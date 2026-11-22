/* A new version found while changing page: the fresh page replaces the service worker's copy before the one normal load,
   so that load lands on the new version (2026-11-22: an old copy there made the next taps load fully again – stutter). */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, 'travel/', 3000); await go(p, '', 3000);   /* the service worker now keeps a copy of /cmd/travel/ */
  const r = await p.evaluate(async () => {
    const has = async () => { for (const k of await caches.keys()) { const h = await (await caches.open(k)).match('/cmd/travel/'); if (h) return true; } return false; };
    const before = await has();
    const n = await window.SoftNav.keepFresh('/cmd/travel/', '<!doctype html><title>made-up fresh copy</title>');
    let txt = ''; for (const k of await caches.keys()) { const h = await (await caches.open(k)).match('/cmd/travel/'); if (h) txt = await h.text(); }
    const n2 = await window.SoftNav.keepFresh('/cmd/nothing-here/', 'x');
    return { before, n, fresh: /made-up fresh copy/.test(txt), n2 };
  });
  check(r.before && r.n >= 1 && r.fresh, 'the fresh page replaces the cached copy ' + JSON.stringify(r));
  check(r.n2 === 0, 'pages that were never cached are not added');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await done(b);
})();
