/* Due days: a grid of days instead of a long list; the choice is saved and the next date shown. */
const { open, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  await p.evaluate(() => { const d = Vault.get(); d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = [{ id: 'f1', name: 'Rent', amount: 12000, day: 1 }, { id: 'f2', name: 'Phone', amount: 399 }]; Vault.save(d); });
  await go(p, 'finance/', 3500);
  await p.evaluate(() => document.getElementById('billsEdit').click()); await sl(600);
  const btns = await p.evaluate(() => [...document.querySelectorAll('#billsBody .dp-btn')].map(x => x.innerText));
  check(btns.length === 2 && /1st every month/.test(btns[0]) && /No due day/.test(btns[1]), 'buttons instead of lists: ' + btns.join(' | ').replace(/\n/g, ' '));
  await p.evaluate(() => document.querySelectorAll('#billsBody .dp-btn')[1].click()); await sl(300);
  check(await p.evaluate(() => document.querySelectorAll('.dp-g button').length === 31), 'the grid has 31 days');
  await p.evaluate(() => document.querySelector('.dp-g button[data-v="15"]').click()); await sl(800);
  check(await p.evaluate(() => Vault.get().budget.fixed.find(f => f.id === 'f2').day) === 15, 'the 15th is saved');
  check(/15th every month[\s\S]*Next:/.test(await p.evaluate(() => document.querySelectorAll('#billsBody .dp-btn')[1].innerText)), 'shows “the 15th every month · Next: …”');
  await p.evaluate(() => document.querySelectorAll('#billsBody .dp-btn')[1].click()); await sl(300); await p.evaluate(() => document.querySelector('.dp-row button[data-v="last"]').click()); await sl(800);
  check(await p.evaluate(() => Vault.get().budget.fixed.find(f => f.id === 'f2').day) === 31, '“Last day” saves the 31st');
  check(/Last day of the month/.test(await p.evaluate(() => document.querySelectorAll('#billsBody .dp-btn')[1].innerText)), '… and reads “Last day of the month”');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
