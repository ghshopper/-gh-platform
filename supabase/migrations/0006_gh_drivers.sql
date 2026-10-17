-- Delivery drivers. A driver logs into the same app with their own account and
-- only ever reaches their assigned orders through the SECURITY DEFINER
-- functions below (no direct table access to orders, prices or customers).

create table if not exists public.gh_drivers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gh_drivers_owner_idx on public.gh_drivers(owner);

alter table public.gh_drivers enable row level security;
create policy "gh own drivers" on public.gh_drivers
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

alter table public.gh_orders
  add column if not exists driver_id uuid references public.gh_drivers(id) on delete set null,
  add column if not exists delivery_address text,
  add column if not exists delivery_collect boolean not null default false,
  add column if not exists driver_status text
    check (driver_status in ('assigned', 'picked', 'delivered')),
  add column if not exists driver_note text,
  add column if not exists delivery_photo_path text,
  add column if not exists driver_delivered_at timestamptz;
create index if not exists gh_orders_driver_idx on public.gh_orders(driver_id);

alter table public.gh_customers add column if not exists address text;

-- Who am I (as a driver)? null for the business owner.
create or replace function public.gh_driver_me()
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object('id', d.id, 'name', d.name, 'phone', d.phone,
                           'active', d.active)
  from gh_drivers d
  where d.user_id = auth.uid();
$$;

-- The calling driver's orders: what to deliver, to whom, and whether to
-- collect the delivery fee. No prices, costs or private notes.
create or replace function public.gh_driver_orders()
returns json
language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(x order by x.sort_at desc), '[]'::json)
  from (
    select o.id,
           o.order_no,
           o.created_at,
           coalesce(o.driver_delivered_at, o.created_at) as sort_at,
           c.name as customer_name,
           c.phone as customer_phone,
           c.city as customer_city,
           coalesce(o.delivery_address, c.address) as address,
           o.delivery_fee,
           o.delivery_collect,
           o.driver_status,
           o.driver_note,
           o.delivery_photo_path,
           o.driver_delivered_at,
           (select coalesce(json_agg(json_build_object(
                     'brand', i.brand, 'name', i.name, 'details', i.details,
                     'status', i.status) order by i.created_at), '[]'::json)
              from gh_order_items i
             where i.order_id = o.id and i.status <> 'cancelled') as items
      from gh_orders o
      join gh_drivers d on d.id = o.driver_id
      join gh_customers c on c.id = o.customer_id
     where d.user_id = auth.uid()
       and d.active
       and (o.driver_status is distinct from 'delivered'
            or o.driver_delivered_at > now() - interval '30 days')
  ) x;
$$;

-- Driver moves an order along: picked -> delivered (with optional photo).
create or replace function public.gh_driver_update(
  p_order uuid, p_status text, p_photo text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_status not in ('picked', 'delivered') then
    raise exception 'invalid status';
  end if;
  select true into v_ok
    from gh_orders o join gh_drivers d on d.id = o.driver_id
   where o.id = p_order and d.user_id = auth.uid() and d.active;
  if v_ok is null then
    raise exception 'not your order';
  end if;
  if p_photo is not null
     and split_part(p_photo, '/', 1) <> auth.uid()::text then
    raise exception 'invalid photo path';
  end if;

  update gh_orders
     set driver_status = p_status,
         delivery_photo_path = coalesce(p_photo, delivery_photo_path),
         driver_delivered_at = case when p_status = 'delivered' then now()
                                    else driver_delivered_at end
   where id = p_order;

  if p_status = 'delivered' then
    update gh_order_items
       set status = 'delivered',
           purchased_at = coalesce(purchased_at, now()),
           arrived_at = coalesce(arrived_at, now()),
           delivered_at = coalesce(delivered_at, now())
     where order_id = p_order and status <> 'cancelled';
  end if;
end;
$$;

revoke all on function public.gh_driver_me() from public, anon;
revoke all on function public.gh_driver_orders() from public, anon;
revoke all on function public.gh_driver_update(uuid, text, text) from public, anon;
grant execute on function public.gh_driver_me() to authenticated;
grant execute on function public.gh_driver_orders() to authenticated;
grant execute on function public.gh_driver_update(uuid, text, text) to authenticated;

-- The owner can view delivery photos their drivers uploaded.
create policy "gh photos owner reads driver photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gh-photos'
    and exists (
      select 1 from public.gh_drivers d
       where d.owner = (select auth.uid())
         and d.user_id::text = (storage.foldername(name))[1]
    )
  );
