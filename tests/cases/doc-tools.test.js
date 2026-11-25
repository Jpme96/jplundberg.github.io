/* The one-off tools on top of Documentation (JP 2026-11-16 14:39 – "a one time thing"): Give files the right names (files or a
   .zip → NS code, document code and text per file → a .zip with the new names) and Check names from the FDV system (paste or
   import → each name OK or what is wrong). Nothing is saved. Made-up data only. */
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
function crc(b) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files, deflate) {
  const parts = [], cen = []; let off = 0;
  for (const [name, text] of files) {
    const raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(deflate ? 8 : 0, 8); h.writeUInt32LE(crc(raw), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    parts.push(h, nm, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(crc(raw), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    cen.push(c, nm); off += 30 + nm.length + data.length;
  }
  const cs = cen.reduce((a, b) => a + b.length, 0), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cs, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat(cen, [e]));
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dctools-'));
const zf = path.join(dir, 'Made-up delivery.zip'), lone = path.join(dir, 'scan 7.pdf');
fs.writeFileSync(zf, zip([['FDV/332 DV Sprinkleranlegg.pdf', '%PDF made up 1'], ['FDV/Datablad radiator.pdf', '%PDF made up 2'], ['FDV/99999-H02-V-332-P-01 – Rørplan.pdf', '%PDF made up 3'], ['FDV/Rørplan sprinkler.dwg', 'made up drawing'], ['__MACOSX/._x', 'x']], true));
fs.writeFileSync(lone, '%PDF made up 4');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1, 4).join(' | ')));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  const t0 = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl .dx-tools .dx-tool b')].map(x => x.textContent).join('|'));
  check(t0 === 'Document plans|Give files the right names|Check names from the FDV system', 'three tools on top (document plans now stay) ' + t0);
  const before = await p.evaluate(() => { const t = Object.assign({}, Features.tools()); delete t.fdvcodes; delete t.fdvlearn; return JSON.stringify(t).length; });
  /* rename: the file naming (suggestions from the name and the PDF text, the naming rules) on files outside any project (JP 20:43) */
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  check(await p.evaluate(() => { const o = document.querySelector('#wkDocCtl .dx-tov'); return !!o && getComputedStyle(o).position === 'fixed' && !!o.querySelector('.dx-ren'); }), 'a tool opens in a popup over the list, not in the page (JP 2026-11-17 20:11)');
  await (await p.$('input[data-dxrenf]')).uploadFile(zf, lone); await sl(2500);
  /* a file opens in a popup (JP 2026-11-17 08:07): R(/name/) opens it and gives its full row */
  /* CI only (2026-11-21): a slow runner sometimes loses an async evaluate ("Promise was collected") while the list
     redraws – try such a step again once the page has settled (the helper R is set up again first) */
  const ev0 = p.evaluate.bind(p);
  p.evaluate = async (fn, ...args) => { for (let i = 0; ; i++) { try { return await ev0(fn, ...args); } catch (e) { if (i >= 2 || !/Promise was collected|Execution context was destroyed/.test(e.message)) throw e; await sl(1000); try { await defR(); } catch (e2) {} } } };
  const defR = () => ev0(() => { window.R = async re => { const c = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => re.test(x.textContent)); if (c) { c.querySelector('[data-dcnexp]').click(); await new Promise(r => setTimeout(r, 350)); } return document.querySelector('.dcn-fpop .dcn-row'); }; });
  await defR();
  const r1 = await p.evaluate(async () => ({ rows: [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].map(li => li.textContent.replace(/\s+/g, ' ').trim()), rules: !!document.querySelector('.dx-ren .dcn-rules'), sum: (document.querySelector('.dx-rsum') || {}).textContent || '',
    sugg: ((await R(/Datablad radiator/)) || { querySelector: () => ({}) }).querySelector('[data-dcncode]').value, plan: /Not in the plan/.test(document.querySelector('.dx-ren').textContent) }));
  check(r1.rows.length === 5 && r1.rules && !r1.plan && !/5 files/.test(r1.sum) && /Download/.test(r1.sum), 'files and the .zip become rows with the naming rules (no plan talk outside a project) ' + JSON.stringify(r1));
  check(/^325/.test(r1.sugg || ''), 'a file named after what it is gets a suggested code from its name (Datablad radiator → 325) ' + JSON.stringify(r1.sugg));
  /* a drawing: the letters say what they mean (Boligbygg's tables 8–11), the discipline comes from the code and the drawing type from the name (JP 21:21) */
  const dw = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); if (!li) return null; const sel = k => li.querySelector('[data-dcnv$=":' + k + '"]');
    return { disc: sel('disc') && sel('disc').selectedOptions[0].textContent, dtype: sel('dtype') && sel('dtype').selectedOptions[0].textContent, floors: sel('floor') && [...sel('floor').options].map(o => o.textContent).slice(1, 3), sug: li.querySelector('.dcn-sug code').textContent }; });
  const dk = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); return { type: !!li.querySelector('[data-dcntype]'), kind: !!li.querySelector('.dcn-g > .dcn-kind'), code: !!li.querySelector('[data-dcncode]') }; });
  check(!dk.type && dk.kind && dk.code, 'a drawing has its kind in the first row, keeps the NS code (it is in the drawing name) and has no document type (JP 22:02) ' + JSON.stringify(dk));
  check(dw && /^V – HVAC and plumbing/.test(dw.disc) && dw.dtype === 'P – Plan' && dw.floors[0] === 'K02 – 2nd basement' && /-V-332-P-\d\d – Rørplan sprinkler\.dwg$/.test(dw.sug), 'a drawing: the choices say what the letters mean, and the discipline (from 332) and type (from “rørplan”) are suggested ' + JSON.stringify(dw));
  /* the boxes in the drawing row sit on one line, also with a two-line label and a hint under one of them (JP 2026-11-23) */
  const vp0 = p.viewport(); await p.setViewport(Object.assign({}, vp0, { width: 1280, height: 900 })); await sl(400);
  const al = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); const fl = [...li.querySelectorAll('.dcn-s .dcn-fl')].filter(l => l.querySelector('input, select'));
    /* as on JP's screen: a label that takes two lines, and a hint under another box */
    fl[0].querySelector('span').textContent = 'Bygningsnummer (for tegninger)'; if (fl[1] && !fl[1].querySelector('small')) fl[1].insertAdjacentHTML('beforeend', '<small>Forslag – sjekk det</small>');
    const f = fl.map(l => ({ row: Math.round(l.getBoundingClientRect().top), box: Math.round(l.querySelector('input, select').getBoundingClientRect().top), lines: Math.round(l.querySelector('span').getBoundingClientRect().height) }));
    const rows = {}; f.forEach(x => { (rows[x.row] = rows[x.row] || []).push(x.box); });
    const spread = Math.max(0, ...Object.values(rows).map(b => Math.max(...b) - Math.min(...b)));
    return { f, spread, together: Math.max(...Object.values(rows).map(b => b.length)) }; });
  check(al.together >= 2 && al.spread <= 2, 'the boxes in a drawing row are on one line ' + JSON.stringify(al));
  /* the new name and Use this name sit level (JP 2026-11-23 "not properly lined") */
  const lv = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)), c = li.querySelector('.dcn-sug code'), bt = li.querySelector('[data-dcnuse], [data-dcnfill]'); if (!c || !bt) return null; const a = c.getBoundingClientRect(), b = bt.getBoundingClientRect(); return { dBottom: Math.round(Math.abs(a.bottom - b.bottom)), sameRow: b.top < a.bottom, ha: Math.round(a.height), hb: Math.round(b.height) }; });
  check(lv && lv.sameRow && lv.dBottom <= 2, 'the new name and Use this name are level ' + JSON.stringify(lv));
  await p.setViewport(vp0); await sl(400);
  await p.evaluate(() => { const b = document.querySelector('[data-dcnbid]'); b.value = '11621'; b.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  check(await p.evaluate(async () => /^11621-/.test((await R(/Rørplan sprinkler/)).querySelector('.dcn-sug code').textContent)), 'the building number for drawings is filled in once for all of them');
  /* and it can be changed again afterwards (JP 2026-11-23: "my building locked itself, I cannot change it") – once set it is on the
     "Shared by all the files" line, Change opens it (JP 2026-11-24), and the file's card no longer asks for it */
  const bn = await p.evaluate(async () => { const inRow = !!(await R(/Rørplan sprinkler/)).querySelector('[data-dcnbid]'); document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); await new Promise(r => setTimeout(r, 200));
    const line = document.querySelector('.dx-ren .dcn-shared'), txt = line ? line.textContent : ''; if (!line) return { box: false, inRow };
    line.querySelector('[data-dcnpvo]').click(); await new Promise(r => setTimeout(r, 250)); const b = document.querySelector('.dx-ren .dcn-pvbox [data-dcnbid]'); if (!b) return { box: false, inRow, txt };
    const was = b.value; b.value = '22222'; b.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 250));
    const now = (await R(/Rørplan sprinkler/)).querySelector('.dcn-sug code').textContent; document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); await new Promise(r => setTimeout(r, 200));
    const b2 = document.querySelector('.dx-ren .dcn-pvbox [data-dcnbid]'); b2.value = '11621'; b2.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 250));
    const done = document.querySelector('.dx-ren .dcn-pvbox [data-dcnpvo]'); done && done.click(); await new Promise(r => setTimeout(r, 200));
    return { box: true, inRow, txt, was, now, folded: !document.querySelector('.dx-ren .dcn-pvbox') && !!document.querySelector('.dx-ren .dcn-shared') }; });
  check(bn.box && !bn.inRow && /11621/.test(bn.txt) && bn.was === '11621' && /^22222-/.test(bn.now) && bn.folded, 'the building number is on the shared line once set, Change opens it, it can be changed, Done folds it again ' + JSON.stringify(bn));
  /* the PDF viewer zooms inside the PDF, not the whole page (JP 2026-11-23) */
  const zv = await p.evaluate(async () => {
    await new Promise((ok, no) => { if (window.jspdf) return ok(); const sc = document.createElement('script'); sc.src = '/cmd/vendor/jspdf.umd.min.js?v=2.5.2'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    const d = new window.jspdf.jsPDF(); d.text('Made-up drawing', 20, 20); d.addPage(); d.text('Page two', 20, 20);
    const ov = window.DocNaming.view(new Blob([d.output('arraybuffer')], { type: 'application/pdf' }), 'Made-up.pdf');
    for (let i = 0; i < 40 && ov.querySelectorAll('.dx-fvz canvas').length < 2; i++) await new Promise(r => setTimeout(r, 150));
    const c = ov.querySelector('.dx-fvz canvas'), w0 = c.getBoundingClientRect().width, body = ov.querySelector('.dx-fvb');
    ov.querySelector('[data-dxz="in"]').click(); await new Promise(r => setTimeout(r, 400));
    const c2 = ov.querySelector('.dx-fvz canvas'), w1 = c2.getBoundingClientRect().width, lbl = ov.querySelector('[data-dxzl]').textContent;
    const out = { pages: ov.querySelectorAll('.dx-fvz canvas').length, w0: Math.round(w0), w1: Math.round(w1), lbl, touch: getComputedStyle(body).touchAction, bar: !ov.querySelector('.dx-fvzb').hidden };
    ov.querySelector('[data-dxfvx]').click(); return out; });
  check(zv.pages === 2 && zv.bar && zv.w1 > zv.w0 * 1.3 && zv.lbl === '140%', 'the PDF zooms inside its own window with − / + ' + JSON.stringify(zv));
  check(/pan-x/.test(zv.touch) && /pan-y/.test(zv.touch), 'and pinching there zooms the PDF, not the page (' + zv.touch + ')');
  await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); const c = li.querySelector('[data-dcncode]'); c.value = [...c.options].map(o => o.value).find(v => /^3[0-9]{2}$/.test(v) && v !== '325' && v !== '332') || ''; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); const a = li.querySelector('[data-dcntype]'); a.value = 'DA'; a.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  const r2 = await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); return { sug: li.querySelector('.dcn-sug code').textContent, btn: (document.querySelector('[data-dxrenuse]') || {}).textContent || '' }; });
  check(/^3\d\d DA Datablad radiator\.pdf$/.test(r2.sug) && !/^325/.test(r2.sug) && /Use the new name on \d+ ready/.test(r2.btn), 'the Boligbygg rule builds the new name, and the ready ones can be renamed in one go ' + JSON.stringify(r2));
  const z = await p.evaluate(async () => { let got = null; FdvPdf.share = f => { got = f; return Promise.resolve(); }; document.querySelector('[data-dxrendl]').click(); await new Promise(r => setTimeout(r, 150)); const dg = document.querySelector('.dx-dlpop [data-dlgo]'); if (dg) dg.click(); for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); if (!got) return null;
    const E = DocCtl.zipEntries(await got.arrayBuffer()); return { name: got.name, files: E.map(e => e.name).sort().join('|'), size: E.map(e => e.size).join() }; });
  check(z && /\.zip$/.test(z.name) && /3\d\d DA Datablad radiator\.pdf/.test(z.files) && !/325 DA Datablad/.test(z.files) && /332 DV Sprinkleranlegg\.pdf/.test(z.files) && /\d{5}-H02-V-332-P-01 – Rørplan\.pdf/.test(z.files) && z.files.split('|').length === 5 && z.size.split(',').every(n => +n > 5), 'the .zip has every file, the ready ones get their new names without pressing anything first (JP 22:30), with their content ' + JSON.stringify(z));
  await p.evaluate(() => document.querySelector('[data-dxrenuse]').click()); await sl(300);
  /* Fag as in JP's Coda: per building and for the whole property, with the Coda names (JP 2026-11-25) */
  const fg = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)), d = li.querySelector('[data-dcnv$=":disc"]'), t = li.querySelector('[data-dcnv$=":dtype"]'); return { e: d.options[0].textContent, g: [...d.querySelectorAll('optgroup')].map(x => x.label + ':' + [...x.children].map(o => o.value).join('')), b: (d.querySelector('option[value="B"]') || {}).textContent, tb: t && (t.querySelector('option[value="B"]') || {}).textContent }; });
  check(/Choose discipline|Velg fag/.test(fg.e), 'the empty choice says what to pick instead of a blank line ' + fg.e);
  check(fg.g.length >= 2 && /ABCEFIHKTV$/.test(fg.g[0]) && /GLMRW$/.test(fg.g[1]) && /byggeteknikk \(RIB\)|Structural engineer/.test(fg.b) && /tekniske fag|technical trades/.test(fg.tb || ''), 'Fag is grouped per building / whole property with the Coda names, and Tegningstype B too ' + JSON.stringify(fg));
  /* own codes and free text in the lists (JP 22:30) */
  await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); const d = li.querySelector('[data-dcnv$=":disc"]'); d.value = '__own'; d.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('.dcn-fpop [data-dcnownf]'); f.querySelector('[data-dcnoc]').value = 'E2'; f.querySelector('[data-dcnom]').value = 'Made-up power'; f.querySelector('[data-dcnosave]').click(); }); await sl(300);
  const oc = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)), d = li.querySelector('[data-dcnv$=":disc"]');
    return { sel: d.selectedOptions[0].textContent, grp: d.selectedOptions[0].parentNode.label, sug: li.querySelector('.dcn-sug code').textContent, kept: /E2/.test(JSON.stringify(Features.tools().dcncodes || {})) };   /* own codes: one list in your tools, synced (JP 2026-11-25) */ });
  check(oc.sel === 'E2 – Made-up power' && oc.grp === 'Your codes' && /-E2-332-/.test(oc.sug) && oc.kept, 'an own code is picked from the list, used in the name and kept for later ' + JSON.stringify(oc));
  /* naming rules (JP 22:00 "lackluster … messy with a lot of rules"): used for, your rules, Boligbygg's folded away, an editor built from parts */
  await p.evaluate(() => { document.querySelector('.dx-ren details.dcn-rules').open = true; document.querySelector('.dx-ren [data-dcnnew]').click(); }); await sl(300);
  const e1 = await p.evaluate(() => ({ ed: !!document.querySelector('.dcn-ov .dcn-ed2'), pills: [...document.querySelectorAll('.dcn-ov .dcn-pill .dcn-pname')].map(b => b.textContent), bb: !document.querySelector('.dx-ren details.dcn-bbl').open, prev: document.querySelector('.dcn-ov .dcn-prev code').textContent }));
  check(e1.ed && e1.pills.length === 3 && e1.bb && /^442 DA taklampe/.test(e1.prev), 'New rule opens the editor with three parts and a live example; Boligbygg’s rules are folded away ' + JSON.stringify(e1));
  await p.evaluate(() => { const a = document.querySelector('.dcn-ov [data-dcnpa]'); a.value = 'floor'; a.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  await p.evaluate(() => document.querySelector('.dcn-ov [data-dcnsepb="_"]').click()); await sl(200);
  await p.evaluate(() => document.querySelector('.dcn-ov [data-dcnpm="3:-1"]').click()); await sl(200);
  const e2 = await p.evaluate(() => ({ prev: document.querySelector('.dcn-ov .dcn-prev code').textContent, opt: !!document.querySelector('.dcn-ov .dcn-popt') }));
  check(e2.prev === '442_DA_H02_taklampe korridor C20.pdf' && e2.opt, 'adding a part, the separator and moving a part change the example at once ' + JSON.stringify(e2));
  await p.evaluate(() => document.querySelector('.dcn-ov [data-dcndone]').click()); await sl(200);
  const e3 = await p.evaluate(() => ({ own: [...document.querySelectorAll('.dx-ren .dcn-rlist')][0].querySelectorAll('.dcn-rrow').length, opt: [...document.querySelectorAll('.dx-ren [data-dcnuse-k="doc"] optgroup')].map(g => g.label + ':' + g.children.length).join() }));
  check(e3.own === 1 && /Your rules:1/.test(e3.opt), 'Done: the rule is listed under Your rules and can be chosen for documents ' + JSON.stringify(e3));
  await p.evaluate(() => { document.querySelector('.dx-ren [data-dcndel]').click(); }); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.dx-ren [data-dcndel]')), 'a rule of your own can be deleted');
  /* many files (JP 21:55 "could be messy"): one line each, chips for what needs you / is ready / is done, a tap opens a row */
  for (const n of ['Made-up a.dwg', 'Made-up b.xlsx', '442 DA Made-up light.pdf', 'Made-up c.docx']) fs.writeFileSync(path.join(dir, n), 'made up ' + n);
  await (await p.$('input[data-dxrenf]')).uploadFile(...['Made-up a.dwg', 'Made-up b.xlsx', '442 DA Made-up light.pdf', 'Made-up c.docx'].map(n => path.join(dir, n))); await sl(2500);
  const m1 = await p.evaluate(() => ({ rows: document.querySelectorAll('.dx-ren .dcn-row').length, compact: document.querySelectorAll('.dx-ren .dcn-row.dcn-c').length, chips: [...document.querySelectorAll('.dx-ren [data-dcnflt]')].map(b => b.textContent), dwg: [...document.querySelectorAll('.dx-ren .dcn-sumt b')].some(b => /Made-up a\.dwg/.test(b.textContent)) }));
  check(m1.rows === 9 && m1.compact === 9 && m1.chips.length === 4 && /^All 9$/.test(m1.chips[0]) && m1.dwg, 'nine files: one line each with chips; a .dwg, .xlsx and .docx are taken too ' + JSON.stringify(m1));
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnflt="todo"]').click()); await sl(200);
  const m2 = await p.evaluate(() => ({ n: document.querySelectorAll('.dx-ren .dcn-row').length, all: [...document.querySelectorAll('.dx-ren .dcn-row')].every(li => li.classList.contains('dcn-warn')) }));
  check(m2.n >= 1 && m2.n < 9 && m2.all, '"Needs you" shows only the files still missing something ' + JSON.stringify(m2));
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnexp]').click()); await sl(200);
  check(await p.evaluate(() => !!document.querySelector('.dcn-fpop [data-dcncode]')), 'a tap opens the row with its fields');
  /* Ready and Done have no pick boxes and no "Select all" – just the files, which still open (JP 2026-11-23) */
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnflt="ready"]').click()); await sl(200);
  const rd = await p.evaluate(() => ({ boxes: document.querySelectorAll('.dx-ren .dcn-files [data-dcnpk]').length, all: !!document.querySelector('.dx-ren [data-dcnpkall]'), rows: document.querySelectorAll('.dx-ren .dcn-files .dcn-row').length, open: !!document.querySelector('.dx-ren .dcn-files [data-dcnexp]') }));
  check(rd.boxes === 0 && !rd.all && (rd.rows === 0 || rd.open), 'Ready shows the files without pick boxes or Select all ' + JSON.stringify(rd));
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnflt=""]').click()); await sl(200);
  /* the add button opens a popup to drop files on (JP 07:50); a drop there adds them and closes it */
  /* with files, adding is in the "+ Add" menu (JP 2026-11-24 17:53) – Choose files still opens the drop popup */
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcaddm="ren"]').click()); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.dx-ren .dc-addlist').hidden && !!document.querySelector('.dx-ren .dc-addlist [data-dxrenclr]')), 'the Add menu has Choose files and Start again');
  await p.evaluate(() => document.querySelector('[data-dxrenopen]').click()); await sl(200);
  const dp = await p.evaluate(async () => { const o = document.querySelector('.dx-drop'); if (!o || o.parentNode !== document.body) return 'no popup';
    const n0 = document.querySelectorAll('.dx-ren .dcn-row').length, dt = new DataTransfer(); dt.items.add(new File(['made up'], 'Made-up dropped.pdf'));
    o.querySelector('.dx-dz').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); await new Promise(r => setTimeout(r, 1500));
    return { gone: !document.querySelector('.dx-drop'), added: document.querySelectorAll('.dx-ren .dcn-row').length - n0, there: [...document.querySelectorAll('.dx-ren .dcn-row')].some(x => /Made-up dropped/.test(x.textContent)) }; });
  check(dp.gone && dp.there, 'files dropped on the popup are added and the popup closes ' + JSON.stringify(dp));
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcaddm="ren"]').click()); await sl(200); await p.evaluate(() => document.querySelector('[data-dxrenopen]').click()); await sl(200); await p.keyboard.press('Escape'); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.dx-drop')), 'Escape closes the drop popup');
  /* a photo's name needs the property ID: asked at the top and in the file's popup, kept for the next files (JP 09:18) */
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); dt.items.add(new File(['made up'], 'IMG_0001.jpeg', { type: 'image/jpeg' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(1500);
  const pv = await p.evaluate(async () => { const top = !!document.querySelector('.dx-ren [data-dcnpv="pid"]'), li = await R(/IMG_0001/), inPop = !!(li && li.querySelector('[data-dcnpv="pid"]'));
    const f = li.querySelector('[data-dcnpv="pid"]'); f.value = '3-999'; f.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400));
    const li2 = await R(/IMG_0001/); return { top, inPop, sug: li2.querySelector('.dcn-sug code').textContent, kept: /3-999/.test(localStorage.getItem('dcn.tool') || '') }; });
  check(pv.top && pv.inPop && /^3-999[–-]/.test(pv.sug) && pv.kept, 'the property ID can be filled in, goes into the photo’s name and is kept ' + JSON.stringify(pv));
  /* a redraw from elsewhere waits while you are choosing in a list of the popup, then comes when you leave it (JP 12:54 "boxes close so fast") */
  const bgd = await p.evaluate(async () => { const li = await R(/./), sel = li.querySelector('select'); await new Promise(r => setTimeout(r, 600)); sel.focus(); const before = document.querySelector('.dcn-fpop');
    DocCtl.draw(); await new Promise(r => setTimeout(r, 300)); const same = document.querySelector('.dcn-fpop') === before && document.activeElement === sel;
    sel.blur(); await new Promise(r => setTimeout(r, 400)); return { same, after: document.querySelector('.dcn-fpop') !== before }; });
  check(bgd.same && bgd.after, 'a redraw from elsewhere waits while a list in the popup is in use ' + JSON.stringify(bgd));
  /* selecting text and letting go outside the box doesn't close it; a tap on the dimmed background does (JP 08:48) */
  const bg = await p.evaluate(async () => { await R(/./); const ov = document.querySelector('.dcn-fpop'), inp = ov.querySelector('input, select');
    inp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
    const stays = !!document.querySelector('.dcn-fpop'); const ov2 = document.querySelector('.dcn-fpop');
    ov2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); ov2.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
    return { stays, closes: !document.querySelector('.dcn-fpop') }; });
  check(bg.stays && bg.closes, 'a drag that ends outside keeps the popup; a tap outside closes it ' + JSON.stringify(bg));
  /* Open shows the file in a popup over the page, not a new tab (JP 07:53) */
  const pages0 = (await b.pages()).length;
  await p.evaluate(() => { const e = document.querySelector('.dx-ren [data-dcnexp]'); e.click(); }); await sl(300);
  await p.evaluate(() => { const o = document.querySelector('.dcn-fpop .dcn-open'); if (o && !document.querySelector('.dx-fv')) o.click(); }); await sl(600);
  const fv = await p.evaluate(() => { const o = document.querySelector('.dx-fv'); return o ? { body: o.parentNode === document.body, dl: !!o.querySelector('a[download]') } : null; });
  check(fv && fv.body && fv.dl && (await b.pages()).length === pages0, 'Open shows the file in a popup with Download – no new tab ' + JSON.stringify(fv));
  await p.keyboard.press('Escape'); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.dx-fv')), 'Escape closes the file popup');
  /* JP 06:38: ¤ in names, the type before a code, the row inside its box, the name further down with its own Open button, Start again asks */
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); dt.items.add(new File(['made up text'], 'TDS¤71¤MADEUP Oljemaling¤Nor¤NO.pdf', { type: 'application/pdf' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(2000);
  const tz = await p.evaluate(async () => { const li = (await R(/MADEUP/)); if (!li) return null;
    if (li.classList.contains('dcn-c')) { li.querySelector('[data-dcnexp]').click(); }
    return true; }); await sl(300);
    const t2 = await p.evaluate(async () => { const li = (await R(/MADEUP/)), ty = li.querySelector('[data-dcntype]'), lr = li.getBoundingClientRect();
    const out = [...li.querySelectorAll('input, select, button, label')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > lr.right + 1 || r.left < lr.left - 1); }).map(e => e.tagName + '.' + e.className);
    const n = li.querySelector('.dcn-s .dcn-n'), d = li.querySelector('[data-dcnv$=":desc"]');
    return { typeOn: !!ty && !ty.disabled && ty.options.length > 5, code: (li.querySelector('[data-dcncode]') || {}).value, desc: d ? d.value : '', out, nameDown: !n && !!li.querySelector('.dcn-head .dcn-open, .dcn-sumb') && !li.querySelector('.dcn-g [data-dcview]'), first: li.querySelector('.dcn-g > *').classList.contains('dcn-kind') }; });
  check(tz && t2.typeOn && !/^71/.test(t2.code) && !/¤/.test(t2.desc) && t2.out.length === 0 && t2.nameDown && t2.first, 'a ¤ name: no 2-digit code, words split; the type can be picked before the code; nothing sticks out; kind first; the file’s name and Open are in the card’s head (JP 2026-11-24) ' + JSON.stringify(t2));
  await p.setViewport({ width: 600, height: 900, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); await sl(400);
  check(await p.evaluate(() => [...document.querySelectorAll('.dcn-fpop .dcn-row')].every(li => { const lr = li.getBoundingClientRect(); return [...li.querySelectorAll('select, input')].every(e => { const r = e.getBoundingClientRect(); return !r.width || r.right <= lr.right + 1; }); })), 'at 600 px (Team’s column) the fields stay inside the row');
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); await sl(400);
  /* New rule opens a popup on top of the page; Escape closes it */
  await p.evaluate(() => { document.querySelector('.dx-ren details.dcn-rules').open = true; document.querySelector('.dx-ren [data-dcnnew]').click(); }); await sl(300);
  const pop = await p.evaluate(() => { const o = document.querySelector('.dcn-ov'); return { body: !!o && o.parentNode === document.body, fixed: !!o && getComputedStyle(o).position === 'fixed', h: o ? Math.round(o.querySelector('.dcn-sheet').getBoundingClientRect().bottom) : 0 }; });
  check(pop.body && pop.fixed && pop.h <= 852, 'New rule opens as a popup on top of the page ' + JSON.stringify(pop));
  await p.keyboard.press('Escape'); await sl(300);
  check(await p.evaluate(() => !document.querySelector('.dcn-ov')), 'Escape closes the popup');
  await p.evaluate(() => { const r = [...document.querySelectorAll('.dx-ren [data-dcndel]')]; r.forEach(b => b.click()); }); await sl(300);
  const hb = await p.evaluate(() => { const b = document.querySelector('.dx-ren .pill-btn:not(.sm)'); return Math.round(b.getBoundingClientRect().height); });
  check(hb >= 44, 'the buttons are at least 44 px tall: ' + hb);
  /* code names (JP 07:48): an unnamed code is just its number; names pasted from your own copy show in the list, kept on this device */
  const nm0 = await p.evaluate(async () => { const s = (await R(/./)).querySelector('[data-dcncode]'); const o = s && s.querySelector('option[value="413"]'); return o ? o.textContent : null; });
  await p.evaluate(() => { document.querySelector('.dx-ren details.dcn-rules').open = true; document.querySelector('[data-dcnnsp]').click(); }); await sl(200);
  await p.evaluate(() => { document.querySelector('[data-dcnnst]').value = '412 Made-up wiring\n413\tMade-up cables\n#skip'; document.querySelector('[data-dcnnss]').click(); }); await sl(300);
  const nm1 = await p.evaluate(async () => { const s = (await R(/./)).querySelector('[data-dcncode]'); return { gone: !s.querySelector('option[value="414"]'), a: s.querySelector('option[value="412"]').textContent, b: s.querySelector('option[value="413"]').textContent, kept: (Features.tools().fdvcodes || []).filter(c => /^41[23]$/.test(c.c)).length, where: document.querySelector('.dcn-nsimp small').textContent }; });
  check(nm0 === '413' && nm1.gone && nm1.a === '412 Made-up wiring' && nm1.b === '413 Made-up cables' && nm1.kept === 2 && /all your devices/.test(nm1.where), 'codes without a name show only the number; pasted names show in the list and are saved with your codes (synced) ' + JSON.stringify({ nm0, nm1 }));
  /* redraws that come by themselves are gathered – uploading many files made the page flicker (JP 13:32) */
  const fl = await p.evaluate(async () => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); await new Promise(r => setTimeout(r, 900)); window.__dcUser = 0;
    const el = document.getElementById('wkDocCtl'); let n = 0; const mo = new MutationObserver(ms => { if (ms.some(m => m.target === el)) n++; }); mo.observe(el, { childList: true });
    for (let i = 0; i < 12; i++) { DocCtl.draw(); await new Promise(r => setTimeout(r, 60)); } await new Promise(r => setTimeout(r, 1200)); mo.disconnect(); return n; });
  check(fl >= 1 && fl <= 3, '12 background redraws in under a second become at most 3 (' + fl + ')');
  /* the code is searchable (JP 12:53) */
  const sr = await p.evaluate(async () => { const li = await R(/./); li.querySelector('[data-dcncpick]').click(); await new Promise(r => setTimeout(r, 200));
    const q = document.querySelector('.dcn-cpk .dcn-cpq'); q.value = '41'; q.dispatchEvent(new Event('input')); const all = [...document.querySelectorAll('.dcn-cpk [data-cpv]')].map(b => b.dataset.cpv);
    q.value = 'made-up wiring'; q.dispatchEvent(new Event('input')); const w = [...document.querySelectorAll('.dcn-cpk [data-cpv]')].map(b => b.dataset.cpv);
    document.querySelector('.dcn-cpk [data-cpv="412"]').click(); await new Promise(r => setTimeout(r, 500));
    const li2 = await R(/./); return { all: all.every(v => v.startsWith('41')) && all.length > 0, w: w.join(), gone: !document.querySelector('.dcn-cpk'), now: li2.querySelector('[data-dcncode]').value }; });
  check(sr.all && sr.w === '412' && sr.gone && sr.now === '412', 'search the code by number or by words, and pick it ' + JSON.stringify(sr));
  await p.evaluate(() => document.querySelector('[data-dxrenclr]').click()); await sl(200);
  check(await p.evaluate(() => document.querySelectorAll('.dx-ren .dcn-row').length > 0 && /again/i.test(document.querySelector('[data-dxrenclr]').textContent)), 'Start again asks first – the files are still there');
  await p.evaluate(() => document.querySelector('[data-dxrenclr]').click()); await sl(300);
  check(await p.evaluate(() => !document.querySelector('.dx-ren .dcn-row')), 'a second tap starts again');
  await p.evaluate(() => document.querySelector('.dx-ren [data-dxtool=""]').click()); await sl(300);
  /* FDV names */
  await p.evaluate(() => document.querySelector('[data-dxtool="fdv"]').click()); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-dxfdv]'); f.t.value = '332 SE Sprinkleranlegg\n442 XX Lys\nRørplan\n'; f.requestSubmit(); }); await sl(300);
  const f1 = await p.evaluate(() => ({ sum: document.querySelector('.dx-sum b').textContent, bad: [...document.querySelectorAll('.dx-flist li.dx-bad')].map(li => li.textContent), ok: document.querySelectorAll('.dx-flist li:not(.dx-bad)').length }));
  check(/1 of 3 names follow the rules/.test(f1.sum) && f1.bad.length === 2 && f1.bad.some(x => /442 XX Lys.*Unknown document code/.test(x)) && f1.ok === 1, 'pasted names are checked: OK, or what is wrong ' + JSON.stringify(f1));
  /* Start over clears the list and the box for a new import (JP 2026-11-23) */
  await p.evaluate(() => document.querySelector('[data-dxfdvclr]').click()); await sl(250);
  check(await p.evaluate(() => !document.querySelector('.dx-flist') && !document.querySelector('.dx-sum') && document.querySelector('form[data-dxfdv] textarea').value === ''), 'Start over clears the checked names');
  check(await p.evaluate(b => { const t = Object.assign({}, Features.tools()); delete t.fdvcodes; delete t.fdvlearn; delete t.dcncodes; return JSON.stringify(t).length === b; }, before), 'the tools saved nothing (but the NS code names you imported and your own codes)');
  /* duplicates: only the same content is grouped, nothing goes by itself, a person picks (JP 2026-11-19) */
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await p.evaluate(() => { const c = document.querySelector('[data-dxrenclr]'); if (c) { c.click(); c.click(); } }); await sl(300);
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer();
    dt.items.add(new File(['%PDF made-up fire concept'], 'Made-up fire concept.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['%PDF made-up fire concept'], 'Made-up fire concept (1).pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['%PDF made-up fire concept v2'], 'Made-up fire concept v2.pdf', { type: 'application/pdf' }));
    i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(1500);
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); dt.items.add(new File(['%PDF made-up fire concept'], 'Made-up fire concept.pdf', { type: 'application/pdf' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(1200);
  const d0 = await p.evaluate(() => ({ rows: document.querySelectorAll('.dx-ren .dcn-row').length, bar: (document.querySelector('.dx-dupbar') || {}).textContent || '' }));
  check(d0.rows === 3 && /2 files are here more than once/.test(d0.bar), 'files with the same content are found; nothing is removed by itself; the very same file added again is not doubled ' + JSON.stringify(d0));
  await p.evaluate(() => document.querySelector('[data-dxdups]').click()); await sl(300);
  const d1 = await p.evaluate(() => ({ items: document.querySelectorAll('.dx-dupov .dx-duplist li').length, open: !!document.querySelector('.dx-dupov [data-dupview]'), all: !!document.querySelector('.dx-dupov [data-dupall]') }));
  check(d1.items === 2 && d1.open && !d1.all, 'the check shows the two same files, each can be opened, and there is no "clean up all" ' + JSON.stringify(d1));
  await p.evaluate(() => { const r = document.querySelectorAll('.dx-dupov input[name=dupkeep]')[1]; r.click(); }); await sl(100);
  await p.evaluate(() => document.querySelector('.dx-dupov [data-duprm]').click()); await sl(400);
  const d2 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.dx-ren .dcn-row')].map(r => r.textContent), bar: !!document.querySelector('.dx-dupbar'), pop: !!document.querySelector('.dx-dupov') }));
  check(d2.rows.length === 2 && d2.rows.some(t => /fire concept \(1\)/.test(t)) && !d2.bar && !d2.pop, 'the one picked stays, the other leaves the list, and the check is done ' + JSON.stringify(d2));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
