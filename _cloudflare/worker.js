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
   /cmd/api/devices   your devices (Settings → Security): a list, and signing one out.
   /cmd/api/push      notifications (Settings → Notifications, off until switched on on a device):
                      the dashboard sends the reminders it planned for the next 7 days, and a
                      cron trigger (every 5 minutes) sends each one at its time with Web Push.
                      "Private" reminders contain no titles or amounts.
   /cmd/api/health    numbers from Apple Health, sent by an iPhone Shortcut with an Access
                      service token. They wait here (numbers only – steps, sleep, heart rate …)
                      until the dashboard picks them up, puts them in your encrypted vault and
                      deletes them. A service token can only use this endpoint.
   /cmd/api/power     electricity prices for Oslo (NO1) from hvakosterstrommen.no, cached at the edge.
   /cmd/api/rate      Norges Bank's policy rate (styringsrenten), its changes over the last years, cached 6 hours.
   /cmd/api/ping      a quick health check: is the worker up, which vault version it holds, and when the cron trigger last ran.
   Vault snapshots:   the first save each day keeps a copy of the vault as it was (vault:snap:<date>,
                      the last 30 days), so a mistake can be undone from Settings → Data & sync.
   /cmd/api/recipe    reads a recipe page you link to (POST {url}) and hands back its name, ingredients,
                      steps, servings and time from the page's schema.org Recipe data. Only public
                      http(s) addresses, at most 3 MB, nothing is stored.
   /cmd/api/backup    the weekly encrypted backup by email (Settings → Data & sync): the vault as it is
                      stored here (still encrypted with your passcode) is mailed to you with Resend.
                      GET = status, PUT = on/off, day and hour, POST = send one now.
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
     RESEND_API_KEY  secret, optional: an API key from resend.com (only for the weekly backup email)
     BACKUP_EMAIL    optional: where the weekly backup goes (your own address)
     BACKUP_FROM     optional: sender, default "Dashboard <onboarding@resend.dev>" (fine for your own
                     Resend address; use e.g. backup@jplundberg.com once the domain is verified in Resend)
   Settings → Triggers → Cron Triggers: "Every 5 minutes" (notifications and the weekly backup)   */

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
    ctx.waitUntil(Promise.all([sendDue(env).catch(e => console.log('push', e)), weeklyBackup(env).catch(e => console.log('backup', e)), cronBeat(env).catch(e => console.log('beat', e))]));
  }
};

/* the cron trigger leaves a mark (at most once an hour, to stay far under the free 1 000 writes a day),
   so Diagnostics can tell whether reminders are being sent at all */
const CRON_KEY = 'meta:cron';
async function cronBeat(env) {
  if (!env.VAULT) return;
  const last = +(await env.VAULT.get(CRON_KEY)) || 0;
  if (Date.now() - last > 3600e3) await env.VAULT.put(CRON_KEY, String(Date.now()));
}

