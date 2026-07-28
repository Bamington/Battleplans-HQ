-- 20260728000000_battlepack_store_admins.sql
--
-- BattlePack becomes a store admin's tool.
--
-- For the first release only people who administer a venue can open it, and a
-- pack belongs to the store it runs at rather than to whoever typed it in. Two
-- consequences follow, and both are the point rather than side effects:
--
--   * Every admin of a store can edit every pack at that store. An event is the
--     shop's, not one staff member's, and the person who created it leaving
--     should not take the pack with them.
--   * Losing the store loses the packs. Access is decided purely by
--     locations.admins, so the owner column no longer grants anything on its own.
--
-- The public read view is unaffected — published packs stay world-readable at
-- their slug when that lands. This is about who can EDIT.
--
-- Safe on the shared database: BattlePack is unlaunched and admin-only today, so
-- no live code path depends on the rules being loosened. The change to
-- my_platform_apps() is purely additive — a new branch, no existing branch
-- altered — so every other app resolves exactly as it did before.

-- ── Who may open which app ───────────────────────────────────────────────────
--
-- Access has been role-based (user | beta_tester | admin) against a grant table.
-- Store-admin is a different axis: it lives in locations.admins and has nothing
-- to do with user_profiles.role. Rather than invent a fourth profile role that
-- would have to be kept in step with the array, 'store_admin' becomes a
-- PSEUDO-ROLE in the grant table — a grant the function knows how to resolve by
-- looking at locations instead of at the profile.
ALTER TABLE public.platform_app_roles
    DROP CONSTRAINT IF EXISTS platform_app_roles_role_check;

ALTER TABLE public.platform_app_roles
    ADD CONSTRAINT platform_app_roles_role_check
    CHECK (role IN ('user', 'beta_tester', 'admin', 'store_admin'));

COMMENT ON COLUMN public.platform_app_roles.role IS
  'user | beta_tester | admin match user_profiles.role. store_admin is a pseudo-role: it matches anyone listed in some locations.admins array, and has no equivalent on the profile.';

INSERT INTO public.platform_app_roles (app_slug, role)
VALUES ('battlepack', 'store_admin')
ON CONFLICT DO NOTHING;

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
              -- The pseudo-role: granted by administering any venue at all.
              OR EXISTS (
                  SELECT 1 FROM public.platform_app_roles r
                  WHERE r.app_slug = a.slug
                    AND r.role = 'store_admin'
                    AND EXISTS (
                        SELECT 1 FROM public.locations l
                        WHERE l.admins @> ARRAY[auth.uid()]
                    )
              )
          )
    )
    ORDER BY a.display_order, a.name;
$$;

-- ── A pack belongs to its store ──────────────────────────────────────────────
--
-- NOT NULL because the row-level rules below decide access entirely from the
-- venue: a pack without one would be invisible to every store admin and
-- editable only by platform admins, which is a trap rather than a feature.
-- Every existing row already has a location, so this cannot fail.
ALTER TABLE public.battlepacks
    ALTER COLUMN location_id SET NOT NULL;

COMMENT ON COLUMN public.battlepacks.location_id IS
  'The store running the event. Required: every admin of this venue can edit the pack, and that is the only thing that grants access.';

-- ── Access ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_edit_battlepack(pack uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.battlepacks p
        WHERE p.id = pack
          AND (
              EXISTS (
                  SELECT 1 FROM public.user_profiles up
                  WHERE up.id = auth.uid() AND up.role = 'admin'
              )
              -- Deliberately no owner_id clause. The store decides, so an
              -- organiser who leaves loses the pack and their colleagues keep it.
              OR EXISTS (
                  SELECT 1 FROM public.locations l
                  WHERE l.id = p.location_id
                    AND l.admins @> ARRAY[auth.uid()]
              )
          )
    );
$$;

DROP POLICY IF EXISTS "Owners, admins and venue admins read packs" ON public.battlepacks;
DROP POLICY IF EXISTS "Store admins read their packs" ON public.battlepacks;
CREATE POLICY "Store admins read their packs"
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
    );

-- Creating a pack somewhere you do not work is not a thing. owner_id still
-- records who made it — useful history — it just no longer grants anything.
DROP POLICY IF EXISTS "Users create their own packs" ON public.battlepacks;
DROP POLICY IF EXISTS "Store admins create packs at their venues" ON public.battlepacks;
CREATE POLICY "Store admins create packs at their venues"
    ON public.battlepacks FOR INSERT
    TO authenticated
    WITH CHECK (
        owner_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role = 'admin'
            )
            OR EXISTS (
                SELECT 1 FROM public.locations l
                WHERE l.id = battlepacks.location_id
                  AND l.admins @> ARRAY[auth.uid()]
            )
        )
    );

DROP POLICY IF EXISTS "Owners, admins and venue admins update packs" ON public.battlepacks;
DROP POLICY IF EXISTS "Store admins update their packs" ON public.battlepacks;
CREATE POLICY "Store admins update their packs"
    ON public.battlepacks FOR UPDATE
    TO authenticated
    USING (public.can_edit_battlepack(id))
    -- Re-checked after the update, so a pack cannot be moved to a venue the
    -- caller does not administer — which would otherwise be a way to give it away.
    WITH CHECK (public.can_edit_battlepack(id));

DROP POLICY IF EXISTS "Owners and admins delete packs" ON public.battlepacks;
DROP POLICY IF EXISTS "Store admins delete their packs" ON public.battlepacks;
CREATE POLICY "Store admins delete their packs"
    ON public.battlepacks FOR DELETE
    TO authenticated
    USING (public.can_edit_battlepack(id));
