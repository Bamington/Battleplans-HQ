-- 20260817000000_club_members.sql
--
-- Members, and nights that are only for them.
--
-- A club can now take bookings (its own tables and timeslots, 20260814040000),
-- but every night it runs is open to whoever can see the club. Some club nights
-- are for members and some are a taster anyone can come to, and there has been
-- no way to say which.
--
-- ── The setting is on the NIGHT, not the club ────────────────────────────────
--
-- `timeslots.audience` rather than a flag on the club, because the same club
-- runs both: an open beginners' evening on the first Tuesday and a members-only
-- league on alternate Fridays. Putting it on the club would force one answer
-- for both.
--
-- Default 'anyone', which is what every existing timeslot already means. No
-- backfill, and a shop that never hears about members is unaffected.
--
-- ── Discovery is deliberately absent ─────────────────────────────────────────
--
-- Nothing here makes a club findable. A club is visible to the people attached
-- to it — its admins, its organisers, and now its members — and to nobody else.
-- A directory of clubs to browse and ask to join is a later, separate thing;
-- building half of it now would mean guessing at the join flow.
--
-- Idempotent: safe to re-run.

create table if not exists public.location_members (
    location_id uuid not null references public.locations (id) on delete cascade,
    user_id     uuid not null references auth.users (id)       on delete cascade,
    added_by    uuid references auth.users (id)                on delete set null,
    created_at  timestamptz not null default now(),
    primary key (location_id, user_id)
);

comment on table public.location_members is
  'Who belongs to a club. Distinct from location_staff on purpose: staff and organisers are a handful of people with powers, members are potentially hundreds with none, and mixing them would make every function that reads location_staff answer a question it was not asked.';

create index if not exists location_members_user_idx
  on public.location_members (user_id);

alter table public.location_members enable row level security;

create or replace function public.is_location_member(loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.location_members
        where location_id = loc and user_id = auth.uid()
    );
$$;

comment on function public.is_location_member(uuid) is
  'Whether the caller belongs to this club. Membership carries no powers — it decides which nights they may book.';

revoke all on function public.is_location_member(uuid) from public, anon;
grant execute on function public.is_location_member(uuid) to authenticated;

-- ── Who may read and write the roll ──────────────────────────────────────────

drop policy if exists "Members and club admins read the roll" on public.location_members;
create policy "Members and club admins read the roll"
    ON public.location_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
        OR public.administers_location(location_id)
        -- Your own membership, so the client can tell you which nights you may
        -- book without being able to enumerate everyone else.
        OR user_id = auth.uid()
    );

drop policy if exists "Club admins manage the roll" on public.location_members;
create policy "Club admins manage the roll"
    ON public.location_members FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
        OR public.administers_location(location_id)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
        OR public.administers_location(location_id)
    );

-- ── A club is visible to its members ─────────────────────────────────────────
--
-- Otherwise a member cannot see the club they belong to, and it never reaches
-- their booking picker. Still nothing public: this adds people the club has
-- named, not the world.

drop policy if exists "Signed-in readers see public venues and their own" on public.locations;
create policy "Signed-in readers see public venues and their own"
    on public.locations for select
    to authenticated
    using (
        (not is_test and kind = 'venue')
        or auth.uid() = any (admins)
        or public.is_location_staff(id)
        or public.is_location_organiser(id)
        or public.is_location_member(id)
        or public.administers_location_owner(id)
    );

-- ── Nights for members only ──────────────────────────────────────────────────

alter table public.timeslots
  add column if not exists audience text not null default 'anyone';

alter table public.timeslots
  drop constraint if exists timeslots_audience_check;

alter table public.timeslots
  add constraint timeslots_audience_check
  check (audience in ('anyone', 'members'));

comment on column public.timeslots.audience is
  'anyone = whoever can see this place may book it, which is what every slot meant before this column. members = only people on the club''s roll.';

create or replace function public.may_book_timeslot(slot uuid, loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        -- Missing or unknown slot falls through to 'anyone'. The foreign key
        -- already refuses a booking that names no real timeslot, and a slot
        -- that cannot be read should not silently become members-only.
        coalesce((select t.audience from public.timeslots t where t.id = slot), 'anyone') = 'anyone'
        or public.is_location_member(loc)
        or public.is_location_admin(loc)
        or public.is_location_staff(loc)
        or public.is_location_organiser(loc);
$$;

comment on function public.may_book_timeslot(uuid, uuid) is
  'Whether the caller may book this particular night. Everything is bookable unless the night says members only.';

revoke all on function public.may_book_timeslot(uuid, uuid) from public, anon;
grant execute on function public.may_book_timeslot(uuid, uuid) to authenticated;

-- RESTRICTIVE, which is the whole point.
--
-- Permissive policies OR together, so adding another one could only ever widen
-- who may book. This has to NARROW: whatever else entitles you to make a
-- booking, a members-only night additionally requires membership. A restrictive
-- policy ANDs with the rest, which is the only way to express that.
--
-- Harmless for every venue: their slots are 'anyone', so the check passes and
-- the existing policy decides on its own exactly as before.

drop policy if exists "Members-only nights need membership" on public.bookings;
create policy "Members-only nights need membership"
    ON public.bookings AS RESTRICTIVE FOR INSERT
    TO authenticated
    WITH CHECK (public.may_book_timeslot(timeslot_id, location_id));

-- ── The roll, with real names ────────────────────────────────────────────────
--
-- Mirrors venue_staff_profiles: names live in user_profiles, which is
-- select-own under RLS, so showing a club its own roll needs the same
-- security-definer fence rather than a join the caller could not make.

drop function if exists public.club_member_profiles(uuid);

create function public.club_member_profiles(loc uuid)
returns table (user_id uuid, handle text, username text, avatar_path text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if loc is null then
    return;
  end if;

  if not (
    public.is_platform_admin()
    or public.is_location_admin(loc)
  ) then
    raise exception 'Only admins of this club may read its members';
  end if;

  return query
  select m.user_id, p.handle, p.username, p.avatar_path, m.created_at
  from public.location_members m
  join public.user_profiles p on p.id = m.user_id
  where m.location_id = loc
  order by m.created_at;
end;
$$;

comment on function public.club_member_profiles(uuid) is
  'A club''s roll with real names. Admin-only: it crosses the select-own fence on user_profiles.';
