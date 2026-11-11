/* Later features: the morning summary (07:30 the next mornings), price changes in At a glance, the home-screen
   shortcuts and putting back one single thing from a day's copy (Settings → Data & sync → Pick items).
   Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), path = require('path');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  /* the morning summary */
  const m = await p.evaluate(() => { const t = new Date(Date.now() + 864e5), k = Features.dkey(t);
    localStorage.setItem('dash.todos', JSON.stringify([{ id: 'tm1', text: 'Made-up errand', due: k }]));
    const it = Notify.plan().find(x => x.id === 'morning:' + k); return it ? { h: new Date(it.at).getHours(), mi: new Date(it.at).getMinutes(), body: it.body } : null; });
  check(m && m.h === 7 && m.mi === 30 && /task/i.test(m.body), 'tomorrow 07:30: a morning summary with the task ' + JSON.stringify(m));
  /* prices: learn, then a change shows in At a glance */
  const pr = await p.evaluate(async () => { const d = Vault.get(); d.budget = d.budget || {}; d.budget.fixed = [{ id: 'fx1', name: 'Made-up power', amount: 500, day: 20 }]; delete d.prices; delete d.priceChanges; Vault.save(d);
    Prices.check(); const learnt = !!(Vault.get().prices || {})['bill:fx1'] && !(Vault.get().priceChanges || []).length;
    const e = Vault.get(); e.budget.fixed[0].amount = 600; Vault.save(e); Prices.check();
    const ch = (Vault.get().priceChanges || [])[0]; return { learnt, ch }; });
  check(pr.learnt, 'the first time it only learns the prices');
  check(pr.ch && pr.ch.from === 500 && pr.ch.to === 600, 'a price change is noted ' + JSON.stringify(pr.ch));
  await go(p, '', 3000);
  check(await until(p, () => /Made-up power/.test(document.body.textContent) && /\+20 %/.test(document.body.textContent), 10000) !== null, 'At a glance says “Made-up power: 500 → 600 kr (+20 %)”');
  /* shortcuts */
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '../../cmd/manifest.webmanifest'), 'utf8'));
  check((man.shortcuts || []).some(s => /add=expense/.test(s.url)) && man.shortcuts.some(s => /add=event/.test(s.url)), 'home-screen shortcuts: add an expense, a new event');
  /* one thing back from a day's copy */
  await p.evaluate(() => { localStorage.setItem('dash.todos', JSON.stringify([{ id: 'tr1', text: 'Made-up keepsake' }, { id: 'tr2', text: 'Made-up other' }])); window.dispatchEvent(new Event('dash:local')); const d = Vault.get(); Vault.save(d); });
  await sl(4000);
  const snap = await p.evaluate(() => fetch('/cmd/api/vault', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.text()));
  await p.evaluate((snap) => { localStorage.setItem('dash.todos', JSON.stringify([{ id: 'tr2', text: 'Made-up other' }]));
    const f = window.fetch; window.fetch = (u, o) => /snap=/.test(String(u)) ? Promise.resolve(new Response(snap, { status: 200 })) : f(u, o);
    const bt = document.createElement('button'); bt.dataset.snappick = '2026-01-01'; document.body.appendChild(bt); bt.click(); }, snap);
  const sh = await until(p, () => { const s = document.getElementById('r1Sheet'); return s && /Made-up keepsake/.test(s.textContent) && !/Made-up other/.test(s.textContent); }, 10000);
  check(sh !== null, 'Pick items lists only what’s gone since that day');
  const back = await p.evaluate(() => { const r = document.querySelector('#r1Sheet [data-r1]'); r.click(); return JSON.parse(localStorage.getItem('dash.todos')).map(t => t.text); });
  check(back.length === 2 && back.indexOf('Made-up keepsake') > -1, 'Restore puts back just that one ' + JSON.stringify(back));
  check(/data-snappick/.test(fs.readFileSync(path.join(__dirname, '../../cmd/settings.js'), 'utf8')), 'each day in Settings has a Pick items button');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
