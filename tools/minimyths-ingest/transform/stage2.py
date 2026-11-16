"""staging.json -> full insert plan: packs, segments, schedule items, sections."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath('stage2.py')))
import schedule as S

R = lambda *p: os.path.join(os.path.dirname(os.path.abspath('stage2.py')), '..', *p)
recs = json.load(open(R('transform', 'staging.json')))

# Two-day tournaments get a segment per day. Everything else that spans dates is
# a window (a league's run, a painting competition's submission period), which is
# exactly what a single segment's starts_on/ends_on pair is for.
TWO_DAY = {'Arcpoint 2025', 'Duel of the Fates 2025', 'Duel of the Fates 2026'}

def _dayafter(d):
    import datetime
    return (datetime.date.fromisoformat(d) + datetime.timedelta(days=1)).isoformat()

# the live mini-myths.com URLs are the only slugs that must not change
SLUG_FIX = {}   # name -> slug, for collisions

seen, plan, notes = {}, [], []
for r in recs:
    s = r['slug']
    if s in seen:
        # disambiguate the later event by year; neither colliding pack has a
        # live public URL, so nothing breaks.
        yr = (r['starts_on'] or '')[:4]
        r['slug'] = f'{s}-{yr}'
        SLUG_FIX[r['name'] + ' @ ' + str(r['starts_on'])] = r['slug']
        notes.append(('SLUG-DISAMBIGUATED', r['name'], f"{s} -> {r['slug']} (collides with {seen[s]})"))
    seen.setdefault(s, f"{r['name']} @ {r['starts_on']}")

    sched = r['schedule']
    first = sched[0]['start'] if sched else None
    last  = None
    if sched:
        tail = sched[-1]
        last = tail['end'] or tail['start']

    # ---- segments
    segs = []
    if r['name'] in TWO_DAY and r['ends_on']:
        segs = [
            {'ordinal': 1, 'starts_on': r['starts_on'], 'ends_on': None,
             'starts_at': first, 'ends_at': last, 'label': 'Day 1'},
            {'ordinal': 2, 'starts_on': r['ends_on'], 'ends_on': None,
             'starts_at': first, 'ends_at': last, 'label': 'Day 2'},
        ]
    else:
        segs = [{'ordinal': 1, 'starts_on': r['starts_on'], 'ends_on': r['ends_on'],
                 'starts_at': first, 'ends_at': last, 'label': None}]

    # ---- schedule items: all on segment 1 (the source gives one timetable)
    items = [{'ordinal': i + 1, 'kind': it['kind'], 'label': it['label'],
              'starts_at': it['start'], 'ends_at': it['end'], 'segment': 1}
             for i, it in enumerate(sched)]

    # ---- sections derived from Notion PROPERTIES (no body parsing, so these
    #      are exact). SectionForm shape is {body, url}.
    sections = {}
    price = r['price']
    if r['ticket_url'] or (price or 0) > 0:
        if price:
            body = f"Tickets were ${price:g} per player."
            if r['ticket_url']:
                body += ' They were sold at the link below.'
        else:
            body = 'Tickets were sold at the link below.'
        sections['tickets'] = {'body': body, 'url': r['ticket_url'] or None}
    elif price == 0:
        notes.append(('FREE-EVENT', r['name'], 'price 0, no ticket link -> no Tickets section'))
    if r['reg_url']:
        sections['registration'] = {
            'body': 'Registration for this event was handled at the link below.',
            'url': r['reg_url']}

    plan.append({
        'notion_id': r['notion_id'],
        'pack': {
            'name': r['name'], 'slug': r['slug'], 'status': 'published',
            'game_id': r['game_id'], 'location_id': r['location_id'],
            'format': r['format'],
            'timeline': 'one-day' if len(segs) == 1 and not r['ends_on'] else 'multi-day',
            'schedule_shape': 'days',
            'recurrence': 'none',
        },
        'segments': segs,
        'items': items,
        'sections': sections,
        'meta': {'is_league': r['is_league'], 'sched_class': r['sched_class'],
                 'body_class': r['body_class'], 'host': r['host'],
                 'event_type': r['event_type'], 'game_name': r['game_name'],
                 'location_name': r['location_name']},
    })

json.dump(plan, open(R('transform', 'plan.json'), 'w'), indent=1)

print(f'{len(plan)} packs planned -> plan.json\n')
print(f"  segments total        : {sum(len(p['segments']) for p in plan)}")
print(f"  schedule items total  : {sum(len(p['items']) for p in plan)}")
print(f"  packs with items      : {sum(1 for p in plan if p['items'])}")
print(f"  tickets sections      : {sum(1 for p in plan if 'tickets' in p['sections'])}")
print(f"  registration sections : {sum(1 for p in plan if 'registration' in p['sections'])}")
print(f"  2-segment packs       : {sum(1 for p in plan if len(p['segments']) > 1)}")
print(f"  packs with no date    : {sum(1 for p in plan if not p['segments'][0]['starts_on'])}")
if notes:
    print('\n--- notes ---')
    for k, a, b in notes:
        print(f'  [{k}] {a}: {b}')
