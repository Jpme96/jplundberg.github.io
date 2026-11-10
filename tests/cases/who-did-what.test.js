/* Who did what (under the chores): both apps list only chores done, with who did them, can show one person's,
   and keep it short (5, then "Show all"). Shopping, pantry and the rest stay out. Made-up data only. */
const { shared, until, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  const names = ['Dishes', 'Bins', 'Hoover', 'Laundry', 'Plants', 'Windows', 'Fridge'];
  await p.evaluate(names => { Features.set('house', true); Features.set('chores', true); const t = Features.tools(), d0 = Features.dkey(new Date());
    t.chores = names.map((n, i) => ({ id: 'c' + i, name: n, every: '1w', day: 0, who: 'rotate', start: d0 }));
    t.shop = [{ id: 's1', text: 'Milk', done: false }]; Features.saveTools(t);
    const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { chores: true, shop: true }); Vault.save(d); }, names);
  await p.evaluate(() => { ShareSpace.direct('chores', true); ShareSpace.direct('shop', true); }); await sl(1500);
  await p.evaluate(() => ShareSpace.sync()); await sl(2000);
  /* Iago adds to the shopping list (must not show) and ticks four chores */
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click()); await sl(800);
  await q.evaluate(() => { const f = document.querySelector('[data-addshop]'); f.shop.value = 'Coffee'; f.requestSubmit(); }); await sl(1000);
  await q.evaluate(() => document.querySelector('[data-tab="chores"]').click());
  check(await until(q, () => document.querySelectorAll('[data-chore]').length >= 7, 12000) !== null, 'Iago sees the 7 chores');
  for (const n of names.slice(0, 4)) { await q.evaluate(n => [...document.querySelectorAll('[data-chore]')].find(e => e.innerText.split('\n')[0] === n).click(), n); await sl(400); }
  /* cmd ticks the other three */
  await until(p, () => Features.list('chores').filter(c => Chores.done(c, Chores.period(c))).length >= 4, 15000);
  await p.evaluate(names => names.forEach(n => { const c = Features.list('chores').find(x => x.name === n); Chores.setDone(c); }), names.slice(4));
  await p.evaluate(() => ShareSpace.sync());
  const rows = () => [...document.querySelectorAll('.h-act li')].map(x => x.innerText.split('\n')[0].trim());
  check(await until(q, () => document.querySelectorAll('.h-act li').length === 5 && !!document.querySelector('[data-actall]'), 15000) !== null, 'Iago: Who did what shows 5 and a "Show all" button: ' + (await q.evaluate(rows)).join(' | '));
  const iago = await q.evaluate(rows);
  check(iago.every(x => / did:? /.test(x) || /did /.test(x)) && !iago.some(x => /Coffee|Milk|added/.test(x)), 'only chores done, no shopping: ' + iago.join(' | '));
  await q.evaluate(() => document.querySelector('[data-actall]').click()); await sl(300);
  check((await q.evaluate(rows)).length === 7 && !(await q.evaluate(() => !!document.querySelector('[data-actall]'))), '"Show all" shows all 7');
  await q.evaluate(() => document.querySelector('[data-actwho="p"]').click()); await sl(300);
  const onlyMe = await q.evaluate(rows);
  check(onlyMe.length === 4 && onlyMe.every(x => /^You /.test(x)), 'Iago filters to his own 4: ' + onlyMe.join(' | '));
  /* owner: Admin → Shared → Who did what */
  await p.evaluate(() => sessionStorage.setItem('adTab', 'shared')); await go(p, 'admin/', 3000);
  await p.evaluate(() => { const h = [...document.querySelectorAll('button, summary')].find(x => /Who did what/.test(x.innerText)); if (h) h.click(); }); await sl(500);
  const own = await p.evaluate(() => [...document.querySelectorAll('.sh-act li')].map(x => x.innerText.split('\n')[0].trim()));
  check(own.some(x => /Iago did/.test(x)) && !own.some(x => /Coffee|Milk/.test(x)), 'cmd lists Iago’s chores and no shopping: ' + own.slice(0, 4).join(' | '));
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
