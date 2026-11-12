/* Real sizes on the Journey (2.5D, F3/F4): you're about life size next to the rides – a bus 1.2–1.9× your height, the
   office door about your height or a bit taller. The other pages draw their things to scale in the scene itself
   (scene25-pages looks at them). Made-up data only. */
const { open, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { try { Features.set('travel', true); sessionStorage.setItem('dash.travelTab', 'journey'); localStorage.setItem('dash.tvLegs', JSON.stringify(['bus', 'rail'])); } catch (e) {} });
  await go(p, 'travel/', 2500);
  check(await until(p, () => !!document.querySelector('#scIllu svg.sc25 .sc25-front'), 10000) !== null, 'the Journey plays in 2.5D');
  const j = await p.evaluate(() => {
    const J = SceneLive.journeySize, A = window.SceneArt, NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg'); sv.setAttribute('viewBox', '0 0 400 240'); sv.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:240px'; document.body.appendChild(sv);
    const g = document.createElementNS(NS, 'g'); g.innerHTML = Fig25.group(Avatar.look(), { a: 0, cx: 200, gy: 200, k: J.K, shadow: false }); sv.appendChild(g); const me = g.getBBox().height;
    const v = document.createElementNS(NS, 'g'); v.innerHTML = A.vehicle('bus', '#e60000') + A.place(true, 0, 'none'); sv.appendChild(v);
    const bus = v.querySelector('.sc-vbody').getBBox().height * J.SC, door = [...v.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === '#3b4a60').map(r => +r.getAttribute('height'))[0] * J.SC; sv.remove();
    return { bus: bus / me, door: door / me, frontNodes: document.querySelectorAll('#scIllu .sc25-front > *').length };
  });
  check(j.bus >= 1.2 && j.bus <= 1.9, 'Journey: a bus is 1.2–1.9× your height (' + j.bus.toFixed(2) + ')');
  check(j.door >= .85 && j.door <= 1.3, 'Journey: the office door is about your height or a bit taller (' + j.door.toFixed(2) + ')');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
