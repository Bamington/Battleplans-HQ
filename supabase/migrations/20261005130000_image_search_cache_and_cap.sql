-- ============================================================
-- image-search: result cache + per-user daily cap (BattleBench)
--
-- The image-search Edge Function pays Brave per search. Two things keep it
-- inside Brave's free monthly credit:
--
--   image_search_cache  — results by normalised search words. The same box
--                         searched by ten users costs one search.
--   image_search_usage  — searches that actually reached Brave, per user per
--                         day. Cache hits are free and are not counted.
--
-- Both are service-role only: RLS on with NO policies, so the Data API sees
-- nothing. Only the Edge Function (service role) reads or writes them.
--
-- Purely additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.image_search_cache (
    query_key  text PRIMARY KEY,          -- lower-cased, whitespace-collapsed
    results    jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_search_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.image_search_usage (
    user_id uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    day     date    NOT NULL,
    count   integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.image_search_usage ENABLE ROW LEVEL SECURITY;

-- Take one search from a user's allowance for today, atomically. Returns
-- false (and changes nothing) once they're at the limit.
--
-- One statement, so two searches racing from the same user can't both slip
-- under the cap: the upsert's WHERE makes the second one update no row.
CREATE OR REPLACE FUNCTION public.image_search_take(p_user uuid, p_limit integer)
RETURNS boolean
LANGUAGE sql
AS $$
    WITH taken AS (
        INSERT INTO public.image_search_usage AS u (user_id, day, count)
        VALUES (p_user, (now() AT TIME ZONE 'utc')::date, 1)
        ON CONFLICT (user_id, day) DO UPDATE
            SET count = u.count + 1
            WHERE u.count < p_limit
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM taken);
$$;

-- Callable by the Edge Function only; a client must not be able to spend or
-- reset anyone's allowance.
REVOKE ALL ON FUNCTION public.image_search_take(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.image_search_take(uuid, integer) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_search_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_search_usage TO service_role;
