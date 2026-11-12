/* Everyday actions (F3): on every page he also waves, stretches, checks the time, looks round (outdoors: a hand over
   the eyes), has a morning coffee, an umbrella in rain, a flag on 17 May – from the spot the page's own action left him.
   Each starts and ends in that rest (no teleport), nothing jumps at 60 frames a second, no "NaN"/"undefined"; the page's
   own action and these take turns, never the same twice in a row; a tap on him waves. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const PAGES = ['finance', 'food', 'work', 'habits', 'papers', 'calendar', 'goals', 'wish', 'people'];
(async () => {
  const { b, p } = await open(420);
  await p.evaluate(() => { const t0 = Features.tools(); t0.people = [{ id: 'tp1', name: 'Ada Test', rel: 'friend' }]; Features.saveTools(t0); ['flex', 'meetings', 'ptime', 'healthpage', 'habits', 'training', 'papers', 'calendar', 'goals', 'wish', 'people', 'work', 'food', 'finance'].forEach(f => { try { Features.set(f, true); } catch (e) {} }); });
  for (const pg of PAGES) {
    await go(p, pg + '/', 3000);
    if (await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000) === null) { check(false, pg + ': the scene is there'); continue; }
    await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
    const r = await p.evaluate(() => {
      const R = Scene25.list()[0], st = R.state, out = { worst: 0, at: '', bad: 0, ends: 0, moved: 0, acts: [] };
      R.at(R.len); const rest = JSON.parse(JSON.stringify(st.figs.me));
      Object.keys(Scene25.GEN).forEach(id => {
        const L = Scene25.GEN[id].len; let prev = null; out.acts.push(id);
        for (let t = 0; t <= L + 1e-6; t += 1 / 60) {
          R.act(id, t); const f = st.figs.me;
          if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) out.bad++;
          if (Math.abs(f.cx - rest.cx) > .01 || Math.abs(f.gy - rest.gy) > .01) out.moved++;
          if (prev) ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > out.worst) { out.worst = d; out.at = id + ' ' + t.toFixed(2) + ' ' + k; } } });
          prev = { R: f.R, L: f.L };
        }
        /* the first and the last frame are the rest */
        [0, L].forEach(t => { R.act(id, t); const f = st.figs.me; ['R', 'L'].forEach(k => { if (f[k] && rest[k]) out.ends = Math.max(out.ends, Math.hypot(f[k][0] - rest[k][0], f[k][1] - rest[k][1])); }); });
      });
      /* taking turns: never the same twice in a row */
      R.at(R.len); const seq = [];
      for (let i = 0; i < 24; i++) { st.playing = false; st.gen = null; st.t = R.len; R.play(); seq.push(st.last); }
      out.repeats = seq.filter((x, i) => i && x === seq[i - 1]).length; out.kinds = [...new Set(seq)].length; out.main = seq.includes('main');
      /* a tap on him waves */
      st.playing = false; st.gen = null; st.t = R.len; st.last = 'main';
      const svg = document.querySelector('#scIllu svg'), rc = svg.getBoundingClientRect();
      const hit = [...svg.querySelectorAll('[data-scgo]')]; hit.forEach(h => h.style.pointerEvents = 'none');
      svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rc.left + 2, clientY: rc.top + 2 }));
      out.tap = st.last; R.at(R.len);
      return out;
    });
    check(r.worst < 7, pg + ': everyday actions are smooth (hands ' + r.worst.toFixed(2) + ' at ' + r.at + ')');
    check(r.ends < 1.5 && !r.moved, pg + ': each starts and ends in the rest where the page left him (' + r.ends.toFixed(2) + ', moved ' + r.moved + ')');
    check(!r.bad, pg + ': no "NaN" or "undefined" in any frame');
    check(!r.repeats && r.kinds >= 4 && r.main, pg + ': at least four actions take turns, never twice in a row (' + r.kinds + ' kinds, ' + r.repeats + ' repeats)');
    check(r.tap === 'wave', pg + ': a tap on him waves (' + r.tap + ')');
  }
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
