-- Leaves a group (challenge) for the current authenticated user.
-- Removes only the membership row, not the group/challenge itself.
-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema.

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if to_regclass('public.group_members') is null then
    raise exception 'missing table public.group_members';
  end if;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.leave_group(uuid) from public;
grant execute on function public.leave_group(uuid) to authenticated;

-- Compatibility overload for PostgREST (single json/jsonb argument)
create or replace function public.leave_group(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  v_group_id := nullif(payload->>'p_group_id', '')::uuid;
  if v_group_id is null then
    v_group_id := nullif(payload->>'group_id', '')::uuid;
  end if;
  if v_group_id is null then
    raise exception 'missing group id (expected p_group_id or group_id)';
  end if;

  perform public.leave_group(v_group_id);
end;
$$;

revoke all on function public.leave_group(jsonb) from public;
grant execute on function public.leave_group(jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');


