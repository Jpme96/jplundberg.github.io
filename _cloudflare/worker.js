/* Dashboard backend – Cloudflare Worker
   Route: jplundberg.com/cmd/api/*   (behind Cloudflare Access: only you get in)

   /cmd/api/vault     the encrypted dashboard data (sync between your devices).
                      It is encrypted in the browser with your passcode, so this
                      worker never sees your numbers.
   /cmd/api/site      the website settings file (_data/site.json) in GitHub:
                      announcement banner, front page sections and featured content.
   /cmd/api/visitors  visitor numbers from Cloudflare Web Analytics.
   /cmd/api/content   list articles and projects, and hide/show them
                      (sets "published: false" in the file's front matter).
   /cmd/api/texts     the website texts you can edit (_data/texts.json in GitHub):
                      about, roles, contact, footer … in English and Norwegian.
   /cmd/api/push      notifications (Settings → Notifications, off until switched on on a device):
                      the dashboard sends the reminders it planned for the next 7 days, and a
                      cron trigger (every 5 minutes) sends each one at its time with Web Push.
                      "Private" reminders contain no titles or amounts.
   /cmd/api/health    numbers from Apple Health, sent by an iPhone Shortcut with an Access
                      service token. They wait here (numbers only – steps, sleep, heart rate …)
                      until the dashboard picks them up, puts them in your encrypted vault and
                      deletes them. A service token can only use this endpoint.
   /cmd/api/power     electricity prices for Oslo (NO1) from hvakosterstrommen.no, cached at the edge.
   /cmd/api/ping      a quick health check: is the worker up, and which vault version does it hold.
   Vault snapshots:   the first save each day keeps a copy of the vault as it was (vault:snap:<date>,
                      the last 30 days), so a mistake can be undone from Settings → Data & sync.
   /cmd/api/recovery  forgot the passcode: emails you a 6-digit code (valid 15 min, 5 tries). The right
                      code returns the recovery key, which opens the copy of your passcode that is
                      locked inside the vault file. Needs the Send email binding EMAIL below.
   /cmd/api/calendar  fetches your phone calendar (iCloud, Google or Outlook
                      calendar link) so the dashboard can show it. The link is
                      stored encrypted in the vault and only passed through here.

   Settings (Worker → Settings → Bindings / Variables and secrets):
     VAULT           KV namespace binding
     TEAM_DOMAIN     e.g. https://cmd-lundberg.cloudflareaccess.com
     POLICY_AUD      the "Application Audience (AUD) Tag" of the Access application
     GITHUB_TOKEN    secret: fine-grained token, only this repository, Contents read & write
     GITHUB_REPO     optional, default Jpme96/jplundberg.github.io
     CF_API_TOKEN    secret: API token with Account Analytics: Read
     CF_ACCOUNT_ID   your Cloudflare account ID
     CF_SITE_TAG     the site tag of jplundberg.com in Web Analytics
     EMAIL           Send email binding, destination address = your own (verified in Email Routing),
                     only needed for passcode recovery by email
     MAIL_FROM       optional, sender address on jplundberg.com (default dashboard@jplundberg.com)
   Settings → Triggers → Cron Triggers: "Every 5 minutes" (only needed for notifications)   */

const KEY = 'vault';
const SNAP = 'vault:snap:';
const MAX_BYTES = 5 * 1024 * 1024;
const SITE_FILE = '_data/site.json';
const SECTIONS = ['about', 'resume', 'courses', 'projects', 'articles'];
/* social profiles that may be shown on the site: network → allowed host */
const SOCIALS = { linkedin: 'linkedin.com', instagram: 'instagram.com', facebook: 'facebook.com', tiktok: 'tiktok.com', x: 'x.com',
  threads: 'threads.net', youtube: 'youtube.com', snapchat: 'snapchat.com', strava: 'strava.com', github: 'github.com' };

export default {
  /* every request gets a clear JSON answer – also when GitHub, Cloudflare or a calendar is down */
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (e) { console.log('error', request.method, new URL(request.url).pathname, e && e.stack || e); return json({ error: 'server error', detail: String(e && e.message || e).slice(0, 200) }, 500); }
  },
  /* every 5 minutes (Triggers → Cron Triggers): send the reminders that are due */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env));
  }
};

