-- ============================================================
-- recipe_images (BattleBench)
--
-- Photos on a paint recipe — the finished result, or step-by-step shots.
-- Same shape as model_images: objects live in the model-images bucket under
-- the uploader's own '{uid}/…' folder (already covered by the storage policy
-- in 20260716130000), one row per photo, at most one cover per recipe.
--
-- Purely additive: a new table nothing in the deployed build reads.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recipe_images (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id     uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
    image_path    text NOT NULL,   -- object key in the model-images bucket
    display_order integer NOT NULL DEFAULT 0,
    is_primary    boolean NOT NULL DEFAULT false,
    user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_images_recipe_id_idx ON public.recipe_images USING btree (recipe_id);
CREATE UNIQUE INDEX IF NOT EXISTS recipe_images_one_primary_idx
    ON public.recipe_images USING btree (recipe_id) WHERE is_primary;

ALTER TABLE public.recipe_images ENABLE ROW LEVEL SECURITY;

-- Recipes are private to their owner, so their photos are too.
DROP POLICY IF EXISTS "Owners manage their recipe images" ON public.recipe_images;
CREATE POLICY "Owners manage their recipe images"
    ON public.recipe_images
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = recipe_images.recipe_id AND r.owner = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = recipe_images.recipe_id AND r.owner = auth.uid()
    ));

-- Explicit, so this works whether or not the project auto-exposes new tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_images TO authenticated;
