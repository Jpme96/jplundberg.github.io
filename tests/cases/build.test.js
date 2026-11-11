/* The built bundles match the sources, the shared app's two version numbers match, and the Worker parses. */
const { execSync } = require('child_process'); const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const R = path.join(__dirname, '..', '..');
let ok = true, why = ''; try { execSync('python3 cmd/build.py --check', { cwd: R, stdio: 'pipe' }); } catch (e) { ok = false; why = String(e.stdout || '').split('\n').filter(l => /out of date/.test(l)).slice(0, 5).join('; '); }
check(ok, 'cmd bundles are up to date (python3 cmd/build.py --check)' + (why ? ' – ' + why : ''));
const app = fs.readFileSync(path.join(R, 'cmd/home/app.js'), 'utf8'), html = fs.readFileSync(path.join(R, 'cmd/home/index.html'), 'utf8');
const a = (app.match(/var APPV = (\d+)/) || [])[1], h = (html.match(/home\/app\.js\?v=(\d+)/) || [])[1];
check(a && a === h, 'shared app version matches (APPV ' + a + ', index.html ' + h + ')');
let w = true; try { execSync('node --check _cloudflare/worker.js', { cwd: R, stdio: 'pipe' }); } catch (e) { w = false; }
check(w, 'the Worker parses');
let ic = true; try { execSync('python3 cmd/icons.py --check', { cwd: R, stdio: 'pipe' }); } catch (e) { ic = false; }
check(ic, 'every icon cmd uses is in its icon set (python3 cmd/icons.py)');
const cfg = fs.readFileSync(path.join(R, '_cloudflare/wrangler.jsonc'), 'utf8');
check(/"LiveRoom"/.test(cfg) && /"FILES"/.test(cfg) && /"DB"/.test(cfg) && /"VAULT"/.test(cfg) && /keep_vars"\s*:\s*true/.test(cfg), 'wrangler.jsonc keeps all bindings and keep_vars');
done();
