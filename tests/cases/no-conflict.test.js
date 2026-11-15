/* No merge leftovers: a line starting with <<<<<<<, ======= between them, or >>>>>>> in any file we ship or test.
   (2026-11-15: one left in cmd/sw.js stopped the service worker from installing – lastgood caught it late.) */
const fs = require('fs'), path = require('path');
const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '../..');
const SKIP = new Set(['node_modules', '.git', '.tmp', 'pictures']);
const bad = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const f = path.join(d, n), st = fs.statSync(f);
    if (st.isDirectory()) walk(f);
    else if (/\.(js|mjs|html|css|json|jsonc|md|py)$/.test(n) && st.size < 4e6) {
      const s = fs.readFileSync(f, 'utf8');
      if (/^(<{7}|>{7}) /m.test(s) || /^<{7}$|^>{7}$/m.test(s)) bad.push(path.relative(ROOT, f));
    }
  }
})(ROOT);
check(!bad.length, 'no merge conflict markers left in the code ' + bad.join(', '));
done();