async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (!/^\/cmd\/api\/(vault|site|visitors|content|calendar|texts|push|health|power|ping|recovery)$/.test(path)) return json({ error: 'not found' }, 404);

    if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return json({ error: 'worker not configured' }, 503);
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok) {
      console.log('unauthorized', check);
      return json({ error: 'unauthorized', ...check }, 401);
    }

    /* a service token (the iPhone Shortcut) may only hand in health numbers */
    if (check.service && !(path === '/cmd/api/health' && request.method === 'POST')) return json({ error: 'not allowed for a service token' }, 403);
    if (path === '/cmd/api/health') return healthApi(request, env);
    if (path === '/cmd/api/site') return site(request, env);
    if (path === '/cmd/api/visitors') return visitors(url, env);
    if (path === '/cmd/api/content') return contentApi(request, env);
    if (path === '/cmd/api/calendar') return calendarFeed(request);
    if (path === '/cmd/api/texts') return textsApi(request, env);
    if (path === '/cmd/api/push') return pushApi(request, env);
    if (path === '/cmd/api/power') return powerApi(url);
    if (path === '/cmd/api/recovery') return recoveryApi(request, env);
    if (path === '/cmd/api/ping') { const v = env.VAULT ? await env.VAULT.get(KEY) : null; return json({ ok: true, now: new Date().toISOString(), rev: v ? JSON.parse(v).rev : null }); }
    return vault(request, env);
}

/* ---------- passcode recovery by email ----------
   rec:key   the recovery key (random, made in the browser). It opens a copy of the passcode that is
             stored, encrypted, in the vault file. It never leaves here without a code from your email.
   rec:otp   {h: sha-256 of the code, exp, tries, sent}  – one code at a time, 15 minutes, 5 tries
   rec:day:<date>  emails sent that day (max 5)                                                     */
