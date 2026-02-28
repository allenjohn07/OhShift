import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured on the server." },
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

    // 3. Generate a secure invitation code / password
    // Using a random alphanumeric string (8 chars)
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const supabaseAdmin = createAdminClient();

    // 4. Create the new user using the admin client (bypasses Auth restrictions)
    const { data: newAuthUser, error: newAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: inviteCode,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

    if (newAuthError) {
      // Return 400 specifically for user already exists
      if (newAuthError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "A user with this email already exists." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: newAuthError.message },
        { status: 400 }
      );
    }

    if (!newAuthUser.user) {
      return NextResponse.json(
        { error: "Failed to create user in authentication system" },
        { status: 500 }
      );
    }

    // 5. Insert employee into the "users" table
    const { error: dbError } = await supabaseAdmin.from("users").insert({
      id: newAuthUser.user.id,
      email: email,
      full_name: name,
      role: "employee",
      company_id: companyId,
    });

    if (dbError) {
      // If DB fails, we should ideally cleanup the auth user, but for now just return error
      return NextResponse.json(
        { error: "Failed to create employee record" },
        { status: 500 }
      );
    }

    // 6. Send the invitation email with Resend
    // By default on free tier, Resend uses onboarding@resend.dev as the 'from' address
    const { error: emailError } = await resend.emails.send({
      from: "OhShift Invitations <onboarding@resend.dev>",
      to: [email],
      subject: `You've been invited to join ${companyName} on OhShift`,
      html: `
        <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
          <h2 style="color: #333 text-xl font-bold">Welcome to OhShift!</h2>
          <p style="color: #555 mt-4">Hi ${name},</p>
          <p style="color: #555 mt-2">You have been invited by <strong>${senderProfile.full_name}</strong> to join the team at <strong>${companyName}</strong> on OhShift, your team scheduling platform.</p>
          
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

    if (emailError) {
      console.error("Resend Email Error:", emailError);
      return NextResponse.json(
        { error: "User created, but failed to send email. Check Resend logs." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Employee invited successfully" });
  } catch (err: any) {
    console.error("Invite Employee Exception:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
