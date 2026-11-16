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
fs.writeFileSync(zf, zip([['FDV/332 DV Sprinkleranlegg.pdf', '%PDF made up 1'], ['FDV/Datablad pumpe.pdf', '%PDF made up 2'], ['FDV/99999-H02-V-332-P-01 – Rørplan.pdf', '%PDF made up 3'], ['__MACOSX/._x', 'x']], true));
fs.writeFileSync(lone, '%PDF made up 4');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  const t0 = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl .dx-tools .dx-tool b')].map(x => x.textContent).join('|'));
  check(t0 === 'Check a document plan|Give files the right names|Check names from the FDV system', 'three one-off tools on top ' + t0);
  const before = await p.evaluate(() => JSON.stringify(Features.tools()).length);
  /* rename */
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await (await p.$('input[data-dxrenf]')).uploadFile(zf, lone); await sl(1200);
  const r1 = await p.evaluate(() => [...document.querySelectorAll('.dx-ren')].map(li => li.querySelector('.dx-rold').textContent + ' → ' + li.querySelector('.dx-rnew span').textContent + (li.querySelector('.dx-rnew.dx-bad') ? ' !' : '')));
  check(r1.length === 4 && r1.some(x => /^332 DV Sprinkleranlegg\.pdf → 332 DV Sprinkleranlegg\.pdf$/.test(x)) && r1.some(x => /Rørplan\.pdf → 99999-H02-V-332-P-01 – Rørplan\.pdf$/.test(x)) && r1.some(x => /^Datablad pumpe\.pdf → Datablad pumpe\.pdf !$/.test(x)), 'files and the .zip are read: a good name stays, a drawing after the template is kept, a name without code is marked ' + JSON.stringify(r1));
  const dl0 = await p.evaluate(() => document.querySelector('[data-dxrenn]').textContent);
  check(/Download 2 of 4/.test(dl0), 'the download counts only the files that are ready ' + dl0);
  await p.evaluate(() => { const li = [...document.querySelectorAll('.dx-ren')].find(x => /Datablad pumpe/.test(x.querySelector('.dx-rold').textContent)); const c = li.querySelector('[data-dxrc]'); c.value = '351'; c.dispatchEvent(new Event('input', { bubbles: true })); const a = li.querySelector('[data-dxra]'); a.value = 'DA'; a.dispatchEvent(new Event('change', { bubbles: true })); const t = li.querySelector('[data-dxrt]'); t.value = 'Made-up pump'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sl(200);
  const r2 = await p.evaluate(() => ({ n: document.querySelector('[data-dxrenn]').textContent, row: [...document.querySelectorAll('.dx-rnew span')].map(s => s.textContent).find(x => /pump/.test(x)) }));
  check(/Download 3 of 4/.test(r2.n) && r2.row === '351 DA Made-up pump.pdf', 'typing the code, picking the document code and the text gives the new name at once ' + JSON.stringify(r2));
  const z = await p.evaluate(async () => { let got = null; FdvPdf.share = f => { got = f; return Promise.resolve(); }; document.querySelector('[data-dxrendl]').click(); for (let i = 0; i < 40 && !got; i++) await new Promise(r => setTimeout(r, 100)); if (!got) return null;
    const E = DocCtl.zipEntries(await got.arrayBuffer()); return { name: got.name, files: E.map(e => e.name).sort().join('|'), size: E.map(e => e.size).join() }; });
  check(z && /\.zip$/.test(z.name) && z.files === '332 DV Sprinkleranlegg.pdf|351 DA Made-up pump.pdf|99999-H02-V-332-P-01 – Rørplan.pdf' && z.size.split(',').every(n => +n > 5), 'the .zip has the ready files with their new names and their content ' + JSON.stringify(z));
  /* FDV names */
  await p.evaluate(() => document.querySelector('[data-dxtool="fdv"]').click()); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-dxfdv]'); f.t.value = '332 SE Sprinkleranlegg\n442 XX Lys\nRørplan\n'; f.requestSubmit(); }); await sl(300);
  const f1 = await p.evaluate(() => ({ sum: document.querySelector('.dx-sum b').textContent, bad: [...document.querySelectorAll('.dx-flist li.dx-bad')].map(li => li.textContent), ok: document.querySelectorAll('.dx-flist li:not(.dx-bad)').length }));
  check(/1 of 3 names follow the rules/.test(f1.sum) && f1.bad.length === 2 && f1.bad.some(x => /442 XX Lys.*Unknown document code/.test(x)) && f1.ok === 1, 'pasted names are checked: OK, or what is wrong ' + JSON.stringify(f1));
  check(await p.evaluate(b => JSON.stringify(Features.tools()).length === b, before), 'the tools saved nothing');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
