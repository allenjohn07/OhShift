import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      );
    }

    // Check if user is returned
    if (!authData.user) {
      return NextResponse.json(
        { error: "Login failed: User data not found" },
        { status: 500 }
      );
    }

    // Fetch user profile to get role info
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*, companies(name)")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      // We can still log them in even if profile fetch fails, or return error
      // returning error for now since we usually need profile data
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Login successful",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile,
      },
    });
  } catch (error: any) {
    console.error("Login route error:", error);
    
    // Check if environment variables are missing
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: Missing database connection details." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
