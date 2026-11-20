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
  /* remove one, then clear the rest of "Earlier"; removed ones stay gone after reopening (JP 2026-11-20) */
  const del = await p.evaluate(async () => {
    const ov = document.querySelector('.nt-ov'), n0 = ov.querySelectorAll('.nt-item').length;
    const it = [...ov.querySelectorAll('.nt-item')].find(x => /plumber/.test(x.textContent)); it.querySelector('[data-ntdel]').click();
    await new Promise(r => setTimeout(r, 100));
    const still = !!document.querySelector('.nt-ov'), n1 = ov.querySelectorAll('.nt-item').length, plumber = /plumber/.test(ov.innerText);
    return { still, n0, n1, plumber };
  });
  check(del.still && del.n1 === del.n0 - 1 && !del.plumber, 'the × removes one and the popup stays open ' + JSON.stringify(del));
  /* swipe a row sideways to remove it (JP 2026-11-20) */
  const sw = await p.evaluate(() => { const it = [...document.querySelectorAll('.nt-ov .nt-item')][0]; if (!it) return null; const r = it.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, tx: it.textContent.slice(0, 30), n: document.querySelectorAll('.nt-ov .nt-item').length }; });
  if (sw) { await p.mouse.move(sw.x, sw.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(sw.x - i * 25, sw.y); await p.mouse.up(); await sl(500); }
  const sw2 = await p.evaluate(() => ({ open: !!document.querySelector('.nt-ov'), n: document.querySelectorAll('.nt-ov .nt-item').length, url: location.pathname }));
  check(sw && sw2.open && sw2.n === sw.n - 1 && sw2.url === '/cmd/', 'swiping a row removes it, and does not open it ' + JSON.stringify([sw, sw2]));
  await p.keyboard.press('Escape'); await sl(200);
  const c2 = await p.evaluate(() => ({ gone: !document.querySelector('.nt-ov'), hidden: document.querySelector('#ntBtn .nt-badge').hidden }));
  check(c2.gone && c2.hidden, 'Escape closes it, and the count is cleared');
  await p.evaluate(() => document.getElementById('ntBtn').click()); await sl(300);
  const clr = await p.evaluate(async () => { const ov = document.querySelector('.nt-ov'); const pl = /plumber/.test(ov.innerText); ov.querySelector('[data-ntall]').click(); await new Promise(r => setTimeout(r, 100)); const r = { pl, dentist: /Dentist/.test(ov.innerText), past: ov.querySelectorAll('.nt-past .nt-item').length, head: !!ov.querySelector('.nt-hp') }; ov.querySelector('[data-ntclose]').click(); return r; });
  check(!clr.pl && !clr.dentist && !clr.past && !clr.head, 'a removed one stays gone, and "Clear all" empties Earlier ' + JSON.stringify(clr));
  /* on the computer with the side menu: on Finances, the popup is styled, and the bell doesn't sit on the name */
  await p.setViewport({ width: 1280, height: 860 }); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'side'; localStorage.setItem('dash.settings', JSON.stringify(s)); localStorage.setItem('dash.sideNav', 'open'); window.dispatchEvent(new Event('dash:local')); }); await go(p, 'finance/', 3000);
  await until(p, () => !!document.querySelector('.mb-me #ntBtn'), 8000);
  const side = await p.evaluate(() => { const bt = document.getElementById('ntBtn'), w = document.querySelector('.mb-me .mb-who b'); if (!bt || !w) return null; const a = bt.getBoundingClientRect(), r = document.createRange(); r.selectNodeContents(w); const t = w.getBoundingClientRect(); bt.click(); const o = document.querySelector('.nt-ov'); const out = { inMe: !!bt.closest('.mb-me'), gap: Math.round(a.left - t.right), fixed: !!o && getComputedStyle(o).position === 'fixed' }; if (o) o.click(); return out; });
  check(side && side.inMe && side.gap >= 0 && side.fixed, 'side menu: the bell is beside the name, and the popup floats on Finances ' + JSON.stringify(side));
  /* a notification goes to its tile: a bill opens Finances' "Next 14 days" – its tab opens and the card lights up */
  await p.evaluate(() => { const b = document.querySelector('[data-ftab-go="tx"]'); if (b) b.click(); });
  await sl(300);
  const hid = await p.evaluate(() => document.querySelector('.card.next').offsetHeight);
  await p.evaluate(() => { location.hash = '#c=next'; }); await until(p, () => document.querySelector('.card.next').classList.contains('sr-flash'), 4000);
  const tile = await p.evaluate(() => { const c = document.querySelector('.card.next'); return { shown: c.offsetHeight > 0, flash: c.classList.contains('sr-flash'), hash: location.hash }; });
  check(hid === 0 && tile.shown && tile.flash && !tile.hash, 'a link to a tile opens its tab and lights it up ' + JSON.stringify([hid, tile]));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
