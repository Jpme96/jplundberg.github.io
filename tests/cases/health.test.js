/* Apple Health: taking the same numbers again changes nothing (no note, no save); a new number counts once. */
const { open } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const r = await p.evaluate(() => { const L = [];
    for (let i = 1; i <= 11; i++) { const d = '2026-10-' + String(i + 10).padStart(2, '0'); L.push({ date: d, steps: 2000 }); L.push({ date: d, steps: 9000 + i }); }
    return [AHealth.merge(L), AHealth.merge(L), AHealth.merge([{ date: '2026-10-21', steps: 9999 }])]; });
  check(r[0] === 11, 'first import: 11 days (' + r[0] + ')');
  check(r[1] === 0, 'the same sendings again: 0 days changed (' + r[1] + ')');
  check(r[2] === 1, 'one new number: 1 day (' + r[2] + ')');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
