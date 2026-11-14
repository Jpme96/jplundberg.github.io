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

  /* --- Documents: the same Document control as /cmd, on Team's storage --- */
  const tmpf = path.join(__dirname, '..', '.tmp', 'team-project-' + process.pid + '.json');
  fs.writeFileSync(tmpf, JSON.stringify({ team: 'dctl', v: 1, p: { id: 'cmd1', name: 'School rehab SECRET-DC', no: 'P-1', made: '2026-11-14T10:00:00Z', files: [{ id: 'f1', name: 'x.pdf' }],
    lines: [{ id: 'a1', code: '442', sys: 'Lighting SECRET-SYS', type: 'Drift', t: 'B', st: 'missing', files: ['f1'] }, { id: 'a2', code: '442', sys: 'Lighting SECRET-SYS', type: 'Vedlikehold', t: 'C', st: 'recv' }, { id: 'a3', code: '320', sys: 'Heating', t: 'B', st: 'missing' }] } }));
  await own.goto(U + '#docs'); await own.reload();
  check(await until(own, () => !!document.querySelector('#wkDocCtl [data-dcnew]'), 20000), 'Documents opens Document control (the same code as /cmd)');
  check(await until(own, () => !!document.querySelector('#wkDocReq') && document.querySelector('#wkDocReq').innerHTML.length > 50), 'and Document requirements next to it');
  const inp = await own.$('input[data-dcimport]'); await inp.uploadFile(tmpf);
  check(await until(own, () => /School rehab SECRET-DC/.test(document.body.innerText) && /^#dc=/.test(location.hash), 15000), 'a project sent from /cmd is imported and opened');
  check(await own.evaluate(() => { const p = DocHost.Fe.list('dctl')[0]; return p.lines.length === 3 && !(p.files || []).length && p.lines.every(l => !(l.files || []).length) && p.id !== 'cmd1'; }), 'with its lines, without the files (they stay on the device), as a new project');
  await word(own, 'Document control in Team');
  /* a requirements list from /cmd lands under Document requirements */
  const tmpr = path.join(__dirname, '..', '.tmp', 'team-req-' + process.pid + '.json');
  fs.writeFileSync(tmpr, JSON.stringify({ team: 'dckrav', v: 1, p: { id: 'r1', name: 'Facade requirements SECRET-REQ', made: '2026-11-14T09:00:00Z', lines: [{ id: 'q1', code: '231', sys: 'Outer walls', t: 'A', st: 'missing' }] } }));
  await own.goto(U + '#docs'); await own.reload(); await own.waitForSelector('input[data-dcimport]', { timeout: 20000 });
  await (await own.$('input[data-dcimport]')).uploadFile(tmpr);
  check(await until(own, () => /^#dr=/.test(location.hash) && !document.getElementById('wkDocReq').hidden && /Facade requirements SECRET-REQ/.test(document.getElementById('wkDocReq').innerText), 15000), 'a requirements list sent from /cmd opens under Document requirements');
  check(await own.evaluate(() => DocHost.Fe.list('dckrav').length === 1 && DocHost.Fe.list('dctl').length === 1), 'next to the project, kept apart');
  /* Kari (Can edit) opens it, cannot approve, but marks a line Not approved */
  await kari.goto(U + '#docs'); await kari.reload();
  check(await until(kari, () => !!document.querySelector('[data-dcopen]'), 20000), 'Kari sees the project');
  await kari.click('[data-dcopen]'); await kari.waitForSelector('[data-dctab="docs"]'); await kari.click('[data-dctab="docs"]');
  await kari.waitForSelector('[data-dcline="a2"]'); await kari.click('[data-dcline="a2"]');
  await kari.waitForSelector('[data-dcst="a2:ok"]'); await kari.click('[data-dcst="a2:ok"]'); await sl(800);
  check(await kari.evaluate(() => DocHost.Fe.list('dctl')[0].lines.find(l => l.id === 'a2').st === 'recv'), 'Can edit cannot mark a document Approved');
  await kari.click('[data-dcst="a2:rej"]'); await sl(1200);
  /* at the same time the owner changes another line of the same project */
  await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a1').st = 'na'; DocHost.Fe.saveTools(t); }); await sl(1200);
  await kari.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a3').cmt = 'Missing the manual'; DocHost.Fe.saveTools(t); }); await sl(1200);
  await own.reload(); await own.waitForSelector('.t-tabs'); await until(own, () => window.DocHost && DocHost.Fe.list('dctl').length === 1, 15000);
  const ls = await own.evaluate(() => DocHost.Fe.list('dctl')[0].lines.map(l => l.id + ':' + l.st + ':' + (l.cmt || '')).join(','));
  check(/a1:na:/.test(ls) && /a2:rej:/.test(ls) && /a3:missing:Missing the manual/.test(ls), 'two people changing the same project at once lose nothing (' + ls + ')');
  check(await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a2').st = 'ok'; DocHost.Fe.saveTools(t); return true; }) && await until(own, () => !Object.values(window.__team.recs).some(r => r.k === 'dcl' && r.v === 0)), 'the owner (Admin) can approve');
  await sl(800);
  await kari.reload(); await kari.waitForSelector('.t-tabs'); await until(kari, () => window.DocHost && DocHost.Fe.list('dctl').length === 1, 15000);
  check(await kari.evaluate(() => DocHost.Fe.list('dctl')[0].lines.find(l => l.id === 'a2').st === 'ok'), "and Kari sees the owner's approval");
  const memDc = (await raw('/__mem')).body;
  check(!/SECRET-DC|SECRET-SYS|SECRET-REQ|Missing the manual|Lighting/.test(memDc), 'the server only has the projects as ciphertext');

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
  check(await until(own, () => /approved Kari/.test(document.body.innerText) && /removed Ola/.test(document.body.innerText) && /MARK-SECRET-1/.test(document.body.innerText) && /Documents: School rehab SECRET-DC/.test(document.body.innerText)), 'the change log shows who did what');
  await word(own, 'the team tab');

  /* --- the server never had anything readable --- */
  const all = (await raw('/__mem')).body;
  check(!/SECRET|Fire safety|Supplier|owner-pass|kari-pass|ola-pass|per-pass/.test(all), 'the server only has ciphertext (no meeting text, no passcodes)');
  check(!/"d":"/.test(all), 'no private keys in the clear');

  /* --- more than one team: each its own members, invites, key and records; the first team is untouched --- */
  const stranger2 = await api(kari2, 'teams', { method: 'POST', body: '{}' });
  check(stranger2 === 403, 'only the owner can make a new team');
  await own.goto(U + '?new=1'); await own.waitForSelector('form[data-form=setup]');
  check(/New team/.test(await text(own)) && /Your teams/.test(await text(own)), 'the owner gets a "New team" form with a way back');
  await own.type('input[name=team]', 'Second site'); await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-2'); await own.type('input[name=pass2]', 'owner-pass-2');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs') && /Second site/.test(document.body.innerText), 20000), 'the new team opens after set-up');
  const tid2 = await own.evaluate(() => window.__team.tid);
  await own.click('[data-act=teams]'); await own.waitForSelector('.t-teams');
  check(/Second site/.test(await own.$eval('.t-teams', e => e.textContent)), 'the new team is in the list at once');
  await own.click('[data-act=close]');
  check(/^[a-z0-9]{12}$/.test(tid2) && await own.evaluate(() => window.__team.members.length === 1), 'it has its own id and only the owner in it');
  check(await own.evaluate(() => !Object.keys(window.__team.recs).length), 'none of the first team\'s records are in it');
  await own.goto(U + '#meetings'); await own.waitForSelector('[data-act=newMeeting]'); await own.click('[data-act=newMeeting]'); await own.waitForSelector('form[data-form=meeting]');
  await own.type('input[name=title]', 'Second MARK-SECRET-5'); await own.click('form[data-form=meeting] button[type=submit]');
  await until(own, () => /Second MARK/.test(document.body.innerText));
  const link3 = await invite('read', '1d');
  check(new RegExp('&t=' + tid2 + '$').test(link3), 'its invites carry the team');
  const kt = JSON.parse(await kari2.evaluate(() => fetch('/api/teams').then(r => r.text())));
  check(kt.teams.length === 1 && kt.teams[0].id === 'team', 'Kari sees only her own team (not the new one, not its name)');
  check(await kari2.evaluate(t => fetch('/api/recs', { headers: { 'x-tid': t } }).then(r => r.status), tid2) === 403, 'and gets nothing from it');
  check(await kari2.evaluate(() => fetch('/api/recs', { headers: { 'x-tid': 'nope' } }).then(r => r.status)) === 400, 'a made-up team id is refused');
  /* Per joins the second team with its link */
  const per = await person('per@y.no');
  await per.goto(link3.replace(/^https?:\/\/[^/]+\//, U)); await per.waitForSelector('form[data-form=join]');
  check(/Join Second site/.test(await text(per)), 'the link opens the right team');
  await per.type('input[name=name]', 'Per'); await per.type('input[name=pass]', 'per-pass-11'); await per.type('input[name=pass2]', 'per-pass-11'); await per.click('button[type=submit]');
  check(await until(per, () => !!document.getElementById('checkCode')), 'Per waits for approval');
  await own.goto(U + '#team'); await own.reload(); await until(own, () => !!document.querySelector('[data-act=approve]')); await own.click('[data-act=approve]');
  check(await until(per, () => !!document.querySelector('.t-tabs'), 15000), 'Per is in the second team');
  await per.goto(U + '#meetings'); await sl(400);
  check(/MARK-SECRET-5/.test(await text(per)) && !/MARK-SECRET-1|MARK-SECRET-4/.test(await text(per)), 'Per reads the second team only');
  /* the owner switches back: the first team opens without its passcode again (its keys stayed on this device) */
  await own.click('[data-act=teams]'); await own.waitForSelector('.t-teams');
  check(/Site team/.test(await text(own)) && /Second site/.test(await text(own)), 'the owner sees both teams');
  await own.evaluate(() => [...document.querySelectorAll('[data-act=goTeam]')].find(b => /Site team/.test(b.textContent)).click());
  check(await until(own, () => !!document.querySelector('.t-tabs') && /Site team/.test(document.body.innerText), 15000), 'switching back opens the first team without unlocking again');
  await own.goto(U + '#meetings'); await sl(400);
  check(/MARK-SECRET-4/.test(await text(own)) && !/MARK-SECRET-5/.test(await text(own)), 'the first team shows only its own meetings');
  await own.evaluate(() => localStorage.setItem('team.cur', 'team'));
  await word(own, 'after switching teams');
  const all2 = (await raw('/__mem')).body;
  check(!/SECRET|Second MARK|per-pass|owner-pass/.test(all2), 'the second team on the server is ciphertext too');

  /* --- Norwegian --- */
  await kari.evaluate(() => localStorage.setItem('team.lang', 'nb'));
  await kari.evaluateOnNewDocument(() => localStorage.setItem('team.lang', 'nb'));
  await kari.goto(U + '#overview'); await kari.reload(); await kari.waitForSelector('.t-tabs');
  const nbt = await text(kari);
  check(/Oversikt/.test(nbt) && /Møter/.test(nbt) && /Dokumenter/.test(nbt) && !/Overview|Meetings/.test(nbt), 'Norwegian when chosen');
  await kari.goto(U + '#docs'); await kari.reload(); await until(kari, () => !!document.querySelector('#wkDocCtl [data-dcnew]'), 20000);
  check(/Dokumentkontroll/.test(await text(kari)) && !/Document control/.test(await text(kari)), 'Document control in Norwegian too');
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
