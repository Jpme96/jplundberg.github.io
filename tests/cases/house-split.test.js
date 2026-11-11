/* Lighter app (Phase D 25), House: house-*.js are split (cmd/split-page.js). The everywhere part stays in tail.js
   (At a glance, search, ⌘K commands, calendar reminders, the data API); the page part (*.page.js) loads only on the
   House page, after tail.js. This checks both halves still work together and apart. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), path = require('path');
(async () => {
  const dist = fs.readFileSync(path.join(__dirname, '../../cmd/dist/tail.js'), 'utf8'), house = fs.readFileSync(path.join(__dirname, '../../cmd/dist/page-house.js'), 'utf8');
  check(!/pickKind|reportAll\(o\)\s*\{|function ocrSheet/.test(dist.replace(/__ui\(\)\.\w+/g, '')) || !/house-claims\.page\.js/.test(dist), 'the House page parts are not in tail.js');
  check(/house-claims\.page\.js/.test(house) && /__late/.test(house), 'they are in the House page bundle, run after tail.js');
  const { b, p } = await open(393);
  const ago = (n) => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  await p.evaluate((found, reply) => {
    ['house', 'hclaim', 'hproj', 'hdocs', 'htake'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    HouseClaims.create({ title: 'Made-up leak under the sink', against: 'seller', found: found, status: 'draft' });
    HouseClaims.create({ title: 'Made-up crack in the tile', against: 'seller', found: found, status: 'sent', sent: found, replyBy: reply });
  }, ago(12), ago(2));
  /* on Home: only the everywhere part */
  await go(p, '', 2500);
  const home = await p.evaluate(() => {
    const brief = [], srch = [], cmds = [], evs = [];
    (window.BriefExtra || []).forEach(f => { try { f(function () { brief.push([].slice.call(arguments).join(' | ')); }); } catch (e) {} });
    (window.SearchExtra || []).forEach(f => { try { f(function () { srch.push([].slice.call(arguments).join(' | ')); }); } catch (e) {} });
    (window.CommandExtra || []).forEach(f => { try { (f() || []).forEach(c => cmds.push(c.t)); } catch (e) {} });
    (window.EventsExtra || []).forEach(f => { try { (f() || []).forEach(e => evs.push(e.title)); } catch (e) {} });
    return { brief: brief.join('\n'), srch: srch.join('\n'), cmds, evs, report: typeof HouseClaims.report, core: !!(window.__core && __core.claims), ui: JSON.stringify(Object.keys(window.__ui || {})), homes: typeof Homes.current, move: typeof HouseMove.date, season: typeof HousePlus.seasonLeft };
  });
  check(/Send the claim: Made-up leak/.test(home.brief), 'At a glance on Home: “Send the claim” for an old draft');
  check(/No answer on: Made-up crack/.test(home.brief), '… and “No answer” for a late reply');
  check(home.srch.includes('Made-up leak under the sink'), 'search on Home finds the claim');
  check(home.cmds.includes('New claim (reklamasjon)') && home.cmds.includes('Take-over day guide') && home.cmds.includes('New home project'), 'the House commands are in ⌘K on Home');
  check(home.evs.some(t => /Answer due: Made-up crack/.test(t)), 'the calendar gets the claim’s answer date');
  check(home.core && home.report === 'undefined' && home.ui === '[]', 'Home has the data part only – nothing of the House page (' + home.report + ', ' + home.ui + ')');
  check(home.homes === 'function' && home.move === 'function' && home.season === 'function', 'what other pages read is there: Homes, HouseMove.date, HousePlus.seasonLeft');
  /* a command from Home goes to the House page */
  await p.evaluate(() => { (window.CommandExtra || []).forEach(f => (f() || []).forEach(c => { if (c.t === 'New claim (reklamasjon)') c.run(); })); });
  await until(p, () => /\/cmd\/house\//.test(location.pathname), 15000); await sl(2500);
  /* on House: both parts */
  const hs = await p.evaluate(() => ({ claims: !!document.querySelector('[data-tool="hclaim"] .kit-card, [data-tool="hclaim"] .kit-row, [data-tool="hclaim"] li'), txt: (document.querySelector('[data-tool="hclaim"]') || {}).textContent || '',
    report: typeof HouseClaims.report, ui: Object.keys(window.__ui || {}).sort().join(','), take: !!document.querySelector('[data-tool="htake"]') }));
  check(/Made-up leak/.test(hs.txt), 'House shows the claims card with the claim');
  check(hs.report === 'function' && /claims/.test(hs.ui) && /homes/.test(hs.ui), 'House has its page parts (' + hs.ui + ')');
  /* instant page changes: House → Home → House – nothing doubled, nothing left behind */
  for (const pg of ['/cmd/', '/cmd/house/']) {
    const c0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(pg => { const a = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === pg || a.pathname === pg); if (a) a.click(); }, pg);
    await until(p, (c0) => SoftNav.count > c0, 15000, c0); await sl(2000);
  }
  const again = await p.evaluate(() => ({ n: document.querySelectorAll('[data-tool="hclaim"]').length, txt: (document.querySelector('[data-tool="hclaim"]') || {}).textContent || '', ui: Object.keys(window.__ui || {}).length,
    hooks: (window.CommandExtra || []).reduce((n, f) => { try { return n + (f() || []).filter(c => c.t === 'New claim (reklamasjon)').length; } catch (e) { return n; } }, 0) }));
  check(again.n === 1 && /Made-up leak/.test(again.txt), 'back on House after Home: the card once, with the claim');
  check(again.hooks === 1, 'the command is there once, not once per visit (' + again.hooks + ')');
  /* the meter photo command from another page opens the reader on House */
  await go(p, '', 2000);
  await p.evaluate(() => { const t = Features.tools(); t.henergycfg = Object.assign({}, t.henergycfg || {}, { ocr: true }); Features.saveTools(t); });
  const ocr = await p.evaluate(() => { let c = null; (window.CommandExtra || []).forEach(f => (f() || []).forEach(x => { if (x.t === 'Read the meter from a photo') c = x; })); return c ? typeof c.run : 'none'; });
  check(ocr === 'function' || ocr === 'none', 'the meter-photo command can be run from another page (' + ocr + ')');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
