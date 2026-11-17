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
  check(t0 === 'Check a document plan|Give files the right names|Check names from the FDV system', 'three one-off tools on top ' + t0);
  const before = await p.evaluate(() => JSON.stringify(Features.tools()).length);
  /* rename: the file naming (suggestions from the name and the PDF text, the naming rules) on files outside any project (JP 20:43) */
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await (await p.$('input[data-dxrenf]')).uploadFile(zf, lone); await sl(2500);
  /* a file opens in a popup (JP 2026-11-17 08:07): R(/name/) opens it and gives its full row */
  const defR = () => p.evaluate(() => { window.R = async re => { const c = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => re.test(x.textContent)); if (c) { c.querySelector('[data-dcnexp]').click(); await new Promise(r => setTimeout(r, 350)); } return document.querySelector('.dcn-fpop .dcn-row'); }; });
  await defR();
  const r1 = await p.evaluate(async () => ({ rows: [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].map(li => li.textContent.replace(/\s+/g, ' ').trim()), rules: !!document.querySelector('.dx-ren .dcn-rules'), sum: (document.querySelector('.dx-rsum') || {}).textContent || '',
    sugg: ((await R(/Datablad radiator/)) || { querySelector: () => ({}) }).querySelector('[data-dcncode]').value, plan: /Not in the plan/.test(document.querySelector('.dx-ren').textContent) }));
  check(r1.rows.length === 5 && r1.rules && !r1.plan && /5 files/.test(r1.sum), 'files and the .zip become rows with the naming rules (no plan talk outside a project) ' + JSON.stringify(r1));
  check(/^325/.test(r1.sugg || ''), 'a file named after what it is gets a suggested code from its name (Datablad radiator → 325) ' + JSON.stringify(r1.sugg));
  /* a drawing: the letters say what they mean (Boligbygg's tables 8–11), the discipline comes from the code and the drawing type from the name (JP 21:21) */
  const dw = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); if (!li) return null; const sel = k => li.querySelector('[data-dcnv$=":' + k + '"]');
    return { disc: sel('disc') && sel('disc').selectedOptions[0].textContent, dtype: sel('dtype') && sel('dtype').selectedOptions[0].textContent, floors: sel('floor') && [...sel('floor').options].map(o => o.textContent).slice(1, 3), sug: li.querySelector('.dcn-sug code').textContent }; });
  const dk = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); return { type: !!li.querySelector('[data-dcntype]'), kind: !!li.querySelector('.dcn-g > .dcn-kind'), code: !!li.querySelector('[data-dcncode]') }; });
  check(!dk.type && dk.kind && dk.code, 'a drawing has its kind in the first row, keeps the NS code (it is in the drawing name) and has no document type (JP 22:02) ' + JSON.stringify(dk));
  check(dw && /^V – HVAC and plumbing/.test(dw.disc) && dw.dtype === 'P – Plan' && dw.floors[0] === 'K02 – 2nd basement' && /-V-332-P-\d\d – Rørplan sprinkler\.dwg$/.test(dw.sug), 'a drawing: the choices say what the letters mean, and the discipline (from 332) and type (from “rørplan”) are suggested ' + JSON.stringify(dw));
  await p.evaluate(() => { const b = document.querySelector('[data-dcnbid]'); b.value = '11621'; b.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  check(await p.evaluate(async () => /^11621-/.test((await R(/Rørplan sprinkler/)).querySelector('.dcn-sug code').textContent)), 'the building number for drawings is filled in once for all of them');
  await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); const c = li.querySelector('[data-dcncode]'); c.value = [...c.options].map(o => o.value).find(v => /^3[0-9]{2}$/.test(v) && v !== '325' && v !== '332') || ''; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); const a = li.querySelector('[data-dcntype]'); a.value = 'DA'; a.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  const r2 = await p.evaluate(async () => { const li = (await R(/Datablad radiator/)); return { sug: li.querySelector('.dcn-sug code').textContent, btn: (document.querySelector('[data-dxrenuse]') || {}).textContent || '' }; });
  check(/^3\d\d DA Datablad radiator\.pdf$/.test(r2.sug) && !/^325/.test(r2.sug) && /Use the new name on \d+ ready/.test(r2.btn), 'the Boligbygg rule builds the new name, and the ready ones can be renamed in one go ' + JSON.stringify(r2));
  const z = await p.evaluate(async () => { let got = null; FdvPdf.share = f => { got = f; return Promise.resolve(); }; document.querySelector('[data-dxrendl]').click(); for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); if (!got) return null;
    const E = DocCtl.zipEntries(await got.arrayBuffer()); return { name: got.name, files: E.map(e => e.name).sort().join('|'), size: E.map(e => e.size).join() }; });
  check(z && /\.zip$/.test(z.name) && /3\d\d DA Datablad radiator\.pdf/.test(z.files) && !/325 DA Datablad/.test(z.files) && /332 DV Sprinkleranlegg\.pdf/.test(z.files) && /\d{5}-H02-V-332-P-01 – Rørplan\.pdf/.test(z.files) && z.files.split('|').length === 5 && z.size.split(',').every(n => +n > 5), 'the .zip has every file, the ready ones get their new names without pressing anything first (JP 22:30), with their content ' + JSON.stringify(z));
  await p.evaluate(() => document.querySelector('[data-dxrenuse]').click()); await sl(300);
  /* own codes and free text in the lists (JP 22:30) */
  await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)); const d = li.querySelector('[data-dcnv$=":disc"]'); d.value = '__own'; d.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('.dcn-fpop [data-dcnownf]'); f.querySelector('[data-dcnoc]').value = 'E2'; f.querySelector('[data-dcnom]').value = 'Made-up power'; f.querySelector('[data-dcnosave]').click(); }); await sl(300);
  const oc = await p.evaluate(async () => { const li = (await R(/Rørplan sprinkler/)), d = li.querySelector('[data-dcnv$=":disc"]');
    return { sel: d.selectedOptions[0].textContent, grp: d.selectedOptions[0].parentNode.label, sug: li.querySelector('.dcn-sug code').textContent, kept: /E2/.test(localStorage.getItem('dcn.tool') || '') }; });
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
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnflt=""]').click()); await sl(200);
  /* the add button opens a popup to drop files on (JP 07:50); a drop there adds them and closes it */
  await p.evaluate(() => document.querySelector('[data-dxrenopen]').click()); await sl(200);
  const dp = await p.evaluate(async () => { const o = document.querySelector('.dx-drop'); if (!o || o.parentNode !== document.body) return 'no popup';
    const n0 = document.querySelectorAll('.dx-ren .dcn-row').length, dt = new DataTransfer(); dt.items.add(new File(['made up'], 'Made-up dropped.pdf'));
    o.querySelector('.dx-dz').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); await new Promise(r => setTimeout(r, 1500));
    return { gone: !document.querySelector('.dx-drop'), added: document.querySelectorAll('.dx-ren .dcn-row').length - n0, there: [...document.querySelectorAll('.dx-ren .dcn-row')].some(x => /Made-up dropped/.test(x.textContent)) }; });
  check(dp.gone && dp.there, 'files dropped on the popup are added and the popup closes ' + JSON.stringify(dp));
  await p.evaluate(() => document.querySelector('[data-dxrenopen]').click()); await sl(200); await p.keyboard.press('Escape'); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.dx-drop')), 'Escape closes the drop popup');
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
    return { typeOn: !!ty && !ty.disabled && ty.options.length > 5, code: (li.querySelector('[data-dcncode]') || {}).value, desc: d ? d.value : '', out, nameDown: !!n && !!n.querySelector('.dcn-open') && !li.querySelector('.dcn-g [data-dcview]'), first: li.querySelector('.dcn-g > *').classList.contains('dcn-kind') }; });
  check(tz && t2.typeOn && !/^71/.test(t2.code) && !/¤/.test(t2.desc) && t2.out.length === 0 && t2.nameDown && t2.first, 'a ¤ name: no 2-digit code, words split; the type can be picked before the code; nothing sticks out; kind first; the name sits lower with its own Open button ' + JSON.stringify(t2));
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
  const hb = await p.evaluate(() => { const b = document.querySelector('.dx-ren .pill-btn'); return Math.round(b.getBoundingClientRect().height); });
  check(hb >= 44, 'the buttons are at least 44 px tall: ' + hb);
  /* code names (JP 07:48): an unnamed code is just its number; names pasted from your own copy show in the list, kept on this device */
  const nm0 = await p.evaluate(async () => { const s = (await R(/./)).querySelector('[data-dcncode]'); const o = s && s.querySelector('option[value="413"]'); return o ? o.textContent : null; });
  await p.evaluate(() => { document.querySelector('.dx-ren details.dcn-rules').open = true; document.querySelector('[data-dcnnsp]').click(); }); await sl(200);
  await p.evaluate(() => { document.querySelector('[data-dcnnst]').value = '412 Made-up wiring\n413\tMade-up cables\n#skip'; document.querySelector('[data-dcnnss]').click(); }); await sl(300);
  const nm1 = await p.evaluate(async () => { const s = (await R(/./)).querySelector('[data-dcncode]'); return { a: s.querySelector('option[value="412"]').textContent, b: s.querySelector('option[value="413"]').textContent, kept: Object.keys(JSON.parse(localStorage.getItem('dcn.nsnames') || '{}')).length }; });
  check(nm0 === '413' && nm1.a === '412 Made-up wiring' && nm1.b === '413 Made-up cables' && nm1.kept === 2, 'codes without a name show only the number; pasted names show in the list ' + JSON.stringify({ nm0, nm1 }));
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
  check(await p.evaluate(b => JSON.stringify(Features.tools()).length === b, before), 'the tools saved nothing');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
