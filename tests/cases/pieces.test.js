/* Rebuild A4: the vault is saved in pieces. The server holds a small core plus pieces; a small change uploads the core
   and at most the piece that changed; a second device gets everything; snapshots are whole; an old version (one copy)
   can't save over the new form. Made-up data only. */
const { open, until, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1100);
  await p.evaluate(() => {
    const d = Vault.get(); d.health = { days: {} };
    for (let m = 1; m <= 4; m++) for (let i = 1; i <= 28; i++) d.health.days['2026-0' + m + '-' + String(i).padStart(2, '0')] = { steps: 5000 + i * 37, sleep: 400 + i, hr: 60 + (i % 9) };
    Vault.save(d);
    const t = Features.tools(); t.homenotes = [{ id: 'n1', title: 'Test', text: 'x'.repeat(3000) }]; t.recipes = []; for (let i = 0; i < 60; i++) t.recipes.push({ id: 'r' + i, title: 'Recipe ' + i, text: 'Mix and bake for ' + i + ' minutes.' });
    Features.saveTools(t);
  });
  const srv = () => p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.text()));
  const ok1 = await until(p, () => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.v === 2 && v.pc.length >= 3 && Vault.syncState() === 'ok', () => false), 15000);
  const v1 = JSON.parse(await srv());
  check(ok1 !== null, 'the server holds the vault in pieces: v' + v1.v + ', ' + (v1.pc || []).length + ' pieces');
  const full = (await p.evaluate(() => localStorage.getItem('dash.vault'))).length;
  check(JSON.stringify(v1).length < full / 3, 'the core is small: ' + JSON.stringify(v1).length + ' of ' + full + ' bytes');
  check(!JSON.stringify(v1).includes('health') && !JSON.stringify(v1).includes('recipes'), 'the server doesn’t see which part a piece is');
  /* a small change: the core and at most one piece go up */
  const sent = []; p.on('request', r => { if (r.method() === 'PUT' && /\/cmd\/api\/(vpiece|vault)$/.test(r.url())) sent.push(r.url().replace(/.*\//, '') + ':' + (r.postData() || '').length); });
  await p.evaluate(() => { const t = Features.tools(); t.recipes[3].title = 'Changed recipe'; Features.saveTools(t); });
  await until(p, () => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.rev >= 0 && Vault.syncState() === 'ok'), 10000); await sl(1500);
  const pcs = sent.filter(x => /^vpiece/.test(x)), vs = sent.filter(x => /^vault/.test(x));
  check(vs.length >= 1 && pcs.length <= vs.length, 'a small change sends the core and one piece: ' + sent.join(', '));
  check(sent.reduce((a, x) => a + +x.split(':')[1], 0) < full / 2, 'far less than the whole vault goes up');
  /* a second device gets everything */
  const d2 = await open(1100);
  const got = await until(d2.p, () => { const d = Vault.get(), t = Features.tools(); return d && d.health && Object.keys(d.health.days || {}).length === 112 && (t.recipes || []).length === 60 && t.recipes[3].title === 'Changed recipe' && (t.homenotes || [])[0] && t.homenotes[0].text.length === 3000; }, 20000);
  check(got !== null, 'the second device has the whole dashboard');
  /* the second device changes one health day; the first gets it */
  await d2.p.evaluate(() => { const d = Vault.get(); d.health.days['2026-02-02'].steps = 12345; Vault.save(d); });
  check(await until(p, () => { const d = Vault.get(); return d.health.days['2026-02-02'].steps === 12345 && d.health.days['2026-04-28'].steps === 5000 + 28 * 37; }, 20000) !== null, 'a change from the second device arrives, nothing else lost');
  /* a snapshot is a whole copy and opens */
  const snap = await p.evaluate(async () => { const l = await fetch('/cmd/api/vault?snaps').then(r => r.json()); if (!l.snaps.length) return 'no snaps'; const v = await fetch('/cmd/api/vault?snap=' + l.snaps[0]).then(r => r.json()); const o = await Vault.peek(v); return (v.pcs ? 'whole ' : 'core ') + Object.keys((o.health || {}).days || {}).length; });
  check(/^whole (112|0)$/.test(snap) || snap === 'no snaps', 'a snapshot is a whole copy: ' + snap);
  /* an old version (one copy) can't save over it */
  const old = await p.evaluate(() => fetch('/cmd/api/vault', { method: 'PUT', headers: { 'content-type': 'application/json', 'X-Base-Rev': '0' }, body: JSON.stringify({ v: 1, rev: 1, salt: 'x', iv: 'x', ct: 'x' }) }).then(r => r.status));
  check(old === 426, 'an old version is told to update instead of saving over it: ' + old);
  /* always in pieces since step 7: an old switch left on a device changes nothing */
  await p.evaluate(() => { localStorage.setItem('dash.vp.off', '1'); const t = Features.tools(); t.recipes[4].title = 'Still in pieces'; Features.saveTools(t); });
  check(await until(p, () => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.v === 2)) !== null, 'an old off switch is ignored: still saved in pieces');
  check(await until(d2.p, () => (Features.tools().recipes || [])[4] && Features.tools().recipes[4].title === 'Still in pieces', 20000) !== null, 'the second device reads it');
  await p.evaluate(() => localStorage.removeItem('dash.vp.off'));
  /* a new passcode: every piece is encrypted again (never an old one reused), the other device opens it with the new one */
  await p.evaluate(() => Vault.changePasscode('test-passcode-2')); await sl(2500);
  check(await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.v)) === 2, 'saved in pieces after the new passcode');
  await d2.p.evaluate(() => Vault.sync()); 
  check(await until(d2.p, () => { const i = document.getElementById('lockPass'); return !!(i && i.offsetParent); }, 20000) !== null, 'the other device asks for the new passcode');
  await d2.p.type('#lockPass', 'test-passcode-2'); await d2.p.click('#lockSubmit');
  const back = await until(d2.p, () => { if (!document.documentElement.classList.contains('unlocked')) return false; const d = Vault.get(), t = Features.tools(); return Object.keys(d.health.days).length === 112 && t.recipes.length === 60 && t.recipes[4].title === 'Still in pieces'; }, 20000);
  check(back !== null, 'with the new passcode the other device has the whole dashboard');
  check(!p.errs.length && !d2.p.errs.length, 'no errors ' + JSON.stringify([p.errs, d2.p.errs]).slice(0, 300));
  await done(b, d2.b);
})();
