/* Team (work.jplundberg.com): its own Worker and app, separate from /cmd.
   Set-up by the owner, one-time invites, check codes, approval, roles, meetings and actions encrypted on the device,
   one writer at a time, carried-over actions, removal with a new team key, a new device unlocked with the passcode,
   the change log, Norwegian, the strict CSP – and that the server never sees what people wrote. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const impOpen = async (pg) => { await pg.waitForSelector('[data-act=settings]', { timeout: 20000 }); await pg.evaluate(() => { const s = document.querySelector('[data-act=settings]'); if (s) s.click(); }); await pg.waitForSelector('[data-settab=team]', { timeout: 20000 }); await pg.evaluate(() => document.querySelector('[data-settab=team]').click()); await pg.waitForSelector('input[data-dcimport]', { timeout: 20000 }); };   /* the import is in Settings → The team (review 19) */
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
    await p.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); localStorage.setItem('dash.dcOldView', '1'); window.confirm = () => true; new MutationObserver(() => { const y = document.querySelector('.ask-ov .ask-ok'); if (y) y.click(); }).observe(document, { childList: true, subtree: true }); });
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
  /* the way to /cmd is a small link on the right – not a back arrow at the top left (JP 2026-11-23 "I think it's the back button") */
  check(await own.evaluate(() => { const a = document.querySelector('.t-tocmd'), b = document.querySelector('.t-top .t-back'); return !!a && a.target === '_blank' && /cmd/.test(a.textContent) && !(b && /cmd/.test(b.textContent)); }), 'the owner reaches /cmd from a small link on the right, not a back arrow');
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
  /* New meeting from Oversikt (JP 2026-11-25 "it flickers twice"): the editor opens over the page you were on, without the whole page fading */
  { await own.goto(U + '#overview'); await own.waitForSelector('[data-act=newMeeting]');
    await own.evaluate(() => { window.__fl = []; new MutationObserver(() => { const a = document.getElementById('app'); if (a.classList.contains('t-enter')) window.__fl.push('fade'); }).observe(document.getElementById('app'), { attributes: true, attributeFilter: ['class'] }); });
    await own.click('[data-act=newMeeting]'); await own.waitForSelector('form[data-form=meeting]'); await sl(500);
    const nm = await own.evaluate(() => ({ fade: window.__fl.length, behind: !!document.querySelector('#app .t-edov') && /Siste møte|Latest meeting/i.test(document.getElementById('app').innerText), ver: '' }));
    nm.ver = await own.evaluate(async () => (await fetch('/version.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : '')).trim());
    check(!nm.fade && nm.behind, 'New meeting opens over Oversikt, no page fade ' + JSON.stringify(nm));
    check(/^[0-9a-f]{12}$/.test(nm.ver), 'the release has a version.txt that a tab compares with its own build (it reloads itself to a new one) ' + nm.ver);
    await own.evaluate(() => { const c = document.querySelector('[data-act=cancelEdit]'); c && c.click(); }); await sl(400); }
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
  check(await own.evaluate(() => { const o = document.querySelector('.t-edov'); return !!o && getComputedStyle(o).position === 'fixed' && !!o.querySelector('form[data-form=meeting]') && !!document.querySelector('.t-tabs'); }), 'New meeting opens as a popup over the Meetings page (JP 2026-11-17 21:39)');
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
  check(await until(own, () => !!document.querySelector('#wkDocCtl [data-drnew]'), 20000), 'Documents opens Documentation (the same code as /cmd)');
  check(await until(own, () => !!document.querySelector('#wkDocCtl .dx-tools [data-dxtool="plan"]') && !document.querySelector('[data-dtab="req"]')), 'one Documentation choice with the plan check on top (JP 2026-11-16)');
  check(await own.evaluate(() => { const r = document.getElementById('wkDocReq'); return !r || r.offsetHeight === 0; }), 'no empty Requirements card under the list (JP 2026-11-17 19:49)');
  await impOpen(own); const inp = await own.$('input[data-dcimport]'); await inp.uploadFile(tmpf);
  check(await until(own, () => /School rehab SECRET-DC/.test(document.body.innerText) && /^#dc=/.test(location.hash), 15000), 'a project sent from /cmd is imported and opened');
  check(await own.evaluate(() => { const p = DocHost.Fe.list('dctl')[0]; return p.lines.length === 3 && !(p.files || []).length && p.lines.every(l => !(l.files || []).length) && p.id !== 'cmd1'; }), 'with its lines, without the files (they stay on the device), as a new project');
  await word(own, 'Document control in Team');
  /* a requirements list from /cmd lands under Document requirements */
  const tmpr = path.join(__dirname, '..', '.tmp', 'team-req-' + process.pid + '.json');
  fs.writeFileSync(tmpr, JSON.stringify({ team: 'dckrav', v: 1, p: { id: 'r1', name: 'Facade requirements SECRET-REQ', made: '2026-11-14T09:00:00Z', lines: [{ id: 'q1', code: '231', sys: 'Outer walls', t: 'A', st: 'missing' }] } }));
  await own.goto(U + '#docs'); await own.reload(); await impOpen(own);
  await (await own.$('input[data-dcimport]')).uploadFile(tmpr);
  check(await until(own, () => /^#dr=/.test(location.hash) && !document.getElementById('wkDocReq').hidden && /Facade requirements SECRET-REQ/.test(document.getElementById('wkDocReq').innerText), 15000), 'a requirements list sent from /cmd opens under Document requirements');
  check(await own.evaluate(() => DocHost.Fe.list('dckrav').length === 1 && DocHost.Fe.list('dctl').length === 1), 'next to the project, kept apart');
  /* everything from /cmd's Document requirements in one file (JP 2026-11-16: Team is the home): lists, the checklist and the project
     types; imported again it updates instead of doubling */
  const tmpb = path.join(__dirname, '..', '.tmp', 'team-bundle-' + process.pid + '.json');
  const bundle = { team: 'dcbundle', v: 1, krav: [{ id: 'k1', name: 'Made-up school SECRET-B1', lines: [{ id: 'x1', code: '330', t: 'A', sys: 'Fire' }] }, { id: 'k2', name: 'Made-up hall SECRET-B2', lines: [] }],
    dcreq: { name: 'Made-up client list', codes: { '330': { t: 'AH' } } }, dcreqs: [], dctypes: [{ id: 'own1', name: 'Made-up type', codes: ['330'] }] };
  fs.writeFileSync(tmpb, JSON.stringify(bundle));
  await own.goto(U + '#docs'); await own.reload(); await impOpen(own);
  await (await own.$('input[data-dcimport]')).uploadFile(tmpb);
  check(await until(own, () => DocHost.Fe.list('dckrav').length === 3, 15000), 'the bundle brings every list along');
  const bt = await own.evaluate(() => { const t = DocHost.Fe.tools(); return { types: (t.dctypes || []).map(x => x.name).join(), req: !!(t.dcreq && t.dcreq.codes && t.dcreq.codes['330']) }; });
  check(bt.types === 'Made-up type' && bt.req, 'and the client checklist and the project types ' + JSON.stringify(bt));
  /* NS code names for the whole team (JP 2026-11-17): an admin imports them once, everyone gets them (encrypted settings record cfgns) */
  const nsOk = await own.evaluate(async () => { const r = [!!DocHost.nsShared, DocHost.nsCan && DocHost.nsCan()]; let ok; try { ok = await DocHost.nsSave({ '412': 'Made-up wiring name' }); } catch (e) { ok = 'err ' + e.message; } r.push(ok); return r; });
  const nsGot = await until(own, () => DocHost.LP.ownMap()['412'] === 'Made-up wiring name' && DocHost.LP.nsName('412') === 'Made-up wiring name', 8000);
  check(nsOk[0] && nsOk[1] && nsOk[2] && nsGot, 'an admin saves NS code names for the team ' + JSON.stringify(nsOk) + ' ' + nsGot);
  await kari.goto(U + '#docs'); await kari.reload(); await sl(2500);
  check(await until(kari, () => !!(window.DocHost && DocHost.LP.ownMap()['412'] === 'Made-up wiring name'), 20000), 'and a colleague sees them');
  bundle.krav[0].lines.push({ id: 'x2', code: '330', t: 'H', sys: 'Fire' }); fs.writeFileSync(tmpb, JSON.stringify(bundle));
  await own.reload(); await impOpen(own);
  await (await own.$('input[data-dcimport]')).uploadFile(tmpb);
  check(await until(own, () => { const l = DocHost.Fe.list('dckrav'); return l.length === 3 && (l.find(x => /SECRET-B1/.test(x.name)) || { lines: [] }).lines.length === 2; }, 15000), 'imported again, a list is updated, not doubled');
  /* a new list made in Team: the project, then the systems (the same flow as /cmd) */
  await own.evaluate(() => { const t = document.querySelector('[data-dtab="req"]') || [...document.querySelectorAll('.t-pick button')].find(b => /requirements/i.test(b.textContent)); if (t) t.click(); }); await sl(600);
  check(await until(own, () => !!document.querySelector('#wkDocCtl [data-drnew]'), 10000), 'Team has New project in Documentation');
  await own.evaluate(() => document.querySelector('#wkDocCtl [data-drnew]').click()); await sl(300);
  await own.evaluate(() => { const f = document.querySelector('form[data-drform]'); f.name.value = 'Made-up team list SECRET-T1'; f.requestSubmit(); }); await sl(800);
  check(await until(own, () => !!document.querySelector('#wkDocReq .dc-pick [data-dctick]'), 10000), 'it opens the system picker');
  await own.evaluate(() => { const c = document.querySelector('#wkDocReq [data-dctick="330"]') || document.querySelector('#wkDocReq [data-dctick]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  await own.evaluate(() => document.querySelector('#wkDocReq [data-dcmake="req"]').click()); await sl(1500);
  check(await until(own, () => { const l = DocHost.Fe.list('dckrav').find(x => /SECRET-T1/.test(x.name)); return !!(l && l.lines.length); }, 10000), 'the new list has its documents, saved in Team');
  const srvBundle = await raw('/__mem');
  check(!/SECRET-T1|SECRET-B1|Made-up client list/.test(srvBundle.body || ''), 'the server never sees the lists in clear text');
  /* the overview: a project without a plan says so (not "0 of 0 approved · 0 %"); not-relevant lines are counted apart (JP's Team, 2026-11-16) */
  await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl.push({ id: 'emptyp', name: 'Made-up empty project', made: new Date().toISOString(), lines: [] }); DocHost.Fe.saveTools(t); }); await sl(1200);
  await own.goto(U + '#home'); await own.reload(); await sl(2500);
  const ov = await own.evaluate(() => { const li = [...document.querySelectorAll('.t-projs .t-proj')].find(x => /Made-up empty project/.test(x.innerText)); return li ? li.innerText : ''; });
  check(/No document plan yet/.test(ov) && !/0 %/.test(ov) && !/0 of 0/.test(ov), 'a project without a plan says so on the overview ' + JSON.stringify(ov));
  /* a project with a plan: the share approved, one bar split by status and the counts (JP 2026-11-16 20:36) */
  const ovp = await own.evaluate(() => { const a = [...document.querySelectorAll('.t-projs .t-proj')].find(x => x.querySelector('.t-pbar')); if (!a) return null; const cs = getComputedStyle(a);
    return { big: a.querySelector('.t-pbig b').textContent, segs: a.querySelectorAll('.t-pbar i').length, keys: [...a.querySelectorAll('.t-pkeys span')].map(s => s.textContent), under: cs.textDecorationLine, w: Math.round(a.querySelector('.t-pbar').getBoundingClientRect().width / a.getBoundingClientRect().width * 100) }; });
  check(ovp && /^\d+ %$/.test(ovp.big) && ovp.segs >= 1 && ovp.keys.length >= 1 && ovp.under === 'none' && ovp.w > 85, 'a project on the overview: the share approved, a full-width bar split by status, the counts, no underline ' + JSON.stringify(ovp));
  await own.goto(U + '#docs'); await own.reload(); await until(own, () => !!window.DocHost && DocHost.Fe.list('dctl').length > 0, 20000);
  await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl = t.dctl.filter(p => p.id !== 'emptyp'); DocHost.Fe.saveTools(t); }); await sl(1200);
  /* Kari (Can edit) opens it, cannot approve, but marks a line Not approved */
  await kari.goto(U + '#docs'); await kari.reload();
  check(await until(kari, () => !!document.querySelector('[data-dcopen]'), 20000), 'Kari sees the project');
  await kari.evaluate(() => document.querySelector('[data-dcopen]').scrollIntoView({ block: 'center' })); await kari.click('[data-dcopen]');   /* the tools on top push the list down: keep the row clear of the tab bar */
  await kari.waitForSelector('[data-dctab="docs"]'); await kari.click('[data-dctab="docs"]');
  await kari.waitForSelector('[data-dcline="a2"]'); await kari.click('[data-dcline="a2"]');
  await kari.waitForSelector('[data-dcst="a2:na"]');
  check(await kari.evaluate(() => !document.querySelector('[data-dcst="a2:ok"]') && !document.querySelector('[data-dcst="a2:rej"]')), 'Can edit has no Approved / Not approved buttons (the access matrix: that is Can approve, JP 15:03)');
  await kari.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a2').st = 'ok'; DocHost.Fe.saveTools(t); }); await sl(800);
  check(await kari.evaluate(() => DocHost.Fe.list('dctl')[0].lines.find(l => l.id === 'a2').st === 'recv'), 'Can edit cannot mark a document Approved, even around the buttons');
  await kari.click('[data-dcst="a2:na"]'); await sl(1200);
  /* at the same time the owner changes another line of the same project */
  await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a1').st = 'na'; DocHost.Fe.saveTools(t); }); await sl(1200);
  await kari.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a3').cmt = 'Missing the manual'; DocHost.Fe.saveTools(t); }); await sl(1200);
  await own.reload(); await own.waitForSelector('.t-tabs'); await until(own, () => window.DocHost && DocHost.Fe.list('dctl').length === 1, 15000);
  const ls = await own.evaluate(() => DocHost.Fe.list('dctl')[0].lines.map(l => l.id + ':' + l.st + ':' + (l.cmt || '')).join(','));
  check(/a1:na:/.test(ls) && /a2:na:/.test(ls) && /a3:missing:Missing the manual/.test(ls), 'two people changing the same project at once lose nothing (' + ls + ')');
  check(await own.evaluate(() => { const t = DocHost.Fe.tools(); t.dctl[0].lines.find(l => l.id === 'a2').st = 'ok'; DocHost.Fe.saveTools(t); return true; }) && await until(own, () => !Object.values(window.__team.recs).some(r => r.k === 'dcl' && r.v === 0)), 'the owner (Admin) can approve');
  await sl(800);
  await kari.reload(); await kari.waitForSelector('.t-tabs'); await until(kari, () => window.DocHost && DocHost.Fe.list('dctl').length === 1, 15000);
  check(await kari.evaluate(() => DocHost.Fe.list('dctl')[0].lines.find(l => l.id === 'a2').st === 'ok'), "and Kari sees the owner's approval");
  /* --- Access (JP 2026-11-16): the admin's card – what each role can do, and who sees which projects --- */
  await own.goto(U + '#team'); await own.reload(); await own.waitForSelector('details[data-accd]', { timeout: 20000 });
  await own.evaluate(() => { document.querySelector('details[data-accd]').open = true; });
  await own.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange'))); await sl(200);
  check(await own.evaluate(() => document.querySelector('details[data-accd]').open), 'an opened box stays open when the page is drawn again (JP 2026-11-17 19:59)');
  check(await own.evaluate(() => { const p = document.createElement('p'); p.className = 't-wait'; p.textContent = 'Team'; document.body.appendChild(p); const st = getComputedStyle(p), ok = st.position !== 'fixed' && st.borderTopStyle === 'none'; p.remove(); return ok; }), 'the loading word is plain text, not the orange "changes waiting" chip (JP 2026-11-19 21:04)');
  const sw = await own.evaluate(async () => { const el = window.__teamSwitch('Made-up Team'); const a = { on: !!document.getElementById('tSwitch'), ini: el.querySelector('b').textContent, letters: el.querySelectorAll('.t-sw-name span').length }; window.__teamSwitchDone(); await new Promise(r => setTimeout(r, 500)); a.gone = !document.getElementById('tSwitch'); return a; });
  check(sw.on && sw.ini === 'MT' && sw.letters === 12 && sw.gone, 'switching team shows the team’s initials and name, then fades away (JP 2026-11-19 21:41) ' + JSON.stringify(sw));
  const th = await own.evaluate(() => { const r = getComputedStyle(document.documentElement); const a = { theme: document.documentElement.dataset.theme, acc: r.getPropertyValue('--acc').trim() };
    localStorage.setItem('team.theme', 'dark'); window.__teamTheme(); a.dark = document.documentElement.dataset.theme; a.acc2 = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(); localStorage.removeItem('team.theme'); window.__teamTheme(); return a; });
  check(th.theme === 'light' && th.acc === '#9d174d' && th.dark === 'dark' && th.acc2 === '#f06595', 'Team is light with the deep berry accent by default; dark (pink) is a choice (JP 2026-11-19) ' + JSON.stringify(th));
  check(await own.evaluate(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); await new Promise(r => setTimeout(r, 100));   /* the box opened above is now in the page once */ const a = document.querySelector('.t-tabs'); window.dispatchEvent(new HashChangeEvent('hashchange')); await new Promise(r => setTimeout(r, 100)); return document.querySelector('.t-tabs') === a; }), 'a redraw with nothing new leaves the page alone – no stutter (JP 2026-11-17 21:35)');
  const ac0 = await own.evaluate(() => ({ boxes: document.querySelectorAll('[data-accm]').length, people: document.querySelectorAll('[data-acctr]').length, cells: document.querySelectorAll('[data-accpp]').length, save: document.querySelector('[data-act="accsave"]').disabled }));
  check(ac0.boxes === 40 && ac0.people >= 1 && ac0.cells >= ac0.people && ac0.save, 'the access card: 10 actions × 4 roles, a row per person who is not an admin, Save off until something changes ' + JSON.stringify(ac0));
  const kname = await kari.evaluate(() => DocHost.Fe.list('dctl')[0].name);
  await own.evaluate(nm => { const ths = [...document.querySelectorAll('.t-mxp thead th')], i = ths.findIndex(th => th.textContent === nm), row = document.querySelector('[data-accpp^="kari@y.no|"]').closest('tr'), s = row.children[i].querySelector('select'); s.value = 'none'; s.dispatchEvent(new Event('change', { bubbles: true })); }, kname); await sl(200);
  await own.evaluate(() => { const c = document.querySelector('[data-accm="types:approve"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  await own.evaluate(() => document.querySelector('[data-act="accsave"]').click()); await sl(1500);
  const ac1 = await own.evaluate(() => fetch('/api/access', { headers: { 'x-team': '1' } }).then(r => r.json()));
  check(ac1.m.types === 'approve' && Object.values(ac1.pp).some(o => Object.values(o).includes('none')), 'Save access stores the matrix and the project choice on the server ' + JSON.stringify(ac1).slice(0, 200));
  await word(own, 'Team access');
  /* Kari has no access to that project now: the server stops sending it to her */
  await kari.reload(); await kari.waitForSelector('.t-tabs'); await sl(1500);
  check(await kari.evaluate(() => !window.DocHost || DocHost.Fe.list('dctl').length === 0), 'Kari no longer gets the project she has no access to');
  await own.evaluate(() => fetch('/api/access', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ m: {}, pp: {}, tr: {} }) }));   /* back to the standard for the rest */
  await kari.reload(); await kari.waitForSelector('.t-tabs'); await until(kari, () => window.DocHost && DocHost.Fe.list('dctl').length === 1, 15000);

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

  /* --- what's new since your last visit (JP 23:46): Kari sees what the owner did, "Seen" clears it --- */
  await kari.evaluate(() => localStorage.setItem('team.seen.team', '0'));
  await kari.goto(U + '#overview'); await kari.reload(); await until(kari, () => !!document.querySelector('.t-tabs'));
  check(await until(kari, () => /Since your last visit/.test(document.body.innerText) && /meeting/.test(document.querySelector('.t-news').innerText)), 'Kari sees what is new since her last visit');
  await kari.click('[data-act=seen]'); await sl(300);
  check(!(await kari.$('.t-news')), '"Seen" clears it');
  await kari.click('[data-act=settings]'); await kari.waitForSelector('[data-act=notify]');
  check(/Turn on/.test(await kari.$eval('[data-act=notify]', e => e.textContent)), 'Settings offer notifications on this device');
  check(!!(await kari.$('[data-settab=team]')), 'a second admin sees the Team tab in Settings');
  await kari.click('[data-act=close]');
  /* --- a backup of the team (admins), locked with its own passcode; restoring brings back what was deleted --- */
  await own.goto(U + '#overview'); await own.reload(); await until(own, () => !!document.querySelector('.t-tabs'));
  const bk = await own.evaluate(async () => { let got = null, blob = null; const oc = HTMLAnchorElement.prototype.click, cu = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return cu.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { if (this.download) got = this; };
    document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('[data-act=backup]').click(); await new Promise(r => setTimeout(r, 200));
    const f = document.querySelector('form[data-form=backup]'); f.pass.value = 'backup-pass-1'; f.pass2.value = 'backup-pass-1'; f.requestSubmit();
    for (let i = 0; i < 60 && !got; i++) await new Promise(r => setTimeout(r, 100)); HTMLAnchorElement.prototype.click = oc; URL.createObjectURL = cu;
    return got ? { name: got.download, text: await blob.text() } : null; });
  check(bk && /\.teambackup$/.test(bk.name) && /"kind":"team-backup"/.test(bk.text) && !/MARK-SECRET/.test(bk.text), 'an admin downloads a backup of the team – locked, nothing readable in it');
  /* a meeting is deleted, then brought back from the backup */
  const victim = await own.evaluate(() => Object.values(window.__team.recs).find(r => r.k === 'meeting' && !r.del && r.d && /MARK-SECRET-1/.test(r.d.title)).id);
  await own.evaluate(async id => { const r = window.__team.recs[id]; await fetch('/api/rec', { method: 'PUT', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ id, k: r.k, del: true, v: r.v }) }); }, victim);
  await own.reload(); await until(own, () => !!document.querySelector('.t-tabs'));
  const rs = await own.evaluate(async (txt) => { document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('[data-act=backup]').click(); await new Promise(r => setTimeout(r, 200));
    const f = document.querySelector('form[data-form=restore]'), dt = new DataTransfer(); dt.items.add(new File([txt], 'x.teambackup')); f.file.files = dt.files; f.pass.value = 'backup-pass-1'; f.requestSubmit();
    for (let i = 0; i < 80 && document.querySelector('form[data-form=restore]'); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 400));
    return document.getElementById('toast').textContent; }, bk.text);
  check(/1 items brought back/.test(rs) && await own.evaluate(id => !window.__team.recs[id].del && /MARK-SECRET-1/.test(window.__team.recs[id].d.title), victim), 'restoring brings back the deleted meeting (and nothing else changes) ' + rs);
  /* --- Kari on a new computer: unlocks with her passcode, reads old and new --- */
  const kari2 = await person('kari@y.no', 1280);
  await kari2.goto(U); await kari2.waitForSelector('form[data-form=unlock]');
  await kari2.type('input[name=pass]', 'wrong-pass'); await kari2.click('button[type=submit]');
  check(await until(kari2, () => /Wrong passcode/.test(document.body.innerText)), 'a wrong passcode is caught');
  await kari2.$eval('input[name=pass]', e => { e.value = ''; e.disabled = false; }); await kari2.type('input[name=pass]', 'kari-pass-1'); await kari2.click('button[type=submit]');
  check(await until(kari2, () => !!document.querySelector('.t-tabs')), 'the right passcode opens Team on the new device');
  /* on a computer: the menu on the left, the page wide, the Overview in two columns (JP 2026-11-17 11:43) */
  await kari2.goto(U + '#overview'); await sl(600);
  const lay = await kari2.evaluate(() => { const t = document.querySelector('.t-tabs').getBoundingClientRect(), a = document.querySelector('#app').getBoundingClientRect(), c = document.querySelectorAll('.t-cols > .t-col');
    return { left: t.left === 0 && t.width < 260 && t.height > 600, wide: a.width > 900, over: a.left >= t.right, cols: c.length === 2 && c[1].getBoundingClientRect().left > c[0].getBoundingClientRect().left + 200, fits: document.documentElement.scrollWidth <= innerWidth }; });
  check(Object.values(lay).every(Boolean), 'on a computer: menu on the left, a wide page, two columns ' + JSON.stringify(lay));
  if (process.env.SHOT) await kari2.screenshot({ path: path.join(__dirname, '..', '.tmp', 'team-pc.png') });
  await kari2.goto(U + '#team'); await sl(400);
  check(await kari2.evaluate(() => { const c = document.querySelectorAll('.t-tcols > .t-col'); return c.length === 2 && c[1].getBoundingClientRect().left > c[0].getBoundingClientRect().right; }), 'the Team tab is two columns on a computer (JP 2026-11-17 20:11)');
  await kari2.goto(U + '#meetings'); await sl(300);
  check(/MARK-SECRET-1/.test(await text(kari2)) && /MARK-SECRET-4/.test(await text(kari2)), 'she reads meetings from before and after the new key');

  /* --- the change log, shown to members, decrypted on the device --- */
  /* no change log any more (JP 2026-11-24 22:57): no card, and the server keeps no log lines */
  await own.goto(U + '#team'); await sl(600);
  check(await own.evaluate(() => !document.querySelector('[data-act=log]')) && !/"l:\d{9}"/.test((await raw('/__mem')).body), 'there is no change log – no card and no log lines on the server');
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
  /* back from the form to the team that is already "open" (JP 21:31: tapping it did nothing) */
  await own.click('[data-act=teams]'); await own.waitForSelector('.t-teams');
  await own.evaluate(() => [...document.querySelectorAll('[data-act=goTeam]')].find(b => /Site team/.test(b.textContent)).click());
  check(await until(own, () => !!document.querySelector('.t-tabs') && /Site team/.test(document.body.innerText), 15000), 'from the New team form, tapping your team takes you back to it');
  await own.goto(U + '?new=1'); await own.waitForSelector('form[data-form=setup]');
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
  await own.goto(U + '#meetings');
  check(await until(own, () => /MARK-SECRET-4/.test(document.body.innerText), 10000) && !/MARK-SECRET-5/.test(await text(own)), 'the first team shows only its own meetings');
  /* rename (admins) and delete (only the owner, the name typed again) – on the second team */
  check(await per.evaluate(t => fetch('/api/rename', { method: 'POST', headers: { 'x-team': '1', 'x-tid': t, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }) }).then(r => r.status), tid2) === 403, 'a member who is not an admin cannot rename the team');
  check(await own.evaluate(t => fetch('/api/rename', { method: 'POST', headers: { 'x-team': '1', 'x-tid': t, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Second site renamed' }) }).then(r => r.status), tid2) === 200, 'an admin renames the team');
  check(await per.evaluate(() => fetch('/api/me', { headers: { 'x-tid': localStorage.getItem('team.cur') } }).then(r => r.json()).then(j => j.team.name)) === 'Second site renamed', 'everyone sees the new name');
  check(await own.evaluate(t => fetch('/api/teams/delete', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ id: t, confirm: 'wrong' }) }).then(r => r.status), tid2) === 409, 'deleting needs the team name typed again');
  check(await per.evaluate(t => fetch('/api/teams/delete', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ id: t, confirm: 'Second site renamed' }) }).then(r => r.status), tid2) === 403, 'only the owner can delete a team');
  check(await own.evaluate(t => fetch('/api/teams/delete', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ id: t, confirm: 'Second site renamed' }) }).then(r => r.status), tid2) === 200, 'the owner deletes the second team');
  const after = JSON.parse(await own.evaluate(() => fetch('/api/teams').then(r => r.text())));
  check(after.teams.length === 1 && after.teams[0].id === 'team' && !JSON.parse((await raw('/__mem')).body).some(([k]) => k.startsWith(tid2 + '/')), 'it is gone from the list and its storage is empty; the first team is untouched');
  check(await per.evaluate(t => fetch('/api/recs', { headers: { 'x-tid': t } }).then(r => r.status), tid2) === 404, 'its members get nothing any more');
  await own.evaluate(() => localStorage.setItem('team.cur', 'team'));
  await word(own, 'after switching teams');
  const all2 = (await raw('/__mem')).body;
  check(!/SECRET|Second MARK|per-pass|owner-pass/.test(all2), 'the second team on the server is ciphertext too');

  /* --- Norwegian --- */
  await kari.evaluate(() => localStorage.setItem('team.lang', 'nb'));
  await kari.evaluateOnNewDocument(() => localStorage.setItem('team.lang', 'nb'));
  await kari.goto(U + '#overview'); await kari.reload(); await kari.waitForSelector('.t-tabs');
  const nbt = await text(kari);
  check(/Oversikt/.test(nbt) && /Møter/.test(nbt) && /Dokumentasjon/.test(nbt) && !/Overview|Meetings/.test(nbt), 'Norwegian when chosen');
  await kari.goto(U + '#docs'); await kari.reload(); await until(kari, () => !!document.querySelector('#wkDocCtl [data-drnew], #wkDocCtl .dx-list'), 20000);
  check(/Dokumentasjon/.test(await text(kari)) && !/Documentation|Document control/.test(await text(kari)), 'Documentation in Norwegian too');
  await word(kari, 'Norwegian overview');
  /* an action linked to a document line closes by itself when the document is approved (JP 23:46) */
  const dlink = await own.evaluate(async () => { const S = window.__team; const p = Object.values(S.recs).find(r => r.k === 'dcp' && !r.del && r.d && r.d.key === 'dctl'); if (!p) return null;
    const l = Object.values(S.recs).find(r => r.k === 'dcl' && !r.del && r.d && r.d.pid === p.d.p.id && !['ok', 'cmt', 'na'].includes(r.d.l.st)); if (!l) return null;
    return { v: p.d.p.id + '|' + l.d.l.id, lid: l.id }; });
  if (dlink) {
    await own.goto(U + '#actions'); await own.waitForSelector('[data-act=newAction]'); await own.click('[data-act=newAction]');
    /* on a slow machine the first tap can land before the view is ready (CI 2026-11-20): tap again rather than wait 30 s */
    for (let i = 0; i < 3 && !(await own.$('form[data-form=action] select[name=doc]')); i++) { await new Promise(r => setTimeout(r, 2500)); if (!(await own.$('form[data-form=action] select[name=doc]'))) await own.evaluate(() => { const b = document.querySelector('[data-act=newAction]'); if (b) b.click(); }); }
    await own.waitForSelector('form[data-form=action] select[name=doc]');
    await own.type('form[data-form=action] input[name=text]', 'Get the made-up FDV'); await own.select('form[data-form=action] select[name=doc]', dlink.v); await own.click('form[data-form=action] button[type=submit]');
    check(await until(own, () => /Get the made-up FDV/.test(document.body.innerText) && /Document: /.test(document.body.innerText)), 'an action can be linked to a document line');
    await own.goto(U + '#docs'); await until(own, () => !!(window.DocHost && window.DocHost.Fe), 20000);
    await own.evaluate(async lid => { const S = window.__team, r = S.recs[lid], d = JSON.parse(JSON.stringify(r.d)); d.l.st = 'ok'; DocHost.Fe.saveTools((() => { const t = DocHost.Fe.tools(); t.dctl.forEach(p => (p.lines || []).forEach(l => { if (l.id === d.l.id) l.st = 'ok'; })); return t; })()); }, dlink.lid);
    check(await until(own, () => Object.values(window.__team.recs).some(r => r.k === 'action' && r.d && r.d.text === 'Get the made-up FDV' && r.d.done && r.d.auto), 12000), 'approving the document closes the action by itself');
  }
  /* search in the team (also opened from /cmd's search as #search=…) */
  await own.goto(U + '#search=' + encodeURIComponent('After Ola')); await own.reload();
  check(await until(own, () => /Meetings/i.test(document.body.innerText) && /After Ola MARK-SECRET-4/.test(document.body.innerText), 15000), 'searching the team finds the meeting');
  /* no signal (JP 23:46): an action made offline waits on the device (encrypted) and is sent when the line is back */
  await own.goto(U + '#actions'); await own.waitForSelector('[data-act=newAction]');
  await own.setOfflineMode(true);
  await own.click('[data-act=newAction]'); await own.waitForSelector('form[data-form=action]');
  await own.type('form[data-form=action] input[name=text]', 'Offline MARK-SECRET-OFF'); await own.click('form[data-form=action] button[type=submit]');
  check(await until(own, () => /1 change waiting for the connection/.test((document.getElementById('tWait') || {}).textContent || '') && /Offline MARK-SECRET-OFF/.test(document.body.innerText)), 'without signal the action shows at once and waits');
  check(await own.evaluate(() => !/MARK-SECRET-OFF/.test(localStorage.getItem('team.q.team') || '') && /"ct"/.test(localStorage.getItem('team.q.team') || '')), 'what waits on the device is encrypted');
  await own.setOfflineMode(false); await own.evaluate(() => window.dispatchEvent(new Event('online')));
  check(await until(own, () => !document.getElementById('tWait'), 15000), 'when the line is back it is sent');
  check(await kari.evaluate(() => fetch('/api/recs').then(r => r.json()).then(j => j.recs.length)) > 0 && JSON.parse((await raw('/__mem')).body).some(([k, v]) => k.startsWith('r:') && v.k === 'action' && v.by === 'owner@x.no' && v.seq), 'and the server has it');
  /* a building inspection shared from /cmd (JP 23:46): imported, shown (cleaned), the team adds notes */
  await own.goto(U + '#docs'); await impOpen(own);
  await own.evaluate(() => { const j = { team: 'insp', v: 1, r: { name: 'Made-up block A', no: 'R-1', date: '2026-11-10', address: 'Made-up street 1' }, html: '<h1>Made-up block A</h1><p class="rp-addr">MARK-SECRET-INSP</p><script>window.__bad = 1</script><img src="x" onerror="window.__bad = 2">' };
    const inp = document.querySelector('input[data-dcimport]'), dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(j)], 'insp.json', { type: 'application/json' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); });
  check(await until(own, () => /^#in=/.test(location.hash) && /MARK-SECRET-INSP/.test(document.body.innerText), 15000), 'an inspection from /cmd is imported and shown');
  check(await own.evaluate(() => !window.__bad && !document.querySelector('.t-insp script, .t-insp [onerror]')), 'its report is cleaned (no scripts, no handlers)');
  await own.type('form[data-form=inote] textarea', 'Made-up note MARK-SECRET-NOTE'); await own.click('form[data-form=inote] button[type=submit]');
  check(await until(own, () => /Made-up note MARK-SECRET-NOTE/.test(document.body.innerText)), 'the team adds notes to it');
  check(!/MARK-SECRET-INSP|MARK-SECRET-NOTE/.test((await raw('/__mem')).body), 'the server only has it encrypted');
  /* the plan file and Excel edits are shared, encrypted records (JP 23:46): what Kari stores, the owner reads */
  const put = await kari.evaluate(async () => { await DocHost.store.put('plan:made-up', new Blob(['MADE-UP-PLAN-BYTES'], { type: 'text/plain' })); await DocHost.store.put('xedit:made-up', { 'xl/worksheets/sheet1.xml': { A1: { v: 'MADE-UP-EDIT' } } }); await new Promise(r => setTimeout(r, 1800)); return true; });
  await own.goto(U + '#docs'); await own.reload(); await until(own, () => !!(window.DocHost && window.DocHost.store), 20000);
  const got = await own.evaluate(async () => { const b = await DocHost.store.get('plan:made-up'), e = await DocHost.store.get('xedit:made-up'); return { plan: b && await b.text(), edit: e && e['xl/worksheets/sheet1.xml'].A1.v }; });
  check(put && got.plan === 'MADE-UP-PLAN-BYTES' && got.edit === 'MADE-UP-EDIT', 'the plan file and Excel edits are shared in the team ' + JSON.stringify(got));
  check(!/MADE-UP-PLAN|MADE-UP-EDIT/.test((await raw('/__mem')).body), 'and the server only has them encrypted');

  /* --- a big project stays quick (JP 2026-11-16 20:06: the Overview froze for ~20 s with ~3 000 document lines) --- */
  await own.goto(U + '#docs'); await own.waitForSelector('#wkDocCtl', { timeout: 20000 }); await until(own, () => window.DocHost && DocHost.Fe.list('dctl').length > 0, 15000);
  await own.evaluate(() => { const t = DocHost.Fe.tools(), p = t.dctl[0]; for (let i = 0; i < 2500; i++) p.lines.push({ id: 'big' + i, code: String(200 + (i % 500)), t: 'E', st: '' }); DocHost.Fe.saveTools(t); });
  await sl(5000);
  const ovBig = await own.evaluate(async () => { const t0 = performance.now(); location.hash = '#overview'; await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); return { ms: Math.round(performance.now() - t0), week: !!document.querySelector('.t-week'), projs: document.querySelectorAll('.t-projs .t-proj').length }; });
  check(ovBig.ms < 1500 && !ovBig.week && ovBig.projs >= 1, 'the Overview opens quickly with a 2 500-line project (the week and the projects are counted once, not per line) ' + JSON.stringify(ovBig));

  /* --- kept apart from /cmd --- */
  const wr = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  /* Team has its own R2 bucket for file pieces (2026-11-24) – never /cmd's (dashboard-files) */
  const r2b = (wr.match(/"bucket_name"\s*:\s*"([^"]+)"/g) || []).map(x => x.split('"')[3]);
  check(!/kv_namespaces|d1_databases|"VAULT"|"LIVE"|dashboard-sync|dashboard-files/.test(wr) && r2b.join() === 'team-files' && /TeamStore/.test(wr) && /work\.jplundberg\.com/.test(wr), "Team's Worker has none of /cmd's bindings – only its own R2 bucket team-files " + r2b.join());
  const cmdJs = fs.readdirSync(path.join(__dirname, '..', '..', 'cmd')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', f), 'utf8')).join('\n');
  check(!/team-keys|\/api\/recs|TeamStore/.test(cmdJs), '/cmd has no Team data or keys');

  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); }); await sl(400);
  const st = await own.evaluate(() => ({ heads: [...document.querySelectorAll('.t-settab')].map(x => x.textContent), name: !!document.querySelector('.t-setrow [data-act=renameTeam]') }));
  const inside = await own.evaluate(async () => { const out = []; for (const t of ['you', 'team', 'acct']) { document.querySelector('[data-settab=' + t + ']').click(); await new Promise(r => setTimeout(r, 100)); const sh = document.querySelector('.t-sheet'), b = document.querySelector('[data-act=close].t-btn.wide'); out.push(t + ':' + !!(b && sh.contains(b))); } document.querySelector('[data-settab=team]').click(); return out.join(); });
  check(!/false/.test(inside), 'Done stays inside the settings window on every tab (JP 2026-11-24) ' + inside);
  check(st.heads.length === 3 && st.name, 'Settings in three tabs, the team name with Change for admins (JP 2026-11-23) ' + JSON.stringify(st));
  await own.evaluate(() => { const c = document.querySelector('[data-act=close]'); if (c) c.click(); }); await sl(300);
  /* an admin can switch the three Documents tabs off for the whole team (JP 2026-11-19 21:42) */
  await own.goto(U + '#docs'); await sl(800);
  const dt0 = await own.evaluate(() => [...document.querySelectorAll('[data-dtab]')].map(x => x.dataset.dtab).join(','));
  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); }); await sl(400);
  await own.evaluate(() => { const i = document.querySelector('input[data-dtoff="insp"]'); i.click(); }); 
  const dt1 = await until(own, () => [...document.querySelectorAll('[data-dtab]')].map(x => x.dataset.dtab).join(',') === 'doc,files');
  check(dt0 === 'doc,insp,files' && dt1, 'switching Inspections off takes the tab away for the team ' + dt0);
  await own.evaluate(() => { document.querySelector('input[data-dtoff="doc"]').click(); }); await sl(1200);
  await own.evaluate(() => { document.querySelector('input[data-dtoff="files"]').click(); });
  check(await until(own, () => !document.querySelector('.t-tabs [data-go="docs"]')), 'all three off: Documents leaves the menu');
  for (const k of ['doc', 'insp', 'files']) { await own.evaluate(x => { const i = document.querySelector('input[data-dtoff="' + x + '"]'); if (i && !i.checked) i.click(); }, k); await sl(1200); }
  check(await until(own, () => !!document.querySelector('.t-tabs [data-go="docs"]')), 'and back on again');
  /* size on a PC (JP 2026-11-25): a mouse on a wide screen scales the whole page; a phone keeps its size; Liten / Stor / As on a phone per device */
  /* Team fits the screen by itself (JP 2026-11-25): the page is scaled from the window's size – phone as it is, a low laptop smaller, a big screen or TV larger – and follows a resize */
  { const z = async () => own.evaluate(() => parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
    const zPhone = await z();
    const at = async (w, h) => { await own.setViewport({ width: w, height: h, isMobile: false, hasTouch: false }); await sl(250); return z(); };
    const zMon = await at(1440, 900), zLap = await at(1280, 600), zTv = await at(3840, 2000), zMon2 = await at(1920, 950);
    /* a laptop at 200 % (JP 2026-11-25 18:37): under 1000 px wide, but scaled down it gets the PC layout – side menu, wide column – not the tablet one */
    const zL2 = await at(960, 443), lay = await own.evaluate(() => { const t = getComputedStyle(document.querySelector('.t-tabs')), a = document.getElementById('app').getBoundingClientRect(); return { wide: document.documentElement.classList.contains('tz-wide'), side: t.top === '0px' && t.bottom === '0px' && parseFloat(t.width) < 260, col: Math.round(a.width / (parseFloat(getComputedStyle(document.documentElement).zoom) || 1)) }; });
    check(Math.abs(zL2 - .78) < .02 && lay.wide && lay.side && lay.col > 800, 'a laptop at 200 % (960 px) is scaled and gets the PC layout with the side menu, so step names have room ' + JSON.stringify({ zL2, lay }));
    const zT = await at(820, 1180); check(zT === 1 && !(await own.evaluate(() => document.documentElement.classList.contains('tz-wide'))), 'a narrow window keeps its own size and layout');
    await own.click('[data-go="actions"]'); const went = await until(own, () => /#actions/.test(location.hash), 4000);
    const noSetting = await own.evaluate(() => !document.querySelector('[data-sizepick]'));
    check(zPhone === 1 && Math.abs(zMon - .86) < .02 && Math.abs(zLap - .78) < .02 && Math.abs(zTv - 1.5) < .02 && Math.abs(zMon2 - .9) < .02 && went && noSetting, 'Team scales itself to the window: phone as it is, a monitor a little smaller, a low laptop smaller, a big TV larger; clicks land right ' + JSON.stringify({ zPhone, zMon, zLap, zTv, zMon2, went }));
    await own.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true }); await own.goto(U + '#overview'); await sl(800); }
  check(!errs.length, 'no page errors or CSP violations ' + errs.join(' | ').slice(0, 400));
  srv.kill();
  await done(b);
})();
