/* The living People and Trips pictures (Phase L6, round 4). People: you stand with up to four of your people at the
   same size; every action (say hi, high five, photo, birthday candle, call) runs to the end and puts everything back –
   nothing in your hands, facing us, the candle lit again. Trips: the suitcase is waist high, every
   action (pack, tag, plane, passport…) runs to the end, the tag line uses the real days left, the suitcase is back
   in place. With nobody added you still wave. Made-up people and a made-up trip only. */
const { open, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const runAll = async (pg) => {
    const names = await p.evaluate(pg => SceneLive['_' + pg].acts().map(a => a.n), pg), res = [];
    for (const n of names) {
      const ok = await p.evaluate((pg, n) => new Promise(r => { const t = setTimeout(() => r('timeout'), 40000); SceneLive['_' + pg].run(n).then(() => { clearTimeout(t); r('ok'); }, e => { clearTimeout(t); r('error ' + (e && e.message)); }); }), pg, n);
      const st = await p.evaluate(pg => { const H = SceneLive['_' + pg].H; return { view: H.view, objs: Object.keys(H.objs).length, turn: Math.abs(H.turn) < .02 }; }, pg);
      res.push([n, ok === 'ok' && st.view === 'front' && !st.objs && st.turn ? 'ok' : ok + JSON.stringify(st)]);
    }
    return res;
  };
  const bubbles = [];
  await p.exposeFunction('__bub', t => bubbles.push(t));
  const watch = () => p.evaluate(() => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('bub')) window.__bub(n.textContent); }))).observe(document.querySelector('#scIllu svg'), { childList: true }); });

  /* nobody added yet: you're there and wave */
  await p.evaluate(() => { ['people', 'travel'].forEach(k => { try { Features.set(k, true); } catch (e) {} }); const t = Features.tools(); t.people = []; Features.saveTools(t); });
  await go(p, 'people/', 2500);
  check(await until(p, () => !!(window.SceneLive && SceneLive._people && document.querySelector('#scIllu .hero')), 10000) !== null, 'People with nobody yet: you come alive');
  check((await p.evaluate(() => SceneLive._people.acts().map(a => a.n))).indexOf('wave') > -1, 'and you can wave');

  /* made-up people: a birthday tomorrow, one to catch up with, two more */
  await p.evaluate(() => { const d = new Date(), k = n => { const x = new Date(d.getTime() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }, dm = n => { const x = new Date(d.getTime() + n * 864e5); return x.getDate() + '.' + (x.getMonth() + 1); };
    const t = Features.tools(); t.people = [{ id: 'tp1', name: 'Ada Test', rel: 'friend', bday: dm(1) }, { id: 'tp2', name: 'Bo Test', rel: 'family', every: 7, last: k(-30) }, { id: 'tp3', name: 'Cy Test', rel: 'work' }, { id: 'tp4', name: 'Di Test', rel: 'other' }, { id: 'tp5', name: 'Ed Test', rel: 'friend' }]; Features.saveTools(t);
    const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'tt1', name: 'Test trip', dest: 'Testby', start: k(3), end: k(6), pack: [{ id: 'a', t: 'Shirt', done: true }, { id: 'b', t: 'Socks', done: false }] }]; localStorage.setItem('dash.travel', JSON.stringify(tv));
    try { sessionStorage.setItem('dash.travelTab', 'trips'); } catch (e) {} });
  p.errs.length = 0;
  await go(p, 'people/', 2500);
  check(await until(p, () => !!(window.SceneLive && SceneLive._people && document.querySelector('#scIllu .hero')), 10000) !== null, 'People: you come alive among your people');
  await watch();
  const lay = await p.evaluate(() => { const ps = [...document.querySelectorAll('#scIllu .sc-mingle > .hs-part svg')], H = SceneLive._people.H, me = H.fig.getBoundingClientRect(), them = ps.map(x => x.querySelector('.bob').getBoundingClientRect()).sort((a, b) => b.height - a.height)[0], mine = H.fig.querySelector('.bob').getBoundingClientRect();
    return { n: ps.length, ratio: mine.height / them.height }; });
  check(lay.n === 4, 'up to four of your people stand with you (' + lay.n + ')');
  check(lay.ratio > .85 && lay.ratio < 1.2, 'you are the same size as the front row of your people (head ' + lay.ratio.toFixed(2) + '×)');
  const names = await p.evaluate(() => SceneLive._people.acts().map(a => a.n));
  check(['greet', 'highfive', 'photo', 'cake', 'call'].every(n => names.indexOf(n) > -1), 'People: say hi, high five, photo, the birthday candle and a call (' + names.join(', ') + ')');
  const pr = await runAll('people');
  check(pr.every(x => x[1] === 'ok'), 'People: every action runs to the end and puts everything back ' + JSON.stringify(pr.filter(x => x[1] !== 'ok')));
  const after = await p.evaluate(() => { const fl = document.querySelector('#scIllu .sc-flame'); return { lit: !fl || fl.style.visibility !== 'hidden' }; });
  check(after.lit, 'the birthday candle is lit again');
  check(!p.errs.length, 'People: no page errors ' + p.errs.join(' | ').slice(0, 200));

  /* Trips */
  p.errs.length = 0;
  await go(p, 'travel/', 2500);
  check(await until(p, () => !!(window.SceneLive && SceneLive._travel && document.querySelector('#scIllu .hero')), 10000) !== null, 'Trips: you come alive by the suitcase');
  await watch();
  const tn = await p.evaluate(() => SceneLive._travel.acts().map(a => a.n));
  check(['pack', 'tag', 'plane', 'passport'].every(n => tn.indexOf(n) > -1), 'Trips: pack, tag, plane and passport with a trip in 3 days and packing left (' + tn.join(', ') + ')');
  const cs = await p.evaluate(() => { const H = SceneLive._travel.H, c = document.querySelector('#scIllu .sc-caseo').getBoundingClientRect(), f = H.fig.getBoundingClientRect(); return c.height / f.height; });
  check(cs < .62, 'the suitcase is about waist high (' + cs.toFixed(2) + ' of your height)');
  const tr = await runAll('travel');
  check(tr.every(x => x[1] === 'ok'), 'Trips: every action runs to the end ' + JSON.stringify(tr.filter(x => x[1] !== 'ok')));
  check(await p.evaluate(() => !(document.querySelector('#scIllu [data-scgo="trips"]').getAttribute('transform') || '')), 'the suitcase is back in its place');
  check(bubbles.some(t => /3 days to go|3 dager igjen/.test(t)), 'the tag says the real days left');
  check(bubbles.length > 4 && !bubbles.some(t => /undefined|NaN|null|\[object/.test(t)), 'speech bubbles read well: ' + bubbles.slice(0, 10).join(' / '));
  check(!p.errs.length, 'Trips: no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
