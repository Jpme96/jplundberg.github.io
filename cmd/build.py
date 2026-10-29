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
        out.append('/* ===== %s ===== */\ntry {\n%s\n} catch (e) { console.error(%s, e); }' % (f, src.rstrip(), json.dumps(f)))
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


stale = False
head_v = write('head.js', bundle(M['head']))
tail_v = write('tail.js', bundle(M['tail']))
stale |= head_v is None or tail_v is None
for page, files in M['pages'].items():
    name = 'page-' + (os.path.dirname(page) or 'home') + '.js'
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
    if new == html and '<!-- scripts:' not in html:
        print('no script block in', page); stale = True; continue
    if new != html:
        if check: print('out of date:', page); stale = True
        else: io.open(html_path, 'w', encoding='utf-8').write(new)

if check:
    print('bundles are out of date – run python3 cmd/build.py' if stale else 'bundles are up to date')
    sys.exit(1 if stale else 0)
print('built', 2 + len(M['pages']), 'bundles')
