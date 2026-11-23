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
  await p.evaluate(() => { Features.set('fdv', true); localStorage.setItem('dash.dcFlow', '0');   /* an old saved choice from the first test switch is ignored */ const t = Features.tools();
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
  /* the project can still be edited and deleted: ⋯ in the header leads to it (JP 2026-11-23 "I cannot delete the projects") */
  await p.evaluate(() => document.querySelector('[data-dcprojinfo]').click()); await sl(400);
  const pj = await p.evaluate(() => ({ step: (document.querySelector('.dc-fsteps [aria-selected=true]') || {}).dataset.dctab, del: !!document.querySelector('.dc-fproj [data-dcdel]'), edit: !!document.querySelector('.dc-fproj [data-dcedit]') }));
  check(pj.step === 'krav' && pj.del && pj.edit, 'the project has Edit and Delete in the new flow ' + JSON.stringify(pj));
  await p.evaluate(() => document.querySelector('.dc-fproj [data-dcedit]').click()); await sl(300);
  check(await p.evaluate(() => !!document.querySelector('.dc-flow form')), 'Edit opens the project form');
  await p.evaluate(() => { const c = [...document.querySelectorAll('.dc-flow form button')].find(b => /Cancel/.test(b.textContent)); if (c) c.click(); }); await sl(300);
  /* no plan: continue without, then make one from the delivery */
  await go(p, 'work/#dc=fp2', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(300);
  await (await p.$('.dc-flow input[data-dcfiles]')).uploadFile(...F); await sl(1800);
  /* a file can be given the right name in Filer, and it opens in a popup (JP 2026-11-23) */
  await p.evaluate(() => { const r = [...document.querySelectorAll('.dc-fh')].find(x => /Tilbud madeup/.test(x.textContent)); r.querySelector('[data-dcren]').click(); }); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-dcren1]'); f.n.value = '234 SE Vindu madeup'; f.requestSubmit(); }); await sl(400);
  const rn = await p.evaluate(() => { const ff = Features.list('dctl').filter(x => x.id === 'fp2')[0].files.filter(x => /madeup/.test(x.name) && x.orig)[0]; return ff ? ff.name + '|' + ff.orig + '|' + ff.p.code + ff.p.abbr : null; });
  check(rn === '234 SE Vindu madeup.pdf|Tilbud madeup.pdf|234SE', 'Filer: a file gets a new name (the type stays), the old one is kept, and the code is read from it ' + rn);
  await p.evaluate(() => document.querySelector('.dc-fh [data-dcview]').click()); await sl(1500);
  check(await p.evaluate(() => !!document.querySelector('.dx-fv')), 'a file opens in the popup viewer');
  await p.evaluate(() => { const x = document.querySelector('[data-dxfvx]'); if (x) x.click(); }); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcnoplan]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcmkplan]').click()); await sl(500);
  const np = await p.evaluate(() => { const r = Features.list('dctl').filter(x => x.id === 'fp2')[0]; return { lines: r.lines.map(l => l.code + ' ' + l.t + ' ' + l.st).sort().join(','), linked: r.files.filter(f => f.line).length, v7: !!document.querySelector('[data-dcvx7]') }; });
  check(np.lines === '234 A recv,234 E recv,261 E recv' && np.linked === 3 && np.v7, 'no plan: a plan is made from the delivered files, linked, ready as Vedlegg 7 ' + JSON.stringify(np));
  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
