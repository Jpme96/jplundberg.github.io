#!/usr/bin/env python3
"""The icons cmd actually uses, instead of all ~2 000 Bootstrap Icons.

    python3 cmd/icons.py          write cmd/assets/bi/bi.css and bi.woff2 (needs fonttools + brotli)
    python3 cmd/icons.py --check  exit 1 if an icon used in cmd is missing from the set

Which icons: every bi-NAME in cmd's scripts and pages, every quoted 'NAME' that is an icon (icon: 'house-gear'),
and – because names are often built from parts ('bi-bell' + '-slash') – every icon that starts with one of those.
The website (jplundberg.com) keeps the full set in /assets/vendor/bootstrap-icons/. """
import hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'assets', 'vendor', 'bootstrap-icons')
OUT = os.path.join(HERE, 'assets', 'bi')

def used():
    names = json.load(open(os.path.join(SRC, 'bootstrap-icons.json')))      # name -> codepoint
    found = set()
    for root, dirs, files in os.walk(HERE):
        if '/dist' in root or '/assets' in root or '/vendor' in root: continue   # vendor: other people's libraries (the PDF tools)
        for f in files:
            if not f.endswith(('.js', '.html', '.css')): continue
            t = open(os.path.join(root, f), encoding='utf-8').read()
            for m in re.finditer(r'bi-([a-z0-9-]+)', t): found.add(m.group(1))
            for m in re.finditer(r"['\"]([a-z0-9-]{1,40})['\"]", t):
                if m.group(1) in names: found.add(m.group(1))
    keep = set()
    for n in names:
        for f in found:
            if n == f or n.startswith(f.rstrip('-') + '-'): keep.add(n); break
    return names, keep

def main():
    names, keep = used()
    if '--check' in sys.argv:
        css = open(os.path.join(OUT, 'bi.css')).read() if os.path.exists(os.path.join(OUT, 'bi.css')) else ''
        have = set(re.findall(r'\.bi-([a-z0-9-]+)::before', css))
        miss = sorted(keep - have)
        if miss: print('missing icons:', ', '.join(miss[:30])); sys.exit(1)
        print('icon set is up to date (%d icons)' % len(have)); return
    from fontTools import subset
    from fontTools.ttLib import TTFont
    os.makedirs(OUT, exist_ok=True)
    cps = [names[n] for n in sorted(keep)]
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True
    font = TTFont(os.path.join(SRC, 'fonts', 'bootstrap-icons.woff2'))
    s = subset.Subsetter(opts); s.populate(unicodes=cps); s.subset(font)
    font.flavor = 'woff2'; font.save(os.path.join(OUT, 'bi.woff2'))
    head = open(os.path.join(SRC, 'bootstrap-icons.css')).read()
    base = head[head.index('.bi::before'):head.index('.bi-', head.index('}', head.index('.bi::before')))]
    ver = hashlib.md5(','.join(sorted(keep)).encode()).hexdigest()[:10]
    css = ('/* Bootstrap Icons v1.11.3 (MIT) – only the %d icons cmd uses. Built by cmd/icons.py – don’t edit. */\n' % len(keep) +
           '@font-face{font-display:block;font-family:"bootstrap-icons";src:url("bi.woff2?%s") format("woff2")}\n' % ver +
           re.sub(r'\s+', ' ', base).strip() + '\n' +
           ''.join('.bi-%s::before{content:"\\%x"}\n' % (n, names[n]) for n in sorted(keep)))
    open(os.path.join(OUT, 'bi.css'), 'w').write(css)
    # point every cmd page at this set (versioned, so the app's cache picks up a new set)
    for root, dirs, files in os.walk(HERE):
        if '/dist' in root or '/assets' in root or '/vendor' in root: continue   # vendor: other people's libraries (the PDF tools)
        for f in files:
            if f != 'index.html': continue
            fp = os.path.join(root, f); t = open(fp, encoding='utf-8').read()
            t2 = re.sub(r'<link href="/(?:assets/vendor/bootstrap-icons/bootstrap-icons|cmd/assets/bi/bi)\.css(?:\?v=[0-9a-f]+)?" rel="stylesheet">', '<link href="/cmd/assets/bi/bi.css?v=%s" rel="stylesheet">' % ver, t)
            if t2 != t: open(fp, 'w', encoding='utf-8').write(t2)
    print('%d of %d icons · bi.woff2 %d kB · bi.css %d kB' % (len(keep), len(names), os.path.getsize(os.path.join(OUT, 'bi.woff2')) // 1024, len(css) // 1024))

if __name__ == '__main__': main()
