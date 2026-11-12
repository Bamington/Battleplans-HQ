-- ============================================================
-- Public profile gameplay sections — second pass
--
-- Follows 20261112120000_public_profile_gameplay.sql (already applied):
--
--   battles.most_played   — top 10, OFFICIAL games only (games.supported);
--                           custom games are left out
--   battles.most_wins     — the official game with the most wins:
--   battles.most_losses     { name, slug, count, played }
--   recent_battles        — last 5, and only from the last 3 months
--   venue → venues        — "Favorite Venues": the top 3 public venues the
--                           user has VISITED. A visit is a distinct day at a
--                           venue, from a past booking or a battle logged
--                           there. Same `public_venue` setting.
--
-- my_profile_section_availability: `venue` now means "has visited a public
-- venue", not "has a preferred venue".
--
-- Additive: replaced functions only. Nothing deployed reads these keys yet.
-- ============================================================

-- Distinct (venue, day) visits for a user: past bookings + battles at a venue.
-- Public, non-test venues only. Used by the two functions below.
CREATE OR REPLACE FUNCTION public.profile_venue_visits(p_user uuid)
RETURNS TABLE (location_id uuid, visits bigint, last_visit date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT v.location_id, count(*) AS visits, max(v.day) AS last_visit
      FROM (
        SELECT bk.location_id, bk.date AS day
          FROM public.bookings bk
         WHERE bk.user_id = p_user AND bk.location_id IS NOT NULL AND bk.date <= current_date
        UNION
        SELECT b.location_id, b.date_played
          FROM public.battles b
         WHERE b.user_id = p_user AND b.location_id IS NOT NULL
      ) v
      JOIN public.locations l ON l.id = v.location_id
     WHERE l.kind = 'venue' AND NOT l.is_test
     GROUP BY v.location_id;
$$;

-- Internal helper: callers go through get_profile_sections / availability,
-- which decide who may see what. Never callable directly.
REVOKE ALL ON FUNCTION public.profile_venue_visits(uuid) FROM PUBLIC, anon, authenticated;

-- The availability check runs as the invoker, so it can't call the definer
-- helper above (revoked). This narrow definer function answers yes/no for the
-- caller only.
CREATE OR REPLACE FUNCTION public.profile_has_venue_visit()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profile_venue_visits(auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.profile_has_venue_visit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_has_venue_visit() TO authenticated;

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
        'venue', public.profile_has_venue_visit()
    );
$$;

REVOKE ALL ON FUNCTION public.my_profile_section_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_section_availability() TO authenticated;

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
        -- Streaks: battles in date order (id breaks ties); a loss or draw
        -- breaks a run. Current = wins since the most recent non-win.
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
            WITH per_game AS (
                -- Official games only: custom games stay out of the rankings.
                SELECT gm.id, gm.name, gm.slug,
                       count(*) AS played,
                       count(*) FILTER (WHERE b2.result = 'won')  AS won,
                       count(*) FILTER (WHERE b2.result = 'lost') AS lost
                  FROM public.battles b2 JOIN public.games gm ON gm.id = b2.game_id
                 WHERE b2.user_id = p_user AND gm.supported
                 GROUP BY gm.id, gm.name, gm.slug
            )
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
                    SELECT jsonb_agg(jsonb_build_object('key', g.id::text, 'name', g.name, 'slug', g.slug,
                                                        'played', g.played, 'won', g.won)
                                     ORDER BY g.played DESC, g.won DESC, g.name)
                      FROM (SELECT * FROM per_game ORDER BY played DESC, won DESC, name LIMIT 10) g), '[]'::jsonb),
                'most_wins', (
                    SELECT jsonb_build_object('name', g.name, 'slug', g.slug, 'count', g.won, 'played', g.played)
                      FROM per_game g WHERE g.won > 0
                     ORDER BY g.won DESC, g.played, g.name LIMIT 1),
                'most_losses', (
                    SELECT jsonb_build_object('name', g.name, 'slug', g.slug, 'count', g.lost, 'played', g.played)
                      FROM per_game g WHERE g.lost > 0
                     ORDER BY g.lost DESC, g.played, g.name LIMIT 1))
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
                   AND b.date_played >= (current_date - interval '3 months')::date
                 ORDER BY b.date_played DESC, b.id DESC
                 LIMIT 5
              ) r), '[]'::jsonb));
    END IF;

    IF prof.public_venue = 'everyone' OR (prof.public_venue = 'friends' AND is_friend)
       OR (is_self AND prof.public_venue <> 'off') THEN
        result := result || jsonb_build_object('venues', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'id', l.id, 'name', l.name, 'icon', l.icon,
                       'address', l.address, 'country', l.country, 'visits', v.visits)
                     ORDER BY v.visits DESC, v.last_visit DESC, l.name)
              FROM (SELECT * FROM public.profile_venue_visits(p_user)
                     ORDER BY visits DESC, last_visit DESC LIMIT 3) v
              JOIN public.locations l ON l.id = v.location_id), '[]'::jsonb));
    END IF;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_sections(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_sections(uuid) TO anon, authenticated;
