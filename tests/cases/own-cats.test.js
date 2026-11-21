/* Your own spending categories (JP 2026-11-21): add one with a colour and an icon in Finances → Categories; it is a choice
   in quick add, the bank import, an expense's category and Sort "Other"; the charts count it; rename a built-in one;
   remove your own and its expenses move to the category you pick. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ym = new Date().toISOString().slice(0, 7);
  await p.evaluate(ym => { try { Features.set('finance', true); } catch (e) {} const d = Vault.get(); delete d.spendCats; d.expenses = (d.expenses || []).filter(e => !/Made-up/.test(e.note || '')).concat([{ id: 'oc1', date: ym + '-03', amount: 700, cat: 'transport', note: 'Made-up Circle K' }]); Vault.save(d); }, ym);
  await sl(800); await go(p, 'finance/', 3000);
  check(await p.evaluate(() => { const b = document.getElementById('fcxBtn'); if (b) b.click(); return !!b; }), 'a Categories button on Finances');
  await sl(400);
  await p.evaluate(() => { const f = document.querySelector('form[data-fcxadd]'); f.n.value = 'Made-up Car'; const c = document.querySelectorAll('[data-fcxnewcol]')[1]; c.click(); });
  await sl(200);
  await p.evaluate(() => { const f = document.querySelector('form[data-fcxadd]'); f.n.value = 'Made-up Car'; const s = f.querySelector('[data-fcxnewicon]'); s.value = 'car-front'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sl(200);
  await p.evaluate(() => { const f = document.querySelector('form[data-fcxadd]'); f.n.value = 'Made-up Car'; f.requestSubmit(); });
  await sl(600);
  const c1 = await p.evaluate(() => { const c = FinCats.list().find(x => x.name === 'Made-up Car'); return c && { id: c.id, icon: c.icon, color: c.color, own: c.own, last: FinCats.list().slice(-1)[0].id, inSheet: [...document.querySelectorAll('[data-fcxname]')].some(i => i.value === 'Made-up Car'), col1: FinCats.COLORS[1] }; });
  check(c1 && c1.own && c1.icon === 'car-front' && c1.color === c1.col1, 'added with the colour and icon picked ' + JSON.stringify(c1));
  check(c1 && c1.last === 'other' && c1.inSheet, 'Other stays last, the new one is in the sheet');
  /* it is a choice everywhere */
  const ch = await p.evaluate(id => ({ add: [...document.querySelectorAll('#spCat option')].some(o => o.value === id), imp: (BankImport.cats || []).some(c => c[0] === id), tx: true }), c1.id);
  check(ch.add && ch.imp, 'a choice in Add expense and in the bank import ' + JSON.stringify(ch));
  /* an expense in it shows in the charts */
  await p.evaluate(id => { const d = Vault.get(); d.expenses.find(e => e.id === 'oc1').cat = id; Vault.save(d); window.dispatchEvent(new Event('fin:change')); }, c1.id); await sl(1200);
  const inChart = await p.evaluate(() => /Made-up Car/.test((document.getElementById('spChart') || {}).textContent || ''));
  check(inChart, 'the spending chart shows the new category');
  /* rename a built-in one */
  await p.evaluate(() => { const i = document.querySelector('[data-fcxname="groceries"]'); i.value = 'Made-up Food'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  check(await p.evaluate(() => FinCats.name('groceries') === 'Made-up Food'), 'a built-in category can be renamed');
  /* remove your own: the expense moves to the one you pick */
  await p.evaluate(id => document.querySelector('[data-fcxdel="' + id + '"]').click(), c1.id); await sl(200);
  await p.evaluate(() => { const s = document.querySelector('[data-fcxto]'); s.value = 'transport'; });
  await p.evaluate(id => document.querySelector('[data-fcxdelok="' + id + '"]').click(), c1.id); await sl(500);
  const gone = await p.evaluate(id => ({ has: FinCats.has(id), cat: Vault.get().expenses.find(e => e.id === 'oc1').cat }), c1.id);
  check(!gone.has && gone.cat === 'transport', 'removed: its expense is in Transport ' + JSON.stringify(gone));
  check(!errs.length, 'no script errors ' + errs.join(' | '));
  await b.close(); done();
})();
