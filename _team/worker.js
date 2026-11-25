/* The Team Worker (work.jplundberg.com) – a separate system from /cmd.
   - It has its own storage (one Durable Object, TeamStore) and none of /cmd's bindings or secrets.
   - Cloudflare Access (its own app, email code) only proves WHO someone is; the member list here decides WHAT they get.
   - Everything people write is encrypted on their devices with the team key. The Worker sees only ciphertext,
     ids, kinds, times, version numbers, names, emails and roles.
   - The team key never reaches the Worker: an admin's device wraps it for each member's own public key (ECDH).
   Plain variables in the Cloudflare dashboard (never in the repo): TEAM_DOMAIN, POLICY_AUD, OWNER (the owner's login
   email), ORIGIN (https://work.jplundberg.com). */

const ROLES = ['read', 'edit', 'approve', 'admin'];
const KINDS = /^(meeting|action|note|dcp|dcl|dct|dcr|dcf|dce|insp|file|upl|clk|cfg|mine|lrn)$/;   /* clk = one clock-in/out (Phase G, 2026-11-15: anyone in the team clocks themselves, only their own), cfg = team settings only admins write (cfgclock: clocking on/off for the team and per person) */   /* file = a shared file (its bytes are encrypted chunks f:<fid>:<n>), upl = an upload link for a contractor (its key stays in the record) */   /* insp = a building inspection shared from /cmd */   /* dc*: Document control and requirements (projects, lines, types, the checklist; dcf = a plan file, dce = Excel edits) */
const ID = /^[a-z0-9]{8,40}$/, TID = /^(team|[a-z0-9]{12})$/, GID = /^[a-z0-9]{4,40}$/;
/* Access (JP 2026-11-16, Documentation): who may do what. ACTS = the lowest role each action needs by default (today's rules);
   an admin can change them, and give a person another role – or none – on one project. A project is a group id (g) the app
   puts on its records, so the Worker never needs to read them. Admins and the owner always have everything. */
const ACTS = { newp: 'edit', delp: 'admin', edit: 'edit', send: 'edit', import: 'edit', na: 'edit', approve: 'approve', types: 'admin', rules: 'admin', codes: 'admin' };   /* codes: the team's code template in file naming (JP 2026-11-25) */
const PROLES = ['none'].concat(['read', 'edit', 'approve', 'admin']);
const MAXREC = 900000, MAXLOG = 2000, LOCKMS = 90000, MAXBATCH = 600;
const TTL = { '15m': 15 * 60e3, '1d': 864e5, '7d': 7 * 864e5 };
const FID = /^[a-f0-9]{20,32}$/, LID = /^[a-f0-9]{16}$/, MAXCHUNK = 1500000, MAXCHUNKS = 60, TEAMBYTES = 10e9, LINKBYTES = 1e9, LINKFILES = 300;

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('not found', { status: 404 });
    /* a contractor's upload link (jplundberg.com/upload/ → the /cmd Worker → here): no sign-in – the link itself is the permission,
       and what is uploaded is already encrypted with the link's key, which never reaches a server (it is in the #part of the link) */
    const up = url.pathname.match(/^\/api\/up\/(team|[a-z0-9]{12})\/([a-f0-9]{16})\/(info|list|chunk|done|needs)$/);
    if (up) {
      if (up[1] !== 'team') { const ok = await (await env.TEAM.get(env.TEAM.idFromName('dir')).fetch(new Request('https://team/dir/has?id=' + up[1]))).json(); if (!ok.has) return json({ error: 'this link does not work' }, 404); }
      const body = request.method === 'GET' ? undefined : await request.text();
      if (body && body.length > 2200000) return json({ error: 'too big' }, 413);
      return env.TEAM.get(env.TEAM.idFromName(up[1])).fetch(new Request('https://team/up/' + up[2] + '/' + up[3], { method: request.method, headers: { 'content-type': 'application/json' }, body }));
    }
    if (url.pathname.startsWith('/api/up/')) return json({ error: 'not found' }, 404);
    /* Team's error lines for cmd's error list (2026-11-20, JP): only the /cmd Worker asks, over its service binding –
       a request from the internet always carries work.jplundberg.com, never the host 'internal' */
    if (url.pathname === '/api/errlog-internal') {
      if (url.hostname !== 'internal') return json({ error: 'not found' }, 404);
      return env.TEAM.get(env.TEAM.idFromName('dir')).fetch(new Request('https://team/dir/errlog', { method: request.method === 'DELETE' ? 'DELETE' : 'GET' }));
    }
    if (!env.TEAM_DOMAIN || !env.POLICY_AUD || !env.OWNER) return json({ error: 'worker not configured' }, 503);
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok || !check.email) return json({ error: 'unauthorized', reason: check.reason || 'no email' }, 401);
    /* writes must come from the Team app itself: a JSON body, our own header and (when the browser says) our own origin */
    if (request.method !== 'GET') {
      const o = request.headers.get('origin');
      if (request.headers.get('x-team') !== '1') return json({ error: 'bad request' }, 400);
      if (o && env.ORIGIN && o !== env.ORIGIN) return json({ error: 'bad origin' }, 403);
    }
    const email = check.email.toLowerCase(), owner = String(env.OWNER).trim().toLowerCase();
    const h = new Headers({ 'content-type': 'application/json', 'x-email': email, 'x-owner': owner });
    /* more than one team: each team is its own Durable Object (its own members, invites, key and records).
       The first team keeps the name 'team'; a list of the others lives in the Durable Object 'dir'. */
    const dir = env.TEAM.get(env.TEAM.idFromName('dir'));
    if (url.pathname === '/api/teams') {
      if (request.method === 'POST') {
        if (email !== owner) return json({ error: 'only the owner can make a team' }, 403);
        return dir.fetch(new Request('https://team/dir/add', { method: 'POST', headers: h, body: '{}' }));
      }
      if (request.method !== 'GET') return json({ error: 'not found' }, 404);
      const ids = ['team'].concat((await (await dir.fetch(new Request('https://team/dir/list', { headers: h }))).json()).ids || []);
      const out = [];
      await Promise.all(ids.map(async (id, i) => {
        const r = await (await env.TEAM.get(env.TEAM.idFromName(id)).fetch(new Request('https://team/api/me', { headers: h }))).json().catch(() => ({}));
        const role = r.member ? r.member.role : r.pending ? 'pending' : '';
        if (role || (email === owner && (id !== 'team' || r.team))) out[i] = { id, name: r.team ? r.team.name : '', role, ready: !!r.team };
      }));
      return json({ teams: out.filter(Boolean), owner: email === owner });
    }
    if (url.pathname === '/api/teams/delete' && request.method === 'POST') {   /* the owner deletes a team: everything in it is gone (asked twice in the app) */
      if (email !== owner) return json({ error: 'only the owner can delete a team' }, 403);
      const b = await request.json().catch(() => ({})), id = String(b.id || '');
      if (!TID.test(id)) return json({ error: 'bad team' }, 400);
      if (id !== 'team') { const ok = await (await dir.fetch(new Request('https://team/dir/has?id=' + id, { headers: h }))).json(); if (!ok.has) return json({ error: 'no such team' }, 404); }
      const r = await env.TEAM.get(env.TEAM.idFromName(id)).fetch(new Request('https://team/api/wipe', { method: 'POST', headers: h, body: JSON.stringify({ confirm: b.confirm }) }));
      if (!r.ok) return r;
      if (id !== 'team') await dir.fetch(new Request('https://team/dir/del?id=' + id, { method: 'POST', headers: h }));
      return json({ ok: true });
    }
    /* the app's error lines (masked in the app and again here; never who it was) – kept in 'dir' for 21 days */
    if (url.pathname === '/api/errlog' && request.method === 'POST') {
      const eb = await request.text(); if (eb.length > 40000) return json({ error: 'too big' }, 413);
      return dir.fetch(new Request('https://team/dir/errlog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: eb }));
    }
    const tid = request.headers.get('x-tid') || 'team';
    if (!TID.test(tid)) return json({ error: 'bad team' }, 400);
    if (tid !== 'team') { const ok = await (await dir.fetch(new Request('https://team/dir/has?id=' + tid, { headers: h }))).json(); if (!ok.has) return json({ error: 'no such team' }, 404); }
    const stub = env.TEAM.get(env.TEAM.idFromName(tid));
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
    if (body && body.length > 4000000) return json({ error: 'too big' }, 413);
    return stub.fetch(new Request('https://team' + url.pathname + url.search, { method: request.method, headers: h, body }));
  }
};

