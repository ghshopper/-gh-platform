-- Customer gender (for message wording) and per-user business settings
-- shown on invoices (company name, commercial registration, contacts…).
alter table public.gh_customers
  add column if not exists gender text not null default 'f' check (gender in ('f','m'));

create table if not exists public.gh_settings (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  company_name text,
  company_name_en text,
  cr_number text,
  phone text,
  instagram text,
  address text,
  bank_details text,
  invoice_note text,
  updated_at timestamptz not null default now()
);

alter table public.gh_settings enable row level security;

create policy "gh own settings" on public.gh_settings for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
