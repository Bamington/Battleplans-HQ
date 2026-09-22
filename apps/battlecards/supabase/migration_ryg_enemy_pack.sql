-- ============================================================
-- BattleCards — the Repent Ye Foolish Gods enemy pack
--
-- Creates an official pack holding all 19 enemies from the book:
-- 4 Minions, 5 Servants, 5 Lieutenants, 5 Champions, with their
-- special abilities, weapons and equipment.
--
-- PACK CARDS ARE TEMPLATES
-- A pack's cards carry is_template = true, deck_id = null and a
-- pack_id (see the cards_template_or_deck constraint). import_pack
-- clones them into the importing user's library, preserving
-- card_type — so an imported enemy arrives as an enemy template.
--
-- KNOWN GAP: nothing consumes these yet. useRygEnemies loads
-- enemies by deck_id, and the builder's only route to one is the
-- Add Enemy button, which creates a blank. Instantiating an enemy
-- from a template is still to be built; until then this pack is
-- data waiting for a door.
--
-- SHARED KIT IS DEDUPLICATED
-- Six enemies carry the same Dagger and three the same Flail, so
-- each distinct weapon and piece of equipment is created once and
-- referenced by every enemy that carries it — matching how a
-- user's own library behaves.
--
-- WEAPON KEYWORDS LIVE IN description
-- "Edged, Two-Handed, Piercing" goes in the addon's description
-- rather than as keyword rows, because that is what the enemy card
-- renders (see useRygEnemies, which reads keywords from
-- description). Warrior weapons use real keyword rows via
-- addon_keywords; the two paths should converge later.
--
-- Re-running is safe: it checks for the pack by name first.
--
-- Run in the Supabase SQL editor after migration_ryg_enemies.sql.
-- ============================================================

do $$
declare
  v_game     uuid;
  v_owner    uuid;
  v_pack     uuid;
  t_ability  uuid;
  t_weapon   uuid;
  t_armor    uuid;
  r          record;
  v_id       uuid;
  v_card     uuid;
  v_sort     int;
  v_name     text;
