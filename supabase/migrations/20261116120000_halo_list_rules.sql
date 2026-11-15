-- Halo Flashpoint list rules: count units and total their points (stats.pointsCost).
-- Track only, no limit yet. Data-only update; schema from 20261115170000_list_rules.
update public.games
set list_rules = '{
  "resources": [
    { "key": "units",  "label": "Units",  "source": "count", "cardTypes": ["operative"] },
    { "key": "points", "label": "Points", "source": { "stat": "pointsCost" }, "cardTypes": ["operative"] }
  ],
  "rules": [
    { "type": "track", "resource": "units" },
    { "type": "track", "resource": "points" }
  ]
}'::jsonb
where slug = 'halo-flashpoint';
