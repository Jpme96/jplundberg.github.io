#!/usr/bin/env python3
"""Texts by name (Phase D 24): gives the dashboard's texts a fixed name instead of matching the English sentence.

    python3 cmd/i18n-keys.py AREA FILE [FILE …]      (AREA: ui for texts on every page, or a page's name)
    python3 cmd/i18n-keys.py ui --prune      take sentences out of the old list that are named everywhere they are used
    python3 cmd/i18n-keys.py ui --wrap FILE … also names pieces of text that sit between other tags (a sentence with a
                                             <b> or <code> in it): each piece gets its own <span data-t="…">
    python3 cmd/i18n-keys.py ui --props FILE … names a card's set-up words: title / empty / addLabel: 'English' (kit.js shows them)
    python3 cmd/i18n-keys.py ui --opts FILE … names the labels of choices: [value, 'Label'] in a list of choices (the value
                                             is what's saved, the label is only shown). Not for head modules (scripts.json
                                             "head"): they run before the Norwegian words are loaded.

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
WRAP = '--wrap' in sys.argv; WRAP_ALL = False
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
        super().__init__(convert_charrefs=True); self.text = text; self.stack = []; self.ins = {}; self.wraps = []
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
        if p['skip'] or t not in D: return
        if first:   # an element's own (first) text: named by data-t on the element
            if not p['has']: self.ins.setdefault(p['start'], []).append(' data-t="%s"' % key_for(t))
            return
        if not WRAP or p['tag'] in ('option', 'title', 'textarea'): return
        # a piece between other tags: wrap it in its own named span (only where the source has the text as it is)
        st0 = self.off(); i = self.text.find(t, st0)
        if i < 0 or i > st0 + len(data): return
        self.wraps.append((i, i + len(t), key_for(t)))

def do_html(text):
    p = P(text); p.feed(text); p.close()
    out, last = [], 0
    for start in sorted(p.ins):
        m = re.match(r'<[A-Za-z][\w-]*', text[start:])
        cut = start + m.end()
        out.append(text[last:cut]); out.append(''.join(p.ins[start])); last = cut
    out.append(text[last:])
    res, n = ''.join(out), sum(len(v) for v in p.ins.values())
    if p.wraps:   # the wraps come after the attribute insertions: redo the offsets on the new text by searching from each old place
        p2 = P(res); p2.feed(res); p2.close()
        for a, b, k in sorted(p2.wraps, reverse=True): res = res[:a] + '<span data-t="%s">' % k + res[a:b] + '</span>' + res[b:]; n += 1
    return res, n

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
    def piece(mm):
        nonlocal n
        txt = mm.group(1); t = txt.strip()
        if t not in D or len(t) < 2 or not re.search(r'[A-Za-z]', t): return mm.group(0)
        n += 1; i0 = txt.index(t)
        return '>' + txt[:i0] + '<span data-t="%s">' % key_for(t) + t + '</span>' + txt[i0 + len(t):]
    def lit(m):
        s = m.group(0)
        if '<' not in s: return s
        s2 = JS_EL.sub(el, s); s2 = JS_AT.sub(at, s2)
        # pieces of text between two tags inside the same string ('<b>Tip:</b> do this <code>x</code>')
        if WRAP and not re.search(r'</?(option|textarea|title|script|style|select)\b', s2): s2 = re.sub(r">([^<>'\\]+)(?=<)", piece, s2)
        return s2
    return re.sub(r"'(?:[^'\\\n]|\\.)*'", lit, text), n

# --args: a label passed to a helper in a script – sw(cfg, key, 'Show the card', 'Sub line') – becomes
# I18N.k('ui.show-the-card', 'Show the card'): named, and Norwegian straight from the words file
ARGS = '--args' in sys.argv
NOT_LABEL = {'indexOf', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'closest', 'matches', 'test', 'replace', 'split', 'startsWith', 'endsWith', 'includes', 'has', 'get', 'set', 'getAttribute', 'setAttribute', 'dataset', 'k', 'fetch', 'api', 'send', 'log', 'error', 'warn', 'RegExp', 'match', 'search', 'lastIndexOf', 'Event', 'CustomEvent', 'dispatchEvent', 'addEventListener', 'key', 'on', 'list', 'tools', 'readJSON', 'rj', 'wj', 'hash', 'trackEvent', 'L'}
def do_args(text):
    n = 0
    def lit(m):
        nonlocal n
        body = m.group(2)
        if '\\' in body or '<' in body or body not in D or ' ' not in body or len(body) < 5 or not re.match(r'[A-Z0-9“"(]', body): return m.group(0)
        pre = text[:m.start()].rstrip(); post = text[m.end():].lstrip()
        if not (pre.endswith('(') or pre.endswith(',')) or not (post.startswith(',') or post.startswith(')')): return m.group(0)
        if pre.endswith(',') and re.search(r'\[[^\[\]()]*$', pre[-200:]): return m.group(0)   # inside an array: it may be data that gets saved (a seed list) – leave it
        fn = re.search(r'([A-Za-z_$][\w$]*)\s*\(\s*$', pre) or re.search(r'([A-Za-z_$][\w$]*)\s*\([^()]*$', pre[-300:])
        if fn and fn.group(1) in NOT_LABEL: return m.group(0)
        if re.search(r'(===|!==|==|!=)\s*$', pre) or re.search(r'^(===|!==|==|!=)', post): return m.group(0)
        n += 1
        return "I18N.k('%s', %s)" % (key_for(body), m.group(1))
    out = re.sub(r"(?<![\w.$])('((?:[^'\\\n]|\\.)*)')", lit, text)
    return out, n
total = 0
OPTS = '--opts' in sys.argv
def do_opts(text):
    """the label in a choice [value, 'Label'] (a number or a short id, then the words) inside a list of choices: shown, never saved"""
    n = 0
    def pair(m):
        nonlocal n
        body = m.group(3)
        if '\\' in body or '<' in body or body not in D or len(body) < 2: return m.group(0)
        pre = text[:m.start()]
        if not re.search(r'(\[|,\s*)$', pre): return m.group(0)                      # one of several pairs in a list
        n += 1
        return '[%s, I18N.k(%s, %s)]' % (m.group(1), "'%s'" % key_for(body), m.group(2))
    out = re.sub(r"\[(-?[\d.]+|'[a-z0-9_-]{1,24}')\s*,\s*('((?:[^'\\\n]|\\.)*)')\s*\]", pair, text)
    return out, n
PROPS = '--props' in sys.argv
def do_props(text):
    """the words of a card's set-up, { title: 'Warranties & receipts', empty: 'Keep track …', addLabel: 'Add' } – shown only
       (kit.js draws them). Only these three names: other properties (name, desc …) can be ids, data or search words."""
    n = 0
    def prop(m):
        nonlocal n
        body = m.group(3)
        if '\\' in body or '<' in body or body not in D or len(body) < 2: return m.group(0)
        n += 1
        return '%s: I18N.k(%s, %s)' % (m.group(1), "'%s'" % key_for(body), m.group(2))
    out = re.sub(r"(?<![\w$.])(title|empty|addLabel)\s*:\s*('((?:[^'\\\n]|\\.)*)')(?=\s*[,}])", prop, text)
    return out, n
if PROPS:
    for f in FILES:
        path = os.path.join(HERE, f); src = io.open(path, encoding='utf-8').read()
        new, k = do_props(src)
        if k: io.open(path, 'w', encoding='utf-8').write(new)
        print('%-28s %d card words named' % (f, k)); total += k
    FILES = []
if OPTS:
    for f in FILES:
        path = os.path.join(HERE, f); src = io.open(path, encoding='utf-8').read()
        new, k = do_opts(src)
        if k: io.open(path, 'w', encoding='utf-8').write(new)
        print('%-28s %d choices named' % (f, k)); total += k
    FILES = []
if ARGS:
    for f in FILES:
        path = os.path.join(HERE, f); src = io.open(path, encoding='utf-8').read()
        new, k = do_args(src)
        if k: io.open(path, 'w', encoding='utf-8').write(new)
        print('%-28s %d labels named' % (f, k)); total += k
    FILES = []
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
    # names used in scripts – I18N.k('ui.x', 'English') – count too, and any missing from the words file is put back
    for s0 in srcs:
        for m in re.finditer(r"I18N\.k\('([a-z][\w.-]*)',\s*'((?:[^'\\]|\\.)*)'", s0):
            used.add(m.group(1)); en = m.group(2).replace("\\'", "'")
            if m.group(1) not in WORDS and en in D: WORDS[m.group(1)] = [en, D[en]]
    # a name written anywhere as a string counts too – code calls I18N.k through short aliases (var K = I18N.k; K('ui.x', …)),
    # which the pattern above doesn't see: 2026-11-13 a prune took out 11 such names and their lines fell back to English
    for s0 in srcs: used.update(m.group(1) for m in re.finditer(r"['\"](" + re.escape(AREA) + r"\.[a-z0-9][\w.-]*)['\"]", s0))
    drop = [k for k in WORDS if k.startswith(AREA + '.') and k not in used]
    for k in drop: del WORDS[k]
    body = '{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in sorted(WORDS.items())) + '\n}'
    io.open(WF, 'w', encoding='utf-8').write('/* Texts by name for %s: [English, Norwegian]. Made by cmd/i18n-keys.py – add new ones by hand the same way. */\nI18N.add(%s);\n' % (AREA, body))
    print('%d unused names taken out of words/%s.nb.js' % (len(drop), AREA))
