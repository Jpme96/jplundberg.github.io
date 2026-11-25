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
  await own.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'en'); localStorage.setItem('dash.dcOldView', '1'); window.confirm = () => true; new MutationObserver(() => { const y = document.querySelector('.ask-ov .ask-ok'); if (y) y.click(); }).observe(document, { childList: true, subtree: true }); window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (x) { window.__blobs.push(x); return o.call(URL, x); }; HTMLAnchorElement.prototype.click = function () {}; });
  const text = () => own.evaluate(() => document.body.innerText);

  /* set up a team and import a project */
  await own.goto(T); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Files team');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]');
  check(await until(own, () => !!document.querySelector('.t-tabs'), 20000), 'the owner is in the app');
  const proj = path.join(tmp, 'p.json');
  fs.writeFileSync(proj, JSON.stringify({ team: 'dctl', p: { name: 'Testveien 9', no: '9', lines: [{ id: 'a1', code: '223', name: 'Plan', st: 'ok' }, { id: 'a2', code: '231', name: 'Section', st: 'missing', due: '2026-01-05' }, { id: 'a3', code: '320', name: 'Pipes', st: 'recv' }] } }));
  await own.goto(T + '#docs'); await own.waitForSelector('input[data-dcimport]');
  await (await own.$('input[data-dcimport]')).uploadFile(proj);
  check(await until(own, () => /Imported/.test(document.body.innerText) || location.hash.startsWith('#dc='), 15000), 'a made-up project is imported');
  await sl(800);

  /* the new project flow: on for the team unless an admin turns it off in Settings (JP 2026-11-23 "only admin can turn on and off") */
  await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); }); await sl(500);
  const fl0 = await own.evaluate(() => { const c = document.querySelector('[data-flowteam]'); return c ? c.checked : null; });
  check(fl0 === true, 'Settings (admin): New project flow, on by default ' + fl0);
  await own.evaluate(() => { const c = document.querySelector('[data-flowteam]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(800);
  await own.evaluate(() => { const x = document.querySelector('[data-act=close]'); if (x) x.click(); }); await sl(300); await own.evaluate(() => { document.querySelector('[data-act=settings]').click(); document.querySelector('[data-settab=team]') && document.querySelector('[data-settab=team]').click(); }); await sl(500);
  check(await own.evaluate(() => { const c = document.querySelector('[data-flowteam]'); return c && !c.checked && window.DocHost && DocHost.flowOn && DocHost.flowOn() === false; }), 'an admin can turn it off for the team (saved: still off when Settings opens again)');
  await own.evaluate(() => { const c = document.querySelector('[data-flowteam]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(800);
  /* the team's colours (JP 2026-11-23): an admin picks a palette, everyone in the team gets it */
  await own.evaluate(() => document.querySelector('[data-act=pal][data-pal=dgreen]').click()); await sl(900);
  const pal = await own.evaluate(() => ({ attr: document.documentElement.getAttribute('data-pal'), acc: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(), on: (document.querySelector('.t-pal[aria-checked=true]') || { getAttribute: () => '' }).getAttribute('data-pal') }));
  check(pal.attr === 'dgreen' && pal.acc === '#034b45' && pal.on === 'dgreen', 'an admin picks the team colours (dark green) ' + JSON.stringify(pal));
  await own.evaluate(() => document.querySelector('[data-act=pal][data-pal=std]').click()); await sl(900);
  check(await own.evaluate(() => !document.documentElement.getAttribute('data-pal')), 'and back to the standard colours');
  await own.evaluate(() => { const x = document.querySelector('[data-act=close]'); if (x) x.click(); }); await sl(300);
  /* overview: all projects at a glance, and the week */
  await own.goto(T + '#overview'); await sl(1200);
  const ov = await text();
  check(/Testveien 9/.test(ov) && /1 of 3/.test(ov) && /1\s*approved/.test(ov) && /33 %/.test(ov), 'Overview lists the projects with how far they are ' + JSON.stringify(ov.slice(ov.indexOf('PROJ'), ov.indexOf('PROJ') + 300)));
  check(!/This week/.test(ov), 'Overview has no "This week" – it shows what needs doing (JP 2026-11-24 22:57)');

  /* a shared file: 2.4 MB in three encrypted chunks */
  await own.goto(T + '#files'); await own.waitForSelector('[data-act=uplink]');
  /* Opplastinger is only about links (JP 2026-11-25): no Add files, no Shared files while there are none */
  check(await own.evaluate(() => !document.querySelector('input[data-fadd], select[name=fproj]') && !/Shared files|Delte filer/.test(document.body.innerText)), 'Opplastinger has no Add files, Take a photo or Shared files');
  const MARK = 'made-up-file-content-';
  await own.evaluate(m => window.__teamSendFile(new File([m.repeat(Math.ceil(2.4e6 / m.length))], 'report.txt', { type: 'text/plain' }), ''), MARK);
  check(await until(own, () => /report\.txt/.test(document.body.innerText), 30000), 'the file is listed under Shared files');
  const mem = (await raw('/__mem')).body, r2 = (await raw('/__r2')).body;
  check(/"t\/do-team\/f\/[a-f0-9]{32}\/2"/.test(r2) && !/"f:[a-f0-9]{32}:/.test(mem) && !/made-up-file-content|report\.txt/.test(mem + r2), 'the file’s three encrypted pieces are in R2 under the team’s prefix, none in the team’s database, and neither the content nor the name is readable');
  await own.click('[data-act=fopen]');
  check(await until(own, () => window.__blobs.some(x => x && x.size > 2.3e6), 20000), 'opening it brings back the whole file');
  const back = await own.evaluate(() => { const f = window.__blobs.filter(x => x && x.size > 2.3e6).pop(); return f.text().then(t => t.slice(0, 42) + '|' + f.size + '|' + f.name); });
  check(back.startsWith('made-up-file-content-made-up-file-content-') && back.endsWith('|report.txt'), 'and it is the same file (' + back.split('|').slice(1).join(' ') + ')');
  check(await until(own, () => /made-up-file-content/.test((document.querySelector('.dx-fv pre') || {}).textContent || ''), 10000), 'a text file is shown right in Team, straight in the viewer – no download needed');
  check(await own.evaluate(() => !!document.querySelector('.dx-fv a[download="report.txt"]') && /fra|from|kB|MB/.test(document.querySelector('.dx-fv .dx-fvt small').textContent)), 'with Download in its top bar and the size and sender under the name');
  await own.evaluate(() => document.querySelector('.dx-fv [data-dxfvx]').click()); await sl(300);

  /* an upload link, used by a contractor on the real /upload/ page (no account, no Team sign-in) */
  await own.click('[data-act=uplink]'); await own.waitForSelector('form[data-form=uplink]');
  await own.select('select[name=pid]', await own.$eval('select[name=pid] option:nth-child(2)', o => o.value));
  await own.click('form[data-form=uplink] button[type=submit]');
  await own.waitForSelector('#invLink');
  const link = await own.$eval('#invLink', e => e.value);
  check(/^https:\/\/jplundberg\.com\/upload\/#team\.[a-f0-9]{16}\.[A-Za-z0-9_-]{40,}\.Testveien%209$/.test(link), 'the link holds the team, the link id, its key and the project name after #');
  /* the project's Filer lists the live link with Switch off (JP 2026-11-23 "cancel a link when I send it") */
  check(await own.evaluate(() => !!(window.DocHost && DocHost.uplinks && (DocHost.Fe.list('dctl') || []).some(p => DocHost.uplinks(p.id).length === 1))), 'the project knows its live upload link, so Filer can switch it off');
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
  await own.evaluate(() => window.__pushNeeds());
  check(await until(own, () => true, 1500) !== null && /"needs":\{"iv"/.test((await raw('/__mem')).body), 'the team\'s app sends the project\'s missing list for the link, encrypted');
  check(!/Section/.test((await raw('/__mem')).body.split('needs')[1] || ''), '… and the server can\'t read it');
  await con.reload(); await sl(1500);
  const nd = await con.evaluate(() => { const b0 = document.getElementById('needs'); return b0 && !b0.hidden ? b0.innerText : ''; });
  check(/What the team still needs/.test(await con.evaluate(() => document.body.innerText)) && /231/.test(nd) && /Section/.test(nd) && !/Plan\b/.test(nd), 'the contractor sees what is still missing on the project (231 Section), not what is approved ' + JSON.stringify(nd.slice(0, 200)));
  const dwg = path.join(tmp, 'A-101 plan.pdf'); fs.writeFileSync(dwg, '%PDF-1.4 made-up drawing ' + 'x'.repeat(5000));
  const photo = path.join(tmp, 'site photo.png'); fs.writeFileSync(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await (await con.$('#pick')).uploadFile(dwg, photo);
  await sl(400);
  const staged = await con.evaluate(() => ({ rows: document.querySelectorAll('#list li').length, btn: document.getElementById('send').textContent, sent: /sent|sendt/i.test(document.getElementById('done').textContent) }));
  check(staged.rows === 2 && /Send 2 files/.test(staged.btn) && !staged.sent, 'choosing files only lists them – nothing is sent before Send (' + staged.btn + ')');
  await con.evaluate(() => document.querySelector('#list [data-rm]:last-of-type') && [...document.querySelectorAll('#list li')].find(li => /site photo/.test(li.textContent)).querySelector('[data-rm]').click());
  check(await con.evaluate(() => document.querySelectorAll('#list li').length === 1), 'a chosen file can be taken off the list');
  await con.click('#send'); await sl(300);
  check(await con.evaluate(() => !document.getElementById('needWho').hidden), 'Send asks who you are first');
  await con.type('#who', 'Kari Test, Bygg AS'); await con.type('#msg', 'Revised plan, rev. C');
  await con.click('#send');
  check(await until(con, () => /1 file was sent to Testveien 9/.test(document.body.innerText), 15000), 'the contractor sends the file without signing in');
  check(await until(con, () => /Sent on this link/.test(document.body.innerText) && /A-101 plan\.pdf/.test(document.getElementById('log').innerText) && /Waiting for the team/.test(document.getElementById('log').innerText) && /Kari Test/.test(document.getElementById('log').innerText), 10000), 'the sender sees what was sent, by whom, and that the team has not taken it in yet');
  check((await raw('/api/up/team/0000000000000000/info', { cookie: 'noauth=1' })).status === 410, 'a made-up link id does not work');

  /* a project's link sends its files straight into the project's Levering (JP 2026-11-24 22:46) – not listed in Opplastinger */
  const lid0 = link.split('#')[1].split('.')[1];
  await own.goto(T + '#overview'); await own.goto(T + '#files'); await sl(1500);
  check(await own.evaluate(() => { const c = document.querySelector('.t-upl'); return !!c && !c.querySelector('[data-ups]') && /straight into the project/.test(c.textContent) && !document.querySelector('[data-act=upkeep]'); }), 'Opplastinger: the project\'s link says its files go straight into the project – no list, no Keep');
  const tp = await own.evaluate(() => ((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).id);
  await own.goto(T + '#dc=' + tp); await sl(800);
  await own.evaluate(() => { const s2 = document.querySelector('[data-dctab="lev"], [data-dctab="files"]'); s2 && s2.click(); });
  check(await until(own, () => (((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).files || []).some(f => /A-101 plan\.pdf/.test(f.name) && f.nw), 25000), 'opening the project brings the file in from the link, marked new ' + await own.evaluate(() => JSON.stringify((((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).files || []).map(f => [f.name, f.nw, f.upf]).concat([location.hash, !!(window.DocHost && DocHost.linkFiles)]))));
  check(await until(own, () => !!document.querySelector('.dc-freshline') || !!document.querySelector('.dc-fresh'), 6000), 'the new-files line shows on Levering');
  check(await until(own, () => true, 300) && await (async () => { for (let i = 0; i < 60; i++) { if (!(await raw('/__mem')).body.includes('"uf:' + lid0 + ':')) return true; await sl(500); } return false; })(), 'once the project\'s copy is shared with the team, the copy on the link is removed');
  /* it opens in the viewer from Documents, which zooms inside the PDF (JP 2026-11-23) */
  await own.evaluate(() => { const v = [...document.querySelectorAll('[data-dcview]')].find(x => /A-101/.test(x.textContent)); v && v.click(); });
  check(await until(own, () => !!document.querySelector('.dx-fv .dx-fvb'), 10000), 'the file from the link opens in the zoomable viewer');
  /* the icons sit in the middle of their round buttons (JP 2026-11-23: the close X was off-centre in Team) */
  const off = await own.evaluate(() => [...document.querySelectorAll('.icon-btn')].filter(b => b.offsetParent && b.querySelector('i.bi')).map(b => { const r = b.getBoundingClientRect(), g = b.querySelector('i.bi').getBoundingClientRect(); return { dx: Math.abs((r.left + r.width / 2) - (g.left + g.width / 2)), dy: Math.abs((r.top + r.height / 2) - (g.top + g.height / 2)) }; }).filter(o => o.dx > 2.5 || o.dy > 2.5));
  check(!off.length, 'every icon is centred in its round button ' + JSON.stringify(off));
  const cx = await own.evaluate(() => { const b = document.querySelector('.dx-fv [data-dxfvx]'); if (!b) return null; const c = getComputedStyle(b), r = b.getBoundingClientRect(), sh = b.closest('.dcn-sheet').getBoundingClientRect(); return { border: c.borderTopColor, bg: c.backgroundColor, gap: Math.round(sh.right - r.right) }; });
  check(cx && /rgba\(0, 0, 0, 0\)|transparent/.test(cx.border) && /rgba\(0, 0, 0, 0\)|transparent/.test(cx.bg) && cx.gap >= 0 && cx.gap <= 24, 'the close X has no circle and sits in the top corner ' + JSON.stringify(cx));
  await own.evaluate(() => { const x = document.querySelector('.dx-fv [data-dxfvx]'); if (x) x.click(); }); await sl(300);
  for (let i = 0; i < 6; i++) {   /* a late save from sharing the file can put it back – clear until it stays empty */
    await own.evaluate(() => { const t = DocHost.Fe.tools(); (t.dctl || []).forEach(x => { if (/Testveien 9/.test(x.name)) x.files = []; }); DocHost.Fe.saveTools(t); }); await sl(1200);
    if (await own.evaluate(() => !(((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).files || []).length)) break; }   /* back to an empty Levering for the steps below */
  await own.goto(T + '#files'); await sl(1200);
  /* switching the link off */
  /* remind the contractor: the card counts what is late and "Remind" makes a message with those items and the link */
  await own.evaluate(() => { window.__shared = null; navigator.share = o => { window.__shared = o.text; return Promise.resolve(); }; });
  await own.evaluate(() => window.__teamDraw ? window.__teamDraw() : null); await sl(300);
  const rm = await own.evaluate(() => { const c = document.querySelector('.t-upl'); const l = c && c.querySelector('.t-late'), bt = c && c.querySelector('[data-act=upremind]'); if (bt) bt.click(); return { late: l ? l.textContent : '', btn: !!bt }; });
  await sl(300);
  const msg = await own.evaluate(() => window.__shared || '');
  check(/1 item is late/.test(rm.late) && rm.btn && /231 Section/.test(msg) && /05\.01\.2026/.test(msg) && msg.indexOf(link) > -1 && !/Plan\b|Pipes/.test(msg), 'Remind: 1 late item on the card, the message lists it with its deadline and the link ' + JSON.stringify([rm, msg.slice(0, 160)]));
  await own.evaluate(() => document.querySelector('[data-act=upoff]').click()); await sl(1200);
  const offInfo = await raw('/api/up/team/' + link.split('#')[1].split('.')[1] + '/info', { cookie: 'noauth=1' });
  await con.goto('about:blank'); await con.goto(SITE + 'upload/' + link.slice(link.indexOf('#')));
  check(offInfo.status === 410 && await until(con, () => /run out or was switched off/.test(document.body.innerText), 8000), 'a switched-off link stops working (' + offInfo.status + ')');
  await con.close();

  /* a link without a project (JP 2026-11-24 22:51): its files wait in Opplastinger – Download as they are, or Put in a project */
  await own.goto(T + '#files'); await sl(800);
  await own.click('[data-act=uplink]'); await own.waitForSelector('form[data-form=uplink]');
  await own.select('select[name=pid]', '');
  await own.click('form[data-form=uplink] button[type=submit]'); await own.waitForSelector('#invLink');
  let link2 = await own.$eval('#invLink', e => e.value); const lid2 = link2.split('#')[1].split('.')[1];
  await own.evaluate(() => { const c = document.querySelector('[data-act=close]'); c && c.click(); }); await sl(300);
  const con2 = await (await b.createBrowserContext()).newPage();
  await con2.setRequestInterception(true);
  con2.on('request', async r => { const u = r.url(); if (u.includes('/upload/api/')) { const res = await raw('/api/up/' + u.split('/upload/api/')[1], { method: r.method(), body: r.postData(), headers: { 'content-type': 'application/json', cookie: 'noauth=1' } }); return r.respond({ status: res.status, contentType: 'application/json', body: res.body }); } r.continue(); });
  const send2 = async (name, body) => { await con2.goto(SITE + 'upload/' + link2.slice(link2.indexOf('#'))); await con2.waitForSelector('#pick'); const fp = path.join(tmp, name); fs.writeFileSync(fp, body); await (await con2.$('#pick')).uploadFile(fp); await sl(300); await con2.click('#send'); await sl(300); if (await con2.evaluate(() => !document.getElementById('needWho').hidden)) { await con2.type('#who', 'Made-up Rør AS'); await con2.click('#send'); } return until(con2, () => /was sent|ble sendt/.test(document.body.innerText), 15000); };
  check(await send2('332 DV Ror madeup.pdf', '%PDF-1.4 made-up pipes ' + 'y'.repeat(800)), 'a file is sent on the link without a project');
  await own.goto(T + '#overview'); await own.goto(T + '#files');
  check(await until(own, () => { const c = document.querySelector('.t-upl[data-upwait]'); return !!c && /332 DV Ror madeup\.pdf/.test(c.textContent) && !!c.querySelector('[data-act=upren]') && !!c.querySelector('[data-act=upproj]') && !!c.querySelector('[data-act=upzip]'); }, 15000), 'it waits on the link\'s card with Name and download, Put in a project and Download as they are');
  await own.evaluate(() => { window.__dlNames = []; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dlNames.push(this.download); return; } return oc.call(this); }; });
  /* the card (JP 2026-11-25): the link's buttons beside the title, an eye and a download on each file, every button styled */
  const card = await own.evaluate(() => { const c = document.querySelector('.t-upl[data-upwait]'), row = c.querySelector('.t-uprow');
    return { head: !!c.querySelector('.t-uphb [data-act=upcopy]') && !!c.querySelector('.t-uphb [data-act=upoff]'), eye: !!(row && row.querySelector('[data-act=upopen].t-icon')), dl: !!(row && row.querySelector('[data-act=updl1]')),
      plain: [...c.querySelectorAll('button')].filter(x => !x.closest('[hidden]') && !/t-btn|t-icon|t-row/.test(x.className)).map(x => x.textContent) }; });
  check(card.head && card.eye && card.dl && !card.plain.length, 'the link card: Copy and Switch off beside the title, an eye and a download per file, no unstyled button ' + JSON.stringify(card));
  await own.evaluate(() => document.querySelector('.t-upl[data-upwait] [data-act=updl1]').click());
  check(await until(own, () => window.__dlNames.includes('332 DV Ror madeup.pdf'), 15000), 'the download on a row gives just that one file');
  await own.evaluate(() => document.querySelector('.t-upl[data-upwait] .t-icon[data-act=upopen]').click());
  check(await until(own, () => { const v = document.querySelector('.dx-fv'); return !!v && /332 DV Ror madeup\.pdf/.test(v.textContent) && !!v.querySelector('a[download]') && !document.getElementById('prevBox'); }, 15000), 'the eye opens the file straight in the viewer (Download in its top bar, no box in between)');
  await own.evaluate(() => { const x = document.querySelector('.dx-fv [data-dxfvx]'); x && x.click(); }); await sl(300);
  await own.evaluate(() => document.querySelector('.t-upl[data-upwait] [data-act=upren]').click());
  check(await until(own, () => { const h = document.getElementById('dcPopHold'), o = h && h.querySelector('.dx-tov'); if (!o) return false; const r = o.getBoundingClientRect(); return r.width > 300 && r.height > 200 && /332 DV Ror madeup/.test(o.textContent) && /opplastingslenken|upload link/.test(o.textContent) && location.hash === '#files' && document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.dx-tov') === o; }, 15000), 'Name and download opens the naming popup right over Opplastinger, with the link\'s files (JP 2026-11-25 "it just doesn\'t pop up")');
  check(await own.evaluate(() => (document.getElementById('dcPopHold').textContent.match(/\.pdf/g) || []).length >= 1 && !/Testveien/.test(document.getElementById('dcPopHold').textContent)), 'only the link\'s files are in it');
  await own.evaluate(() => document.querySelector('#dcPopHold [data-dxtool=""]').click());
  check(await until(own, () => !document.querySelector('#dcPopHold .dx-tov') && location.hash === '#files' && !!document.querySelector('.t-upl[data-upwait]'), 8000), 'closing it leaves you on Opplastinger with the card as it was');
  await own.goto(T + '#overview'); await own.goto(T + '#files');
  await until(own, () => !!document.querySelector('.t-upl[data-upwait] [data-act=upzip]') && !document.querySelector('.t-upl[data-upwait] [data-act=upzip]').closest('[hidden]'), 15000);
  await own.evaluate(() => document.querySelector('.t-upl[data-upwait] [data-act=upzip]').click());
  check(await until(own, () => window.__dlNames.some(n => /\.zip$/.test(n)), 15000), 'Download as they are gives one .zip');
  check(await (async () => { for (let i = 0; i < 30; i++) { if (!(await raw('/__mem')).body.includes('"uf:' + lid2 + ':')) return true; await sl(400); } return false; })(), 'and the files are gone from the link afterwards');
  check(await send2('333 DV Sprinkler madeup.pdf', '%PDF-1.4 made-up sprinkler ' + 'z'.repeat(900)), 'another file on the same link');
  await own.goto(T + '#overview'); await own.goto(T + '#files');
  await until(own, () => !!document.querySelector('.t-upl[data-upwait] [data-act=upproj]') && !document.querySelector('.t-upl[data-upwait] [data-act=upproj]').closest('[hidden]'), 15000);
  await own.evaluate(() => document.querySelector('.t-upl[data-upwait] [data-act=upproj]').click()); await sl(400);
  await own.evaluate(() => { const b2 = [...document.querySelectorAll('[data-act=upprojgo]')].find(x => /Testveien 9/.test(x.textContent)); b2 && b2.click(); });
  check(await until(own, () => (((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).files || []).some(f => /333 DV Sprinkler madeup\.pdf/.test(f.name) && f.nw), 20000), 'Put in a project: the file lands in that project\'s Levering, marked new');
  check(await (async () => { for (let i = 0; i < 60; i++) { if (!(await raw('/__mem')).body.includes('"uf:' + lid2 + ':')) return true; await sl(500); } return false; })(), 'and once it is shared in the project, the link\'s copy goes');
  for (let i = 0; i < 6; i++) {   /* a late save from sharing the file can put it back – clear until it stays empty */
    await own.evaluate(() => { const t = DocHost.Fe.tools(); (t.dctl || []).forEach(x => { if (/Testveien 9/.test(x.name)) x.files = []; }); DocHost.Fe.saveTools(t); }); await sl(1200);
    if (await own.evaluate(() => !(((DocHost.Fe.tools().dctl || []).find(x => /Testveien 9/.test(x.name)) || {}).files || []).length)) break; }
  /* Switch off keeps the files (JP 2026-11-25 "Slå av deletes everything"); Delete the files asks, has Undo, and only then deletes */
  const lid3 = await (async () => { await own.goto(T + '#files'); await sl(600); await own.click('[data-act=uplink]'); await own.waitForSelector('form[data-form=uplink]'); await own.select('select[name=pid]', ''); await own.click('form[data-form=uplink] button[type=submit]'); await own.waitForSelector('#invLink'); return own.$eval('#invLink', e => e.value); })();
  await own.evaluate(() => { const c = document.querySelector('[data-act=close]'); c && c.click(); }); await sl(300);
  const l3 = lid3.split('#')[1].split('.')[1];
  { const prev = link2; link2 = lid3; await con2.goto('about:blank'); check(await send2('334 DV Ventil madeup.pdf', '%PDF-1.4 made-up valve ' + 'v'.repeat(700)), 'a file on a third link without a project'); link2 = prev; }
  await own.goto(T + '#overview'); await own.goto(T + '#files');
  const c3 = '.t-upl[data-lid="' + l3 + '"]';
  await until(own, s3 => { const c = document.querySelector(s3); return !!c && /334 DV Ventil/.test(c.textContent); }, 15000, c3);
  await own.evaluate(s3 => document.querySelector(s3 + ' [data-act=upoff]').click(), c3); await sl(300);
  await own.evaluate(() => { const ok = document.querySelector('.ask-ov .ask-ok'); ok && ok.click(); }); await sl(1500);
  check(await until(own, s3 => { const c = document.querySelector(s3); return !!c && /334 DV Ventil/.test(c.textContent) && /Switched off|Slått av/.test(c.textContent) && !!c.querySelector('[data-act=upwipe]:not([hidden])') && !c.querySelector('[data-act=upoff]'); }, 15000, c3), 'Switch off: the card stays with its files, now with Delete the files');
  check((await raw('/__mem')).body.includes('"uf:' + l3 + ':'), 'and the files are still on the server');
  await own.evaluate(s3 => document.querySelector(s3 + ' [data-act=upwipe]').click(), c3); await sl(300);
  await own.evaluate(() => { const ok = document.querySelector('.ask-ov .ask-ok'); ok && ok.click(); }); await sl(500);
  check(await own.evaluate(s3 => !document.querySelector(s3) && !!document.querySelector('#toast .t-undo'), c3), 'Delete the files: the card goes and the toast offers Undo');
  await own.evaluate(() => document.querySelector('#toast .t-undo').click()); await sl(400);
  check(await until(own, s3 => { const c = document.querySelector(s3); return !!c && /334 DV Ventil/.test(c.textContent); }, 10000, c3), 'Undo brings the card and its files back');
  await sl(9000);
  check((await raw('/__mem')).body.includes('"uf:' + l3 + ':'), 'after Undo nothing is deleted');
  await own.evaluate(s3 => document.querySelector(s3 + ' [data-act=upwipe]').click(), c3); await sl(300);
  await own.evaluate(() => { const ok = document.querySelector('.ask-ov .ask-ok'); ok && ok.click(); });
  check(await (async () => { for (let i = 0; i < 40; i++) { if (!(await raw('/__mem')).body.includes('"uf:' + l3 + ':')) return true; await sl(500); } return false; })(), 'without Undo the files are deleted once the Undo time is over');
  await con2.close();

  /* push when Team is closed: the switch in Settings stores this device's subscription for the team */
  const k = await own.evaluate(() => fetch('/api/push', { headers: { 'x-team': '1' } }).then(r => r.json()));
  check(/^[A-Za-z0-9_-]{80,}$/.test(k.key || ''), 'Team has its own push key (made once, kept on the server)');
  const fake = await own.evaluate(async () => { const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)); const b = u => btoa(String.fromCharCode.apply(null, u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return { endpoint: 'https://push.example.test/abc123def456', keys: { p256dh: b(pub), auth: b(crypto.getRandomValues(new Uint8Array(16))) } }; });
  const on = await own.evaluate(s => fetch('/api/push', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ sub: s, on: true }) }).then(r => r.json()), fake);
  check(on.on === true && /"p:owner@x\.no:/.test((await raw('/__mem')).body), 'switching push on keeps the subscription for this team');
  await own.evaluate(s => fetch('/api/push', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint, on: false }) }), fake);
  check(!/"p:owner@x\.no:/.test((await raw('/__mem')).body), 'and switching it off removes it');
  await own.evaluate(() => { document.querySelector('[data-act=settings]') && document.querySelector('[data-act=settings]').click(); const y = document.querySelector('[data-settab=you]'); if (y) y.click(); });
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

  /* Opplastinger keeps no history: the switched-off project link is gone, and there is no change log (JP 2026-11-24 22:56–22:57) */
  await own.goto(T + '#overview'); await own.goto(T + '#files'); await sl(1500);
  check(await own.evaluate(() => ![...document.querySelectorAll('.t-upl')].some(c => /Switched off/.test(c.textContent))), 'the switched-off project link is not shown any more (the one moved to a project is live)');
  await own.goto(T + '#team'); await sl(1000);
  check(await own.evaluate(() => !document.querySelector('[data-act=log]')) && !((await raw('/__mem')).body.match(/"l:\d{9}"/g) || []).length, 'there is no change log – no card, no lines on the server');
  /* deleting a project in Team */
  await own.goto(T + '#docs'); await sl(1200);
  const pid = await own.evaluate(() => { const a = [...document.querySelectorAll('a[href^="#dc="], [data-dcopen]')][0]; return a ? (a.getAttribute('href') || '').replace('#dc=', '') || a.dataset.dcopen : ''; });
  /* files uploaded to a project: a box to give them the right names, like "Give files the right names"; Done closes it (JP 2026-11-24) */
  if (pid) {
    await own.goto(T + '#dc=' + pid); await sl(1500);
    await until(own, () => !!document.querySelector('[data-dctab="lev"], [data-dctab="files"]'), 8000);   /* this test keeps the old view: its Files tab draws the same delivery part */
    await own.evaluate(() => { const s = document.querySelector('[data-dctab="lev"], [data-dctab="files"]'); s && s.click(); }); await sl(500);
    const upd = fs.mkdtempSync(path.join(os.tmpdir(), 'tfr-')), up = path.join(upd, 'Tegning madeup 15.pdf'), up2 = path.join(upd, 'Untitled.jpg'); fs.writeFileSync(up, '%PDF-1.1\n%%EOF\n'); fs.writeFileSync(up2, 'not really a picture');
    /* nothing delivered yet: one big box to drop on, Choose files as its main button (JP 2026-11-24 17:53) */
    await until(own, () => !!document.querySelector('.dc-drop input[data-dcfiles]'), 8000);
    const eb = await own.evaluate(() => ({ box: !!document.querySelector('.dc-drop .pill-btn input[data-dcfiles]'), menu: !!document.querySelector('.dc-addm') }));
    check(eb.box && !eb.menu, 'an empty Levering is one box to drop on, no Add menu yet ' + JSON.stringify(eb) + (eb.box ? '' : await own.evaluate(() => { const i = document.querySelector('input[data-dcfiles]'); let e = i, c = []; while (e && c.length < 5) { c.push(e.tagName + '.' + e.className); e = e.parentNode; } return c.join(' < '); })));
    const inp = await own.$('.dc-drop input[data-dcfiles]'); if (inp) await inp.uploadFile(up, up2);
    check(await until(own, () => { const b = document.querySelector('.dc-fresh'); return !!b && /Gi de nye filene riktig navn|Give the new files/.test(b.textContent) && /Tegning madeup 15/.test(b.textContent); }, 10000), 'an uploaded file gets the "Give the new files the right names" box');
    /* it is a popup after your own upload; Not now leaves a line that opens it again, and with files there is "+ Add" (JP 2026-11-24 17:53) */
    const pp = await own.evaluate(() => ({ pop: !!document.querySelector('.dc-freshov .dc-fresh'), box: !!document.querySelector('.dc-drop'), add: !!document.querySelector('.dc-sumbar [data-dcaddm]') }));
    check(pp.pop && !pp.box && pp.add, 'the naming box opens as a popup; the page has "+ Add" instead of the big box ' + JSON.stringify(pp));
    await own.evaluate(() => { const b = document.querySelector('.dc-freshbtns [data-dcfreshlater]'); b && b.click(); }); await sl(400);
    const nl = await own.evaluate(() => ({ pop: !!document.querySelector('.dc-freshov'), line: (document.querySelector('.dc-freshline') || {}).textContent || '' }));
    check(!nl.pop && /2 (nye filer|new files)/.test(nl.line), 'Not now closes it and leaves "2 new files need their names" ' + JSON.stringify(nl));
    await own.evaluate(() => document.querySelector('.dc-freshline').click()); await sl(400);
    check(await own.evaluate(() => !!document.querySelector('.dc-freshov .dc-fresh')), 'the line opens the popup again');
    await own.evaluate(() => document.querySelector('.dc-sumbar [data-dcaddm]').click()); await sl(200);
    const am = await own.evaluate(() => { const l = document.querySelector('.dc-sumbar .dc-addlist'); return { open: !!l && !l.hidden, files: !!(l && l.querySelector('input[data-dcfiles]')), names: !!(l && l.querySelector('input[data-dcnames]')), paste: !!(l && l.querySelector('[data-dcpastebtn]')) }; });
    check(am.open && am.files && am.names && am.paste, 'the Add menu has Choose files, Import list and Paste names ' + JSON.stringify(am));
    await own.keyboard.press('Escape'); await sl(200);
    /* "Select all" in that box ticks every file in it (JP 2026-11-24 08:47: it didn't) */
    await until(own, () => document.querySelectorAll('.dc-fresh [data-dcnpk]').length >= 2, 6000);
    await own.evaluate(() => { const a = document.querySelector('.dc-fresh input[data-dcnpkall]'); a && a.click(); }); await sl(400);
    const pk = await own.evaluate(() => { const B = [...document.querySelectorAll('.dc-fresh [data-dcnpk]')]; return { n: B.length, on: B.filter(b => b.checked).length, all: !!(document.querySelector('.dc-fresh input[data-dcnpkall]') || {}).checked }; });
    check(pk.n >= 2 && pk.on === pk.n && pk.all, 'Select all in the new-files box ticks every file (' + JSON.stringify(pk) + ')');
    /* the box shows how far you've come, and Done is the main button only when every file has its new name (JP 2026-11-24) */
    const pr = await own.evaluate(() => ({ p: (document.querySelector('.dc-fresh .dc-freshp') || {}).textContent || '', main: !!document.querySelector('.dc-fresh [data-dcfreshok].pill-btn'), cards: document.querySelectorAll('.dc-fresh .dcn-files > li').length }));
    check(/^0 (av|of) 2/.test(pr.p) && !pr.main && pr.cards === 2, 'the new-files box says 0 of 2 have their new name, and Done is not the main button yet ' + JSON.stringify(pr));
    /* the delivered files are shared with the team (JP 2026-11-24 "files should be shareable"): each gets an encrypted copy in the team's
       storage (R2 in the test server), and a device without the file opens it from there */
    const shared = await until(own, () => { const p = (DocHost.Fe.tools().dctl || []).filter(x => (x.files || []).some(f => /Tegning madeup 15/.test(f.name)))[0]; return !!p && p.files.filter(f => !f.nf).every(f => f.tf && f.tf.fid); }, 25000);   /* sent one at a time – slower on a loaded runner */
    check(shared, 'each delivered file gets a copy in the team’s storage (tf on the file record) ' + (shared ? '' : await own.evaluate(() => JSON.stringify((DocHost.Fe.tools().dctl || []).map(x => (x.files || []).map(f => f.name + ':' + (f.tf ? 'tf' : '-') + (f.nf ? ':nf' : '')))))));
    const away = await own.evaluate(async () => { const p = (DocHost.Fe.tools().dctl || []).filter(x => (x.files || []).some(f => /Tegning madeup 15/.test(f.name)))[0], f = p.files.filter(x => /Tegning madeup 15/.test(x.name))[0];
      await new Promise(r => { const q = indexedDB.open('dash-dctl', 1); q.onsuccess = () => { const t = q.result.transaction('files', 'readwrite'); t.objectStore('files').delete(f.id); t.oncomplete = r; t.onerror = r; }; q.onerror = r; });
      const b = document.querySelector('[data-dcview="' + f.id + '"]'); if (!b) return { btn: false }; b.click();
      for (let i = 0; i < 40 && !document.querySelector('.dx-fv'); i++) await new Promise(r => setTimeout(r, 150));
      const ok = !!document.querySelector('.dx-fv'); const x = document.querySelector('.dx-fv [data-dxfx], .dx-fv .icon-btn'); if (ok) document.querySelector('.dx-fv').remove(); return { btn: true, ok }; });
    check(away.btn && away.ok, 'a device without the file opens it from the team ' + JSON.stringify(away));
    /* duplicates in a project (JP 2026-11-24 "it did not check for duplicates"): the very same file again is skipped; the same content
       under another name is kept, a bar says so, and Check them lets you keep one */
    const du = path.join(upd, 'Kopi av tegning madeup.pdf'); fs.writeFileSync(du, '%PDF-1.1\n%%EOF\n');
    const inp2 = await own.$('input[data-dcfiles]'); if (inp2) await inp2.uploadFile(up, du); await sl(2500);
    /* in Team the duplicates are step 1 of the popup, "Duplikater" (JP 2026-11-24 19:59): each group in its own box, the best one picked,
       nothing removed until Keep; solving the last group goes on to Gi navn by itself */
    const d1 = await own.evaluate(() => ({ grp: [...document.querySelectorAll('.dc-freshov .dc-tdg')].map(g => [...g.querySelectorAll('.dc-tdn')].map(b => b.title).sort().join('+')), step: ((document.querySelector('.dc-freshov .dc-tsteps [aria-selected="true"]') || {}).dataset || {}).dcstep, steps: document.querySelectorAll('.dc-freshov .dc-tsteps [data-dcstep]').length, title: (document.querySelector('.dc-freshov .dc-freshh b') || {}).textContent || '', bar: !!document.querySelector('.dx-dupbar') }));
    check(d1.grp.length === 1 && /Kopi av tegning/.test(d1.grp[0]) && /Tegning madeup 15/.test(d1.grp[0]) && d1.step === '1' && d1.steps === 2 && /Rydd i filene|Tidy up the files/.test(d1.title) && !d1.bar, 'the same content under another name: step 1 Duplicates with the group in its own box ' + JSON.stringify(d1));
    await own.evaluate(() => { const r = [...document.querySelectorAll('.dc-freshov [data-dcdpick]')].find(x => /Tegning madeup 15/.test(x.closest('label').querySelector('.dc-tdn').title)); r.click(); }); await sl(400);
    const pk1 = await own.evaluate(() => ({ kept: [...document.querySelectorAll('.dc-freshov .dc-tdr.on .dc-tdn')].map(x => x.title).join(), files: ((DocHost.Fe.tools().dctl || []).find(x => (x.files || []).some(f => /Tegning madeup 15/.test(f.name))) || { files: [] }).files.some(f => /Kopi av tegning/.test(f.name)) }));
    check(/Tegning madeup 15/.test(pk1.kept) && pk1.files, 'choosing the one to keep removes nothing yet ' + JSON.stringify(pk1));
    await own.evaluate(() => document.querySelector('.dc-freshov [data-dckeep="0"]').click());
    await until(own, () => !document.querySelector('.dc-freshov .dc-tdg'), 8000);
    const d2 = await own.evaluate(() => ({ pop: !!document.querySelector('.dc-freshov'), step: ((document.querySelector('.dc-freshov .dc-tsteps [aria-selected="true"]') || {}).dataset || {}).dcstep, done: !!document.querySelector('.dc-freshov .dc-tsteps .ok'), copy: ((DocHost.Fe.tools().dctl || []).find(x => (x.files || []).some(f => /Tegning madeup 15/.test(f.name))) || { files: [] }).files.some(f => /Kopi av tegning/.test(f.name)) }));
    check(d2.pop && d2.step === '2' && d2.done && !d2.copy, 'Keep: the copy leaves the project and the popup goes on to Gi navn, step 1 ticked ' + JSON.stringify(d2));
    /* the filters: Name problems and All; "Give names" opens it any time, and the name problems on the summary line go to their filter */
    await own.evaluate(() => document.querySelector('.dc-freshov [data-dcff="all"]').click()); await sl(400);
    const fa = await own.evaluate(() => ({ on: (document.querySelector('.dc-freshov [data-dcff][aria-pressed="true"]') || {}).dataset.dcff, cards: document.querySelectorAll('.dc-freshov .dcn-files > li').length, files: (DocHost.Fe.tools().dctl || []).find(x => (x.files || []).some(f => /Tegning madeup 15/.test(f.name))).files.length }));
    check(fa.on === 'all' && fa.cards === fa.files, 'All shows every file in the project ' + JSON.stringify(fa));
    await own.evaluate(() => { const b = document.querySelector('[data-dcfreshok]'); b && b.click(); });
    check(await until(own, () => !document.querySelector('.dc-fresh') && !document.querySelector('.dc-freshline'), 4000), 'and Done closes it, with no line left');
    await own.evaluate(() => document.querySelector('.dc-sumbar .dc-gname').click()); await sl(400);
    const gn = await own.evaluate(() => ({ pop: !!document.querySelector('.dc-freshov'), on: (document.querySelector('.dc-freshov [data-dcff][aria-pressed="true"]') || {}).dataset.dcff }));
    check(gn.pop && (gn.on === 'bad' || gn.on === 'all'), '"Give names" opens the popup again after Done, on Name problems or All ' + JSON.stringify(gn));
    await own.evaluate(() => document.querySelector('.dc-freshbtns [data-dcfreshlater]').click()); await sl(300);
    /* files dropped anywhere on Levering are added, and the popup opens for them */
    await own.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.1\n%%EOF\n made up drop'], 'Dropped madeup 16.pdf', { type: 'application/pdf' }));
      document.querySelector('.dc-sumbar').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); });
    check(await until(own, () => !!document.querySelector('.dc-freshov') && /Dropped madeup 16/.test(document.querySelector('.dc-freshov').textContent), 8000), 'a file dropped on Levering is added and the naming popup opens');
    await own.evaluate(() => { const b = document.querySelector('[data-dcfreshok]'); b && b.click(); }); await sl(300);
  }
  if (pid) { await own.goto(T + '#docs'); await sl(800); await own.goto(T + '#dc=' + pid); await until(own, () => !!document.querySelector('[data-dcprojinfo], [data-dcdel]'), 8000); await own.evaluate(() => { let b = document.querySelector('[data-dcdel]'); if (!b) { const i = document.querySelector('[data-dcprojinfo], [data-dctab="over"]'); i && i.click(); b = document.querySelector('[data-dcdel]'); } b && b.click(); }); await sl(500); await own.evaluate(() => { const ok = document.querySelector('.ask-ov .ask-ok'); ok && ok.click(); }); await sl(2500); await own.goto(T + '#overview'); await own.reload(); await sl(2500); }
  check(pid && !/Testveien 9/.test(await own.evaluate(() => (document.querySelector('.t-projs') || {}).textContent || '')), 'a project can be deleted in Team (' + pid + ')');
  check(!errs.length, 'no errors ' + errs.join(' | ').slice(0, 400));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  await done();
})();
