/* Lighter app (Phase D 25), the pages after House: Papers, Work, Habits (water), Goals, Wishlist and House chores are
   split by cmd/split-page.js. The everywhere part (tail.js) keeps what other pages use – At a glance, search, ⌘K,
   the data API, and the module's rows in Settings (Settings opens on every page); the page part (*.page.js) loads only
   on its own page, after tail.js. This checks both halves, apart and together, and that page changes double nothing.
   Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), path = require('path');
const SPLIT = [   /* file, its page, the page bundle, what other pages still use, what only its page has */
  { f: 'papers', page: 'papers', core: ['Papers.status', 'Papers.getFile'], only: ['Papers.add'] },
  { f: 'work-plus', page: 'work', core: [], only: ['WorkPlus.invoice'] },
  { f: 'life-more', page: 'habits', core: ['Streak.of'], only: [] },
  { f: 'goals', page: 'goals', core: ['GoalSrc.list', 'GoalSrc.value', 'GoalSrc.sync'], only: [] },
  { f: 'wish', page: 'wish', core: ['Wish.fit', 'Wish.room', 'Wish.cfg'], only: ['Wish.add'] },
  { f: 'chores', page: 'house', core: ['Chores.addLog', 'Chores.setDone', 'Chores.turn'], only: ['Chores.rooms'] }];
