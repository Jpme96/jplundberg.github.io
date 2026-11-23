/* The new project flow (JP 2026-11-23, a test – switched on per device): Krav → Dokumentplan → Levering → Sammenligning →
   Sluttkontroll – the standard since 2026-11-23 (in Team an admin can turn it off) – a view on the same project. With a plan: the plan is checked against the requirements, the delivery is compared
   in three piles, and the final check says what to put right. Without a plan: a plan is made from the delivery. Off: as before.
   Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dfl-')), PDF = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const mk = n => { const f = path.join(dir, n); fs.writeFileSync(f, PDF); return f; };
  const F = ['234 DA Vindu madeup.pdf', '261 DA Takstein madeup.pdf', 'Tilbud madeup.pdf'].map(mk);
  await p.evaluate(() => { Features.set('fdv', true); localStorage.removeItem('dash.dcFlow'); const t = Features.tools();
    const L = [['234', 'E', '234 DA Vindu madeup'], ['234', 'BC', '234 DV Vindu madeup'], ['261', 'E', '261 DA Takstein madeup']].map((x, i) => ({ id: 'l' + i, code: x[0], t: x[1], planned: x[2], st: 'missing', files: [] }));
    t.dctl = [{ id: 'fp1', name: 'Made-up flow', lines: L, files: [], planName: 'Made-up plan.xlsx' }, { id: 'fp2', name: 'Made-up no plan', lines: [], files: [] }]; Features.saveTools(t); });
  await go(p, 'work/#dc=fp1', 2500);
  const st = await p.evaluate(() => [...document.querySelectorAll('.dc-fsteps [data-dctab]')].map(b => b.dataset.dctab).join());
  check(st === 'krav,plan,lev,cmp,end', 'the standard: five steps in the order the work goes ' + st);
  /* a narrow window: the step names shorten, never run into the next step (JP 2026-11-23) */
  const vp = p.viewport(); await p.setViewport({ width: 760, height: 900 }); await sl(400);
  const ov = await p.evaluate(() => [...document.querySelectorAll('.dc-fsteps button')].filter(b => { const n = b.querySelector('.dc-fname'); return n && n.getBoundingClientRect().right > b.getBoundingClientRect().right - 2; }).map(b => b.dataset.dctab));
  check(!ov.length, 'at 760 px no step name runs past its step ' + ov.join());
  await p.setViewport(vp); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  check(await p.evaluate(() => /Made-up plan\.xlsx/.test(document.querySelector('.dc-flow').textContent) && !!document.querySelector('.dc-flow input[data-dcplan]')), 'Dokumentplan: the imported plan, checked, with Import a new version');
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(300);
  await (await p.$('.dc-flow input[data-dcfiles]')).uploadFile(...F); await sl(1800);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="cmp"]').click()); await sl(300);
  const piles = await p.evaluate(() => [...document.querySelectorAll('.dc-pile b')].map(b => b.textContent).join());
  check(piles === '2,1,1', 'Sammenligning: 2 in the plan and delivered, 1 missing, 1 not in the plan ' + piles);
  await p.evaluate(() => document.querySelector('[data-dcokall]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(300);
  const end = await p.evaluate(() => ({ v: document.querySelector('.dc-verdict').textContent, rows: [...document.querySelectorAll('.dc-flow .dc-flist2 li')].map(li => li.textContent.replace(/\s+/g, ' ')).join(' | '), rep: !!document.querySelector('.dc-flow [data-dctab="report"]') }));
  check(/to fix/.test(end.v) && /234/.test(end.rows) && /Missing/.test(end.rows) && end.rep, 'Sluttkontroll: not complete, the missing 234 FDV listed, a report for the project manager ' + JSON.stringify(end));
  /* a row opens its line, as in Dokumenter: statuses, deadline, responsible, comment (JP 2026-11-23 "Se på" did nothing) */
  await p.evaluate(() => document.querySelector('.dc-flow .dc-flist2 [data-dcline]').click()); await sl(300);
  const ed = await p.evaluate(() => ({ sts: document.querySelectorAll('.dc-fedit [data-dcst]').length, due: !!document.querySelector('.dc-fedit [data-dcdue]'), cmt: !!document.querySelector('.dc-fedit [data-dccmt]') }));
  check(ed.sts >= 5 && ed.due && ed.cmt, 'a row in the final check opens its line with the statuses, deadline and comment ' + JSON.stringify(ed));
  await p.evaluate(() => document.querySelector('.dc-fedit [data-dcst$=":na"]').click()); await sl(300);
  check(await p.evaluate(() => Features.list('dctl')[0].lines.filter(l => l.st === 'na').length === 1), 'and a status set there is saved on the line');
  /* no plan: continue without, then make one from the delivery */
  await go(p, 'work/#dc=fp2', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(300);
  await (await p.$('.dc-flow input[data-dcfiles]')).uploadFile(...F); await sl(1800);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcnoplan]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcmkplan]').click()); await sl(500);
  const np = await p.evaluate(() => { const r = Features.list('dctl').filter(x => x.id === 'fp2')[0]; return { lines: r.lines.map(l => l.code + ' ' + l.t + ' ' + l.st).sort().join(','), linked: r.files.filter(f => f.line).length, v7: !!document.querySelector('[data-dcvx7]') }; });
  check(np.lines === '234 E recv,261 E recv' && np.linked === 2 && np.v7, 'no plan: a plan is made from the delivered files, linked, ready as Vedlegg 7 ' + JSON.stringify(np));
  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
