-- get_location_profile: viewer.can_manage now means "can open Manage Store".
--
-- Manage Store is location-admins only (useAdminLocations reads
-- locations.admins), so offering the Manage button to staff or platform admins
-- sent them to a page that bounced them home. Staff and platform admins still
-- count as the location's own people for SEEING a private club or test venue.

create or replace function public.get_location_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l          public.locations;
  uid        uuid := auth.uid();
  can_manage boolean := false;
  is_member  boolean := false;
  is_people  boolean := false;
  -- A day of slack: venues span time zones, and an event finishing "today"
  -- somewhere must not drop off while it is still on.
  today      date := current_date - 1;
begin
  select * into l
    from public.locations
   where lower(slug) = lower(btrim(ltrim(p_handle, '@')))
   limit 1;

  if not found or l.kind = 'space' then
    return null;
  end if;

  if uid is not null then
    can_manage := uid = any (l.admins);
    is_member  := public.is_location_member(l.id);
    is_people  := can_manage or is_member
               or public.is_location_staff(l.id)
               or public.is_platform_admin()
               or public.is_location_organiser(l.id)
               or public.administers_location_owner(l.id);
  end if;

  -- Public: real venues. Everything else only to its own people.
  if not (l.kind = 'venue' and not l.is_test) and not is_people then
    return null;
  end if;

  return jsonb_build_object(
    'location', jsonb_build_object(
        'id', l.id, 'slug', l.slug, 'name', l.name, 'kind', l.kind,
        'icon', l.icon, 'address', l.address, 'country', l.country,
        'is_test', l.is_test),
    'viewer', jsonb_build_object('can_manage', can_manage, 'is_member', is_member),
    'tables', coalesce((
        select jsonb_agg(jsonb_build_object('label', t.label, 'count', t.n) order by t.n desc, t.label nulls last)
          from (select nullif(btrim(label), '') as label, count(*)::int as n
                  from public.store_tables
                 where location_id = l.id and enabled
                 group by 1) t), '[]'::jsonb),
    'events', coalesce((
        select jsonb_agg(jsonb_build_object(
                   'id', p.id, 'name', p.name, 'slug', p.slug,
                   'starts_on', p.starts_on, 'ends_on', p.ends_on,
                   'hosted', p.host_location_id = l.id and p.location_id is distinct from l.id,
                   'game', (select jsonb_build_object('name', g.name, 'slug', g.slug)
                              from public.games g where g.id = p.game_id))
                 order by p.starts_on nulls last, p.name)
          from public.battlepacks p
         where p.status = 'published'
           and (p.location_id = l.id or p.host_location_id = l.id)
           and coalesce(p.ends_on, p.starts_on, today) >= today), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_location_profile(text) from public;
grant execute on function public.get_location_profile(text) to anon, authenticated;
