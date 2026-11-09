/* Every cmd page, every page tab and every Admin tab opens without errors, with every feature switched on –
   and no "undefined", "NaN", "null" or "[object …]" reaches the screen. The shared app's tabs too. */
const { open, shared, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const RX = /\bundefined\b|\bNaN\b|\[object [A-Za-z]+\]|\bnull\b|\bInvalid Date\b|\{\{|\}\}|\$\{/;
async function bad(p) {
  return p.evaluate(src => { const R = new RegExp(src), out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const el = n.parentElement; if (!el || el.closest('script,style,noscript,textarea,code')) continue; if (R.test(n.nodeValue) && (el.offsetParent || getComputedStyle(el).position === 'fixed')) out.push(n.nodeValue.trim().slice(0, 80)); }
    document.querySelectorAll('[placeholder]').forEach(i => { if (R.test(i.placeholder)) out.push('placeholder ' + i.placeholder); });
    /* an icon whose name isn't in the icon set draws nothing */
    document.querySelectorAll('i.bi').forEach(i => { if (!i.offsetParent) return; const c = getComputedStyle(i, '::before').content; if (!c || c === 'none' || c === 'normal' || c === '""') out.push('missing icon ' + i.className); });
    return out; }, RX.source);
}
(async () => {
  const { b, p, b2, q } = await shared(393);
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.simple = false; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  const pages = ['', 'calendar/', 'travel/', 'finance/', 'house/', 'papers/', 'people/', 'habits/', 'goals/', 'work/', 'wish/', 'food/', 'health/'];
  for (const pg of pages) {
    p.errs.length = 0; await go(p, pg, 2500);
    const where = [pg || 'home'], words = [].concat(await bad(p));
    const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo));
    for (const t of tabs) { await p.evaluate(t => { const x = document.querySelector('[data-ptab-go="' + t + '"]'); x && x.click(); }, t); await sl(700); words.push(...await bad(p)); }
    check(!p.errs.length && !words.length, (pg || 'home') + (tabs.length ? ' (+' + tabs.length + ' tabs)' : '') + (p.errs.length ? ' errors: ' + p.errs.join(' | ').slice(0, 200) : '') + (words.length ? ' odd text: ' + [...new Set(words)].join(' | ').slice(0, 200) : ''));
  }
  for (const at of ['overview', 'website', 'system', 'shared']) {
    p.errs.length = 0; await p.evaluate(at => sessionStorage.setItem('adTab', at), at); await go(p, 'admin/', 2000);
    const w = await bad(p); check(!p.errs.length && !w.length, 'admin · ' + at + (p.errs.length ? ' errors: ' + p.errs.join(' | ').slice(0, 200) : '') + (w.length ? ' odd text: ' + w.join(' | ').slice(0, 200) : ''));
  }
  const st = await (async () => { await go(p, '', 2000); return p.evaluate(() => [...new Set([...document.querySelectorAll('[data-go]')].map(x => x.dataset.go))]); })();
  const odd = [];
  for (const s of st) { await p.evaluate(s => { const x = document.querySelector('[data-go="' + s + '"]'); if (x) x.click(); }, s); await sl(500); const w = await bad(p); if (w.length) odd.push(s + ': ' + w.join(' | ')); }
  check(!odd.length && !p.errs.length, 'all ' + st.length + ' Settings pages' + (odd.length ? ' odd text: ' + odd.join(' ; ').slice(0, 300) : '') + (p.errs.length ? ' errors: ' + p.errs.join(' | ').slice(0, 200) : ''));
  const tabs = await q.evaluate(() => [...document.querySelectorAll('nav [data-tab], .h-tabs [data-tab]')].map(x => x.dataset.tab));
  for (const t of tabs) { q.errs.length = 0; await q.evaluate(t => document.querySelector('[data-tab="' + t + '"]').click(), t); await sl(700); const w = await bad(q); check(!q.errs.length && !w.length, 'shared app · ' + t + (q.errs.length ? ' errors: ' + q.errs.join(' | ').slice(0, 200) : '') + (w.length ? ' odd text: ' + w.join(' | ').slice(0, 200) : '')); }
  await done(b, b2);
})();
