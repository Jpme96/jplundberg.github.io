#!/usr/bin/env python3
"""CSS per page (Phase D 25, F4): moves the rules in styles.css that only one page uses into that page's own
stylesheet (cmd/<page>/page.css, linked right after styles.css on that page only).

    python3 cmd/split-css.py            show what would move (per page, kB)
    python3 cmd/split-css.py --write    move it

A rule moves when every class in its selector is used only by that page: the class name is found only in the
page's own scripts (its bundle in scripts.json "pages" and "late") and its own index.html – never in head/tail
scripts, the shared app, other pages or other pages' HTML. Rules without a class, keyframes, @font-face, the colour
tokens and anything in doubt stay in styles.css. @media blocks are split rule by rule (the moved rule keeps its
@media around it). Run the tests (`size`, `colors`, `softnav`, the page tests) after a move. """
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SJ = json.load(io.open(os.path.join(HERE, 'scripts.json')))
PAGES = [p for p in SJ['pages'] if p not in ('index.html', 'admin/index.html')]

def rd(p): return io.open(os.path.join(HERE, p), encoding='utf-8').read()

# whose each script is: a page's own when it is listed for that one page only (its bundle or its late part),
# never in head, tail or the settings bundle; everything else is "everywhere" (None)
own, where = {}, {}
for pg, fs in list(SJ['pages'].items()) + list(SJ.get('late', {}).items()):
    for f in fs: where.setdefault(f, set()).add(pg.split('/')[0] if '/' in pg else 'home')
for f, s0 in where.items(): own[f] = list(s0)[0] if len(s0) == 1 and list(s0)[0] not in ('home', 'admin') else None
for f in SJ['head'] + SJ['tail'] + SJ.get('settings', []): own[f] = None
SRC = {}
for d, ds, fs in os.walk(HERE):
    if any(x in d for x in (os.sep + 'dist', os.sep + 'node_modules', os.sep + 'words', os.sep + 'assets')): continue
    for f in fs:
        if f.endswith('.js') or f.endswith('.html'):
            rel = os.path.relpath(os.path.join(d, f), HERE)
            SRC[rel] = io.open(os.path.join(d, f), encoding='utf-8').read()
def owner_of(rel):
    if rel.endswith('index.html'):
        dd = rel.split('/')[0] if '/' in rel else None
        return dd if dd and dd + '/index.html' in SJ['pages'] and dd not in ('admin', 'home') else None
    return own.get(rel, None) if rel in own else None   # a file in no list (the shared app, tools): everywhere

CACHE = {}
def page_of(cls):
    """the one page that uses this class, or None"""
    if cls in CACHE: return CACHE[cls]
    rx = re.compile(r'(?<![\w-])' + re.escape(cls) + r'(?![\w-])')
    pages = set()
    for rel, s in SRC.items():
        if rx.search(s):
            o = owner_of(rel)
            pages.add(o)
            if o is None: break
    CACHE[cls] = pages.pop() if len(pages) == 1 and None not in pages else None
    return CACHE[cls]

def rules(css):
    """top-level items: (kind, prelude, body, text) with @media kept as a block of inner rules"""
    i, n, out = 0, len(css), []
    while i < n:
        m = re.compile(r'\s*(/\*.*?\*/)?', re.S).match(css, i);
        if m.group(1): out.append(('c', None, None, css[i:m.end()])); i = m.end(); continue
        j = css.find('{', i)
        if j < 0: out.append(('x', None, None, css[i:])); break
        pre = css[i:j]; depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            elif css.startswith('/*', k): k = css.find('*/', k) + 1
            k += 1
        out.append(('r', pre.strip(), css[j + 1:k - 1], css[i:k])); i = k
    return out

def target(sel):
    if not sel or sel.startswith('@') or ':root' in sel: return None
    pages = set()
    for part in sel.split(','):
        cls = re.findall(r'\.([a-zA-Z][\w-]*)', part)
        if not cls: return None
        ps = set(page_of(c) for c in cls)
        if None in ps and len(ps) == 1: return None
        ps.discard(None)
        if len(ps) != 1: return None
        # every class of this part must belong to that page (or be a plain state class used with it, like .on/.open)
        pg = ps.pop()
        if any(page_of(c) not in (pg,) and len(c) > 4 for c in cls): return None
        pages.add(pg)
    return pages.pop() if len(pages) == 1 else None

css = rd('styles.css'); keep, moved = [], {}
for kind, pre, body, text in rules(css):
    if kind == 'r' and pre.startswith('@media'):
        inner_keep, inner_move = [], {}
        for k2, p2, b2, t2 in rules(body):
            pg = target(p2) if k2 == 'r' else None
            if pg: inner_move.setdefault(pg, []).append(t2.strip())
            else: inner_keep.append(t2)
        for pg, l in inner_move.items(): moved.setdefault(pg, []).append(pre + ' {\n  ' + '\n  '.join(l) + '\n}')
        keep.append(pre + ' {' + ''.join(inner_keep) + '}' if ''.join(inner_keep).strip() else '')
        continue
    pg = target(pre) if kind == 'r' else None
    if pg: moved.setdefault(pg, []).append(text.strip())
    else: keep.append(text)
for pg, l in sorted(moved.items()): print('%-10s %4d rules  %6.1f kB' % (pg, len(l), sum(len(x) for x in l) / 1024))
print('styles.css %.0f kB → %.0f kB' % (len(css) / 1024, len(''.join(keep)) / 1024))
if '--write' in sys.argv:
    io.open(os.path.join(HERE, 'styles.css'), 'w', encoding='utf-8').write(''.join(keep))
    for pg, l in moved.items():
        p = os.path.join(HERE, pg, 'page.css'); old = io.open(p, encoding='utf-8').read() if os.path.exists(p) else '/* Rules only this page uses (moved out of styles.css by cmd/split-css.py – a rule another page needs goes back there). */\n'
        io.open(p, 'w', encoding='utf-8').write(old.rstrip() + '\n' + '\n'.join(l) + '\n')
        h = os.path.join(HERE, pg, 'index.html'); s = io.open(h, encoding='utf-8').read()
        if 'page.css' not in s:
            s = re.sub(r'(\s*<link href="\.\./styles\.css\?v=[^"]*" rel="stylesheet">)', r'\1\n  <link href="page.css?v=0" rel="stylesheet">', s, count=1)
            io.open(h, 'w', encoding='utf-8').write(s)
    print('written – now run python3 cmd/build.py and the tests')
