/* Bills tick themselves off (JP 2026-11-21): a bank payment whose text doesn't name the bill still ticks it when the
   amount and the day fit one unpaid bill; the preview says so with "Not this bill"; importing remembers the bank's text
   on the bill, so the next month it's a sure match; a payment that fits nothing stays spending. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ym = new Date().toISOString().slice(0, 7);
  await p.evaluate(ym => { try { Features.set('finance', true); } catch (e) {}
    const d = Vault.get(); d.budget = d.budget || {}; d.budget.fixed = [{ id: 'bp', name: 'Made-up power', amount: 1200, day: 15, vary: 1 }, { id: 'br', name: 'Made-up rent', amount: 9000, day: 1 }];
    d.paid = {}; d.expenses = (d.expenses || []).filter(e => !/Made-up/.test(e.note || '')); Vault.save(d); }, ym);
  await sl(800); await go(p, 'finance/', 3000);
  const run = (rows, nobill) => p.evaluate(async (rows, nobill) => {
    BankImport.show([['Dato', 'Tekst', 'Beløp', 'Saldo']].concat(rows), null, null); await new Promise(r => setTimeout(r, 400));
    const box = document.querySelector('.im-box'), txt = box ? box.textContent : '';
    if (nobill) { const n = box.querySelector('[data-nobill]'); if (n) n.click(); await new Promise(r => setTimeout(r, 300)); }
    const btn = document.querySelector('.im-box [data-import]'); if (btn) btn.click(); await new Promise(r => setTimeout(r, 700));
    const d = Vault.get(); return { txt, paid: (d.paid || {})[rows[0][0].slice(0, 7)] || [], bank: (d.budget.fixed.find(f => f.id === 'bp') || {}).bank || [], months: (d.budget.fixed.find(f => f.id === 'bp') || {}).months || {}, spent: (d.expenses || []).filter(e => /Made-up|Kraft/.test(e.note || '')).map(e => e.note) };
  }, rows, nobill);

  /* "Not this bill" leaves it as spending */
  const a = await run([[ym + '-14', 'MADE-UP KRAFT AS 4411', '-1310', '']], true);
  check(/Looks like Made-up power/.test(a.txt) && a.paid.indexOf('bp') < 0 && a.spent.length === 1, '"Not this bill": not ticked, imported as spending ' + JSON.stringify({ paid: a.paid, spent: a.spent, g: /Looks like/.test(a.txt) }));
  await p.evaluate(() => { const d = Vault.get(); d.expenses = d.expenses.filter(e => !/KRAFT|Kraft/i.test(e.note || '')); d.skipRefs = []; Vault.save(d); }); await sl(600);

  /* the same payment, kept: the bill is ticked, that month's amount is what the bank took, and the text is remembered */
  const c = await run([[ym + '-14', 'MADE-UP KRAFT AS 4411', '-1310', ''], [ym + '-20', 'Made-up cinema', '-1200', '']], false);
  check(c.paid.indexOf('bp') > -1 && c.months[ym] === 1310 && c.bank.length === 1, 'kept: Made-up power ticked as paid, 1 310 kr that month, the bank text remembered ' + JSON.stringify(c));
  check(c.spent.length === 1 && /cinema/i.test(c.spent[0]), 'a payment on another day stays spending (the bill is already paid) ' + JSON.stringify(c.spent));
  check(c.paid.indexOf('br') < 0, 'rent is not ticked by anything that doesn\'t fit it');
  check(!errs.length, 'no script errors ' + errs.join(' | '));
  await b.close(); done();
})();
