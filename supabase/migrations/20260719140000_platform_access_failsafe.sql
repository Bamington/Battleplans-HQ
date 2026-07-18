-- 20260719140000_platform_access_failsafe.sql
--
-- Fail safe when a user has no user_profiles row.
--
-- As written, my_platform_apps() resolved the caller's role with a plain lookup
-- against user_profiles. A signed-in user with no row there produced an empty
-- CTE, so the join yielded no apps at all — and because AppAccessRoute blocks on
-- an empty result, that user would be locked out of every app on the platform
-- rather than merely seeing a short switcher.
--
-- New signups get a row from handle_new_user(), but users imported from the old
-- BattlePlan predate that trigger, so this is not hypothetical.
--
-- Treating a missing row as 'user' matches the column default
-- (user_profiles.role DEFAULT 'user'), so the fallback agrees with what such a
-- user would get the moment a row is created for them.
--
-- Note this only affects the app-visibility lens. It grants nothing: every other
-- policy still keys off auth.uid(), and 'user' is the least-privileged role.

CREATE OR REPLACE FUNCTION public.my_platform_apps(as_role text DEFAULT NULL)
RETURNS TABLE (
    slug          text,
    name          text,
    description   text,
    url           text,
    display_order integer,
    is_launched   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE e.role = 'admin'
       OR EXISTS (
           SELECT 1 FROM public.platform_app_roles r
           WHERE r.app_slug = a.slug AND r.role = e.role
       )
    ORDER BY a.display_order, a.name;
$$;

GRANT EXECUTE ON FUNCTION public.my_platform_apps(text) TO authenticated;
