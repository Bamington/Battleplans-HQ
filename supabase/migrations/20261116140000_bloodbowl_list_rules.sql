-- Blood Bowl list rules: total team value in GP from each player's cost.
-- Tracking only, no maximum. Data-only update of games.list_rules.
update public.games
set list_rules = '{
  "resources": [
    { "key": "gp", "label": "GP", "source": { "stat": "cost" }, "cardTypes": ["operative"], "grouping": true }
  ],
  "rules": [
    { "type": "track", "resource": "gp" }
  ]
}'::jsonb
where slug = 'blood-bowl';
