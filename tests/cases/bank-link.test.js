/* Bank connection (2026-11-20, JP): the app's key (.pem) is loaded into the vault, "Connect with BankID" goes to the
   bank and back with a code, the accounts are matched to cmd's accounts, and "Fetch" runs the new booked transactions
   through the import preview (pending ones left out, every page of results read), moving the balance to the bank's.
   The server only passes signed calls on – and only the read-only ones. A pretend Enable Banking in lib/server.mjs;
   made-up data only. */
const { open, go, sl, until, unlock } = require('../lib/browser'); const { check, done } = require('../lib/check');
const http = require('http');
const PORT = +process.env.PORT || 8770;
const eb = () => new Promise(r => http.get('http://localhost:' + PORT + '/__eb', res => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => r(JSON.parse(d || '{}'))); }).on('error', () => r({})));
(async () => {
  const { b, p } = await open(393);
  await go(p, 'finance/', 3000);
  check(await p.evaluate(() => { const x = document.getElementById('bkAcctBtn'); return !!x && x.hasAttribute('data-bksetup') && /Connect bank/.test(x.textContent); }), 'before connecting: "Connect bank" on the Your accounts card');

  /* the server lets only the read-only calls through */
  const refused = await p.evaluate(async () => (await fetch('/cmd/api/bank?p=' + encodeURIComponent('/payments'), { method: 'POST', headers: { authorization: 'Bearer a.b.c' } })).status);
  check(refused === 400, 'the server refuses anything but the read-only bank calls (payments → ' + refused + ')');

  /* 1. the key file: a made-up key made here, named like Enable Banking's download (<app id>.pem) */
  await p.evaluate(async () => {
    const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)); let s = ''; raw.forEach(c => { s += String.fromCharCode(c); });
    const pem = '-----BEGIN PRIVATE KEY-----\n' + btoa(s).match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n';
    BankLink.setup();
    const inp = [...document.querySelectorAll('input[type=file]')].find(i => /pem/.test(i.accept));
    const dt = new DataTransfer(); dt.items.add(new File([pem], '0a1b2c3d-1111-2222-3333-444455556666.pem', { type: 'application/x-pem-file' }));
    inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  });
  check(await until(p, () => !!(Vault.get().bank && Vault.get().bank.key) && !!document.querySelector('[data-bkconnect]'), 8000) !== null, 'the key file is kept in the vault and the sheet offers to connect a bank');
  const kinfo = await p.evaluate(() => ({ app: Vault.get().bank.app, pem: /BEGIN PRIVATE KEY/.test(Vault.get().bank.key), text: document.querySelector('.im-box').innerText.slice(0, 300) }));
  check(kinfo.app === '0a1b2c3d-1111-2222-3333-444455556666' && kinfo.pem && /Key loaded/.test(kinfo.text), 'the app id comes from the file name ' + JSON.stringify(kinfo.app));

  /* 2. connect: to the bank and back with a code (the pretend bank sends straight back) */
  const pk = await until(p, () => !!document.querySelector('[data-bkpick] option'), 6000);
  if (pk === null) check(false, 'the bank list ' + await p.evaluate(() => (document.querySelector('.im-box') || {}).innerText));
  await p.evaluate(() => { const s = document.querySelector('[data-bkpick]'); s.value = 'DNB'; document.querySelector('.bk-add [data-bkconnect]').click(); });
  await p.waitForNavigation({ timeout: 15000 }).catch(() => {});
  /* back on Finances: it opens unlocked by itself (the quick resume); only if the lock screen stays, type the passcode */
  if (await until(p, () => document.documentElement.classList.contains('unlocked'), 9000) === null) await unlock(p);
  check(await until(p, () => !!(Vault.get() && Vault.get().bank && Vault.get().bank.links && Vault.get().bank.links.length), 15000) !== null, 'back from the bank: the connection is saved');
  const link = await p.evaluate(() => { const l = Vault.get().bank.links[0]; return { aspsp: l.aspsp, sid: l.sid, n: l.accts.length, last4: l.accts.map(a => a.last4), url: location.href, until: !!l.until, auth: null }; });
  const e1 = await eb();
  check(link.aspsp === 'DNB' && link.n === 2 && link.last4.join() === '0011,0022' && !/code=/.test(link.url) && link.until, 'DNB with its two accounts, the code gone from the address ' + JSON.stringify(link));
  check(e1.auth && e1.auth.psu_type === 'personal' && /\/cmd\/finance\/$/.test(e1.auth.redirect_url) && e1.auth.aspsp.country === 'NO' && new Date(e1.auth.access.valid_until) - Date.now() > 170 * 864e5, 'the login asks for personal, read access, about 180 days, back to Finances');

  /* 3. match the everyday account to the salary account, leave savings out */
  check(await until(p, () => Vault.get().bank.links[0].accts.every(a => a.named) && /Made-up savings/.test(document.querySelector('.im-box').innerText), 8000) !== null, 'the accounts get their product names, not the holder\'s name ' + await p.evaluate(() => JSON.stringify(Vault.get().bank.links[0].accts.map(a => [a.name, a.holder]))));
  check(await until(p, () => !!document.querySelector('[data-bkmap="0:0"]'), 8000) !== null, 'the sheet opens with the accounts to match ' + await p.evaluate(() => (document.querySelector('.im-box') || {}).innerText || '').then(t => t.slice(0, 200)));
  await p.evaluate(() => { const L = Accts.list(Vault.get()), sal = L.find(a => a.kind === 'salary') || L[0]; const s = document.querySelector('[data-bkmap="0:0"]'); s.value = sal.id; s.dispatchEvent(new Event('change', { bubbles: true })); window.__sal = sal.id; });
  await sl(300);
  const mapped = await p.evaluate(() => Vault.get().bank.links[0].accts.map(a => a.acct));
  check(mapped[0] === await p.evaluate(() => window.__sal) && !mapped[1], 'the everyday account is matched; savings is not fetched ' + JSON.stringify(mapped));
  /* a bank account with no match in cmd becomes a new account, named and typed from the bank (JP: "I need more, like Brukskonto") */
  await p.evaluate(() => { const s = document.querySelector('[data-bkmap="0:1"]'); s.value = '+new'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sl(500);
  const nw = await p.evaluate(() => { const d = Vault.get(), id = d.bank.links[0].accts[1].acct, A = (d.budget.acctList || []).find(a => a.id === id) || {}; return { id, name: A.name, kind: A.kind, inList: Accts.list(d).some(a => a.id === id), opt: !!document.querySelector('[data-bkmap="0:1"] option[value="' + id + '"]:checked') }; });
  check(nw.id && nw.name === 'Made-up savings' && nw.kind === 'savings' && nw.inList && nw.opt, '"+ New account" makes "Made-up savings" as a savings account and matches it ' + JSON.stringify(nw));

  /* the clear button on Finances → Accounts (JP: it was only behind the upload icon) */
  check(await p.evaluate(() => { const x = document.getElementById('bkAcctBtn'); return !!x && x.hasAttribute('data-bkfetch') && /Fetch from bank/.test(x.textContent) && !!x.closest('.card.myaccts'); }), '"Fetch from bank" on the Your accounts card');
  /* balances by themselves: every matched account's balance from the bank, no review (JP: "say how much I have in my account") */
  const nb = await p.evaluate(async () => { const n = await BankLink.balances(); const d = Vault.get(); const A = (d.budget.acctList || []).find(a => a.id === window.__sal) || {}; return { n, bal: A.bal, src: A.balSrc, sheetOpen: !!document.querySelector('.im-box [data-import]') }; });
  check(nb.n >= 1 && nb.bal === 12345.6 && nb.src === 'bank' && !nb.sheetOpen, 'balances are set from the bank by themselves ' + JSON.stringify(nb));
  /* 4. fetch: booked rows through the import preview, the pending one left out, both pages read */
  await p.evaluate(() => document.querySelector('[data-bkfetch]').click());
  check(await until(p, () => !!document.querySelector('.im-box [data-import]'), 10000) !== null, 'the fetched rows open in the import preview');
  const pv = await p.evaluate(() => document.querySelector('.im-box').innerText);
  check(/REMA/i.test(pv) && /Made-up Cafe/i.test(pv) && !/PENDING SHOP/.test(pv), 'both pages are read, the pending payment is left out ' + JSON.stringify([/Made-up Cafe/i.test(pv), /PENDING/i.test(pv), pv.slice(0, 600)]));
  const e2 = await eb();
  const d90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  check(e2.calls.some(c => /continuation_key=page2/.test(c)) && Math.abs(new Date(e2.from) - new Date(d90)) < 2 * 864e5, 'the first fetch reaches back 90 days ' + e2.from);
  await p.evaluate(() => document.querySelector('.im-box [data-import]').click());
  await sl(1500);
  const after = await p.evaluate(() => { const d = Vault.get(), sal = window.__sal; const ex = (d.expenses || []).filter(e => e.src === 'bank' && e.acct === sal); const A = (d.budget.acctList || []).find(a => a.id === sal) || {}; return { notes: ex.map(e => e.note + ' ' + e.amount), bal: A.bal, from: d.bank.links[0].accts[0].from }; });
  check(after.notes.length >= 2 && after.bal === 12345.6 && /^\d{4}-\d\d-\d\d$/.test(after.from || ''), 'imported, the balance set to the bank\'s, and where it got to is remembered ' + JSON.stringify(after));

  /* 5. again: nothing new (duplicates skipped), from a few days before where it got to */
  await p.evaluate(() => { BankLink.fetch(); });
  await sl(2500);
  const e3 = await eb();
  const again = await p.evaluate(() => ({ preview: !!document.querySelector('.im-box [data-import]'), n: (Vault.get().expenses || []).filter(e => e.src === 'bank').length }));
  check(!again.preview && again.n === after.notes.length && e3.from > e2.from, 'the second fetch finds nothing new and starts later ' + JSON.stringify([again, e3.from]));

  /* every call was signed – the pretend bank answers 401 to anything else */
  check(e3.calls.length >= 8 && !e3.calls.some(c => /payments/.test(c)), 'every call went through signed ' + e3.calls.length);

  /* 6. At a glance says when a connection is about to end */
  await p.evaluate(() => { const d = Vault.get(); d.bank.links[0].until = new Date(Date.now() + 5 * 864e5).toISOString(); Vault.save(d); });
  await sl(800); await go(p, '', 3000);
  const brief = await p.evaluate(() => (window.BriefItems || []).map(x => x.title).filter(t => /connection to DNB/.test(t)));
  check(brief.length === 1 && /ends in 5 days/.test(brief[0]), 'At a glance: "The connection to DNB ends in 5 days" ' + JSON.stringify(brief));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
