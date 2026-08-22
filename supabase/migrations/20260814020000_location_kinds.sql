-- 20260814020000_location_kinds.sql
--
-- Somewhere to meet that is not a shop.
--
-- Clubs borrow rooms — a town hall, a church hall, a tennis club — and those
-- rooms need an address so a booking or a BattlePack can point at them. What
-- they must never do is turn up in the public list of places to play.
--
-- `locations` has been doing two jobs that this pulls apart: a BOOKABLE
-- BUSINESS (listed publicly, has staff, fees and apps) and a PLACE WITH AN
-- ADDRESS (where something happens). A club needs the first without an address;
-- a church hall needs the second and none of the rest.
--
-- A KIND, NOT AN `unlisted` FLAG. A flag is a setting somebody can eventually
-- turn on, and then a church hall is in the booking picker. As a kind, "never
-- public" is a property of what the row is, and the read policy can enforce it
-- once instead of every query remembering to.
--
-- 'club' is defined here but nothing creates one yet — the constraint is
-- written once so the next migration adds behaviour rather than re-cutting the
-- check.
--
-- Idempotent: safe to re-run.

alter table public.locations
  add column if not exists kind text not null default 'venue';

alter table public.locations
  drop constraint if exists locations_kind_check;

alter table public.locations
  add constraint locations_kind_check
  check (kind in ('venue', 'club', 'space'));

comment on column public.locations.kind is
  'venue = a bookable business, listed publicly. club = a group of people, no address of its own. space = a borrowed room; has an address, never public.';

-- Which club or venue created a space and looks after it.
--
-- CASCADE because a space exists only because somebody made it: delete the club
-- and its town hall goes too. SET NULL would be worse than a delete — an
-- ownerless space is readable by nobody, so it would linger as a row that
-- cannot be seen, edited or removed.
--
-- Self-referencing on purpose. A space is a location, so its owner is one too,
-- and this avoids a parallel table that would have to be kept in step.
alter table public.locations
  add column if not exists owner_location_id uuid references public.locations (id) on delete cascade;

comment on column public.locations.owner_location_id is
  'For a space, the club or venue that created it — its admins manage it. NULL for venues and clubs, which stand on their own.';

create index if not exists locations_owner_location_id_idx
  on public.locations (owner_location_id)
  where owner_location_id is not null;

-- ── Two helpers, both SECURITY DEFINER for one specific reason ───────────────
--
-- These are called from policies ON `locations` and they READ `locations`. A
-- plain function would re-enter the very policy being evaluated and recurse
-- until Postgres gives up. SECURITY DEFINER runs them as the owner, which
-- bypasses RLS and breaks the loop.
--
-- `authenticated` only, never `anon` — the same split `is_location_staff` uses,
-- and the reason the read policies below stay separated by role. The anonymous
-- policy must not call a function anon cannot execute.

create or replace function public.administers_location(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.locations l
        where l.id = target
          and l.admins @> array[auth.uid()]
    );
$$;

comment on function public.administers_location(uuid) is
  'Whether the caller is an admin of this location. SECURITY DEFINER because it is called from the locations policies and would otherwise recurse.';

create or replace function public.administers_location_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.locations child
        join public.locations owner on owner.id = child.owner_location_id
        where child.id = target
          and owner.admins @> array[auth.uid()]
    );
$$;

comment on function public.administers_location_owner(uuid) is
  'Whether the caller administers the club or venue that owns this space. Lets every admin of a club see its rooms, not just whoever typed one in.';

revoke all on function public.administers_location(uuid)       from public, anon;
revoke all on function public.administers_location_owner(uuid) from public, anon;
grant execute on function public.administers_location(uuid)       to authenticated;
grant execute on function public.administers_location_owner(uuid) to authenticated;

-- ── Reading ──────────────────────────────────────────────────────────────────
--
-- The public branch gains `kind = 'venue'`. For everything that exists today
-- that changes nothing — every current row is a venue by default — so this is
-- backward compatible in the strict sense: no row that was visible stops being
-- visible.
--
-- Still split by role, for the reason 20260811030000 documents: the anonymous
-- path serves the public venue pages and must not evaluate a function that only
-- `authenticated` may execute.

drop policy if exists "Anonymous readers see non-test locations" on public.locations;
drop policy if exists "Signed-in readers see non-test locations and their own" on public.locations;

create policy "Anonymous readers see public venues"
    on public.locations for select
    to anon
    using (not is_test and kind = 'venue');

create policy "Signed-in readers see public venues and their own"
    on public.locations for select
    to authenticated
    using (
        (not is_test and kind = 'venue')
        or auth.uid() = any (admins)
        or public.is_location_staff(id)
        -- Every admin of the owning club sees its rooms.
        or public.administers_location_owner(id)
    );

-- ── Writing ──────────────────────────────────────────────────────────────────
--
-- Platform admins keep the existing "Admins can manage locations" policy, which
-- is untouched. This adds ONE narrow thing on top: a club or venue admin may
-- look after the rooms they meet in.
--
-- SPACES ONLY, and only their own. `kind = 'space'` is checked on the way in and
-- on the way out, so this cannot be used to create a venue, and cannot be used
-- to turn an existing space into one — which would put a church hall on the
-- public list, the exact thing this migration exists to prevent.
--
-- Deliberately does not let a venue admin edit their own VENUE row. That is a
-- separate question with its own blast radius (name, address and admins are all
-- on it) and nothing here needs it.

drop policy if exists "Venue and club admins create their own spaces" on public.locations;
create policy "Venue and club admins create their own spaces"
    on public.locations for insert
    to authenticated
    with check (
        kind = 'space'
        and owner_location_id is not null
        and public.administers_location(owner_location_id)
    );

drop policy if exists "Venue and club admins update their own spaces" on public.locations;
create policy "Venue and club admins update their own spaces"
    on public.locations for update
    to authenticated
    using (
        kind = 'space'
        and public.administers_location_owner(id)
    )
    with check (
        kind = 'space'
        and public.administers_location_owner(id)
    );

drop policy if exists "Venue and club admins delete their own spaces" on public.locations;
create policy "Venue and club admins delete their own spaces"
    on public.locations for delete
    to authenticated
    using (
        kind = 'space'
        and public.administers_location_owner(id)
    );
