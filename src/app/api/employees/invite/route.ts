import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD 
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

export async function POST(request: Request) {
  try {
    const { invites } = await request.json();

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json(
        { error: "At least one invitee is required." },
        { status: 400 }
      );
    }

    if (!transporter) {
      return NextResponse.json(
        { error: "SMTP_EMAIL or SMTP_PASSWORD is not configured on the server." },
        { status: 500 }
      );
    }

    // 1. Verify Authentication of the sender
    const supabaseSession = await createClient();
    const { data: authData, error: authError } = await supabaseSession.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch sender profile and check authorization
    const { data: senderProfile } = await supabaseSession
      .from("users")
      .select("*, companies(name)")
      .eq("id", authData.user.id)
      .single();

    if (!senderProfile || !["owner", "manager"].includes(senderProfile.role)) {
      return NextResponse.json(
        { error: "Only owners or managers can invite employees." },
        { status: 403 }
      );
    }

    const companyId = senderProfile.company_id;
    const companyName = senderProfile.companies?.name || "the company";

    const supabaseAdmin = createAdminClient();
    
    let successCount = 0;
    let inviteErrors: string[] = [];

    // Process each invite sequentially
    for (const invite of invites) {
      const email = invite.email.trim();
      const fullName = invite.fullName.trim();
      const designation = invite.designation?.trim() || null;
      
      try {
        // 3. Generate a secure invitation code / password
        const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        // 4. Create the new user
        const { data: newAuthUser, error: newAuthError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: inviteCode,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
            },
          });

        if (newAuthError) {
          console.error("Auth Error:", newAuthError);
          inviteErrors.push(`${email}: ${newAuthError.message.includes("already registered") ? "Already exists" : newAuthError.message}`);
          continue;
        }

        if (!newAuthUser.user) {
          inviteErrors.push(`${email}: Failed to create user in auth system`);
          continue;
        }

        // 5. Insert employee into the "users" table
        const { error: dbError } = await supabaseAdmin.from("users").insert({
          id: newAuthUser.user.id,
          email: email,
          full_name: fullName,
          role: "employee",
          company_id: companyId,
          designation: designation,
        });

        if (dbError) {
          console.error("DB Error for", email, ":", dbError);
          inviteErrors.push(`${email}: Failed to create profile record`);
          continue;
        }

        // 6. Send the invitation email with Nodemailer
        try {
          await transporter.sendMail({
            from: `"OhShift Invitations" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: `You've been invited to join ${companyName} on OhShift`,
            html: `
            <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <h2 style="color: #333 text-xl font-bold">Welcome to OhShift!</h2>
              <p style="color: #555 mt-4">Hi ${fullName},</p>
              <p style="color: #555 mt-2">You have been invited by <strong>${senderProfile.full_name}</strong> to join the team at <strong>${companyName}</strong> on OhShift.
              
              <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">Your secure invitation code (password):</p>
                <p style="margin: 8px 0 0; font-size: 24px; font-weight: bold; font-family: monospace; color: #0f172a; letter-spacing: 2px;">
                  ${inviteCode}
                </p>
              </div>

              <p style="color: #555 mt-6">Use this email address along with the invitation code above to log in to your employee portal.</p>
              
              <div style="margin-top: 32px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                  Log in to your account
                </a>
              </div>

              <p style="color: #888; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
          });
        } catch (emailError: any) {
          console.error("Nodemailer Email Error for", email, emailError);
          inviteErrors.push(`${email}: User created, but email invite failed to send.`);
          // We don't continue here since the user was actually created, just the email failed.
        }

        successCount++;
      } catch (err: any) {
        inviteErrors.push(`${email}: Unexpected error processing invite`);
      }
    }

    if (successCount === 0) {
      return NextResponse.json(
        { error: "Failed to invite any employees.", details: inviteErrors },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      message: `Successfully invited ${successCount} employee(s).`,
      errors: inviteErrors.length > 0 ? inviteErrors : undefined
    });
  } catch (err: any) {
    console.error("Invite Employee Exception:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
