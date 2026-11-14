#!/usr/bin/env python3
"""Copies what Team's Documents tab needs from cmd/ into _team/public/dc/ – one source, so Document control and Document
requirements are the same code in cmd and in Team. Edit cmd's files, never _team/public/dc/.

    python3 _team/build.py          copy / regenerate
    python3 _team/build.py --check  exit 1 if a copy is out of date (cmd/build.py runs this too)

What it makes:
  dc/doc-control.js   cmd/doc-control.page.js (it runs on Team's storage through window.DocHost)
  dc/xlsx-view.js     cmd/xlsx-view.js (see and edit an Excel file)
  dc/paged-pdf.js     cmd/paged-pdf.js (A4 PDFs on the device) + dc/vendor/ (jsPDF, html2canvas, fetched on first use)
  dc/ns.js            the NS 3451 names from cmd/life-pages.js (window.NS3451)
  dc/words.js         the Norwegian words those files use, from cmd/words/ui.nb.js (window.DC_NB)
  dc/dc.css           cmd's colour tokens (scoped to .dc-host) + the rules whose classes those files use
  dc/bi/              cmd's trimmed icon font """
import io, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CMD = os.path.join(HERE, '..', 'cmd')
OUT = os.path.join(HERE, 'public', 'dc')
check = '--check' in sys.argv
stale = []


def rd(p, binary=False):
    return open(p, 'rb').read() if binary else io.open(p, encoding='utf-8').read()


def put(rel, data):
    p = os.path.join(OUT, rel)
    old = open(p, 'rb').read() if os.path.exists(p) else None
    b = data if isinstance(data, bytes) else data.encode('utf-8')
    if old == b: return
    if check: stale.append(rel); return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(b)


NOTE = '/* Copied from cmd/%s by _team/build.py – edit it there, not here. */\n'
dc = rd(os.path.join(CMD, 'doc-control.page.js'))
pdf = rd(os.path.join(CMD, 'paged-pdf.js'))
put('doc-control.js', NOTE % 'doc-control.page.js' + dc)
put('paged-pdf.js', NOTE % 'paged-pdf.js' + pdf)
xv = rd(os.path.join(CMD, 'xlsx-view.js'))
put('xlsx-view.js', NOTE % 'xlsx-view.js' + xv)
for f in ('jspdf.umd.min.js', 'html2canvas.min.js'):
    put('vendor/' + f, rd(os.path.join(CMD, 'vendor', f), True))

# the NS 3451 table (codes and names, nothing personal)
lp = rd(os.path.join(CMD, 'life-pages.js'))
m = re.search(r'^  var NS = (\[.*?\]);\s*$', lp, re.M | re.S)
if not m: sys.exit('no NS table in cmd/life-pages.js')
put('ns.js', NOTE % 'life-pages.js (the NS 3451 table)' + 'window.NS3451 = ' + m.group(1) + ';\n')

# the Norwegian words the two files use
src = dc + pdf + xv
keys = sorted(set(re.findall(r"""'(ui\.[a-z0-9.-]+)'""", src)))   # every text name in the two files (also those passed around in tables)
wtxt = rd(os.path.join(CMD, 'words', 'ui.nb.js'))
wm = re.search(r'I18N\.add\((\{.*\})\);?\s*$', wtxt, re.S)
words = json.loads(wm.group(1))
dict_ = {k: words[k][1] for k in keys if k in words}
put('words.js', NOTE % 'words/ui.nb.js (only the words Document control uses)' + 'window.DC_NB = ' + json.dumps(dict_, ensure_ascii=False, sort_keys=True, indent=0) + ';\n')

# CSS: a small parser (as in cmd/split-css.py)
def rules(css):
    i, n, out = 0, len(css), []
    cm = re.compile(r'\s*(/\*.*?\*/)?', re.S)
    while i < n:
        mm = cm.match(css, i)
        if mm.group(1): i = mm.end(); continue
        j = css.find('{', i)
        if j < 0: break
        pre = css[i:j]; depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            elif css.startswith('/*', k): k = css.find('*/', k) + 1
            k += 1
        out.append((pre.strip(), css[j + 1:k - 1])); i = k
    return out

TOK = set(re.findall(r'[a-zA-Z][\w-]*', src))
SKIP = re.compile(r':root|\bhtml\b|\.modern\b|\.glass\b|\.simple\b|\.unlocked\b|\.lock\b|\[data-theme|\.mo-|\.dens-|\.corners-')
def wanted(sel):
    if not sel or sel.startswith('@') or SKIP.search(sel): return False
    for part in sel.split(','):
        cls = re.findall(r'\.([a-zA-Z][\w-]*)', part)
        if not cls or any(c not in TOK for c in cls): return False
    return True

def pick(css):
    out = []
    for pre, body in rules(css):
        if pre.startswith('@media'):
            inner = [p2 + ' {' + b2 + '}' for p2, b2 in rules(body) if wanted(p2)]
            if inner: out.append(pre + ' {\n  ' + '\n  '.join(inner) + '\n}')
        elif pre.startswith('@keyframes'):
            if pre.split()[-1] in TOK: out.append(pre + ' {' + body + '}')
        elif wanted(pre):
            out.append(pre + ' {' + body + '}')
    return out

styles = rd(os.path.join(CMD, 'styles.css'))
dark = re.search(r'^:root \{(.*?)^\}', styles, re.S | re.M).group(1)
light = re.search(r'^:root\[data-theme="light"\] \{(.*?)^\}', styles, re.S | re.M).group(1)
css = ['/* Built by _team/build.py from cmd/styles.css and cmd/work/page.css – only what Document control uses. Edit those, not this. */',
       '.dc-host {' + dark + '}', '@media (prefers-color-scheme: light) { .dc-host {' + light + '} }']
css += pick(styles) + pick(rd(os.path.join(CMD, 'work', 'page.css')))
put('dc.css', '\n'.join(css) + '\n')

# the icon font
put('bi/bi.css', rd(os.path.join(CMD, 'assets', 'bi', 'bi.css')))
put('bi/bi.woff2', rd(os.path.join(CMD, 'assets', 'bi', 'bi.woff2'), True))

if check:
    if stale: print('Team copies out of date (run python3 _team/build.py):', ', '.join(stale)); sys.exit(1)
    print('Team copies up to date')
else:
    print('Team: copied Document control (%d words, %.0f kB CSS)' % (len(dict_), len('\n'.join(css)) / 1024))
