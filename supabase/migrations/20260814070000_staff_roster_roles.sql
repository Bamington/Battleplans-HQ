-- 20260814070000_staff_roster_roles.sql
--
-- Show the venue which of its people is which.
--
-- 20260814060000 gave `location_staff` a role, but the roster the Staff column
-- renders comes from `venue_staff_profiles`, which returns four columns and
-- none of them is the role. So a venue could nominate an organiser and then
-- have no way to tell them apart from the person who works the counter — or to
-- notice they had picked the wrong one.
--
-- Return type changes, so the function is dropped and recreated. Postgres will
-- not alter a RETURNS TABLE signature in place.

drop function if exists public.venue_staff_profiles(uuid);

create function public.venue_staff_profiles(loc uuid)
returns table (user_id uuid, handle text, username text, avatar_path text, role text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if loc is null then
    return;
  end if;

  -- Unchanged: real names live in user_profiles, which is select-own under RLS,
  -- so only the venue's own admins get past this fence.
  if not (
    public.is_platform_admin()
    or public.is_location_admin(loc)
  ) then
    raise exception 'Only admins of this venue may read its staff profiles';
  end if;

  return query
  select s.user_id, p.handle, p.username, p.avatar_path, s.role
  from public.location_staff s
  join public.user_profiles p on p.id = s.user_id
  where s.location_id = loc
  order by s.role, s.created_at;
end;
$$;

comment on function public.venue_staff_profiles(uuid) is
  'The venue''s people with their real names and roles. Admin-only: it crosses the select-own fence on user_profiles.';
