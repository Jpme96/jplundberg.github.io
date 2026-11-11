/* The app uses what it already knows (walkthrough, 2026-11-10), with sharing on and Iago as the partner:
   - House → Shared fills in Iago instead of asking who you live with
   - People offers "Add Iago" in one tap until he's in the list, and the empty picture shows you, not just grass
   - Travel's picture only names a route you searched; an upcoming event with a place says "Plan the trip"
   - Admin shows no Resend key light while the email backup isn't set up on the server
   - Diagnostics treats any full-screen popup as a popup (no "two things cover each other")
   Made-up data only. */
const { shared, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2 } = await shared(393);
  await p.setViewport({ width: 1280, height: 900 }); await go(p, '', 1500);
  await p.evaluate(() => {
    ['house', 'people', 'hshared'].forEach(f => Features.set(f, true));
    const dk = n => { const d = new Date(); d.setDate(d.getDate() + n); return Features.dkey(d); };
    Quick.add({ kind: 'event', title: 'Dentist', date: dk(1), start: '09:30', location: 'Storgata 1, Oslo' });
    try { localStorage.removeItem('dash.tvLegs'); localStorage.removeItem('dash.tvMode'); } catch (e) {}
  });
  await sl(1200);

  /* House → Shared */
  await go(p, 'house/', 2200);
  await p.evaluate(() => { const x = document.querySelector('[data-ptab-go="shared"]'); x && x.click(); }); await sl(800);
  const who = await p.evaluate(() => { const i = document.querySelector('form[data-hs2setup] input[name="who"]'); return i ? i.value : null; });
  check(who === 'Iago', 'House → Shared already knows who you live with: ' + JSON.stringify(who));
  check(await p.evaluate(() => /Split what you buy for the home with Iago/.test(document.querySelector('form[data-hs2setup]').textContent)), '… and says so');

  /* People */
  await go(p, 'people/', 2200);
  check(await p.evaluate(() => !!document.querySelector('[data-scme], #scIllu .hero')), 'People with nobody yet: the picture shows you waving, not just grass');
  await until(p, () => !!document.querySelector('.pp-suggest'), 20000);   /* the offer can come a moment after the page */
  const sug = await p.evaluate(() => { const x = document.querySelector('.pp-suggest'); return x ? x.textContent.trim() : ''; });
  check(/Add Iago/.test(sug), 'People offers "Add Iago": ' + JSON.stringify(sug));
  await p.click('.pp-suggest'); await sl(1200);
  check(await p.evaluate(() => (Features.tools().people || []).some(x => x.name === 'Iago')) && await p.evaluate(() => !document.querySelector('.pp-suggest')), 'one tap adds him, and the offer goes away');

  /* Travel */
  await go(p, 'travel/', 2500);
  const cap = await p.evaluate(() => document.body.innerText);
  check(!/Work ⇄ Home/.test(cap) && /Search a journey/.test(cap), 'Travel: no made-up "Work ⇄ Home" route before any search');
  check(await p.evaluate(() => { const c = [...document.querySelectorAll('#tvNext .tv-nx')].find(x => /Dentist/.test(x.textContent)); return !!c && /Plan the trip/.test(c.textContent); }), 'the Dentist card says "Plan the trip"');

  /* Admin: the Resend key light only while email backup is set up */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.admin = Object.assign({}, s.admin || {}, { resendExpiry: '2026-01-01' }); localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); });
  let ready = true;
  p.removeAllListeners('request');
  p.on('request', r => { const u = r.url(); if (!u.startsWith('http://localhost')) return r.abort();
    if (/\/cmd\/api\/backup$/.test(u) && r.method() === 'GET') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready, cfg: {}, last: null }) });
    r.continue(); });
  for (const rd of [true, false]) {
    ready = rd; await go(p, 'admin/', 3500);
    const has = await p.evaluate(() => /Resend key/.test(document.getElementById('crRoot').innerText));
    check(has === rd, 'Admin: Resend key light ' + (rd ? 'shows while email backup is set up' : 'is gone while it isn\'t set up'));
  }

  /* Diagnostics: a new kind of full-screen popup is not an overlap */
  await go(p, '', 2000);
  await p.evaluate(() => { Diag.clear(); const x = document.createElement('div'); x.className = 'brand-new-popup';
    x.style.cssText = 'position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.5);display:grid;place-items:center';
    x.innerHTML = '<div><button type="button" style="position:fixed;top:0;left:0;width:300px;height:300px">Close</button></div>'; document.body.appendChild(x); });
  await sl(300); await p.evaluate(() => Diag.scanNow()); await sl(300);
  const lay = await p.evaluate(() => Diag.list().filter(x => x.k === 'layout' && /cover each other/.test(x.m)).map(x => x.a));
  check(!lay.length, 'Diagnostics: a full-screen popup it has never heard of is not "two things cover each other" ' + JSON.stringify(lay));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b, b2);
})();
