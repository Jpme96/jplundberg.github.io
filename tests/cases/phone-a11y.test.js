/* A round at phone width (393 px), Norwegian, every feature on, with Larger text (2026-11-15): no page runs off the screen,
   and every button, link and field has a name a screen reader can say. Made-up data only. */
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; s.simple = false; s.textSize = 'xl'; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  for (const pg of ['', 'calendar/', 'travel/', 'finance/', 'habits/', 'house/', 'people/', 'food/', 'work/', 'wish/', 'goals/', 'papers/', 'admin/']) {
    await go(p, pg, 2600);
    const r = await p.evaluate(() => {
      const vis = e => { const q = e.getBoundingClientRect(), s = getComputedStyle(e); return q.width > 1 && q.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const nolabel = [...document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea')].filter(e => vis(e) && !(e.getAttribute('aria-label') || e.getAttribute('title') || (e.textContent || '').trim() || (e.labels && e.labels.length) || e.getAttribute('placeholder') || e.getAttribute('aria-labelledby'))).map(e => e.outerHTML.slice(0, 100));
      const W = document.documentElement.clientWidth;
      return { xl: document.documentElement.classList.contains('text-xl'), wide: document.documentElement.scrollWidth - W, nolabel };
    });
    check(r.xl && r.wide <= 1, (pg || 'home') + ': Larger text fits the phone (' + r.wide + ' px too wide)');
    check(!r.nolabel.length, (pg || 'home') + ': every control has a name ' + r.nolabel.slice(0, 2).join(' | '));
  }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
