/* The Team-wide check (JP 2026-11-23 "buttons not properly lined, boxes not correct, font, escape, no circle on my x, tiles not overflowing"):
   every page, each step of a project and the pop-ups, at PC and phone width. Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs'); const http = require('http');
const puppeteer = require('puppeteer'); const { check, done } = require('../lib/check'); const os = require('os');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 430, T = 'http://localhost:' + TPORT + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
const get = p => new Promise(res => http.get(T.replace(/\/$/, '') + p, r => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));
async function until(pg, fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn).catch(() => false)) return true; await sl(150); } return false; }
const AUDIT = () => {
  const out = { hscroll: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0, over: [], xcirc: [], rows: [], fonts: {}, selects: [] };
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  const boxes = [...document.querySelectorAll('.t-card, .t-sheet, .kit-tile, .dc-tile, .dc-pile, .dcn-sheet, .fdv-page, .dc-grp, .t-row, .dc-way, .dc-fsteps button, .t-tile, .t-stat, li, button, .dc-chip, .pill-btn')].filter(vis);
  boxes.forEach(b => { const br = b.getBoundingClientRect(), cs = getComputedStyle(b); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return;
    [...b.querySelectorAll('*')].filter(vis).some(c => { if (c.closest('.dx-tov, .dcn-ov') && !b.closest('.dx-tov, .dcn-ov')) return false;   /* a popup sits over the page, not inside it */ const r = c.getBoundingClientRect(); if (r.right > br.right + 2 || r.left < br.left - 2) { const pcs = getComputedStyle(c.parentElement); if (/(auto|scroll|hidden|clip)/.test(pcs.overflowX)) return false; out.over.push(name(b) + ' ⊃ ' + name(c) + ' by ' + Math.round(Math.max(r.right - br.right, br.left - r.left))); return true; } return false; }); });
  if (innerWidth) [...document.querySelectorAll('body *')].filter(vis).forEach(e => { const r = e.getBoundingClientRect(); if (r.right > innerWidth + 2 && !e.closest('[style*="overflow"], .dc-fsteps')) { const anc = [...(function* () { let a = e.parentElement; while (a) { yield a; a = a.parentElement; } })()].some(a => /(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)); if (!anc) out.over.push('VIEWPORT ' + name(e) + ' right ' + Math.round(r.right)); } });
  [...document.querySelectorAll('button, a')].filter(vis).forEach(b => { const ic = b.querySelector('i.bi-x-lg, i.bi-x, svg'); const txt = (b.textContent || '').trim(); const lab = (b.getAttribute('aria-label') || '') + ' ' + (b.title || '');
    const isX = (b.querySelector('i.bi-x-lg, i.bi-x') && !txt) || (/close|lukk|avbryt|clear|fjern/i.test(lab) && !txt && ic);
    if (!isX) return; const cs = getComputedStyle(b); const bw = parseFloat(cs.borderTopWidth), bc = cs.borderTopColor, bg = cs.backgroundColor;
    if ((bw > 0 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bc)) || !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg)) out.xcirc.push(name(b) + ' border ' + bw + ' ' + bc + ' bg ' + bg); });
  [...document.querySelectorAll('div, span, p, form, nav, label')].filter(vis).forEach(c => { const cs = getComputedStyle(c); if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection)) return;
    const kids = [...c.children].filter(k => vis(k) && /^(BUTTON|A|INPUT|SELECT|LABEL)$/.test(k.tagName) && !k.classList.contains('text-btn') && !k.classList.contains('t-link')); if (kids.length < 2) return;
    const rs = kids.map(k => k.getBoundingClientRect()); const rows = {}; rs.forEach((r, i) => { const key = Math.round(r.top / 30); (rows[key] = rows[key] || []).push([r, kids[i]]); });
    Object.values(rows).forEach(g => { if (g.length < 2) return; const hs = g.map(x => x[0].height), cs2 = g.map(x => x[0].top + x[0].height / 2); if (Math.max(...hs) - Math.min(...hs) > 6 || Math.max(...cs2) - Math.min(...cs2) > 3) out.rows.push(name(c) + ' heights ' + hs.map(Math.round).join('/') + ' centers ' + cs2.map(Math.round).join('/')); }); });
  /* three button kinds (JP 2026-11-24 19:49 "some buttons were gigantic, some small"): main and ghost 44 px with 12 px corners, small 36 px with 10 px, chips at most 36 px */
  out.sizes = [];
  const zq = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;   /* Team's PC size scales the page – sizes are checked in page px */
  [...document.querySelectorAll('.pill-btn, .t-btn, .dc-chip')].filter(vis).forEach(b => { const r0 = b.getBoundingClientRect(), r = { height: r0.height / zq }, cs = getComputedStyle(b), rad = parseFloat(cs.borderTopLeftRadius), sm = b.classList.contains('sm'), chip = b.classList.contains('dc-chip');
    const ok = chip ? r.height <= 37 : sm ? r.height >= 33 && r.height <= 40 && rad === 10 : r.height >= 41 && rad === 12;
    if (!ok) out.sizes.push(name(b) + ' ' + Math.round(r.height) + 'px r' + rad); });
  const bodyF = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
  [...document.querySelectorAll('body *')].filter(e => vis(e) && e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).forEach(e => { if (e.closest('code, pre, svg') || /^bi\b|\bbi-/.test(e.className || '')) return; const f = getComputedStyle(e).fontFamily.split(',')[0].trim(); if (f !== bodyF) { out.fonts[f] = out.fonts[f] || []; if (out.fonts[f].length < 4) out.fonts[f].push(name(e)); } });
  [...document.querySelectorAll('select')].filter(vis).forEach(s => { const cs = getComputedStyle(s); out.selects.push([name(s), cs.appearance, cs.paddingRight, cs.backgroundImage.slice(0, 30), cs.backgroundPosition].join(' | ')); });
  out.bodyFont = bodyF; return out;
};
const PJ = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'tck-')), 'p.json');
(async () => {
  for (let i = 0; i < 50 && (await get('/index.html')) !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const own = await (await b.createBrowserContext()).newPage();
  await own.setViewport({ width: 1280, height: 900 });
  await own.setCookie({ name: 'who', value: 'owner%40x.no', domain: 'localhost', path: '/' });
  await own.evaluateOnNewDocument(() => { localStorage.setItem('team.lang', 'nb'); window.confirm = () => true; });
  await own.goto(T); await own.waitForSelector('form[data-form=setup]');
  await own.$eval('input[name=team]', e => { e.value = ''; }); await own.type('input[name=team]', 'Lundberg FDV');
  await own.type('input[name=name]', 'JP'); await own.type('input[name=pass]', 'owner-pass-1'); await own.type('input[name=pass2]', 'owner-pass-1');
  await own.click('button[type=submit]'); await until(own, () => !!document.querySelector('.t-tabs'), 20000);
  const L = [['234','E','234 DA Vindu madeup'],['234','BC','234 DV Vindu madeup'],['261','E','261 DA Takstein madeup'],['111','E','111 DA Leiekontrakt madeup']];
  fs.writeFileSync(PJ, JSON.stringify({ team: 'dctl', p: { name: 'Vogts gate 10 (oppdiktet) med et ganske langt prosjektnavn', no: '10', planName: 'Dokumentplan.xlsx', lines: L.map((x, i) => ({ id: 'l' + i, code: x[0], t: x[1], planned: x[2], st: 'missing' })) } }));
  await own.goto(T + '#docs'); await own.waitForSelector('input[data-dcimport]'); await (await own.$('input[data-dcimport]')).uploadFile(PJ); await until(own, () => location.hash.startsWith('#dc='), 15000); await sl(1200);
  /* files in the project, two with the same content, so Levering, the tidy-up popup and its duplicates are checked too (JP 2026-11-24 19:49) */
  const dc0 = await own.evaluate(() => location.hash.slice(4));
  await own.evaluate(() => { const b = document.querySelector('.dc-fsteps [data-dctab="lev"]'); if (b) b.click(); }); await until(own, () => !!document.querySelector('.dc-drop input[data-dcfiles]'), 8000);
  const fdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tckf-')), fa = path.join(fdir, '234 DA Vindu madeup.pdf'), fb = path.join(fdir, 'Kopi av vindu madeup.pdf'), fc = path.join(fdir, 'scan madeup 7.pdf');
  fs.writeFileSync(fa, '%PDF-1.1\n%%EOF\n'); fs.writeFileSync(fb, '%PDF-1.1\n%%EOF\n'); fs.writeFileSync(fc, '%PDF-1.1\n% made up\n%%EOF\n');
  await (await own.$('.dc-drop input[data-dcfiles]')).uploadFile(fa, fb, fc); await until(own, () => !!document.querySelector('.dc-freshov'), 10000); await sl(800);
  await own.evaluate(() => { const b = document.querySelector('.dc-freshbtns [data-dcfreshlater]'); if (b) b.click(); }); await sl(400);
  for (const W of [1280, 420]) {
  await own.setViewport({ width: W, height: 900 });
  const res = {};
  const snap = async (k) => { await sl(700); res[k] = await own.evaluate(AUDIT); };
  const esc = async (k, sel) => { await own.keyboard.press('Escape'); await sl(400); res[k].escClosed = await own.evaluate(s => !document.querySelector(s), sel); };
  for (const h of ['overview', 'meetings', 'actions', 'docs', 'files', 'team']) { await own.goto(T + '#' + h); await snap(h); }
  const dc = await own.evaluate(() => { const r = (window.DocHost && DocHost.Fe.list('dctl')) || []; return r[0] && r[0].id; });
  for (const st of ['krav', 'plan', 'lev', 'cmp', 'end']) { await own.goto(T + '#dc=' + dc); await sl(800); await own.evaluate(s => { const b = document.querySelector('.dc-fsteps [data-dctab="' + s + '"]'); if (b) b.click(); }, st); await snap('dc-' + st); }
  await own.goto(T + '#dc=' + dc0); await sl(800); await own.evaluate(() => { const b = document.querySelector('.dc-fsteps [data-dctab="lev"]'); if (b) b.click(); }); await sl(400);
  await own.evaluate(() => { const b = document.querySelector('.dc-gname'); if (b) b.click(); }); await snap('dc-tidy'); await esc('dc-tidy', '.dc-freshov');
  await own.goto(T + '#docs'); await sl(800); await own.evaluate(() => { const b = document.querySelector('[data-dxtool="ren"]'); if (b) b.click(); }); await snap('tool-ren');
  await own.goto(T + '#overview'); await sl(500);
  for (const a of ['settings', 'teams']) { await own.evaluate(x => { const b = document.querySelector('[data-act=' + x + ']'); if (b) b.click(); }, a); await snap('sheet-' + a); await esc('sheet-' + a, '.t-sheetbg'); }
  await own.goto(T + '#files'); await sl(600); await own.evaluate(() => { const b = document.querySelector('[data-act=uplink]'); if (b) b.click(); }); await snap('sheet-uplink'); await esc('sheet-uplink', '.t-sheetbg');
  await own.goto(T + '#meetings'); await sl(600); await own.evaluate(() => { const b = document.querySelector('[data-act=newMeeting]'); if (b) b.click(); }); await snap('new-meeting'); await esc('new-meeting', '.t-sheetbg');
  await own.goto(T + '#actions'); await sl(600); await own.evaluate(() => { const b = document.querySelector('[data-act=newAction]'); if (b) b.click(); }); await snap('new-action'); await esc('new-action', '.t-sheetbg');
  for (const k of Object.keys(res)) { const v = res[k];
    check(!v.hscroll, W + ' px ' + k + ': no sideways scrolling ' + (v.hscroll || ''));
    check(!v.over.length, W + ' px ' + k + ': nothing runs outside its box ' + v.over.slice(0, 3).join(' | '));
    check(!v.xcirc.length, W + ' px ' + k + ': close buttons are a bare X ' + v.xcirc.slice(0, 2).join(' | '));
    check(!v.rows.length, W + ' px ' + k + ': buttons in a row line up ' + v.rows.slice(0, 2).join(' | '));
    check(!v.sizes.length, W + ' px ' + k + ': buttons are one of the three sizes ' + v.sizes.slice(0, 4).join(' | '));
    check(!Object.keys(v.fonts).length, W + ' px ' + k + ': one font (' + v.bodyFont + ') ' + JSON.stringify(v.fonts));
    if ('escClosed' in v) check(v.escClosed, W + ' px ' + k + ': Escape closes it'); }
  }
  await b.close(); srv.kill(); done();
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
