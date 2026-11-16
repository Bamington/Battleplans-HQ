"""Emit an UPDATE-only script setting battlepacks.description."""
import json, os, sys, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath('gen_descriptions.py')))
import descriptions as D

NS = uuid.UUID('6f9b1d2c-8a4e-4c3b-9f71-2d5e8a0c4b16')
uid = lambda *p: str(uuid.uuid5(NS, '|'.join(str(x) for x in p)))
q = lambda v: 'null' if not v else "'" + str(v).replace("'", "''") + "'"

plan = json.load(open('plan.json'))
desc, src = D.build()

L = ["-- Set battlepacks.description on the imported archive packs.",
     "--",
     "-- The original import never wrote this column at all. Text comes from the",
     "-- event body: the lead paragraphs before the first heading, or, for pages",
     "-- that open with a results table, the blurb under their own Description /",
     "-- Overview heading.",
     "--",
     "-- The Notion 'Event Information' property is deliberately NOT used: it holds",
     "-- the mini-myths.com URL, and a bare link is not a description.",
     "--",
     f"-- {src['body']} packs get text; {src['none']} have none anywhere in Notion and stay null.",
     "-- Only non-null values are written, so this never blanks a description",
     "-- someone has since typed. Safe to re-run.",
     "", "begin;", ""]
n = 0
for p in plan:
    d = desc.get(p['notion_id'])
    if not d:
        continue
    n += 1
    L += [f"-- {p['pack']['name']}",
          "update public.battlepacks",
          f"   set description = {q(d)}",
          f" where id = '{uid('pack', p['notion_id'])}'",
          "   and description is null;", ""]
L += ["commit;", "",
      f"-- verification, expect {n}:",
      "-- select count(*) from public.battlepacks",
      "--   where host_location_id = '53809c67-b6a5-4ebc-8941-9c14da626d5a'",
      "--     and description is not null;"]
open('fix_descriptions.sql', 'w').write('\n'.join(L) + '\n')
print(f'{n} descriptions -> fix_descriptions.sql')
