import { createClient } from "@/lib/supabase/server";
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

    const updates = await request.json();
    const { morning_start, morning_end, evening_start, evening_end } = updates;

    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update({
        morning_start: morning_start || "08:00",
        morning_end: morning_end || "16:00",
        evening_start: evening_start || "16:00",
        evening_end: evening_end || "00:00",
      })
      .eq("id", profile.company_id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update company settings", updateError);
      return NextResponse.json({ error: "Failed to update company settings" }, { status: 500 });
    }
    
    // Auto-refresh the dashboard with the new global preset times
    revalidatePath("/company/dashboard");

    return NextResponse.json({ company: updatedCompany });
  } catch (error) {
    console.error("Internal Server Error in /api/company:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
