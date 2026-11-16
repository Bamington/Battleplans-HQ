"""Event description ("About") for each pack.

Source order:
  1. the body's intro prose -- everything before the first heading
  2. the Notion "Event Information" property
  3. nothing; 46 of the 89 have no text anywhere and stay null
"""
import json, os, re, sys

H = os.path.dirname(os.path.abspath('descriptions.py'))
R = lambda *p: os.path.join(H, '..', *p)

HEADING = re.compile(r'^\s{0,3}#{1,6}\s')
BOLDLINE = re.compile(r'^\s*\*\*[^*]+\*\*:?\s*$')
BLOCK = re.compile(r'^\s*<(bookmark|file|image|callout|table-of-contents|columns|column|p\s*/)', re.I)


KEYINFO = re.compile(r'^(date|ticket price|price|cost|format|time|venue|location|'
                     r'tickets?|when|where)\s*:', re.I)


def _plain(ln):
    s = re.sub(r'<!--.*?-->', ' ', ln)           # comments, mine included
    s = re.sub(r'^\s{0,3}>\s*', '', s)           # blockquote marker
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)       # link -> text
    s = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', s)           # images out
    s = s.replace('\\:', ':').replace('\\-', '-').replace('\\*', '*')
    s = re.sub(r'[*_`]{1,3}', '', s)
    s = re.sub(r'^\s*[-*+•]\s*', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def from_body(md: str) -> str:
    """The lead paragraphs: what the organiser says before the detail starts."""
    out = []
    for raw in md.splitlines():
        if HEADING.match(raw) or BOLDLINE.match(raw):
            if out:
                break
            continue          # a title above the intro is not the intro
        if BLOCK.match(raw.strip()):
            if out:
                break
            continue
        t = _plain(raw)
        if t and not KEYINFO.match(t):
            out.append(t)
        elif out and len(' '.join(out)) > 140:
            break             # a blank line after enough text ends the lead
    text = ' '.join(out).strip()
    # a lead that is only a stray bullet or a date line is not a description
    return text if len(text) >= 40 else ''


DESC_HEAD = re.compile(r'^(background|the story|lore|description|overview|about|'
                       r'the event|what is this)\b', re.I)
# Background first: on the Quar pages "Description" is a block of Date / Ticket
# price / Format lines, and the actual blurb sits under Background.
DESC_ORDER = ('background', 'the story', 'lore', 'description', 'overview', 'about')


def from_heading(md: str) -> str:
    """Some pages lead with a results table and put the blurb under its own
    'Description' / 'Overview' heading, so the intro rule cannot see it."""
    found = {}
    lines = md.splitlines()
    for i, raw in enumerate(lines):
        m = HEADING.match(raw) or BOLDLINE.match(raw)
        if not m:
            continue
        title = _plain(re.sub(r'^\s{0,3}#{1,6}\s*', '', raw))
        if not DESC_HEAD.match(title):
            continue
        lvl = len(raw) - len(raw.lstrip('# ').rstrip()) if False else raw.count('#', 0, 7)
        out = []
        for raw2 in lines[i + 1:]:
            if HEADING.match(raw2) or BOLDLINE.match(raw2):
                break
            if BLOCK.match(raw2.strip()):
                continue
            t = _plain(raw2)
            if t:
                out.append(t)
        out = [t for t in out if not KEYINFO.match(t)]
        text = ' '.join(out).strip()
        if len(text) >= 40:
            found.setdefault(title.lower().split()[0], text)
    for key in DESC_ORDER:
        for k, v in found.items():
            if k.startswith(key.split()[0]):
                return v
    return next(iter(found.values()), '')


def build():
    events = {e['id']: e for e in json.load(open(R('raw', 'events.json')))}
    plan = json.load(open(R('transform', 'plan.json')))
    out, src = {}, {'body': 0, 'info': 0, 'none': 0}
    for p in plan:
        pid = p['notion_id']
        bp = R('bodies', pid + '.md')
        md = open(bp).read() if os.path.exists(bp) else ''
        # A named Background/Description section is a stronger signal than the
        # page's leading prose, which on several pages is ticket or format
        # detail that belongs in its own category rather than in About.
        d = from_heading(md) or from_body(md)
        if d:
            src['body'] += 1
        else:
            # "Event Information" turned out to hold the mini-myths.com URL,
            # not prose. A bare link is not a description.
            d = _plain((events.get(pid, {}).get('info') or '').strip())
            if len(d) < 40 or re.match(r'^https?://\S+$', d):
                d = ''
            src['info' if d else 'none'] += 1
        out[pid] = d or None
    return out, src


if __name__ == '__main__':
    desc, src = build()
    print('sources:', src)
    plan = {p['notion_id']: p['pack']['name'] for p in json.load(open(R('transform', 'plan.json')))}
    long = sorted(((len(v or ''), plan[k], v) for k, v in desc.items()), reverse=True)
    print('\nlongest 3:')
    for n, name, v in long[:3]:
        print(f'  [{n:>4}] {name}\n        {v[:200]}...\n')
    print('shortest 5 that are not null:')
    for n, name, v in [x for x in long if x[0]][-5:]:
        print(f'  [{n:>4}] {name}: {v}')
