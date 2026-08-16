-- 20260814090000_one_platform_apps_function.sql
--
-- Fixes a live bug: the per-venue BattlePack rollout never applied.
--
-- `my_platform_apps` existed TWICE — a zero-arg original and a one-arg
-- impersonation version added later with `as_role text DEFAULT NULL`. Every
-- migration since has edited the zero-arg one: the store_admin pseudo-role
-- (20260728000000), the per-venue location_apps gate (20260814010000) and the
-- organiser branch (20260814080000).
--
-- The client has always called the one-arg version.
--
-- So none of it took effect. The function the app actually runs resolves only
-- the profile role, which means:
--
--   * a store admin has never been given BattlePack by administering a venue;
--   * `location_apps` has never gated anything at the app layer;
--   * only platform admins and profile-role grants have ever worked.
--
-- It looked correct because the only account tested against it was a platform
-- admin, who matches the first branch and sees every app regardless.
--
-- ── The fix ──────────────────────────────────────────────────────────────────
--
-- ONE function, not two. The zero-arg version is dropped rather than kept in
-- step: two overloads with a defaulted argument also make `my_platform_apps()`
-- ambiguous to call, and the whole failure here was two copies of one rule
-- drifting apart. Nothing calls the zero-arg form — the client always passes
-- as_role.
--
-- Impersonation semantics are unchanged: a platform admin may view as another
-- PROFILE role, and that substitution deliberately does not touch the venue
-- branches, which are about what you administer rather than what you are.

drop function if exists public.my_platform_apps();

create or replace function public.my_platform_apps(as_role text default null)
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
set search_path to 'public'
as $$
    WITH me AS (
        SELECT COALESCE(
            (SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid()),
            -- Signed in but no profile row yet: fall back to the least
            -- privileged role instead of returning nothing.
            'user'
        ) AS real_role
        -- Still returns no rows when signed out, so anonymous callers get
        -- nothing rather than the default role's apps.
        WHERE auth.uid() IS NOT NULL
    ),
    effective AS (
        SELECT CASE
            -- Admins only, and only to a role that actually exists. Anything
            -- else (including as_role IS NULL) falls back to the real role.
            WHEN me.real_role = 'admin' AND as_role IN ('user', 'beta_tester', 'admin')
                THEN as_role
            ELSE me.real_role
        END AS role
        FROM me
    )
    SELECT a.slug, a.name, a.description, a.url, a.display_order, a.is_launched
    FROM public.platform_apps a, effective e
    WHERE
        -- Admins see everything, including unlaunched apps.
        e.role = 'admin'
        -- A grant to the profile role they are acting as.
        OR EXISTS (
            SELECT 1 FROM public.platform_app_roles r
            WHERE r.app_slug = a.slug AND r.role = e.role
        )
        -- The store_admin PSEUDO-ROLE, venue by venue. Resolved against
        -- locations and location_staff rather than the profile, which is why
        -- impersonation does not reach it: viewing as a 'user' does not stop
        -- you administering your shop.
        --
        -- Two ways to hold it, and both still need the venue to have been given
        -- the app in location_apps:
        --   * you administer that venue, or
        --   * it nominated you as an organiser.
        OR EXISTS (
            SELECT 1 FROM public.platform_app_roles r
            WHERE r.app_slug = a.slug
              AND r.role = 'store_admin'
              AND (
                  EXISTS (
                      SELECT 1
                      FROM public.locations l
                      JOIN public.location_apps la
                        ON la.location_id = l.id
                       AND la.app_slug    = a.slug
                      WHERE l.admins @> ARRAY[auth.uid()]
                  )
                  OR EXISTS (
                      SELECT 1
                      FROM public.location_staff s
                      JOIN public.location_apps la
                        ON la.location_id = s.location_id
                       AND la.app_slug    = a.slug
                      WHERE s.user_id = auth.uid()
                        AND s.role    = 'organiser'
                  )
              )
        )
    ORDER BY a.display_order, a.name;
$$;

comment on function public.my_platform_apps(text) is
  'The apps the caller may open. THE ONLY VERSION — a second zero-arg overload existed until 20260814090000 and silently collected three migrations worth of edits the app never ran. Platform admins get everything; a profile role gets what platform_app_roles grants it; a venue admin or a nominated organiser gets an app where location_apps has switched it on for their venue.';
