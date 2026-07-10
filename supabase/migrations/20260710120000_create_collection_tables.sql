-- ============================================================
-- Collection tables migration (BattleBox)
--
-- Creates: boxes, models, model_boxes, model_images,
--          hobby_items, recipes, recipe_items,
--          model_recipes, model_hobby_items
--
-- Source: the previous BattlePlan app (project dthxptbozocrbvmhwvao).
-- Old primary keys are preserved so the CSV import can carry every
-- foreign key across unchanged. Deliberate departures from the old
-- schema are called out inline.
-- ============================================================

-- Bumps updated_at on UPDATE. Only recipes tracks it today.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- BOXES
-- A physical box of miniatures, or a user-defined Collection.
--
-- Departure: the old `image_url` column was empty on all 502 rows and
-- `custom_game` on all of them too; both are dropped. `image_path` takes
-- image_url's place, storing a storage object key rather than a full URL
-- (see model_images for the rationale).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boxes (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name            text NOT NULL,
    user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id         uuid REFERENCES public.games (id) ON DELETE SET NULL,
    type            text NOT NULL DEFAULT 'Box',
    purchase_date   date,
    includes_string text,
    image_path      text,
    public          boolean NOT NULL DEFAULT false,
    show_carousel   boolean NOT NULL DEFAULT false,
    created_at      timestamptz DEFAULT now(),
    CONSTRAINT boxes_type_check CHECK (type IN ('Box', 'Collection'))
);

CREATE INDEX IF NOT EXISTS boxes_user_id_idx ON public.boxes USING btree (user_id);
CREATE INDEX IF NOT EXISTS boxes_game_id_idx ON public.boxes USING btree (game_id);

ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public boxes"
    ON public.boxes FOR SELECT
    TO authenticated, anon
    USING (public OR user_id = auth.uid());

CREATE POLICY "Owners can manage their boxes"
    ON public.boxes
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- MODELS
-- One row per miniature entry; `count` is how many of it the user owns.
--
-- Departures:
--   * `box_id` is dropped — all 68 rows that set it were already present
--     in model_boxes, which is the real (many-to-many) relationship.
--   * Seven always-empty columns dropped: notes, lore_name,
--     lore_description, custom_game, share_name, share_artist,
--     share_content.
--   * `image_url` becomes `image_path` (storage object key).
--   * `status` gains a CHECK. 'None' means unpainted; the UI renders it
--     as "Unpainted" rather than the raw value.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.models (
    id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name           text NOT NULL,
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id        uuid REFERENCES public.games (id) ON DELETE SET NULL,
    status         text NOT NULL DEFAULT 'None',
    count          integer NOT NULL DEFAULT 1,
    image_path     text,
    purchase_date  date,
    painted_date   date,
    painting_notes text,
    public         boolean NOT NULL DEFAULT false,
    created_at     timestamptz DEFAULT now(),
    CONSTRAINT models_count_check CHECK (count > 0),
    CONSTRAINT models_status_check CHECK (
        status IN ('None', 'Assembled', 'Primed', 'Partially Painted', 'Painted')
    )
);

CREATE INDEX IF NOT EXISTS models_user_id_idx ON public.models USING btree (user_id);
CREATE INDEX IF NOT EXISTS models_game_id_idx ON public.models USING btree (game_id);
CREATE INDEX IF NOT EXISTS models_status_idx  ON public.models USING btree (status);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public models"
    ON public.models FOR SELECT
    TO authenticated, anon
    USING (public OR user_id = auth.uid());

CREATE POLICY "Owners can manage their models"
    ON public.models
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- MODEL ↔ BOX
-- A model can sit in several boxes (37 of them do).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_boxes (
    id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id uuid NOT NULL REFERENCES public.models (id) ON DELETE CASCADE,
    box_id   uuid NOT NULL REFERENCES public.boxes (id)  ON DELETE CASCADE,
    added_at timestamptz DEFAULT now(),
    CONSTRAINT model_boxes_unique UNIQUE (model_id, box_id)
);

