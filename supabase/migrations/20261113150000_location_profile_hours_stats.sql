-- ============================================================
-- Store profiles: Opening Hours, Store Stats, and location_profiles
-- ============================================================
-- location_profiles — the 1:1 home for a venue or club's profile settings,
--   starting with show_stats (off by default: booking stats are opt-in per
--   venue). Readable by anyone, since it holds only display switches; written
--   only through update_location_profile.
--
-- update_location_profile gains p_show_stats (default null = leave alone).
--   The 4-argument version is dropped rather than overloaded, so PostgREST
--   never sees two candidates for the same named call. Nothing shipped calls it.
--
-- get_location_profile adds:
--   hours    — bookable timeslots by weekday (the page's Opening Hours)
--   stats    — top games and bookings by weekday over the last 12 months, when
--              switched on and there are at least 10 bookings; null otherwise
--   settings — { show_stats } for the location's admins
--
-- Additive for any deployed client: new table, new keys in the payload.
-- ============================================================

create table if not exists public.location_profiles (
  location_id uuid primary key references public.locations(id) on delete cascade,
  show_stats  boolean not null default false,
  updated_at  timestamptz not null default now()
);

comment on table public.location_profiles is
  'Profile-page settings for a venue or club, 1:1 with locations. Written through update_location_profile.';

alter table public.location_profiles enable row level security;

drop policy if exists "Anyone reads location profile settings" on public.location_profiles;
create policy "Anyone reads location profile settings"
    on public.location_profiles for select
    to anon, authenticated
    using (true);

grant select on public.location_profiles to anon, authenticated;

-- ── update_location_profile ──────────────────────────────────────────────────
drop function if exists public.update_location_profile(uuid, text, text, text);

create or replace function public.update_location_profile(
  p_location   uuid,
  p_name       text,
  p_icon       text,
  p_slug       text,
  p_show_stats boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.locations;
begin
  select * into l from public.locations where id = p_location;
  if not found then
    raise exception 'Location not found' using errcode = 'P0002';
  end if;

  if not (public.administers_location(p_location) or public.is_platform_admin()) then
    raise exception 'Only this location''s admins can edit its profile' using errcode = '42501';
  end if;

  if l.kind = 'space' then
    raise exception 'Spaces have no profile' using errcode = '22023';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'A name is required' using errcode = '23514';
  end if;

  if nullif(btrim(p_slug), '') is null then
    raise exception 'A profile name is required' using errcode = '23514';
  end if;

  update public.locations
     set name = btrim(p_name),
         icon = nullif(btrim(p_icon), ''),
         slug = lower(btrim(p_slug))
   where id = p_location;

  if p_show_stats is not null then
    insert into public.location_profiles (location_id, show_stats, updated_at)
    values (p_location, p_show_stats, now())
    on conflict (location_id) do update
      set show_stats = excluded.show_stats, updated_at = now();
  end if;
end;
$$;

revoke all on function public.update_location_profile(uuid, text, text, text, boolean) from public;
grant execute on function public.update_location_profile(uuid, text, text, text, boolean) to authenticated;

-- ── get_location_profile ─────────────────────────────────────────────────────
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
  show_stats boolean := false;
  n_bookings int := 0;
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

  select coalesce(lp.show_stats, false) into show_stats
    from public.location_profiles lp
   where lp.location_id = l.id;
  show_stats := coalesce(show_stats, false);

  if show_stats then
    select count(*) into n_bookings
      from public.bookings b
     where b.location_id = l.id
       and b.date > current_date - 365
       and b.date <= current_date;
  end if;

  return jsonb_build_object(
    'location', jsonb_build_object(
        'id', l.id, 'slug', l.slug, 'name', l.name, 'kind', l.kind,
        'icon', l.icon, 'address', l.address, 'country', l.country,
        'is_test', l.is_test),
    'viewer', jsonb_build_object('can_manage', can_manage, 'is_member', is_member),
    'settings', case when can_manage then jsonb_build_object('show_stats', show_stats) else null end,
    -- Kept for clients from before Opening Hours replaced the Tables section.
    'tables', coalesce((
        select jsonb_agg(jsonb_build_object('label', t.label, 'count', t.n) order by t.n desc, t.label nulls last)
          from (select nullif(btrim(label), '') as label, count(*)::int as n
                  from public.store_tables
                 where location_id = l.id and enabled
                 group by 1) t), '[]'::jsonb),
    -- Opening hours: every timeslot a customer could actually book, meaning at
    -- least one enabled table is offered in it. A venue's members-only nights
    -- aren't opening hours; a club's nights are all it has. The client works
    -- out each weekday's next date, in the viewer's own time zone, from
    -- interval_weeks and anchor_date.
    'hours', coalesce((
        select jsonb_agg(jsonb_build_object(
                   'day', d.day,
                   'start', to_char(s.start_time, 'HH24:MI'),
                   'end', to_char(s.end_time, 'HH24:MI'),
                   'name', s.name,
                   'interval_weeks', coalesce(s.interval_weeks, 1),
                   'anchor_date', s.anchor_date,
                   'audience', coalesce(s.audience, 'anyone'))
                 order by dn.n, s.start_time)
          from public.timeslots s
          cross join lateral unnest(s.availability) as d(day)
          join (values ('Monday', 1), ('Tuesday', 2), ('Wednesday', 3), ('Thursday', 4),
                       ('Friday', 5), ('Saturday', 6), ('Sunday', 7)) as dn(day, n)
            on dn.day = d.day
         where s.location_id = l.id
           and (l.kind = 'club' or coalesce(s.audience, 'anyone') = 'anyone')
           and exists (select 1
                         from public.store_table_timeslots sts
                         join public.store_tables t on t.id = sts.table_id
                        where sts.timeslot_id = s.id and t.enabled)), '[]'::jsonb),
    -- Store Stats: opt-in (location_profiles.show_stats), the last twelve
    -- months, and only with ten or more bookings. Below that a "busiest day"
    -- says more about particular people than about the venue.
    'stats', case when show_stats and n_bookings >= 10 then jsonb_build_object(
        'bookings', n_bookings,
        'games', coalesce((
            select jsonb_agg(jsonb_build_object('name', x.name, 'slug', x.slug, 'count', x.n) order by x.n desc, x.name)
              from (select g.name, g.slug, count(*)::int as n
                      from public.bookings b
                      join public.games g on g.id = b.game_id
                     where b.location_id = l.id
                       and b.date > current_date - 365
                       and b.date <= current_date
                     group by g.name, g.slug
                     order by n desc, g.name
                     limit 5) x), '[]'::jsonb),
        'days', coalesce((
            select jsonb_agg(jsonb_build_object('dow', x.dow, 'count', x.n) order by x.dow)
              from (select extract(isodow from b.date)::int as dow, count(*)::int as n
                      from public.bookings b
                     where b.location_id = l.id
                       and b.date > current_date - 365
                       and b.date <= current_date
                     group by 1) x), '[]'::jsonb))
      else null end,
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
