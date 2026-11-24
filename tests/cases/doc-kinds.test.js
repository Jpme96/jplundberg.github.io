/* Documents, drawings and photos apart (JP 2026-11-24 15:20 "the danger is the tegning also get named"):
   a drawing sent as a PDF with an ordinary name is recognised from its title block; Select by kind; bulk code and name changes
   leave drawings and photos out unless you take them in. Same list in "Give files the right names" and in a project.
   Made-up files only. */
const fs = require('fs'), os = require('os'), path = require('path');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
function pdf(lines, w, h) {
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
  const body = lines.map((l, i) => 'BT /F1 ' + (i ? 11 : 20) + ' Tf 50 ' + (h - 60 - 20 * i) + ' Td (' + esc(l) + ') Tj ET').join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dck-'));
const F = {
  plan: path.join(dir, 'Plantegning madeup.pdf'), sheet: path.join(dir, 'Datablad madeup vifte.pdf'), doc: path.join(dir, '365 DA Madeup vifte.pdf'), pic: path.join(dir, 'Madeup bad.jpg')
};
fs.writeFileSync(F.plan, pdf(['Plantegning 1. etasje', 'Tegningsnr. 1001', 'Malestokk 1:100', 'Tegnet av: AB   Kontr.: CD', 'Rev. A', 'Oppdragsgiver: Madeup Eiendom'], 1191, 842));
fs.writeFileSync(F.sheet, pdf(['Teknisk datablad', 'Madeup kanalvifte', 'Produktbeskrivelse: kanalvifte for ventilasjon. Monteres i kanal.', 'Vedlikehold: rengjor viftehjulet hvert aar.', 'Leverandor: Madeup Vent AS'], 595, 842));
fs.writeFileSync(F.doc, pdf(['FDV-dokumentasjon', 'Madeup vifte', 'Drift og vedlikehold av ventilasjonsaggregat.'], 595, 842));
fs.writeFileSync(F.pic, Buffer.from('not really a picture'));
(async () => {
  const { b, p } = await open(1100);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); localStorage.removeItem('dcn.tool'); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await (await p.$('input[data-dxrenf]')).uploadFile(F.plan, F.sheet, F.doc, F.pic); await sl(1500);
  await p.evaluate(() => { const a = document.querySelector('.dx-ren [data-dcnall]'); a && a.click(); });
  const kinds = async () => p.evaluate(() => [...document.querySelectorAll('.dx-ren [data-dcnpks^="kind:"]')].map(b => b.textContent.trim()).join(' | '));
  let ks = ''; for (let i = 0; i < 40 && !/Drawings \(1\)/.test(ks); i++) { await sl(250); ks = await kinds(); }
  /* the plan PDF has an ordinary name but a title block on a landscape page: a drawing; the datasheet stays a document */
  check(/Documents \(2\)/.test(ks) && /Drawings \(1\)/.test(ks) && /Photos \(1\)/.test(ks), 'the plan PDF is recognised as a drawing from its title block, the datasheet stays a document – choose by kind ' + ks);
  const tagged = await p.evaluate(async () => { document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); const c = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => /Plantegning/.test(x.textContent)); if (!c) return 'no row'; c.querySelector('[data-dcnexp]').click(); await new Promise(r => setTimeout(r, 350));
    const li = document.querySelector('.dcn-fpop .dcn-row'), t = li ? li.textContent : ''; document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); return /Recognised as a drawing from the PDF/.test(t) && /Drawing/.test((li.querySelector('.dcn-hn small') || {}).textContent || '') ? 'ok' : t.slice(0, 200); });
  check(tagged === 'ok', 'its card says it was recognised as a drawing from the PDF ' + tagged);
  /* Drawings (1): only the drawing is ticked */
  await p.evaluate(() => [...document.querySelectorAll('.dx-ren [data-dcnpks^="kind:drawing"]')][0].click()); await sl(300);
  const onlyDw = await p.evaluate(() => [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].filter(r => r.querySelector('[data-dcnpk]').checked).map(r => (r.querySelector('.dcn-sumt b') || {}).textContent).join(','));
  check(onlyDw === 'Plantegning madeup.pdf', 'Drawings (1) ticks only the drawing ' + onlyDw);
  /* Select all: the bar says a drawing is among them; Change code and Use the new name leave the drawing and the photo out */
  await p.evaluate(() => { const a = document.querySelector('.dx-ren input[data-dcnpkall]'); if (a.checked) a.click(); a.click(); }); await sl(300);
  const bar = await p.evaluate(() => (document.querySelector('.dcn-pkact .dcn-pkodd') || {}).textContent || '');
  check(/incl\. 1 drawing – /.test(bar), 'with everything ticked, the bar says a drawing is among them ' + bar);
  await p.evaluate(() => document.querySelector('[data-dcnpka="code"]').click()); await sl(300);
  const c1 = await p.evaluate(async () => { const s = document.querySelector('.dcn-bulk [data-bksel]'); s.value = [...s.options].find(o => /^365/.test(o.value)).value; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 200));
    const box = document.querySelector('.dcn-bulk .dcn-bkbox'), odd = document.querySelector('.dcn-bulk [data-bkodd]'), get = () => (document.querySelector('.dcn-bulk [data-bkgo]') || {}).textContent || '';
    const before = { odd: !!odd && !odd.checked, oddText: (document.querySelector('.dcn-bulk .dcn-bkodd') || {}).textContent || '', names: box.textContent, go: get() };
    odd.click(); await new Promise(r => setTimeout(r, 200)); const after = get(); document.querySelector('.dcn-bulk [data-bkx]').click(); return Object.assign(before, { after }); });
  check(c1.odd && /1 drawing and 1 photo are among them/.test(c1.oddText) && !/Plantegning|Madeup bad/.test(c1.names) && /on 1 files/.test(c1.go), 'Change code: the drawing and the photo are left out by default (365 DA … keeps the code its name gave it) ' + JSON.stringify(c1));
  check(/on 3 files/.test(c1.after), '… and “Take them in too” includes them ' + c1.after);
  await p.evaluate(() => document.querySelector('[data-dcnpka="name"]').click()); await sl(300);
  const n1 = await p.evaluate(() => { const t = document.querySelector('.dcn-bulk').textContent; document.querySelector('.dcn-bulk [data-bkx]').click(); return t; });
  check(/are among them – left out/.test(n1) && /of the 2 are ready/.test(n1) && !/Plantegning madeup/.test(n1.split('left out')[1] || ''), 'Use the new name: only the documents are counted and named ' + n1.slice(0, 200));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