async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (!/^\/cmd\/api\/(vault|site|visitors|content|article|calendar|texts|push|health|power|rate|ping|recipe|backup|file|devices|share|shared|sfile|pvault)$/.test(path)) return json({ error: 'not found' }, 404);

    if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return json({ error: 'worker not configured' }, 503);
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok) {
      console.log('unauthorized', check);
      return json({ error: 'unauthorized', ...check }, 401);
    }

    /* the person you share your home with (Settings → Shared space) only ever reaches the shared box –
       never your own vault or anything else */
    const shareCfg = env.VAULT ? await env.VAULT.get(SHARE_CFG, 'json').catch(() => null) : null;
    const em = String(check.email || '').toLowerCase();
    /* once sharing has been set up, the owner's login is known: anyone else (also someone you stopped sharing
       with) gets nothing, even if Cloudflare Access still lets them in */
    const isPartner = !check.service && !!(shareCfg && shareCfg.partner && em && em === shareCfg.partner);
    if (!check.service && !isPartner && shareCfg && shareCfg.owner && em !== shareCfg.owner) return json({ error: 'not allowed' }, 403);
    if (isPartner) {
      if (path === '/cmd/api/shared') return sharedApi(request, env, 'p');
      if (path === '/cmd/api/sfile') return sfileApi(request, url, env, true);
      if (path === '/cmd/api/pvault') return pvaultApi(request, url, env);
      if (path === '/cmd/api/share') return shareApi(request, url, env, true, shareCfg);
      return json({ error: 'only the shared space is open to you', partner: true }, 403);
    }
    if (path === '/cmd/api/shared') return sharedApi(request, env, 'o');
    if (path === '/cmd/api/sfile') return sfileApi(request, url, env, false);
    if (path === '/cmd/api/pvault') return json({ error: 'this belongs to the person you share with' }, 403);   /* never the owner */
    if (path === '/cmd/api/share') { const rq = new Request(request, { headers: new Headers(request.headers), duplex: 'half' }); rq.headers.set('X-Share-Me', em); return shareApi(rq, url, env, false, shareCfg); }

    /* a service token (the iPhone Shortcut) may only hand in health numbers */
    if (check.service && !(path === '/cmd/api/health' && request.method === 'POST')) return json({ error: 'not allowed for a service token' }, 403);
    /* a device you signed out in Settings → Security → Your devices gets nothing more (it wipes itself) */
    const devId = request.headers.get('X-Dash-Device');
    if (devId && DEV_ID.test(devId) && env.VAULT) { const dv = await env.VAULT.get(DEV_PREFIX + devId); if (dv && JSON.parse(dv).revoked) return json({ error: 'signed out', signedOut: true }, 401); }
    if (path === '/cmd/api/devices') return devicesApi(request, url, env);
    if (path === '/cmd/api/health') return healthApi(request, env);
    if (path === '/cmd/api/site') return site(request, env);
    if (path === '/cmd/api/visitors') return visitors(url, env);
    if (path === '/cmd/api/content') return contentApi(request, env);
    if (path === '/cmd/api/article') return articleApi(request, url, env);
    if (path === '/cmd/api/calendar') return calendarFeed(request);
    if (path === '/cmd/api/texts') return textsApi(request, env);
    if (path === '/cmd/api/push') return pushApi(request, env);
    if (path === '/cmd/api/power') return powerApi(url);
    if (path === '/cmd/api/rate') return rateApi();
    if (path === '/cmd/api/recipe') return recipeApi(request);
    if (path === '/cmd/api/backup') return backupApi(request, env);
    if (path === '/cmd/api/file') return fileApi(request, url, env);
    if (path === '/cmd/api/ping') { const v = env.VAULT ? await env.VAULT.get(KEY) : null; const cron = env.VAULT ? +(await env.VAULT.get(CRON_KEY)) || 0 : 0; return json({ ok: true, now: new Date().toISOString(), rev: v ? JSON.parse(v).rev : null, cron }); }
    return vault(request, env);
}

/* ---------- Shared space ----------
   share:cfg  { partner: their login email (lower case), name, since }  – set by you, never by them
   share:wrap { salt, iv, ct }  – the shared key, locked with their own passcode (they set it on their phone)
   shared     { rev, recs: { <id>: { t, by: 'o'|'p', iv, ct } | { t, by, del: 1 } } }
   Each record is encrypted on the phone with the shared key; the Worker only merges them: per record, the
   newest change wins, so two people can edit the same list at once without losing anything. */
