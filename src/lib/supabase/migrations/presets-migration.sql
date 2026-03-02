-- ============================================
-- OhShift — Add Shift Presets to Companies
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Add preset time columns to the companies table
alter table public.companies 
add column if not exists morning_start text not null default '08:00',
add column if not exists morning_end text not null default '16:00',
add column if not exists evening_start text not null default '16:00',
add column if not exists evening_end text not null default '00:00';

-- 2. Add an UPDATE policy so owners and managers can save new preset times 
-- (companies table only had SELECT and INSERT policies previously)
drop policy if exists "Company managers can update their company" on public.companies;

create policy "Company managers can update their company"
  on public.companies for update
  using (
    id in (
      select company_id from public.users where id = auth.uid() and role in ('owner', 'manager')
    )
  );
