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
    /* never walking backwards: while he steps (w > .05) and moves along x, he never faces away from where he goes */
    const back = [];
    [['neg', 7.4], ['ok', 13.2]].forEach(([st, len]) => { const m = mk(st); window.__scTrace = []; for (let t = 0; t < len; t += .05) m.a.at(t); const tr = window.__scTrace; window.__scTrace = null;
      for (let i = 1; i < tr.length; i++) { const dx = tr[i][1] - tr[i - 1][1], f = tr[i][2] * Math.PI / 180; if (tr[i][3] > .05 && Math.abs(dx) > .05 && Math.sin(f) * dx < -1e-6 && Math.abs(Math.sin(f)) > .5) back.push(st + '@' + tr[i][0].toFixed(2)); } });
    /* the worried hand to the chin rises in front of him (facing left: the hand is never right of his middle) – it
       swung back over the top before (JP 2026-11-15) */
    const behind = []; { const m = mk('neg'); for (let t = 2.2; t < 3.6; t += .02) { m.a.at(t); const f = m.a.state.figs, me = f[Object.keys(f)[0]]; ['R', 'L'].forEach(k => { if (me[k] && me[k][0] > me.cx - 1) behind.push(t.toFixed(2) + k + ' ' + (me[k][0] - me.cx).toFixed(1)); }); } }
    /* to the piggy bank he walks behind the jar (JP 2026-11-16: he walked through it): mid-way the jar is drawn over him; where he turns he is in front */
    const pg = mk('ok'); pg.a.pact('piggy', 1.6); const mid = { back: pg.a.state.r.back, over: pg.sv.querySelectorAll('.sc25-front .sc-jarg').length };
    pg.a.pact('piggy', 2.7); const turn = pg.a.state.r.back || 0;
    const jar = { mid, turn };
    return { jar, behind, back, worried, climbing, bookRed: /#d6453f/i.test(book), bad: /NaN|undefined/.test(w.sv.innerHTML + c.sv.innerHTML) };
  });
  check(r.worried.rail > -1 && r.worried.body > -1 && r.worried.rail < r.worried.body, 'walking past the ladder, its near rail is drawn behind him ' + JSON.stringify(r.worried));
  check(r.climbing.rail > r.climbing.body, 'climbing for the coin, the near rail goes between his sides (after his far side) ' + JSON.stringify(r.climbing));
  check(!r.back.length, 'he never walks backwards (facing one way, moving the other) ' + r.back.slice(0, 6).join(', '));
  check(r.jar.mid.back === 1 && r.jar.mid.over === 1 && r.jar.turn === 0, 'to the piggy bank he goes behind the jar (it is drawn over him), in front where he turns ' + JSON.stringify(r.jar));
  check(!r.behind.length, 'the hand to the chin goes up in front of him, never behind ' + r.behind.slice(0, 6).join(', '));
  check(r.bookRed, 'the evening book has a red cover – it shows on a blue top');
  check(!r.bad, 'no NaN/undefined in the Finances picture');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
