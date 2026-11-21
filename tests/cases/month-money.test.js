/* Your month in money (JP 2026-11-21): a push on the 1st at 09:00 with last month's spending against the month before,
   the category that changed most and the savings goal; a switch in Notifications; the private setting shows no numbers.
   The backup line on At a glance now comes after 7 days, not 30. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const r = await p.evaluate(() => {
    const now = new Date(), ym = n => { const x = new Date(now.getFullYear(), now.getMonth() + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
    const d = Vault.get(); d.expenses = (d.expenses || []).filter(e => !/Made-up/.test(e.note || '')).concat([
      { id: 'm1', date: ym(0) + '-05', amount: 6000, cat: 'groceries', note: 'Made-up food' }, { id: 'm2', date: ym(0) + '-06', amount: 3000, cat: 'eating', note: 'Made-up dinners' },
      { id: 'm3', date: ym(-1) + '-05', amount: 6000, cat: 'groceries', note: 'Made-up food' }]);
    d.budget = d.budget || {}; d.budget.acctList = (d.budget.acctList || []).filter(a => a.id !== 'msav').concat([{ id: 'msav', kind: 'savings', name: 'Made-up Savings', bal: 25000 }]);
    d.lastBackup = Date.now() - 9 * 864e5; Vault.save(d); localStorage.setItem('dash.lastBackup', String(d.lastBackup));
    const t = Features.tools(); t.whatif = [{ id: 'main', name: 'T', changes: [], years: 5, target: 100000 }]; Features.saveTools(t);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 2).getTime();
    const full = Notify.plan({ from: Date.now(), to: end, full: true }).filter(x => /^monthly:/.test(x.id || x.tag || '')), priv = Notify.plan({ from: Date.now(), to: end, full: false }).filter(x => /^monthly:/.test(x.id || x.tag || ''));
    return { full: full.map(x => [x.title, x.body, new Date(x.at || x.t).getDate(), new Date(x.at || x.t).getHours()]), priv: priv.map(x => x.body), sw: !!document.querySelector('[data-ntk="monthly"]') };
  });
  check(r.full.length === 1 && /Your month in money/.test(r.full[0][0]) && r.full[0][2] === 1 && r.full[0][3] === 9, 'one push on the 1st at 09:00 ' + JSON.stringify(r.full));
  const body = (r.full[0] || [])[1] || '';
  check(/9[\s ]?000/.test(body) && /50 % more than the month before/.test(body) && /Eating out \+3[\s ]?000|eating \+3[\s ]?000/.test(body) && /savings goal 25 %/.test(body), 'it says what it cost, the change, the biggest category and the goal: ' + body);
  check(r.priv.length === 1 && !/\d/.test(r.priv[0]), 'private: no numbers ' + JSON.stringify(r.priv));
  check(r.sw, 'a switch in Notifications');
  await sl(800); await go(p, '', 3000);
  const bk = await p.evaluate(() => (window.BriefItems || []).some(x => /Time for a backup/.test(x.title)));
  check(bk, 'At a glance: "Time for a backup" after 9 days');
  await b.close(); done();
})();