CREATE INDEX IF NOT EXISTS model_boxes_model_id_idx ON public.model_boxes USING btree (model_id);
CREATE INDEX IF NOT EXISTS model_boxes_box_id_idx   ON public.model_boxes USING btree (box_id);

ALTER TABLE public.model_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read model_boxes for visible models"
    ON public.model_boxes FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_boxes.model_id
          AND (m.public OR m.user_id = auth.uid())
    ));

CREATE POLICY "Owners can manage their model_boxes"
    ON public.model_boxes
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_boxes.model_id AND m.user_id = auth.uid()
    ));

-- ------------------------------------------------------------
-- MODEL IMAGES
--
-- Departures:
--   * `image_url` becomes `image_path`: we store the storage object key
--     ('{user_id}/{file}') and build the URL client-side via
--     supabase.storage.getPublicUrl(). The old rows hardcoded the project
--     ref into 1,585 URLs, which is exactly what made this migration
--     expensive.
--   * `is_progress_photo` was empty on all 840 rows; dropped.
--   * A partial unique index enforces at most one primary per model. In
--     the old data 593 models had no primary and 3 had two; the import
--     repairs this by promoting the row matching models.image_url, else
--     the lowest display_order.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_images (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id      uuid NOT NULL REFERENCES public.models (id) ON DELETE CASCADE,
    image_path    text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    is_primary    boolean NOT NULL DEFAULT false,
    user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_images_model_id_idx ON public.model_images USING btree (model_id);
CREATE UNIQUE INDEX IF NOT EXISTS model_images_one_primary_idx
    ON public.model_images USING btree (model_id) WHERE is_primary;

ALTER TABLE public.model_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read images for visible models"
    ON public.model_images FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_images.model_id
          AND (m.public OR m.user_id = auth.uid())
    ));

CREATE POLICY "Owners can manage their model images"
    ON public.model_images
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_images.model_id AND m.user_id = auth.uid()
    ));

-- ------------------------------------------------------------
-- HOBBY ITEMS
-- The shared paint/spray library. Integer PK, preserved from the old app
-- because recipe_items and model_hobby_items reference it by number.
--
-- Rows with owner IS NULL are the curated global library (2,031 of 2,058)
-- and are editable only by admins. The remaining 27 are user-created.
--
-- `swatch` has no CHECK: 11 rows carry the sentinel '#TRANSPARENT' and one
-- is the malformed '#5221'. Both are preserved rather than guessed at.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hobby_items (
    id             bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    type           text NOT NULL,
    type_secondary text,
    name           text NOT NULL,
    brand          text NOT NULL,
    sub_brand      text,
    code           text,
    swatch         text NOT NULL,
    owner          uuid REFERENCES auth.users (id) ON DELETE CASCADE,
    public         boolean NOT NULL DEFAULT true,
    created_at     timestamptz DEFAULT now(),
    CONSTRAINT hobby_items_type_check CHECK (type IN ('Paint', 'Spray'))
);

CREATE INDEX IF NOT EXISTS hobby_items_brand_idx ON public.hobby_items USING btree (brand);
CREATE INDEX IF NOT EXISTS hobby_items_type_idx  ON public.hobby_items USING btree (type);
CREATE INDEX IF NOT EXISTS hobby_items_owner_idx ON public.hobby_items USING btree (owner);

ALTER TABLE public.hobby_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the public paint library"
    ON public.hobby_items FOR SELECT
    TO authenticated, anon
    USING (public OR owner = auth.uid());

CREATE POLICY "Owners can manage their own hobby items"
    ON public.hobby_items
    TO authenticated
    USING (owner IS NOT NULL AND owner = auth.uid())
    WITH CHECK (owner IS NOT NULL AND owner = auth.uid());

CREATE POLICY "Admins can manage the hobby item library"
    ON public.hobby_items
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
    ));

