/* Quick taps on the menu (or the number keys 1–9) while a page is still on its way (2026-11-10): the second tap was
   dropped, but the menu stayed "on its way" for good – no new page load ever came to clear it – so every later tap
   did nothing until a reload. Now a tap during a change is remembered (the last one wins) and opened right after,
   and the menu always works afterwards. Computer and phone. Made-up data only. */
const { open, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  for (const W of [1580, 393]) {
    const { b, p } = await open(W);
    const tag = W > 700 ? 'computer' : 'phone';
    const where = () => p.evaluate(() => location.pathname);
    const order = await p.evaluate(() => [...document.querySelectorAll('nav a[data-pg]')].filter(a => a.offsetWidth || a.offsetHeight)
      .sort((a, c) => { const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect(); return (ra.top - rc.top) || (ra.left - rc.left); })
      .map(a => new URL(a.href).pathname));
    check(order.length >= 3, tag + ': the menu has pages: ' + order.join(' '));
    await p.evaluate(() => { window.__same = 1; });
    const tapLink = path => p.evaluate(h => { const a = [...document.querySelectorAll('nav a[data-pg]')].find(x => new URL(x.href).pathname === h); if (a) a.click(); return !!a; }, path);

    /* number keys on a computer, menu taps on a phone – quick, at several speeds */
    for (const gap of [60, 150, 200, 250, 350]) {
      const seq = [1, 2, 0, 1];                                   /* menu positions: 2nd, 3rd, 1st, 2nd */
      for (const i of seq) {
        if (W > 700) await p.keyboard.press(String(i + 1)); else await tapLink(order[i]);
        await sl(gap);
      }
      const want = order[seq[seq.length - 1]];
      const got = await until(p, w => location.pathname === w && !document.documentElement.classList.contains('sn-go'), 8000, want);
      await sl(600);
      check(got !== null, tag + ' · ' + gap + ' ms apart: ends on the last one tapped (' + want + '): ' + (await where()));
      /* and the menu still works */
      const target = order.find(x => x !== want);
      await tapLink(target);
      const moved = await until(p, w => location.pathname === w, 6000, target);
      check(moved !== null, tag + ' · ' + gap + ' ms: the menu still works afterwards (to ' + target + '): ' + (await where()));
      await sl(500);
    }
    check(await p.evaluate(() => window.__same === 1), tag + ': all of it without reloading the page');
    check(!p.errs.length, tag + ': no errors ' + p.errs.join(' | ').slice(0, 300));
    await b.close();
  }
  await done();
})();