const REC_KEY = 'rec:key', REC_OTP = 'rec:otp', REC_DAY = 'rec:day:';
async function sha(t) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function sameStr(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function mail(env, subject, text) {
  if (!env.EMAIL) throw Object.assign(new Error('email not set up'), { code: 'nomail' });
  const from = env.MAIL_FROM || 'dashboard@jplundberg.com';
  return env.EMAIL.send({ from: { email: from, name: 'jplundberg.com dashboard' }, subject, text });   // "to" comes from the binding
}
async function recoveryApi(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  const m = request.method;
  if (m === 'GET') return json({ on: !!(await env.VAULT.get(REC_KEY)), email: !!env.EMAIL });
  let body = {};
  try { body = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (m === 'PUT') {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(body.key || '')) return json({ error: 'bad key' }, 400);
    await env.VAULT.put(REC_KEY, body.key); await env.VAULT.delete(REC_OTP);
    return json({ ok: true, email: !!env.EMAIL });
  }
  if (m === 'DELETE') { await env.VAULT.delete(REC_KEY); await env.VAULT.delete(REC_OTP); return json({ ok: true }); }
  if (m !== 'POST') return json({ error: 'method not allowed' }, 405);
  const now = Date.now();
  if (body.test) {
    try { await mail(env, 'Dashboard: email recovery is on', 'Email recovery for jplundberg.com/cmd works.\n\nIf you forget the passcode: lock screen → Forgot passcode? → Email me a code.\n\nNorsk: Gjenoppretting på e-post virker. Glemt koden? Låseskjermen → Glemt koden? → Send meg en kode.'); }
    catch (e) { return json({ error: e.code === 'nomail' ? 'email not set up' : 'email failed', detail: String(e.code || e.message || e).slice(0, 120) }, 502); }
    return json({ ok: true });
  }
  if (!(await env.VAULT.get(REC_KEY))) return json({ error: 'off' }, 404);
  const otp = JSON.parse(await env.VAULT.get(REC_OTP) || 'null');
  if (body.send) {
    if (otp && now - otp.sent < 60e3) return json({ error: 'wait', s: Math.ceil((60e3 - (now - otp.sent)) / 1000) }, 429);
    const dk = REC_DAY + new Date(now).toISOString().slice(0, 10), n = +(await env.VAULT.get(dk) || 0);
    if (n >= 5) return json({ error: 'too many' }, 429);
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000, code = String(r).padStart(6, '0');
    try {
      await mail(env, 'Dashboard code: ' + code, 'Your code for jplundberg.com/cmd: ' + code + '\n\nIt works for 15 minutes. Then choose a new passcode.\nIf you didn’t ask for it, don’t use it – someone got past your Cloudflare login, so check Zero Trust → Access.\n\nNorsk: Koden din er ' + code + '. Den virker i 15 minutter.');
    } catch (e) { return json({ error: e.code === 'nomail' ? 'email not set up' : 'email failed', detail: String(e.code || e.message || e).slice(0, 120) }, 502); }
    await env.VAULT.put(REC_OTP, JSON.stringify({ h: await sha(code), exp: now + 15 * 60e3, tries: 0, sent: now }), { expirationTtl: 1200 });
    await env.VAULT.put(dk, String(n + 1), { expirationTtl: 2 * 86400 });
    return json({ ok: true, min: 15 });
  }
  const code = String(body.code || '').replace(/\D/g, '');
  if (!code) return json({ error: 'no code' }, 400);
  if (!otp || otp.exp < now) return json({ error: 'expired' }, 410);
  if (!sameStr(await sha(code), otp.h)) {
    otp.tries++;
    if (otp.tries >= 5) { await env.VAULT.delete(REC_OTP); return json({ error: 'expired', tries: 0 }, 410); }
    await env.VAULT.put(REC_OTP, JSON.stringify(otp), { expirationTtl: 1200 });
    return json({ error: 'wrong', tries: 5 - otp.tries }, 403);
  }
  await env.VAULT.delete(REC_OTP);
  return json({ key: await env.VAULT.get(REC_KEY) });
}

/* ---------- Apple Health inbox ---------- */
const HEALTH_KEY = 'health:inbox';
function hnum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}
function hday(o) {
  const k = /^\d{4}-\d{2}-\d{2}/.test(String(o.date || '')) ? String(o.date).slice(0, 10) : new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const out = { date: k };
  /* the known numbers, plus any other short name (up to 30) – new numbers need no Worker update */
  Object.keys(o).filter(f => f !== 'date' && /^[a-z][a-z0-9]{0,15}$/.test(f)).slice(0, 30).forEach(f => { const n = hnum(o[f]); if (n !== null) out[f] = n; });
  return Object.keys(out).length > 1 ? out : null;
}
async function healthApi(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  const cur = JSON.parse(await env.VAULT.get(HEALTH_KEY) || '[]');
  if (request.method === 'GET') return json({ items: cur });
  if (request.method === 'DELETE') { await env.VAULT.delete(HEALTH_KEY); return json({ ok: true }); }
  if (request.method === 'POST') {
    let body;
    try { body = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ error: 'bad json' }, 400); }
    const days = (Array.isArray(body.days) ? body.days : [body]).map(hday).filter(Boolean);
    if (!days.length) return json({ error: 'no numbers in the request' }, 400);
    const next = cur.concat(days.map(d => ({ ...d, t: Date.now() }))).slice(-120);
    await env.VAULT.put(HEALTH_KEY, JSON.stringify(next));
    return json({ ok: true, days: days.length });
  }
  return json({ error: 'method not allowed' }, 405);
}

