/* Auto-lock can be as short as 1 minute (2026-11-23, JP: "should be less than 15 min"): choosing it and coming back after
   two quiet minutes shows the lock screen. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const opts = await p.evaluate(() => [...document.querySelectorAll('#stLock option')].map(o => o.value));
  check(['1', '2', '5', '10', '15'].every(v => opts.includes(v)), 'Settings offers 1, 2, 5 and 10 minutes too ' + opts.join(','));
  await p.evaluate(() => { const s = document.getElementById('stLock'); s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sl(300);
  check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.settings')) || {}).lockMins === 1), 'the choice is kept');
  await p.evaluate(() => { const real = Date.now.bind(Date), t0 = real(); Date.now = () => real() + (real() - t0) + 2 * 60e3; document.dispatchEvent(new Event('visibilitychange')); });
  await sl(800);
  check(await p.evaluate(() => document.documentElement.classList.contains('locked')), 'two quiet minutes later it is locked');
  await done(b);
})();
