/* The last walkthrough items (2026-11-10):
   - Work → Today says "Not clocked in" once, not three times
   - Finances: "Spending faster/slower than planned" instead of "… than the days go"
   - House → History: the home you live in isn't "now · now"
   - sliding a finger along the phone menu changes page without reloading
   Made-up data only. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => {
    ['flex', 'holiday', 'house', 'ptime'].forEach(f => Features.set(f, true));
    const d = Vault.get(); d.budget = { income: [{ id: 'i1', name: 'Salary', amount: 41000, day: 25 }], fixed: [{ id: 'f1', name: 'Rent', amount: 12500, day: 1 }] }; Vault.save(d);
    Quick.add({ kind: 'expense', cat: 'groceries', amount: 300, note: 'Shop' });
  });
  await sl(1000);
  await go(p, 'work/', 2500);
  const n = await p.evaluate(() => (document.querySelector('main, #fp').innerText.match(/Not clocked in/g) || []).length);
  check(n === 1, 'Work → Today: "Not clocked in" once (was three times): ' + n);
  await go(p, 'finance/', 2500);
  const fin = await p.evaluate(() => document.body.innerText);
  check(!/than the days go/.test(fin), 'Finances: no "… than the days go"');
  await go(p, 'house/', 2500);
  await p.evaluate(() => { const x = document.querySelector('[data-ptab-go="history"]'); x && x.click(); }); await sl(900);
  const hs = await p.evaluate(() => document.body.innerText);
  check(!/now · now/.test(hs) && /where you live now|since /.test(hs), 'House → History: the home you live in says "where you live now", not "now · now"');

  /* a finger sliding along the phone menu */
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); await go(p, '', 2500);
  await p.evaluate(() => { window.__same = 1; });
  const pos = await p.evaluate(() => { const t = [...document.querySelectorAll('nav.tabbar a[data-pg]')].filter(a => a.offsetWidth).sort((a, c) => a.getBoundingClientRect().left - c.getBoundingClientRect().left);
    const r0 = t[0].getBoundingClientRect(), r2 = t[2].getBoundingClientRect(); return { x0: r0.left + r0.width / 2, x2: r2.left + r2.width / 2, y: r0.top + r0.height / 2, to: new URL(t[2].href).pathname }; });
  const cdp = await p.target().createCDPSession(), n0 = await p.evaluate(() => SoftNav.count);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pos.x0, y: pos.y }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pos.x0 + (pos.x2 - pos.x0) * i / 8, y: pos.y }] }); await sl(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const moved = await until(p, a => location.pathname === a[0] && SoftNav.count > a[1], 8000, [pos.to, n0]);   /* the address changes first, the count when the page is in */
  const st = await p.evaluate(() => ({ path: location.pathname, same: window.__same === 1, count: SoftNav.count }));
  check(moved !== null && st.same && st.count > 0, 'a finger slide to ' + pos.to + ' changes page without reloading ' + JSON.stringify(st) + ' ' + JSON.stringify(pos));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
