/* Team: clocking in and out (Phase G, JP 2026-11-15). Off until an admin turns it on for the team in Settings; then a
   card on Overview with Clock in / Clock out, the running time and this week's hours; the admin can switch it off for
   one person (the card goes for them); admins see everyone's week on the Team tab; clocking stays out of the change log
   and the server never holds anything readable. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 420, T = 'http://localhost:' + TPORT + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
function raw(p) { return new Promise(res => { http.get(T.replace(/\/$/, '') + p, r => { let d = ''; r.on('data', c => { d += c; }); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', () => res({ status: 0, body: '' })); }); }
async function until(pg, fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn).catch(() => false)) return true; await sl(150); } return false; }

(async () => {
  for (let i = 0; i < 50 && (await raw('/index.html')).status !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  const ctx = await b.createBrowserContext(), own = await ctx.newPage();
  await own.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
  await own.setCookie({ name: 'who', value: 'owner%40x.no', domain: 'localhost', path: '/' });
  own.on('pageerror', e => errs.push(e.message));
  await own.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); window.confirm = () => true; });
  const text = () => own.evaluate(() => document.body.innerText);
  const click = sel => own.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);

  await own.goto(T); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Clock team');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 20000), 'the owner is in the app');

  /* off until an admin turns it on */
  await own.goto(T + '#overview'); await sl(1000);
  check(!(await own.$('.t-clock')), 'no clock card before an admin turns it on');
  await click('[data-act=settings]'); await sl(400);
  check(await own.evaluate(() => !!document.querySelector('[data-clockteam]') && !document.querySelector('[data-clockteam]').checked), 'Settings has the team switch, off');
  await own.evaluate(() => { const c = document.querySelector('[data-clockteam]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  check(await until(own, () => !!document.querySelector('[data-clockm="owner@x.no"]'), 8000), 'turned on: a switch per person appears');
  await click('[data-act=close]'); await sl(300);
  check(await until(own, () => !!document.querySelector('.t-clock [data-act=clockIn]'), 8000) && /Not clocked in/.test(await text()), 'Overview shows the clock card: not clocked in');

  /* clock in, then out */
  await click('[data-act=clockIn]');
  check(await until(own, () => /In since \d\d:\d\d/.test(document.body.innerText) && !!document.querySelector('.t-clock.on [data-act=clockOut]'), 8000), 'clocked in: "In since HH:MM" and Clock out');
  await sl(300); await click('[data-act=clockOut]');
  check(await until(own, () => !!document.querySelector('.t-clock [data-act=clockIn]') && /this week 0 h 0\d min/.test(document.body.innerText), 8000), 'clocked out: back to Clock in, with this week\'s hours');
  const mem = (await raw('/__mem')).body;
  check(/"k":"clk"/.test(mem) && /"k":"cfg"/.test(mem) && !/owner@x\.no","start|"start":\d/.test(mem.replace(/"by":"owner@x\.no"/g, '')), 'the server keeps the clock entry and the setting, encrypted');

  /* admins see the team's week on the Team tab */
  await own.goto(T + '#team'); await sl(800);
  const tt = await text();
  check(/Hours this week/i.test(tt), 'the Team tab shows hours this week for admins ' + (/Hours this week/i.test(tt) ? '' : tt.slice(0, 400).replace(/\n/g, ' | ')));
  const all = JSON.parse((await raw('/__mem')).body), logs = all.filter(x => /^l:\d+$/.test(x[0])).map(x => x[1]);
  check(logs.length > 0 && !logs.some(l => l.k === 'clk') && logs.some(l => l.k === 'cfg'), 'clocking in and out stays out of the change log (the setting is in it) – ' + logs.map(l => l.k).join(','));

  /* switched off for one person: their card goes */
  await own.goto(T + '#overview'); await sl(600);
  await click('[data-act=settings]'); await sl(400);
  await own.evaluate(() => { const c = document.querySelector('[data-clockm="owner@x.no"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await sl(800); await click('[data-act=close]'); await sl(500);
  check(await until(own, () => !document.querySelector('.t-clock'), 6000), 'switched off for you: the card is gone');
  const t = await text();
  check(!/\bundefined\b|\bNaN\b|\bnull\b/.test(t), 'no undefined/NaN/null');

  /* Norwegian */
  await own.evaluate(() => localStorage.setItem('team.lang', 'nb')); await own.evaluateOnNewDocument(() => localStorage.setItem('team.lang', 'nb')); await own.reload(); await until(own, () => !!document.querySelector('.t-tabs') || !!document.querySelector('form[data-form=unlock]'), 15000);
  if (await own.$('form[data-form=unlock]')) { await own.type('form[data-form=unlock] input[type=password]', 'owner-pass-1'); await own.click('form[data-form=unlock] button[type=submit]'); await until(own, () => !!document.querySelector('.t-tabs'), 15000); }
  await sl(500);
  await click('[data-act=settings]'); await sl(400);
  const nt = await text();
  check(/Stemple inn og ut for teamet/.test(nt), 'Norwegian: "Stemple inn og ut for teamet" ' + (/Stemple inn og ut/.test(nt) ? '' : nt.slice(0, 300).replace(/\n/g, ' | ')));
  check(!errs.length, 'no errors ' + errs.join(' | ').slice(0, 300));
  await b.close(); srv.kill(); done();
})();