const SHARE_CFG = 'share:cfg', SHARE_WRAP = 'share:wrap', SHARED = 'shared';
const RID = /^[a-f0-9]{16,64}$/;
async function shareApi(request, url, env, partner, cfg) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  const m = request.method;
  if (url.searchParams.has('wrap')) {
    if (m === 'GET') { const w = await env.VAULT.get(SHARE_WRAP); return w ? new Response(w, { headers: hdrs() }) : json({ error: 'empty' }, 404); }
    if (m === 'PUT') {
      const b = await request.json().catch(() => null);
      if (!b || typeof b.salt !== 'string' || typeof b.iv !== 'string' || typeof b.ct !== 'string' || b.ct.length > 2000) return json({ error: 'bad wrap' }, 400);
      await env.VAULT.put(SHARE_WRAP, JSON.stringify({ salt: b.salt, iv: b.iv, ct: b.ct, t: Date.now() }));
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  }
  if (m === 'GET') {
    const w = await env.VAULT.get(SHARE_WRAP);
    if (partner) return json({ partner: true, name: cfg.name || '', joined: !!w });
    return json(cfg && cfg.partner ? { on: true, partner: cfg.partner, name: cfg.name || '', since: cfg.since || null, joined: !!w } : { on: false });
  }
  if (partner) return json({ error: 'only the owner can change sharing' }, 403);
  const me = String(request.headers.get('X-Share-Me') || '').toLowerCase();
  if (m === 'PUT') {
    const b = await request.json().catch(() => null), email = b && String(b.partner || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json({ error: 'bad email' }, 400);
    const prev = cfg && cfg.partner, owner = (cfg && cfg.owner) || me;
    if (!owner || owner === email) return json({ error: 'that is your own login' }, 400);
    await env.VAULT.put(SHARE_CFG, JSON.stringify({ owner, partner: email, name: String(b.name || '').slice(0, 40), since: (cfg && cfg.partner && cfg.since) || new Date().toISOString() }));
    if (prev && prev !== email) await Promise.all([env.VAULT.delete(SHARE_WRAP), env.VAULT.delete(PVAULT), env.VAULT.delete(PVWRAP)]);   /* someone new: the old lock and their own space go */
    return json({ ok: true });
  }
  if (m === 'DELETE') {                                                        /* Stop sharing: access, key and box go – the owner stays known */
    await Promise.all([env.VAULT.put(SHARE_CFG, JSON.stringify({ owner: cfg && cfg.owner || me, stopped: new Date().toISOString() })), env.VAULT.delete(SHARE_WRAP), env.VAULT.delete(SHARED)]);
    await Promise.all([env.VAULT.delete(PVAULT), env.VAULT.delete(PVWRAP)]);
    let cur; do { const l = await env.VAULT.list({ prefix: SFILE, cursor: cur }); await Promise.all(l.keys.map(k => env.VAULT.delete(k.name))); cur = l.list_complete ? null : l.cursor; } while (cur);
    return json({ ok: true });
  }
  return json({ error: 'method' }, 405);
}
async function sharedApi(request, env, by) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  const raw = await env.VAULT.get(SHARED), cur = raw ? JSON.parse(raw) : { rev: 0, recs: {} };
  if (request.method === 'GET') return json(cur);
  if (request.method !== 'PUT') return json({ error: 'method' }, 405);
  const body = await request.text();
  if (body.length > 1024 * 1024) return json({ error: 'too large' }, 413);
  let b; try { b = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
  const recs = b && b.recs && typeof b.recs === 'object' ? b.recs : null; if (!recs) return json({ error: 'no records' }, 400);
  let n = 0; const now = Date.now();
  for (const id of Object.keys(recs).slice(0, 2000)) {
    const r = recs[id]; if (!RID.test(id) || !r || typeof r !== 'object') continue;
    const t = Math.min(+r.t || 0, now + 60e3); if (!t) continue;
    const old = cur.recs[id]; if (old && old.t >= t) continue;                   /* the newest change wins */
    if (r.del) cur.recs[id] = { t, by, del: 1 };
    else if (typeof r.iv === 'string' && typeof r.ct === 'string' && r.ct.length <= 20000) cur.recs[id] = { t, by, iv: r.iv, ct: r.ct };
    else continue;
    n++;
  }
  /* deleted records are remembered for 90 days, so a phone that was away long can't bring them back */
  for (const id of Object.keys(cur.recs)) if (cur.recs[id].del && now - cur.recs[id].t > 90 * 864e5) delete cur.recs[id];
  if (n) { cur.rev = (cur.rev || 0) + 1; await env.VAULT.put(SHARED, JSON.stringify(cur)); }
  return json(cur);
}

/* the other person's own space (their calendar, money, to-dos): encrypted on their phone with their own key,
   which is locked with their passcode (pvault:wrap). Only their login reaches it – the owner gets 403.
   GET → {v, rev, iv, ct} · PUT (X-Base-Rev) → 409 with the current one if it moved on · ?wrap GET/PUT the locked key */
const PVAULT = 'pvault', PVWRAP = 'pvault:wrap';
async function pvaultApi(request, url, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (url.searchParams.has('wrap')) {
    if (request.method === 'GET') { const w = await env.VAULT.get(PVWRAP); return w ? new Response(w, { headers: hdrs() }) : json({ error: 'empty' }, 404); }
    if (request.method === 'PUT') {
      const b = await request.json().catch(() => null);
      if (!b || typeof b.salt !== 'string' || typeof b.iv !== 'string' || typeof b.ct !== 'string' || b.ct.length > 2000) return json({ error: 'bad wrap' }, 400);
      await env.VAULT.put(PVWRAP, JSON.stringify({ salt: b.salt, iv: b.iv, ct: b.ct, t: Date.now() })); return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  }
  if (request.method === 'GET') { const v = await env.VAULT.get(PVAULT); return v ? new Response(v, { headers: hdrs() }) : json({ error: 'empty' }, 404); }
  if (request.method === 'PUT') {
    const body = await request.text(); if (body.length > 4 * 1024 * 1024) return json({ error: 'too large' }, 413);
    let n; try { n = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!n || n.v !== 1 || typeof n.iv !== 'string' || typeof n.ct !== 'string' || !Number.isInteger(n.rev)) return json({ error: 'not a vault' }, 400);
    const cur = await env.VAULT.get(PVAULT), curRev = cur ? JSON.parse(cur).rev || 0 : -1, base = parseInt(request.headers.get('X-Base-Rev') || '-1', 10);
    if (cur && base !== curRev) return new Response(cur, { status: 409, headers: hdrs() });
    await env.VAULT.put(PVAULT, body); return json({ ok: true, rev: n.rev });
  }
  return json({ error: 'method' }, 405);
}

/* shared files: a document you chose to share, encrypted on your phone with the shared key (the server can't
   read it). Only you put or remove them; both of you can fetch them. Stop sharing removes them all. */
const SFILE = 'sfile:';
async function sfileApi(request, url, env, partner) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (!(await env.VAULT.get(SHARE_CFG, 'json').catch(() => null) || {}).partner) return json({ error: 'not sharing' }, 403);
  const id = String(url.searchParams.get('id') || '');
  if (!RID.test(id)) return json({ error: 'bad id' }, 400);
  if (request.method === 'GET') {
    const v = await env.VAULT.get(SFILE + id, { type: 'stream' });
    return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }) : json({ error: 'not found' }, 404);
  }
  if (partner) return json({ error: 'only the owner shares files' }, 403);
  if (request.method === 'PUT') {
    const len = parseInt(request.headers.get('content-length') || '0', 10);
    if (!len || len < 30) return json({ error: 'empty' }, 400);
    if (len > FILE_MAX) return json({ error: 'too large', max: FILE_MAX }, 413);
    await env.VAULT.put(SFILE + id, request.body, { metadata: { s: len, at: Date.now() } });
    return json({ ok: true, id, size: len });
  }
  if (request.method === 'DELETE') { await env.VAULT.delete(SFILE + id); return json({ ok: true }); }
  return json({ error: 'method not allowed' }, 405);
}

