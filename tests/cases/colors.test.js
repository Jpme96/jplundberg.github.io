/* Colours as tokens (Phase D 26): light and dark come from one set of named colours.
   - the only theme selectors are the token blocks (:root and :root[data-theme="light"], and modern.css's own pair)
   - the status colours are used by name (var(--ok), var(--warn), var(--danger) …), never as a hex code
   - no token is defined as itself (that makes it empty)
   A new difference between light and dark = a token in both blocks, not a [data-theme="light"] rule. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const DIR = path.join(__dirname, '../../cmd');
const NAMED = { '22b35e': 'ok', 'c98500': 'warn', 'e66767': 'danger', 'e8743b': 'orange', '3987e5': 'blue', 'd9a400': 'gold', 'd55181': 'pink', '8a6fdf': 'violet', '5b6470': 'slate' };
(async () => {
  for (const f of ['styles.css', 'modern.css', 'sidenav.css']) {
    const css = fs.readFileSync(path.join(DIR, f), 'utf8');
    const outside = css.replace(/\/\* tokens \*\/[\s\S]*?\/\* \/tokens \*\//g, '');
    const theme = (css.match(/[^{}]*\[data-theme[^{]*\{/g) || []).map(s => s.trim()).filter(s => !/^:root(\.modern)?\[data-theme="light"\] \{$/.test(s.replace(/^\/\*[\s\S]*?\*\/\s*/, '')));
    check(!theme.length, f + ': light/dark differences live only in the token blocks ' + JSON.stringify(theme.slice(0, 3)));
    const hex = Object.keys(NAMED).filter(h => new RegExp('#' + h + '\\b', 'i').test(outside));
    check(!hex.length, f + ': status colours by name, not as hex ' + hex.map(h => '#' + h + ' → var(--' + NAMED[h] + ')').join(', '));
    const self = css.match(/--([a-z0-9-]+):\s*var\(--\1\)/g) || [];
    check(!self.length, f + ': no token is defined as itself ' + self.join(', '));
  }
  /* both themes define the same set (a token only light changes is fine; one only light has needs a dark value or a fallback) */
  const st = fs.readFileSync(path.join(DIR, 'styles.css'), 'utf8');
  const block = (re) => { const m = st.match(re); return m ? new Set((m[1].match(/--[a-z0-9-]+(?=\s*:)/g) || [])) : new Set(); };
  const dark = block(/:root \{([\s\S]*?)\n\}/), light = block(/:root\[data-theme="light"\] \{([\s\S]*?)\n\}/);
  const onlyLight = [...light].filter(k => !dark.has(k) && !new RegExp('var\\(' + k + ',').test(st));
  check(dark.size > 40 && !onlyLight.length, dark.size + ' tokens in the dark set; every light one has a dark value or a fallback ' + onlyLight.join(', '));
  await done();
})();
