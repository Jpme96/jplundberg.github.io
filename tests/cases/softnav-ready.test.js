/* Pages are ready before the tap (2026-11-22, JP: "every page has to load, and then it stutters"): the menu's pages are
   fetched after unlocking, a touch on a link starts its page, and a change then needs no request for the page. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  await sl(9000);   /* 3 s after unlock, then one page every 0.7 s */
  const r = await p.evaluate(() => { const ks = [...document.querySelectorAll('.tabbar a[href]')].filter(a => a.offsetWidth > 0).map(a => new URL(a.getAttribute('href'), location.href).pathname).filter(k => k !== location.pathname);
    return { ks, ready: ks.filter(k => window.SoftNav.ready(k)) }; });
  check(r.ks.length > 0 && r.ready.length === r.ks.length, 'the menu’s pages are fetched ahead ' + JSON.stringify(r));
  /* a touch on a link outside the menu starts that page */
  const k2 = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href^="/cmd/"]')].find(x => { const k = new URL(x.href).pathname; return /^\/cmd\/[a-z]+\/$/.test(k) && !window.SoftNav.ready(k) && k !== location.pathname; });
    if (!a) return ''; a.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return new URL(a.href).pathname; });
  if (k2) { await sl(1500); check(await p.evaluate(k => window.SoftNav.ready(k), k2), 'a touch on a link starts its page (' + k2 + ')'); }
  /* the change itself asks for no page */
  const asked = []; p.on('request', q => { const u = new URL(q.url()); if (/^\/cmd\/[a-z]*\/?$/.test(u.pathname) && q.resourceType() === 'fetch') asked.push(u.pathname); });
  await p.evaluate(k => { const a = [...document.querySelectorAll('.tabbar a[href]')].find(x => new URL(x.href).pathname === k); a.click(); }, r.ks[0]);
  await until(p, k => location.pathname === k, 8000, r.ks[0]); await sl(1500);
  check(await p.evaluate(() => window.SoftNav.count) >= 1, 'it was an instant page change');
  check(asked.length === 0, 'and the page came from what was fetched ahead ' + asked.join(','));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await done(b);
})();