/* ---------- notifications (Web Push, RFC 8030/8291/8292) ---------- */
const PUSH_PREFIX = 'push:dev:';
async function pushApi(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (request.method === 'GET') return json({ key: (await vapid(env)).pub });
  let body = {};
  try { body = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ error: 'bad json' }, 400); }
  const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
  if (!id) return json({ error: 'no device' }, 400);
  if (request.method === 'DELETE') { await env.VAULT.delete(PUSH_PREFIX + id); return json({ ok: true }); }
  if (request.method === 'PUT') {
    const sub = body.sub || {};
    if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: 'bad subscription' }, 400);
    const old = JSON.parse(await env.VAULT.get(PUSH_PREFIX + id) || '{}');
    const sent = (old.sent || []).filter(x => x.t > Date.now() - 2 * 864e5);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100).map(x => ({
      id: String(x.id || '').slice(0, 120), at: +x.at || 0, title: String(x.title || 'Dashboard').slice(0, 120),
      body: String(x.body || '').slice(0, 240), url: /^\/cmd\//.test(x.url || '') ? String(x.url).slice(0, 200) : '/cmd/'
    })).filter(x => x.id && x.at > Date.now() - 600e3);
    await env.VAULT.put(PUSH_PREFIX + id, JSON.stringify({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, items, sent, updated: Date.now() }));
    return json({ ok: true, items: items.length });
  }
  if (request.method === 'POST' && body.test) {
    const rec = JSON.parse(await env.VAULT.get(PUSH_PREFIX + id) || 'null');
    if (!rec) return json({ error: 'switch notifications on first' }, 404);
    const r = await webPush(env, rec.sub, { title: 'Dashboard', body: 'Notifications work on this device.', url: '/cmd/', tag: 'test' });
    if (r.status === 404 || r.status === 410) { await env.VAULT.delete(PUSH_PREFIX + id); return json({ error: 'this device’s subscription expired – switch notifications off and on' }, 410); }
    return r.ok ? json({ ok: true }) : json({ error: 'push service ' + r.status }, 502);
  }
  return json({ error: 'method not allowed' }, 405);
}

async function sendDue(env) {
  if (!env.VAULT) return;
  const now = Date.now();
  let cursor;
  do {
    const list = await env.VAULT.list({ prefix: PUSH_PREFIX, cursor });
    for (const k of list.keys) {
      const rec = JSON.parse(await env.VAULT.get(k.name) || 'null');
      if (!rec || !rec.sub) continue;
      const done = new Set((rec.sent || []).map(x => x.id));
      /* due now, and not more than 20 minutes late (a reminder after the fact is no use) */
      const due = rec.items.filter(x => x.at <= now && x.at > now - 20 * 60e3 && !done.has(x.id));
      if (!due.length) continue;
      let gone = false;
      for (const x of due) {
        const r = await webPush(env, rec.sub, { title: x.title, body: x.body, url: x.url, tag: x.id.slice(0, 60) });
        if (r.status === 404 || r.status === 410) { gone = true; break; }
        rec.sent = (rec.sent || []).concat({ id: x.id, t: now });
      }
      if (gone) { await env.VAULT.delete(k.name); continue; }
      rec.items = rec.items.filter(x => x.at > now - 20 * 60e3);
      rec.sent = rec.sent.filter(x => x.t > now - 2 * 864e5);
      await env.VAULT.put(k.name, JSON.stringify(rec));
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
}

/* the server's own key pair for Web Push (made once, kept in KV) */
async function vapid(env) {
  const have = await env.VAULT.get('push:vapid');
  if (have) return JSON.parse(have);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  const v = { jwk, pub };
  await env.VAULT.put('push:vapid', JSON.stringify(v));
  return v;
}
function b64u(u8) { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function cat(...parts) { const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
/* encrypt the message for one browser (RFC 8291, aes128gcm) */
async function encryptPush(sub, text) {
  const te = new TextEncoder(), uaPub = bytes(sub.keys.p256dh), auth = bytes(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);                 // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
async function webPush(env, sub, msg) {
  const v = await vapid(env), aud = new URL(sub.endpoint).origin, te = new TextEncoder();
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 50 * 60, sub: 'https://jplundberg.com' })));
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + p)));
  const body = await encryptPush(sub, JSON.stringify(msg));
  return fetch(sub.endpoint, { method: 'POST', body, headers: {
    'Authorization': 'vapid t=' + h + '.' + p + '.' + b64u(sig) + ', k=' + v.pub,
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '3600', 'Urgency': 'normal'
  } });
}

/* ---------- encrypted dashboard data ---------- */
async function vault(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (request.method === 'GET') {
    const u = new URL(request.url);
    /* the daily snapshots: list them, or fetch one to restore */
    if (u.searchParams.has('snaps')) {
      const l = await env.VAULT.list({ prefix: SNAP });
      return json({ snaps: l.keys.map(k => k.name.slice(SNAP.length)).sort().reverse() });
    }
    if (u.searchParams.has('snap')) {
      const d = String(u.searchParams.get('snap'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: 'bad date' }, 400);
      const sv = await env.VAULT.get(SNAP + d);
      return sv ? new Response(sv, { headers: hdrs() }) : json({ error: 'not found' }, 404);
    }
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
    /* first save of the day: keep yesterday's last version (30 days back) */
    if (cur) {
      const day = new Date().toISOString().slice(0, 10);
      if (!(await env.VAULT.get(SNAP + day))) {
        await env.VAULT.put(SNAP + day, cur, { expirationTtl: 31 * 864e2 });
      }
    }
    await env.VAULT.put(KEY, body);
    return json({ ok: true, rev: next.rev });
  }
  return json({ error: 'method not allowed' }, 405);
}

