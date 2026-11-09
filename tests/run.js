/* Runs every test in tests/cases, each against a fresh stand-in server (state from one test never leaks into the next).
   node tests/run.js            – all tests
   node tests/run.js chat sync  – only the tests whose file name contains one of the words
   Exit code 1 when any test fails – GitHub then marks the push red. */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const CASES = path.join(__dirname, 'cases'), PORT = process.env.PORT || 8770;
const only = process.argv.slice(2);
const files = fs.readdirSync(CASES).filter(f => f.endsWith('.test.js') && (!only.length || only.some(w => f.includes(w)))).sort();
const sl = ms => new Promise(r => setTimeout(r, ms));
function up() { return new Promise(r => { const q = http.get('http://localhost:' + PORT + '/cmd/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); }); }

(async () => {
  const results = [];
  for (const f of files) {
    const srv = spawn(process.execPath, [path.join(__dirname, 'lib', 'server.mjs')], { env: Object.assign({}, process.env, { D1: '1', R2: '1', LIVE: '1', PORT: String(PORT) }), stdio: ['ignore', 'ignore', 'pipe'] });
    let serr = ''; srv.stderr.on('data', d => { serr += d; });
    for (let i = 0; i < 50 && !(await up()); i++) await sl(200);
    const t0 = Date.now();
    const code = await new Promise(res => {
      const t = spawn(process.execPath, [path.join(CASES, f)], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; t.stdout.on('data', d => { out += d; }); t.stderr.on('data', d => { out += d; });
      const kill = setTimeout(() => { out += '\n(timed out after 240 s)'; t.kill('SIGKILL'); }, 240000);
      t.on('exit', c => { clearTimeout(kill); results.push({ f, ok: c === 0, out, ms: Date.now() - t0 }); res(c); });
    });
    srv.kill();
    const r = results[results.length - 1];
    console.log((r.ok ? '✓ ' : '✗ ') + f.replace('.test.js', '').padEnd(22) + (r.ms / 1000).toFixed(1) + ' s');
    if (!r.ok) console.log('   ' + r.out.trim().split('\n').slice(-25).join('\n   ') + (/ExperimentalWarning/.test(serr) ? '' : serr ? '\n   server: ' + serr.trim().slice(-400) : ''));
    await sl(300);
  }
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed');
  process.exit(bad.length ? 1 : 0);
})();