/* ---------- the team's storage: one Durable Object, so every change is in order and never lost ---------- */
export class TeamStore {
  constructor(ctx, env) { this.ctx = ctx; this.s = ctx.storage; this.env = env; }

  /* ---------- file pieces (JP 2026-11-24: 10 GB per team, project files shared with the team) ----------
     Encrypted pieces live in R2 (binding FILES, bucket team-files) under this team's own prefix; a team's database holds at most 10 GB
     in all, so files can't stay there. Pieces from before are read from the database and moved over a few at a time (moveSome).
     Without the FILES binding everything works as before, in the database. */
  ckey(fid, n) { return 't/' + this.ctx.id.toString() + '/f/' + fid + '/' + n; }
  async cGet(fid, n) {
    if (this.env && this.env.FILES) { const o = await this.env.FILES.get(this.ckey(fid, n)); if (o) return await o.json(); }
    return (await this.s.get('f:' + fid + ':' + n)) || null;
  }
  async cPut(fid, n, v) {
    if (this.env && this.env.FILES) { await this.env.FILES.put(this.ckey(fid, n), JSON.stringify(v)); await this.s.delete('f:' + fid + ':' + n); }
    else await this.s.put('f:' + fid + ':' + n, v);
  }
  async cDel(fid, n) { if (this.env && this.env.FILES) await this.env.FILES.delete(this.ckey(fid, n)); await this.s.delete('f:' + fid + ':' + n); }
  async moveSome() {
    if (!this.env || !this.env.FILES || this.moving || (await this.s.get('fmoved'))) return; this.moving = true;
    try { const m = await this.s.list({ prefix: 'f:', limit: 20 }); if (!m.size) { await this.s.put('fmoved', Date.now()); return; }
      for (const [k, v] of m) { const q = k.split(':'); await this.env.FILES.put(this.ckey(q[1], q[2]), JSON.stringify(v)); await this.s.delete(k); } }
    catch (e) {} finally { this.moving = false; }
  }
  async wipeFiles() {
    if (!this.env || !this.env.FILES) return; const pre = 't/' + this.ctx.id.toString() + '/'; let cur;
    for (let i = 0; i < 2000; i++) { const l = await this.env.FILES.list({ prefix: pre, cursor: cur, limit: 1000 }); if (l.objects.length) await this.env.FILES.delete(l.objects.map(o => o.key)); if (!l.truncated) break; cur = l.cursor; }
  }
  /* a project's delivered file leaves the project: its pieces go too (only pieces of the team's own uploads – never an upload link's) */
  async delChunks(email, b) {
    const fid = String(b.fid || ''), n = Math.min(MAXCHUNKS, Math.max(0, b.n | 0)); if (!FID.test(fid)) return json({ error: 'bad file' }, 400);
    let used = (await this.s.get('fbytes')) || 0, gone = 0;
    for (let i = 0; i < n; i++) { const c = await this.cGet(fid, i); if (!c) continue; if (String(c.by || '').indexOf('link:') === 0) return json({ error: 'not yours' }, 403); used -= (c.ct || '').length; await this.cDel(fid, i); gone++; }
    if (gone && gone >= n) await this.s.delete('fg:' + fid);
    await this.s.put('fbytes', Math.max(0, used)); return json({ ok: true, gone });
  }

