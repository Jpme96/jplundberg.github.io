/* The Team Worker (work.jplundberg.com) – a separate system from /cmd.
   - It has its own storage (one Durable Object, TeamStore) and none of /cmd's bindings or secrets.
   - Cloudflare Access (its own app, email code) only proves WHO someone is; the member list here decides WHAT they get.
   - Everything people write is encrypted on their devices with the team key. The Worker sees only ciphertext,
     ids, kinds, times, version numbers, names, emails and roles.
   - The team key never reaches the Worker: an admin's device wraps it for each member's own public key (ECDH).
   Plain variables in the Cloudflare dashboard (never in the repo): TEAM_DOMAIN, POLICY_AUD, OWNER (the owner's login
   email), ORIGIN (https://work.jplundberg.com). */

const ROLES = ['read', 'edit', 'approve', 'admin'];
const KINDS = /^(meeting|action|note|dcp|dcl|dct|dcr)$/;   /* dc*: Document control and requirements (projects, lines, types, the checklist) */
const ID = /^[a-z0-9]{8,40}$/;
const MAXREC = 900000, MAXLOG = 2000, LOCKMS = 90000, MAXBATCH = 600;
const TTL = { '15m': 15 * 60e3, '1d': 864e5, '7d': 7 * 864e5 };

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('not found', { status: 404 });
    if (!env.TEAM_DOMAIN || !env.POLICY_AUD || !env.OWNER) return json({ error: 'worker not configured' }, 503);
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok || !check.email) return json({ error: 'unauthorized', reason: check.reason || 'no email' }, 401);
    /* writes must come from the Team app itself: a JSON body, our own header and (when the browser says) our own origin */
    if (request.method !== 'GET') {
      const o = request.headers.get('origin');
      if (request.headers.get('x-team') !== '1') return json({ error: 'bad request' }, 400);
      if (o && env.ORIGIN && o !== env.ORIGIN) return json({ error: 'bad origin' }, 403);
    }
    const stub = env.TEAM.get(env.TEAM.idFromName('team'));
    const h = new Headers({ 'content-type': 'application/json', 'x-email': check.email.toLowerCase(), 'x-owner': String(env.OWNER).trim().toLowerCase() });
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
    if (body && body.length > 4000000) return json({ error: 'too big' }, 413);
    return stub.fetch(new Request('https://team' + url.pathname + url.search, { method: request.method, headers: h, body }));
  }
};

