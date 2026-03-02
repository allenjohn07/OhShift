import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function PUT(request: Request) {
  const supabase = await createClient();

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { employeeId, designation } = await request.json();

    if (!employeeId) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    // Verify employee belongs to the company
    const { data: employee } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", employeeId)
      .single();

    if (!employee || employee.company_id !== profile.company_id) {
        return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 });
    }

    const { data: updatedEmployee, error: updateError } = await supabase
      .from("users")
      .update({ designation: designation || null })
      .eq("id", employeeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
    }
    
    revalidatePath("/company/dashboard");

    return NextResponse.json({ employee: updatedEmployee });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, company_id")
      .eq("id", authData.user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("id");

    if (!employeeId) {
      return NextResponse.json({ error: "Missing employee ID" }, { status: 400 });
    }

    // Verify employee belongs to the company and isn't the owner
    const { data: employee } = await supabase
      .from("users")
      .select("company_id, role")
      .eq("id", employeeId)
      .single();
    
    if (!employee || employee.company_id !== profile.company_id) {
        return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 });
    }

    if (employee.role === "owner") {
        return NextResponse.json({ error: "Cannot remove company owner" }, { status: 403 });
    }

    // Delete auth user securely using Supabase admin - this should cascade to 'users' table
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employeeId);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove employee" }, { status: 500 });
    }
    
    revalidatePath("/company/dashboard");

    return NextResponse.json({ message: "Employee removed successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
