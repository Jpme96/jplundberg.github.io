/* The offline queue (Phase D): a write that can't reach the server because the network is away waits in the queue
   and goes up by itself when you're back – a nudge from Iago's app, made offline, reaches the server; an answer from
   the server (even an error) is never queued. Made-up data only. */
const { shared, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await q.setOfflineMode(true);
  const r = await q.evaluate(() => ShareCore.send('push', { method: 'POST', body: { notify: { title: 'Test', body: 'Made-up nudge', id: 'oq1', at: Date.now() + 7200e3 } } }, 'push:oq1'));
  check(r && r.queued === true, 'offline: the nudge waits in the queue ' + JSON.stringify(r));
  await q.evaluate(() => ShareCore.send('push', { method: 'POST', body: { notify: { title: 'Test', body: 'Made-up nudge 2', id: 'oq1', at: Date.now() + 7200e3 } } }, 'push:oq1'));
  check(await q.evaluate(() => ShareCore.queued()) === 1, 'a later write with the same key replaces the waiting one');
  await q.setOfflineMode(false);
  await q.evaluate(() => window.dispatchEvent(new Event('online')));
  check(await until(q, () => ShareCore.queued() === 0, 15000) !== null, 'back online: it goes up by itself and the queue is empty');
  const err = await p.evaluate(() => ShareCore.send('nope-not-an-api', { method: 'POST', body: {} }).then(x => 'ok ' + JSON.stringify(x), e => 'error ' + (e && e.status)));
  check(/^error \d+/.test(err) && await p.evaluate(() => ShareCore.queued()) === 0, 'an answer from the server isn’t queued (' + err + ')');
  check(!p.errs.length && !q.errs.filter(e => !/Failed to fetch|ERR_INTERNET/.test(e)).length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
