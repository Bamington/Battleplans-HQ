-- ============================================================
-- BattleCards — add Kill Team game + addon types
-- Paste this into the Supabase SQL editor and run it.
--
-- Adds:
--   • games row              — slug 'kill-team' with the operative stat_schema
--   • addon_types row        — slug 'weapons'   for Kill Team
--   • addon_types row        — slug 'abilities' for Kill Team
-- ============================================================

-- ── Game row ─────────────────────────────────────────────────────────────────

insert into public.games (name, slug, stat_schema, print_size, bleed_size) values (
  'Kill Team',
  'kill-team',
  '[
    {"key": "role",     "label": "Role",     "type": "text"},
    {"key": "teamName", "label": "Team Name","type": "text"},
    {"key": "tags",     "label": "Tags",     "type": "text"},
    {"key": "actions",  "label": "A",        "type": "number"},
    {"key": "movement", "label": "M",        "type": "number"},
    {"key": "save",     "label": "S",        "type": "number"},
    {"key": "wounds",   "label": "W",        "type": "number"},
    {"key": "baseSize", "label": "Base Size","type": "number"}
  ]'::jsonb,
  '[127, 89]'::jsonb,
  '[133, 95]'::jsonb
);

-- ── Addon types ──────────────────────────────────────────────────────────────

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Weapons', 'weapons',
  '[
    {"key": "meleeOrRanged", "label": "Melee or Ranged", "type": "text"},
    {"key": "attack",        "label": "Attack",          "type": "number"},
    {"key": "hit",           "label": "Hit",             "type": "number"},
    {"key": "baseDamage",    "label": "Base Damage",     "type": "number"},
    {"key": "critDamage",    "label": "Crit Damage",     "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';

insert into public.addon_types (game_id, name, slug, stat_schema)
select id, 'Abilities', 'abilities',
  '[
    {"key": "apCost", "label": "AP Cost", "type": "number"}
  ]'::jsonb
from public.games where slug = 'kill-team';
