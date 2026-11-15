/* The test runner's --changed (2026-11-15): picks the tests that touch what changed, plus the quick checks that always run. */
const { execFileSync } = require('child_process'); const path = require('path'); const { check, done } = require('../lib/check');
const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'run.js'), '--changed', 'zz-no-such-test'], { encoding: 'utf8', env: Object.assign({}, process.env, { PORT: String((+process.env.PORT || 8770) + 700) }) });
check(/^changed: \d+ files → 0 tests/m.test(out), 'run.js --changed reports what it picked: ' + out.split('\n')[0]);
done();
