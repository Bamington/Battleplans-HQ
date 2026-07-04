-- ============================================================
-- Booking tables migration
-- Creates: locations, timeslots, bookings, blocked_dates
-- Also adds enabled_battleplan + enabled_battlecards to games
-- ============================================================

-- ------------------------------------------------------------
-- LOCATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,
    address     text NOT NULL,
    icon        text DEFAULT '',
    tables      integer DEFAULT 1 NOT NULL,
    admins      uuid[] DEFAULT ARRAY[]::uuid[],
    store_email text,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT locations_tables_check CHECK (tables > 0)
);

CREATE INDEX IF NOT EXISTS locations_admins_idx ON public.locations USING gin (admins);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read locations"
    ON public.locations FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admins can manage locations"
    ON public.locations
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- ------------------------------------------------------------
-- TIMESLOTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timeslots (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,
    start_time  time NOT NULL,
    end_time    time NOT NULL,
    location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
    availability text[] DEFAULT ARRAY[]::text[],
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT timeslots_time_order_check CHECK (end_time > start_time),
    CONSTRAINT timeslots_availability_check CHECK (
        availability <@ ARRAY[
            'Monday', 'Tuesday', 'Wednesday', 'Thursday',
            'Friday', 'Saturday', 'Sunday'
        ]::text[]
    )
);

CREATE INDEX IF NOT EXISTS timeslots_location_id_idx ON public.timeslots USING btree (location_id);
CREATE INDEX IF NOT EXISTS timeslots_availability_idx ON public.timeslots USING gin (availability);

ALTER TABLE public.timeslots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read timeslots"
    ON public.timeslots FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admins and location admins can manage timeslots"
    ON public.timeslots
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations
            WHERE locations.id = timeslots.location_id
            AND locations.admins @> ARRAY[auth.uid()]
        )
    );

-- ------------------------------------------------------------
-- BOOKINGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id  uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
    timeslot_id  uuid NOT NULL REFERENCES public.timeslots (id) ON DELETE CASCADE,
    game_id      uuid REFERENCES public.games (id) ON DELETE SET NULL,
    date         date NOT NULL,
    user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    user_email   text,
    user_name    text,
    created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_date_idx        ON public.bookings USING btree (date);
CREATE INDEX IF NOT EXISTS bookings_location_id_idx ON public.bookings USING btree (location_id);
CREATE INDEX IF NOT EXISTS bookings_timeslot_id_idx ON public.bookings USING btree (timeslot_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx     ON public.bookings USING btree (user_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all bookings for availability"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert own bookings"
    ON public.bookings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
    ON public.bookings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins can delete bookings"
    ON public.bookings FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations
            WHERE locations.id = bookings.location_id
            AND locations.admins @> ARRAY[auth.uid()]
        )
    );

-- ------------------------------------------------------------
-- BLOCKED DATES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_dates (
    id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id    uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
    date           date NOT NULL,
    description    text,
    blocked_tables integer,
    created_at     timestamptz DEFAULT now(),
    CONSTRAINT blocked_dates_future_check    CHECK (date >= CURRENT_DATE),
    CONSTRAINT blocked_tables_positive_check CHECK (blocked_tables > 0 OR blocked_tables IS NULL)
);

COMMENT ON COLUMN public.blocked_dates.blocked_tables IS 'Number of tables to block. NULL means all tables are blocked.';

CREATE INDEX IF NOT EXISTS blocked_dates_location_id_idx ON public.blocked_dates USING btree (location_id);
CREATE INDEX IF NOT EXISTS blocked_dates_date_idx        ON public.blocked_dates USING btree (date);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocked dates"
    ON public.blocked_dates FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Admins and location admins can manage blocked dates"
    ON public.blocked_dates
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.locations
            WHERE locations.id = blocked_dates.location_id
            AND locations.admins @> ARRAY[auth.uid()]
        )
    );

-- ------------------------------------------------------------
-- GAMES — add app-visibility flags
-- ------------------------------------------------------------
ALTER TABLE public.games
    ADD COLUMN IF NOT EXISTS enabled_battleplan  boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS enabled_battlecards boolean NOT NULL DEFAULT true;
