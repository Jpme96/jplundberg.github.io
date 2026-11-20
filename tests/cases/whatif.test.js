/* "What if?" on Finances → Insights (2026-11-19, plan Part 2): the maths month by month against hand-worked numbers,
   and the card – today's line, adding and removing changes, the warning, phone width, Norwegian. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, 'finance/', 2500);
  const m = await p.evaluate(() => { let out0;
    const pmt = WhatIf.pmt, pay = pmt(1000000, 5, 300);
    const base = { start: '2026-11', income: 40000, fixed: 10000, spend: 15000, loans: [{ id: 'l', bal: 1000000, rate: 5, pay }], assets: 100000 };
    /* by hand: 12 months of the loan at 5 % */
    let bal = 1000000, cash = 100000; for (let i = 0; i < 12; i++) { const r = bal * 0.05 / 12; bal = bal + r - pay; cash += 40000 - 10000 - 15000 - pay; }
    const a = WhatIf.project(base, [], 12), e = a.rows[11];
    const rate = WhatIf.project(base, [{ type: 'rate', from: '2026-12', delta: 1 }], 12).rows[11];
    const cashBuy = WhatIf.project(base, [{ type: 'buy', from: '2027-02', amount: 50000 }], 12).rows[11];
    const loanBuy = WhatIf.project(base, [{ type: 'buy', from: '2027-02', amount: 50000, loan: true, rate: 6, years: 5 }], 12).rows[11];
    const half = WhatIf.project(base, [{ type: 'income', from: '2026-12', pct: 50 }], 12);
    const extra = WhatIf.project(base, [{ type: 'extra', from: '2026-12', amount: 2000 }], 12).rows[11];
    const cost = WhatIf.project(base, [{ type: 'cost', from: '2026-12', until: '2027-02', amount: 1000 }], 12).rows[11];
    const paid = WhatIf.project({ start: '2026-11', income: 30000, fixed: 0, spend: 0, loans: [{ id: 's', bal: 10000, rate: 0, pay: 2500 }], assets: 0 }, [], 6).rows;
    const homeB = Object.assign({}, base, { home: 2000000 });
    const hm = WhatIf.project(homeB, [], 12).rows[11];
    const cust = WhatIf.project(base, [{ type: 'custom', label: 'Sell the car', from: '2027-01', once: 80000, monthly: -1500, until: '2027-06' }], 12).rows[11];
    out0 = { hm, cust };
    return { e, bal: Math.round(bal), cash: Math.round(cash), rate, cashBuy, loanBuy, low: half.low, extra, cost, paid: paid.map(r => r.debt), paidCash: paid[5].assets, first: a.rows[0].m, out0 };
  });
  check(m.first === '2026-12' && Math.abs(m.e.debt - m.bal) <= 1 && Math.abs(m.e.assets - m.cash) <= 1, 'today’s line: the loan and the savings month by month as worked out by hand ' + JSON.stringify([m.e, m.bal, m.cash]));
  check(m.rate.assets < m.e.assets && Math.abs(m.rate.debt - m.e.debt) < 20000, 'a higher rate: higher payments, the loan still ends on time');
  check(m.e.assets - m.cashBuy.assets === 50000 && m.cashBuy.debt === m.e.debt, 'a purchase in cash comes out of savings');
  check(m.loanBuy.debt > m.e.debt && m.loanBuy.debt < m.e.debt + 50000, 'a purchase on a new loan adds a loan that is paid down');
  check(m.low === '2027-06', 'half the pay: the warning says when savings drop under one month’s costs (' + m.low + ')');
  check(m.extra.debt < m.e.debt - 22000 && m.extra.net > m.e.net, 'extra on the loan: less debt, and a little more net worth (less interest)');
  check(m.e.assets - m.cost.assets === 3000, 'a monthly cost with an end date counts only those months');
  check(m.out0.hm.net - m.e.net === 2000000 && m.out0.hm.assets === m.e.assets, 'your part of the home counts in net worth, not as money to spend');
  check(m.out0.cust.assets - m.e.assets === 80000 - 1500 * 6, 'your own change: once +80 000 and −1 500 a month for six months');
  check(JSON.stringify(m.paid) === JSON.stringify([7500, 5000, 2500, 0, 0, 0]) && m.paidCash === 30000 * 6 - 10000, 'a loan that is paid off stops costing money');

  /* the card */
  await p.evaluate(() => {
    const d = Vault.get(); d.budget = d.budget || {}; d.budget.income = [{ id: 'i1', name: 'Salary', amount: 41000, day: 25 }];
    d.budget.fixed = [{ id: 'f1', name: 'Rent', amount: 9000, day: 1 }];
    d.accounts = [{ id: 'a1', kind: 'asset', name: 'Savings', balance: 60000 }, { id: 'a2', kind: 'debt', name: 'Car loan', balance: 200000, rate: 6, pay: 4000, day: 20 }];
    Vault.save(d); const t = Features.tools(); delete t.whatif; Features.saveTools(t);
  });
  await sl(1500);   /* the vault is saved (encrypted) before the page changes – slower on GitHub */
  await go(p, 'finance/', 2500);
  await until(p, () => { const t = document.querySelector('[data-ftab-go="insights"]'); if (t) t.click(); return !!document.querySelector('#wiCard .wi-sum'); }, 15000);
  await p.evaluate(() => { const t = document.querySelector('[data-ftab-go="insights"]'); if (t) t.click(); });
  await sl(500);
  const c1 = await p.evaluate(() => { const c = document.getElementById('wiCard'); return { shown: c && !c.hidden && c.offsetHeight > 0, sum: c && c.querySelector('.wi-sum') && c.querySelector('.wi-sum').textContent, svg: !!(c && c.querySelector('svg.wi-chart path.wi-base')), types: c ? c.querySelectorAll('[data-witype]').length : 0 }; });
  check(c1.shown && /net worth/.test(c1.sum || '') && c1.svg && c1.types === 7, 'the card shows today’s line, a chart and seven kinds of change (six + your own) ' + JSON.stringify(c1));
  /* add: a car for 250 000 in cash */
  await p.evaluate(() => document.querySelector('[data-witype="buy"]').click()); await sl(200);
  const out = await p.evaluate(() => { const f = document.querySelector('[data-wiform="buy"]'), fr = f.getBoundingClientRect(); return [...f.querySelectorAll('input, select')].filter(i => i.offsetWidth && i.getBoundingClientRect().right > fr.right + 0.5).map(i => i.name); });
  check(!out.length, 'every field stays inside the form on the phone (iPhone said 26 px out, 20 Nov) ' + out.join(', '));
  await p.evaluate(() => { const f = document.querySelector('[data-wiform="buy"]'); f.elements.amount.value = '250 000'; f.requestSubmit(); }); await sl(300);
  const c2 = await p.evaluate(() => { const c = document.getElementById('wiCard'); return { n: c.querySelectorAll('.wi-list li').length, plan: !!c.querySelector('path.wi-plan'), diff: (c.querySelector('.wi-sum .stt') || {}).textContent, warn: !!c.querySelector('.wi-warn'), saved: (Features.tools().whatif || [])[0], wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  check(c2.n === 1 && c2.plan && /−\s?250/.test(c2.diff || ''), 'a purchase shows as a second line, 250 000 kr less at the end ' + JSON.stringify(c2.diff));
  check(c2.warn, 'buying it in cash empties the savings – the warning shows');
  check(c2.saved && c2.saved.changes.length === 1 && c2.saved.changes[0].amount === 250000, 'kept in dash.tools.whatif');
  check(c2.wide <= 1, 'fits the phone (' + c2.wide + ' px too wide)');
  /* the home counts, and the starting numbers can be set by hand */
  await p.evaluate(() => { const d = Vault.get(); d.accounts.find(a => a.id === 'a2').home = { value: 400000, own: 50 }; Vault.save(d); window.dispatchEvent(new Event('fin:change')); }); await sl(400);
  check(await p.evaluate(() => /your part of the home 200/.test(document.querySelector('#wiCard .wi-sum').textContent.replace(/\s/g, ' '))), 'the summary shows your part of the home');
  await p.evaluate(() => document.querySelector('[data-wiedit]').click()); await sl(200);
  await p.evaluate(() => { const f = document.querySelector('[data-wistart]'); f.elements.spend.value = '12 000'; f.requestSubmit(); }); await sl(300);
  const st = await p.evaluate(() => ({ base: Features.tools().whatif[0].base, tag: !!document.querySelector('.wi-nums .stt') }));
  check(st.base && st.base.spend === 12000 && !('income' in st.base) && st.tag, 'everyday spending set by hand is kept and marked as yours ' + JSON.stringify(st.base));
  await p.evaluate(() => document.querySelector('[data-witype="custom"]').click()); await sl(200);
  await p.evaluate(() => { const f = document.querySelector('[data-wiform="custom"]'); f.elements.label.value = 'Sell the car'; f.elements.once.value = '+80 000'; f.requestSubmit(); }); await sl(300);
  check(await p.evaluate(() => [...document.querySelectorAll('#wiCard .wi-list b')].some(b => b.textContent === 'Sell the car')), 'your own change shows with its own name');
  await p.evaluate(() => { const l = [...document.querySelectorAll('#wiCard .wi-list li')].find(li => /Sell the car/.test(li.textContent)); l.querySelector('[data-widel]').click(); }); await sl(200);
  /* remove it again, with Undo */
  await p.evaluate(() => document.querySelector('[data-widel]').click()); await sl(200);
  check(await p.evaluate(() => !document.querySelector('#wiCard .wi-list') && (Features.tools().whatif[0].changes.length === 0)), 'removing it takes the line away');
  /* Norwegian */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  await go(p, 'finance/', 2500);
  await p.evaluate(() => { const t = document.querySelector('[data-ftab-go="insights"]'); if (t) t.click(); }); await sl(400);
  const nbt = await p.evaluate(() => document.getElementById('wiCard').innerText);
  check(/Hva om\?/.test(nbt) && /nettoformue/.test(nbt) && !/What if|net worth/.test(nbt), 'in Norwegian');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