/* ---------- Apple Health inbox ---------- */
const HEALTH_KEY = 'health:inbox';
function hnum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 100) / 100 : null;
}
/* sleep may come as a number (hours, minutes or seconds), "7:32" / "7:32:10", or "7 hr 32 min" / "7 t 32 min" */
function hdur(v) {
  if (typeof v === 'number') return hnum(v);
  const s = String(v == null ? '' : v).trim().toLowerCase();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return Math.round((+m[1] + m[2] / 60 + (m[3] || 0) / 3600) * 100) / 100;
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|t|time|timer)(?![a-zæøå])/), mi = s.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|minutt|minutter)(?![a-zæøå])/);
  if (h || mi) return Math.round(((h ? parseFloat(h[1].replace(',', '.')) : 0) + (mi ? parseFloat(mi[1].replace(',', '.')) / 60 : 0)) * 100) / 100;
  return hnum(v);
}
function hday(o) {
  /* field names are matched without caring about capitals: "Sleep" works like "sleep" */
  const lo = {}; Object.keys(o || {}).forEach(f => { lo[String(f).trim().toLowerCase()] = o[f]; }); o = lo;
  const k = /^\d{4}-\d{2}-\d{2}/.test(String(o.date || '')) ? String(o.date).slice(0, 10) : new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const out = { date: k };
  /* the known numbers, plus any other short name (up to 30) – new numbers need no Worker update */
  Object.keys(o).filter(f => f !== 'date' && /^[a-z][a-z0-9]{0,15}$/.test(f)).slice(0, 30).forEach(f => { const n = f === 'sleep' ? hdur(o[f]) : hnum(o[f]); if (n !== null) out[f] = n; });
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

/* ---------- files for Papers and the Home inventory ----------
   The dashboard encrypts each file with a key only your devices have (it lives inside the encrypted
   vault) before it is sent, so what is stored here is unreadable without your passcode.
   GET ?list=1 → { files: { id: size } }   GET ?id= → the encrypted bytes   PUT ?id= (body = bytes)   DELETE ?id= */
const FILE_PREFIX = 'file:';
const FILE_MAX = 24 * 1024 * 1024;                 // KV holds up to 25 MiB per value
async function fileApi(request, url, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (request.method === 'GET' && url.searchParams.get('list') === '1') {
    const files = {}; let cursor, bytes = 0, n = 0;
    do {
      const r = await env.VAULT.list({ prefix: FILE_PREFIX, cursor });
      r.keys.forEach(k => { const sz = k.metadata && k.metadata.s || 0; files[k.name.slice(FILE_PREFIX.length)] = sz; bytes += sz; });
      cursor = r.list_complete ? null : r.cursor;
    } while (cursor && ++n < 20);
    return json({ files, bytes });
  }
  const id = String(url.searchParams.get('id') || '');
  if (!/^[a-z]{2,4}-[A-Za-z0-9_-]{3,90}$/.test(id)) return json({ error: 'bad id' }, 400);
  if (request.method === 'GET') {
    const v = await env.VAULT.get(FILE_PREFIX + id, { type: 'stream' });
    return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }) : json({ error: 'not found' }, 404);
  }
  if (request.method === 'PUT') {
    const len = parseInt(request.headers.get('content-length') || '0', 10);
    if (!len || len < 30) return json({ error: 'empty' }, 400);
    if (len > FILE_MAX) return json({ error: 'too large', max: FILE_MAX }, 413);
    if (!request.body) return json({ error: 'empty' }, 400);
    await env.VAULT.put(FILE_PREFIX + id, request.body, { metadata: { s: len, at: Date.now() } });
    return json({ ok: true, id, size: len });
  }
  if (request.method === 'DELETE') { await env.VAULT.delete(FILE_PREFIX + id); return json({ ok: true }); }
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

