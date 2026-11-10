/* Phone layout from the walkthrough (2026-11-10), at 393 px with sharing on and every page on:
   - nothing is wider than the screen; card headings keep their buttons on screen (Food's Dinners and Shopping list ran off)
   - pages with many tabs show every tab with its whole name (House hid two off the edge, Finances cut "Spen…")
   - Admin's tabs are in the first screen
   - tile text isn't cut ("add what insurance c…", "Days left 2…") and a lone last tile takes the whole row
   - Plan day isn't twice on Home (the top-3 card already has it)
   - Calendar's phone-calendar form is folded until a phone calendar is added
   Made-up data only. */
const { shared, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2 } = await shared(393);
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await go(p, '', 2000);   /* switching to a phone reloads the page */
  await p.evaluate(() => {
    Features.LIST.forEach(f => Features.set(f.id, true));
    const d = Vault.get(); d.budget = { income: [{ id: 'i1', name: 'Salary', amount: 41000, day: 25 }], fixed: [{ id: 'f1', name: 'Rent', amount: 12500, day: 1 }] }; Vault.save(d);
    Quick.add({ kind: 'expense', cat: 'groceries', amount: 300, note: 'Shop' });
    const t = Features.tools(); t.shop = [{ id: 's1', text: 'Milk', done: false }]; Features.saveTools(t);
  });
  await sl(1500);
  const W = 393;
  const wide = () => p.evaluate(() => document.documentElement.scrollWidth);
  const headsOff = () => p.evaluate(() => [...document.querySelectorAll('.card > .card-head')].filter(h => h.offsetParent).flatMap(h => [...h.querySelectorAll('button, a')].filter(x => x.offsetParent && x.getBoundingClientRect().right > innerWidth + 1).map(x => (h.querySelector('h2') || h).textContent.trim().slice(0, 24) + ': ' + (x.getAttribute('aria-label') || x.textContent || x.className).trim().slice(0, 20))));
  const cut = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(el => el.offsetParent && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)).map(el => el.textContent.trim().slice(0, 30)), sel);

  for (const pg of ['', 'calendar/', 'travel/', 'finance/', 'habits/', 'work/', 'house/', 'people/', 'food/', 'wish/', 'goals/', 'papers/', 'admin/']) {
    await go(p, pg, 2200);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go], #fpTabs [data-ftab-go]')].map(x => x.dataset.ptabGo || x.dataset.ftabGo));
    const name = pg.replace('/', '') || 'home';
    for (const t of (tabs.length ? tabs : [''])) {
      if (t) { await p.evaluate(t => { const x = document.querySelector('[data-ptab-go="' + t + '"], #fpTabs [data-ftab-go="' + t + '"]'); x && x.click(); }, t); await sl(500); }
      const w = await wide(), off = await headsOff();
      check(w <= W + 1 && !off.length, name + (t ? ' › ' + t : '') + ': nothing past the right edge' + (w > W + 1 ? ' (page ' + w + ' px)' : '') + (off.length ? ' – ' + off.slice(0, 3).join(' ; ') : ''));
    }
    /* every tab on screen with its whole name */
    const tb = await p.evaluate(() => [...document.querySelectorAll('.fp-tabs button')].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(), s = x.querySelector('span'); return { t: (s || x).textContent.trim(), in: r.left >= -1 && r.right <= innerWidth + 1, cut: !!s && s.scrollWidth > s.clientWidth + 1 }; }));
    if (tb.length) check(tb.every(x => x.in && !x.cut), name + ': all ' + tb.length + ' tabs on screen, names whole ' + JSON.stringify(tb.filter(x => !x.in || x.cut)));
    const tiles = await cut('.hl-tile .sub, .kit-tile > span, .kit-tile > b');
    check(!tiles.length, name + ': tile text not cut ' + JSON.stringify(tiles.slice(0, 4)));
    const lone = await p.evaluate(() => [...document.querySelectorAll('.fp-tiles, .hl-tiles, .fh-parts')].filter(g => g.offsetParent && getComputedStyle(g).gridTemplateColumns.split(' ').length === 2).filter(g => { const k = [...g.children].filter(c => c.offsetParent); return k.length > 1 && k.length % 2 === 1 && Math.abs(k[k.length - 1].getBoundingClientRect().width - g.getBoundingClientRect().width) > 4; }).length);
    check(!lone, name + ': no lone half-width tile at the end of a two-column row');
    if (pg === '') check(await p.evaluate(() => [...document.querySelectorAll('[data-plan]')].filter(x => x.offsetParent).length) === 1, 'home: one Plan button, not two');
    if (pg === 'admin/') { const at = await p.evaluate(() => { const n = document.querySelector('[data-crtab]'); return n ? Math.round(n.getBoundingClientRect().top) : -1; }); check(at > 0 && at < 852 - 90, 'admin: the tabs are in the first screen (top ' + at + ' px)'); }
    if (pg === 'calendar/') check(await p.evaluate(() => { const c = document.getElementById('clFeeds'); return !!c && c.classList.contains('ufold'); }), 'calendar: the phone-calendar card is folded while none is added');
    if (pg === 'food/') check(await p.evaluate(() => { const v = document.querySelector('#shop .sh-vis'); return !!v && /Iago/.test(v.textContent) && v.getBoundingClientRect().width < 40; }), 'food: "Visible to Iago" is an icon on the phone (the words kept for screen readers)');
  }
  /* the PC keeps the words on the badge and the tabs in one row */
  await p.setViewport({ width: 1580, height: 1193 }); await go(p, 'food/', 2000);
  check(await p.evaluate(() => { const v = document.querySelector('#shop .sh-vis'); return !!v && v.getBoundingClientRect().width > 70; }), 'PC: the badge still says "Visible to Iago"');
  await go(p, 'house/', 2000);
  check(await p.evaluate(() => { const b = [...document.querySelectorAll('.fp-tabs button')].filter(x => x.offsetParent); return b.length > 5 && new Set(b.map(x => Math.round(x.getBoundingClientRect().top))).size === 1; }), 'PC: House tabs stay in one row');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b, b2);
})();
