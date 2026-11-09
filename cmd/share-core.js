/* Shared space – the encryption both sides use (your dashboard and the shared app at /cmd/home/).
   · One random AES-256 key for the shared box. You keep it inside your own encrypted vault; the person you share
     with gets it once from the QR code, and locks it with their own passcode (PBKDF2) – only that locked copy is
     stored on the server.
   · Every record ({ c: kind, id, f: fields }) is encrypted on the phone; the server only ever sees random ids,
     times and ciphertext, and keeps the newest change per record. */
(function () {
  "use strict";
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  var keys = {};
  function genKey() { return b64(crypto.getRandomValues(new Uint8Array(32))); }
  function importKey(k) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(k || ''))) return Promise.reject(new Error('bad key'));
    if (!keys[k]) keys[k] = crypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return keys[k];
  }
  function encrypt(k, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return importKey(k).then(function (key) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(obj))); })
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function decrypt(k, rec) {
    return importKey(k).then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.ct)); })
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }
  /* the server id of a record: a hash of the key, kind and id – nothing readable */
  /* files: the same key, bytes in and out */
  function encryptBytes(k, buf) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return importKey(k).then(function (key) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, buf); })
      .then(function (ct) { var out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12); return out; });
  }
  function decryptBytes(k, buf) {
    var a = new Uint8Array(buf);
    return importKey(k).then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: a.slice(0, 12) }, key, a.slice(12)); });
  }
  function rid(k, c, id) {
    return crypto.subtle.digest('SHA-256', enc.encode(k + '|' + c + '|' + id)).then(function (h) { return Array.prototype.map.call(new Uint8Array(h).slice(0, 12), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  function hash(o) { var s = JSON.stringify(o), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }
  /* the shared key locked with a passcode, for the person you share with */
  function passKey(pass, salt) {
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); });
  }
  function wrap(pass, k) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return passKey(pass, salt).then(function (pk) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, pk, enc.encode(k)); })
      .then(function (ct) { return { salt: b64(salt), iv: b64(iv), ct: b64(ct) }; });
  }
  function unwrap(pass, w) {
    return passKey(pass, unb64(w.salt)).then(function (pk) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, pk, unb64(w.ct)); })
      .then(function (pt) { return dec.decode(pt); });
  }
  function api(path, opt) {
    opt = opt || {};
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch('/cmd/api/' + path, { method: opt.method || 'GET', headers: opt.body ? { 'content-type': 'application/json' } : {}, body: opt.body ? JSON.stringify(opt.body) : undefined, credentials: 'same-origin', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(tm); return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; e.body = j; throw e; } return j; }); },
        function (e) { clearTimeout(tm); throw e; });
  }
  /* what may ever be shared – kind → the fields it may carry. Anything else is dropped before it is encrypted. */
  var ALLOW = {
    info: ['owner', 'partner', 'split', 'extra', 'what', 'mvdate', 'olook'],
    shop: ['text', 'done'],
    chore: ['name', 'every', 'day', 'who', 'start'],
    cdone: ['k', 'who', 'at'],
    clog: ['cid', 'name', 'who', 'at'],
    sx: ['date', 'note', 'total', 'payer', 'shares', 'cat'],
    pay: ['date', 'from', 'to', 'amount'],
    led: ['date', 'note', 'kind', 'payer', 'o', 'p', 'amount'],
    ev: ['title', 'date', 'end', 'allDay', 'start', 'stop', 'repeat', 'until', 'location'],
    plant: ['name', 'room', 'every', 'last'],
    mv: ['text', 'done'],
    meal: ['date', 'text'],
    pantry: ['name', 'state'],
    recipe: ['title', 'mins', 'serves', 'ingr', 'steps', 'link'],
    bill: ['name', 'day', 'amount', 'part', 'payer', 'next'],
    trip: ['name', 'dest', 'start', 'end', 'pack'],
    note: ['title', 'text'],
    proj: ['name', 'kind', 'room', 'status', 'budget', 'spent', 'start', 'end', 'tasks'],
    doc: ['name', 'cat', 'src', 'date', 'files'],
    pme: ['name', 'look', 'bday', 'phone']                       /* the other person's own name and avatar – only they write it */
  };
  /* an avatar look: short keys with short colour/word values, nothing else */
  function cleanLook(l) {
    if (!l || typeof l !== 'object') return null; var o = {}, n = 0;
    Object.keys(l).forEach(function (k) { if (n < 16 && /^[a-zA-Z]{1,10}$/.test(k) && typeof l[k] === 'string' && /^[#\w-]{1,20}$/.test(l[k])) { o[k] = l[k]; n++; } });
    return n ? o : null;
  }
  function cleanPack(p) { return (Array.isArray(p) ? p : []).slice(0, 150).map(function (x) { return { t: String((x && x.t) || '').slice(0, 80), done: !!(x && x.done) }; }).filter(function (x) { return x.t; }); }
  function clean(c, f) {
    var al = ALLOW[c]; if (!al || !f || typeof f !== 'object') return null;
    var o = {}; al.forEach(function (k) { if (f[k] !== undefined && f[k] !== null && f[k] !== '') o[k] = f[k]; });
    if (o.tasks) o.tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 200).map(function (x) { return { id: String((x && x.id) || '').slice(0, 40), t: String((x && x.t) || '').slice(0, 120), done: !!(x && x.done), due: /^\d{4}-\d{2}-\d{2}$/.test((x && x.due) || '') ? x.due : undefined }; }).filter(function (x) { return x.id && x.t; });
    if (o.files) o.files = (Array.isArray(o.files) ? o.files : []).slice(0, 20).map(function (x) { return { fid: String((x && x.fid) || ''), name: String((x && x.name) || 'file').slice(0, 120), type: String((x && x.type) || '').slice(0, 60), size: +(x && x.size) || 0 }; }).filter(function (x) { return /^[a-f0-9]{16,64}$/.test(x.fid); });
    if (o.look) o.look = cleanLook(o.look) || undefined; if (o.olook) o.olook = cleanLook(o.olook) || undefined; if (o.pack) o.pack = cleanPack(o.pack);
    Object.keys(o).forEach(function (k) { if (o[k] === undefined) delete o[k]; });
    return o;
  }
  window.ShareCore = { encryptBytes: encryptBytes, decryptBytes: decryptBytes, genKey: genKey, importKey: importKey, encrypt: encrypt, decrypt: decrypt, rid: rid, hash: hash, wrap: wrap, unwrap: unwrap, api: api, ALLOW: ALLOW, clean: clean, cleanLook: cleanLook, b64: b64, unb64: unb64 };
})();
