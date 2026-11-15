/* Runs every test in tests/cases, each against a fresh stand-in server (state from one test never leaks into the next).
   node tests/run.js            – all tests
   node tests/run.js chat sync  – only the tests whose file name contains one of the words
   -j 3                         – run 3 tests at the same time (each with its own server and port); default TEST_JOBS or 2
   --shard 2/4                  – only every 4th test starting with the 2nd (GitHub splits the run over machines)
   --changed                    – only the tests that touch what changed since main (and the quick checks that always run):
                                  a test is picked when it names a changed file (its name without .js/.page.js/.css) – fast
                                  while you work; push still runs everything on GitHub
   Exit code 1 when any test fails – GitHub then marks the push red. */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const CASES = path.join(__dirname, 'cases'), BASE = +(process.env.PORT || 8770);
const args = process.argv.slice(2), only = [];
let JOBS = +(process.env.TEST_JOBS || 2), SHARD = null, CHANGED = false;
for (let i = 0; i < args.length; i++) { if (args[i] === '-j') JOBS = +args[++i]; else if (args[i] === '--shard') SHARD = args[++i].split('/').map(Number); else if (args[i] === '--changed') CHANGED = true; else only.push(args[i]); }
let files = fs.readdirSync(CASES).filter(f => f.endsWith('.test.js') && (!only.length || only.some(w => f.includes(w)))).sort();
if (CHANGED) {
  const { execSync } = require('child_process'), sh = c => { try { return execSync(c, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); } catch (e) { return ''; } };
  const ch = (sh('git diff --name-only origin/main...HEAD') + sh('git diff --name-only') + sh('git diff --name-only --cached') + sh('git ls-files --others --exclude-standard'))
    .split('\n').map(x => x.trim()).filter(x => x && !/^cmd\/dist\/|\.png$|^tests\/\.tmp/.test(x));
  const keys = [...new Set(ch.map(x => path.basename(x).replace(/\.test\.js$|\.page\.js$|\.js$|\.css$|\.html$|\.mjs$/, '')).filter(k => k.length > 2 && !/^(index|page|styles|words|ui\.nb|scripts|worker)$/.test(k)))];
  const ALWAYS = ['build', 'size', 'text-keys', 'css-split', 'colors'];
  if (ch.some(x => /^_team\//.test(x))) ALWAYS.push('team');
  if (ch.some(x => /^_cloudflare\//.test(x))) ALWAYS.push('reminders-server', 'outq');
  files = files.filter(f => ALWAYS.some(a => f === a + '.test.js') || ch.includes('tests/cases/' + f) || keys.some(k => fs.readFileSync(path.join(CASES, f), 'utf8').includes(k)));
  console.log('changed: ' + ch.length + ' files → ' + files.length + ' tests (' + keys.slice(0, 12).join(', ') + (keys.length > 12 ? ' …' : '') + ')');
}
if (SHARD) files = files.filter((f, i) => i % SHARD[1] === SHARD[0] - 1);
const sl = ms => new Promise(r => setTimeout(r, ms));
function up(PORT) { return new Promise(r => { const q = http.get('http://localhost:' + PORT + '/cmd/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); }); }

(async () => {
  const results = [], queue = files.slice();
  async function one(f, PORT) {
    const srv = spawn(process.execPath, [path.join(__dirname, 'lib', 'server.mjs')], { env: Object.assign({}, process.env, { D1: '1', R2: '1', LIVE: '1', PORT: String(PORT) }), stdio: ['ignore', 'ignore', 'pipe'] });
    let serr = ''; srv.stderr.on('data', d => { serr += d; });
    for (let i = 0; i < 50 && !(await up(PORT)); i++) await sl(200);
    const t0 = Date.now();
    await new Promise(res => {
      const t = spawn(process.execPath, [path.join(CASES, f)], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; t.stdout.on('data', d => { out += d; }); t.stderr.on('data', d => { out += d; });
      const kill = setTimeout(() => { out += '\n(timed out after 240 s)'; t.kill('SIGKILL'); }, 240000);
      t.on('exit', c => { clearTimeout(kill); results.push({ f, ok: c === 0, out, ms: Date.now() - t0, serr }); res(c); });
    });
    srv.kill();
    const r = results[results.length - 1];
    console.log((r.ok ? '✓ ' : '✗ ') + f.replace('.test.js', '').padEnd(22) + (r.ms / 1000).toFixed(1) + ' s');
    if (!r.ok) console.log('   ' + r.out.trim().split('\n').filter(l => /FAIL|Error|error/.test(l)).concat(r.out.trim().split('\n').slice(-12)).slice(-40).join('\n   ') + (/ExperimentalWarning/.test(serr) ? '' : serr ? '\n   server: ' + serr.trim().slice(-400) : ''));
    await sl(300);
  }
  async function worker(k) { let f; while ((f = queue.shift())) await one(f, BASE + k); }
  await Promise.all(Array.from({ length: Math.max(1, JOBS) }, (_, k) => worker(k)));
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed');
  if (results.length > 8) console.log('slowest: ' + results.slice().sort((a, b) => b.ms - a.ms).slice(0, 5).map(r => r.f.replace('.test.js', '') + ' ' + Math.round(r.ms / 1000) + ' s').join(' · '));
  process.exit(bad.length ? 1 : 0);
})();