/* ---------- the team's storage: one Durable Object, so every change is in order and never lost ---------- */
export class TeamStore {
  constructor(ctx, env) { this.ctx = ctx; this.s = ctx.storage; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url), m = request.method, p = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
    const email = request.headers.get('x-email') || '', owner = request.headers.get('x-owner') || '';
    let b = {};
    if (m !== 'GET' && m !== 'DELETE') { try { b = JSON.parse((await request.text()) || '{}') || {}; } catch (e) { return json({ error: 'bad json' }, 400); } }
    const team = await this.s.get('team');
    const me = await this.s.get('m:' + email);
    const rank = me ? ROLES.indexOf(me.role) : -1;
    const isAdmin = rank >= 3;
    try {
      if (p === 'me' && m === 'GET') return this.meInfo(email, owner, team, me);
      if (p === 'setup' && m === 'POST') return this.setup(email, owner, team, b);
      if (!team) return json({ error: 'no team yet' }, 404);
      if (p === 'join' && m === 'POST') return this.join(email, me, b);
      if (p === 'join' && m === 'DELETE') { await this.s.delete('q:' + email); return json({ ok: true }); }
      if (!me) return json({ error: 'not a member' }, 403);
      await this.touch(me);
      if (p === 'priv' && m === 'POST') { if (!blob(b.priv)) return json({ error: 'bad key' }, 400); me.priv = b.priv; await this.s.put('m:' + email, me); return json({ ok: true }); }
      if (p === 'members' && m === 'GET') return this.members(isAdmin);
      if (p === 'recs' && m === 'GET') return this.recs(url, team);
      if (p === 'rec' && m === 'PUT') { if (rank < 1) return json({ error: 'read only' }, 403); return this.putRec(email, me, team, b); }
      if (p === 'batch' && m === 'PUT') { if (rank < 1) return json({ error: 'read only' }, 403); return this.batch(email, me, team, b); }
      if (p === 'lock' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); return this.lock(email, b); }
      if (p === 'log' && m === 'GET') return this.logList(url);
      if (!isAdmin) return json({ error: 'admins only' }, 403);
      if (p === 'invites' && m === 'POST') return this.invite(email, b);
      if (p === 'invites' && m === 'GET') return this.invites();
      if (p === 'invites' && m === 'DELETE') { const id = url.searchParams.get('id') || ''; if (!/^[a-f0-9]{16}$/.test(id)) return json({ error: 'bad id' }, 400); for (const [k, v] of await this.s.list({ prefix: 'i:' })) if (k.slice(2, 18) === id) await this.s.delete(k); return json({ ok: true }); }
      if (p === 'approve' && m === 'POST') return this.approve(email, team, b);
      if (p === 'decline' && m === 'POST') { const q = await this.s.get('q:' + low(b.email)); if (!q) return json({ error: 'no request' }, 404); await this.s.delete('q:' + q.email); await this.log(email, 'decline', { who: q.email, name: q.name }); return json({ ok: true }); }
      if (p === 'role' && m === 'POST') return this.setRole(email, owner, b);
      if (p === 'remove' && m === 'POST') return this.remove(email, owner, team, b);
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'server error' }, 500); }
  }

  async touch(me) { const now = Date.now(); if (!me.seen || now - me.seen > 300e3) { me.seen = now; await this.s.put('m:' + me.email, me); } }

  async meInfo(email, owner, team, me) {
    const out = { email, isOwner: !!owner && email === owner, team: team ? { name: team.name, epoch: team.epoch } : null };
    if (me) { await this.touch(me); out.member = { name: me.name, role: me.role, pub: me.pub, priv: me.priv, keys: me.keys }; }
    else if (team) { const q = await this.s.get('q:' + email); if (q) out.pending = { name: q.name, at: q.at, pub: q.pub, priv: q.priv }; }
    return json(out);
  }

  /* the owner (OWNER in the dashboard) makes the team once, from their own device */
  async setup(email, owner, team, b) {
    if (team) return json({ error: 'the team exists' }, 409);
    if (!owner || email !== owner) return json({ error: 'only the owner can set up the team' }, 403);
    const name = str(b.name, 60), mn = str(b.me && b.me.name, 60);
    if (!name || !mn || !jwk(b.me.pub) || !blob(b.me.priv) || !blob(b.me.wrap)) return json({ error: 'missing parts' }, 400);
    await this.s.put('team', { name, epoch: 1, created: Date.now() });
    await this.s.put('m:' + email, { email, name: mn, role: 'admin', pub: b.me.pub, priv: b.me.priv, keys: { 1: b.me.wrap }, joined: Date.now(), seen: Date.now() });
    await this.log(email, 'setup', {});
    return json({ ok: true });
  }

  /* an invite: a random code that works once and runs out; only its hash is kept */
  async invite(email, b) {
    const role = ROLES.includes(b.role) && b.role !== 'admin' ? b.role : 'edit';
    const ttl = TTL[b.ttl] || TTL['15m'];
    const code = hex(crypto.getRandomValues(new Uint8Array(16)));
    const h = await sha(code), now = Date.now();
    for (const [k, v] of await this.s.list({ prefix: 'i:' })) if (v.exp < now) await this.s.delete(k);
    await this.s.put('i:' + h, { by: email, at: now, exp: now + ttl, role, label: str(b.label, 60) });
    await this.log(email, 'invite', { role });
    return json({ code, exp: now + ttl, role });
  }
  async invites() {
    const now = Date.now(), out = [];
    for (const [k, v] of await this.s.list({ prefix: 'i:' })) { if (v.exp < now) { await this.s.delete(k); continue; } out.push({ id: k.slice(2, 18), exp: v.exp, role: v.role, label: v.label || '', by: v.by }); }
    return json({ invites: out });
  }

  /* someone opens an invite and signs in: their request waits for an admin; the code is used up */
  async join(email, me, b) {
    if (me) return json({ error: 'already a member' }, 409);
    if (typeof b.code !== 'string' || !/^[a-f0-9]{32}$/.test(b.code)) return json({ error: 'bad invite' }, 400);
    const k = 'i:' + await sha(b.code), inv = await this.s.get(k);
    if (!inv || inv.exp < Date.now()) { if (inv) await this.s.delete(k); return json({ error: 'this invite has run out or was used' }, 410); }
    const name = str(b.name, 60);
    if (!name || !jwk(b.pub) || !blob(b.priv)) return json({ error: 'missing parts' }, 400);
    await this.s.delete(k);
    await this.s.put('q:' + email, { email, name, pub: b.pub, priv: b.priv, at: Date.now(), role: inv.role, by: inv.by });
    await this.log(email, 'request', {});
    return json({ ok: true });
  }

  async members(isAdmin) {
    const ms = [], qs = [];
    for (const [, v] of await this.s.list({ prefix: 'm:' })) ms.push({ email: v.email, name: v.name, role: v.role, seen: v.seen || 0, joined: v.joined || 0, pub: isAdmin ? v.pub : undefined, epochs: isAdmin ? Object.keys(v.keys || {}).map(Number) : undefined });
    if (isAdmin) for (const [, v] of await this.s.list({ prefix: 'q:' })) qs.push({ email: v.email, name: v.name, pub: v.pub, at: v.at, role: v.role });
    return json({ members: ms, requests: isAdmin ? qs : undefined });
  }

  /* approve: the admin's device sends the team key(s), each wrapped for the new member's public key */
  async approve(email, team, b) {
    const q = await this.s.get('q:' + low(b.email));
    if (!q) return json({ error: 'no request' }, 404);
    const role = ROLES.includes(b.role) ? b.role : q.role || 'edit';
    const keys = b.keys && typeof b.keys === 'object' ? b.keys : null;
    if (!keys || !blob(keys[team.epoch])) return json({ error: 'the team key for this member is missing' }, 400);
    for (const e of Object.keys(keys)) if (!/^\d{1,4}$/.test(e) || +e > team.epoch || !blob(keys[e])) return json({ error: 'bad key' }, 400);
    await this.s.delete('q:' + q.email);
    await this.s.put('m:' + q.email, { email: q.email, name: q.name, role, pub: q.pub, priv: q.priv, keys, joined: Date.now(), seen: 0 });
    await this.log(email, 'approve', { who: q.email, name: q.name, role });
    return json({ ok: true });
  }

  async setRole(email, owner, b) {
    const t = await this.s.get('m:' + low(b.email));
    if (!t) return json({ error: 'no such member' }, 404);
    if (!ROLES.includes(b.role)) return json({ error: 'bad role' }, 400);
    if (t.email === owner && b.role !== 'admin') return json({ error: 'the owner stays admin' }, 409);
    if (t.role === 'admin' && b.role !== 'admin' && (await this.admins()) < 2) return json({ error: 'the team needs an admin' }, 409);
    t.role = b.role; await this.s.put('m:' + t.email, t);
    await this.log(email, 'role', { who: t.email, name: t.name, role: b.role });
    return json({ ok: true });
  }
  async admins() { let n = 0; for (const [, v] of await this.s.list({ prefix: 'm:' })) if (v.role === 'admin') n++; return n; }

  /* remove: they get nothing more at once, and the team moves to a new key that only the others get */
  async remove(email, owner, team, b) {
    const who = low(b.email), t = await this.s.get('m:' + who);
    if (!t) return json({ error: 'no such member' }, 404);
    if (who === owner) return json({ error: 'the owner cannot be removed' }, 409);
    if (t.role === 'admin' && (await this.admins()) < 2) return json({ error: 'the team needs an admin' }, 409);
    const r = b.rotate || {}, next = team.epoch + 1;
    if (r.epoch !== next || !r.keys || typeof r.keys !== 'object') return json({ error: 'a new team key is needed' }, 400);
    const rest = [];
    for (const [, v] of await this.s.list({ prefix: 'm:' })) if (v.email !== who) rest.push(v);
    for (const v of rest) if (!blob(r.keys[v.email])) return json({ error: 'the new key is missing for a member' }, 400);
    await this.s.delete('m:' + who);
    for (const v of rest) { v.keys = Object.assign({}, v.keys, { [next]: r.keys[v.email] }); await this.s.put('m:' + v.email, v); }
    team.epoch = next; await this.s.put('team', team);
    for (const [k, v] of await this.s.list({ prefix: 'lock:' })) if (v.by === who) await this.s.delete(k);
    await this.log(email, 'remove', { who, name: t.name });
    return json({ ok: true, epoch: next });
  }

  async recs(url, team) {
    const since = +url.searchParams.get('since') || 0, out = [];
    for (const [, v] of await this.s.list({ prefix: 'r:' })) if (v.seq > since) out.push(v);
    const locks = {}, now = Date.now();
    for (const [k, v] of await this.s.list({ prefix: 'lock:' })) if (v.until > now) locks[k.slice(5)] = v; else await this.s.delete(k);
    return json({ seq: (await this.s.get('seq')) || 0, epoch: team.epoch, recs: out, locks });
  }

  /* a record: saved only if nobody saved it since you read it (v), never while someone else is writing in it */
  async putRec(email, me, team, b) {
    const r = await this.applyRec(email, me, team, b);
    if (r.error) return json(r, r.status);
    await this.log(email, r.a, { k: b.k, id: b.id, s: logSum(b.s) });
    return json({ ok: true, v: r.v, seq: r.seq, t: r.t });
  }
  /* many records in one go (Document control: a project and its lines). Each is checked on its own; one log line. */
  async batch(email, me, team, b) {
    const list = Array.isArray(b.recs) ? b.recs : null;
    if (!list || !list.length || list.length > MAXBATCH) return json({ error: 'bad batch' }, 400);
    const out = []; let n = 0;
    for (const x of list) { const r = await this.applyRec(email, me, team, x || {}); out.push(r.error ? { id: x && x.id, error: r.error, status: r.status, rec: r.rec } : { id: x.id, v: r.v, seq: r.seq, t: r.t }); if (!r.error) n++; }
    if (n) await this.log(email, 'batch', { k: String(list[0].k || ''), n, s: logSum(b.s) });
    return json({ ok: true, results: out });
  }
  async applyRec(email, me, team, b) {
    if (typeof b.id !== 'string' || !ID.test(b.id) || typeof b.k !== 'string' || !KINDS.test(b.k)) return { error: 'bad record', status: 400 };
    const del = !!b.del;
    if (!del && (!blob(b) || b.ct.length > MAXREC)) return { error: 'bad record', status: 400 };
    if (!del && (!Number.isInteger(b.e) || b.e < 1 || b.e > team.epoch || !me.keys[b.e])) return { error: 'old key', status: 409 };
    const lk = await this.s.get('lock:' + (b.lockId || b.id));
    if (lk && lk.until > Date.now() && lk.by !== email) return { error: 'someone is writing', by: lk.by, status: 423 };
    const old = await this.s.get('r:' + b.id);
    if (old && old.k !== b.k) return { error: 'bad record', status: 400 };
    if ((old ? old.v : 0) !== (b.v | 0)) return { error: 'changed meanwhile', rec: old, status: 409 };
    if (old) await this.s.put('h:' + b.id + ':' + old.v, old);   /* history: nothing is truly gone */
    const seq = ((await this.s.get('seq')) || 0) + 1;
    const rec = del ? Object.assign({}, old || { id: b.id, k: b.k }, { del: 1, v: (old ? old.v : 0) + 1, t: Date.now(), by: email, seq })
      : { id: b.id, k: b.k, e: b.e, iv: b.iv, ct: b.ct, v: (old ? old.v : 0) + 1, t: Date.now(), by: email, seq };
    if (!del) delete rec.del;
    await this.s.put('r:' + b.id, rec); await this.s.put('seq', seq);
    return { v: rec.v, seq, t: rec.t, a: del ? 'del' : old ? (old.del ? 'restore' : 'edit') : 'new' };
  }

  async lock(email, b) {
    if (typeof b.id !== 'string' || !ID.test(b.id)) return json({ error: 'bad id' }, 400);
    const k = 'lock:' + b.id, cur = await this.s.get(k), now = Date.now();
    if (cur && cur.until > now && cur.by !== email) return json({ ok: false, by: cur.by, until: cur.until }, 423);
    if (b.on === false) { if (cur && cur.by === email) await this.s.delete(k); return json({ ok: true }); }
    const l = { by: email, until: now + LOCKMS }; await this.s.put(k, l);
    return json({ ok: true, until: l.until });
  }

  /* the change log: only ever added to – there is no way to edit or remove a line */
  async log(email, a, x) {
    const n = ((await this.s.get('lseq')) || 0) + 1;
    await this.s.put('l:' + String(n).padStart(9, '0'), Object.assign({ n, t: Date.now(), by: email, a }, clean(x)));
    await this.s.put('lseq', n);
    if (n > MAXLOG) { const old = 'l:' + String(n - MAXLOG).padStart(9, '0'); await this.s.delete(old); }
  }
  async logList(url) {
    const before = +url.searchParams.get('before') || 0, lim = Math.min(200, +url.searchParams.get('n') || 100);
    const opt = { prefix: 'l:', reverse: true, limit: lim };
    if (before) opt.end = 'l:' + String(before).padStart(9, '0');
    const out = []; for (const [, v] of await this.s.list(opt)) out.push(v);
    return json({ log: out });
  }
}

