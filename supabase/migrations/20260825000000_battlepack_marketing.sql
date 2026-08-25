-- 20260825000000_battlepack_marketing.sql
--
-- What the BattlePack marketing site needs from the database. Two unrelated
-- things, kept in one migration because they arrive with one deploy and neither
-- is worth a file of its own.
--
--  1. `stores` becomes a reserved slug, because battlepack.app/stores is now a
--     route the app itself serves.
--  2. `venue_leads` learns which app a lead came in through, so the BattlePack
--     stores page can use the same inbox without the two being confused.
--
-- Additive only. Nothing existing changes meaning.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RESERVING `stores`
--
-- A published pack lives at battlepack.app/<slug>, so the app's own routes share
-- that namespace and every path the app serves has to be unavailable as a slug.
-- The list now lives in FOUR places and all four have to agree:
--
--   * apps/battlepack/src/App.tsx        — the route
--   * apps/battlepack/vercel.json        — the rewrite that must NOT send this
--                                          path to the social-preview function
--   * this function                      — what an organiser may claim
--   * apps/battlepack/CLAUDE.md          — where the rule is written down
--
-- The guard below is the point of doing this as a migration rather than an
-- edit. Reserving a slug that a live event is already published at would take
-- that event's URL away from everyone holding the link — the trigger only
-- validates on write, so the row would survive and simply stop resolving. If
-- that has happened, this migration stops the deploy instead of doing it
-- quietly. The fix is to pick a different path for the page.
DO $$
DECLARE
    v_pack_id uuid;
BEGIN
    SELECT pack_id INTO v_pack_id
    FROM public.battlepack_slugs
    WHERE slug = 'stores'
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Cannot reserve the slug "stores": it is already published (pack %). Choose a different path for the marketing page.',
            v_pack_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.battlepack_reserved_slugs()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        'app', 'login', 'logout', 'auth', 'gallery', 'admin', 'api',
        'reset-password', 'assets', 'public', 'static',
        -- The marketing site. `stores` is the "For stores & clubs" page; the
        -- landing page is at the root, which was never claimable anyway.
        'stores'
    ]::text[];
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WHICH APP A LEAD CAME FROM
--
-- battleplan.app/venue and battlepack.app/stores both end on a form, both ask a
-- venue the same four questions, and both want the same person to read the
-- answer. One table, one inbox, one column saying which door they came through
-- — rather than a second table that would need its own policies, its own grants
-- and its own edge function to say almost exactly the same thing.
--
-- The default is 'battleplan' so every row written before this migration is
-- correctly labelled, and so BattlePlan's form keeps working unchanged: it
-- doesn't send the column, and it doesn't have to start.
--
-- Constrained rather than free text, because the value is chosen by an
-- unauthenticated form. `anon` can already write this table; without the check
-- it could also write whatever it liked into the subject line of an email we
-- send ourselves.
ALTER TABLE public.venue_leads
    ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'battleplan';

ALTER TABLE public.venue_leads
    DROP CONSTRAINT IF EXISTS venue_leads_app_check;

ALTER TABLE public.venue_leads
    ADD CONSTRAINT venue_leads_app_check CHECK (app IN ('battleplan', 'battlepack'));

COMMENT ON COLUMN public.venue_leads.app IS
  'Which marketing site the lead came through. Set by the form; defaults to battleplan so pre-existing rows and BattlePlan''s own form are correct without change.';

CREATE INDEX IF NOT EXISTS venue_leads_app_created_at_idx
    ON public.venue_leads (app, created_at DESC);

-- No policy or grant changes. `anon` already holds INSERT on the table and the
-- existing "Anyone can submit a venue lead" policy is `with check (true)`, so
-- the new column is covered by the same rules as every other one — validated by
-- its CHECK constraint, which is where that job belongs.
