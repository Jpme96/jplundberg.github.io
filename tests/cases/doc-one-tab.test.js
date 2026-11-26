/* One Documentation tab (JP 2026-11-16 15:19): Requirements and Control are one Work tab with one project list; a project goes
   Requirements → Received → Report, the plan check sits on top, "‹ Documentation" goes back to the list, and a tab switched off
   before stays off only if both were off (upgrade step 6). Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { localStorage.setItem('dash.dcOldView', '1');   /* these test the old project view */ const t = Features.tools(); t.dckrav = []; t.dctl = []; delete t.dcTeamAt; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  const tabs = await p.evaluate(() => PageTabs.list('work').map(t => t.id).join());
  check(/doc/.test(tabs) && !/req/.test(tabs), 'Work has one Documentation tab, no separate Requirements tab ' + tabs);
  await p.evaluate(() => PageTabs.show('req')); await sl(300);
  const h0 = await p.evaluate(() => ({ cur: PageTabs.current(), tool: !!document.querySelector('#wkDocCtl .dx-tools [data-dxtool="plan"]'), reqGone: document.getElementById('wkDocReq').classList.contains('dc-gone'), title: document.querySelector('#wkDocCtl .card-head h2').textContent.trim() }));
  check(h0.cur === 'doc' && h0.tool && h0.reqGone && /Documentation/.test(h0.title), 'the old Requirements tab opens Documentation: the plan check on top, one list ' + JSON.stringify(h0));
  /* a project: Requirements first */
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-drnew]').click()); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-drform]'); f.name.value = 'Made-up block B'; f.requestSubmit(); }); await sl(800);
  await p.evaluate(() => { const c = document.querySelector('#wkDocReq [data-dctick]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(200);
  await p.evaluate(() => document.querySelector('#wkDocReq [data-dcmake="req"]').click()); await sl(1200);
  const s1 = await p.evaluate(() => ({ steps: [...document.querySelectorAll('#wkDocReq .dx-step')].map(s => (s.getAttribute('aria-current') ? '*' : '') + (s.disabled ? '-' : '') + s.querySelector('b').textContent.trim()).join('|'), ctlGone: document.getElementById('wkDocCtl').classList.contains('dc-gone'), back: (document.querySelector('#wkDocReq [data-drback]') || {}).textContent }));
  check(/^\*1Requirements\|2Project\|-3Report$/.test(s1.steps) && s1.ctlGone && /Documentation/.test(s1.back), 'requirements without a project open on step 1; “Project” (start it) is next – not “Received” (JP 2026-11-24) – Report waits ' + JSON.stringify(s1));
  /* back to the list: one row with its status */
  await p.evaluate(() => document.querySelector('#wkDocReq [data-drback]').click()); await sl(500);
  const l1 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#wkDocCtl .dx-list .kit-main')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), full: document.body.classList.contains('dr-full'), hash: location.hash }));
  check(l1.rows.length === 1 && /Made-up block B/.test(l1.rows[0]) && /Requirements · \d+ documents?/.test(l1.rows[0]) && !l1.full && !l1.hash, '‹ Documentation goes to the list, the project shows "Requirements · n documents" ' + JSON.stringify(l1));
  /* step 2: Received makes the control project from the list, linked */
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dropen]').click()); await sl(500);
  await p.evaluate(() => document.querySelector('#wkDocReq .dx-step[data-drstart]').click()); await sl(800);
  const s2 = await p.evaluate(() => { const c = Features.list('dctl'), k = Features.list('dckrav'); return { n: c.length, linked: c[0] && c[0].krav === k[0].id, lines: c[0] && c[0].lines.length === k[0].lines.length, cur: (document.querySelector('#wkDocCtl .dx-step[aria-current]') || {}).textContent, sub: !!document.querySelector('#wkDocCtl .fdv-tabs [data-dctab="docs"]'), noReport: !document.querySelector('[data-dctab="report"]') }; });
  check(s2.n === 1 && s2.linked && s2.lines && /Received/.test(s2.cur) && s2.sub && s2.noReport, 'step 2 Received starts the control project from the requirements (linked) with Overview / Documents / Files ' + JSON.stringify(s2));
  /* step 3 and back to step 1 */
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dxrap]').click()); await sl(500);
  const s3 = await p.evaluate(() => ({ cur: (document.querySelector('#wkDocCtl .dx-step[aria-current]') || {}).textContent, rep: !!document.querySelector('#wkDocCtl .rp-doc'), tabs: !!document.querySelector('#wkDocCtl .fdv-tabs') }));
  check(/Report/.test(s3.cur) && s3.rep && !s3.tabs, 'step 3 Report shows the report ' + JSON.stringify(s3));
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dxkrav]').click()); await sl(500);
  const s4 = await p.evaluate(() => ({ dr: document.body.classList.contains('dr-full'), dc: document.body.classList.contains('dc-full'), hash: location.hash, cur: (document.querySelector('#wkDocReq .dx-step[aria-current]') || {}).textContent, done: document.querySelectorAll('#wkDocReq .dx-step.done').length }));
  check(s4.dr && !s4.dc && /^#dr=/.test(s4.hash) && /Requirements/.test(s4.cur) && s4.done >= 1, 'step 1 from the control project goes back to its requirements, still editable ' + JSON.stringify(s4));
  await p.evaluate(() => document.querySelector('#wkDocReq [data-drstart]').click()); await sl(700);
  check((await p.evaluate(() => Features.list('dctl').length)) === 1, 'Received again opens the same control project, not a second one');
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dcback]').click()); await sl(500);
  const l2 = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl .dx-list .kit-main')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  check(l2.length === 1 && /0 of \d+ delivered · 0 approved/.test(l2[0]), 'one project in the list, now "0 of n delivered · 0 approved" (2026-11-26) – the requirements and the control project are one row ' + JSON.stringify(l2));
  /* a project straight from a plan */
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-drnew]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('#wkDocCtl form[data-drform] [data-dcnew]').click()); await sl(300);
  check(await p.evaluate(() => !!document.querySelector('#wkDocCtl form[data-dcpform]') && !document.querySelector('form[data-drform]')), '"Start at Received" opens the project form for a plan you already have');
  await p.evaluate(() => document.querySelector('[data-dccancel]').click()); await sl(300);
  /* upgrade step 6: switched-off tabs */
  const up = await p.evaluate(() => { const one = off => { const d = { dv: 5 }, mem = { 'dash.settings': { theme: 'light', tabOff: { work: off, house: ['energy'] } } }; Upgrades.run(d, { get: k => mem[k] ? JSON.parse(JSON.stringify(mem[k])) : null, set: (k, v) => { mem[k] = v; } }); return mem['dash.settings'].tabOff; };
    return { ctlOff: one(['doc', 'notes']), reqOff: one(['req']), both: one(['req', 'doc']), house: one(['req']).house }; });
  check(up.ctlOff.work.join() === 'notes' && up.reqOff.work.join() === '' && up.both.work.join() === 'doc' && up.house.join() === 'energy', 'upgrade step 6: Documentation stays on if one of the two old tabs was on, off if both were off ' + JSON.stringify(up));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
