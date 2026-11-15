/* Page clean-ups (JP, 15 Nov 2026), made-up data only: one sync line in the footer, key numbers that are all 0 stay hidden,
   People has no "Coming up" card that only repeats the next birthday, Food folds past days with no dinner, Admin groups
   repeated log lines, and the picture at the top takes less of a computer screen. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => {
    ['people', 'wish', 'meals', 'food'].forEach(f => Features.set(f, true));
    const t = Features.tools();
    const d = new Date(); d.setDate(d.getDate() + 40);
    t.people = [{ id: 'pp1', name: 'Ola Test', bday: d.getDate() + '.' + (d.getMonth() + 1) + '.1990' }];
    t.wishes = [];
    t.adminlog = [{ at: Date.now() - 1000, t: 'Ran all checks', i: 'arrow-clockwise' }, { at: Date.now() - 2000, t: 'Ran all checks', i: 'arrow-clockwise' }, { at: Date.now() - 3000, t: 'Ran all checks', i: 'arrow-clockwise' }, { at: Date.now() - 4000, t: 'Downloaded a backup', i: 'download' }];
    Features.saveTools(t);
  });
  await sl(500);
  await go(p, 'wish/', 2500);
  const w = await p.evaluate(() => { const s = document.getElementById('wsTiles'); return { cls: s && s.classList.contains('tk-empty'), shown: s ? getComputedStyle(s).display : 'none', foot: (document.querySelector('.foot') || {}).textContent || '' }; });
  check(w.cls && w.shown === 'none', 'Wishlist: the key numbers stay hidden while they are all 0');
  check((w.foot.match(/Synced|Synkronisert/g) || []).length <= 1 && /Encrypted with your passcode/.test(w.foot), 'the footer says "synced" once: ' + w.foot.replace(/\s+/g, ' ').trim());
  await p.evaluate(() => { const t = Features.tools(); t.wishes = [{ id: 'w1', title: 'Made-up lamp', price: 400 }]; Features.saveTools(t); }); await sl(800);
  check(await p.evaluate(() => getComputedStyle(document.getElementById('wsTiles')).display !== 'none'), 'and show again once something is in them');

  await go(p, 'people/', 2500);
  check(await p.evaluate(() => { const c = document.getElementById('pdates'); return !c || c.hidden || !c.innerHTML; }), 'People: no "Coming up" card when it would only repeat the next birthday');

  await go(p, 'food/', 2500);
  const dow = new Date().getDay(), past = dow === 1 ? 0 : (dow === 0 ? 6 : dow - 1);
  const f1 = await p.evaluate(() => ({ gone: (document.querySelector('.hl-gone') || {}).textContent || '', rows: document.querySelectorAll('.hl-meals input[data-ml]').length }));
  if (past) {
    check(/earlier day/.test(f1.gone) && f1.rows === 7 - past, 'Food: ' + past + ' past days with no dinner fold into one line (' + f1.rows + ' rows shown)');
    await p.evaluate(() => document.querySelector('[data-mlpast]').click()); await sl(300);
    check(await p.evaluate(() => document.querySelectorAll('.hl-meals input[data-ml]').length === 7), 'and open with one tap');
  } else check(!f1.gone && f1.rows === 7, 'Food: on a Monday nothing is folded');

  await go(p, 'admin/', 2800);
  const lg = await p.evaluate(() => [...document.querySelectorAll('.cr-log li span')].map(x => x.textContent).join(' | '));
  check(/Ran all checks ×3/.test(lg) && /Downloaded a backup/.test(lg) && (lg.match(/Ran all checks/g) || []).length === 1, 'Admin: repeated log lines are one line with ×3: ' + lg);

  await go(p, 'calendar/', 2800);
  const h = await p.evaluate(() => { const x = document.querySelector('.fp-hero'); return x ? Math.round(x.getBoundingClientRect().height) : 0; });
  check(h > 0 && h <= 380, 'the picture area at the top of Calendar is at most 380 px tall on a computer (' + h + ' px)');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
