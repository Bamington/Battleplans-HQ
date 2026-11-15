-- Halo Flashpoint: per-list points limit (default 200, set by tapping the
-- Points badge) and at most one unit with the Legendary keyword.
-- Data-only update of games.list_rules.
update public.games
set list_rules = '{
  "settings": [
    { "key": "pointsLimit", "label": "Maximum Points", "default": 200, "min": 1, "max": 999, "resource": "points" }
  ],
  "resources": [
    { "key": "units",     "label": "Units",     "source": "count", "cardTypes": ["operative"] },
    { "key": "points",    "label": "Points",    "source": { "stat": "pointsCost" }, "cardTypes": ["operative"] },
    { "key": "legendary", "label": "Legendary", "source": "count", "cardTypes": ["operative"], "hasKeyword": "Legendary", "hidden": true }
  ],
  "rules": [
    { "type": "track", "resource": "units" },
    { "type": "max", "resource": "points", "limit": { "setting": "pointsLimit" }, "severity": "error" },
    { "type": "max", "resource": "legendary", "limit": 1, "severity": "error",
      "message": "Only one Legendary unit is allowed per list" }
  ]
}'::jsonb
where slug = 'halo-flashpoint';
