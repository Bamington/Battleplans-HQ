-- 20260814050000_venue_organisers.sql
--
-- A venue nominates a person to run events there.
--
-- Some people run events at a shop they do not own — a club's organiser, a
-- tournament organiser hiring the room. Until now the only way to let them was
-- to make them a venue admin, which also hands over the venue's bookings, staff
-- list, fees and takings: rather more than "you can have four tables on
-- alternate Fridays".
--
-- MODELLED AS A PERSON, NOT AN ORGANISATION. An earlier draft of this made it a
-- permission between a venue and a club, with its own table. That was the wrong
-- shape — what a venue actually does is point at a PERSON and say "they run
-- things here", and the venue already keeps a list of people: its staff.
--
-- So an organiser is a second role on `location_staff` rather than a parallel
-- mechanism. One list, one place to add someone, one place to take them away.
--
-- ── The trap this migration has to avoid ─────────────────────────────────────
--
-- `is_location_staff` currently means "has a row in location_staff", and it
-- gates real things: seeing a venue's bookings, reading the venue row, and
-- reading its BattlePacks. Adding organisers to that table without touching the
-- function would silently hand every organiser the venue's booking list.
--
-- So the function is narrowed to `role = 'staff'` in the same migration that
-- introduces the other role. Existing rows default to 'staff', so nobody's
-- access changes.
--
-- An organiser is deliberately NOT staff: they hold tables and publish events,
-- and they do not see who booked what.
--
-- Idempotent: safe to re-run.

-- ── Clearing the earlier draft ───────────────────────────────────────────────
--
-- No-ops on a fresh database. They are here because the club-granting draft
-- described above was briefly applied to the shared database before being
-- reconsidered, and this file has to reach the same end state whether or not
-- that ever ran. Nothing was ever stored in any of it.

drop policy if exists "Granted clubs create their holds"  on public.blocked_dates;
drop policy if exists "Granted clubs update their holds"  on public.blocked_dates;
drop policy if exists "Granted clubs release their holds" on public.blocked_dates;

drop table if exists public.location_grants cascade;

-- Went with it: the permission is a person's, so nothing writes a club onto a
-- block. Attribution comes from the pack and the person instead.
alter table public.blocked_dates drop column if exists club_id;

-- ── The role ─────────────────────────────────────────────────────────────────

alter table public.location_staff
  add column if not exists role text not null default 'staff';

alter table public.location_staff
  drop constraint if exists location_staff_role_check;

alter table public.location_staff
  add constraint location_staff_role_check
  check (role in ('staff', 'organiser'));

comment on column public.location_staff.role is
  'staff = works the counter; sees and takes bookings. organiser = runs events here; holds tables and publishes BattlePacks, and does NOT see bookings.';

-- ── Narrowing is_location_staff, carefully ───────────────────────────────────
--
-- Same signature, same name, one clause tighter. Every existing row is 'staff'
-- by default, so this returns exactly what it returned before for everyone who
-- exists today — while making sure an organiser added tomorrow does not
-- inherit the counter's view of the venue.

create or replace function public.is_location_staff(loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.location_staff
        where location_id = loc
          and user_id = auth.uid()
          and role = 'staff'
    );
$$;

create or replace function public.is_location_organiser(loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.location_staff
        where location_id = loc
          and user_id = auth.uid()
          and role = 'organiser'
    );
$$;

comment on function public.is_location_organiser(uuid) is
  'Whether the caller was nominated to run events at this venue. Holds tables and publishes packs; deliberately not a route to the venue''s bookings.';

revoke all on function public.is_location_organiser(uuid) from public, anon;
grant execute on function public.is_location_organiser(uuid) to authenticated;

-- ── Who made a block ─────────────────────────────────────────────────────────
--
-- The venue asked to see who closed its Friday. With the permission attached to
-- a person, the person is the answer — and where the hold came from a pack, the
-- pack's name says what the night actually is.
--
-- Nullable and unbackfilled: every block that already exists was made by the
-- venue itself, and inventing an author for it would be a lie.

alter table public.blocked_dates
  add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.blocked_dates.created_by is
  'Who created this block, when it was not the venue acting on its own. Shown beside the reason so a venue can see which organiser closed the room.';

