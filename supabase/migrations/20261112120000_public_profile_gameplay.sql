-- ============================================================
-- Public profile: gameplay sections (Battleplan data)
--
-- Three more optional sections on /@username, alongside the BattleBench ones
-- from 20261111130000, each Off / Friends only / Everyone (default off):
--   public_battles         — Battle Record: W/L/D, win rate, streaks, Most Played
--   public_recent_battles  — Recent Battles: the last few, game/result/date/photo
--   public_venue           — Home Venue: their preferred venue
--
-- Plus one thing with no setting at all: my_record_against(user), your OWN
-- record against someone, from your own battles where an opponent is linked to
-- their account. It reads only the caller's rows (SECURITY INVOKER, battles
-- RLS), so it exposes nothing of theirs.
--
-- What never leaves get_profile_sections: opponent names (they're the owner's
-- private notes about other people), battle notes, free-text locations. A
-- recent battle names its venue only when it's linked to one of our public
-- venues. Home Venue only ever shows a 'venue' — never a club (membership is
-- the club's business) or a space (a borrowed room) — and never a test venue.
--
-- Additive: new columns with defaults, a widened check, replaced functions
-- that return a superset of what they did. The deployed build ignores the new
-- keys.
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS public_battles        text NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS public_recent_battles text NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS public_venue          text NOT NULL DEFAULT 'off';

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_public_sections_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_public_sections_check CHECK (
    public_bench IN ('off', 'friends', 'everyone')
    AND public_favourites IN ('off', 'friends', 'everyone')
    AND public_stats IN ('off', 'friends', 'everyone')
    AND public_battles IN ('off', 'friends', 'everyone')
    AND public_recent_battles IN ('off', 'friends', 'everyone')
    AND public_venue IN ('off', 'friends', 'everyone')
);

-- user_profiles grants UPDATE per column.
GRANT UPDATE (public_battles, public_recent_battles, public_venue) ON public.user_profiles TO authenticated;

-- ── What the settings tab can offer ─────────────────────────────────────────

-- As before, plus: battles — they've logged a battle (covers Battle Record and
-- Recent Battles); venue — their preferred location is a public, non-test venue.
CREATE OR REPLACE FUNCTION public.my_profile_section_availability()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'bench', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid()
                          AND (on_desk OR started_painting_date IS NOT NULL)),
        'favourites', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid() AND is_favourite)
                   OR EXISTS (SELECT 1 FROM public.boxes  WHERE user_id = auth.uid() AND is_favourite),
        'stats', EXISTS (SELECT 1 FROM public.models WHERE user_id = auth.uid()),
        'battles', EXISTS (SELECT 1 FROM public.battles WHERE user_id = auth.uid()),
        'venue', EXISTS (SELECT 1 FROM public.user_profiles p
                           JOIN public.locations l ON l.id = p.preferred_location_id
                          WHERE p.id = auth.uid() AND l.kind = 'venue' AND NOT l.is_test)
    );
$$;

REVOKE ALL ON FUNCTION public.my_profile_section_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_section_availability() TO authenticated;

-- ── The profile's door ───────────────────────────────────────────────────────

