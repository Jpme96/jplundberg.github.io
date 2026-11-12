/* The home-life split (F4, Phase D 25): home-life, people-plus, food-plus, money-plus, fin-tools, home-shared and
   life-pages are split by cmd/split-page.js. The everywhere part (tail.js) keeps what other pages use – At a glance,
   ⌘K, the calendar, Settings rows, the data jobs (the pantry follows the shopping list, a loan's rate watch, old event
   budgets cleaned away), the Top 3 ring on the avatar button, the "hide amounts" eye – and the API other files call;
   the page part (*.page.js) loads only on the pages that draw its cards. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), path = require('path');
const CMD = path.join(__dirname, '../../cmd');
const SPLIT = [   /* file, the pages its page part is on, what every page has, what only those pages have */
  { f: 'home-life', pages: ['house', 'people', 'food', 'work'], core: ['HomeLife.cfg', 'HomeLife.addShop', 'HomeLife.aisleOf', 'HomeLife.bday', 'HomeLife.dialog', 'HomeLife.talked'], only: [] },
  { f: 'people-plus', pages: ['people'], core: ['PeoplePlus.askNote', 'PeoplePlus.upcoming', 'PeoplePlus.days'], only: ['PeoplePlus.openImport', 'PeoplePlus.detail'] },
  { f: 'food-plus', pages: ['food'], core: ['FoodPlus.inPantry', 'FoodPlus.lines'], only: ['FoodPlus.shopBtn', 'FoodPlus.openImport'] },
  { f: 'money-plus', pages: ['finance', 'house', 'wish'], core: ['MoneyPlus.detect', 'MoneyPlus.addAs', 'Shared.partner', 'Shared.balance', 'Shared.sides', 'Shared.saveItem'], only: ['Shared.split', 'Shared.settle', 'MoneyPlus.split'] },
  { f: 'fin-tools', pages: ['finance'], core: ['FinAfford.open', 'FinAfford.check', 'FinLearn.norm', 'FinPayAll', 'EventBudgets.spent'], only: [] },
  { f: 'home-shared', pages: ['house', 'finance', 'wish'], core: ['SharedHome.move'], only: ['SharedHome.buy', 'SharedHome.forInv', 'SharedHome.cover'] },
  { f: 'life-pages', pages: ['finance', 'house', 'work', 'habits', 'travel'], core: ['PowerPrice.day', 'GymTpl.starter', 'LifePages.summary'], only: [] }];
