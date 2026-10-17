-- Where each item was bought, its tax-free percentage, and whether the
-- tax-free refund has been received.
alter table public.gh_order_items
  add column if not exists purchase_place text
    check (purchase_place in ('boutique_eu','airport','dubai','other')),
  add column if not exists tax_free_pct numeric(5,2),
  add column if not exists tax_free_received boolean not null default false;
