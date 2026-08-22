-- 20260814080000_organisers_get_battlepack.sql
--
-- A nominated organiser can actually open BattlePack.
--
-- 20260814050000 gave organisers the row-level right to create and edit packs
-- at the venue that nominated them — and then left it unreachable. The app gate
-- resolves the `store_admin` pseudo-role against `locations.admins`, and an
-- organiser is deliberately not an admin, so they got no tile and
-- `usePlatformApps` reported no access. The permission existed and nothing
-- could use it.
--
-- STILL THE SAME TWO-PART GATE. `platform_app_roles` says store admins MAY have
-- BattlePack; `location_apps` says at which venues. This adds a second way to
-- satisfy the first half — nominated rather than owning — and does not touch
-- the second. A venue that has not been given BattlePack does not hand it out
-- through its organisers.
--
-- Only 'organiser' rows count. Counter staff are not being given an app.
--
-- Idempotent: safe to re-run.

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
              -- The pseudo-role, venue by venue. Two ways to hold it:
              -- administering a venue that has the app, or being nominated to
              -- run events at one.
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
          )
    )
    ORDER BY a.display_order, a.name;
$$;

comment on function public.my_platform_apps() is
  'The apps the caller may open. Platform admins get everything; a profile role gets whatever platform_app_roles grants it; a venue admin OR a nominated organiser gets an app where location_apps has switched it on for their venue.';
