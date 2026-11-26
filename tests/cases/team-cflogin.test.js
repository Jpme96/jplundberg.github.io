/* Team's e-mail login length (Settings → Account): saving must work even when Cloudflare refuses the organization sent back as read
   (JP 2026-11-26 06:53 "Ikke lagret" – invalid_org_config). A fake Cloudflare, made-up ids only. */
const fs = require('fs'); const path = require('path');
const { check, done } = require('../lib/check');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'worker.js'), 'utf8');
const lenM = src.match(/const ACCESS_LEN = \[[^\]]*\];/), fnStart = src.indexOf('async function accessCfg('), fnEnd = src.indexOf('\n}\n', fnStart) + 2;
check(!!lenM && fnStart > 0, 'accessCfg and ACCESS_LEN are in the Team Worker');
const accessCfg = new Function('fetch', lenM[0] + '\n' + src.slice(fnStart, fnEnd) + '\nreturn accessCfg;');

function fakeCf(orgRule) {
  const calls = [];
  const org = { name: 'Made-up org', auth_domain: 'example.cloudflareaccess.com', session_duration: '24h', login_design: { background_color: '', logo_path: null }, user_seat_expiration_inactive_time: '', is_ui_read_only: false, created_at: 'x', updated_at: 'y' };
  const app = { id: 'app1', aud: 'aud1', domain: 'work.example.test', session_duration: '24h', policies: [{ id: 'p1', precedence: 1, name: 'any' }], created_at: 'x' };
  const fetch = async (url, opt) => {
    const m = (opt && opt.method) || 'GET', p = url.replace(/^.*\/access\//, ''), body = opt && opt.body ? JSON.parse(opt.body) : null;
    calls.push({ m, p, body });
    const ok = r => ({ ok: true, json: async () => ({ success: true, result: r }) }), bad = () => ({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: 'access.api.error.invalid_org_config' }] }) });
    if (p.startsWith('apps?')) return ok([app]);
    if (p === 'organizations' && m === 'GET') return ok(org);
    if (p === 'organizations' && m === 'PUT') return orgRule(body) ? ok(body) : bad();
    if (p === 'apps/app1' && m === 'PUT') return ok(body);
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { calls, fetch };
}
const env = { CF_API_TOKEN: 'cfut_madeuptoken0123456789abcdef', CF_ACCOUNT_ID: '0123456789abcdef0123456789abcdef' };
const noEmpty = b => !JSON.stringify(b).includes('""') && !JSON.stringify(b).includes('null');

(async () => {
  /* 1: Cloudflare refuses empty fields – the cleaned organization goes through */
  let f = fakeCf(noEmpty), r = await accessCfg(f.fetch)(env, 'work.example.test', { d: '720h' });
  check(r.ok && r.org !== false, 'saved when the organization is sent without empty fields');
  const appPut = f.calls.findIndex(c => c.p === 'apps/app1' && c.m === 'PUT'), orgPut = f.calls.findIndex(c => c.p === 'organizations' && c.m === 'PUT');
  check(appPut >= 0 && orgPut > appPut, 'the app is saved first, then the organization');
  check(f.calls[appPut].body.session_duration === '720h' && !('id' in f.calls[appPut].body), 'the app gets the new length, without its read-only fields');
  check(f.calls[orgPut].body.session_duration === '720h' && f.calls[orgPut].body.name === 'Made-up org' && !('created_at' in f.calls[orgPut].body), 'the organization keeps its name and gets the length');

  /* 2: Cloudflare refuses every organization body – Team's own length is still saved and the answer says so */
  f = fakeCf(() => false); r = await accessCfg(f.fetch)(env, 'work.example.test', { d: '168h' });
  check(r.ok && r.org === false, 'Team\'s length is kept even when the organization can\'t be changed');
  check(f.calls.some(c => c.p === 'apps/app1' && c.m === 'PUT' && c.body.session_duration === '168h'), 'the app has the new length');

  /* 3: a length that isn't a choice is refused before anything is sent */
  f = fakeCf(() => true); let threw = false; try { await accessCfg(f.fetch)(env, 'work.example.test', { d: '9999h' }); } catch (e) { threw = /bad length/.test(e.message); }
  check(threw && !f.calls.some(c => c.m === 'PUT'), 'an unknown length is refused and nothing is changed');

  /* 4: the app's message for the half-saved case exists in both languages */
  const app = fs.readFileSync(path.join(__dirname, '..', '..', '_team', 'public', 'app.js'), 'utf8');
  check(/r\.org === false/.test(app) && /Lagret for Team/.test(app), 'the app says when only Team\'s length was saved');
  done();
})();