begin
  -- ── Prerequisites ─────────────────────────────────────────

  select id into v_game from public.games where slug = 'ryg';
  if v_game is null then
    raise exception 'No game row for slug "ryg"';
  end if;

  -- The pack owner. packs.owner_user_id is NOT NULL; official packs
  -- belong to the account that authors them. Change this address to
  -- publish the pack under a different account.
  select id into v_owner from auth.users where email = 'chris.bam.harrison@gmail.com';
  if v_owner is null then
    raise exception 'No user found to own the pack — set the email above';
  end if;

  select id into t_ability from public.addon_types where game_id = v_game and slug = 'enemy-abilities';
  select id into t_weapon  from public.addon_types where game_id = v_game and slug = 'weapons';
  select id into t_armor   from public.addon_types where game_id = v_game and slug = 'armor';
  if t_ability is null or t_weapon is null or t_armor is null then
    raise exception 'Missing an RYG addon type — run migration_ryg_enemies.sql first';
  end if;

  if exists (
    select 1 from public.packs
    where game_id = v_game and name = 'Enemies' and is_official
  ) then
    raise notice 'The Enemies pack already exists — nothing to do.';
    return;
  end if;

  -- ── The pack ──────────────────────────────────────────────

  insert into public.packs (owner_user_id, game_id, name, description, is_public, is_official)
  values (
    v_owner, v_game, 'Enemies',
    'Every enemy from Repent Ye Foolish Gods — minions, servants, lieutenants and champions, with their abilities, weapons and equipment.',
    true, true
  )
  returning id into v_pack;

  -- ── Weapons ───────────────────────────────────────────────
  -- range 0 = melee, which is how the card renders it (an em dash
  -- rather than 0").

  create temp table _weapons (name text primary key, id uuid) on commit drop;

  for r in
    select * from (values
      ('Crossbow',     '2D6+5', 16, 'Edged, Two-Handed, Piercing'),
      ('Flamberge',    '2D6+4',  0, 'Edged, Two-Handed, Reach'),
      ('Kopis',        '1D6+2',  0, 'Edged, One-Handed, Piercing, Slicing'),
      ('Dagger',       '1D6+1',  8, 'Edged, One-Handed, Piercing, Special'),
      ('Short Bow',    '2D6+3', 14, 'Edged, Two-Handed, Piercing, Slicing'),
      ('War Scythe',   '2D6+4',  0, 'Edged, Two-Handed, Slicing'),
      ('Flail',        '1D6+4',  0, 'Bludgeoning, One-Handed'),
      ('Falchion',     '2D6+5',  0, 'Edged, Two-Handed'),
      ('Warhammer',    '1D6+3',  0, 'Bludgeoning, One-Handed, Crushing'),
      ('Rapier',       '1D6+3',  0, 'Edged, One-Handed, Piercing'),
      ('Maul',         '2D6+4',  0, 'Bludgeoning, Two-Handed, Crushing'),
      ('Kriegsmesser', '2D6+5',  0, 'Edged, Two-Handed')
    ) as t(name, damage, rng, keywords)
  loop
    insert into public.addons (user_id, addon_type_id, name, description, stats, pack_id)
    values (
      v_owner, t_weapon, r.name, r.keywords,
      jsonb_build_object('damage', r.damage, 'range', r.rng, 'cost', 0),
      v_pack
    )
    returning id into v_id;
    insert into _weapons values (r.name, v_id);
  end loop;

  -- ── Equipment ─────────────────────────────────────────────
  -- Shield carries no rules text: the book lists Dreadwardens,
  -- Ironbound and Doomlords as "armed with … Shields" without
  -- giving an effect, so none is invented here.

  create temp table _gear (name text primary key, id uuid) on commit drop;

  for r in
    select * from (values
      ('Light Armor', '-1 Enemy Offense.'),
      ('Heavy Armor', '-2 Enemy Offense, -1 Movement.'),
      ('Shield',      '')
    ) as t(name, description)
  loop
    insert into public.addons (user_id, addon_type_id, name, description, stats, pack_id)
    values (v_owner, t_armor, r.name, nullif(r.description, ''), '{}'::jsonb, v_pack)
    returning id into v_id;
    insert into _gear values (r.name, v_id);
  end loop;

  -- ── Enemies ───────────────────────────────────────────────
  -- Each enemy's ability is named after the enemy, which is what the
  -- ability title defaults to — and the card hides a title that
  -- matches the enemy's own name, so these render as plain rules.

  for r in
    select * from (values
      -- name, type, ai, offense, defense, life, tactics, fate, weapons, gear, ability
      ('Carrion', 'Minion', 'Dross', 4, 2, 4, 2, 2,
       array['Crossbow'], array[]::text[],
       'At the start of each turn, Carrion become Hidden. They remain Hidden until they activate.'),

      ('Reaver', 'Minion', 'Dross', 4, 1, 3, 4, 1,
       array['Flamberge'], array[]::text[],
       'Reavers gain +1 Offense when making attacks against enemies who have not yet activated during the current turn.'),

      ('Thrall', 'Minion', 'Dross', 4, 1, 4, 1, 3,
       array['Kopis'], array[]::text[],
       'Thralls deal 1 additional damage on any successful attack against an enemy below their maximum Life.'),

      ('Wretch', 'Minion', 'Dross', 3, 2, 4, 1, 3,
       array['Dagger'], array[]::text[],
       'The Wretch gains +1 Offense for each other Wretch within 3" of it.'),

      ('Ashmarked', 'Servant', 'Hunter', 1, 4, 10, 2, 6,
       array['Dagger'], array[]::text[],
       'Spellcasting (Elementalism): Frost Shards, Firelance.'),

      ('Bloodsmith', 'Servant', 'Defender', 2, 4, 9, 3, 7,
       array['Dagger'], array['Light Armor'],
       'Spellcasting (Blood Magic): Acid Blood, Boiling Blood.'),

      ('Duskborn', 'Servant', 'Hunter', 5, 3, 8, 5, 1,
       array['Short Bow'], array[]::text[],
       'At the start of each turn, Duskborn become Hidden. They remain Hidden until they activate.'),

      ('Harbinger', 'Servant', 'Commander', 4, 6, 10, 3, 5,
       array['War Scythe'], array['Light Armor'],
       'All friendly models within 6" of a Harbinger reduce all damage they suffer by 1, cumulative to a maximum reduction of 3. Harbingers deal Cold damage instead of Edged damage with their War Scythe.'),

      ('Penitent', 'Servant', 'Defender', 5, 3, 7, 3, 3,
       array['Flail'], array[]::text[],
       'The Penitent reduces all weapon attack damage dealt to it by 1.'),

      ('Apostate', 'Lieutenant', 'Hunter', 5, 6, 11, 4, 2,
       array['Falchion'], array['Light Armor'],
       'Apostates may attack twice whenever they make a weapon attack. Roll an Offense check for each attack and resolve damage individually.'),

      ('Doomsayer', 'Lieutenant', 'Hunter', 2, 5, 9, 4, 6,
       array['Dagger'], array[]::text[],
       'Any Warrior within 1" of the Doomsayer reduces their Offense by 1. Spellcasting (Blood Magic): Acid Blood, Exsanguinate.'),

      ('Dreadwarden', 'Lieutenant', 'Commander', 5, 6, 12, 5, 1,
       array['Flail'], array['Heavy Armor', 'Shield'],
       'Dreadwardens gain Supremacy on all Offense attacks whenever they are within 3" of a Secondary Objective, Shrine, or Temple.'),

      ('Endcaller', 'Lieutenant', 'Hunter', 3, 4, 11, 6, 6,
       array['Dagger'], array[]::text[],
       'Spellcasting (Blood Magic): Wound Amplification, Exsanguinate.'),

      ('Ironbound', 'Lieutenant', 'Defender', 6, 6, 13, 1, 3,
       array['Warhammer'], array['Heavy Armor', 'Shield'],
       'If an Ironbound is Critically Hit by an Offense attack, their Defense is reduced to 3 rather than being ignored entirely.'),

      ('Doomlord', 'Champion', 'Commander', 6, 7, 17, 7, 3,
       array['Flail'], array['Heavy Armor', 'Shield'],
       'All enemies (non-warriors) within 6" of Doomlords gain a +1 bonus to their Offense and a +1 bonus to their Tactics.'),

      ('Malekin', 'Champion', 'Hunter', 4, 7, 16, 5, 9,
       array['Dagger'], array['Heavy Armor'],
       'Spellcasting (Blood Magic): Wound Amplification, Acid Blood, Scent of Blood.'),

      ('Nightkin', 'Champion', 'Hunter', 7, 4, 14, 6, 2,
       array['Rapier'], array['Light Armor'],
       'Nightkin are Hidden when deployed. At the end of each of their activations, they become Hidden again. Any Tactics check made to reveal them suffers a -1 penalty. If they hit with an attack while Hidden, they deal 3 additional damage.'),

      ('Paingiver', 'Champion', 'Dross', 6, 4, 23, 4, 1,
       array['Maul'], array[]::text[],
       'Whenever a Paingiver suffers damage from an Offense attack, the attacker suffers damage equal to half the damage dealt to the Paingiver, after Defense is applied.'),

      ('Slaughterborn', 'Champion', 'Hunter', 9, 5, 14, 5, 1,
       array['Kriegsmesser'], array['Light Armor'],
       'Slaughterborn may attack 3 times whenever they make a weapon attack. Roll an Offense check for each attack and resolve damage individually.')
    ) as t(name, enemy_type, ai_type, offense, defense, life, tactics, fate, weapons, gear, ability)
  loop
    -- The card. A pack card is a template: no deck, game_id set.
    insert into public.cards (
      deck_id, user_id, game_id, name, card_type, stats, is_template, pack_id
    )
    values (
      null, v_owner, v_game, r.name, 'enemy',
      jsonb_build_object(
        'enemyType', r.enemy_type,
        'aiType',    r.ai_type,
        'offense',   r.offense,
        'defense',   r.defense,
        'life',      r.life,
        'tactics',   r.tactics,
        'fate',      r.fate
      ),
      true, v_pack
    )
    returning id into v_card;

    v_sort := 0;

    -- Ability first, matching the order the card renders in.
    insert into public.addons (user_id, addon_type_id, name, description, stats, pack_id)
    values (v_owner, t_ability, r.name, r.ability, '{}'::jsonb, v_pack)
    returning id into v_id;

    insert into public.card_addons (card_id, addon_id, sort_order)
    values (v_card, v_id, v_sort);
    v_sort := v_sort + 1;

    foreach v_name in array r.weapons loop
      select id into v_id from _weapons where name = v_name;
      if v_id is null then
        raise exception 'Unknown weapon "%" on enemy "%"', v_name, r.name;
      end if;
      insert into public.card_addons (card_id, addon_id, sort_order)
      values (v_card, v_id, v_sort);
      v_sort := v_sort + 1;
    end loop;

    foreach v_name in array r.gear loop
      select id into v_id from _gear where name = v_name;
      if v_id is null then
        raise exception 'Unknown equipment "%" on enemy "%"', v_name, r.name;
      end if;
      insert into public.card_addons (card_id, addon_id, sort_order)
      values (v_card, v_id, v_sort);
      v_sort := v_sort + 1;
    end loop;
  end loop;

  raise notice 'Enemies pack created with % cards.',
    (select count(*) from public.cards where pack_id = v_pack);
end $$;
