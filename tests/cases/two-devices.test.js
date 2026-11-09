/* Mac + phone at the same time: a change on one device is never undone by the other, even when the other
   keeps saving things of its own. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const A = await open(440); await sl(1000); const B = await open(1200); await sl(3000);
  const k = 'home:weatherCard';
  await B.p.evaluate(() => { let n = 0; window.__iv = setInterval(() => { const t = Features.tools(); t.macTick = ++n; Features.saveTools(t); }, 400); });
  let lost = 0;
  for (let r = 0; r < 6; r++) {
    const want = r % 2;
    await A.p.evaluate((k, v) => { const t = Features.tools(); t.fold = t.fold || {}; t.fold[k] = v; Features.saveTools(t); }, k, want);
    await sl(2500);
    if (await A.p.evaluate(k => (Features.tools().fold || {})[k], k) !== want) lost++;
  }
  check(lost === 0, 'phone kept every change while the Mac saved every 0.4 s (lost ' + lost + ' of 6)');
  await B.p.evaluate(() => clearInterval(window.__iv)); await sl(3000);
  check(await B.p.evaluate(k => (Features.tools().fold || {})[k], k) === 1, 'the Mac ends up with the phone’s last change');
  check(!A.p.errs.length && !B.p.errs.length, 'no errors ' + JSON.stringify([A.p.errs, B.p.errs]).slice(0, 300));
  await done(A.b, B.b);
})();
