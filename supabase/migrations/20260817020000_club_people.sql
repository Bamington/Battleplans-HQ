-- 20260817020000_club_people.sql
--
-- A club's people, in one list.
--
-- Organisers and members were two columns fed by two functions, which meant a
-- club admin looking for a person had to know which of the two they were in
-- order to find them — and somebody who is both appeared twice. One list, one
-- lookup, one place to add or remove.
--
-- ADMINS ARE INCLUDED, which the previous pair could not do: they live in
-- `locations.admins` rather than either table, so neither function returned
-- them. A roster that silently omits the people with the most access is a
-- strange thing to hand somebody.
--
-- ONE ROW PER PERSON. Somebody can be an admin and an organiser and a member;
-- `distinct on` keeps the strongest, ordered by the rank below. Two rows for
-- one person reads as a bug even when both are true.
--
-- Same fence as the functions it replaces: real names live in `user_profiles`,
-- which is select-own under RLS, so showing a club its own roll needs a
-- security-definer function rather than a join the caller could not make.

drop function if exists public.club_people(uuid);

create function public.club_people(loc uuid)
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

  if not (
    public.is_platform_admin()
    or public.is_location_admin(loc)
  ) then
    raise exception 'Only admins of this place may read its people';
  end if;

  return query
  with everyone as (
      -- Admins, straight out of the array on the location.
      select a.id as uid, 'admin'::text as r, 1 as rank
      from public.locations l
      cross join lateral unnest(l.admins) as a(id)
      where l.id = loc

      union all

      select s.user_id, s.role, case s.role when 'organiser' then 2 else 3 end
      from public.location_staff s
      where s.location_id = loc

      union all

      select m.user_id, 'member'::text, 4
      from public.location_members m
      where m.location_id = loc
  ),
  best as (
      select distinct on (e.uid) e.uid, e.r, e.rank
      from everyone e
      order by e.uid, e.rank
  )
  select b.uid, p.handle, p.username, p.avatar_path, b.r
  from best b
  join public.user_profiles p on p.id = b.uid
  -- Strongest first, then alphabetically within a rank. `username` can be null,
  -- so fall back to the handle rather than letting those rows sort arbitrarily.
  order by b.rank, lower(coalesce(nullif(trim(p.username), ''), p.handle, ''));
end;
$$;

comment on function public.club_people(uuid) is
  'Everyone attached to a place, one row each, strongest role first: admin, organiser, staff, member. Admin-only — it crosses the select-own fence on user_profiles.';
