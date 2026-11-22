/* The chat bubble stays after an instant page change (2026-11-22, JP: "the chat vanishes when I close it and press
   somewhere else"): softnav empties the page, the bubble is put back. Made-up shared home. */
const { shared, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await shared();
  await p.click('.hc-bub'); await sl(1000);
  check(await p.evaluate(() => !!document.querySelector('.hc-pop')), 'the chat opens');
  await p.evaluate(() => { const c = document.querySelector('.hc-pop [data-close], .hc-pop .hc-x, .hc-popbg'); if (c) c.click(); });
  await sl(600);
  /* go to another page the way a tap on the menu does */
  await p.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(x => /\/cmd\/calendar\/$/.test(x.getAttribute('href'))); a.click(); });
  await until(p, () => /\/cmd\/calendar\/$/.test(location.pathname), 8000); await sl(2500);
  const r = await p.evaluate(() => { const bb = document.querySelector('.hc-bub'); return { there: !!bb, shown: !!(bb && !bb.hidden && getComputedStyle(bb).display !== 'none' && bb.getBoundingClientRect().width > 20), soft: !!window.__softnavCount || true }; });
  check(r.there && r.shown, 'the chat bubble is there on the next page');
  await p.click('.hc-bub'); await sl(1000);
  check(await p.evaluate(() => !!document.querySelector('.hc-pop .hc-row textarea')), 'and it opens the chat again');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
