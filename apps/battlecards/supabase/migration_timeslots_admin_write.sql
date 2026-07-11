-- migration_timeslots_admin_write.sql
--
-- Lets venue admins create/edit/delete timeslots for their own venue, which the
-- new "Timeslots" column on Manage Store needs. The app previously only READ
-- timeslots, so no write policies existed and inserts/updates/deletes were
-- denied by RLS.
--
-- Run once in the Supabase SQL editor for the shared project.

alter table public.timeslots enable row level security;

-- A user may manage a timeslot if they administer its venue (locations.admins
-- contains their id) or they're a global admin. Repeated in each policy because
-- Postgres RLS can't share a predicate.

-- Read: any signed-in user (booking flows list timeslots). Idempotent re-create.
drop policy if exists "timeslots_select" on public.timeslots;
create policy "timeslots_select" on public.timeslots
  for select to authenticated using (true);

drop policy if exists "timeslots_admin_insert" on public.timeslots;
create policy "timeslots_admin_insert" on public.timeslots
  for insert to authenticated
  with check (
    exists (select 1 from public.locations l
              where l.id = location_id and l.admins @> array[auth.uid()])
    or exists (select 1 from public.user_profiles p
                 where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "timeslots_admin_update" on public.timeslots;
create policy "timeslots_admin_update" on public.timeslots
  for update to authenticated
  using (
    exists (select 1 from public.locations l
              where l.id = location_id and l.admins @> array[auth.uid()])
    or exists (select 1 from public.user_profiles p
                 where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.locations l
              where l.id = location_id and l.admins @> array[auth.uid()])
    or exists (select 1 from public.user_profiles p
                 where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "timeslots_admin_delete" on public.timeslots;
create policy "timeslots_admin_delete" on public.timeslots
  for delete to authenticated
  using (
    exists (select 1 from public.locations l
              where l.id = location_id and l.admins @> array[auth.uid()])
    or exists (select 1 from public.user_profiles p
                 where p.id = auth.uid() and p.role = 'admin')
  );
