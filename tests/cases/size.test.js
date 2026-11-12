/* The app may not quietly get heavier: what each cmd page loads (scripts, gzip-free bytes) stays under its budget.
   Budgets are today's sizes plus a little room; lower them as the app gets lighter. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '..', '..', 'cmd');
const BUDGET_KB = { total: 1745 };      /* biggest page today ≈ 1 740 kB (Finances; head + page + tail, the Norwegian words load only in Norwegian) */
/* each page on its own (Phase D 25: a page loads only its own code) – lower a page's number when it gets lighter */
/* +25 kB on every page (2026-11-12, F1b): the 2.5D figure (avatar-25d.js) and its small moves are in tail next to the old flat drawing; the old
   drawing code goes in F4 and these budgets come down again then.
   +2–9 kB on the pages with a scene (2026-11-12, F2): the 2.5D scene engine (scene25.js) in their bundle, next to the old engine until F4.
   −83 kB on every page (2026-11-12, D 25): Papers, Work, Habits (water), Goals, Wishlist and House chores load their page parts only on their page. */
const PAGE_KB = { 'index.html': 1645, 'admin/index.html': 1570, 'calendar/index.html': 1505, 'finance/index.html': 1749, 'food/index.html': 1513, 'goals/index.html': 1518, 'habits/index.html': 1516, 'house/index.html': 1674, 'papers/index.html': 1532, 'people/index.html': 1499, 'travel/index.html': 1608, 'wish/index.html': 1519, 'work/index.html': 1524 };
const pages = ['index.html'].concat(fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'index.html')) && d !== 'home').map(d => d + '/index.html'));
let worst = 0;
for (const pg of pages) {
  const html = fs.readFileSync(path.join(ROOT, pg), 'utf8'), dir = path.dirname(path.join(ROOT, pg));
  const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  const kb = Math.round(srcs.reduce((a, s) => { const f = s.startsWith('/') ? path.join(ROOT, '..', s) : path.join(dir, s); return a + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0) / 1024);
  worst = Math.max(worst, kb);
  const bud = Math.min(BUDGET_KB.total, PAGE_KB[pg] || BUDGET_KB.total);
  check(kb <= bud, pg + ': ' + kb + ' kB of scripts (budget ' + bud + ')');
}
console.log('  heaviest page: ' + worst + ' kB');
done();
