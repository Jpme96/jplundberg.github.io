/* The Finances picture and Home's evening picture (JP 2026-11-15: "issues in finance animation … and also home"):
   - walking past the ladder (worried, polishing, the piggy bank) the ladder's near rail stays behind him – it went
     through his body; only while he climbs for the coin does it go between his sides;
   - Home's evening book has a cover you can see on any top (a blue one vanished against a blue sweater), so his hands
     are never empty. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await go(p, 'finance/', 2000);
  const r = await p.evaluate(() => {
    const NS = 'http://www.w3.org/2000/svg', mk = st => { const sv = document.createElementNS(NS, 'svg'); sv.setAttribute('viewBox', '0 0 400 240'); document.body.appendChild(sv); const a = SceneLive.finance(sv, { state: st, ratio: .5, left: 1200, days: 10 }); return { sv, a }; };
    const railFirst = (sv) => { const els = [...sv.querySelectorAll('line, path, rect, ellipse, circle')]; const rail = els.findIndex(e => e.tagName === 'line' && e.getAttribute('stroke') === '#aeb6bf' && Math.abs(+e.getAttribute('y1') - 166) < .5 && Math.abs(+e.getAttribute('x1') - 265) < .5);
      const me = sv.querySelector('.sc25-me'), body = me ? els.indexOf(me.querySelector('path')) : -1; return { rail, body }; };
    const w = mk('neg'); w.a.at(1.2); const worried = railFirst(w.sv);
    const c = mk('ok'); c.a.at(5.0); const climbing = railFirst(c.sv);
    const L = Object.assign({}, Avatar.look(), { topC: '#3d85dc' }), book = Avatar.figure(Object.assign({}, Avatar.MOMENTS.evening), L);
    return { worried, climbing, bookRed: /#d6453f/i.test(book), bad: /NaN|undefined/.test(w.sv.innerHTML + c.sv.innerHTML) };
  });
  check(r.worried.rail > -1 && r.worried.body > -1 && r.worried.rail < r.worried.body, 'walking past the ladder, its near rail is drawn behind him ' + JSON.stringify(r.worried));
  check(r.climbing.rail > r.climbing.body, 'climbing for the coin, the near rail goes between his sides (after his far side) ' + JSON.stringify(r.climbing));
  check(r.bookRed, 'the evening book has a red cover – it shows on a blue top');
  check(!r.bad, 'no NaN/undefined in the Finances picture');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
