-- 20260821080000_battlepack_by_slug_league.sql
--
-- The public read learns the two facts 20260821070000 added.
--
-- `segments.kind` is the one that matters to a reader: without it the public
-- page has no way to tell a league's painting week from its Round 3, and would
-- number an Event as though it were play. `round_length_weeks` rides along
-- because the pack object is a field list rather than the whole row, and a
-- league's rounds are otherwise the only part of the pack a reader can see
-- whose length is unexplained.
--
-- DROP AND RECREATE, not ALTER: this is the anonymous reader's only door in,
-- and the rest of the body below is byte-identical to 20260821040000. Diff the
-- two if you are checking — the only changes are the two lines marked NEW.
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
            -- NEW: how long each of a league's rounds runs for.
            'round_length_weeks', p.round_length_weeks,
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
              'label',     sg.label,
              -- NEW: 'round' or 'event'. A league's Events take no round
              -- number and are the organiser's own dates.
              'kind',      sg.kind
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
