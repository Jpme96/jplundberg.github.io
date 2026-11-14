/* A stand-in for Cloudflare for the Team app (work.jplundberg.com): serves _team/public with its _headers (so the
   strict CSP is tested too) and runs the real _team/worker.js with its Durable Object faked in memory.
   Access is faked with locally signed tokens: the cookie who=<email> picks the person (default: the owner).
   Nothing here is real data. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..', '_team');
fs.mkdirSync(path.join(HERE, '..', '.tmp'), { recursive: true });
const WCOPY = path.join(HERE, '..', '.tmp', 'team-worker-' + process.pid + '.mjs');
fs.copyFileSync(path.join(ROOT, 'worker.js'), WCOPY);
const mod = await import(pathToFileURL(WCOPY).href + '?t=' + Date.now());
const PORT = +process.env.TPORT || 9070, ORIGIN = 'http://localhost:' + PORT;
const TEAM = 'https://test.cloudflareaccess.com', AUD = 'team-aud';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
globalThis.fetch = async u => String(u).startsWith(TEAM) ? new Response(JSON.stringify({ keys: [jwk] })) : new Response('{}', { status: 404 });
const b64u = b => Buffer.from(b).toString('base64url');
async function token(em, aud) { const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' })), p = b64u(JSON.stringify({ iss: TEAM, aud: [aud || AUD], exp: Math.floor(Date.now() / 1000) + 3600, email: em }));
  return h + '.' + p + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p))); }

/* each Durable Object's storage, in memory (values are copied like the real one does); one per team name */
const mems = new Map();
function storageFor(name) {
  const mem = new Map(); mems.set(name, mem);
  return {
    get: async k => mem.has(k) ? structuredClone(mem.get(k)) : undefined,
    put: async (k, v) => { mem.set(k, structuredClone(v)); },
    delete: async k => mem.delete(k),
    list: async ({ prefix = '', reverse, limit, end } = {}) => {
      let ks = [...mem.keys()].filter(k => k.startsWith(prefix) && (!end || k < end)).sort();
      if (reverse) ks.reverse(); if (limit) ks = ks.slice(0, limit);
      return new Map(ks.map(k => [k, structuredClone(mem.get(k))]));
    }
  };
}
const env = { TEAM_DOMAIN: TEAM, POLICY_AUD: AUD, OWNER: 'owner@x.no', ORIGIN };
const stores = new Map();
let chain = Promise.resolve();   /* one request at a time, like a Durable Object */
env.TEAM = { idFromName: n => n, get: n => {
  if (!stores.has(n)) stores.set(n, new mod.TeamStore({ storage: storageFor(n) }, env));
  const st = stores.get(n);
  return { fetch: req => (chain = chain.then(() => st.fetch(req), () => st.fetch(req))) };
} };

const HDRS = {};
for (const line of fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8').split('\n')) { const m = line.match(/^\s+([\w-]+):\s*(.+)$/); if (m) HDRS[m[1]] = m[2].trim(); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
env.ASSETS = { fetch: async req => {
  let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith('/')) p += 'index.html';
  let f = path.join(ROOT, 'public', p); if (!f.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(f) || p === '/_headers') f = path.join(ROOT, 'public', 'index.html');
  return new Response(fs.readFileSync(f), { headers: Object.assign({ 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }, HDRS) });
} };

http.createServer(async (req, res) => {
  if (req.url === '/__mem') { const all = []; for (const [n, m] of mems) for (const [k, v] of m) all.push([n === 'team' ? k : n + '/' + k, v]); return res.end(JSON.stringify(all)); }
  const ch = []; for await (const c of req) ch.push(c);
  const who = ((req.headers.cookie || '').match(/(?:^|;\s*)who=([^;]+)/) || [])[1];
  const headers = { ...req.headers };
  if (!/(?:^|;\s*)noauth=1/.test(req.headers.cookie || '')) headers['cf-access-jwt-assertion'] = await token(decodeURIComponent(who || 'owner@x.no'), /(?:^|;\s*)wrongaud=1/.test(req.headers.cookie || '') ? 'cmd-aud' : AUD);
  try {
    const r = await mod.default.fetch(new Request(ORIGIN + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(ch), duplex: 'half' }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end('{"error":"' + String(e.message).replace(/"/g, '') + '"}'); }
}).listen(PORT, () => console.log('team up'));
