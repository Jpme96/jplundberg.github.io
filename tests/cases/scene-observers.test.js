/* Faster frames (F4): a living scene redraws its own layer every frame; the page's observers (masonry, tiles, day
   pickers, translations …) must not hear about it – before, ten of them searched the whole page 30–60 times a
   second. A change outside the scene still reaches them. Made-up data only. */
const { open, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(420);
  await p.evaluate(() => { try { Features.set('work', true); } catch (e) {} });
  await go(p, 'work/', 3000); await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
  const r = await p.evaluate(() => new Promise(res => { let n = 0; const o = new MutationObserver(() => { n++; }); o.observe(document.body, { childList: true, subtree: true, attributes: true });
    document.querySelector('#scIllu').scrollIntoView(); Scene25.list()[0].play(true, 'main');
    setTimeout(() => { const inScene = n; const d = document.createElement('div'); document.body.appendChild(d); setTimeout(() => { res({ inScene, outside: n - inScene }); d.remove(); o.disconnect(); }, 100); }, 1500); }));
  check(r.inScene === 0, 'a scene playing for 1.5 s reaches no page observer (' + r.inScene + ' calls)');
  check(r.outside >= 1, 'a change outside the scene still does');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
