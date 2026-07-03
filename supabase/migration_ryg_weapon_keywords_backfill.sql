-- Backfill stats.keywords for existing RYG weapon addons.
-- Aggregates each weapon's addon_keywords rows into a comma-separated
-- string (e.g. "Brutal, Parry (2)") and stores it in stats->>'keywords'
-- so the AddAddonModal subtitle can display it without a join.
-- Weapons with no keywords get stats.keywords = null (unchanged behaviour).

update public.addons a
set stats = a.stats || jsonb_build_object('keywords', kw.keywords_str)
from (
  select
    a2.id as addon_id,
    string_agg(
      case
        when ak.params->>'X' is not null
          then k.name || ' (' || (ak.params->>'X') || ')'
        else k.name
      end,
      ', '
      order by ak.sort_order
    ) as keywords_str
  from public.addons a2
  join public.addon_types at2 on at2.id = a2.addon_type_id
  join public.games        g2  on g2.id  = at2.game_id
  left join public.addon_keywords ak on ak.addon_id  = a2.id
  left join public.keywords        k  on k.id         = ak.keyword_id
  where at2.slug = 'weapons'
    and g2.slug  = 'ryg'
  group by a2.id
) kw
where a.id = kw.addon_id;
