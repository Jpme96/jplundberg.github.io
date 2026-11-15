/* Settings → Menu & pages: one switch per page puts it in or out of the menu (no need to switch its features off one by one),
   and Work, Health and House have a switch per tab. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => { ['flex', 'meetings', 'holiday', 'learning', 'fdv', 'wish'].forEach(f => Features.set(f, true)); Features.set('people', false); });
  await go(p, '', 2500);
  const flip = (sel, on) => p.evaluate((sel, on) => { const i = document.querySelector(sel); if (!i) return false; i.checked = on; i.dispatchEvent(new Event('change', { bubbles: true })); return true; }, sel, on);

  check(await flip('#stNav input[data-navon="wish"]', false), 'Settings → Menu has a switch for Wishlist');
  await sl(300);
  const st1 = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('tab-off-wish'), off: JSON.parse(localStorage.getItem('dash.settings')).navOff, feat: Features.on('wish') }));
  check(st1.cls && st1.off.includes('wish') && st1.feat, 'switched off: Wishlist leaves the menu, the feature itself stays on ' + JSON.stringify(st1));
  await go(p, 'calendar/', 2500);
  check(await p.evaluate(() => document.documentElement.classList.contains('tab-off-wish')), 'and stays out of the menu on the next page (decided before the first paint)');

  /* a page whose features are all off: the switch turns its main feature on */
  check(await flip('#stNav input[data-navon="people"]', true), 'People has a switch too, though its features are off');
  await sl(400);
  check(await p.evaluate(() => Features.on('people') && !document.documentElement.classList.contains('tab-off-people')), 'switching People on turns the People feature on and puts it in the menu');

  /* Work tabs */
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#stNav input[data-navtab^="work|"]')].map(i => i.dataset.navtab));
  check(tabs.length >= 4 && tabs.includes('work|plan'), 'Work lists its tabs with a switch each: ' + tabs.join(', '));
  await flip('#stNav input[data-navtab="work|plan"]', false); await sl(200);
  await go(p, 'work/', 2500);
  const wt = await p.evaluate(() => [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo));
  check(wt.length && !wt.includes('plan'), 'Work without the Plan tab: ' + wt.join(','));
  /* switch them all off – one tab still stays */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings')); s.tabOff = { work: ['today', 'insp', 'req', 'doc', 'notes', 'plan'] }; localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); });
  await sl(400);
  const wt2 = await p.evaluate(() => document.querySelectorAll('[data-ptab-go]').length);
  check(wt2 > 0, 'with every tab off the tabs still show (' + wt2 + ')');

  await flip('#stNav input[data-navon="wish"]', true); await sl(300);
  check(await p.evaluate(() => !document.documentElement.classList.contains('tab-off-wish')), 'switched back on: Wishlist is back in the menu');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
