-- migration_ryg_spell_prerequisites.sql
--
-- Sets prerequisites on all seeded RYG spells in pack
-- 13462ff2-13bf-4569-9d3d-8b343bdc3c66.
--
-- Each spell requires EITHER Spellcasting OR Spell Learning of the matching
-- magic type (requireAll: false). The talent params { "type": ["<Type>"] }
-- match card_addons.params written when those talents are attached to a warrior.

do $$
declare
  v_user_id uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_sc_id   uuid;
  v_sl_id   uuid;
begin
  select id into v_sc_id
    from public.addons
    where user_id = v_user_id and name = 'Spellcasting'
    limit 1;

  select id into v_sl_id
    from public.addons
    where user_id = v_user_id and name = 'Spell Learning'
    limit 1;

  if v_sc_id is null then
    raise exception 'Spellcasting talent not found for user %', v_user_id;
  end if;
  if v_sl_id is null then
    raise exception 'Spell Learning talent not found for user %', v_user_id;
  end if;

  -- Blood Magic
  update public.addons
  set prerequisites = jsonb_build_object(
    'requireAll', false,
    'items', jsonb_build_array(
      jsonb_build_object('addonId', v_sc_id, 'name', 'Spellcasting',   'params', '{"type":["Blood Magic"]}'::jsonb),
      jsonb_build_object('addonId', v_sl_id, 'name', 'Spell Learning', 'params', '{"type":["Blood Magic"]}'::jsonb)
    )
  )
  where pack_id = v_pack_id
    and stats->>'type' = 'Blood Magic';

  -- Elementalism
  update public.addons
  set prerequisites = jsonb_build_object(
    'requireAll', false,
    'items', jsonb_build_array(
      jsonb_build_object('addonId', v_sc_id, 'name', 'Spellcasting',   'params', '{"type":["Elementalism"]}'::jsonb),
      jsonb_build_object('addonId', v_sl_id, 'name', 'Spell Learning', 'params', '{"type":["Elementalism"]}'::jsonb)
    )
  )
  where pack_id = v_pack_id
    and stats->>'type' = 'Elementalism';

  -- Sorcery
  update public.addons
  set prerequisites = jsonb_build_object(
    'requireAll', false,
    'items', jsonb_build_array(
      jsonb_build_object('addonId', v_sc_id, 'name', 'Spellcasting',   'params', '{"type":["Sorcery"]}'::jsonb),
      jsonb_build_object('addonId', v_sl_id, 'name', 'Spell Learning', 'params', '{"type":["Sorcery"]}'::jsonb)
    )
  )
  where pack_id = v_pack_id
    and stats->>'type' = 'Sorcery';

  raise notice 'Done. Spellcasting=%, Spell Learning=%', v_sc_id, v_sl_id;
end $$;
