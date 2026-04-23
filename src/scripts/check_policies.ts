import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('run_sql', { sql: "select policyname, cmd, qual, with_check from pg_policies where tablename = 'shifts';" });
  if (error) {
     console.error("RPC error (might not exist):", error);
  } else {
     console.log(data);
  }
}
main();
