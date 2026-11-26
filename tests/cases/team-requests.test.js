/* Team: Settings → Requests (JP 2026-11-26 00:00–00:04) – everyone waiting to join, from every team where you are admin, in one list,
   approved or declined right there without switching team. Another team's key comes from this device or, when it isn't kept here,
   from that team's passcode typed in the row. Members who aren't admins see no tab and get nothing. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 440, U = 'http://localhost:' + TPORT + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
function raw(p) { return new Promise(res => { http.get(U.replace(/\/$/, '') + p, r => { let d = ''; r.on('data', c => { d += c; }); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', () => res({ status: 0, body: '' })); }); }
async function until(pg, fn, ms = 15000, arg) { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await sl(150); } return false; }

(async () => {
  for (let i = 0; i < 50 && (await raw('/index.html')).status !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  async function person(email, W = 393) {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    await p.setViewport({ width: W, height: 852, isMobile: W < 700, hasTouch: W < 700 });
    await p.setCookie({ name: 'who', value: encodeURIComponent(email), domain: 'localhost', path: '/' });
    p.on('pageerror', e => errs.push(email + ': ' + e.message));
    await p.evaluateOnNewDocument(() => { if (!localStorage.getItem('team.lang')) localStorage.setItem('team.lang', 'en'); window.confirm = () => true; new MutationObserver(() => { const y = document.querySelector('.ask-ov .ask-ok'); if (y) y.click(); }).observe(document, { childList: true, subtree: true }); });
    p.ctx = ctx; return p;
  }
  const text = p => p.evaluate(() => document.body.innerText);
  async function setup(p, team, pass) {
    await p.waitForSelector('form[data-form=setup]');
    await p.$eval('input[name=team]', e => { e.value = ''; }); await p.type('input[name=team]', team);
    await p.type('input[name=name]', 'JP'); await p.type('input[name=pass]', pass); await p.type('input[name=pass2]', pass);
    await p.click('button[type=submit]');
    check(await until(p, t => !!document.querySelector('.t-tabs') && document.body.innerText.includes(t), 20000, team), team + ' is set up');
  }
  async function invite(p) {
    await p.goto(U + '#team'); await p.waitForSelector('[data-act=invite]'); await p.click('[data-act=invite]');
    await p.waitForSelector('form[data-form=invite]'); await p.click('form[data-form=invite] button[type=submit]'); await p.waitForSelector('#invLink');
    return p.$eval('#invLink', e => e.value);
  }
  async function join(email, link, name) {
    const p = await person(email); await p.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await p.waitForSelector('form[data-form=join]');
    await p.type('input[name=name]', name); await p.type('input[name=pass]', name.toLowerCase() + '-pass-1'); await p.type('input[name=pass2]', name.toLowerCase() + '-pass-1');
    await p.click('button[type=submit]');
    check(await until(p, () => !!document.getElementById('checkCode') && /-/.test(document.getElementById('checkCode').textContent)), name + ' waits with a check code');
    const code = await p.$eval('#checkCode', e => e.textContent); return { p, code };
  }
  async function openReq(p) {
    await p.evaluate(() => document.querySelector('[data-act=settings]').click());
    await p.waitForSelector('[data-settab=req]', { timeout: 10000 });
    await p.evaluate(() => document.querySelector('[data-settab=req]').click());
    await until(p, () => !document.getElementById('rqWait'), 10000);
  }

  /* two teams made by the owner on this device; a person waiting in each */
  const own = await person('owner@x.no');
  await own.goto(U); await setup(own, 'North site', 'owner-pass-1');
  const linkA = await invite(own);
  await own.goto(U + '?new=1'); await setup(own, 'South site', 'owner-pass-2');
  const tidB = await own.evaluate(() => window.__team.tid);
  const linkB = await invite(own);
  const kari = await join('kari@madeup.no', linkA, 'Kari'), ola = await join('ola@madeup.no', linkB, 'Ola');

  /* the owner is in South site: the gear shows 2, the Requests tab lists both teams' people with their check codes */
  await own.goto(U + '#overview'); await own.reload(); await own.waitForSelector('.t-tabs');
  check(await until(own, () => (document.querySelector('[data-act=settings] .t-rqn') || {}).textContent === '2'), 'the gear shows 2 waiting, from both teams');
  await openReq(own);
  const t1 = await text(own);
  check(/North site/i.test(t1) && /South site/i.test(t1) && /Kari/.test(t1) && /Ola/.test(t1), 'Requests lists both teams with their people ' + JSON.stringify(t1.slice(-600)));
  check(await until(own, c => [...document.querySelectorAll('[data-rqcode]')].some(e => e.textContent === c), 8000, kari.code) && await until(own, c => [...document.querySelectorAll('[data-rqcode]')].some(e => e.textContent === c), 8000, ola.code), 'each with the same check code as on their phone');
  check(await own.evaluate(() => { const t = document.querySelector('[data-settab=req]'); const r = t.getBoundingClientRect(); const bar = t.parentElement.getBoundingClientRect(); return r.right <= bar.right + 1 && r.left >= bar.left - 1 && t.scrollWidth <= t.clientWidth + 2; }), 'the Requests tab is in view at phone width (the tabs scroll sideways) ' + JSON.stringify(await own.evaluate(() => [...document.querySelectorAll('.t-settab')].map(t => [t.textContent, t.clientWidth, t.scrollWidth, Math.round(t.getBoundingClientRect().right)]))));

  if (process.env.SHOT) await own.screenshot({ path: process.env.SHOT + '-en.png' });
  /* a big screen, after Documentation has loaded its styles: each request is still one card top to bottom, nothing to scroll sideways (JP 2026-11-26 12:56) */
  await own.setViewport({ width: 1920, height: 1080 }); await own.goto(U + '#docs'); await sl(2500); await own.goto(U + '#req');
  await until(own, () => !!document.querySelector('.t-rq'), 10000);
  const wide = await own.evaluate(() => { const c = document.querySelector('.t-rq'), sb = document.querySelector('.t-setbody'); return { disp: getComputedStyle(c).display, over: sb.scrollWidth - sb.clientWidth }; });
  check(wide.disp === 'block' && wide.over <= 2, 'on a big screen the request card stays a card, nothing sideways ' + JSON.stringify(wide));
  check(!/(^|[},\s])\.acc\s*\{/.test(require('fs').readFileSync(path.join(__dirname, '..', '..', '_team', 'public', 'dc', 'dc.css'), 'utf8')), "cmd's .acc rule stays out of Team's copy of the styles");
  await own.evaluate(() => { const c = document.querySelector('.t-sheet [data-act=close]'); if (c) c.click(); });
  await own.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true }); await own.goto(U + '#overview'); await own.reload(); await own.waitForSelector('.t-tabs'); await openReq(own);
  /* in Norwegian the tab is "Forespørsler" – still fits */
  await own.evaluate(() => { localStorage.setItem('team.lang', 'nb'); }); await own.evaluate(() => document.querySelector('[data-act=close]').click());
  await own.reload(); await own.waitForSelector('.t-tabs');
  await openReq(own);
  check(await own.evaluate(() => /Forespørsler/.test(document.querySelector('[data-settab=req]').textContent) && (() => { const t = document.querySelector('[data-settab=req]'), r = t.getBoundingClientRect(), bar = t.parentElement.getBoundingClientRect(); return r.right <= bar.right + 1 && r.left >= bar.left - 1; })()), 'in Norwegian: "Forespørsler", in view');
  if (process.env.SHOT) await own.screenshot({ path: process.env.SHOT + '-nb.png' });
  await own.evaluate(() => { localStorage.setItem('team.lang', 'en'); }); await own.reload(); await own.waitForSelector('.t-tabs'); await openReq(own);
  /* North site's keys are on this device (set up here, not idle-locked): approving Kari from South site works at once */
  await own.evaluate(() => document.querySelector('[data-act=rqok][data-email="kari@madeup.no"]').click());
  check(await until(own, () => !/kari@madeup\.no/.test(document.querySelector('.t-sheet').innerText)), 'Kari is approved into North site without switching team');
  check(await until(kari.p, () => !!document.querySelector('.t-tabs') || /Unlock|Lås opp/.test(document.body.innerText), 20000), 'Kari\'s page opens by itself');
  check(await until(own, () => (document.querySelector('[data-act=settings] .t-rqn') || {}).textContent === '1'), 'the gear now shows 1');

  /* South site is the team we're in – but say its keys weren't kept: here we drop them, then Ola's row asks for the passcode */
  await own.evaluate(() => document.querySelector('[data-act=close]').click());
  await own.evaluate(t => new Promise(res => { const q = indexedDB.open('team-keys', 1); q.onsuccess = () => { const tx = q.result.transaction('k', 'readwrite'), st = tx.objectStore('k'); const r = st.getAllKeys(); r.onsuccess = () => r.result.forEach(k => { if (String(k).indexOf('t/' + t + '/') === 0) st.delete(k); }); tx.oncomplete = () => { q.result.close(); res(); }; }; }), tidB);
  await own.goto(U + '?t=team'); await own.waitForSelector('.t-tabs');
  check(await until(own, () => /North site/.test(document.body.innerText)), 'now in North site');
  await openReq(own);
  await own.evaluate(() => document.querySelector('[data-act=rqok][data-email="ola@madeup.no"]').click());
  check(await until(own, () => !!document.querySelector('.t-rq input[name=rqpass]')), 'South site isn\'t open here: the row asks for its passcode');
  const ask = await own.evaluate(() => { const r = document.querySelector('.t-rq .t-rqpass'), i = document.querySelector('.t-rq input[name=rqpass]'), b = document.querySelector('.t-rq [data-act=rqok]'); return { box: !!r && /is locked on this device/.test(r.textContent) && /passcode you chose when you made or joined South site \(not the code from the e-mail\)/.test(r.textContent), focus: document.activeElement === i, btn: b && b.textContent }; });
  check(ask.box && ask.focus && ask.btn === 'Unlock and approve', 'it says where: a marked box "South site is locked on this device", the field ready to type in, the button "Unlock and approve" (JP 2026-11-26 14:10) ' + JSON.stringify(ask));
  if (process.env.SHOT) await own.screenshot({ path: process.env.SHOT + '-pass.png' });
  await own.type('.t-rq input[name=rqpass]', 'wrong-pass-9'); await own.evaluate(() => document.querySelector('[data-act=rqok][data-email="ola@madeup.no"]').click());
  check(await until(own, () => /Wrong passcode/.test((document.querySelector('.t-rq .t-err') || {}).textContent || '')), 'a wrong passcode is said in the row');
  await own.$eval('.t-rq input[name=rqpass]', e => { e.value = ''; }); await own.type('.t-rq input[name=rqpass]', 'owner-pass-2');
  await own.keyboard.press('Enter');   /* Enter in the field does the same as the button */
  check(await until(own, () => /Nobody is waiting/.test(document.querySelector('.t-sheet').innerText)), 'with the right passcode Ola is approved – nobody is waiting any more');
  check(await own.evaluate(() => !document.querySelector('[data-act=settings] .t-rqn')), 'the gear has no number');
  check(await until(ola.p, () => !!document.querySelector('.t-tabs') || /Unlock|Lås opp/.test(document.body.innerText), 20000), 'Ola\'s page opens by itself');
  const olaTeams = JSON.parse(await ola.p.evaluate(() => fetch('/api/teams').then(r => r.text())));
  check(olaTeams.teams.length === 1 && olaTeams.teams[0].id === tidB, 'Ola is in South site only');

  /* a member who isn't admin: no Requests tab, and the server gives nothing */
  await kari.p.goto(U); await kari.p.waitForSelector('form[data-form=unlock], .t-tabs');
  if (await kari.p.$('form[data-form=unlock]')) { await kari.p.type('input[name=pass]', 'kari-pass-1'); await kari.p.click('form[data-form=unlock] button[type=submit]'); }
  await kari.p.waitForSelector('[data-act=settings]'); await kari.p.evaluate(() => document.querySelector('[data-act=settings]').click()); await sl(500);
  check(await kari.p.evaluate(() => !document.querySelector('[data-settab=req]')), 'a member who isn\'t admin has no Requests tab');
  const kr = JSON.parse(await kari.p.evaluate(() => fetch('/api/requests').then(r => r.text())));
  check(Array.isArray(kr.teams) && kr.teams.length === 0, 'and the server lists no teams for her');

  /* declining from the list, in another team: a new request in South site, declined from North site */
  await own.evaluate(() => document.querySelector('[data-act=close]').click());
  await own.goto(U + '?t=' + tidB); await own.waitForSelector('.t-tabs');
  const link3 = await invite(own);
  const per = await join('per@madeup.no', link3, 'Per');
  await own.goto(U + '?t=team'); await own.waitForSelector('.t-tabs'); await until(own, () => /North site/.test(document.body.innerText));
  await openReq(own);
  check(await until(own, () => /per@madeup\.no/.test(document.querySelector('.t-sheet').innerText)), 'Per\'s request shows up');
  await own.evaluate(() => document.querySelector('[data-act=rqno][data-email="per@madeup.no"]').click());
  check(await until(own, () => /Nobody is waiting/.test(document.querySelector('.t-sheet').innerText)), 'declined from the list');
  check(await until(per.p, () => !document.getElementById('checkCode'), 20000), 'Per no longer waits');
  check(!/\bundefined\b|\bNaN\b|\bnull\b/.test(await text(own)), 'no undefined/NaN/null');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); srv.kill(); done();
})().catch(e => { console.error(e); process.exit(1); });