/* ---------- Norges Bank's policy rate: { now, changes: [{ date, rate }] } (the days it changed), cached 6 hours ---------- */
async function rateApi() {
  const from = new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 10);
  const keys = ['B.KPRA.SD.R', 'B.KPRA..R'];
  for (const k of keys) {
    let r;
    try {
      r = await fetch('https://data.norges-bank.no/api/data/IR/' + k + '?format=csv&locale=en&startPeriod=' + from,
        { cf: { cacheTtl: 21600, cacheEverything: true }, headers: { 'User-Agent': 'jplundberg-dashboard', 'Accept': 'text/csv' } });
    } catch (e) { continue; }
    if (!r.ok) continue;
    const rows = parseRateCsv(await r.text());
    if (!rows.length) continue;
    const changes = [];
    rows.forEach(function (x) { if (!changes.length || changes[changes.length - 1].rate !== x.rate) changes.push(x); });
    return new Response(JSON.stringify({ now: rows[rows.length - 1].rate, asOf: rows[rows.length - 1].date, changes: changes.slice(1), first: changes[0], source: 'Norges Bank' }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=3600', 'x-robots-tag': 'noindex' } });
  }
  return json({ error: 'policy rate unavailable' }, 502);
}
function parseRateCsv(txt) {
  const lines = String(txt || '').trim().split(/\r?\n/); if (lines.length < 2) return [];
  const sep = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const cells = function (l) { return l.split(sep).map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); };
  const head = cells(lines[0]), ti = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE');
  if (ti < 0 || vi < 0) return [];
  return lines.slice(1).map(cells).map(function (c) { return { date: c[ti], rate: Math.round(parseFloat(String(c[vi]).replace(',', '.')) * 1000) / 1000 }; })
    .filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x.date) && isFinite(x.rate); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
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

/* ---------- write articles and projects from the dashboard (Admin → Website) ----------
   GET  ?path=_articles/x.md          → { path, sha, text }
   PUT  { collection, file, text, sha? } → create or update one Markdown file in _articles/ or _projects/
   POST { name, b64 }                 → upload an image to assets/img/uploads/ (jpg/png/webp, max 3 MB) → { url }
   Only those folders, only .md / images – nothing else in the repository can be touched from here. */
