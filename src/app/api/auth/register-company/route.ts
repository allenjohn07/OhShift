import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { companyName, name, email, password } = await request.json();

    // Validate input
    if (!companyName || !name || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Create auth user (using admin API with service role)
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 2. Create company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName, owner_id: userId })
      .select()
      .single();

    if (companyError) {
      return NextResponse.json(
        { error: "Failed to create company: " + companyError.message },
        { status: 500 }
      );
    }

    // 3. Create user profile with owner role
    const { error: profileError } = await supabase
      .from("users")
      .insert({
        id: userId,
        full_name: name,
        email,
        role: "owner",
        company_id: company.id,
      });

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to create profile: " + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Company registered successfully", companyId: company.id },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
