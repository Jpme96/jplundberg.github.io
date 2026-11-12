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
      /* the page's own actions (F3 part 2): smooth, from the rest and back to it, no broken numbers */
      out.pacts = []; out.pworst = 0; out.pat = ''; out.pbody = 0; out.pends = 0; out.pbad = 0;
      R.acts().forEach(a => { out.pacts.push(a.id); let prev = null;
        for (let t = 0; t <= a.len + 1e-6; t += 1 / 60) { R.pact(a.id, t); const f = st.figs.me;
          if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) out.pbad++;
          if (prev) { out.pbody = Math.max(out.pbody, Math.abs(f.cx - prev.cx), Math.abs(f.gy - prev.gy)); ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > out.pworst) { out.pworst = d; out.pat = a.id + ' ' + t.toFixed(2) + ' ' + k; } } }); }
          prev = { cx: f.cx, gy: f.gy, R: f.R, L: f.L }; }
        [0, a.len].forEach(t => { R.pact(a.id, t); const f = st.figs.me; out.pends = Math.max(out.pends, Math.abs(f.cx - rest.cx)); ['R', 'L'].forEach(k => { if (f[k] && rest[k]) out.pends = Math.max(out.pends, Math.hypot(f[k][0] - rest[k][0], f[k][1] - rest[k][1])); }); }); });
      R.at(R.len);
      /* taking turns: never the same twice in a row */
      R.at(R.len); const seq = [];
      for (let i = 0; i < 60; i++) { st.playing = false; st.gen = null; st.t = R.len; R.play(); seq.push(st.last); }
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
    if (r.pacts.length) {
      check(r.pworst < 7 && r.pbody < 4.5, pg + ': its own actions (' + r.pacts.join(', ') + ') are smooth (body ' + r.pbody.toFixed(2) + ', hands ' + r.pworst.toFixed(2) + ' at ' + r.pat + ')');
      check(r.pends < 2, pg + ': its own actions start and end in the rest (' + r.pends.toFixed(2) + ')');
      check(!r.pbad, pg + ': no "NaN" or "undefined" in its own actions');
    }
    check(r.tap === 'wave', pg + ': a tap on him waves (' + r.tap + ')');
    if (pg === 'work') {   /* a long press: a little dance; moving over the picture: he looks your way */
      const lp = await p.evaluate(() => new Promise(res => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'); st.playing = false; st.gen = null; st.t = R.len; st.last = 'main';
        svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); setTimeout(() => { svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); res(st.last); }, 900); }));
      check(lp === 'dance', 'a long press: a little dance (' + lp + ')');
      const look = await p.evaluate(() => new Promise(res => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'), rc = svg.getBoundingClientRect(); R.at(R.len); st.gen = null; st.playing = false; window.__sceneSpeed = 1;
        svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rc.right - 2, clientY: rc.top + 20 })); setTimeout(() => { res(st.lookF || 0); window.__sceneSpeed = 0.00001; }, 700); }));
      check(look > 5, 'he turns toward your finger at rest (' + look.toFixed(1) + '°)');
    }
  }
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
