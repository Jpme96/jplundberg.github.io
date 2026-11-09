/* A stand-in for Cloudflare in the tests: serves the site from the repo and runs the real _cloudflare/worker.js
   (with D1, R2, KV, the edge cache and the LiveRoom faked in memory). Access is faked with locally signed tokens:
   requests are the owner, or the partner when the browser has the cookie as=partner. Nothing here is real data. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(HERE, '..', '.tmp'), { recursive: true });
const WCOPY = path.join(HERE, '..', '.tmp', 'worker.mjs');
fs.copyFileSync(path.join(HERE, '..', '..', '_cloudflare', 'worker.js'), WCOPY);
const worker = (await import(pathToFileURL(WCOPY).href + '?t=' + Date.now())).default;
import { WebSocketServer } from 'ws';

/* D1 stand-in (node:sqlite) when D1=1 – same calls the Worker uses: prepare/bind/first/all/run and batch (one transaction) */
import { DatabaseSync } from 'node:sqlite';
let __d1 = null;
if (process.env.D1) {
  const sq = new DatabaseSync(process.env.D1FILE || ':memory:');
  const stmt = (sql, args = []) => ({ sql, args, bind: (...a) => stmt(sql, a),
    first: async () => { const r = sq.prepare(sql).get(...args); return r ? { ...r } : null; },
    all: async () => ({ results: sq.prepare(sql).all(...args).map(r => ({ ...r })) }),
    run: async () => { const r = /^\s*select/i.test(sql) ? (sq.prepare(sql).get(...args), { changes: 0 }) : sq.prepare(sql).run(...args); return { meta: { changes: r.changes } }; } });
  __d1 = { prepare: sql => stmt(sql), batch: async list => { sq.exec('BEGIN'); try { const out = []; for (const x of list) out.push(await x.run()); sq.exec('COMMIT'); return out; } catch (e) { sq.exec('ROLLBACK'); throw e; } }, _sq: sq };
  globalThis.__d1 = __d1;
}

/* R2 stand-in when R2=1 */
let __r2 = null;
if (process.env.R2) {
  const m = new Map();
  __r2 = { put: async (k, v, o) => { const b = v && typeof v.getReader === 'function' ? new Uint8Array(await new Response(v).arrayBuffer()) : typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v); m.set(k, { b, meta: (o && o.customMetadata) || {} }); },
    get: async k => { const e = m.get(k); return e ? { body: new Response(e.b).body, size: e.b.length } : null; },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ objects: [...m.keys()].filter(k => k.startsWith(prefix)).map(k => ({ key: k, size: m.get(k).b.length, customMetadata: m.get(k).meta })), truncated: false }), _m: m };
  globalThis.__r2 = __r2;
}
const __cs = new Map(), __edge = new Map();
globalThis.caches = { default: {
  async put(req, res) { const ma = +((res.headers.get('cache-control') || '').match(/max-age=(\d+)/) || [0, 60])[1]; __cs.set(typeof req === 'string' ? req : req.url, { body: await res.text(), h: [...res.headers], exp: Date.now() + ma * 1000 }); },
  async match(req) { const k = typeof req === 'string' ? req : req.url, e = __cs.get(k); if (!e) return undefined; if (Date.now() > e.exp) { __cs.delete(k); return undefined; } return new Response(e.body, { headers: e.h }); },
  async delete(req) { return __cs.delete(typeof req === 'string' ? req : req.url); } } };

const ROOT = path.resolve(HERE, '..', '..');
const TEAM = 'https://test.cloudflareaccess.com', AUD = 'aud123';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init = {}) => { u = String(u); if (u.startsWith(TEAM)) return new Response(JSON.stringify({ keys: [jwk] })); return new Response('{}', { status: 404 }); };
const b64u = b => Buffer.from(b).toString('base64url');
async function token(em) { const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' })), p = b64u(JSON.stringify({ iss: TEAM, aud: [AUD], exp: Math.floor(Date.now()/1000) + 3600, email: em || 'me@x' }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + b64u(sig); }
const store = new Map();
const env = { TEAM_DOMAIN: TEAM, POLICY_AUD: AUD, VAULT: { get: async (k, t) => { let v = store.get(k); if (process.env.STALE && (k === 'chat' || k === 'shared' || k === 'vault')) { const e = __edge.get(k); if (e && Date.now() - e.at < 20000) v = e.v; else __edge.set(k, { v, at: Date.now() }); } if (v == null) return null; const ty = typeof t === 'string' ? t : t && t.type; if (ty === 'json') return JSON.parse(typeof v === 'string' ? v : new TextDecoder().decode(v)); if (ty === 'stream' || ty === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v) : v; return typeof v === 'string' ? v : new TextDecoder().decode(v); }, getWithMetadata: async (k, t) => ({ value: store.get(k) ?? null, metadata: null }), put: async (k, v) => { if (v && typeof v.getReader === 'function') { v = new Uint8Array(await new Response(v).arrayBuffer()); } store.set(k, v); }, delete: async k => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) } };
if (__d1) env.DB = __d1;
if (__r2) env.FILES = __r2;
/* LIVE stand-in when LIVE=1: the same /notify messages the Durable Object gets, sent to sockets opened at /cmd/api/ws */
const __socks = new Set(), __st = { box: null, chat: null, vault: null, seeno: null, seenp: null }, __typ = { o: null, p: null };
const __on = r => [...__socks].some(s => s.role === r && s.readyState === 1);
const __snap = r => { const o = Object.assign({ now: Date.now(), box: __st.box, chat: __st.chat, typing: { ...__typ }, seen: { o: __st.seeno, p: __st.seenp }, online: { o: __on('o'), p: __on('p') }, last: { o: __st.lasto, p: __st.lastp }, away: !!__st['hide' + r] }, r === 'o' ? { vault: __st.vault } : {});
  const other = r === 'o' ? 'p' : 'o'; for (const x of ['o', 'p']) if (__st['hide' + x] || (x === other && __st['hide' + r])) { o.online[x] = false; o.last[x] = null; } return JSON.stringify(o); };
