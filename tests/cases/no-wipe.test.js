/* A device that lost its copy and is offline must never wipe the synced dashboard (16 Nov 2026: a phone with no
   saved copy couldn't reach the server, showed "Create a passcode", made a new empty dashboard and it replaced the
   real one). Made-up data only.
   - the Worker refuses a dashboard with another salt unless the device says it is an on-purpose replace (423)
   - the lock screen makes a new dashboard only when the server says it has none; offline it says so instead
   - back online, the same device finds the synced dashboard and opens it with the passcode */
const { open, launch, page, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const U = 'http://localhost:' + (process.env.PORT || 8770) + '/cmd/';
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => { const d = Vault.get(); d.expenses = Array.from({ length: 60 }, (_, i) => ({ id: 'nw' + i, desc: 'Test expense ' + i, amt: -10 - i, date: '2026-11-1' + (i % 9), cat: 'other' })); Vault.save(d); });
  await sl(2500);
  const before = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()));
  check(before && before.rev > 0, 'the dashboard is on the server (rev ' + (before && before.rev) + ')');

  /* the Worker: another salt without X-Replace is refused */
  const st = await p.evaluate(async cur => {
    const body = JSON.stringify({ v: 2, rev: cur.rev + 1, iter: cur.iter, salt: 'AAAAAAAAAAAAAAAAAAAAAA==', iv: cur.iv, ct: cur.ct, pc: [] });
    const r = await fetch('/cmd/api/vault', { method: 'PUT', headers: { 'content-type': 'application/json', 'X-Base-Rev': String(cur.rev) }, body });
    return r.status;
  }, before);
  check(st === 423, 'the server refuses another dashboard over the synced one (' + st + ')');

  /* a second device with nothing saved, offline when the lock screen asks */
  const b2 = await launch(), q = await page(b2, 393);
  await q.evaluateOnNewDocument(() => { window.__off = true; const f = window.fetch; window.fetch = function (u, o) { if (window.__off && /\/cmd\/api\//.test(String(u && u.url || u))) return Promise.reject(new TypeError('Load failed')); return f.apply(this, arguments); }; });
  await q.goto(U); await sl(7500);   /* the lock screen's own look for a synced dashboard times out (6 s) */
  const setup = await q.evaluate(() => { const c = document.getElementById('lockConfirm'); return !!(c && c.offsetParent); });
  if (setup) { await q.type('#lockPass', 'test-passcode-1'); await q.type('#lockConfirm', 'test-passcode-1'); }
  else await q.type('#lockPass', 'test-passcode-1');
  await q.click('#lockSubmit'); await sl(9500);
  const off = await q.evaluate(() => ({ unlocked: document.documentElement.classList.contains('unlocked'), msg: (document.getElementById('lockMsg') || {}).textContent || '' }));
  check(!off.unlocked, 'offline, no new dashboard is made (' + off.msg.slice(0, 80) + ')');
  const after1 = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()));
  check(after1.salt === before.salt, 'the synced dashboard is untouched');

  /* back online: it finds the synced one and opens it */
  await q.evaluate(() => { window.__off = false; });
  await q.click('#lockSubmit'); await sl(3000);
  const conf = await q.evaluate(() => { const c = document.getElementById('lockConfirm'); return !!(c && c.offsetParent); });
  check(!conf, 'online again, the lock screen asks for the passcode of the synced dashboard');
  await q.evaluate(() => { document.getElementById('lockPass').value = ''; });
  await q.type('#lockPass', 'test-passcode-1'); await q.click('#lockSubmit');
  await until(q, () => document.documentElement.classList.contains('unlocked'), 15000); await sl(1500);
  const n = await q.evaluate(() => (Vault.get() && Vault.get().expenses || []).filter(x => /^Test expense/.test(x.desc)).length);
  check(n === 60, 'the second device has the synced dashboard (' + n + ' of 60 expenses)');
  const after2 = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()));
  check(after2.salt === before.salt, 'the server still holds the same dashboard');
  /* a device whose copy lost most of its data doesn't upload it (the same passcode, so the server can't tell) */
  await sl(2500);
  const r0 = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.rev));
  await q.evaluate(() => { const d = Vault.get(); d.expenses = []; Vault.save(d); });
  await sl(4000);
  const r1 = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.rev));
  check(r1 === r0, 'an upload with most of the data gone is refused (server rev ' + r0 + ' → ' + r1 + ')');
  await p.reload(); await sl(3000);
  const n2 = await p.evaluate(() => ((window.Vault && Vault.get() && Vault.get().expenses) || []).length);
  check(n2 === 60, 'the first device still has everything after a reload (' + n2 + ')');
  check(!p.errs.length, 'no errors on the first device ' + p.errs.join(' | ').slice(0, 200));
  await done(b, b2);
})();
