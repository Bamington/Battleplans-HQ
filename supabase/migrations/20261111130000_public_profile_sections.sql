-- ============================================================
-- Public profile sections (BattleBench)
--
-- A user chooses what their profile (/@username) shows, per section:
--   public_bench       — Painting Bench: the models on their Painting Desk
--   public_favourites  — Favourites: models and collections they starred
--   public_stats       — Painting Stats: the Overall summary + Most Collected
-- Each is 'off' (the default — nothing new becomes public by itself),
-- 'friends' (accepted friends only) or 'everyone' (anyone, signed out too).
--
-- The profile reads them through get_profile_sections(user), a SECURITY
-- DEFINER function that returns only the sections the viewer may see, with
-- models and collections in the share page's JSON shape (never purchase dates).
-- my_profile_section_availability() tells the settings tab which sections the
-- user has anything for yet (the rest are shown, but disabled).
--
-- Additive: new columns with defaults, new functions.
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS public_bench      text NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS public_favourites text NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS public_stats      text NOT NULL DEFAULT 'off';

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_public_sections_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_public_sections_check CHECK (
    public_bench IN ('off', 'friends', 'everyone')
    AND public_favourites IN ('off', 'friends', 'everyone')
    AND public_stats IN ('off', 'friends', 'everyone')
);

-- user_profiles grants UPDATE per column.
GRANT UPDATE (public_bench, public_favourites, public_stats) ON public.user_profiles TO authenticated;

ALTER TABLE public.models ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;
ALTER TABLE public.boxes  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS models_favourite_idx ON public.models (user_id) WHERE is_favourite;
CREATE INDEX IF NOT EXISTS boxes_favourite_idx  ON public.boxes  (user_id) WHERE is_favourite;

-- ── What the settings tab can offer ─────────────────────────────────────────

-- Per section, whether the signed-in user has anything for it yet:
-- bench — they've ever used the Painting Desk; favourites — they've starred
-- something; stats — they have a model.
CREATE OR REPLACE FUNCTION public.my_profile_section_availability()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'bench', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid()
                          AND (on_desk OR started_painting_date IS NOT NULL)),
        'favourites', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid() AND is_favourite)
                   OR EXISTS (SELECT 1 FROM public.boxes  WHERE user_id = auth.uid() AND is_favourite),
        'stats', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.my_profile_section_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_section_availability() TO authenticated;

-- ── The profile's door ───────────────────────────────────────────────────────

-- The sections of p_user's profile the viewer may see. A section is visible
-- when it's 'everyone', or 'friends' and the viewer is an accepted friend —
-- or, on your own profile, whenever it's switched on (so you see what you've
-- chosen to show). Hidden sections are simply absent from the result.
--
--   bench:      [model…]                        — on the desk, not yet painted
--   favourites: { models: [model…], boxes: [box…] }
--   stats:      { total, by_status, collections, games, most_collected }
-- Models painted FOR someone else are left out of stats, as on the stats page.
CREATE OR REPLACE FUNCTION public.get_profile_sections(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    prof public.user_profiles;
    viewer uuid := auth.uid();
    is_self boolean := viewer IS NOT NULL AND viewer = p_user;
    is_friend boolean := false;
    result jsonb := '{}'::jsonb;
BEGIN
    SELECT * INTO prof FROM public.user_profiles WHERE id = p_user;
    IF NOT FOUND THEN RETURN NULL; END IF;

    IF viewer IS NOT NULL AND NOT is_self THEN
        is_friend := EXISTS (
            SELECT 1 FROM public.friendships f
             WHERE f.status = 'accepted'
               AND ((f.requester_id = p_user AND f.addressee_id = viewer)
                 OR (f.addressee_id = p_user AND f.requester_id = viewer)));
    END IF;

    IF prof.public_bench = 'everyone' OR (prof.public_bench = 'friends' AND is_friend)
       OR (is_self AND prof.public_bench <> 'off') THEN
        result := result || jsonb_build_object('bench', coalesce((
            SELECT jsonb_agg(public.shared_model_json(m.id)
                             ORDER BY m.started_painting_date DESC NULLS LAST, m.created_at DESC)
              FROM public.models m
             WHERE m.user_id = p_user AND m.on_desk AND m.status <> 'Painted'), '[]'::jsonb));
    END IF;

    IF prof.public_favourites = 'everyone' OR (prof.public_favourites = 'friends' AND is_friend)
       OR (is_self AND prof.public_favourites <> 'off') THEN
        result := result || jsonb_build_object('favourites', jsonb_build_object(
            'models', coalesce((
                SELECT jsonb_agg(public.shared_model_json(m.id) ORDER BY m.name)
                  FROM public.models m WHERE m.user_id = p_user AND m.is_favourite), '[]'::jsonb),
            'boxes', coalesce((
                SELECT jsonb_agg(public.shared_box_json(b.id) ORDER BY b.name)
                  FROM public.boxes b WHERE b.user_id = p_user AND b.is_favourite), '[]'::jsonb)));
    END IF;

    IF prof.public_stats = 'everyone' OR (prof.public_stats = 'friends' AND is_friend)
       OR (is_self AND prof.public_stats <> 'off') THEN
        result := result || jsonb_build_object('stats', (
            WITH owned AS (
                SELECT greatest(m.count, 1) AS n, m.status, m.game_id
                  FROM public.models m
                 WHERE m.user_id = p_user AND m.painted_for_id IS NULL
            )
            SELECT jsonb_build_object(
                'total', coalesce((SELECT sum(n) FROM owned), 0),
                'by_status', jsonb_build_object(
                    'None',              coalesce((SELECT sum(n) FROM owned WHERE status = 'None'), 0),
                    'Assembled',         coalesce((SELECT sum(n) FROM owned WHERE status = 'Assembled'), 0),
                    'Primed',            coalesce((SELECT sum(n) FROM owned WHERE status = 'Primed'), 0),
                    'Partially Painted', coalesce((SELECT sum(n) FROM owned WHERE status = 'Partially Painted'), 0),
                    'Painted',           coalesce((SELECT sum(n) FROM owned WHERE status = 'Painted'), 0)),
                'collections', (SELECT count(*) FROM public.boxes b WHERE b.user_id = p_user),
                'games', (SELECT count(DISTINCT game_id) FROM owned WHERE game_id IS NOT NULL),
                'most_collected', coalesce((
                    SELECT jsonb_agg(row_to_json(g) ORDER BY g.total DESC, g.name)
                      FROM (
                        SELECT coalesce(o.game_id::text, 'none') AS key,
                               coalesce(gm.name, 'No game') AS name,
                               gm.slug,
                               sum(o.n) AS total,
                               coalesce(sum(o.n) FILTER (WHERE o.status = 'Painted'), 0) AS painted
                          FROM owned o LEFT JOIN public.games gm ON gm.id = o.game_id
                         GROUP BY o.game_id, gm.name, gm.slug
                      ) g), '[]'::jsonb)
            )));
    END IF;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_sections(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_sections(uuid) TO anon, authenticated;
