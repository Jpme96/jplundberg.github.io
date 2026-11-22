/* Food's Meals tab stays put when Iago ticks the shopping list (2026-11-22: the number tiles were drawn only on the first change and pushed the cards down). Made-up data. */
const { shared, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { ['food', 'shop', 'meals', 'pantry', 'recipes'].forEach(f => Features.set(f, true)); const t = Features.tools(); t.shop = []; for (let i = 0; i < 25; i++) t.shop.push({ id: 'nj' + i, text: 'Item ' + i, done: false, ts: Date.now() + i }); Features.saveTools(t); localStorage.setItem('dash.ptab.food', 'meals'); });
  await sl(3000); await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click()); await sl(800);
  await go(p, 'food/', 3500); await p.evaluate(() => window.scrollTo(0, 300)); await sl(400);
  const top = () => p.evaluate(() => Math.round(document.querySelector('[data-tool="meals"]').getBoundingClientRect().top));
  const a = await top(); await q.evaluate(() => document.querySelector('[data-shop]').click()); await sl(3500); const c = await top();
  check(Math.abs(a - c) <= 2, 'meals stays put ' + a + ' → ' + c);
  await done(b, b2);
})();