/* ---------- electricity prices (NO1), cached for an hour at the edge ---------- */
async function powerApi(url) {
  const d = String(url.searchParams.get('date') || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: 'bad date' }, 400);
  let r;
  try {
    r = await fetch('https://www.hvakosterstrommen.no/api/v1/prices/' + d.slice(0, 4) + '/' + d.slice(5, 7) + '-' + d.slice(8) + '_NO1.json',
      { cf: { cacheTtl: 3600, cacheEverything: true }, headers: { 'User-Agent': 'jplundberg-dashboard' } });
  } catch (e) { return json({ error: 'price service unreachable' }, 502); }
  if (r.status === 404) return json({ error: 'not published yet' }, 404);
  if (!r.ok) return json({ error: 'prices ' + r.status }, 502);
  return new Response(await r.text(), { headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=900', 'x-robots-tag': 'noindex' } });
}

/* ---------- website settings in GitHub ---------- */
async function site(request, env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'github not configured' }, 503);
  const api = 'https://api.github.com/repos/' + (env.GITHUB_REPO || 'Jpme96/jplundberg.github.io') + '/contents/' + SITE_FILE;
  const gh = { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jplundberg-dashboard' };

  if (request.method === 'GET') {
    const r = await fetch(api + '?ref=main', { headers: gh });
    if (r.status === 404) return json({ settings: cleanSite({}), sha: null });
    if (!r.ok) return json({ error: 'github ' + r.status }, 502);
    const f = await r.json();
    let settings = {};
    try { settings = JSON.parse(fromB64(f.content)); } catch (e) {}
    return json({ settings: cleanSite(settings), sha: f.sha });
  }

  if (request.method === 'PUT') {
    let body;
    try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
    const settings = cleanSite(body.settings || {});
    settings.updated = new Date().toISOString();
    const r = await fetch(api, {
      method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Website settings from the dashboard',
        content: toB64(JSON.stringify(settings, null, 2) + '\n'),
        sha: body.sha || undefined, branch: 'main'
      })
    });
    if (r.status === 409 || r.status === 422) return json({ error: 'changed elsewhere' }, 409);
    if (!r.ok) return json({ error: 'github ' + r.status }, 502);
    const out = await r.json();
    return json({ ok: true, settings, sha: out.content && out.content.sha });
  }
  return json({ error: 'method not allowed' }, 405);
}

