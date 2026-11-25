/* File suggestions that keep learning, the suggest button that says what it did, and scans read quietly (JP 2026-11-25
   16:23–17:22): in the naming tool on the Work page – every finished file teaches its clues → code and type; one choice is only
   a hint, a few make it the suggestion; word variants count as one; the button shows that it works and names the files it
   couldn't help; a PDF that is only a picture is read in the background with no word about scanning. Made-up data only. */
const fs = require('fs'), os = require('os'), path = require('path');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
/* a tiny real PDF with text (one page, Helvetica) */
function pdf(lines) {
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
  const body = 'BT /F1 24 Tf 60 780 Td (' + esc(lines[0]) + ') Tj ET\n' + lines.slice(1).map((l, i) => 'BT /F1 11 Tf 60 ' + (740 - 18 * i) + ' Td (' + esc(l) + ') Tj ET').join('\n');
  return build(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(body, 'latin1') + ' >>\nstream\n' + body + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
}
/* a PDF that is only a picture of a page (a "scan") – the JPEG is drawn in the browser */
function scanPdf(jpg, w, h) {
  const body = 'q 595 0 0 842 0 0 cm /Im1 Do Q';
  const parts = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream', null];
  let out = Buffer.from('%PDF-1.4\n', 'latin1'); const off = [];
  parts.forEach((o, i) => { off.push(out.length); if (o) out = Buffer.concat([out, Buffer.from((i + 1) + ' 0 obj\n' + o + '\nendobj\n', 'latin1')]);
    else out = Buffer.concat([out, Buffer.from((i + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n', 'latin1'), jpg, Buffer.from('\nendstream\nendobj\n', 'latin1')]); });
  const x = out.length;
  return Buffer.concat([out, Buffer.from('xref\n0 6\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n', 'latin1')]);
}
function build(objs) {
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlearn-'));
const mk = (n, lines) => { const f = path.join(dir, n); fs.writeFileSync(f, pdf(lines)); return f; };
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; delete t.fdvlearn; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  const row = re => p.evaluate(async src => { const re = new RegExp(src); const c = [...document.querySelectorAll('.dx-ren .dcn-row')].find(x => re.test(x.textContent)); if (!c) return null; const ex = c.querySelector('[data-dcnexp]'); if (ex) { ex.click(); await new Promise(r => setTimeout(r, 350)); }
    const o = document.querySelector('.dcn-ov') || c; const sel = o.querySelector('[data-dcncode]'), ty = o.querySelector('[data-dcntype]'); return { code: sel ? sel.value : '', type: ty ? ty.value : '', alt: [...o.querySelectorAll('[data-dcnalt]')].map(x => x.dataset.dcnalt.split('|')[1]).join(), text: o.textContent.replace(/\s+/g, ' ') }; }, re.source);
  const closeRow = async () => { await p.keyboard.press('Escape'); await sl(250); };
  const setCode = (re, v) => p.evaluate((src, v) => { const re = new RegExp(src), o = document.querySelector('.dcn-ov'); const s = o && o.querySelector('[data-dcncode]'); if (!s) return false; if (![...s.options].some(x => x.value === v)) s.insertAdjacentHTML('beforeend', '<option value="' + v + '">' + v + '</option>'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }, re.source, v);
  const up = async fs0 => { await (await p.$('input[data-dxrenf]')).uploadFile(...fs0); await sl(2500); };

  /* 1. the suggest button: it says it's reading, then names the file it couldn't help – and goes away */
  await up([mk('12312312313.pdf', ['Made-up', 'Nothing here says what this is.'])]);
  const b0 = await p.evaluate(() => { const x = document.querySelector('.dx-ren [data-dcnall]'); return x ? x.textContent : ''; });
  await p.evaluate(() => { window.__busySeen = ''; const mo = new MutationObserver(() => { const x = document.querySelector('.dx-ren button[aria-busy]'); if (x) window.__busySeen = x.textContent; }); mo.observe(document.body, { childList: true, subtree: true }); window.__busyMo = mo; document.querySelector('.dx-ren [data-dcnall]').click(); });
  await sl(3000);
  const busy = await p.evaluate(() => { window.__busyMo.disconnect(); return window.__busySeen; });
  const m1 = await p.evaluate(() => { const m = document.querySelector('.dx-ren .dcn-sugm'); return { msg: m ? m.textContent.replace(/\s+/g, ' ') : '', btn: !!document.querySelector('.dx-ren [data-dcnall]'), open: !!(m && m.querySelector('[data-dcnexp]')) }; });
  check(/Suggest a code and check the file/.test(b0) && /Reading the files/.test(busy), 'the button says what it does, and that it is reading ' + JSON.stringify({ b0, busy }));
  check(/No suggestion for 1 file/.test(m1.msg) && /12312312313\.pdf/.test(m1.msg) && /Found no code in the name or the text – choose one yourself/.test(m1.msg) && m1.open && !m1.btn, 'afterwards it names the file it could not help (a tap opens it) and the button goes away ' + JSON.stringify(m1));
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnsugx]').click()); await sl(200);

  /* 2. learning: a code you choose for a file is remembered with its words; once is a hint, a few times makes it the suggestion */
  await up([mk('Zorblat irisspjeld A.pdf', ['Made-up', 'Product sheet'])]);
  await row(/Zorblat irisspjeld A/); await setCode(/Zorblat irisspjeld A/, '364'); await closeRow();
  await up([mk('Zorblat irisspjeld B.pdf', ['Made-up', 'Product sheet'])]);
  const h1 = await row(/Zorblat irisspjeld B/); await closeRow();
  check(h1 && !h1.code && /364/.test(h1.alt) && /chosen last time/.test(h1.text), 'one choice is only a hint: the next file offers 364 as a choice, not as its code ' + JSON.stringify(h1 && { code: h1.code, alt: h1.alt, t: h1.text.slice(0, 400) }));
  await row(/Zorblat irisspjeld B/); await setCode(/Zorblat irisspjeld B/, '364'); await closeRow();
  await up([mk('Zorblat irisspjeld C.pdf', ['Made-up', 'Product sheet'])]);
  await row(/Zorblat irisspjeld C/); await setCode(/Zorblat irisspjeld C/, '364'); await closeRow();
  await up([mk('Zorblat irisspjeld D.pdf', ['Made-up', 'Product sheet'])]);
  const h3 = await row(/Zorblat irisspjeld D/); await closeRow();
  check(h3 && h3.code === '364' && /chosen \d× for/.test(h3.text), 'after a few choices it is the suggestion, with the reason shown to you ' + JSON.stringify(h3 && { code: h3.code, alt: h3.alt }));
  const st = await p.evaluate(() => { const L = DocNaming.learnState(); return { zorb: !!L.w.zorblat, code: L.w.zorblat && L.w.zorblat.c['364'], names: JSON.stringify(L).indexOf('irisspjeld A') >= 0 }; });
  check(st.zorb && st.code >= 3 && !st.names, 'what it keeps is clues → code with votes, never the file names ' + JSON.stringify(st));

  /* 3. word variants: a type learned on Norwegian names counts for the Swedish/English words for the same document */
  for (const n of ['332 Ytelseserklaering Quxa.pdf', '332 Ytelseserklaering Quxb.pdf', '332 Ytelseserklaering Quxc.pdf']) {
    await up([mk(n, ['Made-up', 'Text'])]); await row(new RegExp(n.split(' ').slice(1, 3).join(' ').replace('.pdf', '')));
    await p.evaluate(() => { const s = document.querySelector('.dcn-ov [data-dcntype]'); if (!s) return; if (![...s.options].some(x => x.value === 'AT')) s.insertAdjacentHTML('beforeend', '<option value="AT">AT</option>'); s.value = 'AT'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await closeRow();
  }
  await up([mk('332 Declaration of Performance Madeup Q.pdf', ['Made-up', 'Text'])]);
  const dop = await row(/Declaration of Performance Madeup Q/); await closeRow();
  check(dop && dop.type === 'AT', 'a type taught on “ytelseserklæring” is suggested for “Declaration of Performance” – the same document in another language ' + JSON.stringify(dop && dop.type));

  /* 4. a scan: page 1 is only a picture – it is read quietly and gets a code and type, with no word about scanning on screen */
  const jpg = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1240; c.height = 1754; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    x.font = 'bold 72px Helvetica, Arial, sans-serif'; x.fillText('SAMSVARSERKLAERING', 90, 200); x.font = '44px Helvetica, Arial, sans-serif';
    ['Brannsentral Madeup BS-1 for brannalarm.', 'Vi erklaerer at brannsentral BS-1 er i samsvar', 'med kravene. Samsvarserklaering for brannsentral.', 'Produsent: Madeup Brann AS'].forEach((l, i) => x.fillText(l, 90, 320 + i * 70));
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]; }), 'base64');
  const sc = path.join(dir, 'Skann 0042.pdf'); fs.writeFileSync(sc, scanPdf(jpg, 1240, 1754));
  await up([sc]);
  await p.evaluate(() => document.querySelector('.dx-ren [data-dcnall]') && document.querySelector('.dx-ren [data-dcnall]').click());
  const tl = Date.now(); let sr = null;
  while (Date.now() - tl < 90000) { sr = await row(/Skann 0042/); await closeRow(); if (sr && sr.code && sr.type) break; await sl(2000); }
  const scanTxt = await p.evaluate(() => document.querySelector('.dx-ren').innerText);
  check(sr && sr.code === '542' && /^(SE|KR)$/.test(sr.type), 'a scanned page is read in the background: the fire alarm declaration gets 542 and SE ' + JSON.stringify(sr && { code: sr.code, type: sr.type }) + ' ' + Math.round((Date.now() - tl) / 1000) + ' s');
  check(!/scann|skann(?!\s*0042)|ocr\b/i.test(scanTxt.replace(/Skann 0042[^\n]*/g, '')), 'and nothing on screen says it was scanned');
  check(await p.evaluate(() => (DocNaming.learnState().sc || 0) >= 1), 'only the learning info (yours) counts the scans read');

  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
