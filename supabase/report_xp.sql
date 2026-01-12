-- Todo MVP: +10 XP per report, stored per report and summed per user.
-- Paste this in Supabase SQL Editor.

-- 1) Ensure per-report XP columns exist
alter table public.reports
  add column if not exists points_earned integer;

alter table public.reports
  alter column points_earned set default 10;

-- Running total after this report (10,20,30...)
alter table public.reports
  add column if not exists total_points_after integer;

-- Make it not null if you want strictness (safe once existing rows are updated)
-- update public.reports set points_earned = 10 where points_earned is null;
-- alter table public.reports alter column points_earned set not null;

-- Optional: enforce no negative XP
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_points_earned_nonnegative'
  ) then
    alter table public.reports
      add constraint reports_points_earned_nonnegative check (points_earned >= 0);
  end if;
end $$;

-- 2) Ensure running total exists on users
alter table public.users
  add column if not exists total_points integer;

update public.users set total_points = 0 where total_points is null;

alter table public.users
  alter column total_points set default 0;

-- 3) Trigger: BEFORE INSERT on reports:
-- - set points_earned default if missing
-- - compute total_points_after (10,20,30...)
-- - update users.total_points atomically
create or replace function public.apply_report_points_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_total integer;
  earned integer;
begin
  earned := coalesce(new.points_earned, 10);
  new.points_earned := earned;

  -- Lock user row to avoid race conditions on concurrent reports
  select coalesce(total_points, 0)
    into current_total
  from public.users
  where id = new.user_id
  for update;

  new.total_points_after := current_total + earned;

  update public.users
  set total_points = new.total_points_after
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_increment_user_points_on_report_insert on public.reports;
drop trigger if exists trg_apply_report_points_before_insert on public.reports;

create trigger trg_apply_report_points_before_insert
before insert on public.reports
for each row
execute function public.apply_report_points_before_insert();

-- 4) Optional backfill for existing rows: fills total_points_after per user in created_at order
-- Run this once after deploying, if you already have reports.
-- It does NOT change points_earned (still 10 each), only populates total_points_after.
--
-- with ordered as (
--   select
--     id,
--     user_id,
--     sum(coalesce(points_earned, 10)) over (partition by user_id order by created_at asc) as running_total
--   from public.reports
-- )
-- update public.reports r
-- set total_points_after = o.running_total
-- from ordered o
-- where r.id = o.id;


