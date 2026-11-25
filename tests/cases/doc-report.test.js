/* The report step and Sammenligning without a list (JP 2026-11-24 20:36–20:53): Sammenligning says when there is nothing to compare
   against and makes the list from the delivery; the report has one "Download ▾" menu – the handover package on top, or the report,
   the document plan (Vedlegg 7 made from the delivery when no plan was uploaded), the delivery list and the files (choose which);
   the preview switches between the report and the document plan; each file in Levering can be downloaded on its own. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drp-')), PDF = n => '%PDF-1.1\n% made up ' + n + '\n%%EOF\n';
  const mk = n => { const f = path.join(dir, n); fs.writeFileSync(f, PDF(n)); return f; };
  const F = [mk('365 DA Kanalvifte madeup.pdf'), mk('433 DA Stikkontakt madeup.pdf'), mk('scan madeup 7.pdf')];
  await p.evaluate(() => { Features.set('fdv', true); const t = Features.tools(); t.dckrav = [];
    t.dctl = [{ id: 'prp1', name: 'Made-up report', lines: [], files: [], noPlan: 1 }]; Features.saveTools(t); });
  await go(p, 'work/#dc=prp1', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(300);
  await (await p.$('.dc-flow input[data-dcfiles]')).uploadFile(...F); await sl(2000);
  /* each file in Levering has its own download, with its name */
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(400);
  const one = await p.evaluate(async () => { let got = null; const old = FdvPdf.share; FdvPdf.share = f => { got = f; };
    const btn = document.querySelector('.dc-files [data-dcfdl]'); if (!btn) { FdvPdf.share = old; return { btn: false }; } btn.click();
    for (let i = 0; i < 30 && !got; i++) await new Promise(r => setTimeout(r, 100)); FdvPdf.share = old; return { btn: true, name: got && got.name, size: got && got.size }; });
  check(one.btn && /madeup/.test(one.name || '') && one.size > 0, 'a file in Levering downloads on its own ' + JSON.stringify(one));
  /* Sammenligning without a plan or requirements: says so, offers to make the list from the delivery, or to skip */
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="cmp"]').click()); await sl(400);
  const c0 = await p.evaluate(() => ({ t: (document.querySelector('.dc-flow .dc-empty b') || {}).textContent || '', mk: !!document.querySelector('.dc-flow [data-dcmkplan]'), skip: !!document.querySelector('.dc-flow .dc-empty [data-dctab="end"]'), sub: (document.querySelector('.dc-fsteps [data-dctab="cmp"]') || {}).textContent || '', piles: document.querySelectorAll('.dc-pile').length }));
  check(/No list to compare against/.test(c0.t) && c0.mk && c0.skip && /No list/.test(c0.sub) && !c0.piles, 'Sammenligning without a list says so, with Make the plan from the delivery and Skip ' + JSON.stringify(c0));
  await p.evaluate(() => document.querySelector('.dc-flow [data-dcmkplan]').click()); await sl(600);
  const c1 = await p.evaluate(() => { const r = Features.list('dctl')[0]; return { lines: (r.lines || []).length, piles: document.querySelectorAll('.dc-pile').length }; });
  check(c1.lines === 2 && c1.piles === 3, 'the list is made from the files that have a code; the comparison has its piles ' + JSON.stringify(c1));
  /* the report: one Download menu */
  await p.evaluate(() => { location.hash = '#dc=prp1'; }); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(300);
  const e0 = await p.evaluate(() => ({ btn: (document.querySelector('.dc-flow [data-dctab="report"]') || {}).textContent || '', v7: !!document.querySelector('.dc-flow [data-dcvx7]') }));
  check(/See the report and download/.test(e0.btn) && !e0.v7, 'the final check has one way on: See the report and download – no separate Vedlegg 7 button ' + JSON.stringify(e0));
  await p.evaluate(() => { const b2 = document.querySelector('[data-dctab="report"]'); b2 && b2.click(); }); await sl(600);
  const r0 = await p.evaluate(() => ({ menu: !!document.querySelector('[data-dcdlm]'), old: !!document.querySelector('.fdv-rbar [data-dcpdf]'), tabs: [...document.querySelectorAll('.dc-pvtabs [role="tab"]')].map(x => x.textContent).join(','), art: !!document.querySelector('.rp-doc') }));
  check(r0.menu && !r0.old && r0.tabs === 'Report,Document plan' && r0.art, 'the report has one Download button and two preview tabs ' + JSON.stringify(r0));
  await p.evaluate(() => document.querySelector('[data-dcdlm]').click()); await sl(300);
  const m0 = await p.evaluate(() => { const l = document.querySelector('.dc-dllist'); return { open: !!l && !l.hidden, pkg: !!l.querySelector('.dc-dlall [data-dchand]'), items: [...l.querySelectorAll('.dc-dlit b')].map(x => x.textContent).join(','), plan: (l.querySelector('[data-dcdls="plan"]').closest('label').querySelector('small') || {}).textContent, go: (l.querySelector('[data-dcdlgo]') || {}).textContent }; });
  check(m0.open && m0.pkg && m0.items === 'Report,Document plan,Delivery list,The files' && /Document plan made from the delivery/.test(m0.plan) && /\(2\)/.test(m0.go), 'the menu: the handover package on top, then the four choices; without an uploaded plan it is Vedlegg 7 ' + JSON.stringify(m0));
  /* choose the delivery list too, then pick only one file */
  await p.click('.dc-dllist [data-dcdls="list"]'); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcdlpick]').click()); await sl(300);
  const pk = await p.evaluate(() => ({ pop: !!document.querySelector('.dc-dlpov'), boxes: document.querySelectorAll('.dc-dlpov [data-dcdlpf]').length }));
  check(pk.pop && pk.boxes === 3, 'Choose files opens a list of the files, by NS 3451 heading ' + JSON.stringify(pk));
  const pkw = await p.evaluate(() => { const sh = document.querySelector('.dc-dlpov .dx-tsheet'), h = sh.querySelector('.dc-freshh').getBoundingClientRect(), r = sh.getBoundingClientRect(); return { side: sh.scrollWidth - sh.clientWidth, pad: Math.round(h.left - r.left) }; });
  check(pkw.side <= 1 && pkw.pad >= 12, 'the file picker does not scroll sideways and has room at the edge (JP 21:43) ' + JSON.stringify(pkw));
  await p.evaluate(() => document.querySelector('.dc-dlpov [data-dcdlpall="0"]').click()); await sl(200);
  await p.click('.dc-dlpov [data-dcdlpf]'); await sl(200);
  await p.evaluate(() => document.querySelector('.dc-dlpov .dc-freshbtns [data-dcdlpx]').click()); await sl(300);
  await p.click('.dc-dllist [data-dcdls="files"]'); await sl(300);
  const m1 = await p.evaluate(() => ({ open: !document.querySelector('.dc-dllist').hidden, files: document.querySelector('[data-dcdls="files"]').closest('label').querySelector('small').textContent, go: document.querySelector('[data-dcdlgo]').textContent, kept: JSON.parse(localStorage.getItem('dash.dcDl') || '{}').prp1 }));
  check(m1.open && /1 of 3/.test(m1.files) && /\(4\)/.test(m1.go) && m1.kept && m1.kept.list === 1, 'back in the menu: 1 of 3 files, four chosen, the choice kept for the project ' + JSON.stringify(m1));
  const z = await p.evaluate(async () => { let got = null; const old = FdvPdf.share; FdvPdf.share = f => { got = f; };
    document.querySelector('[data-dcdlgo]').click(); for (let i = 0; i < 80 && !got; i++) await new Promise(r => setTimeout(r, 200)); FdvPdf.share = old; if (!got) return null;
    const u = new Uint8Array(await got.arrayBuffer()), names = []; let i = 0;
    while (i < u.length - 46) { if (u[i] === 0x50 && u[i + 1] === 0x4b && u[i + 2] === 1 && u[i + 3] === 2) { const n = u[i + 28] | (u[i + 29] << 8); names.push(new TextDecoder().decode(u.slice(i + 46, i + 46 + n))); i += 46 + n; } else i++; }
    return { name: got.name, names }; });
  check(z && /\.zip$/.test(z.name) && z.names.some(n => /Report.*\.pdf$/.test(n)) && z.names.some(n => /Document plan.*\.xlsx$/.test(n)) && z.names.some(n => /Delivery list.*\.xlsx$/.test(n)) && z.names.filter(n => /\.pdf$/.test(n) && /\//.test(n)).length === 1, 'Download the chosen: one .zip with the report, Vedlegg 7, the delivery list and the one file ' + JSON.stringify(z));
  /* the preview switches to the document plan; "Download only this" gives that one file */
  await p.evaluate(() => document.querySelector('[data-dcrtab="plan"]').click()); await sl(300);
  const pv = await p.evaluate(() => ({ rows: document.querySelectorAll('.dc-pvt tbody tr').length, tags: document.querySelectorAll('.dc-pvt .stt').length, art: !!document.querySelector('.rp-doc') }));
  check(pv.rows === 2 && pv.tags === 2 && !pv.art, 'the Document plan tab shows the plan as a table with status tags ' + JSON.stringify(pv));
  const o1 = await p.evaluate(async () => { let got = null; const old = FdvPdf.share; FdvPdf.share = f => { got = f; }; document.querySelector('[data-dcdlone]').click(); for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); FdvPdf.share = old; return got && got.name; });
  check(/\.xlsx$/.test(o1 || ''), '"Download only this" on the plan tab gives the Excel file ' + o1);
  /* the naming tool can make a document plan (Vedlegg 7) from its files (JP 2026-11-24 22:51) */
  await p.evaluate(async () => { await window.DocTools.ren([new File(['%PDF-1.1 made up'], '365 DA Vifte madeup.pdf', { type: 'application/pdf' })]); }); await sl(800);
  const v7 = await p.evaluate(async () => { let got = null; const old = FdvPdf.share; FdvPdf.share = f => { got = f; }; const b2 = document.querySelector('[data-dxrenplan]'); if (!b2) { FdvPdf.share = old; return 'no button'; } b2.click(); for (let i = 0; i < 20 && !got; i++) await new Promise(r => setTimeout(r, 100)); FdvPdf.share = old; return got ? got.name + '|' + new TextDecoder().decode(await got.arrayBuffer()).includes('365') : 'nothing'; });
  check(/Document plan.*\.xlsx\|true$/.test(v7), 'the naming tool downloads a Vedlegg 7 made from its files ' + v7);
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
