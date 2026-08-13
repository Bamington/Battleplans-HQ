-- 20260812010000_lookup_user_for_venue_staff.sql
--
-- Let venue staff resolve a person too.
--
-- 20260811020000 fenced lookup_user_for_venue to platform admins and venue
-- admins, because at that point its only caller was the "add a staff member"
-- form — an admin-only action. Staff can now take bookings on someone's
-- behalf, and that form needs the same lookup, so the gate has to widen to
-- venue members.
--
-- This does widen the account-existence oracle from venue owners to everyone
-- who works a counter. The containment is unchanged and is what makes that
-- acceptable: exact match only (no wildcards, no fuzzy search), at most one
-- row, and it never returns an email address. You must already know the exact
-- address to learn anything, and all you learn is that the person is here —
-- which is precisely what someone standing at the counter with the customer
-- needs, and no more.
--
-- Idempotent: safe to re-run.

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
    or exists (select 1 from public.location_staff where user_id = auth.uid())
  ) then
    raise exception 'Only venue admins and staff may look up users';
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
  'Resolve one user by exact @handle or exact email, for venue admins and staff adding colleagues or booking on a customer''s behalf. Returns no email. Callable only by platform admins and venue members.';

revoke all on function public.lookup_user_for_venue(text) from public, anon;
grant execute on function public.lookup_user_for_venue(text) to authenticated;
