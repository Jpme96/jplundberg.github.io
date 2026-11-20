/* Content-Security-Policy on every cmd page (2026-11-19, plan Part 4 – held back until JP has checked it live):
   every page carries the policy, and opening every page with every feature on (Settings and the avatar maker too)
   is never blocked by it. Made-up data only. */
const fs = require('fs'), path = require('path');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '../../cmd');
(async () => {
  const pages = ['index.html'].concat(fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'index.html')) && d !== 'home').map(d => d + '/index.html'));
  const missing = pages.filter(pg => !/<meta http-equiv="Content-Security-Policy" content="default-src 'self';/.test(fs.readFileSync(path.join(ROOT, pg), 'utf8')));
  check(!missing.length, 'every cmd page carries the policy ' + missing.join(', '));
  const { b, p } = await open(1280);
  const blocked = [];
  await p.evaluateOnNewDocument(() => { document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber); }); });
  p.on('console', m => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text().slice(0, 200)); });
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); });
  for (const pg of ['', 'calendar/', 'travel/', 'finance/', 'habits/', 'house/', 'people/', 'food/', 'work/', 'wish/', 'goals/', 'papers/', 'admin/']) {
    await go(p, pg, 2500);
    const v = await p.evaluate(() => window.__csp || []);
    v.forEach(x => blocked.push((pg || 'home') + ': ' + x));
  }
  /* Settings and the avatar maker (inline styles, the figure) */
  await go(p, '', 2000);
  await p.evaluate(() => { const s = document.querySelector('[data-open-settings], #settingsBtn, [aria-label="Settings"]'); if (s) s.click(); }); await sl(800);
  (await p.evaluate(() => window.__csp || [])).forEach(x => blocked.push('settings: ' + x));
  /* the shared app and the contractors' upload page (2026-11-20) */
  for (const u of ['home/', '../upload/']) {
    await p.goto(p.url().replace(/\/cmd\/.*$/, '/cmd/') + u, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sl(2500);
    const has = await p.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
    if (!has) blocked.push(u + ': no policy');
    (await p.evaluate(() => window.__csp || [])).forEach(x => blocked.push(u + ': ' + x));
  }
  check(!blocked.length, 'nothing is blocked by the policy ' + [...new Set(blocked)].slice(0, 5).join(' | '));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
