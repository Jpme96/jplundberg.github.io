/* Nothing you can tap sits on top of something else you can tap: every page at phone width, and the side bar
   (open and icons only) in short and tall windows. Parts scrolled out of a scrolling list don't count. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const FIND = () => {
  const vis = el => { let r = el.getBoundingClientRect(), x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    if (r.width < 2 || r.height < 2) return null;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') return null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
      if (+c.opacity === 0 || c.visibility === 'hidden' || c.display === 'none') return null;
      if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom); } }
    x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, innerWidth); y2 = Math.min(y2, innerHeight);
    return x2 - x1 > 2 && y2 - y1 > 2 ? { x1, y1, x2, y2 } : null; };
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 18);
  const fixed = el => { for (let a = el; a && a !== document.body; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return a; } return null; };
  const els = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')]
    .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed').filter(el => !el.closest('#lock, .st-backdrop:not(.open), #settings:not(.open), [hidden], [aria-hidden="true"], .sn-fold'))
    .map(el => ({ el, r: vis(el), f: fixed(el) })).filter(x => x.r);
  const out = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const A = els[i], B = els[j]; if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    if (!A.f && !B.f) continue;                                       /* page content scrolls under the bars – only the bars and floating buttons */
    if (A.f && B.f && A.f !== B.f && !(A.f.contains(B.f) || B.f.contains(A.f))) { /* two different floating things */ }
    else if (!(A.f && B.f)) continue;
    const ox = Math.min(A.r.x2, B.r.x2) - Math.max(A.r.x1, B.r.x1), oy = Math.min(A.r.y2, B.r.y2) - Math.max(A.r.y1, B.r.y1);
    if (ox > 6 && oy > 6) out.push(name(A.el) + ' × ' + name(B.el));
  }
  return out;
};
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); });
  const pages = ['', 'calendar/', 'travel/', 'finance/', 'house/', 'people/', 'habits/', 'food/', 'admin/'];
  for (const pg of pages) { await go(p, pg, 2500); const o = await p.evaluate(FIND); check(!o.length, 'phone · ' + (pg || 'home') + (o.length ? ': ' + o.slice(0, 6).join(' ; ') : '')); }
  for (const mode of ['icons', 'open']) {
    await p.evaluate(m => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'side'; localStorage.setItem('dash.settings', JSON.stringify(s)); localStorage.setItem('dash.sideNav', m); window.dispatchEvent(new Event('dash:local')); }, mode);
    await sl(1000);
    for (const h of [560, 700, 900]) {
      await p.setViewport({ width: 1280, height: h }); await go(p, 'admin/', 2500);
      const o = await p.evaluate(FIND); check(!o.length, 'side bar ' + mode + ' · window ' + h + ' px high' + (o.length ? ': ' + o.slice(0, 6).join(' ; ') : ''));
    }
    if (mode === 'icons') { await p.hover('.mbar .tabbar a[data-pg="calendar"]'); await sl(400);
      const tip = await p.evaluate(() => { const t = document.querySelector('.sn-tip.on'); return t ? t.textContent : ''; });
      check(/Calendar/.test(tip), 'icons only: the page name shows next to the icon: ' + JSON.stringify(tip)); }
  }
  /* the top bar on a computer */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'bar'; localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); }); await sl(1000);
  for (const w of [1024, 1280]) { await p.setViewport({ width: w, height: 800 }); await go(p, '', 2500); const o = await p.evaluate(FIND); check(!o.length, 'top bar · ' + w + ' px wide' + (o.length ? ': ' + o.slice(0, 6).join(' ; ') : '')); }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
