-- migration_ryg_septs2_seed.sql
--
-- Seeds 3 Septs and their Benefits into pack 13462ff2-13bf-4569-9d3d-8b343bdc3c66
-- for user 95c85832-e8eb-4693-b2fa-c6b122972b12.
--
-- Each Sept is inserted first, then its Benefits are inserted and their IDs
-- are written back into the Sept's stats as benefitIds / benefitNames.

do $$
declare
  v_user_id          uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id          uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_game_id          uuid;
  v_sept_type_id     uuid;
  v_benefit_type_id  uuid;
  v_sept_id          uuid;
  v_benefit_ids      uuid[];
  v_benefit_names    text[];
begin
  select id into v_game_id from public.games where slug = 'ryg';

  select id into v_sept_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'septs';

  select id into v_benefit_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'sept-benefits';

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Shadow
  -- ══════════════════════════════════════════════════════════════════════

  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_sept_type_id,
    'Sept of the Shadow',
    '{
      "prohibited": "Your Sept may not include any Soldiers.",
      "required":   "Your Sept must have at least two members that are either Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one Forsaken or Fallen."
    }'::jsonb
  )
  returning id into v_sept_id;

  -- Benefits
  v_benefit_ids   := array[]::uuid[];
  v_benefit_names := array[]::text[];

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Infiltration',
      'When setting up your models, you may place up to two total Bastard or Wronged warriors anywhere on the battlefield outside of the enemy deployment zones. Those warriors count as Hidden until they activate for the first time. (They may still remain Hidden due to other rules or game elements.)'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Infiltration')
    into v_benefit_ids, v_benefit_names
  from ins;

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Careful Strikes',
      'Warriors of this Sept reduce the penalty to Offense from armor by 1, to a minimum of zero.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Careful Strikes')
    into v_benefit_ids, v_benefit_names
  from ins;

  update public.addons
    set stats = stats || jsonb_build_object(
      'benefitIds',   to_jsonb(v_benefit_ids),
      'benefitNames', to_jsonb(v_benefit_names)
    )
  where id = v_sept_id;

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Star
  -- ══════════════════════════════════════════════════════════════════════

  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_sept_type_id,
    'Sept of the Star',
    '{
      "required":   "Your Sept must include at least one Soldier and at least one Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one of any warrior type."
    }'::jsonb
  )
  returning id into v_sept_id;

  -- Benefits
  v_benefit_ids   := array[]::uuid[];
  v_benefit_names := array[]::text[];

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Careful Planning',
      'Before the first turn of the game, you may choose a single warrior from your Sept that has been set up. That warrior may move up to 6".'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Careful Planning')
    into v_benefit_ids, v_benefit_names
  from ins;

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Combined Tactics',
      'Whenever a warrior of your Sept critically hits an enemy with an Offense attack, that enemy halves their Defense against the next damage they suffer from a spell that turn.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Combined Tactics')
    into v_benefit_ids, v_benefit_names
  from ins;

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Tactical Assault',
      'Warriors of the Sept of the Star increase their Tactics by 1. In addition, they have Superiority on Initiative checks during the first turn of the game.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Tactical Assault')
    into v_benefit_ids, v_benefit_names
  from ins;

  update public.addons
    set stats = stats || jsonb_build_object(
      'benefitIds',   to_jsonb(v_benefit_ids),
      'benefitNames', to_jsonb(v_benefit_names)
    )
  where id = v_sept_id;

  -- ══════════════════════════════════════════════════════════════════════
  -- Sept of the Talisman
  -- ══════════════════════════════════════════════════════════════════════

  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_sept_type_id,
    'Sept of the Talisman',
    '{
      "required":   "Your Sept must include at least one Bastard or Wronged.",
      "restricted": "Your Sept may not have more than one Fallen."
    }'::jsonb
  )
  returning id into v_sept_id;

  -- Benefits
  v_benefit_ids   := array[]::uuid[];
  v_benefit_names := array[]::text[];

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Starting Gold',
      'The Sept of the Talisman begins play with 200gp instead of the normal 100gp.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Starting Gold')
    into v_benefit_ids, v_benefit_names
  from ins;

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Treasure Seekers',
      'When rolling to Determine Rewards in the Post-Game Process, the Sept of the Talisman is always treated as having achieved a victory one step higher than they achieved in the game. If they lost, they roll as though it were a Minor Victory; if they achieved a Minor Victory, they roll as though it were a Victory; if they achieved a Victory, they roll as though it were a Glorious Victory. If they achieve a Glorious Victory, they may roll one additional time on the Determine Rewards table, potentially gaining a second item. This second roll is always made with a single D12 that cannot be modified.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Treasure Seekers')
    into v_benefit_ids, v_benefit_names
  from ins;

  with ins as (
    insert into public.addons (user_id, pack_id, addon_type_id, name, description)
    values (
      v_user_id, v_pack_id, v_benefit_type_id,
      'Magical Strikes',
      'When making Offense attacks, warriors of this Sept are always treated as though their weapons are magical (meaning they can damage Ethereal enemies). If the warrior makes an Offense attack with a magical weapon, they deal 1 additional damage with any such attack.'
    )
    returning id
  )
  select array_append(v_benefit_ids, id), array_append(v_benefit_names, 'Magical Strikes')
    into v_benefit_ids, v_benefit_names
  from ins;

  update public.addons
    set stats = stats || jsonb_build_object(
      'benefitIds',   to_jsonb(v_benefit_ids),
      'benefitNames', to_jsonb(v_benefit_names)
    )
  where id = v_sept_id;

end $$;
