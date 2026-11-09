/* Dinner voting: the owner suggests dinners, Iago picks one – it lands on the plan in both apps; and the other way round. */
const { shared, until, sl, U } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { Features.set('food', true); Features.set('meals', true); });
  await p.goto(U + 'food/'); await sl(3500);
  const btn = await until(p, () => !!document.querySelector('[data-vtnew]'), 8000);
  check(btn !== null, 'cmd offers “Let Iago choose”');
  await p.evaluate(() => document.querySelector('[data-vtnew]').click()); await sl(400);
  await p.evaluate(() => { const f = document.querySelector('[data-vtform]'); f.d.selectedIndex = 1; f.o1.value = 'Taco'; f.o2.value = 'Pasta'; f.o3.value = 'Curry'; f.requestSubmit(); }); await sl(800);
  check(await p.evaluate(() => /Waiting for Iago/.test(document.querySelector('.hl-votes').innerText)), 'cmd shows “Waiting for Iago to pick”');
  await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click());
  const seen = await until(q, () => document.querySelectorAll('[data-votepick]').length === 3, 15000);
  check(seen !== null, 'Iago gets three dinners to pick from');
  await q.evaluate(() => [...document.querySelectorAll('[data-votepick]')].find(x => /Pasta/.test(x.innerText)).click());
  const k = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return Features.dkey(d); });
  const onPlan = await until(p, k => (Features.tools().meals || {})[k] === 'Pasta' && (Features.tools().votes || []).some(v => v.pick === 1), 15000, k);
  check(onPlan !== null, 'Pasta lands on tomorrow’s plan in cmd, and the pick is recorded');
  check(await until(p, () => /Iago picked Pasta/.test((document.querySelector('.hl-votes') || {}).innerText || ''), 8000) !== null, 'cmd says “Iago picked Pasta”');
  /* the other way: Iago asks, the owner picks */
  await q.evaluate(() => document.querySelector('[data-votenew]').click()); await sl(500);
  await q.evaluate(() => { const f = document.querySelector('.h-sheetbg form'); f.d.selectedIndex = 2; f.o1.value = 'Sushi'; f.o2.value = 'Pizza'; f.requestSubmit(); }); await sl(500);
  const asked = await until(p, () => document.querySelectorAll('[data-vtpick]').length === 2, 15000);
  check(asked !== null, 'cmd gets Iago’s two suggestions');
  await p.evaluate(() => [...document.querySelectorAll('[data-vtpick]')].find(x => /Pizza/.test(x.innerText)).click()); await sl(800);
  const k2 = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 2); return Features.dkey(d); });
  const back = await until(q, k2 => [...document.querySelectorAll('[data-meal]')].some(x => x.dataset.meal === k2 && /Pizza/.test(x.innerText)), 15000, k2);
  check(back !== null, 'Pizza shows on Iago’s plan');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
