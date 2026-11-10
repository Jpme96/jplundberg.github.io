/* Rebuild A2, step 3: the dinner plan straight from the shared box. Both set dinners at the same time and both
   changes stay; a dinner cleared on one side is gone on the other; older dinners stay in cmd. Made-up data. */
const { shared, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  const day = n => p.evaluate(n => Features.dkey(new Date(Date.now() + n * 864e5)), n);
  const [d0, d1, d2, dOld] = [await day(0), await day(1), await day(2), await day(-10)];
  await p.evaluate((d0, d1, dOld) => { Features.set('food', true); Features.set('meals', true); const t = Features.tools(); t.meals = { [d0]: 'Tacos', [d1]: 'Soup', [dOld]: 'Old pizza' }; Features.saveTools(t);
    const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { meals: true }); Vault.save(d); }, d0, d1, dOld);
  await p.evaluate(() => ShareSpace.sync()); await sl(1500);
  check(await p.evaluate(() => ShareSpace.direct('meals')) === true, 'on by default');
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click());
  check(await until(q, () => /Tacos/.test(document.body.innerText) && /Soup/.test(document.body.innerText), 12000) !== null, 'Iago sees the dinners');
  /* both at once: Iago changes tomorrow, the owner plans the day after */
  await Promise.all([
    p.evaluate(d2 => { const t = Features.tools(); t.meals[d2] = 'Curry'; Features.saveTools(t); }, d2),
    (async () => { await q.evaluate(d1 => document.querySelector('[data-meal="' + d1 + '"]').click(), d1); await sl(400);
      await q.evaluate(() => { const f = document.querySelector('.h-sheetbg form'); f.text.value = 'Pasta'; f.requestSubmit(); }); })()
  ]);
  const ok = await until(p, a => { const m = Features.tools().meals || {}; return m[a[0]] === 'Tacos' && m[a[1]] === 'Pasta' && m[a[2]] === 'Curry'; }, 15000, [d0, d1, d2]);
  check(ok !== null, 'cmd has both changes: ' + JSON.stringify(await p.evaluate(() => Features.tools().meals)));
  check(await until(q, () => /Pasta/.test(document.body.innerText) && /Curry/.test(document.body.innerText) && !/Soup/.test(document.body.innerText), 15000) !== null, 'Iago has both changes');
  check(await p.evaluate(k => Features.tools().meals[k] === 'Old pizza', dOld), 'an older dinner stays in cmd');
  /* cleared in cmd: gone for Iago, and it doesn't come back */
  await p.evaluate(d0 => { const t = Features.tools(); delete t.meals[d0]; Features.saveTools(t); }, d0);
  check(await until(q, () => !/Tacos/.test(document.body.innerText), 15000) !== null, 'a cleared dinner is gone for Iago');
  await sl(2500);
  check(await p.evaluate(d0 => !Features.tools().meals[d0], d0), 'and stays gone');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
