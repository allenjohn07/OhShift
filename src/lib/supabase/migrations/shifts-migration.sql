-- ============================================
-- OhShift — Shifts Table Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Shifts table
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now()
);

-- 2. Grant table permissions
grant all on public.shifts to anon, authenticated, service_role;

-- 3. Enable Row Level Security
alter table public.shifts enable row level security;

-- 4. RLS Policies for shifts
-- Company owners/managers can view and manage shifts for their company
create policy "Company members can view shifts"
  on public.shifts for select
  using (
    company_id in (
      select company_id from public.users where id = auth.uid() and role in ('owner', 'manager')
    )
    or
    employee_id = auth.uid()
  );

create policy "Company managers can insert shifts"
  on public.shifts for insert
  with check (
    company_id in (
      select company_id from public.users where id = auth.uid() and role in ('owner', 'manager')
    )
  );

create policy "Company managers can update shifts"
  on public.shifts for update
  using (
    company_id in (
      select company_id from public.users where id = auth.uid() and role in ('owner', 'manager')
    )
  );

create policy "Company managers can delete shifts"
  on public.shifts for delete
  using (
    company_id in (
      select company_id from public.users where id = auth.uid() and role in ('owner', 'manager')
    )
  );
