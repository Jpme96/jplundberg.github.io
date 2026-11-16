/* JP's live check of 15 Nov 2026 (late) – made-up data only:
   - the live line under a title comes out in Norwegian even when a page makes it in English (House: "Read the meter")
   - Norwegian weekday letters in Norwegian (Home's "This week", Health's habits: M T O T F L S, not M T W T F S S)
   - the wish list's line keeps " · " between "1 wish" and "0 fit this month" (they were glued together), "1 ønske" not "1 ønsker"
   - Apple Health: more than 24 "stand hours" in a day can only be minutes – shown as min; the % says it is against last week
   - Settings on a computer is a sheet of at most 860 px, not the whole page */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => {
    Features.LIST.forEach(f => Features.set(f.id, true));
    const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; s.simple = false; localStorage.setItem('dash.settings', JSON.stringify(s));
    const t = Features.tools(); t.wishes = [{ id: 'w1', title: 'Testlampe', price: 900, added: Date.now() - 864e5 * 10 }]; Features.saveTools(t);
    const d = Vault.get(); d.health = { days: {} }; const k = x => { const q = new Date(Date.now() - x * 864e5); return q.getFullYear() + '-' + String(q.getMonth() + 1).padStart(2, '0') + '-' + String(q.getDate()).padStart(2, '0'); };
    for (let i = 0; i < 14; i++) d.health.days[k(i)] = { steps: 6000 + i * 100, stand: 40 + i };
    Vault.save(d);
  });
  await sl(600);

  await go(p, '', 2500);
  const home = await p.evaluate(() => {
    const heads = [...document.querySelectorAll('.hb-head')].slice(0, 7).map(e => e.textContent).join('');
    return { heads };
  });
  check(!home.heads || home.heads === 'MTOTFLS', 'Home\'s week has Norwegian weekday letters (' + home.heads + ')');

  await go(p, 'wish/', 2500);
  const wish = await p.evaluate(() => document.body.innerText);
  const live = await p.evaluate(() => { PageLive.set(['Read the meter']); return (document.querySelector('.fp-live') || {}).textContent || ''; });
  check(live && !/Read the meter/.test(live), 'the live line is translated (' + live + ')');
  check(!/ønske\d/.test(wish), 'the wish line has a separator between its parts');
  check(!/\b1 ønsker\b/.test(wish), '"1 ønske", not "1 ønsker"');

  /* Travel has the same page top as every page: kicker → title → live line (2026-11-16) */
  await go(p, 'travel/', 2500);
  const tv = await p.evaluate(() => { const h = document.querySelector('.fp-hero'); return h ? { kicker: !!h.querySelector('.fp-kicker'), title: (h.querySelector('h1') || {}).textContent } : null; });
  check(tv && tv.kicker && /^Reise$/.test((tv.title || '').trim()), 'Travel\'s page top: kicker and title ' + JSON.stringify(tv));
  /* People's tile: no "0 å holde kontakten med"; the 14 days list: no English "on" */
  await go(p, 'people/', 2500);
  check(await p.evaluate(() => !/\b0 å holde kontakten med\b/.test(document.body.innerText)), 'People: no "0 å holde kontakten med"');
  await go(p, 'habits/', 2800);
  const hl = await p.evaluate(() => { const tl = [...document.querySelectorAll('.ah-tile')].find(e => /person-standing/.test(e.innerHTML)); return tl ? tl.innerText : ''; });
  check(!hl || (/min/.test(hl) && !/\d+ h\b/.test(hl)), 'stand over 24 in a day is shown as minutes (' + hl.replace(/\n/g, ' ') + ')');

  const st = await p.evaluate(async () => { const bt = document.getElementById('settingsBtn'); if (!bt) return null; bt.click(); await new Promise(r => setTimeout(r, 900)); const pn = document.querySelector('#settings .st-panel'); return pn ? pn.getBoundingClientRect().width : null; });
  check(st == null || st <= 862, 'Settings is at most 860 px wide on a computer (' + st + ')');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