/* Only known settings get through, with sensible limits */
function cleanSite(s) {
  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  const a = s.announcement || {};
  let link = str(a.link, 300);
  if (link && !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(link)) link = '';
  const seen = new Set();
  const sections = (Array.isArray(s.sections) ? s.sections : [])
    .filter(x => x && SECTIONS.includes(x.id) && !seen.has(x.id) && seen.add(x.id))
    .map(x => ({ id: x.id, on: x.on !== false }));
  SECTIONS.forEach(id => { if (!seen.has(id)) sections.push({ id, on: true }); });
  const ref = v => (/^[a-z0-9-]{0,80}$/.test(String(v || '')) ? String(v || '') : '');
  const f = s.featured || {};
  const socials = (Array.isArray(s.socials) ? s.socials : []).filter(x => {
    if (!x || !SOCIALS[x.net] || typeof x.url !== 'string' || x.url.length > 200) return false;
    try { const u = new URL(x.url); const h = SOCIALS[x.net]; return u.protocol === 'https:' && (u.hostname === h || u.hostname.endsWith('.' + h)); } catch (e) { return false; }
  }).slice(0, 10).map(x => ({ net: x.net, url: x.url }));
  const now = s.now || {};
  const KINDS = ['course', 'certificate', 'book', 'standard', 'other'];
  const courses = (Array.isArray(s.courses) ? s.courses : []).filter(x => x && typeof x === 'object' && str(x.title, 120)).slice(0, 40).map(x => ({
    title: str(x.title, 120), org: str(x.org, 120), year: str(x.year, 12), kind: KINDS.includes(x.kind) ? x.kind : 'course', cv: x.cv === true
  }));
  const goals = (Array.isArray(s.goals) ? s.goals : []).filter(x => x && typeof x === 'object' && str(x.name, 120)).slice(0, 20).map(x => ({
    name: str(x.name, 120), value: Number(x.value) || 0, target: Number(x.target) || 0, updated: str(x.updated, 12)
  }));
  const cv = s.cv || {};
  const prof = cv.profile || {};
  const jobs = l => (Array.isArray(l) ? l : []).slice(0, 12).filter(j => j && typeof j === 'object' && str(j.title, 120)).map(j => ({
    title: str(j.title, 120), dates: str(j.dates, 60), company: str(j.company, 120), points: (Array.isArray(j.points) ? j.points : []).slice(0, 8).map(p => str(p, 240)).filter(Boolean)
  }));
  const ex = s.experience || {};
  const edu = l => (Array.isArray(l) ? l : []).slice(0, 12).filter(j => j && typeof j === 'object' && str(j.title, 120)).map(j => ({
    title: str(j.title, 120), dates: str(j.dates, 60), school: str(j.school, 120), note: str(j.note, 160)
  }));
  const lvl = l => (Array.isArray(l) ? l : []).slice(0, 12).filter(x => x && typeof x === 'object' && str(x.name, 60)).map(x => ({ name: str(x.name, 60), level: Math.max(0, Math.min(100, Math.round(Number(x.level) || 0))) }));
  const words = l => (Array.isArray(l) ? l : []).slice(0, 10).map(x => str(x, 40)).filter(Boolean);
  const ed = cv.education || {}, sk = cv.skills || {}, lg = cv.languages || {}, hb = cv.hobbies || {}, ct = cv.contact || {};
  return {
    announcement: { on: a.on === true, en: str(a.en, 180), nb: str(a.nb, 180), link },
    sections,
    featured: { article: ref(f.article), project: ref(f.project) },
    socials,
    now: { en: str(now.en, 240), nb: str(now.nb, 240) },
    courses,
    goals,
    cv: { on: cv.on === true, courses: cv.courses !== false, projects: cv.projects !== false, articles: cv.articles === true, profile: { en: str(prof.en, 1200), nb: str(prof.nb, 1200) },
      education: { en: edu(ed.en), nb: edu(ed.nb) }, skills: { en: lvl(sk.en), nb: lvl(sk.nb) }, languages: { en: lvl(lg.en), nb: lvl(lg.nb) }, hobbies: { en: words(hb.en), nb: words(hb.nb) },
      contact: { phone: str(ct.phone, 30), address: str(ct.address, 120), born: str(ct.born, 40), nationality: str(ct.nationality, 60) } },
    experience: { en: jobs(ex.en), nb: jobs(ex.nb) },
    updated: str(s.updated, 40)
  };
}
function toB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/* ---------- articles and projects: hide / show ---------- */
const COLLECTIONS = { articles: '_articles', projects: '_projects' };

function ghHeaders(env) {
  return { 'Authorization': 'Bearer ' + env.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'jplundberg-dashboard' };
}
function repoApi(env) { return 'https://api.github.com/repos/' + (env.GITHUB_REPO || 'Jpme96/jplundberg.github.io') + '/contents/'; }

/* Reads the few front matter fields we need. Values are kept as plain text. */
function frontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  m[1].split(/\r?\n/).forEach(line => {
    const k = line.match(/^(title|ref|lang|date|published):\s*(.*)$/);
    if (k) out[k[1]] = k[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  });
  return out;
}
/* Changes only the "published" line; everything else in the file stays as it is. */
function withPublished(md, on) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  let fm = m[1].split(/\r?\n/).filter(l => !/^published:/.test(l)).join('\n').replace(/\s+$/, '');
  if (!on) fm += '\npublished: false';
  return '---\n' + fm + '\n---' + md.slice(m[0].length);
}

