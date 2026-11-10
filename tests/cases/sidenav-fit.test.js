/* The side bar fits all pages in the window when it can: normal spacing if there's room, then closer rows, then
   smaller rows. Only when even that is too tall does the list scroll – and then it fades at the edge that has more
   (no icon cut in half under the line), with the page you're on in view (2026-11-10). Icons only and open, short
   and tall windows, every page switched on. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); });
  const state = () => p.evaluate(() => {
    const l = document.querySelector('.mbar .tabbar'), r = document.documentElement, links = [...l.querySelectorAll('a[data-pg]')].filter(a => a.offsetHeight);
    const lb = l.getBoundingClientRect(), cur = l.querySelector('a[aria-current="page"]'), cb = cur && cur.getBoundingClientRect();
    return { n: links.length, over: l.scrollHeight > l.clientHeight + 1, fit1: r.classList.contains('sn-fit1'), fit2: r.classList.contains('sn-fit2'),
      up: l.classList.contains('sn-up'), down: l.classList.contains('sn-down'), top: l.scrollTop, minH: Math.min(...links.map(a => a.offsetHeight)),
      curIn: !!cb && cb.top >= lb.top - 1 && cb.bottom <= lb.bottom + 1 };
  });
  for (const mode of ['icons', 'open']) {
    await p.evaluate(m => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.nav = 'side'; localStorage.setItem('dash.settings', JSON.stringify(s)); localStorage.setItem('dash.sideNav', m); window.dispatchEvent(new Event('dash:local')); }, mode);
    await sl(800);
    const seen = {};
    for (const h of [1400, 1193, 950, 800, 640, 520]) {
      await p.setViewport({ width: 1280, height: h }); await go(p, 'travel/', 1500);
      const s = await state(); seen[h] = s;
      const tag = mode + ' · ' + h + ' px high';
      check(s.n >= 10, tag + ': every page is in the bar (' + s.n + ')');
      check(s.minH >= 30, tag + ': rows stay easy to hit (' + s.minH + ' px)');
      check(!s.over || s.fit2, tag + ': it only scrolls after moving the rows closer and making them smaller ' + JSON.stringify(s));
      check(!s.over || s.down || s.up, tag + ': when it scrolls, the edge with more fades ' + JSON.stringify(s));
      check(s.over || (!s.up && !s.down), tag + ': no fade when everything fits');
      check(s.curIn, tag + ': the page you are on is in view');
      const rows = await p.evaluate(() => [...document.querySelectorAll('.mbar .sn-more')].map(x => (x.offsetParent ? 'shown' : 'hidden') + (x.disabled ? '/dim' : '')).join(' '));
      check(s.over ? rows === 'shown/dim shown' : !/shown/.test(rows), tag + ': "more pages" arrows only when it scrolls (top dimmed at the start): ' + rows);
      if (s.over) {   /* the down arrow scrolls; then the top one lights up */
        await p.click('.mbar .sn-more-down'); await sl(700);
        const t2 = await p.evaluate(() => [document.querySelector('.mbar .tabbar').scrollTop, document.querySelector('.mbar .sn-more-up').disabled]);
        check(t2[0] > 20 && t2[1] === false, tag + ': the down arrow scrolls the list, and the up arrow lights up ' + JSON.stringify(t2));
      }
      if (s.over) {   /* scrolled to the very end: only the top fades */
        await p.evaluate(() => { const l = document.querySelector('.mbar .tabbar'); l.scrollTop = l.scrollHeight; }); await sl(300);
        const e = await state(); check(e.up && !e.down, tag + ': scrolled to the end, only the top fades ' + JSON.stringify({ up: e.up, down: e.down }));
        check(await p.evaluate(() => document.querySelector('.mbar .sn-more-down').disabled), tag + ': at the end the down arrow is dimmed');
      }
    }
    check(!seen[1400].fit1 && !seen[1400].over, mode + ': a tall window keeps the normal spacing');
    check(!seen[1193].over, mode + ': a 1193 px window (a laptop) fits every page without scrolling ' + JSON.stringify(seen[1193]));
  }
  /* the arrow (icons ↔ names) and the hide button stay after instant page changes – they vanished after the first one */
  await p.setViewport({ width: 1280, height: 900 }); await go(p, '', 2000);
  const nav = async path => { const n0 = await p.evaluate(() => SoftNav.count);
    await p.evaluate(h => { const a = [...document.querySelectorAll('nav a[data-pg]')].find(x => new URL(x.href).pathname === h); a.click(); }, '/cmd/' + path);
    for (let i = 0; i < 80 && (await p.evaluate(() => SoftNav.count)) <= n0; i++) await sl(100); await sl(500); };
  const btns = () => p.evaluate(() => { const vis = el => !!(el && el.offsetParent && el.getBoundingClientRect().width > 10);
    return { fold: vis(document.querySelector('.mbar .sn-fold')), hide: vis(document.querySelector('.mbar .sn-hidebtn')), n: document.querySelectorAll('.mbar .sn-fold').length }; });
  for (const pg of ['calendar/', 'finance/', '', 'travel/']) {
    await nav(pg); const bt = await btns();
    check(bt.fold && bt.hide && bt.n === 1, 'after going to ' + (pg || 'home') + ' without reloading: the arrow and the hide button are there (once) ' + JSON.stringify(bt));
  }
  await p.click('.mbar .sn-hidebtn'); await sl(900);
  check(await p.evaluate(() => document.documentElement.classList.contains('sn-hide') && !!document.querySelector('.sn-open')), 'the hide button hides the side bar, the corner button shows');
  await p.click('.sn-open'); await sl(900);
  check(await p.evaluate(() => !document.documentElement.classList.contains('sn-hide')), 'the corner button brings it back');
  await p.click('.mbar .sn-fold'); await sl(900);
  const m1 = await p.evaluate(() => localStorage.getItem('dash.sideNav'));
  await p.click('.mbar .sn-fold'); await sl(900);
  const m2 = await p.evaluate(() => localStorage.getItem('dash.sideNav'));
  check(m1 !== m2 && ['icons', 'open'].includes(m1) && ['icons', 'open'].includes(m2), 'the arrow switches icons ↔ names: ' + m1 + ' → ' + m2);
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
