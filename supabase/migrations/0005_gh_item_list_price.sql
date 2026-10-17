-- Selling price as quoted in a foreign currency (EUR / AED) plus the commission used.
alter table gh_order_items
  add column if not exists list_price numeric(12,2),
  add column if not exists list_currency text,
  add column if not exists commission_pct numeric(6,2);
