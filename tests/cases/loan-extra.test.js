/* Loans: paying extra every month moves the payoff date, shows what it saves and counts in fixed costs. */
const { open, sl, U } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  await p.evaluate(() => { const d = Vault.get(); d.accounts = d.accounts || []; d.accounts.push({ id: 'L1', kind: 'debt', name: 'Car loan', balance: 300000, rate: 6, pay: 6000, day: 20, asOf: '2026-06-20' }); Vault.save(d); });
  await p.goto(U + 'finance/#c=loans'); await sl(3500);
  const before = await p.evaluate(() => { const l = Vault.get().accounts.find(a => a.id === 'L1'); return { m: Loans.calc(l).months, fixed: (Vault.get().budget.fixed || []).filter(f => f.src === 'loan').map(f => f.amount) }; });
  check(before.fixed[0] === 6000, 'fixed costs count 6 000 before');
  await p.evaluate(() => { const r = document.querySelector('[data-lntry="L1"]'); r.value = 2000; r.dispatchEvent(new Event('input', { bubbles: true })); });
  check(/Pay \+2\s000 kr every month/.test(await p.evaluate(() => document.querySelector('.ln-moreacts').innerText)), 'button offers +2 000 every month');
  await p.evaluate(() => document.querySelector('[data-lnmore="L1"]').click()); await sl(1500);
  const after = await p.evaluate(() => { const l = Vault.get().accounts.find(a => a.id === 'L1'); return { more: l.more, m: Loans.calc(l).months, fixed: (Vault.get().budget.fixed || []).filter(f => f.src === 'loan').map(f => f.amount), line: (document.querySelector('.ln-more') || {}).innerText || '' }; });
  check(after.more && after.more[0].amount === 2000, 'extra stored on the loan');
  check(after.m < before.m, 'paid off sooner: ' + before.m + ' → ' + after.m + ' months');
  check(after.fixed[0] === 8000, 'fixed costs count 8 000 after');
  check(/\+2\s000 kr extra/.test(after.line), 'loan says “You pay +2 000 kr extra every month”');
  check(await p.evaluate(() => document.querySelector('.ln-moreacts').hidden), 'the button hides once saved');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
