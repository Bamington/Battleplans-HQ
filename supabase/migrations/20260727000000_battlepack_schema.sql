-- 20260727000000_battlepack_schema.sql
--
-- BattlePack's schema: packs, their categories, their schedule, and the slug
-- ledger that makes published URLs permanent.
--
-- A pack is one document describing one wargaming event. It is assembled from
-- CATEGORIES drawn from a curated catalogue (Event Basics, Rounds & Breaks,
-- FAQ…). That catalogue lives in TypeScript, not here — every category needs a
-- bespoke form with hand-written helper copy, so a form component is being
-- written per category either way, and a database catalogue would only be a
-- second source of truth to keep in sync. Adding a category should need a
-- deploy, not a deploy AND a migration.
--
-- Categories use one of three storage paths, declared per category by the
-- registry:
--
--   core     → real typed columns on battlepacks
--   schedule → rows in battlepack_schedule_items
--   section  → the content jsonb on battlepack_categories
--
-- Purely additive: four new tables, three new functions. Nothing existing is
-- touched, so this is safe to apply to the shared database ahead of any deploy.
-- Idempotent.

-- ------------------------------------------------------------
-- BATTLEPACKS
-- The core pack row. Mandatory universal fields are real columns.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepacks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,

    -- Fixed at creation and never changed. Changing it would orphan the
    -- game-specific mandatory categories — possibly with content typed into
    -- them — and none of block / silently-drop / keep-and-flag is free. ON
    -- DELETE RESTRICT because a pack without its game is meaningless.
    game_id     uuid NOT NULL REFERENCES public.games (id) ON DELETE RESTRICT,

    -- Optional: not every event runs at a venue on the platform. When it is
    -- set, that venue's admins can edit the pack (see the RLS below).
    location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,

    starts_on   date,
    owner_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

    -- draft → published → unpublished → published → …
    -- Unpublishing is a rare, deliberate "this event is off", not a routine
    -- step: published packs stay fully editable, so fixing a typo never means
    -- tombstoning the URL every attendee is holding.
    status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'unpublished')),

    -- The display form of the URL slug, as the organiser typed it. NULL until
    -- first publish, and permanent from that moment on — see the triggers.
    -- Case-insensitive uniqueness lives in battlepack_slugs, not here.
    slug        text,

    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    -- A pack can only leave draft once it has a URL to leave it at.
    CONSTRAINT battlepacks_published_needs_slug
        CHECK (status = 'draft' OR slug IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS battlepacks_owner_id_idx    ON public.battlepacks USING btree (owner_id);
CREATE INDEX IF NOT EXISTS battlepacks_game_id_idx     ON public.battlepacks USING btree (game_id);
CREATE INDEX IF NOT EXISTS battlepacks_location_id_idx ON public.battlepacks USING btree (location_id);
CREATE INDEX IF NOT EXISTS battlepacks_status_idx      ON public.battlepacks USING btree (status);

DROP TRIGGER IF EXISTS battlepacks_set_updated_at ON public.battlepacks;
CREATE TRIGGER battlepacks_set_updated_at
    BEFORE UPDATE ON public.battlepacks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.battlepacks.game_id IS
  'Fixed at creation. The game-specific mandatory category set resolves exactly once, from this, and never needs reconciling.';
COMMENT ON COLUMN public.battlepacks.slug IS
  'Display form of the public URL (battlepack.app/<slug>). NULL until first publish, immutable thereafter. Uniqueness is enforced case-insensitively by battlepack_slugs.';

-- ------------------------------------------------------------
-- BATTLEPACK_SLUGS
-- Every slug that has ever been published, forever.
--
-- This is a ledger, not a mirror of battlepacks. A unique index on
-- battlepacks.slug could not do the job: deleting a pack would free its slug,
-- and the design requires that a slug is never reused by anything, ever —
-- not by another pack, not after unpublishing, not after deletion.
--
-- It also gives the tombstone page the two states it has to tell apart. An
-- organiser who unpublishes to fix something must not have every attendee's
-- link read "this event has been deleted":
--
--   pack_id set, pack not published  → withdrawn ("not currently available")
--   pack_id NULL (pack deleted)      → gone
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepack_slugs (
    -- Lowercased. Being the primary key is what makes uniqueness and lookup
    -- both case-insensitive, so someone typing the URL in lower case does not
    -- get a 404 on a slug that was registered with capitals.
    slug         text PRIMARY KEY,
    -- What the organiser actually typed, so the canonical URL can be rendered
    -- (and redirected to) even after the pack itself is gone.
    display_slug text NOT NULL,
    pack_id      uuid REFERENCES public.battlepacks (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT battlepack_slugs_is_lowercase CHECK (slug = lower(slug))
);

CREATE INDEX IF NOT EXISTS battlepack_slugs_pack_id_idx ON public.battlepack_slugs USING btree (pack_id);

COMMENT ON TABLE public.battlepack_slugs IS
  'Every slug ever published, retained after unpublish and after the pack is deleted. Slugs are never reused. pack_id NULL means the pack is gone — the tombstone copy differs from a merely withdrawn one.';

-- ------------------------------------------------------------
-- BATTLEPACK_SCHEDULE_ITEMS
-- Rounds & Breaks. Genuinely relational — queried and reordered — so it gets
-- a table rather than being buried in jsonb.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepack_schedule_items (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id    uuid NOT NULL REFERENCES public.battlepacks (id) ON DELETE CASCADE,
    ordinal    integer NOT NULL,
    kind       text NOT NULL CHECK (kind IN ('round', 'break')),
    label      text,
    starts_at  time,
    ends_at    time,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- DEFERRABLE so a drag-reorder can renumber rows inside one transaction
    -- without having to shuffle them through temporary ordinals first.
    CONSTRAINT battlepack_schedule_items_pack_ordinal_key
        UNIQUE (pack_id, ordinal) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS battlepack_schedule_items_pack_id_idx
    ON public.battlepack_schedule_items USING btree (pack_id, ordinal);

-- ------------------------------------------------------------
-- BATTLEPACK_CATEGORIES
-- Membership, visibility and ordering for EVERY category regardless of its
-- storage path, plus the content jsonb for `section`-storage ones.
--
-- Named for membership, not content, and the distinction matters: visibility
-- cannot live on a content row, because not every category has one. Rounds &
-- Breaks is hideable but its content lives in battlepack_schedule_items.
--
-- A row exists ONLY where a pack departs from the registry defaults:
--
--   mandatory / default, untouched  → no row; derived from the registry
--   default, hidden                 → row, hidden = true
--   optional, added                 → row, hidden = false, plus content
--   optional, added then hidden     → row, hidden = true, content retained
--
-- Seeding full membership at creation would mean a backfill migration across
-- every existing pack each time the TypeScript registry gains a category —
-- a recurring tax for no benefit. Storing only deviations propagates registry
-- changes to every pack for free.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battlepack_categories (
    pack_id      uuid NOT NULL REFERENCES public.battlepacks (id) ON DELETE CASCADE,
    -- Matches a key in CATEGORY_REGISTRY. Deliberately not a foreign key:
    -- the catalogue is in TypeScript, so there is nothing here to point at.
    category_key text NOT NULL,

    -- Categories are hidden, never deleted, and their content is retained, so
    -- re-adding one brings its text back. Mandatory categories cannot be
    -- hidden — that is enforced in the registry, since only it knows the tier.
    hidden       boolean NOT NULL DEFAULT false,

    -- NULL means "use the registry's default weight".
    sort_order   integer,

    -- Only `section`-storage categories use this; core and schedule ones leave
    -- it NULL and keep their content in their own columns / table.
    content      jsonb,

    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (pack_id, category_key)
);

DROP TRIGGER IF EXISTS battlepack_categories_set_updated_at ON public.battlepack_categories;
CREATE TRIGGER battlepack_categories_set_updated_at
    BEFORE UPDATE ON public.battlepack_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.battlepack_categories IS
  'Deviations from the TypeScript registry defaults — membership, visibility and order — plus the content jsonb for section-storage categories. Absence of a row means "as the registry says".';

-- ------------------------------------------------------------
-- SLUG RULES
--
-- Enforced in the database, not the client: the guarantee that a published URL
-- never moves and never gets handed to somebody else should not depend on
-- whoever is calling.
-- ------------------------------------------------------------

-- Paths BattlePack itself serves. The public page for a published pack lives at
-- the root — battlepack.app/<slug> — so it shares a namespace with the app's own
-- routes, and anything the app routes must be permanently unavailable as a slug.
-- Adding a route to apps/battlepack/src/App.tsx means adding it here too.
CREATE OR REPLACE FUNCTION public.battlepack_reserved_slugs()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        'app', 'login', 'logout', 'auth', 'gallery', 'admin', 'api',
        'reset-password', 'assets', 'public', 'static'
    ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.battlepack_validate_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.slug IS NOT NULL THEN
        NEW.slug := btrim(NEW.slug);

        IF NEW.slug !~ '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$' THEN
            RAISE EXCEPTION 'Invalid pack URL "%": use letters, numbers and hyphens, starting and ending with a letter or number', NEW.slug
                USING ERRCODE = '22023';
        END IF;

        IF lower(NEW.slug) = ANY (public.battlepack_reserved_slugs()) THEN
            RAISE EXCEPTION 'The URL "%" is reserved by the app itself', NEW.slug
                USING ERRCODE = '22023';
        END IF;
    END IF;

    -- Once set, a slug is permanent. It is set at first publish and shown to
    -- the organiser before they commit to it; after that, attendees hold the
    -- link, and an unpublished pack's slug still has to serve its tombstone.
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION 'A pack URL cannot be changed once it has been set (pack %)', OLD.id
            USING ERRCODE = '22023';
    END IF;

    RETURN NEW;
END;
$$;

-- AFTER, not BEFORE: on INSERT the battlepacks row does not exist yet, so the
-- ledger's foreign key would have nothing to point at.
--
-- SECURITY DEFINER because the ledger is otherwise unwritable — reserving a
-- slug is something only this trigger may do, so nobody can squat a URL by
-- writing the table directly.
CREATE OR REPLACE FUNCTION public.battlepack_reserve_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.slug IS NULL THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
        RETURN NULL;                       -- already reserved; slug is immutable
    END IF;

    -- The insert IS the availability check. A pre-flight "is this free?" query
    -- races two organisers publishing the same slug at the same moment; the
    -- primary key does not.
    INSERT INTO public.battlepack_slugs (slug, display_slug, pack_id)
    VALUES (lower(NEW.slug), NEW.slug, NEW.id)
    ON CONFLICT (slug) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1 FROM public.battlepack_slugs
        WHERE slug = lower(NEW.slug) AND pack_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'The URL "%" is already taken', NEW.slug
            USING ERRCODE = '23505';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS battlepacks_validate_slug ON public.battlepacks;
CREATE TRIGGER battlepacks_validate_slug
    BEFORE INSERT OR UPDATE ON public.battlepacks
    FOR EACH ROW EXECUTE FUNCTION public.battlepack_validate_slug();

DROP TRIGGER IF EXISTS battlepacks_reserve_slug ON public.battlepacks;
CREATE TRIGGER battlepacks_reserve_slug
    AFTER INSERT OR UPDATE OF slug ON public.battlepacks
    FOR EACH ROW EXECUTE FUNCTION public.battlepack_reserve_slug();

-- Live availability feedback for the publish panel, without exposing the ledger.
-- Advisory only — the primary key above is what makes it correct.
CREATE OR REPLACE FUNCTION public.battlepack_slug_available(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT candidate IS NOT NULL
       AND btrim(candidate) ~ '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$'
       AND lower(btrim(candidate)) <> ALL (public.battlepack_reserved_slugs())
       AND NOT EXISTS (
           SELECT 1 FROM public.battlepack_slugs WHERE slug = lower(btrim(candidate))
       );
$$;

GRANT EXECUTE ON FUNCTION public.battlepack_slug_available(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.battlepack_slug_available(text) FROM anon;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- BattlePack is admin-only and unlaunched, so V1 can be locked down at zero UX
-- cost: owner, platform admin, and venue admin only. No anonymous access
-- anywhere, and no `using (true)` — `bookings` shipped with one of those and
-- leaked every user's name and email platform-wide until
-- 20260723010000_bookings_privacy.sql. Starting locked and loosening
-- deliberately when the public read view lands is the cheaper order.
--
-- The child tables get their own explicit policies rather than inheriting
-- anything from the parent; RLS does not cascade through foreign keys.
-- ------------------------------------------------------------

-- SECURITY DEFINER so it can see the pack row past battlepacks' own RLS, which
-- is what stops the child-table policies recursing back into it.
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
              p.owner_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.user_profiles up
                  WHERE up.id = auth.uid() AND up.role = 'admin'
              )
              OR EXISTS (
                  SELECT 1 FROM public.locations l
                  WHERE l.id = p.location_id
                    AND l.admins @> ARRAY[auth.uid()]
              )
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_battlepack(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_battlepack(uuid) FROM anon;

-- ── battlepacks ──────────────────────────────────────────────────────────────
ALTER TABLE public.battlepacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners, admins and venue admins read packs" ON public.battlepacks;
CREATE POLICY "Owners, admins and venue admins read packs"
    ON public.battlepacks FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations l
            WHERE l.id = battlepacks.location_id
              AND l.admins @> ARRAY[auth.uid()]
        )
    );

-- Creating a pack for someone else is not a thing; the owner is always the
-- caller. Admins included — an admin who wants a pack creates their own.
DROP POLICY IF EXISTS "Users create their own packs" ON public.battlepacks;
CREATE POLICY "Users create their own packs"
    ON public.battlepacks FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners, admins and venue admins update packs" ON public.battlepacks;
CREATE POLICY "Owners, admins and venue admins update packs"
    ON public.battlepacks FOR UPDATE
    TO authenticated
    USING (public.can_edit_battlepack(id))
    -- Re-checked after the update so a pack cannot be handed to another user.
    WITH CHECK (public.can_edit_battlepack(id));

DROP POLICY IF EXISTS "Owners and admins delete packs" ON public.battlepacks;
CREATE POLICY "Owners and admins delete packs"
    ON public.battlepacks FOR DELETE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() AND up.role = 'admin'
        )
    );

-- ── battlepack_categories ────────────────────────────────────────────────────
ALTER TABLE public.battlepack_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack editors manage its categories" ON public.battlepack_categories;
CREATE POLICY "Pack editors manage its categories"
    ON public.battlepack_categories
    TO authenticated
    USING (public.can_edit_battlepack(pack_id))
    WITH CHECK (public.can_edit_battlepack(pack_id));

-- ── battlepack_schedule_items ────────────────────────────────────────────────
ALTER TABLE public.battlepack_schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack editors manage its schedule" ON public.battlepack_schedule_items;
CREATE POLICY "Pack editors manage its schedule"
    ON public.battlepack_schedule_items
    TO authenticated
    USING (public.can_edit_battlepack(pack_id))
    WITH CHECK (public.can_edit_battlepack(pack_id));

-- ── battlepack_slugs ─────────────────────────────────────────────────────────
-- The ledger is written only by the reserve trigger (SECURITY DEFINER) and read
-- only through battlepack_slug_available(). Nobody else touches it: a slug is a
-- permanent claim, and letting a client write the table directly would let one
-- squat every good URL. Platform admins get a window in for support.
ALTER TABLE public.battlepack_slugs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read the slug ledger" ON public.battlepack_slugs;
CREATE POLICY "Admins read the slug ledger"
    ON public.battlepack_slugs FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
    ));
