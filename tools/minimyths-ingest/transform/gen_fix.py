"""Emit an UPDATE-only corrective script for section rows whose content changed.

Reads the live rows, diffs against the regenerated plan, and writes upserts for
the difference only. Touches no pack, segment or schedule row.
"""
import json, os, sys, uuid
H = os.path.dirname(os.path.abspath('gen_fix.py'))
NS = uuid.UUID('6f9b1d2c-8a4e-4c3b-9f71-2d5e8a0c4b16')
uid = lambda *p: str(uuid.uuid5(NS, '|'.join(str(x) for x in p)))
plan = json.load(open(os.path.join(H, 'plan.json')))
live = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/cats.json'))
prod = {(r['pack_id'], r['category_key']): r['content'] for r in live}

L = ["-- Corrective update for section content only. Touches no pack, segment or",
     "-- schedule row. Safe to re-run: every statement is an upsert.",
     "--",
     "-- Four extraction defects, all found by reading the imported rows back out",
     "-- of production rather than from the local plan:",
     "--   1. A Prizes block naming each prize as a '#' sub-heading collapsed into",
     "--      one item titled 'Prize pool'.",
     "--   2. Markdown markers (###, **, >) leaked into jsonb section values.",
     "--   3. The same prize was collected twice where an outer section and its",
     "--      own sub-heading both matched the Prizes anchor.",
     "--   4. A heading with no prose of its own ('Rewards, Prizes, and",
     "--      Giveaways') became an empty-bodied prize instead of a container.",
     "", "begin;", ""]
n = 0
for p in plan:
    pid = uid('pack', p['notion_id'])
    for key, content in sorted(p['sections'].items()):
        if prod.get((pid, key)) == content:
            continue
        n += 1
        j = json.dumps(content, ensure_ascii=False).replace("'", "''")
        L += [f"-- {p['pack']['name']} :: {key}",
              "insert into public.battlepack_categories (pack_id, category_key, hidden, content)",
              f"select '{pid}', '{key}', false, '{j}'::jsonb",
              f"where exists (select 1 from public.battlepacks where id = '{pid}')",
              "on conflict (pack_id, category_key) do update set content = excluded.content;", ""]
L += ["commit;", "",
      "-- verification, expect 0:",
      "-- select count(*) from public.battlepack_categories",
      "--   where content::text ~ '#{2,6} ' or content::text like '%**%';"]
open(os.path.join(H, 'fix_sections.sql'), 'w').write('\n'.join(L) + '\n')
print(f'{n} section rows changed -> fix_sections.sql')
