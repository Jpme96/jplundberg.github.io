/* Keep the screen on (2026-11-19, plan Part 4): a toggle on an open recipe and on the shopping list asks for a screen
   wake lock, lets go when tapped again or when you leave the page. The browser's wake lock is a fake here so the test
   can count requests and releases. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluateOnNewDocument(() => {
    window.__wl = { req: 0, rel: 0 };
    const fake = { request: () => { window.__wl.req++; const l = new EventTarget(); l.release = () => { window.__wl.rel++; l.dispatchEvent(new Event('release')); return Promise.resolve(); }; return Promise.resolve(l); } };
    try { Object.defineProperty(navigator, 'wakeLock', { value: fake, configurable: true }); } catch (e) {}
  });
  await p.evaluate(() => {
    Features.set('food', true);
    const t = Features.tools(); t.recipes = [{ id: 'rcPasta', title: 'Pasta', ingr: 'pasta\ntomatoes', steps: 'Boil.' }]; t.shop = [{ id: 'sMilk', text: 'Milk', done: false }]; Features.saveTools(t);
  });
  await go(p, 'food/', 2500);
  const r1 = await p.evaluate(async () => {
    const b = document.querySelector('#shop [data-awake]'); if (!b) return { none: true };
    b.click(); await new Promise(r => setTimeout(r, 200));
    const on = b.getAttribute('aria-pressed'), txt = b.textContent.trim(), req = window.__wl.req;
    b.click(); await new Promise(r => setTimeout(r, 200));
    return { on, txt, req, off: document.querySelector('#shop [data-awake]').getAttribute('aria-pressed'), rel: window.__wl.rel };
  });
  check(!r1.none, 'the shopping list has a Keep screen on button');
  check(r1.on === 'true' && r1.req === 1 && /stays on/.test(r1.txt), 'a tap keeps the screen on ' + JSON.stringify(r1));
  check(r1.off === 'false' && r1.rel === 1, 'a second tap lets go');
  /* the recipe's own button, and leaving the page lets go */
  const r2 = await p.evaluate(async () => {
    const tg = document.querySelector('[data-kit-toggle="rcPasta"]'); if (tg) tg.click();
    await new Promise(r => setTimeout(r, 300));
    const b = document.querySelector('.kit-detail [data-awake]'); if (!b) return { none: true };
    b.click(); await new Promise(r => setTimeout(r, 200));
    return { req: window.__wl.req };
  });
  check(!r2.none && r2.req === 2, 'an open recipe has the button too');
  const rel = await p.evaluate(async () => { window.dispatchEvent(new Event('softnav:swap')); await new Promise(r => setTimeout(r, 100)); return window.__wl.rel; });
  check(rel >= 2, 'leaving the page lets go (' + rel + ')');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
