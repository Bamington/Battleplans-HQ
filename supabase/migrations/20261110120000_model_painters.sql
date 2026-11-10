-- ============================================================
-- Who painted a model (BattleBench)
--
-- A model is "painted by me" unless the owner says otherwise. Two ways to
-- credit someone else, never both:
--   painter_id     — someone else painted MY model      (painted_by_me = false)
--   painted_for_id — I painted this model FOR someone   (painted_by_me = true)
--
-- Both point at the owner's `opponents` list — the same people Battleplan
-- uses for battles — so one friend who battles you and paints for you is one
-- entry. An opponent linked to a real account (linked_user_id) is how the
-- other person gets to see the model:
--
--   While the owner and that person are accepted friends, the model (and its
--   photos) is readable by them, read-only. Becoming friends later reveals
--   past models; unfriending hides them again. Nothing is copied — it's all
--   one check, shared_with_me(models), used by the RLS policies below.
--
-- The friend's full read-only view comes from get_friend_model(id), which
-- reuses the share page's JSON builder rather than opening recipes and paints.
--
-- Additive: new columns with defaults, new indexes, functions and policies.
-- ============================================================

ALTER TABLE public.models
    ADD COLUMN IF NOT EXISTS painted_by_me  boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS painter_id     uuid REFERENCES public.opponents (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS painted_for_id uuid REFERENCES public.opponents (id) ON DELETE SET NULL;

-- A painter only when it isn't painted by me; "painted for" only when it is.
ALTER TABLE public.models DROP CONSTRAINT IF EXISTS models_painter_direction;
ALTER TABLE public.models ADD CONSTRAINT models_painter_direction CHECK (
    (painter_id IS NULL OR NOT painted_by_me) AND (painted_for_id IS NULL OR painted_by_me)
);

-- The credited person must be in the model owner's own list. A foreign key
-- skips RLS, so without this a model could point at someone else's opponent.
CREATE OR REPLACE FUNCTION public.models_check_painter_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.opponents o
                WHERE o.id IN (NEW.painter_id, NEW.painted_for_id) AND o.user_id <> NEW.user_id) THEN
        RAISE EXCEPTION 'painter must be one of the model owner''s own people';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS models_check_painter_owner ON public.models;
CREATE TRIGGER models_check_painter_owner
    BEFORE INSERT OR UPDATE OF painter_id, painted_for_id, user_id ON public.models
    FOR EACH ROW
    WHEN (NEW.painter_id IS NOT NULL OR NEW.painted_for_id IS NOT NULL)
    EXECUTE FUNCTION public.models_check_painter_owner();

CREATE INDEX IF NOT EXISTS models_painter_id_idx    ON public.models (painter_id)     WHERE painter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS models_painted_for_id_idx ON public.models (painted_for_id) WHERE painted_for_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS opponents_linked_user_idx ON public.opponents (linked_user_id) WHERE linked_user_id IS NOT NULL;

-- ── Visibility ───────────────────────────────────────────────────────────────

-- True when the signed-in user is the person this model credits (painter or
-- recipient), through one of the OWNER's opponents linked to them, and the
-- two are accepted friends. SECURITY DEFINER because opponents and
-- friendships are private to their owners. Also a PostgREST computed field,
-- so the app can ask for "mine or shared with me" in one query.
CREATE OR REPLACE FUNCTION public.shared_with_me(m public.models)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT (m.painter_id IS NOT NULL OR m.painted_for_id IS NOT NULL)
       AND auth.uid() IS NOT NULL
       AND auth.uid() <> m.user_id
       AND EXISTS (
            SELECT 1
              FROM public.opponents o
              JOIN public.friendships f
                ON f.status = 'accepted'
               AND ((f.requester_id = m.user_id AND f.addressee_id = o.linked_user_id)
                 OR (f.addressee_id = m.user_id AND f.requester_id = o.linked_user_id))
             WHERE o.id IN (m.painter_id, m.painted_for_id)
               AND o.user_id = m.user_id
               AND o.linked_user_id = auth.uid()
       );
$$;

GRANT EXECUTE ON FUNCTION public.shared_with_me(public.models) TO authenticated;

DROP POLICY IF EXISTS "Friends read models credited to them" ON public.models;
CREATE POLICY "Friends read models credited to them"
    ON public.models FOR SELECT TO authenticated
    USING (public.shared_with_me(models));

DROP POLICY IF EXISTS "Friends read images of models credited to them" ON public.model_images;
CREATE POLICY "Friends read images of models credited to them"
    ON public.model_images FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.models m WHERE m.id = model_images.model_id AND public.shared_with_me(m)));

-- ── Share-page JSON: who painted it ──────────────────────────────────────────

-- As before, plus painted_by_me and the credited person's name (the owner's
-- label for them).
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
        'painted_by_me', m.painted_by_me,
        'painter_name', (SELECT o.name FROM public.opponents o WHERE o.id = m.painter_id),
        'painted_for_name', (SELECT o.name FROM public.opponents o WHERE o.id = m.painted_for_id),
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
        'included_in', coalesce((
            SELECT jsonb_agg(jsonb_build_object('name', b.name, 'type', b.type) ORDER BY b.name)
              FROM public.model_boxes mb JOIN public.boxes b ON b.id = mb.box_id
             WHERE mb.model_id = m.id), '[]'::jsonb)
    )
    FROM public.models m WHERE m.id = p_model;
$$;

REVOKE ALL ON FUNCTION public.shared_model_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── The friend's door ────────────────────────────────────────────────────────

-- A model credited to the signed-in user, in the share page's shape, plus who
-- owns it and which way the credit runs from the viewer's side:
--   'painted_by_viewer'  — the owner says the viewer painted it
--   'painted_for_viewer' — the owner painted it for the viewer
-- NULL unless shared_with_me holds right now.
CREATE OR REPLACE FUNCTION public.get_friend_model(p_model uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'direction', CASE WHEN m.painter_id IS NOT NULL THEN 'painted_by_viewer' ELSE 'painted_for_viewer' END,
        'owner', (SELECT jsonb_build_object('id', p.id, 'handle', p.handle, 'avatar_path', p.avatar_path)
                    FROM public.public_profiles p WHERE p.id = m.user_id),
        'item', public.shared_model_json(m.id)
    )
    FROM public.models m
    WHERE m.id = p_model AND public.shared_with_me(m);
$$;

REVOKE ALL ON FUNCTION public.get_friend_model(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_model(uuid) TO authenticated;
