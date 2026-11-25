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
  const ph = await p.evaluate(async () => (await (await fetch('/cmd/papers.page.js')).text()).match(/ph: '[^']*the seller[^']*'/) + '');
  check(/seller/.test(ph) && !/Iago/.test(ph), 'Papers asks who it is with without naming anyone ' + JSON.stringify(ph));
  /* a plan read before "Rømningsplan" was a known type word: read again, no "Unknown document type" */
  await p.evaluate(() => { const t = Features.tools(); t.dctl = [{ id: 'rvp1', name: 'Made-up review', planName: 'Made-up plan.xlsx', planFile: true, files: [], lines: [{ id: 'rl1', code: '172', type: 'Rømningsplan', t: '', planned: '172 Rømningsplan madeup', st: 'missing', files: [] }] }]; Features.set('fdv', true); Features.saveTools(t); });
  await go(p, 'work/#dc=rvp1', 2500);
  await p.evaluate(() => { try { PageTabs.show('doc'); } catch (e) {} }); await sl(400);
  await p.evaluate(() => { const s = document.querySelector('.dc-fsteps [data-dctab="plan"]'); if (s) s.click(); }); await sl(500);
  const unk = await p.evaluate(() => { const f = document.querySelector('.dc-flow'); return f ? /Unknown document type/.test(f.innerText) : null; });
  check(unk === false, 'an old plan line with the type word "Rømningsplan" is read as a drawing now');
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
