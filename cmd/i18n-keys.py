#!/usr/bin/env python3
"""Texts by name (Phase D 24): gives the dashboard's texts a fixed name instead of matching the English sentence.

    python3 cmd/i18n-keys.py AREA FILE [FILE …]      (AREA: ui for texts on every page, or a page's name)
    python3 cmd/i18n-keys.py ui --prune      take sentences out of the old list that are named everywhere they are used

For each file it finds texts that the old sentence list (i18n-nb.js) translates word for word:
  - in HTML: an element's own text and its placeholder / aria-label / title / data-title
  - in scripts: the same inside HTML written in a string – '<b>Save</b>' or aria-label="Close" in one string
and gives them a name: data-t="AREA.some-words" (data-t-aria-label="…" for attributes). The English stays where it
is; the name and its [English, Norwegian] go into cmd/words/AREA.nb.js (loaded with the Norwegian words only).
Then `python3 cmd/i18n-keys.py ui --prune` takes the sentences that are named everywhere out of the old list.
Run it, look at the diff, run the tests (norwegian, words). It never touches texts it isn't sure about. """
import html.parser, io, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
AREA, FILES = sys.argv[1], [a for a in sys.argv[2:] if not a.startswith('--')]
if not re.match(r'^[a-z][a-z0-9-]*$', AREA): sys.exit('area: lower-case letters')

# the old sentence list, read by running i18n-nb.js with nothing around it
DUMP = r'''
const fs = require('fs'); let src = fs.readFileSync(process.argv[1], 'utf8').replace('var D = {', 'var D = window.__D = {');
const w = { I18N: { lang: 'nb', nb: {} } }, d = { documentElement: {}, body: null, addEventListener() {} };
global.localStorage = { getItem() { return null; } };
new Function('window', 'document', src)(w, d); process.stdout.write(JSON.stringify(w.__D));'''
D = json.loads(subprocess.run(['node', '-e', DUMP, os.path.join(HERE, 'i18n-nb.js')], capture_output=True, check=True).stdout)

WF = os.path.join(HERE, 'words', AREA + '.nb.js')
WORDS = {}
if os.path.exists(WF):
    m = re.search(r'I18N\.add\((\{.*\})\);', io.open(WF, encoding='utf-8').read(), re.S)
    if m: WORDS = json.loads(m.group(1))
BY_EN = {v[0]: k for k, v in WORDS.items()}

def key_for(en):
    if en in BY_EN: return BY_EN[en]
    slug = '-'.join(re.findall(r'[a-z0-9]+', en.lower().replace('’', '').replace("'", '')))[:40].strip('-') or 'text'
    k, n = AREA + '.' + slug, 2
    while k in WORDS and WORDS[k][0] != en: k, n = AREA + '.' + slug + '-' + str(n), n + 1
    WORDS[k] = [en, D[en]]; BY_EN[en] = k
    return k

ATTRS = ('placeholder', 'aria-label', 'title', 'data-title')
SKIP_TAGS = {'script', 'style', 'textarea', 'code'}

class P(html.parser.HTMLParser):
    """remembers where each start tag ends ('>' position), and which tags get a name"""
    def __init__(self, text):
        super().__init__(convert_charrefs=True); self.text = text; self.stack = []; self.ins = {}
        self.lines = [0]
        for i, ch in enumerate(text):
            if ch == '\n': self.lines.append(i + 1)
    def off(self): l, c = self.getpos(); return self.lines[l - 1] + c
    VOID = {'br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'col', 'area', 'base', 'wbr', 'path', 'circle', 'rect', 'use', 'line', 'ellipse', 'polygon', 'polyline', 'stop'}
    def handle_starttag(self, tag, attrs):
        start = self.off(); end = self.text.index('>', start)
        a = dict(attrs)
        skip = tag in SKIP_TAGS or 'data-noi18n' in a or any(s['skip'] for s in self.stack)
        node = {'tag': tag, 'pos': end, 'skip': skip, 'has': 'data-t' in a, 'start': start}
        if not skip:
            for at in ATTRS:
                v = a.get(at)
                if v and v.strip() in D and ('data-t-' + at) not in a:
                    self.ins.setdefault(start, []).append(' data-t-%s="%s"' % (at, key_for(v.strip())))
        if tag not in self.VOID and not self.text[end - 1] == '/': self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1]['tag'] == tag and tag not in self.VOID: self.stack.pop()
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag: del self.stack[i:]; break
    def handle_data(self, data):
        t = data.strip()
        if not t or not self.stack: return
        p = self.stack[-1]
        first = not p.get('seen'); p['seen'] = True       # only an element's first text gets a name (that's the one data-t swaps)
        if not first or p['skip'] or p['has'] or t not in D: return
        self.ins.setdefault(p['start'], []).append(' data-t="%s"' % key_for(t))

def do_html(text):
    p = P(text); p.feed(text); p.close()
    out, last = [], 0
    for start in sorted(p.ins):
        m = re.match(r'<[A-Za-z][\w-]*', text[start:])
        cut = start + m.end()
        out.append(text[last:cut]); out.append(''.join(p.ins[start])); last = cut
    out.append(text[last:])
    return ''.join(out), sum(len(v) for v in p.ins.values())

