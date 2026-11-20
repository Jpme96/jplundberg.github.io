/* Safety nets (2026-11-20, plan Part 4): a new backup is opened again with your key right after it's saved
   (dash.lastBackupOk, "checked: it opens" in Settings); the uptime workflow asks the four services; the weekly error
   line on At a glance reads the errlog once a day. Made-up data only. */
const fs = require('fs'), path = require('path');
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const wf = fs.readFileSync(path.join(__dirname, '../../.github/workflows/uptime.yml'), 'utf8');
  check(/schedule:/.test(wf) && /work\.jplundberg\.com/.test(wf) && /\/cmd\/api\/ping/.test(wf), 'the uptime workflow runs on a schedule and asks the Worker and Team');
  const { b, p } = await open(393);
  const r = await p.evaluate(async () => { localStorage.removeItem('dash.lastBackupOk'); await Vault.backup(); await new Promise(r => setTimeout(r, 500)); return +localStorage.getItem('dash.lastBackupOk') || 0; });
  check(r > Date.now() - 60000, 'a new backup is opened again and marked as readable');
  const dg = await p.evaluate(async () => {
    localStorage.removeItem('dash.errDigest');
    const real = window.fetch; let asked = 0;
    window.fetch = (u, o) => { if (/\/cmd\/api\/errlog/.test(String(u))) { asked++; return Promise.resolve(new Response(JSON.stringify({ o: [{ t: Date.now() - 864e5, k: 'js', m: 'x is null', n: 3 }], p: [{ t: Date.now() - 2 * 864e5, k: 'layout', m: 'too wide', n: 1 }, { t: Date.now() - 20 * 864e5, k: 'old', m: 'old', n: 9 }] }), { headers: { 'Content-Type': 'application/json' } })); } return real(u, o); };
    window.dispatchEvent(new Event('tools:change')); if (window.Brief && Brief.render) Brief.render();
    await new Promise(r => setTimeout(r, 800)); window.fetch = real;
    return { asked, c: JSON.parse(localStorage.getItem('dash.errDigest') || 'null') };
  });
  check(dg.c && dg.c.n === 4 && dg.c.k === 2, 'the weekly digest counts the last 7 days only ' + JSON.stringify(dg));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
