/* Shared calendar invites (2026-11-15): the owner invites the other one from the event editor ("Invite … – they answer in
   their app"); the shared app shows the invite with Yes / Maybe / No; the answer comes back to cmd as a status tag. The
   other way too: an invite made in the shared app is answered in cmd's editor and the answer shows in the shared app.
   Made-up data only. */
const { shared, until, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared();
  const d1 = await p.evaluate(() => Features.dkey(new Date(Date.now() + 864e5)));
  await p.evaluate(() => { const d = Vault.get(); d.share.what = Object.assign({}, d.share.what || {}, { cal: true }); Vault.save(d); });
  await p.evaluate(() => ShareSpace.sync()); await sl(800);

  /* the owner invites from the editor */
  await go(p, 'calendar/', 2000);
  await p.evaluate(() => document.getElementById('clNew').click()); await sl(400);
  const row = await p.evaluate(() => { const r = document.getElementById('clInvRow'); return r && !r.hidden && !r.closest('[hidden]') ? r.innerText : ''; });
  check(/Invite .+ – they answer in their app/.test(row), 'the editor has an invite switch ' + JSON.stringify(row));
  await p.evaluate(d1 => { document.getElementById('clTitleIn').value = 'Concert (made up)'; document.getElementById('clDate').value = d1; const a = document.getElementById('clAllDay'); if (!a.checked) a.click();
    const i = document.getElementById('clInvite'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('clSave').click(); }, d1);
  await sl(600);
  const ev = await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.calendar') || '{}').events || []).find(e => e.title === 'Concert (made up)'));
  check(ev && ev.inv === 'o' && ev.share === true, 'saved as a shared event with an invite ' + JSON.stringify(ev && { inv: ev.inv, share: ev.share }));
  await p.evaluate(() => ShareSpace.sync()); await sl(1500);

  /* the shared app: Yes / Maybe / No on the row */
  await q.evaluate(() => document.querySelector('[data-tab="cal"]').click());
  const seen = await until(q, () => /Concert \(made up\)/.test(document.body.innerText) && !!document.querySelector('[data-rsvp]'), 15000);
  check(seen !== null, 'the other one sees the invite with answer buttons');
  check(await q.evaluate(() => /invites you/.test(document.body.innerText)), '… saying who invites them');
  await q.evaluate(id => document.querySelector('[data-rsvp="' + id + '|yes"]').click(), ev.id); await sl(400);
  check(await q.evaluate(id => document.querySelector('[data-rsvp="' + id + '|yes"]').getAttribute('aria-pressed') === 'true', ev.id), 'their Yes is shown as chosen');

  /* back in cmd: the answer as a status tag */
  check(await until(p, id => { ShareSpace.sync(); return ShareSpace.rsvp(id, 'p') === 'yes'; }, 20000, ev.id) !== null, 'cmd gets their answer');
  await p.evaluate(() => { try { localStorage.setItem('dash.calView', 'list'); } catch (e) {} });
  await go(p, 'calendar/', 2000);
  await p.evaluate(() => { const b = document.querySelector('[data-view="list"]'); if (b) b.click(); }); await sl(500);
  const tag = await p.evaluate(() => { const t = [...document.querySelectorAll('.cl-ev .stt')].map(x => x.className + ' ' + x.textContent); return t.join(' | '); });
  check(/stt-ok [^|]*: yes/.test(tag), 'the event shows "…: yes" as a status tag ' + JSON.stringify(tag));

  /* the other way: an invite from the shared app, answered in cmd */
  await q.evaluate(() => document.querySelector('[data-addev]').click()); await sl(400);
  check(await q.evaluate(() => /Invite .+ – they answer yes or no/.test(document.querySelector('.h-sheetbg form').innerText)), 'the shared app\'s new event has an invite box');
  await q.evaluate(d1 => { const f = document.querySelector('.h-sheetbg form'); f.title.value = 'Hike (made up)'; f.date.value = d1; f.all.checked = true; f.inv.checked = true; f.requestSubmit(); }, d1);
  const hid = await until(p, () => { ShareSpace.sync(); const e = (JSON.parse(localStorage.getItem('dash.calendar') || '{}').events || []).find(x => x.title === 'Hike (made up)'); return e && e.inv === 'p' ? e.id : null; }, 20000);
  check(!!hid, 'their invite reaches cmd as theirs (inv p)');
  const hidV = await p.evaluate(() => ((JSON.parse(localStorage.getItem('dash.calendar') || '{}').events || []).find(x => x.title === 'Hike (made up)') || {}).id);
  await go(p, 'calendar/', 2000);
  await p.evaluate(() => { const b = document.querySelector('[data-view="list"]'); if (b) b.click(); }); await sl(500);
  check(await p.evaluate(() => [...document.querySelectorAll('.cl-ev .stt-cmt')].some(x => /invites you/.test(x.textContent))), 'cmd shows "… invites you" on it');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.cl-ev')].find(x => /Hike/.test(x.textContent)); b.click(); }); await sl(500);
  check(await p.evaluate(() => { const a = document.getElementById('clInvAns'); return a && !a.hidden && a.querySelectorAll('[data-invans]').length === 3 && document.getElementById('clInvRow').hidden; }), 'opening it in cmd: Yes / Maybe / No instead of the invite switch');
  await p.evaluate(() => document.querySelector('[data-invans="maybe"]').click()); await sl(300);
  check(await p.evaluate(id => ShareSpace.rsvp(id, 'o') === 'maybe', hidV), 'cmd\'s answer is saved');
  await p.evaluate(() => document.getElementById('clSave').click()); await sl(400);
  check(await p.evaluate(id => ((JSON.parse(localStorage.getItem('dash.calendar')).events || []).find(e => e.id === id) || {}).inv === 'p', hidV), 'saving keeps it their invite');
  await p.evaluate(() => ShareSpace.sync());
  check(await until(q, () => /: maybe/.test(document.body.innerText), 20000) !== null, 'the shared app shows "…: maybe"');
  check(!/undefined|NaN|null/.test(await q.evaluate(() => document.body.innerText)), 'no undefined/NaN/null in the shared app');
  check(!p.errs.length && !q.errs.length, 'no errors ' + JSON.stringify([p.errs, q.errs]).slice(0, 300));
  await done(b, b2);
})();
