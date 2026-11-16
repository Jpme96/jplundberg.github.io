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
  const r1 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.dx-ren .dcn-row')].map(li => li.querySelector('.dcn-n').textContent.replace(/\s+/g, ' ').trim()), rules: !!document.querySelector('.dx-ren .dcn-rules'), sum: (document.querySelector('.dx-rsum') || {}).textContent || '',
    sugg: [...document.querySelectorAll('.dx-ren .dcn-row')].filter(li => /Datablad radiator/.test(li.textContent)).map(li => li.querySelector('[data-dcncode]').value)[0], plan: /Not in the plan/.test(document.querySelector('.dx-ren').textContent) }));
  check(r1.rows.length === 5 && r1.rules && !r1.plan && /5 files/.test(r1.sum), 'files and the .zip become rows with the naming rules (no plan talk outside a project) ' + JSON.stringify(r1));
  check(/^325/.test(r1.sugg || ''), 'a file named after what it is gets a suggested code from its name (Datablad radiator → 325) ' + JSON.stringify(r1.sugg));
  /* a drawing: the letters say what they mean (Boligbygg's tables 8–11), the discipline comes from the code and the drawing type from the name (JP 21:21) */
  const dw = await p.evaluate(() => { const li = [...document.querySelectorAll('.dx-ren .dcn-row')].find(x => /Rørplan sprinkler/.test(x.textContent)); if (!li) return null; const sel = k => li.querySelector('[data-dcnv$=":' + k + '"]');
    return { disc: sel('disc') && sel('disc').selectedOptions[0].textContent, dtype: sel('dtype') && sel('dtype').selectedOptions[0].textContent, floors: sel('floor') && [...sel('floor').options].map(o => o.textContent).slice(1, 3), sug: li.querySelector('.dcn-sug code').textContent }; });
  check(dw && /^V – HVAC and plumbing/.test(dw.disc) && dw.dtype === 'P – Plan' && dw.floors[0] === 'K02 – 2nd basement' && /-V-332-P-\d\d – Rørplan sprinkler\.dwg$/.test(dw.sug), 'a drawing: the choices say what the letters mean, and the discipline (from 332) and type (from “rørplan”) are suggested ' + JSON.stringify(dw));
  await p.evaluate(() => { const b = document.querySelector('[data-dcnbid]'); b.value = '11621'; b.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  check(await p.evaluate(() => /^11621-/.test([...document.querySelectorAll('.dx-ren .dcn-row')].find(x => /Rørplan sprinkler/.test(x.textContent)).querySelector('.dcn-sug code').textContent)), 'the building number for drawings is filled in once for all of them');
  await p.evaluate(() => { const li = [...document.querySelectorAll('.dx-ren .dcn-row')].find(x => /Datablad radiator/.test(x.textContent)); const c = li.querySelector('[data-dcncode]'); c.value = '351 Made-up'; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await p.evaluate(() => { const li = [...document.querySelectorAll('.dx-ren .dcn-row')].find(x => /Datablad radiator/.test(x.textContent)); const a = li.querySelector('[data-dcntype]'); a.value = 'DA'; a.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  const r2 = await p.evaluate(() => { const li = [...document.querySelectorAll('.dx-ren .dcn-row')].find(x => /Datablad radiator/.test(x.textContent)); return { sug: li.querySelector('.dcn-sug code').textContent, btn: (document.querySelector('[data-dxrenuse]') || {}).textContent || '' }; });
  check(/^351 DA Datablad radiator\.pdf$/.test(r2.sug) && /Use the new name on \d+ ready/.test(r2.btn), 'the Boligbygg rule builds the new name, and the ready ones can be renamed in one go ' + JSON.stringify(r2));
  await p.evaluate(() => document.querySelector('[data-dxrenuse]').click()); await sl(300);
  const z = await p.evaluate(async () => { let got = null; FdvPdf.share = f => { got = f; return Promise.resolve(); }; document.querySelector('[data-dxrendl]').click(); for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); if (!got) return null;
    const E = DocCtl.zipEntries(await got.arrayBuffer()); return { name: got.name, files: E.map(e => e.name).sort().join('|'), size: E.map(e => e.size).join() }; });
  check(z && /\.zip$/.test(z.name) && /351 DA Datablad radiator\.pdf/.test(z.files) && /332 DV Sprinkleranlegg\.pdf/.test(z.files) && /\d{5}-H02-V-332-P-01 – Rørplan\.pdf/.test(z.files) && z.files.split('|').length === 5 && z.size.split(',').every(n => +n > 5), 'the .zip has every file, the renamed ones with their new names, with their content ' + JSON.stringify(z));
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
