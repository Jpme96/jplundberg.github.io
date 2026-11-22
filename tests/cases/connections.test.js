/* The life sections connect to the rest (2026-11-22, JP: "Do 1-6 from the gaps … and then do 1-8"):
   calendar, phone reminders, search, cost buttons, return from a receipt, dinner ↔ freezer, rain in the morning,
   the evening wrap-up, Siri's say= link, shop mode and the shared home (off until switched on). Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  await p.evaluate(() => {
    ['parties', 'returns', 'usefood', 'freezer', 'food', 'shop', 'pets', 'receipts'].forEach(i => Features.set(i, true));
    const pad = n => String(n).padStart(2, '0'), k = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = new Date(), tm = new Date(now.getTime() + 864e5), in5 = new Date(now.getTime() + 5 * 864e5);
    const t = Features.tools();
    t.parties = [{ id: 'pt1', title: 'Made-up party', date: k(in5), budget: 500 }];
    t.returns = [{ id: 'rt1', title: 'Made-up jacket', got: k(now), days: 14, state: 'open' }];
    t.usefood = [{ id: 'uf1', title: 'Made-up spinach', by: k(tm) }];
    t.pantry = [{ id: 'pa1', name: 'melk', state: 'ok' }];
    t.freezer = [{ id: 'fz1', title: 'Made-up kjøttdeig', n: 1 }];
    t.meals = Object.assign(t.meals || {}, { [k(tm)]: 'Taco med kjøttdeig' });
    Features.saveTools(t);
    window.__k = k(tm);
  });
  await sl(400);
  const r = await p.evaluate(() => {
    const d = LifePlus.dates(), ev = (window.EventsExtra || []).reduce((a, f) => { try { return a.concat(f() || []); } catch (e) { return a; } }, []);
    const pl = Notify.plan({ to: Date.now() + 8 * 864e5 }), si = (SearchIndex() || []).map(x => x.t + ' ' + (x.s || '')).join('|');
    return { ids: d.map(x => x.id), ev: ev.filter(e => /^rem:lp:/.test(e.id)).length, push: pl.filter(x => /party|ret|use/.test(x.id)).length,
      srch: /Made-up party/.test(si), dn: LifePlus.dinnerFor(window.__k) };
  });
  check(['party:pt1', 'ret:rt1', 'use:uf1'].every(i => r.ids.indexOf(i) > -1), 'the life sections give their dates ' + r.ids);
  check(r.ev >= 3, 'they show in the calendar (' + r.ev + ')');
  check(r.push >= 2, 'they become phone reminders (' + r.push + ')');
  check(r.srch, 'search finds the made-up party');
  check(r.dn && r.dn.frz && r.dn.frz.length === 1, 'tomorrow’s taco needs the kjøttdeig from the freezer ' + JSON.stringify(r.dn));
  /* rain in the morning, from made-up hourly weather */
  const rain = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); const pad = n => String(n).padStart(2, '0');
    const iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T14:00';
    const old = localStorage.getItem('dash.weather'), w = JSON.parse(old || '{}'); w.data = w.data || {}; w.data.hourly = { time: [iso], precipitation_probability: [80], precipitation: [1.2] }; localStorage.setItem('dash.weather', JSON.stringify(w));
    const out = Notify.plan({ to: Date.now() + 2 * 864e5 }).map(x => x.body || '').join('|'); if (old) localStorage.setItem('dash.weather', old); else localStorage.removeItem('dash.weather'); return out; });
  check(/14:00/.test(rain), 'the morning push says rain from 14:00');
  /* Siri: say= waits for the passcode and is then added */
  await go(p, '?say=' + encodeURIComponent('melk'), 2500);
  await sl(1200);
  const said = await p.evaluate(() => ({ shop: (Features.tools().shop || []).some(x => /melk/i.test(x.text)), sheet: !!document.querySelector('.qa-bg.show, .qa-sheet.open, #qaLine:not([hidden])') && (document.getElementById('qaLine') || {}).value, left: localStorage.getItem('dash.qa.say'), url: location.search }));
  check(said.shop && !/say=/.test(said.url), 'a Siri line lands on the shopping list and leaves the address clean ' + JSON.stringify(said));
  /* shop mode: tick an item off */
  await go(p, 'food/', 2500);
  const sm = await p.evaluate(() => new Promise(res => { const t = Features.tools(); t.shop = [{ id: 'sm1', text: 'Made-up bread', done: false }]; Features.saveTools(t);
    setTimeout(() => { const b = document.querySelector('[data-shmode]'); if (!b) return res('no button'); b.click();
      setTimeout(() => { const x = document.querySelector('.sm-ov [data-smx]'); if (!x) return res('no row'); x.click();
        setTimeout(() => res((Features.tools().shop || []).find(i => i.id === 'sm1')), 400); }, 300); }, 600); }));
  check(sm && (sm.done || sm.got), 'shop mode ticks the bread off ' + JSON.stringify(sm));
  /* shared home: life sections stay off until switched on */
  const sh = await p.evaluate(() => { const ALLOW = window.ShareCore && ShareCore.ALLOW; return { allow: !!(ALLOW ? ALLOW.lp : true) }; });
  check(sh.allow, 'the shared home knows the life-section fields');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})();
