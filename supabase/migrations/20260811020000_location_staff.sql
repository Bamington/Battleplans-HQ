-- 20260811020000_location_staff.sql
--
-- Location Staff — the people who work the counter.
--
-- Until now a venue had exactly one kind of person attached to it: an admin,
-- stored in `locations.admins`. That array is the key to everything — tables,
-- timeslots, blocked dates, fees, and the venue record itself. Handing it to a
-- casual weekend employee so they can see who's booked in is far too much.
--
-- So: a second, weaker membership. Staff can SEE bookings at the venues they
-- work at. They cannot touch admins, cannot add or remove other staff, and
-- cannot change any venue setting — all of which stay gated on
-- `locations.admins`, untouched by this migration.
--
-- `locations.admins` deliberately stays an array rather than becoming rows in
-- this table. Every existing policy in the schema reads it, and rewriting all
-- of them to satisfy a tidiness urge would be a large breaking change on a
-- database that sits behind production and every preview. Staff are additive.
--
-- Idempotent: safe to re-run.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.location_staff (
    location_id uuid not null references public.locations (id) on delete cascade,
    user_id     uuid not null references auth.users (id)       on delete cascade,
    -- Who granted this, for the venue's own audit trail. Kept if that admin is
    -- later deleted — the grant is still a fact about the venue.
    added_by    uuid references auth.users (id) on delete set null,
    created_at  timestamptz default now(),
    primary key (location_id, user_id)
);

comment on table public.location_staff is
  'Weaker-than-admin venue membership. Staff may read bookings at their venues; they may not manage admins, staff, or venue settings.';

create index if not exists location_staff_user_id_idx
    on public.location_staff using btree (user_id);

-- ── Membership helpers ───────────────────────────────────────────────────────
-- SECURITY DEFINER because `location_staff`'s own SELECT policy needs to ask
-- "is the caller staff here?" — asking that through RLS would recurse into the
-- policy being evaluated. Each function reports only on auth.uid(), so a caller
-- learns nothing about anyone else by calling them.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_location_admin(loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.locations
    where id = loc and admins @> array[auth.uid()]
  );
$$;

create or replace function public.is_location_staff(loc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.location_staff
    where location_id = loc and user_id = auth.uid()
  );
$$;

comment on function public.is_location_staff(uuid) is
  'True when the CALLER is staff at this venue. Reports only on auth.uid(); reveals nothing about other users.';

revoke all on function public.is_platform_admin()      from public, anon;
revoke all on function public.is_location_admin(uuid)  from public, anon;
revoke all on function public.is_location_staff(uuid)  from public, anon;
grant execute on function public.is_platform_admin()     to authenticated;
grant execute on function public.is_location_admin(uuid) to authenticated;
grant execute on function public.is_location_staff(uuid) to authenticated;

-- ── RLS on the roster ────────────────────────────────────────────────────────
alter table public.location_staff enable row level security;

-- A staff member can see the team they're on; admins see their venues' rosters.
-- `user_id = auth.uid()` is checked directly (no recursion — it's this row), and
-- the venue-wide case goes through the security-definer helper.
drop policy if exists "Read staff at venues you belong to" on public.location_staff;
create policy "Read staff at venues you belong to"
    on public.location_staff for select
    to authenticated
    using (
        user_id = auth.uid()
        or public.is_platform_admin()
        or public.is_location_admin(location_id)
        or public.is_location_staff(location_id)
    );

-- Only admins hire and fire. This is the line that stops staff promoting
-- themselves or each other.
drop policy if exists "Only admins manage staff" on public.location_staff;
create policy "Only admins manage staff"
    on public.location_staff
    to authenticated
    using (
        public.is_platform_admin()
        or public.is_location_admin(location_id)
    )
    with check (
        public.is_platform_admin()
        or public.is_location_admin(location_id)
    );

-- ── Let staff read their venues' bookings ────────────────────────────────────
-- Strictly a superset of the policy it replaces (20260725000000): same three
-- clauses, plus staff. Nobody who could read a booking before loses access.
drop policy if exists "Read own, admin, or venue-admin bookings" on public.bookings;
drop policy if exists "Read own, admin, venue-admin, or venue-staff bookings" on public.bookings;
create policy "Read own, admin, venue-admin, or venue-staff bookings"
    on public.bookings for select
    to authenticated
    using (
        auth.uid() = user_id
        or public.is_platform_admin()
        or public.is_location_admin(location_id)
        or public.is_location_staff(location_id)
    );

-- ── Finding the person you want to hire ──────────────────────────────────────
-- Staff are added by @handle or by email. Handles resolve client-side through
-- `public_profiles`, but email deliberately isn't exposed there, so resolving
-- one needs a definer function.
--
-- This is an account-existence oracle, so it is fenced: only platform admins
-- and people who already administer at least one venue may call it, it matches
-- on exact equality (no wildcards, no fuzzy search), it returns at most one
-- row, and it never returns an email address — you must already know the
-- address to learn anything, and all you learn is "yes, that person is here".
-- That is the minimum needed to invite a colleague you already work with.

create or replace function public.lookup_user_for_venue(identifier text)
returns table (user_id uuid, handle text, username text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := btrim(coalesce(identifier, ''));
begin
  if not (
    public.is_platform_admin()
    or exists (select 1 from public.locations where admins @> array[auth.uid()])
  ) then
    raise exception 'Only venue admins may look up users';
  end if;

  if needle = '' then
    return;
  end if;

  return query
  select p.id, p.handle, p.username
  from public.user_profiles p
  join auth.users u on u.id = p.id
  where lower(p.handle) = lower(ltrim(needle, '@'))
     or lower(u.email)  = lower(needle)
  limit 1;
end;
$$;

comment on function public.lookup_user_for_venue(text) is
  'Resolve one user by exact @handle or exact email, for venue admins adding staff. Returns no email. Callable only by platform/venue admins.';

revoke all on function public.lookup_user_for_venue(text) from public, anon;
grant execute on function public.lookup_user_for_venue(text) to authenticated;
