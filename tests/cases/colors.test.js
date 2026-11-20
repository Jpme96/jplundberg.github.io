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
  /* scripts (2026-11-19, plan Part 3 A2): where these files draw a colour into style="--c:…" it goes through Tok(), which
     turns a status hex into its token; the list may only grow */
  const viaTok = ['brief.js', 'kit.js', 'pagetabs.js', 'review.js', 'home-life.js', 'daily.js'];
  const raw = [];
  for (const f of viaTok) {
    const js = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const m of js.matchAll(/style=\\?"--c:' \+ (?!Tok\(|esc\(Tok\()([^+]+)\+/g)) raw.push(f + ': ' + m[1].trim());
  }
  check(!raw.length, 'colours drawn by scripts go through Tok() (light/dark tokens) ' + raw.slice(0, 4).join(' | '));
  /* and these files use the status tokens, never the status hex (2026-11-20 – the list may only grow) */
  const noHex = ["finance/fin-plan.js", "tools.js", "house-proj.js", "papers.js", "house-docs.js", "house-claims.js", "health-plus.js", "admin-clean.js", "life.js", "life-pages.js", "home-life.page.js", "finance/fin-now.js", "fin-tools.js", "budget.js", "wish.js", "life-more.js", "house-energy.js", "ahealth.js", "people-plus.js", "money-plus.page.js", "house-claims.page.js", "home-shared.page.js", "home-more.js", "goals.js", "wish.page.js", "people-plus.page.js", "house-proj.page.js", "house-move.js", "goals.page.js", "finance/fin-now2.js", "travel/trips.js", "travel/history.js", "money-plus.js", "life-pages.page.js", "house-plus.js", "house-homes.page.js"];
  const hexLeft = [];
  for (const f of noHex) { const js = fs.readFileSync(path.join(DIR, f), 'utf8'); if (/['"]#(22b35e|c98500|e66767|e8743b|3987e5|d9a400|c9a227|d55181|8a6fdf|5b6470)['"]/i.test(js)) hexLeft.push(f); }
  check(!hexLeft.length, 'status colours in scripts are tokens ' + hexLeft.join(', '));
  await done();
})();
