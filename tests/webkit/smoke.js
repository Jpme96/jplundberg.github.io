/* The Safari check: the things that have broken on the Mac before, run in WebKit (Safari's engine).
   - unlock with a passcode, change pages through the menu (instant page changes), Back, open Settings, lock
   - the avatar maker opens and a tap changes the avatar
   - the weather canvas draws
   - no page errors anywhere
   Runs on GitHub (npx playwright install webkit). Locally: ENGINE=chromium node tests/webkit/smoke.js
   Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const pw = require('playwright'); const ENGINE = process.env.ENGINE || 'webkit', PORT = +(process.env.PORT || 8790), U = 'http://localhost:' + PORT + '/cmd/';
const sl = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const up = () => new Promise(r => { const q = http.get(U, res => { res.resume(); r(true); }); q.on('error', () => r(false)); });
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'server.mjs')], { env: Object.assign({}, process.env, { D1: '1', R2: '1', LIVE: '1', PORT: String(PORT) }), stdio: ['ignore', 'ignore', 'pipe'] });
  let serr = ''; srv.stderr.on('data', d => { serr += d; });
  for (let i = 0; i < 50 && !(await up()); i++) await sl(200);
  if (!(await up())) console.log('  the test server did not start: ' + serr.slice(-800));
  const b = await pw[ENGINE].launch(); const errs = [];
  try {
    for (const W of [1280, 393]) {
      const ctx = await b.newContext({ viewport: { width: W, height: W < 700 ? 852 : 900 }, isMobile: W < 700 && ENGINE !== 'firefox', hasTouch: W < 700 });
      const p = await ctx.newPage(); p.on('pageerror', e => errs.push(W + ': ' + e.message));
      await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
      await p.goto(U); await p.waitForSelector('#lockPass', { state: 'visible', timeout: 15000 });
      await p.fill('#lockPass', 'test-passcode-1');
      if (await p.locator('#lockConfirm').isVisible().catch(() => false)) await p.fill('#lockConfirm', 'test-passcode-1');
      await p.click('#lockSubmit');
      const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text()));
      const unl = await p.waitForFunction(() => document.documentElement.classList.contains('unlocked'), null, { timeout: 30000, polling: 250 }).then(() => true, () => false);
      if (!unl) console.log('  not unlocked – the lock screen says: ' + JSON.stringify(await p.evaluate(() => { const l = document.getElementById('lock') || document.body; return (l.innerText || '').slice(0, 300) + ' | secure ' + window.isSecureContext + ' | subtle ' + !!(window.crypto && crypto.subtle); })) + ' | console: ' + logs.slice(-6).join(' / ').slice(0, 600));
      check(unl, W + ' px: unlocked');
      if (!unl) { await ctx.close(); continue; }
      /* instant page changes through the menu – the Mac once got stuck on Home */
      const pages = ['calendar', 'finance', 'habits', 'travel', 'people', ''];
      let moved = 0;
      /* the glide: in Safari the new page's content glides in after the swap (C10) */
      const gl0 = await p.evaluate(() => (window.SoftNav && SoftNav.glides) || 0);
      for (const pg of pages) {
        const ok = await p.evaluate(pg => { const a = document.querySelector('a[href="/cmd/' + pg + '"], a[href="/cmd/' + pg + (pg ? '/' : '') + '"]'); if (!a) return false; a.click(); return true; }, pg);
        if (!ok) { await p.goto(U + pg + (pg ? '/' : '')); }
        /* reached = the address changed and the page shows (unlocked, or the lock screen after a full load – then unlock again) */
        let there = false;
        for (let t = 0; t < 60 && !there; t++) {
          // a manual loop: survives a fallback full load (the page context is replaced) and busy animation frames
          there = await p.evaluate(pg => location.pathname === '/cmd/' + pg + (pg ? '/' : '') && document.readyState !== 'loading' && (document.documentElement.classList.contains('unlocked') || !!(document.getElementById('lockPass') || {}).offsetParent), pg).catch(() => false);
          if (!there) await p.waitForTimeout(250);
        }
        if (there && !(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) { await p.fill('#lockPass', 'test-passcode-1'); await p.click('#lockSubmit'); await p.waitForFunction(() => document.documentElement.classList.contains('unlocked'), null, { timeout: 15000, polling: 250 }).catch(() => {}); }
        if (there) moved++; else console.log('    (did not reach /' + pg + ' – at ' + await p.evaluate(() => location.pathname + ' unlocked=' + document.documentElement.classList.contains('unlocked') + ' lockvis=' + !!(document.getElementById('lockPass') || {}).offsetParent + ' title=' + document.title) + ')');
        await sl(400);
      }
      check(moved === pages.length, W + ' px: page changes reach every page (' + moved + '/' + pages.length + ')');
      if (ENGINE === 'webkit') { const gl = await p.evaluate(g0 => ((window.SoftNav && SoftNav.glides) || 0) - g0, gl0); check(gl >= 3, W + ' px: pages glide in (' + gl + ' of ' + pages.length + ')'); }
      const clickable = await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, 200); return !!e && getComputedStyle(document.body).pointerEvents !== 'none'; });
      check(clickable, W + ' px: the page can be clicked after the changes');
      await p.goBack(); await sl(800);
      check(await p.evaluate(() => document.documentElement.classList.contains('unlocked')), W + ' px: Back works');
      /* the weather canvas */
      await p.evaluate(() => localStorage.setItem('dash.wxNow', JSON.stringify({ code: 63, at: Date.now() })));
      await p.goto(U); await sl(2500);
      check(await p.evaluate(() => !!document.querySelector('#dlWx canvas') || !document.getElementById('dlWx')), W + ' px: weather draws (or is off)');
      /* Settings → Your avatar: the page opens, a tap and Save save, the turn-around and "See it move" work */
      if (await p.locator('#settingsBtn').isVisible().catch(() => false)) {
        await p.click('#settingsBtn'); await sl(600);
        await p.evaluate(() => { const g = document.querySelector('[data-go="touches"]'); g && g.click(); }); await sl(900);
        const opened = await p.evaluate(() => { const b = document.querySelector('#avSet [data-avp-open]'); if (!b) return false; b.click(); return true; }); await sl(800);
        check(opened && await p.evaluate(() => !!document.querySelector('.avp')), W + ' px: the avatar page opens');
        if (opened) {
          await p.evaluate(() => { document.querySelector('.avp [data-avp-tab="extras"]').click(); }); await sl(300);
          await p.evaluate(() => { document.querySelector('.avp [data-avm-k="hat"][data-avm-v="beanie"]').click(); }); await sl(300);
          for (const v of ['q', 'side', 'back', 'front']) { await p.evaluate(v => document.querySelector('.avp [data-avp-view="' + v + '"]').click(), v); await sl(150); }
          await p.evaluate(() => document.querySelector('.avp [data-avp-play]').click()); await sl(400);
          const pose = () => p.evaluate(() => { const h = document.querySelector('.avp-test .hero-body'); return h ? (h.getAttribute('transform') || '') + '|' + [...document.querySelectorAll('.avp-test .av-limb path')].map(x => x.getAttribute('d')).join('') : ''; });
          const a = await pose(); await sl(1200); const b2 = await pose();
          check(!!a && a !== b2, W + ' px: "See it move" moves');
          await p.evaluate(() => document.querySelector('.avp-bar [data-avp-save]').click()); await sl(400);
          check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.settings') || '{}').avatar || {}).hat === 'beanie' && !document.querySelector('.avp')), W + ' px: the avatar page saves');
        }
        await p.keyboard.press('Escape').catch(() => {}); await sl(300);
      }
      /* the living Finances picture moves */
      /* reached by an instant page change, as from the menu (a fresh load hid the frozen-avatar bug) */
      await p.evaluate(() => { const a = document.createElement('a'); a.href = '/cmd/finance/'; document.body.appendChild(a); a.click(); a.remove(); }); await sl(2500);
      if (!(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) { await p.fill('#lockPass', 'test-passcode-1'); await p.click('#lockSubmit'); await sl(2500); }
      const live = await p.waitForFunction(() => !!document.querySelector('#scIllu .hero'), null, { timeout: 12000, polling: 250 }).then(() => true, () => false);
      if (live) {
        const pose2 = () => p.evaluate(() => { const h = document.querySelector('#scIllu .hero-body'); return (h.getAttribute('transform') || '') + '|' + [...document.querySelectorAll('#scIllu .av-limb path')].map(x => x.getAttribute('d')).join(''); });
        let moved2 = false; const f0 = await pose2();
        for (let k = 0; k < 16 && !moved2; k++) { await sl(500); moved2 = (await pose2()) !== f0; }
        check(moved2, W + ' px: the Finances avatar moves');
      } else check(false, W + ' px: the Finances avatar comes alive');
      await ctx.close();
    }
  } catch (e) { check(false, 'ran to the end: ' + e.message); }
  check(!errs.length, 'no page errors ' + errs.join(' | ').slice(0, 400));
  await b.close(); srv.kill();
  console.log(fails ? '\n' + fails + ' Safari check(s) failed (' + ENGINE + ')' : '\nSafari checks passed (' + ENGINE + ')');
  process.exit(fails ? 1 : 0);
})();
