import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin client using the service role key — bypasses RLS.
// Only use this in trusted server-side API routes (never expose to the browser).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

