"""Snapshot + maps -> typed staging records for the BattlePack import."""
import json, os, re, sys, unicodedata
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath('build.py')))
import schedule as S

HERE = os.path.dirname(__file__)
R    = lambda *p: os.path.join(HERE, '..', *p)

events = json.load(open(R('raw', 'events.json')))
cls    = {}
for l in open(R('maps', 'classification.tsv')).read().splitlines()[1:]:
    if l.strip():
        p = l.split('\t'); cls[p[0]] = {'name': p[1], 'body': p[2], 'sched': p[3]}

def _cols(path):
    rows = []
    for l in open(R('maps', path)).read().splitlines()[1:]:
        if l.strip():
            rows.append([c.strip() for c in l.split('\t')])
    return rows

# games.map.tsv: events | notion_game_id | notion_game | game_id | bp_game | verified | note
GAMES = {r[1]: r[3].lower() for r in _cols('games.map.tsv') if len(r) > 3 and r[3]}
GAME_NAME = {r[1]: r[2] for r in _cols('games.map.tsv') if len(r) > 2}

# locations.map.tsv is keyed by NOTION NAME: events | notion_location | addr | status | location_id
LOC_BY_NAME = {r[1]: r[4].lower() for r in _cols('locations.map.tsv')
               if len(r) > 4 and r[4]}

# the 5 venues created by migration 20261116120000, same keying
LOC_BY_NAME.update({
    'Gaming Arena':                  '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b401',
    'Games Portal':                  '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b402',
    "Andrew's Hobbies":              '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b403',
    'Arcfest (Sandown Racecourse)':  '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b404',
    'Arndell Park Community Center': '9f1c2a7e-4b83-4d16-9a5e-0c2f81d6b405',
})

# notion location page id -> notion name
NLOC = {d['id']: d['name'] for d in json.load(open(R('raw', 'notion_locations.json')))}
NGAME = {}
for l in open(R('raw', 'notion_games.tsv')).read().splitlines():
    if '\t' in l:
        a, b = l.split('\t', 1); NGAME[a.strip()] = b.strip()

OTHER_GAME = 'f8906f05-5a28-4af0-8ffa-be293e96cba8'

def _first_id(v):
    """events.json holds relation properties as a JSON array of page ids."""
    if not v:
        return None
    try:
        a = json.loads(v) if isinstance(v, str) else v
    except Exception:
        return None
    if isinstance(a, list) and a:
        return str(a[0]).replace('-', '').split('/')[-1]
    return None

SLUG_ALIASES = {}  # pack slugs are from the event name, not the game art map

def slugify(v):
    v = unicodedata.normalize('NFKD', v).encode('ascii', 'ignore').decode()
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', v.lower().replace("'", '')))

RESERVED = {'app','login','logout','auth','gallery','admin','api',
            'reset-password','assets','public','static'}

# the four live mini-myths.com URLs that are NOT slugify(name)
SLUG_OVERRIDE = {
    'Mayhem of Mustafar':            'mayhem-of-mustafar',
    'Operation: Mini Mythmas':       'operation-march-minimythmas',
    'Casual Casualties':             'april-casual-casualties',
    'Fumble Rumble I':               'fumble-rumble-i',
}

LEAGUE_SCHED = {'league-weeks', 'league-fortnight', 'league-months'}

out, report = [], []
for e in events:
    pid  = e['id']
    c    = cls.get(pid, {'name': e['name'], 'body': '?', 'sched': 'none'})
    name = e['name']

    # ---- dates. The Start RANGE end is authoritative; the End property is a
    # stale leftover on most rows (proved against 4 bodies).
    starts_on = (e.get('start') or '')[:10] or None
    rng_end   = (e.get('start_end') or '')[:10] or None
    prop_end  = (e.get('end_prop') or '')[:10] or None
    ends_on, end_src = (rng_end, 'start-range') if rng_end else \
                       ((prop_end, 'end-prop') if prop_end else (None, None))
    if ends_on and starts_on and ends_on < starts_on:
        report.append(('END-BEFORE-START', name, f'{ends_on} < {starts_on} (from {end_src}) -> dropped'))
        ends_on, end_src = None, None
    if ends_on == starts_on:
        ends_on = None   # one-day events keep a NULL ends_on (envelope flip)

    # ---- game
    gnid  = _first_id(e.get('game'))
    gname = NGAME.get(gnid) or GAME_NAME.get(gnid) or ''
    gid   = GAMES.get(gnid) or OTHER_GAME
    if gnid and gnid not in GAMES:
        report.append(('GAME-FALLBACK', name, f'{gname or gnid!r} -> Other'))
    if not gnid:
        report.append(('GAME-MISSING', name, 'no Game relation -> Other'))

    # ---- location
    lnid  = _first_id(e.get('loc'))
    lname = NLOC.get(lnid, '')
    lid   = LOC_BY_NAME.get(lname)
    if lnid and not lid:
        report.append(('LOC-UNMAPPED', name, lname or lnid))
    if not lnid:
        report.append(('LOC-MISSING', name, 'no Location relation'))

    # ---- slug
    slug = SLUG_OVERRIDE.get(name) or slugify(name)
    if slug in RESERVED or not re.match(r'^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$', slug):
        report.append(('SLUG-INVALID', name, slug))

    # ---- schedule
    bodyp = R('bodies', pid + '.md')
    rows  = S.parse(open(bodyp).read()) if os.path.exists(bodyp) else []
    for r in rows:
        if r['fixed']:
            report.append(('TIME-REPAIRED', name, f"{r['label']}: source {r['fixed']} -> {r['start']}"))

    is_league = c['sched'] in LEAGUE_SCHED or (e.get('type') or '') == 'Campaign / League'

    out.append({
        'notion_id': pid, 'name': name, 'slug': slug,
        'game_id': gid, 'game_name': gname, 'notion_game_id': gnid,
        'location_id': lid, 'location_name': lname, 'notion_loc_id': lnid,
        'starts_on': starts_on, 'ends_on': ends_on, 'ends_on_source': end_src,
        'format': (e.get('format') or '').strip() or None,
        'price': e.get('price'),
        'ticket_url': (e.get('ticket') or '').strip() or None,
        'reg_url': (e.get('reg') or '').strip() or None,
        'host': (e.get('host') or '').strip() or None,
        'event_type': (e.get('type') or '').strip() or None,
        'is_league': is_league,
        'body_class': c['body'], 'sched_class': c['sched'],
        'schedule': [{k: r[k] for k in ('start', 'end', 'label', 'kind')} for r in rows],
    })

# ---- slug collisions
seen = {}
for r in out:
    seen.setdefault(r['slug'], []).append(r['name'])
for s, names in seen.items():
    if len(names) > 1:
        report.append(('SLUG-COLLISION', s, ' | '.join(names)))

json.dump(out, open(R('transform', 'staging.json'), 'w'), indent=1)

print(f'{len(out)} records -> staging.json\n')
print(f"  with parsed schedule : {sum(1 for r in out if r['schedule'])}")
print(f"  leagues              : {sum(1 for r in out if r['is_league'])}")
print(f"  multi-day (ends_on)  : {sum(1 for r in out if r['ends_on'])}")
print(f"  no location mapped   : {sum(1 for r in out if not r['location_id'])}")
print(f"  game = Other         : {sum(1 for r in out if r['game_id'] == OTHER_GAME)}")
print(f"\n--- {len(report)} items needing attention ---')" if False else f"\n--- {len(report)} items needing attention ---")
for kind in sorted({r[0] for r in report}):
    print(f'\n[{kind}]')
    for k, a, b in report:
        if k == kind:
            print(f'   {a:<38} {b}')
