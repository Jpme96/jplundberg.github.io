/* Team (work.jplundberg.com) – meetings, actions and the team, end-to-end encrypted.
   How the keys work:
   - The team key (AES-GCM) encrypts every record on the device. The server never sees it.
   - Each member has their own key pair (ECDH P-256). The private key is locked with their passcode before it is
     stored on the server (so a new device can unlock with the passcode); on this device it is kept in IndexedDB.
   - An admin's device wraps the team key for a new member's public key when it approves them. Removing someone
     makes a new team key (a new "epoch") that only the others get.
   No part of /cmd is loaded here. */
/* the look: light by default, dark or "like the device" as a choice (JP 2026-11-19) – set before anything is drawn */
/* switching team (JP 2026-11-19 21:41): a short transition – the team's initials in a ring that draws itself, its name coming in letter by letter –
   shown on the click, kept through the reload (sessionStorage, the name only) and faded out once the new team is on screen */
window.__teamSwitch = function (name) {
  var old = document.getElementById('tSwitch'); if (old) old.remove();
  var nm = String(name || 'Team').slice(0, 60), ini = nm.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'T';
  var esc = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var el = document.createElement('div'); el.id = 'tSwitch'; el.className = 't-sw'; el.setAttribute('role', 'status');
  el.innerHTML = '<div class="t-sw-mark" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="t-sw-bg" cx="60" cy="60" r="52"></circle><circle class="t-sw-ring" cx="60" cy="60" r="52"></circle></svg><b>' + esc(ini) + '</b></div>' +
    '<p class="t-sw-name">' + nm.split('').map(function (c, i) { return '<span style="--i:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>'; }).join('') + '</p>';
  el._t0 = Date.now();
  el.addEventListener('click', function () { el._skip = true; window.__teamSwitchDone(); });   /* a tap skips it */
  document.body.appendChild(el);
  return el;
};
/* it stays a little while when the page opens (JP 2026-11-19 22:32/22:33) – a tap skips it; tests (webdriver) don't wait */
var SW_MIN = navigator.webdriver ? 0 : 2200;   /* JP 22:33 'or a proper amount': long enough to see the ring and the name (about 1.3 s), then a short pause */
window.__teamSwitchDone = function () { var el = document.getElementById('tSwitch'); if (!el) return;
  if (!el._skip && !el.classList.contains('out')) { var left = SW_MIN - (Date.now() - (el._t0 || 0)); if (left > 0) { clearTimeout(el._wait); el._wait = setTimeout(window.__teamSwitchDone, left); return; } } if (el.classList.contains('out')) { if (Date.now() - (el._out || 0) > 600) el.remove(); return; } el.classList.add('out'); el._out = Date.now(); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420); };   /* never left behind: a second call removes it */
(function () { var n = null; try { n = sessionStorage.getItem('team.switch'); sessionStorage.removeItem('team.switch'); if (!n && !navigator.webdriver && !/[?&#](join|j)=/.test(location.href)) n = localStorage.getItem('team.lastName') || 'Team'; } catch (e) {}
  if (n) { var go = function () { window.__teamSwitch(n); setTimeout(window.__teamSwitchDone, 12000); }; if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); } })();
(function () { function theme() { var t = 'light'; try { t = localStorage.getItem('team.theme') || 'light'; } catch (e) {} var dk = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dk ? 'dark' : 'light'); var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dk ? '#0e0f11' : '#f5f5f7'); }
  theme(); window.__teamTheme = theme;
  /* each team's colours (JP 2026-11-23): an admin picks a palette; built from Oslo kommune's public colours (Punkt) – dark blue
     #2a2859, warm blue #1f42aa, dark green #034b45, green #43f8b6, yellow #f9c66b, red #ff8274, purple #e0adff, beige #d0bfae, blue #6fe9ff.
     Light accents carry text in dark blue (the design manual's rule); in dark mode the bright colour is the accent. */
  var PAL = {
    std: null,
    mblue: { n: ['Dark blue', 'Mørkeblå'], sw: '#2a2859', l: ['#2a2859', '42, 40, 89', '#ffffff', 'rgba(111, 233, 255, .22)', '#f3fbfd'], d: ['#6fe9ff', '111, 233, 255', '#2a2859', 'rgba(111, 233, 255, .14)'] },
    wblue: { n: ['Warm blue', 'Varm blå'], sw: '#1f42aa', l: ['#1f42aa', '31, 66, 170', '#ffffff', 'rgba(31, 66, 170, .09)', '#f4f7fd'], d: ['#9db4ff', '157, 180, 255', '#0d1a40', 'rgba(157, 180, 255, .15)'] },
    dgreen: { n: ['Dark green', 'Mørkegrønn'], sw: '#034b45', l: ['#034b45', '3, 75, 69', '#ffffff', 'rgba(67, 248, 182, .2)', '#f2faf6'], d: ['#43f8b6', '67, 248, 182', '#034b45', 'rgba(67, 248, 182, .14)'] },
    yellow: { n: ['Yellow', 'Gul'], sw: '#f9c66b', l: ['#2a2859', '42, 40, 89', '#ffffff', 'rgba(249, 198, 107, .38)', '#fdf8ee'], d: ['#f9c66b', '249, 198, 107', '#2a2859', 'rgba(249, 198, 107, .16)'] },
    red: { n: ['Red', 'Rød'], sw: '#ff8274', l: ['#2a2859', '42, 40, 89', '#ffffff', 'rgba(255, 130, 116, .26)', '#fff6f5'], d: ['#ff8274', '255, 130, 116', '#2a2859', 'rgba(255, 130, 116, .16)'] },
    purple: { n: ['Purple', 'Lilla'], sw: '#e0adff', l: ['#2a2859', '42, 40, 89', '#ffffff', 'rgba(224, 173, 255, .35)', '#faf6fd'], d: ['#e0adff', '224, 173, 255', '#2a2859', 'rgba(224, 173, 255, .16)'] },
    beige: { n: ['Beige', 'Beige'], sw: '#d0bfae', l: ['#2a2859', '42, 40, 89', '#ffffff', 'rgba(208, 191, 174, .42)', '#f8f0dd'], d: ['#d0bfae', '208, 191, 174', '#2a2859', 'rgba(208, 191, 174, .16)'] }
  };
  window.__teamPals = PAL;
  window.__teamPal = function (id) {
    var p = PAL[id] || null, st = document.getElementById('tPal');
    if (!p) { if (st) st.remove(); document.documentElement.removeAttribute('data-pal'); return; }
    if (!st) { st = document.createElement('style'); st.id = 'tPal'; document.head.appendChild(st); }
    st.textContent = ':root { --acc: ' + p.l[0] + '; --acc-rgb: ' + p.l[1] + '; --acc-ink: ' + p.l[2] + '; --acc-soft: ' + p.l[3] + '; --bg: ' + p.l[4] + '; }\n' +
      ':root[data-theme="dark"] { --acc: ' + p.d[0] + '; --acc-rgb: ' + p.d[1] + '; --acc-ink: ' + p.d[2] + '; --acc-soft: ' + p.d[3] + '; }';
    document.documentElement.setAttribute('data-pal', id);
  };
  try { var t0 = localStorage.getItem('team.cur') || 'team'; window.__teamPal(localStorage.getItem('team.pal.' + t0) || ''); } catch (e) {} if (window.matchMedia) try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme); } catch (e) {} })();

/* errors into cmd's error list (2026-11-20, JP): Team's own script errors, masked here (no numbers, no emails, never
   who it was), are sent to Team's server every few seconds and when the page closes; cmd's error list shows them as "Team". */
