-- Add columns that may be missing if the locations table pre-dates this migration.
-- All statements use IF NOT EXISTS / SET DEFAULT so they are safe to run repeatedly.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS store_email text,
  ADD COLUMN IF NOT EXISTS icon        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tables      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS admins      uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

-- address was declared NOT NULL in the original CREATE TABLE but that blocks
-- inserts from the Manage Locations form (which has no address field).
-- Make it optional so the app can manage locations without requiring an address.
ALTER TABLE public.locations
  ALTER COLUMN address DROP NOT NULL;
