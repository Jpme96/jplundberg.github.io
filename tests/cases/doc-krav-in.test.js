/* Requirements inside the project (JP 2026-11-24 16:57–16:59 "To get out of krav I need to press mottak"): step 1 Krav makes and changes
   the requirements right there, under the project's five steps; Lag listen / Avbryt / Ferdig come back to Krav. Without requirements: two
   choices – Lag krav or Fortsett uten krav. A project's requirements opened from elsewhere land in its Krav step. Requirements without a
   project keep their own page, with "Start prosjektet". Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { Features.set('fdv', true); const t = Features.tools();
    t.dckrav = [{ id: 'kalone', name: 'Made-up requirements alone', lines: [{ id: 'qa', code: '365', t: 'E' }] }];
    t.dctl = [{ id: 'pk1', name: 'Made-up without requirements', lines: [], files: [] }, { id: 'pk2', name: 'Made-up second', lines: [], files: [] }]; Features.saveTools(t); });
  await go(p, 'work/#dc=pk1', 2500);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="krav"]').click()); await sl(300);
  const k0 = await p.evaluate(() => ({ make: !!document.querySelector('.dc-nokrav [data-dckin]'), skip: (document.querySelector('.dc-nokrav [data-dctab]') || {}).textContent || '', line: (document.querySelector('.dc-nokrav .dc-help') || {}).textContent || '' }));
  check(k0.make && /Go on without requirements/.test(k0.skip) && /checked against the document plan/.test(k0.line), 'no requirements: two choices – Make requirements / Go on without, and what it is checked against ' + JSON.stringify(k0));
  /* Make requirements: the picker inside the project, the five steps on top, no old three-step bar */
  await p.evaluate(() => document.querySelector('.dc-nokrav [data-dckin]').click()); await sl(500);
  const k1 = await p.evaluate(() => ({ five: [...document.querySelectorAll('.dc-fsteps [data-dctab]')].map(b => b.dataset.dctab).join(), old: !!document.querySelector('.dx-steps'), picker: !!document.querySelector('[data-dcmake="req"]'), hash: location.hash, krav: Features.list('dctl').filter(x => x.id === 'pk1')[0].krav || '' }));
  check(k1.five === 'krav,plan,lev,cmp,end' && !k1.old && k1.picker && k1.hash === '#dc=pk1' && !!k1.krav, 'Make requirements opens the picker inside the project, under the five steps ' + JSON.stringify(k1));
  /* tick a project type, Make the list: back in Krav with the list, and the project has the lines */
  await p.evaluate(() => { const c = document.querySelector('[data-dcptype]'); c.click(); }); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dcmake="req"]').click());
  for (let i = 0; i < 30 && !(await p.evaluate(() => document.querySelectorAll('.dc-flow .dc-flist2 li').length)); i++) await sl(200);   /* a long list takes a moment on a busy machine */
  const k2 = await p.evaluate(() => { const pr = Features.list('dctl').filter(x => x.id === 'pk1')[0], r = Features.list('dckrav').filter(x => x.id === pr.krav)[0];
    return { rows: document.querySelectorAll('.dc-flow .dc-flist2 li').length, picker: !!document.querySelector('[data-dcmake="req"]'), edit: !!document.querySelector('[data-dckin]'), kl: (r.lines || []).length, pl: (pr.lines || []).length, tab: (document.querySelector('.dc-fsteps [aria-selected="true"]') || {}).dataset.dctab }; });
  check(k2.rows > 0 && !k2.picker && k2.edit && k2.kl > 0 && k2.pl === k2.kl && k2.tab === 'krav', 'Make the list: back in Krav with the list; the project gets the lines ' + JSON.stringify(k2));
  /* Change the requirements: the list with Done inside the project; Done comes back */
  await p.evaluate(() => document.querySelector('[data-dckin]').click()); await sl(400);
  const k3 = await p.evaluate(() => ({ done: !!document.querySelector('.dr-inside [data-dckinx]'), start: !!document.querySelector('[data-drstart]'), five: !!document.querySelector('.dc-fsteps') }));
  await p.evaluate(() => document.querySelector('[data-dckinx]').click()); await sl(400);
  const k3b = await p.evaluate(() => ({ inside: !!document.querySelector('.dr-inside'), edit: !!document.querySelector('[data-dckin]') }));
  check(k3.done && !k3.start && k3.five && !k3b.inside && k3b.edit, 'Change the requirements: the list inside the project with Done (no Start button); Done comes back ' + JSON.stringify([k3, k3b]));
  /* Cancel on a project without requirements: back to the two choices */
  await go(p, 'work/#dc=pk2', 2000);
  await p.evaluate(() => document.querySelector('.dc-fsteps [data-dctab="krav"]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('.dc-nokrav [data-dckin]').click()); await sl(400);
  await p.evaluate(() => document.querySelector('[data-dccancel]').click()); await sl(400);
  const k4 = await p.evaluate(() => ({ hash: location.hash, choices: !!document.querySelector('.dc-nokrav [data-dckin]'), picker: !!document.querySelector('[data-dcmake="req"]'), krav: Features.list('dctl').filter(x => x.id === 'pk2')[0].krav || '', lists: Features.list('dckrav').length }));
  check(k4.hash === '#dc=pk2' && k4.choices && !k4.picker && !k4.krav && k4.lists === 2, 'Cancel comes back to Krav in the project, and leaves no empty list behind ' + JSON.stringify(k4));
  /* Go on without requirements: the next step */
  await p.evaluate(() => document.querySelector('.dc-nokrav [data-dctab]').click()); await sl(300);
  check(await p.evaluate(() => /plan|lev/.test((document.querySelector('.dc-fsteps [aria-selected="true"]') || {}).dataset.dctab || '')), 'Go on without requirements goes to the next step');
  /* a project's requirements opened by their own address land in the project's Krav step */
  const kid = await p.evaluate(() => Features.list('dctl').filter(x => x.id === 'pk1')[0].krav);
  await go(p, 'work/#dr=' + kid, 2000);
  const k5 = await p.evaluate(() => ({ hash: location.hash, tab: (document.querySelector('.dc-fsteps [aria-selected="true"]') || {}).dataset.dctab, old: !!document.querySelector('.dx-steps') }));
  check(k5.hash === '#dc=pk1' && k5.tab === 'krav' && !k5.old, 'the requirements of a project open in its Krav step ' + JSON.stringify(k5));
  /* requirements without a project: their own page, step 2 "Project · Start the project" and a Start the project button */
  await go(p, 'work/#dr=kalone', 2000);
  const k6 = await p.evaluate(() => ({ step: [...document.querySelectorAll('.dx-steps .dx-step')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).join(' | '), btn: (document.querySelector('[data-drstart]') || {}).textContent || '' }));
  check(/Project Start the project/.test(k6.step) && !/Received/.test(k6.step) && /Start the project/.test(k6.btn), 'requirements without a project: “Start the project”, no “Received” ' + JSON.stringify(k6));
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