(function () {
  var Q = {}, T = 0, V = (((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '?').slice(0, 16);
  function mask(x) { return String(x == null ? '' : x).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '@').replace(/\d/g, '#').replace(/\s+/g, ' ').trim().slice(0, 200); }
  function add(k, m, a) {
    m = mask(m); if (!m || /ResizeObserver loop/.test(m)) return;
    var key = k + '|' + m + '|' + (a || ''), x = Q[key] || (Q[key] = { k: k, m: m, a: mask(a), p: (location.hash.split('=')[0] || '#').slice(0, 20), v: V, n: 0, t: 0 });
    x.n++; x.t = Date.now(); clearTimeout(T); T = setTimeout(send, 8000);
  }
  function send(keep) {
    var l = Object.keys(Q).map(function (k) { return Q[k]; }); if (!l.length || navigator.onLine === false) return Promise.resolve(0);
    Q = {}; var ua = navigator.userAgent;
    var body = { os: /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'other', br: /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'other', w: Math.round(innerWidth / 10) * 10, errs: l };
    try { return fetch('/api/errlog', { method: 'POST', headers: { 'x-team': '1', 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body), keepalive: !!keep }).then(function (r) { return r.ok ? l.length : 0; }, function () { return 0; }); } catch (e) { return Promise.resolve(0); }
  }
  window.addEventListener('error', function (e) { if (e && e.message) add('js', e.message, String(e.filename || '').split('/').pop().split('?')[0] + ':' + (e.lineno || 0)); });
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; add('promise', (r && r.message) || String(r), ''); });
  window.addEventListener('pagehide', function () { if (Object.keys(Q).length) send(true); });
  window.TeamErr = { add: add, send: send };
})();
(function () {
  'use strict';
  var nb = (function () { try { var v = localStorage.getItem('team.lang'); if (v) return v === 'nb'; } catch (e) {} return true; })();   /* Norwegian unless someone picks English themselves (JP 2026-11-24 21:56) */
  function L(en, no) { return nb ? no : en; }
  /* the app's own popups instead of the browser's grey boxes (window.Ask from /dc/filedrop.js – 2026-11-19) */
  function sure(msg) { return window.Ask ? window.Ask.confirm(msg, { danger: true }) : Promise.resolve(window.confirm(msg)); }   /* native-ok: only if Ask is missing */
  function showText(msg, val) { if (window.Ask) window.Ask.prompt(msg, val, { ok: L('Close', 'Lukk') }); else window.prompt(msg, val); }   /* native-ok */
  document.documentElement.lang = nb ? 'nb' : 'en';
  var $app = document.getElementById('app');
  var ROLES = ['read', 'edit', 'approve', 'admin'];
  function roleName(r) { return { read: L('Can read', 'Kan lese'), edit: L('Can edit', 'Kan redigere'), approve: L('Can approve', 'Kan godkjenne'), admin: L('Admin', 'Admin') }[r] || r; }
  var S = { me: null, keys: {}, priv: null, recs: {}, raw: {}, seq: 0, locks: {}, members: [], requests: [], invites: [], log: [], edit: null, sheet: null, timer: 0, hb: 0 };
  window.__team = S;   /* for the tests */
  /* which team: ?t= in the link (invites carry it), else the last one used here, else the first team ('team') */
  var TID = /^(team|[a-z0-9]{12})$/;
  S.tid = (function () { var q = new URLSearchParams(location.search).get('t'), v = null; try { v = localStorage.getItem('team.cur'); } catch (e) {} return TID.test(q || '') ? q : TID.test(v || '') ? v : 'team'; })();
  S.newTeam = new URLSearchParams(location.search).get('new') === '1';
  S.teams = [];
  function useTeam(id) { S.tid = id; try { localStorage.setItem('team.cur', id); } catch (e) {} }
  function goTeam(id) {
    var t = (S.teams || []).filter(function (x) { return x.id === id; })[0], nm = (t && t.name) || 'Team';
    try { sessionStorage.setItem('team.switch', nm); } catch (e) {}
    useTeam(id); closeSheet(); window.__teamSwitch(nm);
    setTimeout(function () { location.href = '/?t=' + id; }, window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
  }

  /* ---------- icons (inline, so nothing is fetched from elsewhere) ---------- */
  var IC = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.4 5 2.8 5 5.8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    docs: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13l2 2 4-4"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(s, long) { if (!s) return ''; var d = new Date(s + 'T12:00:00'); if (isNaN(d)) return ''; return d.toLocaleDateString(nb ? 'nb-NO' : 'en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fmtTime(t) { if (!t) return ''; var d = new Date(t); return d.toLocaleString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function ago(t) { if (!t) return L('Not yet', 'Ikke ennå'); var m = Math.round((Date.now() - t) / 60000); if (m < 10) return L('Now', 'Nå'); if (m < 60 * 20) return L('Today', 'I dag'); var dd = Math.round(m / 1440); return dd <= 1 ? L('Yesterday', 'I går') : L(dd + ' days ago', 'for ' + dd + ' dager siden'); }
  function rid() { return [].map.call(crypto.getRandomValues(new Uint8Array(10)), function (b) { return ('0' + b.toString(36)).slice(-2); }).join('').slice(0, 16); }
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function nMembers(n) { return n === 1 ? L('1 member', '1 medlem') : L(n + ' members', n + ' medlemmer'); }
  function rank() { return S.me && S.me.member ? ROLES.indexOf(S.me.member.role) : -1; }
  function nameOf(em) { if (!em) return '—'; if (S.me && em === S.me.email) return L('You', 'Deg'); for (var i = 0; i < S.members.length; i++) if (S.members[i].email === em) return S.members[i].name; return em.split('@')[0]; }
  var toastT = 0;
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.remove('undo'); el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 3200); }
  /* a delete is asked first and can be undone right after (JP 2026-11-24 21:56): the message gets an Angre button for 8 s */
  function undoToast(t, fn) { var el = document.getElementById('toast'); el.innerHTML = ''; el.appendChild(document.createTextNode(t + ' '));
    var b = document.createElement('button'); b.type = 'button'; b.className = 't-undo'; b.textContent = L('Undo', 'Angre'); el.appendChild(b); el.classList.add('on', 'undo'); clearTimeout(toastT);
    b.onclick = function () { el.classList.remove('on', 'undo'); clearTimeout(toastT); Promise.resolve(fn()).then(function () { toast(L('Undone', 'Angret')); }); };
    toastT = setTimeout(function () { el.classList.remove('on', 'undo'); }, 8000); }
  function typing() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }

  /* ---------- the server ---------- */
  function api(path, opt) {
    opt = opt || {};
    var init = { method: opt.method || 'GET', headers: { 'x-team': '1', 'x-tid': S.tid }, credentials: 'same-origin', cache: 'no-store' };
    if (opt.body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
    return fetch('/api/' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var er = new Error(j.error || ('HTTP ' + r.status)); er.status = r.status; er.data = j; throw er; }
        return j;
      });
    }, function () { var er = new Error('offline'); er.offline = true; throw er; });
  }
  function failMsg(e) {
    if (e && e.offline) return navigator.onLine ? L('Could not reach Team. Reload the page to sign in again.', 'Fikk ikke kontakt med Team. Last inn siden på nytt for å logge inn igjen.') : L('No connection – nothing was saved.', 'Ingen forbindelse – ingenting ble lagret.');
    if (e && e.status === 409) return L('Someone changed this meanwhile. It has been updated – try again.', 'Noen endret dette i mellomtiden. Det er oppdatert – prøv igjen.');
    if (e && e.status === 423) return L(nameOf(e.data && e.data.by) + ' is writing here right now.', nameOf(e.data && e.data.by) + ' skriver her akkurat nå.');
    if (e && e.status === 403) return L('Your role does not allow this.', 'Rollen din tillater ikke dette.');
    return L('Something went wrong. Try again.', 'Noe gikk galt. Prøv igjen.');
  }

  /* ---------- crypto ---------- */
  var C = crypto.subtle, TE = new TextEncoder(), TD = new TextDecoder();
  var EC = { name: 'ECDH', namedCurve: 'P-256' }, AES = { name: 'AES-GCM', length: 256 };
  function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function b64(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function ub64(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function passKey(pass, salt) { return C.importKey('raw', TE.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) { return C.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' }, base, AES, false, ['encrypt', 'decrypt']); }); }
  async function sealPriv(privKey, pass) { var salt = rnd(16), iv = rnd(12), k = await passKey(pass, salt); var raw = await C.exportKey('pkcs8', privKey); var ct = await C.encrypt({ name: 'AES-GCM', iv: iv }, k, raw); return { salt: b64(salt), iv: b64(iv), ct: b64(ct) }; }
  async function openPriv(blob, pass, extractable) { var k = await passKey(pass, ub64(blob.salt)); var raw = await C.decrypt({ name: 'AES-GCM', iv: ub64(blob.iv) }, k, ub64(blob.ct)); return C.importKey('pkcs8', raw, EC, !!extractable, ['deriveBits']); }
  async function keepPriv(extractableKey) { var raw = await C.exportKey('pkcs8', extractableKey); return C.importKey('pkcs8', raw, EC, false, ['deriveBits']); }
  async function pubOf(kp) { var j = await C.exportKey('jwk', kp.publicKey); return { kty: j.kty, crv: j.crv, x: j.x, y: j.y }; }
  async function hk(bits, info) { var k = await C.importKey('raw', bits, 'HKDF', false, ['deriveKey']); return C.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: TE.encode(info) }, k, AES, false, ['encrypt', 'decrypt']); }
  async function wrapFor(pubJwk, teamKey, e) {
    var pub = await C.importKey('jwk', pubJwk, EC, false, []);
    var eph = await C.generateKey(EC, true, ['deriveBits']);
    var bits = await C.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256);
    var k = await hk(bits, 'team-key-' + e), iv = rnd(12);
    var ct = await C.encrypt({ name: 'AES-GCM', iv: iv }, k, await C.exportKey('raw', teamKey));
    var epk = await C.exportKey('jwk', eph.publicKey);
    return { epk: { kty: epk.kty, crv: epk.crv, x: epk.x, y: epk.y }, iv: b64(iv), ct: b64(ct) };
  }
  async function unwrapTeam(w, priv, e) {
    var epk = await C.importKey('jwk', w.epk, EC, false, []);
    var bits = await C.deriveBits({ name: 'ECDH', public: epk }, priv, 256);
    var raw = await C.decrypt({ name: 'AES-GCM', iv: ub64(w.iv) }, await hk(bits, 'team-key-' + e), ub64(w.ct));
    return C.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  async function seal(obj, aad, e) { var iv = rnd(12); var ct = await C.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(aad) }, S.keys[e], TE.encode(JSON.stringify(obj))); return { iv: b64(iv), ct: b64(ct) }; }
  async function unseal(blob, aad, e) { var k = S.keys[e]; if (!k) return null; try { var pt = await C.decrypt({ name: 'AES-GCM', iv: ub64(blob.iv), additionalData: TE.encode(aad) }, k, ub64(blob.ct)); return JSON.parse(TD.decode(pt)); } catch (x) { return null; } }
  /* a short code both people can compare, so nobody can slip in a different key */
  async function checkCode(pub) { var h = new Uint8Array(await C.digest('SHA-256', TE.encode(pub.x + '.' + pub.y))); var s = [].map.call(h.slice(0, 4), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase(); return s.slice(0, 4) + '-' + s.slice(4); }

  /* ---------- this device's keys (IndexedDB) ---------- */
  var dbp = null;
  function db() { return dbp || (dbp = new Promise(function (res, rej) { var q = indexedDB.open('team-keys', 1); q.onupgradeneeded = function () { q.result.createObjectStore('k'); }; q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; })); }
  function kop(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('k', mode), st = t.objectStore('k'), r = fn(st); t.oncomplete = function () { res(r && r.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  /* each team's keys have their own names here: the first team keeps the old ones, others are 't/<id>/…' */
  function kn(k) { return S.tid === 'team' ? k : 't/' + S.tid + '/' + k; }
  function mine(k) { return S.tid === 'team' ? !/^t\//.test(k) : k.indexOf('t/' + S.tid + '/') === 0; }
  function kget(k) { return kop('readonly', function (st) { return st.get(kn(k)); }); }
  function kset(k, v) { return kop('readwrite', function (st) { st.put(v, kn(k)); }); }
  function kclear() { return kop('readwrite', function (st) { var r = st.getAllKeys(); r.onsuccess = function () { r.result.forEach(function (k) { if (mine(String(k))) st.delete(k); }); }; }); }

  async function loadKeys() {
    var em = await kget('email').catch(function () { return null; });
    if (em !== S.me.email) { await kclear().catch(function () {}); return false; }
    var priv = await kget('priv'); if (!priv) return false;
    S.priv = priv;
    var ks = S.me.member.keys || {};
    for (var e in ks) {
      var k = S.keys[e] || await kget('tk:' + e);
      if (!k) { try { k = await unwrapTeam(ks[e], priv, e); await kset('tk:' + e, k); } catch (x) { continue; } }
      S.keys[e] = k;
    }
    return !!S.keys[S.me.team.epoch];
  }

  /* ---------- start ---------- */
  async function boot() {
    var q = new URLSearchParams(location.search);
    if (/^[a-f0-9]{32}$/.test(q.get('join') || '')) { try { sessionStorage.setItem('team.join', q.get('join')); } catch (e) {} }
    if (q.get('t') || q.get('join') || q.get('new')) history.replaceState(null, '', '/' + location.hash);
    var cache = null;
    try { S.teams = (await api('teams')).teams || []; } catch (e) { S.teams = []; if (e.offline) { cache = await kget('cache').catch(function () { return null; }); if (cache) { S.teams = cache.teams || []; S.offline = true; } } }
    /* the team kept here may be gone or not yours: go to one you are in (an invite link always wins) */
    if (!joinCode() && !S.newTeam && S.teams.length && !S.teams.some(function (t) { return t.id === S.tid; })) useTeam(S.teams[0].id);
    useTeam(S.tid);
    if (S.offline && !cache) cache = await kget('cache').catch(function () { return null; });
    if (S.offline && cache && cache.me) { S.me = cache.me; S.cache = cache; return route(); }
    try { S.me = await api('me'); } catch (e) { if (e.offline) { cache = await kget('cache').catch(function () { return null; }); if (cache && cache.me) { S.me = cache.me; S.cache = cache; S.offline = true; return route(); } } return screen('<h1>' + esc(L('Team', 'Team')) + '</h1><p>' + esc(failMsg(e)) + '</p><button class="t-btn" type="button" data-act="reload">' + L('Try again', 'Prøv igjen') + '</button>'); }
    route();
  }
  function joinCode() { try { return sessionStorage.getItem('team.join'); } catch (e) { return null; } }
  async function route() {
    var me = S.me;
    if (S.newTeam && me.isOwner) return screenSetup(true);
    if (!me.team) return me.isOwner ? screenSetup() : screen('<h1>' + L('No team yet', 'Ingen team ennå') + '</h1><p>' + L('The team has not been set up yet.', 'Teamet er ikke satt opp ennå.') + '</p>');
    if (me.member) {
      if (!(await loadKeys())) return screenUnlock();
      try { sessionStorage.removeItem('team.join'); } catch (e) {}
      return startApp();
    }
    if (me.pending) return screenWaiting();
    if (joinCode()) return screenJoin();
    screen('<h1>' + esc(me.team.name) + '</h1><p>' + L('You are signed in as ', 'Du er logget inn som ') + '<b>' + esc(me.email) + '</b>.</p><p>' + L('You are not in this team. Ask an admin for an invite link.', 'Du er ikke med i dette teamet. Be en admin om en invitasjonslenke.') + '</p>');
  }
  function screen(html) { stopPoll(); $app.innerHTML = '<div class="t-screen">' + html + '</div>'; if (window.__teamSwitchDone) setTimeout(window.__teamSwitchDone, 250); }
  function passFields() {
    return '<label class="t-lbl">' + L('Choose a passcode (at least 8 characters)', 'Velg en kode (minst 8 tegn)') + '<input name="pass" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="t-lbl">' + L('Passcode again', 'Koden en gang til') + '<input name="pass2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<p class="t-small">' + L('It unlocks Team on a new phone or computer. Nobody else can see it or get it back – keep it in your password manager.', 'Den låser opp Team på en ny telefon eller datamaskin. Ingen andre kan se den eller hente den tilbake – ta vare på den i passordbehandleren din.') + '</p>';
  }
  function checkPass(f) {
    if (f.pass.value.length < 8) return L('The passcode needs at least 8 characters.', 'Koden må ha minst 8 tegn.');
    if (f.pass.value !== f.pass2.value) return L('The two passcodes are not the same.', 'De to kodene er ikke like.');
    return '';
  }
  function screenSetup(isNew) {
    var others = S.teams.filter(function (t) { return t.ready && t.role; });
    screen((others.length ? '<div class="t-top"><button class="t-back" type="button" data-act="teams">' + ic('back') + L('Your teams', 'Teamene dine') + '</button></div>' : '') +
      '<h1>' + (isNew ? L('New team', 'Nytt team') : L('Set up your team', 'Sett opp teamet ditt')) + '</h1><p>' + (isNew ? L('A team of its own: its own members, invites, key and records. Nobody in your other teams sees it.', 'Et eget team: egne medlemmer, invitasjoner, nøkkel og innhold. Ingen i de andre teamene dine ser det.') : L('Only you can do this, once. Then you invite the others.', 'Bare du kan gjøre dette, én gang. Så inviterer du de andre.')) + '</p>' +
      '<form class="t-form" data-form="setup"><label class="t-lbl">' + L('Team name', 'Navn på teamet') + '<input name="team" required maxlength="60" value="' + (isNew ? '' : 'Team') + '" placeholder="' + L('e.g. Made-up school project', 'f.eks. Oppdiktet skoleprosjekt') + '"></label>' +
      '<label class="t-lbl">' + L('Your name as the team sees it', 'Navnet ditt slik teamet ser det') + '<input name="name" required maxlength="60" autocomplete="name"></label>' + passFields() +
      '<p class="t-err" id="err"></p><button class="t-btn wide" type="submit">' + L('Create the team', 'Lag teamet') + '</button></form>');
  }
  function screenJoin() {
    screen('<h1>' + L('Join ', 'Bli med i ') + esc(S.me.team.name) + '</h1><p>' + L('Signed in as ', 'Logget inn som ') + '<b>' + esc(S.me.email) + '</b></p>' +
      '<form class="t-form" data-form="join"><label class="t-lbl">' + L('Your name as the team sees it', 'Navnet ditt slik teamet ser det') + '<input name="name" required maxlength="60" autocomplete="name"></label>' + passFields() +
      '<p class="t-err" id="err"></p><button class="t-btn wide" type="submit">' + L('Ask to join', 'Be om å bli med') + '</button></form>');
  }
  async function screenWaiting() {
    var code = await checkCode(S.me.pending.pub);
    screen('<h1>' + L('Waiting for approval', 'Venter på godkjenning') + '</h1><p>' + L('An admin has been told. This page opens by itself when you are approved.', 'En admin har fått beskjed. Siden åpner seg selv når du er godkjent.') + '</p>' +
      '<p class="t-small">' + L('Your check code – the admin sees the same one:', 'Kontrollkoden din – admin ser den samme:') + '</p><p class="t-code" id="checkCode">' + code + '</p>' +
      '<button class="t-btn ghost sm" type="button" data-act="withdraw">' + L('Withdraw my request', 'Trekk tilbake forespørselen') + '</button>');
    S.timer = setInterval(async function () {
      try { var me = await api('me'); if (me.member) { stopPoll(); S.me = me; route(); } else if (!me.pending) { stopPoll(); S.me = me; route(); } } catch (e) {}
    }, 5000);
  }
  function teamsBack() { return S.teams.length > 1 ? '<div class="t-top"><button class="t-back" type="button" data-act="teams">' + ic('back') + L('Your teams', 'Teamene dine') + '</button></div>' : ''; }
  function screenUnlock() {
    screen(teamsBack() + '<p class="t-small">' + esc(S.me.team.name) + '</p><h1>' + L('Unlock Team on this device', 'Lås opp Team på denne enheten') + '</h1><p>' + L('Type your Team passcode once. After that this device remembers it.', 'Skriv inn Team-koden din én gang. Etter det husker denne enheten den.') + '</p>' +
      '<form class="t-form" data-form="unlock"><label class="t-lbl">' + L('Passcode', 'Kode') + '<input name="pass" type="password" autocomplete="current-password" required></label>' +
      '<p class="t-err" id="err"></p><button class="t-btn wide" type="submit">' + L('Unlock', 'Lås opp') + '</button>' +
      '<p class="t-small">' + L('Forgot it? An admin can remove you and send a new invite.', 'Glemt den? En admin kan fjerne deg og sende en ny invitasjon.') + '</p></form>');
  }

  async function onSetup(f) {
    var err = checkPass(f); if (err) return setErr(err);
    busy(f, true);
    try {
      var kp = await C.generateKey(EC, true, ['deriveBits']), tk = await C.generateKey(AES, true, ['encrypt', 'decrypt']);
      var pub = await pubOf(kp);
      if (S.newTeam) { useTeam((await api('teams', { method: 'POST', body: {} })).id); S.newTeam = false; }
      await api('setup', { method: 'POST', body: { name: f.team.value.trim(), me: { name: f.name.value.trim(), pub: pub, priv: await sealPriv(kp.privateKey, f.pass.value), wrap: await wrapFor(pub, tk, 1) } } });
      await kset('email', S.me.email); await kset('priv', await keepPriv(kp.privateKey)); await kset('tk:1', tk);
      try { S.teams = (await api('teams')).teams || S.teams; } catch (x) {}
      S.me = await api('me'); route();
    } catch (e) { busy(f, false); setErr(failMsg(e)); }
  }
  async function onJoin(f) {
    var err = checkPass(f); if (err) return setErr(err);
    busy(f, true);
    try {
      var kp = await C.generateKey(EC, true, ['deriveBits']);
      await api('join', { method: 'POST', body: { code: joinCode(), name: f.name.value.trim(), pub: await pubOf(kp), priv: await sealPriv(kp.privateKey, f.pass.value) } });
      await kclear(); await kset('email', S.me.email); await kset('priv', await keepPriv(kp.privateKey));
      try { sessionStorage.removeItem('team.join'); } catch (x) {}
      S.me = await api('me'); route();
    } catch (e) {
      busy(f, false);
      if (e.status === 410) { try { sessionStorage.removeItem('team.join'); } catch (x) {} return setErr(L('This invite has run out or was already used. Ask for a new one.', 'Denne invitasjonen er utløpt eller allerede brukt. Be om en ny.')); }
      setErr(failMsg(e));
    }
  }
  async function onUnlock(f) {
    busy(f, true);
    try {
      var priv = await openPriv(S.me.member.priv, f.pass.value, false);
      await kclear(); await kset('email', S.me.email); await kset('priv', priv);
      if (await loadKeys()) return startApp();
      busy(f, false); setErr(L('Your key for the team is missing. Ask an admin.', 'Nøkkelen din til teamet mangler. Spør en admin.'));
    } catch (e) { busy(f, false); setErr(e && e.status ? failMsg(e) : L('Wrong passcode.', 'Feil kode.')); }
  }
  function setErr(t) { var el = document.getElementById('err') || document.querySelector('.t-sheet .t-err'); if (el) el.textContent = t; }
  function busy(f, on) { [].forEach.call(f.querySelectorAll('button, input, select, textarea'), function (x) { x.disabled = on; }); }

  /* ---------- the app ---------- */
  async function startApp() {
    document.documentElement.classList.add('unlocked'); waitChip(); flush().catch(function () {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});
    try { await Promise.all([pull(true), loadMembers(), loadAccess()]); S.offline = false; }
    catch (e) {
      var c = S.cache || await kget('cache').catch(function () { return null; });
      if (!c || !e.offline) throw e;
      S.offline = true; S.members = c.members || []; await fromRaw(c.raw || [], c.seq || 0);
      toast(L('No signal – showing what was here last. Changes wait and are sent later.', 'Ingen dekning – viser det som var her sist. Endringer venter og sendes senere.'));
    }
    draw();
    stopPoll();
    S.timer = setInterval(function () { if (document.visibilityState === 'visible') refresh(); }, 15000);
  }
  function stopPoll() { clearInterval(S.timer); S.timer = 0; }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.timer) refresh(); });
  async function refresh() {
    try {
      flush().catch(function () {});
      var before = S.seq, ep = S.me.team.epoch;
      await pull(false); if (S.offline) { S.offline = false; S.me = await api('me').catch(function () { return S.me; }); }
      if (S.tab() === 'team' || rank() >= 3) await loadMembers();
      await loadAccess();
      if (S.me.team.epoch !== ep) { S.me = await api('me'); await loadKeys(); await pull(true); }
      if (S.docsDirty) autoDone().catch(function () {});
      if (S.tab() === 'docs' && !S.edit) { if (S.docsDirty) { S.docsDirty = false; window.dispatchEvent(new Event('tools:change')); } }
      else if (!typing() && !S.sheet && !S.edit) draw(); else if (S.seq !== before) S.stale = true;
    } catch (e) { if (e.status === 403) { S.me = await api('me').catch(function () { return S.me; }); if (!S.me.member) { stopPoll(); route(); } } }
  }
  async function fromRaw(raw, seq) { await pull(true, { recs: raw, seq: seq, epoch: S.me.team.epoch, locks: {} }, true); }
  async function pull(all, given, quiet) {
    var j = given || await api('recs?since=' + (all ? 0 : S.seq));
    if (all) { S.recs = {}; S.raw = {}; }
    for (var i = 0; i < j.recs.length; i++) {
      var r = j.recs[i]; S.raw[r.id] = r;
      if (DK[r.k]) { S.docsDirty = true; S.docGen++; }
      if (r.del) { S.recs[r.id] = { id: r.id, k: r.k, v: r.v, t: r.t, by: r.by, del: 1 }; continue; }
      var d = await unseal(r, r.id + '|' + r.k + '|' + r.e, r.e);
      S.recs[r.id] = { id: r.id, k: r.k, v: r.v, t: r.t, by: r.by, e: r.e, d: d, locked: !d, seq: r.seq };
      if (!all && r.by !== S.me.email && r.k === 'action' && d && d.owner === S.me.email && !d.done) notifyMe(L('New action for you', 'Ny oppgave til deg'), d.text);
    }
    S.seq = j.seq; S.locks = j.locks || {};
    if (j.epoch !== S.me.team.epoch) S.me.team.epoch = j.epoch;
    if (!given) saveCache();
  }
  /* ---------- access (JP 2026-11-16): what each role may do in Documentation, and someone's own role on one project. The Worker
     checks the same rules on every write and sends nobody a project they have no access to; this only draws the buttons. ---------- */
  var ACTS = [['newp', 'New projects', 'Lage nye prosjekter', 'edit'], ['delp', 'Delete projects', 'Slette prosjekter', 'admin'], ['edit', 'Choose types and change the list', 'Velge typer og endre listen', 'edit'],
    ['send', 'Send requirements to the contractor', 'Sende krav til entreprenør', 'edit'], ['import', 'Import delivered files', 'Importere leverte filer', 'edit'], ['na', 'Mark “Not relevant”', 'Merke «Ikke relevant»', 'edit'],
    ['approve', 'Approved / Not approved', 'Godkjent / Ikke godkjent', 'approve'],
    ['types', 'Own project types', 'Egne prosjekttyper', 'admin'], ['rules', 'Client checklists and naming rules', 'Sjekklister og navneregler', 'admin']];
  S.acc = { m: {}, pp: {}, tr: {} };
  async function loadAccess() { try { var j = await api('access'); S.acc = { m: j.m || {}, pp: j.pp || {}, tr: j.tr || {} }; } catch (e) {} }
  function accMin(a, A) { A = A || S.acc; var d = ACTS.filter(function (x) { return x[0] === a; })[0]; return (A.m && A.m[a]) || (d ? d[3] : 'edit'); }
  function gOfRaw(raw) { return raw ? drid('g', raw) : ''; }
  function roleIn(g) { var me = S.me && S.me.member; if (!me) return 'none'; if (me.role === 'admin') return 'admin'; var pp = S.acc.pp[S.me.email] || {}; if (g && pp[g]) return pp[g]; return S.acc.tr[S.me.email] === 'none' ? 'none' : me.role; }
  function canDo(a, raw) { if (a === 'see' || a === 'tools') return true; var r = roleIn(gOfRaw(raw)); return r !== 'none' && ROLES.indexOf(r) >= ROLES.indexOf(accMin(a)); }
  function ownProjectRole() { var pp = S.acc.pp[S.me.email] || {}; return Object.keys(pp).some(function (g) { return ROLES.indexOf(pp[g]) >= 1; }); }
  /* the projects for the access card: one per group (requirements and their control project are one) */
  function accProjects() {
    var out = {}; Object.keys(S.recs).forEach(function (id) { var r = S.recs[id]; if (!r || r.del || r.k !== 'dcp' || !r.d || !r.d.p) return; var raw = r.d.key === 'dctl' && r.d.p.krav ? r.d.p.krav : r.d.p.id, g = gOfRaw(raw); if (!out[g] || r.d.key === 'dckrav') out[g] = { g: g, name: r.d.p.name || '—' }; });
    return Object.keys(out).map(function (g) { return out[g]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function accessCard() {
    var E = S.accEdit || (S.accEdit = JSON.parse(JSON.stringify(S.acc))), roles = ROLES.slice(), P = accProjects(), ppl = S.members.filter(function (m) { return m.role !== 'admin'; });
    var h = '<details class="t-card t-acc"' + (S.accOpen ? ' open' : '') + ' data-accd><summary><b>' + L('Access – who may do what', 'Tilgang – hvem kan gjøre hva') + '</b><small class="t-small">' + L('Documentation', 'Dokumentasjon') + '</small></summary>';
    h += '<p class="t-h">' + L('What each role can do', 'Hva hver rolle kan') + '</p><div class="t-mxw"><table class="t-mx"><thead><tr><th></th>' + roles.map(function (r) { return '<th>' + roleName(r) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      '<tr><td>' + L('See projects, lists and files · use the one-off tools', 'Se prosjekter, lister og filer · bruke engangsverktøyene') + '</td>' + roles.map(function () { return '<td><input type="checkbox" checked disabled></td>'; }).join('') + '</tr>' +
      ACTS.map(function (a) { var mn = ROLES.indexOf(accMin(a[0], E)); return '<tr><td>' + L(a[1], a[2]) + '</td>' + roles.map(function (r, i) { return '<td><input type="checkbox" data-accm="' + a[0] + ':' + r + '"' + (i >= mn ? ' checked' : '') + (r === 'admin' ? ' disabled' : '') + ' aria-label="' + esc(L(a[1], a[2]) + ' – ' + roleName(r)) + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    h += '<p class="t-small">' + L('Admins can always do everything. A role that can do something can also do it with the roles above it.', 'Admin kan alltid alt. Det en rolle kan, kan også rollene over den.') + '</p>';
    h += '<p class="t-h">' + L('Who sees which projects', 'Hvem ser hvilke prosjekter') + '</p>';
    if (!ppl.length || !P.length) h += '<p class="t-small">' + (ppl.length ? L('No projects yet.', 'Ingen prosjekter ennå.') : L('Everyone in the team is an admin.', 'Alle i teamet er admin.')) + '</p>';
    else h += '<div class="t-mxw"><table class="t-mx t-mxp"><thead><tr><th>' + L('Person', 'Person') + '</th><th>' + L('In the team', 'I teamet') + '</th>' + P.map(function (p) { return '<th>' + esc(p.name) + '</th>'; }).join('') + '</tr></thead><tbody>' + ppl.map(function (m) {
      var tr = E.tr[m.email] === 'none', pp = E.pp[m.email] || {};
      return '<tr><td>' + esc(m.name) + '</td><td><select data-acctr="' + esc(m.email) + '" aria-label="' + esc(m.name) + '"><option value="">' + roleName(m.role) + '</option><option value="none"' + (tr ? ' selected' : '') + '>' + L('Only their projects', 'Bare egne prosjekter') + '</option></select></td>' +
        P.map(function (p) { var v = pp[p.g] || ''; return '<td><select data-accpp="' + esc(m.email) + '|' + p.g + '"' + (v ? ' class="set"' : '') + ' aria-label="' + esc(m.name + ' – ' + p.name) + '"><option value="">' + (tr ? L('No access', 'Ingen tilgang') : L('As in the team', 'Som i teamet')) + '</option>' + [['none', L('No access', 'Ingen tilgang')], ['read', roleName('read')], ['edit', roleName('edit')], ['approve', roleName('approve')]].filter(function (o) { return !(tr && o[0] === 'none'); }).map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div><p class="t-small">' + L('A contractor can have “Only their projects” in the team and Can edit on their own project – then they see only that project. The server checks this too, and never sends anyone a project they can’t see.', 'En entreprenør kan ha «Bare egne prosjekter» i teamet og Kan redigere på sitt prosjekt – da ser de bare det prosjektet. Serveren sjekker dette også, og sender aldri noen et prosjekt de ikke har tilgang til.') + '</p>';
    var dirty = JSON.stringify(E) !== JSON.stringify(S.acc);
    h += '<div class="t-btns"><button class="t-btn ghost" type="button" data-act="accstd">' + L('Back to the standard', 'Tilbake til standard') + '</button><button class="t-btn" type="button" data-act="accsave"' + (dirty ? '' : ' disabled') + '>' + L('Save access', 'Lagre tilgang') + '</button></div></details>';
    return h;
  }
  async function saveAccess() {
    /* older records learn their project first, so the Worker can keep them from people without access */
    var tags = {}, n = 0; Object.keys(S.recs).forEach(function (id) { var r = S.recs[id], raw = S.raw[id]; if (!r || r.del || !r.d || (raw && raw.g) || !/^(dcp|dcl)$/.test(r.k)) return; var g = '';
      if (r.k === 'dcp') g = gOfRaw(r.d.key === 'dctl' && r.d.p.krav ? r.d.p.krav : r.d.p.id); else { var pr = S.recs[drid('p', r.d.key, r.d.pid)]; g = gOfRaw(r.d.key === 'dctl' && pr && pr.d && pr.d.p.krav ? pr.d.p.krav : r.d.pid); }
      if (g) { tags[id] = g; n++; } });
    if (n) await api('gtag', { method: 'POST', body: { g: tags } });
    Object.keys(tags).forEach(function (id) { if (S.raw[id]) S.raw[id].g = tags[id]; });
    var j = await api('access', { method: 'POST', body: S.accEdit });
    S.acc = { m: j.m || {}, pp: j.pp || {}, tr: j.tr || {} }; S.accEdit = null; draw(); toast(L('Access saved', 'Tilgang lagret'));
  }
  async function loadMembers() {
    var j = await api('members'); S.members = j.members || []; S.requests = j.requests || []; saveCache();
    if (rank() >= 3) { try { S.invites = (await api('invites')).invites || []; } catch (e) {} }
  }
  function list(kind) { var out = []; for (var id in S.recs) { var r = S.recs[id]; if (r.k === kind && !r.del && r.d) out.push(r); } return out; }
  function meetings() { return list('meeting').sort(function (a, b) { return (b.d.date + (b.d.from || '')).localeCompare(a.d.date + (a.d.from || '')); }); }
  function actions() { return list('action'); }
  function lockOf(id) { var l = S.locks[id]; return l && l.until > Date.now() && l.by !== S.me.email ? l : null; }

  /* no signal (JP 23:46): a change waits on this device – already encrypted, never readable – and is sent when the line is
     back (online event, every refresh). The newest version of a record wins; the version number is taken fresh on send. */
  function qKey() { return 'team.q.' + S.tid; }
  function queue() { try { return JSON.parse(localStorage.getItem(qKey()) || '[]'); } catch (e) { return []; } }
  function setQueue(q) { try { if (q.length) localStorage.setItem(qKey(), JSON.stringify(q)); else localStorage.removeItem(qKey()); } catch (e) {} waitChip(); }
  function enqueue(body) { var q = queue().filter(function (x) { return x.id !== body.id; }); q.push(body); setQueue(q); }
  function waitChip() {
    var n = queue().length, el = document.getElementById('tWait');
    if (!n) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'tWait'; el.className = 't-qwait'; document.body.appendChild(el); }
    el.textContent = L(n === 1 ? '1 change waiting for the connection' : n + ' changes waiting for the connection', n === 1 ? '1 endring venter på forbindelse' : n + ' endringer venter på forbindelse');
  }
  var flushing = false;
  async function flush() {
    if (flushing || !navigator.onLine) return; var q = queue(); if (!q.length) return; flushing = true;
    try {
      for (var i = 0; i < q.length; i++) {
        var b = q[i], cur = S.recs[b.id];
        try { var res = await api('rec', { method: 'PUT', body: Object.assign({}, b, { v: cur && cur.srvV != null ? cur.srvV : b.v }) }); if (cur) { cur.v = res.v; cur.srvV = res.v; cur.t = res.t; } q[i] = null; }
        catch (err) {
          if (err.offline) break;
          if (err.status === 409) { var srv = err.data && err.data.rec; if (srv) { try { var r2 = await api('rec', { method: 'PUT', body: Object.assign({}, b, { v: srv.v }) }); if (cur) { cur.v = r2.v; cur.srvV = r2.v; } q[i] = null; continue; } catch (e2) {} } }
          q[i] = null; toast(failMsg(err));   /* refused for good (a role, a lock): dropped, the server's version stays */
        }
      }
      setQueue(q.filter(Boolean));
      if (!queue().length) { toast(L('Changes made without signal are saved', 'Endringer gjort uten forbindelse er lagret')); await pull(false).catch(function () {}); draw(); }
    } finally { flushing = false; }
  }
  window.addEventListener('online', function () { flush(); });
  async function putRec(kind, id, data, sum) {
    var e = S.me.team.epoch, cur = S.recs[id];
    var s = await seal(data, id + '|' + kind + '|' + e, e);
    var sm = sum ? Object.assign({ e: e }, await seal({ t: String(sum).slice(0, 200) }, 'log', e)) : undefined;
    try {
      var res = await api('rec', { method: 'PUT', body: { id: id, k: kind, e: e, iv: s.iv, ct: s.ct, v: cur ? cur.v : 0, s: sm } });
      S.recs[id] = { id: id, k: kind, v: res.v, t: res.t, by: S.me.email, e: e, d: data };
      S.raw[id] = { id: id, k: kind, e: e, iv: s.iv, ct: s.ct, v: res.v, t: res.t, by: S.me.email, seq: res.seq }; saveCache();
      S.seq = Math.max(S.seq, res.seq - 1);
      return true;
    } catch (err) {
      if (err.offline) { enqueue({ id: id, k: kind, e: e, iv: s.iv, ct: s.ct, v: cur ? cur.v : 0, s: sm }); S.recs[id] = Object.assign({}, cur || {}, { id: id, k: kind, by: S.me.email, e: e, d: data, del: 0, pending: 1 }); return true; }
      if (err.status === 409) await pull(false).catch(function () {}); toast(failMsg(err)); return false;
    }
  }
  async function delRec(id, sum) {
    var cur = S.recs[id]; if (!cur) return false;
    var e = S.me.team.epoch, sm = sum ? Object.assign({ e: e }, await seal({ t: String(sum).slice(0, 200) }, 'log', e)) : undefined;
    try { var res = await api('rec', { method: 'PUT', body: { id: id, k: cur.k, del: true, v: cur.v, s: sm } }); cur.del = 1; cur.v = res.v; if (S.raw[id]) { S.raw[id] = Object.assign({}, S.raw[id], { del: 1, v: res.v }); saveCache(); } return true; }
    catch (err) { if (err.offline) { enqueue({ id: id, k: cur.k, del: true, v: cur.v, s: sm }); cur.del = 1; return true; } toast(failMsg(err)); return false; }
  }

  /* where you are: #overview, #meetings, #m=<id>, #actions, #team */
  S.tab = function () { var h = location.hash.slice(1); if (/^(docs|files|d[cr]=|in=)/.test(h) && !dtabsOn().length) return 'overview'; if (/^m=/.test(h)) return 'meetings'; if (/^(d[cr]|in)=/.test(h) || h === 'files') return 'docs'; return /^(overview|meetings|actions|docs|team)$/.test(h) ? h : 'overview'; };
  window.addEventListener('hashchange', function () { if (S.edit) endEdit(true); closeSheet(); draw(); window.scrollTo(0, 0); });

  function palCfg() { var r = S.recs.cfgpalette; return r && !r.del && r.d && window.__teamPals && window.__teamPals[r.d.p] ? r.d.p : 'std'; }
  function palSync() { var id = palCfg(), cur = document.documentElement.getAttribute('data-pal') || 'std'; if (id !== cur) window.__teamPal(id === 'std' ? '' : id); try { localStorage.setItem('team.pal.' + S.tid, id === 'std' ? '' : id); } catch (e) {} }
  function palAdmin() {
    if (rank() < 3 || !window.__teamPals) return '';
    var P = window.__teamPals, cur = palCfg(), ids = ['std'].concat(Object.keys(P).filter(function (k) { return P[k]; }));
    return '<p class="t-h">' + L('Colours', 'Farger') + '</p><div class="t-pals" role="radiogroup" aria-label="' + L('The team\'s colours', 'Teamets farger') + '">' + ids.map(function (id) {
      var p = P[id], name = id === 'std' ? L('Berry (standard)', 'Bær (standard)') : L(p.n[0], p.n[1]), sw = id === 'std' ? '#9d174d' : p.sw;
      return '<button type="button" class="t-pal" role="radio" aria-checked="' + (id === cur) + '" data-act="pal" data-pal="' + id + '"><span class="t-palsw" style="background:' + sw + '"></span>' + esc(name) + '</button>'; }).join('') +
      '</div><p class="t-small">' + L('Everyone in the team sees these colours. Built from Oslo kommune\'s colour palette.', 'Alle i teamet ser disse fargene. Laget ut fra Oslo kommunes fargepalett.') + '</p>';
  }
  function draw() {
    palSync();
    if (!S.me || !S.me.member) return;
    S.stale = false;
    clearTimeout(S.needsT); S.needsT = setTimeout(pushNeeds, 2500);   /* the contractors' lists follow the project */
    var h = location.hash.slice(1), body;
    if (S.edit) body = (S.edit.isNew || !S.recs[S.edit.id] ? viewMeetings() : viewMeeting(S.edit.id)) + '<div class="t-edov"><div class="t-edsheet" role="dialog" aria-modal="true">' + viewEdit() + '</div></div>';   /* a popup over the page, not a page of its own (JP 2026-11-17 21:39) */
    else if (/^m=/.test(h)) body = viewMeeting(h.slice(2));
    else if (/^search=/.test(h)) body = viewSearch(decodeURIComponent(h.slice(7)));
    else if (/^in=/.test(h)) body = viewInsp(h.slice(3));
    else body = ({ overview: viewOverview, meetings: viewMeetings, actions: viewActions, docs: viewDocs, team: viewTeam })[S.tab()]();
    var tab = S.tab(), reqs = rank() >= 3 ? S.requests.length : 0;
    var dKey = function (d) { var sm = d.querySelector('summary'); return d.className + '|' + (sm ? sm.textContent.trim() : ''); }, dWas = {};
    [].forEach.call($app.querySelectorAll('details'), function (d) { if (!d.closest('.dc-host, #wkDocCtl, #wkDocReq')) dWas[dKey(d)] = d.open; });   /* a box you opened or closed stays that way when the page is drawn again (JP 2026-11-17 19:59) */
    var html = body + '<nav class="t-tabs t-noprint" aria-label="' + L('Team', 'Team') + '">' + [['overview', 'home', L('Overview', 'Oversikt')], ['meetings', 'cal', L('Meetings', 'Møter')], ['actions', 'check', L('Actions', 'Oppgaver')], ['docs', 'docs', L('Documentation', 'Dokumentasjon')], ['team', 'team', L('Team', 'Team')]].filter(function (t) { return t[0] !== 'docs' || dtabsOn().length; }).map(function (t) {
      return '<button type="button" data-go="' + t[0] + '" aria-current="' + (tab === t[0]) + '">' + ic(t[1]) + '<span>' + t[2] + (t[0] === 'team' && reqs ? ' <span class="t-badge">' + reqs + '</span>' : '') + '</span></button>';
    }).join('') + '</nav>';
    if (html === S.lastHtml && $app.querySelector(':scope > .t-tabs')) return;   /* nothing changed: leave the page alone – redrawing it every 15 s made Team stutter (JP 2026-11-17 21:35) */
    S.lastHtml = html; $app.innerHTML = html; try { if (S.me && S.me.team && S.me.team.name) localStorage.setItem('team.lastName', S.me.team.name); } catch (e) {} if (window.__teamSwitchDone) setTimeout(window.__teamSwitchDone, 350);
    document.documentElement.classList.toggle('t-modal', !!S.edit);
    [].forEach.call($app.querySelectorAll('details'), function (d) { var w = dWas[dKey(d)]; if (w !== undefined && d.open !== w) d.open = w; if (d.hasAttribute('data-accd')) S.accOpen = d.open; });
    if (tab === 'docs' && !S.edit) { docsReady(); if (S.dtab === 'files') loadUploads(); }
  }
  function head(title, sub, back) {
    return '<div class="t-top t-noprint">' + (back ? '<a class="t-back" href="#' + back[0] + '">' + ic('back') + esc(back[1]) + '</a>' : '<small>work.jplundberg.com</small>') +
      '<span class="t-topr">' + (S.me.isOwner && !back ? '<a class="t-tocmd" href="https://jplundberg.com/cmd/work/" target="_blank" rel="noopener" title="' + L('Open /cmd', 'Åpne /cmd') + '">cmd ↗</a>' : '') + '<a class="t-icon" href="#search=" aria-label="' + L('Search', 'Søk') + '">' + ic('search') + '</a>' + (S.teams.length > 1 || S.me.isOwner ? '<button class="t-icon" type="button" data-act="teams" aria-label="' + L('Your teams', 'Teamene dine') + '">' + ic('swap') + '</button>' : '') + '<button class="t-icon" type="button" data-act="settings" aria-label="' + L('Settings', 'Innstillinger') + '">' + ic('gear') + '</button></span></div>' +
      '<div class="t-title"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  }

  /* what's new since your last visit (JP 23:46): what others did, counted by kind; "Seen" clears it. The app badge shows
     your new actions; with notifications on, this device tells you about a new action while Team is open in the background. */
  function seenKey() { return 'team.seen.' + S.tid; }
  function seenSeq() { var v = null; try { v = localStorage.getItem(seenKey()); } catch (e) {} if (v == null) { try { localStorage.setItem(seenKey(), String(S.seq)); } catch (e) {} return S.seq; } return +v || 0; }
  function news() {
    var since = seenSeq(), n = { mine: 0, act: 0, meet: 0, docs: {}, by: {} };
    for (var id in S.recs) { var r = S.recs[id]; if (!r.seq || r.seq <= since || r.by === S.me.email || r.del) continue;
      n.by[r.by] = 1;
      if (r.k === 'action' && r.d) { if (r.d.owner === S.me.email && !r.d.done) n.mine++; else n.act++; }
      else if (r.k === 'meeting') n.meet++;
      else if (DK[r.k] && r.d) n.docs[(r.d.p && r.d.p.name) || r.d.pid || r.k] = 1; }
    n.ndocs = Object.keys(n.docs).length; n.total = n.mine + n.act + n.meet + n.ndocs; return n;
  }
  function badge(n) { try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {} }
  function notifyMe(title, body) {
    try { if (localStorage.getItem('team.notify') !== '1' || !window.Notification || Notification.permission !== 'granted' || !document.hidden) return; new Notification(title, { body: String(body || '').slice(0, 120), tag: 'team-' + S.tid, icon: '/icon-192.png' }); } catch (e) {}
  }
  function newsCard() {
    var n = news(); badge(n.mine); if (!n.total) return '';
    var who = Object.keys(n.by).map(nameOf).slice(0, 3).join(', ');
    var lines = [n.mine ? L(n.mine + (n.mine === 1 ? ' new action for you' : ' new actions for you'), n.mine + (n.mine === 1 ? ' ny oppgave til deg' : ' nye oppgaver til deg')) : '', n.act ? L(n.act + (n.act === 1 ? ' action changed' : ' actions changed'), n.act + (n.act === 1 ? ' oppgave endret' : ' oppgaver endret')) : '',
      n.meet ? L(n.meet + (n.meet === 1 ? ' meeting' : ' meetings') + ' new or changed', n.meet + (n.meet === 1 ? ' møte' : ' møter') + ' nye eller endret') : '', n.ndocs ? L('Changes in ' + n.ndocs + (n.ndocs === 1 ? ' document project' : ' document projects'), 'Endringer i ' + n.ndocs + (n.ndocs === 1 ? ' dokumentprosjekt' : ' dokumentprosjekter')) : ''].filter(Boolean);
    return '<div class="t-card acc t-news"><h2>' + L('Since your last visit', 'Siden sist') + '</h2><ul>' + lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="t-small">' + esc(L('By ', 'Av ') + who) + '</p><button class="t-btn sm" type="button" data-act="seen">' + L('Seen', 'Sett') + '</button></div>';
  }
  /* search in the team (JP 23:46) – also opened from /cmd's search (#search=…); everything is searched here, on the device */
  function viewSearch(q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean), hit = function (o) { var hay = JSON.stringify(o).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) > -1; }); };
    var out = head(L('Search', 'Søk'), '', ['overview', L('Overview', 'Oversikt')]) + '<form class="t-form t-srch" data-form="search"><input name="q" type="search" value="' + esc(q) + '" placeholder="' + esc(L('Search meetings, actions and documents', 'Søk i møter, oppgaver og dokumenter')) + '" autocomplete="off"></form>';
    if (!words.length) return out;
    var ms = meetings().filter(function (m) { return hit(m.d); }), as = actions().filter(function (a) { return hit(a.d); }), ds = [];
    (docRO().dctl || []).forEach(function (p) { var ls = (p.lines || []).filter(function (l) { return hit(l); }); if (hit({ n: p.name, no: p.no, who: p.who, t: p.trade }) || ls.length) ds.push({ p: p, n: ls.length }); });
    if (!ms.length && !as.length && !ds.length) return out + '<p class="t-empty">' + esc(L('Nothing found for “' + q + '”.', 'Fant ingenting for «' + q + '».')) + '</p>';
    if (ms.length) out += '<p class="t-h">' + L('Meetings', 'Møter') + '</p>' + ms.slice(0, 30).map(meetingCard).join('');
    if (as.length) out += '<p class="t-h">' + L('Actions', 'Oppgaver') + '</p>' + actionList(as.slice(0, 50), true);
    if (ds.length) out += '<p class="t-h">' + L('Documentation', 'Dokumentasjon') + '</p><ul class="t-list">' + ds.slice(0, 30).map(function (x) { return '<li><a class="t-row" href="#dc=' + esc(x.p.id) + '"><span class="grow"><span>' + esc(x.p.name) + '</span><small>' + esc(x.n ? L(x.n + ' matching documents', x.n + ' treff i dokumentene') : L('The project', 'Prosjektet')) + '</small></span></a></li>'; }).join('') + '</ul>';
    return out;
  }
  function viewOverview() {
    var t = today(), ms = meetings();
    var next = ms.filter(function (m) { return m.d.date >= t; }).sort(function (a, b) { return (a.d.date + a.d.from).localeCompare(b.d.date + b.d.from); })[0] || ms[0];
    var mine = actions().filter(function (a) { return !a.d.done && a.d.owner === S.me.email; }).sort(byDue);
    var out = head(S.me.team.name, nMembers(S.members.length) + L(' · your role: ', ' · din rolle: ') + roleName(S.me.member.role));
    out += welcomeCard();
    out += '<div class="t-cols"><div class="t-col">' + clockCard() + newsCard() + weekCard();
    if (rank() >= 3 && S.requests.length) out += '<a class="t-card acc t-link" href="#team"><h2>' + L(S.requests.length + ' waiting to join', S.requests.length + ' venter på å bli med') + '</h2><span class="t-small">' + L('Check their code and approve them under Team.', 'Sjekk koden deres og godkjenn dem under Team.') + '</span></a>';
    out += '<p class="t-h">' + (next && next.d.date >= t ? L('Next meeting', 'Neste møte') : L('Latest meeting', 'Siste møte')) + '</p>';
    out += next ? meetingCard(next) : '<div class="t-card"><p class="t-empty">' + L('No meetings yet.', 'Ingen møter ennå.') + '</p>' + (rank() >= 1 ? '<button class="t-btn sm" type="button" data-act="newMeeting">' + ic('plus') + L('New meeting', 'Nytt møte') + '</button>' : '') + '</div>';
    out += '<p class="t-h"><span>' + L('My open actions', 'Mine åpne oppgaver') + '</span><span>' + mine.length + '</span></p>';
    out += mine.length ? actionList(mine) : '<p class="t-empty">' + L('Nothing open for you.', 'Ingenting åpent for deg.') + '</p>';
    out += '</div><div class="t-col">' + projectsCard() + '</div></div>';   /* two columns on a computer (JP 2026-11-17 11:43) */
    return out;
  }
  /* a welcome guide for someone new to the team (2026-11-20, plan Part 4): what to do first and where things are –
     until they close it (kept per team on this device) */
  function welcomeCard() {
    var key = 'team.welcome.' + S.tid; try { if (localStorage.getItem(key) || (navigator.webdriver && !window.__welcomeTest)) return ''; } catch (e) { return ''; }   /* tests skip it, like the switch screen */
    var steps = [
      ['home', L('Overview', 'Oversikt'), L('Your open actions and the next meeting – start here each day.', 'Dine åpne oppgaver og neste møte – start her hver dag.')],
      ['docs', L('Documentation', 'Dokumentasjon'), L('The document requirements, what has come in and the report for each project.', 'Dokumentkravene, det som har kommet inn og rapporten for hvert prosjekt.')],
      ['cal', L('Meetings', 'Møter'), L('Agendas, minutes and the actions that come out of them.', 'Saksliste, referat og oppgavene som kommer ut av dem.')],
      ['gear', L('Settings', 'Innstillinger'), L('Turn on notifications to hear when something changes – only who changed what kind, never the content.', 'Slå på varsler for å høre når noe endres – bare hvem som endret hva slags, aldri innholdet.')]
    ];
    return '<div class="t-card t-welcome"><h2>' + L('Welcome to ', 'Velkommen til ') + esc(S.me.team.name) + '</h2><p class="t-small">' + L('Everything here is encrypted in your browser – the server never sees what you write.', 'Alt her krypteres i nettleseren din – serveren ser aldri det du skriver.') + '</p><ol class="t-wsteps">' +
      steps.map(function (s) { return '<li>' + ic(s[0]) + '<span><b>' + esc(s[1]) + '</b><small>' + esc(s[2]) + '</small></span></li>'; }).join('') + '</ol>' +
      '<button class="t-btn sm ghost" type="button" data-act="welcomeOk">' + L('Got it', 'Skjønner') + '</button></div>';
  }
  function meetingCard(m) {
    var open = actions().filter(function (a) { return a.d.meeting === m.id && !a.d.done; }).length;
    var who = (m.d.att || []).length + (lines(m.d.guests).length);
    return '<a class="t-card t-link" href="#m=' + m.id + '"><h2>' + esc(m.d.title || L('Meeting', 'Møte')) + '</h2><span class="t-small">' + esc(fmtDate(m.d.date)) + (m.d.from ? ' · ' + esc(m.d.from) : '') + ' · ' + L(who + ' attending', who + ' deltar') + (open ? ' · ' + L(open + ' open actions', open + ' åpne oppgaver') : '') + '</span>' + (lockOf(m.id) ? '<p class="t-small"><span class="t-chip acc">' + esc(L(nameOf(lockOf(m.id).by) + ' is writing', nameOf(lockOf(m.id).by) + ' skriver')) + '</span></p>' : '') + '</a>';
  }
  function byDue(a, b) { return (a.d.due || '9999').localeCompare(b.d.due || '9999'); }
  function actionList(xs, showMeeting) {
    var t = today();
    return '<ul class="t-list">' + xs.map(function (a) {
      var late = !a.d.done && a.d.due && a.d.due < t, m = a.d.meeting && S.recs[a.d.meeting] && S.recs[a.d.meeting].d;
      return '<li class="' + (a.d.done ? 'done' : '') + '"><input type="checkbox" data-tick="' + a.id + '"' + (a.d.done ? ' checked' : '') + (rank() < 1 ? ' disabled' : '') + ' aria-label="' + esc(L('Done: ', 'Ferdig: ') + a.d.text) + '">' +
        '<button class="t-row" type="button" data-act="editAction" data-id="' + a.id + '"' + (rank() < 1 ? ' disabled' : '') + '><span class="grow"><span>' + esc(a.d.text) + '</span><small>' + esc(nameOf(a.d.owner)) +
        (a.d.due ? ' · <span class="' + (late ? 't-warn' : '') + '">' + esc((late ? L('Overdue · ', 'Forfalt · ') : L('Due ', 'Frist ')) + fmtDate(a.d.due)) + '</span>' : '') + (showMeeting && m ? ' · ' + esc(m.title) : '') + (a.d.doc && docOf(a.d.doc) ? ' · ' + esc(L('Document: ', 'Dokument: ') + docLabel(docOf(a.d.doc))) : '') + '</small></span></button></li>';
    }).join('') + '</ul>';
  }

  function viewMeetings() {
    var ms = meetings();
    var out = head(L('Meetings', 'Møter'), L(ms.length + ' meetings', ms.length + ' møter'));
    if (rank() >= 1) out += '<button class="t-btn wide" type="button" data-act="newMeeting">' + ic('plus') + L('New meeting', 'Nytt møte') + '</button><p></p>';
    out += ms.length ? ms.map(meetingCard).join('') : '<p class="t-empty">' + L('No meetings yet.', 'Ingen møter ennå.') + '</p>';
    return out;
  }

  function carried(m) {
    return actions().filter(function (a) { var src = a.d.meeting && S.recs[a.d.meeting]; return a.d.meeting !== m.id && !a.d.done && src && src.d && !src.del && src.d.date < m.d.date; }).sort(byDue);
  }
  function viewMeeting(id) {
    var m = S.recs[id];
    if (!m || m.del || !m.d) return head(L('Meeting', 'Møte'), '', ['meetings', L('Meetings', 'Møter')]) + '<p class="t-empty">' + L('This meeting is not here (any more).', 'Dette møtet finnes ikke (lenger).') + '</p>';
    var d = m.d, lk = lockOf(id), own = actions().filter(function (a) { return a.d.meeting === id; }).sort(byDue), co = carried(m);
    var out = head(d.title || L('Meeting', 'Møte'), fmtDate(d.date, true) + (d.from ? ' · ' + d.from + (d.to ? '–' + d.to : '') : ''), ['meetings', L('Meetings', 'Møter')]);
    if (lk) out += '<div class="t-banner t-noprint"><span class="t-dot"></span>' + esc(L(nameOf(lk.by) + ' is writing – you can read until they are done', nameOf(lk.by) + ' skriver – du kan lese til de er ferdige')) + '</div>';
    out += '<div class="t-btns t-noprint">' + (rank() >= 1 && !lk ? '<button class="t-btn sm" type="button" data-act="edit" data-id="' + id + '">' + L('Edit', 'Rediger') + '</button>' : '') + '<button class="t-btn ghost sm" type="button" data-act="print">' + L('Export PDF', 'Eksporter PDF') + '</button></div>';
    var att = (d.att || []).map(function (e) { return '<span class="t-chip">' + esc(nameOf(e)) + '</span>'; }).concat(lines(d.guests).map(function (g) { return '<span class="t-chip guest">' + esc(g) + ' (' + L('guest', 'gjest') + ')</span>'; }));
    out += '<p class="t-h">' + L('Attending', 'Til stede') + '</p><div class="t-chips">' + (att.join('') || '<span class="t-empty">—</span>') + '</div>';
    out += sec(L('Agenda', 'Agenda'), lines(d.agenda), true) + sec(L('Decisions', 'Vedtak'), lines(d.decisions)) + (d.notes ? '<p class="t-h">' + L('Notes', 'Notater') + '</p><div class="t-card"><p class="t-pre">' + esc(d.notes) + '</p></div>' : '');
    out += '<p class="t-h"><span>' + L('Actions', 'Oppgaver') + '</span>' + (rank() >= 1 ? '<button class="t-btn ghost sm t-noprint" type="button" data-act="newAction" data-meeting="' + id + '">' + ic('plus') + L('Add', 'Legg til') + '</button>' : '') + '</p>';
    out += own.length ? actionList(own) : '<p class="t-empty">' + L('No actions from this meeting.', 'Ingen oppgaver fra dette møtet.') + '</p>';
    if (co.length) out += '<p class="t-h">' + L('Carried over from earlier meetings', 'Videreført fra tidligere møter') + '</p>' + actionList(co, true);
    out += '<p class="t-printonly">' + esc(S.me.team.name) + ' · ' + esc(L('Exported ', 'Eksportert ') + fmtTime(Date.now())) + '</p>';
    return out;
  }
  function sec(title, xs, ordered) { return '<p class="t-h">' + esc(title) + '</p><div class="t-card">' + (xs.length ? '<' + (ordered ? 'ol' : 'ul') + ' class="t-lines">' + xs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>' : '<span class="t-empty">—</span>') + '</div>'; }

  /* editing a meeting: one person at a time (the server holds a short lock that this device keeps renewing) */
  async function startEdit(id, isNew) {
    var r = await api('lock', { method: 'POST', body: { id: id, on: true } }).catch(function (e) { return e; });
    if (r instanceof Error) { toast(failMsg(r)); return; }
    var base = isNew ? { title: '', date: today(), from: '09:00', to: '10:00', att: [S.me.email], guests: '', agenda: '', decisions: '', notes: '' } : JSON.parse(JSON.stringify(S.recs[id].d));
    S.edit = { id: id, isNew: !!isNew, d: base };
    clearInterval(S.hb); S.hb = setInterval(function () { if (S.edit) api('lock', { method: 'POST', body: { id: S.edit.id, on: true } }).catch(function () {}); }, 30000);
    if (location.hash !== '#m=' + id) history.replaceState(null, '', '#m=' + id);
    draw(); window.scrollTo(0, 0);
  }
  function endEdit(quiet) { if (!S.edit) return; var id = S.edit.id; S.edit = null; clearInterval(S.hb); api('lock', { method: 'POST', body: { id: id, on: false } }).catch(function () {}); if (!quiet) draw(); }
  function viewEdit() {
    var d = S.edit.d;
    var out = '<div class="t-top"><button class="t-back" type="button" data-act="cancelEdit">' + ic('back') + L('Cancel', 'Avbryt') + '</button></div><div class="t-title"><h1>' + (S.edit.isNew ? L('New meeting', 'Nytt møte') : L('Edit meeting', 'Rediger møte')) + '</h1><p>' + L('Others see that you are writing.', 'De andre ser at du skriver.') + '</p></div>';
    out += '<form class="t-form" data-form="meeting">' +
      '<label class="t-lbl">' + L('Title', 'Tittel') + '<input name="title" required maxlength="120" value="' + esc(d.title) + '"></label>' +
      '<label class="t-lbl">' + L('Date', 'Dato') + '<input name="date" type="date" required value="' + esc(d.date) + '"></label>' +
      '<div class="t-row2"><label class="t-lbl">' + L('From', 'Fra') + '<input name="from" type="time" value="' + esc(d.from) + '"></label><label class="t-lbl">' + L('To', 'Til') + '<input name="to" type="time" value="' + esc(d.to) + '"></label></div>' +
      '<div class="t-lbl">' + L('Attending', 'Til stede') + '<div class="t-pick">' + S.members.map(function (m) { return '<label><input type="checkbox" name="att" value="' + esc(m.email) + '"' + ((d.att || []).indexOf(m.email) >= 0 ? ' checked' : '') + '>' + esc(nameOf(m.email)) + '</label>'; }).join('') + '</div></div>' +
      '<label class="t-lbl">' + L('Guests – not in the team (one per line)', 'Gjester – ikke i teamet (én per linje)') + '<textarea name="guests" rows="2">' + esc(d.guests) + '</textarea></label>' +
      '<label class="t-lbl">' + L('Agenda (one point per line)', 'Agenda (ett punkt per linje)') + '<textarea name="agenda">' + esc(d.agenda) + '</textarea></label>' +
      '<label class="t-lbl">' + L('Decisions (one per line)', 'Vedtak (ett per linje)') + '<textarea name="decisions">' + esc(d.decisions) + '</textarea></label>' +
      '<label class="t-lbl">' + L('Notes', 'Notater') + '<textarea name="notes">' + esc(d.notes) + '</textarea></label>' +
      '<p class="t-err" id="err"></p><button class="t-btn wide" type="submit">' + L('Save', 'Lagre') + '</button>' +
      (S.edit.isNew ? '' : '<button class="t-btn danger wide" type="button" data-act="delMeeting">' + L('Delete meeting', 'Slett møtet') + '</button>') + '</form>' +
      '<p class="t-small">' + L('Actions are added on the meeting page after saving.', 'Oppgaver legges til på møtesiden når du har lagret.') + '</p>';
    return out;
  }
  async function onMeeting(f) {
    var d = { title: f.title.value.trim(), date: f.date.value, from: f.from.value, to: f.to.value, att: [].filter.call(f.querySelectorAll('input[name=att]'), function (x) { return x.checked; }).map(function (x) { return x.value; }), guests: f.guests.value, agenda: f.agenda.value, decisions: f.decisions.value, notes: f.notes.value };
    if (!d.title || !d.date) return setErr(L('A title and a date are needed.', 'Tittel og dato trengs.'));
    busy(f, true);
    var id = S.edit.id, ok = await putRec('meeting', id, d, L('Meeting: ', 'Møte: ') + d.title);
    if (!ok) { busy(f, false); return; }
    endEdit(true); location.hash = '#m=' + id; draw(); toast(L('Saved', 'Lagret'));
  }

  function viewActions() {
    var f = S.afilter || 'mine', all = actions();
    var xs = all.filter(function (a) { return f === 'done' ? a.d.done : !a.d.done && (f === 'all' || a.d.owner === S.me.email); }).sort(f === 'done' ? function (a, b) { return (b.d.doneAt || 0) - (a.d.doneAt || 0); } : byDue);
    var out = head(L('Actions', 'Oppgaver'), L(all.filter(function (a) { return !a.d.done; }).length + ' open in the team', all.filter(function (a) { return !a.d.done; }).length + ' åpne i teamet'));
    out += '<div class="t-pick t-noprint" role="group">' + [['mine', L('Mine', 'Mine')], ['all', L('Everyone', 'Alle')], ['done', L('Done', 'Ferdige')]].map(function (o) { return '<label><input type="radio" name="af" data-filter="' + o[0] + '"' + (f === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div><p></p>';
    if (rank() >= 1) out += '<button class="t-btn ghost wide" type="button" data-act="newAction">' + ic('plus') + L('New action', 'Ny oppgave') + '</button><p></p>';
    out += xs.length ? actionList(xs, true) : '<p class="t-empty">' + L('Nothing here.', 'Ingenting her.') + '</p>';
    return out;
  }
  /* an action can point at a document line (JP 23:46): it closes by itself when that document is approved */
  function docLines() { if (docLines.g === S.docGen && docLines.c) return docLines.c; var t = docRO(), out = []; docLines.g = S.docGen; docLines.c = out; (t.dctl || []).forEach(function (p) { (p.lines || []).forEach(function (l) { out.push({ v: p.id + '|' + l.id, p: p, l: l }); }); }); return out; }
  function docOf(v) { if (!v) return null; return docLines().filter(function (x) { return x.v === v; })[0] || null; }
  var DONE_ST = { ok: 1, cmt: 1, na: 1 };
  function docLabel(x) { return x.p.name + ' · ' + x.l.code + ' ' + (x.l.name || x.l.type || x.l.sys || ''); }
  function docSelect(cur) {
    var L0 = docLines().filter(function (x) { return x.v === cur || !DONE_ST[x.l.st]; }); if (!L0.length && !cur) return '';
    return '<label class="t-lbl">' + L('Document (closes when approved)', 'Dokument (lukkes når godkjent)') + '<select name="doc"><option value="">—</option>' + L0.slice(0, 500).map(function (x) { return '<option value="' + esc(x.v) + '"' + (x.v === cur ? ' selected' : '') + '>' + esc(docLabel(x)) + '</option>'; }).join('') + '</select></label>';
  }
  async function autoDone() {
    if (rank() < 1) return;
    var acts = actions().filter(function (a) { return a.d.doc && !a.d.done; }); if (!acts.length) return;
    for (var i = 0; i < acts.length; i++) { var x = docOf(acts[i].d.doc); if (x && DONE_ST[x.l.st]) await putRec('action', acts[i].id, Object.assign({}, acts[i].d, { done: true, doneAt: Date.now(), auto: 1 }), L('Action done – document approved: ', 'Oppgave ferdig – dokument godkjent: ') + acts[i].d.text); }
  }
  function actionSheet(id, meeting) {
    var a = id ? S.recs[id].d : { text: '', owner: S.me.email, due: '', done: false, meeting: meeting || '' };
    var ms = meetings();
    openSheet('<h2>' + (id ? L('Action', 'Oppgave') : L('New action', 'Ny oppgave')) + '</h2><form class="t-form" data-form="action" data-id="' + (id || '') + '">' +
      '<label class="t-lbl">' + L('What needs doing', 'Hva skal gjøres') + '<input name="text" required maxlength="300" value="' + esc(a.text) + '"></label>' +
      '<label class="t-lbl">' + L('Who', 'Hvem') + '<select name="owner"><option value="">—</option>' + S.members.map(function (m) { return '<option value="' + esc(m.email) + '"' + (a.owner === m.email ? ' selected' : '') + '>' + esc(nameOf(m.email)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="t-lbl">' + L('Due', 'Frist') + '<input name="due" type="date" value="' + esc(a.due) + '"></label>' +
      docSelect(a.doc) +
      '<label class="t-lbl">' + L('From the meeting', 'Fra møtet') + '<select name="meeting"><option value="">—</option>' + ms.map(function (m) { return '<option value="' + m.id + '"' + (a.meeting === m.id ? ' selected' : '') + '>' + esc(m.d.title + ' · ' + fmtDate(m.d.date)) + '</option>'; }).join('') + '</select></label>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></div>' +
      (id ? '<button class="t-btn danger wide" type="button" data-act="delAction" data-id="' + id + '">' + L('Delete', 'Slett') + '</button>' : '') + '</form>');
  }
  async function onAction(f) {
    var id = f.dataset.id || rid(), cur = S.recs[id] && S.recs[id].d;
    var d = Object.assign({}, cur || { done: false }, { text: f.text.value.trim(), owner: f.owner.value, due: f.due.value, meeting: f.meeting.value, doc: f.doc ? f.doc.value : (cur && cur.doc) || '' });
    if (!d.text) return;
    busy(f, true);
    if (await putRec('action', id, d, L('Action: ', 'Oppgave: ') + d.text)) { closeSheet(); draw(); } else busy(f, false);
  }
  async function tick(id, on) {
    var a = S.recs[id]; if (!a || !a.d) return;
    var d = Object.assign({}, a.d, { done: on, doneAt: on ? Date.now() : 0 });
    if (await putRec('action', id, d, (on ? L('Done: ', 'Ferdig: ') : L('Opened again: ', 'Åpnet igjen: ')) + d.text)) draw(); else draw();
  }

  /* ---------- the team: members, invites, requests, the change log ---------- */
  function viewTeam() {
    var adm = rank() >= 3;
    var out = head(L('Team', 'Team'), (S.me.team.name !== 'Team' ? S.me.team.name + ' · ' : '') + nMembers(S.members.length)) + '<div class="t-cols t-tcols"><div class="t-col">';   /* on a computer: people on the left, access, clock and log on the right (JP 2026-11-17 20:11) */
    if (adm) out += '<button class="t-btn wide t-inv" type="button" data-act="invite">' + ic('plus') + L('Invite someone', 'Inviter noen') + '</button><p class="t-small">' + L('One link per person. It works once and runs out.', 'Én lenke per person. Den virker én gang og går ut.') + '</p>';
    if (adm && S.requests.length) {
      out += '<p class="t-h">' + L('Wants to join', 'Vil bli med') + '</p>';
      out += S.requests.map(function (q) {
        return '<div class="t-card acc"><h2>' + esc(q.name) + '</h2><p class="t-small">' + esc(q.email) + ' · ' + esc(fmtTime(q.at)) + '</p>' +
          '<p class="t-small">' + L('Check code – ask them to read theirs to you:', 'Kontrollkode – be dem lese opp sin:') + ' <span class="t-code" data-code="' + esc(q.email) + '">…</span></p>' +
          '<label class="t-lbl">' + L('Role', 'Rolle') + '<select data-qrole="' + esc(q.email) + '">' + ROLES.map(function (r) { return '<option value="' + r + '"' + ((q.role || 'edit') === r ? ' selected' : '') + '>' + roleName(r) + '</option>'; }).join('') + '</select></label>' +
          '<div class="t-btns"><button class="t-btn ghost" type="button" data-act="decline" data-email="' + esc(q.email) + '">' + L('Decline', 'Avslå') + '</button><button class="t-btn" type="button" data-act="approve" data-email="' + esc(q.email) + '">' + L('Approve', 'Godkjenn') + '</button></div></div>';
      }).join('');
      setTimeout(fillCodes, 0);
    }
    out += '<p class="t-h">' + L('Members', 'Medlemmer') + '</p><ul class="t-list">' + S.members.slice().sort(function (a, b) { return ROLES.indexOf(b.role) - ROLES.indexOf(a.role) || a.name.localeCompare(b.name); }).map(function (m) {
      var inner = '<span class="grow"><span>' + esc(m.email === S.me.email ? m.name + ' (' + L('you', 'deg') + ')' : m.name) + '</span><small>' + esc(adm ? m.email + ' · ' : '') + esc(L('Used: ', 'Brukt: ') + ago(m.seen)) + '</small></span><span class="t-chip' + (m.role === 'admin' ? ' acc' : '') + '">' + roleName(m.role) + '</span>';
      return '<li>' + (adm && m.email !== S.me.email ? '<button class="t-row" type="button" data-act="member" data-email="' + esc(m.email) + '">' + inner + '</button>' : inner) + '</li>';
    }).join('') + '</ul>';
    if (adm) out += '<p class="t-small">' + L('Tap a person to change their role or remove them. Removing gives the team a new key at once.', 'Trykk på en person for å endre rolle eller fjerne dem. Når noen fjernes, får teamet en ny nøkkel med en gang.') + '</p>';
    if (adm && S.invites.length) out += '<p class="t-h">' + L('Open invites', 'Åpne invitasjoner') + '</p><ul class="t-list">' + S.invites.map(function (v) { return '<li><span class="grow"><span>' + esc(v.label || roleName(v.role)) + '</span><small>' + esc(L('Runs out ', 'Går ut ') + fmtTime(v.exp)) + '</small></span><button class="t-btn ghost sm" type="button" data-act="cancelInvite" data-id="' + v.id + '">' + L('Cancel', 'Avbryt') + '</button></li>'; }).join('') + '</ul>';
    out += '</div><div class="t-col">';
    if (adm) out += accessCard();
    out += clockTeamCard();
    out += '<p class="t-h"><span>' + L('Change log', 'Endringslogg') + '</span><button class="t-btn ghost sm" type="button" data-act="log">' + (S.logOpen ? L('Hide', 'Skjul') : L('Show', 'Vis')) + '</button></p>' +
      (S.logOpen ? logHtml(5) + (S.log.length > 5 || (S.log.length && rank() >= 3) ? '<button class="t-btn ghost sm t-logall" type="button" data-act="logall">' + L('Show all ({n})', 'Vis alle ({n})').replace('{n}', S.log.length) + '</button>' : '') : '') + '</div></div>';   /* the newest five here, the whole log in a popup (JP 2026-11-17 21:20) */
    return out;
  }
  async function fillCodes() { for (var i = 0; i < S.requests.length; i++) { var q = S.requests[i], el = document.querySelector('[data-code="' + CSS.escape(q.email) + '"]'); if (el) el.textContent = await checkCode(q.pub); } }
  function logHtml(n) {
    if (!S.log.length) return '<p class="t-empty">' + L('Nothing yet.', 'Ingenting ennå.') + '</p>';
    var A = { access: L('changed who may do what', 'endret hvem som kan gjøre hva'), 'log-reset': L('emptied the log', 'tømte loggen'), 'upload-removed': L('removed uploaded files', 'fjernet opplastede filer'), upload: L('sent a file on an upload link', 'sendte en fil med en opplastingslenke'), uplink: L('made an upload link', 'lagde en opplastingslenke'), 'uplink-off': L('switched off an upload link', 'slo av en opplastingslenke'), setup: L('set up the team', 'satte opp teamet'), invite: L('made an invite', 'lagde en invitasjon'), request: L('asked to join', 'ba om å bli med'), approve: L('approved', 'godkjente'), decline: L('declined', 'avslo'), role: L('changed the role of', 'endret rollen til'), remove: L('removed', 'fjernet'), new: L('added', 'la til'), edit: L('changed', 'endret'), del: L('deleted', 'slettet'), restore: L('brought back', 'hentet tilbake'), rename: L('renamed the team to', 'ga teamet navnet') };
    return '<ul class="t-list t-log">' + (n ? S.log.slice(0, n) : S.log).map(function (l) {
      var what = l.sum || (l.k ? ({ meeting: L('a meeting', 'et møte'), action: L('an action', 'en oppgave') })[l.k] || '' : '');
      if (l.a === 'rename') return '<li><span class="grow"><span>' + esc(nameOf(l.by) + ' ' + A.rename + ' «' + (l.name || '') + '»') + '</span><small>' + esc(fmtTime(l.t)) + '</small></span></li>';
      var who = l.who ? ' ' + (l.who === S.me.email ? nameOf(l.who) : l.name || nameOf(l.who)) + (l.role ? ' (' + roleName(l.role) + ')' : '') : (l.a === 'role' || l.a === 'invite') && l.role ? ' (' + roleName(l.role) + ')' : '';
      return '<li><span class="grow"><span>' + esc(nameOf(l.by) + ' ' + (A[l.a] || l.a) + who + (what ? ' – ' + what : '')) + '</span><small>' + esc(fmtTime(l.t)) + '</small></span></li>';
    }).join('') + '</ul>' + (n ? '' : '<p class="t-small">' + L('Nobody can change a line in the log. An admin can empty it – that is written down too.', 'Ingen kan endre en linje i loggen. En admin kan tømme den – det blir også skrevet ned.') + '</p>' +
      (rank() >= 3 ? '<button class="t-btn sm ghost t-danger" type="button" data-act="logreset">' + L('Empty the log', 'Tøm loggen') + '</button>' : ''));
  }
  async function loadLog() {
    var j = await api('log?n=100');
    for (var i = 0; i < j.log.length; i++) { var l = j.log[i]; if (l.s) { var x = await unseal(l.s, 'log', l.s.e); l.sum = x ? x.t : ''; } }
    S.log = j.log;
  }
  function inviteSheet() {
    openSheet('<h2>' + L('Invite someone', 'Inviter noen') + '</h2><form class="t-form" data-form="invite">' +
      '<label class="t-lbl">' + L('Who is it for (only you see this)', 'Hvem er den til (bare du ser dette)') + '<input name="label" maxlength="60" placeholder="' + esc(L('e.g. Kari', 'f.eks. Kari')) + '"></label>' +
      '<label class="t-lbl">' + L('Role', 'Rolle') + '<select name="role">' + ['read', 'edit', 'approve'].map(function (r) { return '<option value="' + r + '"' + (r === 'edit' ? ' selected' : '') + '>' + roleName(r) + '</option>'; }).join('') + '</select></label>' +
      '<label class="t-lbl">' + L('The link runs out after', 'Lenken går ut etter') + '<select name="ttl"><option value="15m">' + L('15 minutes', '15 minutter') + '</option><option value="1d">' + L('1 day', '1 dag') + '</option><option value="7d">' + L('7 days', '7 dager') + '</option></select></label>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Make the link', 'Lag lenken') + '</button></div></form>');
  }
  async function onInvite(f) {
    busy(f, true);
    try {
      var j = await api('invites', { method: 'POST', body: { role: f.role.value, ttl: f.ttl.value, label: f.label.value.trim() } });
      var link = location.origin + '/?join=' + j.code + (S.tid !== 'team' ? '&t=' + S.tid : '');
      openSheet('<h2>' + L('Send this link', 'Send denne lenken') + '</h2><p class="t-small">' + L('For one person. It works once and runs out ', 'For én person. Den virker én gang og går ut ') + esc(fmtTime(j.exp)) + '. ' + L('They sign in with their email, and you approve them here.', 'De logger inn med e-posten sin, og du godkjenner dem her.') + '</p>' +
        '<input readonly id="invLink" value="' + esc(link) + '" aria-label="' + esc(L('Invite link', 'Invitasjonslenke')) + '">' +
        '<div class="t-btns">' + (navigator.share ? '<button class="t-btn" type="button" data-act="shareInvite">' + L('Share', 'Del') + '</button>' : '') + '<button class="t-btn ghost" type="button" data-act="copyInvite">' + L('Copy', 'Kopier') + '</button></div><button class="t-btn ghost wide" type="button" data-act="close">' + L('Done', 'Ferdig') + '</button>');
      loadMembers().then(function () { if (!S.sheet) draw(); });
    } catch (e) { busy(f, false); setErr(failMsg(e)); }
  }
  async function approve(email, btn) {
    var q = S.requests.filter(function (x) { return x.email === email; })[0]; if (!q) return;
    var sel = document.querySelector('[data-qrole="' + CSS.escape(email) + '"]'), role = sel ? sel.value : 'edit';
    btn.disabled = true;
    try {
      var keys = {}; for (var e in S.keys) keys[e] = await wrapFor(q.pub, S.keys[e], e);
      await api('approve', { method: 'POST', body: { email: email, role: role, keys: keys } });
      toast(L(q.name + ' is in the team', q.name + ' er med i teamet')); await loadMembers(); draw();
    } catch (e) { btn.disabled = false; toast(failMsg(e)); }
  }
  function memberSheet(email) {
    var m = S.members.filter(function (x) { return x.email === email; })[0]; if (!m) return;
    openSheet('<h2>' + esc(m.name) + '</h2><p class="t-small">' + esc(m.email) + '</p><form class="t-form" data-form="role" data-email="' + esc(email) + '">' +
      '<label class="t-lbl">' + L('Role', 'Rolle') + '<select name="role">' + ROLES.map(function (r) { return '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + roleName(r) + '</option>'; }).join('') + '</select></label>' +
      '<p class="t-small">' + L('Can read: sees everything. Can edit: also writes meetings and actions. Can approve: also approves documents. Admin: also invites and removes people.', 'Kan lese: ser alt. Kan redigere: skriver også møter og oppgaver. Kan godkjenne: godkjenner også dokumenter. Admin: inviterer og fjerner også folk.') + '</p>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></div>' +
      '<button class="t-btn danger wide" type="button" data-act="remove" data-email="' + esc(email) + '">' + L('Remove from the team', 'Fjern fra teamet') + '</button></form>');
  }
  async function onRole(f) {
    busy(f, true);
    try { await api('role', { method: 'POST', body: { email: f.dataset.email, role: f.role.value } }); closeSheet(); await loadMembers(); draw(); toast(L('Saved', 'Lagret')); }
    catch (e) { busy(f, false); setErr(e.status === 409 ? L('The team needs at least one admin, and the owner stays admin.', 'Teamet trenger minst én admin, og eieren forblir admin.') : failMsg(e)); }
  }
  async function removeMember(email, btn) {
    var m = S.members.filter(function (x) { return x.email === email; })[0]; if (!m) return;
    if (!(await sure(L('Remove ' + m.name + '? They lose access at once, and the team gets a new key.', 'Fjerne ' + m.name + '? De mister tilgangen med en gang, og teamet får en ny nøkkel.')))) return;
    btn.disabled = true;
    try {
      var next = S.me.team.epoch + 1, nk = await C.generateKey(AES, true, ['encrypt', 'decrypt']), keys = {};
      for (var i = 0; i < S.members.length; i++) if (S.members[i].email !== email) keys[S.members[i].email] = await wrapFor(S.members[i].pub, nk, next);
      await api('remove', { method: 'POST', body: { email: email, rotate: { epoch: next, keys: keys } } });
      await kset('tk:' + next, nk); S.keys[next] = nk; S.me = await api('me'); await loadKeys();
      closeSheet(); await loadMembers(); draw(); toast(L(m.name + ' was removed', m.name + ' ble fjernet'));
    } catch (e) { btn.disabled = false; setErr(e.status === 409 ? L('The owner cannot be removed, and the team needs an admin.', 'Eieren kan ikke fjernes, og teamet trenger en admin.') : failMsg(e)); }
  }

  /* Settings: three tabs – You, The team (admins), Account – one thing per row, so it is calm (JP 2026-11-23 "clean the settings") */
  function settingsSheet() {
    var adm = rank() >= 3, tabs = [['you', L('You', 'Deg')]].concat(adm ? [['team', L('The team', 'Teamet')]] : []).concat([['acct', L('Account', 'Konto')]]);
    var tab = tabs.some(function (x) { return x[0] === S.setTab; }) ? S.setTab : 'you', nOn = ((function () { try { return localStorage.getItem('team.notify') === '1'; } catch (e) { return false; } })());
    var body = tab === 'you' ?
      '<div class="t-set2">' +
      '<label class="t-lbl">' + L('Appearance', 'Utseende') + '<select data-themepick>' + [['light', L('Light', 'Lys')], ['dark', L('Dark', 'Mørk')], ['auto', L('Like the device', 'Som enheten')]].map(function (o) { var cur = 'light'; try { cur = localStorage.getItem('team.theme') || 'light'; } catch (e) {} return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="t-lbl">' + L('Language', 'Språk') + '<select data-lang><option value="en"' + (nb ? '' : ' selected') + '>English</option><option value="nb"' + (nb ? ' selected' : '') + '>Norsk</option></select></label>' + '</div>' +
      '<label class="t-switch"><span><b>' + L('Push when Team is closed', 'Push når Team er lukket') + '</b><small>' + L('Only that someone changed something in this team – never what was written. On this device.', 'Bare at noen endret noe i dette teamet – aldri hva som ble skrevet. På denne enheten.') + '</small></span><input type="checkbox" data-push' + (pushOn() ? ' checked' : '') + '></label>' +
      '<div class="t-setrow"><span><b>' + L('Notifications while Team is open', 'Varsler mens Team er åpent') + '</b><small>' + (nOn ? L('On on this device', 'På på denne enheten') : L('Off on this device', 'Av på denne enheten')) + '</small></span><button class="t-btn ghost sm" type="button" data-act="notify">' + (nOn ? L('Turn off', 'Slå av') : L('Turn on', 'Slå på')) + '</button></div>'
      : tab === 'team' ?
        '<div class="t-setrow"><span><b>' + L('Team name', 'Navn på teamet') + '</b><small>' + esc(S.me.team.name) + '</small></span><button class="t-btn ghost sm" type="button" data-act="renameTeam">' + L('Change', 'Endre') + '</button></div>' +
        palAdmin() + dtabsAdmin() + flowAdmin() + clockAdmin() +
        '<p class="t-h">' + L('Backup', 'Sikkerhetskopi') + '</p><div class="t-setrow"><span><b>' + L('Backup of the team', 'Sikkerhetskopi av teamet') + '</b><small>' + L('A copy of everything in the team, encrypted', 'En kopi av alt i teamet, kryptert') + '</small></span><button class="t-btn ghost sm" type="button" data-act="backup">' + L('Open', 'Åpne') + '</button></div>'
      : '<p class="t-small">' + L('Signed in as ', 'Logget inn som ') + esc(S.me.email) + ' · ' + roleName(S.me.member.role) + '</p>' +
        '<div class="t-btns t-setbtns"><button class="t-btn ghost sm" type="button" data-act="changePass">' + L('Change my passcode', 'Bytt koden min') + '</button><a class="t-btn ghost sm" href="/cdn-cgi/access/logout">' + L('Sign out', 'Logg ut') + '</a><button class="t-btn ghost sm" type="button" data-act="forget">' + L('Forget Team on this device', 'Glem Team på denne enheten') + '</button></div>' +
        (S.me.isOwner ? '<button class="t-btn ghost sm t-danger t-setdel" type="button" data-act="deleteTeam">' + L('Delete the team …', 'Slett teamet …') + '</button>' : '') +
      '<p class="t-small t-setfoot">' + L('What you write here is encrypted on your device before it is saved. The server only sees names, emails, roles and times.', 'Det du skriver her, krypteres på enheten din før det lagres. Serveren ser bare navn, e-post, roller og tidspunkter.') + '</p>';
    openSheet('<h2>' + L('Settings', 'Innstillinger') + '</h2>' +
      '<div class="t-settabs" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" class="t-settab' + (x[0] === tab ? ' on' : '') + '" aria-selected="' + (x[0] === tab) + '" data-act="settab" data-settab="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="t-setbody">' + body + '</div>' +
      '<button class="t-btn wide" type="button" data-act="close">' + L('Done', 'Ferdig') + '</button>', 'set');
  }
  /* the team's name (admins) and deleting a team (only the owner, the name typed again – it can't be undone) */
  function renameSheet() {
    openSheet('<h2>' + L('Rename the team', 'Gi teamet nytt navn') + '</h2><form class="t-form" data-form="rename"><label class="t-lbl">' + L('Team name', 'Navn på teamet') + '<input name="name" required maxlength="60" value="' + esc(S.me.team.name) + '"></label>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></div></form>');
  }
  async function onRename(f) {
    busy(f, true);
    try { await api('rename', { method: 'POST', body: { name: f.name.value.trim() } }); S.me = await api('me'); try { S.teams = (await api('teams')).teams || S.teams; } catch (x) {} closeSheet(); draw(); toast(L('Saved', 'Lagret')); }
    catch (e) { busy(f, false); setErr(failMsg(e)); }
  }
  function deleteSheet() {
    openSheet('<h2>' + L('Delete the team', 'Slett teamet') + '</h2><p>' + L('Everything in ', 'Alt i ') + '<b>' + esc(S.me.team.name) + '</b>' + L(' is deleted for everyone: meetings, actions, documents, members and the change log. This cannot be undone.', ' slettes for alle: møter, oppgaver, dokumenter, medlemmer og endringsloggen. Dette kan ikke angres.') + '</p>' +
      '<form class="t-form" data-form="delTeam"><label class="t-lbl">' + L('Type the team name to confirm', 'Skriv navnet på teamet for å bekrefte') + '<input name="name" required autocomplete="off"></label>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn t-danger" type="submit">' + L('Delete for good', 'Slett for godt') + '</button></div></form>');
  }
  async function onDelTeam(f) {
    if (f.name.value.trim() !== S.me.team.name) return setErr(L('The name does not match.', 'Navnet stemmer ikke.'));
    if (!(await sure(L('Delete ' + S.me.team.name + ' for everyone? This cannot be undone.', 'Slette ' + S.me.team.name + ' for alle? Dette kan ikke angres.')))) return;
    busy(f, true);
    try { await api('teams/delete', { method: 'POST', body: { id: S.tid, confirm: f.name.value.trim() } }); await kclear().catch(function () {}); try { localStorage.removeItem('team.cur'); } catch (x) {} location.href = '/'; }
    catch (e) { busy(f, false); setErr(failMsg(e)); }
  }
  /* a backup of the whole team (JP 23:46): everything you can read, locked with a passcode you choose (PBKDF2 + AES-GCM),
     kept by you. Restoring brings back what is missing or deleted – it never overwrites what is there now. */
  function backupSheet() {
    openSheet('<h2>' + L('Backup of the team', 'Sikkerhetskopi av teamet') + '</h2><p class="t-small">' + L('A file with all meetings, actions and documents, locked with a passcode you choose. Keep the file and the passcode safe – nobody can open it without the passcode.', 'En fil med alle møter, oppgaver og dokumenter, låst med en kode du velger. Ta godt vare på filen og koden – ingen kan åpne den uten koden.') + '</p>' +
      '<form class="t-form" data-form="backup">' + passFields() + '<p class="t-err"></p><button class="t-btn wide" type="submit">' + L('Download the backup', 'Last ned sikkerhetskopien') + '</button></form>' +
      '<h2 style="margin-top:18px">' + L('Restore', 'Gjenopprett') + '</h2><form class="t-form" data-form="restore"><label class="t-lbl">' + L('Backup file', 'Sikkerhetskopi') + '<input name="file" type="file" accept=".teambackup,.json" required></label><label class="t-lbl">' + L('Its passcode', 'Koden til den') + '<input name="pass" type="password" autocomplete="off" required></label>' +
      '<p class="t-small">' + L('Brings back what is missing or deleted. Nothing that is there now is overwritten.', 'Henter tilbake det som mangler eller er slettet. Ingenting som finnes nå blir overskrevet.') + '</p><p class="t-err"></p><button class="t-btn ghost wide" type="submit">' + L('Restore', 'Gjenopprett') + '</button></form>' +
      '<button class="t-btn ghost wide" type="button" data-act="close">' + L('Close', 'Lukk') + '</button>');
  }
  async function onBackup(f) {
    var err = checkPass(f); if (err) return setErr(err);
    busy(f, true);
    try {
      var recs = []; for (var id in S.recs) { var r = S.recs[id]; if (r && !r.del && r.d) recs.push({ id: r.id, k: r.k, d: r.d, t: r.t, by: r.by }); }
      var salt = rnd(16), iv = rnd(12), key = await passKey(f.pass.value, salt);
      var ct = await C.encrypt({ name: 'AES-GCM', iv: iv }, key, TE.encode(JSON.stringify({ v: 1, team: S.me.team.name, at: Date.now(), recs: recs })));
      var out = JSON.stringify({ kind: 'team-backup', v: 1, team: S.me.team.name, at: Date.now(), n: recs.length, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
      var nm = (S.me.team.name + ' ' + today()).replace(/[\\/:*?"<>|]+/g, '-') + '.teambackup', a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/json' })); a.download = nm; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      busy(f, false); toast(L('Backup downloaded: ' + recs.length + ' items', 'Sikkerhetskopi lastet ned: ' + recs.length + ' elementer'));
    } catch (e) { busy(f, false); setErr(failMsg(e)); }
  }
  async function onRestore(f) {
    var file = f.file.files && f.file.files[0]; if (!file) return;
    busy(f, true);
    try {
      var j = JSON.parse(await file.text()); if (j.kind !== 'team-backup') throw new Error('kind');
      var data; try { var key = await passKey(f.pass.value, ub64(j.salt)); data = JSON.parse(TD.decode(await C.decrypt({ name: 'AES-GCM', iv: ub64(j.iv) }, key, ub64(j.ct)))); } catch (x) { busy(f, false); return setErr(L('Wrong passcode, or not a Team backup.', 'Feil kode, eller ikke en sikkerhetskopi fra Team.')); }
      var back = 0;
      for (var i = 0; i < data.recs.length; i++) { var r = data.recs[i], cur = S.recs[r.id]; if (cur && !cur.del) continue; if (await putRec(r.k, r.id, r.d)) back++; }
      busy(f, false); closeSheet(); await pull(false).catch(function () {}); draw(); S.docGen++; window.dispatchEvent(new Event('tools:change'));
      toast(back ? L(back + ' items brought back', back + ' elementer hentet tilbake') : L('Nothing was missing', 'Ingenting manglet'));
    } catch (e) { busy(f, false); setErr(L('That file could not be read.', 'Den filen kunne ikke leses.')); }
  }
  function passSheet() {
    openSheet('<h2>' + L('Change my passcode', 'Bytt koden min') + '</h2><form class="t-form" data-form="pass"><label class="t-lbl">' + L('Current passcode', 'Nåværende kode') + '<input name="old" type="password" autocomplete="current-password" required></label>' + passFields() +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></div></form>');
  }
  async function onPass(f) {
    var err = checkPass(f); if (err) return setErr(err);
    busy(f, true);
    try { var k = await openPriv(S.me.member.priv, f.old.value, true); var blob = await sealPriv(k, f.pass.value); await api('priv', { method: 'POST', body: { priv: blob } }); S.me.member.priv = blob; closeSheet(); toast(L('Passcode changed', 'Koden er byttet')); }
    catch (e) { busy(f, false); setErr(e && e.status ? failMsg(e) : L('Wrong passcode.', 'Feil kode.')); }
  }

  /* ---------- Documents: the same Document control and Document requirements as /cmd (copied to /dc/ by _team/build.py),
     running on Team's encrypted storage. A project is one record (dcp) plus one record per line (dcl), so two people can work
     on the same project at once; each line is saved on its own (the newest change of a line wins). ---------- */
  var DK = { dcp: 1, dcl: 1, dct: 1, dcr: 1 };
  S.dtab = 'doc'; S.docBase = {}; S.docGen = 0;
  function viewDocs() {
    if (/^#d[rc]=/.test(location.hash)) S.dtab = 'doc'; else if (/^#files/.test(location.hash)) S.dtab = 'files';
    var DT = dtabsOn(); if (DT.length && !DT.some(function (t) { return t[0] === S.dtab; })) S.dtab = DT[0][0];
    var out = '<div class="t-dhead">' + head(L('Documentation', 'Dokumentasjon'), L('Documentation for each project – requirements, document plan, delivery, comparison and final check. The same tools as in /cmd.', 'Dokumentasjon per prosjekt – krav, dokumentplan, levering, sammenligning og sluttkontroll. De samme verktøyene som i /cmd.'));
    out += '<div class="t-pick t-noprint" role="group">' + DT.map(function (t) { return [t[0], L(t[1], t[2])]; }).map(function (o) { return '<label><input type="radio" name="dtab" data-dtab="' + o[0] + '"' + (S.dtab === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div><p></p>';
    /* Import from /cmd: always one small fold (JP 13:48 – the page was heavy; 2026-11-17 20:11 – less scrolling) */
    var dHas = DFe.list('dctl').length + DFe.list('dckrav').length > 0;
    if (rank() >= 1) out += (dHas || true) ? '<details class="t-imp t-noprint"><summary>' + L('Import from /cmd', 'Importer fra /cmd') + '</summary>' + '<label class="t-btn ghost wide t-noprint" id="dcImport">' + L('Import from /cmd', 'Importer fra /cmd') + '<input type="file" accept=".json,application/json" data-dcimport hidden></label><p class="t-small t-noprint">' + L('In /cmd: Work → Document requirements → Move to Team takes all your lists, checklists and project types in one file; a single project: open it → Send to Team. Files for the whole team go under Files.', 'I /cmd: Jobb → Dokumentkrav → Flytt til Team tar med alle listene, sjekklistene og prosjekttypene i én fil; ett prosjekt: åpne det → Send til Team. Filer for hele teamet legges under Filer.') + '</p>' + '</details>' : '<label class="t-btn ghost wide t-noprint" id="dcImport">' + L('Import from /cmd', 'Importer fra /cmd') + '<input type="file" accept=".json,application/json" data-dcimport hidden></label><p class="t-small t-noprint">' + L('In /cmd: Work → Document requirements → Move to Team takes all your lists, checklists and project types in one file; a single project: open it → Send to Team. Files for the whole team go under Files.', 'I /cmd: Jobb → Dokumentkrav → Flytt til Team tar med alle listene, sjekklistene og prosjekttypene i én fil; ett prosjekt: åpne det → Send til Team. Filer for hele teamet legges under Filer.') + '</p>';
    out += '</div>';
    out += '<div class="dc-host"><section class="card kit-card kit-wide dc-card" id="wkDocCtl"' + (S.dtab === 'doc' ? '' : ' hidden') + '><p class="t-empty">' + L('Loading …', 'Laster …') + '</p></section>' +
      '<section class="card kit-card kit-wide dc-card dc-gone" id="wkDocReq"' + (S.dtab === 'doc' ? '' : ' hidden') + '></section></div>' +
      '<section id="tFiles"' + (S.dtab === 'files' ? '' : ' hidden') + '>' + filesHtml() + '</section>' +
      '<section id="tInsp"' + (S.dtab === 'insp' ? '' : ' hidden') + '>' + (inspections().length ? '<ul class="t-list">' + inspections().map(function (r) { return '<li><a class="t-row" href="#in=' + r.id + '"><span class="grow"><span>' + esc(r.d.name) + '</span><small>' + esc([r.d.no, r.d.date ? fmtDate(r.d.date) : '', r.d.address, (r.d.notes || []).length ? L((r.d.notes.length) + ' notes', (r.d.notes.length) + ' notater') : ''].filter(Boolean).join(' · ')) + '</small></span></a></li>'; }).join('') + '</ul>' : '<p class="t-empty">' + L('No inspections yet. In /cmd: Work → Building inspection → a report → Send to Team, then Import from /cmd here.', 'Ingen befaringer ennå. I /cmd: Jobb → Bygningsbefaring → en rapport → Send til Team, så Importer fra /cmd her.') + '</p>') + '</section>';
    return out;
  }
  function loadJs(src) { return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
  function loadCss(href) { if (document.querySelector('link[href="' + href + '"]')) return; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  var docsP = null;
  function docsReady() {
    if (!docsP) {
      loadCss('/dc/bi/bi.css'); loadCss('/dc/dc.css');
      window.PAGED_PDF_VENDOR = '/dc/vendor/';
      window.I18N = { lang: nb ? 'nb' : 'en', k: function (key, en, o) { var t = (nb && window.DC_NB && window.DC_NB[key]) || en; if (o) t = t.replace(/\{(\w+)\}/g, function (m, x) { return o[x] != null ? o[x] : m; }); return t; }, apply: function () {} };
      window.Quick = { toast: function (h) { toast(String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); } };
      window.PageTabs = { show: function () { S.dtab = 'doc'; showDtab(); } };
      window.DocHost = { Fe: DFe, LP: { nsName: nsName, ownMap: teamNs },
        /* NS code names for the whole team (JP 2026-11-17 09:37): one encrypted settings record (cfgnsnames), written by admins */
        nsShared: true, nsCan: function () { return rank() >= 3; }, nsSave: function (m) { var d = m ? { m: Object.assign({}, teamNs(), m) } : { m: {} }; for (var nk in d.m) if (d.m[nk] == null || d.m[nk] === '') delete d.m[nk];   /* null or empty removes a code */ return putRec('cfg', 'cfgnsnames', d, L('NS code names', 'NS-kodenavn')).then(function (ok) { draw(); return ok; }); }, profile: function () { return { name: S.me.member.name, employer: S.me.team.name }; }, team: true, store: DStore, rank: function () { return rank(); }, can: function (a, raw) { return canDo(a, raw); }, flowOn: function () { return flowCfgOn(); },
        uplinks: function (pid) { return links().filter(function (r) { return r.d && r.d.pid === pid && !r.d.off && r.d.exp > Date.now(); }).map(function (r) { return { id: r.id, exp: new Date(r.d.exp).toISOString().slice(0, 10) }; }); },
        uplinkOff: function (id) { upOff(id); },
        /* a project's delivered files, shared with the team (JP 2026-11-24): sent up encrypted, fetched on another device, removed with the file */
        fup: function (blob) { if (rank() < 1 || !blob || blob.size > FMAX) return Promise.resolve(null); return sendChunks(blob).catch(function () { return null; }); },
        fget: function (tf, name, type) { return getFile({ fid: tf.fid, n: tf.n, e: tf.e, name: name, type: type }); },
        fdel: function (tf) { if (rank() < 1 || !tf || !tf.fid) return Promise.resolve(); return api('fdel', { method: 'POST', body: { fid: tf.fid, n: tf.n } }).catch(function () {}); },
        uplink: function (pid) { if (rank() < 1) return; S.fproj = pid; uplinkSheet(); } };   /* Filer → "Entreprenøren har dem": the upload-link sheet with this project chosen */
      docsP = loadJs('/dc/ns.js').then(function () { return loadJs('/dc/words.js'); }).then(function () { return loadJs('/dc/paged-pdf.js'); }).then(function () {
        window.FdvPdf = { html: function (h, f, n) { return window.PagedPdf.html(h, f, n); }, share: function (f) { return window.PagedPdf.share(f); } };
        return loadJs('/dc/doc-control.js');
      }).catch(function (e) { docsP = null; toast(L('Could not load Documents. Try again.', 'Klarte ikke å laste Dokumenter. Prøv igjen.')); throw e; });
    }
    docsP.then(function () { window.dispatchEvent(new Event('tools:change')); }, function () {});
  }
  function showDtab() {
    var a = document.getElementById('wkDocCtl'), b = document.getElementById('wkDocReq'), c = document.getElementById('tInsp'), d = document.getElementById('tFiles'); if (a) a.hidden = S.dtab !== 'doc'; if (b) b.hidden = S.dtab !== 'doc'; if (c) c.hidden = S.dtab !== 'insp'; if (d) { d.hidden = S.dtab !== 'files'; if (!d.hidden) loadUploads(); }
    [].forEach.call(document.querySelectorAll('[data-dtab]'), function (x) { x.checked = x.dataset.dtab === S.dtab; });
  }
  var NSM = null;
  function teamNs() { var r = S.recs.cfgnsnames; return r && !r.del && r.d && r.d.m && typeof r.d.m === 'object' ? r.d.m : {}; }
  function nsName(code) {
    var tn = teamNs()[String(code || '')]; if (tn) return tn;
    if (!NSM) { NSM = {}; (window.NS3451 || []).forEach(function (q) { NSM[q[0]] = q; }); }
    code = String(code || ''); var q = NSM[code] || NSM[code.slice(0, 2)] || NSM[code.slice(0, 1)]; return q ? (nb ? q[2] : q[1]) : '';
  }
  /* a stable record id for a project, line, type or the checklist */
  function fnv(str) { var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995; for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; } return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8); }
  function drid(kind, a, b, c) { return kind + fnv([kind, a, b, c].join('|')); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  /* what Document control sees as its "tools": built fresh from the records each time */
  function docState(base) {
    var t = { dctl: [], dckrav: [], dctypes: [] }, heads = [], lines = {};
    for (var id in S.recs) {
      var r = S.recs[id]; if (!DK[r.k] || r.del || !r.d) continue;
      if (base) base[id] = 1;
      if (r.k === 'dcp' && r.d.p) heads.push(r.d);
      else if (r.k === 'dcl' && r.d.l) (lines[r.d.key + '|' + r.d.pid] = lines[r.d.key + '|' + r.d.pid] || []).push(r.d);
      else if (r.k === 'dct' && r.d.t) t.dctypes.push(clone(r.d.t));
      else if (r.k === 'dcr' && r.d.r) { if (r.d.id) (t.dcreqs = t.dcreqs || []).push(Object.assign(clone(r.d.r), { id: r.d.id })); else t.dcreq = clone(r.d.r); }   /* other clients' checklists carry an id */
    }
    heads.forEach(function (h) {
      if (h.key !== 'dctl' && h.key !== 'dckrav') return;
      var p = clone(h.p); p.lines = (lines[h.key + '|' + p.id] || []).sort(function (a, b) { return a.o - b.o; }).map(function (x) { return clone(x.l); });
      t[h.key].push(p);
    });
    return t;
  }
  /* the plan file and Excel edits as shared records (kind dcf = a file, dce = edits), so the whole team has the same coloured plan */
  function b64Of(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  var DStore = {
    get: function (key) {
      var r = S.recs[drid('f', key)]; if (!r || r.del || !r.d) return Promise.resolve(null);
      if (r.d.b64 != null) { var b = atob(r.d.b64), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return Promise.resolve(new Blob([u], { type: r.d.type || '' })); }
      return Promise.resolve(clone(r.d.o));
    },
    put: function (key, val) {
      var id = drid('f', key);
      if (val && typeof val.arrayBuffer === 'function') return val.arrayBuffer().then(function (buf) {
        if (buf.byteLength > 600000) return false;   /* bigger plans stay on the device that imported them */
        return putRec('dcf', id, { key: key, name: val.name || '', type: val.type || '', b64: b64Of(buf) });
      });
      clearTimeout(DStore.t[key]); return new Promise(function (ok) { DStore.t[key] = setTimeout(function () { putRec('dce', id, { key: key, o: val || {} }).then(ok); }, 1500); });   /* typing in the editor: saved once it pauses */
    },
    del: function (key) { var id = drid('f', key); return S.recs[id] && !S.recs[id].del ? delRec(id) : Promise.resolve(true); },
    t: {}
  };
  var DFe = {
    tools: function () { S.docBase = {}; return docState(S.docBase); },
    list: function (k) { var t = docRO(); return Array.isArray(t[k]) ? t[k] : []; },   /* read-only callers: cached until a document record changes */
    saveTools: function (t) { saveDocs(t, S.docBase, true); }
  };
  function wanted(t) {
    var want = {};
    ['dctl', 'dckrav'].forEach(function (key) {
      (t[key] || []).forEach(function (p) {
        if (!p || !p.id) return;
        var h = clone(p), ls = h.lines || []; delete h.lines;
        var g = gOfRaw(key === 'dctl' && p.krav ? p.krav : p.id);   /* the project's group id: requirements and their control project are one (access) */
        want[drid('p', key, p.id)] = { k: 'dcp', d: { key: key, p: h }, g: g };
        ls.forEach(function (l, i) { if (l && l.id) want[drid('l', key, p.id, l.id)] = { k: 'dcl', d: { key: key, pid: p.id, l: l, o: i }, g: g }; });
      });
    });
    (t.dctypes || []).forEach(function (ty) { if (ty && ty.id) want[drid('t', ty.id)] = { k: 'dct', d: { t: ty } }; });
    if (t.dcreq) want[drid('r', 'checklist')] = { k: 'dcr', d: { r: t.dcreq } };
    (t.dcreqs || []).forEach(function (r) { if (r && r.id) want[drid('r', 'checklist', r.id)] = { k: 'dcr', d: { r: r, id: r.id } }; });
    return want;
  }
  /* save what changed: new and changed records, and deletes only of what was there when Document control read it */
  async function saveDocs(t, base, first) {
    if (rank() < 1 && !ownProjectRole()) { toast(L('Your role can only read.', 'Rollen din kan bare lese.')); window.dispatchEvent(new Event('tools:change')); return; }
    var want = wanted(t), ops = [], names = {}, blocked = 0;
    for (var id in want) {
      var cur = S.recs[id], w = want[id];
      if (cur && !cur.del && cur.d && JSON.stringify(cur.d) === JSON.stringify(w.d)) continue;
      /* approving a document is for Can approve and Admin */
      if (w.k === 'dcl' && w.d.l.st === 'ok' && ROLES.indexOf(roleIn(w.g)) < ROLES.indexOf(accMin('approve')) && !(cur && cur.d && cur.d.l && cur.d.l.st === 'ok')) { if (cur && cur.d) w.d.l.st = cur.d.l.st; else w.d.l.st = 'recv'; blocked++; if (cur && cur.d && JSON.stringify(cur.d) === JSON.stringify(w.d)) continue; }
      ops.push({ id: id, k: w.k, d: w.d, g: w.g });
      var pn = w.k === 'dcp' ? w.d.p.name : w.k === 'dcl' ? (want[drid('p', w.d.key, w.d.pid)] || { d: { p: {} } }).d.p.name : ''; if (pn) names[pn] = 1;
    }
    for (var rid2 in base) if (!want[rid2] && S.recs[rid2] && !S.recs[rid2].del) ops.push({ id: rid2, k: S.recs[rid2].k, del: true });
    if (blocked) toast(L('Only people who can approve can mark a document Approved.', 'Bare de som kan godkjenne, kan merke et dokument Godkjent.'));
    if (!ops.length) { if (blocked) window.dispatchEvent(new Event('tools:change')); return; }
    /* show it at once; the server's answer follows */
    S.docGen++;
    ops.forEach(function (o) { var cur = S.recs[o.id]; if (o.del) { if (cur) cur.del = 1; } else S.recs[o.id] = Object.assign({}, cur || { id: o.id, k: o.k, v: 0 }, { d: o.d, del: 0, locked: false });
    setTimeout(function () { autoDone().catch(function () {}); }, 1500);   /* a document approved here closes the actions that wait for it */ });
    window.dispatchEvent(new Event('tools:change'));
    var e = S.me.team.epoch, failed = 0;
    var sum = Object.keys(names).length ? Object.assign({ e: e }, await seal({ t: L('Documents: ', 'Dokumenter: ') + Object.keys(names).join(', ').slice(0, 160) }, 'log', e)) : undefined;
    for (var i = 0; i < ops.length; i += 400) {
      var part = ops.slice(i, i + 400), recs = [];
      for (var j = 0; j < part.length; j++) {
        var o = part[j], v = S.recs[o.id] ? S.recs[o.id].v || 0 : 0;
        if (o.del) recs.push({ id: o.id, k: o.k, del: true, v: v });
        else { var sl = await seal(o.d, o.id + '|' + o.k + '|' + e, e), rc = { id: o.id, k: o.k, e: e, iv: sl.iv, ct: sl.ct, v: v }; if (o.g && !(S.raw[o.id] && S.raw[o.id].g)) rc.g = o.g; recs.push(rc); }
      }
      try {
        var res = await api('batch', { method: 'PUT', body: { recs: recs, s: i ? undefined : sum } });
        res.results.forEach(function (x) { var r = S.recs[x.id]; if (x.error) { failed++; return; } if (r) { r.v = x.v; r.t = x.t; r.by = S.me.email; r.e = e; } var r0 = recs.filter(function (q) { return q.id === x.id; })[0]; if (r0) S.raw[x.id] = r0.del ? Object.assign({}, S.raw[x.id] || { id: x.id, k: r0.k }, { del: 1, v: x.v }) : { id: x.id, k: r0.k, e: r0.e, iv: r0.iv, ct: r0.ct, v: x.v, t: x.t, by: S.me.email, seq: x.seq }; }); saveCache();
      } catch (err) {
        if (err.offline) { recs.forEach(function (r0) { enqueue(Object.assign({}, r0, { s: undefined })); }); continue; }   /* no signal: each change waits */
        toast(failMsg(err)); failed += part.length; if (err.status === 403) break;
      }
    }
    if (failed) {
      /* someone changed the same line meanwhile: take theirs, then put my changes on top once */
      await pull(false).catch(function () {});
      if (first) return saveDocs(t, base, false);
      toast(L('Some changes could not be saved – the newest version is shown.', 'Noen endringer kunne ikke lagres – den nyeste versjonen vises.'));
      window.dispatchEvent(new Event('tools:change'));
    }
  }
  /* a project sent from /cmd (Document control → Send to Team) */
  /* building inspections shared from /cmd (JP 23:46): the report (without photos) as one record; the team adds notes */
  function cleanHtml(h) {
    var d = new DOMParser().parseFromString('<div>' + String(h).slice(0, 600000) + '</div>', 'text/html'), root = d.body.firstChild;
    [].forEach.call(root.querySelectorAll('script,iframe,object,embed,link,meta,style,form,input,button,textarea,select,base'), function (x) { x.remove(); });
    [].forEach.call(root.querySelectorAll('*'), function (x) { [].slice.call(x.attributes).forEach(function (a) { if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action)$/i.test(a.name) && /^\s*(javascript|data:text)/i.test(a.value))) x.removeAttribute(a.name); }); });
    return root.innerHTML;
  }
  async function importInsp(j) {
    var id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var d = { name: String(j.r.name || L('Inspection', 'Befaring')).slice(0, 120), no: String(j.r.no || '').slice(0, 40), date: String(j.r.date || '').slice(0, 10), address: String(j.r.address || '').slice(0, 160), html: cleanHtml(j.html), notes: [] };
    if (await putRec('insp', id, d, L('Inspection: ', 'Befaring: ') + d.name)) { toast(L('Imported: ', 'Importert: ') + d.name); S.dtab = 'insp'; location.hash = '#in=' + id; }
  }
  function inspections() { return list('insp').sort(function (a, b) { return (b.d.date || '').localeCompare(a.d.date || ''); }); }
  function viewInsp(id) {
    var r = S.recs[id]; if (!r || r.del || !r.d) return '<p class="t-empty">' + L('Not found.', 'Fant ikke.') + '</p>';
    var d = r.d, out = '<div class="t-top t-noprint"><a class="t-back" href="#docs">' + ic('back') + L('Inspections', 'Befaringer') + '</a><button class="t-btn ghost sm" type="button" data-act="inspPdf" data-id="' + id + '">PDF</button></div>';
    out += '<article class="rp-doc rp-inline dc-host t-insp">' + d.html + '</article>';
    out += '<p class="t-h">' + L('Notes from the team', 'Notater fra teamet') + '</p><ul class="t-list">' + (d.notes || []).map(function (n) { return '<li><span class="grow"><span>' + esc(n.text) + '</span><small>' + esc(nameOf(n.by) + ' · ' + fmtTime(n.t)) + '</small></span></li>'; }).join('') + (d.notes && d.notes.length ? '' : '<li><span class="grow t-empty">' + L('No notes yet.', 'Ingen notater ennå.') + '</span></li>') + '</ul>';
    if (rank() >= 1) out += '<form class="t-form" data-form="inote" data-id="' + id + '"><label class="t-lbl">' + L('Add a note', 'Legg til et notat') + '<textarea name="text" rows="3" maxlength="2000" required></textarea></label><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></form>';
    return out;
  }
  async function onInote(f) {
    var id = f.dataset.id, r = S.recs[id]; if (!r || !r.d) return; var tx = f.text.value.trim(); if (!tx) return;
    busy(f, true);
    var d = Object.assign({}, r.d, { notes: (r.d.notes || []).concat([{ by: S.me.email, t: Date.now(), text: tx.slice(0, 2000) }]) });
    if (await putRec('insp', id, d, L('Note on ', 'Notat på ') + d.name)) draw(); else busy(f, false);
  }
  function importDoc(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var j = null; try { j = JSON.parse(fr.result); } catch (x) {}
      if (j && j.team === 'insp' && typeof j.html === 'string' && j.r) { importInsp(j); return; }
      if (j && j.team === 'dcbundle' && Array.isArray(j.krav)) { importBundle(j); return; }
      if (!j || (j.team !== 'dctl' && j.team !== 'dckrav') || !j.p || typeof j.p.name !== 'string' || !Array.isArray(j.p.lines)) { toast(L('That is not a project file from /cmd.', 'Det er ikke en prosjektfil fra /cmd.')); return; }
      var key = j.team;   /* dctl = a Document control project, dckrav = a Document requirements list */
      var p = j.p, nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      p.id = nid; p.files = []; p.made = p.made || new Date().toISOString(); p.name = String(p.name).slice(0, 120);
      p.lines = p.lines.filter(function (l) { return l && typeof l === 'object'; }).slice(0, 3000).map(function (l) { l.files = []; l.id = l.id ? String(l.id).slice(0, 40) : nid + Math.random().toString(36).slice(2, 6); return l; });
      var t = DFe.tools(); t[key].push(p); saveDocs(t, S.docBase, true).then(function () {
        toast(L('Imported: ', 'Importert: ') + p.name);
        S.dtab = 'doc'; location.hash = (key === 'dckrav' ? '#dr=' : '#dc=') + nid;
      });
    };
    fr.readAsText(file);
  }

  /* everything from /cmd's Document requirements in one file (JP 2026-11-16: Team is the home – everybody uses them): every
     list, the client checklists and the project types. A list keeps where it came from (src), so importing the file again
     updates it instead of adding a second copy; types and checklists are matched by their id. */
  function importBundle(j) {
    if (rank() < 1) { toast(L('Your role can only read.', 'Rollen din kan bare lese.')); return; }
    var t = DFe.tools(), now = new Date().toISOString(), nl = 0, nu = 0;
    var cleanP = function (p) { var q = JSON.parse(JSON.stringify(p)); q.files = []; q.name = String(q.name || '').slice(0, 120) || L('Untitled', 'Uten navn');
      q.lines = (Array.isArray(q.lines) ? q.lines : []).filter(function (l) { return l && typeof l === 'object'; }).slice(0, 3000).map(function (l) { l.files = []; l.id = l.id ? String(l.id).slice(0, 40) : Math.random().toString(36).slice(2, 10); return l; }); return q; };
    j.krav.slice(0, 300).forEach(function (p) {
      if (!p || typeof p !== 'object' || typeof p.name !== 'string') return;
      var q = cleanP(p), src = String(p.id || '').slice(0, 60), have = src ? t.dckrav.filter(function (x) { return x.src === src; })[0] : null;
      q.src = src; q.made = q.made || now;
      if (have) { q.id = have.id; t.dckrav = t.dckrav.map(function (x) { return x === have ? q : x; }); nu++; }
      else { q.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); t.dckrav.push(q); nl++; }
    });
    var byId = function (list, x) { return (list || []).filter(function (y) { return y && y.id === x.id; })[0]; };
    (Array.isArray(j.dctypes) ? j.dctypes : []).slice(0, 200).forEach(function (ty) { if (!ty || !ty.id || typeof ty.name !== 'string') return; var h = byId(t.dctypes, ty); if (h) t.dctypes = t.dctypes.map(function (x) { return x === h ? ty : x; }); else t.dctypes.push(ty); });
    var reqs = [].concat(j.dcreq ? [j.dcreq] : [], Array.isArray(j.dcreqs) ? j.dcreqs : []).filter(function (r) { return r && typeof r === 'object' && r.codes; });
    reqs.forEach(function (r, i) {
      if (i === 0 && !t.dcreq) { t.dcreq = r; return; }   /* the first checklist becomes the team's default if it has none */
      if (t.dcreq && JSON.stringify(t.dcreq.codes) === JSON.stringify(r.codes)) return;   /* the same checklist already */
      var rr = Object.assign({}, r, { id: r.id || 'c' + fnv(JSON.stringify(r.codes)) }); t.dcreqs = t.dcreqs || [];
      var h = byId(t.dcreqs, rr); if (h) t.dcreqs = t.dcreqs.map(function (x) { return x === h ? rr : x; }); else t.dcreqs.push(rr);
    });
    saveDocs(t, S.docBase, true).then(function () {
      toast(L('Imported: {a} new and {b} updated lists, the checklists and the project types', 'Importert: {a} nye og {b} oppdaterte lister, sjekklistene og prosjekttypene').replace('{a}', nl).replace('{b}', nu));
      S.dtab = 'doc'; location.hash = '#docs'; draw();
    });
  }

  /* ---------- shared files (Documents → Files): encrypted on this device in chunks of 1 MB, the name in a 'file' record ---------- */
  var CHUNK = 1000000, FMAX = 55e6;
  function hexId(n) { return [].map.call(rnd(n), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function fsize(b) { return b > 1e6 ? (b / 1e6).toFixed(1).replace('.', nb ? ',' : '.') + ' MB' : Math.max(1, Math.round((b || 0) / 1e3)) + ' kB'; }
  function files() { return list('file').sort(function (a, b) { return (b.d.at || 0) - (a.d.at || 0); }); }
  /* the documentation state for reading, built once per change (S.docGen). The Overview's week asked for a project's name once per line,
     and each ask built the whole state again – with ~3 000 lines that froze Team for 20 s (JP 2026-11-16 20:06) */
  function docRO() { if (S.docCache && S.docCache.gen === S.docGen) return S.docCache.t; var t = docState(); S.docCache = { gen: S.docGen, t: t }; return t; }
  function projects() { return (docRO().dctl || []).map(function (p) { return { id: p.id, name: p.name }; }); }
  function projName(pid, key) { var t = docRO(); if (!t._names) { t._names = {}; (t.dckrav || []).forEach(function (p) { t._names['dckrav|' + p.id] = p.name + ' (' + L('requirements', 'krav') + ')'; }); (t.dctl || []).forEach(function (p) { t._names[p.id] = t._names['dctl|' + p.id] = p.name; }); } return t._names[key ? key + '|' + pid : pid] || ''; }
  /* the encrypted pieces of one file – shared files and, since 2026-11-24, a project's delivered files (DocHost.fup) */
  async function sendChunks(file) {
    var e = S.me.team.epoch, fid = hexId(16), n = Math.max(1, Math.ceil(file.size / CHUNK));
    for (var i = 0; i < n; i++) {
      var part = new Uint8Array(await file.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer()), iv = rnd(12);
      var ct = await C.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(fid + '|' + i + '|' + e) }, S.keys[e], part);
      await api('fchunk', { method: 'PUT', body: { fid: fid, n: i, iv: b64(iv), ct: b64(ct) } });
    }
    return { fid: fid, n: n, e: e };
  }
  async function sendFile(file, pid) {
    if (file.size > FMAX) { toast(L('Too big (over 55 MB): ', 'For stor (over 55 MB): ') + file.name); return false; }
    var c = await sendChunks(file), fid = c.fid, n = c.n, e = c.e;
    return putRec('file', 'fl' + fid.slice(0, 20), { fid: fid, n: n, e: e, name: String(file.name || 'file').slice(0, 160), type: file.type || '', size: file.size, pid: pid || '', at: Date.now() }, L('File: ', 'Fil: ') + file.name);
  }
  async function getFile(d) {
    var parts = [], key = d.k ? await C.importKey('raw', ub64(d.k), 'AES-GCM', false, ['decrypt']) : S.keys[d.e];
    if (!key) throw new Error('key');
    for (var i = 0; i < d.n; i++) {
      var c = await api('fchunk?fid=' + d.fid + '&n=' + i);
      parts.push(new Uint8Array(await C.decrypt({ name: 'AES-GCM', iv: ub64(c.iv), additionalData: TE.encode(d.k ? d.lid + '|' + d.fid + '|' + i : d.fid + '|' + i + '|' + d.e) }, key, ub64(c.ct))));
    }
    return new File(parts, d.name, { type: d.type || 'application/octet-stream' });
  }
  /* open a file in Team: pictures, PDFs and text are shown right here; everything can be downloaded or shared */
  var prevUrl = '';
  function fileKind(t, n) { t = String(t || ''); n = String(n || '').toLowerCase(); return /^image\/(png|jpe?g|gif|webp|avif|bmp|svg)/.test(t) || /\.(png|jpe?g|gif|webp|avif)$/.test(n) ? 'img' : /pdf/.test(t) || /\.pdf$/.test(n) ? 'pdf' : /^text\/|json|csv/.test(t) || /\.(txt|csv|md|json|log)$/.test(n) ? 'text' : /^video\//.test(t) ? 'video' : 'other'; }
  function pdfView(f, name) {
    docsReady();
    return docsP.then(function () { return window.DocNaming && window.DocNaming.view ? 0 : loadJs('/dc/doc-naming.js'); }).then(function () {
      if (!window.DocNaming || !window.DocNaming.view) throw new Error('no viewer'); window.DocNaming.view(f, name); });
  }
  function openFile(d) {
    if (prevUrl) { URL.revokeObjectURL(prevUrl); prevUrl = ''; }
    var kind = fileKind(d.type, d.name), meta = [fsize(d.size), d.who ? L('from ', 'fra ') + d.who : '', d.at ? fmtTime(d.at) : ''].filter(Boolean).join(' · ');
    openSheet('<h2 class="t-prevh">' + esc(d.name) + '</h2><p class="t-small">' + esc(meta) + '</p>' + (d.msg ? '<p class="t-prevmsg">' + esc(d.msg) + '</p>' : '') + '<div class="t-prev" id="prevBox"><p class="t-small">' + esc(L('Opening …', 'Åpner …')) + '</p></div>' +
      '<div class="t-acts2"><button class="t-btn" type="button" data-act="fdl" disabled>' + L('Download', 'Last ned') + '</button>' + (navigator.share ? '<button class="t-btn ghost" type="button" data-act="fshare" disabled>' + L('Share', 'Del') + '</button>' : '') + '</div><button class="t-btn ghost wide" type="button" data-act="close">' + L('Close', 'Lukk') + '</button>', 'wide');
    getFile(d).then(function (f) {
      var box = document.getElementById('prevBox'); if (!box) return;
      S.prevFile = f; prevUrl = URL.createObjectURL(f);
      document.querySelectorAll('[data-act=fdl],[data-act=fshare]').forEach(function (b) { b.disabled = false; });
      if (kind === 'img') box.innerHTML = '<img src="' + prevUrl + '" alt="' + esc(d.name) + '">';
      else if (kind === 'pdf') {   /* the viewer from Documents: pinch and double-tap zoom the PDF itself, not the whole page (JP 2026-11-23 – a PDF in a frame can't be zoomed on its own on iPhone/iPad) */
        box.innerHTML = '<p class="t-small">' + esc(L('Opening …', 'Åpner …')) + '</p>';
        pdfView(f, d.name).then(function () { box.innerHTML = '<button class="t-btn ghost" type="button" data-act="fpview">' + esc(L('Show the PDF again', 'Vis PDF-en igjen')) + '</button>'; },
          function () { box.innerHTML = '<iframe src="' + prevUrl + '#view=FitH" title="' + esc(d.name) + '"></iframe>'; });
      }
      else if (kind === 'video') box.innerHTML = '<video src="' + prevUrl + '" controls playsinline></video>';
      else if (kind === 'text' && f.size < 6e6) f.text().then(function (t) { box.innerHTML = '<pre>' + esc(t.slice(0, 200000)) + '</pre>'; });
      else box.innerHTML = '<p class="t-empty">' + esc(L('This kind of file can’t be shown here – download it to open it.', 'Denne filtypen kan ikke vises her – last den ned for å åpne den.')) + '</p>';
    }, function () { var box = document.getElementById('prevBox'); if (box) box.innerHTML = '<p class="t-err">' + esc(L('Could not open the file.', 'Klarte ikke å åpne filen.')) + '</p>'; });
  }
  function saveFile(f) { var u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
  function projPick(name, cur) { return '<select name="' + name + '"><option value="">' + esc(L('No project', 'Uten prosjekt')) + '</option>' + projects().map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>'; }
  /* switch an upload link off (Files, or the project's Filer): files already sent stay */
  async function upOff(id) { var lo = S.recs[id]; if (!lo || !lo.d || !(await sure(L('Switch off this upload link? Files already sent stay.', 'Slå av denne opplastingslenken? Filer som er sendt, blir liggende.')))) return; try { await api('uplink?lid=' + lo.d.lid, { method: 'DELETE' }); await putRec('upl', lo.id, Object.assign({}, lo.d, { off: 1, exp: Math.min(lo.d.exp, Date.now()) })); draw(); toast(L('The link is switched off', 'Lenken er slått av')); } catch (x) { toast(failMsg(x)); } }
  function links() { return list('upl').filter(function (r) { return r.d.exp > Date.now() - 30 * 864e5; }).sort(function (a, b) { return b.d.exp - a.d.exp; }); }
  function filesHtml() {
    var fl = files(), by = {}, out = '';
    if (rank() >= 1) out += '<div class="t-card t-noprint"><label class="t-lbl">' + L('Project', 'Prosjekt') + projPick('fproj', S.fproj) + '</label><div class="t-acts2"><label class="t-btn">' + L('Add files', 'Legg til filer') + '<input type="file" multiple hidden data-fadd></label><label class="t-btn ghost">' + L('Take a photo', 'Ta et bilde') + '<input type="file" accept="image/*" capture="environment" hidden data-fadd></label></div>' +
      '<button class="t-btn ghost wide" type="button" data-act="uplink">' + L('Upload link for a contractor …', 'Opplastingslenke til en entreprenør …') + '</button></div>';
    var ls = links();
    if (ls.length) out += '<p class="t-h">' + L('Upload links', 'Opplastingslenker') + '</p>' + ls.map(function (r) { var live = r.d.exp > Date.now() && !r.d.off;
      return '<div class="t-card t-upl" data-lid="' + esc(r.d.lid) + '"><h2>' + esc(projName(r.d.pid) || r.d.label || L('Upload link', 'Opplastingslenke')) + ' <span class="t-chip t-upcount"></span></h2><p class="t-small">' + esc(live ? L('Works until ', 'Virker til ') + fmtTime(r.d.exp) : L('Switched off', 'Slått av')) + '</p><ul class="t-list" data-ups="' + esc(r.d.lid) + '"><li class="t-small">' + esc(L('Looking for files …', 'Ser etter filer …')) + '</li></ul>' +
        (live ? lateLine(r) + '<div class="t-acts2">' + remindBtn(r) + '<button class="t-btn sm ghost" type="button" data-act="upcopy" data-id="' + esc(r.id) + '">' + L('Copy the link', 'Kopier lenken') + '</button><button class="t-btn sm ghost t-danger" type="button" data-act="upoff" data-id="' + esc(r.id) + '">' + L('Switch off', 'Slå av') + '</button></div>' : (rank() >= 1 ? '<div class="t-acts2"><button class="t-btn sm ghost t-danger" type="button" data-act="updel" data-id="' + esc(r.id) + '">' + L('Delete the link and what came in', 'Slett lenken og det som kom inn') + '</button></div>' : '')) + '</div>'; }).join('');
    fl.forEach(function (r) { var k = r.d.pid || ''; (by[k] = by[k] || []).push(r); });
    out += '<p class="t-h"><span>' + L('Shared files', 'Delte filer') + '</span><span>' + fl.length + '</span></p>';
    if (!fl.length) return out + '<p class="t-empty">' + L('No files yet. Files here are encrypted and shared with the team.', 'Ingen filer ennå. Filer her er kryptert og delt med teamet.') + '</p>';
    Object.keys(by).sort(function (a, b) { return (projName(a) || '~').localeCompare(projName(b) || '~'); }).forEach(function (k) {
      out += '<p class="t-sub">' + esc(projName(k) || L('No project', 'Uten prosjekt')) + '</p><ul class="t-list">' + by[k].map(function (r) {
        return '<li><button class="t-row" type="button" data-act="fopen" data-id="' + esc(r.id) + '"><span class="grow"><span>' + esc(r.d.name) + '</span><small>' + esc([fsize(r.d.size), r.d.from ? (r.d.who ? L('from ', 'fra ') + r.d.who : L('from the upload link', 'fra opplastingslenken')) : nameOf(r.by), fmtTime(r.d.at || r.t)].filter(Boolean).join(' · ')) + '</small></span></button>' + (rank() >= 1 ? '<button class="t-icon" type="button" data-act="fdel" data-id="' + esc(r.id) + '" aria-label="' + esc(L('Delete', 'Slett')) + '">×</button>' : '') + '</li>';
      }).join('') + '</ul>';
    });
    return out;
  }
  /* what came in on each upload link: the names are opened here with the link's key */
  async function loadUploads() {
    var ls = links(); if (!ls.length) return;
    for (var i = 0; i < ls.length; i++) {
      var r = ls[i], ul = document.querySelector('[data-ups="' + r.d.lid + '"]'); if (!ul) continue;
      try {
        var j = await api('uploads?lid=' + r.d.lid), key = await C.importKey('raw', ub64(r.d.key), 'AES-GCM', false, ['decrypt']), kept = {}, groups = {}, order = [], fresh = 0;
        files().forEach(function (x) { if (x.d.from === r.d.lid) kept[x.d.fid] = 1; });
        S.upMeta = S.upMeta || {};
        for (var k = 0; k < j.files.length; k++) {
          var u = j.files[k], meta = null;
          try { meta = JSON.parse(TD.decode(await C.decrypt({ name: 'AES-GCM', iv: ub64(u.name.iv), additionalData: TE.encode(r.d.lid + '|' + u.fid + '|name') }, key, ub64(u.name.ct)))); } catch (x) { meta = { name: L('(could not be read)', '(kunne ikke leses)') }; }
          var um = S.upMeta[u.fid] = { fid: u.fid, n: u.n, name: String(meta.name || 'file').slice(0, 160), type: meta.type || '', size: meta.size || u.size, lid: r.d.lid, k: r.d.key, pid: r.d.pid, from: r.d.lid, who: String(meta.who || '').slice(0, 120), msg: String(meta.msg || '').slice(0, 1000), at: u.t };
          var g = meta.b || u.fid; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(um);
          if (!kept[u.fid]) fresh++;
        }
        order.sort(function (a, b) { return groups[b][0].at - groups[a][0].at; });
        var card = ul.closest('.t-upl'), cnt = card && card.querySelector('.t-upcount');
        if (cnt) cnt.textContent = fresh ? L(fresh + ' new', fresh === 1 ? '1 ny' : fresh + ' nye') : '';
        ul.innerHTML = order.length ? order.map(function (g) {
          var l = groups[g], m0 = l[0], left = l.filter(function (x) { return !kept[x.fid]; });
          return '<li class="t-upb"><div class="t-upbh"><b>' + esc(m0.who || L('Someone with the link', 'Noen med lenken')) + '</b><span class="t-small">' + esc(fmtTime(m0.at)) + '</span></div>' + (m0.msg ? '<p class="t-prevmsg">' + esc(m0.msg) + '</p>' : '') +
            '<ul class="t-list">' + l.map(function (x) { return '<li><button class="t-row" type="button" data-act="upopen" data-fid="' + esc(x.fid) + '"><span class="grow"><span>' + esc(x.name) + '</span><small>' + esc(fsize(x.size)) + '</small></span></button>' + (kept[x.fid] ? '<span class="t-chip">' + L('Kept', 'Lagt til') + '</span>' : rank() >= 1 ? '<button class="t-btn sm" type="button" data-act="upkeep" data-fid="' + esc(x.fid) + '">' + L('Keep', 'Behold') + '</button>' : '') + (rank() >= 1 ? '<button class="t-icon" type="button" data-act="uprm" data-lid="' + esc(x.lid) + '" data-fid="' + esc(x.fid) + '" aria-label="' + esc(L('Remove', 'Fjern')) + '">×</button>' : '') + '</li>'; }).join('') + '</ul>' +
            (left.length > 1 && rank() >= 1 ? '<button class="t-btn sm ghost" type="button" data-act="upkeepall" data-fids="' + esc(left.map(function (x) { return x.fid; }).join(',')) + '">' + L('Keep all ' + left.length, 'Behold alle ' + left.length) + '</button>' : '') + '</li>';
        }).join('') : '<li class="t-small">' + esc(L('Nothing sent yet.', 'Ingenting sendt ennå.')) + '</li>';
      } catch (x) { ul.innerHTML = '<li class="t-small">' + esc(failMsg(x)) + '</li>'; }
    }
  }
  /* keep files from an upload link in the project's shared files – and tell the sender they were received */
  async function keepUploads(fids) {
    var done = [], lid = '';
    for (var i = 0; i < fids.length; i++) { var uk = (S.upMeta || {})[fids[i]]; if (!uk) continue; lid = uk.lid; if (await putRec('file', 'fl' + uk.fid.slice(0, 20), uk, L('File: ', 'Fil: ') + uk.name)) done.push(uk.fid); }
    if (done.length) { api('upkept', { method: 'POST', body: { lid: lid, fids: done } }).catch(function () {}); toast(L(done.length === 1 ? 'Kept in the project files' : done.length + ' files kept in the project files', done.length === 1 ? 'Lagt i prosjektfilene' : done.length + ' filer lagt i prosjektfilene')); draw(); }
  }
  /* the contractor's live list (2026-11-21, JP): for every open upload link on a project, what is still missing or
     sent back – code, document type, planned name, due date – encrypted with that link's key (only someone with the
     link can read it) and sent when it changes. The upload page shows it. */
  function needsFor(pid) {
    var p = (docRO().dctl || []).filter(function (x) { return x.id === pid; })[0]; if (!p) return null;
    var out = [];
    (p.lines || []).forEach(function (l) {
      var st = l.st || 'missing'; if (['missing', 'rej', 'cmt'].indexOf(st) < 0) return;
      out.push({ c: String(l.code || '').slice(0, 12), s: String(l.sys || '').slice(0, 80), t: String(l.type || l.name || '').slice(0, 60), p: String(l.planned || '').slice(0, 120), st: st, due: String(l.due || '').slice(0, 10) });
    });
    return out.slice(0, 600);
  }
  async function pushNeeds() {
    if (!S.me || !S.me.member || S.me.member.role === 'read') return;   /* only those who may write; the server checks too */
    var L0 = links().filter(function (r) { return r.d && r.d.pid && r.d.key && !r.d.off && r.d.exp > Date.now(); });
    for (var i = 0; i < L0.length; i++) {
      var d = L0[i].d, items = needsFor(d.pid); if (!items) continue;
      var body = JSON.stringify({ v: 1, items: items }), mark = 'team.needs.' + d.lid, h = body.length + ':' + body.split('').reduce(function (a, c) { return (a * 31 + c.charCodeAt(0)) | 0; }, 7);
      try { if (localStorage.getItem(mark) === h) continue; } catch (e) {}
      try {
        var k = await C.importKey('raw', ub64(d.key), 'AES-GCM', false, ['encrypt']), iv = rnd(12);
        var ct = await C.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(d.lid + '|needs') }, k, TE.encode(body));
        await api('upneeds', { method: 'POST', body: { lid: d.lid, iv: b64(iv), ct: b64(ct) } });
        try { localStorage.setItem(mark, h); } catch (e) {}
      } catch (e) { /* read-only members, or offline: the next draw tries again */ }
    }
  }
  window.__pushNeeds = pushNeeds;
  /* remind the contractor (2026-11-21, JP): on a live link with a project, what is late (deadline passed, still missing or
     sent back) is counted on the card, and "Remind" makes a short message with those items and the link – shared from the
     phone (Mail, SMS, Teams …) or copied. Nothing is sent by the server. */
  function today0() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function lateOf(pid) { var n = needsFor(pid) || [], t = today0(); return { all: n, late: n.filter(function (x) { return x.due && x.due < t && (x.st === 'missing' || x.st === 'rej'); }) }; }
  function lateLine(r) { if (!r.d.pid) return ''; var o = lateOf(r.d.pid); return o.late.length ? '<p class="t-small t-late">' + esc(L(o.late.length === 1 ? '1 item is late' : o.late.length + ' items are late', o.late.length === 1 ? '1 dokument er forsinket' : o.late.length + ' dokumenter er forsinket')) + '</p>' : ''; }
  function remindBtn(r) {
    if (!r.d.pid || rank() < 1) return ''; var o = lateOf(r.d.pid); if (!o.all.length) return '';
    return '<button class="t-btn sm" type="button" data-act="upremind" data-id="' + esc(r.id) + '">' + esc(o.late.length ? L('Remind about the late ones', 'Påminn om de forsinkede') : L('Remind about what is missing', 'Påminn om det som mangler')) + '</button>';
  }
  function fmtDue(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function remindText(d) {
    var o = lateOf(d.pid), use = (o.late.length ? o.late : o.all).slice(0, 40), more = (o.late.length ? o.late : o.all).length - use.length, pn = projName(d.pid) || '';
    var line = function (x) { return '– ' + [x.c, x.t || x.s].filter(Boolean).join(' ') + (x.st === 'rej' ? L(' (sent back – needs a new version)', ' (sendt i retur – trenger ny versjon)') : '') + (x.due ? L(' – deadline ', ' – frist ') + fmtDue(x.due) : ''); };
    return [L('Hi!', 'Hei!'), '', (o.late.length ? L('A reminder about documentation for ' + pn + ' that is past its deadline:', 'En påminnelse om FDV-dokumentasjon for ' + pn + ' som har passert fristen:') : L('A reminder about what is still missing for ' + pn + ':', 'En påminnelse om det som fortsatt mangler for ' + pn + ':')), '']
      .concat(use.map(line), more > 0 ? [L('… and ' + more + ' more – see the list on the page.', '… og ' + more + ' til – se listen på siden.')] : [], ['', L('Send the files here (the page shows the whole list):', 'Send filene her (siden viser hele listen):'), linkUrl(d), '', L('Thanks!', 'Takk!')]).join('\n');
  }
  function linkUrl(d) { return 'https://jplundberg.com/upload/#' + S.tid + '.' + d.lid + '.' + d.key + '.' + encodeURIComponent(projName(d.pid) || d.label || ''); }
  function uplinkSheet() {
    openSheet('<h2>' + L('Upload link for a contractor', 'Opplastingslenke til en entreprenør') + '</h2><p class="t-small">' + L('Anyone with the link can send files to the project – no account needed. The files are encrypted in their browser; only the team can open them. Nobody can see what is already there.', 'Alle med lenken kan sende filer til prosjektet – uten konto. Filene krypteres i nettleseren deres; bare teamet kan åpne dem. Ingen kan se det som allerede ligger der.') + '</p>' +
      '<form class="t-form" data-form="uplink"><label class="t-lbl">' + L('Project', 'Prosjekt') + projPick('pid', S.fproj) + '</label><label class="t-lbl">' + L('Works for', 'Virker i') + '<select name="days"><option value="7">' + L('1 week', '1 uke') + '</option><option value="14" selected>' + L('2 weeks', '2 uker') + '</option><option value="30">' + L('30 days', '30 dager') + '</option><option value="60">' + L('60 days', '60 dager') + '</option></select></label>' +
      '<p class="t-err" id="err"></p><button class="t-btn wide" type="submit">' + L('Make the link', 'Lag lenken') + '</button><button class="t-btn ghost wide" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button></form>');
  }
  async function onUplink(f) {
    busy(f, true);
    try {
      var lid = hexId(8), kraw = new Uint8Array(await C.exportKey('raw', await C.generateKey(AES, true, ['encrypt', 'decrypt']))), key = b64(kraw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      var j = await api('uplink', { method: 'POST', body: { lid: lid, days: +f.days.value } }), d = { lid: lid, key: key, pid: f.pid.value, label: projName(f.pid.value), exp: j.exp };
      if (!(await putRec('upl', 'ul' + lid, d, L('Upload link: ', 'Opplastingslenke: ') + (d.label || '')))) { busy(f, false); return; }
      var url = linkUrl(d);
      openSheet('<h2>' + L('The link', 'Lenken') + '</h2><p class="t-small">' + L('Send it to the contractor. It works until ', 'Send den til entreprenøren. Den virker til ') + esc(fmtTime(d.exp)) + '.</p><input class="t-in" id="invLink" readonly value="' + esc(url) + '">' +
        '<button class="t-btn wide" type="button" data-act="copyInvite">' + L('Copy', 'Kopier') + '</button>' + (navigator.share ? '<button class="t-btn ghost wide" type="button" data-act="shareInvite">' + L('Share', 'Del') + '</button>' : '') + '<button class="t-btn ghost wide" type="button" data-act="close">' + L('Done', 'Ferdig') + '</button>');
    } catch (x) { setErr(failMsg(x)); busy(f, false); }
  }

  /* ---------- push when Team is closed (Settings): only "someone changed something" – never what was written ---------- */
  function pushOn() { try { return localStorage.getItem('team.push.' + S.tid) === '1'; } catch (e) { return false; } }
  function swReg() { return 'serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js').then(function () { return navigator.serviceWorker.ready; }) : Promise.reject(new Error('sw')); }
  async function setPush(on) {
    try {
      var reg = await swReg();
      if (!on) { var s0 = await reg.pushManager.getSubscription(); if (s0) await api('push', { method: 'POST', body: { endpoint: s0.endpoint, on: false } }); localStorage.removeItem('team.push.' + S.tid); toast(L('Push is off for this team on this device', 'Push er av for dette teamet på denne enheten')); return; }
      if (!window.Notification || !reg.pushManager) throw new Error('none');
      if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') { toast(L('Notifications are not allowed in this browser', 'Varsler er ikke tillatt i denne nettleseren')); return; }
      var k = (await api('push')).key, sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ub64(k) });
      await api('push', { method: 'POST', body: { sub: sub.toJSON(), on: true } });
      localStorage.setItem('team.push.' + S.tid, '1'); toast(L('Push is on – you hear about changes when Team is closed', 'Push er på – du får beskjed om endringer når Team er lukket'));
    } catch (x) { toast(x && x.status ? failMsg(x) : L('This browser cannot get push notifications. On iPhone: add Team to the Home Screen first.', 'Denne nettleseren kan ikke få push-varsler. På iPhone: legg Team til på Hjem-skjermen først.')); }
  }

  /* ---------- the overview: all projects at a glance, and the week in short ---------- */
  /* the projects at a glance (JP 2026-11-16 20:36 "needs to be better to visualize"): a card per project – name and what tells the
     same names apart, the share approved as a big number, one bar split by status, and the counts behind it */
  function projectsCard() {
    var ps = docRO().dctl || []; if (!ps.length) return '';
    var SEG = [['ok', L('approved', 'godkjent')], ['cmt', L('approved with comments', 'godkjent med merknad')], ['recv', L('to check', 'til kontroll')], ['rej', L('not approved', 'ikke godkjent')], ['missing', L('missing', 'mangler')]];
    return '<p class="t-h"><span>' + L('Projects', 'Prosjekter') + '</span><span>' + ps.length + '</span></p><div class="t-projs">' + ps.map(function (p) {
      var all = p.lines || [], ls = all.filter(function (l) { return l.st !== 'na'; }), c = { ok: 0, cmt: 0, recv: 0, rej: 0, missing: 0 };
      ls.forEach(function (l) { c[c[l.st] != null ? l.st : 'missing']++; });
      var done = c.ok + c.cmt, pct = ls.length ? Math.round(done / ls.length * 100) : 0, due = p.due || p.deadline || '', late = due && due < today() && done < ls.length;
      var sub = [p.no, p.trade || p.type, p.site || p.addr, p.who].filter(Boolean).join(' · ');
      var bar = ls.length ? '<span class="t-pbar" role="img" aria-label="' + esc(SEG.filter(function (g) { return c[g[0]]; }).map(function (g) { return c[g[0]] + ' ' + g[1]; }).join(', ')) + '">' + SEG.map(function (g) { return c[g[0]] ? '<i class="s-' + g[0] + '" style="flex:' + c[g[0]] + '"></i>' : ''; }).join('') + '</span>' : '';
      var keys = ls.length ? '<span class="t-pkeys">' + SEG.filter(function (g) { return c[g[0]]; }).map(function (g) { return '<span><i class="s-' + g[0] + '"></i><b class="t-num">' + c[g[0]] + '</b> ' + g[1] + '</span>'; }).join('') + (all.length > ls.length ? '<span><i class="s-na"></i><b class="t-num">' + (all.length - ls.length) + '</b> ' + L('not relevant', 'ikke relevant') + '</span>' : '') + '</span>' : '<span class="t-small">' + L('No document plan yet', 'Ingen dokumentplan ennå') + '</span>';
      return '<a class="t-proj" href="#dc=' + esc(p.id) + '"><span class="t-ptop"><span class="grow"><b>' + esc(p.name) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (ls.length ? '<span class="t-pbig' + (pct === 100 ? ' all' : '') + '"><b class="t-num">' + pct + ' %</b><small>' + L(done + ' of ' + ls.length, done + ' av ' + ls.length) + '</small></span>' : '') + '</span>' + bar + keys +
        (due ? '<span class="t-pdue' + (late ? ' t-warn' : '') + '">' + esc((late ? L('Overdue ', 'Forfalt ') : L('Due ', 'Frist ')) + fmtDate(due)) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
  }
  function weekText() {
    var from = Date.now() - 7 * 864e5, n = { meet: 0, done: 0, newA: 0, docs: {}, files: 0, people: {} };
    for (var id in S.recs) { var r = S.recs[id]; if (!r.t || r.t < from || r.del || !r.d) continue; n.people[r.by] = 1;
      if (r.k === 'meeting') n.meet++; else if (r.k === 'action') { if (r.d.done) n.done++; else n.newA++; } else if (r.k === 'file') n.files++;
      else if (r.k === 'dcl' && r.d.l) {   /* a line made this week (version 1) was brought in or added; a later version is a real change – approved, rejected or other (JP 2026-11-16) */
        /* a requirements list's lines (dckrav) count under its own name too; lines whose project is gone are left out – they showed as "…" (JP 21:32) */
        var pn = projName(r.d.pid, r.d.key); if (!pn) continue; var dd = n.docs[pn] = n.docs[pn] || { add: 0, ok: 0, rej: 0, ch: 0 };
        if ((r.v || 1) <= 1) dd.add++; else if (r.d.l.st === 'ok') dd.ok++; else if (r.d.l.st === 'rej') dd.rej++; else dd.ch++; } }
    var out = [];
    if (n.meet) out.push(L(n.meet + (n.meet === 1 ? ' meeting' : ' meetings'), n.meet + (n.meet === 1 ? ' møte' : ' møter')));
    if (n.done || n.newA) out.push(L(n.done + ' actions done, ' + n.newA + ' open or changed', n.done + ' oppgaver ferdige, ' + n.newA + ' åpne eller endret'));
    Object.keys(n.docs).forEach(function (pn) { var dd = n.docs[pn], bits = [];
      if (dd.add && !dd.ok && !dd.rej && !dd.ch) { out.push(L(pn + ': imported (' + dd.add + ' documents)', pn + ': importert (' + dd.add + ' dokumenter)')); return; }
      if (dd.ok) bits.push(L(dd.ok + ' approved', dd.ok + ' godkjent')); if (dd.rej) bits.push(L(dd.rej + ' not approved', dd.rej + ' ikke godkjent'));
      if (dd.ch) bits.push(L(dd.ch + ' changed', dd.ch + ' endret')); if (dd.add) bits.push(L(dd.add + ' added', dd.add + ' lagt til'));
      out.push(pn + ': ' + bits.join(', ')); });
    if (n.files) out.push(L(n.files + ' files added', n.files + ' filer lagt til'));
    return { lines: out, who: Object.keys(n.people).length };
  }
  function weekCard() {
    var w = weekText(); if (!w.lines.length) return '';
    return '<div class="t-card t-week"><h2>' + L('This week', 'Denne uka') + '</h2><ul>' + w.lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="t-small">' + esc(L(w.who + (w.who === 1 ? ' person' : ' people') + ' did something the last 7 days', w.who + (w.who === 1 ? ' person' : ' personer') + ' gjorde noe de siste 7 dagene')) + '</p><button class="t-btn sm ghost" type="button" data-act="weekCopy">' + L('Copy as text', 'Kopier som tekst') + '</button></div>';
  }

  /* ---------- clocking in and out (Phase G, JP 2026-11-15) ----------
     Admins turn it on for the whole team and can switch it off person by person (record cfgclock, kind cfg – only
     admins may save it, the server checks). Each clock-in is a clk record of your own (start, end, project), encrypted
     like the rest; you only change your own. It shows on Overview as a card with the running time and this week's hours;
     admins see everyone's week on the Team tab. */
  /* the three Documents tabs can be switched off for the whole team by an admin (JP 2026-11-19 21:42); all three off = no Documents in the menu */
  var DTABS = [['doc', 'Documentation', 'Dokumentasjon'], ['insp', 'Inspections', 'Befaringer'], ['files', 'Files', 'Filer']];
  function dtabsOff() { var r = (S.recs || {}).cfgdoctabs; var d = r && !r.del && r.d ? r.d : {}; return Array.isArray(d.off) ? d.off.filter(function (x) { return /^(doc|insp|files)$/.test(x); }) : []; }
  function dtabsOn() { var off = dtabsOff(); return DTABS.filter(function (t) { return off.indexOf(t[0]) < 0; }); }
  async function dtabsSet(key, on) { var off = dtabsOff().filter(function (x) { return x !== key; }); if (!on) off.push(key); if (await putRec('cfg', 'cfgdoctabs', { off: off }, L('Documents tabs', 'Faner i Dokumenter'))) { if (S.sheet) settingsSheet(); draw(); } }
  function dtabsAdmin() {
    if (rank() < 3) return '';
    var off = dtabsOff();
    return '<p class="t-h">' + L('Documentation', 'Dokumentasjon') + '</p>' + DTABS.map(function (t) { var on = off.indexOf(t[0]) < 0; return '<label class="t-switch"><span><b>' + L(t[1], t[2]) + '</b><small>' + (on ? L('On for everyone in the team', 'På for alle i teamet') : L('Off – nobody sees this tab', 'Av – ingen ser denne fanen')) + '</small></span><input type="checkbox" data-dtoff="' + t[0] + '"' + (on ? ' checked' : '') + '></label>'; }).join('') +
      (off.length === 3 ? '<p class="t-small">' + L('All three are off, so Documents is gone from the menu.', 'Alle tre er av, så Dokumenter er borte fra menyen.') + '</p>' : '');
  }
  function clockCfg() { var r = S.recs.cfgclock; var d = r && !r.del && r.d ? r.d : {}; return { on: !!d.on, off: Array.isArray(d.off) ? d.off : [] }; }
  function clockFor(em) { var c = clockCfg(); return c.on && c.off.indexOf(em) < 0; }
  function clks(em) { return list('clk').filter(function (r) { return (r.d.who || r.by) === em; }); }
  function clockRun(em) { return clks(em).filter(function (r) { return r.d.start && !r.d.end; }).sort(function (a, b) { return b.d.start - a.d.start; })[0] || null; }
  function monday() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  function clockWeek(em) { var from = monday(), now = Date.now(); return clks(em).reduce(function (n, r) { var a = Math.max(r.d.start || 0, from), b = r.d.end || now; return b > a ? n + (b - a) : n; }, 0); }
  function hm(ms) { var m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ' t ' + String(m % 60).padStart(2, '0') + ' min'; }
  function hmEn(ms) { var m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; }
  function dur(ms) { return nb ? hm(ms) : hmEn(ms); }
  function clockCard() {
    if (!S.me || !clockFor(S.me.email)) return '';
    var run = clockRun(S.me.email), wk = clockWeek(S.me.email);
    var at = run ? new Date(run.d.start).toLocaleTimeString(nb ? 'nb-NO' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    return '<div class="t-card t-clock' + (run ? ' on' : '') + '"><div class="t-clockrow"><span class="grow"><b>' + (run ? L('In since ', 'Inne siden ') + esc(at) : L('Not clocked in', 'Ikke stemplet inn')) + '</b>' +
      '<small class="t-num">' + (run ? esc(dur(Date.now() - run.d.start)) + ' · ' : '') + esc(L('this week ', 'denne uka ') + dur(wk)) + '</small></span>' +
      '<button class="t-btn' + (run ? ' ghost' : '') + '" type="button" data-act="' + (run ? 'clockOut' : 'clockIn') + '">' + (run ? L('Clock out', 'Stemple ut') : L('Clock in', 'Stemple inn')) + '</button></div>' + clockCmd() + '</div>';
  }
  /* your hours into cmd's flex time (2026-11-15, only for the owner – the one with cmd): finished clock-ins from the last 31
     days go in the link's hash (date.in.out.id – no names, no projects; a hash never reaches a server); cmd asks before adding
     and skips any it already has */
  function clockLink(em) {
    var from = Date.now() - 31 * 864e5, p2 = function (n) { return String(n).padStart(2, '0'); };
    var l = clks(em).filter(function (r) { return r.d.start && r.d.end > r.d.start && r.d.start > from; }).sort(function (a, b) { return a.d.start - b.d.start; }).slice(-60).map(function (r) {
      var a = new Date(r.d.start), b = new Date(r.d.end), sameDay = a.toDateString() === b.toDateString();
      return a.getFullYear() + p2(a.getMonth() + 1) + p2(a.getDate()) + '.' + p2(a.getHours()) + p2(a.getMinutes()) + '.' + (sameDay ? p2(b.getHours()) + p2(b.getMinutes()) : '2359') + '.' + String(r.id).replace(/^clk/, '').replace(/[^0-9a-z]/gi, '').slice(-10).toLowerCase();
    }).filter(function (x) { return !/\.(\d{4})\.\1\./.test(x) && /\.[0-9a-z]{4,}$/.test(x); });
    if (!l.length) return '';
    var base = /(^|\.)jplundberg\.com$/.test(location.hostname) ? 'https://jplundberg.com' : location.origin;
    return base + '/cmd/work/#teamhours=' + l.join(',');
  }
  function clockCmd() {
    if (!S.me || !S.me.isOwner) return '';
    var u = clockLink(S.me.email); if (!u) return '';
    return '<a class="t-link t-clockcmd" href="' + esc(u) + '" target="_blank" rel="noopener">' + ic('cal') + L('Add to my flex time in cmd', 'Legg til i fleksitiden min i cmd') + '</a>';
  }
  setInterval(function () { if (S.me && S.me.member && S.tab && S.tab() === 'overview' && !S.sheet && !S.edit && !typing() && clockRun(S.me.email)) draw(); }, 60e3);   /* the running time on the card, once a minute */
  async function clockIn() { if (clockRun(S.me.email)) return; var id = 'clk' + rid(); if (await putRec('clk', id, { who: S.me.email, start: Date.now(), end: 0 })) { draw(); toast(L('Clocked in', 'Stemplet inn')); } }
  async function clockOut() { var r = clockRun(S.me.email); if (!r) return; if (await putRec('clk', r.id, Object.assign({}, r.d, { end: Date.now() }))) { draw(); toast(L('Clocked out · ', 'Stemplet ut · ') + dur(Date.now() - r.d.start)); } }
  /* admins: the switch for the whole team and one per person */
  /* the new project flow in Documentation (JP 2026-11-23): on for the whole team unless an admin turns it off (record cfgprojflow, kind cfg) */
  function flowCfgOn() { var r = S.recs.cfgprojflow; return !(r && !r.del && r.d && r.d.on === false); }
  function flowAdmin() {
    if (rank() < 3) return '';
    var on = flowCfgOn();
    return '<label class="t-switch"><span><b>' + L('New project flow', 'Ny prosjektflyt') + '</b><small>' + (on ? L('On – projects go Requirements → Document plan → Delivery → Comparison → Final check.', 'På – prosjektene går Krav → Dokumentplan → Levering → Sammenligning → Sluttkontroll.') : L('Off – projects show the old view (Requirements, Received, Report).', 'Av – prosjektene viser den gamle visningen (Krav, Mottak, Rapport).')) + '</small></span><input type="checkbox" data-flowteam' + (on ? ' checked' : '') + '></label>';
  }
  async function flowSet(on) { if (await putRec('cfg', 'cfgprojflow', { on: !!on }, L('Project flow', 'Prosjektflyt'))) { if (S.sheet) settingsSheet(); draw(); } }
  function clockAdmin() {
    if (rank() < 3) return '';
    var c = clockCfg();
    return '<p class="t-h">' + L('Clocking in', 'Stempling') + '</p>' +
      '<label class="t-switch"><span><b>' + L('Clock in and out for the team', 'Stemple inn og ut for teamet') + '</b><small>' + (c.on ? L('On – choose below who can clock in.', 'På – velg under hvem som kan stemple.') : L('Off – nobody in the team sees the button.', 'Av – ingen i teamet ser knappen.')) + '</small></span><input type="checkbox" data-clockteam' + (c.on ? ' checked' : '') + '></label>' +
      (c.on ? '<ul class="t-list t-clockppl">' + S.members.map(function (m) { var on = c.off.indexOf(m.email) < 0; return '<li><label class="t-switch t-inline"><span><b>' + esc(m.email === S.me.email ? L('You', 'Deg') : m.name) + '</b><small>' + esc(roleName(m.role)) + '</small></span><input type="checkbox" data-clockm="' + esc(m.email) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(L('Clocking for ', 'Stempling for ') + m.name) + '"></label></li>'; }).join('') + '</ul>' : '');
  }
  async function clockSet(patch) { var c = clockCfg(), d = { on: 'on' in patch ? patch.on : c.on, off: c.off.slice() }; if (patch.who) { var i = d.off.indexOf(patch.who); if (patch.allow && i > -1) d.off.splice(i, 1); if (!patch.allow && i < 0) d.off.push(patch.who); } if (await putRec('cfg', 'cfgclock', d, L('Clocking settings', 'Stempling'))) { if (S.sheet) settingsSheet(); draw(); } }
  /* admins: everyone's hours this week (Team tab) */
  function clockTeamCard() {
    if (rank() < 3 || !clockCfg().on) return '';
    var rows = S.members.filter(function (m) { return clockFor(m.email); }).map(function (m) { return { m: m, wk: clockWeek(m.email), run: clockRun(m.email) }; });
    if (!rows.length) return '';
    return '<p class="t-h">' + L('Hours this week', 'Timer denne uka') + '</p><div class="t-card"><ul class="t-list t-hours">' + rows.map(function (x) { return '<li><span class="grow">' + esc(x.m.email === S.me.email ? L('You', 'Deg') : x.m.name) + (x.run ? ' <span class="t-tag ok">' + L('in', 'inne') + '</span>' : '') + '</span><b class="t-num">' + esc(dur(x.wk)) + '</b></li>'; }).join('') + '</ul></div>';
  }

  /* ---------- starting without signal: what was here last (still encrypted) is kept on this device ---------- */
  function saveCache() {
    clearTimeout(saveCache.t); saveCache.t = setTimeout(function () {
      var raw = []; for (var id in S.raw) raw.push(S.raw[id]);
      kset('cache', { me: S.me, teams: S.teams, seq: S.seq, raw: raw, members: S.members.map(function (m) { return { email: m.email, name: m.name, role: m.role }; }), at: Date.now() }).catch(function () {});
    }, 800);
  }

  /* ---------- sheets ---------- */
  function openSheet(html, cls) {
    closeSheet(true);
    var bg = document.createElement('div'); bg.className = 't-sheetbg'; bg.innerHTML = '<div class="t-sheet' + (cls ? ' t-sheet-' + cls : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); S.sheet = bg;
    var f = bg.querySelector('input:not([readonly]), select'); if (f && !/Mobi/.test(navigator.userAgent)) f.focus();
  }
  /* your teams: each one is separate – switching opens it (unlocked once per device, like the first) */
  function teamsSheet() {
    var ts = S.teams.filter(function (t) { return t.role || t.ready; });
    openSheet('<h2>' + L('Your teams', 'Teamene dine') + '</h2><ul class="t-list t-teams">' + ts.map(function (t) {
      var sub = t.role === 'pending' ? L('Waiting for approval', 'Venter på godkjenning') : t.role ? roleName(t.role) : L('Not set up yet', 'Ikke satt opp ennå');
      return '<li><button class="t-row" type="button" data-act="goTeam" data-id="' + esc(t.id) + '"><span class="grow"><span>' + esc(t.name || L('New team', 'Nytt team')) + '</span><small>' + esc(sub) + '</small></span>' + (t.id === S.tid && document.querySelector('.t-tabs') ? '<span class="t-chip">' + L('Open', 'Åpen') + '</span>' : '') + '</button></li>';
    }).join('') + '</ul>' + (S.me.isOwner ? '<button class="t-btn wide" type="button" data-act="newTeam">' + ic('plus') + ' ' + L('New team', 'Nytt team') + '</button>' : '') +
      '<button class="t-btn ghost wide" type="button" data-act="close">' + L('Close', 'Lukk') + '</button>');
  }
  function closeSheet(keep) { if (S.sheet) { S.sheet.remove(); S.sheet = null; if (!keep && S.stale) draw(); } }

  /* ---------- one place for clicks and forms ---------- */
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act], [data-go], [data-filter], [data-dtab]');
    if (!t) { if (S.sheet && e.target === S.sheet) closeSheet(); return; }
    if (t.dataset.go) { e.preventDefault(); location.hash = '#' + t.dataset.go; return; }
    if (t.dataset.filter) { S.afilter = t.dataset.filter; draw(); return; }
    if (t.dataset.dtab) { S.dtab = t.dataset.dtab; showDtab(); return; }
    var a = t.dataset.act;
    if (a === 'reload') return location.reload();
    if (a === 'close') return closeSheet();
    if (a === 'settings') return settingsSheet();
    if (a === 'settab') { S.setTab = t.dataset.settab; settingsSheet(); return; }
    if (a === 'pal') { if (rank() < 3) return; var pid = t.dataset.pal; if (await putRec('cfg', 'cfgpalette', { p: pid }, L('Team colours', 'Teamets farger'))) { palSync(); if (S.sheet) settingsSheet(); draw(); } return; }
    if (a === 'clockIn') return clockIn();
    if (a === 'clockOut') return clockOut();
    if (a === 'teams') return teamsSheet();
    if (a === 'inspPdf') { var ir = S.recs[t.dataset.id]; if (!ir || !ir.d) return; docsReady(); docsP.then(function () { return window.PagedPdf.html(ir.d.html, [ir.d.name, S.me.team.name].join('  ·  '), (ir.d.no ? ir.d.no + ' ' : '') + ir.d.name + '.pdf'); }).then(function (f2) { window.PagedPdf.share(f2); }, function () { toast(L('The PDF could not be made.', 'PDF-en kunne ikke lages.')); }); return; }
    if (a === 'uplink') return uplinkSheet();
    if (a === 'accsave') { t.disabled = true; try { await saveAccess(); } catch (e2) { t.disabled = false; toast(failMsg(e2)); } return; }
    if (a === 'accstd') { if (S.accEdit) { S.accEdit.m = {}; S.accOpen = true; draw(); } return; }
    if (a === 'fopen') { var fr = S.recs[t.dataset.id]; if (fr && fr.d) openFile(fr.d); return; }
    if (a === 'fdel') { var fd = S.recs[t.dataset.id]; if (!fd || !(await sure(L('Delete this file for everyone? It stays in the history.', 'Slette denne filen for alle? Den blir liggende i historikken.')))) return; if (await delRec(t.dataset.id, L('File: ', 'Fil: ') + (fd.d ? fd.d.name : ''))) draw(); return; }
    if (a === 'upopen') { var um = (S.upMeta || {})[t.dataset.fid]; if (um) openFile(um); return; }
    if (a === 'upkeep') { t.disabled = true; await keepUploads([t.dataset.fid]); return; }
    if (a === 'uprm') { if (!(await sure(L('Remove this file from the list? If it was kept, it stays in the shared files.', 'Fjerne denne filen fra listen? Er den lagt til, blir den liggende i de delte filene.')))) return; t.disabled = true; try { await api('uprm', { method: 'POST', body: { lid: t.dataset.lid, fids: [t.dataset.fid] } }); toast(L('Removed', 'Fjernet')); draw(); } catch (x) { t.disabled = false; toast(failMsg(x)); } return; }
    if (a === 'welcomeOk') { try { localStorage.setItem('team.welcome.' + S.tid, '1'); } catch (x) {} draw(); return; }
    if (a === 'updel') { var ld = S.recs[t.dataset.id]; if (!ld || !ld.d || !(await sure(L('Delete this upload link and everything that came in on it? Files you kept stay in the shared files.', 'Slette denne opplastingslenken og alt som kom inn med den? Filer du har lagt til, blir liggende i de delte filene.')))) return; try { await api('uprm', { method: 'POST', body: { lid: ld.d.lid, all: true } }); await delRec(ld.id, L('Upload link', 'Opplastingslenke')); toast(L('Deleted', 'Slettet')); draw(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'logreset') { if (!(await sure(L('Empty the whole change log for this team? One line will say that you did it.', 'Tømme hele endringsloggen for dette teamet? Én linje sier at du gjorde det.')))) return; try { await api('log', { method: 'DELETE' }); await loadLog(); closeSheet(); draw(); toast(L('The log is empty', 'Loggen er tømt')); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'upkeepall') { t.disabled = true; await keepUploads(t.dataset.fids.split(',')); return; }
    if (a === 'fdl') { if (S.prevFile) saveFile(S.prevFile); return; }
    if (a === 'fpview') { if (S.prevFile) pdfView(S.prevFile, S.prevFile.name).catch(function () {}); return; }
    if (a === 'fshare') { if (S.prevFile && navigator.canShare && navigator.canShare({ files: [S.prevFile] })) navigator.share({ files: [S.prevFile] }).catch(function () {}); else if (S.prevFile) saveFile(S.prevFile); return; }
    if (a === 'upremind') { var rr = S.recs[t.dataset.id]; if (!rr || !rr.d) return; var txt = remindText(rr.d);
      if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast(L('Message copied – paste it in an e-mail or SMS', 'Meldingen er kopiert – lim den inn i en e-post eller SMS')); }, function () { showText(L('The message', 'Meldingen'), txt); });
      return; }
    if (a === 'upcopy') { var lr = S.recs[t.dataset.id]; if (!lr || !lr.d) return; var lu = linkUrl(lr.d); (navigator.clipboard ? navigator.clipboard.writeText(lu) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () { showText(L('The link', 'Lenken'), lu); }); return; }
    if (a === 'upoff') { upOff(t.dataset.id); return; }
    if (a === 'weekCopy') { var wt = weekText(), txt = S.me.team.name + ' – ' + L('this week', 'denne uka') + '\n' + wt.lines.map(function (x) { return '• ' + x; }).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () { showText('', txt); }); return; }
    if (a === 'seen') { try { localStorage.setItem(seenKey(), String(S.seq)); } catch (x) {} badge(0); draw(); return; }
    if (a === 'notify') { if (!window.Notification) { toast(L('This browser cannot show notifications.', 'Denne nettleseren kan ikke vise varsler.')); return; } var on = localStorage.getItem('team.notify') === '1'; if (on) { localStorage.removeItem('team.notify'); closeSheet(); toast(L('Notifications off', 'Varsler av')); return; } Notification.requestPermission().then(function (pm) { if (pm === 'granted') { localStorage.setItem('team.notify', '1'); toast(L('Notifications on for this device', 'Varsler på for denne enheten')); } else toast(L('The browser said no – allow notifications for work.jplundberg.com in its settings.', 'Nettleseren sa nei – tillat varsler for work.jplundberg.com i innstillingene.')); closeSheet(); }); return; }
    if (a === 'renameTeam') return renameSheet();
    if (a === 'backup') return backupSheet();
    if (a === 'deleteTeam') return deleteSheet();
    if (a === 'goTeam') { if (t.dataset.id === S.tid && S.me.member && document.querySelector('.t-tabs')) closeSheet(); else goTeam(t.dataset.id); return; }   /* from the New team form the open team is not on screen: go to it (JP 21:31) */
    if (a === 'newTeam') { location.href = '/?new=1'; return; }
    if (a === 'newMeeting') return startEdit(rid(), true);
    if (a === 'edit') return startEdit(t.dataset.id);
    if (a === 'cancelEdit') { var wasNew = S.edit && S.edit.isNew; endEdit(); if (wasNew) location.hash = '#meetings'; return; }
    if (a === 'delMeeting') { if (!(await sure(L('Delete this meeting? It stays in the history.', 'Slette dette møtet? Det blir liggende i historikken.')))) return; var mid = S.edit.id, ttl = S.recs[mid] && S.recs[mid].d ? S.recs[mid].d.title : ''; var mkeep = S.recs[mid] && { k: S.recs[mid].k, d: S.recs[mid].d }; if (await delRec(mid, L('Meeting: ', 'Møte: ') + ttl)) { endEdit(true); location.hash = '#meetings'; draw(); if (mkeep && mkeep.d) undoToast(L('Meeting deleted.', 'Møtet er slettet.'), function () { return putRec(mkeep.k, mid, mkeep.d, L('Restored – meeting: ', 'Gjenopprettet – møte: ') + ttl).then(function () { draw(); }); }); } return; }
    if (a === 'print') return window.print();
    if (a === 'newAction') return actionSheet(null, t.dataset.meeting);
    if (a === 'editAction') return actionSheet(t.dataset.id);
    if (a === 'delAction') { var ad = S.recs[t.dataset.id], aid = t.dataset.id; if (!(await sure(L('Delete this action?', 'Slette denne oppgaven?')))) return;   /* asked first, Undo after (JP 2026-11-24 21:56) */
      var akeep = ad && { k: ad.k, d: ad.d }; if (await delRec(aid, L('Action: ', 'Oppgave: ') + (ad && ad.d ? ad.d.text : ''))) { closeSheet(); draw(); if (akeep && akeep.d) undoToast(L('Action deleted.', 'Oppgaven er slettet.'), function () { return putRec(akeep.k, aid, akeep.d, L('Restored – action: ', 'Gjenopprettet – oppgave: ') + (akeep.d.text || '')).then(function () { draw(); }); }); } return; }
    if (a === 'invite') return inviteSheet();
    if (a === 'shareInvite') { var v = document.getElementById('invLink').value; navigator.share({ title: S.me.team.name, text: L('Join our team', 'Bli med i teamet vårt'), url: v }).catch(function () {}); return; }
    if (a === 'copyInvite') { var inp = document.getElementById('invLink'); inp.select(); (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () { document.execCommand('copy'); toast(L('Copied', 'Kopiert')); }); return; }
    if (a === 'cancelInvite') { try { await api('invites?id=' + t.dataset.id, { method: 'DELETE' }); await loadMembers(); draw(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'approve') return approve(t.dataset.email, t);
    if (a === 'decline') { if (!(await sure(L('Decline this request?', 'Avslå denne forespørselen?')))) return; try { await api('decline', { method: 'POST', body: { email: t.dataset.email } }); await loadMembers(); draw(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'member') return memberSheet(t.dataset.email);
    if (a === 'remove') return removeMember(t.dataset.email, t);
    if (a === 'logall') { openSheet('<h2>' + L('Change log', 'Endringslogg') + '</h2>' + logHtml() + '<div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Close', 'Lukk') + '</button></div>', 'log'); return; }
    if (a === 'log') { S.logOpen = !S.logOpen; if (S.logOpen) { try { await loadLog(); } catch (x) { toast(failMsg(x)); } } draw(); return; }
    if (a === 'withdraw') { try { await api('join', { method: 'DELETE' }); await kclear(); S.me = await api('me'); stopPoll(); route(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'changePass') return passSheet();
    if (a === 'forget') { if (!(await sure(L('Forget Team on this device? You need your passcode to open it here again.', 'Glemme Team på denne enheten? Du trenger koden for å åpne den her igjen.')))) return; await kclear(); S.keys = {}; closeSheet(true); stopPoll(); route(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.tick) return tick(t.dataset.tick, t.checked);
    if (t.dataset.accm && S.accEdit) { var am = t.dataset.accm.split(':'), ai = ROLES.indexOf(am[1]); S.accEdit.m[am[0]] = t.checked ? am[1] : ROLES[Math.min(3, ai + 1)]; S.accOpen = true; draw(); return; }
    if (t.dataset.acctr && S.accEdit) { if (t.value) S.accEdit.tr[t.dataset.acctr] = t.value; else delete S.accEdit.tr[t.dataset.acctr]; S.accOpen = true; draw(); return; }
    if (t.dataset.accpp && S.accEdit) { var ap = t.dataset.accpp.split('|'), o = S.accEdit.pp[ap[0]] || (S.accEdit.pp[ap[0]] = {}); if (t.value) o[ap[1]] = t.value; else delete o[ap[1]]; if (!Object.keys(o).length) delete S.accEdit.pp[ap[0]]; S.accOpen = true; draw(); return; }
    if (t.hasAttribute('data-dtoff')) return dtabsSet(t.dataset.dtoff, t.checked);
    if (t.hasAttribute('data-clockteam')) return clockSet({ on: t.checked });
    if (t.hasAttribute('data-flowteam')) return flowSet(t.checked);
    if (t.dataset.clockm) return clockSet({ who: t.dataset.clockm, allow: t.checked });
    if (t.hasAttribute('data-push')) { setPush(t.checked).then(function () { t.checked = pushOn(); }); return; }
    if (t.name === 'fproj') { S.fproj = t.value; return; }
    if (t.hasAttribute('data-fadd')) { var fs = Array.prototype.slice.call(t.files || []); t.value = ''; if (!fs.length) return; (async function () { var ok = 0; toast(L('Encrypting and sending …', 'Krypterer og sender …')); for (var i = 0; i < fs.length; i++) { try { if (await sendFile(fs[i], S.fproj || '')) ok++; } catch (x) { toast(failMsg(x)); break; } } if (ok) { toast(L(ok + (ok === 1 ? ' file shared' : ' files shared'), ok + (ok === 1 ? ' fil delt' : ' filer delt'))); draw(); } })(); return; }
    if (t.hasAttribute('data-dcimport')) { if (t.files && t.files[0]) importDoc(t.files[0]); t.value = ''; return; }
    if (t.hasAttribute('data-themepick')) { try { localStorage.setItem('team.theme', t.value); } catch (x) {} if (window.__teamTheme) window.__teamTheme(); return; }
    if (t.hasAttribute('data-lang')) { try { localStorage.setItem('team.lang', t.value); } catch (x) {} location.reload(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    ({ setup: onSetup, join: onJoin, unlock: onUnlock, meeting: onMeeting, action: onAction, invite: onInvite, role: onRole, pass: onPass, rename: onRename, delTeam: onDelTeam, backup: onBackup, restore: onRestore, inote: onInote, uplink: onUplink, search: function (f2) { location.hash = 'search=' + encodeURIComponent(f2.q.value.trim()); } })[f.dataset.form](f);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) closeSheet(); });

  boot();
})();
