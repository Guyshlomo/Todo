-- MVP policy: allow authenticated users to UPDATE challenges so validity dates can be saved from the app.
-- Run this in Supabase SQL editor.
--
-- NOTE: This is permissive. For stricter security, constrain UPDATE to challenge creators or group members.

alter table public.challenges enable row level security;

drop policy if exists "mvp_authenticated_update_challenges" on public.challenges;
create policy "mvp_authenticated_update_challenges"
on public.challenges
for update
to authenticated
using (true)
with check (true);

-- Refresh PostgREST schema cache
select pg_notify('pgrst', 'reload schema');


