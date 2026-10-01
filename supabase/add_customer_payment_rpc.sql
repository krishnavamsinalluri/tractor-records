-- Run once in Supabase Dashboard > SQL Editor.
-- Adds atomic, oldest-first customer payment allocation with idempotent retries.

begin;

alter table public.payments
  add column if not exists payment_request_id uuid;

create unique index if not exists payments_request_work_unique
  on public.payments (user_id, payment_request_id, work_record_id)
  where payment_request_id is not null;

create index if not exists payments_request_id_idx
  on public.payments (payment_request_id)
  where payment_request_id is not null;

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_request_id uuid
)
returns table (
  allocated_amount numeric,
  remaining_balance numeric,
  allocation_count integer,
  was_duplicate boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric(14,2) := round(p_amount, 2);
  v_customer_balance numeric(14,2);
  v_remaining_payment numeric(14,2);
  v_work_balance numeric(14,2);
  v_allocation numeric(14,2);
  v_paid numeric(14,2);
  v_existing_count integer;
  v_existing_amount numeric(14,2);
  v_existing_date date;
  v_existing_method text;
  v_existing_customer_matches boolean;
  v_allocation_count integer := 0;
  v_work record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_customer_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'Customer and request identifiers are required';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception using errcode = '22023', message = 'Payment amount must be greater than zero';
  end if;
  if p_payment_date is null then
    raise exception using errcode = '22023', message = 'Payment date is required';
  end if;
  if p_method is null or p_method not in ('Cash', 'UPI', 'Bank transfer', 'Other') then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end if;

  -- Serialize retries using the same authenticated user/request identifier.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id::text, 0)
  );

  select
    count(*)::integer,
    coalesce(sum(p.amount), 0)::numeric(14,2),
    min(p.payment_date),
    min(p.method),
    coalesce(bool_and(w.customer_id = p_customer_id), false)
  into
    v_existing_count,
    v_existing_amount,
    v_existing_date,
    v_existing_method,
    v_existing_customer_matches
  from public.payments p
  join public.work_records w on w.id = p.work_record_id
  where p.user_id = v_user_id
    and p.payment_request_id = p_request_id;

  if v_existing_count > 0 then
    if not v_existing_customer_matches
      or v_existing_amount <> v_amount
      or v_existing_date is distinct from p_payment_date
      or v_existing_method is distinct from p_method then
      raise exception using errcode = '22023', message = 'Idempotency identifier was already used with different payment details';
    end if;

    select coalesce(sum(greatest(w.total - coalesce(paid.amount, 0), 0)), 0)::numeric(14,2)
      into v_customer_balance
    from public.work_records w
    left join (
      select p2.work_record_id, sum(p2.amount) as amount
      from public.payments p2
      where p2.user_id = v_user_id
      group by p2.work_record_id
    ) paid on paid.work_record_id = w.id
    where w.user_id = v_user_id
      and w.customer_id = p_customer_id;

    return query select v_existing_amount, v_customer_balance, v_existing_count, true;
    return;
  end if;

  -- Lock the customer first. This also serializes different payment requests for
  -- the same customer and prevents a concurrent work insert from being missed.
  perform c.id
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Customer was not found or does not belong to the signed-in user';
  end if;

  -- Lock every affected work row in the same deterministic order before any
  -- balance is recalculated. Direct work-level payments use the same row locks.
  perform w.id
  from public.work_records w
  where w.customer_id = p_customer_id
    and w.user_id = v_user_id
  order by w.work_date, w.created_at, w.id
  for update;

  select coalesce(sum(greatest(w.total - coalesce(paid.amount, 0), 0)), 0)::numeric(14,2)
    into v_customer_balance
  from public.work_records w
  left join (
    select p2.work_record_id, sum(p2.amount) as amount
    from public.payments p2
    where p2.user_id = v_user_id
    group by p2.work_record_id
  ) paid on paid.work_record_id = w.id
  where w.user_id = v_user_id
    and w.customer_id = p_customer_id;

  if v_amount > v_customer_balance then
    raise exception using errcode = '22023', message = 'Payment cannot be greater than the outstanding customer balance';
  end if;

  v_remaining_payment := v_amount;
  for v_work in
    select w.id, w.total
    from public.work_records w
    where w.customer_id = p_customer_id
      and w.user_id = v_user_id
    order by w.work_date, w.created_at, w.id
  loop
    select coalesce(sum(p.amount), 0)::numeric(14,2)
      into v_paid
    from public.payments p
    where p.work_record_id = v_work.id
      and p.user_id = v_user_id;

    v_work_balance := greatest(v_work.total - v_paid, 0);
    if v_work_balance <= 0 then
      continue;
    end if;

    v_allocation := least(v_remaining_payment, v_work_balance);
    insert into public.payments (
      user_id,
      work_record_id,
      payment_date,
      amount,
      method,
      payment_request_id
    ) values (
      v_user_id,
      v_work.id,
      p_payment_date,
      v_allocation,
      p_method,
      p_request_id
    );

    v_allocation_count := v_allocation_count + 1;
    v_remaining_payment := v_remaining_payment - v_allocation;
    exit when v_remaining_payment <= 0;
  end loop;

  if v_remaining_payment > 0 then
    raise exception using errcode = 'P0001', message = 'Payment allocation could not be completed';
  end if;

  v_customer_balance := v_customer_balance - v_amount;
  return query select v_amount, v_customer_balance, v_allocation_count, false;
end;
$$;

revoke all on function public.record_customer_payment(uuid, numeric, date, text, uuid) from public;
revoke all on function public.record_customer_payment(uuid, numeric, date, text, uuid) from anon;
grant execute on function public.record_customer_payment(uuid, numeric, date, text, uuid) to authenticated;

commit;
