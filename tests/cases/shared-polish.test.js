/* Iago's app from the walkthrough (2026-11-10):
   - a chore one day late says "1 day late", not "1 days late"
   - "Who did what" counts things done, not setting chores up (it said "you 0 · Lundberg 6" after creating three chores)
   - "Make your avatar" is on Today only and can be put away for good
   - the room chips wrap, so no room runs off the edge
   - the chat header shows only the other person, in both apps
   Made-up data only. */
const { shared, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared(393);
  await p.evaluate(() => {
    ['chores', 'shop', 'house'].forEach(f => Features.set(f, true));
    const dk = n => { const d = new Date(); d.setDate(d.getDate() + n); return Features.dkey(d); };
    const yday = ((new Date().getDay() + 6) % 7 + 6) % 7;      /* yesterday, 0 = Monday */
    const t = Features.tools();
    t.rooms = [{ id: 'rK', name: 'Kitchen', icon: 'tv', size: '' }, { id: 'rB', name: 'Bathroom', icon: 'droplet', size: '' }, { id: 'rL', name: 'Living room', icon: 'house', size: '' }, { id: 'rH', name: 'Hallway', icon: 'door-open', size: '' }, { id: 'rO', name: 'Home office', icon: 'laptop', size: '' }];
    t.chores = [{ id: 'cA', name: 'Clean the bathroom', every: '1w', day: yday, who: 'p', start: dk(-8), room: 'rB' }, { id: 'cB', name: 'Hoover', every: '1w', day: (yday + 2) % 7, who: 'o', start: dk(-7), room: 'rL' }, { id: 'cC', name: 'Wipe the fridge', every: '2w', day: (yday + 3) % 7, who: 'p', start: dk(-3), room: 'rK' }];
    t.shop = [{ id: 'sM', text: 'Milk', done: false }];
    Features.saveTools(t); window.dispatchEvent(new Event('dash:local'));
  });
  await sl(1500); await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  const tab = async t => { await q.evaluate(t => { const x = document.querySelector('[data-tab="' + t + '"]'); x && x.click(); }, t); await sl(900); };
  await q.evaluate(() => location.reload()); await sl(4000);

  /* the avatar nudge: Today only, and it can be put away */
  await tab('today');
  check(await q.evaluate(() => !!document.querySelector('.h-nudge[data-avatar]')), 'Today asks once: "Make your avatar"');
  await tab('chores');
  check(await q.evaluate(() => !document.querySelector('.h-nudge[data-avatar]')), 'the other tabs don\'t repeat it');
  const txt = await q.evaluate(() => document.querySelector('.h-body').innerText);
  check(/1 day late/.test(txt) && !/1 days late/.test(txt), 'a chore one day late says "1 day late": ' + JSON.stringify((txt.match(/\d+ days? late/g) || [])));
  const who = await q.evaluate(() => { const m = document.querySelector('.h-body').innerText.match(/Last 2 weeks:[^\n]*/); return m ? m[0] : ''; });
  check(/you 0/.test(who) && !/Lundberg [2-9]/.test(who), '"Who did what" doesn\'t count setting chores up: ' + JSON.stringify(who));
  check(!/changed the chore/.test(txt), 'no "changed the chore" for chores that were only set up');
  const off = await q.evaluate(() => [...document.querySelectorAll('.h-rooms .h-room')].filter(x => x.offsetParent && x.getBoundingClientRect().right > innerWidth + 1).map(x => x.textContent.trim()));
  check(!off.length && await q.evaluate(() => document.querySelectorAll('.h-rooms .h-room').length) >= 6, 'every room chip is on screen (they wrap) ' + JSON.stringify(off));
  await tab('today');
  await q.evaluate(() => document.querySelector('[data-avnx]').click()); await sl(700);
  check(await q.evaluate(() => !document.querySelector('.h-nudge[data-avatar]')), 'the × puts it away');
  await q.evaluate(() => location.reload()); await sl(4000); await tab('today');
  check(await q.evaluate(() => !document.querySelector('.h-nudge[data-avatar]')), '… and it stays away');
  check(await q.evaluate(() => /avatar/i.test(document.body.innerHTML)), 'making an avatar is still possible from Settings');

  /* the chat header: only the other person */
  for (const [pg, who2] of [[q, 'Iago\'s app'], [p, 'the dashboard']]) {
    await pg.evaluate(() => { const x = document.querySelector('.hc-bub'); x && x.click(); }); await sl(1500);
    const n = await pg.evaluate(() => { const f = document.querySelector('.hc-pop .hc-head .hc-faces, .hc .hc-head .hc-faces'); return f ? f.children.length : -1; });
    check(n === 1, who2 + ': the chat header shows one face (the other person), not two: ' + n);
  }
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
