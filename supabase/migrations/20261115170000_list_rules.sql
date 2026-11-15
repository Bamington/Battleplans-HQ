-- List-level rules (points, unit caps, uniqueness) per game, with per-deck settings.
-- Additive only: two nullable/defaulted JSONB columns. Safe ahead of deploy.

alter table public.games
  add column if not exists list_rules jsonb;

alter table public.decks
  add column if not exists list_settings jsonb not null default '{}'::jsonb;

comment on column public.games.list_rules is
  'List building rules: { resources, rules, settings }. See apps/battlecards/src/lib/listRules.ts.';
comment on column public.decks.list_settings is
  'Per-deck values for games.list_rules settings, e.g. { "unitLimit": 5 }.';

-- Gundam Assemble: scenario unit cap (3 or 5), unique units unless Mass Produced,
-- exactly nine Tactics cards with one copy of each.
update public.games
set list_rules = '{
  "settings": [
    { "key": "unitLimit", "label": "Scenario size", "options": [3, 5], "default": 3, "suffix": "units" }
  ],
  "resources": [
    { "key": "units",   "label": "Units",   "source": "count", "cardTypes": ["operative"] },
    { "key": "tactics", "label": "Tactics", "source": "count", "cardTypes": ["rule"] }
  ],
  "rules": [
    { "type": "max",   "resource": "units",   "limit": { "setting": "unitLimit" }, "severity": "error" },
    { "type": "exact", "resource": "tactics", "limit": 9, "severity": "warning" },
    { "type": "unique", "cardTypes": ["operative"], "exemptStat": "mass_produced", "severity": "error",
      "message": "Only one copy of each unit, unless it is Mass Produced" },
    { "type": "unique", "cardTypes": ["rule"], "severity": "error",
      "message": "Only one copy of each Tactics card" }
  ]
}'::jsonb
where slug = 'gundam-assemble';

-- Torohachi (EX01-U02) is the launch Mass Produced unit. Flag every Gundam
-- Assemble copy: pack sources, library templates and deck cards.
update public.cards c
set stats = c.stats || '{"mass_produced": 1}'::jsonb
where c.name = 'Torohachi'
  and (
    c.game_id = (select id from public.games where slug = 'gundam-assemble')
    or c.deck_id in (select d.id from public.decks d
                     join public.games g on g.id = d.game_id
                     where g.slug = 'gundam-assemble')
  );
