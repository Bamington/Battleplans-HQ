-- 20260812050000_venue_staff_profiles.sql
--
-- Let a venue admin see their staff's real names.
--
-- `username` — the private "Your Name" — was deliberately dropped from
-- public_profiles (20260722030000), so the roster could only show @handles.
-- That is right for a view every signed-in user can read, but wrong for the
-- one place it matters: an owner looking at the people who work for them.
--
-- So a narrow, fenced RPC instead of widening the public view:
--
--   * Scoped to ONE venue per call, named by the caller.
--   * Callable only by that venue's admins (and platform admins). Staff are
--     excluded even though they can read the roster rows themselves — they
--     have no screen that needs colleagues' real names, and private data
--     should reach the smallest audience that has a use for it.
--   * Returns only people already on that venue's roster. It cannot be used
--     to resolve an arbitrary user, which is what separates it from an
--     enumeration oracle.
--
-- Every column reference is alias-qualified. `returns table (user_id …)`
-- declares OUT variables that collide with the very columns being selected —
-- exactly the mistake that made lookup_user_for_venue raise "column reference
-- user_id is ambiguous" on every call (fixed in 20260812040000).
--
-- Idempotent: safe to re-run.

create or replace function public.venue_staff_profiles(loc uuid)
returns table (user_id uuid, handle text, username text, avatar_path text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if loc is null then
    return;
  end if;

  if not (
    public.is_platform_admin()
    or public.is_location_admin(loc)
  ) then
    raise exception 'Only admins of this venue may read its staff profiles';
  end if;

  return query
  select s.user_id, p.handle, p.username, p.avatar_path
  from public.location_staff s
  join public.user_profiles p on p.id = s.user_id
  where s.location_id = loc
  order by s.created_at;
end;
$$;

comment on function public.venue_staff_profiles(uuid) is
  'Staff at one venue with their real names, for that venue''s admins. Fenced: one venue per call, admins only, and only people already on that roster — it cannot resolve an arbitrary user.';

revoke all on function public.venue_staff_profiles(uuid) from public, anon;
grant execute on function public.venue_staff_profiles(uuid) to authenticated;
