-- migration_ryg_gods_seed.sql
--
-- Seeds the 6 core Gods into pack 13462ff2-13bf-4569-9d3d-8b343bdc3c66
-- for user 95c85832-e8eb-4693-b2fa-c6b122972b12.
--
-- Each God is created as an addon (gods type) with stats for
-- specialAbility, minions, servants, lieutenants, and champions.

do $$
declare
  v_user_id    uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id    uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_game_id    uuid;
  v_god_type_id uuid;
begin
  select id into v_game_id from public.games where slug = 'ryg';

  select id into v_god_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'gods';

  -- ══════════════════════════════════════════════════════════════════════
  -- Dakrim, The Flowing Blood
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'Dakrim, The Flowing Blood',
    '{
      "minions":     "These enemies cause the Bleeding condition on any attack which Critically Hits.",
      "servants":    "Whenever this enemy Critically Hits with a weapon attack, all warriors within 3\" of the target gain the Bleeding condition.",
      "lieutenants": "These enemies are immune to the Bleeding condition. In addition, whenever these enemies successfully attack and cause damage, they also impose the Bleeding condition on their target.",
      "champions":   "These enemies are immune to the Bleeding condition. In addition, whenever they successfully attack and cause damage with a melee attack, all enemies within 3\" of this model gain the Bleeding condition."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Ivel Xvim, Roaring Flame
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'Ivel Xvim, Roaring Flame',
    '{
      "minions":     "These enemies'' attacks count as magical. They gain a +1 bonus to damage against any enemy with the Spellcasting talent.",
      "servants":    "If this enemy does not have Spellcasting, it gains Spellcasting (Elementalism). This enemy uses the spells Ball Lightning and Eye of the Storm. If the enemy already has the Spellcasting talent, they gain +1 Fate instead.",
      "lieutenants": "If this enemy does not have Spellcasting, it gains Spellcasting (Elementalism). This enemy uses the spells Firelance and Eye of the Storm. If the enemy already has the Spellcasting talent, they gain +1 Fate instead.",
      "champions":   "If this enemy does not have Spellcasting, it gains Spellcasting (Elementalism). This enemy uses the spells Explosion and Eye of the Storm. If the enemy already has the Spellcasting talent, they gain +1 Fate instead. These enemies reduce all spell damage done to them by 2."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Jyva, The Infected Wound
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'Jyva, The Infected Wound',
    '{
      "minions":     "If this enemy Critically Hits with a melee attack, the target gains the Slowed condition.",
      "servants":    "If this enemy Critically Hits with a melee attack, the target gains the Slowed and Bleeding conditions.",
      "lieutenants": "If this enemy Critically Hits with a melee attack, the target gains the Slowed, Poisoned, and Bleeding conditions.",
      "champions":   "If this enemy Critically Hits with a melee attack, the target gains the Slowed, Poisoned, and Bleeding conditions. In addition, this model ignores all enemy Defense when determining damage from attacks."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Krushar the Destroyer
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'Krushar the Destroyer',
    '{
      "minions":     "These enemies deal 1 additional damage with any attack made with melee weapons.",
      "servants":    "These enemies gain a +1 bonus to their Offense stat.",
      "lieutenants": "These enemies gain a +1 bonus to their Offense stat. In addition, if they attack when they have Supremacy, they deal 3 additional damage with any successful attack.",
      "champions":   "These enemies have Supremacy on all Offense checks made with melee weapons."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Talek, The Darkened Knife
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'Talek, The Darkened Knife',
    '{
      "minions":     "These enemies deal Poison damage with weapons instead of Edged or Bludgeoning damage.",
      "servants":    "These enemies deal Poison damage with weapons instead of Edged or Bludgeoning damage. In addition, if they Critically Hit with a weapon attack, the target gains the Poisoned condition.",
      "lieutenants": "These enemies deal Poison damage with weapons instead of Edged or Bludgeoning damage. These enemies begin the game Hidden and are randomly set up on a piece of terrain that grants cover, if any is present. If they end their move on any terrain that grants cover, they count as Hidden.",
      "champions":   "These enemies deal Poison damage with weapons instead of Edged or Bludgeoning damage. If they deal damage with an attack, their target gains the Poisoned condition. These enemies begin the game Hidden and are randomly set up on a piece of terrain that grants cover, if any is present. If they end their move on any terrain that grants cover, they count as Hidden."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- They Who Devour
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_god_type_id,
    'They Who Devour',
    '{
      "minions":     "These enemies have +1 to their Life stat.",
      "servants":    "These enemies have +2 to their Life stat and reduce all damage done by magical attacks by 1.",
      "lieutenants": "These enemies have +3 to their Life stat and reduce all damage done by magical attacks by 1. They also cannot be forced to move.",
      "champions":   "These enemies have +6 to their Life stat and reduce all damage done by magical attacks by 2. They also cannot be forced to move."
    }'::jsonb
  );

end $$;
