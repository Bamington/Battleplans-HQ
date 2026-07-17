-- 20260716140000_paint_packs.sql
--
-- Paint packs — publishable, curated sets of paints from the shared hobby_items
-- library (e.g. "Citadel Contrast", "Army Painter Warpaints"). A user browses
-- public packs and ADDS one to their collection; their paint library is then
-- derived from the packs they've added.
--
-- REFERENCE model (deliberately NOT the deep-clone model BattleCards uses):
-- paints are a shared, curated library — identical for everyone and not
-- user-editable — so adding a pack records a single membership row rather than
-- duplicating paint rows. Library corrections propagate to everyone, and
-- removing a pack is a clean single-row delete.
--
--   paint_packs        — the published pack definition
--   paint_pack_items   — which shared paints (hobby_items) a pack contains
--   paint_pack_imports — a user's "I added this pack" marker
--
-- Packs are game-agnostic (paints aren't tied to a game), so there is no
-- game_id. Official/system packs have owner IS NULL (mirrors how the curated
-- hobby_items rows use owner IS NULL) and are managed only by admins.

-- ── paint_packs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paint_packs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner       uuid REFERENCES auth.users (id) ON DELETE CASCADE,  -- NULL = official/system pack
    name        text NOT NULL,
    description text,
    brand       text,        -- optional primary brand, for display/thumbnail
    is_public   boolean NOT NULL DEFAULT false,
    is_official boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paint_packs_owner_idx  ON public.paint_packs USING btree (owner);
CREATE INDEX IF NOT EXISTS paint_packs_public_idx ON public.paint_packs USING btree (is_public);

ALTER TABLE public.paint_packs ENABLE ROW LEVEL SECURITY;

-- Anyone can see public packs (and their own drafts).
CREATE POLICY "Read public or own paint packs"
    ON public.paint_packs FOR SELECT
    TO authenticated, anon
    USING (is_public OR owner = auth.uid());

-- Owners manage their own packs but may NOT self-promote to official.
CREATE POLICY "Owners manage their paint packs"
    ON public.paint_packs
    TO authenticated
    USING (owner IS NOT NULL AND owner = auth.uid())
    WITH CHECK (owner IS NOT NULL AND owner = auth.uid() AND is_official = false);

-- Admins manage everything, including official/system packs (owner IS NULL).
CREATE POLICY "Admins manage all paint packs"
    ON public.paint_packs
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ));

-- ── paint_pack_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paint_pack_items (
    pack_id       uuid   NOT NULL REFERENCES public.paint_packs (id) ON DELETE CASCADE,
    hobby_item_id bigint NOT NULL REFERENCES public.hobby_items (id) ON DELETE CASCADE,
    display_order integer NOT NULL DEFAULT 0,
    PRIMARY KEY (pack_id, hobby_item_id)
);

CREATE INDEX IF NOT EXISTS paint_pack_items_pack_idx  ON public.paint_pack_items USING btree (pack_id);
CREATE INDEX IF NOT EXISTS paint_pack_items_paint_idx ON public.paint_pack_items USING btree (hobby_item_id);

ALTER TABLE public.paint_pack_items ENABLE ROW LEVEL SECURITY;

-- Readable whenever the parent pack is readable.
CREATE POLICY "Read items of visible paint packs"
    ON public.paint_pack_items FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.paint_packs p
        WHERE p.id = paint_pack_items.pack_id
          AND (p.is_public OR p.owner = auth.uid())
    ));

-- Writable by the pack's owner.
CREATE POLICY "Owners manage their paint pack items"
    ON public.paint_pack_items
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.paint_packs p
        WHERE p.id = paint_pack_items.pack_id AND p.owner = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.paint_packs p
        WHERE p.id = paint_pack_items.pack_id AND p.owner = auth.uid()
    ));

-- Writable by admins (covers official packs with owner IS NULL).
CREATE POLICY "Admins manage all paint pack items"
    ON public.paint_pack_items
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    ));

-- ── paint_pack_imports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paint_pack_imports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users (id)   ON DELETE CASCADE,
    pack_id     uuid NOT NULL REFERENCES public.paint_packs (id) ON DELETE CASCADE,
    imported_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, pack_id)
);

CREATE INDEX IF NOT EXISTS paint_pack_imports_user_idx ON public.paint_pack_imports USING btree (user_id);
CREATE INDEX IF NOT EXISTS paint_pack_imports_pack_idx ON public.paint_pack_imports USING btree (pack_id);

ALTER TABLE public.paint_pack_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own paint pack imports"
    ON public.paint_pack_imports FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- You may only add (import) a pack you can actually see.
CREATE POLICY "Add own paint pack imports"
    ON public.paint_pack_imports FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.paint_packs p
            WHERE p.id = paint_pack_imports.pack_id
              AND (p.is_public OR p.owner = auth.uid())
        )
    );

CREATE POLICY "Remove own paint pack imports"
    ON public.paint_pack_imports FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ── Views ────────────────────────────────────────────────────────────────────
-- The caller's paint library: every shared paint from a pack they've added,
-- plus any paints they created themselves. security_invoker means each of the
-- underlying tables' RLS applies to the caller, so imports are scoped to them.
CREATE OR REPLACE VIEW public.user_paints WITH (security_invoker = true) AS
    SELECT hi.*
    FROM public.hobby_items hi
    WHERE hi.owner = auth.uid()
    UNION
    SELECT hi.*
    FROM public.hobby_items hi
    JOIN public.paint_pack_items   ppi ON ppi.hobby_item_id = hi.id
    JOIN public.paint_pack_imports imp ON imp.pack_id = ppi.pack_id
    WHERE imp.user_id = auth.uid();

GRANT SELECT ON public.user_paints TO authenticated;

-- Packs with a paint count, for the browse list's content badge.
CREATE OR REPLACE VIEW public.paint_pack_summary WITH (security_invoker = true) AS
    SELECT p.*, count(ppi.hobby_item_id) AS item_count
    FROM public.paint_packs p
    LEFT JOIN public.paint_pack_items ppi ON ppi.pack_id = p.id
    GROUP BY p.id;

GRANT SELECT ON public.paint_pack_summary TO authenticated, anon;
