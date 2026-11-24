/* Drawings as PDF and/or DWG (JP 2026-11-24 16:14–16:18): what the drawings are delivered as is a requirement (step 1 Krav, kept on
   the requirements); Levering shows the drawings at a glance and asks once; the notes and the final check follow the setting; the report
   lists every file with its status (Note / Error / OK) and a line on the drawings. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddw-')), PDF = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  const mk = (n, c) => { const f = path.join(dir, n); fs.writeFileSync(f, c || PDF); return f; };
  const F = [mk('11621-H01-A-200-P-01 - Plan madeup.pdf'), mk('11621-H01-A-200-P-01 - Plan madeup.dwg', 'AC1032 made up'), mk('11621-H01-A-201-P-01 - Snitt madeup.pdf'), mk('11621-H01-A-202-P-01 - Fasade madeup.dwg', 'AC1032 made up 2'), mk('365 DA Vifte madeup.pdf', PDF + ' ')];
  await p.evaluate(() => { Features.set('fdv', true); const t = Features.tools();
    t.dckrav = [{ id: 'kr1', name: 'Made-up requirements', lines: [{ id: 'q1', code: '365', t: 'E' }] }];
    t.dctl = [{ id: 'pw1', name: 'Made-up drawings', krav: 'kr1', lines: [], files: [], noPlan: 1 }]; Features.saveTools(t); });
  await go(p, 'work/#dc=pw1', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(300);
  await (await p.$('.dc-flow input[data-dcfiles]')).uploadFile(...F); await sl(2000);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(400);
  const box = await p.evaluate(() => { const x = document.querySelector('.dc-dwbox'); if (!x) return null; return { head: x.querySelector('.dc-dwh').textContent.replace(/\s+/g, ' '), rows: [...x.querySelectorAll('.dc-dwrow summary')].map(s => s.textContent.replace(/\s+/g, ' ').trim()), ask: !!x.querySelector('.dc-dwask') }; });
  check(box && /Drawings 3/.test(box.head) && /assumed/.test(box.head) && box.rows.join('|') === 'Both PDF and DWG1|Only PDF – DWG missing1|Only DWG – PDF missing1' && box.ask, 'Levering shows the 3 drawings: 1 with both, 1 only PDF, 1 only DWG, and asks once ' + JSON.stringify(box));
  const iss0 = await p.evaluate(() => Features.list('dctl')[0].files.filter(f => /Snitt/.test(f.name))[0].iss.map(x => x[1]).join());
  check(/nodwg/.test(iss0), 'before choosing, the PDF-only drawing has the DWG note ' + iss0);
  /* "No, only PDF": kept on the requirements; the PDF-only drawing is fine, the DWG-only one lacks its PDF */
  await p.evaluate(() => [...document.querySelectorAll('.dc-dwask [data-dcdw]')].find(b => /\|pdf$/.test(b.dataset.dcdw)).click()); await sl(400);
  const s1 = await p.evaluate(() => { const t = Features.tools(), f = t.dctl[0].files; return { kr: t.dckrav[0].dw, proj: t.dctl[0].dw || '', snitt: f.filter(x => /Snitt/.test(x.name))[0].iss.map(x => x[1]).join(), fasade: f.filter(x => /Fasade/.test(x.name))[0].iss.map(x => x[1]).join(), head: document.querySelector('.dc-dwh').textContent, ask: !!document.querySelector('.dc-dwask') }; });
  check(s1.kr === 'pdf' && !s1.proj && !/nodwg/.test(s1.snitt) && /nopdf/.test(s1.fasade) && /Required: Only PDF/.test(s1.head) && !s1.ask, '“No, only PDF” is kept on the requirements; the PDF-only drawing has no note any more ' + JSON.stringify(s1));
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(300);
  const e1 = await p.evaluate(() => [...document.querySelectorAll('.dc-flow .dc-flist2 li')].map(li => li.textContent.replace(/\s+/g, ' ')).filter(t => /PDF missing|DWG missing/.test(t)));
  check(e1.length === 1 && /PDF missing/.test(e1[0]) && /Fasade/.test(e1[0]), 'Sluttkontroll: only PDF required → the DWG-only drawing is to put right ' + JSON.stringify(e1));
  /* Krav: change it to PDF and DWG */
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="krav"]').click()); await sl(300);
  const kp = await p.evaluate(() => [...document.querySelectorAll('.dc-dwreq [data-dcdw]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('|'));
  check(kp === 'PDF and DWG|Only PDF*|Only DWG', 'step 1 Krav has the setting, Only PDF chosen ' + kp);
  await p.evaluate(() => [...document.querySelectorAll('.dc-dwreq [data-dcdw]')].find(b => /\|both$/.test(b.dataset.dcdw)).click()); await sl(400);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(300);
  const e2 = await p.evaluate(() => [...document.querySelectorAll('.dc-flow .dc-flist2 li')].map(li => li.textContent.replace(/\s+/g, ' ')).filter(t => /PDF missing|DWG missing/.test(t)).map(t => (/DWG missing/.test(t) ? 'DWG' : 'PDF') + (/Snitt/.test(t) ? ' Snitt' : /Fasade/.test(t) ? ' Fasade' : '')).sort().join(','));
  check(e2 === 'DWG Snitt,PDF Fasade', 'PDF and DWG required → the missing DWG and the missing PDF are both to put right ' + e2);
  /* the report: every file with its status, notes as Note, and the drawings line */
  await p.evaluate(() => document.querySelector('.dc-flow [data-dctab="report"]').click()); await sl(800);
  const rp = await p.evaluate(() => { const t = document.body.innerText, h2 = [...document.querySelectorAll('h2')].find(h => /4 File names/.test(h.textContent)); let tbl = h2; while (tbl && tbl.tagName !== 'TABLE') tbl = tbl.nextElementSibling;
    return { dw: (t.match(/Drawings: [^\n]*/) || [''])[0], rows: tbl ? [...tbl.querySelectorAll('tbody tr')].map(r => r.cells[0].textContent + ' = ' + r.cells[1].textContent) : [], err: /Error:/.test(tbl ? tbl.textContent : '') }; });
  check(/Drawings: 1 of 3 delivered as PDF and DWG · only PDF: 1 · only DWG: 1\. Required: PDF and DWG\./.test(rp.dw), 'the report has a line on the drawings ' + rp.dw);
  check(rp.rows.length === 5 && rp.rows.some(r => /Snitt madeup\.pdf = Note: .*DWG/.test(r)) && rp.rows.filter(r => / = OK$/.test(r)).length >= 2 && /= OK$/.test(rp.rows[rp.rows.length - 1]), 'section 4 lists all 5 files, notes first and OK last; a missing DWG is a Note ' + JSON.stringify(rp.rows));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
