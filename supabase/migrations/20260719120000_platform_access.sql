-- 20260719120000_platform_access.sql
--
-- Platform access levels — which of the Battleplans apps each user can reach.
--
-- Half of this already existed: public.user_profiles.role is one of
-- 'user' | 'beta_tester' | 'admin', and admins manage it from Manage Users.
-- This migration adds the other half — a registry of the apps themselves, and
-- a grant table saying which roles may open each one.
--
-- Admins are NOT listed in the grant table; they bypass it and see everything.
-- That way "admins have access to everything" stays true automatically as new
-- apps are added, with no risk of forgetting to grant them.
--
-- Keeping this in the database rather than in each app's code is the whole
-- point: the apps deploy as three separate Vercel projects, so unlocking an app
-- in code means editing three files and shipping three deploys. Here it's one
-- row, live immediately.
--
--   platform_apps        — the app registry (name, url, launch state)
--   platform_app_roles   — which roles may access an app
--   my_platform_apps()   — the caller's accessible apps, resolved server-side

-- ── platform_apps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_apps (
    slug          text PRIMARY KEY,
    name          text NOT NULL,
    description   text,
    url           text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    -- false renders as a disabled "Coming soon" entry for whoever can see it
    is_launched   boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_apps ENABLE ROW LEVEL SECURITY;

-- The catalogue itself isn't sensitive — knowing BattleBox exists reveals
-- nothing. Access is decided by my_platform_apps() and the per-app data RLS.
CREATE POLICY "Read platform apps"
    ON public.platform_apps FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins manage platform apps"
    ON public.platform_apps
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ));

-- ── platform_app_roles ───────────────────────────────────────────────────────
-- An explicit role→app grant rather than a single "minimum level" column,
-- because the levels are not a strict hierarchy: beta testers and regular users
-- get deliberately different sets, not one a superset of the other.
CREATE TABLE IF NOT EXISTS public.platform_app_roles (
    app_slug text NOT NULL REFERENCES public.platform_apps (slug) ON DELETE CASCADE,
    role     text NOT NULL CHECK (role IN ('user', 'beta_tester', 'admin')),
    PRIMARY KEY (app_slug, role)
);

CREATE INDEX IF NOT EXISTS platform_app_roles_role_idx
    ON public.platform_app_roles USING btree (role);

ALTER TABLE public.platform_app_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read platform app roles"
    ON public.platform_app_roles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins manage platform app roles"
    ON public.platform_app_roles
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ));

-- ── my_platform_apps() ───────────────────────────────────────────────────────
-- Resolves the caller's role against the grants server-side and returns only
-- the apps they may open, ordered for the switcher. SECURITY DEFINER so the
-- answer can't be widened by the client.
CREATE OR REPLACE FUNCTION public.my_platform_apps()
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
          )
    )
    ORDER BY a.display_order, a.name;
$$;

GRANT EXECUTE ON FUNCTION public.my_platform_apps() TO authenticated;

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- Launch posture: regular users get BattlePlan only; beta testers also get
-- BattleCards and BattleBox; admins get everything including BattlePack, which
-- has no source yet and so stays unlaunched.
INSERT INTO public.platform_apps (slug, name, description, url, display_order, is_launched) VALUES
    ('battleplan',  'BattlePlan',  'Find stores and book tables',     'https://battleplans-hq-battleplan-xi.vercel.app/app',   1, true),
    ('battlecards', 'BattleCards', 'Build and manage unit cards',     'https://battleplans-hq-battlecards-one.vercel.app/app', 2, true),
    ('battlebox',   'BattleBox',   'Track your miniature collection', 'https://battleplans-hq-battlebox.vercel.app/app',       3, true),
    ('battlepack',  'BattlePack',  'Organise wargaming events',       '#',                                                     4, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.platform_app_roles (app_slug, role) VALUES
    ('battleplan',  'user'),
    ('battleplan',  'beta_tester'),
    ('battlecards', 'beta_tester'),
    ('battlebox',   'beta_tester')
ON CONFLICT DO NOTHING;
