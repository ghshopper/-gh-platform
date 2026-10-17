-- GH Shopper (gh_ prefix keeps it apart from the salon tables in this project): customers, orders, items, payments, purchase invoices.
-- Every row belongs to the signed-in user (owner) and is protected by RLS.

create table public.gh_customers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  city text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.gh_purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  store text not null,
  invoice_no text,
  purchased_on date not null default current_date,
  country text,
  currency text not null default 'EUR',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  total_amount numeric(14,3) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.gh_orders (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_no bigint generated always as identity,
  customer_id uuid not null references public.gh_customers(id) on delete restrict,
  trip text,
  delivery_fee numeric(14,3) not null default 0 check (delivery_fee >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.gh_order_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.gh_orders(id) on delete cascade,
  name text not null,
  details text,
  price numeric(14,3) not null default 0 check (price >= 0),
  status text not null default 'requested'
    check (status in ('requested','purchased','arrived','delivered','cancelled')),
  purchase_invoice_id uuid references public.gh_purchase_invoices(id) on delete set null,
  cost_amount numeric(14,3),
  cost_currency text,
  cost_rate numeric(14,6),
  purchased_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gh_payments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references public.gh_orders(id) on delete cascade,
  amount numeric(14,3) not null check (amount > 0),
  method text,
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index on public.gh_customers (owner);
create index on public.gh_purchase_invoices (owner);
create index on public.gh_orders (owner);
create index on public.gh_orders (customer_id);
create index on public.gh_order_items (owner);
create index on public.gh_order_items (order_id);
create index on public.gh_order_items (purchase_invoice_id);
create index on public.gh_order_items (status);
create index on public.gh_payments (owner);
create index on public.gh_payments (order_id);

alter table public.gh_customers enable row level security;
alter table public.gh_purchase_invoices enable row level security;
alter table public.gh_orders enable row level security;
alter table public.gh_order_items enable row level security;
alter table public.gh_payments enable row level security;

create policy "gh own customers" on public.gh_customers for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "gh own purchase invoices" on public.gh_purchase_invoices for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "gh own orders" on public.gh_orders for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "gh own order items" on public.gh_order_items for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "gh own payments" on public.gh_payments for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
