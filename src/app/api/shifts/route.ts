import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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
      .select("company_id")
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
