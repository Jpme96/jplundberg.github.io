/* The two of you in 2.5D (Phase F2b – the shared home's Today card, cmd/scene-couple.js on scene25.js): every one
   of the eight moments plays from start to rest without anything jumping – for both people, each hand by side – with
   no "NaN"/"undefined", each person in their own look, and the shared pet by them. Made-up looks only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(420); await sl(500);
  await p.addScriptTag({ url: '/cmd/scene25.js' }); await p.addScriptTag({ url: '/cmd/scene-couple.js' });
  const r = await p.evaluate(() => {
    const out = {}; window.__sceneSpeed = 0.00001;
    for (const kind of ['hold', 'hi5', 'hug', 'kiss', 'selfie', 'dance', 'cook', 'sofa']) {
      const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.appendChild(sv);
      const R = SceneLive.couple(sv, { kind, me: { hair: 'short', top: 'tee', skin: '#c99a73' }, them: { hair: 'long', top: 'dress', skin: '#8d5a3b' }, pet: 'dog' });
      const o = { len: R.len, body: 0, hand: 0, at: '', bad: 0, pet: !!sv.querySelector('.av-pet'), two: 0 }; let prev = null;
      for (let t = 0; t <= R.len + .4; t += 1 / 60) { R.at(t); const f = R.state.figs; if (/NaN|undefined/.test(sv.innerHTML)) o.bad++; o.two = Math.max(o.two, Object.keys(f).length);
        if (prev) for (const who of Object.keys(f)) { const a = f[who], z = prev[who]; if (!z) continue; o.body = Math.max(o.body, Math.abs(a.cx - z.cx), Math.abs(a.gy - z.gy));
          ['R', 'L'].forEach(k => { if (a[k] && z[k]) { const d = Math.hypot(a[k][0] - z[k][0], a[k][1] - z[k][1]); if (d > o.hand) { o.hand = d; o.at = who + ' ' + t.toFixed(2) + ' ' + k; } } }); }
        prev = JSON.parse(JSON.stringify(f)); }
      R.stop(); sv.remove(); out[kind] = o;
    }
    return out;
  });
  for (const k in r) {
    const o = r[k];
    check(o.two === 2 && o.pet && !o.bad, k + ': both of you, the shared pet, no broken numbers');
    /* a twirl is the fastest move there is – a hand going round with the body – so dance gets a little more room */
    check(o.body < 5 && o.hand < (k === 'dance' ? 10 : 8), k + ': smooth, nothing jumps (body ' + o.body.toFixed(2) + ', hands ' + o.hand.toFixed(2) + ' at ' + o.at + ')');
  }
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
