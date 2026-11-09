/* tiny assertions: check(condition, what) collects failures; done() prints them and sets the exit code */
const fails = [];
function check(ok, what) { console.log((ok ? '  ok  ' : '  FAIL ') + what); if (!ok) fails.push(what); }
function done(...browsers) { return Promise.all(browsers.filter(Boolean).map(b => b.close().catch(() => {}))).then(() => process.exit(fails.length ? 1 : 0)); }
process.on('unhandledRejection', e => { console.log('  FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
module.exports = { check, done };