(async () => {
  const dist = p => fs.readFileSync(path.join(CMD, 'dist', p), 'utf8');
  const tail = dist('tail.js'), all = ['home', 'calendar', 'finance', 'food', 'goals', 'habits', 'house', 'papers', 'people', 'travel', 'wish', 'work'];
  for (const s of SPLIT) {
    const on = all.filter(pg => dist('page-' + pg + '.js').indexOf(s.f + '.page.js') > -1);
    check(tail.indexOf(s.f + '.page.js') < 0 && on.join() === all.filter(pg => s.pages.includes(pg)).join(), s.f + ': the page part is only in the bundles of ' + s.pages.join(', ') + ' (' + on.join(', ') + ')');
  }
  /* a ⌘K command or At a glance button in an everywhere part never calls a page-only thing without asking first (on another page __ui() is empty) */
  const bare = [];
  fs.readdirSync(CMD).filter(f => /\.js$/.test(f) && fs.existsSync(path.join(CMD, f.replace(/\.js$/, '.page.js')))).forEach(f => {
    fs.readFileSync(path.join(CMD, f), 'utf8').split('\n').forEach((l, i, arr) => {
      const ok = x => /if \(!?__ui\(\)|__ui\(\)\.[\w$.]+ &&|\.test\(location\.pathname\)|if \(document\.querySelector\(/.test(x);
      if (/__ui\(\)\.[\w$]+\s*\(/.test(l) && !ok(l) && !(i && ok(arr[i - 1]))) bare.push(f + ':' + (i + 1));
    });
  });
  check(!bare.length, 'every page-only call from an everywhere part is guarded ' + bare.join(', '));

  const { b, p } = await open(393);
  await p.evaluate(() => { ['house', 'people', 'food', 'work', 'ptime', 'finance', 'shared', 'habits', 'gym'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools();
    t.people = [{ id: 'pp1', name: 'Made-up Kari', bday: '1990-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-28', rel: 'friend' }];
    t.pantry = [{ id: 'pn1', name: 'Made-up oats', state: 'low' }];
    t.shop = [{ id: 'sh1', text: 'Made-up oats', done: true }];
    t.foodcfg = Object.assign({}, t.foodcfg, { pantryBack: true });
    t.pproj = [{ id: 'pj1', name: 'Made-up client', color: '#3987e5' }];
    Features.saveTools(t);
    const k = new Date(); const tk = k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');
    localStorage.setItem('dash.todos', JSON.stringify([{ id: 'td1', text: 'Made-up task', today: tk, done: true }, { id: 'td2', text: 'Made-up task two', today: tk }]));
  });
  await sl(1200);
  /* on Home: the everywhere parts only */
  await go(p, '', 2500);
  const home = await p.evaluate(SPLIT => {
    const get = s => s.split('.').reduce((o, k) => o && o[k], window);
    const cmds = []; (window.CommandExtra || []).forEach(f => { try { (f() || []).forEach(c => cmds.push(c.t)); } catch (e) { cmds.push('ERR ' + e.message); } });
    return { core: SPLIT.map(s => s.core.filter(n => typeof get(n) !== 'function')).flat(), only: SPLIT.map(s => s.only.filter(n => typeof get(n) === 'function')).flat(),
      ui: Object.keys(window.__ui || {}).filter(k => ['homelife', 'peopleplus', 'foodplus', 'moneyplus', 'fintools', 'homeshared', 'lifepages'].includes(k)), cmds,
      aisle: HomeLife.aisleOf('melk'), aisles: Object.keys(HomeLife.AISLE).length };
  }, SPLIT);
  check(!home.core.length, 'on Home, what other pages use is there ' + home.core.join(', '));
  check(!home.only.length && !home.ui.length, 'on Home, nothing of the pages themselves ' + home.only.concat(home.ui).join(', '));
  check(!home.cmds.some(t => /^ERR/.test(t)) && ['Work report for today', 'Can I afford it?', 'Shopping list'].every(t => home.cmds.includes(t)), 'their ⌘K commands are there on Home ' + home.cmds.filter(t => /ERR/.test(t)).join(', '));
  check(home.aisles > 5 && !!home.aisle, 'the shop aisles are filled on Home (' + home.aisles + ', melk → ' + home.aisle + ')');
  /* jobs that must run on every page */
  await until(p, () => { const b = document.querySelector('.me-btn[data-me]'); return b && b.classList.contains('me-ring'); }, 8000);
  const ring = await p.evaluate(() => { const b = document.querySelector('.me-btn[data-me]'); return b ? b.style.getPropertyValue('--ring') : null; });
  check(ring !== null && Math.abs(parseFloat(ring) - 0.5) < 0.01, 'the Top 3 ring on the avatar button is drawn on Home (' + ring + ')');
  const back = await until(p, () => { const x = (Features.tools().pantry || [])[0]; return x && x.state === 'ok'; }, 8000);
  check(back !== null, 'on Home, a pantry item ticked off on the shopping list is back in stock');
  const sheet = await p.evaluate(async () => { FinAfford.open('500'); await new Promise(r => setTimeout(r, 400)); const bg = [...document.querySelectorAll('.lf-bg')].find(x => x.querySelector('[data-fares]')); if (bg) bg.click(); return bg ? 1 : 0; });
  check(sheet > 0, 'Can I afford it? opens on Home too');
  /* a command on Home goes to its page */
  await p.evaluate(() => { (window.CommandExtra || []).forEach(f => (f() || []).forEach(c => { if (c.t === 'Work report for today') c.run(); })); });
  const went = await until(p, () => /\/cmd\/work\//.test(location.pathname), 15000); await sl(2500);
  check(went !== null, 'the work report command on Home opens the Work page');
  /* each page: its own parts run and draw */
  const DRAW = { people: '[data-tool="people"]', food: '[data-tool="pantry"]', house: '[data-tool="hmaint"]', work: '[data-tool="ptime"]', finance: '[data-tool="recur"], [data-tool="shared"]', habits: '[data-tool="gym"]' };
  for (const pg of Object.keys(DRAW)) {
    await go(p, pg + '/', 2500);
    const r = await p.evaluate((SPLIT, pg, sel) => { const get = n => n.split('.').reduce((o, k) => o && o[k], window);
      const want = SPLIT.filter(s => s.pages.includes(pg)).map(s => s.only.concat(s.core)).flat();
      return { miss: want.filter(n => typeof get(n) !== 'function'), drawn: [...document.querySelectorAll(sel)].some(el => el.innerHTML.length > 20) }; }, SPLIT, pg, DRAW[pg]);
    check(!r.miss.length, pg + ': both parts are there ' + r.miss.join(', '));
    check(r.drawn, pg + ': its card is drawn');
  }
  const ppl = await p.evaluate(() => (document.querySelector('[data-tool="people"]') || {}).textContent || '');
  await go(p, 'people/', 2500);
  const ppl2 = await p.evaluate(() => ({ t: (document.querySelector('[data-tool="people"]') || {}).textContent || '', n: document.querySelectorAll('[data-tool="people"]').length }));
  check(/Made-up Kari/.test(ppl2.t) && ppl2.n === 1, 'People shows the person once after the page changes');
  /* page changes: People → Home → People, nothing doubled */
  for (const pg of ['/cmd/', '/cmd/people/']) {
    const c0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(pg => { const a = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === pg || a.pathname === pg); if (a) a.click(); }, pg);
    await until(p, c0 => SoftNav.count > c0, 15000, c0); await sl(2000);
  }
  const again = await p.evaluate(() => ({ cmd: (window.CommandExtra || []).reduce((n, f) => { try { return n + (f() || []).filter(c => c.t === 'Note a gift').length; } catch (e) { return n; } }, 0),
    hero: document.querySelectorAll('#hlTiles .hl-tile').length }));
  check(again.cmd === 1, 'the command is there once, not once per visit (' + again.cmd + ')');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 400) + (ppl ? '' : ''));
  await done(b);
})();
