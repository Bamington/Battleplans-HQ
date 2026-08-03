-- 20260802000000_battlepack_public_read.sql
--
-- Let anyone read a PUBLISHED pack by its slug.
--
-- 20260727000100 revoked anon's table grants and said why: when the public read
-- landed, someone would be writing a policy for anon, and the safe version of
-- that mistake is one that grants too much on a table anon cannot touch. This
-- keeps that promise. The tables stay revoked and unpolicied for anon; the only
-- thing anon gains is permission to call one function.
--
-- SECURITY DEFINER, so it reads past RLS as its owner. That is the entire risk
-- surface, which is why it takes a slug and nothing else: there is no way to
-- ask it for a pack by id, no way to ask it for a draft, and no filter a caller
-- can influence beyond the slug itself. A pack that is not published returns
-- its state and no content.
--
-- owner_id is deliberately not returned. It is a user id, it is of no use to a
-- reader, and a public endpoint should not hand out the set of people who
-- administer a store.
--
-- THE FOUR STATES ARE THE POINT. battlepack_slugs outlives the packs it names,
-- so a URL that does not resolve can say WHY:
--   published — here is the pack
--   withdrawn — the slug and pack exist, the pack is not currently published
--   gone      — the slug is a tombstone, pack_id NULL after deletion
--   unknown   — never registered
-- Collapsing those into one 404 throws away the distinction the ledger exists
-- to preserve.
--
-- Idempotent: safe to re-run.

create or replace function public.battlepack_by_slug(lookup text)
returns jsonb
language sql
stable
security definer
set search_path = public
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
          -- Name and address only. A venue row carries an admin array and
          -- contact details that a pack page has no business publishing.
          'venue', (
            select jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address)
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

comment on function public.battlepack_by_slug(text) is
  'Public read for a published pack, by slug. Returns {state: published|withdrawn|gone|unknown} plus the pack, game, venue, category rows and schedule when published. SECURITY DEFINER — the battlepack tables stay unreadable to anon, and this is the only way in.';

-- anon reads published packs; authenticated gets the same function so a signed-in
-- visitor takes the same path rather than a second one that could disagree.
revoke all on function public.battlepack_by_slug(text) from public;
grant execute on function public.battlepack_by_slug(text) to anon, authenticated;
