/* The self-check notice and the chat button never cover each other. On phones the notice ran full width just above the
   menu and sat on top of the chat button, so a tap on the button closed the notice instead (2026-11-10).
   Phone, wide phone, tablet and computer width; a long notice that wraps. Made-up data only. */
const { shared, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2 } = await shared();
  for (const [w, h] of [[393, 852], [440, 956], [700, 1000], [1280, 900]]) {
    await p.setViewport({ width: w, height: h }); await sl(400);
    await p.evaluate(() => Diag.notice('t-long', 'Sync is slow right now – your changes are kept on this device and sent when the line is back.', 'Try again', function () {}));
    await sl(600);
    const r = await p.evaluate(() => {
      const n = document.getElementById('dgNote').getBoundingClientRect(), bb = document.querySelector('.hc-bub').getBoundingClientRect();
      const hit = (sel) => { const el = document.querySelector(sel), q = el.getBoundingClientRect(), at = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!(at && at.closest(sel)); };
      const apart = n.right <= bb.left || bb.right <= n.left || n.bottom <= bb.top || bb.bottom <= n.top;
      return { apart, bub: hit('.hc-bub'), x: hit('#dgNote .dg-x'), act: hit('#dgNote .dg-act'), inside: n.left >= 0 && n.right <= innerWidth, nw: Math.round(n.width) };
    });
    check(r.apart && r.bub && r.x && r.act && r.inside && r.nw >= 240, w + ' px: notice and chat button apart, both tappable, notice on screen ' + JSON.stringify(r));
    await p.click('.hc-bub');
    check(await until(p, () => !!document.querySelector('.hc-pop'), 5000) !== null, w + ' px: a tap on the chat button opens the chat');
    await p.evaluate(() => { HomeChat.closePop(); Diag.hide(); }); await sl(500);
  }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b, b2);
})();
