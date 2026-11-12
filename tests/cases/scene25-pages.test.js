/* Every page scene in 2.5D (Phase F2), the same checks for each and each of its versions (what he does follows
   the page's data): the scene takes the picture over, its things still open their cards, stepping through it at 60
   frames a second nothing jumps (body, hands – each hand by side, whichever way he faces), the end of the action
   is the rest that follows, a replay is smooth too, no "NaN"/"undefined" in any frame, and in the wheelchair it plays
   without errors. Pages are added here as they move to 2.5D. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const DAY = "const k = new Date(), key = k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');";
const PAGES = [
  { page: 'food', go: ['meals', 'pantry', 'shop'], versions: [
    { name: 'dinner planned: milk from the fridge into the pot', len: [16, 19], setup: DAY + "Features.set('food', true); const t = Features.tools(); t.shop = [{ id: 's1', text: 'Milk (made up)', done: false }]; t.meals = Object.assign({}, t.meals || {}, { [key]: 'Rice pudding (made up)' }); Features.saveTools(t);" },
    { name: 'nothing planned: a look in the fridge', len: [7, 10], setup: DAY + "Features.set('food', true); const t = Features.tools(); t.shop = [{ id: 's1', text: 'Milk (made up)', done: false }]; t.meals = {}; Features.saveTools(t);" }] },
  { page: 'work', go: ['ptime', 'flex'], versions: [{ name: 'typing, a sip of coffee, a stretch', len: [11, 13], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'habits', go: ['training', 'ahealth'], versions: [{ name: 'dumbbells, three curls, arms up', len: [9, 11], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'papers', go: ['papers'], versions: [{ name: 'the letter into the drawer, the plant watered', len: [11, 12.5], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'calendar', go: ['clToday'], versions: [{ name: 'yesterday torn off, the clock, thumbs up', len: [7, 8], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'goals', go: ['glActive'], versions: [{ name: 'up the trail with the flag', len: [10, 11.5], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'wish', go: ['wishes', 'wbuy'], versions: [{ name: 'the gift from the shelf into the cart', len: [6, 7.5], setup: "['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'people', go: ['people'], versions: [{ name: 'walk over, wave, a high five', len: [7, 8], setup: "const t0 = Features.tools(); t0.people = [{ id: 'tp1', name: 'Ada Test', rel: 'friend' }]; Features.saveTools(t0); ['flex','meetings','fdv','ptime','healthpage','habits','training','papers','calendar','goals','wish','people','work'].forEach(f => { try { Features.set(f, true); } catch (e) {} });" }] },
  { page: 'travel', go: ['trips'], versions: [{ name: 'a trip: suitcase to the plane, up the stairs, a wave, home again', len: [16, 18], setup: "Features.set('travel', true); const d = new Date(), k = n => { const x = new Date(d.getTime() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }; const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'tt1', name: 'Test trip', dest: 'Testby', start: k(3), end: k(6), pack: [] }]; localStorage.setItem('dash.travel', JSON.stringify(tv)); try { sessionStorage.setItem('dash.travelTab', 'trips'); } catch (e) {}" }] }
];
(async () => {
  const { b, p } = await open(420);
  const look = l => p.evaluate(l => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar || {}, { aid: 'none' }, l || {}); localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); }, l);
  const sweep = () => p.evaluate(() => { const R = Scene25.list()[0], st = R.state, o = { len: R.len, body: 0, hand: 0, at: '', bad: 0, endJump: 0 }; let prev = null, last = null;
    for (let t = 0; t <= R.len + .5; t += 1 / 60) { R.at(t); const f = st.figs.me; if (/NaN|undefined/.test(document.querySelector('#scIllu svg').innerHTML)) o.bad++;
      /* off the picture or not drawn this frame (inside the bus, gone with the plane): no jump to measure across */
      const seen = f.t === R.state.t && f.cx > -20 && f.cx < 420; if (!seen) { prev = null; continue; }
      if (prev) { o.body = Math.max(o.body, Math.abs(f.cx - prev.cx), Math.abs(f.gy - prev.gy)); ['R', 'L'].forEach(k => { if (f[k] && prev[k]) { const d = Math.hypot(f[k][0] - prev[k][0], f[k][1] - prev[k][1]); if (d > o.hand) { o.hand = d; o.at = t.toFixed(2) + ' ' + k; } } }); }
      prev = { cx: f.cx, gy: f.gy, R: f.R, L: f.L }; }
    return o; });
  for (const P of PAGES) for (const V of P.versions) {
    await p.evaluate(new Function(V.setup)); await look(null); await sl(1200);
    await go(p, P.page + '/', 3000);
    const ok = await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
    check(ok !== null, P.page + ' – ' + V.name + ': the 2.5D scene takes the picture over');
    if (ok === null) continue;
    const gos = await p.evaluate(() => [...new Set([...document.querySelectorAll('#scIllu svg.sc25 [data-scgo]')].map(x => x.dataset.scgo))]);
    check(P.go.every(g => gos.includes(g)), P.page + ': its things still open their cards (' + gos.join(', ') + ')');
    await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
    const a = await sweep();
    check(a.len >= V.len[0] && a.len <= V.len[1], P.page + ' – ' + V.name + ' (' + a.len.toFixed(1) + ' s)');
    check(a.body < 4.5 && a.hand < 7, P.page + ' – ' + V.name + ': smooth, nothing jumps (body ' + a.body.toFixed(2) + ', hands ' + a.hand.toFixed(2) + ' at ' + a.at + ')');
    check(!a.bad, P.page + ' – ' + V.name + ': no "NaN" or "undefined" in any frame');
    await p.evaluate(() => { const R = Scene25.list()[0]; R.at(R.len); R.play(true); });
    const r2 = await sweep();
    check(r2.body < 4.5 && r2.hand < 7, P.page + ' – ' + V.name + ': a replay is smooth too (body ' + r2.body.toFixed(2) + ', hands ' + r2.hand.toFixed(2) + ' at ' + r2.at + ')');
    /* the wheelchair: plays through without errors or broken numbers */
    await look({ aid: 'chair' }); await sl(1200); await go(p, P.page + '/', 3000); await until(p, () => !!document.querySelector('#scIllu svg.sc25'), 10000);
    await p.evaluate(() => { window.__sceneSpeed = 0.00001; });
    const c = await sweep();
    check(!c.bad && c.body < 4.5, P.page + ' – ' + V.name + ': in the wheelchair too');
    await look(null);
  }
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
