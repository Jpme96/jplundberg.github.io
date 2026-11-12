/* The 2.5D living scenes (Phase F2): the engine (cmd/scene25.js) and the Finances scene, the first page.
   - the scene takes the page picture over (400 × 240), with the jar and calendar still opening the budget card;
   - what he does follows the money: a coin in the jar when it goes well, a worried look when it doesn't, nothing to
     do without a budget; in the wheelchair the coin is tossed (no ladder);
   - smooth (build criterion 5): stepping through at 60 frames a second, his body and hands never jump, the end of
     the action is the rest that follows, a replay starts from where he stands;
   - staging: the coin goes in at the slot;
   - still pictures: one frame, the last; leaving the page stops the scene;
   - a frame takes little time. Made-up money only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(420);
  const setup = async (rent, look, spent) => { await p.evaluate((rent, look, spent) => { Features.set('finance', true);
    const d = Vault.get(); d.budget = { income: [{ id: 'i1', name: 'Salary (made up)', amount: 41000, day: 25 }], fixed: [{ id: 'f1', name: 'Rent (made up)', amount: rent, day: 1 }] }; Vault.save(d);
    const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar || {}, { aid: 'none' }, look || {}); localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); if (spent) Quick.add({ kind: 'expense', cat: 'shopping', amount: spent, note: 'Made-up big buy' }); }, rent, look, spent); await sl(1200); };
  const sweep = () => p.evaluate(() => { const R = Scene25.list()[0], st = R.state, out = { len: R.len, jumpBody: 0, jumpHand: 0, bad: 0, path: [] };
    let prev = null; for (let t = 0; t <= R.len + .5; t += 1 / 60) { R.at(t); const f = st.figs.me; if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML.slice(0, 40000))) out.bad++;
      if (prev) { out.jumpBody = Math.max(out.jumpBody, Math.abs(f.cx - prev.cx), Math.abs(f.gy - prev.gy)); ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > out.jumpHand) { out.jumpHand = d; out.at = +t.toFixed(2) + ' ' + k; } } }); }
      out.path.push([+t.toFixed(3), f.cx, f.near && f.near[0], f.near && f.near[1], st.r && st.r.coin, f.R && f.R.map(v => +v.toFixed(1)), f.L && f.L.map(v => +v.toFixed(1)), st.r && st.r.pose && st.r.pose.far && +(+st.r.pose.far.m).toFixed(2), st.r && st.r.w, st.r && st.r.face, st.phme]); prev = f; }
    return out; });
  /* 1. money on track: the coin, up the ladder */
  await setup(12500); await go(p, 'finance/', 3000);
  check(await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000) !== null, 'Finances: the 2.5D scene takes the picture over');
  const pic = await p.evaluate(() => { const sv = document.querySelector('#scIllu svg.sc25'); return { vb: sv.getAttribute('viewBox'), go: sv.querySelectorAll('[data-scgo="fin"]').length, amt: (sv.querySelector('.sc25-amt') || {}).textContent || '', cap: (document.querySelector('#scIllu figcaption') || {}).textContent || '' }; });
  check(pic.vb === '0 0 400 240' && pic.go === 2, 'the jar and the calendar still open the budget card (' + pic.go + ')');
  check(/28\s500 kr/.test(pic.amt) && /left/.test(pic.cap), 'the jar shows what is left (' + pic.amt + ')');
  await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
  const a = await sweep();
  check(a.len > 12 && a.len < 16, 'the coin action plays (' + a.len.toFixed(1) + ' s)');
  check(a.jumpBody < 4.5, 'smooth: his body never jumps between two frames (max ' + a.jumpBody.toFixed(2) + ')');
  if (process.env.DBG) console.log(a.path.filter(x => Math.abs(x[0] - parseFloat(a.at)) < .1).map(x => JSON.stringify(x)).join('\n'));
  check(a.jumpHand < 7, 'smooth: his hands never jump between two frames (max ' + a.jumpHand.toFixed(2) + ' at ' + a.at + ')');
  check(!a.bad, 'no "NaN" or "undefined" in any frame');
  const slot = a.path.filter(x => x[4] === 'hand').pop(), drop = a.path.find(x => typeof x[4] === 'number');
  check(slot && drop && Math.hypot(slot[2] - 237, slot[3] - 66) < 8, 'staging: the hand with the coin is at the slot when he lets go (' + (slot ? slot.slice(2, 4).map(v => v.toFixed(0)).join(', ') : '-') + ')');
  const end = a.path[a.path.length - 1], last = a.path.filter(x => x[0] <= a.len).pop();
  check(Math.abs(end[1] - last[1]) < .5, 'the end of the action is the rest that follows (no jump into the rest)');
  /* a replay starts from where he stands */
  const rep = await p.evaluate(() => { const R = Scene25.list()[0]; R.at(R.len); R.play(true, 'main'); R.at(0); return Scene25.list()[0].state.figs.me.cx; });
  check(Math.abs(rep - 300) < 3, 'a replay starts where he rests – no teleport to the edge (' + rep.toFixed(0) + ')');
  const a2 = await sweep();   /* the replay itself: he turns from you, walks back to the ladder – just as smooth */
  if (process.env.DBG) console.log(a2.path.filter(x => Math.abs(x[0] - parseFloat(a2.at)) < .06).map(x => JSON.stringify(x)).join('\n'));
  check(a2.jumpBody < 4.5 && a2.jumpHand < 7, 'the replay is smooth too (body ' + a2.jumpBody.toFixed(2) + ', hands ' + a2.jumpHand.toFixed(2) + ' at ' + a2.at + ')');
  /* frame time, at normal speed */
  await p.evaluate(() => { window.__sceneSpeed = 1; Scene25.reset(); Scene25.list()[0].play(true); }); await sl(3000);
  const ms = await p.evaluate(() => Scene25.ms());
  check(ms.n > 30 && ms.avg < 2.5, 'a frame takes little time (' + ms.avg.toFixed(2) + ' ms on average, ' + ms.n + ' frames)');
  /* 2. spending more than there is: no coin, a worried look */
  await setup(12500, null, 30000); await go(p, 'finance/', 3000); await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
  await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
  const w = await sweep();
  check(w.len > 5 && w.len < 10 && !w.path.some(x => x[4]), 'spent more than there is: no coin – he looks, worried (' + w.len.toFixed(1) + ' s)');
  /* 3. in the wheelchair: no ladder – he tosses the coin in */
  await setup(12500, { aid: 'chair' }); await go(p, 'finance/', 3000); await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
  await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
  const c = await sweep();
  check(c.len < 10 && c.path.every(x => x[1] > 270) && c.jumpBody < 4.5 && !c.bad, 'in the wheelchair the coin is tossed from beside the jar, never up the ladder (' + c.len.toFixed(1) + ' s)');
  /* 4. still pictures: the last frame, nothing running */
  await setup(12500); await p.evaluate(() => document.documentElement.classList.add('mo-off'));
  const still = await p.evaluate(() => { const sv = document.querySelector('#scIllu svg'); const r = SceneLive.finance(sv, { state: 'ok', left: 1000, daysLeft: 5, ratio: .4 }); return { t: r.state.t, len: r.len, playing: r.state.playing }; });
  check(still.t === still.len && !still.playing, 'still pictures: the last frame, drawn once');
  await p.evaluate(() => document.documentElement.classList.remove('mo-off'));
  /* 5. leaving the page stops it */
  await go(p, '', 2500);
  check(await p.evaluate(() => !window.Scene25 || Scene25.list().length === 0), 'on another page no scene keeps running');
  check(!p.errs.filter(e => !/income/.test(e)).length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
