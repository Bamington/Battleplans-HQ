-- ============================================================
-- Store tables migration
-- Turns the integer locations.tables count into first-class
-- table objects, each with a size, an on/off flag, and a
-- per-timeslot availability list. Backfills existing counts,
-- then drops locations.tables.
-- ============================================================

-- ------------------------------------------------------------
-- STORE TABLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_tables (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
    name        text NOT NULL,
    size        text NOT NULL DEFAULT 'wargaming',
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT store_tables_size_check CHECK (size IN ('wargaming', 'tcg'))
);

CREATE INDEX IF NOT EXISTS store_tables_location_id_idx ON public.store_tables USING btree (location_id);

ALTER TABLE public.store_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store tables"
    ON public.store_tables FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admins and location admins can manage store tables"
    ON public.store_tables
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations
            WHERE locations.id = store_tables.location_id
            AND locations.admins @> ARRAY[auth.uid()]
        )
    );

-- ------------------------------------------------------------
-- STORE TABLE ↔ TIMESLOT AVAILABILITY
-- A row means the table is bookable in that timeslot.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_table_timeslots (
    table_id    uuid NOT NULL REFERENCES public.store_tables (id) ON DELETE CASCADE,
    timeslot_id uuid NOT NULL REFERENCES public.timeslots (id)    ON DELETE CASCADE,
    PRIMARY KEY (table_id, timeslot_id)
);

CREATE INDEX IF NOT EXISTS store_table_timeslots_timeslot_id_idx ON public.store_table_timeslots USING btree (timeslot_id);

ALTER TABLE public.store_table_timeslots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store table timeslots"
    ON public.store_table_timeslots FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admins and location admins can manage store table timeslots"
    ON public.store_table_timeslots
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
        OR EXISTS (
            SELECT 1
            FROM public.store_tables st
            JOIN public.locations l ON l.id = st.location_id
            WHERE st.id = store_table_timeslots.table_id
            AND l.admins @> ARRAY[auth.uid()]
        )
    );

-- ------------------------------------------------------------
-- BACKFILL — one table object per counted table, named
-- "Table N", size wargaming, enabled, available for every
-- timeslot the venue currently has.
-- ------------------------------------------------------------
INSERT INTO public.store_tables (location_id, name, size, enabled)
SELECT l.id, 'Table ' || gs.n, 'wargaming', true
FROM public.locations l
CROSS JOIN LATERAL generate_series(1, COALESCE(l.tables, 0)) AS gs(n)
WHERE COALESCE(l.tables, 0) > 0;

INSERT INTO public.store_table_timeslots (table_id, timeslot_id)
SELECT st.id, t.id
FROM public.store_tables st
JOIN public.timeslots t ON t.location_id = st.location_id;

-- ------------------------------------------------------------
-- RETIRE the old integer count — tables are objects now.
-- ------------------------------------------------------------
ALTER TABLE public.locations DROP COLUMN IF EXISTS tables;
