/* The phone menu: the tab you press takes its name and width at once and the highlight lands on it exactly
   (2026-11-22, JP: "the animation here is very laggy" – it arrived icon-sized and jumped wider when the page came). */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  const r = await p.evaluate(() => new Promise(res => {
    const nav = document.querySelector('.tabbar'), cur = nav.querySelector('a[aria-current="page"]'), t = [...nav.querySelectorAll('a[data-pg]')].find(a => a !== cur && a.offsetWidth > 0);
    t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    setTimeout(() => {
      const pill = nav.querySelector('.tb-pill').getBoundingClientRect(), tr = t.getBoundingClientRect(), lbl = t.querySelector('span:last-child');
      const out = { dl: Math.abs(pill.left - tr.left), dw: Math.abs(pill.width - tr.width), tw: tr.width, cw: cur.getBoundingClientRect().width, label: !!lbl && getComputedStyle(lbl).display !== 'none' };
      t.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
      setTimeout(() => { out.back = !nav.querySelector('a.going'); res(out); }, 400);
    }, 450);
  }));
  check(r.label && r.tw > 90, 'the pressed tab shows its name and widens right away ' + JSON.stringify(r));
  check(r.cw < 70, 'the current tab narrows to an icon');
  check(r.dl < 3 && r.dw < 3, 'the highlight lands exactly on the pressed tab');
  check(r.back, 'letting go without opening puts it back');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await done(b);
})();
