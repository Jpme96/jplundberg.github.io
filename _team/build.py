#!/usr/bin/env python3
"""Copies what Team's Documents tab needs from cmd/ into _team/public/dc/ – one source, so Document control and Document
requirements are the same code in cmd and in Team. Edit cmd's files, never _team/public/dc/.

    python3 _team/build.py          copy / regenerate
    python3 _team/build.py --check  exit 1 if a copy is out of date (cmd/build.py runs this too)

What it makes:
  dc/doc-control.js   cmd/doc-control.page.js (it runs on Team's storage through window.DocHost)
  dc/doc-naming.js    cmd/doc-naming.js (file naming and the content check, loaded only where switched on)
  dc/xlsx-view.js     cmd/xlsx-view.js (see and edit an Excel file)
  dc/paged-pdf.js     cmd/paged-pdf.js (A4 PDFs on the device) + dc/vendor/ (jsPDF, html2canvas, pdf.js – fetched on first use)
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
dn = rd(os.path.join(CMD, 'doc-naming.js'))
put('doc-naming.js', NOTE % 'doc-naming.js' + dn)   # file naming, loaded only where it is switched on
put('paged-pdf.js', NOTE % 'paged-pdf.js' + pdf)
fd = rd(os.path.join(CMD, 'filedrop.js'))
put('filedrop.js', NOTE % 'filedrop.js' + fd)   # every file picker opens the drop popup (JP 2026-11-17 21:02)
xv = rd(os.path.join(CMD, 'xlsx-view.js'))
put('xlsx-view.js', NOTE % 'xlsx-view.js' + xv)
for f in ('jspdf.umd.min.js', 'html2canvas.min.js', 'pdf.min.js', 'pdf.worker.min.js'):   # pdf.js: the content check reads a PDF's text on the device
    put('vendor/' + f, rd(os.path.join(CMD, 'vendor', f), True))
for f in sorted(os.listdir(os.path.join(CMD, 'vendor', 'ocr'))):   # scans read quietly in the background (tesseract.js – loaded the first time a scan turns up, JP 2026-11-25)
    put('vendor/ocr/' + f, rd(os.path.join(CMD, 'vendor', 'ocr', f), True))

# the NS 3451 table (codes and names, nothing personal)
lp = rd(os.path.join(CMD, 'life-pages.js'))
m = re.search(r'^  var NS = (\[.*?\]);\s*$', lp, re.M | re.S)
if not m: sys.exit('no NS table in cmd/life-pages.js')
put('ns.js', NOTE % 'life-pages.js (the NS 3451 table)' + 'window.NS3451 = ' + m.group(1) + ';\n')

# the Norwegian words the two files use
src = dc + dn + pdf + xv + fd
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

TOK = set(re.findall(r'[a-zA-Z][\w-]*', src + rd(os.path.join(CMD, 'fdv.page.js'))))   # + the inspection report's classes (inspections shared to Team)
SKIP = re.compile(r':root|\bhtml\b|\.modern\b|\.glass\b|\.simple\b|\.unlocked\b|\.lock\b|\[data-theme|\.mo-|\.dens-|\.corners-')
# Team's own class names that cmd also uses for something else: cmd's rules for them never come along
# (cmd's `.acc` – a finance account row, display: flex – turned Team's accent cards into rows in Settings → Requests, JP 2026-11-26 12:56)
CLASH = {'acc'}
def keep(sel):
    """the parts of a selector list that Document control uses – a list that also names a class it doesn't use still keeps its other parts
       (the rule that centres an icon in a round button named .fold-btn too, so Team lost it – JP 2026-11-23 "the x was not in the middle")"""
    if not sel or sel.startswith('@') or SKIP.search(sel): return ''
    ok = []
    for part in sel.split(','):
        cls = re.findall(r'\.([a-zA-Z][\w-]*)', part)
        if cls and all(c in TOK for c in cls) and not (set(cls) & CLASH): ok.append(part.strip())
    return ', '.join(ok)
def wanted(sel): return bool(keep(sel))

def pick(css):
    out = []
    for pre, body in rules(css):
        if pre.startswith('@media'):
            inner = [keep(p2) + ' {' + b2 + '}' for p2, b2 in rules(body) if wanted(p2)]
            if inner: out.append(pre + ' {\n  ' + '\n  '.join(inner) + '\n}')
        elif pre.startswith('@keyframes'):
            if pre.split()[-1] in TOK: out.append(pre + ' {' + body + '}')
        elif wanted(pre):
            out.append(keep(pre) + ' {' + body + '}')
    return out

styles = rd(os.path.join(CMD, 'styles.css'))
dark = re.search(r'^:root \{(.*?)^\}', styles, re.S | re.M).group(1)
light = re.search(r'^:root\[data-theme="light"\] \{(.*?)^\}', styles, re.S | re.M).group(1)
css = ['/* Built by _team/build.py from cmd/styles.css and cmd/work/page.css – only what Document control uses. Edit those, not this. */',
       # light = cmd's dark tokens with the light ones over them, as the cascade does in cmd – the light block alone lacks --warn-rgb, --ok-rgb … (JP 2026-11-24: the new-files line had no colour in Team)
       '.dc-host {' + dark + light + '}', ':root[data-theme="dark"] .dc-host, :root[data-theme="dark"] .dc-host.dcn-ov {' + dark + '}',
       # Team's own colours win inside Documentation too: the accent, text on it, the error colour, the grey text; blue and violet tags go neutral (JP 2026-11-19)
       '.dc-host, :root[data-theme="dark"] .dc-host, :root[data-theme="dark"] .dc-host.dcn-ov { --accent: var(--acc); --accent-rgb: var(--acc-rgb); --on-accent: var(--acc-ink); --accent-soft: var(--acc-soft); --glow: rgba(var(--acc-rgb), .3); --danger: var(--bad); --muted: var(--t-muted); --blue: var(--neutral); --violet: var(--neutral); --pink: var(--acc); }',
       # status colours from Oslo kommune's palette (JP 2026-11-24 20:36 "change that to oslo farger"): text in dark green / dark blue on the
       # light Oslo tints (the design manual's rule); in dark mode the bright Oslo colour is the text on a faint tint
       '.dc-host { --ok: #034b45; --ok-rgb: 67, 248, 182; --warn: #2a2859; --warn-rgb: 249, 198, 107; --danger-rgb: 255, 130, 116; --orange: #2a2859; --orange-rgb: 224, 173, 255; --blue: #2a2859; --blue-rgb: 111, 233, 255; --slate: #2a2859; --slate-rgb: 208, 191, 174; --stt-fg: 100%; --stt-bg: .34; }',
       ':root[data-theme="dark"] .dc-host, :root[data-theme="dark"] .dc-host.dcn-ov { --ok: #43f8b6; --ok-rgb: 67, 248, 182; --warn: #f9c66b; --warn-rgb: 249, 198, 107; --danger-rgb: 255, 130, 116; --orange: #e0adff; --orange-rgb: 224, 173, 255; --blue: #6fe9ff; --blue-rgb: 111, 233, 255; --slate: #d0bfae; --slate-rgb: 208, 191, 174; --stt-fg: 100%; --stt-bg: .16; }',
       '.dc-host .stt-bad { --c: #2a2859; } :root[data-theme="dark"] .dc-host .stt-bad { --c: #ff8274; }']
css += pick(styles) + pick(rd(os.path.join(CMD, 'work', 'page.css')))
# the status tags (modern.css) – Team didn't have them, so "Navn OK" showed as plain text (JP 2026-11-24)
modern = rd(os.path.join(CMD, 'modern.css'))
css.append('.dc-host { --r-chip: 999px; --fs-s: 12px; --stt-mix: black; }')
css.append(':root[data-theme="dark"] .dc-host, :root[data-theme="dark"] .dc-host.dcn-ov { --stt-mix: white; }')
css += [m.group(0) for m in re.finditer(r'^\.stt[^{]*\{[^}]*\}', modern, re.M)]
# Team scales the page with CSS zoom and viewport units don't follow it (100dvh was 78 percent of a low laptop's screen - review 15):
# every vh becomes the zoom-corrected --tvh that app.js sets (plain vh when there is no zoom)
css = [re.sub(r'(?<![\w.-])(\d+(?:\.\d+)?)([dsl]?)vh\b', lambda m: 'calc(var(--tvh, 1' + m.group(2) + 'vh) * ' + m.group(1) + ')', c) for c in css]
put('dc.css', '\n'.join(css) + '\n')

# the icon font
put('bi/bi.css', rd(os.path.join(CMD, 'assets', 'bi', 'bi.css')))
put('bi/bi.woff2', rd(os.path.join(CMD, 'assets', 'bi', 'bi.woff2'), True))

# the build's fingerprint (JP 2026-11-25 – a tab ran old code after a release): app.js carries it in `var BUILD = '…'`
# and /version.txt has the same; a tab whose BUILD differs from version.txt reloads itself when nothing is open
import hashlib
PUB = os.path.dirname(OUT)
def _pubfiles():
    L = []
    for root, _, fs in os.walk(PUB):
        for f in sorted(fs):
            if f.endswith(('.js', '.css', '.html')) and f not in ('sw.js',) and root.find(os.sep + 'vendor') < 0:
                L.append(os.path.join(root, f))
    return sorted(L)
_h = hashlib.sha256()
for f in _pubfiles():
    b = open(f, 'rb').read()
    if f.endswith(os.sep + 'app.js'): b = re.sub(rb"var BUILD = '[0-9a-f]*';", b"var BUILD = '';", b)
    _h.update(f[len(PUB):].encode() + b'\0' + b)
_sig = _h.hexdigest()[:12]
_app = os.path.join(PUB, 'app.js'); _a = io.open(_app, encoding='utf-8').read()
_a2 = re.sub(r"var BUILD = '[0-9a-f]*';", "var BUILD = '%s';" % _sig, _a)
for _rel, _data in (('app.js', _a2), ('version.txt', _sig + '\n')):
    _p = os.path.join(PUB, _rel); _old = open(_p, 'rb').read() if os.path.exists(_p) else None
    if _old != _data.encode('utf-8'):
        if check: stale.append(_rel)
        else: open(_p, 'wb').write(_data.encode('utf-8'))

if check:
    if stale: print('Team copies out of date (run python3 _team/build.py):', ', '.join(stale)); sys.exit(1)
    print('Team copies up to date')
else:
    print('Team: copied Document control (%d words, %.0f kB CSS)' % (len(dict_), len('\n'.join(css)) / 1024))
