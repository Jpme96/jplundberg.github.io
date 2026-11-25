/* Team access (JP 2026-11-16, Documentation): what each role may do, and someone's own role on one project – checked by the
   Worker on every write, and a project someone has no access to never leaves the server. The defaults are today's rules, so
   nobody loses anything until an admin changes them. Runs the real _team/worker.js with its storage in memory. Made-up data only. */
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const { check, done } = require('../lib/check');
(async () => {
  const tmp = path.join(__dirname, '..', '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const copy = path.join(tmp, 'team-access-worker-' + process.pid + '.mjs'); fs.copyFileSync(path.join(__dirname, '..', '..', '_team', 'worker.js'), copy);
  const mod = await import(pathToFileURL(copy).href);
  const mem = new Map(), clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
  const storage = { get: async k => clone(mem.get(k)), put: async (k, v) => { mem.set(k, clone(v)); }, delete: async k => mem.delete(k), deleteAll: async () => mem.clear(),
    list: async ({ prefix = '' } = {}) => new Map([...mem.keys()].filter(k => k.startsWith(prefix)).sort().map(k => [k, clone(mem.get(k))])) };
  const store = new mod.TeamStore({ storage, waitUntil: () => {} }, { ORIGIN: 'http://localhost' });
  const OWNER = 'owner@x.no';
  async function call(email, p, method = 'GET', body) {
    const r = await store.fetch(new Request('https://team/api/' + p, { method, headers: { 'x-email': email, 'x-owner': OWNER, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
    let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j };
  }
  const B = { iv: 'aXZpdml2aXZpdml2', ct: 'Y3RjdGN0Y3RjdGN0' }, PUB = { kty: 'EC', crv: 'P-256', x: 'eA', y: 'eQ' };
  let seq = 0; const rid = k => k + 'made' + (++seq).toString().padStart(6, '0');
  const rec = (k, g, extra) => Object.assign({ id: rid(k), k, e: 1, iv: B.iv, ct: B.ct, v: 0 }, g ? { g } : {}, extra || {});
  /* the team, Kari (Can edit) and a contractor (Can read) */
  check((await call(OWNER, 'setup', 'POST', { name: 'Made-up team', me: { name: 'Owner', pub: PUB, priv: B, wrap: B } })).s === 200, 'the owner sets up the team');
  for (const [em, role] of [['kari@x.no', 'edit'], ['con@x.no', 'read']]) {
    const inv = await call(OWNER, 'invites', 'POST', { role, ttl: '1d', label: 'x' });
    await call(em, 'join', 'POST', { code: inv.j.code, name: em.split('@')[0], pub: PUB, priv: B });
    await call(OWNER, 'approve', 'POST', { email: em, role, keys: { 1: B } });
  }
  const mems = (await call(OWNER, 'members')).j.members.map(m => m.email + ':' + m.role).sort().join();
  check(mems === 'con@x.no:read,kari@x.no:edit,owner@x.no:admin', 'three members ' + mems);
  /* two projects (A and B) and an old record without a project id */
  const pA = rec('dcp', 'ga0000001'), lA = rec('dcl', 'ga0000001'), pB = rec('dcp', 'gb0000002'), lB = rec('dcl', 'gb0000002'), old = rec('dcl');
  const ty = rec('dct');
  const w0 = await call(OWNER, 'batch', 'PUT', { recs: [pA, lA, pB, lB, old, ty] });
  check(w0.s === 200 && w0.j.results.every(r => !r.error), 'the owner writes two projects');
  const seen = async em => (await call(em, 'recs?since=0')).j.recs.map(r => r.id);
  /* the defaults are today's rules: nobody loses anything */
  check((await seen('kari@x.no')).length === 6 && (await seen('con@x.no')).length === 6, 'before any change everyone in the team sees every project');
  const k1 = await call('kari@x.no', 'batch', 'PUT', { recs: [Object.assign({}, lA, { v: 1 })] });
  check(k1.j.results[0].v === 2, 'Can edit changes a line, as before ' + JSON.stringify(k1.j.results[0]));
  check((await call('con@x.no', 'batch', 'PUT', { recs: [rec('dcl', 'ga0000001')] })).s === 403, 'Can read writes nothing, as before');
  const t1 = await call('kari@x.no', 'batch', 'PUT', { recs: [rec('dct')] });
  check(t1.j.results[0].status === 403, 'own project types are for admins by default (JP 15:03 – only admin does the admin things)');
  const d1 = await call('kari@x.no', 'batch', 'PUT', { recs: [{ id: pB.id, k: 'dcp', del: true, v: 1 }] });
  check(d1.j.results[0].status === 403, 'deleting a project is for admins by default');
  check((await call('kari@x.no', 'access', 'POST', { m: {} })).s === 403, 'only admins change access');
  /* the admin changes it: types for Can edit; Kari no access to B; the contractor only on A, as Can edit */
  const sv = await call(OWNER, 'access', 'POST', { m: { types: 'edit' }, pp: { 'kari@x.no': { gb0000002: 'none' }, 'con@x.no': { ga0000001: 'edit' }, 'owner@x.no': { ga0000001: 'none' } }, tr: { 'con@x.no': 'none' } });
  check(sv.s === 200 && sv.j.m.types === 'edit' && sv.j.m.delp === 'admin' && !sv.j.pp['owner@x.no'], 'access is saved; an admin can never be shut out ' + JSON.stringify(sv.j));
  const ks = await seen('kari@x.no'), cs = await seen('con@x.no');
  check(ks.includes(pA.id) && !ks.includes(pB.id) && !ks.includes(lB.id) && ks.includes(old.id), 'Kari no longer receives project B at all ' + ks.length);
  check(cs.length === 3 && cs.includes(pA.id) && cs.includes(lA.id) && cs.includes(ty.id), 'the contractor receives only project A (and the team’s project types) ' + JSON.stringify(cs));
  check((await call('con@x.no', 'batch', 'PUT', { recs: [rec('dcl', 'ga0000001')] })).j.results[0].v === 1, 'the contractor (Can read in the team) adds a line on their own project');
  check((await call('con@x.no', 'batch', 'PUT', { recs: [Object.assign({}, lB, { v: 1 })] })).j.results[0].status === 403, '… but cannot touch project B');
  check((await call('con@x.no', 'rec', 'PUT', rec('meeting'))).s === 403, '… nor the rest of the team (a meeting)');
  check((await call('kari@x.no', 'batch', 'PUT', { recs: [Object.assign({}, lB, { v: 1 })] })).j.results[0].status === 403, 'Kari cannot write to the project she has no access to');
  check(!(await call('kari@x.no', 'batch', 'PUT', { recs: [rec('dct')] })).j.results[0].error, 'with types set to Can edit, Kari saves a project type');
  check((await seen(OWNER)).length >= 8, 'the owner (admin) still sees everything');
  const ka = (await call('kari@x.no', 'access')).j;
  check(!ka.pp['con@x.no'] && ka.pp['kari@x.no'].gb0000002 === 'none' && ka.m.types === 'edit', 'a member reads only their own part of the access list');
  /* an old record learns its project once (an admin's device knows it) */
  check((await call('kari@x.no', 'gtag', 'POST', { g: { [old.id]: 'gb0000002' } })).s === 403, 'only admins tag old records');
  await call(OWNER, 'gtag', 'POST', { g: { [old.id]: 'gb0000002', [pA.id]: 'gb0000002' } });
  const ks2 = await seen('kari@x.no');
  check(!ks2.includes(old.id) && ks2.includes(pA.id), 'a tagged old record follows its project; a record that has one keeps it');
  /* files follow their project too (JP 2026-11-25 16:42): the file record and its pieces never reach someone with no access */
  const fidB = 'b'.repeat(32), fidOld = 'c'.repeat(32), fidT = 'd'.repeat(32);
  check((await call(OWNER, 'fchunk', 'PUT', { fid: fidB, n: 0, iv: B.iv, ct: B.ct, g: 'gb0000002' })).s === 200, 'a project file\'s piece is sent with its project');
  const fB = rec('file', 'gb0000002'); await call(OWNER, 'rec', 'PUT', fB);
  check(!(await seen('kari@x.no')).includes(fB.id) && (await seen(OWNER)).includes(fB.id), 'the file record of project B never reaches Kari (no access), the owner gets it');
  check((await call('kari@x.no', 'fchunk?fid=' + fidB + '&n=0')).s === 404 && (await call(OWNER, 'fchunk?fid=' + fidB + '&n=0')).s === 200, 'Kari can\'t download its pieces either; the owner can');
  check((await call('kari@x.no', 'fchunk', 'PUT', { fid: fidT, n: 0, iv: B.iv, ct: B.ct, g: 'gb0000002' })).s === 403, 'Kari can\'t send a file to project B');
  check((await call('con@x.no', 'fchunk', 'PUT', { fid: fidT, n: 0, iv: B.iv, ct: B.ct, g: 'ga0000001' })).s === 200 && (await call('con@x.no', 'fchunk', 'PUT', { fid: 'e'.repeat(32), n: 0, iv: B.iv, ct: B.ct })).s === 403, 'the contractor (Can read) sends files only to their own project');
  await call(OWNER, 'fchunk', 'PUT', { fid: fidOld, n: 0, iv: B.iv, ct: B.ct });
  check((await call('kari@x.no', 'fchunk?fid=' + fidOld + '&n=0')).s === 200, 'an older piece without a project is there for everyone (as before) …');
  await call(OWNER, 'gtag', 'POST', { g: {}, f: { [fidOld]: 'gb0000002' } });
  check((await call('kari@x.no', 'fchunk?fid=' + fidOld + '&n=0')).s === 404, '… until an admin\'s Team tags it with its project once');
  /* the file suggestions' learning (JP 2026-11-25 16:34 "I don't want other people to see how much it learned"): someone's own votes reach only them and admins; the team's rules follow "codes" */
  const lk = rec('lrn'); check((await call('con@x.no', 'rec', 'PUT', lk)).s === 200, 'anyone (Can read too) keeps their own learning votes');
  check((await seen('con@x.no')).includes(lk.id) && !(await seen('kari@x.no')).includes(lk.id) && (await seen(OWNER)).includes(lk.id), '… which only they and the admins receive');
  check((await call('kari@x.no', 'rec', 'PUT', Object.assign({}, lk, { v: 1 }))).s === 403, 'nobody else writes them');
  const cl = Object.assign(rec('cfg'), { id: 'cfglearn' });
  check((await call(OWNER, 'rec', 'PUT', cl)).s === 200 && (await call('con@x.no', 'rec', 'PUT', Object.assign({}, cl, { v: 1 }))).s === 403, 'the team\'s learned rules are written by whoever keeps the code template');
  /* the server still never holds anything readable */
  /* own codes in file naming (JP 2026-11-25): the team's template follows the "codes" action (admin by default); each person's own list only they write */
  await call(OWNER, 'access', 'POST', { m: {}, pp: {}, tr: {} });
  const tpl = { id: 'cfgncodes', k: 'cfg', e: 1, iv: B.iv, ct: B.ct, v: 0 };
  const kt = await call('kari@x.no', 'batch', 'PUT', { recs: [tpl] });
  check(kt.j.results[0].status === 403, 'Can edit may not change the team\'s code template by default ' + JSON.stringify(kt.j.results[0]));
  const ot = await call(OWNER, 'batch', 'PUT', { recs: [tpl] });
  check(ot.j.results[0].v === 1, 'an admin changes the template ' + JSON.stringify(ot.j.results[0]));
  await call(OWNER, 'access', 'POST', { m: { codes: 'edit' }, pp: {}, tr: {} });
  const kt2 = await call('kari@x.no', 'batch', 'PUT', { recs: [Object.assign({}, tpl, { v: 1 })] });
  check(kt2.j.results[0].v === 2, 'with "codes" set to Can edit, Kari may change it ' + JSON.stringify(kt2.j.results[0]));
  const ko = await call('kari@x.no', 'batch', 'PUT', { recs: [{ id: 'cfgclockxx', k: 'cfg', e: 1, iv: B.iv, ct: B.ct, v: 0 }] });
  check(ko.j.results[0].status === 403, 'but no other team setting');
  await call(OWNER, 'access', 'POST', { m: {}, pp: {}, tr: {} });
  const km = { id: 'mnkari00000000001', k: 'mine', e: 1, iv: B.iv, ct: B.ct, v: 0 }, cm = { id: 'mncon000000000001', k: 'mine', e: 1, iv: B.iv, ct: B.ct, v: 0 };
  const w1 = await call('kari@x.no', 'batch', 'PUT', { recs: [km] }), w2 = await call('con@x.no', 'rec', 'PUT', cm);
  check(w1.j.results[0].v === 1 && w2.j.v === 1, 'everyone keeps their own code list, Can read too ' + JSON.stringify([w1.j.results[0], w2.j]));
  const w3 = await call(OWNER, 'batch', 'PUT', { recs: [Object.assign({}, km, { v: 1 })] });
  check(w3.j.results[0].status === 403, 'nobody else writes someone\'s own list, not even an admin ' + JSON.stringify(w3.j.results[0]));
  const all = JSON.stringify([...mem.entries()]);
  check(!/Made-up line|Made-up project/.test(all), 'the server never sees what was written');
  fs.rmSync(copy, { force: true });
  done();
})();
