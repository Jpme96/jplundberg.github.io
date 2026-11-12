/* CSS per page (D 25, F4): rules only one page uses live in that page's page.css (cmd/split-css.py). Each page links
   its own right after styles.css; an instant page change brings it in at the same place (so the rules cascade the same
   as on a fresh load) and takes the old page's out; no page.css rule is a class another page's scripts use. */
const fs = require('fs'), path = require('path');
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '..', '..', 'cmd');
(async () => {
  const pages = fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'page.css')));
  check(pages.length >= 5, 'pages with their own stylesheet: ' + pages.join(', '));
  for (const pg of pages) { const h = fs.readFileSync(path.join(ROOT, pg, 'index.html'), 'utf8'); check(/styles\.css\?v=[^"]*" rel="stylesheet">\s*<link href="page\.css\?v=[0-9a-f]+"/.test(h), pg + ': page.css right after styles.css'); }
  const { b, p } = await open(393);
  await p.evaluate(() => { ['finance', 'house', 'papers', 'work', 'goals'].forEach(k => { try { Features.set(k, true); } catch (e) {} }); });
  const sheets = () => p.evaluate(() => [...document.querySelectorAll('head link[rel="stylesheet"]')].map(l => new URL(l.href).pathname));
  await go(p, 'finance/', 2500); const fresh = await sheets();
  await go(p, '', 2500);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/cmd/finance/'; document.body.appendChild(a); a.click(); a.remove(); });
  await until(p, () => /\/finance\/$/.test(location.pathname) && !!document.querySelector('link[href*="finance/page.css"]'), 12000);
  const soft = await sheets();
  check(JSON.stringify(soft) === JSON.stringify(fresh), 'an instant page change gives the same stylesheets in the same order ' + JSON.stringify(soft.map(x => x.split('/').slice(-2).join('/'))));
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/cmd/house/'; document.body.appendChild(a); a.click(); a.remove(); });
  await until(p, () => /\/house\/$/.test(location.pathname), 12000); await sl(800);
  const h2 = await sheets();
  check(!h2.some(x => /finance\/page\.css/.test(x)) && h2.some(x => /house\/page\.css/.test(x)), 'leaving takes the old page’s stylesheet out');
  /* a page's own rule really draws: something on Finances takes a style only its page.css has */
  await go(p, 'finance/', 2500);
  check(await p.evaluate(() => [...document.styleSheets].some(s => /finance\/page\.css/.test(s.href || '') && s.cssRules.length > 100)), 'the Finances rules are loaded on Finances');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
