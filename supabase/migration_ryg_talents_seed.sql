-- migration_ryg_talents_seed.sql
--
-- Seeds the full talent list for Repent Ye Foolish Gods.
-- Spellcasting and Spell Learning include a paramsSchema so the builder
-- can prompt the warrior's player to choose a magic type on attachment.

with
  talent_type as (
    select at.id as addon_type_id
    from   public.addon_types at
    join   public.games g on at.game_id = g.id
    where  g.slug = 'ryg' and at.slug = 'talents'
  ),
  admin_user as (
    select id as user_id
    from   auth.users
    where  email = 'chris.bam.harrison@gmail.com'
    limit  1
  )
insert into public.addons (user_id, addon_type_id, name, description, stats)
select
  u.user_id,
  t.addon_type_id,
  v.name,
  v.description,
  v.stats::jsonb
from talent_type t, admin_user u,
(values
  (
    'Aegis',
    'Once per turn, when an enemy is making an attack against the warrior with Supremacy, that Supremacy is cancelled and the attack is made with Deficiency instead.',
    '{"prerequisites": "Offense 5", "repeatable": true}'
  ),
  (
    'Blast Master',
    'Whenever this warrior successfully casts a spell with the Area keyword, all damage dealt by the spell is increased by 1.',
    '{"prerequisites": "Fate 6, Spellcasting", "repeatable": true}'
  ),
  (
    'Champion',
    'Whenever the warrior makes a weapon attack as part of an Offensive action, they may make two weapon attacks instead of one, rolling an Offense check for each and resolving damage individually.',
    '{"prerequisites": "Offense 5", "repeatable": false}'
  ),
  (
    'Dauntless',
    'The first time in the game the warrior is reduced to 0 Life, they may make a Fate check. If this check is successful, they are not reduced to 0, but instead ignore all damage and effects from that attack and heal 1D6 damage.',
    '{"prerequisites": "Defense 5", "repeatable": false}'
  ),
  (
    'Deadeye',
    'This talent allows the warrior to ignore the penalty for cover when making ranged attacks. The target must still be within line of sight as normal. If the target of the ranged attack is a Secondary Objective, the warrior also deals an additional 3 damage.',
    '{"prerequisites": "Offense 5", "repeatable": false}'
  ),
  (
    'Deflection',
    'This talent allows the warrior to start the turn with two Shield tokens if they are wielding a shield. This means they may negate up to 2 attacks each turn. Both Shield tokens refresh at the start of the turn as long as the warrior is still wielding the shield.',
    '{"prerequisites": "Defense 7", "repeatable": false}'
  ),
  (
    'Empowerment',
    'Whenever this warrior deals damage with a spell attack, they may choose a single model that was attacked and deal 1D6 additional damage to that target.',
    '{"prerequisites": "Fate 6, Spellcasting", "repeatable": false}'
  ),
  (
    'Ensnaring',
    'Whenever this warrior is within melee range of an enemy, if that enemy leaves melee range for any reason, the warrior may deal damage to that enemy equal to the damage of the melee weapon they are currently wielding. Defense applies to this damage as normal.',
    '{"prerequisites": "Offense 6", "repeatable": false}'
  ),
  (
    'Evasion',
    'Once per turn, when this warrior is attacked by an enemy they can see, and that attack is from a ranged weapon or has the Area keyword, this warrior may negate the attack. The warrior must make this decision before the damage is rolled. This attack now counts as a miss and deals no damage.',
    '{"prerequisites": "Defense 4 and Fate 4", "repeatable": false}'
  ),
  (
    'Flanking',
    'Whenever this warrior makes an attack with a melee weapon and another friendly warrior is within melee range of the enemy targeted by that attack, this warrior gains Supremacy for that attack.',
    '{"prerequisites": "Tactics 5", "repeatable": false}'
  ),
  (
    'Fleet',
    'Whenever this warrior moves, they may move an additional 2".',
    '{"prerequisites": "None", "repeatable": true}'
  ),
  (
    'Immunity',
    'Choose a single Resistance type (Cold, Fire, Edged weapons, etc.) that the warrior already has the Resistance talent for. The warrior now reduces all damage taken from attacks with that keyword to 0.',
    '{"prerequisites": "Resistance, Defense 8", "repeatable": false}'
  ),
  (
    'Improved Evasion',
    'The warrior may use Evasion twice per turn instead of once.',
    '{"prerequisites": "Defense 7 and Fate 6, Evasion", "repeatable": false}'
  ),
  (
    'Improved Shield Slam',
    'When the warrior uses the Shield token to negate an attack, they deal 2D6 damage to the attacker if the attacker is within 1" of the warrior.',
    '{"prerequisites": "Offense 8, Soldier", "repeatable": false}'
  ),
  (
    'Paragon',
    'Whenever the warrior makes a weapon attack as part of an Offensive action, they may make 3 weapon attacks instead of one, rolling an Offense check for each and resolving damage individually.',
    '{"prerequisites": "Champion, Offense 9", "repeatable": false}'
  ),
  (
    'Phoenix',
    'The first time in the game the warrior is reduced to 0 Life, they may make a Fate check. If this check is successful, all enemies within 3" suffer 3 damage that ignores Defense, and the warrior is restored to maximum Life. This ability replaces Dauntless.',
    '{"prerequisites": "Dauntless, Defense 7, Fate 5", "repeatable": false}'
  ),
  (
    'Piercing',
    'Whenever this warrior makes an attack with Supremacy, they deal 3 additional damage.',
    '{"prerequisites": "Flanking, Offense 6, Tactics 5", "repeatable": true}'
  ),
  (
    'Prepared Spellcaster',
    'After all models have been set up but before Initiative is rolled for the first turn, this warrior may cast a single spell with a range of Self and/or that targets an allied warrior. The spell may not target or affect an enemy in any way.',
    '{"prerequisites": "Fate 8", "repeatable": false}'
  ),
  (
    'Punishing',
    'When the warrior uses a spell with a single target to make an attack, that target reduces their Defense by 2 against the effects of the spell.',
    '{"prerequisites": "Spellcasting, Fate 8", "repeatable": false}'
  ),
  (
    'Resistance',
    'This talent allows the warrior to shrug off certain types of damage. Whenever a warrior gains Resistance, they must select a type from Blunt weapons, Cold, Edged weapons, Fire, Lightning, or Poison. Whenever a warrior suffers damage from an attack with the chosen keyword, their Defense is increased by 2.',
    '{"prerequisites": "Defense 5", "repeatable": true}'
  ),
  (
    'Restoration',
    'During the warrior''s turn, as a Utility action, they may select a friendly model within 3" and then choose to suffer any amount of damage up to their remaining Life. Their target then heals three times that amount of Life. If the damage suffered reduces the warrior''s Life to 0, they are removed from play as normal.',
    '{"prerequisites": "Fate 7", "repeatable": false}'
  ),
  (
    'Shaping',
    'When the warrior uses a spell with the Area keyword, they may double the radius of the spell. A spell that normally has a 3" radius would now have a 6" radius.',
    '{"prerequisites": "Spellcasting, Fate 8", "repeatable": false}'
  ),
  (
    'Spell Learning',
    'Select one additional spell from the type of magic selected with the chosen Spellcasting talent.',
    '{"prerequisites": "Spellcasting", "repeatable": true, "paramsSchema": [{"key": "type", "label": "Magic Type", "options": ["Blood Magic", "Elementalism", "Sorcery"]}]}'
  ),
  (
    'Spellcasting',
    'This warrior has the ability to learn and cast magical spells. When gained, choose a type of magic: Blood Magic, Elementalism, or Sorcery (Sorcery only on the second acquisition). The warrior may select 3 spells they know and may cast from that school. A warrior may never select Spellcasting more than twice.',
    '{"prerequisites": "Fate 5 (Fate 9 for the second selection)", "repeatable": true, "paramsSchema": [{"key": "type", "label": "Magic Type", "options": ["Blood Magic", "Elementalism", "Sorcery"]}]}'
  ),
  (
    'Stealthy',
    'Whenever this warrior is on or within 1" of terrain with the Cover keyword, they count as Hidden. If they lose the Hidden condition for any reason, they cannot regain Hidden from that same piece of terrain until they have become Hidden by a different piece of terrain with the Cover keyword.',
    '{"prerequisites": "Offense 5 and Tactics 6", "repeatable": false}'
  ),
  (
    'Surprise',
    'Whenever this warrior attacks an enemy while Hidden, they gain Supremacy for that attack.',
    '{"prerequisites": "Tactics 5", "repeatable": false}'
  )
) as v(name, description, stats);
