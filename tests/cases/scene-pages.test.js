/* The living pictures on Calendar, Food, Goals, Health, Papers, Wish list and Work (Phase L6): on each page your
   avatar comes alive, the page's own two first actions run to the end and put everything back (nothing in the
   hands, facing us), speech bubbles read well, a pet stays on the ground, and no page errors. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => {
    ['flex', 'meetings', 'people', 'food', 'work', 'healthpage', 'wish', 'goals', 'papers', 'calendar'].forEach(k => { try { Features.set(k, true); } catch (e) {} });
    const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar || {}, { pet: 'dog', build: 'muscular' }); localStorage.setItem('dash.settings', JSON.stringify(s));
  });
  const bubbles = [];
  await p.exposeFunction('__bub', t => bubbles.push(t));
  for (const pg of ['calendar', 'food', 'goals', 'habits', 'papers', 'wish', 'work']) {
    p.errs.length = 0;
    await go(p, pg + '/', 2500);
    const live = await until(p, pg => !!(window.SceneLive && SceneLive['_' + pg] && document.querySelector('#scIllu .hero')), 10000, pg);
    check(live !== null, pg + ': the avatar comes alive');
    if (live === null) continue;
    await p.evaluate(() => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('bub')) window.__bub(n.textContent); }))).observe(document.querySelector('#scIllu svg'), { childList: true }); });
    const names = await p.evaluate(pg => SceneLive['_' + pg].acts().map(a => a.n), pg);
    check(names.length >= 4, pg + ': has several things to do (' + names.join(', ') + ')');
    for (const n of names.slice(0, 2)) {
      const ok = await p.evaluate((pg, n) => new Promise(res => { const t = setTimeout(() => res('timeout'), 45000); SceneLive['_' + pg].run(n).then(() => { clearTimeout(t); res('ok'); }, e => { clearTimeout(t); res('error ' + (e && e.message)); }); }), pg, n);
      const st = await p.evaluate(pg => { const H = SceneLive['_' + pg].H; return { view: H.view, objs: Object.keys(H.objs).length, turn: Math.abs(H.turn) < .02 }; }, pg);
      check(ok === 'ok' && st.view === 'front' && st.objs === 0 && st.turn, pg + '.' + n + ': runs to the end and puts everything back ' + ok + ' ' + JSON.stringify(st));
    }
    check(await p.evaluate(() => { const pet = document.querySelector('#scIllu .hero-pet'); return !!pet && !document.querySelector('#scIllu .hero-body .av-pet'); }), pg + ': the pet stays on the ground');
    check(!p.errs.length, pg + ': no page errors ' + p.errs.join(' | ').slice(0, 200));
  }
  check(bubbles.length > 3 && !bubbles.some(t => /undefined|NaN|null|\[object/.test(t)), 'speech bubbles read well: ' + bubbles.slice(0, 8).join(' / '));
  await done(b);
})();
