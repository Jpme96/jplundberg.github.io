/* Team (work.jplundberg.com) – meetings, actions and the team, end-to-end encrypted.
   How the keys work:
   - The team key (AES-GCM) encrypts every record on the device. The server never sees it.
   - Each member has their own key pair (ECDH P-256). The private key is locked with their passcode before it is
     stored on the server (so a new device can unlock with the passcode); on this device it is kept in IndexedDB.
   - An admin's device wraps the team key for a new member's public key when it approves them. Removing someone
     makes a new team key (a new "epoch") that only the others get.
   No part of /cmd is loaded here. */
(function () {
  'use strict';
  var nb = (function () { try { var v = localStorage.getItem('team.lang'); if (v) return v === 'nb'; } catch (e) {} return /^(nb|no|nn)/i.test(navigator.language || ''); })();
  function L(en, no) { return nb ? no : en; }
  document.documentElement.lang = nb ? 'nb' : 'en';
  var $app = document.getElementById('app');
  var ROLES = ['read', 'edit', 'approve', 'admin'];
  function roleName(r) { return { read: L('Can read', 'Kan lese'), edit: L('Can edit', 'Kan redigere'), approve: L('Can approve', 'Kan godkjenne'), admin: L('Admin', 'Admin') }[r] || r; }
  var S = { me: null, keys: {}, priv: null, recs: {}, seq: 0, locks: {}, members: [], requests: [], invites: [], log: [], edit: null, sheet: null, timer: 0, hb: 0 };
  window.__team = S;   /* for the tests */
  /* which team: ?t= in the link (invites carry it), else the last one used here, else the first team ('team') */
  var TID = /^(team|[a-z0-9]{12})$/;
  S.tid = (function () { var q = new URLSearchParams(location.search).get('t'), v = null; try { v = localStorage.getItem('team.cur'); } catch (e) {} return TID.test(q || '') ? q : TID.test(v || '') ? v : 'team'; })();
  S.newTeam = new URLSearchParams(location.search).get('new') === '1';
  S.teams = [];
  function useTeam(id) { S.tid = id; try { localStorage.setItem('team.cur', id); } catch (e) {} }
  function goTeam(id) { useTeam(id); location.href = '/?t=' + id; }

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
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 3200); }
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
    try { S.teams = (await api('teams')).teams || []; } catch (e) { S.teams = []; }
    /* the team kept here may be gone or not yours: go to one you are in (an invite link always wins) */
    if (!joinCode() && !S.newTeam && S.teams.length && !S.teams.some(function (t) { return t.id === S.tid; })) useTeam(S.teams[0].id);
    useTeam(S.tid);
    try { S.me = await api('me'); } catch (e) { return screen('<h1>' + esc(L('Team', 'Team')) + '</h1><p>' + esc(failMsg(e)) + '</p><button class="t-btn" type="button" data-act="reload">' + L('Try again', 'Prøv igjen') + '</button>'); }
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
  function screen(html) { stopPoll(); $app.innerHTML = '<div class="t-screen">' + html + '</div>'; }
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
    document.documentElement.classList.add('unlocked');
    await Promise.all([pull(true), loadMembers()]);
    draw();
    stopPoll();
    S.timer = setInterval(function () { if (document.visibilityState === 'visible') refresh(); }, 15000);
  }
  function stopPoll() { clearInterval(S.timer); S.timer = 0; }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.timer) refresh(); });
  async function refresh() {
    try {
      var before = S.seq, ep = S.me.team.epoch;
      await pull(false);
      if (S.tab() === 'team' || rank() >= 3) await loadMembers();
      if (S.me.team.epoch !== ep) { S.me = await api('me'); await loadKeys(); await pull(true); }
      if (S.tab() === 'docs' && !S.edit) { if (S.docsDirty) { S.docsDirty = false; window.dispatchEvent(new Event('tools:change')); } }
      else if (!typing() && !S.sheet && !S.edit) draw(); else if (S.seq !== before) S.stale = true;
    } catch (e) { if (e.status === 403) { S.me = await api('me').catch(function () { return S.me; }); if (!S.me.member) { stopPoll(); route(); } } }
  }
  async function pull(all) {
    var j = await api('recs?since=' + (all ? 0 : S.seq));
    if (all) S.recs = {};
    for (var i = 0; i < j.recs.length; i++) {
      var r = j.recs[i];
      if (DK[r.k]) { S.docsDirty = true; S.docGen++; }
      if (r.del) { S.recs[r.id] = { id: r.id, k: r.k, v: r.v, t: r.t, by: r.by, del: 1 }; continue; }
      var d = await unseal(r, r.id + '|' + r.k + '|' + r.e, r.e);
      S.recs[r.id] = { id: r.id, k: r.k, v: r.v, t: r.t, by: r.by, e: r.e, d: d, locked: !d };
    }
    S.seq = j.seq; S.locks = j.locks || {};
    if (j.epoch !== S.me.team.epoch) S.me.team.epoch = j.epoch;
  }
  async function loadMembers() {
    var j = await api('members'); S.members = j.members || []; S.requests = j.requests || [];
    if (rank() >= 3) { try { S.invites = (await api('invites')).invites || []; } catch (e) {} }
  }
  function list(kind) { var out = []; for (var id in S.recs) { var r = S.recs[id]; if (r.k === kind && !r.del && r.d) out.push(r); } return out; }
  function meetings() { return list('meeting').sort(function (a, b) { return (b.d.date + (b.d.from || '')).localeCompare(a.d.date + (a.d.from || '')); }); }
  function actions() { return list('action'); }
  function lockOf(id) { var l = S.locks[id]; return l && l.until > Date.now() && l.by !== S.me.email ? l : null; }

  async function putRec(kind, id, data, sum) {
    var e = S.me.team.epoch, cur = S.recs[id];
    var s = await seal(data, id + '|' + kind + '|' + e, e);
    var sm = sum ? Object.assign({ e: e }, await seal({ t: String(sum).slice(0, 200) }, 'log', e)) : undefined;
    try {
      var res = await api('rec', { method: 'PUT', body: { id: id, k: kind, e: e, iv: s.iv, ct: s.ct, v: cur ? cur.v : 0, s: sm } });
      S.recs[id] = { id: id, k: kind, v: res.v, t: res.t, by: S.me.email, e: e, d: data };
      S.seq = Math.max(S.seq, res.seq - 1);
      return true;
    } catch (err) { if (err.status === 409) await pull(false).catch(function () {}); toast(failMsg(err)); return false; }
  }
  async function delRec(id, sum) {
    var cur = S.recs[id]; if (!cur) return false;
    var e = S.me.team.epoch, sm = sum ? Object.assign({ e: e }, await seal({ t: String(sum).slice(0, 200) }, 'log', e)) : undefined;
    try { var res = await api('rec', { method: 'PUT', body: { id: id, k: cur.k, del: true, v: cur.v, s: sm } }); cur.del = 1; cur.v = res.v; return true; }
    catch (err) { toast(failMsg(err)); return false; }
  }

  /* where you are: #overview, #meetings, #m=<id>, #actions, #team */
  S.tab = function () { var h = location.hash.slice(1); if (/^m=/.test(h)) return 'meetings'; if (/^d[cr]=/.test(h)) return 'docs'; return /^(overview|meetings|actions|docs|team)$/.test(h) ? h : 'overview'; };
  window.addEventListener('hashchange', function () { if (S.edit) endEdit(true); closeSheet(); draw(); window.scrollTo(0, 0); });

  function draw() {
    if (!S.me || !S.me.member) return;
    S.stale = false;
    var h = location.hash.slice(1), body;
    if (S.edit) body = viewEdit();
    else if (/^m=/.test(h)) body = viewMeeting(h.slice(2));
    else body = ({ overview: viewOverview, meetings: viewMeetings, actions: viewActions, docs: viewDocs, team: viewTeam })[S.tab()]();
    var tab = S.tab(), reqs = rank() >= 3 ? S.requests.length : 0;
    $app.innerHTML = body + '<nav class="t-tabs t-noprint" aria-label="' + L('Team', 'Team') + '">' + [['overview', 'home', L('Overview', 'Oversikt')], ['meetings', 'cal', L('Meetings', 'Møter')], ['actions', 'check', L('Actions', 'Oppgaver')], ['docs', 'docs', L('Documents', 'Dokumenter')], ['team', 'team', L('Team', 'Team')]].map(function (t) {
      return '<button type="button" data-go="' + t[0] + '" aria-current="' + (tab === t[0]) + '">' + ic(t[1]) + '<span>' + t[2] + (t[0] === 'team' && reqs ? ' <span class="t-badge">' + reqs + '</span>' : '') + '</span></button>';
    }).join('') + '</nav>';
    if (tab === 'docs' && !S.edit) docsReady();
  }
  function head(title, sub, back) {
    return '<div class="t-top t-noprint">' + (back ? '<a class="t-back" href="#' + back[0] + '">' + ic('back') + esc(back[1]) + '</a>' : (S.me.isOwner ? '<a class="t-back" href="https://jplundberg.com/cmd/work/">' + ic('back') + '/cmd</a>' : '<small>work.jplundberg.com</small>')) +
      '<span class="t-topr">' + (S.teams.length > 1 || S.me.isOwner ? '<button class="t-icon" type="button" data-act="teams" aria-label="' + L('Your teams', 'Teamene dine') + '">' + ic('swap') + '</button>' : '') + '<button class="t-icon" type="button" data-act="settings" aria-label="' + L('Settings', 'Innstillinger') + '">' + ic('gear') + '</button></span></div>' +
      '<div class="t-title"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  }

  function viewOverview() {
    var t = today(), ms = meetings();
    var next = ms.filter(function (m) { return m.d.date >= t; }).sort(function (a, b) { return (a.d.date + a.d.from).localeCompare(b.d.date + b.d.from); })[0] || ms[0];
    var mine = actions().filter(function (a) { return !a.d.done && a.d.owner === S.me.email; }).sort(byDue);
    var out = head(S.me.team.name, nMembers(S.members.length) + L(' · your role: ', ' · din rolle: ') + roleName(S.me.member.role));
    if (rank() >= 3 && S.requests.length) out += '<a class="t-card acc t-link" href="#team"><h2>' + L(S.requests.length + ' waiting to join', S.requests.length + ' venter på å bli med') + '</h2><span class="t-small">' + L('Check their code and approve them under Team.', 'Sjekk koden deres og godkjenn dem under Team.') + '</span></a>';
    out += '<p class="t-h">' + (next && next.d.date >= t ? L('Next meeting', 'Neste møte') : L('Latest meeting', 'Siste møte')) + '</p>';
    out += next ? meetingCard(next) : '<div class="t-card"><p class="t-empty">' + L('No meetings yet.', 'Ingen møter ennå.') + '</p>' + (rank() >= 1 ? '<button class="t-btn sm" type="button" data-act="newMeeting">' + ic('plus') + L('New meeting', 'Nytt møte') + '</button>' : '') + '</div>';
    out += '<p class="t-h"><span>' + L('My open actions', 'Mine åpne oppgaver') + '</span><span>' + mine.length + '</span></p>';
    out += mine.length ? actionList(mine) : '<p class="t-empty">' + L('Nothing open for you.', 'Ingenting åpent for deg.') + '</p>';
    return out;
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
        (a.d.due ? ' · <span class="' + (late ? 't-warn' : '') + '">' + esc((late ? L('Overdue · ', 'Forfalt · ') : L('Due ', 'Frist ')) + fmtDate(a.d.due)) + '</span>' : '') + (showMeeting && m ? ' · ' + esc(m.title) : '') + '</small></span></button></li>';
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
  function actionSheet(id, meeting) {
    var a = id ? S.recs[id].d : { text: '', owner: S.me.email, due: '', done: false, meeting: meeting || '' };
    var ms = meetings();
    openSheet('<h2>' + (id ? L('Action', 'Oppgave') : L('New action', 'Ny oppgave')) + '</h2><form class="t-form" data-form="action" data-id="' + (id || '') + '">' +
      '<label class="t-lbl">' + L('What needs doing', 'Hva skal gjøres') + '<input name="text" required maxlength="300" value="' + esc(a.text) + '"></label>' +
      '<label class="t-lbl">' + L('Who', 'Hvem') + '<select name="owner"><option value="">—</option>' + S.members.map(function (m) { return '<option value="' + esc(m.email) + '"' + (a.owner === m.email ? ' selected' : '') + '>' + esc(nameOf(m.email)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="t-lbl">' + L('Due', 'Frist') + '<input name="due" type="date" value="' + esc(a.due) + '"></label>' +
      '<label class="t-lbl">' + L('From the meeting', 'Fra møtet') + '<select name="meeting"><option value="">—</option>' + ms.map(function (m) { return '<option value="' + m.id + '"' + (a.meeting === m.id ? ' selected' : '') + '>' + esc(m.d.title + ' · ' + fmtDate(m.d.date)) + '</option>'; }).join('') + '</select></label>' +
      '<p class="t-err"></p><div class="t-btns"><button class="t-btn ghost" type="button" data-act="close">' + L('Cancel', 'Avbryt') + '</button><button class="t-btn" type="submit">' + L('Save', 'Lagre') + '</button></div>' +
      (id ? '<button class="t-btn danger wide" type="button" data-act="delAction" data-id="' + id + '">' + L('Delete', 'Slett') + '</button>' : '') + '</form>');
  }
  async function onAction(f) {
    var id = f.dataset.id || rid(), cur = S.recs[id] && S.recs[id].d;
    var d = Object.assign({}, cur || { done: false }, { text: f.text.value.trim(), owner: f.owner.value, due: f.due.value, meeting: f.meeting.value });
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
    var out = head(L('Team', 'Team'), (S.me.team.name !== 'Team' ? S.me.team.name + ' · ' : '') + nMembers(S.members.length));
    if (adm) out += '<button class="t-btn wide" type="button" data-act="invite">' + ic('plus') + L('Invite someone', 'Inviter noen') + '</button><p class="t-small">' + L('One link per person. It works once and runs out.', 'Én lenke per person. Den virker én gang og går ut.') + '</p>';
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
    out += '<p class="t-h"><span>' + L('Change log', 'Endringslogg') + '</span><button class="t-btn ghost sm" type="button" data-act="log">' + L('Show', 'Vis') + '</button></p>' + (S.logOpen ? logHtml() : '');
    return out;
  }
  async function fillCodes() { for (var i = 0; i < S.requests.length; i++) { var q = S.requests[i], el = document.querySelector('[data-code="' + CSS.escape(q.email) + '"]'); if (el) el.textContent = await checkCode(q.pub); } }
  function logHtml() {
    if (!S.log.length) return '<p class="t-empty">' + L('Nothing yet.', 'Ingenting ennå.') + '</p>';
    var A = { setup: L('set up the team', 'satte opp teamet'), invite: L('made an invite', 'lagde en invitasjon'), request: L('asked to join', 'ba om å bli med'), approve: L('approved', 'godkjente'), decline: L('declined', 'avslo'), role: L('changed the role of', 'endret rollen til'), remove: L('removed', 'fjernet'), new: L('added', 'la til'), edit: L('changed', 'endret'), del: L('deleted', 'slettet'), restore: L('brought back', 'hentet tilbake') };
    return '<ul class="t-list t-log">' + S.log.map(function (l) {
      var what = l.sum || (l.k ? ({ meeting: L('a meeting', 'et møte'), action: L('an action', 'en oppgave') })[l.k] || '' : '');
      var who = l.who ? ' ' + (l.who === S.me.email ? nameOf(l.who) : l.name || nameOf(l.who)) + (l.role ? ' (' + roleName(l.role) + ')' : '') : (l.a === 'role' || l.a === 'invite') && l.role ? ' (' + roleName(l.role) + ')' : '';
      return '<li><span class="grow"><span>' + esc(nameOf(l.by) + ' ' + (A[l.a] || l.a) + who + (what ? ' – ' + what : '')) + '</span><small>' + esc(fmtTime(l.t)) + '</small></span></li>';
    }).join('') + '</ul><p class="t-small">' + L('Nobody can change or remove a line in the log.', 'Ingen kan endre eller fjerne en linje i loggen.') + '</p>';
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
    if (!confirm(L('Remove ' + m.name + '? They lose access at once, and the team gets a new key.', 'Fjerne ' + m.name + '? De mister tilgangen med en gang, og teamet får en ny nøkkel.'))) return;
    btn.disabled = true;
    try {
      var next = S.me.team.epoch + 1, nk = await C.generateKey(AES, true, ['encrypt', 'decrypt']), keys = {};
      for (var i = 0; i < S.members.length; i++) if (S.members[i].email !== email) keys[S.members[i].email] = await wrapFor(S.members[i].pub, nk, next);
      await api('remove', { method: 'POST', body: { email: email, rotate: { epoch: next, keys: keys } } });
      await kset('tk:' + next, nk); S.keys[next] = nk; S.me = await api('me'); await loadKeys();
      closeSheet(); await loadMembers(); draw(); toast(L(m.name + ' was removed', m.name + ' ble fjernet'));
    } catch (e) { btn.disabled = false; setErr(e.status === 409 ? L('The owner cannot be removed, and the team needs an admin.', 'Eieren kan ikke fjernes, og teamet trenger en admin.') : failMsg(e)); }
  }

  function settingsSheet() {
    openSheet('<h2>' + L('Settings', 'Innstillinger') + '</h2><p class="t-small">' + L('Signed in as ', 'Logget inn som ') + esc(S.me.email) + ' · ' + roleName(S.me.member.role) + '</p>' +
      '<label class="t-lbl">' + L('Language', 'Språk') + '<select data-lang><option value="en"' + (nb ? '' : ' selected') + '>English</option><option value="nb"' + (nb ? ' selected' : '') + '>Norsk</option></select></label>' +
      '<button class="t-btn ghost wide" type="button" data-act="changePass">' + L('Change my passcode', 'Bytt koden min') + '</button>' +
      '<button class="t-btn ghost wide" type="button" data-act="forget">' + L('Forget Team on this device', 'Glem Team på denne enheten') + '</button>' +
      '<a class="t-btn ghost wide" href="/cdn-cgi/access/logout">' + L('Sign out', 'Logg ut') + '</a>' +
      '<p class="t-small">' + L('What you write here is encrypted on your device before it is saved. The server only sees names, emails, roles and times.', 'Det du skriver her, krypteres på enheten din før det lagres. Serveren ser bare navn, e-post, roller og tidspunkter.') + '</p>' +
      '<button class="t-btn wide" type="button" data-act="close">' + L('Done', 'Ferdig') + '</button>');
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
    if (/^#dr=/.test(location.hash)) S.dtab = 'req'; else if (/^#dc=/.test(location.hash)) S.dtab = 'doc';
    var out = '<div class="t-dhead">' + head(L('Documents', 'Dokumenter'), L('Document control and document requirements – the same tools as in /cmd.', 'Dokumentkontroll og dokumentkrav – de samme verktøyene som i /cmd.'));
    out += '<div class="t-pick t-noprint" role="group">' + [['doc', L('Document control', 'Dokumentkontroll')], ['req', L('Document requirements', 'Dokumentkrav')]].map(function (o) { return '<label><input type="radio" name="dtab" data-dtab="' + o[0] + '"' + (S.dtab === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div><p></p>';
    if (rank() >= 1) out += '<label class="t-btn ghost wide t-noprint" id="dcImport">' + L('Import from /cmd', 'Importer fra /cmd') + '<input type="file" accept=".json,application/json" data-dcimport hidden></label><p class="t-small t-noprint">' + L('In /cmd: Work → Document control or Document requirements → open it → Send to Team. Attached files stay on the device they were added on.', 'I /cmd: Jobb → Dokumentkontroll eller Dokumentkrav → åpne den → Send til Team. Vedlagte filer blir på enheten de ble lagt til på.') + '</p>';
    out += '</div>';
    out += '<div class="dc-host"><section class="card kit-card kit-wide dc-card" id="wkDocCtl"' + (S.dtab === 'doc' ? '' : ' hidden') + '><p class="t-empty">' + L('Loading …', 'Laster …') + '</p></section>' +
      '<section class="card kit-card kit-wide dc-card" id="wkDocReq"' + (S.dtab === 'req' ? '' : ' hidden') + '></section></div>';
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
      window.PageTabs = { show: function (t) { S.dtab = t === 'req' ? 'req' : 'doc'; showDtab(); } };
      window.DocHost = { Fe: DFe, LP: { nsName: nsName, ownMap: function () { return {}; } }, profile: function () { return { name: S.me.member.name, employer: S.me.team.name }; }, team: true };
      docsP = loadJs('/dc/ns.js').then(function () { return loadJs('/dc/words.js'); }).then(function () { return loadJs('/dc/paged-pdf.js'); }).then(function () {
        window.FdvPdf = { html: function (h, f, n) { return window.PagedPdf.html(h, f, n); }, share: function (f) { return window.PagedPdf.share(f); } };
        return loadJs('/dc/doc-control.js');
      }).catch(function (e) { docsP = null; toast(L('Could not load Documents. Try again.', 'Klarte ikke å laste Dokumenter. Prøv igjen.')); throw e; });
    }
    docsP.then(function () { window.dispatchEvent(new Event('tools:change')); }, function () {});
  }
  function showDtab() {
    var a = document.getElementById('wkDocCtl'), b = document.getElementById('wkDocReq'); if (a) a.hidden = S.dtab !== 'doc'; if (b) b.hidden = S.dtab !== 'req';
    [].forEach.call(document.querySelectorAll('[data-dtab]'), function (x) { x.checked = x.dataset.dtab === S.dtab; });
  }
  var NSM = null;
  function nsName(code) {
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
      else if (r.k === 'dcr' && r.d.r) t.dcreq = clone(r.d.r);
    }
    heads.forEach(function (h) {
      if (h.key !== 'dctl' && h.key !== 'dckrav') return;
      var p = clone(h.p); p.lines = (lines[h.key + '|' + p.id] || []).sort(function (a, b) { return a.o - b.o; }).map(function (x) { return clone(x.l); });
      t[h.key].push(p);
    });
    return t;
  }
  var DFe = {
    tools: function () { S.docBase = {}; return docState(S.docBase); },
    list: function (k) { if (S.docCache && S.docCache.gen === S.docGen) return S.docCache.t[k] || []; var t = docState(); S.docCache = { gen: S.docGen, t: t }; return Array.isArray(t[k]) ? t[k] : []; },   /* read-only callers: cached until a document record changes */
    saveTools: function (t) { saveDocs(t, S.docBase, true); }
  };
  function wanted(t) {
    var want = {};
    ['dctl', 'dckrav'].forEach(function (key) {
      (t[key] || []).forEach(function (p) {
        if (!p || !p.id) return;
        var h = clone(p), ls = h.lines || []; delete h.lines;
        want[drid('p', key, p.id)] = { k: 'dcp', d: { key: key, p: h } };
        ls.forEach(function (l, i) { if (l && l.id) want[drid('l', key, p.id, l.id)] = { k: 'dcl', d: { key: key, pid: p.id, l: l, o: i } }; });
      });
    });
    (t.dctypes || []).forEach(function (ty) { if (ty && ty.id) want[drid('t', ty.id)] = { k: 'dct', d: { t: ty } }; });
    if (t.dcreq) want[drid('r', 'checklist')] = { k: 'dcr', d: { r: t.dcreq } };
    return want;
  }
  /* save what changed: new and changed records, and deletes only of what was there when Document control read it */
  async function saveDocs(t, base, first) {
    if (rank() < 1) { toast(L('Your role can only read.', 'Rollen din kan bare lese.')); window.dispatchEvent(new Event('tools:change')); return; }
    var want = wanted(t), ops = [], names = {}, blocked = 0;
    for (var id in want) {
      var cur = S.recs[id], w = want[id];
      if (cur && !cur.del && cur.d && JSON.stringify(cur.d) === JSON.stringify(w.d)) continue;
      /* approving a document is for Can approve and Admin */
      if (w.k === 'dcl' && w.d.l.st === 'ok' && rank() < 2 && !(cur && cur.d && cur.d.l && cur.d.l.st === 'ok')) { if (cur && cur.d) w.d.l.st = cur.d.l.st; else w.d.l.st = 'recv'; blocked++; if (cur && cur.d && JSON.stringify(cur.d) === JSON.stringify(w.d)) continue; }
      ops.push({ id: id, k: w.k, d: w.d });
      var pn = w.k === 'dcp' ? w.d.p.name : w.k === 'dcl' ? (want[drid('p', w.d.key, w.d.pid)] || { d: { p: {} } }).d.p.name : ''; if (pn) names[pn] = 1;
    }
    for (var rid2 in base) if (!want[rid2] && S.recs[rid2] && !S.recs[rid2].del) ops.push({ id: rid2, k: S.recs[rid2].k, del: true });
    if (blocked) toast(L('Only people who can approve can mark a document Approved.', 'Bare de som kan godkjenne, kan merke et dokument Godkjent.'));
    if (!ops.length) { if (blocked) window.dispatchEvent(new Event('tools:change')); return; }
    /* show it at once; the server's answer follows */
    S.docGen++;
    ops.forEach(function (o) { var cur = S.recs[o.id]; if (o.del) { if (cur) cur.del = 1; } else S.recs[o.id] = Object.assign({}, cur || { id: o.id, k: o.k, v: 0 }, { d: o.d, del: 0, locked: false }); });
    window.dispatchEvent(new Event('tools:change'));
    var e = S.me.team.epoch, failed = 0;
    var sum = Object.keys(names).length ? Object.assign({ e: e }, await seal({ t: L('Documents: ', 'Dokumenter: ') + Object.keys(names).join(', ').slice(0, 160) }, 'log', e)) : undefined;
    for (var i = 0; i < ops.length; i += 400) {
      var part = ops.slice(i, i + 400), recs = [];
      for (var j = 0; j < part.length; j++) {
        var o = part[j], v = S.recs[o.id] ? S.recs[o.id].v || 0 : 0;
        if (o.del) recs.push({ id: o.id, k: o.k, del: true, v: v });
        else { var sl = await seal(o.d, o.id + '|' + o.k + '|' + e, e); recs.push({ id: o.id, k: o.k, e: e, iv: sl.iv, ct: sl.ct, v: v }); }
      }
      try {
        var res = await api('batch', { method: 'PUT', body: { recs: recs, s: i ? undefined : sum } });
        res.results.forEach(function (x) { var r = S.recs[x.id]; if (x.error) { failed++; return; } if (r) { r.v = x.v; r.t = x.t; r.by = S.me.email; r.e = e; } });
      } catch (err) { toast(failMsg(err)); failed += part.length; if (err.status === 403) break; }
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
  function importDoc(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var j = null; try { j = JSON.parse(fr.result); } catch (x) {}
      if (!j || (j.team !== 'dctl' && j.team !== 'dckrav') || !j.p || typeof j.p.name !== 'string' || !Array.isArray(j.p.lines)) { toast(L('That is not a project file from /cmd.', 'Det er ikke en prosjektfil fra /cmd.')); return; }
      var key = j.team;   /* dctl = a Document control project, dckrav = a Document requirements list */
      var p = j.p, nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      p.id = nid; p.files = []; p.made = p.made || new Date().toISOString(); p.name = String(p.name).slice(0, 120);
      p.lines = p.lines.filter(function (l) { return l && typeof l === 'object'; }).slice(0, 3000).map(function (l) { l.files = []; l.id = l.id ? String(l.id).slice(0, 40) : nid + Math.random().toString(36).slice(2, 6); return l; });
      var t = DFe.tools(); t[key].push(p); saveDocs(t, S.docBase, true).then(function () {
        toast(L('Imported: ', 'Importert: ') + p.name);
        S.dtab = key === 'dckrav' ? 'req' : 'doc'; location.hash = (key === 'dckrav' ? '#dr=' : '#dc=') + nid;
      });
    };
    fr.readAsText(file);
  }

  /* ---------- sheets ---------- */
  function openSheet(html) {
    closeSheet(true);
    var bg = document.createElement('div'); bg.className = 't-sheetbg'; bg.innerHTML = '<div class="t-sheet" role="dialog" aria-modal="true">' + html + '</div>';
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
    if (a === 'teams') return teamsSheet();
    if (a === 'goTeam') { if (t.dataset.id === S.tid && S.me.member && document.querySelector('.t-tabs')) closeSheet(); else goTeam(t.dataset.id); return; }   /* from the New team form the open team is not on screen: go to it (JP 21:31) */
    if (a === 'newTeam') { location.href = '/?new=1'; return; }
    if (a === 'newMeeting') return startEdit(rid(), true);
    if (a === 'edit') return startEdit(t.dataset.id);
    if (a === 'cancelEdit') { var wasNew = S.edit && S.edit.isNew; endEdit(); if (wasNew) location.hash = '#meetings'; return; }
    if (a === 'delMeeting') { if (!confirm(L('Delete this meeting? It stays in the history.', 'Slette dette møtet? Det blir liggende i historikken.'))) return; var mid = S.edit.id, ttl = S.recs[mid] && S.recs[mid].d ? S.recs[mid].d.title : ''; if (await delRec(mid, L('Meeting: ', 'Møte: ') + ttl)) { endEdit(true); location.hash = '#meetings'; draw(); } return; }
    if (a === 'print') return window.print();
    if (a === 'newAction') return actionSheet(null, t.dataset.meeting);
    if (a === 'editAction') return actionSheet(t.dataset.id);
    if (a === 'delAction') { var ad = S.recs[t.dataset.id]; if (await delRec(t.dataset.id, L('Action: ', 'Oppgave: ') + (ad && ad.d ? ad.d.text : ''))) { closeSheet(); draw(); } return; }
    if (a === 'invite') return inviteSheet();
    if (a === 'shareInvite') { var v = document.getElementById('invLink').value; navigator.share({ title: S.me.team.name, text: L('Join our team', 'Bli med i teamet vårt'), url: v }).catch(function () {}); return; }
    if (a === 'copyInvite') { var inp = document.getElementById('invLink'); inp.select(); (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () { document.execCommand('copy'); toast(L('Copied', 'Kopiert')); }); return; }
    if (a === 'cancelInvite') { try { await api('invites?id=' + t.dataset.id, { method: 'DELETE' }); await loadMembers(); draw(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'approve') return approve(t.dataset.email, t);
    if (a === 'decline') { if (!confirm(L('Decline this request?', 'Avslå denne forespørselen?'))) return; try { await api('decline', { method: 'POST', body: { email: t.dataset.email } }); await loadMembers(); draw(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'member') return memberSheet(t.dataset.email);
    if (a === 'remove') return removeMember(t.dataset.email, t);
    if (a === 'log') { S.logOpen = !S.logOpen; if (S.logOpen) { try { await loadLog(); } catch (x) { toast(failMsg(x)); } } draw(); return; }
    if (a === 'withdraw') { try { await api('join', { method: 'DELETE' }); await kclear(); S.me = await api('me'); stopPoll(); route(); } catch (x) { toast(failMsg(x)); } return; }
    if (a === 'changePass') return passSheet();
    if (a === 'forget') { if (!confirm(L('Forget Team on this device? You need your passcode to open it here again.', 'Glemme Team på denne enheten? Du trenger koden for å åpne den her igjen.'))) return; await kclear(); S.keys = {}; closeSheet(true); stopPoll(); route(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.tick) return tick(t.dataset.tick, t.checked);
    if (t.hasAttribute('data-dcimport')) { if (t.files && t.files[0]) importDoc(t.files[0]); t.value = ''; return; }
    if (t.hasAttribute('data-lang')) { try { localStorage.setItem('team.lang', t.value); } catch (x) {} location.reload(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    ({ setup: onSetup, join: onJoin, unlock: onUnlock, meeting: onMeeting, action: onAction, invite: onInvite, role: onRole, pass: onPass })[f.dataset.form](f);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) closeSheet(); });

  boot();
})();
