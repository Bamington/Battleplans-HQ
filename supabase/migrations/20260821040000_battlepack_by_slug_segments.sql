-- 20260821040000_battlepack_by_slug_segments.sql
--
-- The public read learns about segments.
--
-- `battlepack_by_slug` is the only way an anonymous reader sees a pack, and it
-- returns an EXPLICIT column list precisely so a column added later has to be
-- named here before it reaches the public (20260802000000). Segments are the
-- level the schedule now hangs off, so the page cannot lay a timetable out
-- without them.
--
-- Two additions, both purely additive to the returned object:
--
--   'segments'   the days or periods, ordered by ordinal
--   segment_id   on each schedule item, so the client can group without
--                a second pass or a guess
--
-- ORDERED BY ORDINAL, NEVER BY DATE. A segment may have no date yet — a pack is
-- publishable before its dates are agreed — and day two still has to follow day
-- one.
--
-- `ends_at` is returned even though it is deliberately outside the notification
-- signature. The two questions are different: what the calendar entry says, and
-- what is worth an email about. This is the first.
--
-- The deployed app ignores both keys, so this is safe ahead of the app that
-- reads them. Everything else is byte-identical to 20260820030000.
--
-- Idempotent: safe to re-run.

create or replace function public.battlepack_by_slug(lookup text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (
      select case
        -- Tombstone: the pack was deleted. The slug can never be reused.
        when s.pack_id is null then
          jsonb_build_object('state', 'gone', 'display_slug', s.display_slug)

        -- Registered and attached, but not currently public.
        when p.status <> 'published' then
          jsonb_build_object('state', 'withdrawn', 'display_slug', s.display_slug)

        else jsonb_build_object(
          'state',        'published',
          'display_slug', s.display_slug,
          'pack', jsonb_build_object(
            'id',               p.id,
            'name',             p.name,
            'game_id',          p.game_id,
            'location_id',      p.location_id,
            'host_location_id', p.host_location_id,
            'starts_on',        p.starts_on,
            'ends_on',          p.ends_on,
            'starts_at',        p.starts_at,
            'timeline',         p.timeline,
            'schedule_shape',   p.schedule_shape,
            'recurrence',       p.recurrence,
            'interval_weeks',   p.interval_weeks,
            'days_of_week',     p.days_of_week,
            'week_of_month',    p.week_of_month,
            'until_date',       p.until_date,
            'format',           p.format,
            'description',      p.description,
            'banner_path',      p.banner_path,
            'banner_aspect',    p.banner_aspect,
            'status',           p.status,
            'slug',             p.slug
          ),
          'game', (
            select jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug,
                                      'icon', g.icon, 'image', g.image)
            from games g where g.id = p.game_id
          ),
          -- Name, address, kind and icon. A venue row also carries an admin
          -- array and contact details that a pack page has no business
          -- publishing, which is why this is a list and not to_jsonb.
          'venue', (
            select jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address,
                                      'kind', l.kind, 'icon', l.icon)
            from locations l where l.id = p.location_id
          ),
          -- The club running it. Name and icon only: this is a credit line
          -- under the title, not a directory entry.
          'host', (
            select jsonb_build_object('id', h.id, 'name', h.name, 'icon', h.icon)
            from locations h where h.id = p.host_location_id
          ),
          -- Who made it, for the byline when no club is hosting. A display
          -- name and nothing else.
          'creator', (
            select jsonb_build_object('name', coalesce(nullif(up.username, ''), nullif(up.handle, '')))
            from user_profiles up where up.id = p.owner_id
          ),
          -- Deviations from the registry defaults, same shape the editor reads.
          'categories', coalesce((
            select jsonb_agg(jsonb_build_object(
              'pack_id',      c.pack_id,
              'category_key', c.category_key,
              'hidden',       c.hidden,
              'sort_order',   c.sort_order,
              'content',      c.content
            ))
            from battlepack_categories c where c.pack_id = p.id
          ), '[]'::jsonb),
          -- The days or periods the schedule hangs off.
          'segments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',        sg.id,
              'pack_id',   sg.pack_id,
              'ordinal',   sg.ordinal,
              'starts_on', sg.starts_on,
              'ends_on',   sg.ends_on,
              'starts_at', sg.starts_at,
              'ends_at',   sg.ends_at,
              'label',     sg.label
            ) order by sg.ordinal)
            from battlepack_schedule_segments sg where sg.pack_id = p.id
          ), '[]'::jsonb),
          'schedule', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',               i.id,
              'pack_id',          i.pack_id,
              'segment_id',       i.segment_id,
              'ordinal',          i.ordinal,
              'kind',             i.kind,
              'label',            i.label,
              'duration_minutes', i.duration_minutes
            ) order by i.ordinal)
            from battlepack_schedule_items i where i.pack_id = p.id
          ), '[]'::jsonb)
        )
      end
      from battlepack_slugs s
      left join battlepacks p on p.id = s.pack_id
      -- The primary key is already lowercased, so lowering the input is what
      -- makes the URL case-insensitive.
      where s.slug = lower(trim(lookup))
    ),
    jsonb_build_object('state', 'unknown')
  );
$$;
