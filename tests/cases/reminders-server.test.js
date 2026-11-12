/* Reminders sent by the server, sealed on the device (F-R): a device seals each reminder's text with its own key
   (cmd/push-key.js), the Worker keeps only the time, an id, the page and the ciphertext, and the same device can open
   it again. A device that still sends plain titles gets them dropped by the Worker. Made-up reminders only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const KV = 'http://localhost:' + (process.env.PORT || 8770) + '/__kvget?k=';
(async () => {
  const { b, p } = await open(393);
  await sl(500);
  const r = await p.evaluate(async () => {
    const at = Date.now() + 3600e3, sub = { endpoint: 'https://push.example.invalid/sub/made-up', keys: { p256dh: 'BMadeUpKeyForTestsOnly0000000000000000000000', auth: 'madeupauth00000' } };
    const items = [{ id: 'rem:test:1', at, title: 'Dentist (made up)', body: 'At 10:00', url: '/cmd/calendar/' }];
    const sealed = await PushKey.sealItems(items);
    const put = await fetch('/cmd/api/push', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'testdevA', sub, items: sealed }) }).then(x => x.json());
    const back = await PushKey.open(sealed[0].c);
    const again = await PushKey.sealItems(items);                 /* the same key every time, a new random start each time */
    const plain = await fetch('/cmd/api/push', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'testdevB', sub, items: [{ id: 'rem:test:2', at, title: 'Secret plan (made up)', body: 'x', url: '/cmd/' }] }) }).then(x => x.json());
    const broken = await PushKey.open('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    return { sealed, put, back, sameKey: (await PushKey.open(again[0].c) || {}).t, differs: again[0].c !== sealed[0].c, plain, broken, fb: PushKey.fallback() };
  });
  check(r.sealed[0].c && !('title' in r.sealed[0]) && !('body' in r.sealed[0]), 'the device seals the text: only id, time, page and ciphertext are sent');
  check(r.put.ok && r.put.items === 1, 'the Worker takes the sealed list');
  const stA = await (await fetch(KV + 'push:dev:testdevA')).text();
  check(stA.indexOf('Dentist') < 0 && stA.indexOf('"c":"') > -1 && stA.indexOf('"title"') < 0, 'the Worker keeps no readable text, only the ciphertext');
  check(r.back && r.back.t === 'Dentist (made up)' && r.back.b === 'At 10:00', 'the same device opens it again (what its service worker does when the push comes)');
  check(r.sameKey === 'Dentist (made up)' && r.differs, 'one key per device, a fresh random start for every seal');
  const stB = await (await fetch(KV + 'push:dev:testdevB')).text();
  check(r.plain.ok && stB.indexOf('Secret plan') < 0, 'plain titles from an old device are dropped by the Worker');
  check(r.broken === null && r.fb.t === 'Reminder', 'text that can\'t be opened shows a plain "Reminder" instead');
  const sw = require('fs').readFileSync(require('path').join(__dirname, '../../cmd/sw.js'), 'utf8'), hsw = require('fs').readFileSync(require('path').join(__dirname, '../../cmd/home/sw.js'), 'utf8');
  check(/importScripts\('\/cmd\/push-key\.js'\)/.test(sw) && /importScripts\('\/cmd\/push-key\.js'\)/.test(hsw) && /PushKey\.text\(d,/.test(sw) && /PushKey\.text\(d,/.test(hsw), 'both apps\' service workers open the sealed text');
  await done(b);
})();
