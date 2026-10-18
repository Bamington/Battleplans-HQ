-- ============================================================
-- Sharing (BattleBench)
--
-- Models, collections (boxes) and recipes can be shared at two tiers:
--   "Anyone with the link" — a share_links row exists for the item
--   "Public"               — a link exists AND the item's `public` flag is on
--                            (for a future search; models/boxes already have
--                            the flag from the old app, recipes get it here)
-- "Not shared" = no link and public off.
--
-- A link is an unguessable random code. The public page and the link-preview
-- function read a shared item ONLY through get_shared_item(code), a
-- SECURITY DEFINER function that returns the item and everything inside it
-- (a collection's models, a model's recipes) as one JSON bundle — minus
-- purchase dates, which stay private. Nothing here opens the underlying
-- tables to anonymous readers.
--
-- Additive: a new table, a new nullable-with-default column, new functions.
-- ============================================================

ALTER TABLE public.recipes
    ADD COLUMN IF NOT EXISTS public boolean NOT NULL DEFAULT false;

-- ── share_links ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.share_links (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    -- 16 random bytes, URL-safe base64 without padding: 22 characters.
    token      text NOT NULL UNIQUE DEFAULT rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '='),
    kind       text NOT NULL CHECK (kind IN ('model', 'box', 'recipe')),
    item_id    uuid NOT NULL,
    user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT share_links_one_per_item UNIQUE (kind, item_id)
);

CREATE INDEX IF NOT EXISTS share_links_user_idx ON public.share_links USING btree (user_id);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Owners see and remove their own links.
DROP POLICY IF EXISTS "Owners read their share links" ON public.share_links;
CREATE POLICY "Owners read their share links"
    ON public.share_links FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete their share links" ON public.share_links;
CREATE POLICY "Owners delete their share links"
    ON public.share_links FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- …and may only create a link to something they own.
DROP POLICY IF EXISTS "Owners share their own items" ON public.share_links;
CREATE POLICY "Owners share their own items"
    ON public.share_links FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND (
            (kind = 'model'  AND EXISTS (SELECT 1 FROM public.models  m WHERE m.id = item_id AND m.user_id = auth.uid())) OR
            (kind = 'box'    AND EXISTS (SELECT 1 FROM public.boxes   b WHERE b.id = item_id AND b.user_id = auth.uid())) OR
            (kind = 'recipe' AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = item_id AND r.owner   = auth.uid()))
        )
    );

GRANT SELECT, INSERT, DELETE ON public.share_links TO authenticated;

-- A link can't outlive its item (item_id spans three tables, so no FK).
CREATE OR REPLACE FUNCTION public.delete_share_links_for_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.share_links WHERE kind = TG_ARGV[0] AND item_id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS models_delete_share_links  ON public.models;
CREATE TRIGGER models_delete_share_links  AFTER DELETE ON public.models
    FOR EACH ROW EXECUTE FUNCTION public.delete_share_links_for_item('model');
DROP TRIGGER IF EXISTS boxes_delete_share_links   ON public.boxes;
CREATE TRIGGER boxes_delete_share_links   AFTER DELETE ON public.boxes
    FOR EACH ROW EXECUTE FUNCTION public.delete_share_links_for_item('box');
DROP TRIGGER IF EXISTS recipes_delete_share_links ON public.recipes;
CREATE TRIGGER recipes_delete_share_links AFTER DELETE ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.delete_share_links_for_item('recipe');

-- ── JSON builders (internal; called only by get_shared_item) ─────────────────