async function listItems(env) {
  const gh = ghHeaders(env), items = [];
  for (const [col, dir] of Object.entries(COLLECTIONS)) {
    const r = await fetch(repoApi(env) + dir + '?ref=main', { headers: gh });
    if (r.status === 404) continue;
    if (!r.ok) throw new Error('github ' + r.status);
    const files = (await r.json()).filter(f => f.type === 'file' && /^[A-Za-z0-9._-]+\.md$/.test(f.name));
    const docs = await Promise.all(files.map(f => fetch(repoApi(env) + dir + '/' + f.name + '?ref=main', { headers: gh }).then(x => x.json())));
    docs.forEach(d => {
      const fm = frontMatter(fromB64(d.content || ''));
      items.push({
        collection: col, path: d.path, sha: d.sha,
        ref: fm.ref || d.name.replace(/\.md$/, ''), lang: fm.lang || 'en',
        title: fm.title || d.name, date: (fm.date || '').slice(0, 10),
        published: !/^(false|no|0)$/i.test(fm.published || '')
      });
    });
  }
  return items;
}

async function contentApi(request, env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'github not configured' }, 503);
  try {
    if (request.method === 'GET') return json({ items: await listItems(env) });
    if (request.method === 'PUT') {
      let body;
      try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
      const col = String(body.collection || ''), ref = String(body.ref || ''), on = body.published === true;
      if (!COLLECTIONS[col] || !/^[a-z0-9-]{1,80}$/.test(ref)) return json({ error: 'bad request' }, 400);
      /* All language versions with the same ref are switched together */
      const targets = (await listItems(env)).filter(i => i.collection === col && i.ref === ref && i.published !== on);
      const gh = ghHeaders(env);
      for (const t of targets) {
        const f = await (await fetch(repoApi(env) + t.path + '?ref=main', { headers: gh })).json();
        const next = withPublished(fromB64(f.content), on);
        if (next === null) continue;
        const r = await fetch(repoApi(env) + t.path, {
          method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: (on ? 'Show ' : 'Hide ') + col.slice(0, -1) + ' "' + t.title.slice(0, 80) + '" (dashboard)', content: toB64(next), sha: f.sha, branch: 'main' })
        });
        if (!r.ok) return json({ error: 'github ' + r.status }, r.status === 409 ? 409 : 502);
      }
      return json({ ok: true, changed: targets.length, items: await listItems(env) });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 200) }, 502);
  }
}

/* ---------- visitors (Cloudflare Web Analytics) ---------- */
async function visitors(url, env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_SITE_TAG) return json({ error: 'analytics not configured' }, 503);
  const acct = String(env.CF_ACCOUNT_ID).trim(), tag = String(env.CF_SITE_TAG).trim();
  if (!/^[a-f0-9]{16,64}$/i.test(acct) || !/^[a-f0-9]{16,64}$/i.test(tag)) return json({ error: 'analytics settings look wrong' }, 503);
  const days = url.searchParams.get('days') === '30' ? 30 : 7;
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19) + 'Z';
  const until = new Date().toISOString().slice(0, 19) + 'Z';
  const f = '{AND: [{datetime_geq: "' + since + '", datetime_leq: "' + until + '"}, {siteTag: "' + tag + '"}]}';
  const g = (alias, extra, dims) => alias + ': rumPageloadEventsAdaptiveGroups(filter: ' + f + extra + ') { count sum { visits } ' + (dims ? 'dimensions { ' + dims + ' }' : '') + ' }';
  const query = '{ viewer { accounts(filter: {accountTag: "' + acct + '"}) { ' +
    g('total', ', limit: 1', '') + ' ' +
    g('days', ', limit: 100, orderBy: [date_ASC]', 'date') + ' ' +
    g('pages', ', limit: 8, orderBy: [count_DESC]', 'requestPath') + ' ' +
    g('refs', ', limit: 6, orderBy: [count_DESC]', 'refererHost') + ' ' +
    g('countries', ', limit: 6, orderBy: [count_DESC]', 'countryName') + ' } } }';
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const j = await r.json().catch(() => ({}));
  const a = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
  if (!a) return json({ error: 'analytics error', detail: (j.errors || []).map(e => e.message).join('; ').slice(0, 300) }, 502);
  const rows = (list, key) => (list || []).map(x => ({ name: (x.dimensions || {})[key] || '', views: x.count || 0, visits: (x.sum || {}).visits || 0 }));
  const total = (a.total || [])[0] || {};
  return json({
    days,
    views: total.count || 0,
    visits: (total.sum || {}).visits || 0,
    perDay: rows(a.days, 'date'),
    pages: rows(a.pages, 'requestPath'),
    referrers: rows(a.refs, 'refererHost'),
    countries: rows(a.countries, 'countryName')
  });
}