  async fetch(request) {
    const url = new URL(request.url), m = request.method, p = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
    if (p.startsWith('/dir/')) return this.dir(p.slice(5), url, request);   /* only the Durable Object 'dir' is ever asked these */
    if (p.startsWith('/up/')) { try { return await this.upPublic(p.slice(4), m, request, url); } catch (e) { return json({ error: 'server error' }, 500); } }
    if (!this.noLog) { this.noLog = 1; if (!(await this.s.get('nolog'))) { await this.wipeLog(); await this.s.put('nolog', 1); } }   /* no change log any more – the old lines go once (JP 2026-11-24 22:57, asked and approved) */
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
      const acc = await this.access();
      const elev = !!(acc.pp[email] && Object.values(acc.pp[email]).some(r => ROLES.indexOf(r) >= 1));   /* someone with a project of their own to work on */
      if (p === 'access' && m === 'GET') return json(isAdmin ? acc : { m: acc.m, pp: { [email]: acc.pp[email] || {} }, tr: { [email]: acc.tr[email] || '' } });
      if (p === 'access' && m === 'POST') { if (!isAdmin) return json({ error: 'admins only' }, 403); return this.setAccess(email, b); }
      /* older Documentation records get their project's group id once (an admin's device knows it; the Worker can't read them) */
      if (p === 'gtag' && m === 'POST') { if (!isAdmin) return json({ error: 'admins only' }, 403); let n = 0; for (const id of Object.keys(b.g || {}).slice(0, 20000)) { const g = b.g[id]; if (!ID.test(id) || typeof g !== 'string' || !GID.test(g)) continue; const r = await this.s.get('r:' + id); if (r && !r.g && /^(dcp|dcl|dcf|dce|file)$/.test(r.k)) { r.g = g; await this.s.put('r:' + id, r); n++; } } for (const fid of Object.keys(b.f || {}).slice(0, 20000)) { const g = b.f[fid]; if (!FID.test(fid) || typeof g !== 'string' || !GID.test(g) || (await this.s.get('fg:' + fid))) continue; await this.s.put('fg:' + fid, g); n++; } return json({ ok: true, n }); }
      if (p === 'recs' && m === 'GET') return this.recs(url, team, email, me, acc);
      if (p === 'rec' && m === 'PUT') { if (rank < 1 && b.k !== 'clk' && b.k !== 'mine' && b.k !== 'lrn' && !elev) return json({ error: 'read only' }, 403); return this.putRec(email, me, team, b, acc); }
      if (p === 'batch' && m === 'PUT') { if (rank < 1 && !elev) return json({ error: 'read only' }, 403); return this.batch(email, me, team, b, acc); }
      if (p === 'lock' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); return this.lock(email, b); }
      if (p === 'log' && m === 'GET') return this.logList(url);
      if (p === 'fchunk' && m === 'GET') return this.getChunk(url, me, acc);
      if (p === 'fchunk' && m === 'PUT') { if (rank < 1 && !elev) return json({ error: 'read only' }, 403); return this.putChunk(email, b, me, acc); }
      if (p === 'fdel' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); return this.delChunks(email, b); }
      if (p === 'push' && m === 'GET') return json({ key: (await this.vapid()).pub });
      if (p === 'push' && m === 'POST') return this.pushSub(email, b);
      if (p === 'uploads' && m === 'GET') return this.uploads(url);
      /* remove what came in on a link (testing, or junk): a file already kept in the shared files is only taken off the list */
      if (p === 'uprm' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); return this.upRemove(email, b); }
      /* the change log can be emptied by an admin (JP, while testing) – one line says who did it */
      if (p === 'log' && m === 'DELETE') { if (rank < 3) return json({ error: 'admins only' }, 403); return this.logReset(email); }
      if (p === 'upkept' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); const lid = String(b.lid || ''), fids = Array.isArray(b.fids) ? b.fids.slice(0, 300) : []; if (!LID.test(lid)) return json({ error: 'bad link' }, 400); for (const fid of fids) { if (!FID.test(String(fid))) continue; const k = 'uf:' + lid + ':' + fid, f = await this.s.get(k); if (f && !f.kept) { f.kept = Date.now(); await this.s.put(k, f); } } return json({ ok: true }); }
      if (p === 'uplink' && m === 'POST') { if (rank < 1) return json({ error: 'read only' }, 403); return this.upLink(email, b); }
      /* the contractor's live list: the app sends the project's missing documents, already encrypted with the link's key */
      if (p === 'upneeds' && m === 'POST') {
        if (rank < 1) return json({ error: 'read only' }, 403);
        const lid = String(b.lid || ''); if (!LID.test(lid) || !blob(b) || b.ct.length > 160000) return json({ error: 'bad list' }, 400);
        const l = await this.s.get('u:' + lid); if (!l) return json({ error: 'no such link' }, 404);
        l.needs = { iv: b.iv, ct: b.ct }; l.needsAt = Date.now(); await this.s.put('u:' + lid, l);
        return json({ ok: true, at: l.needsAt });
      }
      if (p === 'uplink' && m === 'DELETE') { if (rank < 1) return json({ error: 'read only' }, 403); const lid = url.searchParams.get('lid') || ''; if (!LID.test(lid)) return json({ error: 'bad link' }, 400); const l = await this.s.get('u:' + lid); if (l) { l.exp = Math.min(l.exp, Date.now()); l.off = 1; await this.s.put('u:' + lid, l); await this.log(email, 'uplink-off', {}); } return json({ ok: true }); }
      if (!isAdmin) return json({ error: 'admins only' }, 403);
      if (p === 'invites' && m === 'POST') return this.invite(email, b);
      if (p === 'invites' && m === 'GET') return this.invites();
      if (p === 'invites' && m === 'DELETE') { const id = url.searchParams.get('id') || ''; if (!/^[a-f0-9]{16}$/.test(id)) return json({ error: 'bad id' }, 400); for (const [k, v] of await this.s.list({ prefix: 'i:' })) if (k.slice(2, 18) === id) await this.s.delete(k); return json({ ok: true }); }
      if (p === 'approve' && m === 'POST') return this.approve(email, team, b);
      if (p === 'rename' && m === 'POST') { const nm = str(b.name, 60); if (!nm) return json({ error: 'a name is needed' }, 400); const old = team.name; team.name = nm; await this.s.put('team', team); await this.log(email, 'rename', { name: nm, from: old }); return json({ ok: true }); }
      if (p === 'wipe' && m === 'POST') { if (!owner || email !== owner) return json({ error: 'only the owner can delete a team' }, 403); if (typeof b.confirm !== 'string' || b.confirm.trim() !== team.name) return json({ error: 'type the team name to delete it' }, 409); await this.wipeFiles(); await this.s.deleteAll(); return json({ ok: true }); }
      if (p === 'decline' && m === 'POST') { const q = await this.s.get('q:' + low(b.email)); if (!q) return json({ error: 'no request' }, 404); await this.s.delete('q:' + q.email); await this.log(email, 'decline', { who: q.email, name: q.name }); return json({ ok: true }); }
      if (p === 'role' && m === 'POST') return this.setRole(email, owner, b);
      if (p === 'remove' && m === 'POST') return this.remove(email, owner, team, b);
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'server error' }, 500); }
  }

  /* the list of teams besides the first: ids only (each team keeps its own name) */
  async dir(p, url, request) {
    if (p === 'errlog') return this.errlog(request);
    const ids = (await this.s.get('ids')) || [];
    if (p === 'list') return json({ ids });
    if (p === 'has') return json({ has: ids.includes(url.searchParams.get('id')) });
    if (p === 'del') { await this.s.put('ids', ids.filter(function (x) { return x !== url.searchParams.get('id'); })); return json({ ok: true }); }
    if (p === 'vapid') return json(await makeVapid(this.s));
    if (p === 'add') { if (ids.length >= 50) return json({ error: 'too many teams' }, 409); const id = hex(crypto.getRandomValues(new Uint8Array(6))); ids.push(id); await this.s.put('ids', ids); return json({ id }); }
    return json({ error: 'not found' }, 404);
  }

  /* error lines from the app, like cmd's: kind, masked message and place, the view, the version, the device type, a count */
  async errlog(request) {
    const cut = Date.now() - 21 * 864e5, m = request.method;
    const l = ((await this.s.get('errlog')) || []).filter(x => x && x.t > cut);
    if (m === 'GET') return json({ list: l });
    if (m === 'DELETE') { await this.s.delete('errlog'); return json({ ok: true }); }
    if (m !== 'POST') return json({ error: 'method not allowed' }, 405);
    let b = {}; try { b = JSON.parse((await request.text()) || '{}') || {}; } catch (e) { return json({ error: 'bad json' }, 400); }
    const mask = x => String(x == null ? '' : x).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '@').replace(/\d/g, '#').replace(/\s+/g, ' ').trim();
    const dev = [b.os, b.br, b.w ? b.w + 'px' : ''].map(x => String(x || '').replace(/[^\w ()]/g, '').slice(0, 24)).filter(Boolean).join(' ').slice(0, 60) || '?';
    let n = 0;
    (Array.isArray(b.errs) ? b.errs : []).slice(0, 40).forEach(e => {
      if (!e || !e.m) return;
      const x = { k: String(e.k || 'js').replace(/[^\w-]/g, '').slice(0, 12), m: mask(e.m).slice(0, 200), a: mask(e.a).slice(0, 80), p: String(e.p || '').replace(/[^\w#=-]/g, '').slice(0, 24), v: String(e.v || '').replace(/[^\w.-]/g, '').slice(0, 16), d: dev, n: Math.max(1, Math.min(9999, +e.n || 1)), t: Math.min(Date.now(), +e.t || Date.now()) };
      const hit = l.find(y => y.k === x.k && y.m === x.m && y.a === x.a && y.p === x.p && y.v === x.v && y.d === x.d);
      if (hit) { hit.n = Math.max(hit.n, x.n); hit.t = Math.max(hit.t, x.t); } else l.push(x);
      n++;
    });
    l.sort((a, b2) => a.t - b2.t); await this.s.put('errlog', l.slice(-300));
    return json({ ok: true, n });
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
  async access() { const a = (await this.s.get('acc')) || {}; return { m: Object.assign({}, ACTS, a.m || {}), pp: a.pp || {}, tr: a.tr || {} }; }
  /* the role someone has where a record lives: their team role, or the one an admin gave them on that project ('none' = not there) */
  roleIn(me, acc, g) { if (me.role === 'admin') return 'admin'; const pr = g && acc.pp[me.email] ? acc.pp[me.email][g] : ''; if (pr && PROLES.includes(pr)) return pr; return acc.tr[me.email] === 'none' ? 'none' : me.role; }
  async setAccess(email, b) {
    const m = {}, pp = {}, tr = {}, mem = {};
    for (const [, v] of await this.s.list({ prefix: 'm:' })) mem[v.email] = v;
    for (const a of Object.keys(ACTS)) { const r = b.m && b.m[a]; m[a] = ROLES.includes(r) ? r : ACTS[a]; }
    for (const e of Object.keys(b.pp || {})) { if (!mem[e] || mem[e].role === 'admin') continue; const o = {}; let n = 0; for (const g of Object.keys(b.pp[e] || {})) { if (GID.test(g) && PROLES.includes(b.pp[e][g]) && ++n <= 500) o[g] = b.pp[e][g]; } if (n) pp[e] = o; }
    for (const e of Object.keys(b.tr || {})) if (mem[e] && mem[e].role !== 'admin' && b.tr[e] === 'none') tr[e] = 'none';
    await this.s.put('acc', { m, pp, tr }); await this.log(email, 'access', {});
    return json({ ok: true, m, pp, tr });
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
    { const ac = await this.s.get('acc'); if (ac && ((ac.pp && ac.pp[who]) || (ac.tr && ac.tr[who]))) { if (ac.pp) delete ac.pp[who]; if (ac.tr) delete ac.tr[who]; await this.s.put('acc', ac); } }   /* their access goes with them */
    for (const v of rest) { v.keys = Object.assign({}, v.keys, { [next]: r.keys[v.email] }); await this.s.put('m:' + v.email, v); }
    team.epoch = next; await this.s.put('team', team);
    for (const [k, v] of await this.s.list({ prefix: 'lock:' })) if (v.by === who) await this.s.delete(k);
    await this.log(email, 'remove', { who, name: t.name });
    return json({ ok: true, epoch: next });
  }

  async recs(url, team, email, me, acc) {
    const since = +url.searchParams.get('since') || 0, out = [], hid = [];
    /* only what the person may see: a project they have 'none' on – or, with no team access, everything but their own projects – never leaves the server */
    for (const [, v] of await this.s.list({ prefix: 'r:' })) if (v.seq > since) { if (v.k === 'lrn' && v.by !== email && me.role !== 'admin') continue;   /* someone's own learning votes: only them and admins (JP 16:34 "I don't want other people to see how much it learned") */
      if (!/^(dct|dcr|cfg)$/.test(v.k) && !(/^(mine|lrn)$/.test(v.k) && v.by === email) && this.roleIn(me, acc, v.g) === 'none') { hid.push(v.id); continue; } out.push(v); }   /* project types and client checklists are for everyone in the team */
    const locks = {}, now = Date.now();
    for (const [k, v] of await this.s.list({ prefix: 'lock:' })) if (v.until > now) locks[k.slice(5)] = v; else await this.s.delete(k);
    return json({ seq: (await this.s.get('seq')) || 0, epoch: team.epoch, recs: out, locks, hid: since ? undefined : hid.length || undefined });
  }

  /* a record: saved only if nobody saved it since you read it (v), never while someone else is writing in it */
  async putRec(email, me, team, b, acc) {
    const r = await this.applyRec(email, me, team, b, acc);
    if (r.error) return json(r, r.status);
    if (b.k !== 'clk') await this.log(email, r.a, { k: b.k, id: b.id, s: logSum(b.s) });   /* clocking in and out stays out of the change log */
    this.nudge(email, me, team, [b.k]).catch(() => {});
    return json({ ok: true, v: r.v, seq: r.seq, t: r.t });
  }
  /* many records in one go (Document control: a project and its lines). Each is checked on its own; one log line. */
  async batch(email, me, team, b, acc) {
    const list = Array.isArray(b.recs) ? b.recs : null;
    if (!list || !list.length || list.length > MAXBATCH) return json({ error: 'bad batch' }, 400);
    const out = []; let n = 0;
    for (const x of list) { const r = await this.applyRec(email, me, team, x || {}, acc); out.push(r.error ? { id: x && x.id, error: r.error, status: r.status, rec: r.rec } : { id: x.id, v: r.v, seq: r.seq, t: r.t }); if (!r.error) n++; }
    if (n) { await this.log(email, 'batch', { k: String(list[0].k || ''), n, s: logSum(b.s) }); this.nudge(email, me, team, list.map(x => x && x.k)).catch(() => {}); }
    return json({ ok: true, results: out });
  }
  async applyRec(email, me, team, b, acc) {
    if (typeof b.id !== 'string' || !ID.test(b.id) || typeof b.k !== 'string' || !KINDS.test(b.k)) return { error: 'bad record', status: 400 };
    const del = !!b.del;
    if (!del && (!blob(b) || b.ct.length > MAXREC)) return { error: 'bad record', status: 400 };
    if (!del && (!Number.isInteger(b.e) || b.e < 1 || b.e > team.epoch || !me.keys[b.e])) return { error: 'old key', status: 409 };
    const lk = await this.s.get('lock:' + (b.lockId || b.id));
    if (lk && lk.until > Date.now() && lk.by !== email) return { error: 'someone is writing', by: lk.by, status: 423 };
    const old = await this.s.get('r:' + b.id);
    if (old && old.k !== b.k) return { error: 'bad record', status: 400 };
    const rk = me ? ROLES.indexOf(me.role) : -1;
    if (b.g !== undefined && (typeof b.g !== 'string' || !GID.test(b.g))) return { error: 'bad record', status: 400 };
    const g = old && old.g ? old.g : b.g;
    if (acc) {   /* Documentation: the action this write is, against the role the person has where it lives (the access matrix) */
      const act = b.k === 'dct' ? 'types' : b.k === 'dcr' ? 'rules' : b.k === 'dcp' ? (del ? 'delp' : old && !old.del ? 'edit' : 'newp') : /^(dcl|dcf|dce)$/.test(b.k) ? 'edit' : '';
      const role = this.roleIn(me, acc, /^(dcp|dcl|dcf|dce|file)$/.test(b.k) ? g : '');
      if (role === 'none' && !/^(mine|lrn)$/.test(b.k)) return { error: 'no access', status: 403 };   /* your own lists are yours, whatever your projects */
      if (act && ROLES.indexOf(role) < ROLES.indexOf(acc.m[act] || ACTS[act])) return { error: 'your role does not allow this', status: 403 };
      if (!act && b.k !== 'clk' && b.k !== 'mine' && b.k !== 'lrn' && ROLES.indexOf(role) < 1) return { error: 'read only', status: 403 };
    }
    /* the naming code template (cfgncodes) follows the access matrix's "codes" (admin by default); other settings: admins */
    if (b.k === 'cfg' && rk < 3 && !((b.id === 'cfgncodes' || b.id === 'cfglearn') && acc && ROLES.indexOf(this.roleIn(me, acc, '')) >= ROLES.indexOf(acc.m.codes || ACTS.codes))) return { error: 'admins only', status: 403 };
    if ((b.k === 'mine' || b.k === 'lrn') && old && old.by !== email) return { error: 'not yours', status: 403 };   /* lrn: someone's own votes for the file suggestions (JP 2026-11-25) */   /* a person's own code list: only they write it (JP 2026-11-25) */                         /* team settings: admins */
    if (b.k === 'clk' && old && old.by !== email && rk < 3) return { error: 'not yours', status: 403 };  /* your own clock entries: only you (and admins, to fix a forgotten one) */
    if ((old ? old.v : 0) !== (b.v | 0)) return { error: 'changed meanwhile', rec: old, status: 409 };
    if (old) await this.s.put('h:' + b.id + ':' + old.v, old);   /* history: nothing is truly gone */
    const seq = ((await this.s.get('seq')) || 0) + 1;
    const rec = del ? Object.assign({}, old || { id: b.id, k: b.k }, { del: 1, v: (old ? old.v : 0) + 1, t: Date.now(), by: email, seq })
      : { id: b.id, k: b.k, e: b.e, iv: b.iv, ct: b.ct, v: (old ? old.v : 0) + 1, t: Date.now(), by: email, seq };
    if (g) rec.g = g;
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

  /* ---------- shared files: the bytes are encrypted on the device in chunks of about 1 MB; the name and type are in a 'file' record ---------- */
  async putChunk(email, b, me, acc) {
    const n = b.n | 0;
    if (!FID.test(String(b.fid || '')) || n < 0 || n >= MAXCHUNKS || !blob(b) || b.ct.length > MAXCHUNK) return json({ error: 'bad chunk' }, 400);
    /* a project's file knows its project (JP 2026-11-25 16:42 "people who does not have access to the project should not be able to see the project") */
    if (b.g !== undefined && (typeof b.g !== 'string' || !GID.test(b.g))) return json({ error: 'bad chunk' }, 400);
    if (b.g && me && acc && this.roleIn(me, acc, b.g) === 'none') return json({ error: 'no access' }, 403);
    if (!b.g && me && ROLES.indexOf(me.role) < 1) return json({ error: 'read only' }, 403);   /* read-only people with a project of their own send only to that project */
    if (b.g && n === 0 && !(await this.s.get('fg:' + b.fid))) await this.s.put('fg:' + b.fid, b.g);
    const used = (await this.s.get('fbytes')) || 0;
    if (used + b.ct.length > TEAMBYTES) return json({ error: 'the team has no room for more files' }, 507);
    const old = await this.cGet(b.fid, n);
    if (old && old.by !== email) return json({ error: 'bad chunk' }, 409);
    await this.cPut(b.fid, n, { iv: b.iv, ct: b.ct, by: email, t: Date.now() });
    await this.s.put('fbytes', used + b.ct.length - (old ? old.ct.length : 0));
    return json({ ok: true });
  }
  async getChunk(url, me, acc) {
    const fid = url.searchParams.get('fid') || '', n = +url.searchParams.get('n') | 0;
    if (!FID.test(fid)) return json({ error: 'bad file' }, 400);
    if (me && acc) { const g = await this.s.get('fg:' + fid); if (g && this.roleIn(me, acc, g) === 'none') return json({ error: 'not found' }, 404); }   /* a file from a project you're not in is not there for you */
    const c = await this.cGet(fid, n); this.ctx.waitUntil(this.moveSome());
    return c ? json({ iv: c.iv, ct: c.ct }) : json({ error: 'not found' }, 404);
  }

  /* ---------- upload links: a contractor sends files to a project without an account ---------- */
  async upLink(email, b) {
    const lid = String(b.lid || ''), days = Math.min(60, Math.max(1, +b.days || 14));
    if (!LID.test(lid)) return json({ error: 'bad link' }, 400);
    if (await this.s.get('u:' + lid)) return json({ error: 'exists' }, 409);
    await this.s.put('u:' + lid, { by: email, at: Date.now(), exp: Date.now() + days * 864e5, n: 0, bytes: 0, files: [] });
    await this.log(email, 'uplink', { days });
    return json({ ok: true, exp: Date.now() + days * 864e5 });
  }
  async uploads(url) {
    const lid = url.searchParams.get('lid') || ''; if (!LID.test(lid)) return json({ error: 'bad link' }, 400);
    const l = await this.s.get('u:' + lid); if (!l) return json({ files: [], exp: 0 });
    const out = [];
    for (const fid of l.files) { const f = await this.s.get('uf:' + lid + ':' + fid); if (f && f.done) out.push({ fid, name: f.name, size: f.size, n: f.n, t: f.t, kept: f.kept || 0 }); }
    return json({ files: out, exp: l.exp, off: !!l.off });
  }
  async upPublic(rest, m, request, url) {
    const [lid, what] = rest.split('/'), l = LID.test(lid || '') ? await this.s.get('u:' + lid) : null, team = await this.s.get('team');
    if (!l || !team || l.exp < Date.now()) return json({ error: 'this link has run out or was switched off' }, 410);
    if (what === 'info' && m === 'GET') return json({ ok: true, exp: l.exp, n: l.n, left: Math.max(0, LINKFILES - l.n) });
    /* what's still missing on the link's project – encrypted by the team's app with the link's key (2026-11-21, JP) */
    if (what === 'needs' && m === 'GET') return json({ needs: l.needs || null, at: l.needsAt || 0 });
    /* what was sent on this link – for the sender's own log (the names are opened in their browser with the link's key) */
    if (what === 'list' && m === 'GET') {
      const out = [];
      for (const fid of l.files) { const f = await this.s.get('uf:' + lid + ':' + fid); if (f && f.done) out.push({ fid, name: f.name, size: f.size, t: f.t, kept: f.kept || 0 }); }
      return json({ files: out, exp: l.exp });
    }
    let b = {}; try { b = JSON.parse((await request.text()) || '{}') || {}; } catch (e) { return json({ error: 'bad json' }, 400); }
    const fid = String(b.fid || ''); if (!FID.test(fid)) return json({ error: 'bad file' }, 400);
    const fk = 'uf:' + lid + ':' + fid;
    let f = await this.s.get(fk);
    if (what === 'chunk' && m === 'PUT') {
      const n = b.n | 0;
      if (n < 0 || n >= MAXCHUNKS || !blob(b) || b.ct.length > MAXCHUNK) return json({ error: 'bad chunk' }, 400);
      if (!f) { if (n !== 0 || !blob(b.name) || b.name.ct.length > 8000 || l.n >= LINKFILES) return json({ error: 'bad file' }, 400); f = { name: { iv: b.name.iv, ct: b.name.ct }, t: Date.now(), n: 0, size: 0, done: false }; l.files.push(fid); l.n++; }
      if (f.done) return json({ error: 'already sent' }, 409);
      if (l.bytes + b.ct.length > LINKBYTES) return json({ error: 'the link is full' }, 507);
      const used = (await this.s.get('fbytes')) || 0; if (used + b.ct.length > TEAMBYTES) return json({ error: 'the team has no room for more files' }, 507);
      const old = await this.cGet(fid, n);
      await this.cPut(fid, n, { iv: b.iv, ct: b.ct, by: 'link:' + lid, t: Date.now() });
      const grow = b.ct.length - (old ? old.ct.length : 0);
      f.n = Math.max(f.n, n + 1); f.size += grow; l.bytes += grow;
      await this.s.put('fbytes', used + grow); await this.s.put(fk, f); await this.s.put('u:' + lid, l);
      return json({ ok: true });
    }
    if (what === 'done' && m === 'POST') {
      if (!f || !(f.n > 0)) return json({ error: 'nothing was sent' }, 400);
      f.done = true; f.t = Date.now(); await this.s.put(fk, f);
      await this.log('link:' + lid, 'upload', {});
      this.nudge('link:' + lid, { name: 'Upload link' }, team, ['upl']).catch(() => {});
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }

  /* ---------- push when Team is closed: only "someone changed something" – never what was written ---------- */
  async vapid() {
    if (this.vp) return this.vp;
    const dir = this.env && this.env.TEAM ? this.env.TEAM.get(this.env.TEAM.idFromName('dir')) : null;
    if (dir) { const r = await dir.fetch(new Request('https://team/dir/vapid')).catch(() => null); if (r && r.ok) { this.vp = await r.json(); return this.vp; } }
    return (this.vp = await makeVapid(this.s));
  }
  async pushSub(email, b) {
    const sub = b.sub, ep = String((sub && sub.endpoint) || b.endpoint || '');
    if (!/^https:\/\/[^\s]{10,700}$/.test(ep)) return json({ error: 'bad subscription' }, 400);
    const k = 'p:' + email + ':' + (await sha(ep)).slice(0, 24);
    if (b.on === false) { await this.s.delete(k); return json({ ok: true, on: false }); }
    if (!sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') return json({ error: 'bad subscription' }, 400);
    await this.s.put(k, { email, sub: { endpoint: ep, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, at: Date.now(), last: 0 });
    return json({ ok: true, on: true });
  }
  async nudge(by, me, team, kinds) {
    kinds = (kinds || []).filter(k => k !== 'clk' && k !== 'cfg' && k !== 'mine'); if (!kinds.length) return;   /* clocking in and settings are no news for the others */
    const subs = await this.s.list({ prefix: 'p:' }); if (!subs.size) return;
    const v = await this.vapid(), what = Array.from(new Set((kinds || []).map(k => ({ meeting: 'meeting', action: 'action', note: 'note', insp: 'inspection', file: 'file', upl: 'upload' })[k] || (/^dc/.test(k || '') ? 'document' : '')).filter(Boolean)));
    const body = (me && me.name ? me.name : 'Someone') + ' · ' + (what.length ? what.join(', ') : 'a change');
    const now = Date.now();
    for (const [k, x] of subs) {
      if (x.email === by || now - (x.last || 0) < 180e3) continue;   /* not to the one who did it, at most every 3 minutes */
      x.last = now; await this.s.put(k, x);
      const r = await webPush(v, x.sub, { title: team.name, body, tag: 'team', url: '/' }).catch(() => null);
      if (r && (r.status === 404 || r.status === 410)) await this.s.delete(k);
    }
  }

  /* no change log (JP 2026-11-24 22:57 "I honestly don't want to store logs"): nothing is written; the calls stay so nothing else changes */
  async log() {}
  async wipeLog() { const all = await this.s.list({ prefix: 'l:' }); for (const k of all.keys()) await this.s.delete(k); await this.s.delete('lseq'); }
  async logReset() { await this.wipeLog(); return json({ ok: true }); }
  async upRemove(email, b) {
    const lid = String(b.lid || ''); if (!LID.test(lid)) return json({ error: 'bad link' }, 400);
    const l = await this.s.get('u:' + lid); if (!l) return json({ ok: true });
    const all = !!b.all, fids = all ? l.files.slice() : (Array.isArray(b.fids) ? b.fids.slice(0, 300) : []).filter(f => FID.test(String(f)));
    let used = (await this.s.get('fbytes')) || 0, n = 0;
    for (const fid of fids) {
      const k = 'uf:' + lid + ':' + fid, f = await this.s.get(k); if (!f) continue;
      if (!f.kept) for (let i = 0; i < (f.n || 0); i++) { const c = await this.cGet(fid, i); if (c) { used -= c.ct.length; await this.cDel(fid, i); } }
      await this.s.delete(k); l.files = l.files.filter(x => x !== fid); l.bytes = Math.max(0, l.bytes - (f.kept ? 0 : f.size || 0)); n++;
    }
    if (all) { l.off = 1; l.exp = Math.min(l.exp, Date.now()); }
    await this.s.put('fbytes', Math.max(0, used)); await this.s.put('u:' + lid, l);
    await this.log(email, 'upload-removed', { n });
    return json({ ok: true, removed: n });
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

/* ---- Web Push (RFC 8291 + VAPID), as in the /cmd Worker; the key pair is made once and kept in the 'dir' Durable Object ---- */
async function makeVapid(s) {
  const have = await s.get('vapid'); if (have) return have;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const v = { jwk: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))) };
  await s.put('vapid', v); return v;
}
function b64u(u8) { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function cat(...parts) { const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
async function hkdf(salt, ikm, info, len) { const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8)); }
async function encryptPush(sub, text) {
  const te = new TextEncoder(), uaPub = bytes(sub.keys.p256dh), auth = bytes(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}
async function webPush(v, sub, msg) {
  const aud = new URL(sub.endpoint).origin, te = new TextEncoder();
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 50 * 60, sub: 'https://work.jplundberg.com' })));
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + p)));
  return fetch(sub.endpoint, { method: 'POST', body: await encryptPush(sub, JSON.stringify(msg)), headers: { 'Authorization': 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + v.pub, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '3600', 'Urgency': 'normal' } });
}

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
