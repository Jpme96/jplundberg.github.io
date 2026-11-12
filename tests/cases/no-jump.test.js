/* When Iago ticks things off, what the owner is looking at in cmd stays in the same spot (no jumping). */
const { shared, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { ['food', 'shop', 'meals', 'pantry', 'recipes', 'house', 'chores'].forEach(f => Features.set(f, true)); const t = Features.tools(); t.shop = []; for (let i = 0; i < 25; i++) t.shop.push({ id: 's' + i + Date.now(), text: 'Item ' + i, done: false }); Features.saveTools(t); });
  await sl(3000);
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
  await q.evaluate(() => document.querySelector('[data-tab="shop"]').click()); await sl(800);
  for (const page of ['food/', '', 'food/']) for (const which of ['first', 'last']) {
    await go(p, page, 3500);
    /* looking at the middle of the list, well away from the first and last rows Iago ticks (not a fixed scroll – the page above it changes size as features move) */
    await p.evaluate(() => { const f = [...document.querySelectorAll('label')].find(l => /^Item 10\b/.test(l.textContent.trim())); const y = f ? f.getBoundingClientRect().top + scrollY - 200 : 1100; window.scrollTo(0, Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight - 50))); }); await sl(600);
    const probes = await p.evaluate(() => [200, 400, 600].map(y => { let el = document.elementFromPoint(200, y); while (el && el.children.length && el.textContent.length > 120) el = el.firstElementChild; return el ? { tx: (el.textContent || '').trim().slice(0, 60), top: el.getBoundingClientRect().top, tag: el.tagName } : null; }).filter(x => x && x.tx));
    const ticked = await q.evaluate(w => { const all = document.querySelectorAll('[data-shop]'), x = w === 'first' ? all[0] : all[all.length - 1]; const tx = (x.closest('li') || x).textContent.trim().slice(0, 20); x.click(); return tx; }, which);
    await sl(3500);
    /* a probe sitting on the very item Iago ticked moves with it – that's the item, not the page */
    probes.forEach(pr => { if (ticked && pr.tx && ticked.indexOf(pr.tx.slice(0, 8)) > -1) pr.skip = 1; });
    const shift = await p.evaluate(ps => ps.map(pr => { if (pr.skip) return 0; let bd = 1e9; document.querySelectorAll(pr.tag).forEach(x => { if ((x.textContent || '').trim().slice(0, 60) === pr.tx) { const d = x.getBoundingClientRect().top - pr.top; if (Math.abs(d) < Math.abs(bd)) bd = d; } }); return bd === 1e9 ? 0 : Math.round(bd); }), probes);
    /* the view stays put: what's at the top of the screen doesn't move, and nothing moves by more than the one row
       that can appear or disappear where Iago's item goes (that's the list changing, not the page jumping) */
    check(Math.abs(shift[0]) <= 2 && shift.every(s => Math.abs(s) <= 45), (page || 'home') + ' · Iago ticks the ' + which + ' item → shift ' + shift.join(', '));
  }
  check(!p.errs.length, 'no errors in cmd ' + p.errs.join(' | ').slice(0, 300));
  await done(b, b2);
})();
