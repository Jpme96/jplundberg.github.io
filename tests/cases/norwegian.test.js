/* In Norwegian, how much English is still left on each page? Counted, not perfect yet – the test fails only if a page
   gets MORE English than its budget (so new texts must come with Norwegian). Lower the budgets as translations improve. */
const { open, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
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
  await done(b);
})();
