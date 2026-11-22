/* Tabs on Food, Papers and People, and four new sections (2026-11-22, JP: "Do all of it"):
   Use it up + Freezer (Food), Return deadlines (Papers), Thank-yous (People). Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
(async () => {
  const { b, p } = await open(393);
  const NEW = ['usefood', 'freezer', 'returns', 'thanks'];
  await go(p, '', 2500);
  check(await p.evaluate(ids => ids.every(i => { const f = Features.LIST.find(x => x.id === i); return f && f.def === false && !Features.on(i); }), NEW), 'the four new sections exist and are off');
  await p.evaluate((ids, d) => {
    ['food', 'papers', 'people'].concat(ids).forEach(i => Features.set(i, true));
    const t = Features.tools();
    t.recipes = [{ id: 'r-made-up-1', title: 'Spinach pie', ingr: '200 g spinach\n2 eggs' }];
    t.usefood = [{ id: 'u1', title: 'Spinach', by: d[0] }];
    t.freezer = [{ id: 'f1', title: 'Bolognese', n: 2, date: d[1] }, { id: 'f2', title: 'Old bread', n: 1, date: d[2] }];
    t.returns = [{ id: 'rt1', title: 'Made-up jacket', got: d[3], days: 14, state: 'open' }];
    t.people = (t.people || []).concat([{ id: 'pp-made-up-1', name: 'Kari Testesen' }]);
    t.thanks = [{ id: 'ty1', what: 'A scarf', pid: 'pp-made-up-1', date: d[4] }];
    Features.saveTools(t);
  }, NEW, [day(1), day(-10), day(-200), day(-12), day(-5)]);
  /* tabs */
  const tabsOf = async pg => { await go(p, pg + '/', 3500); return p.evaluate(() => [...document.querySelectorAll('.pt-tabs [data-ptab-go]')].map(x => x.dataset.ptabGo)); };
  const ft = await tabsOf('food'), pt = await tabsOf('papers'), pe = await tabsOf('people');
  check(ft.join() === 'meals,shop,recipes,pantry', 'Food tabs: Meals · Shopping · Recipes · Pantry ' + ft);
  check(pt.join() === 'docs,receipts,soon', 'Papers tabs: Documents · Receipts · Expiring ' + pt);
  check(pe.join() === 'people,dates,gifts', 'People tabs: People · Dates · Gifts ' + pe);
  const fit = await p.evaluate(() => { const n = document.querySelector('.pt-tabs'); return [...n.querySelectorAll('[data-ptab-go] span')].every(s => s.scrollWidth <= s.clientWidth + 1); });
  check(fit, 'People: tab names fit whole on a phone');
  /* cards */
  await go(p, 'food/?customize', 3500);
  const fd = await p.evaluate(() => ({ use: document.querySelector('[data-tool="lp-usefood"]').textContent, frz: document.querySelector('[data-tool="lp-freezer"]').textContent }));
  check(/Spinach pie/.test(fd.use), 'Use it up: names the recipe that uses it');
  check(/3 portions/.test(fd.frz) && /1 in for more than 6 months/.test(fd.frz) && fd.frz.indexOf('Old bread') < fd.frz.indexOf('Bolognese'), 'Freezer: portions counted, oldest first, the old one flagged');
  await p.evaluate(() => document.querySelector('[data-lpact="frzone"][data-lpid="f1"]').click()); await sl(300);
  check(await p.evaluate(() => Features.list('freezer').find(x => x.id === 'f1').n === 1), 'Freezer: −1 takes a portion out');
  await go(p, 'papers/?customize', 3500);
  check(await p.evaluate(() => /Made-up jacket/.test(document.querySelector('[data-tool="lp-returns"]').textContent)), 'Return deadlines: the card is on Papers');
  await go(p, 'people/?customize', 3500);
  const ty = await p.evaluate(() => document.querySelector('[data-tool="lp-thanks"]').textContent);
  check(/from Kari Testesen/.test(ty) && /1 still to thank/.test(ty), 'Thank-yous: shows who it was from and how many are left');
  await p.evaluate(() => document.querySelector('[data-lpact="tydone"][data-lpid="ty1"]').click()); await sl(300);
  check(await p.evaluate(() => Features.list('thanks')[0].done === true), 'Thank-yous: the tick marks it thanked');
  /* At a glance */
  await go(p, '', 3000);
  const br = await p.evaluate(() => (window.BriefItems || []).map(x => x.title + ' ' + (x.href || '')).join(' | '));
  check(/Use it up: Spinach/.test(br) && /Return Made-up jacket\?/.test(br), 'At a glance: use it up and the return deadline ' + br.slice(0, 200));
  check(!p.errs.length, 'no script errors ' + p.errs.slice(0, 2).join(' | '));
  await b.close(); done();
})();
