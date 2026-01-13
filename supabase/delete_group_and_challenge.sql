-- Deletes a group + its single MVP challenge and related data.
-- Run in Supabase SQL Editor.
--
-- Expected tables (MVP):
-- - public.groups (id uuid)
-- - public.challenges (id uuid, group_id uuid)
-- - public.reports (id uuid, group_id uuid)  -- if your reports table uses group_id
-- - public.group_members (group_id uuid, user_id uuid) -- if exists (RPC get_group_members likely uses this)
--
-- If some tables are named differently in your project, tell me and I’ll adapt the function.

create or replace function public.delete_group_and_challenge(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Delete reports (if table/column exists)
  if to_regclass('public.reports') is not null then
    begin
      execute 'delete from public.reports where group_id = $1' using p_group_id;
    exception when undefined_column then
      -- reports may not have group_id in some setups
      null;
    end;
  end if;

  -- Delete memberships (if exists)
  if to_regclass('public.group_members') is not null then
    begin
      execute 'delete from public.group_members where group_id = $1' using p_group_id;
    exception when undefined_column then
      null;
    end;
  end if;

  -- Delete challenge (MVP: one challenge per group)
  if to_regclass('public.challenges') is not null then
    begin
      execute 'delete from public.challenges where group_id = $1' using p_group_id;
    exception when undefined_column then
      null;
    end;
  end if;

  -- Delete group
  if to_regclass('public.groups') is not null then
    execute 'delete from public.groups where id = $1' using p_group_id;
  end if;
end;
$$;

-- Allow calling the function from the client (authenticated users)
revoke all on function public.delete_group_and_challenge(uuid) from public;
grant execute on function public.delete_group_and_challenge(uuid) to authenticated;

-- Compatibility overload:
-- PostgREST can call a function with a single json/jsonb argument by passing the whole body as that argument.
-- This avoids "schema cache" mismatches when parameter names don't line up.
create or replace function public.delete_group_and_challenge(payload jsonb)
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

  perform public.delete_group_and_challenge(v_group_id);
end;
$$;

revoke all on function public.delete_group_and_challenge(jsonb) from public;
grant execute on function public.delete_group_and_challenge(jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');


