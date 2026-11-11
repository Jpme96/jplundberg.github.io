/* Key moments of the living scenes (Phase L7), measured frame by frame instead of compared as pictures (a moving
   scene never stops on the same pixel twice): whatever goes to the mouth – the coffee on Work, the spoon on Food, the
   bottle on Goals and Health – really reaches the mouth, and nothing held ever goes above the head (the cup on the
   head, 2026-11-11). The actions play 3× faster here (Live.pace). Made-up data only. */
const { open, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const CASES = [['work', 'sip'], ['food', 'stir'], ['goals', 'rest'], ['habits', 'drink']];
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { ['flex', 'meetings', 'food', 'work', 'healthpage', 'goals'].forEach(k => { try { Features.set(k, true); } catch (e) {} }); });
  for (const [pg, act] of CASES) {
    p.errs.length = 0;
    await go(p, pg + '/', 2500);
    const live = await until(p, pg => !!(window.SceneLive && SceneLive['_' + pg] && document.querySelector('#scIllu .hero')), 10000, pg);
    check(live !== null, pg + ': the avatar comes alive');
    if (live === null) continue;
    const r = await p.evaluate((pg, act) => new Promise(res => {
      const api = SceneLive['_' + pg], H = api.H, svg = H.svg, L = window.Live; L.pace(3);
      const cup = pg === 'work' ? svg.querySelectorAll('[data-scgo="flex"]')[1] : null;
      const inSvg = (rc) => { const m = svg.getScreenCTM().inverse(), a = new DOMPoint(rc.left, rc.top).matrixTransform(m), c = new DOMPoint(rc.right, rc.bottom).matrixTransform(m); return { x0: a.x, y0: a.y, x1: c.x, y1: c.y }; };
      let best = 1e9, worstTop = 1e9, frames = 0, on = false;
      /* measure only this action: first let the one that's running finish (a flag held up high there is fine) */
      api.R.paused = true;
      Promise.resolve(api.R.cur).then(() => { on = true; fr(); api.run(act).then(() => { on = false; clearTimeout(t); L.pace(1); res({ best, worstTop, frames }); }, e => { on = false; clearTimeout(t); res({ err: String(e && e.message) }); }); });
      function fr() { if (!on) return; frames++;
        const k = H.s * (H.k || 1), mo = L.mouth(H), top = L.bodyAt(H, 0, 40)[1];
        const things = Object.keys(H.objs).map(s => H.objs[s].g).concat(cup && cup.getAttribute('transform') ? [cup] : []);
        things.forEach(g => { const q = inSvg(g.getBoundingClientRect()), dx = Math.max(q.x0 - mo[0], 0, mo[0] - q.x1), dy = Math.max(q.y0 - mo[1], 0, mo[1] - q.y1);
          best = Math.min(best, Math.hypot(dx, dy) / k); worstTop = Math.min(worstTop, (q.y0 - top) / k); });
        requestAnimationFrame(fr); }
      const t = setTimeout(() => { on = false; res({ err: 'timeout' }); }, 30000);
    }), pg, act);
    check(!r.err && r.frames > 20, pg + '.' + act + ': runs and is measured (' + (r.err || r.frames + ' frames') + ')');
    check(r.best <= 6, pg + '.' + act + ': it reaches the mouth (closest ' + (r.best || 0).toFixed(1) + ' avatar units)');
    check(r.worstTop >= -3, pg + '.' + act + ': nothing held goes above the head (highest ' + (r.worstTop || 0).toFixed(1) + ' units from the top of the head)');
    check(!p.errs.length, pg + ': no page errors ' + p.errs.join(' | ').slice(0, 200));
  }
  await done(b);
})();
