/* A project with no document plan and no requirements (JP's live review 2026-11-26 17:05): no words about a plan or a list it
   doesn't have – Sammenligning says the list is made from the delivery, Levering doesn't say "0 not in the plan", Sluttkontroll
   says what it was checked against; the project list and Team's overview use the same progress words. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { Features.set('fdv', true); const t = Features.tools(); t.dcreq = []; t.dckrav = [];
    const files = [{ id: 'f1', name: '364 DV Madeup spjeld.pdf', size: 10, line: 'l1' }, { id: 'f2', name: '365 DA Madeup vifte.pdf', size: 10, line: 'l2' }];
    const lines = [{ id: 'l1', code: '364', t: 'BC', st: 'recv', files: ['f1'] }, { id: 'l2', code: '365', t: 'E', st: 'ok', files: ['f2'] }];
    t.dctl = [{ id: 'nl1', name: 'Made-up without a list', lines, files, noPlan: 1 }]; Features.saveTools(t); });
  await go(p, 'work/#docs', 2500);
  const row = await p.evaluate(() => (document.querySelector('.dx-list .dc-st') || {}).textContent || '');
  check(/2 of 2 delivered · 1 approved/.test(row), 'the project list: "2 of 2 delivered · 1 approved" ' + row);
  await go(p, 'work/#dc=nl1', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="cmp"]').click()); await sl(400);
  const cmp = await p.evaluate(() => ({ note: (document.querySelector('.dc-nolist') || {}).textContent || '', piles: [...document.querySelectorAll('.dc-pile .dc-fpill')].map(x => x.textContent), go: !!document.querySelector('.dc-nolist [data-dctab="plan"]') }));
  check(/the list is made from what was delivered/.test(cmp.note) && cmp.go && cmp.piles.join('|') === 'Delivered|Missing|Not on the list yet', 'Sammenligning says the list came from the delivery, offers a plan, and the piles say no "on the list" ' + JSON.stringify(cmp));
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="lev"]').click()); await sl(400);
  const lev = await p.evaluate(() => [...document.querySelectorAll('.dc-flow .dc-note, .dc-sumbar .dc-note')].map(x => x.textContent.replace(/\s+/g, ' ')).join(' | '));
  check(/2 files delivered/.test(lev) && !/not in the plan/.test(lev), 'Levering: "2 files delivered" without "not in the plan" ' + lev);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(400);
  const end = await p.evaluate(() => [...document.querySelectorAll('.dc-flow .dc-help')].map(x => x.textContent).join(' | '));
  check(/No requirements, document plan or checklist to check against/.test(end) && !/client’s checklist\./.test(end), 'Sluttkontroll says there was nothing to check against ' + end);
  /* the same project with a plan: the plan words come back */
  await p.evaluate(() => { const t = Features.tools(); t.dctl[0].planName = 'Made-up plan.xlsx'; t.dctl[0].planFile = 1; delete t.dctl[0].noPlan; Features.saveTools(t); });
  await go(p, 'work/#dc=nl1', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="end"]').click()); await sl(400);
  check(/Checked against the document plan\./.test(await p.evaluate(() => document.querySelector('.dc-flow').textContent)), 'with a plan: "Checked against the document plan."');
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="cmp"]').click()); await sl(400);
  check(await p.evaluate(() => !document.querySelector('.dc-nolist') && /In the plan and delivered/.test(document.querySelector('.dc-piles').textContent)), 'with a plan: the plan piles, no note');
  /* Team's overview card names what its number is */
  const app = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '_team', 'public', 'app.js'), 'utf8');
  check(/' approved', done \+ ' av ' \+ ls\.length \+ ' godkjent'/.test(app), 'Team\'s overview says "0 av 4 godkjent", not just "0 av 4"');
  check(/t-whead/.test(app) && /L\('Actions', 'Oppgaver'\), L\('What you and the others are to do/.test(app), 'the welcome card is compact ("Got it" beside the title) and names Oppgaver too');
  await go(p, 'work/#docs', 2000);
  check(await p.evaluate(() => { const n = document.querySelector('[data-dcnew], [data-drnew]'); return !!n && n.classList.contains('pill-btn'); }), '"New project" is a real button');
  /* a popup's opening is held until it has been drawn, then runs from the start (JP 2026-11-26 20:14 "stuttering") */
  /* the page is updated in place (JP 2026-11-27: opening a file card rebuilt the whole page): what didn't change stays the same node,
     a field comes back to what the page says, the popup observer's classes stay on a kept popup */
  const ip = await p.evaluate(async () => { const el = document.getElementById('wkDocCtl'); const first = el.firstElementChild; const kids = el.querySelectorAll('*').length;
    let muts = 0, mw = []; const mo = new MutationObserver(ms => { muts += ms.length; ms.forEach(m => mw.push(m.type + ':' + (m.target.className || m.target.nodeName) + ':' + [...m.removedNodes].map(n => n.outerHTML || n.nodeValue).join('|').slice(0, 200) + '+' + [...m.addedNodes].map(n => n.outerHTML || n.nodeValue).join('|').slice(0, 200))); }); mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    window.__dcUser = Date.now(); DocCtl.draw(); await new Promise(r => setTimeout(r, 50)); mo.disconnect();
    const inp = el.querySelector('input:not([type=checkbox]):not([type=file]):not([type=radio])'); let reset = null;
    if (inp) { inp.value = 'zz typed'; inp.blur(); window.__dcUser = Date.now(); DocCtl.draw(); await new Promise(r => setTimeout(r, 50)); reset = el.contains(inp) ? inp.value === inp.defaultValue : true; }
    return { same: first && first.isConnected && el.firstElementChild === first, muts, mw, kids, reset }; });
  check(ip.same && ip.muts === 0 && ip.reset !== false, 'a redraw with nothing new changes nothing on the page, and a field comes back to what the page says ' + JSON.stringify(ip));
  const ow = await p.evaluate(async () => { const seen = []; const mo = new MutationObserver(() => { const o = document.querySelector('.dx-tov'); if (o) seen.push(o.classList.contains('ov-wait')); }); mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.querySelector('[data-dxtool="ren"]').click(); await new Promise(r => setTimeout(r, 300)); mo.disconnect(); const o = document.querySelector('.dx-tov'); return { first: seen[0], now: o && o.classList.contains('ov-wait'), anim: o && getComputedStyle(o.querySelector('.dx-tsheet')).animationName, cls: o && o.className, html: document.documentElement.className, off: document.documentElement.classList.contains('mo-off') || matchMedia('(prefers-reduced-motion: reduce)').matches }; });
  check(ow.first === true && ow.now === false && (ow.off || /sh-in/.test(ow.anim || '')), 'a new popup waits (ov-wait) until drawn, then opens with its animation ' + JSON.stringify(ow));
  /* closing fades out as a copy that can't be touched, then it is gone (JP 2026-11-26 20:55) */
  const gh = await p.evaluate(async () => { window.__ovGhost = true; const dbg = { hidden: document.hidden, n: document.querySelectorAll('.dx-tov').length }; const o = document.querySelector('.dx-tov'); o.remove(); await new Promise(r => setTimeout(r, 30));
    const g = document.querySelector('.dx-tov.ov-ghost'); const a = g && getComputedStyle(g).animationName, pe = g && getComputedStyle(g).pointerEvents; await new Promise(r => setTimeout(r, 300)); window.__ovGhost = false;
    return { had: !!g, a, pe, gone: !document.querySelector('.ov-ghost'), dbg }; });
  check(gh.had && gh.pe === 'none' && /ov-out/.test(gh.a || '') && gh.gone, 'a closed popup fades out as an untouchable copy, then is gone ' + JSON.stringify(gh));
  /* Team: Documentation's popups have their keyframes (they were left out, so they opened with no animation), the type scale, the step buttons */
  const fs = require('fs'), path = require('path'), dcc = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'public', 'dc', 'dc.css'), 'utf8'), tc = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'public', 'app.css'), 'utf8');
  check(['ov-in', 'sh-in', 'view-in', 'ov-out', 'sh-out'].every(n => new RegExp('@keyframes ' + n + '\\b').test(dcc + tc)) && !/@keyframes rise\b/.test(dcc), 'Team has the popup keyframes (and not the card rise)');
  /* Levering: Select several sits in the summary row, and linking a loose file is a small button on its row (JP 2026-11-26 21:37) */
  const pcs = fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', 'doc-control.page.js'), 'utf8');
  check(/!namingOn\(\) && F\.length \? selBtn\('f', p\.id\)/.test(pcs) && !/'<div class="dc-selrow">' \+ selBtn\('f'/.test(pcs) && /icon-btn sm dc-linkb/.test(pcs) && !/text-btn dc-linkb/.test(pcs), 'Select several in the Levering row; Link to a line is a row button');
  check(!/font-size:\s*(11|11\.5|12\.5|13\.5|14\.5)px/.test(dcc + tc), 'Team uses one type scale (no 12.5 / 13.5 / 14.5 px)');
  check(/html\.t-modal, html\.dcn-modal \{ overflow: hidden/.test(tc), 'the page doesn\'t scroll behind a Documentation popup in Team');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
