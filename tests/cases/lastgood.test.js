/* The last good version (Phase D): a start that reaches the lock screen marks this version as good in the service
   worker; with no older good copy, "go back" does nothing (no loop, nothing broken); "state" says which is running.
   (Going back for real needs two releases on one phone – the steps are the ones checked here.) Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  const ctl = await until(p, () => !!(navigator.serviceWorker && navigator.serviceWorker.controller), 15000);
  if (ctl === null) { await p.reload(); await sl(2500); }
  check(await until(p, () => !!(navigator.serviceWorker && navigator.serviceWorker.controller), 15000) !== null, 'the service worker runs the page');
  const good = await p.evaluate(() => LastGood.ask('good'));
  check(good && /^cmd-v/.test(good.good || ''), 'reaching the lock screen marks this version as good ' + JSON.stringify(good));
  const back = await p.evaluate(() => LastGood.ask('back'));
  check(back && back.use === '', 'with no older good copy, going back does nothing ' + JSON.stringify(back));
  const st = await p.evaluate(() => LastGood.ask('state'));
  check(st && st.current === good.good && !st.use, 'the current version runs and is the good one ' + JSON.stringify(st));
  check(await p.evaluate(() => !document.getElementById('lgvBar')), 'no “previous version” bar');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
