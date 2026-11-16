"""Normalise free-text event schedules from Notion bodies into typed rows.

Design: there are 17 distinct schedule formats across the corpus, so this is a
normaliser, not a format matcher. Everything funnels through one time scanner
and one label cleaner.
"""
import re, sys, os, json

BODIES = os.path.join(os.path.dirname(__file__), '..', 'bodies')

# ---------------------------------------------------------------- block detect
HEADING    = re.compile(r'^\s{0,3}#{1,6}\s')
BOLD_ONLY  = re.compile(r'^\s*\*\*(?P<t>[^*]+)\*\*:?\s*$')
SCHED_HEAD = re.compile(r'(schedule|timetable|order of the day|event structure|'
                        r'rounds and point|timing|structure of the event|'
                        r'running of the day|the day)', re.I)
SCHED_CUE  = re.compile(r'round times as follows|with round times|order of the day|'
                        r'times? (?:are|will be) as follows', re.I)

# ---------------------------------------------------------------------- times
# h3 branch is constrained to [01]\d so that years (2024-2026) and point values
# cannot be read as 24h times. This is what corrupted Arcpoint 2026.
TIME = re.compile(
    r'(?<![\d:.])(?:'
    r'(?P<h1>\d{1,2}):(?P<m1>\d{2})\s*(?P<ap1>[ap]\.?m\.?)?'
    r'|(?P<h2>\d{1,2})\s*(?P<ap2>[ap]\.?m\.?)'
    r'|(?P<h3>[01]\d)(?P<m3>[0-5]\d)(?!\d)(?!\s*(?:p(?:oin)?ts?\b))'
    r')', re.I)

# BREAK is tested BEFORE ROUND: "Round 1 complete, let's go for lunch" is a break.
BREAK = re.compile(r'\blunch\b|\bbreak\b|\bdinner\b|\bfood\b|\bsupper\b', re.I)
# tested before ROUND so "Round 3 Ends, Prizes Handed Out" is an event
PRIZE = re.compile(r'\bprize|\baward|\bpresentation\b|\bwrap ?up\b|\bpack ?up\b|'
                   r'\braffle\b|\bwinners\b|\btidy ?up\b', re.I)
ROUND = re.compile(r'\b(round|game)\s*\d|\bround\b', re.I)
# trailing verbs that add nothing to a schedule label
TAILVERB = re.compile(r'[\s,:-]*\b(commences?|will begin|begins?|starts?)\b\s*$', re.I)

MAXWORDS = 8   # a schedule entry's label; anything longer is prose


def _clean(s: str) -> str:
    """Strip markdown noise but keep the words and the times."""
    s = s.replace('\\:', ':').replace('\\-', '-').replace('\\*', '*')
    s = re.sub(r'<[^>]+>', ' ', s)                       # inline html/bookmarks
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)       # links -> text
    s = re.sub(r'[*_`]+', '', s)                         # emphasis
    s = re.sub(r'^\s*[-*+•]\s*', '', s)                  # bullet
    s = re.sub(r'^\s*\|', '', s).replace('|', ' ')       # table pipes
    # 10.30am -> 10:30am  (no \b after \d{2}: "30am" has no boundary)
    s = re.sub(r'(?<=\d)\.(?=\d{2})', ':', s)
    return s.strip()


def _find_block(lines):
    """Return the run of lines that holds the schedule, or []."""
    for i, raw in enumerate(lines):
        ln = _clean(raw)
        is_head = bool(HEADING.match(raw)) or bool(BOLD_ONLY.match(raw))
        hit = (is_head and SCHED_HEAD.search(ln)) or SCHED_CUE.search(ln)
        if not hit:
            continue
        out = []
        for raw2 in lines[i + 1:]:
            if HEADING.match(raw2) and not SCHED_HEAD.search(_clean(raw2)):
                break
            out.append(raw2)
        if sum(1 for x in out if TIME.search(_clean(x))) >= 2:
            return out
    # fallback: no heading, but the doc has a contiguous run of entry-shaped lines
    out = [l for l in lines if _is_entry(_clean(l))]
    return out if len(out) >= 3 else []


def _is_entry(ln: str) -> bool:
    if not TIME.search(ln):
        return False
    label = TIME.sub(' ', ln)
    label = re.sub(r'[-–—:,.()\[\]/]+', ' ', label)
    words = [w for w in label.split() if w]
    return 0 < len(words) <= MAXWORDS or len(words) == 0


