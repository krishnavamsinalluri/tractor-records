-- Add configurable acre/hour rates to existing work types.
-- Safe to run more than once in Supabase Dashboard > SQL Editor.

alter table public.work_types
  add column if not exists acre_rate numeric(12,2) check (acre_rate is null or acre_rate >= 0),
  add column if not exists hour_rate numeric(12,2) check (hour_rate is null or hour_rate >= 0);
