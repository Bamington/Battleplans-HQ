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

MINI_MYTHS_CLUB = '53809c67-b6a5-4ebc-8941-9c14da626d5a'

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
    _last_override = None
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

    # ---- schedule items. The schema stores DURATION, not clock time: migration
    # 20260728010000 dropped starts_at/ends_at from items because a round is
    # "two hours" and where it lands follows from the anchor plus what precedes
    # it. So convert to a contiguous duration chain.
    #
    # Each duration is taken from the gap to the NEXT item's start, which makes
    # every derived start time exactly match the source. Where the source states
    # an end AND the next item starts later, that gap is emitted as its own
    # break item rather than being absorbed into the preceding one -- inflating
    # a round from 100 to 150 minutes would misstate the round.
    def _m(t):
        h, mi = t.split(':'); return int(h) * 60 + int(mi)

    items, defaulted = [], False
    for i, it in enumerate(sched):
        nxt = sched[i + 1] if i + 1 < len(sched) else None
        own = _m(it['end']) - _m(it['start']) if it['end'] else None
        if nxt:
            span = _m(nxt['start']) - _m(it['start'])
            dur = own if own is not None else span
            gap = span - dur
        else:
            dur, gap = (own if own is not None else 60), 0
            if own is None:
                defaulted = True
        items.append({'ordinal': len(items) + 1, 'kind': it['kind'],
                      'label': it['label'], 'duration_minutes': max(dur, 0),
                      'segment': 1})
        if gap > 0:
            items.append({'ordinal': len(items) + 1, 'kind': 'break',
                          'label': 'Break', 'duration_minutes': gap,
                          'segment': 1, 'generated': True})
    if defaulted:
        notes.append(('DURATION-DEFAULTED', r['name'],
                      f"final item {sched[-1]['label']!r} has no end time -> 60 min"))

    # segment end follows the chain, so it cannot contradict the timetable
    if first and items:
        _end = _m(first) + sum(i['duration_minutes'] for i in items)
        if _end < 24 * 60:
            for _s in segs:
                _s['ends_at'] = '%02d:%02d' % (_end // 60, _end % 60)

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
            # timeline IN ('one-day','multi-day','league');
            # schedule_shape IN ('days','periods'). A league's run and a painting
            # competition's submission window are PERIODS, not consecutive days.
            'timeline': ('league' if r['is_league'] else
                         'multi-day' if r['ends_on'] or len(segs) > 1 else 'one-day'),
            'schedule_shape': ('days' if (len(segs) > 1 or not r['ends_on'])
                               and not r['is_league'] else 'periods'),
            'recurrence': 'none',
            # The club running the event, as distinct from location_id, which is
            # only ever where it happened. Every event in this archive is a Mini
            # Myths event -- that is the filter the snapshot was taken under --
            # and the read policy grants access via EITHER side, so leaving this
            # null hides all 89 packs from the club's own admins.
            'host_location_id': MINI_MYTHS_CLUB,
            'starts_on': r['starts_on'],
            '_ends_on': r['ends_on'],
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
