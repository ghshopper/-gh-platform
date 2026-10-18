-- Tracking page: business contact for the WhatsApp button, and the driver's
-- name and phone while an order is out for delivery.
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
    'phone', s.phone,
    'instagram', s.instagram,
    'driver_status', o.driver_status,
    'delivered_at', o.driver_delivered_at,
    'driver', case
      when d.id is not null and d.active
       and o.driver_status in ('assigned', 'picked')
      then jsonb_build_object('name', split_part(d.name, ' ', 1), 'phone', d.phone)
    end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'brand', i.brand,
                                          'status', i.status)
                       order by i.created_at)
      from public.gh_order_items i
      where i.order_id = o.id and i.status <> 'cancelled'
    ), '[]'::jsonb)
  )
  from public.gh_orders o
  left join public.gh_customers c on c.id = o.customer_id
  left join public.gh_settings s on s.owner = o.owner
  left join public.gh_drivers d on d.id = o.driver_id
  where o.tracking_token = p_token
$$;

revoke all on function public.gh_track(uuid) from public;
grant execute on function public.gh_track(uuid) to anon, authenticated;
