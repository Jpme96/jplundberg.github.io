/* The day's self-check is kept – a problem it found must go away once it's fixed: "Nothing from Apple Health for 41 hours"
   stayed in "needs you" after the morning's numbers had come in (JP 2026-11-21). New Health numbers run the check again.
   Made-up data only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  const today = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const r1 = await p.evaluate(async (today) => { Features.set('ahealth', true); const d = Vault.get(); d.health = { days: { [today]: { steps: 1000 } }, last: Date.now() - 41 * 36e5 }; Vault.save(d);
    const r = await Diag.selfCheck(true); return (r.issues || []).map(i => i.id); }, today);
  check(r1.indexOf('health') > -1, 'an import 41 hours ago is a problem ' + JSON.stringify(r1));
  await p.evaluate(today => { const d = Vault.get(); d.health.days[today].steps = 4321; d.health.last = Date.now(); Vault.save(d); window.dispatchEvent(new Event('health:change')); }, today);
  await sl(3500);
  const r2 = await p.evaluate(() => (Diag.state().check.issues || []).map(i => i.id));
  check(r2.indexOf('health') < 0, 'new Health numbers run the check again and the problem is gone ' + JSON.stringify(r2));
  await b.close(); done();
})();