-- Unchanged for bench / favourites / stats. New keys:
--
--   battles: { played, won, lost, drew, this_year, games,
--              current_streak, longest_streak,
--              most_played: [{ key, name, slug, played, won }] }
--   recent_battles: [{ id, date_played, result, game: {name, slug} | null,
--                      venue: text | null, photo_path: text | null }]
--   venue: { id, name, icon, address, country }
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
    last_date date;
    last_id bigint;
    cur_streak int;
    long_streak int;
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

    IF prof.public_battles = 'everyone' OR (prof.public_battles = 'friends' AND is_friend)
       OR (is_self AND prof.public_battles <> 'off') THEN
        -- Streaks, as on the stats page: battles in date order (id breaks
        -- ties); a loss or draw breaks a run. Current = wins since the most
        -- recent non-win.
        SELECT b.date_played, b.id INTO last_date, last_id
          FROM public.battles b
         WHERE b.user_id = p_user AND b.result <> 'won'
         ORDER BY b.date_played DESC, b.id DESC LIMIT 1;
        SELECT count(*) INTO cur_streak
          FROM public.battles b
         WHERE b.user_id = p_user AND b.result = 'won'
           AND (last_date IS NULL OR (b.date_played, b.id) > (last_date, last_id));
        SELECT coalesce(max(run), 0) INTO long_streak FROM (
            SELECT count(*) AS run FROM (
                SELECT b.result,
                       row_number() OVER (ORDER BY b.date_played, b.id)
                     - row_number() OVER (PARTITION BY b.result = 'won' ORDER BY b.date_played, b.id) AS grp
                  FROM public.battles b WHERE b.user_id = p_user
            ) s WHERE s.result = 'won' GROUP BY s.grp
        ) runs;

        result := result || jsonb_build_object('battles', (
            SELECT jsonb_build_object(
                'played', count(*),
                'won',  count(*) FILTER (WHERE b.result = 'won'),
                'lost', count(*) FILTER (WHERE b.result = 'lost'),
                'drew', count(*) FILTER (WHERE b.result = 'drew'),
                'this_year', count(*) FILTER (WHERE b.date_played >= date_trunc('year', current_date)::date),
                'games', count(DISTINCT b.game_id),
                'current_streak', cur_streak,
                'longest_streak', long_streak,
                'most_played', coalesce((
                    SELECT jsonb_agg(row_to_json(g) ORDER BY g.played DESC, g.won DESC, g.name)
                      FROM (
                        SELECT gm.id::text AS key, gm.name, gm.slug,
                               count(*) AS played,
                               count(*) FILTER (WHERE b2.result = 'won') AS won
                          FROM public.battles b2 JOIN public.games gm ON gm.id = b2.game_id
                         WHERE b2.user_id = p_user
                         GROUP BY gm.id, gm.name, gm.slug
                         ORDER BY played DESC, won DESC, gm.name
                         LIMIT 50
                      ) g), '[]'::jsonb))
              FROM public.battles b WHERE b.user_id = p_user));
    END IF;

    IF prof.public_recent_battles = 'everyone' OR (prof.public_recent_battles = 'friends' AND is_friend)
       OR (is_self AND prof.public_recent_battles <> 'off') THEN
        result := result || jsonb_build_object('recent_battles', coalesce((
            SELECT jsonb_agg(r ORDER BY r.date_played DESC, r.id DESC)
              FROM (
                SELECT b.id, b.date_played, b.result,
                       CASE WHEN gm.id IS NULL THEN NULL
                            ELSE jsonb_build_object('name', gm.name, 'slug', gm.slug) END AS game,
                       (SELECT l.name FROM public.locations l
                         WHERE l.id = b.location_id AND l.kind = 'venue' AND NOT l.is_test) AS venue,
                       (SELECT i.image_path FROM public.battle_images i
                         WHERE i.battle_id = b.id
                         ORDER BY i.is_primary DESC, i.display_order, i.created_at
                         LIMIT 1) AS photo_path
                  FROM public.battles b LEFT JOIN public.games gm ON gm.id = b.game_id
                 WHERE b.user_id = p_user
                 ORDER BY b.date_played DESC, b.id DESC
                 LIMIT 6
              ) r), '[]'::jsonb));
    END IF;

    IF prof.public_venue = 'everyone' OR (prof.public_venue = 'friends' AND is_friend)
       OR (is_self AND prof.public_venue <> 'off') THEN
        result := result || coalesce((
            SELECT jsonb_build_object('venue', jsonb_build_object(
                       'id', l.id, 'name', l.name, 'icon', l.icon,
                       'address', l.address, 'country', l.country))
              FROM public.locations l
             WHERE l.id = prof.preferred_location_id AND l.kind = 'venue' AND NOT l.is_test),
            '{}'::jsonb);
    END IF;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_sections(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_sections(uuid) TO anon, authenticated;

-- ── Head to head ─────────────────────────────────────────────────────────────

-- The caller's record against p_user: their own battles where one of the
-- opponents is linked to p_user's account. Invoker rights — battles RLS keeps
-- it to the caller's rows. Null when there are none (or signed out).
CREATE OR REPLACE FUNCTION public.my_record_against(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
    SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
               'played', count(*),
               'won',  count(*) FILTER (WHERE result = 'won'),
               'lost', count(*) FILTER (WHERE result = 'lost'),
               'drew', count(*) FILTER (WHERE result = 'drew')) END
      FROM public.battles b
     WHERE b.user_id = auth.uid()
       AND EXISTS (SELECT 1 FROM public.battle_opponents bo
                     JOIN public.opponents o ON o.id = bo.opponent_id
                    WHERE bo.battle_id = b.id AND o.linked_user_id = p_user);
$$;

REVOKE ALL ON FUNCTION public.my_record_against(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_record_against(uuid) TO authenticated;
