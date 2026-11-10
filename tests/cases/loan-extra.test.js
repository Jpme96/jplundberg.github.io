/* Loans: paying extra every month moves the payoff date, shows what it saves and counts in fixed costs. */
const { open, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  await p.evaluate(() => { const d = Vault.get(); d.accounts = d.accounts || []; d.accounts.push({ id: 'L1', kind: 'debt', name: 'Car loan', balance: 300000, rate: 6, pay: 6000, day: 20, asOf: '2026-06-20' }); Vault.save(d); });
  await go(p, 'finance/#c=loans', 3500);
  const before = await p.evaluate(() => { const l = Vault.get().accounts.find(a => a.id === 'L1'); return { m: Loans.calc(l).months, fixed: (Vault.get().budget.fixed || []).filter(f => f.src === 'loan').map(f => f.amount) }; });
  check(before.fixed[0] === 6000, 'fixed costs count 6 000 before');
  await p.evaluate(() => { const r = document.querySelector('[data-lntry="L1"]'); r.value = 2000; r.dispatchEvent(new Event('input', { bubbles: true })); });
  const btn = await p.evaluate(() => document.querySelector('.ln-moreacts').textContent); check(/Pay \+2.000.kr every month/.test(btn), 'button offers +2 000 every month: ' + JSON.stringify(btn));
  await p.evaluate(() => document.querySelector('[data-lnmore="L1"]').click()); await sl(1500);
  const after = await p.evaluate(() => { const l = Vault.get().accounts.find(a => a.id === 'L1'); return { more: l.more, m: Loans.calc(l).months, fixed: (Vault.get().budget.fixed || []).filter(f => f.src === 'loan').map(f => f.amount), line: (document.querySelector('.ln-monthly') || {}).innerText || '' }; });
  check(after.more && after.more[0].amount === 2000, 'extra stored on the loan');
  check(after.m < before.m, 'paid off sooner: ' + before.m + ' → ' + after.m + ' months');
  check(after.fixed[0] === 8000, 'fixed costs count 8 000 after');
  check(/\+2.000.kr extra/.test(after.line), 'loan says “You pay +2 000 kr extra every month”: ' + JSON.stringify(after.line));
  check(await p.evaluate(() => document.querySelector('.ln-moreacts').hidden), 'the button hides once saved');
  /* the opened loan is laid out top to bottom, not squeezed into columns (a class clash once did that) */
  const lay = await p.evaluate(() => { const t = document.querySelector('[data-lntog="L1"]'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); const m = t && t.parentElement.querySelector(':scope > .ln-more'), g = m && m.querySelector('.ln-grid'); return m ? getComputedStyle(m).display + ' ' + Math.round(g.getBoundingClientRect().width) + '/' + Math.round(m.getBoundingClientRect().width) : 'none'; });
  await sl(300);
  const lay2 = await p.evaluate(() => { const m = document.querySelector('[data-lntog="L1"]').parentElement.querySelector(':scope > .ln-more'), g = m.querySelector('.ln-grid'); return [getComputedStyle(m).display, g.getBoundingClientRect().width, m.getBoundingClientRect().width]; });
  check(lay2[0] === 'block' && lay2[1] > lay2[2] * 0.9, 'the opened loan uses the full width: ' + JSON.stringify(lay2) + ' ' + lay);
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
