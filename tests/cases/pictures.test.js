/* Picture tests (Phase C step 11): the avatar in several looks and moments is drawn and compared, pixel by pixel in
   the browser, with reference pictures in tests/pictures/. A change shows up as a failed check and the new picture
   is saved in tests/.tmp/pictures/ to look at. When a change is on purpose: UPDATE_PICTURES=1 node run.js pictures
   (then look at the new pictures before committing them). Made-up looks only. */
const fs = require('fs'), path = require('path');
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const REF = path.join(__dirname, '..', 'pictures'), OUT = path.join(__dirname, '..', '.tmp', 'pictures');
fs.mkdirSync(REF, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const UPDATE = !!process.env.UPDATE_PICTURES;
const base = { build: 'regular', skin: '#c99a73', hair: 'short', hairC: '#4a2f1b', beard: 'none', glasses: 'none', expr: 'smile', top: 'tee', topC: '#2f5d8a', bottom: 'trousers', legs: '#2a2f3a', auto: 'off' };
const CASES = [
  ['plain-day', 'day', {}],
  ['long-hair-evening', 'evening', { hair: 'long', hairC: '#a33d2b', top: 'sweater', topC: '#6b3fa0', glasses: 'round' }],
  ['beard-cap-morning', 'morning', { hair: 'bald', beard: 'full', hat: 'cap', skin: '#f3d4bb', bottom: 'shorts', legs: '#c9b48a' }],
  ['bun-dress-day', 'day', { hair: 'bun', hairC: '#1e140d', top: 'dress', topC: '#c0392b', skin: '#8d5a3b' }],
  ['muscular-gym', 'gym', { build: 'muscular', hair: 'quiff', beard: 'short' }],
  ['rain-night', 'rain', { hair: 'curly', hairC: '#2b1a10', top: 'hoodie', topC: '#22313f' }],
  ['night', 'night', { hair: 'short', expr: 'calm' }],
  ['pet-dog', 'day', { pet: 'dog', hair: 'long', top: 'shirt', topC: '#f2f2f2' }],
  /* turned by the rig (Phase L rounds 2–3): the back of the top, a hood and glasses from the side, the near earring */
  ['jersey-back', 'day', { top: 'jersey', topC: '#c62828', num: '23', bag: 'yes', hair: 'ponytail', _view: 'back' }],
  ['hoodie-side', 'day', { top: 'hoodie', topC: '#3a6ea5', glasses: 'aviator', ears: 'hoops', _view: 'side' }],
  ['suit-quarter', 'day', { top: 'suit', neck: 'tie', ears: 'studs', hair: 'long', hairC: '#1e140d', _view: 'q' }],
  /* 2026-11-13: the crest of a mohawk in two halves, the chin beard, a pet in the body's look */
  ['mohawk-goatee-cat', 'day', { hair: 'mohawk', beard: 'goatee', pet: 'cat', _view: 'q' }]
];
(async () => {
  const { b, p } = await open(1280);
  await sl(500);
  for (const [id, mom, patch] of CASES) {
    const look = Object.assign({}, base, patch);
    const ref = path.join(REF, id + '.png'), have = fs.existsSync(ref) && !UPDATE;
    const res = await p.evaluate(async (mom, look, refUrl) => {
      const W = 240, H = 300;
      const A25 = { q: 40, side: 90, back: 180 };
      let svg = Avatar.figure(Object.assign({}, Avatar.MOMENTS[mom], window.Fig25 && look._view ? { a: A25[look._view] } : {}), look);
      if (look._view && !window.Fig25) { const d = document.createElement('div'); d.innerHTML = svg; document.body.appendChild(d); const r = Rig(d.querySelector('svg'), look);
        if (look._view === 'back') Rig.back(r, true, look); else Rig.turn(r, look._view === 'side' ? 1 : .55); svg = d.innerHTML; d.remove(); }
      const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('could not draw')); i.src = src; });
      const px = img => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H); return { c, d: x.getImageData(0, 0, W, H).data }; };
      let s = svg; if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const now = px(await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)));
      const out = { png: now.c.toDataURL('image/png'), bad: /undefined|NaN/.test(svg) };
      if (refUrl) {
        const was = px(await load(refUrl + '?t=' + Date.now())).d; let off = 0;
        for (let i = 0; i < was.length; i += 4) if (Math.abs(was[i] - now.d[i]) > 48 || Math.abs(was[i + 1] - now.d[i + 1]) > 48 || Math.abs(was[i + 2] - now.d[i + 2]) > 48) off++;
        out.off = off / (W * H);
      }
      return out;
    }, mom, look, have ? '/tests/pictures/' + id + '.png' : '').catch(e => ({ err: e.message }));
    if (res.err) { check(false, id + ': drawn (' + res.err + ')'); continue; }
    check(!res.bad, id + ': no "undefined" or "NaN" in the drawing');
    const png = Buffer.from(res.png.split(',')[1], 'base64');
    if (!have) { fs.writeFileSync(ref, png); console.log('  saved reference ' + id + '.png'); continue; }
    const pct = Math.round(res.off * 1000) / 10;
    if (res.off > 0.01) fs.writeFileSync(path.join(OUT, id + '.png'), png);
    check(res.off <= 0.01, id + ': looks like the reference (' + pct + ' % of pixels differ' + (res.off > 0.01 ? ' – new picture in tests/.tmp/pictures/' : '') + ')');
  }
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
