-- 20260719130000_impersonate_role.sql
--
-- Let an admin preview the platform as a lower access level ("view as").
--
-- my_platform_apps() gains an optional as_role. The check that matters is here
-- rather than in the client: the function only honours as_role when the CALLER
-- is genuinely an admin, so a regular user passing as_role => 'admin' is simply
-- ignored and gets their own apps back. The parameter can therefore only ever
-- narrow what you see, never widen it.
--
-- This is a lens over app visibility, not a login-as-someone-else: the admin
-- keeps their own session and their own rows, so every other RLS policy still
-- evaluates against their real auth.uid().

-- Dropped rather than replaced: adding a defaulted parameter creates a second
-- overload, which would make the existing no-arg call ambiguous.
DROP FUNCTION IF EXISTS public.my_platform_apps();

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
        SELECT up.role AS real_role
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
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
