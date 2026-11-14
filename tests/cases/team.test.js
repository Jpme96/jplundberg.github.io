/* Team (work.jplundberg.com): its own Worker and app, separate from /cmd.
   Set-up by the owner, one-time invites, check codes, approval, roles, meetings and actions encrypted on the device,
   one writer at a time, carried-over actions, removal with a new team key, a new device unlocked with the passcode,
   the change log, Norwegian, the strict CSP – and that the server never sees what people wrote. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 400, U = 'http://localhost:' + TPORT + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
function raw(p, opt = {}) { return new Promise(res => { const q = http.request(U.replace(/\/$/, '') + p, { method: opt.method || 'GET', headers: Object.assign({ cookie: opt.cookie || '' }, opt.headers || {}) }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b, headers: r.headers })); }); q.on('error', () => res({ status: 0, body: '' })); if (opt.body) q.write(opt.body); q.end(); }); }
async function until(pg, fn, ms = 15000, arg) { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await sl(120); } return false; }

(async () => {
  for (let i = 0; i < 50 && (await raw('/index.html')).status !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  async function person(email, W = 393) {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    await p.setViewport({ width: W, height: 852, isMobile: W < 700, hasTouch: W < 700 });
    await p.setCookie({ name: 'who', value: encodeURIComponent(email), domain: 'localhost', path: '/' });
    p.on('pageerror', e => errs.push(email + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(email + ' console: ' + m.text().slice(0, 200)); });
    await p.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); window.confirm = () => true; });
    p.ctx = ctx; return p;
  }
  const text = p => p.evaluate(() => document.body.innerText);
  const api = (p, path, opt) => p.evaluate((path, opt) => fetch('/api/' + path, Object.assign({ headers: { 'x-team': '1', 'content-type': 'application/json' } }, opt || {})).then(r => r.status), path, opt);
  const word = async (p, where) => { const t = await text(p); check(!/\bundefined\b|\bNaN\b|\bnull\b|\[object/.test(t), 'no undefined/NaN/null on ' + where); const o = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); check(o, 'nothing wider than the phone on ' + where); };

  /* --- the door: Access token needed and it must be Team's own app (not /cmd's) --- */
  check((await raw('/api/me', { cookie: 'noauth=1' })).status === 401, 'no Access token → 401');
  check((await raw('/api/me', { cookie: 'wrongaud=1' })).status === 401, "a token for /cmd's Access app is refused");
  const post = await raw('/api/setup', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  check(post.status === 400, 'a write without the app header is refused (' + post.status + ')');
  const page0 = await raw('/');
  check(/default-src 'self'/.test(page0.headers['content-security-policy'] || '') && page0.headers['x-frame-options'] === 'DENY', 'the app has a strict CSP and cannot be framed');

  /* --- someone who is not the owner cannot set up the team --- */
  const stranger = await person('stranger@y.no');
  await stranger.goto(U); await until(stranger, () => /No team yet/.test(document.body.innerText));
  check(/No team yet/.test(await text(stranger)), 'before set-up, others see "No team yet"');
  check(await api(stranger, 'setup', { method: 'POST', body: JSON.stringify({ name: 'x', me: {} }) }) === 403, 'only the owner can set up the team');

  /* --- the owner sets it up --- */
  const own = await person('owner@x.no');
  await own.goto(U); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Site team');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 20000), 'the owner is in the app after set-up');
  check(/Site team/.test(await text(own)) && /your role: Admin/.test(await text(own)), 'overview shows the team and the role');
  check(await api(own, 'setup', { method: 'POST', body: JSON.stringify({ name: 'x', me: {} }) }) === 409, 'set-up works only once');
  await word(own, 'overview');

  /* --- an invite for Kari --- */
  async function invite(role, ttl) {
    await own.goto(U + '#team'); await own.waitForSelector('[data-act=invite]'); await own.click('[data-act=invite]');
    await own.waitForSelector('form[data-form=invite]'); await own.select('select[name=role]', role); if (ttl) await own.select('select[name=ttl]', ttl);
    await own.click('form[data-form=invite] button[type=submit]'); await own.waitForSelector('#invLink');
    return own.$eval('#invLink', e => e.value);
  }
  const link = await invite('edit', '1d');
  check(/\/\?join=[a-f0-9]{32}$/.test(link), 'the invite is a link with a one-time code ' + link.replace(/[a-f0-9]{32}/, '…'));
  const kari = await person('kari@y.no');
  await kari.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await kari.waitForSelector('form[data-form=join]');
  check(await kari.evaluate(() => location.search === ''), 'the code is taken off the address at once');
  await kari.type('input[name=name]', 'Kari'); await kari.type('input[name=pass]', 'kari-pass-1'); await kari.type('input[name=pass2]', 'kari-pass-2');
  await kari.click('button[type=submit]'); await sl(300);
  check(/not the same/.test(await text(kari)), 'two different passcodes are caught');
  await kari.$eval('input[name=pass2]', e => { e.value = ''; }); await kari.type('input[name=pass2]', 'kari-pass-1'); await kari.click('button[type=submit]');
  check(await until(kari, () => !!document.getElementById('checkCode') && /-/.test(document.getElementById('checkCode').textContent)), 'Kari waits for approval with a check code');
  const kcode = await kari.$eval('#checkCode', e => e.textContent);
  check(await api(kari, 'recs') === 403, 'while waiting Kari gets no records');
  /* the same link a second time: used up */
  const ola0 = await person('ola@y.no');
  await ola0.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await ola0.waitForSelector('form[data-form=join]');
  await ola0.type('input[name=name]', 'Ola'); await ola0.type('input[name=pass]', 'ola-pass-11'); await ola0.type('input[name=pass2]', 'ola-pass-11'); await ola0.click('button[type=submit]');
  check(await until(ola0, () => /run out or was already used/.test(document.body.innerText)), 'an invite works only once');
  await ola0.ctx.close();

  /* --- the owner sees the request with the same check code and approves --- */
  await own.goto(U + '#team'); await own.reload();
  check(await until(own, () => /Wants to join/i.test(document.body.innerText)), 'the owner sees the request');
  check(await until(own, c => [...document.querySelectorAll('[data-code]')].some(e => e.textContent === c), 8000, kcode), 'with the same check code as on Kari\'s phone');
  check(/1/.test(await own.$eval('.t-tabs [data-go=team]', e => e.textContent)), 'the Team tab shows a badge for the request');
  await own.click('[data-act=approve]');
  check(await until(own, () => /Kari is in the team/.test(document.body.innerText)), 'approved');
  check(await until(kari, () => !!document.querySelector('.t-tabs'), 15000), "Kari's phone opens the app by itself");

  /* --- a meeting with an action --- */
  await own.goto(U + '#meetings'); await own.waitForSelector('[data-act=newMeeting]'); await own.click('[data-act=newMeeting]');
  await own.waitForSelector('form[data-form=meeting]');
  await own.type('input[name=title]', 'Weekly site meeting MARK-SECRET-1');
  await own.evaluate(() => { const f = document.querySelector('form[data-form=meeting]'); f.date.value = '2026-11-11'; f.agenda.value = 'Fire safety\nFDV handover'; f.decisions.value = 'Fire plan to rev C SECRET-DEC'; f.guests.value = 'Supplier'; f.querySelectorAll('input[name=att]').forEach(x => { x.checked = true; }); });
  await own.click('form[data-form=meeting] button[type=submit]');
  check(await until(own, () => /Weekly site meeting MARK-SECRET-1/.test(document.body.innerText) && /Fire plan to rev C/.test(document.body.innerText) && /Supplier \(guest\)/.test(document.body.innerText)), 'the meeting is saved and shown');
  const mid = await own.evaluate(() => location.hash.slice(3));
  await own.click('[data-act=newAction]'); await own.waitForSelector('form[data-form=action]');
  await own.type('form[data-form=action] input[name=text]', 'Send fire drawing SECRET-2');
  await own.select('form[data-form=action] select[name=owner]', 'kari@y.no');
  await own.$eval('form[data-form=action] input[name=due]', e => { e.value = '2026-01-05'; });
  await own.click('form[data-form=action] button[type=submit]');
  check(await until(own, () => /Send fire drawing SECRET-2/.test(document.body.innerText)), 'the action is on the meeting');
  await word(own, 'the meeting');

  await kari.reload(); await kari.waitForSelector('.t-tabs');
  check(await until(kari, () => /Send fire drawing SECRET-2/.test(document.body.innerText) && /Overdue/.test(document.body.innerText)), "Kari sees her overdue action on the overview");
  check(/MARK-SECRET-1/.test(await text(kari)), 'and the meeting');

  /* --- one writer at a time --- */
  await own.goto(U + '#m=' + mid); await own.waitForSelector('[data-act=edit]'); await own.click('[data-act=edit]'); await own.waitForSelector('form[data-form=meeting]');
  await kari.goto(U + '#m=' + mid); await kari.reload();
  check(await until(kari, () => /JP is writing/.test(document.body.innerText)), 'Kari sees that JP is writing');
  check(!(await kari.$('[data-act=edit]')), 'and has no Edit button meanwhile');
  const blocked = await api(kari, 'rec', { method: 'PUT', body: JSON.stringify({ id: mid, k: 'meeting', e: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA', v: 1 }) });
  check(blocked === 423, 'the server refuses a write while someone else is writing (' + blocked + ')');
  await own.click('[data-act=cancelEdit]'); await sl(400);
  await kari.reload(); await kari.waitForSelector('.t-tabs');
  check(await until(kari, () => !!document.querySelector('[data-act=edit]')), 'when JP is done, Kari can edit');
  /* an old version is refused */
  check(await api(kari, 'rec', { method: 'PUT', body: JSON.stringify({ id: mid, k: 'meeting', e: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA', v: 0 }) }) === 409, 'a save over a newer version is refused');

  /* --- Kari ticks her action; a later meeting carries open ones over --- */
  await kari.goto(U + '#overview'); await kari.waitForSelector('[data-tick]');
  await own.goto(U + '#meetings'); await own.click('[data-act=newMeeting]'); await own.waitForSelector('form[data-form=meeting]');
  await own.type('input[name=title]', 'Next week MARK-SECRET-3'); await own.$eval('input[name=date]', e => { e.value = '2026-11-18'; });
  await own.click('form[data-form=meeting] button[type=submit]');
  check(await until(own, () => /Carried over from earlier meetings/i.test(document.body.innerText) && /SECRET-2/.test(document.body.innerText)), 'an open action is carried over into the next meeting');
  await kari.click('[data-tick]'); await sl(600);
  await own.reload(); await own.waitForSelector('.t-tabs'); await sl(300);
  check(!/Carried over/i.test(await text(own)), 'once done, it is no longer carried over');

  /* --- roles --- */
  async function setRole(email, role) { await own.goto(U + '#team'); await own.reload(); await own.waitForSelector('[data-act=member][data-email="' + email + '"]'); await own.click('[data-act=member][data-email="' + email + '"]'); await own.waitForSelector('form[data-form=role]'); await own.select('form[data-form=role] select[name=role]', role); await own.click('form[data-form=role] button[type=submit]'); await until(own, () => !document.querySelector('.t-sheetbg')); }
  await setRole('kari@y.no', 'read');
  check(await api(kari, 'rec', { method: 'PUT', body: JSON.stringify({ id: 'abcdefgh12', k: 'action', e: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA', v: 0 }) }) === 403, 'Read cannot write');
  check(await api(kari, 'invites', { method: 'POST', body: '{}' }) === 403, 'and a non-admin cannot invite');
  await setRole('kari@y.no', 'admin');
  check(await api(own, 'role', { method: 'POST', body: JSON.stringify({ email: 'owner@x.no', role: 'edit' }) }) === 409, 'the owner stays admin');

  /* --- Ola joins and is removed: he gets nothing more, and the team moves to a new key --- */
  const link2 = await invite('read', '15m');
  const ola = await person('ola@y.no');
  await ola.goto(link2.replace(/^https?:\/\/[^/]+\//, U)); await ola.waitForSelector('form[data-form=join]');
  await ola.type('input[name=name]', 'Ola'); await ola.type('input[name=pass]', 'ola-pass-11'); await ola.type('input[name=pass2]', 'ola-pass-11'); await ola.click('button[type=submit]');
  await until(ola, () => !!document.getElementById('checkCode'));
  /* Kari is admin now and approves him */
  await kari.goto(U + '#team'); await kari.reload();
  check(await until(kari, () => !!document.querySelector('[data-act=approve]')), 'a second admin can approve too');
  await kari.click('[data-act=approve]');
  check(await until(ola, () => !!document.querySelector('.t-tabs'), 15000), 'Ola is in');
  await ola.goto(U + '#meetings'); await sl(300);
  check(/MARK-SECRET-1/.test(await text(ola)), 'and can read the old meetings');
  await ola.goto(U + '#overview');
  check(!(await ola.$('[data-act=newMeeting]')), 'Ola (Read) has no New meeting button');
  await own.goto(U + '#team'); await own.reload(); await own.waitForSelector('[data-act=member][data-email="ola@y.no"]');
  await own.click('[data-act=member][data-email="ola@y.no"]'); await own.waitForSelector('[data-act=remove]'); await own.click('[data-act=remove]');
  check(await until(own, () => /Ola was removed/.test(document.body.innerText)), 'Ola is removed');
  check(await own.evaluate(() => window.__team.me.team.epoch === 2 && !!window.__team.keys[2]), 'the team has a new key (epoch 2)');
  check(await api(ola, 'recs') === 403, 'Ola gets nothing from the server any more');
  await ola.reload(); check(await until(ola, () => /not in this team/.test(document.body.innerText)), 'his app says he is not in the team');
  await own.goto(U + '#meetings'); await own.click('[data-act=newMeeting]'); await own.waitForSelector('form[data-form=meeting]');
  await own.type('input[name=title]', 'After Ola MARK-SECRET-4'); await own.click('form[data-form=meeting] button[type=submit]');
  await until(own, () => /After Ola/.test(document.body.innerText));
  const mem = JSON.parse((await raw('/__mem')).body);
  const r4 = mem.filter(([k, v]) => k.startsWith('r:') && v.k === 'meeting').map(([, v]) => v).sort((a, b) => b.seq - a.seq)[0];
  check(r4 && r4.e === 2, 'new records use the new key');
  check(!mem.some(([k, v]) => k === 'm:ola@y.no') && !JSON.stringify(mem.filter(([k]) => k.startsWith('m:')).map(([, v]) => Object.keys(v.keys))).includes('"2"') === false, 'the others got the new key, Ola has no member entry');

  /* --- Kari on a new computer: unlocks with her passcode, reads old and new --- */
  const kari2 = await person('kari@y.no', 1280);
  await kari2.goto(U); await kari2.waitForSelector('form[data-form=unlock]');
  await kari2.type('input[name=pass]', 'wrong-pass'); await kari2.click('button[type=submit]');
  check(await until(kari2, () => /Wrong passcode/.test(document.body.innerText)), 'a wrong passcode is caught');
  await kari2.$eval('input[name=pass]', e => { e.value = ''; e.disabled = false; }); await kari2.type('input[name=pass]', 'kari-pass-1'); await kari2.click('button[type=submit]');
  check(await until(kari2, () => !!document.querySelector('.t-tabs')), 'the right passcode opens Team on the new device');
  await kari2.goto(U + '#meetings'); await sl(300);
  check(/MARK-SECRET-1/.test(await text(kari2)) && /MARK-SECRET-4/.test(await text(kari2)), 'she reads meetings from before and after the new key');

  /* --- the change log, shown to members, decrypted on the device --- */
  await own.goto(U + '#team'); await own.click('[data-act=log]');
  check(await until(own, () => /approved Kari/.test(document.body.innerText) && /removed Ola/.test(document.body.innerText) && /MARK-SECRET-1/.test(document.body.innerText)), 'the change log shows who did what');
  await word(own, 'the team tab');

  /* --- the server never had anything readable --- */
  const all = (await raw('/__mem')).body;
  check(!/SECRET|Fire safety|Supplier|owner-pass|kari-pass|ola-pass/.test(all), 'the server only has ciphertext (no meeting text, no passcodes)');
  check(!/"d":"/.test(all), 'no private keys in the clear');

  /* --- Norwegian --- */
  await kari.evaluate(() => localStorage.setItem('team.lang', 'nb'));
  await kari.evaluateOnNewDocument(() => localStorage.setItem('team.lang', 'nb'));
  await kari.goto(U + '#overview'); await kari.reload(); await kari.waitForSelector('.t-tabs');
  const nbt = await text(kari);
  check(/Oversikt/.test(nbt) && /Møter/.test(nbt) && !/Overview|Meetings/.test(nbt), 'Norwegian when chosen');
  await word(kari, 'Norwegian overview');

  /* --- kept apart from /cmd --- */
  const wr = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  check(!/kv_namespaces|d1_databases|r2_buckets|"VAULT"|"LIVE"|dashboard-sync/.test(wr) && /TeamStore/.test(wr) && /work\.jplundberg\.com/.test(wr), "Team's Worker has none of /cmd's bindings");
  const cmdJs = fs.readdirSync(path.join(__dirname, '..', '..', 'cmd')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', f), 'utf8')).join('\n');
  check(!/team-keys|\/api\/recs|TeamStore/.test(cmdJs), '/cmd has no Team data or keys');

  check(!errs.length, 'no page errors or CSP violations ' + errs.join(' | ').slice(0, 400));
  srv.kill();
  await done(b);
})();
