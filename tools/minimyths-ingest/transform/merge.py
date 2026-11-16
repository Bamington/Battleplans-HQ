"""Fold body-derived sections into plan.json and report anything for review."""
import json, os, re
H = os.path.dirname(os.path.abspath('merge.py'))
R = lambda *p: os.path.join(H, '..', *p)

plan = json.load(open(R('transform', 'plan.json')))
secs = json.load(open(R('transform', 'sections.json')))

flags = []
for p in plan:
    g = secs.get(p['notion_id'], {})
    for k, v in g.items():
        p['sections'][k] = v
    n = p['pack']['name']
    for it in g.get('prizes', {}).get('items', []):
        if len(it['title']) > 90:
            flags.append(('LONG-TITLE', n, f"prizes: {it['title'][:70]}…"))
    for it in g.get('resources', {}).get('items', []):
        if len(it['title']) > 90:
            flags.append(('LONG-TITLE', n, f"resources: {it['title'][:70]}…"))
    for it in g.get('faq', {}).get('items', []):
        if len(it['answer']) > 900:
            flags.append(('LONG-ANSWER', n, it['question'][:60]))

json.dump(plan, open(R('transform', 'plan.json'), 'w'), indent=1)

tot = {}
for p in plan:
    for k in p['sections']:
        tot[k] = tot.get(k, 0) + 1
print(f'{len(plan)} packs\n\nsections per category:')
for k in sorted(tot):
    print(f'   {k:<16} {tot[k]}')
print(f"\n  packs with >=1 section : {sum(1 for p in plan if p['sections'])}")
print(f"  packs with no section  : {sum(1 for p in plan if not p['sections'])}")
print(f"  total section rows     : {sum(len(p['sections']) for p in plan)}")
print(f"  schedule items         : {sum(len(p['items']) for p in plan)}")
print(f"  segments               : {sum(len(p['segments']) for p in plan)}")
if flags:
    print(f'\n--- {len(flags)} for your review ---')
    for k, a, b in flags:
        print(f'  [{k}] {a}: {b}')
