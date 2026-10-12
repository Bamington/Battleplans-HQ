-- ============================================================
-- Photo source + "has your photo" (BattleBench)
--
-- Records where each model / collection photo came from, so the filter sheets
-- can show what still needs the user's OWN photo:
--   'upload' — chosen from the user's device
--   'web'    — picked through the photo finder (image-search)
--
-- Existing rows default to 'upload': the photo finder only shipped on
-- 2026-10-07, so almost every existing photo was uploaded. The exceptions are
-- the 12 collection covers that are external shop/eBay links (image_url, no
-- object in storage) — those are found images, so they're marked 'web'. The
-- handful of photos added since 2026-10-07 can't be told apart and stay
-- 'upload' (agreed with Chris).
--
-- has_own_photo(models|boxes) are PostgREST computed fields, so the client can
-- filter with `.eq('has_own_photo', true)`. A model's legacy models.image_path
-- (from the old app) counts as its own photo. A collection counts only its own
-- photos, not its member models'.
--
-- Backward compatible: NOT NULL with a default, so the deployed build's
-- inserts keep working.
-- ============================================================

ALTER TABLE public.model_images
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload'
    CONSTRAINT model_images_source_check CHECK (source IN ('upload', 'web'));

ALTER TABLE public.box_images
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload'
    CONSTRAINT box_images_source_kind_check CHECK (source IN ('upload', 'web'));

UPDATE public.box_images
   SET source = 'web'
 WHERE image_url IS NOT NULL AND image_path IS NULL AND source <> 'web';

CREATE OR REPLACE FUNCTION public.has_own_photo(m public.models)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT m.image_path IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.model_images i
                    WHERE i.model_id = m.id AND i.source = 'upload');
$$;

CREATE OR REPLACE FUNCTION public.has_own_photo(b public.boxes)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (SELECT 1 FROM public.box_images i
                    WHERE i.box_id = b.id AND i.source = 'upload');
$$;

GRANT EXECUTE ON FUNCTION public.has_own_photo(public.models) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_own_photo(public.boxes)  TO authenticated, anon;
