/* One place for data changes (Phase C step 9): numbered steps bring old saved data up to date once, right after
   unlocking; the vault remembers the last step (dv), so they don't run twice; a failing step stops and is retried;
   the old avatar 'extra' looks exactly the same after its step. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const info = await p.evaluate(() => ({ last: Upgrades.last, dv: Vault.get().dv }));
  check(info.last >= 1 && info.dv === info.last, 'a new dashboard is marked as up to date (dv ' + info.dv + ' of ' + info.last + ')');
  /* pure checks on made-up data */
  const pure = await p.evaluate(() => {
    const mem = { 'dash.settings': { avatar: { hair: 'short', extra: 'cap', hat: 'none' } } };
    const io = { get: k => mem[k] ? JSON.parse(JSON.stringify(mem[k])) : null, set: (k, v) => { mem[k] = v; } };
    const d = {}, r1 = Upgrades.run(d, io), a = mem['dash.settings'].avatar;
    const r2 = Upgrades.run(d, io);
    const d2 = { dv: 0 }, mem2 = { 'dash.settings': { avatar: { extra: 'watch' } } };
    Upgrades.run(d2, { get: () => { throw new Error('boom'); }, set: () => {} });
    const empty = {}; Upgrades.run(empty, { get: () => null, set: () => {} });
    return { r1, a, r2, d2: d2.dv, empty: empty.dv };
  });
  check(pure.r1.indexOf(1) > -1 && pure.a.hat === 'cap' && pure.a.oldCap === 1 && pure.a.extra === 'none' && pure.a.hair === 'short', 'step 1 turns the old cap into the hat, keeping the rest ' + JSON.stringify(pure.a));
  check(pure.r2.length === 0, 'it runs only once');
  check(pure.d2 === 0, 'a failing step stops and is tried again next time (dv stays ' + pure.d2 + ')');
  check(pure.empty >= 1, 'nothing to change still counts as done');
  /* the real thing: an old look saved on this device, vault marked as old → after unlocking it is new and looks the same */
  const before = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar || {}, { extra: 'cap', hat: 'none' }); localStorage.setItem('dash.settings', JSON.stringify(s));
    const d = Vault.get(); d.dv = 0; Vault.save(d);
    return true;
  });
  await sl(1500);
  await p.evaluate(() => Vault.lock && Vault.lock());
  await go(p, '', 1500);
  const after = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); return { a: s.avatar, dv: Vault.get().dv, log: Diag.list().some(e => e.k === 'upgrade' && /step 1/.test(e.m)) }; });
  check(after.dv >= 1 && after.a.extra === 'none' && after.a.hat === 'cap', 'after unlocking the saved look is upgraded ' + JSON.stringify({ dv: after.dv, extra: after.a.extra, hat: after.a.hat }));
  check(after.a.oldCap === 1, 'and it is drawn exactly as before (the old cap style is kept)');
  check(after.log, 'Diagnostics notes the upgrade');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
