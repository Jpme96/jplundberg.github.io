/* Rebuild A2, step 1: the shopping list straight from the shared box. Owner and Iago change the list at the same
   time and both end up with the same list; the owner's second device reads the box too; cmd's own extras
   ("from the pantry") stay; turning it off keeps the list. Made-up data only. */
const { shared, open, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const names = l => (l || []).map(x => x.text + (x.done ? '✓' : '')).sort().join(',');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { const t = Features.tools(); t.shop = [{ id: 'sMilk', text: 'Milk', done: false, from: 'pantry' }, { id: 'sBread', text: 'Bread', done: false }]; Features.saveTools(t); });
  await p.evaluate(() => ShareSpace.sync()); await sl(1500);
  check(await p.evaluate(() => ShareSpace.direct('shop', true)) === true, 'the switch turns on');
  await p.evaluate(() => ShareSpace.sync()); await sl(1000);
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click());
  check(await until(q, () => /Milk/.test(document.body.innerText) && /Bread/.test(document.body.innerText), 10000) !== null, 'Iago sees the list');
  /* both at once, no sync in between */
  await Promise.all([
    p.evaluate(() => { const t = Features.tools(); t.shop.find(x => x.id === 'sMilk').done = true; t.shop.push({ id: 'sEggs', text: 'Eggs', done: false }); Features.saveTools(t); }),
    q.evaluate(() => { document.querySelector('[data-shop="sBread"]').click(); const f = document.querySelector('[data-addshop]'); f.shop.value = 'Coffee'; f.requestSubmit(); })
  ]);
  const want = 'Bread✓,Coffee,Eggs,Milk✓';
  const okP = await until(p, w => (Features.tools().shop || []).map(x => x.text + (x.done ? '✓' : '')).sort().join(',') === w, 15000, want);
  check(okP !== null, 'cmd ends with both changes: ' + names(await p.evaluate(() => Features.tools().shop)));
  const okQ = await until(q, w => { const l = [...document.querySelectorAll('[data-shop]')].map(x => x.innerText.trim() + (x.getAttribute('aria-pressed') === 'true' ? '✓' : '')).sort().join(','); return l === w; }, 15000, want);
  check(okQ !== null, 'Iago ends with both changes');
  check(await p.evaluate(() => (Features.tools().shop.find(x => x.id === 'sMilk') || {}).from === 'pantry'), 'cmd’s own extra ("from the pantry") is kept');
  /* a delete in cmd reaches Iago, and isn't brought back */
  await p.evaluate(() => { const t = Features.tools(); t.shop = t.shop.filter(x => x.id !== 'sEggs'); Features.saveTools(t); });
  check(await until(q, () => !/Eggs/.test(document.querySelector('.h-list') ? document.querySelector('.h-list').innerText : ''), 10000) !== null, 'the delete reaches Iago');
  /* Iago deletes: gone in cmd */
  await q.evaluate(() => document.querySelector('[data-shopdel="sBread"]').click());
  check(await until(p, () => !(Features.tools().shop || []).some(x => x.id === 'sBread'), 10000) !== null, 'Iago’s delete reaches cmd');
  await sl(2500);
  check(await p.evaluate(() => !(Features.tools().shop || []).some(x => x.id === 'sEggs' || x.id === 'sBread')), 'deleted things stay deleted after more syncs');
  /* the owner's second device reads the box */
  const d2 = await open(1100);
  const two = await until(d2.p, () => window.ShareSpace && ShareSpace.direct('shop') && (Features.tools().shop || []).map(x => x.text).sort().join(',') === 'Coffee,Milk', 25000);
  check(two !== null, 'the second device shows the same list: ' + names(await d2.p.evaluate(() => Features.tools().shop)));
  await d2.p.evaluate(() => { const t = Features.tools(); t.shop.push({ id: 'sTea', text: 'Tea', done: false }); Features.saveTools(t); });
  check(await until(q, () => /Tea/.test(document.body.innerText), 12000) !== null, 'an add on the second device reaches Iago');
  check(await until(p, () => (Features.tools().shop || []).some(x => x.text === 'Tea'), 12000) !== null, '… and the first device');
  /* off again: the list stays (the vault copy) */
  await p.evaluate(() => ShareSpace.direct('shop', false)); await sl(500);
  const after = await p.evaluate(() => (Features.tools().shop || []).map(x => x.text).sort().join(','));
  check(after === 'Coffee,Milk,Tea', 'turned off, the list is kept: ' + after);
  await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  check(await q.evaluate(() => [...document.querySelectorAll('[data-shop]')].map(x => x.innerText.trim()).sort().join(',')) === 'Coffee,Milk,Tea', 'Iago’s list is unchanged after turning it off');
  check(!p.errs.length && !q.errs.length && !d2.p.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs, d2.p.errs]).slice(0, 300));
  await done(b, b2, d2.b);
})();
