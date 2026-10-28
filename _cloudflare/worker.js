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

   Settings (Worker → Settings → Bindings / Variables and secrets):
     VAULT           KV namespace binding
     TEAM_DOMAIN     e.g. https://cmd-lundberg.cloudflareaccess.com
     POLICY_AUD      the "Application Audience (AUD) Tag" of the Access application
     GITHUB_TOKEN    secret: fine-grained token, only this repository, Contents read & write
     GITHUB_REPO     optional, default Jpme96/jplundberg.github.io
     CF_API_TOKEN    secret: API token with Account Analytics: Read
     CF_ACCOUNT_ID   your Cloudflare account ID
     CF_SITE_TAG     the site tag of jplundberg.com in Web Analytics            */

const KEY = 'vault';
const MAX_BYTES = 5 * 1024 * 1024;
const SITE_FILE = '_data/site.json';
const SECTIONS = ['about', 'resume', 'projects', 'articles'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    if (!/^\/cmd\/api\/(vault|site|visitors|content)$/.test(path)) return json({ error: 'not found' }, 404);

    if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return json({ error: 'worker not configured' }, 503);
    const check = await verifyAccess(request, env).catch(e => ({ ok: false, reason: 'error: ' + e.message }));
    if (!check.ok) {
      console.log('unauthorized', check);
      return json({ error: 'unauthorized', ...check }, 401);
    }

    if (path === '/cmd/api/site') return site(request, env);
    if (path === '/cmd/api/visitors') return visitors(url, env);
    if (path === '/cmd/api/content') return contentApi(request, env);
    return vault(request, env);
  }
};

/* ---------- encrypted dashboard data ---------- */
async function vault(request, env) {
  if (!env.VAULT) return json({ error: 'worker not configured' }, 503);
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
  return {
    announcement: { on: a.on === true, en: str(a.en, 180), nb: str(a.nb, 180), link },
    sections,
    featured: { article: ref(f.article), project: ref(f.project) },
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
