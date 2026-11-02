-- MoneyTrack relational storage migration
-- Run in Supabase SQL editor. Existing auth-user metadata may be migrated separately.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  month date not null default date_trunc('month', current_date)::date,
  amount numeric(14,2) not null check (amount > 0),
  rollover_enabled boolean not null default false,
  unique (user_id, category, month)
);

create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '-',
  frequency text not null check (frequency in ('weekly', 'monthly')),
  next_date date not null,
  day_of_month integer check (day_of_month between 1 and 31),
  reminder_days integer not null default 0 check (reminder_days between 0 and 31),
  pending_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'expense' check (type in ('income', 'expense')),
  unique (user_id, lower(name))
);

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_template_id uuid references public.recurring_templates(id) on delete cascade,
  delivery_date date not null,
  channel text not null default 'email',
  delivered_at timestamptz not null default now(),
  unique (user_id, recurring_template_id, delivery_date, channel)
);

alter table public.budgets enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.savings_goals enable row level security;
alter table public.custom_categories enable row level security;
alter table public.reminder_deliveries enable row level security;

drop policy if exists budgets_owner_all on public.budgets;
drop policy if exists recurring_owner_all on public.recurring_templates;
drop policy if exists savings_owner_all on public.savings_goals;
drop policy if exists categories_owner_all on public.custom_categories;
drop policy if exists reminder_owner_all on public.reminder_deliveries;
create policy budgets_owner_all on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_owner_all on public.recurring_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy savings_owner_all on public.savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy categories_owner_all on public.custom_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reminder_owner_all on public.reminder_deliveries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Transactions ownership policy (run even if it already exists)
drop policy if exists transactions_owner_all on public.transactions;
create policy transactions_owner_all on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.transactions enable row level security;
