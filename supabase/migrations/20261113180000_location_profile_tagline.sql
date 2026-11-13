-- ============================================================
-- Location profiles: Tagline replaces Founded; About gets a word limit
-- ============================================================
-- tagline — one short line under the name: "Est. 2022", "Gaming for
--   everyone"… at most 60 characters. Replaces the founded-year field in the
--   editor; existing founded years are carried over as "Est. <year>".
--   founded_year stays (preview builds of the previous commit still read it)
--   and is still returned, but nothing writes it any more.
--
-- About is limited to 200 words, counted as runs of non-space characters that
--   contain a letter or digit (so markdown bullets don't count). The editor
--   enforces the same rule with a live count; this is the backstop.
--
-- Additive: one new column, one new helper, and the two functions replaced
-- with the same signatures.
-- ============================================================

alter table public.location_profiles
  add column if not exists tagline text;

alter table public.location_profiles drop constraint if exists location_profiles_tagline_len;
alter table public.location_profiles add constraint location_profiles_tagline_len
  check (tagline is null or char_length(tagline) <= 60);

update public.location_profiles
   set tagline = 'Est. ' || founded_year
 where tagline is null and founded_year is not null;

-- Words in a piece of text, the way the editor counts them.
create or replace function public.word_count(p_text text)
returns int
language sql
immutable
set search_path = public
as $$
  select count(*)::int
    from regexp_matches(coalesce(p_text, ''), '\S*[[:alnum:]]\S*', 'g');
$$;

-- ── update_location_profile ──────────────────────────────────────────────────
create or replace function public.update_location_profile(
  p_location   uuid,
  p_name       text,
  p_icon       text,
  p_slug       text,
  p_show_stats boolean default null,
  p_profile    jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l       public.locations;
  v_links jsonb;
  link    jsonb;
  venues  jsonb;
  v       jsonb;
  homes   int := 0;
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

  if p_show_stats is not null or p_profile is not null then
    insert into public.location_profiles (location_id)
    values (p_location)
    on conflict (location_id) do nothing;
  end if;

  if p_show_stats is not null then
    update public.location_profiles
       set show_stats = p_show_stats, updated_at = now()
     where location_id = p_location;
  end if;

  if p_profile is null then
    return;
  end if;

  if jsonb_typeof(p_profile) <> 'object' then
    raise exception 'p_profile must be an object' using errcode = '22023';
  end if;

  -- Links: tidy each one, drop the empty ones, insist on a web address.
  if p_profile ? 'links' then
    if jsonb_typeof(p_profile->'links') <> 'array' then
      raise exception 'links must be a list' using errcode = '22023';
    end if;
    v_links := '[]'::jsonb;
    for link in select * from jsonb_array_elements(p_profile->'links') loop
      continue when nullif(btrim(link->>'url'), '') is null;
      if btrim(link->>'url') !~* '^https?://[^\s]+$' then
        raise exception 'Links must start with http:// or https://' using errcode = '23514';
      end if;
      v_links := v_links || jsonb_build_object(
        'label', left(coalesce(nullif(btrim(link->>'label'), ''), btrim(link->>'url')), 40),
        'url',   btrim(link->>'url'));
    end loop;
    if jsonb_array_length(v_links) > 8 then
      raise exception 'At most 8 links' using errcode = '23514';
    end if;
  end if;

  if p_profile ? 'rules_url' and nullif(btrim(p_profile->>'rules_url'), '') is not null
     and btrim(p_profile->>'rules_url') !~* '^https?://[^\s]+$' then
    raise exception 'The rules link must start with http:// or https://' using errcode = '23514';
  end if;

  if p_profile ? 'about' and public.word_count(p_profile->>'about') > 200 then
    raise exception 'Keep About to 200 words or fewer' using errcode = '23514';
  end if;

  if p_profile ? 'tagline' and char_length(btrim(coalesce(p_profile->>'tagline', ''))) > 60 then
    raise exception 'Keep the tagline to 60 characters or fewer' using errcode = '23514';
  end if;

  if p_profile ? 'cover_url' and nullif(btrim(p_profile->>'cover_url'), '') is not null
     and btrim(p_profile->>'cover_url') !~* '^https://' then
    raise exception 'The cover image must be an https address' using errcode = '23514';
  end if;

  update public.location_profiles lp set
    about        = case when p_profile ? 'about'        then nullif(btrim(p_profile->>'about'), '')        else lp.about end,
    cover_url    = case when p_profile ? 'cover_url'    then nullif(btrim(p_profile->>'cover_url'), '')    else lp.cover_url end,
    cover_aspect = case when p_profile ? 'cover_url'
                        then case when nullif(btrim(p_profile->>'cover_url'), '') is null then null
                                  else (p_profile->>'cover_aspect')::real end
                        else lp.cover_aspect end,
    founded_year = case when p_profile ? 'founded_year' then (nullif(p_profile->>'founded_year', ''))::int else lp.founded_year end,
    tagline      = case when p_profile ? 'tagline'      then nullif(btrim(p_profile->>'tagline'), '')      else lp.tagline end,
    links        = case when p_profile ? 'links'        then v_links                                       else lp.links end,
    rules        = case when p_profile ? 'rules'        then nullif(btrim(p_profile->>'rules'), '')        else lp.rules end,
    rules_url    = case when p_profile ? 'rules_url'    then nullif(btrim(p_profile->>'rules_url'), '')    else lp.rules_url end,
    -- Only a club has a choice; a venue is always public.
    is_public    = case when p_profile ? 'is_public' and l.kind = 'club'
                        then coalesce((p_profile->>'is_public')::boolean, false) else lp.is_public end,
    updated_at   = now()
  where lp.location_id = p_location;

  -- Venues: clubs only, and the whole list at once.
  if p_profile ? 'venues' and l.kind = 'club' then
    venues := p_profile->'venues';
    if jsonb_typeof(venues) <> 'array' then
      raise exception 'venues must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(venues) > 10 then
      raise exception 'At most 10 venues' using errcode = '23514';
    end if;

    delete from public.club_venues where club_id = p_location;

    for v in select * from jsonb_array_elements(venues) loop
      if not exists (select 1 from public.locations x
                      where x.id = (v->>'id')::uuid and x.kind = 'venue') then
        raise exception 'Venues must be stores on the platform' using errcode = '23514';
      end if;
      if coalesce((v->>'home')::boolean, false) then
        homes := homes + 1;
      end if;
      insert into public.club_venues (club_id, venue_id, is_home)
      values (p_location, (v->>'id')::uuid, coalesce((v->>'home')::boolean, false))
      on conflict (club_id, venue_id) do update set is_home = excluded.is_home;
    end loop;

    if homes > 1 then
      raise exception 'Only one home venue' using errcode = '23514';
    end if;
  end if;
end;
$$;

revoke all on function public.update_location_profile(uuid, text, text, text, boolean, jsonb) from public;
grant execute on function public.update_location_profile(uuid, text, text, text, boolean, jsonb) to authenticated;


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
  lp         public.location_profiles;
  uid        uuid := auth.uid();
  can_manage boolean := false;
  is_member  boolean := false;
  is_people  boolean := false;
  is_public  boolean := false;
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

  select * into lp from public.location_profiles where location_id = l.id;

  if uid is not null then
    can_manage := uid = any (l.admins);
    is_member  := public.is_location_member(l.id);
    is_people  := can_manage or is_member
               or public.is_location_staff(l.id)
               or public.is_platform_admin()
               or public.is_location_organiser(l.id)
               or public.administers_location_owner(l.id);
  end if;

  -- Public: real venues, and clubs that opted in. Everything else only to its
  -- own people.
  is_public := not l.is_test
               and (l.kind = 'venue' or (l.kind = 'club' and coalesce(lp.is_public, false)));
  if not is_public and not is_people then
    return null;
  end if;

  show_stats := coalesce(lp.show_stats, false);

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
    'settings', case when can_manage then jsonb_build_object(
        'show_stats', show_stats,
        'is_public', coalesce(lp.is_public, false)) else null end,
    'profile', jsonb_build_object(
        'about', lp.about,
        'cover_url', lp.cover_url,
        'cover_aspect', lp.cover_aspect,
        'founded_year', lp.founded_year,
        'tagline', lp.tagline,
        'links', coalesce(lp.links, '[]'::jsonb),
        'rules', lp.rules,
        'rules_url', lp.rules_url),
    -- Kept for clients from before Opening Hours replaced the Tables section.
    'tables', coalesce((
        select jsonb_agg(jsonb_build_object('label', t.label, 'count', t.n) order by t.n desc, t.label nulls last)
          from (select nullif(btrim(label), '') as label, count(*)::int as n
                  from public.store_tables
                 where location_id = l.id and enabled
                 group by 1) t), '[]'::jsonb),
    -- Opening hours: every timeslot a customer could actually book, meaning at
    -- least one enabled table is offered in it. A venue's members-only nights
    -- aren't opening hours; a club's nights are all it has.
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
    -- Store Stats: opt-in, the last twelve months, ten or more bookings.
    'stats', case when show_stats and n_bookings >= 10 then jsonb_build_object(
        'bookings', n_bookings,
        'games', coalesce((
            select jsonb_agg(jsonb_build_object('name', x.name, 'slug', x.slug, 'count', x.n) order by x.n desc, x.name)
              from (select g.name, g.slug, count(*)::int as n
                      from public.bookings b
                      join public.games g on g.id = b.game_id
                     where b.location_id = l.id
                       and g.slug is distinct from 'other'
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
    -- A club's venues: the ones it lists, plus anywhere it has run a published
    -- event. Test venues only on a test club's page.
    'venues', case when l.kind = 'club' then coalesce((
        select jsonb_agg(jsonb_build_object(
                   'id', v.id, 'slug', v.slug, 'name', v.name, 'icon', v.icon,
                   'address', v.address, 'home', x.home)
                 order by x.home desc, v.name)
          from (select venue_id, bool_or(home) as home
                  from (select cv.venue_id, cv.is_home as home
                          from public.club_venues cv
                         where cv.club_id = l.id
                        union all
                        select p.location_id, false
                          from public.battlepacks p
                         where p.host_location_id = l.id
                           and p.status = 'published'
                           and p.location_id is not null) u
                 group by venue_id) x
          join public.locations v on v.id = x.venue_id
         where v.kind = 'venue' and v.id <> l.id
           and (not v.is_test or l.is_test)), '[]'::jsonb)
      else '[]'::jsonb end,
    -- A venue's clubs: public clubs that list it or have run events here.
    'clubs', case when l.kind = 'venue' then coalesce((
        select jsonb_agg(jsonb_build_object(
                   'id', c.id, 'slug', c.slug, 'name', c.name, 'icon', c.icon,
                   'home', x.home)
                 order by x.home desc, c.name)
          from (select club_id, bool_or(home) as home
                  from (select cv.club_id, cv.is_home as home
                          from public.club_venues cv
                         where cv.venue_id = l.id
                        union all
                        select p.host_location_id, false
                          from public.battlepacks p
                         where p.location_id = l.id
                           and p.status = 'published'
                           and p.host_location_id is not null) u
                 group by club_id) x
          join public.locations c on c.id = x.club_id
          join public.location_profiles cp on cp.location_id = c.id and cp.is_public
         where c.kind = 'club' and not c.is_test), '[]'::jsonb)
      else '[]'::jsonb end,
    'events', coalesce((
        select jsonb_agg(public.location_profile_event(p, l.id)
                 order by p.starts_on nulls last, p.name)
          from public.battlepacks p
         where p.status = 'published'
           and (p.location_id = l.id or p.host_location_id = l.id)
           and coalesce(p.ends_on, p.starts_on, today) >= today), '[]'::jsonb),
    'past_events', coalesce((
        select jsonb_agg(public.location_profile_event(x, l.id)
                 order by coalesce(x.ends_on, x.starts_on) desc, x.name)
          from public.battlepacks x
         where x.id in (select p.id
                          from public.battlepacks p
                         where p.status = 'published'
                           and (p.location_id = l.id or p.host_location_id = l.id)
                           and coalesce(p.ends_on, p.starts_on) < today
                         order by coalesce(p.ends_on, p.starts_on) desc, p.name
                         limit 20)), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_location_profile(text) from public;
grant execute on function public.get_location_profile(text) to anon, authenticated;