CREATE OR REPLACE FUNCTION public.shared_paint_json(h public.hobby_items, note text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object('name', h.name, 'brand', h.brand, 'type', h.type, 'swatch', h.swatch, 'note', note);
$$;

CREATE OR REPLACE FUNCTION public.shared_recipe_json(p_recipe uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'description', coalesce(nullif(p_note, ''), r.description),
        'paints', coalesce((
            SELECT jsonb_agg(public.shared_paint_json(h, NULL) ORDER BY ri.display_order)
              FROM public.recipe_items ri JOIN public.hobby_items h ON h.id = ri.hobby_item_id
             WHERE ri.recipe_id = r.id), '[]'::jsonb),
        'images', coalesce((
            SELECT jsonb_agg(jsonb_build_object('image_path', i.image_path, 'is_primary', i.is_primary, 'display_order', i.display_order))
              FROM public.recipe_images i WHERE i.recipe_id = r.id), '[]'::jsonb)
    )
    FROM public.recipes r WHERE r.id = p_recipe;
$$;

-- Everything the model modal shows, except purchase_date.
CREATE OR REPLACE FUNCTION public.shared_model_json(p_model uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'status', m.status,
        'count', m.count,
        'painted_date', m.painted_date,
        'started_painting_date', m.started_painting_date,
        'on_desk', m.on_desk,
        'painting_notes', m.painting_notes,
        'lore_name', m.lore_name,
        'lore_description', m.lore_description,
        'image_path', m.image_path,
        'game', (SELECT jsonb_build_object('name', g.name, 'slug', g.slug) FROM public.games g WHERE g.id = m.game_id),
        'images', coalesce((
            SELECT jsonb_agg(jsonb_build_object('image_path', i.image_path, 'is_primary', i.is_primary,
                   'display_order', i.display_order, 'is_progress', i.is_progress, 'created_at', i.created_at))
              FROM public.model_images i WHERE i.model_id = m.id), '[]'::jsonb),
        'recipes', coalesce((
            SELECT jsonb_agg(public.shared_recipe_json(mr.recipe_id, mr.description) ORDER BY mr.sort_order)
              FROM public.model_recipes mr WHERE mr.model_id = m.id), '[]'::jsonb),
        'direct_paints', coalesce((
            SELECT jsonb_agg(public.shared_paint_json(h, mh.section) ORDER BY mh.sort_order)
              FROM public.model_hobby_items mh JOIN public.hobby_items h ON h.id = mh.hobby_item_id
             WHERE mh.model_id = m.id), '[]'::jsonb),
        -- Collections it belongs to: names only — they aren't inside the model.
        'included_in', coalesce((
            SELECT jsonb_agg(jsonb_build_object('name', b.name, 'type', b.type) ORDER BY b.name)
              FROM public.model_boxes mb JOIN public.boxes b ON b.id = mb.box_id
             WHERE mb.model_id = m.id), '[]'::jsonb)
    )
    FROM public.models m WHERE m.id = p_model;
$$;

-- A collection and, in full, every model inside it. No purchase_date.
CREATE OR REPLACE FUNCTION public.shared_box_json(p_box uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'type', b.type,
        'includes_string', b.includes_string,
        'game', (SELECT jsonb_build_object('name', g.name, 'slug', g.slug) FROM public.games g WHERE g.id = b.game_id),
        'images', coalesce((
            SELECT jsonb_agg(jsonb_build_object('image_path', i.image_path, 'image_url', i.image_url,
                   'is_primary', i.is_primary, 'display_order', i.display_order))
              FROM public.box_images i WHERE i.box_id = b.id), '[]'::jsonb),
        'models', coalesce((
            SELECT jsonb_agg(public.shared_model_json(mb.model_id) ORDER BY m.name)
              FROM public.model_boxes mb JOIN public.models m ON m.id = mb.model_id
             WHERE mb.box_id = b.id), '[]'::jsonb)
    )
    FROM public.boxes b WHERE b.id = p_box;
$$;

-- The internal builders are never called directly by clients.
REVOKE ALL ON FUNCTION public.shared_paint_json(public.hobby_items, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_recipe_json(uuid, text)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_model_json(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_box_json(uuid)                       FROM PUBLIC, anon, authenticated;

-- ── The one public door ──────────────────────────────────────────────────────

-- The shared item for a link code, or NULL when the code doesn't exist (never
-- shared, or sharing was turned off). Anyone may call it.
CREATE OR REPLACE FUNCTION public.get_shared_item(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'kind', s.kind,
        'public', CASE s.kind
            WHEN 'model'  THEN (SELECT m.public FROM public.models  m WHERE m.id = s.item_id)
            WHEN 'box'    THEN (SELECT b.public FROM public.boxes   b WHERE b.id = s.item_id)
            WHEN 'recipe' THEN (SELECT r.public FROM public.recipes r WHERE r.id = s.item_id)
        END,
        'owner', (SELECT jsonb_build_object('id', p.id, 'handle', p.handle, 'avatar_path', p.avatar_path)
                    FROM public.public_profiles p WHERE p.id = s.user_id),
        'item', CASE s.kind
            WHEN 'model'  THEN public.shared_model_json(s.item_id)
            WHEN 'box'    THEN public.shared_box_json(s.item_id)
            WHEN 'recipe' THEN public.shared_recipe_json(s.item_id)
        END
    )
    FROM public.share_links s
    WHERE s.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_item(text) TO anon, authenticated;
