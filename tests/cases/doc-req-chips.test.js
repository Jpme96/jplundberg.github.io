/* Document requirements → project types (JP 2026-11-16 13:08: a type tapped again stayed on). A second tap turns the
   type off and unticks the systems only it ticked; systems another chosen type also wants stay ticked. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; delete t.dcTeamAt; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('req')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcnew]').click()); await sl(300);   /* New project lands on the picker in step 1 (JP 2026-11-24) */
  await p.evaluate(() => { const f = document.querySelector('form[data-dcpform]'); f.name.value = 'Made-up block'; f.requestSubmit(); }); await sl(800);
  const st = id => p.evaluate(i => ({ on: document.querySelector('.dc-ptg [data-dcptype="' + i + '"]').getAttribute('aria-pressed'), n: document.querySelectorAll('[data-dctick]:checked').length, ticked: [...document.querySelectorAll('[data-dctick]:checked')].map(e => e.dataset.dctick) }), id);
  const tap = id => p.evaluate(i => document.querySelector('.dc-ptg [data-dcptype="' + i + '"]').click(), id).then(() => sl(200));
  const ids = await p.evaluate(() => [...document.querySelectorAll('.dc-ptg [data-dcptype]')].map(e => e.dataset.dcptype));
  const bad = [];
  for (const id of ids) { const a = await st(id); await tap(id); const on = await st(id); await tap(id); const off = await st(id); if (!(on.on === 'true' && off.on === 'false' && off.n === a.n)) bad.push([id, a.n, on.on, on.n, off.on, off.n]); }
  const openLeft = await p.evaluate(() => document.querySelectorAll('details.dc-pg[open]').length);
  check(openLeft === 0, 'with no type picked, every system group is folded again (JP 14:30) – open: ' + openLeft);
  await tap('bath'); const opened = await p.evaluate(() => [...document.querySelectorAll('details.dc-pg')].every(d => d.open === !!d.querySelector('[data-dctick]:checked')));
  await tap('bath'); const closed = await p.evaluate(() => document.querySelectorAll('details.dc-pg[open]').length);
  check(opened && closed === 0, 'a type opens exactly the groups it ticks, and taking it off folds them ' + JSON.stringify({ opened, closed }));
  check(ids.length > 20 && !bad.length, 'every project type turns on, and off again with a second tap, unticking its systems ' + JSON.stringify(bad));
  /* two types sharing a system: turning one off keeps what the other wants */
  await tap('sprinkler'); await tap('fire'); const both = await st('fire'); await tap('sprinkler'); const left = await st('fire');
  const sp = await p.evaluate(() => [...document.querySelectorAll('[data-dctick]')].filter(e => /^33/.test(e.dataset.dctick)).map(e => e.dataset.dctick + (e.checked ? '+' : '-')));
  check(both.on === 'true' && left.on === 'true' && left.n > 0 && left.n <= both.n, 'turning one type off keeps the systems another chosen type ticked ' + JSON.stringify({ both: both.n, left: left.n, sp }));
  /* lighter (JP 13:48): a tap changes only what it touches – the system boxes stay the same elements, no redraw */
  await p.evaluate(() => { window.__box = document.querySelector('[data-dctick]'); });
  await tap('bath');
  const light = await p.evaluate(() => ({ same: window.__box === document.querySelector('[data-dctick]'), rows: document.querySelectorAll('.dc-ptg [data-dcptg]').length, sum: (document.querySelector('[data-dcpsum]') || {}).textContent || '' }));
  check(light.same && light.rows >= 6 && /Bathroom renovation/.test(light.sum) && /systems/.test(light.sum), 'a tap updates in place; types sit in rows; the picked line shows the type and the count ' + JSON.stringify(light));
  await p.evaluate(() => document.querySelector('[data-dcpsum] [data-dcptype="bath"]').click()); await sl(200);
  check(await p.evaluate(() => document.querySelector('.dc-ptg [data-dcptype="bath"]').getAttribute('aria-pressed') === 'false'), 'the × in the picked line takes the type off');
  await p.evaluate(() => { const q = document.querySelector('[data-dcpq]'); q.value = 'sprink'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await sl(150);
  const found = await p.evaluate(() => [...document.querySelectorAll('.dc-ptg [data-dcptype]')].filter(b => !b.hidden && b.offsetParent).map(b => b.dataset.dcptype));
  check(found.join() === 'sprinkler', 'the search finds a project type ' + found.join());
  await p.evaluate(() => { const q = document.querySelector('[data-dcpq]'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
  /* a long list opens folded per NS group, and only open groups are drawn */
  await p.evaluate(() => { [...document.querySelectorAll('.dc-ptg [data-dcptype][aria-pressed="true"]')].forEach(b => b.click()); }); await sl(200);
  await tap('new'); await p.evaluate(() => document.querySelector('[data-dcmake="req"]').click()); await sl(1200);
  await p.evaluate(() => { const b = document.querySelector('[data-dckin]'); b && b.click(); }); await sl(800);   /* in the project: Change the requirements shows the whole list */
  const fold = await p.evaluate(() => ({ lines: Features.list('dckrav')[0].lines.length, groups: document.querySelectorAll('details.dc-fold').length, open: document.querySelectorAll('details.dc-fold[open]').length, drawn: document.querySelectorAll('.dr-line').length, dbg: [location.hash, !!document.querySelector('[data-dckin]'), !!document.querySelector('[data-dckinx]'), document.querySelectorAll('.dc-flist2 li').length].join(), sub: (document.querySelector('.dc-fold summary small') || {}).textContent || '' }));
  check(fold.lines > 40 && fold.groups >= 5 && fold.open === 0 && fold.drawn === 0 && /systems/.test(fold.sub), 'a long list is folded per group with counts, nothing drawn until opened ' + JSON.stringify(fold));
  await p.evaluate(() => { const d = document.querySelector('details.dc-fold'); d.open = true; }); await sl(400);
  const one = await p.evaluate(() => ({ open: document.querySelectorAll('details.dc-fold[open]').length, drawn: document.querySelectorAll('.dr-line').length }));
  check(one.open === 1 && one.drawn > 0, 'opening a group draws its lines ' + JSON.stringify(one));
  await p.evaluate(() => document.querySelector('[data-dcgall]').click()); await sl(500);
  const all = await p.evaluate(() => ({ g: document.querySelectorAll('details.dc-fold').length, open: document.querySelectorAll('details.dc-fold[open]').length, drawn: document.querySelectorAll('.dr-line').length, n: Features.list('dckrav')[0].lines.length }));
  check(all.open === all.g && all.drawn === all.n, 'Open all groups draws every line ' + JSON.stringify(all));
  /* help texts: one line until tapped */
  await p.evaluate(() => document.querySelector('[data-drsend]').click()); await sl(300);   /* the long help is in the Send sheet now */
  const hp = await p.evaluate(() => { const h = document.querySelector('.dc-help.dc-clamp'); if (!h) return null; const a = h.offsetHeight; h.click(); const b = h.offsetHeight; return { a, b, more: h.classList.contains('dc-more') }; });
  check(hp && hp.more && hp.b > hp.a, 'a long help text shows one line and opens when tapped ' + JSON.stringify(hp));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