globalThis.__liveMsgs = 0;
if (process.env.LIVE) env.LIVE = { idFromName: () => 1, get: () => ({ fetch: async (u, init) => { const b = JSON.parse(init.body); const roles = new Set();
  for (const k of ['box', 'chat']) if (b[k] != null) { __st[k] = b[k]; roles.add('o'); roles.add('p'); }
  if (b.vault != null) { __st.vault = b.vault; roles.add('o'); }
  if (b.seen) { __st['seen' + b.seen.by] = b.seen.v; roles.add('o'); roles.add('p'); }
  if (b.away) { __st['hide' + b.away.by] = !!b.away.v; roles.add('o'); roles.add('p'); }
  if (b.typ) { __typ[b.typ] = b.on ? Date.now() : null; roles.add(b.typ === 'o' ? 'p' : 'o'); }
  if (b.kick === 'p') { for (const s of __socks) if (s.role === 'p') s.close(4001); roles.delete('p'); }
  for (const s of __socks) if (roles.has(s.role)) { s.send(__snap(s.role)); globalThis.__liveMsgs++; }
  return new Response('ok'); } }) };
const __srv = http.createServer(async (req, res) => {
  if (req.url === '/__live') return res.end(JSON.stringify({ socks: [...__socks].map(s => s.role), msgs: globalThis.__liveMsgs }));
  if (req.url.startsWith('/__kvput')) { let body = ''; for await (const c of req) body += c; const j = JSON.parse(body); store.set(j.k, j.v); return res.end('ok'); }
  if (req.url.startsWith('/__kvget')) { const k = new URL('http://x' + req.url).searchParams.get('k'); const v = store.get(k); return res.end(v == null ? '' : typeof v === 'string' ? v : '[bytes]'); }
  if (req.url.startsWith('/__r2')) return res.end(JSON.stringify(globalThis.__r2 ? [...globalThis.__r2._m.keys()] : null));
  if (req.url.startsWith('/__sql')) { const q = new URL('http://x' + req.url).searchParams.get('q'); return res.end(JSON.stringify(globalThis.__d1 ? globalThis.__d1._sq.prepare(q).all() : null)); }
  if (req.url.startsWith('/cmd/api/')) { const ch = []; for await (const c of req) ch.push(c); const body = Buffer.concat(ch);
    const asP = /(^|;\s*)as=partner/.test(req.headers.cookie || ''); const headers = { ...req.headers, 'Cf-Access-Jwt-Assertion': await token(asP ? 'iago@x.no' : 'me@x') };
    try { const r = await worker.fetch(new Request('http://localhost' + req.url, { method: req.method, headers, body: ['GET','HEAD'].includes(req.method) ? undefined : body, duplex: 'half' }), env, { waitUntil() {} });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer())); } catch (e) { res.writeHead(500); return res.end('{"error":"x"}'); } }
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404, {'content-type':'text/html'}); return res.end('<h1>404</h1>'); }
    const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream' }); res.end(d); });
});
__srv.listen(+process.env.PORT || 8770, () => console.log('up'));
if (process.env.LIVE) { const wss = new WebSocketServer({ noServer: true });
  __srv.on('upgrade', (req, sock, head) => { if (!req.url.startsWith('/cmd/api/ws')) return sock.destroy();
    wss.handleUpgrade(req, sock, head, ws => { ws.role = /(^|;\s*)as=partner/.test(req.headers.cookie || '') ? 'p' : 'o'; __socks.add(ws); for (const s of __socks) if (s.role !== ws.role) s.send(__snap(s.role)); ws.on('message', m => { if (String(m) === 'ping') ws.send('pong'); }); ws.on('close', () => { __socks.delete(ws); if (!__on(ws.role)) __st['last' + ws.role] = Date.now(); for (const s of __socks) if (s.role !== ws.role) s.send(__snap(s.role)); }); ws.send(__snap(ws.role)); }); }); }
