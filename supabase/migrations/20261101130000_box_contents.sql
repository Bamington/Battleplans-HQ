-- ============================================================
-- box_contents: what's inside a boxed product (BattleBench)
--
-- The box-contents Edge Function looks a box up on the web (Brave web search)
-- and has Claude Haiku read the results into a list of models. The answer is
-- kept here and shared by everyone, so Starter Set 01 is looked up once.
--
--   box_contents        — one row per (box name, game). `items` is the list
--                         of models; `found` is false when the lookup ran but
--                         nothing believable came back (so we don't retry it
--                         on every open). Rows nobody has edited are looked up
--                         again after 90 days; once an admin edits a row
--                         (`edited_at` set) it is never overwritten.
--   box_contents_usage  — lookups that actually reached Brave/Haiku, per user
--                         per day, for the daily cap. Cached answers are free.
--
-- Reads for ordinary users go through the Edge Function (service role). Admins
-- may read, edit and delete rows directly, for the Box Contents admin page.
--
-- Purely additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.box_contents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- lower-cased, whitespace-collapsed box name + '|' + game id (or '')
    query_key   text NOT NULL UNIQUE,
    box_name    text NOT NULL,
    game_id     uuid REFERENCES public.games (id) ON DELETE SET NULL,
    game_name   text,
    -- [{ "name": "RX-78-2 Gundam", "count": 1 }, …]
    items       jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- [{ "title": "…", "url": "https://…" }, …] — where the answer came from
    sources     jsonb NOT NULL DEFAULT '[]'::jsonb,
    found       boolean NOT NULL DEFAULT true,
    fetched_at  timestamptz NOT NULL DEFAULT now(),
    edited_at   timestamptz,
    edited_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.box_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage box contents"
    ON public.box_contents
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
         WHERE user_profiles.id = auth.uid()
           AND user_profiles.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.user_profiles
         WHERE user_profiles.id = auth.uid()
           AND user_profiles.role = 'admin'
    ));

GRANT SELECT, UPDATE, DELETE ON public.box_contents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.box_contents TO service_role;

CREATE TABLE IF NOT EXISTS public.box_contents_usage (
    user_id uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    day     date    NOT NULL,
    count   integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.box_contents_usage ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.box_contents_usage TO service_role;

-- Take one lookup from a user's allowance for today, atomically; false once
-- they're at the limit. Same shape as image_search_take.
CREATE OR REPLACE FUNCTION public.box_contents_take(p_user uuid, p_limit integer)
RETURNS boolean
LANGUAGE sql
AS $$
    WITH taken AS (
        INSERT INTO public.box_contents_usage AS u (user_id, day, count)
        VALUES (p_user, (now() AT TIME ZONE 'utc')::date, 1)
        ON CONFLICT (user_id, day) DO UPDATE
            SET count = u.count + 1
            WHERE u.count < p_limit
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM taken);
$$;

REVOKE ALL ON FUNCTION public.box_contents_take(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.box_contents_take(uuid, integer) TO service_role;