async function articleApi(request, url, env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'github not configured' }, 503);
  const gh = ghHeaders(env);
  const okPath = p => /^_(articles|projects)\/[a-z0-9][a-z0-9-]{0,90}\.md$/.test(p);
  try {
    if (request.method === 'GET') {
      const p = String(url.searchParams.get('path') || '');
      if (!okPath(p)) return json({ error: 'bad path' }, 400);
      const r = await fetch(repoApi(env) + p + '?ref=main', { headers: gh });
      if (r.status === 404) return json({ error: 'not found' }, 404);
      if (!r.ok) return json({ error: 'github ' + r.status }, 502);
      const f = await r.json();
      return json({ path: p, sha: f.sha, text: fromB64(f.content || '') });
    }
    let body; try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (request.method === 'PUT') {
      const dir = COLLECTIONS[String(body.collection || '')], file = String(body.file || ''), text = String(body.text || '');
      if (!dir || !/^[a-z0-9][a-z0-9-]{0,90}\.md$/.test(file)) return json({ error: 'bad name' }, 400);
      if (!/^---\n[\s\S]*?\n---/.test(text) || text.length > 200000) return json({ error: 'the file needs front matter and must be under 200 kB' }, 400);
      const p = dir + '/' + file;
      let sha = body.sha ? String(body.sha) : null;
      if (!sha) { const ex = await fetch(repoApi(env) + p + '?ref=main', { headers: gh }); if (ex.ok) return json({ error: 'exists', path: p }, 409); }
      const title = ((text.match(/\ntitle:\s*"?([^"\n]+)/) || [])[1] || file).slice(0, 80);
      const r = await fetch(repoApi(env) + p, { method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: (sha ? 'Update ' : 'New ') + body.collection.slice(0, -1) + ' "' + title + '" (dashboard)', content: toB64(text), branch: 'main', ...(sha ? { sha } : {}) }) });
      if (!r.ok) return json({ error: 'github ' + r.status }, r.status === 409 || r.status === 422 ? 409 : 502);
      const j = await r.json();
      return json({ ok: true, path: p, sha: j.content && j.content.sha });
    }
    if (request.method === 'POST') {
      const m = String(body.name || '').toLowerCase().match(/^([a-z0-9][a-z0-9-]{0,60})\.(jpg|jpeg|png|webp)$/), b64 = String(body.b64 || '').replace(/^data:[^,]+,/, '');
      if (!m || !b64 || b64.length > 4200000) return json({ error: 'jpg, png or webp under 3 MB' }, 400);
      const p = 'assets/img/uploads/' + m[1] + '-' + Date.now().toString(36) + '.' + m[2];
      const r = await fetch(repoApi(env) + p, { method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Image for an article (dashboard)', content: b64, branch: 'main' }) });
      if (!r.ok) return json({ error: 'github ' + r.status }, 502);
      return json({ ok: true, url: '/' + p });
    }
    if (request.method === 'DELETE') {   /* {paths: ['_articles/x.md', ...]} – every language version of one item; it stays in the git history */
      const paths = Array.isArray(body.paths) ? body.paths.map(String).filter(okPath).slice(0, 4) : [];
      if (!paths.length) return json({ error: 'bad path' }, 400);
      const deleted = [];
      for (const p of paths) {
        const ex = await fetch(repoApi(env) + p + '?ref=main', { headers: gh });
        if (ex.status === 404) continue;
        if (!ex.ok) return json({ error: 'github ' + ex.status, deleted }, 502);
        const f = await ex.json();
        const r = await fetch(repoApi(env) + p, { method: 'DELETE', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Delete ' + p.replace(/^_/, '') + ' (dashboard)', sha: f.sha, branch: 'main' }) });
        if (!r.ok) return json({ error: 'github ' + r.status, deleted }, 502);
        deleted.push(p);
      }
      return json({ ok: true, deleted });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) { return json({ error: String(e.message || e).slice(0, 200) }, 502); }
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

/* ---------- recipe import: read schema.org Recipe data from a page you link to ---------- */
const RECIPE_MAX = 3 * 1024 * 1024;
/* only public addresses – never this worker's own network, localhost or private ranges */
function publicHost(h) {
  h = String(h || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h.indexOf('.') < 0 || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/.test(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (h.indexOf(':') > -1) return false;       // no raw IPv6 addresses
  return true;
}
function unhtml(s) {
  return String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').trim();
}
function isRecipe(n) { const t = n && n['@type']; return Array.isArray(t) ? t.some(x => /recipe$/i.test(x)) : /recipe$/i.test(String(t || '')); }
function findRecipe(n, depth = 0) {
  if (!n || typeof n !== 'object' || depth > 6) return null;
  if (Array.isArray(n)) { for (const x of n) { const r = findRecipe(x, depth + 1); if (r) return r; } return null; }
  if (isRecipe(n)) return n;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) { const r = findRecipe(n[k], depth + 1); if (r) return r; }
  return null;
}
function isoMins(s) {
  const m = String(s || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const n = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return n > 0 && n < 10000 ? n : null;
}
function steps(x, out = []) {
  if (!x) return out;
  if (typeof x === 'string') { unhtml(x).split(/\n+/).map(s => s.trim()).filter(Boolean).forEach(s => out.push(s)); return out; }
  if (Array.isArray(x)) { x.forEach(y => steps(y, out)); return out; }
  if (typeof x === 'object') {
    if (x.itemListElement) { if (x.name) out.push(unhtml(x.name) + ':'); return steps(x.itemListElement, out); }
    steps(x.text || x.name || '', out);
  }
  return out;
}
function servingsOf(y) {
  const l = Array.isArray(y) ? y : [y];
  for (const v of l) { const m = String(v == null ? '' : v).match(/(\d+)/); if (m && +m[1] > 0 && +m[1] < 100) return +m[1]; }
  return null;
}
async function recipeApi(request) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: 'bad json' }, 400); }
  let url;
  try { url = new URL(String(body.url || '').trim()); } catch (e) { return json({ error: 'not a link' }, 400); }
  let r;
  for (let hop = 0; ; hop++) {
    if (hop > 4) return json({ error: 'too many redirects' }, 502);
    if (!/^https?:$/.test(url.protocol) || !publicHost(url.hostname) || (url.port && !/^(80|443)$/.test(url.port))) return json({ error: 'unsupported link' }, 400);
    try {
      r = await fetch(url.toString(), { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jplundberg-dashboard recipe import)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8' } });
    } catch (e) { return json({ error: 'page unreachable' }, 502); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
    break;
  }
  if (!r.ok) return json({ error: 'page ' + r.status }, 502);
  if (+(r.headers.get('content-length') || 0) > RECIPE_MAX) return json({ error: 'page too large' }, 413);
  const html = (await r.text()).slice(0, RECIPE_MAX);
  let rec = null;
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while (!rec && (m = re.exec(html))) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '').replace(/^\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/$/g, '');
    try { rec = findRecipe(JSON.parse(raw)); } catch (e) { /* a broken block: try the next one */ }
  }
  const title = unhtml(((html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i) || [])[1]) || ((html.match(/<title[^>]*>([^<]*)/i) || [])[1]) || '');
  if (!rec) return json({ error: 'no recipe', title: title.slice(0, 120) }, 422);
  const ingr = (Array.isArray(rec.recipeIngredient) ? rec.recipeIngredient : Array.isArray(rec.ingredients) ? rec.ingredients : [rec.recipeIngredient || rec.ingredients].filter(Boolean))
    .map(unhtml).filter(Boolean).slice(0, 80).map(s => s.slice(0, 160));
  const img = rec.image && (typeof rec.image === 'string' ? rec.image : Array.isArray(rec.image) ? (typeof rec.image[0] === 'string' ? rec.image[0] : rec.image[0] && rec.image[0].url) : rec.image.url);
  return json({
    name: unhtml(rec.name || title).slice(0, 120), ingredients: ingr, steps: steps(rec.recipeInstructions).slice(0, 60).map(s => s.slice(0, 600)),
    servings: servingsOf(rec.recipeYield), mins: isoMins(rec.totalTime) || ((isoMins(rec.prepTime) || 0) + (isoMins(rec.cookTime) || 0)) || null,
    image: /^https?:\/\//.test(img || '') ? String(img).slice(0, 500) : null, url: url.toString()
  });
}

/* ---------- weekly encrypted backup by email (Resend) ---------- */
const BK_CFG = 'backup:cfg', BK_LAST = 'backup:last';
function bkReady(env) { return !!(env.RESEND_API_KEY && env.BACKUP_EMAIL); }
function mask(e) { const m = String(e || '').match(/^(.)(.*)(@.+)$/); return m ? m[1] + '•••' + m[3] : ''; }
function oslo(d = new Date()) {
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), hour: +p.hour, date: p.year + '-' + p.month + '-' + p.day };
}
async function bkCfg(env) { const c = JSON.parse(await env.VAULT.get(BK_CFG) || 'null') || {}; return { on: !!c.on, day: Number.isInteger(c.day) ? c.day : 0, hour: Number.isInteger(c.hour) ? c.hour : 20 }; }
async function backupApi(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
  if (request.method === 'GET') return json({ ready: bkReady(env), to: mask(env.BACKUP_EMAIL), cfg: await bkCfg(env), last: JSON.parse(await env.VAULT.get(BK_LAST) || 'null') });
  let body;
  try { body = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (request.method === 'PUT') {
    const c = { on: !!body.on, day: Math.min(6, Math.max(0, parseInt(body.day, 10) || 0)), hour: Math.min(23, Math.max(0, parseInt(body.hour, 10) || 0)) };
    await env.VAULT.put(BK_CFG, JSON.stringify(c));
    return json({ ok: true, cfg: c });
  }
  if (request.method === 'POST') {
    if (!bkReady(env)) return json({ error: 'not set up' }, 503);
    const last = await sendBackup(env, 'now');
    return json(last, last.ok ? 200 : 502);
  }
  return json({ error: 'method not allowed' }, 405);
}
function b64ascii(str) {
  const u8 = new TextEncoder().encode(str); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
async function sendBackup(env, why) {
  const v = await env.VAULT.get(KEY);
  if (!v) { const l = { at: Date.now(), ok: false, err: 'nothing to back up yet', why }; await env.VAULT.put(BK_LAST, JSON.stringify(l)); return l; }
  const d = oslo().date;
  let r, err = null;
  try {
    r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({
      from: env.BACKUP_FROM || 'Dashboard <onboarding@resend.dev>', to: [env.BACKUP_EMAIL], subject: 'Dashboard backup ' + d,
      text: 'Your weekly dashboard backup is attached (dashboard-backup-' + d + '.json).\n\nIt is encrypted with your passcode – nobody can read it without it. To use it: Settings → Data & sync → Restore from a backup, then unlock with the passcode you had when it was made.\n\nKeep a few of these mails; you can switch the weekly mail off under Settings → Data & sync.',
      attachments: [{ filename: 'dashboard-backup-' + d + '.json', content: b64ascii(v) }] }) });
    if (!r.ok) err = 'email service ' + r.status + ': ' + (await r.text()).slice(0, 140);
  } catch (e) { err = 'email service unreachable'; }
  const last = { at: Date.now(), ok: !err, err, size: v.length, rev: JSON.parse(v).rev || null, why };
  await env.VAULT.put(BK_LAST, JSON.stringify(last));
  return last;
}
/* from the cron trigger: once a week, on your day, from your hour (Norwegian time) */
async function weeklyBackup(env) {
  if (!env.VAULT || !bkReady(env)) return;
  const c = await bkCfg(env); if (!c.on) return;
  const now = oslo(); if (now.day !== c.day || now.hour < c.hour) return;
  const last = JSON.parse(await env.VAULT.get(BK_LAST) || 'null');
  if (last && last.ok && Date.now() - last.at < 6 * 864e5) return;
  if (last && !last.ok && Date.now() - last.at < 3 * 3600e3) return;       // a failed try waits 3 hours
  await sendBackup(env, 'weekly');
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

/* ---- Your devices (Settings → Security): each device says hello now and then (at most every few hours);
   you see them all and can sign one out – it wipes its own copy the next time it asks for anything. ---- */
const DEV_PREFIX = 'dev:';
const DEV_ID = /^[a-z0-9]{8,40}$/;
async function devicesApi(request, url, env) {
  if (!env.VAULT) return json({ error: 'no storage' }, 503);
  if (request.method === 'GET') {
    const l = await env.VAULT.list({ prefix: DEV_PREFIX }), out = [];
    for (const k of l.keys.slice(0, 50)) { const v = await env.VAULT.get(k.name); if (v) { try { out.push(JSON.parse(v)); } catch (e) {} } }
    return json({ devices: out });
  }
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!DEV_ID.test(b.id || '')) return json({ error: 'bad device id' }, 400);
    const old = JSON.parse(await env.VAULT.get(DEV_PREFIX + b.id) || 'null');
    if (old && old.revoked) return json({ error: 'signed out', signedOut: true }, 401);
    const cf = request.cf || {};
    const rec = { id: b.id, name: String(b.name || '').slice(0, 60), ua: (request.headers.get('User-Agent') || '').slice(0, 200), first: old ? old.first : Date.now(), last: Date.now(), where: [cf.city, cf.country].filter(Boolean).join(', ') };
    await env.VAULT.put(DEV_PREFIX + b.id, JSON.stringify(rec), { expirationTtl: 400 * 86400 });
    return json({ ok: true });
  }
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id') || '';
    if (!DEV_ID.test(id)) return json({ error: 'bad device id' }, 400);
    if (url.searchParams.get('forget')) { await env.VAULT.delete(DEV_PREFIX + id); return json({ ok: true }); }
    const old = JSON.parse(await env.VAULT.get(DEV_PREFIX + id) || 'null') || { id };
    old.revoked = Date.now();
    await env.VAULT.put(DEV_PREFIX + id, JSON.stringify(old), { expirationTtl: 90 * 86400 });
    return json({ ok: true });
  }
  return json({ error: 'method not allowed' }, 405);
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
  return valid ? { ok: true, service: !payload.email && !!payload.common_name, email: payload.email ? String(payload.email) : '' } : { ok: false, reason: 'bad signature' };
}

function b64url(s) { return s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='); }
function dec(s) { return new TextDecoder().decode(bytes(s)); }
function bytes(s) { return Uint8Array.from(atob(b64url(s)), c => c.charCodeAt(0)); }