-- ── An organiser may hold tables ─────────────────────────────────────────────
--
-- Alongside the venue's existing policy, which is untouched; permissive policies
-- OR together, so a venue admin keeps exactly what they had.
--
-- SCOPED TO THEIR OWN BLOCKS on update and delete. An organiser closing their
-- own Friday is the feature; an organiser reopening the venue's Christmas
-- closure is not.

drop policy if exists "Organisers hold tables where nominated" on public.blocked_dates;
create policy "Organisers hold tables where nominated"
    ON public.blocked_dates FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_location_organiser(location_id)
        -- Recorded, not optional: this is what the venue reads to see who did it.
        and created_by = auth.uid()
    );

drop policy if exists "Organisers change their own holds" on public.blocked_dates;
create policy "Organisers change their own holds"
    ON public.blocked_dates FOR UPDATE
    TO authenticated
    USING (
        public.is_location_organiser(location_id)
        and created_by = auth.uid()
    )
    WITH CHECK (
        public.is_location_organiser(location_id)
        and created_by = auth.uid()
    );

drop policy if exists "Organisers release their own holds" on public.blocked_dates;
create policy "Organisers release their own holds"
    ON public.blocked_dates FOR DELETE
    TO authenticated
    USING (
        public.is_location_organiser(location_id)
        and created_by = auth.uid()
    );

-- ── An organiser may run an event there ──────────────────────────────────────

create or replace function public.can_edit_battlepack(pack uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.battlepacks p
        where p.id = pack
          and (
              exists (
                  select 1 from public.user_profiles up
                  where up.id = auth.uid() and up.role = 'admin'
              )
              -- Deliberately no owner_id clause. The store decides, so an
              -- organiser who leaves loses the pack and their colleagues keep it.
              or exists (
                  select 1 from public.locations l
                  where l.id = p.location_id
                    and l.admins @> array[auth.uid()]
              )
              -- Nominated to run events at the venue this pack is at.
              or public.is_location_organiser(p.location_id)
          )
    );
$$;

drop policy if exists "Store admins and granted clubs create packs" on public.battlepacks;
drop policy if exists "Store admins create packs at their venues" on public.battlepacks;
-- Its own name too, or re-running this file collides with itself.
drop policy if exists "Store admins and organisers create packs" on public.battlepacks;
create policy "Store admins and organisers create packs"
    ON public.battlepacks FOR INSERT
    TO authenticated
    WITH CHECK (
        owner_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role = 'admin'
            )
            OR EXISTS (
                SELECT 1 FROM public.locations l
                WHERE l.id = battlepacks.location_id
                  AND l.admins @> ARRAY[auth.uid()]
            )
            OR public.is_location_organiser(battlepacks.location_id)
        )
    );

-- An organiser has to be able to READ the packs they run, and the venue row
-- itself, or the venue never appears in their picker and their own event is
-- invisible to them.

drop policy if exists "Store admins and staff read their packs" on public.battlepacks;
drop policy if exists "Store admins, staff and organisers read their packs" on public.battlepacks;
create policy "Store admins, staff and organisers read their packs"
    ON public.battlepacks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations l
            WHERE l.id = battlepacks.location_id
              AND l.admins @> ARRAY[auth.uid()]
        )
        OR public.is_location_staff(battlepacks.location_id)
        OR public.is_location_organiser(battlepacks.location_id)
    );

drop policy if exists "Signed-in readers see public venues and their own" on public.locations;
create policy "Signed-in readers see public venues and their own"
    on public.locations for select
    to authenticated
    using (
        (not is_test and kind = 'venue')
        or auth.uid() = any (admins)
        or public.is_location_staff(id)
        or public.is_location_organiser(id)
        or public.administers_location_owner(id)
    );

-- The earlier draft's helper. A no-op on a fresh database, and it has to come
-- LAST on one that ran that draft: the battlepacks insert policy and
-- can_edit_battlepack both referenced it, and Postgres refuses to drop a
-- function out from under a policy that depends on it. Both are replaced above.
drop function if exists public.club_may(uuid, uuid, text);
