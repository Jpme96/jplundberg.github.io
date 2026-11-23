/* The opening in the iPhone apps (2026-11-23): the name is written while the ring fills, then it fades into the page.
   Only in the apps (or ?splash), once per app start, never in safe mode; gone within a few seconds whatever happens. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  check(!(await p.evaluate(() => !!document.getElementById('splash'))), 'not on the website');
  await p.goto(p.url().replace(/\/cmd\/.*$/, '/cmd/?splash'), { waitUntil: 'domcontentloaded' });
  await sl(250);
  const a = await p.evaluate(() => { const s = document.getElementById('splash'); return s && { name: s.querySelector('#splashN').textContent, ring: +s.querySelector('#splashR').getAttribute('stroke-dashoffset'), w: s.querySelector('#splashN').getBoundingClientRect().width, vw: innerWidth }; });
  check(a && a.name === 'Lundberg', 'cmd opens with the name ' + JSON.stringify(a));
  check(a && a.w < a.vw, 'and it fits the screen');
  await p.screenshot({ path: '/tmp/splash-mid.png' });
  await sl(500);
  const ring2 = await p.evaluate(() => { const r = document.getElementById('splashR'); return r ? +r.getAttribute('stroke-dashoffset') : -1; });
  check(ring2 === -1 || ring2 < a.ring, 'the ring fills as it loads (' + a.ring + ' → ' + ring2 + ')');
  await sl(6500);
  check(!(await p.evaluate(() => !!document.getElementById('splash'))), 'it is gone after loading');
  check(await p.evaluate(() => !!document.getElementById('lock') || document.documentElement.classList.contains('unlocked')), 'the page is there underneath');
  /* in the app: once per start */
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 cmdapp/1');
  await p.goto(p.url().replace(/\/cmd\/.*$/, '/cmd/'), { waitUntil: 'domcontentloaded' });
  check(!(await p.evaluate(() => !!document.getElementById('splash'))), 'not again in the same app start');
  await p.evaluate(() => sessionStorage.removeItem('dash.splash'));
  await p.goto(p.url().replace(/\/cmd\/.*$/, '/cmd/?safe'), { waitUntil: 'domcontentloaded' });
  check(!(await p.evaluate(() => !!document.getElementById('splash'))), 'never in safe mode');
  await p.evaluate(() => sessionStorage.removeItem('dash.splash'));
  await p.goto(p.url().replace(/\/cmd\/.*$/, '/cmd/home/'), { waitUntil: 'domcontentloaded' }); await sl(300);
  check(await p.evaluate(() => { const s = document.getElementById('splash'); return s && s.querySelector('#splashN').textContent === 'Our home'; }), 'the shared app opens with “Our home”');
  await done(b);
})();
