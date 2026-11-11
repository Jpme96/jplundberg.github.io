/* The two of you (Phase E, together.js – the same code in both apps): on my way home, a high five, countdowns,
   date ideas, guests, the shared packing list, dinners → the shopping list (leaving out what the pantry has) and a
   nudge kept by the server for its minute. Made-up data only. */
const { shared, until, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  const d = (n) => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  /* cmd: share dinners, recipes, pantry, the shopping list and a trip; Iago makes his avatar so cmd knows the two of you */
  await p.evaluate((d1, d3) => { ['food', 'shop', 'house', 'travel'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools(); t.meals = Object.assign({}, t.meals || {}, { [d1]: 'Test taco' });
    t.recipes = [{ id: 'r1', title: 'Test taco', ingr: 'Tortillas\nMinced meat\nCheese', steps: 'Made up' }]; t.pantry = [{ id: 'pa1', name: 'Cheese', state: 'ok' }]; t.shop = [];
    Features.saveTools(t);
    const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'tr1', name: 'Test trip', dest: 'Testby', start: d3, end: d3, share: true, pack: [] }]; localStorage.setItem('dash.travel', JSON.stringify(tv));
    const v = Vault.get(); v.share.what = Object.assign({}, v.share.what || {}, { meals: true, shop: true, recipes: true, pantry: true, trips: true }); Vault.save(v); }, d(1), d(3));
  await q.evaluate(() => { const x = document.querySelector('[data-avatar]'); if (x) x.click(); }); await sl(800);
  await q.evaluate(() => { const r = document.querySelector('.avp [data-avp-rand]'); if (r) r.click(); const bk = document.querySelector('.avp [data-avp-back]'); if (bk) bk.click(); }); await sl(500);
  await q.evaluate(() => { const s = document.querySelector('.avp-ask [data-avp-save]'); if (s) s.click(); }); await sl(1200);
  const sync = async () => { await p.evaluate(() => ShareSpace.sync()); await sl(1500); await q.evaluate(() => window.HomeApp && HomeApp.sync ? HomeApp.sync() : null); await sl(1200); await p.evaluate(() => ShareSpace.sync()); await sl(1200); };
  await sync();
  await go(p, '', 2500); await sync();
  check(await until(p, () => !!document.querySelector('#tgCard .tg-card'), 15000) !== null, 'cmd Home shows “The two of you”');
  await q.evaluate(() => { const t = document.querySelector('[data-tab="today"]'); if (t) t.click(); });
  check(await until(q, () => !!document.querySelector('.tg-card'), 10000) !== null, 'Iago’s Today shows it too');

  /* on my way home: Iago → cmd */
  await q.evaluate(() => Together.open('omw')); await sl(300);
  await q.evaluate(() => { document.querySelector('.tg-sheet [name=m][value="20"]').checked = true; document.querySelector('.tg-sheet form').requestSubmit(); }); await sl(800);
  await sync();
  check(await until(p, () => /on the way|på vei/i.test((document.querySelector('#tgCard') || {}).textContent || ''), 15000) !== null, 'Iago on the way shows in cmd with the time he’s home');
  /* a high five: cmd → Iago */
  await p.evaluate(() => ShareSpace.put('react', 'rTest', { by: 'o', kind: 'hi5', at: Date.now(), what: 'x' })); await sync();
  check(await until(q, () => /high five/i.test((document.querySelector('.tg-card') || {}).textContent || ''), 15000) !== null, 'a high five from cmd pops up in Iago’s app');
  /* a countdown and guests from Iago, an idea from cmd */
  await q.evaluate((dd) => { Together.open('cd'); const f = document.querySelector('.tg-sheet form'); f.t.value = 'Test holiday'; f.d.value = dd; f.requestSubmit(); document.querySelector('.tg-sheet').remove(); }, d(10)); await sl(300);
  await q.evaluate((a, z) => { Together.open('guest'); const f = document.querySelector('.tg-sheet form'); f.n.value = 'Test guest'; f.a.value = a; f.b.value = z; f.requestSubmit(); }, d(4), d(5)); await sl(300);
  await p.evaluate(() => { Together.open('ideas'); const f = document.querySelector('.tg-sheet form'); f.t.value = 'Test picnic'; f.requestSubmit(); document.querySelector('.tg-sheet').remove(); });
  await sync();
  check(await until(p, () => /Test holiday/.test(document.querySelector('#tgCard').textContent) && /Test guest/.test(document.querySelector('#tgCard').textContent), 15000) !== null, 'Iago’s countdown and guest show in cmd');
  check(await until(q, () => { Together.open('ideas'); const ok = /Test picnic/.test(document.querySelector('.tg-sheet').textContent); document.querySelector('.tg-sheet').remove(); return ok; }, 15000) !== null, 'cmd’s date idea shows in Iago’s list');
  check(await until(q, () => Together.week !== undefined, 2000) !== null, 'the Sunday summary is there to show on Sundays');
  /* packing: Iago adds, cmd sees */
  await q.evaluate(() => { Together.open('pack'); const f = document.querySelector('.tg-sheet form'); if (f && f.t) { f.t.value = 'Test charger'; f.requestSubmit(); } const s = document.querySelector('.tg-sheet'); if (s) s.remove(); }); await sync();
  check(await until(p, () => { Together.open('pack'); const s = document.querySelector('.tg-sheet'), ok = /Test charger/.test(s.textContent); s.remove(); return ok; }, 15000) !== null, 'the shared packing list: Iago’s item shows in cmd');
  /* dinners → shopping list, in Iago's app: the cheese is in the pantry */
  const dl = await q.evaluate(() => { Together.open('dinner'); const s = document.querySelector('.tg-sheet'), txt = s.textContent; const f = s.querySelector('form'); if (f.querySelector('input[type=checkbox]')) f.requestSubmit(); else s.remove(); return txt; });
  check(/Tortillas/.test(dl) && /Minced meat/.test(dl) && !/Cheese/.test(dl), 'dinners → list: the taco’s ingredients, without the cheese from the pantry');
  await sync();
  check(await until(p, () => (Features.tools().shop || []).some(x => x.text === 'Tortillas'), 15000) !== null, '… and they’re on cmd’s shopping list');
  /* a nudge for tonight: the server keeps it for its minute */
  const ng = await p.evaluate(() => ShareCore.api('push', { method: 'POST', body: { notify: { title: 'Test', body: 'Bins', id: 'ntest', at: Date.now() + 3600e3 } } }).then(r => r, e => ({ err: String(e) })));
  check(ng && ng.at > Date.now(), 'a nudge for later is kept by the server until its minute ' + JSON.stringify(ng));
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
