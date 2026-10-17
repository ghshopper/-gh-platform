-- Trips and trip expenses, item brand/photos, order tracking links.
create table if not exists public.gh_trips (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.gh_trip_expenses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid not null references public.gh_trips(id) on delete cascade,
  title text not null,
  amount numeric(14,3) not null default 0 check (amount >= 0),
  currency text not null default 'OMR',
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.gh_orders
  add column if not exists trip_id uuid references public.gh_trips(id) on delete set null,
  add column if not exists tracking_token uuid not null default gen_random_uuid();
create unique index if not exists gh_orders_tracking_token_key on public.gh_orders (tracking_token);

alter table public.gh_order_items
  add column if not exists brand text,
  add column if not exists photo_path text,
  add column if not exists receipt_path text;

create index if not exists gh_trips_owner_idx on public.gh_trips (owner);
create index if not exists gh_trip_expenses_owner_idx on public.gh_trip_expenses (owner);
create index if not exists gh_trip_expenses_trip_idx on public.gh_trip_expenses (trip_id);
create index if not exists gh_orders_trip_idx on public.gh_orders (trip_id);

alter table public.gh_trips enable row level security;
alter table public.gh_trip_expenses enable row level security;

create policy "gh own trips" on public.gh_trips for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "gh own trip expenses" on public.gh_trip_expenses for all to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

insert into storage.buckets (id, name, public)
values ('gh-photos', 'gh-photos', false)
on conflict (id) do nothing;

create policy "gh photos own read" on storage.objects for select to authenticated
  using (bucket_id = 'gh-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gh photos own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'gh-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gh photos own update" on storage.objects for update to authenticated
  using (bucket_id = 'gh-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "gh photos own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gh-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.gh_track(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_no', o.order_no,
    'created_at', o.created_at,
    'customer', split_part(coalesce(c.name, ''), ' ', 1),
    'company', s.company_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'brand', i.brand, 'status', i.status)
                       order by i.created_at)
      from public.gh_order_items i
      where i.order_id = o.id and i.status <> 'cancelled'
    ), '[]'::jsonb)
  )
  from public.gh_orders o
  left join public.gh_customers c on c.id = o.customer_id
  left join public.gh_settings s on s.owner = o.owner
  where o.tracking_token = p_token
$$;

revoke all on function public.gh_track(uuid) from public;
grant execute on function public.gh_track(uuid) to anon, authenticated;
