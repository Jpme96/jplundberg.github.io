/* The notification panel (2026-11-20): a bell in the top bar with a count of reminders that have gone off since you
   last looked, and a popup with "Coming up" and "Earlier"; opening it clears the count. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => {
    const pad = n => String(n).padStart(2, '0'), d0 = new Date(), k = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const past = new Date(Date.now() - 3 * 36e5), soon = new Date(Date.now() + 3 * 36e5);
    const cal = JSON.parse(localStorage.getItem('dash.calendar') || '{}'); cal.events = (cal.events || []).concat([
      { id: 'evPast', date: k(past), start: pad(past.getHours()) + ':' + pad(past.getMinutes()), end: '', title: 'Dentist MADE-UP', cat: 'personal' },
      { id: 'evSoon', date: k(soon), start: pad(soon.getHours()) + ':' + pad(soon.getMinutes()), end: '', title: 'Call the plumber', cat: 'personal' }]);
    localStorage.setItem('dash.calendar', JSON.stringify(cal)); localStorage.removeItem('dash.ntSeen');
  });
  await go(p, '', 2500);
  check(await until(p, () => !!document.getElementById('ntBtn'), 8000), 'a bell in the top bar');
  const c1 = await p.evaluate(() => ({ n: (document.querySelector('#ntBtn .nt-badge') || {}).textContent, hidden: document.querySelector('#ntBtn .nt-badge').hidden, recent: Notify.recent(72, 24).map(x => x.title) }));
  check(!c1.hidden && +c1.n >= 1, 'it counts what has gone off ' + JSON.stringify(c1));
  await p.evaluate(() => document.getElementById('ntBtn').click()); await sl(300);
  const pop = await p.evaluate(() => { const o = document.querySelector('.nt-ov'); return o ? { txt: o.innerText, rows: o.querySelectorAll('.nt-row').length, news: o.querySelectorAll('.nt-new').length, wide: o.querySelector('.nt-sh').getBoundingClientRect().right <= innerWidth } : null; });
  check(pop && /Coming up/i.test(pop.txt) && /Earlier/i.test(pop.txt) && /plumber/.test(pop.txt) && /Dentist/.test(pop.txt) && pop.rows >= 2 && pop.news >= 1 && pop.wide, 'the popup lists what is coming and what has been, the new ones marked ' + JSON.stringify(pop && pop.txt.slice(0, 200)));
  /* it looks like a popup on every page, not text at the bottom (JP 2026-11-20: it opened unstyled on Finances) */
  check(await p.evaluate(() => getComputedStyle(document.querySelector('.nt-ov')).position === 'fixed'), 'the popup floats over the page');
  await p.keyboard.press('Escape'); await sl(200);
  const c2 = await p.evaluate(() => ({ gone: !document.querySelector('.nt-ov'), hidden: document.querySelector('#ntBtn .nt-badge').hidden }));
  check(c2.gone && c2.hidden, 'Escape closes it, and the count is cleared');
  /* on the computer with the side menu: on Finances, the popup is styled, and the bell doesn't sit on the name */
  await p.setViewport({ width: 1280, height: 860 }); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'side'; localStorage.setItem('dash.settings', JSON.stringify(s)); localStorage.setItem('dash.sideNav', 'open'); window.dispatchEvent(new Event('dash:local')); }); await go(p, 'finance/', 3000);
  await until(p, () => !!document.querySelector('.mb-me #ntBtn'), 8000);
  const side = await p.evaluate(() => { const bt = document.getElementById('ntBtn'), w = document.querySelector('.mb-me .mb-who b'); if (!bt || !w) return null; const a = bt.getBoundingClientRect(), r = document.createRange(); r.selectNodeContents(w); const t = w.getBoundingClientRect(); bt.click(); const o = document.querySelector('.nt-ov'); const out = { inMe: !!bt.closest('.mb-me'), gap: Math.round(a.left - t.right), fixed: !!o && getComputedStyle(o).position === 'fixed' }; if (o) o.click(); return out; });
  check(side && side.inMe && side.gap >= 0 && side.fixed, 'side menu: the bell is beside the name, and the popup floats on Finances ' + JSON.stringify(side));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
