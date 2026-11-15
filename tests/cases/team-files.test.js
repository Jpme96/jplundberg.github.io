/* Team: shared files (encrypted in chunks), upload links for a contractor (the real /upload/ page, no account), push when
   Team is closed (only "someone changed something"), starting without signal, all projects at a glance and the week in short.
   The server must never hold anything readable. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http'); const os = require('os');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 410, T = 'http://localhost:' + TPORT + '/', SITE = 'http://localhost:' + (process.env.PORT || 8770) + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
function raw(p, opt = {}) { return new Promise(res => { const q = http.request(T.replace(/\/$/, '') + p, { method: opt.method || 'GET', headers: Object.assign({ cookie: opt.cookie || '' }, opt.headers || {}) }, r => { let d = ''; r.on('data', c => { d += c; }); r.on('end', () => res({ status: r.statusCode, body: d, headers: r.headers })); }); q.on('error', () => res({ status: 0, body: '' })); if (opt.body) q.write(opt.body); q.end(); }); }
async function until(pg, fn, ms = 15000, arg) { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await sl(150); } return false; }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-'));

(async () => {
  for (let i = 0; i < 50 && (await raw('/index.html')).status !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  const ctx = await b.createBrowserContext(), own = await ctx.newPage();
  await own.setViewport({ width: 420, height: 860, isMobile: true, hasTouch: true });
  await own.setCookie({ name: 'who', value: 'owner%40x.no', domain: 'localhost', path: '/' });
  own.on('pageerror', e => errs.push(e.message));
  await own.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); window.confirm = () => true; window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (x) { window.__blobs.push(x); return o.call(URL, x); }; HTMLAnchorElement.prototype.click = function () {}; });
  const text = () => own.evaluate(() => document.body.innerText);

  /* set up a team and import a project */
  await own.goto(T); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Files team');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 20000), 'the owner is in the app');
  const proj = path.join(tmp, 'p.json');
  fs.writeFileSync(proj, JSON.stringify({ team: 'dctl', p: { name: 'Testveien 9', no: '9', lines: [{ id: 'a1', code: '223', name: 'Plan', st: 'ok' }, { id: 'a2', code: '231', name: 'Section', st: 'missing' }, { id: 'a3', code: '320', name: 'Pipes', st: 'recv' }] } }));
  await own.goto(T + '#docs'); await own.waitForSelector('input[data-dcimport]');
  await (await own.$('input[data-dcimport]')).uploadFile(proj);
  check(await until(own, () => /Imported/.test(document.body.innerText) || location.hash.startsWith('#dc='), 15000), 'a made-up project is imported');
  await sl(800);

  /* overview: all projects at a glance, and the week */
  await own.goto(T + '#overview'); await sl(1200);
  const ov = await text();
  check(/Testveien 9/.test(ov) && /1 of 3 approved/.test(ov) && /33 %/.test(ov), 'Overview lists the projects with how far they are');
  check(/This week/.test(ov) && /Testveien 9: 3 documents changed/.test(ov), 'Overview has "This week" in short');

  /* a shared file: 2.4 MB in three encrypted chunks */
  await own.goto(T + '#files'); await own.waitForSelector('input[data-fadd]');
  const big = path.join(tmp, 'report.txt'), MARK = 'made-up-file-content-';
  fs.writeFileSync(big, MARK.repeat(Math.ceil(2.4e6 / MARK.length)));
  await (await own.$('input[data-fadd]')).uploadFile(big);
  check(await until(own, () => /report\.txt/.test(document.body.innerText), 30000), 'the file is listed under Shared files');
  const mem = (await raw('/__mem')).body;
  check(/"f:[a-f0-9]{32}:2"/.test(mem) && !/made-up-file-content|report\.txt/.test(mem), 'the server holds three encrypted chunks and neither the content nor the name');
  await own.click('[data-act=fopen]');
  check(await until(own, () => window.__blobs.some(x => x && x.size > 2.3e6), 20000), 'opening it brings back the whole file');
  const back = await own.evaluate(() => { const f = window.__blobs.filter(x => x && x.size > 2.3e6).pop(); return f.text().then(t => t.slice(0, 42) + '|' + f.size + '|' + f.name); });
  check(back.startsWith('made-up-file-content-made-up-file-content-') && back.endsWith('|report.txt'), 'and it is the same file (' + back.split('|').slice(1).join(' ') + ')');

  /* an upload link, used by a contractor on the real /upload/ page (no account, no Team sign-in) */
  await own.click('[data-act=uplink]'); await own.waitForSelector('form[data-form=uplink]');
  await own.select('select[name=pid]', await own.$eval('select[name=pid] option:nth-child(2)', o => o.value));
  await own.click('form[data-form=uplink] button[type=submit]');
  await own.waitForSelector('#invLink');
  const link = await own.$eval('#invLink', e => e.value);
  check(/^https:\/\/jplundberg\.com\/upload\/#team\.[a-f0-9]{16}\.[A-Za-z0-9_-]{40,}\.Testveien%209$/.test(link), 'the link holds the team, the link id, its key and the project name after #');
  const memL = (await raw('/__mem')).body, keyPart = link.split('#')[1].split('.')[2];
  check(!memL.includes(keyPart), 'the link key is not on the server in readable form');
  const con = await (await b.createBrowserContext()).newPage();
  await con.setRequestInterception(true);
  con.on('request', async r => {
    const u = r.url();
    if (u.includes('/upload/api/')) { const res = await raw('/api/up/' + u.split('/upload/api/')[1], { method: r.method(), body: r.postData(), headers: { 'content-type': 'application/json', cookie: 'noauth=1' } }); return r.respond({ status: res.status, contentType: 'application/json', body: res.body }); }
    r.continue();
  });
  con.on('pageerror', e => errs.push('upload page: ' + e.message));
  await con.goto(SITE + 'upload/' + link.slice(link.indexOf('#')));
  check(await until(con, () => /Testveien 9/.test(document.body.innerText) && !!document.getElementById('pick'), 10000), 'the contractor sees the upload page for the project');
  const dwg = path.join(tmp, 'A-101 plan.pdf'); fs.writeFileSync(dwg, '%PDF-1.4 made-up drawing ' + 'x'.repeat(5000));
  await (await con.$('#pick')).uploadFile(dwg);
  check(await until(con, () => /1 file sent/.test(document.body.innerText), 15000), 'the contractor sends a file without signing in');
  check((await raw('/api/up/team/0000000000000000/info', { cookie: 'noauth=1' })).status === 410, 'a made-up link id does not work');

  await own.goto(T + '#overview'); await own.goto(T + '#files');
  check(await until(own, () => /A-101 plan\.pdf/.test(document.body.innerText), 15000), 'the team sees the file name (opened with the link key on the device)');
  await own.click('[data-act=upkeep]');
  check(await until(own, () => [...document.querySelectorAll('[data-act=fopen]')].some(x => /A-101 plan\.pdf/.test(x.textContent)), 15000), '"Keep" puts it into the shared files');
  await own.evaluate(() => { window.__blobs = []; [...document.querySelectorAll('[data-act=fopen]')].find(x => /A-101/.test(x.textContent)).click(); });
  check(await until(own, () => window.__blobs.some(x => x && /A-101/.test(x.name || '')), 15000), 'and it opens');
  const got = await own.evaluate(() => window.__blobs.find(x => /A-101/.test(x.name || '')).text().then(t => t.slice(0, 25)));
  check(got === '%PDF-1.4 made-up drawing ', 'the uploaded file comes back as sent');
  /* switching the link off */
  await own.evaluate(() => document.querySelector('[data-act=upoff]').click()); await sl(1200);
  const offInfo = await raw('/api/up/team/' + link.split('#')[1].split('.')[1] + '/info', { cookie: 'noauth=1' });
  await con.goto('about:blank'); await con.goto(SITE + 'upload/' + link.slice(link.indexOf('#')));
  check(offInfo.status === 410 && await until(con, () => /run out or was switched off/.test(document.body.innerText), 8000), 'a switched-off link stops working (' + offInfo.status + ')');
  await con.close();

  /* push when Team is closed: the switch in Settings stores this device's subscription for the team */
  const k = await own.evaluate(() => fetch('/api/push', { headers: { 'x-team': '1' } }).then(r => r.json()));
  check(/^[A-Za-z0-9_-]{80,}$/.test(k.key || ''), 'Team has its own push key (made once, kept on the server)');
  const fake = await own.evaluate(async () => { const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)); const b = u => btoa(String.fromCharCode.apply(null, u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return { endpoint: 'https://push.example.test/abc123def456', keys: { p256dh: b(pub), auth: b(crypto.getRandomValues(new Uint8Array(16))) } }; });
  const on = await own.evaluate(s => fetch('/api/push', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ sub: s, on: true }) }).then(r => r.json()), fake);
  check(on.on === true && /"p:owner@x\.no:/.test((await raw('/__mem')).body), 'switching push on keeps the subscription for this team');
  await own.evaluate(s => fetch('/api/push', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint, on: false }) }), fake);
  check(!/"p:owner@x\.no:/.test((await raw('/__mem')).body), 'and switching it off removes it');
  await own.evaluate(() => { document.querySelector('[data-act=settings]') && document.querySelector('[data-act=settings]').click(); });
  check(await until(own, () => !!document.querySelector('input[data-push]'), 5000), 'Settings has the "Push when Team is closed" switch');
  await own.keyboard.press('Escape');

  /* starting without signal */
  await own.goto(T + '#overview'); await sl(1500);
  check(await until(own, () => !!(navigator.serviceWorker && navigator.serviceWorker.controller), 15000), 'Team has a service worker for starting without signal');
  await sl(1500);
  await own.setOfflineMode(true);
  await own.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  check(await until(own, () => /Files team/.test(document.body.innerText) && /Testveien 9/.test(document.body.innerText), 15000), 'without signal Team still opens with what was here last');
  check(/No signal/.test(await text()), 'and says it is showing what was saved');
  await own.setOfflineMode(false);

  check(!errs.length, 'no errors ' + errs.join(' | ').slice(0, 400));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  await done();
})();
