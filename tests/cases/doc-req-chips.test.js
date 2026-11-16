/* Document requirements → project types (JP 2026-11-16 13:08: a type tapped again stayed on). A second tap turns the
   type off and unticks the systems only it ticked; systems another chosen type also wants stay ticked. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; delete t.dcTeamAt; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('req')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-drnew]').click()); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-drform]'); f.name.value = 'Made-up block'; f.requestSubmit(); }); await sl(800);
  const st = id => p.evaluate(i => ({ on: document.querySelector('[data-dcptype="' + i + '"]').getAttribute('aria-pressed'), n: document.querySelectorAll('[data-dctick]:checked').length, ticked: [...document.querySelectorAll('[data-dctick]:checked')].map(e => e.dataset.dctick) }), id);
  const tap = id => p.evaluate(i => document.querySelector('[data-dcptype="' + i + '"]').click(), id).then(() => sl(200));
  const ids = await p.evaluate(() => [...document.querySelectorAll('[data-dcptype]')].map(e => e.dataset.dcptype));
  const bad = [];
  for (const id of ids) { const a = await st(id); await tap(id); const on = await st(id); await tap(id); const off = await st(id); if (!(on.on === 'true' && off.on === 'false' && off.n === a.n)) bad.push([id, a.n, on.on, on.n, off.on, off.n]); }
  check(ids.length > 20 && !bad.length, 'every project type turns on, and off again with a second tap, unticking its systems ' + JSON.stringify(bad));
  /* two types sharing a system: turning one off keeps what the other wants */
  await tap('sprinkler'); await tap('fire'); const both = await st('fire'); await tap('sprinkler'); const left = await st('fire');
  const sp = await p.evaluate(() => [...document.querySelectorAll('[data-dctick]')].filter(e => /^33/.test(e.dataset.dctick)).map(e => e.dataset.dctick + (e.checked ? '+' : '-')));
  check(both.on === 'true' && left.on === 'true' && left.n > 0 && left.n <= both.n, 'turning one type off keeps the systems another chosen type ticked ' + JSON.stringify({ both: both.n, left: left.n, sp }));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
