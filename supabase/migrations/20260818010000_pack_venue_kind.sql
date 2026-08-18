-- 20260818010000_pack_venue_kind.sql
--
-- Tell a public pack page whose event it is.
--
-- A pack run by a club should say so under its title, the way it names the
-- game. `battlepack_by_slug` returns the venue as name and address only, so the
-- page cannot tell a club from a shop, and has no artwork for either.
--
-- Two more fields on the venue object: `kind` and `icon`.
--
-- STILL NOT `to_jsonb(l)`. The existing comment is right and stays: a location
-- row carries an admins array and contact details a pack page has no business
-- publishing, so every field is named deliberately. `kind` says what sort of
-- place it is and `icon` is the picture it already shows in every picker —
-- neither reveals anything the venue has not already put on display.
--
-- Nothing else in the function changes; it is repeated verbatim because a SQL
-- function has to be recreated whole.

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
          -- Explicit column list rather than to_jsonb(p): a column added later
          -- should have to be named here before it reaches the public, rather
          -- than arriving by default.
          'pack', jsonb_build_object(
            'id',            p.id,
            'name',          p.name,
            'game_id',       p.game_id,
            'location_id',   p.location_id,
            'starts_on',     p.starts_on,
            'ends_on',       p.ends_on,
            'starts_at',     p.starts_at,
            'timeline',      p.timeline,
            'format',        p.format,
            'description',   p.description,
            'banner_path',   p.banner_path,
            'banner_aspect', p.banner_aspect,
            'status',        p.status,
            'slug',          p.slug
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
      -- makes the URL case-insensitive: /TEST-Quarmaggedon-3 finds the pack
      -- registered as test-quarmaggedon-3.
      where s.slug = lower(trim(lookup))
    ),
    jsonb_build_object('state', 'unknown')
  );
$$;
