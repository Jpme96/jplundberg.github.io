/* In Norwegian, how much English is still left on each page? Counted, not perfect yet – the test fails only if a page
   gets MORE English than its budget (so new texts must come with Norwegian). Lower the budgets as translations improve. */
const { open, sl, U, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const EN = /\b(the|your|you|and|with|this|that|from|when|what|add|show|hide|nothing|today|tomorrow|week|month|settings|change|remove|open)\b/i;
const BUDGET = 40;     /* English bits per page, at most */
(async () => {
  const { b, p } = await open(440);
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; s.simple = false; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  let worst = 0, report = [];
  for (const pg of ['', 'calendar/', 'travel/', 'finance/', 'house/', 'papers/', 'people/', 'habits/', 'goals/', 'work/', 'wish/', 'food/']) {
    await go(p, pg, 2500);
    const en = await p.evaluate(src => { const R = new RegExp(src, 'i'), out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const el = n.parentElement, t = n.nodeValue.trim(); if (!t || t.length < 4 || !el || el.closest('script,style,textarea,input,code,.hc-list,[contenteditable]')) continue; if (!el.offsetParent) continue; if (R.test(t) && !/[æøå]/i.test(t)) out.add(t.slice(0, 50)); }
      return [...out]; }, EN.source);
    worst = Math.max(worst, en.length); report.push((pg || 'home') + ' ' + en.length);
    check(en.length <= BUDGET, (pg || 'home') + ': ' + en.length + ' English bits' + (en.length ? ' – e.g. ' + en.slice(0, 3).join(' | ') : ''));
  }
  console.log('  ' + report.join(' · ') + ' (worst ' + worst + ')');
  /* the words load once, right after the head (dist/nb.js), and keep translating after instant page changes */
  check(await p.evaluate(() => !!document.querySelector('script[src*="dist/nb.js"]')), 'Norwegian: the words file is loaded');
  await go(p, '', 2500);
  const c0 = await p.evaluate(() => SoftNav.count);
  await p.evaluate(() => { const a = document.querySelector('a[href$="/cmd/calendar/"], a[href="calendar/"]'); if (a) a.click(); });
  const soft = await until(p, (c0) => SoftNav.count > c0 && /\/calendar\/$/.test(location.pathname), 15000, c0);
  await sl(1500);
  const after = await p.evaluate(() => { const d = document.createElement('p'); d.textContent = 'Settings'; document.body.appendChild(d); return new Promise(r => setTimeout(() => { const t = d.textContent; d.remove(); r(t); }, 400)); });
  check(soft !== null && after === 'Innstillinger', 'after an instant page change new texts are still translated (' + after + ')');
  /* in English the words aren't fetched at all */
  const nbReq = [];
  p.on('request', r => { if (/dist\/nb\.js/.test(r.url())) nbReq.push(r.url()); });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'en'; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  await go(p, '', 2000);
  check(!nbReq.length && await p.evaluate(() => I18N.lang === 'en' && !document.querySelector('script[src*="dist/nb.js"]')), 'English: the Norwegian words are not loaded');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 300));
  await done(b);
})();
