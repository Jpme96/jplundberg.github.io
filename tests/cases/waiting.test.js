/* "N changes waiting" (C10): offline, an edit shows a small chip at the top of the page with how many changes are
   waiting; back online it syncs and the chip goes away. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  check(await until(p, () => window.Vault && Vault.syncState() === 'ok', 15000) !== null, 'synced to begin with');
  check(await p.evaluate(() => !document.getElementById('waitChip')), 'no chip when everything is synced');
  await p.setOfflineMode(true);
  await p.evaluate(() => { const t = Features.tools(); t.homenotes = (t.homenotes || []).concat([{ id: 'wn1', title: 'Offline note', text: 'Made up' }]); Features.saveTools(t); });
  await p.evaluate(() => Vault.sync && Vault.sync());
  const chip = await until(p, () => { const c = document.getElementById('waitChip'); return c && /\d+ (change|changes) waiting|endring/.test(c.textContent) ? c.textContent.trim() : false; }, 20000);
  check(chip !== null, 'offline: the chip says changes are waiting: ' + await p.evaluate(() => (document.getElementById('waitChip') || {}).textContent));   /* until() gives the wait in ms – 0 when it's there at once */
  const box = await p.evaluate(() => { const r = document.getElementById('waitChip').getBoundingClientRect(); return { top: r.top, right: r.right, w: innerWidth }; });
  check(box.top >= 0 && box.top < 80 && box.right <= box.w, 'it sits at the top, inside the phone screen ' + JSON.stringify(box));
  await p.setOfflineMode(false);
  await p.evaluate(() => { const c = document.getElementById('waitChip'); if (c) c.click(); });   /* coming back online may already have synced */
  check(await until(p, () => !document.getElementById('waitChip') && Vault.syncState() === 'ok', 20000) !== null, 'back online: it syncs and the chip goes away');
  check(!p.errs.filter(e => !/Failed to fetch|NetworkError|ERR_INTERNET/.test(e)).length, 'no page errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
