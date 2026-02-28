import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Get current session user
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ user: null });
    }

    // 2. Fetch the custom user profile with role
    const { data: profile } = await supabase
      .from("users")
      .select("*, companies(name)")
      .eq("id", authData.user.id)
      .single();

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile,
      },
    });
  } catch {
    return NextResponse.json( // Silently return null user on error so client doesn't break
      { user: null },
      { status: 200 }
    );
  }
}
