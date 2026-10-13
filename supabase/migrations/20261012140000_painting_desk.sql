-- ============================================================
-- Painting Desk (BattleBench)
--
-- The desk is a working list of models being painted. A desk item IS a model
-- — flagged, not copied — so its recipes, paints, notes and photos stay put
-- when it comes off the desk. Collections are never on the desk themselves;
-- adding one puts its unpainted models there.
--
--   models.on_desk                — on the Painting Desk right now
--   models.started_painting_date  — "Started Painting": set when a model goes
--                                   on the desk (if not already set). Distinct
--                                   from purchase_date; feeds a later
--                                   time-until-painted stat
--   model_images.is_progress      — a work-in-progress photo (taken while the
--                                   model was on the desk). Kept out of covers
--                                   and of the "Has your photo" filter for now
--
-- Additive and backward compatible: NOT NULL columns have defaults, and the
-- deployed build never reads or writes them.
-- ============================================================

ALTER TABLE public.models
    ADD COLUMN IF NOT EXISTS on_desk boolean NOT NULL DEFAULT false;

ALTER TABLE public.models
    ADD COLUMN IF NOT EXISTS started_painting_date date;

ALTER TABLE public.model_images
    ADD COLUMN IF NOT EXISTS is_progress boolean NOT NULL DEFAULT false;

-- The desk column lists one user's on-desk models; keep that lookup cheap.
CREATE INDEX IF NOT EXISTS models_on_desk_idx
    ON public.models USING btree (user_id) WHERE on_desk;

-- Progress photos aren't "your photo" of the finished model.
CREATE OR REPLACE FUNCTION public.has_own_photo(m public.models)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT m.image_path IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.model_images i
                    WHERE i.model_id = m.id AND i.source = 'upload' AND NOT i.is_progress);
$$;
