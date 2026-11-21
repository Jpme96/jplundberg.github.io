/* 2026-11-21 (JP): the Goals savings pennant follows the savings accounts' real balances (not the starting number
   typed into What if); the Subscriptions card points to repeating payments found in the bank; the Apple Health
   card loads only on Habits (ahealth.page.js) while the rest of Apple Health still works everywhere. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const dk = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  await p.evaluate((a, b2, c) => {
    ['goals', 'subs', 'recur', 'finance'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools(); t.whatif = [{ id: 'main', name: 'Test plan', changes: [], years: 5, target: 100000, base: { assets: 10000 } }]; t.subs = []; Features.saveTools(t);
    const d = Vault.get(); d.budget = d.budget || {};
    d.budget.acctList = (d.budget.acctList || []).filter(x => x.id !== 'tsav').concat([{ id: 'tsav', kind: 'savings', name: 'Made-up Savings', bal: 60000 }]);
    d.expenses = (d.expenses || []).concat([a, b2, c].map((dt, i) => ({ id: 'ns' + i, date: dt, amount: 129, cat: 'fun', note: 'Made-up Stream AS', src: 'bank' })));
    Vault.save(d);
  }, dk(64), dk(34), dk(4));
  await sl(800);

  /* the pennant: 60 000 in savings of 100 000 = 60 %, not the 10 % the typed starting number gives */
  await go(p, 'goals/', 3000);
  const GF = () => { const l = (document.body.innerText.match(/Savings goal[^\n]*/) || [])[0], m = l && l.match(/(\d+)\s*%\s*$/); return m ? +m[1] : null; };
  await until(p, GF, 10000); const g = await p.evaluate(GF);
  check(g === 60, 'the savings goal follows the savings account: ' + g + ' %');

  /* subscriptions: one line for the repeating payment the bank shows */
  await go(p, 'finance/', 3000);
  const SF = () => { const a = document.querySelector('.sub-found'); return a ? { t: a.textContent, h: a.getAttribute('href') } : null; };
  await until(p, SF, 10000); const sf = await p.evaluate(SF);
  check(sf && /1 repeating payment/.test(sf.t) && /129/.test(sf.t) && /#recur$/.test(sf.h), 'the Subscriptions card points to what the bank found ' + JSON.stringify(sf));

  /* Apple Health: the card's code only on Habits; the data part everywhere */
  const fin = await p.evaluate(() => ({ api: !!(window.AHealth && AHealth.days), card: typeof window.__ahCard, src: [...document.scripts].some(s => /ahealth\.page\.js/.test(s.src)) }));
  check(fin.api && fin.card === 'undefined' && !fin.src, 'Finances: Apple Health data works, the card code is not loaded ' + JSON.stringify(fin));
  await p.evaluate(() => { Features.set('ahealth', true); const d = Vault.get(); d.health = { days: { [new Date().toISOString().slice(0, 10)]: { steps: 4321 } } }; Vault.save(d); });
  await go(p, 'habits/', 3000);
  const hb = await until(p, () => { const c = document.getElementById('ahCard'); return c && /4\D?321/.test(c.textContent) ? true : null; }, 10000);
  const hf = await p.evaluate(() => ({ f: typeof window.__ahCard, card: !!document.getElementById('ahCard'), t: ((document.getElementById('ahCard') || {}).textContent || '').slice(0, 80) }));
  check(hb !== null && hf.f === 'function', 'Habits: the Apple Health card is drawn from its own file ' + JSON.stringify(hf));

  await b.close(); done();
})();