(async () => {
  const dist = p => fs.readFileSync(path.join(__dirname, '../../cmd/dist/' + p), 'utf8');
  const tail = dist('tail.js');
  for (const s of SPLIT) {
    check(tail.indexOf(s.f + '.page.js') < 0 && dist('page-' + s.page + '.js').indexOf(s.f + '.page.js') > -1, s.f + ': the page part is in the ' + s.page + ' bundle only, not in tail.js');
  }
  const { b, p } = await open(393);
  await p.evaluate(() => { ['papers', 'goals', 'wish', 'house', 'ptime', 'fdv', 'habits'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools(); t.wishes = [{ id: 'tw1', title: 'Made-up lamp', price: 400, prio: 1 }]; t.papers = [{ id: 'tp1', title: 'Made-up insurance', kind: 'insurance', date: '2030-01-01', dateKind: 'renews' }];
    t.chores = [{ id: 'tc1', name: 'Made-up hoovering', every: '1w', day: 0, who: 'me' }]; Features.saveTools(t);
    localStorage.setItem('dash.goals', JSON.stringify([{ id: 'tg1', name: 'Made-up savings goal', target: 1000, cur: 200 }]));
    window.dispatchEvent(new Event('goals:refresh')); });   /* the way goals.js saves: Home's Goals card reads them again instead of saving its older copy over them */
  await sl(1500);
  /* on Home: the everywhere parts only */
  await go(p, '', 2500);
  const home = await p.evaluate(SPLIT => {
    const get = s => s.split('.').reduce((o, k) => o && o[k], window);
    const cmds = []; (window.CommandExtra || []).forEach(f => { try { (f() || []).forEach(c => cmds.push(c.t)); } catch (e) {} });
    const srch = []; (window.SearchExtra || []).forEach(f => { try { f(function () { srch.push([].slice.call(arguments).join(' | ')); }); } catch (e) {} });
    ['goals', 'wish', 'house', 'health', 'habits', 'work', 'papers'].forEach(d => window.dispatchEvent(new CustomEvent('st:page', { detail: d })));
    return { core: SPLIT.map(s => s.core.filter(n => typeof get(n) !== 'function')).flat(), only: SPLIT.map(s => s.only.filter(n => typeof get(n) === 'function')).flat(),
      ui: Object.keys(window.__ui || {}).filter(k => ['papers', 'work', 'lifemore', 'goals', 'wish', 'chores'].includes(k)), cmds, srch: srch.join('\n'),
      goalCfg: !document.getElementById('hlSet-goals') || !!document.querySelector('#hlSet-goals [data-glcfg]') };
  }, SPLIT);
  check(!home.core.length, 'on Home, what other pages use is there ' + home.core.join(', '));
  check(!home.only.length && !home.ui.length, 'on Home, nothing of the pages themselves ' + home.only.concat(home.ui).join(', '));
  check(['Add a paper', 'New goal', 'New wish'].every(t => home.cmds.includes(t)), 'their ⌘K commands are there on Home');
  /* search reads the saved lists, which can arrive a moment after the page (slower on GitHub) – wait for them */
  const found = await until(p, () => { const srch = []; (window.SearchExtra || []).forEach(f => { try { f(function () { srch.push([].slice.call(arguments).join(' | ')); }); } catch (e) {} });
    const t = srch.join('\n'); return /Made-up lamp/.test(t) && /Made-up savings goal/.test(t) ? t : null; }, 10000);
  check(found !== null, 'search on Home finds a wish and a goal ' + (found === null ? home.srch.slice(0, 200) : ''));
  check(home.goalCfg, 'the Goals rows in Settings work on Home');
  /* jobs that must run on every page stay in the everywhere part */
  const jobs = await p.evaluate(async () => { let refreshed = 0; window.addEventListener('goals:refresh', () => refreshed++);
    localStorage.setItem('dash.fdvPend', '2'); window.dispatchEvent(new CustomEvent('sync:state', { detail: 'ok' })); await new Promise(r => setTimeout(r, 50));
    return { fdv: localStorage.getItem('dash.fdvPend') }; });
  check(jobs.fdv === '0', 'an inspection saved offline is marked synced on Home too, not only on Work (' + jobs.fdv + ')');
  check(/goals:refresh/.test(require('fs').readFileSync(require('path').join(__dirname, '../../cmd/goals.js'), 'utf8').split('__core')[0].slice(-400)), 'Home’s Goals card is told to draw again once the goal sources are here (every page)');
  /* a command on Home goes to its page */
  await p.evaluate(() => { (window.CommandExtra || []).forEach(f => (f() || []).forEach(c => { if (c.t === 'New wish') c.run(); })); });
  await until(p, () => /\/cmd\/wish\//.test(location.pathname), 15000); await sl(2500);
  /* each page: its own part runs and draws */
  const DRAW = { papers: '[data-tool="papers"]', work: '[data-tool="fdv"], [data-tool="ptime"]', habits: 'body', goals: '#glRoot', wish: '[data-tool="wishes"]', house: '[data-tool="hchores"]' };
  for (const s of SPLIT) {
    await go(p, s.page + '/', 2500);
    const r = await p.evaluate((s, sel) => { const get = n => n.split('.').reduce((o, k) => o && o[k], window); const el = document.querySelector(sel);
      return { only: s.only.filter(n => typeof get(n) !== 'function'), core: s.core.filter(n => typeof get(n) !== 'function'), drawn: !!el && el.innerHTML.length > 20 }; }, s, DRAW[s.page]);
    check(!r.only.length && !r.core.length, s.f + ' on its page: both parts are there ' + r.only.concat(r.core).join(', '));
    check(r.drawn, s.f + ' on its page: it draws its card');
  }
  const txt = await p.evaluate(() => (document.querySelector('[data-tool="hchores"]') || {}).textContent || '');
  check(/Made-up hoovering/.test(txt), 'House shows the chores card with the chore');
  /* page changes: Wishlist → Home → Wishlist, nothing doubled */
  await go(p, 'wish/', 2000);
  for (const pg of ['/cmd/', '/cmd/wish/']) {
    const c0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(pg => { const a = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === pg || a.pathname === pg); if (a) a.click(); }, pg);
    await until(p, c0 => SoftNav.count > c0, 15000, c0); await sl(2000);
  }
  const again = await p.evaluate(() => ({ n: document.querySelectorAll('[data-tool="wishes"]').length, txt: (document.querySelector('[data-tool="wishes"]') || {}).textContent || '',
    cmd: (window.CommandExtra || []).reduce((n, f) => { try { return n + (f() || []).filter(c => c.t === 'New wish').length; } catch (e) { return n; } }, 0) }));
  check(again.n === 1 && /Made-up lamp/.test(again.txt), 'back on Wishlist after Home: the card once, with the wish');
  check(again.cmd === 1, 'the command is there once, not once per visit (' + again.cmd + ')');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 400));
  await done(b);
})();
