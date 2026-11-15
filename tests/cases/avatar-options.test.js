/* Every choice in the avatar maker changes the picture you can see (JP 2026-11-15: "the things doesn't affect any changes").
   Each value of each option is drawn on the same made-up figure – face options zoomed on the head, the rest the whole
   figure, in the ¾ view – and compared pixel by pixel: it must differ from the starting look and from every other value of
   the same option (small features – eye colour, make-up, cheeks, aids – by fewer pixels than a garment). No "undefined"/"NaN" in any drawing. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await sl(400);
  const res = await p.evaluate(async () => {
    const M = Avatar._mk, FACE = { faceS: 1, expr: 1, eyeC: 1, makeup: 1, cheeks: 1, beard: 1, glasses: 1, hair: 1, hairC: 1, hat: 1, hatC: 1 };
    const base = { build: 'regular', skin: '#c99a73', hair: 'short', hairC: '#4a2f1b', beard: 'none', glasses: 'none', expr: 'smile', top: 'tee', topC: '#3d85dc', bottom: 'trousers', legs: '#555c66', shoes: 'sneakers', hat: 'none', aid: 'none', pet: 'none' };
    const W = 200, H = 260, load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('could not draw')); i.src = src; });
    const draw = async (look, face) => {
      const inner = Fig25.group(look, { a: 25, cx: 100, gy: face ? 600 : 250, k: face ? 3.3 : 1.05, shadow: false });
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + inner + '</svg>';
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#1d2128'; x.fillRect(0, 0, W, H);
      x.drawImage(await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)), 0, 0, W, H);
      return { d: x.getImageData(0, 0, W, H).data, bad: /undefined|NaN/.test(inner) };
    };
    const diff = (a, b2) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 60) n++; return n / (W * H); };
    const out = [], keys = Object.keys(M.MKO).concat(Object.keys(M.MKC || {})).filter((k, i, l) => l.indexOf(k) === i && !/^(pet|auto|hand|walk|addons)$/.test(k));
    for (const k of keys) {
      let vals = (M.MKO[k] || []).map(v => v[0]); if (!vals.length) vals = (M.MKC[k] || []).map(v => Array.isArray(v) ? v[0] : v);
      if (vals.length < 2) continue;
      const b0 = Object.assign({}, base); if (k === 'hatC') b0.hat = 'cap'; if (k === 'eyeC' || k === 'makeup') b0.expr = 'grin';
      const pics = [];
      for (const v of vals) { const L = Object.assign({}, b0); L[k] = v; const r = await draw(L, !!FACE[k]), r2 = await draw(L, !FACE[k]); pics.push([v, r.d, r2.d]); if (r.bad || r2.bad) out.push({ k, v, bad: 1 }); }   /* both zooms: the head and the whole figure – the bigger difference counts */
      for (let i = 0; i < pics.length; i++) for (let j = i + 1; j < pics.length; j++) { const d = Math.max(diff(pics[i][1], pics[j][1]), diff(pics[i][2], pics[j][2]) * (FACE[k] ? 1 : .5)), lim = /^(eyeC|makeup|aid|cheeks)$/.test(k) ? .0009 : .0018; if (d < lim) out.push({ k, a: pics[i][0], b: pics[j][0], d: Math.round(d * 10000) / 100 }); }
    }
    return { out, n: keys.length };
  });
  check(res.n > 15, 'the maker has its options (' + res.n + ')');
  const bad = res.out.filter(x => x.bad);
  check(!bad.length, 'no "undefined" or "NaN" in any drawing ' + JSON.stringify(bad).slice(0, 200));
  const same = res.out.filter(x => !x.bad);
  check(!same.length, 'every value of every option looks different from the others (' + same.length + ' pairs too alike: ' + same.slice(0, 40).map(x => x.k + ' ' + x.a + '/' + x.b + ' ' + x.d + '%').join(', ') + ')');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
