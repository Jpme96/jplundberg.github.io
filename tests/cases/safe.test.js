/* Safety nets (Phase C step 6): /cmd/?safe turns the extras off with a "Back to normal" bar; two starts in a row
   that never reach the lock screen open safe mode by themselves; two failed page changes pause instant page
   changes on this device (shown in Diagnostics, with "Try again"). */
const { open, go, until, sl, U, unlock } = require('../lib/browser'); const { check, done } = require('../lib/check');
const clickTo = (p, pg) => p.evaluate(pg => { const a = document.querySelector('a[href="/cmd/' + pg + '/"], a[href="/cmd/' + pg + '"]'); if (a) { a.click(); return true; } location.href = '/cmd/' + pg + '/'; return false; }, pg);
const state = p => p.evaluate(() => ({ bar: !!document.getElementById('safeBar'), off: document.documentElement.classList.contains('mo-off'), sn: !!(window.SoftNav && window.SoftNav.on), safe: window.__safeMode || '', path: location.pathname, text: (document.getElementById('safeBar') || {}).textContent || '' }));
(async () => {
  const { b, p } = await open(393, { path: '?safe' });
  let s = await state(p);
  check(s.bar && s.off && !s.sn && s.safe === 'asked', '?safe: the bar shows, animations and instant page changes are off ' + JSON.stringify(s));
  check(!/undefined|null|NaN/.test(s.text) && /Back to normal/.test(s.text), 'the bar reads well: ' + s.text);
  const bar = await p.evaluate(() => { const r = document.getElementById('safeBar').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check(bar.w <= 393 && bar.h < 120, 'the bar fits a phone ' + JSON.stringify(bar));
  /* it stays on while moving around (normal loads) */
  await clickTo(p, 'calendar'); await sl(2500);
  if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);
  s = await state(p);
  check(s.path === '/cmd/calendar/' && s.bar && !s.sn, 'still safe mode on the next page ' + JSON.stringify(s));
  /* Back to normal */
  await Promise.all([p.waitForNavigation({ timeout: 15000 }).catch(() => {}), p.click('#safeBack')]);
  await sl(1500);
  if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);
  s = await state(p);
  check(!s.bar && s.sn && !s.safe, 'Back to normal: the bar is gone and instant page changes are back ' + JSON.stringify(s));

  /* the crash guard: two starts that never got to the lock screen */
  await p.evaluate(() => localStorage.setItem('dash.boot', JSON.stringify({ n: 2, at: Date.now() })));
  await go(p, '', 1500);
  s = await state(p);
  check(s.safe === 'crash' && s.bar && /twice/.test(s.text), 'after two failed starts the next one opens in safe mode with a note ' + JSON.stringify(s));
  const logged = await p.evaluate(() => Diag.list().some(e => e.k === 'crash'));
  check(logged, 'and it is in the error log');
  await sl(1500);
  check(await p.evaluate(() => !localStorage.getItem('dash.boot')), 'a start that reaches the lock screen clears the count');
  await Promise.all([p.waitForNavigation({ timeout: 15000 }).catch(() => {}), p.click('#safeBack')]);
  await sl(1500);
  if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);

  /* self-healing page changes: two failures → normal loads on this device */
  /* from now on, every new page refuses to fetch other pages (also the early fetch of the menu pages) */
  await p.evaluateOnNewDocument(() => { if (sessionStorage.getItem('t.nopage')) { const f = window.fetch; window.fetch = function (u) { if (/^\/cmd\/[a-z]*\/?$/.test(String(u && u.url || u))) return Promise.reject(new Error('test: no page')); return f.apply(this, arguments); }; } });
  await p.evaluate(() => sessionStorage.setItem('t.nopage', '1'));
  await go(p, '', 1500);
  for (let i = 0; i < 2; i++) {
    const went = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href^="/cmd/"]')].filter(x => /^\/cmd\/[a-z]*\/?$/.test(x.getAttribute('href')) && x.pathname !== location.pathname && x.offsetParent)[0]; if (a) a.click(); return a ? a.getAttribute('href') : ''; });
    check(!!went, 'round ' + (i + 1) + ': tapped a menu link (' + went + ')');
    await sl(3000);
    if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);
  }
  const ps = await p.evaluate(() => ({ paused: !!(window.SoftNav && SoftNav.paused), on: !!(window.SoftNav && SoftNav.on), log: Diag.list().some(e => /paused on this device/.test(e.m)) }));
  check(ps.paused && !ps.on && ps.log, 'after 2 failed page changes this device uses normal loads, and says so ' + JSON.stringify(ps));
  await p.evaluate(() => sessionStorage.removeItem('t.nopage'));
  await go(p, 'admin/', 1500);
  await p.evaluate(() => { const b = document.querySelector('[data-go="diag"]'); if (b) b.click(); });
  await until(p, () => !!document.getElementById('dgSnTry'), 8000);
  const row = await p.evaluate(() => !!document.getElementById('dgSnTry'));
  check(row, 'Diagnostics shows it with "Try again"');
  await Promise.all([p.waitForNavigation({ timeout: 15000 }).catch(() => {}), p.evaluate(() => document.getElementById('dgSnTry').click())]);
  await sl(1500);
  if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);
  check(await p.evaluate(() => !!SoftNav.on && !SoftNav.paused), 'Try again turns them back on');
  check(!p.errs.filter(e => !/test: no page/.test(e)).length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
