/* Instant updates: Iago's changes reach cmd and back within seconds over the live line, and a second
   device of the owner gets the owner's saves. */
const { shared, open, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  check(await p.evaluate(() => ShareCore.liveMode()) === 'instant', 'cmd is on the instant line');
  check(await q.evaluate(() => ShareCore.liveMode()) === 'instant', 'Iago’s app is on the instant line');
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click()); await sl(800);
  await p.evaluate(() => { const t = Features.tools(); t.shop = (t.shop || []).concat([{ id: 's' + Date.now(), text: 'Bananas', done: false }]); Features.saveTools(t); });
  const a = await until(q, () => /Bananas/.test(document.body.innerText), 10000);
  check(a !== null && a < 6000, 'owner → Iago in ' + a + ' ms');
  await q.evaluate(() => { const f = document.querySelector('[data-addshop]'); f.shop.value = 'Coffee'; f.requestSubmit(); });
  const c = await until(p, () => (Features.tools().shop || []).some(x => x.text === 'Coffee'), 10000);
  check(c !== null && c < 6000, 'Iago → owner in ' + c + ' ms');
  const d2 = await open(1100);
  const ready = await until(d2.p, () => !!(window.Vault && Vault.get() && document.documentElement.classList.contains('unlocked') && window.ShareCore && ShareCore.liveMode() === 'instant'), 30000);
  check(ready !== null, 'second device unlocked and on the instant line');
  await p.evaluate(() => { const t = Features.tools(); t.shop = (t.shop || []).concat([{ id: 'x' + Date.now(), text: 'Melon', done: false }]); Features.saveTools(t); });
  const e = await until(d2.p, () => (Features.tools().shop || []).some(x => x.text === 'Melon'), 10000);
  check(e !== null && e < 8000, 'owner’s second device got the save in ' + e + ' ms');
  check(!p.errs.length && !q.errs.length && !d2.p.errs.length, 'no errors on any screen ' + JSON.stringify([p.errs, q.errs, d2.p.errs]).slice(0, 300));
  await done(b, b2, d2.b);
})();
