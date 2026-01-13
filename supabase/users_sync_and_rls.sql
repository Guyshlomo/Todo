-- Ensure public.users has display_name and is readable for group members.
-- Run in Supabase SQL Editor, then Settings -> API -> Reload schema.

-- 1) Make sure columns exist (safe).
alter table public.users
  add column if not exists display_name text,
  add column if not exists birthdate date,
  add column if not exists avatar_url text;

-- 2) Sync auth.users -> public.users (insert/update) based on auth metadata.
create or replace function public.sync_public_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_birthdate date;
  v_birthdate_raw text;
begin
  v_display_name := nullif(new.raw_user_meta_data->>'display_name', '');
  v_birthdate_raw := nullif(new.raw_user_meta_data->>'birthdate', '');
  if v_birthdate_raw ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birthdate := to_date(v_birthdate_raw, 'YYYY-MM-DD');
  else
    v_birthdate := null;
  end if;

  insert into public.users (id, display_name, birthdate)
  values (new.id, v_display_name, v_birthdate)
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, public.users.display_name),
      birthdate = coalesce(excluded.birthdate, public.users.birthdate);

  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_public_user on auth.users;
create trigger on_auth_user_sync_public_user
after insert or update of raw_user_meta_data
on auth.users
for each row
execute procedure public.sync_public_user_from_auth();

-- 2b) Backfill existing users from auth.users (so old accounts also get display_name)
insert into public.users (id, display_name, birthdate)
select
  au.id,
  nullif(au.raw_user_meta_data->>'display_name', '') as display_name,
  case
    when nullif(au.raw_user_meta_data->>'birthdate', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then to_date(au.raw_user_meta_data->>'birthdate', 'YYYY-MM-DD')
    else null
  end as birthdate
from auth.users au
on conflict (id) do update
set display_name = coalesce(excluded.display_name, public.users.display_name),
    birthdate = coalesce(excluded.birthdate, public.users.birthdate);

-- 3) RLS: allow reading names/avatars for people in the same group (and self).
alter table public.users enable row level security;

drop policy if exists "users_select_self_or_shared_group" on public.users;
create policy "users_select_self_or_shared_group"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members gm_me
    join public.group_members gm_other
      on gm_me.group_id = gm_other.group_id
    where gm_me.user_id = auth.uid()
      and gm_other.user_id = public.users.id
  )
);

-- Optional: allow users to update their own profile
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

select pg_notify('pgrst', 'reload schema');