/* ---------- small helpers ---------- */
function low(s) { return String(s || '').trim().toLowerCase(); }
function str(s, n) { return typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : ''; }
function blob(o) { return !!o && typeof o.iv === 'string' && typeof o.ct === 'string' && o.iv.length < 64 && /^[A-Za-z0-9+/=_-]+$/.test(o.ct + o.iv); }
function jwk(o) { return !!o && o.kty === 'EC' && o.crv === 'P-256' && typeof o.x === 'string' && typeof o.y === 'string' && !o.d; }
function logSum(s) { return blob(s) && s.ct.length < 2000 ? { e: s.e, iv: s.iv, ct: s.ct } : undefined; }
function clean(x) { const o = {}; for (const k in x) if (x[k] !== undefined) o[k] = x[k]; return o; }
function hex(u) { return [...u].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function sha(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }

/* ---- Cloudflare Access token check (RS256 JWT), as in the /cmd Worker ---- */
let certCache = { at: 0, keys: [] };
async function verifyAccess(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, reason: 'no Access token' };
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return { ok: false, reason: 'malformed token' };
  const header = JSON.parse(dec(h)), payload = JSON.parse(dec(p));
  const team = env.TEAM_DOMAIN.trim().replace(/\/+$/, ''), wantAud = env.POLICY_AUD.trim();
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== team) return { ok: false, reason: 'TEAM_DOMAIN does not match' };
  if (!aud.includes(wantAud)) return { ok: false, reason: 'POLICY_AUD does not match' };
  if (!payload.exp || payload.exp * 1000 < Date.now()) return { ok: false, reason: 'login expired, reload the page' };
  if (Date.now() - certCache.at > 3600e3 || !certCache.keys.some(k => k.kid === header.kid)) {
    const res = await fetch(team + '/cdn-cgi/access/certs');
    certCache = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const k = certCache.keys.find(x => x.kid === header.kid);
  if (!k) return { ok: false, reason: 'signing key not found' };
  const { alg, use, kid, ...pub } = k;
  const key = await crypto.subtle.importKey('jwk', pub, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(s), new TextEncoder().encode(h + '.' + p));
  return valid ? { ok: true, email: payload.email ? String(payload.email) : '' } : { ok: false, reason: 'bad signature' };
}
function b64url(s) { return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='); }
function dec(s) { return new TextDecoder().decode(bytes(s)); }
function bytes(s) { return Uint8Array.from(atob(b64url(s)), c => c.charCodeAt(0)); }
