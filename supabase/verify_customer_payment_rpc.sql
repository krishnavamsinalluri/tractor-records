-- Optional verification script for Supabase SQL Editor.
-- Prerequisites: add_customer_payment_rpc.sql has run and at least one auth user exists.
-- All fixture rows and payments are rolled back at the end.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users order by created_at limit 1),
  true
);
set local role authenticated;

do $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid := gen_random_uuid();
  v_oldest_work_id uuid := gen_random_uuid();
  v_newer_work_id uuid := gen_random_uuid();
  v_partial_request uuid := gen_random_uuid();
  v_full_request uuid := gen_random_uuid();
  v_result record;
  v_amount numeric;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'No authenticated test user is available';
  end if;

  insert into public.customers (id, user_id, name, phone)
  values (v_customer_id, v_user_id, 'RPC verification ' || v_customer_id::text, null);

  insert into public.work_records (
    id, user_id, customer_id, work_type_id, work_type_name,
    work_date, charge_basis, quantity, rate, created_at
  ) values
    (v_oldest_work_id, v_user_id, v_customer_id, null, 'Oldest test work', '2020-01-01', 'acre', 1, 4000, '2020-01-01 08:00:00+00'),
    (v_newer_work_id, v_user_id, v_customer_id, null, 'Newer test work', '2020-01-02', 'acre', 1, 800, '2020-01-02 08:00:00+00');

  -- Partial payment: only the oldest ₹4,000 work should receive ₹3,000.
  select * into v_result
  from public.record_customer_payment(v_customer_id, 3000, current_date, 'Cash', v_partial_request);
  assert v_result.allocated_amount = 3000, 'Partial allocated amount is incorrect';
  assert v_result.remaining_balance = 1800, 'Partial remaining balance should be 1800';
  assert v_result.allocation_count = 1, 'Partial payment should create one allocation';
  assert not v_result.was_duplicate, 'First partial request must not be a duplicate';

  select coalesce(sum(amount), 0) into v_amount
  from public.payments where work_record_id = v_oldest_work_id;
  assert v_amount = 3000, 'Oldest work did not receive the partial payment';

  select coalesce(sum(amount), 0) into v_amount
  from public.payments where work_record_id = v_newer_work_id;
  assert v_amount = 0, 'Newer work received money before the oldest work';

  -- Same request ID and payload must return the prior result without new rows.
  select * into v_result
  from public.record_customer_payment(v_customer_id, 3000, current_date, 'Cash', v_partial_request);
  assert v_result.was_duplicate, 'Retry was not identified as a duplicate';

  select count(*) into v_count
  from public.payments where payment_request_id = v_partial_request;
  assert v_count = 1, 'Duplicate retry inserted another payment';

  -- Full remaining payment: ₹1,000 finishes the oldest and ₹800 finishes the newer work.
  select * into v_result
  from public.record_customer_payment(v_customer_id, 1800, current_date, 'UPI', v_full_request);
  assert v_result.remaining_balance = 0, 'Full payment did not clear the customer balance';
  assert v_result.allocation_count = 2, 'Full payment should create two allocations';

  select coalesce(sum(amount), 0) into v_amount
  from public.payments where work_record_id = v_oldest_work_id;
  assert v_amount = 4000, 'Oldest work total is incorrect after full payment';

  select coalesce(sum(amount), 0) into v_amount
  from public.payments where work_record_id = v_newer_work_id;
  assert v_amount = 800, 'Newer work total is incorrect after full payment';

  -- A later request cannot overpay a now-cleared customer.
  begin
    perform public.record_customer_payment(v_customer_id, 1, current_date, 'Cash', gen_random_uuid());
    raise exception 'Expected the overpayment request to fail';
  exception
    when sqlstate '22023' then
      null;
  end;
end;
$$;

rollback;
