-- 20260820030000_battlepack_creator_name.sql
--
-- Say who made a published pack, by name.
--
-- The social preview for an event reads "BattlePack: <event> by <club>", and
-- falls back to the person who created it when no club is hosting. That name is
-- the only thing missing from `battlepack_by_slug`.
--
-- A NAME, STILL NOT AN ID. 20260802000000 left owner_id out on purpose: it is a
-- user id, it is of no use to a reader, and a public endpoint should not hand
-- out the set of people who administer a store. None of that changes here. What
-- is added is the display name they already chose to be known by — the same
-- string their profile shows — and nothing that could be used to look them up.
--
-- Falls back to the handle, then to null. A pack whose creator has neither is
-- rendered by the caller as the venue or as nothing at all; an empty byline is
-- better than "by null".
--
-- Everything else is byte-identical to 20260818020000. Recreated in full rather
-- than patched because a jsonb_build_object cannot be altered in place, which is
-- also why the explicit column list is worth keeping: a column added later has
-- to be named here before it reaches the public.
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
          -- name and nothing else — no id, no handle-to-id mapping, nothing
          -- that identifies the account behind it.
          'creator', (
            select jsonb_build_object('name', coalesce(nullif(up.username, ''), nullif(up.handle, '')))
            from user_profiles up where up.id = p.owner_id
          ),
          -- Deviations from the registry defaults, same shape the editor reads,
          -- so the client can compute visibility with the same code.
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
          'schedule', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',               i.id,
              'pack_id',          i.pack_id,
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
