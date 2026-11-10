/* Rebuild A2, last step: shared calendar events straight from the shared box. Both add events at the same time and
   both stay; an event deleted on one side is gone on the other; private events are never touched; another device's
   older copy of the calendar can't bring an old version back. Made-up data only. */
const { shared, until, sl, open } = require('../lib/browser'); const { check, done } = require('../lib/check');
const evs = () => (JSON.parse(localStorage.getItem('dash.calendar') || '{}').events || []);
(async () => {
  const { b, p, b2, q } = await shared();
  const day = n => p.evaluate(n => Features.dkey(new Date(Date.now() + n * 864e5)), n);
  const [d1, d2] = [await day(1), await day(2)];
  await p.evaluate((d1, d2) => { const c = JSON.parse(localStorage.getItem('dash.calendar') || '{}'); c.events = (c.events || []).concat([
      { id: 'eA', title: 'Dinner with friends', date: d1, allDay: true, cat: 'social', share: true },
      { id: 'eP', title: 'Private dentist', date: d2, allDay: true, cat: 'personal' }]);
    localStorage.setItem('dash.calendar', JSON.stringify(c)); window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('cal:change'));
    const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { cal: true }); Vault.save(d); }, d1, d2);
  await p.evaluate(() => ShareSpace.sync()); await sl(1500); await p.evaluate(() => ShareSpace.sync()); await sl(1000);
  check(await p.evaluate(() => ShareSpace.direct('cal')) === true, 'on by default');
  await q.evaluate(() => document.querySelector('[data-tab="cal"]').click());
  check(await until(q, () => /Dinner with friends/.test(document.body.innerText), 12000) !== null, 'Iago sees the shared event');
  check(await q.evaluate(() => !/Private dentist/.test(document.body.innerText)), 'Iago doesn’t see the private one');
  /* both at once: the owner renames A and adds C; Iago adds B */
  await Promise.all([
    p.evaluate(d2 => { const c = JSON.parse(localStorage.getItem('dash.calendar')); c.events.find(e => e.id === 'eA').title = 'Dinner at Anna’s';
      c.events.push({ id: 'eC', title: 'Cinema', date: d2, allDay: false, start: '20:00', stop: '22:00', cat: 'social', share: true });
      localStorage.setItem('dash.calendar', JSON.stringify(c)); window.dispatchEvent(new Event('cal:change')); }, d2),
    (async () => { await q.evaluate(() => document.querySelector('[data-addev]').click()); await sl(400);
      await q.evaluate(d1 => { const f = document.querySelector('.h-sheetbg form'); f.title.value = 'Plumber visit'; f.date.value = d1; f.all.checked = true; f.requestSubmit(); }, d1); })()
  ]);
  const want = 'Cinema,Dinner at Anna’s,Plumber visit';
  const okP = await until(p, w => (JSON.parse(localStorage.getItem('dash.calendar')).events || []).filter(e => e.share).map(e => e.title).sort().join(',') === w, 15000, want);
  check(okP !== null, 'cmd ends with both sides’ events: ' + await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.calendar')).events || []).map(e => e.title + (e.share ? '*' : '')).join(', ')));
  check(await until(q, () => /Cinema/.test(document.body.innerText) && /Anna/.test(document.body.innerText) && /Plumber/.test(document.body.innerText), 15000) !== null, 'Iago ends with all three');
  check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.calendar')).events || []).some(e => e.id === 'eP' && e.title === 'Private dentist' && !e.share)), 'the private event is untouched');
  /* Iago deletes the plumber: gone in cmd */
  const pid = await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.calendar')).events.find(e => e.title === 'Plumber visit') || {}).id);
  await q.evaluate(id => document.querySelector('[data-evdel="' + id + '"]').click(), pid);
  check(await until(p, id => !(JSON.parse(localStorage.getItem('dash.calendar')).events || []).some(e => e.id === id), 15000, pid) !== null, 'Iago’s delete reaches cmd');
  /* an older copy of the calendar arriving from another device doesn't bring the old name back */
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('dash.calendar')); c.events.find(e => e.id === 'eA').title = 'Dinner with friends'; localStorage.setItem('dash.calendar', JSON.stringify(c)); window.dispatchEvent(new CustomEvent('vault:in', { detail: ['dash.calendar'] })); });
  await sl(300); await p.evaluate(() => ShareSpace.sync()); await sl(2500);
  check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.calendar')).events.find(e => e.id === 'eA') || {}).title) === 'Dinner at Anna’s', 'an older copy from another device can’t bring the old name back');
  check(await q.evaluate(() => /Anna/.test(document.body.innerText) && !/Dinner with friends/.test(document.body.innerText)), '… for Iago either');
  /* the owner deletes the cinema: gone for Iago, stays gone */
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('dash.calendar')); c.events = c.events.filter(e => e.id !== 'eC'); localStorage.setItem('dash.calendar', JSON.stringify(c)); window.dispatchEvent(new Event('cal:change')); });
  check(await until(q, () => !/Cinema/.test(document.body.innerText), 15000) !== null, 'a delete in cmd reaches Iago');
  await sl(2500);
  check(await p.evaluate(() => !(JSON.parse(localStorage.getItem('dash.calendar')).events || []).some(e => e.id === 'eC')), 'and stays gone');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
