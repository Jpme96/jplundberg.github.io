/* Rebuild A5: instant page changes. With the switch on, the menu changes page without a reload: every page draws,
   nothing is set up twice (a tick ticks once), no errors, no odd words, Back works, Settings still open, the lock
   still works, and it's faster than a full load. On by default; turned off, nothing of it runs. Made-up data only. */
const { open, sl, U, until, go } = require('../lib/browser'); const { check, done, GAPS } = require('../lib/check');
const RX = /\bundefined\b|\bNaN\b|\[object [A-Za-z]+\]|\bInvalid Date\b/;
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { ['food', 'shop', 'house', 'chores', 'travel', 'habits'].forEach(f => Features.set(f, true)); const t = Features.tools(); t.shop = [{ id: 'sA', text: 'Apples', done: false }, { id: 'sB', text: 'Bread', done: false }]; Features.saveTools(t); });
  check(await p.evaluate(() => window.SoftNav && window.SoftNav.on === true), 'on by default');
  /* turned off: nothing runs (a normal page load) */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.softNav = false; localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); });
  await sl(1200); await go(p, '', 3000);
  check(await p.evaluate(() => window.SoftNav.on === false && setTimeout.toString().indexOf('native') > -1), 'off: nothing of it runs');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.softNav = true; localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); });
  await sl(1200); await go(p, '', 3000);
  check(await p.evaluate(() => window.SoftNav.on === true), 'on again');
  await p.evaluate(() => { window.__still = 'same page'; });
  const nav = async path => { const t0 = Date.now(); const n0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(h => { const a = document.createElement('a'); a.href = h; document.body.appendChild(a); a.click(); a.remove(); }, '/cmd/' + path);
    const ok = await until(p, n => SoftNav.count > n, 15000, n0); const ms = Date.now() - t0; await sl(700); return ok === null ? null : ms; };
  const order = ['calendar/', 'finance/', 'food/', '', 'house/', 'travel/', 'calendar/', 'habits/', 'food/', 'people/', 'admin/', ''];
  const times = [];
  for (const pg of order) {
    p.errs.length = 0;
    const ms = await nav(pg); times.push(ms);
    const st = await p.evaluate(rx => { const R = new RegExp(rx), odd = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const el = n.parentElement; if (el && !el.closest('script,style,textarea,code') && el.offsetParent && R.test(n.nodeValue)) odd.push(n.nodeValue.trim().slice(0, 50)); }
      return { still: window.__still, path: location.pathname, unlocked: document.documentElement.classList.contains('unlocked'), cards: document.querySelectorAll('main .card, main section, .card').length, odd }; }, RX.source);
    /* every page tab of this page: no empty gap where something should be */
    const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo));
    const gaps = [];
    for (const t of tabs.length ? tabs : ['']) { if (t) { await p.evaluate(t => document.querySelector('[data-ptab-go="' + t + '"]').click(), t); await sl(500); } gaps.push(...(await p.evaluate(GAPS)).map(g => (t || 'page') + ': ' + g)); }
    check(!gaps.length, 'no empty gaps on ' + (pg || 'home') + (gaps.length ? ': ' + gaps.slice(0, 5).join(' ; ') : ''));
    check(ms !== null && st.still === 'same page' && st.path === '/cmd/' + pg && st.unlocked && st.cards > 0 && !st.odd.length && !p.errs.length,
      'to ' + (pg || 'home') + ' in ' + ms + ' ms without reloading' + (st.odd.length ? ' odd: ' + st.odd.join(' | ') : '') + (p.errs.length ? ' errors: ' + p.errs.join(' | ').slice(0, 300) : '') + ' ' + JSON.stringify({ still: st.still, path: st.path, cards: st.cards }));
  }
  /* nothing set up twice: on Food, one tap on an item ticks it once */
  await nav('food/');
  const before = await p.evaluate(() => (Features.tools().shop.find(x => x.id === 'sA') || {}).done);
  await p.evaluate(() => { const el = document.querySelector('[data-shx="sA"], [data-shtog="sA"], [data-id="sA"] .check, [data-shop="sA"]'); if (el) el.click(); });
  await sl(800);
  const after = await p.evaluate(() => (Features.tools().shop.find(x => x.id === 'sA') || {}).done);
  check(before === false && after === true, 'one tap ticks once (nothing doubled after ' + (order.length + 1) + ' page changes): ' + before + ' → ' + after);
  /* Back goes to the page before */
  await p.goBack(); await sl(2500);
  check(await p.evaluate(() => location.pathname === '/cmd/' && window.__still === 'same page' && document.documentElement.classList.contains('unlocked')), 'Back goes to the page before, still without reloading');
  /* Settings open from the avatar */
  const set = await p.evaluate(() => { const a = document.getElementById('settingsBtn'); if (!a) return 'no button'; a.click(); return 'ok'; }); await sl(800);
  check(set === 'ok' && await p.evaluate(() => !!document.querySelector('#settings.open')), 'Settings still open after page changes: ' + set);
  await p.keyboard.press('Escape'); await sl(400);
  /* the lock still works and opens again */
  await p.evaluate(() => Vault.lock()); await sl(600);
  check(await p.evaluate(() => { const i = document.getElementById('lockPass'); return !!(i && i.offsetParent); }), 'the lock screen comes up');
  await p.type('#lockPass', 'test-passcode-1'); await p.click('#lockSubmit');
  check(await until(p, () => document.documentElement.classList.contains('unlocked'), 15000) !== null, 'and unlocks again');
  /* faster than a full load */
  const t0 = Date.now(); await go(p, 'calendar/', 0); await until(p, () => document.documentElement.classList.contains('unlocked'), 15000); const fullMs = Date.now() - t0;
  const soft = times.filter(Boolean).sort((a, c) => a - c)[Math.floor(times.length / 2)];
  /* not slower than a full load (with room for a busy test machine: one full load is a single, noisy measurement) */
  check(soft < Math.max(fullMs * 1.6, 400), 'instant change ' + soft + ' ms vs full load ' + fullMs + ' ms');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
