-- Tractor Records database setup
-- Run this entire file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now()
);

create unique index if not exists customers_user_name_unique
  on public.customers (user_id, lower(name));

create table if not exists public.work_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  acre_rate numeric(12,2) check (acre_rate is null or acre_rate >= 0),
  hour_rate numeric(12,2) check (hour_rate is null or hour_rate >= 0),
  created_at timestamptz not null default now()
);

alter table public.work_types
  add column if not exists acre_rate numeric(12,2) check (acre_rate is null or acre_rate >= 0),
  add column if not exists hour_rate numeric(12,2) check (hour_rate is null or hour_rate >= 0);

create unique index if not exists work_types_user_name_unique
  on public.work_types (user_id, lower(name));

create table if not exists public.work_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  work_type_id uuid references public.work_types(id) on delete set null,
  work_type_name text not null check (length(trim(work_type_name)) > 0),
  work_date date not null default current_date,
  charge_basis text not null check (charge_basis in ('hour', 'acre')),
  quantity numeric(12,2) not null check (quantity > 0),
  rate numeric(12,2) not null check (rate >= 0),
  total numeric(14,2) generated always as (round(quantity * rate, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_record_id uuid not null references public.work_records(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('Cash', 'UPI', 'Bank transfer', 'Other')),
  created_at timestamptz not null default now()
);

create index if not exists customers_user_id_idx on public.customers(user_id);
create index if not exists work_types_user_id_idx on public.work_types(user_id);
create index if not exists work_records_user_date_idx on public.work_records(user_id, work_date desc);
create index if not exists payments_work_id_idx on public.payments(work_record_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_records_updated_at on public.work_records;
create trigger set_work_records_updated_at
  before update on public.work_records
  for each row execute function public.set_updated_at();

create or replace function public.validate_record_owner()
returns trigger language plpgsql set search_path = '' as $$
declare
  customer_owner uuid;
  type_owner uuid;
begin
  select user_id into customer_owner from public.customers where id = new.customer_id;
  if customer_owner is distinct from new.user_id then
    raise exception 'Customer must belong to the signed-in user';
  end if;
  if new.work_type_id is not null then
    select user_id into type_owner from public.work_types where id = new.work_type_id;
    if type_owner is distinct from new.user_id then
      raise exception 'Work type must belong to the signed-in user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_record_owner on public.work_records;
create trigger validate_record_owner
  before insert or update on public.work_records
  for each row execute function public.validate_record_owner();

create or replace function public.validate_work_total()
returns trigger language plpgsql set search_path = '' as $$
declare
  amount_paid numeric;
begin
  if tg_op = 'UPDATE' then
    select coalesce(sum(amount), 0) into amount_paid
      from public.payments where work_record_id = old.id;
    if round(new.quantity * new.rate, 2) < amount_paid then
      raise exception 'Work total cannot be less than payments already received';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_work_total on public.work_records;
create trigger validate_work_total
  before update on public.work_records
  for each row execute function public.validate_work_total();

create or replace function public.validate_payment()
returns trigger language plpgsql set search_path = '' as $$
declare
  record_owner uuid;
  record_total numeric;
  other_payments numeric;
begin
  select user_id, total into record_owner, record_total
    from public.work_records where id = new.work_record_id for update;
  if record_owner is null or record_owner is distinct from new.user_id then
    raise exception 'Work record must belong to the signed-in user';
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(sum(amount), 0) into other_payments
      from public.payments
      where work_record_id = new.work_record_id and id <> old.id;
  else
    select coalesce(sum(amount), 0) into other_payments
      from public.payments
      where work_record_id = new.work_record_id;
  end if;
  if other_payments + new.amount > record_total then
    raise exception 'Payment cannot be greater than the outstanding balance';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_payment on public.payments;
create trigger validate_payment
  before insert or update on public.payments
  for each row execute function public.validate_payment();

alter table public.customers enable row level security;
alter table public.work_types enable row level security;
alter table public.work_records enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Users manage own customers" on public.customers;
create policy "Users manage own customers" on public.customers
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own work types" on public.work_types;
create policy "Users manage own work types" on public.work_types
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own work records" on public.work_records;
create policy "Users manage own work records" on public.work_records
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own payments" on public.payments;
create policy "Users manage own payments" on public.payments
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Give every newly-created account a useful starting list of work types.
create or replace function public.add_default_work_types()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.work_types (user_id, name) values
    (new.id, 'Ploughing / దుక్కి'),
    (new.id, 'Cultivator / కల్టివేటర్'),
    (new.id, 'Rotavator / రోటావేటర్'),
    (new.id, 'Transport / రవాణా');
  return new;
end;
$$;

drop trigger if exists add_default_work_types_after_signup on auth.users;
create trigger add_default_work_types_after_signup
  after insert on auth.users
  for each row execute function public.add_default_work_types();

-- If the login account already existed before this script was run, add defaults once:
insert into public.work_types (user_id, name)
select u.id, seed.name
from auth.users u
cross join (values
  ('Ploughing / దుక్కి'),
  ('Cultivator / కల్టివేటర్'),
  ('Rotavator / రోటావేటర్'),
  ('Transport / రవాణా')
) as seed(name)
on conflict do nothing;
