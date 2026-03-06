import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { avatarUrl } = await request.json();

    if (!avatarUrl) {
      return NextResponse.json(
        { error: "Avatar URL is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Verify Authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const supabaseAdmin = createAdminClient();

    // 2. Update the user's avatar_url in the auth.users metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { user_metadata: { avatar_url: avatarUrl } }
    );

    if (updateError) {
      console.error("Avatar Update Error:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update profile picture" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Profile picture updated successfully",
    });
  } catch (error: any) {
    console.error("Update avatar route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
