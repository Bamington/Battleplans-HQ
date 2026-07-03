-- migration_ryg_destinies_seed.sql
--
-- Seeds the 7 core Destinies into pack 13462ff2-13bf-4569-9d3d-8b343bdc3c66
-- for user 95c85832-e8eb-4693-b2fa-c6b122972b12.
--
-- Each Destiny is created as an addon (destinies type) with stats for
-- description (the destiny ability) and curse.

do $$
declare
  v_user_id         uuid := '95c85832-e8eb-4693-b2fa-c6b122972b12';
  v_pack_id         uuid := '13462ff2-13bf-4569-9d3d-8b343bdc3c66';
  v_game_id         uuid;
  v_destiny_type_id uuid;
begin
  select id into v_game_id from public.games where slug = 'ryg';

  select id into v_destiny_type_id
    from public.addon_types
    where game_id = v_game_id and slug = 'destinies';

  -- ══════════════════════════════════════════════════════════════════════
  -- Farsight
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Farsight',
    '{
      "description": "Once per game, you may reroll any single roll.",
      "curse":       "Once you use the Farsight reroll, your warriors suffer a -1 penalty to Initiative rolls for the remainder of the game."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Martyred Saint
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Martyred Saint',
    '{
      "description": "Whenever a warrior is reduced to half their total Life or less, they gain a +1 bonus to Offense as long as they are at half or less Life.",
      "curse":       "Whenever one of your warriors is healed when at half or less Life, halve the effect of all healing (rounding down)."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Soul of Iron
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Soul of Iron',
    '{
      "description": "Once per game, you may choose any one warrior in your Sept to ignore all effects and damage from any single magic attack.",
      "curse":       "The warrior who benefited from the Destiny halves their Defense against all magic attacks for the remainder of the game."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Topple Stone
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Topple Stone',
    '{
      "description": "Once per game, when a warrior of your Sept makes an attack against a Lieutenant, Champion, or Legendary enemy, they may ignore all Deficiency and gain Supremacy for the attack.",
      "curse":       "Whenever a Minion rolls a Critical Hit on an attack against your warriors, they deal 1 additional damage."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Dawn Bringer
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Dawn Bringer',
    '{
      "description": "Your warriors gain a +1 bonus to all stats when making Stat checks during the first turn of the game.",
      "curse":       "Your warriors suffer a -1 penalty to all stats when making Stat checks during the fifth turn of the game."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Break the Chain
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Break the Chain',
    '{
      "description": "Once per game, one warrior in your Sept may automatically end any condition affecting them when they activate. This does not take any action.",
      "curse":       "Whenever the warrior who benefited from this Destiny is affected by a condition for the remainder of the game, they have Deficiency to end that condition."
    }'::jsonb
  );

  -- ══════════════════════════════════════════════════════════════════════
  -- Oath Keeper
  -- ══════════════════════════════════════════════════════════════════════
  insert into public.addons (user_id, pack_id, addon_type_id, name, stats)
  values (
    v_user_id, v_pack_id, v_destiny_type_id,
    'Oath Keeper',
    '{
      "description": "Once per game, a warrior in your Sept swears an Oath to kill a chosen enemy. They gain Supremacy on all attacks against that enemy and deal 1 additional damage with all such attacks.",
      "curse":       "If the enemy chosen in the Destiny ability is not slain by the end of the next round after the Oath is declared, that warrior has Deficiency on all checks for the remainder of the game, which cannot be cancelled for any reason."
    }'::jsonb
  );

end $$;
