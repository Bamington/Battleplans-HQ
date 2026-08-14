-- 20260814010000_location_apps.sql
--
-- Turn an app on for a particular venue.
--
-- BattlePack launched to platform admins only (20260814000000) because it was
-- not ready for every venue at once. This is the middle setting it was missing:
-- a venue at a time, chosen deliberately, rather than all-or-nothing.
--
-- A TABLE, NOT A `battlepack_enabled` COLUMN ON locations. The platform already
-- thinks in app slugs — platform_apps, platform_app_roles, AppSlug in the
-- client — and a boolean per app would need a schema change, a migration and a
-- new form field every time a fifth app wants the same treatment. One row per
-- (venue, app) says the same thing and costs nothing to extend.

create table if not exists public.location_apps (
    location_id uuid not null references public.locations (id)      on delete cascade,
    app_slug    text not null references public.platform_apps (slug) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (location_id, app_slug)
);

comment on table public.location_apps is
  'Which apps are turned on for which venue. A row means the venue''s admins get that app; no row means they do not. Platform admins are unaffected — they see every app regardless.';

-- my_platform_apps() and the events column both look up by venue.
create index if not exists location_apps_location_id_idx
  on public.location_apps (location_id);

alter table public.location_apps enable row level security;

-- Readable by any signed-in user. The client needs it to decide whether to draw
-- a venue's Upcoming Events column, and which shops have an app switched on is
-- a feature flag rather than anything private.
drop policy if exists "Anyone signed in reads app enablement" on public.location_apps;
create policy "Anyone signed in reads app enablement"
    ON public.location_apps FOR SELECT
    TO authenticated
    USING (true);

-- Writable by platform admins only. Deliberately NOT the venue's own admins:
-- this is the switch that decides whether they get the app at all, so letting
-- them flip it would make it no switch.
drop policy if exists "Platform admins set app enablement" on public.location_apps;
create policy "Platform admins set app enablement"
    ON public.location_apps FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

-- ── The store_admin grant comes back, now with a per-venue gate ──────────────
--
-- 20260728000000 granted BattlePack to the 'store_admin' pseudo-role;
-- 20260814000000 revoked it, because the grant was all-or-nothing and turning
-- the app on would have handed it to every venue admin at once. The grant is
-- now half of a two-part rule, so it is safe to restore:
--
--   platform_app_roles  — MAY a venue admin have this app at all
--   location_apps       — AT WHICH of their venues is it switched on
--
-- Both must say yes. Restoring the grant on its own changes nothing, because no
-- venue has a location_apps row yet.

insert into public.platform_app_roles (app_slug, role)
values ('battlepack', 'store_admin')
on conflict do nothing;

create or replace function public.my_platform_apps()
returns table (
    slug          text,
    name          text,
    description   text,
    url           text,
    display_order integer,
    is_launched   boolean
)
language sql
stable
security definer
set search_path = public
as $$
    SELECT a.slug, a.name, a.description, a.url, a.display_order, a.is_launched
    FROM public.platform_apps a
    WHERE EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND (
              -- Admins see everything, including unlaunched apps.
              up.role = 'admin'
              OR EXISTS (
                  SELECT 1 FROM public.platform_app_roles r
                  WHERE r.app_slug = a.slug AND r.role = up.role
              )
              -- The pseudo-role, now venue-by-venue: granted by administering a
              -- venue that has this app switched on. Previously any venue at all
              -- was enough, which is the part that made the grant unusable as a
              -- rollout mechanism.
              OR EXISTS (
                  SELECT 1 FROM public.platform_app_roles r
                  WHERE r.app_slug = a.slug
                    AND r.role = 'store_admin'
                    AND EXISTS (
                        SELECT 1
                        FROM public.locations l
                        JOIN public.location_apps la
                          ON la.location_id = l.id
                         AND la.app_slug    = a.slug
                        WHERE l.admins @> ARRAY[auth.uid()]
                    )
              )
          )
    )
    ORDER BY a.display_order, a.name;
$$;

comment on function public.my_platform_apps() is
  'The apps the caller may open. Platform admins get everything; a profile role gets whatever platform_app_roles grants it; a venue admin gets an app only where location_apps has switched it on for one of their venues.';
