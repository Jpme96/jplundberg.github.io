/* Pushes to the other one are sealed with the shared key (2026-11-12): a nudge for later, "N added milk" and a chat line
   leave the device with their title and text sealed (push-key.js keepShared/sealShared, ShareCore.send seals before
   anything is sent or queued); the Worker keeps and forwards only the ciphertext; the other one's phone opens it with the
   key both of you have. Plain text sent by an old device is dropped. Made-up data only. */
const { shared, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const KV = 'http://localhost:' + (process.env.PORT || 8770) + '/__kvget?k=';
(async () => {
  const { b, p, b2, q } = await shared();
  /* both devices keep the push key made from the shared key */
  const has = d => d.evaluate(() => PushKey.sealShared({ t: 'x', b: 'y' }).then(() => true, () => false));
  check(await until(p, () => true, 100) !== null && await (async () => { for (let i = 0; i < 40; i++) { if (await has(p) && await has(q)) return true; await sl(300); } return false; })(), 'both devices keep a push key made from the shared key');
  /* a nudge for later, from the owner's dashboard */
  const sealed = await p.evaluate(() => ShareCore.sealPush({ method: 'POST', body: { notify: { title: 'Made-up name', body: 'Take out the made-up bins', id: 'nseal1', at: Date.now() + 3600e3 } } }));
  const n = sealed.body.notify;
  check(n.c && !('title' in n) && !('body' in n) && n.id === 'nseal1', 'the title and text are sealed before they leave the device');
  const opened = await q.evaluate(c => PushKey.openShared(c), n.c);
  check(opened && opened.t === 'Made-up name' && opened.b === 'Take out the made-up bins', 'the other one\'s phone opens it with the shared key');
  const r = await p.evaluate(() => ShareCore.send('push', { method: 'POST', body: { notify: { title: 'Made-up name', body: 'Water the made-up plants', id: 'nseal2', at: Date.now() + 3600e3 } } }));
  check(r && r.ok, 'the Worker takes the sealed nudge ' + JSON.stringify(r));
  const st = await (await fetch(KV + 'push:nudge:o:nseal2')).text();
  check(st.indexOf('plants') < 0 && st.indexOf('Made-up name') < 0 && /"c":"[A-Za-z0-9+/=]{24,}"/.test(st), 'the Worker keeps no readable text, only the ciphertext');
  /* an old device sending plain text: dropped */
  await p.evaluate(() => ShareCore.api('push', { method: 'POST', body: { notify: { title: 'Old', body: 'Plain made-up secret', id: 'nseal3', at: Date.now() + 3600e3 } } }));
  const st3 = await (await fetch(KV + 'push:nudge:o:nseal3')).text();
  check(st3.indexOf('secret') < 0 && st3.indexOf('Old') < 0, 'plain text from an old device is dropped by the Worker');
  /* what the service worker shows */
  const shown = await q.evaluate(c => Promise.all([PushKey.text({ c, s: 1 }, true), PushKey.text({ c: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', s: 1 }, true)]), n.c);
  check(shown[0].b === 'Take out the made-up bins' && /open the app/i.test(shown[1].b), 'the phone shows the text, or a plain "Something new" when it can\'t open it');
  const fs = require('fs'), path = require('path'), src = f => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');
  check(!/notify: \{ title: [^}]*\} \} \}\)\.catch/.test(src('cmd/share.js')) || /SC\.send\('push'/.test(src('cmd/share.js')), 'the shared-list push goes through ShareCore.send (sealed)');
  check(['cmd/share.js', 'cmd/chat.js', 'cmd/together.js', 'cmd/home/app.js'].every(f => !/SC\(\)?\.api\('push'[^)]*notify/.test(src(f))), 'no push to the other one bypasses the sealing');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
