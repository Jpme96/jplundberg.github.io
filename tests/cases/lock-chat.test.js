/* Locking cmd with the chat open must hide the chat. The chat pop-up (z-index 60) sat above the lock screen (50), so the
   messages stayed readable on the lock screen (2026-11-10). Now: the lock screen is on top of everything, nothing else on
   the page shows while locked, and the chat forgets its messages, photos and key until unlocked again.
   Phone and computer width. Made-up data only. */
const { shared, sl, until, unlock } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await q.click('.hc-bub'); await sl(1200);
  await q.type('.hc-row textarea', 'Secret test message'); await q.click('.hc-row .hc-send'); await sl(1500);
  for (const [w, h, name] of [[393, 852, 'phone'], [1280, 900, 'computer']]) {
    await p.setViewport({ width: w, height: h }); await sl(400);
    await p.evaluate(() => { const n = document.getElementById('dgNote'); if (n) n.hidden = true; });   /* a self-check notice can sit over the button on phones */
    await p.click('.hc-bub');
    check(await until(p, () => /Secret test message/.test((document.querySelector('.hc-pop') || {}).innerText || ''), 10000) !== null, name + ': the chat is open with the message');
    await p.evaluate(() => Vault.lock()); await sl(1000);
    const r = await p.evaluate(() => {
      /* what is actually drawn at a grid of points: only the lock screen may be there */
      const seen = new Set();
      for (let x = 5; x < innerWidth; x += 40) for (let y = 5; y < innerHeight; y += 40) {
        const el = document.elementFromPoint(x, y); if (el && !el.closest('#lock')) seen.add(el.className || el.tagName);
      }
      const vis = el => { if (!el) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && el.getClientRects().length > 0; };
      return { outside: [...seen].slice(0, 5), pop: vis(document.querySelector('.hc-pop')), bub: vis(document.querySelector('.hc-bub')),
        text: /Secret test message/.test(document.body.innerHTML), left: window.HomeChat.unread() === 0 && !window.HomeChat.last() };
    });
    check(!r.outside.length, name + ': only the lock screen shows while locked' + (r.outside.length ? ' – also: ' + r.outside.join(', ') : ''));
    check(!r.pop && !r.bub, name + ': no chat pop-up or chat button while locked');
    check(!r.text && r.left, name + ': the message is gone from the page and from the chat\'s memory');
    await unlock(p); await sl(2500);
    await p.evaluate(() => { const n = document.getElementById('dgNote'); if (n) n.hidden = true; });   /* a self-check notice can sit over the button on phones */
    await p.click('.hc-bub');
    check(await until(p, () => /Secret test message/.test((document.querySelector('.hc-pop') || {}).innerText || ''), 10000) !== null, name + ': after unlocking the chat works again');
    await p.evaluate(() => HomeChat.closePop()); await sl(400);
  }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b, b2);
})();
