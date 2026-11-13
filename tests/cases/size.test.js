/* The app may not quietly get heavier: what each cmd page loads (scripts, gzip-free bytes) stays under its budget.
   Budgets are today's sizes plus a little room; lower them as the app gets lighter. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '..', '..', 'cmd');
const BUDGET_KB = { total: 1626 };   /* +8 (2026-11-13): the avatar's new face – eyes with iris and lids, tapered brows, a nose shaped by light, two lips, a profile – and room for the hair, beards and mouth shapes that follow */   /* +6 (2026-11-13): the avatar's anatomy pass – teardrop shoulders, a jaw and chin, the back's details */      /* biggest page today ≈ 1589 kB (Finances; head + page + tail, the Norwegian words load only in Norwegian) */
/* each page on its own (Phase D 25: a page loads only its own code) – lower a page's number when it gets lighter */
/* +25 kB on every page (2026-11-12, F1b): the 2.5D figure (avatar-25d.js) and its small moves are in tail next to the old flat drawing; the old
   drawing code goes in F4 and these budgets come down again then.
   +2–9 kB on the pages with a scene (2026-11-12, F2): the 2.5D scene engine (scene25.js) in their bundle, next to the old engine until F4.
   −83 kB on every page (2026-11-12, D 25): Papers, Work, Habits (water), Goals, Wishlist and House chores load their page parts only on their page.
   −100 kB on every page (2026-11-12, F4): the old engine (scene-kit, avatar-rig, scene-common) and the flat drawing are gone; scene25.js is in tail
   now (the avatar page's "See it move" uses it on every page).
   +4 kB on every page (2026-11-12, F3): the everyday actions (wave, stretch, the time, a look round, coffee, umbrella, flag) in scene25.js.
   +1–3 kB on the scene pages (2026-11-12, F3 part 2): each page's own actions (a video call, the bottle, dusting, a note, a sit on the rock, the bench …), long press, looking at your finger.
   +25 kB on every page (2026-11-12, D 24): texts by name – the pieces of text between tags got their own named span and the labels passed to helpers became I18N.k(name, English); the old sentence list (Norwegian only) shrank by 9 kB.
   −220 kB on the pages that don't draw them (2026-11-12, F4 home-life split): home-life, people-plus, food-plus, money-plus, fin-tools, home-shared and
   life-pages load their page parts only on House, People, Food, Work, Finances, Habits, Travel and Wishlist (test home-split).
   +1 kB on some pages (2026-11-12, F4 faster frames): scene25's patch() – a frame is built off the page and only the changes are written.
   +5–6 kB on every page, +10 on Travel (2026-11-12, F3 extras): the season props and walks (tree, pumpkin) and the taps on things in scene25.js;
   Travel's packing and map.
   +4–5 kB on every page (2026-11-12 night, D 24): the choices in lists, the Settings summaries and the counts as I18N.k(name, English, {n}).
   +1 kB on Food and People (2026-11-12 night): night actions, muscles and face shapes in the figure, the whole plane.
   +1 kB on most pages (2026-11-12 night): the six-pack and obliques on a bare athletic or muscular body.
   +1–4 kB on the scene pages (2026-11-13): the last F3 actions (price tag, cart, call, ball, heart note, star sticker, done for the day, stamp, the smaller climber, taste and salt, the shelf, polish, piggy bank, payday bag, passport). */
const PAGE_KB = { 'index.html': 1395, 'admin/index.html': 1317, 'calendar/index.html': 1246, 'finance/index.html': 1626, 'food/index.html': 1330, 'goals/index.html': 1262, 'habits/index.html': 1306, 'house/index.html': 1616, 'papers/index.html': 1277, 'people/index.html': 1328, 'travel/index.html': 1402, 'wish/index.html': 1345, 'work/index.html': 1370 };
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
