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
    /* step 2 (step 7 of the plan): the old off switches are cleared */
    const d3 = { dv: 1, share: { on: true, direct: { shop: false, cal: false } } }, mem3 = { 'dash.settings': { softNav: false, theme: 'dark' } };
    const r3 = Upgrades.run(d3, { get: k => mem3[k] ? JSON.parse(JSON.stringify(mem3[k])) : null, set: (k, v) => { mem3[k] = v; } });
    /* step 3 (F0): the removed avatar settings and choices go from your look and your people's looks */
    const d4 = { dv: 2 }, mem4 = { 'dash.settings': { avatar: { hair: 'mullet', pierce: 'nose', neck: 'tie', topC: '#d93a3a', hat: 'beret' } }, 'dash.tools': { people: [{ id: 'p1', name: 'Made Up', look: { hair: 'bun', badge: 'trophy', glasses: 'stars' } }] } };
    const r4 = Upgrades.run(d4, { get: k => mem4[k] ? JSON.parse(JSON.stringify(mem4[k])) : null, set: (k, v) => { mem4[k] = v; } });
    const f0 = { r4, a: mem4['dash.settings'].avatar, pl: mem4['dash.tools'].people[0].look };
    return { f0, r1, a, r2, d2: d2.dv, empty: empty.dv, s7: { r3, direct: 'direct' in d3.share, on: d3.share.on, soft: 'softNav' in mem3['dash.settings'], theme: mem3['dash.settings'].theme } };
  });
  check(pure.s7.r3.indexOf(2) > -1 && !pure.s7.direct && pure.s7.on === true && !pure.s7.soft && pure.s7.theme === 'dark', 'step 2 clears the old off switches and keeps the rest ' + JSON.stringify(pure.s7));
  check(pure.r1.indexOf(1) > -1 && pure.a.hat === 'cap' && pure.a.oldCap === 1 && pure.a.extra === 'none' && pure.a.hair === 'short', 'step 1 turns the old cap into the hat, keeping the rest ' + JSON.stringify(pure.a));
  check(pure.r2.length === 0, 'it runs only once');
  check(pure.f0.r4.indexOf(3) > -1 && pure.f0.a.hair === 'side' && pure.f0.a.hat === 'beanie' && !('pierce' in pure.f0.a) && !('neck' in pure.f0.a) && pure.f0.a.topC === '#d93a3a', 'step 3 (F0) trims your saved look ' + JSON.stringify(pure.f0.a));
  check(pure.f0.pl.hair === 'topknot' && pure.f0.pl.glasses === 'sun' && !('badge' in pure.f0.pl), 'and your people\'s looks ' + JSON.stringify(pure.f0.pl));
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
