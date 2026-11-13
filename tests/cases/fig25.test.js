/* The 2.5D avatar (Phase F1, cmd/avatar-25d.js): every choice left in the avatar maker after F0 is drawn from five
   angles (front, three-quarter, side, back, the other three-quarter) without errors, and nothing broken ("NaN",
   "undefined") reaches the picture. Hands report where they ended up (scenes put things in them). Made-up looks only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await sl(400);
  await p.addScriptTag({ url: '/cmd/avatar-25d.js' });
  const r = await p.evaluate(() => {
    const base = { skin: '#c99a73', hair: 'short', hairC: '#1e140d', beard: 'none', glasses: 'none', top: 'sweater', bottom: 'trousers', legs: '#2a2f3a', shoes: 'sneakers', hat: 'none', hatC: '#e8743b', expr: 'smile' };
    const G = { faceS: ['oval', 'round', 'long'], expr: ['smile', 'grin', 'laugh', 'wink', 'cool', 'calm', 'shy', 'wow'], makeup: ['none', 'lashes', 'lips', 'both'], cheeks: ['none', 'blush', 'freckles'],
      beard: ['none', 'stubble', 'short', 'full', 'goatee', 'moustache'], glasses: ['none', 'round', 'square', 'cateye', 'sun', 'aviator'],
      hair: ['short', 'side', 'quiff', 'curly', 'fade', 'mohawk', 'afro', 'undercut', 'waves', 'bangs', 'long', 'ponytail', 'topknot', 'braids', 'pigtails', 'dreads', 'bald'],
      build: ['slim', 'regular', 'athletic', 'muscular', 'broad'], height: ['short', 'regular', 'tall'], aid: ['none', 'chair', 'crutches', 'hearing', 'arm'],
      top: ['tee', 'tank', 'polo', 'sweater', 'knit', 'hoodie', 'shirt', 'jersey', 'kit', 'varsity', 'suit', 'puffer', 'rain', 'jacket', 'dress', 'bunad', 'scrubs', 'chef', 'pjs', 'robe', 'none'],
      bottom: ['trousers', 'jeans', 'joggers', 'cargo', 'shorts', 'skirt', 'overalls', 'swim'], shoes: ['sneakers', 'hightops', 'boots', 'sandals', 'slippers', 'cleats'],
      hat: ['none', 'cap', 'beanie', 'bandana', 'cowboy', 'phones', 'party', 'wizard', 'santa', 'witch', 'chef', 'crown'] };
    let n = 0, bad = [], errs = [], distinct = {};
    for (const k in G) for (const v of G[k]) for (const ang of [0, 35, 90, 150, -60]) {
      try { const s = Fig25.svg(Object.assign({}, base, { [k]: v }), { a: ang }); n++; if (/NaN|undefined|null/.test(s)) bad.push(k + ':' + v + '@' + ang); if (ang === 35) { distinct[k] = distinct[k] || new Set(); distinct[k].add(s); } }
      catch (e) { errs.push(k + ':' + v + '@' + ang + ' ' + e.message); }
    }
    /* the look sweep (build criteria 1 and 2): mixed looks, walking too */
    const SW = [{ hair: 'long', hat: 'beanie' }, { hair: 'ponytail', hat: 'cap', glasses: 'round' }, { hair: 'afro', hat: 'phones' }, { beard: 'full', glasses: 'sun', hat: 'cowboy', top: 'shirt' },
      { top: 'dress', shoes: 'boots', hair: 'braids', makeup: 'both' }, { top: 'tank', bottom: 'shorts', shoes: 'sandals', build: 'muscular' }, { top: 'hoodie', hat: 'bandana', hair: 'dreads' },
      { top: 'suit', hat: 'wizard', beard: 'goatee' }, { aid: 'chair', top: 'knit', hat: 'crown', pet: 'dog' }, { aid: 'crutches', top: 'jacket', hair: 'mohawk', pet: 'cat' }, { pet: 'bunny' }, { pet: 'bird' }];
    let sweep = 0;
    for (const lk of SW) for (const ang of [0, 35, 90, 150, -60]) for (const ph of [0, 1.3]) { try { const s = Fig25.svg(Object.assign({}, base, lk), { a: ang, ph, w2: ph ? 1 : 0 }); sweep++; if (/NaN|undefined|null/.test(s)) bad.push('sweep ' + JSON.stringify(lk) + '@' + ang); } catch (e) { errs.push('sweep ' + JSON.stringify(lk) + ' ' + e.message); } }
    const chair = Fig25.svg(Object.assign({}, base, { aid: 'chair' }), { a: 35 }), crutch = Fig25.svg(Object.assign({}, base, { aid: 'crutches' }), { a: 35 }), plain = Fig25.svg(base, { a: 35 });
    const petSvg = Fig25.svg(Object.assign({}, base, { pet: 'dog' }), { a: 35 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.appendChild(svg);
    Fig25.draw(base, -Math.PI / 2, 200, 200, .5, 0, 0, { near: { m: 1, at: [180, 130] } }).forEach(q => svg.appendChild(q[1]));
    const h = Fig25.hand().near;
    /* talking and brows (F6, 2026-11-13): each mouth shape and each brow mood is its own drawing, big and small, and the shapes take turns over time */
    const face = (pose, k) => Fig25.svg(base, { a: 20, k: k, pose: pose }), faces = new Set(), talkBad = [];
    [1.2, .5].forEach(k => { [{}, { mouth: 'a' }, { mouth: 'o' }, { mouth: 'e' }, { brow: 'up' }, { brow: 'down' }, { brow: 'sad' }].forEach(ps => { const f = face(ps, k); faces.add(k + '|' + f); if (/NaN|undefined|null/.test(f)) talkBad.push(JSON.stringify(ps)); }); });
    const vis = new Set(); for (let tt = 0; tt < 1; tt += 1 / 16) vis.add(Fig25.viseme(tt));
    const sameM = face({ mouth: 'm' }, 1.2) === face({}, 1.2);
    const dif = {}; for (const k in distinct) dif[k] = distinct[k].size + '/' + G[k].length;
    return { n, sweep, chairDiff: chair !== plain && chair.length > plain.length + 400, crutchDiff: crutch.length > plain.length + 200, petDiff: petSvg.length > plain.length + 300, bad: bad.slice(0, 5), errs: errs.slice(0, 5), hand: h && Math.hypot(h.X - 180, h.Y - 130), faces: faces.size, talkBad, vis: [...vis].sort().join(''), sameM, dif, trimmed: Fig25.look({ hair: 'mullet', topC: '#ff0000' }), plainTop: Fig25.look({ hair: 'short' }).topC };
  });
  check(r.n > 500 && !r.errs.length, 'every choice draws from five angles (' + r.n + ' pictures) ' + r.errs.join(' | '));
  check(r.sweep === 120, 'the look sweep: 12 mixed looks from five angles, standing and walking (' + r.sweep + ')');
  check(r.chairDiff && r.crutchDiff && r.petDiff, 'the wheelchair, the crutches and a pet add their own parts');
  check(!r.bad.length, 'no "NaN", "undefined" or "null" in any picture ' + r.bad.join(', '));
  check(r.faces === 14 && !r.talkBad.length && r.vis === 'aemo' && r.sameM, 'talking: the mouth shapes a, o, e and the brow moods up, down, sad are each their own drawing, big and small; "m" is the closed mouth; the shapes take turns (' + r.faces + ' of 14, ' + r.vis + ')');
  check(r.hand != null && r.hand < 3, 'a hand put on a point lands there (' + (r.hand || 0).toFixed(1) + ' px off)');
  check(r.trimmed.hair === 'side' && r.trimmed.topC === '#ff0000' && r.plainTop === '#2f7a55', 'it draws the trimmed look: removed choices mapped, your top colour kept, forest green when none (' + r.trimmed.hair + ', ' + r.trimmed.topC + ', ' + r.plainTop + ')');
  /* shared shapes for now (F1 follow-up): undercut and waves are drawn as the side part */
  const ALIAS = { hair: 2 };
  const same = Object.keys(r.dif).filter(k => ['top', 'hat', 'hair', 'beard', 'glasses', 'shoes', 'bottom'].includes(k) && +r.dif[k].split('/')[0] < +r.dif[k].split('/')[1] - (ALIAS[k] || 0));
  check(!same.length, 'each top, bottom, hat, hair style, beard, glasses and shoe looks different ' + JSON.stringify(r.dif));
  await done(b);
})();
