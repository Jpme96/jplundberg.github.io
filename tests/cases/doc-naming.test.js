/* Document control → file naming (2026-11-16, a test switch – off unless switched on on the device): each file gets an
   NS 3451 code and a document type, a name from the project's naming rule (Boligbygg's built in, or your own), and a
   content check that reads a PDF's text on the device with pdf.js (cmd/vendor). Off by default: the old Files tab stays.
   Made-up data only. */
const fs = require('fs'), os = require('os'), path = require('path');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
/* a tiny real PDF with text (one page, Helvetica) */
function pdf(lines) {
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
  const body = 'BT /F1 24 Tf 60 780 Td (' + esc(lines[0]) + ') Tj ET\n' + lines.slice(1).map((l, i) => 'BT /F1 11 Tf 60 ' + (740 - 18 * i) + ' Td (' + esc(l) + ') Tj ET').join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcn-'));
const fan = path.join(dir, 'KANALVIFTE_K200EC.pdf'); fs.writeFileSync(fan, pdf(['K200 EC', 'Datablad', 'Kanalvifte for runde kanaler, EC-motor', 'Produsent: Eksempel Luft AS', 'Tekniske data: 230 V og 120 W. Merking: Drift', 'Viften skal monteres av fagfolk og filteret skal byttes med jevne mellomrom.', 'Det er viktig at viften ikke blir tildekket, og at den rengjøres to ganger i året av eier eller driftspersonell.', 'Ved feil skal strømmen kobles fra før dekselet tas av, og som eier må du melde fra til leverandøren.']));
const decl = path.join(dir, 'Made-up 7.pdf'); fs.writeFileSync(decl, pdf(['EU-samsvarserklaering', 'Samsvarserklaering for brannsentral BS-1 til brannalarm', 'Vi erklaerer at produktet er i samsvar med kravene.', 'Produsent: Eksempel Sikring AS']));
const scan = path.join(dir, 'scan 12.pdf'); fs.writeFileSync(scan, pdf(['.']));
const named = path.join(dir, '442 DA taklampe korridor.pdf'); fs.writeFileSync(named, pdf(['Made-up lamp', 'Datablad for taklampe', 'Belysning i korridor']));
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await sl(150); } return false; };
  await p.evaluate(() => { const t = Features.tools(); t.dctl = [{ id: 'nproj', name: 'Made-up block', no: 'P-9', bid: '10001', pid: '77', who: 'Made-up Bygg AS', made: new Date().toISOString(), files: [],
    lines: [{ id: 'l1', code: '365', sys: 'Made-up air handling', t: 'E', type: 'Produktinformasjon', planned: '', st: 'missing', files: [] }, { id: 'l2', code: '542', sys: 'Made-up fire alarm', t: 'A', type: 'Kravoppnåelse', planned: '', st: 'missing', files: [] }, { id: 'l3', code: '442', sys: 'Made-up light', t: 'E', type: 'Produktinformasjon', planned: '442 DA Taklampe', st: 'missing', files: [] }] }]; Features.saveTools(t); try { localStorage.removeItem('dash.dcNaming'); } catch (e) {} });
  await go(p, 'work/#dc=nproj', 2500);
  await p.evaluate(() => { PageTabs.show('doc'); }); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dctab="files"]').click()); await sl(300);
  /* off by default: the old Files tab, with the switch */
  const off = await p.evaluate(() => ({ sw: !!document.querySelector('[data-dcnon]'), on: document.querySelector('[data-dcnon]') && document.querySelector('[data-dcnon]').checked, rows: document.querySelectorAll('.dcn-row').length }));
  check(off.sw && !off.on && off.rows === 0, 'naming is off by default – the switch is there, the old Files tab shows ' + JSON.stringify(off));
  await (await p.$('input[data-dcfiles]')).uploadFile(fan, decl, scan, named); await sl(1500);
  check(await p.evaluate(() => document.querySelectorAll('.dcn-row').length === 0 && document.querySelectorAll('.dc-frow').length === 4), 'with the switch off, files show as before');
  /* switch on (this device only) */
  await p.evaluate(() => { const s = document.querySelector('[data-dcnon]'); s.checked = true; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  const op = id => p.evaluate(id => { const b = document.querySelector('[data-dcnexp="' + id + '"]'); if (b) b.click(); }, id).then(() => sl(300));   /* a file opens in a popup (JP 2026-11-17 08:07) */
  await p.evaluate(() => document.querySelector('[data-dcnexp]').click()); await sl(300);
  const on = await p.evaluate(() => ({ ls: localStorage.getItem('dash.dcNaming'), rows: document.querySelectorAll('.dcn-row').length, pop: !!document.querySelector('body > .dcn-fpop'), cols: [...document.querySelector('.dcn-fpop .dcn-row .dcn-g').children].map(c => c.className), dl: document.querySelectorAll('.dcn-fpop [data-dcncode] option').length, compact: document.querySelectorAll('#wkDocCtl .dcn-row.dcn-c').length }));
  check(on.ls === '1' && on.compact === 4 && on.pop && on.cols.join() === 'dcn-c dcn-kind,dcn-c,dcn-c,dcn-t' && on.dl > 10, 'switched on: one line per file; a tap opens it in a popup – kind · code · type · status, and a code list ' + JSON.stringify(on));
  await op(await p.evaluate(() => Features.list('dctl')[0].files.find(x => /^442/.test(x.name)).id));
  const named0 = await p.evaluate(() => { const f = Features.list('dctl')[0].files.find(x => /^442/.test(x.name)), row = document.querySelector('[data-dcnf="' + f.id + '"]'); return { line: f.line, sug: row.querySelector('.dcn-sug code').textContent, follows: /Name follows the rule/.test(row.textContent) }; });
  check(named0.line === 'l3' && named0.sug === '442 DA taklampe korridor.pdf' && named0.follows, 'a file named by Boligbygg’s rule is on its line and follows the rule ' + JSON.stringify(named0));
  /* suggest codes and check the PDFs (pdf.js from cmd/vendor, read here) */
  await p.evaluate(() => document.querySelector('[data-dcnall]').click());
  const read = await until(() => Features.list('dctl')[0].files.filter(f => f.cc).length === 4, 30000);
  const cc = await p.evaluate(() => Features.list('dctl')[0].files.map(f => ({ n: f.name, code: f.p.code, abbr: f.p.abbr, line: f.line, desc: (f.nv || {}).desc, cc: f.cc && { t: f.cc.t && f.cc.t[0], c: f.cc.c && f.cc.c[0], w: f.cc.w, e: f.cc.e, mk: f.cc.mk, lang: f.cc.lang }, sg: f.sg })));
  const F = n => cc.find(x => x.n.indexOf(n) === 0);
  check(read, 'every PDF was read on the device ' + JSON.stringify(cc));
  check(F('KANALVIFTE').code === '365' && F('KANALVIFTE').abbr === 'DA' && F('KANALVIFTE').line === 'l1' && /^KANALVIFTE K200EC\b/.test(F('KANALVIFTE').desc) && /Eksempel Luft/.test(F('KANALVIFTE').desc) && F('KANALVIFTE').sg,
    'a fan datasheet: code 365 and DA suggested, on its line, and the description keeps every word of the file name (JP 11:43) ' + JSON.stringify(F('KANALVIFTE')));
  check(F('Made-up 7').code === '542' && F('Made-up 7').abbr === 'SE' && F('Made-up 7').line === 'l2', 'a declaration about a fire alarm: 542 SE from its content ' + JSON.stringify(F('Made-up 7')));
  check(F('scan 12').cc.w.indexOf('notext') >= 0 || F('scan 12').cc.w.indexOf('little') >= 0, 'a PDF with no text is flagged as probably scanned ' + JSON.stringify(F('scan 12')));
  check(F('KANALVIFTE').cc.mk.indexOf('Drift') >= 0 && F('KANALVIFTE').cc.lang === 'nb', 'marking and language found ' + JSON.stringify(F('KANALVIFTE').cc));
  /* use the suggested name; back to the original */
  const fid = await p.evaluate(() => Features.list('dctl')[0].files.find(x => /^KANALVIFTE/.test(x.name)).id);
  await op(fid); await p.evaluate(id => document.querySelector('[data-dcnuse="' + id + '"]').click(), fid); await sl(400);
  const adv = await p.evaluate(id => { const pp = document.querySelector('.dcn-fpop [data-dcnf]'); return !!pp && pp.dataset.dcnf !== id; }, fid);
  check(adv, 'after Use this name the popup moves on to the next file');
  await op(fid);
  const rn = await p.evaluate(id => { const f = Features.list('dctl')[0].files.find(x => x.id === id); return { name: f.name, orig: f.orig, line: f.line, follows: /Name follows the rule/.test(document.querySelector('[data-dcnf="' + id + '"]').textContent) }; }, fid);
  check(/^365 DA KANALVIFTE K200EC .*\.pdf$/.test(rn.name) && rn.orig === 'KANALVIFTE_K200EC.pdf' && rn.line === 'l1' && rn.follows, 'Use this name renames it after the rule and keeps the name it came with ' + JSON.stringify(rn));
  /* change the code by hand: the box empties while picking (JP 11:54), and the file moves */
  /* the code is a dropdown grouped by the main parts, like the other choices (JP 2026-11-17 07:22), with your own code / free text last */
  await op(fid);
  const empt = await p.evaluate(id => { const s = document.querySelector('[data-dcncode="' + id + '"]'); return s.tagName === 'SELECT' && s.querySelectorAll('optgroup').length >= 3 && !!s.querySelector('option[value="542"]') && s.options[s.options.length - 1].value === '__own' ? '' : 'no'; }, fid);
  await p.evaluate(id => { const i = document.querySelector('[data-dcncode="' + id + '"]'); i.value = '542'; i.dispatchEvent(new Event('change', { bubbles: true })); }, fid); await sl(400);
  const moved = await p.evaluate(id => { const r = Features.list('dctl')[0], f = r.files.find(x => x.id === id); return { code: f.p.code, line: f.line, l1: r.lines[0].files.length }; }, fid);
  check(empt === '' && moved.code === '542' && moved.l1 === 0, 'the code is a grouped dropdown, and a new code takes the file off the old line ' + JSON.stringify({ empt, moved }));
  await op(fid); await p.evaluate(id => document.querySelector('[data-dcnorig="' + id + '"]').click(), fid); await sl(400);
  check(await p.evaluate(id => { const f = Features.list('dctl')[0].files.find(x => x.id === id); return f.name === 'KANALVIFTE_K200EC.pdf' && !f.orig; }, fid), 'Back to the name it came with');
  /* your own rule: copy Boligbygg's, change it, use it for documents */
  await p.evaluate(() => { const d = document.querySelector('[data-dcnrules]'); d.open = true; d.dispatchEvent(new Event('toggle')); }); await sl(100);
  await p.evaluate(() => document.querySelector('[data-dcncopy="bby-doc"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcnsepb="_"]').click()); await sl(300);
  await p.evaluate(() => { const a = document.querySelector('[data-dcnpa]'); a.value = 'proj'; a.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  const own = await p.evaluate(() => { const r = Features.list('dctl')[0]; return { rules: (r.nrules || []).length, ex: document.querySelector('.dcn-prev code').textContent }; });
  check(own.rules === 1 && own.ex === '442_DA_taklampe korridor C20_P-9.pdf', 'a copied rule can be changed, and the example follows ' + JSON.stringify(own));
  await p.evaluate(() => { const r = Features.list('dctl')[0].nrules[0].id, s = document.querySelector('[data-dcnuse-k="doc"]'); s.value = r; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  await op(fid);
  const used = await p.evaluate(id => document.querySelector('[data-dcnf="' + id + '"] .dcn-sug code').textContent, fid);
  check(/^542_DA_KANALVIFTE K200EC.*_P-9\.pdf$/.test(used), 'the project’s documents follow the chosen rule ' + used);
  /* nothing wider than the screen on a phone */
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true }); await sl(500);
  const wide = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl *')].filter(e => !e.closest('.dc-chips, .dcn-rl') && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5));
  check(!wide.length, 'nothing wider than the phone ' + JSON.stringify(wide));
  /* switch off again: back to the old view, the data stays */
  await p.evaluate(() => { const s = document.querySelector('[data-dcnon]'); s.checked = false; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  check(await p.evaluate(() => !document.querySelector('.dcn-row') && document.querySelectorAll('.dc-frow').length === 4 && !localStorage.getItem('dash.dcNaming')), 'switched off: the old view again');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
  await b.close(); done();
})();
