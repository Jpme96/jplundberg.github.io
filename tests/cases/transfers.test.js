/* Money to yourself and loan/credit payments are not spending (2026-11-20 – JP's bank file had ~100 000 kr a month of
   "Other" like that): Budget.transferWhy, upgrade step 7 moves rows already imported to d.notSpent (kept), the bank
   import leaves new ones out, and Transactions can put them back. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, 'finance/', 2500);
  const w = await p.evaluate(() => [
    Budget.transferWhy('Kari Mette Nordmann', 'Kari Nordmann'), Budget.transferWhy('Overføring Kari Nordmann', 'Kari Nordmann'),
    Budget.transferWhy('Kredittbanken ASA', ''), Budget.transferWhy('REMA 1000 Grünerløkka', 'Kari Nordmann'), Budget.transferWhy('Kari Hansen', 'Kari Nordmann')]);
  check(w[0] === 'to yourself' && w[1] === 'to yourself', 'a payment to your own name is money to yourself');
  check(w[2] === 'a loan or credit payment', 'a credit bank is a loan payment');
  check(w[3] === '' && w[4] === '', 'a shop or someone with only your first name is spending');
  const st = await p.evaluate(() => {
    const d = { dv: 6, expenses: [
      { id: 'x1', date: '2026-10-02', amount: 15000, cat: 'other', note: 'Kari Nordmann', src: 'bank' },
      { id: 'x2', date: '2026-10-03', amount: 7800, cat: 'other', note: 'Kredittbanken ASA', src: 'bank' },
      { id: 'x3', date: '2026-10-04', amount: 420, cat: 'groceries', note: 'Kari Nordmann bakeri', src: 'bank' },
      { id: 'x4', date: '2026-10-05', amount: 300, cat: 'other', note: 'Kari Nordmann', src: 'quick' },
      { id: 'x5', date: '2026-10-06', amount: 99, cat: 'other', note: 'Streamio', src: 'bank' }] };
    const mem = { 'dash.profile': { name: 'Kari Nordmann' } };
    const r = Upgrades.run(d, { get: k => mem[k] ? JSON.parse(JSON.stringify(mem[k])) : null, set: () => {} });
    return { r, left: d.expenses.map(e => e.id), moved: (d.notSpent || []).map(e => e.id + ':' + e.why), dv: d.dv };
  });
  check(st.r.indexOf(7) > -1 && st.left.join() === 'x3,x4,x5' && st.moved.join() === 'x1:to yourself,x2:a loan or credit payment', 'step 7 moves only bank rows under Other to d.notSpent ' + JSON.stringify(st));
  /* the bank import leaves a payment to yourself out */
  const imp = await p.evaluate(() => {
    localStorage.setItem('dash.profile', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('dash.profile') || '{}'), { name: 'Kari Nordmann' })));
    const rows = [['Dato', 'Beskrivelse', 'Beløp'], ['01.11.2026', 'Kari Nordmann', '-5000,00'], ['02.11.2026', 'REMA 1000', '-250,00']];
    const r = BankImport.analyse(rows, {});
    return r.rows.map(x => x.desc + ':' + (x.transfer ? 'out' : 'in') + ':' + x.on);
  });
  check(imp.some(s => /^Kari Nordmann:out:false$/.test(s)) && imp.some(s => /^REMA 1000:in:true$/.test(s)), 'the bank import leaves money to yourself out ' + JSON.stringify(imp));
  /* Transactions: the line and Put them back */
  await p.evaluate(() => { const d = Vault.get(); d.notSpent = [{ id: 'n1', date: '2026-10-02', amount: 15000, cat: 'other', note: 'Kari Nordmann', src: 'bank', why: 'to yourself' }]; Vault.save(d); window.dispatchEvent(new Event('fin:change')); });
  await sl(300);
  await p.evaluate(() => { const t = document.querySelector('[data-ftab-go="tx"]'); if (t) t.click(); }); await sl(300);
  const ln = await p.evaluate(() => { const e = document.getElementById('nsLine'); return e && !e.hidden ? e.textContent : ''; });
  check(/1 bank rows/.test(ln) && /15/.test(ln), 'Transactions says what is left out ' + ln);
  await p.evaluate(() => document.querySelector('[data-nsback]').click()); await sl(300);
  const back = await p.evaluate(() => { const d = Vault.get(); return { ns: (d.notSpent || []).length, ex: (d.expenses || []).some(e => e.id === 'n1' && !e.why), hidden: document.getElementById('nsLine').hidden }; });
  check(back.ns === 0 && back.ex && back.hidden, 'Put them back moves them back into spending');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
