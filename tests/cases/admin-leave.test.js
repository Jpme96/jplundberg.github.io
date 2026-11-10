/* Two false alarms in Settings → Diagnostics (2026-11-10):
   1. Leaving Admin (instant page change) while its checks were still loading: when they came back, Admin tried to draw
      on the page you had moved to – "admin: Cannot set properties of null". Admin must just stay quiet.
   2. The shared-app preview (a dark full-screen popup) over the side bar was reported as "Two things on the screen
      cover each other". A popup that covers everything on purpose is not an overlap.
   Made-up data only. */
const { open, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  /* side bar with icons only – the menu the report came from */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'side'; localStorage.setItem('dash.settings', JSON.stringify(s)); localStorage.setItem('dash.sideNav', 'icons'); window.dispatchEvent(new Event('dash:local')); });
  await sl(1000);
  check(await p.evaluate(() => window.SoftNav && window.SoftNav.on === true), 'instant page changes are on');

  /* answers from the server take 3 s, so Admin's checks are still out when we leave (slowed in the browser's network,
     not in the page – the page wraps fetch itself on every page change) */
  let slow = false, out = 0;
  p.removeAllListeners('request');
  p.on('request', r => { const u = r.url();
    if (!u.startsWith('http://localhost')) return r.abort();
    if (slow && /\/cmd\/api\/(site|ping|visitors|content)/.test(u)) { out++; return setTimeout(() => { out--; r.continue().catch(() => {}); }, 3000); }
    r.continue(); });
  const waitFor = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sl(100); } return false; };
  const nav = async path => { const n0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(h => { const a = document.createElement('a'); a.href = h; document.body.appendChild(a); a.click(); a.remove(); }, '/cmd/' + path);
    return until(p, n => SoftNav.count > n, 15000, n0); };

  await p.evaluate(() => Diag.clear()); slow = true;
  p.errs.length = 0;
  check(await nav('admin/') !== null, 'to Admin without reloading');
  check(await waitFor(() => out > 0, 8000), 'Admin has started its checks …');
  check(await nav('papers/') !== null, 'and on to Papers before they come back');
  check(await waitFor(() => out === 0, 10000), '… which now come back'); await sl(800);
  const errs = await p.evaluate(() => Diag.list().filter(x => x.k === 'error').map(x => x.m + ' @' + x.a));
  check(!errs.some(e => /admin/i.test(e)), 'Admin stays quiet after you left it' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
  check(await p.evaluate(() => location.pathname === '/cmd/papers/' && !document.getElementById('crRoot')), 'still on Papers, nothing of Admin drawn there');
  slow = false;

  /* coming back to Admin still draws it */
  check(await nav('admin/') !== null, 'back to Admin');
  check(await until(p, () => { const r = document.getElementById('crRoot'); return !!(r && r.querySelector('#crTop') && r.innerText.trim()); }, 8000) !== null, 'Admin draws again when you come back');

  /* the shared-app preview over the side bar is not an overlap */
  await p.evaluate(() => { Diag.clear();
    const bg = document.createElement('div'); bg.className = 'sh-prev-bg';
    bg.innerHTML = '<div class="sh-prev"><div class="sh-prev-head"><b>Preview</b><button type="button" class="icon-btn sm" data-shprevx aria-label="Close">×</button></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(() => bg.classList.add('open')); });
  await sl(500);
  await p.evaluate(() => Diag.scanNow());
  await sl(300);
  const lay = await p.evaluate(() => Diag.list().filter(x => x.k === 'layout').map(x => x.m + ' — ' + x.a));
  check(!lay.some(x => /cover each other/.test(x) && /sh-prev-bg/.test(x)), 'the shared-app preview is not reported as covering the menu' + (lay.length ? ': ' + lay.join(' | ').slice(0, 300) : ''));
  await p.evaluate(() => document.querySelectorAll('.sh-prev-bg').forEach(x => x.remove()));

  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
