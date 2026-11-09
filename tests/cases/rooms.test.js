/* Rooms for chores: the owner adds rooms and puts a chore in one; Iago sees the rooms, filters by room and adds a
   chore in a room; the owner gets it. By room / one room in cmd. */
const { shared, until, sl, U, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { Features.set('house', true); Features.set('chores', true); const t = Features.tools(); t.chores = [{ id: 'c1', name: 'Clean the toilet', every: '1w', day: 0, who: 'rotate', start: Features.dkey(new Date()) }, { id: 'c2', name: 'Hoover', every: '1w', day: 1, who: 'rotate', start: Features.dkey(new Date()) }]; Features.saveTools(t);
    const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { chores: true }); Vault.save(d); });
  await go(p, 'house/', 3500);
  await p.evaluate(() => document.querySelector('[data-chrooms]').click()); await sl(400);
  await p.evaluate(() => document.querySelector('[data-chrseed]').click()); await sl(800);
  const rooms = await p.evaluate(() => Features.list('rooms').map(r => r.name + ':' + r.icon));
  check(rooms.length === 7, 'the usual rooms are added: ' + rooms.join(', '));
  /* put the toilet chore in the bathroom */
  await p.evaluate(() => { const t = Features.tools(), bad = t.rooms.find(r => /Bath/.test(r.name)); t.chores[0].room = bad.id; Features.saveTools(t); });
  await sl(800);
  const chips = await p.evaluate(() => [...document.querySelectorAll('[data-chroom]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  check(chips.length === 8, 'room chips in cmd: ' + chips.join(' | '));
  await p.evaluate(() => document.querySelector('[data-chroom]:not([data-chroom=""])') && [...document.querySelectorAll('[data-chroom]')].find(x => /Bathroom/.test(x.innerText)).click()); await sl(500);
  const only = await p.evaluate(() => [...document.querySelectorAll('[data-tool="hchores"] .kit-row, [data-tool="hchores"] li[data-id]')].map(x => x.innerText.split('\n')[0]));
  check(only.length === 1 && /toilet/.test(only[0]), 'one room at a time shows only its chores: ' + only.join(' | '));
  await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  /* Iago */
  await q.evaluate(() => document.querySelector('[data-tab="chores"]').click());
  const seen = await until(q, () => document.querySelectorAll('[data-hroom]').length === 8, 15000);
  check(seen !== null, 'Iago sees the 7 rooms (+ All rooms)');
  check(await q.evaluate(() => /Bathroom/.test([...document.querySelectorAll('.h-list li')].map(x => x.innerText).join(' '))), 'Iago sees the room on the chore');
  await q.evaluate(() => [...document.querySelectorAll('[data-hroom]')].find(x => /Bathroom/.test(x.innerText)).click()); await sl(400);
  check(await q.evaluate(() => document.querySelectorAll('[data-chore]').length) === 1, 'Iago’s room filter shows one chore');
  await q.evaluate(() => document.querySelector('[data-choreadd]').click()); await sl(500);
  await q.evaluate(() => { const f = document.querySelector('.h-sheet form, form.h-sheet, .h-sheetbg form'); f.name.value = 'Wash the shower glass'; f.requestSubmit ? f.requestSubmit() : f.submit(); }); await sl(500);
  const got = await until(p, () => (Features.tools().chores || []).some(c => c.name === 'Wash the shower glass' && c.room && (Features.tools().rooms || []).find(r => r.id === c.room && /Bath/.test(r.name))), 15000);
  check(got !== null, 'Iago’s new chore arrives in cmd in the Bathroom (picked by the open room filter)');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
