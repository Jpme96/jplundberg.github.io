/* Team's errors go into cmd's error list (2026-11-20, JP): the app sends its script errors masked (no numbers, no
   emails, never who), Team's server keeps them, and only the /cmd Worker can read them (over its service binding –
   the host 'internal'); from the internet that address answers "not found". Made-up data only. */
const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const puppeteer = require('puppeteer');
const { check, done } = require('../lib/check');
const sl = ms => new Promise(r => setTimeout(r, ms));
const TPORT = (+process.env.PORT || 8770) + 430, T = 'http://localhost:' + TPORT + '/';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'team-server.mjs')], { env: Object.assign({}, process.env, { TPORT: String(TPORT) }), stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => srv.kill());
function raw(p) { return new Promise(res => { http.get(T.replace(/\/$/, '') + p, r => { let d = ''; r.on('data', c => { d += c; }); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', () => res({ status: 0, body: '' })); }); }
(async () => {
  for (let i = 0; i < 50 && (await raw('/index.html')).status !== 200; i++) await sl(200);
  const b = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setCookie({ name: 'who', value: 'member%40x.no', domain: 'localhost', path: '/' });
  await p.goto(T); await sl(1500);
  check(await p.evaluate(() => !!window.TeamErr), 'the Team app catches its errors');
  /* a thrown error is caught by itself; one added by hand carries made-up numbers and an email that must not get through */
  await p.evaluate(() => { setTimeout(() => { throw new Error('Made-up crash in view'); }, 0); });
  await sl(300);
  const n = await p.evaluate(() => { TeamErr.add('js', 'Made-up failure 12345 for someone@example.no', 'app.js:42'); return TeamErr.send(); });
  check(n >= 2, 'the app sends them to its server ' + n);
  const got = JSON.parse((await raw('/__internal/errlog')).body || '{}').list || [];
  const txt = JSON.stringify(got);
  check(got.length >= 2 && /Made-up crash in view|Script error/.test(txt) && /Made-up failure #####/.test(txt), 'the /cmd Worker gets them over its binding ' + txt.slice(0, 300));
  check(!/12345|someone@|example\.no|member@x/.test(txt), 'no numbers, no emails, never who it was');
  const pub = await raw('/api/errlog-internal');
  check(pub.status === 404 || pub.status === 401, 'from the internet the address answers not found / not signed in (' + pub.status + ')');
  await done(b);
})();
