/* Team fixes from the hands-on review (JP 2026-11-25): next meeting, a short window, delete questions. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const impOpen = async (pg) => { await pg.waitForSelector('[data-act=settings]', { timeout: 20000 }); await pg.evaluate(() => { const s = document.querySelector('[data-act=settings]'); if (s) s.click(); }); await pg.waitForSelector('[data-settab=team]', { timeout: 20000 }); await pg.evaluate(() => document.querySelector('[data-settab=team]').click()); await pg.waitForSelector('input[data-dcimport]', { timeout: 20000 }); };
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
  await own.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); window.confirm = () => true; new MutationObserver(() => { const y = document.querySelector('.ask-ov .ask-ok'); if (y) y.click(); }).observe(document, { childList: true, subtree: true }); });
  const text = () => own.evaluate(() => document.body.innerText);
  const click = sel => own.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);

  await own.goto(T); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Clock team');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 20000), 'the owner is in the app');


  /* a meeting earlier today is not "next" any more (review 4) */
  const today = await own.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await own.evaluate(() => { location.hash = '#meetings'; }); await own.waitForSelector('[data-act=newMeeting]'); await click('[data-act=newMeeting]'); await own.waitForSelector('form[data-form=meeting]');
  await own.type('input[name=title]', 'Madeup morning meeting');
  await own.evaluate(t => { const f = document.querySelector('form[data-form=meeting]'); f.date.value = t; if (f.from) f.from.value = '00:01'; if (f.to) f.to.value = '00:02'; }, today);
  await click('form[data-form=meeting] button[type=submit]');
  check(await until(own, () => /Madeup morning meeting/.test(document.body.innerText) && /^#m=/.test(location.hash)), 'the meeting is saved');
  const mid = await own.evaluate(() => location.hash.slice(3));
  await own.evaluate(() => { location.hash = '#overview'; }); await sl(800);
  const ov = await own.evaluate(() => { const t = document.getElementById('app').innerText; const i = t.search(/Next meeting/i); return i < 0 ? '' : t.slice(i, i + 80); });
  check(!/Madeup morning meeting/.test(ov), 'Overview does not call a meeting that ended this morning the next one ' + JSON.stringify(ov));
  /* a low laptop: the date stays under the meeting's title, viewport heights follow the page zoom, Save stays in reach (review 14, 15) */
  const lap = await ctx.newPage(); await lap.setViewport({ width: 1366, height: 650 });
  await lap.setCookie({ name: 'who', value: 'owner%40x.no', domain: 'localhost', path: '/' });
  await lap.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); });
  await lap.goto(T + '#m=' + mid); await until(lap, () => !!document.querySelector('.t-title h1'), 20000); await sl(600);
  const lp = await lap.evaluate(() => { const p = document.querySelector('.t-title p'); const d = document.createElement('div'); d.style.cssText = 'position:absolute;top:0;height:calc(var(--tvh, 1vh) * 100)'; document.body.appendChild(d);
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1, hv = d.getBoundingClientRect().height * (document.documentElement.getBoundingClientRect().height ? 1 : 1); d.remove();
    return { date: p ? getComputedStyle(p).display !== 'none' && p.textContent : '', z, hv: Math.round(hv * (navigator.userAgent ? 1 : 1)), ih: innerHeight }; });
  check(lp.date && /\d/.test(lp.date), 'the meeting page shows its date on a low laptop ' + JSON.stringify(lp));
  check(lp.z < 1 && Math.abs(lp.hv - lp.ih) < 6, 'a full-height box fills the real window under the page zoom ' + JSON.stringify(lp));
  await lap.evaluate(() => { const e = document.querySelector('[data-act=edit]'); if (e) e.click(); }); await until(lap, () => !!document.querySelector('form[data-form=meeting]'));
  const sv = await lap.evaluate(() => { const s = document.querySelector('form[data-form=meeting] [type=submit]'); const r = s.getBoundingClientRect(); return { bottom: Math.round(r.bottom), ih: innerHeight, pos: getComputedStyle(s.closest('.t-btns') || s).position }; });
  check(sv.pos === 'sticky' && sv.bottom <= sv.ih + 2, 'Save is on the screen in the meeting editor ' + JSON.stringify(sv));
  await lap.close();
  /* live review 2026-11-25: search as you type with the matching lines, Settings switches, the access card's arrow, normal-sized New buttons, the Projects tab, no client name */
  const tmpS = require('path').join(require('os').tmpdir(), 'tr-madeup.json');
  require('fs').writeFileSync(tmpS, JSON.stringify({ team: 'dctl', v: 1, p: { id: 'trs1', name: 'Madeup search project', no: 'P-9', made: '2026-11-20T10:00:00Z', files: [], lines: [{ id: 'trl1', code: '171', sys: 'Brann', type: 'Tegning', t: 'A', planned: '171 RA Brannkonsept madeup', st: 'missing', files: [] }, { id: 'trl2', code: '442', sys: 'Lys', type: 'Drift', t: 'B', st: 'missing', files: [] }] } }));
  await own.goto(T + '#docs'); await impOpen(own); await (await own.$('input[data-dcimport]')).uploadFile(tmpS); await until(own, () => /^#dc=/.test(location.hash), 15000); await sl(800);
  const tabs = await own.evaluate(() => [...document.querySelectorAll('[data-dtab]')].map(x => x.closest('label') ? x.closest('label').textContent.trim() : x.textContent.trim()).join('|'));
  check(/Projects/.test(tabs) && !/Documentation/.test(tabs), 'the tab under the Documentation title says Projects ' + tabs);
  await own.evaluate(() => { location.hash = '#search='; }); await sl(700);
  check(await own.evaluate(() => document.activeElement && document.activeElement.matches('.t-srch input[name=q]')), 'the search box is ready to type in');
  await own.keyboard.type('brannkonsept'); await sl(900);
  const sr = await own.evaluate(() => ({ lines: [...document.querySelectorAll('.t-srline a')].map(a => a.getAttribute('href')), focus: document.activeElement && document.activeElement.matches('.t-srch input[name=q]'), cur: [...document.querySelectorAll('.t-tabs [aria-current="true"]')].length }));
  check(sr.lines.some(h => /#dc=[\w-]+&l=trl1$/.test(h)) && sr.focus, 'results come while typing, with the matching line, and the box keeps the cursor ' + JSON.stringify(sr));
  check(sr.cur === 0, 'no menu item is lit while searching');
  await own.evaluate(() => document.querySelector('.t-srline a').click()); await sl(1500);
  check(await own.evaluate(() => !!document.querySelector('.dc-frow2.open [data-dcline="trl1"]')), 'the hit opens the project on that line');
  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); }); await sl(500);
  await own.evaluate(() => { const d = document.querySelector('[data-settab=you]'); if (d) d.click(); }); await sl(400);
  const sw = await own.evaluate(() => { const i = document.querySelector('.t-sheet input[data-act="notify"]'); return i ? { type: i.type, app: getComputedStyle(i).appearance, w: Math.round(i.getBoundingClientRect().width) } : null; });
  check(sw && sw.type === 'checkbox' && sw.app === 'none' && sw.w >= 40, 'notifications while Team is open is a switch like the others ' + JSON.stringify(sw));
  await own.evaluate(() => document.querySelector('[data-settab=team]').click()); await sl(400);
  check(await own.evaluate(() => !/Oslo kommune/.test(document.querySelector('.t-sheet').innerText)), 'no client name in the colour setting');
  await own.evaluate(() => { const c = document.querySelector('.t-sheet [data-act=close]'); if (c) c.click(); location.hash = '#team'; }); await sl(800);
  check(await own.evaluate(() => { const s = document.querySelector('.t-acc summary'); return !!s && getComputedStyle(s, '::after').content !== 'none'; }), 'the access card shows it opens');
  const big = await ctx.newPage(); await big.setViewport({ width: 1500, height: 1000 });
  await big.goto(T + '#meetings'); await until(big, () => !!document.querySelector('[data-act=newMeeting]'), 20000); await sl(500);
  const bw = await big.evaluate(() => { const b = document.querySelector('[data-act=newMeeting]'); return { b: Math.round(b.getBoundingClientRect().width), p: Math.round(b.parentElement.getBoundingClientRect().width) }; });
  check(bw.b < bw.p * 0.6, 'New meeting is a button, not a bar across a big screen ' + JSON.stringify(bw));
  await big.close();
  /* JP 2026-11-25 22:01: an admin sets how long a device may sit unused; past it the passcode again (nobody loses access) */
  await own.evaluate(() => { location.hash = '#overview'; }); await sl(800);
  await own.waitForSelector('[data-act=settings]'); await own.evaluate(() => document.querySelector('[data-act=settings]').click());
  await own.waitForSelector('[data-settab=team]', { timeout: 10000 }); await own.evaluate(() => document.querySelector('[data-settab=team]').click()); await sl(500);
  const hasLock = await own.evaluate(() => { const s = document.querySelector('select[data-lockmin]'); if (!s) return false; s.value = '15'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }); await sl(1500);
  check(hasLock && await own.evaluate(() => localStorage.getItem('team.idle.' + (localStorage.getItem('team.cur') || 'team')) === '15'), 'an admin sets "ask for the passcode again after 15 minutes" for the team');
  await own.evaluate(() => { const c = document.querySelector('.t-sheet [data-act=close]'); if (c) c.click(); });
  await own.evaluate(() => { const t = localStorage.getItem('team.cur') || 'team'; localStorage.setItem('team.act.' + t, String(Date.now() - 20 * 60000)); document.dispatchEvent(new Event('visibilitychange')); }); await sl(1200);
  const lk = await own.evaluate(() => ({ form: !!document.querySelector('form[data-form=unlock]'), note: (document.querySelector('.t-locknote') || {}).textContent || '' }));
  check(lk.form && /15 minutes/.test(lk.note), 'unused for longer: Team asks for the passcode again and says why ' + JSON.stringify(lk));
  await own.type('form[data-form=unlock] input[name=pass]', 'owner-pass-1'); await own.click('form[data-form=unlock] button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 15000), 'the passcode opens it again – same team, same role');
  await own.reload(); check(await until(own, () => !!document.querySelector('.t-tabs'), 15000), 'used just now: a reload opens without the passcode');
  /* the owner's e-mail login setting: says what is missing until the Cloudflare secrets are added */
  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); }); await sl(400);
  await own.evaluate(() => { const b = document.querySelector('[data-settab=acct]'); if (b) b.click(); }); await sl(1200);
  check(await own.evaluate(() => /CF_API_TOKEN/.test((document.getElementById('accessBox') || {}).textContent || '')), 'the owner sees the e-mail login setting (not set up here)');
  await own.evaluate(() => { const c = document.querySelector('.t-sheet [data-act=close]'); if (c) c.click(); });
  /* someone signed in with an e-mail that isn't in the team: the message in the middle, and a way to try another e-mail */
  const stranger = await (await b.createBrowserContext()).newPage(); await stranger.setViewport({ width: 1500, height: 900 });
  await stranger.setCookie({ name: 'who', value: 'wrong%40madeup.no', domain: 'localhost', path: '/' });
  await stranger.goto(T); await until(stranger, () => /not in this team|ikke med i dette teamet/.test(document.body.innerText), 15000);
  const st = await stranger.evaluate(() => { const s = document.querySelector('.t-screen'), r = s.getBoundingClientRect(); return { mid: Math.round((r.left + r.right) / 2), w: innerWidth, btn: !!document.querySelector('.t-screen [data-act=signout]') }; });
  check(Math.abs(st.mid - st.w / 2) < 40 && st.btn, 'not in the team: the message is in the middle, with "Sign in with another e-mail" ' + JSON.stringify(st));
  await stranger.close();
  /* the sign-in runs out while Team is open: it says so and offers to sign in again (JP 2026-11-25 22:37 – it looked open, nothing reached the server) */
  await own.setCookie({ name: 'noauth', value: '1', domain: 'localhost', path: '/' });
  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); }); await sl(400);
  await own.evaluate(() => { const b = document.querySelector('[data-settab=acct]'); if (b) b.click(); }); await sl(800);
  const ab2 = await own.evaluate(() => { const b = document.getElementById('tAuthBar'); return b ? { t: b.textContent, btn: !!b.querySelector('[data-act=signin]') } : null; });
  check(ab2 && /sign-in has run out/.test(ab2.t) && ab2.btn, 'a run-out sign-in is said, with "Sign in again" ' + JSON.stringify(ab2));
  await own.deleteCookie({ name: 'noauth', domain: 'localhost', path: '/' });
  await own.evaluate(() => { const b = document.getElementById('tAuthBar'); if (b) b.remove(); const c = document.querySelector('.t-sheet [data-act=close]'); if (c) c.click(); }); await sl(300);
  /* deleting asks with a button that says Delete (review 17) */
  await own.goto(T + '#m=' + mid); await own.waitForSelector('[data-act=edit]');
  await own.evaluate(() => { window.__askBtn = ''; const c = window.Ask.confirm; window.Ask.confirm = (m, o) => { window.__askBtn = (o && o.ok) || 'OK'; return c.call(window.Ask, m, o); }; });
  await click('[data-act=edit]'); await until(own, () => !!document.querySelector('[data-act=delMeeting]')); await click('[data-act=delMeeting]'); await sl(700);
  const ab = await own.evaluate(() => window.__askBtn);
  check(ab === 'Delete', 'the delete question says "Delete", not "OK" ' + JSON.stringify(ab));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); srv.kill(); done();
})();
