/* Work → Document control (2026-11-14): a project, its document plan (an Excel file like Boligbygg's Dokumentplan –
   one sheet per main group, a header row with Anleggsnummer / Anleggsnavn / Brannbok / document type / planned name),
   the delivered files matched by name, the naming checks, statuses with comments, the overview and the report (PDF).
   Made-up data only. */
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
/* a tiny .xlsx (a stored zip of XML with inline strings) */
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
const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function sheet(rows) { return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((v, j) => v === '' ? '' : '<c r="' + String.fromCharCode(65 + j) + (i + 1) + '" t="inlineStr"><is><t>' + X(v) + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>'; }
const H = ['', 'Anleggsnummer', 'Anleggsnavn', 'Kategori anlegg', 'Brannbok', 'Velg dokument type/informasjonstype', 'Planlagt navngivning', 'Kommentar'];
const S1 = [['Generelt'], ['', 'Hvordan bruke planen?'], ['', 'Kode', 'Type', 'Beskrivelse']];
const S3 = [['3 - VVS'], H,
  ['3', '300.000', 'VVS generelt', '3 VVS', 'Nei', '', 'Navngivning ref. Mal for FDVU kap. 3.6. Dokumentnavnet skal bestå av …', ''],
  ['3', '310.000', 'Sanitær', '3 VVS', 'Nei', '', '', ''],
  ['3', '332.101', 'Brannslukking med sprinkler', '332 Sprinkelanlegg', 'Ja', 'Kravoppnåelse', '332 SE Sprinkleranlegg', 'Made-up note'],
  ['', '', '', '', '', 'Drift, Vedlikehold', '332 DV Sprinkleranlegg', ''],
  ['', '', '', '', '', 'Tegning', '', ''],
  ['3', '336.000', 'Brannslokking med skum', '330 Brannslokking', 'Ja', 'Produktinformasjon', '', '']];
const S2 = [['2 - Bygning'], H, ['2', '234.000', 'Vinduer, dører, porter', '2 Bygg', 'Nei', 'Produktinformasjon', 'Eksempel: 234 DA Vindu', ''], ['2', '235.000', 'Utvendig kledning', '2 Bygg', 'Nei', 'Drift, Vedlikehold', '', '']];
const book = zip([
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Generelt" sheetId="1" r:id="rId1"/><sheet name="3 - VVS" sheetId="2" r:id="rId2"/><sheet name="2 - Bygning" sheetId="3" r:id="rId3"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml', sheet(S1)], ['xl/worksheets/sheet2.xml', sheet(S3)], ['xl/worksheets/sheet3.xml', sheet(S2)]], true);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-')), planF = path.join(dir, 'Made-up plan.xlsx'); fs.writeFileSync(planF, book);
/* delivered files: two loose, three in a zip (one in a folder) */
const f1 = path.join(dir, '332 SE Sprinkleranlegg.pdf'), f2 = path.join(dir, 'random scan 7.pdf'); fs.writeFileSync(f1, '%PDF-1.4 made up'); fs.writeFileSync(f2, '%PDF-1.4 made up');
const zf = path.join(dir, 'Made-up delivery.zip');
fs.writeFileSync(zf, zip([['FDV/332 DV Sprinkleranlegg.pdf', '%PDF made up'], ['FDV/99999-H02-V-332-P-01 – Rørplan rev 2.pdf', '%PDF made up'], ['FDV/234 DA Vindu sørfasade modell X fra Made-up.pdf', '%PDF made up'], ['__MACOSX/._x', 'x']], true));
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dctl = []; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  /* names on their own */
  const nm = await p.evaluate(() => ['442 DA taklampe korridor C20 Glamox.pdf', '11621-H02-V-332-P-01 – Rørplan.dwg', '11621-H02-V-332-P-01 – Rørplan rev B.pdf', 'Rørplan.pdf', '332 XX Sprinkler.pdf', '332.101 SE Sprinkler.pdf', 'IMG_0001.jpg'].map(n => { const r = DocCtl.parseName(n); return [r.code, r.abbr, r.kind, r.issues.map(i => i[1]).join('+')]; }));
  check(JSON.stringify(nm) === JSON.stringify([['442', 'DA', 'doc', 'long'], ['332', 'K', 'drawing', ''], ['332', 'K', 'drawing', 'version'], ['', '', 'doc', 'nocode'], ['332', 'XX', 'doc', 'abbr'], ['332.101', 'SE', 'doc', ''], ['', '', 'doc', '']]), 'file names: code, document code, drawings, and the problems (long, version, no code, unknown code) ' + JSON.stringify(nm));
  check((await p.evaluate(() => ['Drift, Vedlikehold', 'E', 'Kravoppnåelse', 'Tegning', 'A, F'].map(DocCtl.letters).join())) === 'BC,E,A,K,AF', 'document types become NS 3456 letters');
  /* a new project */
  await p.evaluate(() => document.querySelector('[data-dcnew]').click()); await sl(200);
  await p.evaluate(() => { const f = document.querySelector('form[data-dcpform]'); f.name.value = 'Made-up school'; f.no.value = 'P-123'; f.who.value = 'Made-up Sprinkler AS'; f.trade.value = 'Sprinkler'; f.requestSubmit(); }); await sl(500);
  const pr = await p.evaluate(() => ({ n: Features.list('dctl').length, full: document.body.classList.contains('dc-full'), hash: location.hash }));
  check(pr.n === 1 && pr.full && /^#dc=/.test(pr.hash), 'a new project opens on its own page (#dc=…) ' + JSON.stringify(pr));
  /* the plan */
  await (await p.$('input[data-dcplan]')).uploadFile(planF); await sl(1200);
  const pl = await p.evaluate(() => { const r = Features.list('dctl')[0]; return { n: r.lines.length, lines: r.lines.map(l => [l.code, l.t, l.planned, l.fire ? 1 : 0, l.st].join('|')), name: r.planName }; });
  check(pl.n === 6 && pl.lines.join(';') === '332.101|A|332 SE Sprinkleranlegg|1|missing;332.101|BC|332 DV Sprinkleranlegg|1|missing;332.101|K||1|missing;336|E||1|missing;234|E|234 DA Vindu|0|missing;235|BC||0|missing' && pl.name === 'Made-up plan.xlsx',
    'the plan: lines with a type or a planned name (the next rows under a code belong to it), fire book, the template\'s naming note left out ' + JSON.stringify(pl));
  /* the files */
  await (await p.$('input[data-dcfiles]')).uploadFile(f1, f2, zf); await sl(1500);
  const fl = await p.evaluate(() => { const r = Features.list('dctl')[0], L = {}; r.lines.forEach(l => L[l.id] = l); return { n: r.files.length, m: r.files.map(f => [f.name, f.line ? L[f.line].t : '-', (f.iss || []).map(i => i[1]).join('+')].join('|')).sort(), st: r.lines.map(l => l.st).join(), tab: document.querySelector('.fdv-tabs [aria-selected="true"]').dataset.dctab, loose: document.querySelectorAll('.dc-files li.loose').length }; });
  check(fl.n === 5 && fl.m.join(';') === '234 DA Vindu sørfasade modell X fra Made-up.pdf|E|long;332 DV Sprinkleranlegg.pdf|BC|;332 SE Sprinkleranlegg.pdf|A|;99999-H02-V-332-P-01 – Rørplan rev 2.pdf|K|version;random scan 7.pdf|-|nocode'
    && fl.st === 'recv,recv,recv,missing,recv,missing' && fl.tab === 'files' && fl.loose === 1, 'files (also from a .zip, without __MACOSX) are matched by code + document code, checked by name, and their lines become Received ' + JSON.stringify(fl));
  /* link the loose one by hand to 336 */
  await p.evaluate(() => { const r = Features.list('dctl')[0], s = document.querySelector('select[data-dcflink]'); s.value = r.lines[3].id; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  check(await p.evaluate(() => { const r = Features.list('dctl')[0]; return r.lines[3].st === 'recv' && r.lines[3].files.length === 1 && r.files.every(f => f.line); }), 'a file that wasn\'t matched can be linked to a line by hand');
  /* statuses and a comment */
  await p.evaluate(() => document.querySelector('[data-dctab="docs"]').click()); await sl(300);
  const ids = await p.evaluate(() => Features.list('dctl')[0].lines.map(l => l.id));
  await p.evaluate(id => document.querySelector('[data-dcline="' + id + '"]').click(), ids[0]); await sl(250);
  await p.evaluate(id => document.querySelector('[data-dcst="' + id + ':ok"]').click(), ids[0]); await sl(250);
  await p.evaluate(id => document.querySelector('[data-dcline="' + id + '"]').click(), ids[2]); await sl(250);
  await p.evaluate(id => { document.querySelector('[data-dcst="' + id + ':rej"]').click(); }, ids[2]); await sl(250);
  await p.evaluate(id => { const t = document.querySelector('textarea[data-dccmt="' + id + '"]'); t.focus(); t.value = 'Made-up: version number in the name'; t.blur(); }, ids[2]); await sl(600);
  const sts = await p.evaluate(() => { const r = Features.list('dctl')[0]; return { st: r.lines.map(l => l.st).join(), cmt: r.lines[2].cmt, wide: [...document.querySelectorAll('#wkDocCtl *')].filter(e => !e.closest('.dc-chips') && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className).slice(0, 4) }; });
  check(sts.st === 'ok,recv,rej,recv,recv,missing' && /version number/.test(sts.cmt), 'a line gets a status and a comment ' + JSON.stringify(sts));
  check(!sts.wide.length, 'nothing is wider than the phone ' + JSON.stringify(sts.wide));
  /* filters */
  await p.evaluate(() => document.querySelector('[data-dcfilt="missing"]').click()); await sl(250);
  check((await p.evaluate(() => document.querySelectorAll('.dc-line').length)) === 1, 'the Missing filter shows only the missing line');
  /* overview */
  await p.evaluate(() => document.querySelector('[data-dctab="over"]').click()); await sl(300);
  const ov = await p.evaluate(() => ({ grp: [...document.querySelectorAll('.dc-grp .dc-gn')].map(e => e.textContent.trim()), fire: (document.querySelector('.dc-note') || {}).textContent || '', bar: document.querySelectorAll('.dc-bar i').length }));
  check(ov.grp.length === 2 && /^2/.test(ov.grp[0]) && /^3/.test(ov.grp[1]) && /Fire book: 1 of 4/.test(ov.fire) && ov.bar > 2, 'the overview shows each NS 3451 group with a bar and the fire book ' + JSON.stringify(ov));
  /* report + PDF */
  await p.evaluate(() => document.querySelector('[data-dctab="report"]').click()); await sl(300);
  const rp = await p.evaluate(() => { const d = document.querySelector('#wkDocCtl .rp-doc'); return { h2: [...d.querySelectorAll('h2')].map(h => h.textContent).join('|'), t: d.textContent }; });
  check(rp.h2 === '1 Summary|2 Missing documents|3 Not approved and comments|4 File names' && /235/.test(rp.t) && /Made-up: version number/.test(rp.t) && /random scan 7\.pdf/.test(rp.t), 'the report: summary, missing, not approved with the comment, and the file-name problems ' + JSON.stringify(rp.h2));
  const pdf = await p.evaluate(async () => { const r = Features.list('dctl')[0], f = await window.FdvPdf.html(document.querySelector('#wkDocCtl .rp-doc').innerHTML, 'Made-up foot', 'x.pdf'); const t = new TextDecoder().decode(new Uint8Array(await f.slice(0, 8).arrayBuffer())); return { pdf: t.slice(0, 5), pages: f._pages }; });
  check(pdf.pdf === '%PDF-' && pdf.pages >= 1, 'the report becomes a PDF on the device ' + JSON.stringify(pdf));
  /* importing the plan again keeps the statuses */
  await p.evaluate(() => document.querySelector('[data-dctab="over"]').click()); await sl(300);
  await (await p.$('input[data-dcplan]')).uploadFile(planF); await sl(1200);
  check((await p.evaluate(() => Features.list('dctl')[0].lines.map(l => l.st).join())) === 'ok,recv,rej,recv,recv,missing', 'importing the plan again keeps the statuses');
  /* back closes the project page */
  await p.evaluate(() => document.querySelector('[data-dcback]').click()); await sl(500);
  check(await p.evaluate(() => !document.body.classList.contains('dc-full') && !!document.querySelector('[data-dcopen]')), 'Back goes to the list of projects');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
  await b.close(); done();
})();
