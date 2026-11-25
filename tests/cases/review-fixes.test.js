/* Fixes from the hands-on review (JP 2026-11-25 19:34 "you can start"): the bell keeps its count on it, a task picked for
   today's top 3 is not called tomorrow's, Papers names no partner, a plan read before a type word was known is read again,
   and Finances' late redraw stops once you have left the page. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  /* the bell's red count sits on the bell (it flew to the screen's corner on a phone) */
  const bell = await p.evaluate(() => { const btn = document.getElementById('ntBtn'); if (!btn) return null; let bd = btn.querySelector('.nt-badge'); if (!bd) { btn.insertAdjacentHTML('beforeend', '<span class="nt-badge">1</span>'); bd = btn.querySelector('.nt-badge'); } bd.hidden = false; bd.textContent = '1'; return { pos: getComputedStyle(btn).position, parent: bd.offsetParent === btn || !btn.offsetParent }; });
  check(bell && bell.pos === 'relative' && bell.parent, 'the notification count sits on the bell ' + JSON.stringify(bell));
  /* evening: a task picked for today's top 3 is still today's */
  const ev = await p.evaluate(async () => {
    const now = new Date(), tk = new Date(now); tk.setDate(tk.getDate() + 1); const k = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem('dash.todos', JSON.stringify([{ id: 'tmadeup1', text: 'Ring madeup', today: true, done: false }]));
    const RealDate = Date; const fake = new RealDate(now); fake.setHours(19, 0, 0, 0);
    window.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fake.getTime()])); } static now() { return fake.getTime(); } };
    window.dispatchEvent(new Event('tools:change')); window.dispatchEvent(new Event('storage'));
    await new Promise(r => setTimeout(r, 1500));
    const t = (document.getElementById('dlLine') || {}).textContent || ''; window.Date = RealDate; return t;
  });
  check(!/Tomorrow – Ring madeup/.test(ev), 'the evening line never calls a task picked for today "tomorrow" ' + JSON.stringify(ev));
  /* Papers: the "With" example names no partner */
  const ph = await p.evaluate(async () => (t => /Iago/.test(t) ? 'Iago' : (t.match(/'[^']*the seller, the bank[^']*'/) + ''))(await (await fetch('/cmd/papers.page.js')).text()));
  check(/seller/.test(ph) && !/Iago/.test(ph), 'Papers asks who it is with without naming anyone ' + JSON.stringify(ph));
  /* a plan read before "Rømningsplan" was a known type word: read again, no "Unknown document type" */
  await p.evaluate(() => { const t = Features.tools(); t.dctl = [{ id: 'rvp1', name: 'Made-up review', planName: 'Made-up plan.xlsx', planFile: true, files: [], lines: [{ id: 'rl1', code: '172', type: 'Rømningsplan', t: '', planned: '172 Rømningsplan madeup', st: 'missing', files: [] }] }]; Features.set('fdv', true); Features.saveTools(t); });
  await go(p, 'work/#dc=rvp1', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(400);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  const unk = await p.evaluate(() => { const f = document.querySelector('.dc-flow'); return f ? /Unknown document type/.test(f.innerText) : null; });
  check(unk === false, 'an old plan line with the type word "Rømningsplan" is read as a drawing now');
  /* requirements but no contractor plan: you can still add a line, and the plan check folds many gaps per group (review 11–13) */
  await p.evaluate(() => { const t = Features.tools(); const codes = ['221', '232', '311', '320', '330', '360', '411', '433', '442', '521', '562', '631'];
    t.dckrav = [{ id: 'kq', name: 'Made-up req only', lines: codes.map((c, i) => ({ id: 'q' + i, code: c, t: 'A' })) }, { id: 'kp', name: 'Made-up many gaps', lines: codes.map((c, i) => ({ id: 'g' + i, code: c, t: 'A' })) }];
    t.dctl = [{ id: 'kq1', name: 'Made-up req only', krav: 'kq', lines: codes.map((c, i) => ({ id: 'l' + i, code: c, t: 'A', type: '', planned: '', st: 'missing', files: [] })), files: [] },
      { id: 'kp1', name: 'Made-up many gaps', krav: 'kp', planName: 'Made-up plan.xlsx', planFile: true, lines: [{ id: 'pl1', code: '221', t: 'A', type: 'Brukerveiledning', planned: '221 Brukerveiledning madeup', st: 'missing', files: [] }], files: [] }];
    Features.saveTools(t); });
  await go(p, 'work/#dc=kq1', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(300);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  check(await p.evaluate(() => !!document.querySelector('.dc-flow [data-dcaddo]')), 'a project with requirements but no contractor plan can get a line of its own');
  await go(p, 'work/#dc=kp1', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(300);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  const gp = await p.evaluate(() => ({ folds: document.querySelectorAll('.dc-flow details[data-dcg^="gp:"]').length, open: document.querySelectorAll('.dc-flow details[data-dcg^="gp:"][open]').length, h: Math.round((document.querySelector('.dc-flow') || { scrollHeight: 0 }).scrollHeight) }));
  check(gp.folds >= 3 && !gp.open, 'many gaps fold per NS group, closed ' + JSON.stringify(gp));
  /* the same code and type twice: asked first */
  await p.evaluate(() => { const b = document.querySelector('.dc-flow [data-dcaddo]'); if (b) b.click(); }); await sl(300);
  const n0 = await p.evaluate(() => Features.tools().dctl.find(x => x.id === 'kp1').lines.length);
  await p.evaluate(() => { const c = document.querySelector('[data-dcalc]'), t = document.querySelector('[data-dcalt]'); c.value = '221'; t.value = 'A'; document.querySelector('button[data-dcaddl]').click(); }); await sl(400);
  const d1 = await p.evaluate(() => ({ n: Features.tools().dctl.find(x => x.id === 'kp1').lines.length, msg: (document.querySelector('.dc-addle') || {}).textContent || '' }));
  check(d1.n === n0 && /already has 221/.test(d1.msg), 'adding 221 again asks first ' + JSON.stringify(d1));
  await p.evaluate(() => document.querySelector('button[data-dcaddl]').click()); await sl(400);
  check(await p.evaluate(() => Features.tools().dctl.find(x => x.id === 'kp1').lines.length) === n0 + 1, 'the second tap adds it anyway');
  /* a repeating event found in search opens on its next time (review 16) */
  const nx = await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('dash.calendar') || '{}'); c.events = (c.events || []).concat([{ id: 'evmadeup', title: 'Madeup weekly swim', date: '2025-01-06', start: '18:00', dur: 3600000, repeat: 'weekly' }]); localStorage.setItem('dash.calendar', JSON.stringify(c));
    const r = (window.SearchIndex() || []).find(x => x.t === 'Madeup weekly swim'); const t = new Date(); t.setHours(0, 0, 0, 0); const d = r && (r.h.match(/#d=(\d{4}-\d{2}-\d{2})/) || [])[1]; return { h: r && r.h, ok: !!d && new Date(d + 'T12:00') >= t }; });
  check(nx.ok, 'a repeating event found in search opens on its next day ' + JSON.stringify(nx));
  /* the need card: an arrow, the type said once, code order (review 21) */
  await go(p, 'work/#dc=kq1', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(300);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  const nc = await p.evaluate(() => { const d = document.querySelector('.dc-flow details.dc-need'); if (!d) return null; d.open = true; const arrow = getComputedStyle(d.querySelector('summary'), '::after').content; const rows = [...d.querySelectorAll('li')].map(li => ({ c: li.querySelector('.dc-code').textContent, b: li.querySelector('.dc-lx b').textContent, s: (li.querySelector('.dc-lx small') || {}).textContent || '' })); return { arrow, rows: rows.slice(0, 40) }; });
  if (nc) { check(nc.arrow && nc.arrow !== 'none', 'the need card shows it opens');
    check(nc.rows.every(r => !r.s || r.b.indexOf(r.s) < 0), 'the type is not repeated in the title ' + JSON.stringify(nc.rows.slice(0, 3)));
    check(nc.rows.every((r, i, a) => !i || a[i - 1].c <= r.c), 'the suggestions are in code order'); }
  /* phone: the avatar pen is off the bubble, Calendar has its title (review 30, 33) */
  await go(p, '', 2500);
  const pen = await p.evaluate(() => { const x = document.querySelector('#avHome .av-edit'), y = document.querySelector('#avHome .av-say'); if (!x || !y) return 'none'; const r = x.getBoundingClientRect(), q = y.getBoundingClientRect(); return r.right <= q.left || q.right <= r.left || r.bottom <= q.top || q.bottom <= r.top; });
  check(pen === true || pen === 'none', 'the avatar pen does not cover the speech bubble ' + pen);
  await go(p, 'calendar/', 2000);
  check(await p.evaluate(() => { const h = document.querySelector('.cl-hero h1'); return !!h && getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 0; }), 'Calendar shows its page title on a phone');
  /* live review 2026-11-25: the final check names each line and folds per group, a missing code says what the name starts with, #dc=…&l=… opens on the line, one suggestion row per code */
  await p.evaluate(() => { const t = Features.tools(); const L = [];
    ['163', '164', '171', '172', '217', '230', '232', '234', '360', '442'].forEach((c, i) => L.push({ id: 'fx' + i, code: c, t: 'A', type: 'Tegning', planned: c + ' DA Madeup line ' + i, st: 'missing', files: [] }));
    L.push({ id: 'fxn', code: '171', t: 'A', type: 'Tegning', planned: 'Eksempel: 171 RA Madeup brann', st: 'missing', files: [] });
    t.dctl = (t.dctl || []).filter(x => x.id !== 'fx1p').concat([{ id: 'fx1p', name: 'Made-up final', planName: 'Made-up plan.xlsx', planFile: true, lines: L, files: [] }]); Features.saveTools(t); });
  await go(p, 'work/#dc=fx1p', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(300);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="end"]'); if (s) s.click(); }); await sl(500);
  const fx = await p.evaluate(async () => { const d = [...document.querySelectorAll('.dc-flow details[data-dcg^="fx:"]')]; if (!d.length) return { n: 0 }; d[0].open = true; d[0].dispatchEvent(new Event('toggle')); await new Promise(r => setTimeout(r, 500)); const f = document.querySelector('.dc-flow details[data-dcg^="fx:"][open]'); return { n: document.querySelectorAll('.dc-flow details[data-dcg^="fx:"]').length, sub: f ? [...f.querySelectorAll('.dc-lx small')].map(x => x.textContent).join('|') : '' }; });
  check(fx.n >= 2 && /Madeup line/.test(fx.sub), 'the final check folds per NS group and each row names its line ' + JSON.stringify(fx));
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  check(await p.evaluate(() => /Starts with “Eksempel:” – the NS 3451 code \(171\) must come first/.test(document.querySelector('.dc-flow').innerText)), 'a name with the code further in says what it starts with');
  await go(p, 'work/#dc=fx1p&l=fx4', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(500);
  check(await p.evaluate(() => !!document.querySelector('.dc-frow2.open [data-dcline="fx4"]')), 'a link to a line opens the project on that line');
  /* Livsadmin: a yearly reminder saved in English shows in Norwegian when Norwegian is chosen */
  await p.evaluate(() => { const t = Features.tools(); t.ladmin = [{ id: 'lam1', name: 'Check that BankID works on a new phone or card', md: '01-15', lead: 14, notes: '', doneY: 0 }]; Features.set('ladmin', true); Features.saveTools(t); const st = JSON.parse(localStorage.getItem('dash.settings') || '{}'); st.lang = 'nb'; localStorage.setItem('dash.settings', JSON.stringify(st)); });
  await go(p, 'lifeadmin/', 2500);
  const la = await p.evaluate(() => document.body.innerText);
  check(/Sjekk at BankID virker/.test(la) && !/Check that BankID works/.test(la), 'a saved English yearly reminder is shown in Norwegian');
  const hb = await (async () => { await go(p, 'habits/', 2000); return p.evaluate(() => [...document.querySelectorAll('.hp-card small, .hp-stat small')].map(x => x.textContent).join('|')); })();
  check(!/\bweeks?\b/.test(hb), 'Habits says uke/uker in Norwegian ' + hb.slice(0, 120));
  await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('dash.settings') || '{}'); st.lang = 'en'; localStorage.setItem('dash.settings', JSON.stringify(st)); });
  /* Finances' late redraw after leaving (its worker answered on People/House): no error */
  await go(p, 'finance/', 1500);
  await p.evaluate(() => { const a = document.querySelector('a[href="/cmd/people/"]'); if (a) a.click(); }); await sl(2500);
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
  /* tapping the avatar bubble fast many times stays quick (old Firefox froze here) */
  await go(p, '', 2000);
  const taps = await p.evaluate(async () => { const f = document.querySelector('#avHome [data-avnext]'); if (!f) return -1; const t0 = performance.now(); for (let i = 0; i < 30; i++) f.click(); return performance.now() - t0; });
  check(taps < 1500, 'thirty quick taps on the avatar take under 1.5 s (' + Math.round(taps) + ' ms)');
  check(!p.errs.length, 'still no page errors ' + p.errs.join(' | '));
  await b.close(); done();
})();
