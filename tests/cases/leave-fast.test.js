/* A change made right before leaving the page is kept: flip switches, go to another page at once – they're still on. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  await sl(1500);
  await p.emulateCPUThrottling(6);      /* a slow phone: saving takes longer than leaving */
  for (let i = 0; i < 3; i++) {
    const want = i % 2 === 0;
    await p.evaluate(w => { Features.set('food', w); Features.set('people', !w); const t = Features.tools(); t.leaveFast = (t.leaveFast || 0) + 1; Features.saveTools(t); }, want);
    await go(p, i % 2 ? '' : 'calendar/', 1500);       /* straight away – no time to save */
    const st = await p.evaluate(() => ({ food: Features.on('food'), people: Features.on('people'), n: Features.tools().leaveFast }));
    check(st.food === want && st.people === !want && st.n === i + 1, 'round ' + (i + 1) + ': kept after leaving at once ' + JSON.stringify(st));
  }
  await sl(2500);
  check(await p.evaluate(() => !localStorage.getItem('dash.dirty')), 'and it was sealed into the vault afterwards');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
