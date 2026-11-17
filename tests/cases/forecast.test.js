/* One "at this pace" forecast (JP 2026-11-17: Home said 63 825 kr over, Finances 29 756 kr short; "keep to 0 kr a day" told you nothing).
   Budget.forecast is the only calculation; Budget.advice is the only sentence. Made-up numbers only. */
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  const r = await p.evaluate(() => {
    const B = Budget, pace0 = B.pace, real0 = B.real, money = n => Math.round(n) + ' kr', per = { daysLeft: 10, byPayday: true, startKey: 'x' };
    const run = (pc, real) => { B.pace = () => Object.assign({ per }, pc); B.real = () => real; const f = B.forecast({}); return { f, a: B.advice(f, money) }; };
    const out = {
      /* budget only: 10 000 room, 6 000 spent, 9 000 by the end at this pace → 1 000 left */
      ok: run({ room: 10000, spent: 6000, projected: 9000, perDay: 300 }, null),
      /* real balances: 2 000 free, 3 000 more to come at this pace → 1 000 short, keep to 200 a day */
      keep: run({ room: 10000, spent: 6000, projected: 9000, perDay: 300 }, { free: 2000, money: { saved: 0 } }),
      /* already short with savings to cover it, and without */
      cover: run({ room: 10000, spent: 6000, projected: 9000, perDay: 300 }, { free: -500, money: { saved: 4000 } }),
      bare: run({ room: 10000, spent: 6000, projected: 9000, perDay: 300 }, { free: -500, money: { saved: 100 } })
    };
    B.pace = pace0; B.real = real0; return out;
  });
  check(r.ok.f.end === 1000 && r.ok.f.ok && /On track – about 1000 kr left/.test(r.ok.a), 'on budget: the same end as the budget ' + JSON.stringify(r.ok));
  check(r.keep.f.end === -1000 && r.keep.f.keep === 200 && /end 1000 kr short – keep to 200 kr a day/.test(r.keep.a), 'with balances: what you have minus what is still to come ' + JSON.stringify(r.keep));
  check(r.cover.f.short === 500 && r.cover.f.cover && /already 500 kr short – move it from savings/.test(r.cover.a) && !/0 kr a day/.test(r.cover.a), 'already short: move it from savings, never "keep to 0 kr a day" ' + r.cover.a);
  check(r.bare.f.short === 500 && !r.bare.f.cover && /spend only on what you must until payday/.test(r.bare.a), 'short without savings ' + r.bare.a);
  /* every place uses it: no other "at this pace" sums in the code */
  const src = await p.evaluate(async () => (await Promise.all(['/cmd/money.js', '/cmd/brief.js', '/cmd/finance/fin-now.js'].map(u => fetch(u).then(x => x.text())))).map(t => /pc\.room - pc\.spent|projected - pc\.spent|keep to \{d\}\/day/.test(t)));
  check(src.every(x => !x), 'Home, the Money card and Finances have no sums of their own ' + JSON.stringify(src));
  await go(p, 'finance/', 2500);
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
