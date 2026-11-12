/* Real sizes (Phase L4): every object listed in SceneCommon.SIZES is measured against your avatar's height on its
   page and must stay in its range – a fridge about your height, a shopping bag knee to waist high, your people your
   size (the suitcase was as tall as your shoulders and the wish-list bag almost as tall as you, 2026-11-11). On the
   Journey you're about life size next to the rides (a bus 1.2–1.9× your height, the door a bit taller than you).
   Made-up data only. */
const { open, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393, { oldLive: 1 });
  await p.evaluate(() => { ['food', 'wish', 'travel', 'people', 'shop'].forEach(k => { try { Features.set(k, true); } catch (e) {} });
    const d = new Date(), k = n => { const x = new Date(d.getTime() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const t = Features.tools(); t.people = [{ id: 'sp1', name: 'Ada Test', rel: 'friend' }, { id: 'sp2', name: 'Bo Test', rel: 'family' }, { id: 'sp3', name: 'Cy Test', rel: 'work' }]; Features.saveTools(t);
    const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'st1', name: 'Test trip', start: k(5), end: k(8), pack: [{ id: 'a', t: 'Socks', done: false }] }]; localStorage.setItem('dash.travel', JSON.stringify(tv));
    try { sessionStorage.setItem('dash.travelTab', 'trips'); } catch (e) {} });
  const pages = await p.evaluate(() => Object.keys(SceneCommon.SIZES));
  for (const pg of pages) {
    await go(p, pg + '/', 2500);
    if (await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 3000) !== null) continue;   /* a page in 2.5D (F2): its sizes are drawn to scale in the scene itself */
    const ok = await until(p, pg => !!(window.SceneLive && SceneLive['_' + pg] && document.querySelector('#scIllu .hero')), 10000, pg);
    check(ok !== null, pg + ': the avatar is there to measure against');
    if (ok === null) continue;
    const res = await p.evaluate(pg => { const H = SceneLive['_' + pg].H, svg = H.svg, M = svg.getScreenCTM().inverse();
      const top = e => new DOMPoint(0, e.getBoundingClientRect().top).matrixTransform(M).y, hgt = e => { const r = e.getBoundingClientRect(); return new DOMPoint(0, r.bottom).matrixTransform(M).y - new DOMPoint(0, r.top).matrixTransform(M).y; };
      const me = H.pos[1] - top(H.fig.querySelector('.av-all') || H.fig);
      return SceneCommon.SIZES[pg].map(([sel, nth, lo, hi, what]) => { const all = [...svg.querySelectorAll(sel)].filter(e => !e.closest('.hero')), els = nth < 0 ? all : [all[nth]].filter(Boolean);
        if (!els.length) return [what, 'missing'];
        const r = els.map(e => hgt(e) / me); return [what, r.every(x => x >= lo && x <= hi) ? 'ok' : r.map(x => x.toFixed(2)).join('/') + ' (want ' + lo + '–' + hi + ')']; }); }, pg);
    res.forEach(([what, r]) => check(r === 'ok', pg + ': ' + what + ' ' + r));
  }
  /* the Journey: life size next to the rides */
  await p.evaluate(() => { try { sessionStorage.setItem('dash.travelTab', 'journey'); localStorage.setItem('dash.tvLegs', JSON.stringify(['bus'])); } catch (e) {} });
  await go(p, 'travel/', 2500);
  if (await until(p, () => !!(window.SceneLive && SceneLive._travel && document.querySelector('#scIllu .hero')), 10000) !== null) {
    const j = await p.evaluate(() => { const H = SceneLive._travel.H, svg = H.svg, M = svg.getScreenCTM().inverse(), y = v => new DOMPoint(0, v).matrixTransform(M).y;
      const me = H.pos[1] - y((H.fig.querySelector('.av-all') || H.fig).getBoundingClientRect().top);
      const A = window.SceneArt, g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = A.vehicle('bus', '#e60000') + A.place(true, 0, 'none'); svg.appendChild(g);
      const bus = g.querySelector('.sc-vbody').getBBox().height, door = [...g.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === '#3b4a60').map(r => +r.getAttribute('height'))[0]; g.remove();
      return { bus: bus / me, door: door / me }; });
    check(j.bus >= 1.2 && j.bus <= 1.9, 'Journey: a bus is 1.2–1.9× your height (' + j.bus.toFixed(2) + ')');
    check(j.door >= .85 && j.door <= 1.3, 'Journey: the office door is about your height or a bit taller (' + j.door.toFixed(2) + ')');
  }
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
