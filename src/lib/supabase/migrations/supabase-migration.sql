-- ============================================
-- OhShift — Initial Tables: companies & users
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Companies table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2. Users (profiles) table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'employee')),
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Grant table permissions
grant all on public.companies to anon, authenticated, service_role;
grant all on public.users to anon, authenticated, service_role;

-- 3. Enable Row Level Security
alter table public.companies enable row level security;
alter table public.users enable row level security;

-- 4. RLS Policies for companies
create policy "Users can view their own company"
  on public.companies for select
  using (owner_id = auth.uid());

create policy "Authenticated users can insert companies"
  on public.companies for insert
  with check (auth.role() = 'authenticated');

-- 5. RLS Policies for users
create policy "Users can view their own profile"
  on public.users for select
  using (id = auth.uid());

create policy "Authenticated users can insert their profile"
  on public.users for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.users for update
  using (id = auth.uid());
