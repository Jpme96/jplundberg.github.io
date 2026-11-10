/* Chat: sending keeps the keyboard up, Active now / appear offline, photos get a small preview that loads first. */
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const { shared, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
/* a 1600×1200 PNG made here (no real photo in the repo) */
function png(w, h) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = x % 256; raw[o + 1] = y % 256; raw[o + 2] = (x * y) % 256; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const { b, p, b2, q } = await shared();
  const reqs = []; p.on('request', r => { if (/cfile/.test(r.url()) && r.method() === 'GET') reqs.push(r.url().split('id=')[1]); });
  await p.click('.hc-bub'); await sl(1200); await q.click('.hc-bub'); await sl(1500);
  const hdr = pg => pg.evaluate(() => (document.querySelector('.hc-head .hc-tt small') || {}).innerText || '');
  check(/Active now/.test(await hdr(p)), 'owner sees Iago “Active now”');
  /* send with the keyboard up */
  await q.tap('.hc-row textarea'); await q.type('.hc-row textarea', 'Hello there'); await q.tap('.hc-row .hc-send'); await sl(1500);
  check(await q.evaluate(() => document.activeElement && document.activeElement.tagName) === 'TEXTAREA', 'the text box keeps focus after sending');
  check(await p.evaluate(() => /Hello there/.test(document.querySelector('.hc-list').innerText)), 'owner got the message');
  /* photo with preview */
  const f = path.join(__dirname, '..', '.tmp', 'photo.png'); fs.writeFileSync(f, png(1600, 1200));
  const inp = await q.$('input[data-in=pics]'); await inp.uploadFile(f); await sl(400); await q.click('.hc-row .hc-send'); await sl(6000);
  const fid = await q.evaluate(() => { const i = [...document.querySelectorAll('.hc-imgs img')].pop(); return i && i.dataset.fid; });
  check(await p.evaluate(() => !!document.querySelector('.hc-imgs img.on')), 'owner sees the photo');
  check(reqs.length >= 1 && reqs.indexOf(fid) < 0, 'owner loaded the small preview, not the full photo');
  /* opening a photo keeps the chat open (phone and computer), closing the photo goes back to the chat */
  for (const [pg, who] of [[q, 'phone'], [p, 'computer']]) {
    await pg.evaluate(() => document.querySelector('.hc-imgs button, .hc-imgs img').scrollIntoView());
    if (who === 'phone') await pg.tap('.hc-imgs button'); else await pg.click('.hc-imgs button');
    await sl(700);
    const st1 = await pg.evaluate(() => [!!document.querySelector('.hc-view, .fv-bg'), !!document.querySelector('.hc-pop')]);
    check(st1[0] && st1[1], who + ': a photo opens and the chat stays open ' + JSON.stringify(st1));
    if (who === 'phone') await pg.tap('.hc-view [data-x], .fv-x'); else await pg.click('.hc-view [data-x], .fv-x');
    await sl(700);
    const st2 = await pg.evaluate(() => [!document.querySelector('.hc-view, .fv-bg'), !!document.querySelector('.hc-pop')]);
    check(st2[0] && st2[1], who + ': closing the photo goes back to the chat ' + JSON.stringify(st2));
  }
  /* the owner on a phone too (cmd) */
  await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); await p.reload(); await sl(3500);
  if (!(await p.evaluate(() => !!document.querySelector('.hc-pop')))) { await p.tap('.hc-bub'); await sl(1500); }
  await p.evaluate(() => document.querySelector('.hc-imgs button').scrollIntoView()); await p.tap('.hc-imgs button'); await sl(800);
  const st3 = await p.evaluate(() => [!!document.querySelector('.hc-view, .fv-bg'), !!document.querySelector('.hc-pop')]);
  check(st3[0] && st3[1], 'owner’s phone: a photo opens and the chat stays open ' + JSON.stringify(st3));
  await p.tap('.hc-view img, .fv-body'); await sl(800);
  const st4 = await p.evaluate(() => [!document.querySelector('.hc-view, .fv-bg'), !!document.querySelector('.hc-pop')]);
  check(st4[0] && st4[1], 'owner’s phone: tapping the photo closes it and the chat is still there ' + JSON.stringify(st4));
  /* Escape closes the photo first, the chat stays */
  await p.setViewport({ width: 1280, height: 900 }); await sl(500);
  await p.evaluate(() => { if (!document.querySelector('.hc-pop .hc-imgs button')) { const bb = document.querySelector('.hc-bub'); if (bb) bb.click(); } }); await sl(1500);
  const opened = await p.evaluate(() => { const b = document.querySelector('.hc-pop .hc-imgs button'); if (!b) return false; b.scrollIntoView(); b.click(); return true; }); await sl(700);
  await p.keyboard.press('Escape'); await sl(400);
  check(opened && await p.evaluate(() => !document.querySelector('.hc-view') && !!document.querySelector('.hc-pop')), 'Escape closes the photo and the chat stays (opened: ' + opened + ')');
  /* the send arrow sits in the middle of its circle */
  const off = await q.evaluate(() => { const b = document.querySelector('.hc-row .hc-send'), i = b && b.querySelector('i, svg'); if (!b || !i) return 'none'; const r = b.getBoundingClientRect(), c = i.getBoundingClientRect(); return [Math.round((c.left + c.width / 2) - (r.left + r.width / 2)), Math.round((c.top + c.height / 2) - (r.top + r.height / 2))]; });
  check(Array.isArray(off) && Math.abs(off[0]) <= 1 && Math.abs(off[1]) <= 1, 'the send arrow is centred: ' + JSON.stringify(off));
  /* appear offline */
  await q.click('[data-hcmenu]'); await sl(500); await q.click('[data-away="1"]'); await sl(1500);
  check(!/Active/.test(await hdr(p)), 'with “Show when I’m active” off, the owner no longer sees Iago active');
  check(!/Active/.test(await hdr(q)), '… and Iago doesn’t see the owner either');
  await q.click('[data-hcmenu]'); await sl(400); await q.click('[data-away="0"]'); await sl(1500);
  check(/Active now/.test(await hdr(p)), 'switched back on: Active now again');
  /* mute is a setting on the server, not a message that can disappear */
  await p.evaluate(() => fetch('/cmd/api/chat', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 86400000 }) }));
  await sl(800); await p.evaluate(() => document.querySelector('[data-hcmenu]').click()); await sl(500); await p.evaluate(() => document.querySelector('[data-mute="3600000"]').click()); await sl(1500);
  const mu = await p.evaluate(() => fetch('/cmd/api/chat').then(r => r.json()).then(j => j.mute && j.mute.o));
  check(mu > Date.now() + 3000e3, 'mute is stored as a setting on the server');
  check(await q.evaluate(() => HomeChat._test.mutedThem()), 'Iago’s app knows the owner muted the chat');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
