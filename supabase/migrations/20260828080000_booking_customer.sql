-- ============================================================================
-- Who made this booking — for the venue it was made at
-- ============================================================================
--
-- A venue looking at one of its own bookings should be able to contact the
-- person who made it. The store view of the booking modal now shows their name,
-- email and @username, and none of the three is reachable from the client:
-- `user_profiles` is select-own under RLS, `public_profiles` deliberately drops
-- the real name, and `auth.users` is not exposed at all.
--
-- ── WHY THIS IS ALLOWED TO RETURN AN EMAIL WHEN lookup_user_for_venue IS NOT ─
--
-- 20260812010000 is emphatic that it never returns an email, and that is still
-- right: it takes an arbitrary address or handle and answers "is this person
-- here?", so it is an oracle over every account on the platform. Its safety
-- comes from returning nothing you did not already know.
--
-- This function is the opposite shape. It takes a BOOKING ID, and answers only
-- for the venue that booking was made at. You cannot search with it, you cannot
-- enumerate with it, and you learn nothing about anyone who has not chosen to
-- book with you. That is exactly the exchange onboarding describes — "your
-- email address is only shared with stores when you make a booking" — so this
-- honours a promise already made rather than widening one.
--
-- ── WHO MAY CALL IT ─────────────────────────────────────────────────────────
--
-- Platform admins, the venue's admins, and its STAFF. Deliberately not
-- organisers: `is_location_staff` matches role = 'staff' only, and an organiser
-- runs events at a venue without seeing its bookings — handing them customer
-- emails would quietly reverse that.
--
-- Anyone else gets an exception rather than an empty row, so a caller can tell
-- "not allowed" from "no such booking".
--
-- ── WHAT IT RETURNS ─────────────────────────────────────────────────────────
--
-- Guest bookings (no account) are the reason every column falls back. A venue
-- can book someone in by name and email alone; that person has no profile, so
-- there is no handle and the name and email come off the booking row itself.
--
-- `bookings.user_email` is the fallback rather than the source: it was written
-- for every booking early on but is now only set when a venue books a guest in,
-- so for an account holder `auth.users.email` is the one that is current — and
-- the one that still works if they change their address.

create or replace function public.booking_customer(p_booking_id uuid)
returns table (name text, email text, handle text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  loc uuid;
begin
  select b.location_id into loc from public.bookings b where b.id = p_booking_id;

  if loc is null then
    return;                                   -- no such booking
  end if;

  if not (
    public.is_platform_admin()
    or exists (select 1 from public.locations l
                where l.id = loc and l.admins @> array[auth.uid()])
    or public.is_location_staff(loc)
  ) then
    raise exception 'Only this venue''s admins and staff may see who booked';
  end if;

  return query
  select coalesce(nullif(btrim(p.username), ''), b.user_name)  as name,
         coalesce(u.email::text, b.user_email)                 as email,
         p.handle                                              as handle
    from public.bookings b
    left join public.user_profiles p on p.id = b.user_id
    left join auth.users          u on u.id = b.user_id
   where b.id = p_booking_id;
end;
$$;

comment on function public.booking_customer(uuid) is
  'Name, email and @handle of whoever a booking is for, callable only by that venue''s admins and staff (not organisers). Bounded to one booking — unlike lookup_user_for_venue, which searches and therefore returns no email. Falls back to the booking''s own name/email for guests with no account.';

revoke all on function public.booking_customer(uuid) from public, anon;
grant execute on function public.booking_customer(uuid) to authenticated;
