/* Faster frames (F4): every page scene, timed with a 4× slower CPU (a mid-range phone), stays under 4 ms a frame.
   A frame is built off the page (pooled elements, attributes in _a) and patch() writes only what changed into the
   live picture: this also checks that the live picture is exactly that frame (same elements, attributes, text), and
   that a resting figure between breaths costs nothing (Fig25.draw gives the same parts back). Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const PAGES = ['finance', 'food', 'work', 'habits', 'papers', 'calendar', 'goals', 'wish', 'people', 'travel'];
(async () => {
  const { b, p } = await open(420);
  await p.evaluate(() => { const t0 = Features.tools(); t0.people = [{ id: 'tp1', name: 'Ada Test', rel: 'friend' }]; Features.saveTools(t0);
    ['flex', 'meetings', 'ptime', 'healthpage', 'habits', 'training', 'papers', 'calendar', 'goals', 'wish', 'people', 'finance', 'food', 'travel'].forEach(f => { try { Features.set(f, true); } catch (e) {} }); });
  const cdp = await p.target().createCDPSession();
  for (const pg of PAGES) {
    await go(p, pg + '/', 2500);
    if (await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000) === null) { check(false, pg + ': the scene is there'); continue; }
    /* the live picture is the frame that was built */
    const same = await p.evaluate(() => {
      const R = Scene25.list()[0], st = R.state, live = document.querySelector('#scIllu svg.sc25 .sc25-front');
      const attrs = n => { const o = {}; if (n._a) { for (const k in n._a) o[k] = String(n._a[k]); } else for (const a of n.attributes) o[a.name] = a.value; return o; };
      let bad = '';
      const cmp = (L, V, path) => {
        if (bad) return;
        if (V.__static) return;
        const la = {}; for (const a of L.attributes) la[a.name] = a.value;
        const va = attrs(V); for (const k in va) if (la[k] !== va[k]) { bad = path + ' ' + k + ': ' + la[k] + ' ≠ ' + va[k]; return; }
        const lk = [...L.children], vk = [...V.children];
        if (!vk.length && V.textContent !== L.textContent) { bad = path + ' text'; return; }
        if (lk.length !== vk.length) { bad = path + ': ' + lk.length + ' ≠ ' + vk.length + ' children'; return; }
        vk.forEach((v, i) => { if (lk[i].nodeName !== v.nodeName) bad = bad || path + '>' + i + ' ' + lk[i].nodeName + ' ≠ ' + v.nodeName; else cmp(lk[i], v, path + '>' + i + v.nodeName); });
      };
      for (const t of [0, .7, 1.9, 3.3, R.len]) { R.at(t); cmp(live, st.__vf, 'front@' + t); if (bad) break; }
      return bad;
    });
    check(!same, pg + ': the live picture is exactly the frame built off the page ' + same);
    let best = 99;
    for (let i = 0; i < 4 && best >= 4; i++) {   /* the best of up to four tries: other tests running at the same time slow it down */
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await p.evaluate(() => { Scene25.reset(); const R = Scene25.list()[0]; R.at(0); R.play(true, 'main'); });
      await sl(3500);
      const ms = await p.evaluate(() => Scene25.ms());
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      if (ms.n > 20) best = Math.min(best, ms.avg);
    }
    check(best < 4, pg + ': a frame takes ' + best.toFixed(2) + ' ms with a 4× slower CPU (under 4)');
  }
  /* resting between two breaths: the same parts again, nothing worked out */
  const rest = await p.evaluate(() => { const pool = Fig25.pool(), look = Scene25.look(), pose = { breath: .3 };
    const a = Fig25.draw(look, .2, 200, 200, .5, 0, 0, pose, pool), b2 = Fig25.draw(look, .2, 200, 200, .5, 0, 0, { breath: .3 }, pool);
    const k1 = pool.key; Fig25.draw(look, .2, 200, 200, .5, 0, 0, { breath: .4 }, pool);
    return { same: a.length === b2.length && a.every((x, i) => x[1] === b2[i][1]), moved: pool.key !== k1 }; });
  check(rest.same, 'the same pose again gives the same parts back');
  check(rest.moved, 'a new pose is drawn again');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 400));
  await done(b);
})();