-- ------------------------------------------------------------
-- RECIPES
-- An ordered sequence of paints, reusable across models.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL,
    owner       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    description text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_owner_idx ON public.recipes USING btree (owner);

CREATE TRIGGER recipes_set_updated_at
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their recipes"
    ON public.recipes
    TO authenticated
    USING (owner = auth.uid())
    WITH CHECK (owner = auth.uid());

-- ------------------------------------------------------------
-- RECIPE ITEMS
-- The ordered paint steps of a recipe. ON DELETE RESTRICT on the paint:
-- removing a library paint must not silently gut somebody's recipe.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_items (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id     uuid   NOT NULL REFERENCES public.recipes (id)     ON DELETE CASCADE,
    hobby_item_id bigint NOT NULL REFERENCES public.hobby_items (id) ON DELETE RESTRICT,
    display_order integer NOT NULL DEFAULT 0,
    added_at      timestamptz DEFAULT now(),
    CONSTRAINT recipe_items_unique UNIQUE (recipe_id, hobby_item_id)
);

CREATE INDEX IF NOT EXISTS recipe_items_recipe_id_idx     ON public.recipe_items USING btree (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_items_hobby_item_id_idx ON public.recipe_items USING btree (hobby_item_id);

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their recipe items"
    ON public.recipe_items
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = recipe_items.recipe_id AND r.owner = auth.uid()
    ));

-- ------------------------------------------------------------
-- MODEL ↔ RECIPE
-- `description` notes where on the model the recipe was used
-- (e.g. "Halberd shafts, flag haft.").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_recipes (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id    uuid NOT NULL REFERENCES public.models (id)  ON DELETE CASCADE,
    recipe_id   uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
    description text,
    sort_order  integer NOT NULL DEFAULT 0,
    added_at    timestamptz DEFAULT now(),
    CONSTRAINT model_recipes_unique UNIQUE (model_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS model_recipes_model_id_idx  ON public.model_recipes USING btree (model_id);
CREATE INDEX IF NOT EXISTS model_recipes_recipe_id_idx ON public.model_recipes USING btree (recipe_id);

ALTER TABLE public.model_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read model_recipes for visible models"
    ON public.model_recipes FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_recipes.model_id
          AND (m.public OR m.user_id = auth.uid())
    ));

CREATE POLICY "Owners can manage their model_recipes"
    ON public.model_recipes
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_recipes.model_id AND m.user_id = auth.uid()
    ));

-- ------------------------------------------------------------
-- MODEL ↔ HOBBY ITEM
-- A paint used directly on a model, outside any recipe. `section` names
-- the part it was used on (e.g. "All Metals", "Zenithal Spray over black.").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_hobby_items (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id      uuid   NOT NULL REFERENCES public.models (id)       ON DELETE CASCADE,
    hobby_item_id bigint NOT NULL REFERENCES public.hobby_items (id)  ON DELETE RESTRICT,
    section       text,
    sort_order    integer NOT NULL DEFAULT 0,
    added_at      timestamptz DEFAULT now(),
    CONSTRAINT model_hobby_items_unique UNIQUE (model_id, hobby_item_id)
);

CREATE INDEX IF NOT EXISTS model_hobby_items_model_id_idx      ON public.model_hobby_items USING btree (model_id);
CREATE INDEX IF NOT EXISTS model_hobby_items_hobby_item_id_idx ON public.model_hobby_items USING btree (hobby_item_id);

ALTER TABLE public.model_hobby_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read model_hobby_items for visible models"
    ON public.model_hobby_items FOR SELECT
    TO authenticated, anon
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_hobby_items.model_id
          AND (m.public OR m.user_id = auth.uid())
    ));

CREATE POLICY "Owners can manage their model_hobby_items"
    ON public.model_hobby_items
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.models m
        WHERE m.id = model_hobby_items.model_id AND m.user_id = auth.uid()
    ));
