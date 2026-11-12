/* The avatar's day and the two of you (C10):
   - dressed for the weather: cold → padded jacket, beanie, scarf; warm → T-shirt (only your own avatar, only with
     "Dress for the weather" on); a badge you earn shows (today's top 3 done) unless you picked one yourself
   - the sofa picture: you sit on it
   - "Match with …" in the avatar page puts their top on you, Undo gives yours back
   - the shared pet: picked in cmd, it stands in the picture of the two of you in Iago's app; Iago can pick it too
   Made-up data only. */
const { shared, until, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  /* weather and badges */
  const day = await p.evaluate(() => {
    const L = Object.assign({}, Avatar.look(), { auto: 'off', top: 'sweater', hat: 'none' }), now = Date.now();
    localStorage.setItem('dash.wxNow', JSON.stringify({ code: 3, t: -6, at: now }));
    const cold = Avatar.dressed(L);
    localStorage.setItem('dash.wxNow', JSON.stringify({ code: 0, t: 26, at: now }));
    const warm = Avatar.dressed(L);
    const td = Features.dkey(new Date()); localStorage.setItem('dash.todos', JSON.stringify([1, 2, 3].map(i => ({ id: 't' + i, text: 'Made up ' + i, today: td, done: true }))));
    const earned = Avatar.dressed(L), trimmed = Avatar.trimLook(Object.assign({}, L, { badge: 'trophy', neck: 'tie', pat: 'stripes', topC: '#d93a3a', hair: 'mullet', hat: 'beret', glasses: 'monocle' }));
    const sofa = Avatar.couple('sofa', L, L, {}), hold = Avatar.couple('hold', L, L, {});
    return { cold: [cold.top, cold.hat, cold.wxScarf ? 'scarf' : 'none'], warm: warm.top, earned: earned.badge || 'none', trimmed: [trimmed.badge, trimmed.neck, trimmed.pat, trimmed.topC, trimmed.hair, trimmed.hat, trimmed.glasses].join(','), seated: /scale\(1 \.56\)|av-sit/.test(sofa) && !/scale\(1 \.56\)|av-sit/.test(hold) };
  });
  check(day.cold.join(',') === 'puffer,beanie,scarf', 'cold: a padded jacket, beanie and scarf ' + day.cold);
  check(day.warm === 'tee', 'warm: a T-shirt instead of the sweater (' + day.warm + ')');
  check(day.earned === 'none', 'no earned badges any more, even with today’s top 3 done (' + day.earned + ')');
  check(day.trimmed === ',,,#2f7a55,side,beanie,round', 'F0: removed settings go, removed choices become the nearest kept one, tops get the standard colour (' + day.trimmed + ')');
  check(day.seated, 'on the sofa you sit');
  /* the two of you: Iago has an avatar */
  /* (slow machines: wait for his app, and try again if the first save didn't reach the box) */
  let ci = null;
  for (let tries = 0; tries < 3 && ci === null; tries++) {
    await until(q, () => !!document.querySelector('[data-avatar]'), 20000);
    await q.evaluate(() => { const b = document.querySelector('[data-avatar]'); if (b) b.click(); });
    await until(q, () => !!document.querySelector('.avp [data-avp-rand]'), 10000);
    await q.evaluate(() => { const x = document.querySelector('.avp [data-avp-rand]'); if (x) x.click(); const sv = document.querySelector('.avp [data-avp-back]'); if (sv) sv.click(); });
    await until(q, () => !!document.querySelector('.avp-ask [data-avp-save]'), 5000);
    await q.evaluate(() => { const s = document.querySelector('.avp-ask [data-avp-save]'); if (s) s.click(); }); await sl(1500);
    await q.evaluate(() => window.HomeApp && HomeApp.sync ? HomeApp.sync() : null); await sl(1200);
    await p.evaluate(() => ShareSpace.sync()); await sl(1500); await p.evaluate(() => ShareSpace.sync()); await sl(1000);
    ci = await until(p, () => { const c = window.CoupleInfo && CoupleInfo(); return c && c.look ? c.kind : false; }, 15000);
  }
  check(ci !== null, 'cmd knows the two of you (' + ci + ')');
  /* Match with Iago */
  await p.evaluate(() => { const b = document.querySelector('[data-avp-open]'); if (b) b.click(); else Avatar.page('T', Avatar.look(), () => {}, { mine: true, match: { look: ShareSpace.partnerLook(), name: ShareSpace.partnerName() } }); }); await sl(800);
  const m = await p.evaluate(() => { const btn = document.querySelector('.avp [data-avp-match]'); if (!btn) return { btn: false };
    const lbl = btn.textContent.trim(), before = document.querySelector('.avp-fig').innerHTML; btn.click();
    const after = !document.querySelector('.avp [data-avp-undo]').disabled; document.querySelector('.avp [data-avp-undo]').click();
    return { btn: true, lbl, after, undo: !document.querySelector('.avp [data-avp-undo]').disabled === false }; });
  check(m.btn && /^Match with |^Match med /.test(m.lbl), 'the avatar page offers "' + m.lbl + '"');
  check(m.after, 'a tap puts their outfit on you (Undo is offered)');
  await p.evaluate(() => { const x = document.querySelector('.avp [data-avp-back]'); if (x) x.click(); const d = document.querySelector('.avp-ask [data-avp-drop]'); if (d) d.click(); }); await sl(400);
  /* the shared pet, picked in cmd → in Iago's picture of the two of you */
  await p.evaluate(() => ShareSpace.setPet('dog')); await sl(500); await p.evaluate(() => ShareSpace.sync()); await sl(2000);
  await q.evaluate(() => { const t = document.querySelector('[data-tab="today"]'); if (t) t.click(); });
  const pet = await until(q, () => { const c = document.querySelector('.h-couple svg'); return !!(c && c.querySelector('.av-pet')); }, 15000);
  check(pet !== null, 'the shared dog stands in Iago’s picture of the two of you');
  check(await p.evaluate(() => ShareSpace.sharedPet()) === 'dog', 'cmd has the dog too');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
