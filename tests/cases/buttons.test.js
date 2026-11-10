/* Card headers look the same everywhere: the card's buttons sit together next to the fold arrow (no gap in the
   middle), all the same height, and every icon is in the middle of its button. Phone and computer, every page tab. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const SCAN = where => [...document.querySelectorAll('.card-head')].filter(h => h.offsetParent && !h.closest('.card-folded')).map(h => {
  const name = ((h.querySelector('h2') || {}).textContent || '').trim().slice(0, 22), bad = [];
  const btns = [...h.children].flatMap(c => c.matches('button, a.icon-btn, a.text-btn.mi') ? [c] : [...c.querySelectorAll(':scope > button.icon-btn, :scope > button.mi, :scope > a.icon-btn, :scope > button.text-btn.mi, :scope > a.text-btn.mi, :scope > a.text-btn, :scope > button.text-btn')])
    .filter(x => x.offsetParent && !x.closest('h2') && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().height < 50);
  if (!btns.length) return null;
  const rs = btns.map(x => x.getBoundingClientRect()).sort((a, c) => a.left - c.left);
  for (let i = 1; i < rs.length; i++) if (rs[i].left - rs[i - 1].right > 24 && Math.abs(rs[i].top - rs[i - 1].top) < 10) bad.push('gap ' + Math.round(rs[i].left - rs[i - 1].right));
  const hs = [...new Set(btns.filter(x => x.querySelector(':scope > i.bi') && !(x.textContent || '').trim() || getComputedStyle(x).fontSize === '0px').map(x => Math.round(x.getBoundingClientRect().height)))];
  if (hs.length > 1) bad.push('heights ' + hs.join('/'));
  btns.forEach(x => { const i = x.querySelector(':scope > i.bi'); if (!i || ((x.textContent || '').trim() && getComputedStyle(x).fontSize !== '0px')) return;
    const r = x.getBoundingClientRect(), c = i.getBoundingClientRect(), dx = (c.left + c.width / 2) - (r.left + r.width / 2), dy = (c.top + c.height / 2) - (r.top + r.height / 2);
    if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) bad.push((x.getAttribute('aria-label') || 'icon') + ' off by ' + Math.round(dx) + ',' + Math.round(dy)); });
  return bad.length ? where + ' · ' + name + ': ' + bad.join(', ') + ' [' + rs.map(r => Math.round(r.left) + '-' + Math.round(r.right)).join(' ') + '] ' + btns.map(x => x.className.split(' ')[0] + ':' + (x.getAttribute('aria-label') || x.textContent.trim()).slice(0, 10)).join(',') : null;
}).filter(Boolean);
(async () => {
  for (const W of [393, 1280]) {
    const { b, p } = await open(W);
    await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); });
    const out = [];
    for (const pg of ['', 'food/', 'house/', 'finance/', 'calendar/', 'people/', 'travel/', 'papers/', 'work/']) {
      await go(p, pg, 2200);
      const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo));
      for (const t of tabs.length ? tabs : ['']) { if (t) { await p.evaluate(t => document.querySelector('[data-ptab-go="' + t + '"]').click(), t); await sl(400); } out.push(...await p.evaluate(SCAN, (pg || 'home') + (t ? '/' + t : ''))); }
    }
    check(!out.length, W + ' px: card buttons together, same size, icons centred' + (out.length ? ': ' + out.slice(0, 8).join(' ; ') : ''));
    check(!p.errs.length, W + ' px: no errors ' + p.errs.join(' | ').slice(0, 200));
    await b.close();
  }
  await done();
})();
