import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Check if the user exists in our database
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, role")
      .eq("email", email)
      .single();

    if (checkError || !existingUser) {
      return NextResponse.json(
        { error: "No account found with that email address" },
        { status: 404 }
      );
    }

    // 2. Generate a secure temporary password
    const tempPassword = Math.random().toString(36).substring(2, 10).toUpperCase();

    // 3. Update their password in Supabase Auth via Admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Admin Update Error:", updateError);
      return NextResponse.json(
        { error: "Failed to reset password in system." },
        { status: 500 }
      );
    }

    // 4. Send this new temporary password to the user via Resend
    const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${
      existingUser.role === "owner" ? "/company/login" : "/login"
    }`;

    const { error: emailError } = await resend.emails.send({
      from: "OhShift Support <onboarding@resend.dev>",
      to: [email],
      subject: `Your Password Reset Request - OhShift`,
      html: `
        <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
          <h2 style="color: #333 text-xl font-bold">Password Reset</h2>
          <p style="color: #555 mt-4">Hi ${existingUser.full_name || 'there'},</p>
          <p style="color: #555 mt-2">We received a request to reset your password for OhShift.</p>
          
          <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">Your temporary password:</p>
            <p style="margin: 8px 0 0; font-size: 24px; font-weight: bold; font-family: monospace; color: #0f172a; letter-spacing: 2px;">
              ${tempPassword}
            </p>
          </div>

          <p style="color: #555 mt-6">Use this temporary password to log in, and be sure to change it immediately in your profile dashboard.</p>
          
          <div style="margin-top: 32px;">
            <a href="${loginLink}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
              Log in to your account
            </a>
          </div>

          <p style="color: #888; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            If you did not request this reset, please contact your manager or support immediately.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend Email Error:", emailError);
      return NextResponse.json(
        { error: emailError.message || "Password was reset but failed to send the email." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Password reset email sent successfully",
    });
  } catch (error: any) {
    console.error("Reset password route error:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
