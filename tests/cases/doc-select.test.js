/* Tick several (JP 2026-11-21): Received → Documents: select lines, one status or one deadline for all, Undo puts
   them back; Received → Files: remove several files at once; Requirements: remove several lines, or mark them
   "only if in the contract". Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { ['work', 'fdv'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools();
    t.dctl = [{ id: 'dcs1', name: 'Made-up school', no: 'P-1', made: '2026-11-01', lines: [{ id: 'l1', code: '320', t: 'A', st: 'missing' }, { id: 'l2', code: '360', t: 'D', st: 'missing' }, { id: 'l3', code: '442', t: 'E', st: 'missing' }],
      files: [{ id: 'f1', name: '320 DA Made-up one.pdf', size: 10 }, { id: 'f2', name: '360 DV Made-up two.pdf', size: 10 }, { id: 'f3', name: 'Made-up three.pdf', size: 10 }] }];
    t.dckrav = [{ id: 'ks1', name: 'Made-up block D', made: '2026-11-16T10:00:00Z', lines: [{ id: 'a', code: '332', t: 'A' }, { id: 'b', code: '332', t: 'BC' }, { id: 'c', code: '442', t: 'E' }] }];
    Features.saveTools(t); });
  await sl(600);
  await go(p, 'work/#dc=dcs1', 3500);
  const tap = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel).then(r => sl(350).then(() => r));
  const st = () => p.evaluate(() => Features.list('dctl')[0].lines.map(l => l.st + (l.due ? '@' + l.due : '')).join());

  /* Documents */
  await tap('[data-dctab="docs"]');
  check(await tap('[data-dcsel^="d:"]'), 'Documents has "Select several"');
  await tap('[data-dcpick="l1"]'); await tap('[data-dcpick="l3"]');
  const bar = await p.evaluate(() => { const b = document.querySelector('.dc-selbar'); return b && { t: b.textContent, open: !!document.querySelector('[data-dcdue]') }; });
  check(bar && /2 selected/.test(bar.t) && !bar.open, 'two ticked lines: the bar says 2 selected and no line opens ' + JSON.stringify(bar));
  await tap('[data-dcselst="ok"]');
  check(await st() === 'ok,missing,ok', 'Approved for both ticked lines: ' + await st());
  await tap('[data-undo]'); await sl(300);
  const und = await st();
  await tap('[data-dcselall]');
  await p.evaluate(() => { const i = document.querySelector('[data-dcseldue]'); i.value = '2026-12-01'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(500);
  const due = await p.evaluate(() => Features.list('dctl')[0].lines.filter(l => l.due === '2026-12-01').length);
  check(due === 3 && und === 'missing,missing,missing', 'Undo puts the statuses back; All shown → one deadline for every line (' + due + '; after Undo: ' + und + ')');
  await tap('.dc-selbar [data-dcsel]');
  check(await p.evaluate(() => !document.querySelector('.dc-selbar') && !!document.querySelector('[data-dcline="l1"]')), '× ends selecting and lines open again');

  /* Files */
  await tap('[data-dctab="files"]');
  if (await p.evaluate(() => !!document.querySelector('[data-dcnon]:checked'))) await tap('[data-dcnon]');
  check(await tap('[data-dcsel^="f:"]'), 'Files has "Select several"');
  await tap('li[data-dcpick="f1"]'); await tap('li[data-dcpick="f3"]');
  await tap('[data-dcselfdel]');
  const fl = await p.evaluate(() => Features.list('dctl')[0].files.map(f => f.id).join());
  check(fl === 'f2', 'Remove the files: the two ticked are gone ' + fl);

  /* Requirements */
  await go(p, 'work/', 2500); await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await tap('[data-dropen="ks1"]'); await sl(300);
  check(await tap('#wkDocReq [data-dcsel^="r:"]'), 'Requirements has "Select several"');
  await tap('li[data-dcpick="a"]'); await tap('li[data-dcpick="c"]');
  await tap('[data-drselopt]');
  const op = await p.evaluate(() => Features.list('dckrav')[0].lines.map(l => l.id + (l.opt ? '*' : '')).join());
  check(op === 'a*,b,c*', 'Only if in the contract for the two ticked: ' + op);
  await tap('li[data-dcpick="a"]'); await tap('li[data-dcpick="b"]');
  await tap('[data-drseldel]');
  const kl = await p.evaluate(() => Features.list('dckrav')[0].lines.map(l => l.id).join());
  check(kl === 'c', 'Remove the lines: only the one not ticked is left ' + kl);
  check(!errs.length, 'no script errors ' + errs.join(' | '));
  await b.close(); done();
})();
