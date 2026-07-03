-- migration_ryg_spells_seed.sql
--
-- Seeds all core spells (Blood Magic, Elementalism, Sorcery) into pack
-- 13462ff2-13bf-4569-9d3d-8b343bdc3c66 for user 95c85832-e8eb-4693-b2fa-c6b122972b12.

do $$
declare
  v_user_id      uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id      uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_game_id      uuid;
  v_type_id      uuid;
  v_empty_prereq jsonb := '{"requireAll":false,"items":[]}'::jsonb;

  -- keyword ids
  kw_blood      uuid;
  kw_mind       uuid;
  kw_healing    uuid;
  kw_lightning  uuid;
  kw_area       uuid;
  kw_cold       uuid;
  kw_fire       uuid;
  kw_sorcery    uuid;

  -- spell ids
  s_id uuid;
begin
  -- ── Resolve game + addon type ─────────────────────────────────────────────
  select id into v_game_id from public.games where slug = 'ryg';
  select id into v_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'spells';

  -- ── Upsert spell keywords (category = 'spell') ────────────────────────────
  insert into public.keywords (user_id, game_id, name, category)
  select v_user_id, v_game_id, kw, 'spell'
  from unnest(array['Blood','Mind','Healing','Lightning','Area','Cold','Fire','Sorcery']) as kw
  where not exists (
    select 1 from public.keywords where game_id = v_game_id and name = kw
  );

  select id into kw_blood     from public.keywords where game_id = v_game_id and name = 'Blood';
  select id into kw_mind      from public.keywords where game_id = v_game_id and name = 'Mind';
  select id into kw_healing   from public.keywords where game_id = v_game_id and name = 'Healing';
  select id into kw_lightning from public.keywords where game_id = v_game_id and name = 'Lightning';
  select id into kw_area      from public.keywords where game_id = v_game_id and name = 'Area';
  select id into kw_cold      from public.keywords where game_id = v_game_id and name = 'Cold';
  select id into kw_fire      from public.keywords where game_id = v_game_id and name = 'Fire';
  select id into kw_sorcery   from public.keywords where game_id = v_game_id and name = 'Sorcery';

  -- ══════════════════════════════════════════════════════════════════════════
  -- BLOOD MAGIC
  -- ══════════════════════════════════════════════════════════════════════════

  -- Puppeteer's Betrayal
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Puppeteer''s Betrayal',
    'The caster seizes control of the blood of an enemy, turning them on their allies.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        6,
      'target',       'One Model',
      'fateModifier', '0 (−3 vs Champion or Legendary)',
      'effect',       'The target resolves a melee attack with Supremacy with one weapon of your choice against any model within melee range, including itself.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood, '{}', 0),
    (s_id, kw_mind,  '{}', 1);

  -- Sanguine Song
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Sanguine Song',
    'The caster pulls deeply from their own lifeforce, restoring it to a lost ally.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        3,
      'target',       'One friendly model that has been destroyed',
      'fateModifier', '-2',
      'effect',       'If successful, the caster suffers D3+3 damage. Choose a friendly model that has been put Out of Action and is no longer on the battlefield. Set that model up within 3" of the caster and outside melee range of any enemies. The model is returned with Life equal to the damage suffered by the caster. A single model may not be affected by this spell more than once per game. The affected model must still roll on the Injury and Death table at the end of the game, though if the model rolls a 1 ("Dead"), it instead counts as 2–4 ("Permanent Injury").'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood,   '{}', 0),
    (s_id, kw_healing, '{}', 1);

  -- Scent of Blood
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Scent of Blood',
    'The caster marks the blood of one enemy, empowering allies to attack.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        12,
      'target',       'One Enemy',
      'fateModifier', 'n/a',
      'effect',       'Until the end of the turn, all melee weapon attacks made against the target have Supremacy.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood, '{}', 0);

  -- Shared Suffering
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Shared Suffering',
    'The caster binds their blood to another, causing them to share wounds.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        6,
      'target',       'One model',
      'fateModifier', '-2 (vs enemy); 0 (vs friendly)',
      'effect',       'Until the end of the current turn, whenever the caster suffers damage, reduce that damage by half (rounding down) after Defense has been applied. That same amount of damage is then applied to the target. The damage applied to the spell''s target cannot be reduced or negated.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood, '{}', 0);

  -- Veinweave Mail
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Veinweave Mail',
    'The caster reinforces their own or an ally''s blood and lifeforce, shielding them from harm.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        3,
      'target',       'One Model',
      'fateModifier', '-1',
      'effect',       'The targeted model gains a +2 bonus to Defense for the remainder of the game. A model cannot be affected by this spell more than once in any game.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood, '{}', 0);

  -- Wound Amplification
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Wound Amplification',
    'The caster opens the target''s existing wounds, causing further damage.',
    jsonb_build_object(
      'type',         'Blood Magic',
      'range',        8,
      'target',       'One damaged enemy',
      'fateModifier', '-1',
      'effect',       'The target suffers 3D6+3 damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_blood, '{}', 0);

  -- ══════════════════════════════════════════════════════════════════════════
  -- ELEMENTALISM
  -- ══════════════════════════════════════════════════════════════════════════

  -- Ball Lightning
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Ball Lightning',
    'The caster unleashes bouncing balls of electricity to shock their enemy into submission.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        12,
      'target',       'Up to three enemies',
      'fateModifier', '-1',
      'effect',       'The targets suffer 1D6+2 damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_lightning, '{}', 0);

  -- Cataclysm
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Cataclysm',
    'The caster unleashes a primordial storm of every element.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        12,
      'radius',       4,
      'target',       'All other models in radius',
      'fateModifier', '-2',
      'effect',       'All models suffer 2D6+5 damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area,      '{}', 0),
    (s_id, kw_cold,      '{}', 1),
    (s_id, kw_fire,      '{}', 2),
    (s_id, kw_lightning, '{}', 3);

  -- Explosion
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Explosion',
    'The caster summons a mighty explosion, destroying everything in its path.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        12,
      'radius',       6,
      'target',       'All models within radius',
      'fateModifier', '-2',
      'effect',       'The targets suffer 2D6+1 damage and must move 4" directly away from the caster.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area, '{}', 0),
    (s_id, kw_fire, '{}', 1);

  -- Firelance
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Firelance',
    'The caster launches a gout of burning flame toward an enemy.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        16,
      'target',       'One enemy',
      'fateModifier', 'n/a',
      'effect',       'The target suffers 2D6+4 damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_fire, '{}', 0);

  -- Djinn's Blessing
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Djinn''s Blessing',
    'The caster calls forth elemental power to the weapons of their allies.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        6,
      'target',       'The caster and all friendly models within range',
      'fateModifier', '-1',
      'effect',       'When casting this spell, choose Cold, Fire, or Lightning — the spell gains that keyword. Until the end of the turn, melee and ranged weapons wielded by affected models deal damage of the chosen type instead of their normal type, deal 2 additional damage, and count as magical weapons.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area,      '{}', 0),
    (s_id, kw_cold,      '{}', 1),
    (s_id, kw_fire,      '{}', 2),
    (s_id, kw_lightning, '{}', 3);

  -- Eye of the Storm
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Eye of the Storm',
    'The caster unleashes a raging storm from inside their own being.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        0,
      'radius',       3,
      'target',       'All models within radius',
      'fateModifier', 'n/a',
      'effect',       'All models except the caster suffer 3D6+1 Lightning damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area,      '{}', 0),
    (s_id, kw_lightning, '{}', 1);

  -- Frost Shards
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Frost Shards',
    'The caster calls forth a local storm of ice, damaging and binding foes.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        10,
      'radius',       3,
      'target',       'All models within radius',
      'fateModifier', 'n/a',
      'effect',       'The targets suffer 1D6+1 damage and have the Slowed condition.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area, '{}', 0),
    (s_id, kw_cold, '{}', 1);

  -- Ice-Crusted Plate
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Ice-Crusted Plate',
    'The caster coats themselves in ice, preventing enemies from landing mortal blows.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        0,
      'target',       'Caster',
      'fateModifier', 'n/a',
      'effect',       'The caster increases their Defense to 10 until they next activate.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_cold, '{}', 0);

  -- Ignite the Earth
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Ignite the Earth',
    'The caster ignites the very earth around them, burning all upon it.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        10,
      'target',       'One piece of terrain',
      'fateModifier', 'n/a',
      'effect',       'The terrain counts as Dangerous terrain. Any model that activates on or within 1" of the terrain, or ends movement on or within 1" of the terrain, suffers 3 damage. Defense does not apply to this damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_fire, '{}', 0);

  -- Lightning Reflexes
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Lightning Reflexes',
    'The caster infuses the power of lightning into an ally.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        3,
      'target',       'One model within range',
      'fateModifier', 'n/a',
      'effect',       'The target may move an additional 4" whenever they move and ignores the movement penalty of Difficult terrain. If they make a melee weapon attack and that attack is successful, that attack has the Lightning keyword and deals 2 additional damage. Whenever the caster activates, they must make a Fate check. If successful, the spell and its bonuses continue on the target. If the Fate check fails, this spell ends. The caster cannot cast this spell if there is currently a target benefiting from a previous casting of the spell.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_lightning, '{}', 0);

  -- Winter's Tomb
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Winter''s Tomb',
    'The caster traps an enemy in a cage of solid ice, rendering them unable to escape.',
    jsonb_build_object(
      'type',         'Elementalism',
      'range',        12,
      'target',       'One enemy',
      'fateModifier', 'n/a',
      'effect',       'The target has the Immobilized condition. The target may attack the Cage of Ice (treating it as an enemy). Any trapped enemy will ignore their normal AI behavior and instead attack the ice. The Cage cannot attack, but has a Defense of 4 and 10 Life.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_cold, '{}', 0);

  -- ══════════════════════════════════════════════════════════════════════════
  -- SORCERY
  -- ══════════════════════════════════════════════════════════════════════════

  -- Apocryphon of Divine Imitation
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Apocryphon of Divine Imitation',
    'The caster causes great wings to sprout from an ally, lifting them aloft and making them an imitation of the old champions of good.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        6,
      'target',       'One friendly model',
      'fateModifier', '-1',
      'effect',       'Until the end of the game or until the chosen model is put Out of Action, that model gains the Fly keyword and increases their Movement by 2". They also increase a Stat of the target''s choice by 2. In addition, the target now scores Critical Hits with weapon or spell attacks on a roll of 1 or 2.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Black Sabre
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Black Sabre',
    'The caster summons a blade of pure entropic destruction.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        0,
      'target',       'Caster',
      'fateModifier', 'n/a',
      'effect',       'The caster creates and is automatically wielding the Black Sabre. Choose One-Handed (1D6+6 damage, Slicing/Edged/Piercing) or Two-Handed (2D6+7 damage, Slicing/Edged/Piercing). The weapon counts as magical and attacks with the Fate stat instead of Offense. It lasts until the end of the game or until the caster is put Out of Action.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Crippling Curse
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Crippling Curse',
    'The caster infects an enemy with scores of deadly illnesses, wracking their body with weakness and pain.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        8,
      'target',       'One model within range',
      'fateModifier', '-1',
      'effect',       'The target suffers 1D6+3 damage; they also gain the Bleeding, Slowed, and Poisoned conditions. Any checks to remove these conditions suffer a -2 penalty.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Dimensional Manipulation
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Dimensional Manipulation',
    'The caster binds allies and steps between worlds, arriving at a new location on the battlefield to surprise their foes.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        18,
      'target',       'Self and any friendly models within range',
      'fateModifier', '0 (−1 per additional target beyond the caster)',
      'effect',       'The caster, and any friendly models selected, are teleported up to 18". Models must be set up more than 1" from all enemies. Any friendly models teleported in this way who have not yet activated gain Supremacy on all checks this turn.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Exegesis of the Soul
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Exegesis of the Soul',
    'The caster steps into the world of shadows that borders our own, becoming little more than a ghost to those who remain.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        0,
      'target',       'Caster',
      'fateModifier', '-2',
      'effect',       'The caster loses half their current Life (rounded down) and becomes Ethereal. As long as they are Ethereal, the caster has Supremacy on all Fate checks made to cast spells. The caster may end this effect whenever they activate (no action required). Each time the caster chooses to remain Ethereal, they lose half their current Life (rounded down).'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Fist of Ra-Den-et
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Fist of Ra-Den-et',
    'The caster summons a great construct of force to batter and crush their enemies.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        10,
      'target',       'One model within range',
      'fateModifier', '-1',
      'effect',       'The target suffers 3D6+4 Bludgeoning damage, and the caster may push the model up to 6" directly away. Until the caster next activates, the model is Immobilized. Any check to remove this Immobilized condition suffers a -4 penalty.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Hypostasis of the Archons
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Hypostasis of the Archons',
    'The caster reaches into the flow of time, pulling a warrior forward and infusing them with unnatural alacrity.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        3,
      'target',       'One friendly model within range',
      'fateModifier', 'n/a',
      'effect',       'The model doubles their movement. Whenever the model uses their Offensive action to make an Offense weapon attack, they may make one additional attack as part of that action. These bonuses last until the end of the game. At the end of the game, the warrior must roll on the Injury and Death table, regardless of whether or not they were taken Out of Action.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Manipulate Fate
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Manipulate Fate',
    'The caster pulls on the strings of fate, changing potential future outcomes.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        12,
      'target',       'One friendly model and one enemy model',
      'fateModifier', 'n/a',
      'effect',       'The chosen friendly model has Supremacy on all checks until the caster''s next activation. The chosen enemy has Deficiency on all checks until the caster''s next activation.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Refutation of Heresy
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Refutation of Heresy',
    'The caster summons a sphere that protects against enemy magic.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        3,
      'target',       'All friendly models in range',
      'fateModifier', '-2',
      'effect',       'Until the caster next activates, the caster and all models within 3" gain a Shield token that can only be used to negate spell damage. Each time a spell is negated in this way, the caster of the spell suffers 1D6 damage.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_area,    '{}', 0),
    (s_id, kw_sorcery, '{}', 1);

  -- Resurrection
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Resurrection',
    'The caster calls back the soul of the fallen before they are lost to the underworld.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        3,
      'target',       'One destroyed friendly model',
      'fateModifier', '-2',
      'effect',       'Choose a single friendly model that has been put Out of Action during this game and is not currently in the game. If successful, set the model up within 3" of the caster at 1D6+4 Life (cannot exceed their normal maximum). As long as the model is not put Out of Action a second time, they do not need to roll on the Injury and Death table. No single model may be targeted by this spell more than once per game.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

  -- Word of Extinction
  insert into public.addons (user_id, addon_type_id, pack_id, name, description, stats, prerequisites)
  values (v_user_id, v_type_id, v_pack_id,
    'Word of Extinction',
    'The caster reaches out and extinguishes the life of a weaksouled enemy.',
    jsonb_build_object(
      'type',         'Sorcery',
      'range',        13,
      'target',       'One model within range',
      'fateModifier', '-1',
      'effect',       'Choose a single Minion, Servant, or Lieutenant within range. If the spell is successful, that model is slain and put Out of Action.'
    ),
    v_empty_prereq)
  returning id into s_id;
  insert into public.addon_keywords (addon_id, keyword_id, params, sort_order) values
    (s_id, kw_sorcery, '{}', 0);

end $$;
