-- Expenses can belong to a trip or be general business expenses (ads, packaging…).
alter table public.gh_trip_expenses alter column trip_id drop not null;
