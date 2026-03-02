-- ============================================
-- OhShift — Fix Users RLS Policy
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Drop the old overly restrictive policies
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can view members of their company" on public.users;
drop policy if exists "Users can view profiles in their company" on public.users;

-- 1. Everyone can see their own profile
create policy "Users can view their own profile"
  on public.users for select
  using (id = auth.uid());

-- 2. Create a security definer function to safely get the current user's company_id
-- This prevents the "infinite recursion" error that happens if you query the users table
-- within a policy on the users table.
create or replace function public.get_my_company_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select company_id from users where id = auth.uid();
$$;

-- 3. Allow users to see other users in the same company
create policy "Users can view company members"
  on public.users for select
  using (
    company_id = public.get_my_company_id()
  );