def _label(ln: str) -> str:
    s = TIME.sub('\x00', ln)
    s = re.sub(r'\x00\s*(?:to|until|till|through|[-–—:])\s*\x00', '\x00', s, flags=re.I)
    s = s.replace('\x00', ' ')
    s = re.sub(r'\s*[-–—]\s*', ' – ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^[\s–—:,.\-]+|[\s–—:,.\-]+$', '', s)
    s = TAILVERB.sub('', s)
    return s.strip()


def _kind(label: str) -> str:
    if BREAK.search(label):
        return 'break'
    if PRIZE.search(label):
        return 'event'
    if ROUND.search(label):
        return 'round'
    return 'event'


def _times(ln: str):
    """All times on the line, as (minutes, explicit_ampm)."""
    out = []
    for m in TIME.finditer(ln):
        if m.group('h3'):
            h, mi, ap = int(m.group('h3')), int(m.group('m3')), None
        elif m.group('h1'):
            h, mi, ap = int(m.group('h1')), int(m.group('m1')), m.group('ap1')
        else:
            h, mi, ap = int(m.group('h2')), 0, m.group('ap2')
        explicit = bool(ap) or (m.group('h3') is not None) or h > 12
        if ap:
            ap = ap[0].lower()
            if ap == 'p' and h != 12:
                h += 12
            elif ap == 'a' and h == 12:
                h = 0
        if h > 23 or mi > 59:
            continue
        out.append([h * 60 + mi, explicit])
    return out


def parse(text: str):
    block = _find_block(text.splitlines())
    rows, last = [], None
    for raw in block:
        ln = _clean(raw)
        if not _is_entry(ln):
            continue
        ts = _times(ln)
        if not ts:
            continue
        # afternoon rollover: only ever applied to BARE times, never to an
        # explicit am/pm or 24h value.
        for t in ts:
            if not t[1]:
                while last is not None and t[0] < last and t[0] + 720 <= 23 * 60 + 59:
                    t[0] += 720
            last = t[0]
        label = _label(ln)
        if not label:
            continue
        rows.append({
            '_s':    ts[0][0],
            '_e':    ts[1][0] if len(ts) > 1 else None,
            'label': label,
            'kind':  _kind(label),
            'fixed': None,
        })
    return _repair(rows)


def _repair(rows):
    """An explicit am/pm that sits out of order, but lands correctly 12h later,
    is a source typo (Jump To Jakku and Defense of Mandalore both carry the same
    '12:15 AM - Round 1 complete' template bug). Correct it and record it."""
    for i, r in enumerate(rows):
        prev = rows[i - 1]['_s'] if i else None
        nxt = rows[i + 1]['_s'] if i + 1 < len(rows) else None
        if prev is None or r['_s'] >= prev:
            continue
        cand = r['_s'] + 720
        if cand > prev and (nxt is None or cand <= nxt) and cand < 24 * 60:
            r['fixed'] = '%02d:%02d' % (r['_s'] // 60, r['_s'] % 60)
            r['_s'] = cand
    for r in rows:
        r['start'] = '%02d:%02d' % (r['_s'] // 60, r['_s'] % 60)
        r['end'] = '%02d:%02d' % (r['_e'] // 60, r['_e'] % 60) if r['_e'] is not None else None
    return rows


if __name__ == '__main__':
    cls = {}
    cp = os.path.join(os.path.dirname(__file__), '..', 'maps', 'classification.tsv')
    for l in open(cp).read().splitlines()[1:]:
        if l.strip():
            p = l.split('\t')
            cls[p[0]] = (p[1], p[3])
    want = sys.argv[1] if len(sys.argv) > 1 else None
    for fn in sorted(os.listdir(BODIES)):
        pid = fn[:-3]
        name, sched = cls.get(pid, ('?', '?'))
        if want and want.lower() not in name.lower():
            continue
        rows = parse(open(os.path.join(BODIES, fn)).read())
        if not rows and sched in ('none', 'image', 'league-weeks', 'league-fortnight', 'league-months'):
            continue
        flag = '' if rows else '   *** NOTHING PARSED ***'
        print(f'\n=== {name}  [{sched}]{flag}')
        for r in rows:
            e = f" – {r['end']}" if r['end'] else '      '
            fx = f"   !! source said {r['fixed']}" if r['fixed'] else ''
            print(f"    {r['start']}{e}  {r['kind']:<6} {r['label']}{fx}")
