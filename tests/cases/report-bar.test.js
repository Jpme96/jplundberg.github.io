/* The top bar of a report sheet (Close · options · Save as PDF) – 2026-11-16:
   - nothing in it runs past the screen at phone width or on a computer
   - a tick box sits right next to its words (it was spread across the bar, the words in three lines)
   - the invoice's month and client sit side by side on a computer (each took a row of its own)
   The bars are taken from the page scripts themselves, so a new bar is checked too. Made-up data only. */
const fs = require('fs'), path = require('path');
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const CMD = path.join(__dirname, '..', '..', 'cmd');
const bars = [];
for (const f of ['house-move.js', 'house-claims.page.js', 'house-plus.page.js', 'work-plus.page.js']) {
  const s = fs.readFileSync(path.join(CMD, f), 'utf8'); let i = -1;
  while ((i = s.indexOf("'<div class=\"rp-bar\">", i + 1)) >= 0) { const end = s.indexOf('</div>\' +', i); if (end < 0) continue; const seg = s.slice(i, end + 8); try { bars.push([f, eval(seg)]); } catch (e) { /* a bar built over several statements – skipped */ } }
}
(async () => {
  check(bars.length >= 4, 'found the report bars in the page scripts (' + bars.length + ')');
  for (const W of [393, 1280]) {
    const { b, p } = await open(W); await go(p, 'house/', 2000);
    for (const [f, html] of bars) {
      const r = await p.evaluate(h => { const bg = document.createElement('div'); bg.className = 'rp-bg'; bg.innerHTML = h; document.body.appendChild(bg); const bar = bg.querySelector('.rp-bar');
        bar.querySelectorAll('select').forEach(s => { s.innerHTML = '<option>November 2026</option><option>A made-up client AS</option>'; });
        const out = []; bar.querySelectorAll('*').forEach(e => { const q = e.getBoundingClientRect(); if (q.width && (q.right > innerWidth + 1 || q.left < -1)) out.push(e.tagName + '.' + e.className); });
        const gaps = [...bar.querySelectorAll('.rp-opt')].map(l => { const c = l.querySelector('input'); if (!c) return 0; const rg = document.createRange(); rg.setStartAfter(c); rg.setEnd(l, l.childNodes.length); const rs = [...rg.getClientRects()].filter(q => q.width > 6); if (c.getBoundingClientRect().width > 30) return 99; return rs.length ? Math.round(Math.min(...rs.map(q => q.left)) - c.getBoundingClientRect().right) : 0; });
        const sel = [...bar.querySelectorAll('select')].map(s => Math.round(s.getBoundingClientRect().top));
        bg.remove(); return { out, gaps, sel }; }, html);
      check(!r.out.length, f + ' at ' + W + ' px: nothing runs past the screen ' + r.out.join());
      check(r.gaps.every(g => g >= 0 && g <= 12), f + ' at ' + W + ' px: tick boxes sit next to their words ' + r.gaps);
      if (W === 1280 && r.sel.length > 1) check(new Set(r.sel).size === 1, f + ': the choices sit side by side on a computer ' + r.sel);
    }
    await b.close();
  }
  done();
})();
