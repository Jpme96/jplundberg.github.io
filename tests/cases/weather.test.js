/* The weather behind the page is a real animation (2026-11-10): falling rain, snow, drifting clouds and fog, sun, stars.
   - it draws on a canvas and keeps moving; it goes on after a page change
   - reduced motion: a still picture; light pages: no stars
   Made-up data only. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const setWx = code => p.evaluate(code => { localStorage.setItem('dash.wxNow', JSON.stringify({ code, at: Date.now() })); }, code);
  const snap = () => p.evaluate(() => { const c = document.querySelector('#dlWx canvas'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 3; i < d.length; i += 16) { if (d[i] > 0) { n++; h = (h * 31 + i) % 1000003; } } return { n, h }; });
  await setWx(63); await go(p, '', 2500);
  const a = await snap(); await sl(250); const a2 = await snap();
  check(a && a.n > 50, 'rain: the canvas has drops on it ' + JSON.stringify(a));
  check(a && a2 && a.h !== a2.h, 'rain: the drops move');
  check(await p.evaluate(() => getComputedStyle(document.getElementById('dlWx')).pointerEvents === 'none'), 'the weather never catches taps');
  await go(p, 'finance/', 2500);
  const f1 = await snap(); await sl(250); const f2 = await snap();
  check(f1 && f2 && f1.h !== f2.h, 'after a page change it is still falling');
  for (const [code, name] of [[73, 'snow'], [3, 'cloud'], [45, 'fog'], [95, 'storm']]) {
    await setWx(code); await go(p, '', 2000);
    const s1 = await snap();
    check(s1 && s1.n > 0 && await p.evaluate(k => document.getElementById('dlWx').classList.contains('dl-wx-' + k), name), name + ' draws');
  }
  await setWx(63); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await go(p, '', 2000); await sl(600);
  const r1 = await snap(); await sl(400); const r2 = await snap();
  check(r1 && r2 && r1.h === r2.h, 'with reduced motion it is a still picture');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
