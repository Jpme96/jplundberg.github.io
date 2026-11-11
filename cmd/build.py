#!/usr/bin/env python3
"""Bundles the dashboard's scripts so each page loads 3 files instead of ~30.

    python3 cmd/build.py          build cmd/dist/*.js and point the pages at them
    python3 cmd/build.py --check  exit 1 if a bundle is out of date (run before committing)

The source files stay where they are – edit those, never cmd/dist/.
Which files each page uses, and in which order, is in cmd/scripts.json:
  head  – loaded first on every page (language, lock, features)
  tail  – loaded last on every page (search, quick add, notifications, menu …)
  pages – what each page loads in between
Each file is wrapped so an error in one can't stop the others, like separate files. """
import hashlib, io, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(io.open(os.path.join(HERE, 'scripts.json'), encoding='utf-8'))
DIST = os.path.join(HERE, 'dist')
check = '--check' in sys.argv


ESBUILD = None if os.environ.get('NOMINIFY') else next((x for x in [os.environ.get('ESBUILD'), '/opt/npm-tools/node_modules/esbuild/bin/esbuild', shutil.which('esbuild')] if x and os.path.exists(x)), None)


def minify(text):
    """Smaller files load and start faster on a phone. Uses esbuild when it's installed;
    without it the bundles stay readable (and work the same)."""
    if not ESBUILD:
        return text
    r = subprocess.run([ESBUILD, '--minify', '--loader=js', '--charset=utf8', '--legal-comments=none', '--target=es2018'],
                       input=text.encode('utf-8'), capture_output=True)
    if r.returncode:
        sys.stderr.write(r.stderr.decode('utf-8', 'replace')); sys.exit('minify failed')
    return '/* Built by cmd/build.py – edit the source files listed in cmd/scripts.json, not this one. */\n' + r.stdout.decode('utf-8')


def bundle(files):
    out = ['/* Built by cmd/build.py from: ' + ', '.join(files) + ' – edit those files, not this one. */']
    for f in files:
        src = io.open(os.path.join(HERE, f), encoding='utf-8').read()
        out.append('/* ===== %s ===== */\ntry {\n%s\n} catch (e) { console.error(%s, e); if (window.__dlog) window.__dlog(e, %s); }' % (f, src.rstrip(), json.dumps(f), json.dumps(f)))
    return minify('\n'.join(out) + '\n')


def write(name, text):
    path = os.path.join(DIST, name)
    old = io.open(path, encoding='utf-8').read() if os.path.exists(path) else None
    if old != text:
        if check:
            print('out of date:', name); return None
        os.makedirs(DIST, exist_ok=True)
        io.open(path, 'w', encoding='utf-8').write(text)
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:10]


# Settings everywhere: the panel's markup is written once in index.html and copied into every other
# page (links made absolute), and its scripts go into every page's bundle – so the avatar opens
# Settings right where you are instead of going to the dashboard first.
HOME = io.open(os.path.join(HERE, 'index.html'), encoding='utf-8').read()
_m = re.search(r'  <!-- Settings -->\n(.*?)\n\n  <!-- scripts: built', HOME, re.S)
if not _m: sys.exit('no <!-- Settings --> block in index.html')
def _abs(m):
    u = m.group(2)
    if re.match(r'(/|#|[a-z]+:|\.\./)', u): return m.group(0)
    return '%s="/cmd/%s"' % (m.group(1), u)
SETTINGS = ('  <!-- settings: copied from index.html by cmd/build.py – edit it there -->\n' +
            re.sub(r'(href|src)="([^"]*)"', _abs, _m.group(1)) + '\n  <!-- /settings -->\n\n')
SET_JS = M.get('settings', [])

stale = False
head_v = write('head.js', bundle(M['head']))
tail_v = write('tail.js', bundle(M['tail']))
stale |= head_v is None or tail_v is None
for page, files in M['pages'].items():
    name = 'page-' + (os.path.dirname(page) or 'home') + '.js'
    if os.path.dirname(page): files = files + [f for f in SET_JS if f not in files]
    v = write(name, bundle(files))
    if v is None: stale = True; continue
    html_path = os.path.join(HERE, page)
    html = io.open(html_path, encoding='utf-8').read()
    pre = '../' if os.path.dirname(page) else ''
    block = ('  <!-- scripts: built by cmd/build.py from cmd/scripts.json -->\n'
             '  <script src="%sdist/head.js?v=%s"></script>\n'
             '  <script src="%sdist/%s?v=%s"></script>\n'
             '  <script src="%sdist/tail.js?v=%s"></script>\n'
             '  <!-- /scripts -->\n') % (pre, head_v, pre, name, v, pre, tail_v)
    new = re.sub(r'  <!-- scripts: built by cmd/build\.py[^\n]*-->\n(?:.*\n)*?  <!-- /scripts -->\n', lambda m: block, html)
    if os.path.dirname(page):
        new = re.sub(r'  <!-- settings: copied.*?<!-- /settings -->\n\n', '', new, flags=re.S)
        new = new.replace('  <!-- scripts: built by cmd/build.py', SETTINGS + '  <!-- scripts: built by cmd/build.py', 1)
    if new == html and '<!-- scripts:' not in html:
        print('no script block in', page); stale = True; continue
    if new != html:
        if check: print('out of date:', page); stale = True
        else: io.open(html_path, 'w', encoding='utf-8').write(new)

