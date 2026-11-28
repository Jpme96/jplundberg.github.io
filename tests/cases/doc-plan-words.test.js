/* Live check 2026-11-28 (JP "check live again for improvements"): a project without requirements whose list was made from what was
   delivered says so (not "From the requirements"), a line without a type has no lone "– Air handling", and two projects with one
   name are told apart by the day they were made. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => {
    const t = Features.tools(), mk = (id, made) => ({ id, name: 'Madeup site', made, lines: [{ id: id + 'l1', code: '360', st: 'recv' }, { id: id + 'l2', code: '362', st: 'missing' }], files: [{ id: id + 'f1', name: '360 Madeup damper.pdf', line: id + 'l1', p: { code: '360' } }] });
    t.dckrav = []; t.dctl = [mk('pmadeupa', '2026-11-20T10:00:00.000Z'), mk('pmadeupb', '2026-11-27T10:00:00.000Z'), Object.assign(mk('pmadeupc', '2026-11-27T14:30:00.000Z'), {})]; Features.saveTools(t);
  });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(400);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl .dx-row .dx-part')].map(x => x.textContent));
  check(rows.length === 3 && new Set(rows).size === 3 && rows.filter(x => /20\.11\.2026\)$/.test(x)).length === 1 && rows.filter(x => /27\.11\.2026 \d\d:\d\d\)/.test(x)).length === 2, 'projects with one name show the day each was made, with the time when it is the same day ' + JSON.stringify(rows));
  await p.evaluate(() => document.querySelector('[data-dcopen="pmadeupa"]').click()); await sl(600);
  const st = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl [data-dctab]')].map(x => x.dataset.dctab + ':' + x.textContent.replace(/\s+/g, ' ').trim()));
  check(st.some(x => /^plan:.*Made from the delivery/.test(x)) && !st.some(x => /From the requirements/.test(x)), 'no requirements: the plan step says it was made from the delivery ' + JSON.stringify(st));
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dctab="plan"]').click()); await sl(500);
  const pl = await p.evaluate(() => document.querySelector('#wkDocCtl').textContent.replace(/\s+/g, ' '));
  check(/made from what was delivered \(2 lines\)/.test(pl) && !/made from the requirements/.test(pl), 'the plan step explains where the list came from ' + pl.slice(0, 300));
  await p.evaluate(() => document.querySelector('#wkDocCtl [data-dctab="cmp"]').click()); await sl(500);
  const heads = await p.evaluate(() => [...document.querySelectorAll('#wkDocCtl .dc-flist2 li b, #wkDocCtl .dc-frow b')].map(x => x.textContent.trim()).filter(Boolean));
  check(heads.length && !heads.some(x => /^–/.test(x)), 'line titles without a type have no lone dash ' + JSON.stringify(heads));
  const app = require('fs').readFileSync(require('path').join(__dirname, '../../_team/public/app.js'), 'utf8');
  check(/nmN\[String\(p\.name[^\]]*\] > 1 && p\.made \? L\('made ', 'laget '\)/.test(app), 'Team\'s overview cards also show the day for two projects with one name');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error('error', e); process.exit(1); });
