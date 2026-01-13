-- Add challenge validity + reminder columns to public.challenges
-- Run this in Supabase SQL editor (project -> SQL -> New query).

alter table public.challenges
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists description text;

-- Optional: if you already have challenges and want a safe default validity,
-- set start_date/end_date only when they are NULL.
-- update public.challenges
-- set start_date = current_date,
--     end_date = current_date + interval '7 days'
-- where start_date is null or end_date is null;

-- Refresh PostgREST schema cache so the app can immediately use the new columns.
-- (If this fails, just restart the API from Supabase dashboard or wait ~1-2 min.)
select pg_notify('pgrst', 'reload schema');


