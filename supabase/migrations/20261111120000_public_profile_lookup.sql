-- ============================================================
-- Public profile lookup
--
-- The full profile page (/@username) is open to anyone, signed in or not.
-- public_profiles stays readable by signed-in users only; signed-out visitors
-- get exactly the public fields — id, @username, avatar — through this one
-- function, by @username (case-insensitive, like the unique index).
--
-- Never the real name ("Your Name"): that's for friends, and the app reads it
-- from my_friends once you're signed in.
--
-- Also: shared_model_json gains the credited person's @username when they're a
-- linked account, so share pages can link the painter to their profile.
--
-- Additive: new function, replaced builder.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_handle text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT jsonb_build_object('id', p.id, 'handle', p.handle, 'avatar_path', p.avatar_path)
      FROM public.public_profiles p
     WHERE lower(p.handle) = lower(btrim(ltrim(p_handle, '@')))
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;

-- As in 20261110120000, plus painter_handle / painted_for_handle.
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
        'painter_handle', (SELECT p.handle FROM public.opponents o JOIN public.public_profiles p ON p.id = o.linked_user_id WHERE o.id = m.painter_id),
        'painted_for_name', (SELECT o.name FROM public.opponents o WHERE o.id = m.painted_for_id),
        'painted_for_handle', (SELECT p.handle FROM public.opponents o JOIN public.public_profiles p ON p.id = o.linked_user_id WHERE o.id = m.painted_for_id),
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
