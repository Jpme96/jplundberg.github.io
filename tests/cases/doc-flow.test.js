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
    t.dctl = [{ id: 'fp1', name: 'Made-up flow', lines: L, files: [], planName: 'Made-up plan.xlsx' }, { id: 'fp2', name: 'Made-up no plan', lines: [], files: [] }, { id: 'fp3', name: 'Made-up from requirements', lines: [{ id: 'k1', code: '234', t: 'E', st: 'missing', files: [] }], files: [], planName: 'Dokumentkrav: Made-up' }]; Features.saveTools(t); });
  await go(p, 'work/#dc=fp1', 2500);
  const st = await p.evaluate(() => [...document.querySelectorAll('.dc-fsteps [data-dctab]')].map(b => b.dataset.dctab).join());
  check(st === 'krav,plan,lev,cmp,end', 'the standard: five steps in the order the work goes ' + st);
  /* the whole plan as imported, per NS group (JP 2026-11-23 "I should be able to see what I uploaded") */
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  await p.evaluate(() => { const d = document.querySelector('.dc-flow details.dc-fold'); d.open = true; }); await sl(500);
  const wp = await p.evaluate(() => ({ groups: document.querySelectorAll('.dc-flow details.dc-fold').length, rows: [...document.querySelectorAll('.dc-flow details.dc-fold[open] li')].map(li => li.textContent.replace(/\s+/g, ' ')).join(' | ') }));
  check(wp.groups === 1 && /234 DA Vindu madeup/.test(wp.rows) && /234 DV Vindu madeup/.test(wp.rows), 'Dokumentplan shows the whole plan, per NS group ' + JSON.stringify(wp));
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
  /* picking several (JP 2026-11-25): per pile in Sammenligning, and lines in Dokumentplan; Remove the plan keeps files and statuses */
  const ask = async () => { await sl(250); await p.evaluate(() => { const o = document.querySelector('.ask-ov .ask-ok'); o && o.click(); }); await sl(400); };
  await p.evaluate(() => document.querySelector('[data-dcpile="miss"]').click()); await sl(250);
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcsel^="cm:"]').click()); await sl(250);
  await p.evaluate(() => document.querySelector('.dc-flow .dc-selbar [data-dcselall]').click()); await sl(250);
  const cm = await p.evaluate(() => ({ picked: document.querySelectorAll('.dc-flow .dc-frow2.picked').length, acts: [...document.querySelectorAll('.dc-flow .dc-selacts > *')].map(x => x.dataset ? Object.keys(x.dataset).join('') || (x.querySelector('input,select') ? Object.keys(x.querySelector('input,select').dataset).join('') : '') : '').join(',') }));
  await p.evaluate(() => { const i = document.querySelector('.dc-flow [data-dcselwho]'); i.value = 'Made-up Rør AS'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  check(cm.picked === 1 && /dcselst/.test(cm.acts) && /dcseldue/.test(cm.acts) && /dcselwho/.test(cm.acts) && await p.evaluate(() => Features.list('dctl')[0].lines.some(l => l.who === 'Made-up Rør AS')), 'Sammenligning, missing pile: pick all, Not relevant / Deadline / Responsible – the responsible lands on the line ' + JSON.stringify(cm));
  await p.evaluate(() => document.querySelector('[data-dcpile="loose"]').click()); await sl(250);
  check(await p.evaluate(() => !document.querySelector('.dc-flow .dc-selbar') && !!document.querySelector('.dc-flow [data-dcsel^="cl:"]')), 'changing pile ends the picking; the loose pile has its own Select');
  await p.evaluate(() => document.querySelector('[data-dcpile="got"]').click()); await sl(250);
  await p.evaluate(() => document.querySelector('.dc-flow .dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcsel^="pl:"]').click()); await sl(250);
  await p.evaluate(() => { const d = document.querySelector('.dc-flow details.dc-fold'); d.open = true; d.dispatchEvent(new Event('toggle')); }); await sl(400);
  const n0 = await p.evaluate(() => Features.list('dctl')[0].lines.length);
  await p.evaluate(() => { const g = document.querySelector('.dc-flow .dc-gpick [data-dcselall]'); g ? g.click() : document.querySelector('.dc-flow .dc-frow2 [data-dcpick]').click(); }); await sl(250);
  const pick = await p.evaluate(() => document.querySelectorAll('.dc-flow .dc-frow2.picked').length);
  for (let i = 1; i < pick; i++) { await p.evaluate(() => { const r = document.querySelectorAll('.dc-flow .dc-frow2.picked [data-dcpick]'); r[r.length - 1].click(); }); await sl(200); }
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcselrm]').click()); await ask();
  const n1 = await p.evaluate(() => Features.list('dctl')[0].lines.length);
  await p.evaluate(() => { const u = document.querySelector('[data-undo]'); u && u.click(); }); await sl(400);
  const n2 = await p.evaluate(() => Features.list('dctl')[0].lines.length);
  check(pick >= 1 && n1 === n0 - 1 && n2 === n0, 'Dokumentplan: pick lines (Select all in the group), Remove from the plan asks, removes one, and Undo brings it back ' + JSON.stringify({ pick, n0, n1, n2 }));
  await p.evaluate(() => { const x = document.querySelector('.dc-flow .dc-selbar [data-dcsel]'); x && x.click(); }); await sl(250);
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcrmplan]').click()); await ask();
  const rp = await p.evaluate(() => { const q = Features.list('dctl')[0]; return { plan: q.planName === 'Made-up plan.xlsx', who: q.lines.some(l => l.who === 'Made-up Rør AS'), files: q.files.length, text: document.querySelector('.dc-flow .fdv-body').textContent.slice(0, 200) }; });
  await p.evaluate(() => { const u = [...document.querySelectorAll('[data-undo]')].pop(); u && u.click(); }); await sl(400);
  const rb = await p.evaluate(() => Features.list('dctl')[0].planName === 'Made-up plan.xlsx');
  check(!rp.plan && rp.who && rp.files >= 3 && rb, 'Remove the plan asks, keeps the files and what you set (the responsible), and Undo puts the plan back ' + JSON.stringify(rp));
  await p.evaluate(() => document.querySelector('.dc-flow .dc-fsteps [data-dctab="cmp"]').click()); await sl(300);
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
  /* ⋯ in the header is a small menu: Edit the project (a popup where you are) and Delete the project (JP 2026-11-24 21:55) */
  const st0 = await p.evaluate(() => (document.querySelector('.dc-fsteps [aria-selected=true]') || {}).dataset.dctab);
  await p.evaluate(() => document.querySelector('[data-dcprojinfo]').click()); await sl(300);
  const pj = await p.evaluate(() => ({ step: (document.querySelector('.dc-fsteps [aria-selected=true]') || {}).dataset.dctab, open: !document.querySelector('.dc-pmenu .dc-addlist').hidden, edit: !!document.querySelector('.dc-pmenu [data-dcpedit]'), del: !!document.querySelector('.dc-pmenu [data-dcdel]'), box: !!document.querySelector('.dc-fproj') }));
  check(pj.step === st0 && pj.open && pj.edit && pj.del && !pj.box, 'the ⋯ menu opens where you are, with Edit and Delete ' + JSON.stringify(pj));
  await p.evaluate(() => document.querySelector('.dc-pmenu [data-dcpedit]').click()); await sl(300);
  check(await p.evaluate(() => !!document.querySelector('.dc-ppov form[data-dcpform]')), 'Edit opens the project form in a popup');
  await p.evaluate(() => { const f = document.querySelector('.dc-ppov form[data-dcpform]'); f.no.value = 'MU-77'; f.requestSubmit(); }); await sl(400);
  check(await p.evaluate(() => !document.querySelector('.dc-ppov') && Features.list('dctl')[0].no === 'MU-77'), 'saving the form closes the popup and keeps the change');
  /* a list made from the project's requirements is not the contractor's plan (JP 2026-11-23) */
  await go(p, 'work/#dc=fp3', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  const kp = await p.evaluate(() => ({ t: document.querySelector('.dc-flow .fdv-body').textContent, imp: !!document.querySelector('.dc-flow input[data-dcplan]') }));
  check(/made from the requirements/.test(kp.t) && !/contractor’s plan, checked/.test(kp.t) && kp.imp, 'a project made from requirements says so in Dokumentplan, with import of the contractor’s plan ' + kp.t.slice(0, 120));
  /* a project made from requirements in Norwegian (the word has a soft hyphen) is not a contractor's plan (JP 2026-11-24) */
  await p.evaluate(() => { const t = Features.tools(); t.dctl.push({ id: 'fp7', name: 'Made-up nb', krav: 'kr7', planName: 'Dokument\u00adkrav: Made-up nb', lines: [], files: [] }); Features.saveTools(t); });
  await go(p, 'work/#dc=fp7', 2500);
  check(await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); return !!s && !/OK/.test(s.textContent) && !!document.querySelector('.dc-flow input[data-dcplan]'); }), 'a project made from Norwegian requirements does not say the plan is checked OK');
  /* deleting a project made from requirements removes its requirements list too – it is one project (JP 2026-11-23) */
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = [{ id: 'kr9', name: 'Made-up both parts', lines: [{ id: 'q1', code: '234', t: 'E' }] }]; t.dctl.push({ id: 'fp9', name: 'Made-up both parts', krav: 'kr9', lines: [], files: [] }); Features.saveTools(t); });
  await go(p, 'work/#dc=fp9', 2500);
  await p.evaluate(() => document.querySelector('[data-dcprojinfo]').click()); await sl(400);
  await p.evaluate(() => document.querySelector('.dc-pmenu [data-dcdel]').click()); await sl(400);
  check(await p.evaluate(() => !!document.querySelector('.ask-ov') && Features.tools().dctl.some(x => x.id === 'fp9')), 'deleting asks first (the app\'s own popup), nothing gone yet');
  await p.evaluate(() => document.querySelector('.ask-ov .ask-ok').click()); await sl(600);
  check(await p.evaluate(() => { const t = Features.tools(); return !t.dctl.some(x => x.id === 'fp9') && !(t.dckrav || []).some(x => x.id === 'kr9'); }), 'deleting the project removes its requirements list too');
  /* delete straight from the list: asked first, Cancel keeps it, Undo brings it back (JP 2026-11-24) */
  await p.evaluate(() => { const t = Features.tools(); t.dctl.push({ id: 'fp8', name: 'Made-up list delete', lines: [], files: [] }); Features.saveTools(t); });
  await go(p, 'work/#docs', 2000);
  check(await p.evaluate(() => !document.querySelector('.dx-list [data-dxdel="fp8"]') && !!document.querySelector('.dx-list [data-dxmore="fp8"]')), 'the bin is behind "⋯" on each project row, not out on the row (JP 2026-11-26)');
  await p.evaluate(() => document.querySelector('[data-dxmore="fp8"]').click()); await sl(300);
  check(await p.evaluate(() => /Delete the project|Slett prosjektet/.test((document.querySelector('.dx-rowmenu') || {}).textContent || '')), '"⋯" opens a menu with Delete the project');
  await p.evaluate(() => document.querySelector('[data-dxdel="fp8"]').click()); await sl(400);
  await p.evaluate(() => document.querySelector('.ask-ov .ask-no').click()); await sl(400);
  check(await p.evaluate(() => Features.tools().dctl.some(x => x.id === 'fp8')), 'Cancel keeps the project');
  await p.evaluate(() => { if (!document.querySelector('[data-dxdel="fp8"]')) document.querySelector('[data-dxmore="fp8"]').click(); }); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxdel="fp8"]').click()); await sl(400);
  await p.evaluate(() => document.querySelector('.ask-ov .ask-ok').click()); await sl(600);
  check(await p.evaluate(() => !Features.tools().dctl.some(x => x.id === 'fp8') && !document.querySelector('[data-dxdel="fp8"]')), 'Delete removes it from the list');
  const und = await p.evaluate(() => { const b = [...document.querySelectorAll('.toast button, [class*=toast] button')].find(x => /Undo|Angre/.test(x.textContent)); if (b) b.click(); return !!b; }); await sl(600);
  check(und && await p.evaluate(() => Features.tools().dctl.some(x => x.id === 'fp8')), 'and Undo brings it back');
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
  /* "Usual for this project, but not in the plan" (JP 2026-11-25): a folded card from the codes the project has; one tap adds a line of your own, Undo takes it back */
  const nd = await p.evaluate(() => { const c = document.querySelector('.dc-flow details.dc-need'); return c ? { open: c.open, n: c.querySelectorAll('[data-dcneedadd]').length, t: c.textContent } : null; });
  check(nd && !nd.open && nd.n >= 1 && /Usual for this project, but not in the plan/.test(nd.t) && /Only a suggestion/.test(nd.t), 'a project without a plan shows the folded card of what such a project usually has ' + JSON.stringify(nd && { open: nd.open, n: nd.n }));
  const n0d = await p.evaluate(() => Features.list('dctl').filter(x => x.id === 'fp2')[0].lines.length);
  const nT = await p.evaluate(() => { const c = document.querySelector('.dc-flow details.dc-need'); c.open = true; const b = c.querySelector('[data-dcneedadd]'); const t = b.dataset.dcneedadd.split('|')[2].length; b.click(); return t; }); await sl(400);   /* one row per code adds each of its types (live review 2026-11-25) */
  const n1d = await p.evaluate(() => { const r = Features.list('dctl').filter(x => x.id === 'fp2')[0]; return { n: r.lines.length, own: r.lines.filter(l => l.own).length }; });
  await p.evaluate(() => { const u = [...document.querySelectorAll('[data-undo]')].pop(); u && u.click(); }); await sl(500);
  const n2d = await p.evaluate(() => Features.list('dctl').filter(x => x.id === 'fp2')[0].lines.length);
  check(n1d.n === n0d + nT && n1d.own === nT && n2d === n0d, 'Add puts the suggested document in as a line of your own; Undo takes it out ' + JSON.stringify({ n0d, n1d, n2d }));
  check(await p.evaluate(() => !/Vedlegg 7|Boligbygg/.test(document.querySelector('.dc-flow').innerText)), 'no client names on screen – "Download document plan (.xlsx)" (JP 2026-11-25 "I own the system")');
  /* the Vedlegg 7 from such a plan has the delivered names in Planlagt navngivning (JP 2026-11-24 09:34: it was empty) */
  const v7 = await p.evaluate(async () => { let got = null; const old = FdvPdf.share; FdvPdf.share = f => { got = f; }; document.querySelector('[data-dcvx7]').click(); FdvPdf.share = old; if (!got) return ''; return new TextDecoder().decode(await got.arrayBuffer()); });
  check(/234 SE Vindu madeup/.test(v7), 'the Vedlegg 7 made from the delivery fills Planlagt navngivning with the delivered names');
  /* Comparison: opening a line shows its file first; deleting a file takes its line along, so Delivery and Comparison agree (JP 2026-11-24 14:18) */
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="cmp"]').click()); await sl(400);
  await p.evaluate(() => [...document.querySelectorAll('[data-dcline]')].find(b => /Vindu madeup/.test(b.textContent)).click()); await sl(400);
  const lp = await p.evaluate(() => { const e = document.querySelector('.dc-frow2.open .dc-ledit'); return e && e.firstElementChild ? e.firstElementChild.className + '|' + !!e.firstElementChild.querySelector('[data-dcview]') : ''; });
  check(lp === 'dc-flist|true', 'opening a line in Comparison shows its file first, ready to open ' + lp);
  await p.evaluate(() => { const b = document.querySelector('.dc-frow2.open [data-dcst$=":ok"]'); b && b.click(); }); await sl(400);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(400);
  await p.evaluate(() => { const li = [...document.querySelectorAll('[data-dcfdel]')].find(b => /Vindu madeup/.test((b.closest('li') || b.parentElement.parentElement).textContent)); li.click(); }); await sl(600);
  await p.evaluate(() => { const y = document.querySelector('.ask-ov .ask-ok'); if (y) y.click(); }); await sl(500);   /* deletes are asked first (JP 2026-11-24 21:56) */
  const ag = await p.evaluate(() => { const r = Features.list('dctl').filter(x => x.id === 'fp2')[0], S = [...document.querySelectorAll('.dc-fsteps [data-dctab]')].map(b => b.innerText.replace(/\n/g, ' '));
    return { lines: r.lines.map(l => l.code + ' ' + l.t + ' ' + l.st).sort().join(','), files: r.files.length, lev: S[2], cmp: S[3] }; });
  check(ag.lines.split(',').length === 2 && ag.files === 2 && /2 /.test(ag.lev) && /^4 \D+ 2 /.test(ag.cmp), 'deleting an approved file takes the line made from it along – Delivery and Comparison both say 2 ' + JSON.stringify(ag));
  /* a line of your own in Dokumentplan, kept when a new version of the plan is imported (JP 2026-11-25) */
  await go(p, 'work/#dc=fp1', 2000);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="plan"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcaddo]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-flow .dc-addl [data-dcaddl]').click()); await sl(200);
  const er9 = await p.evaluate(() => { const e = document.querySelector('.dc-addle'); return e && !e.hidden ? e.textContent : ''; });
  await p.evaluate(() => { const b = document.querySelector('.dc-flow .dc-addl'); b.querySelector('[data-dcalc]').value = '360'; b.querySelector('[data-dcalt]').value = 'I'; b.querySelector('[data-dcalx]').value = 'Made-up balancing report'; b.querySelector('[data-dcaddl]').click(); }); await sl(400);
  const ol = await p.evaluate(() => { const l = Features.list('dctl')[0].lines.filter(x => x.own)[0]; return l ? l.code + ' ' + l.t + ' ' + l.sys + ' ' + l.st : ''; });
  await p.evaluate(() => { const d = [...document.querySelectorAll('.dc-flow details.dc-fold')].find(x => /3 /.test(x.querySelector('summary').textContent)) || [...document.querySelectorAll('.dc-flow details.dc-fold')].pop(); d.open = true; d.dispatchEvent(new Event('toggle')); }); await sl(400);
  check(/Write a code/.test(er9) && ol === '360 I Made-up balancing report missing', 'Add line asks for a code and a type, then adds a line of your own, missing until it is delivered ' + JSON.stringify({ er9, ol }));
  const csv = path.join(dir, 'Made-up plan v2.csv'); fs.writeFileSync(csv, 'Systemkode;Systemnavn;Dokumenttype;Planlagt navngivning\n234;Vinduer;Produktinformasjon;234 DA Vindu madeup\n261;Tak;Produktinformasjon;261 DA Takstein madeup\n');
  await (await p.$('.dc-flow input[data-dcplan]')).uploadFile(csv); await sl(1200);
  const rv = await p.evaluate(() => { const q = Features.list('dctl')[0]; return { name: q.planName, own: q.lines.filter(l => l.own).map(l => l.code).join(), n: q.lines.length }; });
  check(rv.name === 'Made-up plan v2.csv' && rv.own === '360' && rv.n === 3, 'a new version of the plan keeps your own line ' + JSON.stringify(rv));
  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
