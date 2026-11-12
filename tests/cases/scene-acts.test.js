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
      const R = Scene25.list()[0], st = R.state, out = { worst: 0, at: '', bad: 0, ends: 0, moved: 0, acts: [], wbody: 0, wfar: 0 };
      R.at(R.len); const rest = JSON.parse(JSON.stringify(st.figs.me));
      Object.keys(Scene25.GEN).forEach(id => {
        const L = Scene25.GEN[id].len, walk = Scene25.GEN[id].walk; let prev = null; out.acts.push(id);
        for (let t = 0; t <= L + 1e-6; t += 1 / 60) {
          R.act(id, t); const f = st.figs.me;
          if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) out.bad++;
          if (!walk && (Math.abs(f.cx - rest.cx) > .01 || Math.abs(f.gy - rest.gy) > .01)) out.moved++;
          if (walk && prev) { out.wbody = Math.max(out.wbody, Math.abs(f.cx - prev.cx)); out.wfar = Math.max(out.wfar, Math.abs(f.cx - rest.cx)); }   /* the season's walk to the tree or the pumpkin: smooth steps */
          if (prev) ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > out.worst) { out.worst = d; out.at = id + ' ' + t.toFixed(2) + ' ' + k; } } });
          prev = { R: f.R, L: f.L, cx: f.cx };
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
    check(r.wbody < 4.5, pg + ': the walk to the season\'s tree or pumpkin and back is smooth (' + r.wbody.toFixed(2) + ' a frame, ' + r.wfar.toFixed(0) + ' away at most)');
    check(!r.bad, pg + ': no "NaN" or "undefined" in any frame');
    check(!r.repeats && r.kinds >= 4 && r.main, pg + ': at least four actions take turns, never twice in a row (' + r.kinds + ' kinds, ' + r.repeats + ' repeats)');
    if (r.pacts.length) {
      check(r.pworst < 7 && r.pbody < 4.5, pg + ': its own actions (' + r.pacts.join(', ') + ') are smooth (body ' + r.pbody.toFixed(2) + ', hands ' + r.pworst.toFixed(2) + ' at ' + r.pat + ')');
      check(r.pends < 2, pg + ': its own actions start and end in the rest (' + r.pends.toFixed(2) + ')');
      check(!r.pbad, pg + ': no "NaN" or "undefined" in its own actions');
    }
    check(r.tap === 'wave', pg + ': a tap on him waves (' + r.tap + ')');
    /* a tap on a thing: he goes and uses it (data-scact), and it still opens its card (data-scgo) */
    const taps = await p.evaluate(() => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'), out = [];
      [...svg.querySelectorAll('[data-scact]')].forEach(h => { const want = h.getAttribute('data-scact'); st.playing = false; st.gen = null; st.pact = null; st.t = R.len; st.last = 'x'; st.queue = null;
        let opened = false; const stop = e => { if (e.target.closest('[data-scgo]')) opened = true; e.stopPropagation(); }; svg.addEventListener('click', stop);   /* after the scene's own listener: the card (scenes.js, on the document) is not opened in the test */
        h.dispatchEvent(new MouseEvent('click', { bubbles: true })); svg.removeEventListener('click', stop);
        out.push({ want, got: st.last, opened }); R.at(R.len); });
      return out; });
    await sl(600);
    const tbad = taps.filter(x => x.got !== x.want || !x.opened);
    check(!tbad.length, pg + ': a tap on a thing plays its action and opens the card (' + taps.map(x => x.want + '→' + x.got + (x.opened ? '' : ' (no card)')).join(', ') + ')');
    /* the seasons: the tree in December, the pumpkin at Halloween, on the pages that have room for them */
    const sea = await p.evaluate(() => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'), out = {};
      ['xmas', 'halloween', ''].forEach(sn => { window.__season = sn; R.at(R.len); out[sn || 'none'] = svg.querySelectorAll('.sc25-season').length; });
      window.__season = 'xmas'; out.gens = Scene25.gens({}, { season: st.season }); R.at(R.len); const n0 = svg.querySelectorAll('.sc25-season circle').length;
      Scene25.GEN.tree.done(st); R.at(R.len); out.hung = svg.querySelectorAll('.sc25-season circle').length - n0; window.__season = null; R.at(R.len); out.spot = !!st.season; return out; });
    if (sea.spot) {
      check(sea.xmas === 1 && sea.halloween === 1 && sea.none === 0, pg + ': the tree in December, the pumpkin at Halloween, nothing otherwise (' + JSON.stringify(sea) + ')');
      check(sea.hung === 1, pg + ': the bauble he hung stays on the tree');
    }
    if (pg === 'work') {   /* a long press: a little dance; moving over the picture: he looks your way */
      const lp = await p.evaluate(() => new Promise(res => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'); st.playing = false; st.gen = null; st.t = R.len; st.last = 'main';
        svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); setTimeout(() => { svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); res(st.last); }, 900); }));
      check(lp === 'dance', 'a long press: a little dance (' + lp + ')');
      const look = await p.evaluate(() => new Promise(res => { const R = Scene25.list()[0], st = R.state, svg = document.querySelector('#scIllu svg'), rc = svg.getBoundingClientRect(); R.at(R.len); st.gen = null; st.playing = false; window.__sceneSpeed = 1;
        svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rc.right - 2, clientY: rc.top + 20 })); setTimeout(() => { res(st.lookF || 0); window.__sceneSpeed = 0.00001; }, 700); }));
      check(look > 5, 'he turns toward your finger at rest (' + look.toFixed(1) + '°)');
    }
  }
  /* the walks to the season's tree and pumpkin in the wheelchair and on crutches: smooth, no broken numbers, back in the rest */
  for (const aid of ['chair', 'crutches']) {
    await p.evaluate(aid => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar, { aid }); localStorage.setItem('dash.settings', JSON.stringify(s)); }, aid);
    await go(p, 'papers/', 2500); await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
    const w = await p.evaluate(() => { window.__sceneSpeed = 0.00001; const R = Scene25.list()[0], st = R.state, out = { body: 0, hands: 0, bad: 0, ends: 0 }; R.at(R.len); const rest = JSON.parse(JSON.stringify(st.figs.me));
      ['tree', 'pumpkin', 'yawn'].forEach(id => { let prev = null; const L = Scene25.GEN[id].len; for (let t = 0; t <= L + 1e-6; t += 1 / 60) { R.act(id, t); const f = st.figs.me; if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) out.bad++;
        if (prev) { out.body = Math.max(out.body, Math.abs(f.cx - prev.cx)); ['R', 'L'].forEach(k => { if (f[k] && prev[k]) out.hands = Math.max(out.hands, Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1])); }); } prev = { cx: f.cx, R: f.R, L: f.L }; }
        R.act(id, L); out.ends = Math.max(out.ends, Math.abs(st.figs.me.cx - rest.cx)); });
      R.at(R.len); return out; });
    check(!w.bad && w.body < 4.5 && w.hands < 7 && w.ends < 1.5, (aid === 'chair' ? 'in the wheelchair' : 'on crutches') + ': the tree, the pumpkin and the yawn are smooth and end in the rest (' + JSON.stringify(w) + ')');
  }
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar, { aid: 'none' }); localStorage.setItem('dash.settings', JSON.stringify(s)); });
  /* Travel's own actions on a planned trip: packing (something left on the packing list), the map */
  await p.evaluate(() => { Features.set('travel', true); const d = new Date(), k = n => { const x = new Date(d.getTime() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'tt1', name: 'Made-up trip', dest: 'Testby', start: k(3), end: k(6), how: 'bus', pack: [{ id: 'p1', text: 'Shirts', done: false }] }];
    localStorage.setItem('dash.travel', JSON.stringify(tv)); try { sessionStorage.setItem('dash.travelTab', 'trips'); } catch (e) {} });
  await go(p, 'travel/', 3000);
  if (await until(p, () => !!document.querySelector('#scIllu svg.sc25') && Scene25.list()[0] && Scene25.list()[0].acts().length > 0, 10000) === null) check(false, 'travel: the trip scene with its own actions is there');
  else {
    await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
    const tr = await p.evaluate(() => { const R = Scene25.list()[0], st = R.state, out = { acts: R.acts(), worst: 0, body: 0, ends: 0, bad: 0, at: '' }; R.at(R.len); const rest = JSON.parse(JSON.stringify(st.figs.me));
      out.acts.forEach(a => { let prev = null; for (let t = 0; t <= a.len + 1e-6; t += 1 / 60) { R.pact(a.id, t); const f = st.figs.me; if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) out.bad++;
        if (prev) { out.body = Math.max(out.body, Math.abs(f.cx - prev.cx)); ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > out.worst) { out.worst = d; out.at = a.id + ' ' + t.toFixed(2) + ' ' + k; } } }); }
        prev = { cx: f.cx, R: f.R, L: f.L }; }
        [0, a.len].forEach(t => { R.pact(a.id, t); const f = st.figs.me; out.ends = Math.max(out.ends, Math.abs(f.cx - rest.cx)); ['R', 'L'].forEach(k => { if (f[k] && rest[k]) out.ends = Math.max(out.ends, Math.hypot(f[k][0] - rest[k][0], f[k][1] - rest[k][1])); }); }); });
      R.at(R.len); return out; });
    check(tr.acts.map(a => a.id).slice(0, 2).join() === 'pack,map' && tr.acts[0].w > tr.acts[1].w, 'travel: packing comes first while something is left to pack (' + JSON.stringify(tr.acts) + ')');
    check(tr.worst < 7 && tr.body < 4.5, 'travel: packing and the map are smooth (body ' + tr.body.toFixed(2) + ', hands ' + tr.worst.toFixed(2) + ' at ' + tr.at + ')');
    check(tr.ends < 2 && !tr.bad, 'travel: they start and end in the rest, no broken numbers (' + tr.ends.toFixed(2) + ', ' + tr.bad + ')');
  }
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
