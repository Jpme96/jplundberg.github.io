/* After a new shared key, messages sent with the earlier key stay readable – in cmd and in Iago's app. */
const { shared, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  /* a message encrypted with an older key, as if sent before the key changed */
  const old = await p.evaluate(async () => {
    const k = ShareCore.genKey(), e = await ShareCore.encrypt(k, { text: 'From before the new key', files: [] });
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x => x.toString(16).padStart(2, '0')).join('');
    await fetch('/cmd/api/chat', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msgs: { [id]: { t: Date.now() - 6e4, iv: e.iv, ct: e.ct, fl: [] } } }) });
    const d = Vault.get(); d.keyHist = [k].concat(d.keyHist || []); Vault.save(d); return k;
  });
  await sl(800); await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  await p.click('.hc-bub'); await sl(1500);
  check(await until(p, () => /From before the new key/.test((document.querySelector('.hc-list') || {}).innerText || ''), 10000) !== null, 'cmd reads the message sent with the earlier key');
  await q.reload(); await sl(4000); await q.evaluate(() => document.querySelectorAll('.h-sheetbg').forEach(x => x.remove()));
  await q.click('.hc-bub'); await sl(1500);
  check(await until(q, () => /From before the new key/.test((document.querySelector('.hc-list') || {}).innerText || ''), 10000) !== null, 'Iago’s app reads it too (the earlier key came through the shared box)');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
