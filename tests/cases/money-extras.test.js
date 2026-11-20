/* Money extras (2026-11-20, JP "do all"): Sort "Other" – one list of shops, a category once, moved and remembered;
   the file reminder for an account that can't be connected; bank news in the bell; the accounts card shows small
   marks with one key instead of "not in net worth" on every line; "A new version is ready" with one tap.
   Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const ym = new Date().toISOString().slice(0, 7), old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  await p.evaluate((ym, old) => {
    const d = Vault.get(); d.expenses = (d.expenses || []).concat([
      { id: 'x1', date: ym + '-02', amount: 300, cat: 'other', note: 'Made-up Gym AS' }, { id: 'x2', date: ym + '-03', amount: 300, cat: 'other', note: 'Made-up Gym AS' },
      { id: 'x3', date: ym + '-04', amount: 150, cat: 'other', note: 'Made-up Kiosk' }, { id: 'x4', date: ym + '-05', amount: 50, cat: 'groceries', note: 'Made-up Shop' },
      { id: 'x5', date: old, amount: 99, cat: 'shopping', note: 'Made-up card buy', src: 'bank', acct: 'credit' }]);
    d.budget = d.budget || {}; d.budget.acctList = (d.budget.acctList || []).filter(a => a.id !== 'credit').concat([{ id: 'credit', kind: 'credit', name: 'Made-up Card', bal: 100, nw: false }]);
    Vault.save(d);
    localStorage.setItem('dash.bankNew', JSON.stringify({ n: 3, at: Date.now() - 6e4 })); localStorage.removeItem('dash.ntSeen');
  }, ym, old);
  await sl(800); await go(p, 'finance/', 3000);

  /* Sort "Other" */
  check(await until(p, () => !!document.getElementById('soBtn'), 6000) !== null, 'a "Sort Other" button when Other is a big part of the month');
  await p.evaluate(() => document.getElementById('soBtn').click()); await sl(400);
  const so = await p.evaluate(() => { const L = [...document.querySelectorAll('.so-list li')].map(li => li.querySelector('b').textContent); const gym = [...document.querySelectorAll('.so-list li')].findIndex(li => /Gym/.test(li.textContent)); const s = document.querySelectorAll('[data-so]')[gym]; s.value = 'health'; document.querySelector('[data-sosave]').click(); return L; });
  await sl(600);
  const after = await p.evaluate(() => { const d = Vault.get(); return { cats: d.expenses.filter(e => /Gym/.test(e.note || '')).map(e => e.cat), kiosk: d.expenses.find(e => /Kiosk/.test(e.note || '')).cat, mem: Object.keys(d.catMemory || {}).some(k => /gym/.test(k) && d.catMemory[k] === 'health') }; });
  check(so.length === 2 && after.cats.join() === 'health,health' && after.kiosk === 'other' && after.mem, 'one pick moves every Gym row and is remembered; Kiosk stays ' + JSON.stringify([so, after]));

  /* the accounts card: a mark and one key, not the words on every line */
  await p.evaluate(() => { const t = document.querySelector('[data-ftab-go="accts"]'); if (t) t.click(); }); await sl(400);
  const ac = await p.evaluate(() => { const c = document.getElementById('fpMoney'); return { words: (c.innerText.match(/not in net worth/gi) || []).length, mark: !!c.querySelector('.mn-mark.bi-eye-slash'), key: !!c.querySelector('.mn-key') }; });
  check(ac.words === 0 && ac.mark && ac.key, 'Your accounts: a small mark and one key ' + JSON.stringify(ac));

  /* the bell: bank news */
  await p.evaluate(() => document.getElementById('ntBtn').click()); await sl(400);
  const bell = await p.evaluate(() => { const ov = document.querySelector('.nt-ov'); const a = ov && [...ov.querySelectorAll('.nt-row')].find(r => /new from the bank/.test(r.textContent)); const r = { has: !!a, href: a && a.getAttribute('href') }; if (ov) ov.querySelector('[data-ntclose]').click(); return r; });
  check(bell.has && bell.href === '/cmd/finance/#bankreview', '"3 new from the bank" in the bell, opening the review ' + JSON.stringify(bell));

  /* At a glance: the file reminder for the card that can't be connected */
  await go(p, '', 3000);
  const fd = await p.evaluate(() => (window.BriefItems || []).map(x => x.title).filter(t => /Import the .* file/.test(t)));
  check(fd.length === 1 && /Made-up Card/.test(fd[0]), 'At a glance: "Import the Made-up Card file" ' + JSON.stringify(fd));

  /* a new version: the bar, and one tap */
  await p.evaluate(() => { const real = window.fetch; window.fetch = (u, o) => /\/cmd\/(index\.html)?$/.test(String(u)) ? Promise.resolve(new Response('<script src="/cmd/dist/tail.js?v=zzzzzz"></script>')) : real(u, o); return window.__nvCheck(); });
  await sl(300);
  const nv = await p.evaluate(() => { const b0 = document.getElementById('nvBar'); return { bar: !!b0, txt: b0 && b0.innerText }; });
  check(nv.bar && /new version/i.test(nv.txt), 'a newer page on the server shows "A new version of cmd is ready" ' + JSON.stringify(nv));
  await p.evaluate(() => document.querySelector('[data-nvx]').click());
  check(await p.evaluate(() => !document.getElementById('nvBar')), '… and it can be put away');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