# ---------- version numbers, stamped from the file contents (no hand bumps) ----------
# Every local file a page loads with "?v=" gets the first 10 characters of its content's hash, the service worker's
# CACHE name is the hash of everything under cmd/, and the shared app's APPV counts up by one whenever its files change.
ROOT = os.path.dirname(HERE)
def _h(data): return hashlib.sha1(data).hexdigest()[:10]
def _local(html_path, url):
    u = url.split('#')[0]
    if re.match(r'[a-z]+:', u) or u.startswith('//'): return None
    p = os.path.join(ROOT, u.lstrip('/')) if u.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(html_path), u))
    return p if os.path.isfile(p) else None
def _save(path, old, new):
    global stale
    if new == old: return
    if check: print('out of date (version):', os.path.relpath(path, ROOT)); stale = True
    else: io.open(path, 'w', encoding='utf-8').write(new)
HTML = []
for d, _, fs in os.walk(HERE):
    if os.sep + 'dist' in d or os.sep + 'node_modules' in d: continue
    HTML += [os.path.join(d, f) for f in fs if f.endswith('.html')]
for hp in sorted(HTML):
    html = io.open(hp, encoding='utf-8').read()
    def _stamp(m):
        if m.group(2).endswith('home/app.js'): return m.group(0)     # the shared app keeps its counting number (below)
        f = _local(hp, m.group(2))
        return m.group(0) if not f else '%s="%s?v=%s"' % (m.group(1), m.group(2), _h(open(f, 'rb').read()))
    _save(hp, html, re.sub(r'(src|href)="([^"?]+)\?v=[^"]*"', _stamp, html))
# the shared app: its version goes up by one when any of its files change (it compares numbers to know "newer")
HV = os.path.join(HERE, 'home', 'version.json'); APPJS = os.path.join(HERE, 'home', 'app.js'); HIDX = os.path.join(HERE, 'home', 'index.html')
hv = json.load(io.open(HV)) if os.path.exists(HV) else None
appjs = io.open(APPJS, encoding='utf-8').read(); hidx = io.open(HIDX, encoding='utf-8').read()
cur = int(re.search(r'var APPV = (\d+);', appjs).group(1))
parts = [re.sub(r'var APPV = \d+;', '', appjs), re.sub(r'home/app\.js\?v=\d+', '', hidx)]
for f in ['home/app.css', 'avatar.js', 'avatar-rig.js', 'scene-kit.js', 'avatar-page.js', 'share-core.js', 'chat.js']: parts.append(io.open(os.path.join(HERE, f), encoding='utf-8').read())
hh = _h('\n'.join(parts).encode('utf-8'))
if not hv: hv = {'n': cur, 'hash': hh}
n = hv['n'] + (1 if hv['hash'] != hh else 0)
_save(APPJS, appjs, re.sub(r'var APPV = \d+;', 'var APPV = %d;' % n, appjs))
_save(HIDX, hidx, re.sub(r'home/app\.js\?v=\d+', 'home/app.js?v=%d' % n, hidx))
newhv = json.dumps({'n': n, 'hash': hh}) + '\n'
_save(HV, io.open(HV, encoding='utf-8').read() if os.path.exists(HV) else '', newhv)
# the service worker's cache name: changes whenever anything under cmd/ changes, so every device picks up the new version
SW = os.path.join(HERE, 'sw.js'); sw = io.open(SW, encoding='utf-8').read(); acc = hashlib.sha1()
for d, ds, fs in os.walk(HERE):
    ds.sort()                                   # the same order on every machine (GitHub's disk lists folders differently)
    if os.sep + 'node_modules' in d: continue
    for f in sorted(fs):
        fp = os.path.join(d, f)
        if fp == SW or f.endswith(('.md', '.py')): continue
        acc.update(os.path.relpath(fp, HERE).replace(os.sep, '/').encode()); acc.update(open(fp, 'rb').read())
_save(SW, sw, re.sub(r"var CACHE = '[^']*';", "var CACHE = 'cmd-v%s';" % acc.hexdigest()[:10], sw))

if check:
    print('bundles or versions are out of date – run python3 cmd/build.py' if stale else 'bundles and versions are up to date')
    sys.exit(1 if stale else 0)
print('built', 2 + len(M['pages']), 'bundles, stamped versions')
