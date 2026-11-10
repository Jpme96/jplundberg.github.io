/* Rebuild A2, step 2: chores and rooms straight from the shared box. Changes at the same time on both sides end
   up the same everywhere; rooms keep their order; ticking still works; off again keeps everything. Made-up data. */
const { shared, until, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  await p.evaluate(() => { Features.set('house', true); Features.set('chores', true); const t = Features.tools(), d0 = Features.dkey(new Date());
    t.rooms = [{ id: 'rK', name: 'Kitchen', icon: 'tv', size: '' }, { id: 'rB', name: 'Bathroom', icon: 'droplet', size: '' }];
    t.chores = [{ id: 'cA', name: 'Clean the sink', every: '1w', day: 0, who: 'rotate', start: d0, room: 'rK' }, { id: 'cB', name: 'Mop the floor', every: '1w', day: 2, who: 'me', start: d0 }];
    Features.saveTools(t); const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { chores: true }); Vault.save(d); });
  await p.evaluate(() => ShareSpace.sync()); await sl(1500);
  check(await p.evaluate(() => ShareSpace.direct('chores', true)) === true, 'the switch turns on');
  await p.evaluate(() => ShareSpace.sync()); await sl(1000);
  await q.evaluate(() => document.querySelector('[data-tab="chores"]').click());
  check(await until(q, () => /Clean the sink/.test(document.body.innerText) && /Mop the floor/.test(document.body.innerText), 12000) !== null, 'Iago sees the chores');
  /* both at once: the owner renames A and adds a room; Iago deletes B and adds a chore in the Bathroom */
  await Promise.all([
    p.evaluate(() => { const t = Features.tools(); t.chores.find(c => c.id === 'cA').name = 'Scrub the sink'; t.rooms.push({ id: 'rH', name: 'Hallway', icon: 'signpost', size: '' }); Features.saveTools(t); }),
    (async () => {
      await q.evaluate(() => document.querySelector('[data-choreedit="cB"]').click()); await sl(300);
      await q.evaluate(() => document.querySelector('[data-choredel="cB"]').click()); await sl(300);
      await q.evaluate(() => document.querySelector('[data-choreadd]').click()); await sl(400);
      await q.evaluate(() => { const f = document.querySelector('.h-sheetbg form'); f.name.value = 'Wash the shower'; if (f.room) f.room.value = 'rB'; f.requestSubmit(); });
    })()
  ]);
  const want = 'Scrub the sink,Wash the shower';
  const okP = await until(p, w => (Features.tools().chores || []).map(c => c.name).sort().join(',') === w, 15000, want);
  check(okP !== null, 'cmd ends with both sides’ changes: ' + await p.evaluate(() => (Features.tools().chores || []).map(c => c.name).join(',')));
  check(await p.evaluate(() => (Features.tools().chores.find(c => c.name === 'Wash the shower') || {}).room === 'rB'), 'Iago’s new chore is in the Bathroom');
  check(await p.evaluate(() => Features.tools().rooms.map(r => r.name).join(',')) === 'Kitchen,Bathroom,Hallway', 'rooms keep their order');
  check(await until(q, () => [...document.querySelectorAll('[data-chore]')].map(x => x.innerText.split('\n')[0]).sort().join(',') === 'Scrub the sink,Wash the shower' && document.querySelectorAll('[data-hroom]').length === 4, 15000) !== null, 'Iago ends with the same chores and 3 rooms: ' + await q.evaluate(() => [...document.querySelectorAll('[data-chore]')].map(x => x.innerText.split('\n')[0]).join('|') + ' rooms ' + document.querySelectorAll('[data-hroom]').length + ' sheet ' + !!document.querySelector('.h-sheetbg')));
  /* a tick in cmd still reaches Iago */
  await go(p, 'house/', 2500);
  await p.evaluate(() => { const c = Features.list('chores').find(x => x.name === 'Scrub the sink'); Chores.setDone(c); });
  check(await until(q, () => { const x = [...document.querySelectorAll('[data-chore]')].find(e => /Scrub/.test(e.innerText)); return x && x.getAttribute('aria-pressed') === 'true'; }, 15000) !== null, 'a tick in cmd reaches Iago');
  /* Iago ticks one: cmd shows it done and it's in the history; then cmd unticks its own and Iago sees that */
  await q.evaluate(() => [...document.querySelectorAll('[data-chore]')].find(e => /Wash the shower/.test(e.innerText)).click());
  check(await until(p, () => { const c = Features.list('chores').find(x => x.name === 'Wash the shower'); return c && Chores.done(c, Chores.period(c)) && Chores.log().some(l => l.cid === c.id); }, 15000) !== null, 'Iago’s tick shows in cmd and in the history: ' + await p.evaluate(() => { const c = Features.list('chores').find(x => x.name === 'Wash the shower'); return JSON.stringify({ done: Chores.done(c, Chores.period(c)), cd: Features.tools().choreDone, raw: Features.rawTools().choreDone, log: Chores.log().map(l => l.cid + ':' + l.who) }); }));
  await p.evaluate(() => { const c = Features.list('chores').find(x => x.name === 'Scrub the sink'); Chores.setDone(c); });
  check(await until(q, () => { const x = [...document.querySelectorAll('[data-chore]')].find(e => /Scrub/.test(e.innerText)); return x && x.getAttribute('aria-pressed') === 'false'; }, 15000) !== null, 'untick in cmd reaches Iago');
  await sl(2000);
  check(await p.evaluate(() => { const c = Features.list('chores').find(x => x.name === 'Wash the shower'), s = Features.list('chores').find(x => x.name === 'Scrub the sink'); return Chores.done(c, Chores.period(c)) && !Chores.done(s, Chores.period(s)); }), 'ticks stay as they are after more syncs');
  /* order changed in cmd reaches Iago */
  await p.evaluate(() => { const t = Features.tools(); t.rooms = [t.rooms[2], t.rooms[0], t.rooms[1]]; Features.saveTools(t); });
  check(await until(q, () => [...document.querySelectorAll('[data-hroom]')].map(x => x.innerText.replace(/\d+/g, '').trim()).slice(1).join(',') === 'Hallway,Kitchen,Bathroom', 15000) !== null, 'a new room order reaches Iago: ' + await q.evaluate(() => [...document.querySelectorAll('[data-hroom]')].map(x => x.innerText.trim()).join('|')));
  await sl(2500);
  check(await p.evaluate(() => (Features.tools().chores || []).map(c => c.name).sort().join(',')) === want, 'nothing comes back after more syncs');
  /* notes the same way */
  await p.evaluate(() => { const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { notes: true }); Vault.save(d); });
  check(await p.evaluate(() => ShareSpace.direct('notes', true)) === true, 'notes switch turns on');
  await p.evaluate(() => { const t = Features.tools(); t.homenotes = (t.homenotes || []).concat([{ id: 'nWifi', title: 'Wi-Fi', text: 'Name: TestNet' }]); Features.saveTools(t); });
  await q.evaluate(() => { const b = document.querySelector('[data-tab="notes"]'); if (b) b.click(); });
  check(await until(q, () => /TestNet/.test(document.body.innerText), 15000) !== null, 'a note from cmd reaches Iago');
  await p.evaluate(() => ShareSpace.direct('notes', false));
  await p.evaluate(() => ShareSpace.direct('chores', false)); await sl(500);
  check(await p.evaluate(() => (Features.tools().chores || []).map(c => c.name).sort().join(',') + '|' + Features.tools().rooms.map(r => r.name).join(',')) === want + '|Hallway,Kitchen,Bathroom', 'turned off, chores and rooms are kept');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
