/* Hours from Team into Flex time (2026-11-15): Team's "Add to my flex time in cmd" opens /cmd/work/#teamhours=…;
   cmd clears the hash at once, offers the entries in the Flex time card, adds them with one tap (one entry per clock-in,
   the break only on a day's first work entry, the Team id kept) and never offers the same ones again. Made-up data only. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  await p.evaluate(() => { Features.set('flex', true); const t = Features.tools(); t.flex = []; t.flexcfg = { norm: 7.5, brk: 30 }; Features.saveTools(t); });
  const d2 = day(-2), d1 = day(-1);
  const hash = '#teamhours=' + [d2 + '.0800.1130.a1b2c3', d2 + '.1215.1600.d4e5f6', d1 + '.0730.1545.0099aa', 'junk', d1 + '.1600.0900.bad111', '20261340.0800.0900.zz9999'].join(',');
  await go(p, 'work/' + hash, 3000);
  check(await p.evaluate(() => !/teamhours/.test(location.href)), 'the hash is cleared at once (nothing stays in the address or history)');
  const card = () => p.evaluate(() => { const c = document.querySelector('[data-tool="flex"]'); return c ? c.innerText : ''; });
  const t1 = await card();
  check(/From Team – your clocked hours/.test(t1) && /08:00–11:30/.test(t1) && /12:15–16:00/.test(t1) && /07:30–15:45/.test(t1), 'Flex time offers the three good entries ' + t1.slice(0, 300).replace(/\n/g, ' | '));
  check(!/16:00–09:00/.test(t1) && !/undefined|NaN|null/.test(t1), 'bad entries (end before start, a 13th month, junk) are left out');
  check(/Add all 3/.test(t1), 'one button adds all three');
  await p.evaluate(() => document.querySelector('[data-flexteam]').click()); await sl(600);
  const fl = await p.evaluate(() => Features.tools().flex);
  const iso = s => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6);
  check(fl.length === 3 && fl.every(e => e.type === 'work' && /^team:/.test(e.tid)), 'three work entries, each with its Team id ' + JSON.stringify(fl.map(e => [e.date, e.in, e.out, e.brk, e.tid])));
  const a = fl.filter(e => e.date === iso(d2)).sort((x, y) => x.in < y.in ? -1 : 1);
  check(a.length === 2 && a[0].brk === 30 && a[1].brk === 0, 'the break is counted once a day (on the first entry)');
  check(!/From Team – your clocked hours/.test(await card()), 'the offer is gone after adding');
  /* the same link again: nothing new to offer */
  await go(p, '', 1500); await go(p, 'work/' + hash, 3000);   /* a fresh load, like the new tab Team's link opens */
  check(!/From Team – your clocked hours/.test(await card()) && (await p.evaluate(() => Features.tools().flex.length)) === 3, 'opening the same link again adds nothing twice');
  /* Not now: dismissed for this tab */
  await go(p, '', 1500); await go(p, 'work/#teamhours=' + day(-3) + '.0900.1500.feed01', 3000);
  check(/09:00–15:00/.test(await card()), 'a new entry is offered');
  await p.evaluate(() => document.querySelector('[data-flexteamno]').click()); await sl(400);
  check(!/From Team – your clocked hours/.test(await card()) && (await p.evaluate(() => Features.tools().flex.length)) === 3, '"Not now" drops the offer without adding');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