# in scripts: whole elements written inside one string literal
JS_EL = re.compile(r"""<([a-z][a-z0-9]*)((?:\s[^<>'"]*(?:"[^"]*"[^<>'"]*)*)?)>([^<>'"\\]+)</\1>""")
JS_AT = re.compile(r"""(<[a-z][a-z0-9]*\b[^<>']*?)\s(placeholder|aria-label|title|data-title)="([^"<>']+)"([^<>']*>)""")
def do_js(text):
    n = 0
    def el(m):
        nonlocal n
        tag, attrs, inner = m.group(1), m.group(2) or '', m.group(3)
        t = inner.strip()
        if tag in SKIP_TAGS or 'data-t=' in attrs or 'data-noi18n' in attrs or t not in D: return m.group(0)
        n += 1
        return '<%s%s data-t="%s">%s</%s>' % (tag, attrs, key_for(t), inner, tag)
    def at(m):
        nonlocal n
        before, a, v, after = m.groups()
        if 'data-t-' + a in before + after or v.strip() not in D: return m.group(0)
        n += 1
        return '%s %s="%s" data-t-%s="%s"%s' % (before, a, v, a, key_for(v.strip()), after)
    # only inside single-quoted strings (the code's style); never in comments
    def lit(m):
        s = m.group(0)
        if '<' not in s: return s
        s2 = JS_EL.sub(el, s); s2 = JS_AT.sub(at, s2); return s2
    return re.sub(r"'(?:[^'\\\n]|\\.)*'", lit, text), n

total = 0
for f in FILES:
    path = os.path.join(HERE, f) if not os.path.isabs(f) else f
    src = io.open(path, encoding='utf-8').read()
    new, n = do_html(src) if f.endswith('.html') else do_js(src)
    if n: io.open(path, 'w', encoding='utf-8').write(new)
    print('%-28s %d named' % (f, n)); total += n
os.makedirs(os.path.dirname(WF), exist_ok=True)
body = '{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in sorted(WORDS.items())) + '\n}'
io.open(WF, 'w', encoding='utf-8').write('/* Texts by name for %s: [English, Norwegian]. Made by cmd/i18n-keys.py – add new ones by hand the same way. */\nI18N.add(%s);\n' % (AREA, body))
print('%d texts named, %d names in words/%s.nb.js' % (total, len(WORDS), AREA))

# ---------- --prune: take sentences out of the old list once every use of them has a name ----------
# A sentence goes when it's written somewhere and every place it's written is named (data-t / data-t-<attr>), and it
# has at least three words (short words can also be pieces the patterns translate, like "Today" in "Today: …").
if '--prune' in sys.argv:
    srcs = []
    for d, ds, fs in os.walk(HERE):
        if os.sep + 'dist' in d or os.sep + 'node_modules' in d or os.sep + 'words' in d: continue
        for f in fs:
            if (f.endswith('.js') or f.endswith('.html')) and f not in ('i18n-nb.js',):
                srcs.append(io.open(os.path.join(d, f), encoding='utf-8').read())
    def named_at(s, i, en):
        lt = s.rfind('<', 0, i); gt = s.rfind('>', 0, i)
        if gt > lt and s[gt + 1:i].strip() == '':                 # an element's text: its start tag carries data-t
            st = s.rfind('<', 0, gt); return ' data-t="' in s[st:gt]
        if lt > gt:                                                  # inside a tag: an attribute with data-t-<attr>
            end = s.find('>', i); tag = s[lt:end]; m = re.search(r'([a-z-]+)="$', s[lt:i])
            return bool(m) and ('data-t-' + m.group(1) + '="') in tag
        return False
    gone = []
    for en in D:
        if len(en.split()) < 3: continue
        forms = {en, en.replace('&', '&amp;')}
        hits = [(s, i) for s in srcs for f in forms for i in [m.start() for m in re.finditer(re.escape(f), s)]]
        if hits and all(named_at(s, i, en) for s, i in hits): gone.append(en)
    I = os.path.join(HERE, 'i18n-nb.js'); src = io.open(I, encoding='utf-8').read(); n0 = len(src.encode('utf-8'))
    for en in gone:
        lit = en.replace('\\', '\\\\').replace("'", "\\'")
        src, k = re.subn(r"(?<=[{,\s])'" + re.escape(lit) + r"'\s*:\s*'(?:[^'\\]|\\.)*'\s*,?[ \t]*", '', src)
    io.open(I, 'w', encoding='utf-8').write(src)
    print('pruned %d sentences from the old list (%d kB → %d kB)' % (len(gone), n0 // 1024, len(src.encode('utf-8')) // 1024))
    # names no file uses any more leave the words file too
    used = set(m.group(1) for s in srcs for m in re.finditer(r'data-t(?:-[a-z-]+)?=\\?"([a-z][\w.-]*)\\?"', s))
    drop = [k for k in WORDS if k.startswith(AREA + '.') and k not in used]
    for k in drop: del WORDS[k]
    body = '{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in sorted(WORDS.items())) + '\n}'
    io.open(WF, 'w', encoding='utf-8').write('/* Texts by name for %s: [English, Norwegian]. Made by cmd/i18n-keys.py – add new ones by hand the same way. */\nI18N.add(%s);\n' % (AREA, body))
    print('%d unused names taken out of words/%s.nb.js' % (len(drop), AREA))
