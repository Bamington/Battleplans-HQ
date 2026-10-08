-- ============================================================
-- shopping_list_items (BattleBench)
--
-- A personal shopping list: things the user plans to buy. Deliberately
-- simple — free-text title and notes, an optional single photo, and a bought
-- flag. Nothing here links to models, paints or collections.
--
-- One photo per item, so it lives on the row (image_path, an object key in the
-- model-images bucket under the user's own '{uid}/…' folder — already covered
-- by the storage policy in 20260716130000). Replacing a photo just repoints
-- the column; the old object is left in place, like every other photo delete.
--
-- Private to the owner. Purely additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
    title      text NOT NULL CHECK (length(btrim(title)) > 0),
    notes      text,
    image_path text,
    bought     boolean NOT NULL DEFAULT false,
    bought_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_list_items_user_id_idx
    ON public.shopping_list_items USING btree (user_id);

CREATE TRIGGER shopping_list_items_set_updated_at
    BEFORE UPDATE ON public.shopping_list_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their shopping list" ON public.shopping_list_items;
CREATE POLICY "Owners manage their shopping list"
    ON public.shopping_list_items
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Explicit, so this works whether or not the project auto-exposes new tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
