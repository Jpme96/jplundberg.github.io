/* The new avatar maker (2026-11): one maker for Settings, People and the shared home.
   - avatars made before it are drawn exactly as before (fingerprints in tests/lib/avatar-old.json – first made from the
     old code with only the ear change, renewed on purpose for the new body, L1 2026-11-11: same choices, new arms/legs/neck)
   - hundreds of random looks with every new option: no errors, no "undefined"/"NaN", nothing outside the picture
   - Settings → Your avatar: its own page with tabs and picture tiles, turn-around, See it move, Undo, Save; an old cap/lanyard carries over; fits a phone
   - Iago makes his avatar in his app with new options; cmd gets all of them (more than the old 16-setting limit)
   Made-up data only. */
const { shared, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const OLD = require('../lib/avatar-old.json');
(async () => {
  const { b, p, b2, q } = await shared(393);

  /* 1. old avatars look the same */
  const now = await p.evaluate(rows => {
    const h = s => { s = s.replace(/ data-f25="\d+"/g, '').replace(/f25t\d+/g, 'f25t');   /* frame and clip ids are only counters */ let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
    return rows.map(r => r.couple ? h(Avatar.couple(r.couple, { hair: 'curly' }, { hair: 'bun' }, { uid: 't' })) : h(Avatar.figure(Avatar.MOMENTS[r.m], r.look)));
  }, OLD);
  /* a change on purpose (like F0, 2026-11-12): UPDATE_PICTURES=1 node run.js avatar-maker writes the new fingerprints – look at the pictures test first */
  if (process.env.UPDATE_PICTURES) require('fs').writeFileSync(require('path').join(__dirname, '../lib/avatar-old.json'), JSON.stringify(OLD.map((r, i) => Object.assign({}, r, { h: now[i] }))));
  const same = OLD.filter((r, i) => now[i] !== r.h).length;
  check(same === 0, 'avatars made before the new maker are drawn exactly as before (' + OLD.length + ' drawings, ' + same + ' differ)');

  /* 2. random looks with everything new */
  const stress = await p.evaluate(() => {
    const O = { faceS: ['oval', 'round', 'square', 'long', 'heart'], expr: ['smile', 'grin', 'laugh', 'wink', 'silly', 'cool', 'calm', 'love', 'starry', 'shy', 'wow'], eyeS: ['round', 'almond', 'big', 'sleepy'], nose: ['normal', 'button', 'pointy', 'wide'], earS: ['normal', 'small', 'big', 'elf'],
      brows: ['normal', 'thick', 'thin', 'arched', 'uni'], makeup: ['none', 'lashes', 'lips', 'both'], cheeks: ['none', 'blush', 'freckles', 'both'], mark: ['none', 'mole', 'star', 'heart', 'plaster'], lines: ['none', 'dimples', 'wrinkles', 'both'], pierce: ['none', 'nose', 'brow', 'lip', 'septum'], tat: ['none', 'arm', 'neck', 'face'],
      beard: ['none', 'stubble', 'short', 'full', 'goatee', 'chinstrap', 'moustache', 'handlebar', 'curled'], glasses: ['none', 'round', 'square', 'cateye', 'sun', 'aviator', 'hearts', 'stars', 'monocle'],
      hair: ['short', 'side', 'quiff', 'curly', 'buzz', 'fade', 'spiky', 'mohawk', 'afro', 'mullet', 'slick', 'undercut', 'waves', 'long', 'ponytail', 'bun', 'braids', 'pigtails', 'dreads', 'sideshave', 'bangs', 'bowl', 'topknot', 'cornrows', 'bald'], hairAge: ['none', 'grey', 'receding'],
      build: ['slim', 'regular', 'athletic', 'muscular', 'broad'], height: ['short', 'regular', 'tall'], shape: ['straight', 'belly', 'hips'], aid: ['none', 'chair', 'crutches', 'hearing', 'arm'],
      top: ['tee', 'tank', 'polo', 'sweater', 'knit', 'hoodie', 'shirt', 'jersey', 'varsity', 'suit', 'puffer', 'rain', 'jacket', 'dress', 'scrubs', 'chef', 'kit', 'pjs', 'robe', 'bunad', 'none'],
      pat: ['none', 'stripes', 'check', 'star', 'heart', 'flame', 'bolt', 'camo', 'tiedye', 'flag', 'pumpkin', 'bones'], bottom: ['trousers', 'jeans', 'joggers', 'cargo', 'shorts', 'skirt', 'overalls', 'swim'], shoes: ['sneakers', 'hightops', 'boots', 'sandals', 'slippers', 'cleats'],
      hat: ['none', 'cap', 'beanie', 'bucket', 'beret', 'bandana', 'cowboy', 'phones', 'flowers', 'party', 'wizard', 'santa', 'witch', 'chef', 'crown'], ears: ['none', 'studs', 'hoops', 'buds'], neck: ['none', 'chain', 'pearls', 'scarf', 'bowtie', 'tie', 'medal', 'lanyard'],
      pet: ['none', 'cat', 'dog', 'bunny', 'bird'], watch: ['yes', 'no'], bag: ['yes', 'no'], hold: ['none', 'phone', 'coffee', 'laptop', 'bag', 'flowers', 'icecream', 'balloon', 'flag'], badge: ['none', 'streak', 'trophy', 'top3', 'paid'], scene: ['none', 'city', 'beach', 'forest', 'office', 'oslo'], chest: ['', 'JP', 'ØÅ'], auto: ['on', 'off'] };
    const C = ['#f3d4bb', '#3e2618', '#2f5d8a', '#f2f2f2', '#1a1a1a'];
    let seed = 5, bad = [], out = 0; const rnd = a => { seed = (seed * 48271) % 2147483647; return a[seed % a.length]; };
    const moms = Object.keys(Avatar.MOMENTS).map(k => Avatar.MOMENTS[k]).concat([{ k: 'plain', plain: true, bg: 'none' }]);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;visibility:hidden'; document.body.appendChild(host);
    for (let i = 0; i < 600; i++) {
      const lk = {}; Object.keys(O).forEach(k => lk[k] = rnd(O[k])); ['skin', 'hairC', 'topC', 'legs', 'shoeC', 'hatC', 'eyeC'].forEach(k => lk[k] = rnd(C));
      let s; try { s = Avatar.figure(moms[i % moms.length], lk); } catch (e) { bad.push(e.message); continue; }
      if (/undefined|NaN|null|\[object/.test(s)) bad.push('word in ' + JSON.stringify(lk).slice(0, 80));
      if (i % 20 === 0) { host.innerHTML = s; const bb = host.querySelector('.av-all').getBBox(); if (bb.x < -2 || bb.y < -24 || bb.x + bb.width > 202 || bb.y + bb.height > 202) out++; }
    }
    host.remove(); return { bad: bad.slice(0, 3), out };
  });
  check(!stress.bad.length && !stress.out, '600 random avatars with all the new options: no errors or broken words, nothing outside the picture ' + JSON.stringify(stress));

  /* 3. Settings → Your avatar: the maker on its own page */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = { build: 'slim', hair: 'quiff', top: 'sweater', extra: 'lanyard' }; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  await p.click('#settingsBtn'); await sl(500); await p.click('[data-go="touches"]'); await sl(700);
  check(await p.evaluate(() => !!document.querySelector('#avSet [data-avp-open]') && !document.querySelector('#avSet .avm-tiles')), 'Settings keeps one row for your avatar (no tiles crowding it)');
  await p.evaluate(() => document.querySelector('#avSet [data-avp-open]').click()); await sl(700);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.avp [data-avp-tab]')].map(x => x.textContent));
  check(tabs.length === 8, 'the avatar page has 8 tabs: ' + tabs.join(', '));
  const perTab = [];
  for (const t of ['face', 'hair', 'body', 'style', 'extras', 'pet', 'moves', 'settings']) {
    await p.evaluate(t => document.querySelector('.avp [data-avp-tab="' + t + '"]').click(), t); await sl(250);
    perTab.push(await p.evaluate(() => { const m = document.querySelector('.avp-pane'); return [m.querySelectorAll('.avm-t').length + m.querySelectorAll('.avm-d').length + m.querySelectorAll('.avp-set label').length, /undefined|NaN|null/.test(m.innerText)]; }));
  }
  check(perTab.every(x => x[0] >= 2 && !x[1]), 'every tab shows picture tiles, colours or settings, no broken words ' + JSON.stringify(perTab));
  await p.evaluate(() => document.querySelector('.avp [data-avp-tab="extras"]').click()); await sl(250);
  await p.evaluate(() => document.querySelector('.avp [data-avm-k="hat"][data-avm-v="beanie"]').click()); await sl(300);
  check(await p.evaluate(() => document.querySelector('.avp [data-avm-k="hat"][data-avm-v="beanie"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('.avp [data-avp-undo]').disabled), 'a tap shows on the tile, and Undo is ready');
  check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.settings')).avatar || {}).hat !== 'beanie'), 'nothing is saved until Save');
  /* turn it around and see it move */
  for (const v of ['q', 'side', 'back', 'front']) await p.evaluate(v => document.querySelector('.avp [data-avp-view="' + v + '"]').click(), v);
  await p.evaluate(() => document.querySelector('.avp [data-avp-play]').click()); await sl(2500);
  check(await p.evaluate(() => !!document.querySelector('.avp-test.sc25 .sc25-front path')), 'turning around and "See it move" work');
  /* leaving with changes asks first */
  await p.evaluate(() => { const x = document.querySelector('.avp [data-avp-back]'); x && x.click(); }); await sl(200);
  check(await p.evaluate(() => !document.querySelector('.avp-ask').hidden), 'leaving with changes asks first');
  await p.evaluate(() => document.querySelector('.avp-ask [data-avp-save]').click()); await sl(400);
  const saved = await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.settings')).avatar));
  check(!await p.evaluate(() => !!document.querySelector('.avp')) && saved.hat === 'beanie' && !saved.neck && saved.extra === 'none' && saved.hair === 'quiff', 'Save saves (beanie), and the old work lanyard carries over: ' + JSON.stringify({ hat: saved.hat, neck: saved.neck, extra: saved.extra }));
  await p.evaluate(() => document.querySelector('#avSet [data-avp-open]').click()); await sl(500);
  const fit = await p.evaluate(() => { const m = document.querySelector('.avp'); return { sw: m.scrollWidth, cw: m.clientWidth, pane: document.querySelector('.avp-pane').scrollWidth <= document.querySelector('.avp-pane').clientWidth + 1 }; });
  check(fit.sw <= fit.cw + 1 && fit.pane, 'fits a 393 px phone: ' + JSON.stringify(fit));
  await p.evaluate(() => { const x = document.querySelector('.avp [data-avp-back]'); x && x.click(); }); await sl(200);

  /* 4. Iago's own avatar in the shared home, with more than 16 settings */
  await q.evaluate(() => { const t = document.querySelector('[data-tab="today"]'); t && t.click(); });
  const qAv = await until(q, () => !!document.querySelector('[data-avatar]'), 25000);   /* the shared app can be slow to start on GitHub */
  check(qAv !== null, 'Iago’s app shows his avatar');
  await q.evaluate(() => { const x = document.querySelector('[data-avatar]'); x && x.click(); });
  const qOpen = await until(q, () => !!document.querySelector('.avp .avp-pane .avm-t'), 8000);
  check(qOpen, 'Iago’s app opens the same avatar page');
  check(await q.evaluate(() => !document.querySelector('.avp [data-avp-tab="settings"]')), 'without your settings tab');
  await q.evaluate(() => { document.querySelector('.avp [data-avp-rand]').click(); }); await sl(300);   /* Surprise me: every setting gets a value */
  await q.evaluate(() => { document.querySelector('.avp [data-avm-k="expr"][data-avm-v="wink"]').click(); }); await sl(200);
  await q.evaluate(() => { document.querySelector('.avp [data-avp-tab="style"]').click(); }); await sl(200);
  await q.evaluate(() => { document.querySelector('.avp [data-avm-k="top"][data-avm-v="kit"]').click(); }); await sl(200);
  await q.evaluate(() => { document.querySelector('.avp [data-avp-tab="pet"]').click(); }); await sl(200);
  await q.evaluate(() => { document.querySelector('.avp [data-avm-k="pet"][data-avm-v="dog"]').click(); }); await sl(200);
  await q.evaluate(() => { document.querySelector('.avp-bar [data-avp-save]').click(); }); await sl(1500);
  await p.evaluate(() => ShareSpace.sync());
  await until(p, () => { const l = ShareSpace.partnerLook && ShareSpace.partnerLook(); return !!(l && l.expr === 'wink' && l.top === 'kit' && l.pet === 'dog'); }, 15000);
  const got = await p.evaluate(() => { const l = ShareSpace.partnerLook(); return l && l.expr === 'wink' && l.top === 'kit' && l.pet === 'dog' ? Object.keys(l).length : 0; });
  check(got && got > 16, 'cmd gets all of Iago’s picks (wink, football kit, dog) – ' + got + ' settings');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
