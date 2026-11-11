/* Living pictures after instant page changes (the bug JP saw 2026-11-11: after the first page change every avatar
   froze while its actions went on, because the page change dropped the engine's drawing loop). Here we move between
   pages the way a person does – tapping the menu, no reloads – and check that on each living page the avatar really
   moves on screen, and that the avatar page's "See it move" moves after page changes too. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const pose = p => p.evaluate(sel => { const h = document.querySelector(sel + ' .hero-body'); return h ? (h.getAttribute('transform') || '') + '|' + [...document.querySelectorAll(sel + ' .av-limb path')].map(x => x.getAttribute('d')).join('') + '|' + [...document.querySelectorAll(sel + ' .av-legL g, ' + sel + ' .av-legR g')].map(x => x.getAttribute('transform')).join('') : ''; }, '#scIllu');
async function moves(p, ms) { const a = await pose(p); for (let t = 0; t < ms; t += 400) { await sl(400); const b = await pose(p); if (a && b && a !== b) return true; } return false; }
(async () => {
  const { b, p } = await open(393);
  await p.evaluate(() => { ['flex', 'meetings', 'food', 'work', 'healthpage', 'wish', 'goals', 'papers', 'calendar', 'finance'].forEach(k => { try { Features.set(k, true); } catch (e) {} }); });
  await go(p, '', 2000);
  await p.evaluate(() => { window.__still = 'same page'; });
  for (const pg of ['finance', 'calendar', 'finance', 'food', 'goals', 'finance']) {
    /* an instant page change, as from the menu */
    await p.evaluate(pg => { const a = document.createElement('a'); a.href = '/cmd/' + pg + '/'; document.body.appendChild(a); a.click(); a.remove(); }, pg);
    const there = await until(p, pg => location.pathname === '/cmd/' + pg + '/' && !!document.querySelector('#scIllu .hero'), 12000, pg);
    check(there !== null, pg + ': reached by an instant page change, the avatar is there');
    check(await p.evaluate(() => window.__still === 'same page'), pg + ': without a reload');
    check(await moves(p, 9000), pg + ': the avatar moves on screen');
    check(await p.evaluate(() => document.querySelectorAll('#scIllu .hero').length) === 1, pg + ': one avatar');
  }
  /* the avatar page after all those page changes */
  await p.evaluate(() => Avatar.page('Test', Avatar.look(), () => {}, { mine: true })); await sl(500);
  await p.evaluate(() => document.querySelector('.avp [data-avp-play]').click()); await sl(500);
  const sp = () => p.evaluate(() => { const h = document.querySelector('.avp-test .hero-body'); return h ? h.getAttribute('transform') : ''; });
  const s0 = await sp(); await sl(1500); const s1 = await sp();
  check(!!s0 && s0 !== s1, '"See it move" moves after page changes');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
