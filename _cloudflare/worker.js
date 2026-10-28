/* Dashboard sync – Cloudflare Worker
   Route: jplundberg.com/cmd/api/*
   Stores ONE encrypted blob (the dashboard vault). The data is encrypted in the
   browser with your passcode before it is sent, so this worker never sees your numbers.

   Needs (Worker → Settings → Bindings / Variables):
     VAULT        KV namespace binding
     TEAM_DOMAIN  e.g. https://lundberg.cloudflareaccess.com
     POLICY_AUD   the "Application Audience (AUD) Tag" of the Access application
   Every request must carry a valid Cloudflare Access token, so only you get in. */

const KEY = 'vault';
const MAX_BYTES = 5 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/cmd/api/vault')) return json({ error: 'not found' }, 404);

    if (!env.VAULT || !env.TEAM_DOMAIN || !env.POLICY_AUD) {
      return json({ error: 'worker not configured' }, 503);
    }
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok) {
      console.log('unauthorized', check);
      return json({ error: 'unauthorized', ...check }, 401);
    }

    if (request.method === 'GET') {
      const v = await env.VAULT.get(KEY);
      return v ? new Response(v, { headers: hdrs() }) : json({ error: 'empty' }, 404);
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > MAX_BYTES) return json({ error: 'too large' }, 413);
      let next;
      try { next = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (!next || next.v !== 1 || !next.ct || !next.iv || !next.salt || !Number.isInteger(next.rev)) {
        return json({ error: 'not a vault' }, 400);
      }
      /* Only accept the write if the device saw the latest version first. */
      const base = parseInt(request.headers.get('X-Base-Rev') || '-1', 10);
      const cur = await env.VAULT.get(KEY);
      const curRev = cur ? JSON.parse(cur).rev || 0 : -1;
      if (cur && base !== curRev) return new Response(cur, { status: 409, headers: hdrs() });
      await env.VAULT.put(KEY, body);
      return json({ ok: true, rev: next.rev });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};

function hdrs() {
  return { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: hdrs() });
}

/* ---- Cloudflare Access token check (RS256 JWT) ---- */
let certCache = { at: 0, keys: [] };

async function verifyAccess(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, reason: 'no Access token on the request (is the Access app covering /cmd?)' };
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return { ok: false, reason: 'malformed token' };
  const header = JSON.parse(dec(h));
  const payload = JSON.parse(dec(p));

  const team = env.TEAM_DOMAIN.trim().replace(/\/+$/, '');
  const wantAud = env.POLICY_AUD.trim();
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== team) return { ok: false, reason: 'TEAM_DOMAIN does not match', expected: payload.iss, configured: team };
  if (!aud.includes(wantAud)) return { ok: false, reason: 'POLICY_AUD does not match', expected: aud, configured: wantAud };
  if (!payload.exp || payload.exp * 1000 < Date.now()) return { ok: false, reason: 'login expired, reload the page' };

  if (Date.now() - certCache.at > 3600 * 1000 || !certCache.keys.some(k => k.kid === header.kid)) {
    const res = await fetch(team + '/cdn-cgi/access/certs');
    certCache = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const jwk = certCache.keys.find(k => k.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'signing key not found' };
  const { alg, use, kid, ...pub } = jwk;
  const key = await crypto.subtle.importKey('jwk', pub, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(s), new TextEncoder().encode(h + '.' + p));
  return valid ? { ok: true } : { ok: false, reason: 'bad signature' };
}

function b64url(s) { return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='); }
function dec(s) { return new TextDecoder().decode(bytes(s)); }
function bytes(s) { return Uint8Array.from(atob(b64url(s)), c => c.charCodeAt(0)); }
