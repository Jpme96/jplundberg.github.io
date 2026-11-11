/* Error reports reach the server (Phase C step 5): cmd and the shared app send their masked error lines to
   /cmd/api/errlog; only the owner can read them (also as plain text for a session); nothing personal gets through. */
const { shared, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p, b2, q } = await shared(393);
  /* cmd: an error with an amount, an e-mail address and quoted text in it */
  await p.evaluate(() => { Diag.log('error', 'Cannot read 12 500 kr for "Kari Nordmann" from kari@example.no', 'finance.js:42'); });
  await p.evaluate(() => Diag.upload());
  await sl(1200);
  const o = await p.evaluate(() => fetch('/cmd/api/errlog', { credentials: 'same-origin' }).then(r => r.json()));
  const line = (o.o || []).filter(x => /Cannot read/.test(x.m))[0];
  check(!!line, 'the cmd error reached the server ' + JSON.stringify(o.o || []).slice(0, 200));
  check(line && !/\d/.test(line.m) && !/example|Kari/.test(line.m), 'and it is masked: ' + (line && line.m));
  check(line && line.a === 'finance.js:42' && line.v && line.v !== '?' && /\dpx/.test(line.d), 'with where, version and device ' + JSON.stringify(line || {}));
  /* sending again without anything new sends nothing; a repeat raises the count */
  await p.evaluate(() => { Diag.log('error', 'Cannot read 12 500 kr for "Kari Nordmann" from kari@example.no', 'finance.js:42'); Diag.upload(); });
  await sl(1200);
  const o2 = await p.evaluate(() => fetch('/cmd/api/errlog', { credentials: 'same-origin' }).then(r => r.json()));
  const l2 = (o2.o || []).filter(x => /Cannot read/.test(x.m));
  check(l2.length === 1 && l2[0].n === 2, 'a repeat is one line counted twice ' + JSON.stringify(l2.map(x => x.n)));
  /* the shared app */
  await q.evaluate(() => { window.__homeErr.log('error', 'Chores broke at 3 for "Ola"', 'app.js:7'); window.__homeErr.send(); });
  await sl(1500);
  const o3 = await p.evaluate(() => fetch('/cmd/api/errlog', { credentials: 'same-origin' }).then(r => r.json()));
  const pl = (o3.p || []).filter(x => /Chores broke/.test(x.m))[0];
  check(!!pl && !/\d|Ola/.test(pl.m) && pl.p === 'shared', 'the shared app error reached the owner, masked ' + JSON.stringify(pl || o3.p));
  const qq = await q.evaluate(() => fetch('/cmd/api/errlog', { credentials: 'same-origin' }).then(r => r.status));
  check(qq === 403, 'the person you share with cannot read the reports (' + qq + ')');
  /* plain text for a session */
  const txt = await p.evaluate(() => fetch('/cmd/api/errlog?format=text', { credentials: 'same-origin' }).then(r => r.text()));
  check(/cmd \(owner\)/.test(txt) && /shared app/.test(txt) && /finance\.js:42/.test(txt) && !/undefined|null|NaN/.test(txt), 'readable as plain text');
  /* junk is cleaned or refused */
  const bad = await p.evaluate(() => fetch('/cmd/api/errlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ errs: [{ k: '<b>', m: 'x' }, 'no', null] }) }).then(r => r.json()));
  check(bad.ok && bad.n === 0, 'junk lines are dropped ' + JSON.stringify(bad));
  check(!p.errs.length && !q.errs.length, 'no page errors ' + p.errs.concat(q.errs).join(' | ').slice(0, 300));
  await b2.close();
  await done(b);
})();
