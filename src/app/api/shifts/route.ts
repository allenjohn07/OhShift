import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  const supabase = await createClient();

  try {
    // 1. Authenticate user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Authorize - only owners and managers can create shifts
    const { data: profile } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!profile.company_id) {
        return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }

    // 3. Parse request body
    const { employeeId, title, startTime, endTime } = await request.json();

    if (!employeeId || !title || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4. Verify employee belongs to the company
    const { data: employee } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", employeeId)
        .single();
    
    if (!employee || employee.company_id !== profile.company_id) {
        return NextResponse.json({ error: "Invalid employee" }, { status: 400 });
    }

    // 5. Insert shift
    const { data: shift, error: insertError } = await supabase
      .from("shifts")
      .insert({
        company_id: profile.company_id,
        employee_id: employeeId,
        title,
        start_time: startTime,
        end_time: endTime,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating shift:", insertError);
      return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
    }

    // 6. Send Email Notification
    if (transporter) {
      const { data: employeeData } = await supabase
        .from("users")
        .select("email, full_name, companies(name)")
        .eq("id", employeeId)
        .single();

      if (employeeData && employeeData.email) {
        const comp = employeeData.companies as any;
        const companyName = comp?.name || (Array.isArray(comp) && comp[0]?.name) || "your company";
        
        try {
          // Format times for email
          const formattedStart = new Date(startTime).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
          });
          const formattedEnd = new Date(endTime).toLocaleString("en-US", {
            hour: "numeric", minute: "2-digit"
          });

          await transporter.sendMail({
            from: `"OhShift Scheduling" <${process.env.SMTP_EMAIL}>`,
            to: employeeData.email,
            subject: `New Shift Assigned: ${title}`,
            html: `
              <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <h2 style="color: #333; font-size: 20px; font-weight: bold;">New Shift Assigned</h2>
                <p style="color: #555; margin-top: 16px;">Hi ${employeeData.full_name || 'there'},</p>
                <p style="color: #555; margin-top: 8px;">You have been assigned a new shift at <strong>${companyName}</strong>.</p>
                
                <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 8px;">
                  <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 16px;">${title}</p>
                  <p style="margin: 8px 0 0; color: #475569; font-size: 15px;">
                    🗓 ${formattedStart} - ${formattedEnd}
                  </p>
                </div>

                <div style="margin-top: 32px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                    View Your Schedule
                  </a>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Failed to send shift assignment email:", emailError);
          // Don't fail the request if email fails, shift was still created
        }
      }
    }
    
    // Revalidate paths so the schedule automatically refreshes
    revalidatePath("/company/dashboard");
    revalidatePath("/dashboard");

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Unexpected error in /api/shifts:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  try {
    // 1. Authenticate user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Authorize - only owners and managers can delete shifts
    const { data: profile } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse query param for shift ID
    const { searchParams } = new URL(request.url);
    const shiftId = searchParams.get("id");

    if (!shiftId) {
      return NextResponse.json({ error: "Missing shift ID" }, { status: 400 });
    }

    // 4. Verify the shift belongs to the user's company
    const { data: existingShift } = await supabase
      .from("shifts")
      .select("company_id, employee_id, title, start_time, end_time")
      .eq("id", shiftId)
      .single();
    
    if (!existingShift || existingShift.company_id !== profile.company_id) {
        return NextResponse.json({ error: "Shift not found or access denied" }, { status: 404 });
    }

    // 5. Delete shift
    const { error: deleteError } = await supabase
      .from("shifts")
      .delete()
      .eq("id", shiftId);

    if (deleteError) {
      console.error("Error deleting shift:", deleteError);
      return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
    }

    // 6. Send Cancellation Email
    if (transporter && existingShift.employee_id) {
      const { data: employeeData } = await supabase
        .from("users")
        .select("email, full_name, companies(name)")
        .eq("id", existingShift.employee_id)
        .single();

      if (employeeData && employeeData.email) {
        const comp = employeeData.companies as any;
        const companyName = comp?.name || (Array.isArray(comp) && comp[0]?.name) || "your company";
        
        try {
          const shiftTitle = existingShift.title || "Unknown Shift";
          // formatting if available
          let timeString = "";
          if (existingShift.start_time && existingShift.end_time) {
             const formattedStart = new Date(existingShift.start_time).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
             });
             const formattedEnd = new Date(existingShift.end_time).toLocaleString("en-US", {
                hour: "numeric", minute: "2-digit"
             });
             timeString = `<p style="margin: 8px 0 0; color: #475569; font-size: 15px;">🗓 ${formattedStart} - ${formattedEnd}</p>`;
          }

          await transporter.sendMail({
            from: `"OhShift Scheduling" <${process.env.SMTP_EMAIL}>`,
            to: employeeData.email,
            subject: `Shift Cancelled: ${shiftTitle}`,
            html: `
              <div style="font-family: sans-serif; max-w-xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <h2 style="color: #dc2626; font-size: 20px; font-weight: bold;">Shift Cancelled</h2>
                <p style="color: #555; margin-top: 16px;">Hi ${employeeData.full_name || 'there'},</p>
                <p style="color: #555; margin-top: 8px;">A shift previously assigned to you at <strong>${companyName}</strong> has been cancelled and removed from your schedule.</p>
                
                <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                  <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 16px;"><span style="text-decoration: line-through;">${shiftTitle}</span></p>
                  ${timeString}
                </div>

                <div style="margin-top: 32px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                    View Your Updated Schedule
                  </a>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Failed to send shift cancellation email:", emailError);
        }
      }
    }
    
    // Revalidate paths so the schedule automatically refreshes
    revalidatePath("/company/dashboard");
    revalidatePath("/dashboard");

    return NextResponse.json({ message: "Shift deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in /api/shifts DELETE:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();

  try {
    // 1. Authenticate user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Authorize - only owners and managers can edit shifts
    const { data: profile } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse request body
    const { shiftId, title, startTime, endTime } = await request.json();

    if (!shiftId || !title || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4. Verify the shift belongs to the user's company
    const { data: existingShift } = await supabase
      .from("shifts")
      .select("company_id")
      .eq("id", shiftId)
      .single();
    
    if (!existingShift || existingShift.company_id !== profile.company_id) {
        return NextResponse.json({ error: "Shift not found or access denied" }, { status: 404 });
    }

    // 5. Update shift
    const { data: shift, error: updateError } = await supabase
      .from("shifts")
      .update({
        title,
        start_time: startTime,
        end_time: endTime,
      })
      .eq("id", shiftId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating shift:", updateError);
      return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
    }
    
    // Revalidate paths so the schedule automatically refreshes
    revalidatePath("/company/dashboard");
    revalidatePath("/dashboard");

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Unexpected error in /api/shifts PUT:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
