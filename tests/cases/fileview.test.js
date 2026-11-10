/* Files open in a panel inside the dashboard (not a new tab): a picture and a PDF show, Download keeps the name,
   Expand fills the screen, Close / Escape / tapping outside closes it. Phone and computer. Made-up files only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PDF = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
(async () => {
  for (const W of [393, 1280]) {
    const { b, p } = await open(W);
    await go(p, 'papers/', 2500);
    const tabs0 = (await b.pages()).length;
    const make = (data, type, name, bin) => p.evaluate((d, ty, n, bin) => { const bytes = bin ? Uint8Array.from(atob(d), c => c.charCodeAt(0)) : new TextEncoder().encode(d);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: ty })); a.target = '_blank'; a.innerHTML = '<b>' + n + '</b>'; a.id = 'fvT'; document.querySelector('main').appendChild(a); a.click(); a.remove(); }, data, type, name, bin);
    await make(PNG, 'image/png', 'Receipt.png', true); await sl(700);
    const img = await p.evaluate(() => { const bx = document.querySelector('.fv-bg.open'); return bx ? [bx.querySelector('.fv-name').textContent, !!bx.querySelector('.fv-img'), bx.querySelector('.fv-dl').getAttribute('download')].join('|') : 'none'; });
    check(img === 'Receipt.png|true|Receipt.png', W + ' px: a picture opens in the panel with Download: ' + img);
    check((await b.pages()).length === tabs0, W + ' px: no new tab');
    await p.keyboard.press('Escape'); await sl(400);
    check(await p.evaluate(() => !document.querySelector('.fv-bg')), W + ' px: Escape closes it');
    /* a tall phone screenshot fits whole in the panel – no scrolling to see it (2026-11-10) */
    await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1179; c.height = 2556; const g = c.getContext('2d'); g.fillStyle = '#eee'; g.fillRect(0, 0, c.width, c.height);
      return new Promise(ok => c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.target = '_blank'; a.innerHTML = '<b>IMG_0001.png</b>'; document.querySelector('main').appendChild(a); a.click(); a.remove(); ok(); }, 'image/png')); });
    await sl(900);
    const tall = await p.evaluate(() => { const bd = document.querySelector('.fv-bg.open .fv-body'), im = bd && bd.querySelector('.fv-img'); if (!im || !im.naturalHeight) return 'no picture';
      const r = im.getBoundingClientRect(), q = bd.getBoundingClientRect();
      return { scrolls: bd.scrollHeight > bd.clientHeight + 1 || bd.scrollWidth > bd.clientWidth + 1, inside: r.top >= q.top - 1 && r.bottom <= q.bottom + 1 && r.left >= q.left - 1 && r.right <= q.right + 1,
        ratio: Math.abs(r.width / r.height - 1179 / 2556) < .02, h: Math.round(r.height) }; });
    check(tall.scrolls === false && tall.inside && tall.ratio && tall.h > 200, W + ' px: a tall picture fits whole, no scrolling ' + JSON.stringify(tall));
    await p.click('.fv-img'); await sl(300);
    check(await p.evaluate(() => { const bd = document.querySelector('.fv-body'); return bd.scrollHeight > bd.clientHeight + 1; }), W + ' px: clicking it shows it at full size (then it scrolls)');
    await p.keyboard.press('Escape'); await sl(400);
    await make(PDF, 'application/pdf', 'Contract.pdf', false); await sl(800);
    check(await p.evaluate(() => !!document.querySelector('.fv-bg.open iframe.fv-pdf')), W + ' px: a PDF opens in the panel');
    if (W > 600) { await p.click('.fv-big'); await sl(300); check(await p.evaluate(() => document.querySelector('.fv-bg').classList.contains('fv-full') && document.querySelector('.fv-box').getBoundingClientRect().width >= innerWidth - 2), 'Expand fills the screen'); }
    else check(await p.evaluate(() => document.querySelector('.fv-box').getBoundingClientRect().width >= innerWidth - 2), 'on a phone it fills the screen');
    await p.click('.fv-x'); await sl(400);
    check(await p.evaluate(() => !document.querySelector('.fv-bg') && !document.documentElement.classList.contains('fv-on')), W + ' px: Close closes it');
    check(!p.errs.length, W + ' px: no errors ' + p.errs.join(' | ').slice(0, 200));
    await b.close();
  }
  await done();
})();
