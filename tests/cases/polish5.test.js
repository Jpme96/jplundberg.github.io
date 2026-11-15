/* The desktop round of 15 Nov 2026 (made-up data only):
   - English left in the Norwegian version: the weather word, Finance's year-ahead chart, Health's Body/Care tabs, dinner voting,
     Papers (menu, title, suggestions, "Look at it again"), old lines in Admin's activity log, the pantry's starter items
   - things out of line: card heads side by side, House's "Set up a new home" button, Admin's narrow columns,
     Travel's "Show more", the empty box next to a long Finance card, the scene floor that looked like a box */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => {
    Features.LIST.forEach(f => Features.set(f.id, true));
    const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; s.simple = false; localStorage.setItem('dash.settings', JSON.stringify(s));
    const d = Vault.get();
    d.budget = d.budget || {}; d.budget.income = [{ id: 'i1', name: 'Lønn', amount: 41000, day: 20 }]; d.budget.fixed = [{ id: 'f1', name: 'Husleie', amount: 12000, day: 1 }];
    d.budget.taxBack = { amount: 4200, month: '2027-06' };
    Vault.save(d);
    const t = Features.tools();
    t.pantry = [{ id: 'p1', name: 'Garlic' }, { id: 'p2', name: 'Flour' }, { id: 'p3', name: 'Kardemomme' }];
    t.papers = [{ id: 'pa1', title: 'Testkontrakt', kind: 'home', date: '2027-03-31', dateKind: 'review', who: 'Kari' }];
    t.adminlog = [{ at: Date.now() - 3600e3, t: 'Ran all checks', i: 'arrow-clockwise' }, { at: Date.now() - 7200e3, t: 'Link check: 2 broken', i: 'link-45deg' }];
    Features.saveTools(t);
  });
  await sl(800);

  await go(p, 'finance/', 2800);
  /* words */
  const w = await p.evaluate(() => [I18N.k('ui.wx-overcast', 'Overcast'), I18N.k('ui.let-x-choose', 'Let {x} choose', { x: 'Ola' }), I18N.k('ui.tab-care', 'Care'), I18N.k('ui.fx-leg-net', 'Net pay')]);
  check(w.join('|') === 'Overskyet|La Ola velge|Oppfølging|Nettolønn', 'Norwegian for the weather word, dinner voting, Health tab and the chart legend: ' + w.join(' | '));

  const ya = await p.evaluate(() => { const x = document.getElementById('fpYearAhead'); return x ? x.textContent : ''; });
  check(ya && !/Net pay|Holiday pay|Half tax|Fixed costs|Tax settlement/.test(ya) && /Nettolønn/.test(ya) && /Skatteoppgjør/.test(ya), 'Finance → the year ahead is Norwegian: ' + ya.slice(0, 160));
  const pair = await p.evaluate(() => { const x = document.querySelector('.fx-pair'); return x ? getComputedStyle(x).alignItems : 'none'; });
  check(pair === 'start' || pair === 'none', 'Finance: two cards side by side keep their own height (' + pair + ')');

  await go(p, 'habits/', 2500);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go]')].map(x => x.textContent.trim()).join(','));
  check(/Kropp/.test(tabs) && /Oppfølging/.test(tabs) && !/Body|Care/.test(tabs), 'Health tabs in Norwegian: ' + tabs);

  await go(p, 'papers/', 2500);
  const pa = await p.evaluate(() => ({ h1: (document.querySelector('.fp-hero h1') || {}).textContent, nav: (document.querySelector('a[data-pg="papers"] span[data-t]') || {}).textContent, body: document.querySelector('main, #fp').innerText }));
  check(pa.h1 === 'Papirer' && pa.nav === 'Papirer', 'Papers is "Papirer" in the menu and the title: ' + pa.h1 + ' / ' + pa.nav);
  check(/Se på den igjen 31\. mars 2027/.test(pa.body) && !/Look at it again|Also worth keeping|Start with/.test(pa.body), 'Papers: the date line and suggestions are Norwegian');

  await go(p, 'food/', 2500);
  const food = await p.evaluate(() => { const c = [...document.querySelectorAll('.pn-chip')].map(x => x.textContent.trim()); return c.join(','); });
  check(/Hvitløk/.test(food) && /Hvetemel/.test(food) && /Kardemomme/.test(food) && !/Garlic|Flour/.test(food), 'pantry starter items show in Norwegian, your own stay as written: ' + food);
  /* card heads side by side keep their titles on one line */
  const heads = await p.evaluate(() => { const r = [...document.querySelectorAll('.card > .card-head')].filter(h => h.offsetWidth).map(h => ({ top: Math.round(h.getBoundingClientRect().top), card: Math.round(h.parentElement.getBoundingClientRect().top), h: h.getBoundingClientRect().height }));
    const bad = []; r.forEach(a => r.forEach(c => { if (a !== c && a.card === c.card && a.top !== c.top) bad.push(a.top + '≠' + c.top); })); return { bad, minH: Math.min(...r.map(x => x.h)) }; });
  check(!heads.bad.length && heads.minH >= 36, 'Food: card heads side by side line up (' + heads.bad.join(' ') + ', lowest head ' + heads.minH + ' px)');

  await go(p, 'house/', 2500);
  const mv = await p.evaluate(() => { const bt = document.querySelector('.hm-move .pill-btn'); if (!bt) return null; const i = bt.querySelector('i').getBoundingClientRect(), s = bt.querySelector('span').getBoundingClientRect(); return { dy: Math.abs((i.top + i.height / 2) - (s.top + s.height / 2)), h: bt.getBoundingClientRect().height }; });
  check(!mv || (mv.dy < 4 && mv.h <= 48), 'House: "Sett opp en ny bolig" has its + next to the words ' + JSON.stringify(mv));

  await go(p, 'admin/', 2800);
  const ad = await p.evaluate(() => ({ log: [...document.querySelectorAll('.cr-log li span')].map(x => x.textContent).join(' | '), cols: (() => { const g = document.querySelector('.cr-grid'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0; })() }));
  check(/Kjørte alle sjekker/.test(ad.log) && /Lenkesjekk: 2 brutte/.test(ad.log) && !/Ran all checks|Link check/.test(ad.log), 'Admin: old log lines in today\'s language: ' + ad.log);
  check(ad.cols === 2, 'Admin at 1280 px: two columns, so titles fit (' + ad.cols + ')');

  /* the scene floor fades at both ends */
  await go(p, 'calendar/', 2800);
  const fl = await p.evaluate(() => { const r = [...document.querySelectorAll('.sc25-back rect')].find(x => x.getAttribute('y') === '200' && x.getAttribute('width') === '400'); return r ? r.getAttribute('fill') : null; });
  check(fl && /^url\(#sc25fl/.test(fl), 'Calendar: the floor fades out at the ends (' + fl + ')');

  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
