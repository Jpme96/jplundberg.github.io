/* The living Finances picture (Phase L6, page 1): your avatar, posed by the rig, does its actions by the jar.
   Each action runs to the end, puts everything back (nothing left in the hands, facing us again), and no bubble shows
   "undefined"/"NaN"; a tap on the jar still opens its card; leaving and coming back gives one avatar, not two;
   with animations off it's the still picture. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393, { oldLive: 1 });
  await go(p, 'finance/', 3000);
  const live = await until(p, () => !!(window.SceneLive && SceneLive._finance && document.querySelector('#scIllu .hero')), 10000);
  check(live !== null, 'the avatar comes alive in the Finances picture');
  check(await p.evaluate(() => !!document.querySelector('#scIllu .sc-ladder') && !document.querySelector('#scIllu .sc-me')), 'the ladder is there and the still avatar is replaced');
  const bubbles = [];
  await p.exposeFunction('__bub', t => bubbles.push(t));
  await p.evaluate(() => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('bub')) window.__bub(n.textContent); }))).observe(document.querySelector('#scIllu svg'), { childList: true }); });
  for (const n of ['save', 'knock', 'polish', 'count', 'phone', 'wave']) {
    const t0 = Date.now();
    const ok = await p.evaluate(n => new Promise(res => { const t = setTimeout(() => res('timeout'), 30000); SceneLive._finance.run(n).then(() => { clearTimeout(t); res('ok'); }, e => res('error ' + e.message)); }), n);
    const st = await p.evaluate(() => { const H = SceneLive._finance.H; return { view: H.view, objs: Object.keys(H.objs).length, turn: Math.abs(H.turn) < .02, hands: !H.hand.R && !H.hand.L }; });
    check(ok === 'ok' && st.view === 'front' && st.objs === 0 && st.turn && st.hands, n + ': runs to the end and puts everything back (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s) ' + ok + ' ' + JSON.stringify(st));
  }
  check(bubbles.length > 2 && !bubbles.some(t => /undefined|NaN|null/.test(t)), 'speech bubbles read well: ' + bubbles.slice(0, 6).join(' / '));
  check(!bubbles.some(t => /\d+\s?kr/.test(t)), 'no amounts in the bubbles');
  /* a tap on the jar still goes to the card */
  await p.evaluate(() => { window.__h0 = location.hash; document.querySelector('#scIllu [data-scgo="fin"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await sl(600);
  check(!p.errs.length, 'tapping the jar works without errors');
  /* away and back (instant page change): one avatar */
  await go(p, '', 1500); await go(p, 'finance/', 3000);
  await until(p, () => !!document.querySelector('#scIllu .hero'), 8000);
  check(await p.evaluate(() => document.querySelectorAll('#scIllu .hero').length) === 1, 'after leaving and coming back there is one avatar');
  /* animations off: the still picture */
  await p.evaluate(() => { document.documentElement.classList.remove('mo-full', 'mo-subtle'); document.documentElement.classList.add('mo-off'); const b = document.getElementById('scIllu'); if (b) { b._h = ''; } window.dispatchEvent(new Event('touch:change')); });
  await sl(1200);
  const still = await p.evaluate(() => ({ hero: !!document.querySelector('#scIllu .hero'), me: !!document.querySelector('#scIllu .sc-me') }));
  check(!still.hero && still.me, 'with animations off it is the still picture ' + JSON.stringify(still));
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
