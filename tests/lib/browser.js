/* Browser helpers for the tests: a phone or computer-sized Chrome, unlocked cmd, and Iago's app next to it.
   CHROME_PATH picks a Chrome already on the machine; otherwise the one puppeteer downloaded is used. */
const puppeteer = require('puppeteer');
const U = 'http://localhost:' + (process.env.PORT || 8770) + '/cmd/';
const sl = ms => new Promise(r => setTimeout(r, ms));
const PASS = 'test-passcode-1';

async function launch() {
  return puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
}
async function page(b, W, opts = {}) {
  const p = await b.newPage(), touch = W < 700;
  await p.setViewport({ width: W, height: opts.h || (touch ? 852 : 945), isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket connection|localStorage|Manifest: Line: 1, column: 1/.test(m.text())) p.errs.push('console: ' + m.text().slice(0, 200)); });
  await p.setRequestInterception(true);
  p.on('request', r => { if (!r.url().startsWith('http://localhost')) return r.abort(); r.continue(); });
  return p;
}
/* the owner's cmd, unlocked (a new dashboard the first time, the synced one after) */
async function open(W, opts = {}) {
  const b = await launch(), p = await page(b, W, opts);
  await p.goto(U + (opts.path || '')); await sl(1500);
  await unlock(p);
  return { b, p };
}
/* type the passcode on the lock screen. When a synced dashboard exists, wait until the lock screen has found it
   (slow machines) – typing into "make a new one" would start a second, separate dashboard. */
async function unlock(p) {
  const synced = await p.evaluate(() => fetch('/cmd/api/vault', { credentials: 'same-origin' }).then(r => r.ok, () => false));
  if (synced) await until(p, () => { const c = document.getElementById('lockConfirm'); return !(c && c.offsetParent); }, 10000);
  await p.waitForSelector('#lockPass', { visible: true, timeout: 10000 });
  await p.type('#lockPass', PASS);
  if (await p.evaluate(() => { const c = document.getElementById('lockConfirm'); return !!(c && c.offsetParent); })) await p.type('#lockConfirm', PASS);
  await p.click('#lockSubmit');
  await until(p, () => document.documentElement.classList.contains('unlocked'), 15000);
  await sl(800);
}
/* go to a cmd page; if it came up locked (a slow machine missed the quick resume), unlock it */
async function go(p, path, wait = 2500) {
  await p.goto(U + (path || ''));
  /* normally the page opens unlocked by itself; only when the lock screen is really showing, type the passcode */
  const shown = () => { const i = document.getElementById('lockPass'), bx = document.getElementById('lockBox'); return !!(i && i.offsetParent && bx && getComputedStyle(bx).visibility !== 'hidden' && !document.documentElement.classList.contains('resuming')); };
  const ok = await until(p, '(' + 'function () { return document.documentElement.classList.contains("unlocked") || (' + shown.toString() + ')(); }' + ')()', 15000);
  if (ok !== null && !(await p.evaluate(() => document.documentElement.classList.contains('unlocked')))) await unlock(p);
  await sl(wait);
}
/* owner (computer) starts sharing; Iago's phone opens the shared app with the key */
async function shared(W2 = 393) {
  const { b, p } = await open(1280);
  const key = await p.evaluate(async () => {
    await fetch('/cmd/api/share', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ partner: 'iago@x.no', name: 'Iago' }) });
    const d = Vault.get(); d.share = Object.assign({}, d.share || {}, { key: ShareCore.genKey(), on: true, name: 'Iago', since: Features.dkey(new Date()) }); Vault.save(d); return d.share.key;
  });
  await sl(1500); await p.evaluate(() => ShareSpace.sync()); await sl(3000);
  const b2 = await launch(), q = await page(b2, W2);
  await q.setCookie({ name: 'as', value: 'partner', domain: 'localhost', path: '/' });
  await q.evaluateOnNewDocument(k => { localStorage.setItem('home.key', JSON.stringify(k)); localStorage.setItem('home.lang', 'en'); localStorage.setItem('home.profiled', '1'); }, key);
  await q.goto(U + 'home/'); await sl(4000);
  await q.evaluate(() => document.querySelectorAll('.h-sheetbg').forEach(x => x.remove()));
  return { b, p, b2, q, key };
}
/* wait until fn() in the page is true; returns ms taken, or null */
async function until(pg, fn, ms = 20000, arg) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return Date.now() - t; await sl(100); }
  return null;
}
module.exports = { launch, page, open, shared, until, sl, U, go, unlock };
