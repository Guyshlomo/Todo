-- Atomic create + persist validity dates (start/end) in one RPC.
-- This avoids cases where a follow-up UPDATE is blocked by RLS or schema cache timing.
--
-- Requires existing function:
--   public.create_group_with_challenge(p_group_name text, p_group_icon text, p_challenge_name text, p_goal int, p_type text, p_frequency text) returns uuid
--
-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema.

create or replace function public.create_group_with_challenge_v2(
  p_group_name text,
  p_group_icon text,
  p_challenge_name text,
  p_goal int,
  p_type text,
  p_frequency text,
  p_start_date date,
  p_end_date date,
  p_reminder_enabled boolean default true,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_challenge_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_group_id := public.create_group_with_challenge(
    p_group_name := p_group_name,
    p_group_icon := p_group_icon,
    p_challenge_name := p_challenge_name,
    p_goal := p_goal,
    p_type := p_type,
    p_frequency := p_frequency
  );

  select id into v_challenge_id
  from public.challenges
  where group_id = v_group_id
  limit 1;

  if v_challenge_id is null then
    raise exception 'challenge row not found for created group';
  end if;

  update public.challenges
  set
    start_date = p_start_date,
    end_date = p_end_date,
    reminder_enabled = coalesce(p_reminder_enabled, true),
    description = p_description
  where id = v_challenge_id;

  return v_group_id;
end;
$$;

revoke all on function public.create_group_with_challenge_v2(
  text, text, text, int, text, text, date, date, boolean, text
) from public;
grant execute on function public.create_group_with_challenge_v2(
  text, text, text, int, text, text, date, date, boolean, text
) to authenticated;

select pg_notify('pgrst', 'reload schema');


