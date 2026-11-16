"""Extract Prizes / What to Bring / Resources / FAQ from event bodies.

Each target has a jsonb shape fixed by its Form component in the category
registry, so extraction is per-shape, not generic.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath('sections.py'))
R = lambda *p: os.path.join(HERE, '..', *p)

HEAD = re.compile(r'^\s{0,3}(?P<h>#{1,6})\s*(?P<t>.+?)\s*$')
BOLD = re.compile(r'^\s*\*\*(?P<t>[^*]+?)\*\*:?\s*$')
BULLET = re.compile(r'^\s*[-*+•]\s+(?P<t>.+)$')
BOOKMARK = re.compile(r'<(?:bookmark|file|image)\s+source="(?P<u>[^"]+)"')
MDLINK = re.compile(r'\[(?P<t>[^\]]*)\]\((?P<u>[^)]+)\)')
BAREURL = re.compile(r'https?://[^\s<>")]+')

ANCHORS = {
    'prizes':         re.compile(r'^(prizes?|prizing|prize support|terrain raffle|'
                                 r'judging criteria|awards?)\b', re.I),
    'what-to-bring':  re.compile(r"^(what you'?ll need|what you will need|"
                                 r'what to bring|painting requirements|'
                                 r'your (kill team|army|list))\b', re.I),
    'resources':      re.compile(r'^(rules documents?|resources?|'
                                 r'(the )?players? pack)\b', re.I),
    'faq':            re.compile(r'^(faqs?|frequently asked)\b', re.I),
}


def _level(raw):
    m = HEAD.match(raw)
    if m:
        return len(m.group('h')), m.group('t')
    m = BOLD.match(raw)
    if m:
        return 99, m.group('t')
    return None, None


def _blocks(lines, rx):
    """Every run of lines under a heading matching rx."""
    out = []
    for i, raw in enumerate(lines):
        lv, title = _level(raw)
        if lv is None or not rx.match(_plain(title)):
            continue
        body = []
        for raw2 in lines[i + 1:]:
            lv2, _ = _level(raw2)
            if lv2 is not None and lv2 <= lv:
                break
            body.append(raw2)
        out.append((_plain(title), body))
    return out


TOGGLE = re.compile(r'^\s*TOGGLE-[QA]\s*:\s*', re.I)


def _plain(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = TOGGLE.sub('', s)
    s = MDLINK.sub(r'\1', s)
    s = re.sub(r'[*_`\\]+', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def _url(raw):
    m = BOOKMARK.search(raw) or MDLINK.search(raw)
    if m:
        u = m.group('u')
        return u if u.startswith('http') else None
    m = BAREURL.search(re.sub(r'<[^>]+>', ' ', raw))
    return m.group(0) if m else None


def _items(body):
    """Bullet lines, each with any URL that belongs to it."""
    out = []
    for raw in body:
        m = BULLET.match(raw)
        if not m:
            continue
        t = _plain(m.group('t'))
        if t:
            out.append((t, _url(raw)))
    return out


def _paras(body):
    """Non-bullet, non-blank prose lines."""
    return [(_plain(r), _url(r)) for r in body
            if r.strip() and not BULLET.match(r) and _plain(r)]


def _is_just_url(t):
    return bool(t) and not re.sub(r'https?://\S+', '', t).strip(' \u2013\u2014-:,.')


def _strip_urls(t):
    t = re.sub(r'https?://\S+', '', t or '')
    return re.sub(r'\s+', ' ', t).strip(' \u2013\u2014-:,.')


def _tidy(t):
    return re.sub(r'[\s,;]+$', '', t).strip()


def _split_titled(t):
    """'Best Painted: voted by players' -> ('Best Painted', 'voted by players')

    Only splits on a separator OUTSIDE brackets: a prize like
    "Coolest Lore (write a paragraph - judged by the TO)" is one prize.
    """
    depth, best = 0, None
    for i, ch in enumerate(t):
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth = max(0, depth - 1)
        elif depth == 0:
            for sep in (' — ', ' – ', ': ', ' - '):
                if t.startswith(sep, i) and 0 < i <= 60:
                    best = (i, len(sep)); break
            if best:
                break
    if best:
        i, n = best
        return _tidy(t[:i].strip(' :–—-')), _tidy(t[i + n:])
    return _tidy(t), ''


def extract(text):
    lines = text.splitlines()
    got = {}

    # ---- prizes: titled list {items:[{title,description,url?}]}
    items = []
    for title, body in _blocks(lines, ANCHORS['prizes']):
        bl = _items(body)
        if bl:
            for t, u in bl:
                a, b = _split_titled(t)
                items.append({'title': a, 'description': _strip_urls(b), **({'url': u} if u else {})})
        else:
            # a prose-only Prizes section: keep the heading as the title
            pr = _paras(body)
            if pr:
                generic = re.match(r'^(prizes?|prizing|prize support|awards?)$',
                                   title.rstrip(':'), re.I)
                items.append({'title': 'Prize pool' if generic else title.rstrip(':'),
                              'description': ' '.join(p for p, _ in pr)[:600]})
    if items:
        got['prizes'] = {'items': items}

    # ---- what to bring: checklist {items:[{text,url?}]}
    items = []
    for _, body in _blocks(lines, ANCHORS['what-to-bring']):
        for t, u in _items(body):
            items.append({'text': _tidy(t), **({'url': u} if u else {})})
    if items:
        got['what-to-bring'] = {'items': items}

    # ---- resources: titled list, URL-bearing only (a resource without a link
    #      is not a resource)
    items = []
    for title, body in _blocks(lines, ANCHORS['resources']):
        pending = None
        for raw in body:
            if not raw.strip():
                continue
            m = BULLET.match(raw)
            txt = _plain(m.group('t')) if m else _plain(raw)
            u = _url(raw)
            if not u:
                # a label with no link of its own: remember it for the next URL
                if txt and len(txt) <= 120:
                    pending = txt.rstrip(':')
                continue
            a, b = _split_titled(txt)
            # when the line is nothing but its own URL, the label is above it
            if _is_just_url(a):
                a, b = (pending or title.rstrip(':')), ''
            items.append({'title': a, 'description': _strip_urls(b), 'url': u})
            pending = None
    # dedupe on url
    seen, ded = set(), []
    for it in items:
        if it['url'] not in seen:
            seen.add(it['url']); ded.append(it)
    if ded:
        got['resources'] = {'items': ded}

    # ---- faq: {items:[{question,answer}]}
    items = []
    for _, body in _blocks(lines, ANCHORS['faq']):
        q, acc = None, []
        for raw in body:
            lv, t = _level(raw)
            cand = _plain(t) if lv is not None else None
            if not cand:
                m = BULLET.match(raw)
                txt = _plain(m.group('t')) if m else _plain(raw)
                if txt.endswith('?') and len(txt) < 200:
                    cand = txt
                else:
                    if txt:
                        acc.append(txt)
                    continue
            if q:
                items.append({'question': q, 'answer': ' '.join(acc).strip()[:1000]})
            q, acc = cand, []
        if q:
            items.append({'question': q, 'answer': ' '.join(acc).strip()[:1000]})
    items = [i for i in items if i['question'] and i['answer']]
    if items:
        got['faq'] = {'items': items}

    return got


if __name__ == '__main__':
    cls = {}
    for l in open(R('maps', 'classification.tsv')).read().splitlines()[1:]:
        if l.strip():
            p = l.split('\t'); cls[p[0]] = p[1]
    tally, allout = {}, {}
    for fn in sorted(os.listdir(R('bodies'))):
        pid = fn[:-3]
        g = extract(open(R('bodies', fn)).read())
        allout[pid] = g
        for k, v in g.items():
            tally[k] = tally.get(k, 0) + 1
    json.dump(allout, open(R('transform', 'sections.json'), 'w'), indent=1)
    print('packs with each section:')
    for k, v in sorted(tally.items()):
        print(f'   {k:<16} {v}')
    want = sys.argv[1] if len(sys.argv) > 1 else None
    if want:
        for pid, g in allout.items():
            if want.lower() in cls.get(pid, '').lower():
                print(f'\n=== {cls[pid]}')
                print(json.dumps(g, indent=1, ensure_ascii=False))
