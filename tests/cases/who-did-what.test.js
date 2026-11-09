/* Who did what: both apps list the same shared changes with who made them, and can show only one person's. */
const { shared, until, sl, U } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { const t = Features.tools(); t.shop = [{ id: 's1', text: 'Milk', done: false }]; Features.saveTools(t); }); await sl(1500);
  await p.evaluate(() => ShareSpace.sync()); await sl(2000);
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click()); await sl(800);
  await q.evaluate(() => { const f = document.querySelector('[data-addshop]'); f.shop.value = 'Coffee'; f.requestSubmit(); }); await sl(1500);
  /* Iago: Home tab → Who did what */
  await q.evaluate(() => document.querySelector('[data-tab="chores"]').click()); await sl(800);
  const iago = await q.evaluate(() => [...document.querySelectorAll('.h-act li')].map(x => x.innerText.split('\n')[0].trim()));
  check(iago.some(x => /You added Coffee/.test(x)) && iago.some(x => /Lundberg|added Milk/.test(x)), 'Iago sees both: ' + iago.slice(0, 4).join(' | '));
  await q.evaluate(() => document.querySelector('[data-actwho="p"]').click()); await sl(300);
  const onlyMe = await q.evaluate(() => [...document.querySelectorAll('.h-act li')].map(x => x.innerText.split('\n')[0].trim()));
  check(onlyMe.length && onlyMe.every(x => /^You /.test(x)), 'Iago filters to his own: ' + onlyMe.join(' | '));
  /* owner: Admin → Shared → Who did what */
  await p.evaluate(() => sessionStorage.setItem('adTab', 'shared')); await p.goto(U + 'admin/'); await sl(3000);
  await until(p, () => !!document.querySelector('[data-shact]') || !!document.querySelector('[data-sec="act"], #shActList'), 8000);
  await p.evaluate(() => { const h = [...document.querySelectorAll('button, summary')].find(x => /Who did what/.test(x.innerText)); if (h) h.click(); }); await sl(500);
  const own = await p.evaluate(() => [...document.querySelectorAll('.sh-act li')].map(x => x.innerText.split('\n')[0].trim()));
  check(own.some(x => /Iago added Coffee/.test(x)), 'cmd lists Iago’s change: ' + own.slice(0, 4).join(' | '));
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
