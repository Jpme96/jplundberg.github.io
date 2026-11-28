/* The file card keeps its look where it fits; where the window is too low for it (JP's PC, 2026-11-28 21:44) it turns tight – fields side
   by side, the content check folded with "Show all" – so the whole card is seen without scrolling. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.setViewport({ width: 1280, height: 1100 });
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await p.evaluate(() => {
    const mk = (lines) => { const esc = s => s.replace(/[\\()]/g, m => '\\' + m); const body = 'BT /F1 12 Tf ' + lines.map((l, i) => '1 0 0 1 60 ' + (780 - i * 18) + ' Tm (' + esc(l) + ') Tj').join(' ') + ' ET'; const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']; let out = '%PDF-1.4\n', offs = []; objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; }); const x = out.length; out += 'xref\n0 6\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'; return new Blob([out], { type: 'application/pdf' }); };
    const dt = new DataTransfer();
    dt.items.add(new File([mk(['Monteringsanvisning radiator', 'Produsent: Madeup AS', 'Radiator panelovn modell M102', 'Montering, drift og vedlikehold'])], 'Madeup radiator monteringsanvisning 3.pdf', { type: 'application/pdf' }));
    dt.items.add(new File([mk(['Produktdatablad pumpe', 'Sirkulasjonspumpe M101'])], 'Madeup pumpe produktdatablad 2.pdf', { type: 'application/pdf' }));
    const i = document.querySelector('input[data-dxrenf]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sl(4000);
  await p.evaluate(() => { const r = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => /radiator/i.test(x.textContent)); r.querySelector('[data-dcnexp]').click(); }); await sl(800);
  for (let i = 0; i < 20 && !(await p.evaluate(() => !!document.querySelector('.dcn-fpop .dcn-cc ul'))); i++) await sl(300);
  const st = () => p.evaluate(() => { const sh = document.querySelector('.dcn-fpop:not(.ov-ghost) .dcn-fsheet'); if (!sh) return null; const cc = sh.querySelector('.dcn-cc'); return { tight: sh.classList.contains('dcn-tight'), over: sh.scrollHeight - sh.clientHeight, w: Math.round(sh.getBoundingClientRect().width), li: cc ? [...cc.querySelectorAll('ul > li')].filter(x => x.offsetParent).length : -1, more: cc && cc.querySelector('.dcn-ccmore') ? (cc.querySelector('.dcn-ccmore').offsetParent ? cc.querySelector('.dcn-ccmore').textContent : 'hidden') : 'none' }; });
  const tall = await st();
  check(tall && !tall.tight && tall.over <= 2 && tall.more === 'hidden', 'a window the card fits in: the card as it was, nothing folded ' + JSON.stringify(tall));
  await p.setViewport({ width: 1280, height: 760 }); await sl(600);
  const low = await st();
  check(low && low.tight && low.over <= 2 && low.w > tall.w && /Show all/.test(low.more) && low.li < tall.li, 'a low window: the card turns tight and is seen whole ' + JSON.stringify({ tall, low }));
  await p.evaluate(() => document.querySelector('.dcn-fpop .dcn-ccmore').click()); await sl(300);
  const opened = await st();
  check(opened.li === tall.li && /Show less/.test(opened.more), '"Show all" opens every finding ' + JSON.stringify(opened));
  await p.evaluate(() => document.querySelector('.dcn-fpop [data-dcnfgo]:not([disabled])').click()); await sl(500);
  const next = await st();
  check(next && next.tight && next.over <= 2, 'the next file keeps the tight card in the low window ' + JSON.stringify(next));
  await p.setViewport({ width: 1280, height: 1100 }); await sl(600);
  const back = await st();
  check(back && !back.tight, 'a taller window again: the card as it was ' + JSON.stringify(back));
  await p.setViewport({ width: 420, height: 620, isMobile: true, hasTouch: true }); await sl(600);
  const phone = await st();
  check(!phone || !phone.tight, 'a phone never gets the tight card ' + JSON.stringify(phone));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error('error', e); process.exit(1); });
