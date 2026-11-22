/* The life pages (2026-11-22, JP: Home life · Life admin · Me): each shows in the menu only while one of its
   sections is on, opens with its tabs, and says so when nothing is on. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const menu = () => p.evaluate(() => ['homelife', 'lifeadmin', 'me'].map(pg => { const a = document.querySelector('.tabbar a[data-pg="' + pg + '"]'); return !!a && getComputedStyle(a).display !== 'none'; }));
  await go(p, '', 2500);
  check((await menu()).every(x => !x), 'all three stay out of the menu while their sections are off');
  await go(p, 'me/', 2500);
  check(await p.evaluate(() => { const e = document.querySelector('[data-pgempty="me"]'); return !!e && !e.hidden; }), 'Me with nothing on says how to turn sections on');
  await p.evaluate(() => { Features.set('sleep', true); Features.set('ladmin', true); Features.set('pets', true); });
  await go(p, '', 2500);
  check((await menu()).every(x => x), 'one section on puts its page in the menu ' + JSON.stringify(await menu()));
  await go(p, 'me/', 3000);
  const me = await p.evaluate(() => ({ empty: document.querySelector('[data-pgempty="me"]').hidden, tabs: [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo), card: (document.querySelector('[data-tool="lp-sleep"]') || {}).innerHTML.length > 50, h1: document.querySelector('.fp-hero h1').textContent }));
  check(me.empty && me.card && me.tabs.indexOf('rest') > -1 && me.tabs.indexOf('career') < 0 && me.h1 === 'Me', 'Me: the Sleep card in the Rest tab, no tab for sections that are off ' + JSON.stringify(me));
  await go(p, 'lifeadmin/', 3000);
  check(await p.evaluate(() => /Yearly tasks/.test(document.querySelector('[data-tool="lp-ladmin"]').textContent)), 'Life admin: the section is called Yearly tasks');
  await go(p, 'homelife/', 3000);
  check(await p.evaluate(() => document.querySelector('.tabbar a[data-pg="homelife"]').getAttribute('aria-current') === 'page' && !!document.querySelector('[data-tool="lp-pets"]').innerHTML), 'Home life: its menu tab is lit and the Pets card is drawn');
  await p.screenshot({ path: '/tmp/homelife.png' });
  check(!p.errs.length, 'no script errors ' + p.errs.slice(0, 2).join(' | '));
  await b.close(); done();
})();
