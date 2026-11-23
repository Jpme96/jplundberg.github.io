/* A device whose own copy got damaged (23 Nov 2026: iOS closed the app for an update mid-save and most of its copy was
   gone) locks once with a note, and one unlock brings back the synced copy – even though the damaged copy kept saving and
   carries a higher version number. Never merged, never uploaded. Made-up data only. */
const { open, sl, until, unlock } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { const d = Vault.get(); d.expenses = Array.from({ length: 120 }, (_, i) => ({ id: 'hl' + i, desc: 'Made-up expense number ' + i + ' with some words to weigh', amt: -10 - i, date: '2026-11-1' + (i % 9), cat: 'other' })); d.hlNote = 'made-up '.repeat(400); Vault.save(d); });
  await sl(3000);
  const srv = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.rev));
  /* the damage: most of it gone on this device, and it keeps saving */
  await p.evaluate(() => { const d = Vault.get(); d.expenses = d.expenses.slice(0, 2); delete d.hlNote; Vault.save(d); });
  await until(p, () => document.documentElement.classList.contains('locked'), 12000);
  const st = await p.evaluate(() => ({ locked: document.documentElement.classList.contains('locked'), note: (document.getElementById('lockMsg') || {}).textContent || '', heal: !!localStorage.getItem('dash.heal'), localRev: (JSON.parse(localStorage.getItem('dash.vault')) || {}).rev }));
  check(st.locked && /incomplete/i.test(st.note), 'the device locks once with a note ' + JSON.stringify(st).slice(0, 160));
  check(st.heal && st.localRev > srv, 'the damaged copy is newer by number than the synced one (' + st.localRev + ' > ' + srv + ')');
  const srv2 = await p.evaluate(() => fetch('/cmd/api/vault', { cache: 'no-store' }).then(r => r.json()).then(v => v.rev));
  check(srv2 === srv, 'nothing was uploaded over the synced copy');
  await sl(1500);
  await unlock(p); await sl(1500);
  const back = await p.evaluate(() => ({ n: (Vault.get().expenses || []).filter(x => /^hl/.test(x.id)).length, note: !!Vault.get().hlNote, heal: !!localStorage.getItem('dash.heal') }));
  check(back.n === 120 && back.note, 'one unlock brings back the synced copy ' + JSON.stringify(back));
  check(!back.heal, 'and the device is back to normal');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
