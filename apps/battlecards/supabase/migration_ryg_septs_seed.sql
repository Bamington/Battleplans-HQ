-- migration_ryg_septs_seed.sql
--
-- Seeds the 6 core Septs into pack 13462ff2-13bf-4569-9d3d-8b343bdc3c66
-- for user 95c85832-e8eb-4693-b2fa-c6b122972b12.
--
-- Each Sept is created as an addon (septs type) with name/stats for the
-- three requirement fields, plus associated sept-benefit addons. Both the
-- addon and its benefits are cloned into the pack via pack_addons.

do $$
declare
  v_user_id  uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id  uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_game_id  uuid;
  v_sept_type_id    uuid;
  v_benefit_type_id uuid;

  v_sept_id    uuid;
  v_benefit_id uuid;
begin
  select id into v_game_id from public.games where slug = 'ryg';

  select id into v_sept_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'septs';

  select id into v_benefit_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'sept-benefits';

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of Decapitation
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'Decapitation',
    'Cutting the head from the snake is the only way to make sure the creature is dead. Warriors of this Sept favor brutal, straightforward tactics. They find nothing more thrilling than wading into their enemies, letting the spray of blood and viscera mark their passage.',
    '{
      "prohibited": "Your Sept may not include any Fallen.",
      "required":   "Your Sept must have at least one Soldier or Forsaken.",
      "restricted": "Your Sept may not have more than one Cursed."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  -- Benefits
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Bloodsoaked',
    'Warriors of this Sept deal 1 additional damage with all melee weapon attacks. If that attack was made with Supremacy, it deals 3 additional damage instead.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Revel in Gore',
    'Whenever a warrior of this Sept destroys an enemy with a melee weapon, they may immediately move up to 6".',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of Esoterica
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'Esoterica',
    'Only by stealing the power of the gods — their magic — can we have any hope of destroying them. Warriors of this Sept utilize magic and ancient arcana as their primary weapons.',
    '{
      "prohibited": "Your Sept may not include any Soldiers.",
      "required":   "Your Sept must have at least two members that are either Cursed or Fallen.",
      "restricted": "Your Sept may not have more than one Forsaken."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Fate Marked',
    'Warriors of this Sept increase their Fate by 1.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Magic Inured',
    'Warriors of this Sept reduce any damage done by a spell attack by 1 to a minimum of 0.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Outcast
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'The Outcast',
    'The gods have cursed us and thrown us away. We shall make them pay in blood for their crimes. Warriors of this Sept are some of the most cursed and abominable combatants that walk this land.',
    '{
      "prohibited": "Your Sept may not include any Soldiers.",
      "required":   "Your Sept must include two members that are either Cursed, Forsaken, or Wronged in any combination.",
      "restricted": "None."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Cursed Fate',
    'Whenever a warrior of this Sept is put Out of Action, when rolling on the Injury and Death table, they treat all results of 2–4 (permanent injury) as a roll of 10–11 (alteration) instead. When rolling the D3 for Alteration to determine the increase or reduction in stats, they may roll twice and take either result.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Inured to Suffering',
    'Warriors of this Sept have Superiority when making a Stat check to remove any condition. In addition, if they have the Bleeding condition, they may choose to forgo rolling to remove that condition. If they do, they suffer the 1 damage from Bleeding when they activate as normal. If that damage is not prevented, they gain a +3 bonus to damage with all Offense attacks during that activation.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Strength from Pain',
    'Whenever a warrior of this Sept has half or less of their Life remaining, they gain a +1 bonus to Offense and Defense.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Shadow
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'The Shadow',
    'The gods think shadows and night their allies; we will show them how wrong they are. Warriors of this Sept utilize darkness and stealth as weapons more than any sword or hammer.',
    '{
      "prohibited": "Your Sept may not include any Soldiers.",
      "required":   "Your Sept must have at least two members that are either Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one Forsaken or Fallen."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Infiltration',
    'When setting up your models, you may place up to two total Bastard or Wronged warriors anywhere on the battlefield outside of the enemy deployment zones. Those warriors count as Hidden until they activate for the first time.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Careful Strikes',
    'Warriors of this Sept reduce the penalty to Offense from armor by 1, to a minimum of zero.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Star
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'The Star',
    'The gods will not be destroyed by brute strength alone. Only through our wits can we win the day and destroy them. Warriors of this Sept are focused on clever tactics and outsmarting their enemies.',
    '{
      "prohibited": "None.",
      "required":   "Your Sept must include at least one Soldier and at least one Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one of any warrior type."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Careful Planning',
    'Before the first turn of the game, you may choose a single warrior from your Sept that has been set up. That warrior may move up to 6".',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Combined Tactics',
    'Whenever a warrior of your Sept critically hits an enemy with an Offense attack, that enemy halves their Defense against the next damage they suffer from a spell that turn.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Tactical Assault',
    'Warriors of the Sept of the Star increase their Tactics by 1. In addition, they have Superiority on Initiative checks during the first turn of the game.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Talisman
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_sept_type_id,
    'The Talisman',
    'The gods are fools for putting their power into weapons and trinkets. They willingly give us the means to destroy them. Warriors of this Sept are focused on acquiring magical items and items of power to aid them in their war against the dark gods.',
    '{
      "prohibited": "None.",
      "required":   "Your Sept must include at least one Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one Fallen."
    }'::jsonb
  )
  returning id into v_sept_id;

  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_sept_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Starting Gold',
    'The Sept of the Talisman begins play with 200gp instead of the normal 100gp.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Treasure Seekers',
    'When rolling to Determine Rewards in the Post-Game Process, the Sept of the Talisman is always treated as having achieved a victory one step higher than they achieved in the game. If they lost, they roll as though it were a Minor Victory; if they achieved a Minor Victory, they roll as though it were a Victory; if they achieved a Victory, they roll as though it were a Glorious Victory. If they achieve a Glorious Victory, they may roll one additional time on the Determine Rewards table, potentially gaining a second item. This second roll is always made with a single D12 that cannot be modified.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

  insert into public.addons (user_id, addon_type_id, name, description, stats)
  values (
    v_user_id, v_benefit_type_id,
    'Magical Strikes',
    'When making Offense attacks, warriors of this Sept are always treated as though their weapons are magical (meaning they can damage Ethereal enemies). If the warrior makes an Offense attack with a magical weapon, they deal 1 additional damage with any such attack.',
    '{}'::jsonb
  )
  returning id into v_benefit_id;
  insert into public.pack_addons (pack_id, addon_id) values (v_pack_id, v_benefit_id);

end $$;
