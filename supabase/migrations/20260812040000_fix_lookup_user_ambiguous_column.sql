-- 20260812040000_fix_lookup_user_ambiguous_column.sql
--
-- Fix: lookup_user_for_venue always raised
--   column reference "user_id" is ambiguous
--
-- `returns table (user_id uuid, ...)` declares an OUT variable called
-- `user_id`. 20260812010000 then widened the permission check with
--
--     exists (select 1 from public.location_staff where user_id = auth.uid())
--
-- where `user_id` is equally the OUT variable and location_staff's column.
-- Postgres refuses to guess, so every call failed before it got as far as
-- looking anyone up — breaking both callers: adding a staff member, and
-- booking on a customer's behalf.
--
-- It survived review because the function was only ever exercised against
-- stubbed components, never against a live session. The permission branch is
-- also the first thing that runs, so no amount of testing the *search* would
-- have reached it.
--
-- Fixed by aliasing the table so the reference can only mean one thing. The
-- OUT name stays `user_id` because clients already read that key.
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
    or exists (select 1 from public.locations l where l.admins @> array[auth.uid()])
    -- Aliased: unqualified `user_id` here collides with this function's own
    -- OUT column of the same name.
    or exists (select 1 from public.location_staff ls where ls.user_id = auth.uid())
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

revoke all on function public.lookup_user_for_venue(text) from public, anon;
grant execute on function public.lookup_user_for_venue(text) to authenticated;
