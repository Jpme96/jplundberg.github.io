/* Texts by name (Phase D 24): every data-t / data-t-<attribute> name used in cmd has its [English, Norwegian] in
   cmd/words/*.nb.js, the English written next to a name is the English stored under it (change one, change both),
   and the old list of English sentences (i18n-nb.js) only gets smaller. Made-up data: none needed. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const DIR = path.join(__dirname, '../../cmd');
const OLD_KB = 243;      /* i18n-nb.js after naming every page's texts (2026-11-11: 253; 2026-11-13 evening: 243) – lower it as more move over, never raise it */
(async () => {
  const W = {};
  global.I18N = { add: o => Object.assign(W, o) };
  for (const f of fs.readdirSync(path.join(DIR, 'words'))) if (f.endsWith('.nb.js')) new Function('I18N', fs.readFileSync(path.join(DIR, 'words', f), 'utf8'))(global.I18N);
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (/dist|node_modules|words|vendor/.test(f)) continue; if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html)$/.test(f) && f !== 'i18n-nb.js') files.push(p); } })(DIR);
  const missing = new Set(), drift = [];
  let used = 0;
  for (const p of files) {
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/data-t(?:-[a-z-]+)?=\\?"([a-z][\w.-]*)\\?"/g)) { used++; if (!W[m[1]]) missing.add(m[1]); }
    /* names used in scripts, also through a short alias (var K = I18N.k; K('ui.x', 'English')) – a prune once took 11 of those out (2026-11-13) */
    for (const m of s.matchAll(/(?:I18N\.k|\bK)\(\s*'((?:ui|home)\.[\w.-]+)'\s*,/g)) { used++; if (!W[m[1]]) missing.add(m[1]); }
    /* <tag data-t="k" …>English< : the English must be the stored one */
    for (const m of s.matchAll(/data-t="([\w.-]+)"[^<>]*>\s*([^<>]+?)\s*</g)) {
      const w = W[m[1]], en = m[2].replace(/&amp;/g, '&');
      if (w && Array.isArray(w) && en !== w[0] && !/['"+]/.test(en)) drift.push(path.relative(DIR, p) + ': ' + m[1] + ' says “' + en + '”, stored “' + w[0] + '”');
    }
  }
  check(used > 1000 && !missing.size, used + ' named texts; every name has its words ' + [...missing].slice(0, 5).join(', '));
  check(!drift.length, 'the English next to a name is the stored English ' + drift.slice(0, 4).join(' | '));
  const bad = Object.entries(W).filter(([k, v]) => !Array.isArray(v) || v.length !== 2 || !v[0] || !v[1] || /undefined|NaN|null/.test(v[1]));
  check(!bad.length, Object.keys(W).length + ' names, each with English and Norwegian ' + bad.slice(0, 3).map(x => x[0]).join(', '));
  const kb = Math.round(fs.statSync(path.join(DIR, 'i18n-nb.js')).size / 1024);
  check(kb <= OLD_KB, 'the old sentence list is ' + kb + ' kB (at most ' + OLD_KB + ' – it only shrinks)');
  await done();
})();