/* ---------- website texts ---------- */
/* Only these texts can be changed, each with a length limit. Empty = use the original text. */
const TEXT_FILE = '_data/texts.json';
const TEXT_KEYS = {
  description: 200, hero_items: 200, about_intro: 700, about_heading: 80, about_p1: 900, about_p2: 900,
  fact_city: 60, fact_degree: 120, exp_intro: 300, contact_intro: 700, contact_form_note: 200,
  cta_title: 140, cta_text: 400, author_bio: 200, footer_tagline: 300
};
function cleanTexts(t) {
  const out = { en: {}, nb: {} };
  ['en', 'nb'].forEach(l => {
    const src = (t && t[l]) || {};
    Object.keys(TEXT_KEYS).forEach(k => {
      const v = String(src[k] == null ? '' : src[k]).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TEXT_KEYS[k]);
      if (v) out[l][k] = v;
    });
  });
  return out;
}
async function textsApi(request, env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'github not configured' }, 503);
  const api = repoApi(env) + TEXT_FILE, gh = ghHeaders(env);
  if (request.method === 'GET') {
    const r = await fetch(api + '?ref=main', { headers: gh });
    if (r.status === 404) return json({ texts: cleanTexts({}), sha: null });
    if (!r.ok) return json({ error: 'github ' + r.status }, 502);
    const f = await r.json();
    let t = {};
    try { t = JSON.parse(fromB64(f.content)); } catch (e) {}
    return json({ texts: cleanTexts(t), sha: f.sha });
  }
  if (request.method === 'PUT') {
    let body;
    try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
    const texts = cleanTexts(body.texts);
    const r = await fetch(api, {
      method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Website texts from the dashboard', content: toB64(JSON.stringify(texts, null, 2) + '\n'), sha: body.sha || undefined, branch: 'main' })
    });
    if (r.status === 409 || r.status === 422) return json({ error: 'changed elsewhere' }, 409);
    if (!r.ok) return json({ error: 'github ' + r.status }, 502);
    const out = await r.json();
    return json({ ok: true, texts, sha: out.content && out.content.sha });
  }
  return json({ error: 'method not allowed' }, 405);
}

/* ---------- phone calendar (read only) ---------- */
/* Only calendar services are fetched, so this can't be used to reach anything else. */
const CAL_HOSTS = /^(p\d+-caldav\.icloud\.com|calendar\.google\.com|outlook\.office365\.com|outlook\.office\.com|outlook\.live\.com)$/i;
const CAL_MAX = 4 * 1024 * 1024;

async function calendarFeed(request) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
  let url;
  try { url = new URL(String(body.url || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch (e) { return json({ error: 'not a link' }, 400); }
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' || !CAL_HOSTS.test(url.hostname)) return json({ error: 'unsupported link' }, 400);
    const r = await fetch(url.toString(), { redirect: 'manual', headers: { 'User-Agent': 'jplundberg-dashboard', 'Accept': 'text/calendar, */*' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
    if (r.status === 404 || r.status === 403 || r.status === 401) return json({ error: 'calendar not found' }, 404);
    if (!r.ok) return json({ error: 'calendar ' + r.status }, 502);
    const text = await r.text();
    if (text.length > CAL_MAX) return json({ error: 'calendar too large' }, 413);
    if (!/^\s*BEGIN:VCALENDAR/i.test(text)) return json({ error: 'not a calendar' }, 502);
    return new Response(text, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }
  return json({ error: 'too many redirects' }, 502);
}

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
  return valid ? { ok: true, service: !payload.email && !!payload.common_name } : { ok: false, reason: 'bad signature' };
}

function b64url(s) { return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='); }
function dec(s) { return new TextDecoder().decode(bytes(s)); }
function bytes(s) { return Uint8Array.from(atob(b64url(s)), c => c.charCodeAt(0)); }
