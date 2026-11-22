/* Quick add knows more (2026-11-22, JP: "All of it"): shopping, dinner, mood, wish, return, gift idea, thank-you,
   freezer, use it up, flex – each only while its section is on, by form and by the typed line. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  const tabs = () => p.evaluate(() => { window.Quick && 0; document.getElementById('quickAdd').click(); return new Promise(r => setTimeout(() => { const l = [...document.querySelectorAll('#qaTabs [data-tab]')].map(x => x.dataset.tab); document.querySelector('.qa-bg [data-close], [data-close]').click(); r(l); }, 300)); });
  const before = await tabs();
  check(before.indexOf('freezer') < 0 && before.indexOf('return') < 0, 'sections that are off have no tab ' + before);
  await p.evaluate(() => { ['food', 'mood', 'journal', 'wish', 'returns', 'people', 'thanks', 'freezer', 'usefood', 'flex'].forEach(i => Features.set(i, true));
    const t = Features.tools(); t.people = [{ id: 'pp-made-up-2', name: 'Kari Testesen' }]; t.pantry = [{ id: 'pa1', name: 'havremelk', state: 'ok' }]; Features.saveTools(t); });
  await sl(500);
  const after = await tabs();
  const want = ['shop', 'dinner', 'mood', 'wish', 'return', 'gift', 'thanks', 'freezer', 'usefood', 'flex'];
  check(want.every(k => after.indexOf(k) > -1), 'with the sections on, quick add has all ten new tabs ' + after);
  /* by form: open each tab, fill in, save */
  const viaForm = (kind, fill) => p.evaluate((kind, fill) => new Promise(res => {
    document.getElementById('quickAdd').click();
    setTimeout(() => { document.querySelector('#qaTabs [data-tab="' + kind + '"]').click();
      setTimeout(() => { const f = document.querySelector('.qa-form[data-kind="' + kind + '"]'); Object.keys(fill).forEach(n => { const el = f.querySelector('[name="' + n + '"]' + (n === 'm' ? '[value="' + fill[n] + '"]' : '')); if (n === 'm') el.checked = true; else el.value = fill[n]; });
        f.querySelector('button[type=submit]').click(); setTimeout(res, 300); }, 200); }, 250);
  }), kind, fill);
  await viaForm('shop', { t: 'Made-up milk, Made-up eggs' });
  await viaForm('mood', { m: '4', t: 'A made-up good day' });
  await viaForm('gift', { t: 'A made-up bird book' });
  await viaForm('freezer', { t: 'Made-up soup', n: '3' });
  await viaForm('flex', { i: '08:00', o: '16:00' });
  const r1 = await p.evaluate(() => { const t = Features.tools(), pad = n => String(n).padStart(2, '0'), d = new Date(), k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return { shop: (t.shop || []).filter(x => /Made-up/.test(x.text)).length, mood: (t.journal || []).find(j => j.date === k), gift: (t.people[0].gifts || ''), frz: (t.freezer || [])[0], flex: (t.flex || []).find(x => x.in === '08:00') }; });
  check(r1.shop === 2, 'form: two items on the shopping list');
  check(r1.mood && r1.mood.mood === '4' && /good day/.test(r1.mood.line), 'form: today’s mood and line in the journal');
  check(/bird book/.test(r1.gift), 'form: the gift idea on the person');
  check(r1.frz && r1.frz.n === 3, 'form: three portions in the freezer');
  check(r1.flex && r1.flex.out === '16:00', 'form: a flex day 08–16');
  /* by the typed line */
  const typed = line => p.evaluate(l => new Promise(res => { document.getElementById('quickAdd').click(); setTimeout(() => { const i = document.getElementById('qaLine'); i.value = l; i.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { const g = (document.querySelector('#qaPrev .qa-gx small') || {}).textContent || ''; const a = document.querySelector('[data-addline]'); if (a) a.click(); setTimeout(() => res(g), 300); }, 200); }, 250); }), line);
  const g1 = await typed('havremelk'), g2 = await typed('middag taco i morgen'), g3 = await typed('ønske made-up kaffemaskin 2999 kr'), g4 = await typed('retur made-up jakke'), g5 = await typed('fikk skjerf av Kari Testesen'), g6 = await typed('bruk opp spinat');
  check([g1, g2, g3, g4, g5, g6].join('|') === 'Shopping|Dinner|Wish|Return|Thank-you|Use it up', 'typed: each line is understood ' + [g1, g2, g3, g4, g5, g6].join('|'));
  const r2 = await p.evaluate(() => { const t = Features.tools(); return { milk: (t.shop || []).some(x => x.text === 'Havremelk' || x.text === 'havremelk'), meals: Object.values(t.meals || {}).indexOf('Taco') > -1, wish: (t.wishes || []).find(x => /kaffemaskin/i.test(x.title)), ret: (t.returns || [])[0], ty: (t.thanks || [])[0], use: (t.usefood || [])[0] }; });
  check(r2.milk && r2.meals && r2.wish && r2.wish.price === 2999 && r2.ret && r2.ret.days === 14 && r2.ty && r2.ty.pid === 'pp-made-up-2' && r2.use, 'typed: saved where each section keeps it ' + JSON.stringify({ milk: r2.milk, meals: r2.meals, ty: r2.ty }));
  /* undo */
  await typed('fryser made-up lasagne x2');
  await p.evaluate(() => { const u = [...document.querySelectorAll('.toast button, [data-undo]')].pop(); if (u) u.click(); }); await sl(300);
  check(await p.evaluate(() => !(Features.tools().freezer || []).some(x => /lasagne/i.test(x.title))), 'Undo takes it out again');
  check(!p.errs.length, 'no script errors ' + p.errs.slice(0, 2).join(' | '));
  await b.close(); done();
})();
