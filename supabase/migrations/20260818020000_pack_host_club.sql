-- 20260818020000_pack_host_club.sql
--
-- Say which club is running an event, separately from where it happens.
--
-- A pack has always had exactly one place: `location_id`, the venue. That
-- conflates two different facts as soon as clubs exist — a club running a
-- tournament at a shop is hosted by the club and held at the venue, and the
-- pack could only record one of them.
--
-- 20260818010000 worked around it by naming the club when the pack's LOCATION
-- happened to be a club. That only covered a club meeting at its own space, and
-- it made the sub-heading a side effect of the venue field rather than
-- something the organiser chose. This replaces it: the host is explicit, and
-- the venue goes back to meaning only where the tables are.
--
-- ON DELETE SET NULL, not CASCADE. An event held at a shop outlives the club
-- that organised it — the shop still ran it, the attendees still went. Deleting
-- a club should drop its name from the poster, not delete the poster.
--
-- Idempotent: safe to re-run.

alter table public.battlepacks
  add column if not exists host_location_id uuid references public.locations (id) on delete set null;

comment on column public.battlepacks.host_location_id is
  'The club running this event, when a club is. NULL means the venue is running it themselves. Distinct from location_id, which is only ever where it happens.';

-- Both policies below filter by it, and a club's pack list is a hot path.
create index if not exists battlepacks_host_location_id_idx
  on public.battlepacks (host_location_id)
  where host_location_id is not null;

-- ── The host's people can read and edit it ───────────────────────────────────
--
-- A hosted pack appears in the club's own list, and that list is the way into
-- the editor — showing it there without edit rights would be a door that does
-- not open. So the club's admins and its organisers get what the venue's admins
-- get.
--
-- The consequence is worth stating plainly: naming a host hands the event to
-- that club's people. That is the point — it is their event — but it is a real
-- transfer, not a label.

create or replace function public.can_edit_battlepack(pack uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.battlepacks p
        where p.id = pack
          and (
              exists (
                  select 1 from public.user_profiles up
                  where up.id = auth.uid() and up.role = 'admin'
              )
              -- Deliberately no owner_id clause. The store decides, so an
              -- organiser who leaves loses the pack and their colleagues keep it.
              or exists (
                  select 1 from public.locations l
                  where l.id = p.location_id
                    and l.admins @> array[auth.uid()]
              )
              -- Nominated to run events at the venue this pack is at.
              or public.is_location_organiser(p.location_id)
              -- The club hosting it: its admins, and the organisers it has
              -- nominated.
              or (
                  p.host_location_id is not null
                  and (
                      public.administers_location(p.host_location_id)
                      or public.is_location_organiser(p.host_location_id)
                  )
              )
          )
    );
$$;

drop policy if exists "Store admins, staff and organisers read their packs" on public.battlepacks;
create policy "Store admins, staff, organisers and hosts read their packs"
    ON public.battlepacks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations l
            WHERE l.id = battlepacks.location_id
              AND l.admins @> ARRAY[auth.uid()]
        )
        OR public.is_location_staff(battlepacks.location_id)
        OR public.is_location_organiser(battlepacks.location_id)
        -- In the host club's own list, which is the whole point of setting one.
        OR (
            battlepacks.host_location_id is not null
            AND (
                public.administers_location(battlepacks.host_location_id)
                OR public.is_location_organiser(battlepacks.host_location_id)
            )
        )
    );

-- Creating one already required the right to write at the VENUE, and that does
-- not change: a club cannot put an event into a shop that has not agreed to it.
-- The host is a label the creator adds, not a way in.

-- ── The public page reads the host, not the venue's kind ─────────────────────
--
-- Replaces the venue.kind fallback from 20260818010000. The venue object keeps
-- kind and icon — the Key Info panel still wants them — but the sub-heading now
-- comes from `host`, which is a real choice rather than an inference.

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
