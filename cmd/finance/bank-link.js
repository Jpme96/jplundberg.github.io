/* Bank connection (2026-11-20, JP: "the bank thing"): transactions and balances straight from the bank through
   Enable Banking (a licensed account-information service) – read-only, no payments.
   - The app's key (the .pem file from Enable Banking) is kept in the encrypted vault (d.bank.key); each call is
     signed here in the browser. cmd's server only passes the calls on (/cmd/api/bank – the bank's API can't be
     called from a web page) and keeps nothing.
   - Connect a bank → BankID at the bank → back on Finances (?code=…) → the session and its accounts are saved;
     each account is matched to one of your accounts in cmd.
   - Fetch: new booked transactions per account go through the import preview (import.js), one account after the
     other, so the same rules apply (duplicates, transfers, card payments, the balance from the bank).
   - When you open Finances (at most every six hours) it looks quietly and shows "N new from the bank".
   - A connection lasts up to 180 days (the bank decides); At a glance says when one is about to end.
   d.bank = { app, key, links: [{ sid, aspsp, until, accts: [{ uid, name, last4, cur, acct, from }] }] } */
(function () {
  'use strict';
  if (!window.Vault || !window.crypto || !crypto.subtle) return;
  var K = function (n, e, o) { return window.I18N && I18N.k ? I18N.k(n, e, o) : e.replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(t) { var x = new Date(t); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function toast(h) { if (window.Quick && Quick.toast) Quick.toast(h); }
  function V() { return window.Vault.get() || {}; }
  function B() { return V().bank || null; }
  function saveBank(fn) { var d = V(); d.bank = d.bank || { links: [] }; d.bank.links = d.bank.links || []; fn(d.bank, d); window.Vault.save(d); }
  var MINE = ['SpareBank 1 Østlandet', 'DNB', 'Bank Norwegian'];     /* the banks JP named – first in the list */
  var BACK = location.origin + '/cmd/finance/';

  /* ---------- signing: a short JWT with the app's key (RS256), made fresh for each call ---------- */
  var ck = null, ckFor = '';
  function der(pem) {
    var b = atob(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    if (!/BEGIN RSA PRIVATE KEY/.test(pem)) return u;
    /* an older "RSA PRIVATE KEY" (PKCS#1) is wrapped as PKCS#8 for WebCrypto */
    function len(n) { return n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; }
    var alg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
    var oct = [0x04].concat(len(u.length)), body = [0x02, 0x01, 0x00].concat(alg, oct), total = body.length + u.length;
    var head = [0x30].concat(len(total)), out = new Uint8Array(head.length + total);
    out.set(head, 0); out.set(body, head.length); out.set(u, head.length + body.length); return out;
  }
  function b64u(x) {
    var bin = typeof x === 'string' ? unescape(encodeURIComponent(x)) : Array.prototype.map.call(new Uint8Array(x), function (c) { return String.fromCharCode(c); }).join('');
    return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function key() {
    var b = B(); if (!b || !b.key || !b.app) return Promise.reject(new Error(K('ui.bk-no-key', 'Load the key file first')));
    if (ck && ckFor === b.key) return Promise.resolve(ck);
    return crypto.subtle.importKey('pkcs8', der(b.key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']).then(function (k) { ck = k; ckFor = b.key; return k; });
  }
  function jwt() {
    return key().then(function (k) {
      var now = Math.floor(Date.now() / 1000), b = B();
      var h = b64u(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: b.app })), p = b64u(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }));
      return crypto.subtle.sign('RSASSA-PKCS1-v1_5', k, new TextEncoder().encode(h + '.' + p)).then(function (sig) { return h + '.' + p + '.' + b64u(sig); });
    });
  }
  function api(method, p, body) {
    return jwt().then(function (t) {
      return fetch('/cmd/api/bank?p=' + encodeURIComponent(p), { method: method, credentials: 'same-origin', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && (j.message || j.error || j.detail)) || ('HTTP ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
        return j;
      });
    });
  }

  /* ---------- the sheet (the import sheet's box, import.js) ---------- */
  function sheet(html) { if (window.BankImport && BankImport.open) BankImport.open(html); }
  function accts() { return window.Accts ? Accts.list(V()) : []; }
  function guess(bankName, a) {
    /* which of your cmd accounts a bank account is: a credit card bank → the credit card with that name; otherwise by name */
    var L = accts(), n = (a.name || '').toLowerCase(), bn = bankName.toLowerCase();
    var byName = L.filter(function (x) { var l = (x.label || '').toLowerCase(); return l && (n.indexOf(l) > -1 || l.indexOf(n) > -1 || (bn.indexOf('norwegian') > -1 && /norwegian/.test(l))); })[0];
    if (byName) return byName.id;
    if (/norwegian/i.test(bankName)) { var cr = L.filter(function (x) { return x.kind === 'credit'; })[0]; if (cr) return cr.id; }
    return null;
  }
  /* a bank account that has no match in cmd yet (JP 2026-11-20: "I need more, like Brukskonto") becomes a new cmd
     account: its own name from the bank (with its last four digits when that name is taken) and a type from the name */
  function newName(bank, a) {
    var n = String(a.name || K('ui.bk-account', 'Account')).trim(), taken = accts().some(function (x) { return (x.label || '').toLowerCase() === n.toLowerCase(); });
    return taken ? n + (a.last4 ? ' ••' + a.last4 : ' (' + bank + ')') : n;   /* SpareBank 1 calls five accounts BRUKSKONTO */
  }
  function newKind(bank, a) {
    var n = (a.name || '').toLowerCase();
    if (/norwegian|kreditt|credit|visa|mastercard|kort/.test(n) || /norwegian/i.test(bank)) return 'credit';
    if (/fond|aksje|ask\b/.test(n)) return 'fund';
    if (/spar|bsu|høyrente|hoyrente|buffer|saving/.test(n)) return 'savings';
    return 'card';
  }
  function addAcct(bank, a) {
    var id = 'bk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var d = V(); d.budget = d.budget || {}; d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
    d.budget.acctList.push({ id: id, name: newName(bank, a), kind: newKind(bank, a) });
    window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
    return id;
  }
  function untilTxt(u) { if (!u) return ''; var days = Math.round((new Date(u) - Date.now()) / 864e5); return days < 0 ? K('ui.bk-ended', 'ended – connect again') : K('ui.bk-until', 'until {d} ({n} days)', { d: new Date(u).toLocaleDateString(I18N && I18N.lang === 'nb' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }), n: days }); }
  /* the banks send the account holder's name as "name" (JP's accounts all said "John Paul Lundberg"): ask each account
     once for its product name ("Brukskonto", "Sparekonto") and use that, the holder's name in small type */
  var naming = false;
  function nameAccts() {
    if (naming) return; var todo = [];
    ((B() || {}).links || []).forEach(function (l) { (l.accts || []).forEach(function (a) { if ((!a.named || (a.holder && a.name === a.holder)) && a.uid) todo.push(a.uid); }); });
    if (!todo.length) return; naming = true;
    Promise.all(todo.map(function (uid) { return api('GET', '/accounts/' + uid + '/details').then(function (j) { return { uid: uid, j: j }; }, function () { return { uid: uid, j: null }; }); })).then(function (res) {
      saveBank(function (b) { b.links.forEach(function (l) { (l.accts || []).forEach(function (a) {
        var r = res.filter(function (x) { return x.uid === a.uid; })[0]; if (!r || !r.j) return;   /* failed: tried again next time */
        var p = r.j && (r.j.product || r.j.details || (r.j.cash_account_type && { CACC: 'Brukskonto', SVGS: 'Sparekonto', CARD: 'Kortkonto', LOAN: 'Lån' }[r.j.cash_account_type]));
        if (!a.holder) a.holder = a.name;
        if (p) a.name = p;
        a.named = true;
      }); }); });
      naming = false;
      if (document.querySelector('[data-bkmap]')) setup();
    });
  }
  var aspspList = null;
  function setup(msg) {
    setTimeout(nameAccts, 0);
    var b = B() || { links: [] }, L = accts(), links = b.links || [];
    var keyPart = b.key && b.app
      ? '<p class="bk-ok"><i class="bi bi-key"></i> ' + esc(K('ui.bk-key-ok', 'Key loaded – locked in your vault')) + ' <small class="muted">· ' + esc('…' + String(b.app).slice(-6)) + '</small> <button type="button" class="text-btn" data-bkkey>' + esc(K('ui.bk-replace', 'Replace')) + '</button></p>'
      : '<div class="bk-step"><b>1. ' + esc(K('ui.bk-step1', 'Load the key file')) + '</b><p class="muted im-small">' + esc(K('ui.bk-step1-sub', 'The .pem file Enable Banking downloaded when the app was registered. It is kept in your encrypted vault and never sent anywhere.')) + '</p><button type="button" class="pill-btn" data-bkkey><i class="bi bi-file-earmark-lock"></i> ' + esc(K('ui.bk-choose', 'Choose the .pem file')) + '</button></div>';
    var linkPart = links.map(function (l, li) {
      return '<div class="bk-link"><div class="bk-lh"><b><i class="bi bi-bank"></i> ' + esc(l.aspsp) + '</b><small class="muted">' + esc(untilTxt(l.until)) + '</small><span class="spacer"></span>' +
        '<button type="button" class="text-btn" data-bkconnect="' + esc(l.aspsp) + '">' + esc(K('ui.bk-renew', 'Renew')) + '</button><button type="button" class="text-btn" data-bkdrop="' + li + '">' + esc(K('ui.remove', 'Remove')) + '</button></div>' +
        (l.accts || []).map(function (a, ai) {
          return '<label class="bk-acct"><span><b>' + esc(a.name || K('ui.bk-account', 'Account')) + '</b><small class="muted">' + esc((a.last4 ? '•• ' + a.last4 : '') + (a.holder && a.holder !== a.name ? ' · ' + a.holder : '') + (a.from ? ' · ' + K('ui.bk-fetched', 'fetched to {d}', { d: a.from }) : '')) + '</small></span>' +
            '<select data-bkmap="' + li + ':' + ai + '"><option value="">' + esc(K('ui.bk-skip', 'Don’t fetch')) + '</option>' + L.map(function (x) { return '<option value="' + esc(x.id) + '"' + (a.acct === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') +
            '<option value="+new">' + esc(K('ui.bk-new-acct', '+ New account: {n}', { n: newName(l.aspsp, a) })) + '</option></select></label>';
        }).join('') + '</div>';
    }).join('');
    var names = (aspspList || MINE.map(function (n) { return { name: n }; })).map(function (x) { return x.name; });
    names = MINE.filter(function (n) { return names.indexOf(n) > -1 || !aspspList; }).concat(names.filter(function (n) { return MINE.indexOf(n) < 0; }).sort());
    var addPart = b.key ? '<div class="bk-step"><b>' + esc(links.length ? K('ui.bk-another', 'Connect another bank') : '2. ' + K('ui.bk-step2', 'Connect a bank')) + '</b><div class="bk-add"><select data-bkpick>' + names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="pill-btn" data-bkconnect><i class="bi bi-shield-lock"></i> ' + esc(K('ui.bk-bankid', 'Connect with BankID')) + '</button></div><p class="muted im-small">' + esc(K('ui.bk-step2-sub', 'You sign in at your bank; cmd gets read access to the accounts for up to 180 days. It can never pay or move money.')) + '</p></div>' : '';
    var mapped = links.some(function (l) { return (l.accts || []).some(function (a) { return a.acct; }); });
    sheet('<h2 class="im-h"><i class="bi bi-bank"></i> ' + esc(K('ui.bk-title', 'Bank connection')) + '</h2>' + (msg ? '<p class="bk-msg">' + msg + '</p>' : '') + keyPart + linkPart + addPart +
      '<p class="muted im-small">' + esc(K('ui.bk-how', 'Read-only, through Enable Banking (licensed by the Finnish FSA). cmd’s server only passes the calls on and keeps nothing; the transactions are saved in your encrypted vault like everything else.')) + '</p>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-close>' + esc(K('ui.close', 'Close')) + '</button><span class="spacer"></span>' + (mapped ? '<button type="button" class="pill-btn wide" data-bkfetch><i class="bi bi-arrow-repeat"></i> ' + esc(K('ui.bk-fetch', 'Fetch new transactions')) + '</button>' : '') + '</div>');
    if (b.key && !aspspList) api('GET', '/aspsps?country=NO&psu_type=personal').then(function (j) { aspspList = (j.aspsps || []).filter(function (x) { return !x.psu_types || x.psu_types.indexOf('personal') > -1; }); var sel = document.querySelector('[data-bkpick]'); if (sel && !sel.dataset.touched) setup(msg); }).catch(function () {});
  }
  /* the line at the top of the import sheet */
  function block() {
    var b = B(), on = b && b.key && (b.links || []).some(function (l) { return (l.accts || []).some(function (a) { return a.acct; }); });
    return '<div class="bk-block"><span><b><i class="bi bi-lightning-charge"></i> ' + esc(K('ui.bk-straight', 'Straight from your bank')) + '</b><small class="muted">' + esc(on ? K('ui.bk-straight-on', 'Connected – fetch what’s new, no file needed') : K('ui.bk-straight-off', 'Connect once with BankID instead of exporting files')) + '</small></span>' +
      '<button type="button" class="pill-btn" ' + (on ? 'data-bkfetch' : 'data-bksetup') + '>' + esc(on ? K('ui.bk-fetch-short', 'Fetch') : K('ui.bk-setup', 'Set up')) + '</button>' + (on ? '<button type="button" class="text-btn" data-bksetup>' + esc(K('ui.bk-manage', 'Manage')) + '</button>' : '') + '</div>';
  }

  /* ---------- the key file ---------- */
  var kf = document.createElement('input'); kf.type = 'file'; kf.accept = '.pem,.key,.txt,application/x-pem-file'; kf.hidden = true; document.body.appendChild(kf);
  kf.addEventListener('change', function () {
    var f = kf.files && kf.files[0]; if (!f) return; kf.value = '';
    f.text().then(function (t) {
      if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(t)) throw new Error(K('ui.bk-not-key', 'That file isn’t a private key (.pem)'));
      var m = String(f.name).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      var go = function (app) {
        return crypto.subtle.importKey('pkcs8', der(t), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']).then(function () {
          saveBank(function (b) { b.key = t.trim(); b.app = app; }); ck = null;
          setup('<i class="bi bi-check-lg"></i> ' + esc(K('ui.bk-key-saved', 'Key saved in your vault. You can delete the file from Downloads now.')));
        });
      };
      if (m) return go(m[0].toLowerCase());
      return (window.Ask ? Ask.prompt(K('ui.bk-app-id', 'The application ID from Enable Banking (looks like 1a2b3c4d-…)'), '') : Promise.resolve(null)).then(function (v) {
        v = String(v || '').trim(); if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error(K('ui.bk-app-bad', 'That doesn’t look like an application ID'));
        return go(v.toLowerCase());
      });
    }).catch(function (e) { setup('<i class="bi bi-exclamation-triangle"></i> ' + esc(e.message)); });
  });

  /* ---------- connecting: BankID at the bank, then back here ---------- */
  function connect(name) {
    var a = (aspspList || []).filter(function (x) { return x.name === name; })[0], max = a && a.maximum_consent_validity ? a.maximum_consent_validity * 1000 : 180 * 864e5;
    var until = new Date(Date.now() + Math.min(max, 180 * 864e5) - 60e3).toISOString(), state = crypto.getRandomValues(new Uint32Array(4)).join('-');
    try { sessionStorage.setItem('bank.state', JSON.stringify({ state: state, name: name, at: Date.now() })); } catch (e) {}
    return api('POST', '/auth', { access: { valid_until: until }, aspsp: { name: name, country: 'NO' }, state: state, redirect_url: BACK, psu_type: 'personal' })
      .then(function (j) { if (!j.url) throw new Error('no address from the bank service'); location.href = j.url; })
      .catch(function (e) { setup('<i class="bi bi-exclamation-triangle"></i> ' + esc(K('ui.bk-connect-fail', 'Couldn’t start the bank login: {m}', { m: e.message }))); });
  }
  function back() {
    var q = new URLSearchParams(location.search), code = q.get('code'), st = q.get('state'), err = q.get('error');
    if (!code && !err) return;
    var mem = null; try { mem = JSON.parse(sessionStorage.getItem('bank.state') || 'null'); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.hash);
    if (!mem || mem.state !== st) return;                       /* not a login this browser started */
    sessionStorage.removeItem('bank.state');
    if (err) { setTimeout(function () { setup('<i class="bi bi-exclamation-triangle"></i> ' + esc(K('ui.bk-bank-said', 'The bank stopped the login: {m}', { m: q.get('error_description') || err }))); }, 400); return; }
    api('POST', '/sessions', { code: code }).then(function (s) {
      var name = (s.aspsp && s.aspsp.name) || mem.name;
      saveBank(function (b) {
        var old = b.links.filter(function (l) { return l.aspsp === name; })[0];
        if (old && old.sid && old.sid !== s.session_id) api('DELETE', '/sessions/' + old.sid).catch(function () {});
        var keep = {}; if (old) (old.accts || []).forEach(function (a) { keep[a.iban || a.last4 + '|' + a.name] = a; });
        var accs = (s.accounts || []).map(function (a) {
          var iban = (a.account_id && (a.account_id.iban || (a.account_id.other && a.account_id.other.identification))) || '', last4 = String(iban).replace(/\s/g, '').slice(-4);
          var was = keep[iban] || keep[last4 + '|' + (a.name || a.product || '')] || {};
          var x = { uid: a.uid, name: a.product || a.details || a.name || K('ui.bk-account', 'Account'), holder: a.name || '', named: !!(a.product || a.details), last4: last4, iban: iban, cur: a.currency || 'NOK', acct: was.acct || null, from: was.from || null };
          if (!x.acct) x.acct = guess(name, x);
          return x;
        });
        b.links = b.links.filter(function (l) { return l.aspsp !== name; }).concat([{ sid: s.session_id, aspsp: name, until: (s.access && s.access.valid_until) || null, accts: accs }]);
      });
      setTimeout(function () { setup('<i class="bi bi-check-lg"></i> ' + esc(K('ui.bk-connected', '{b} is connected. Check which of your accounts each one is, then fetch.', { b: name }))); }, 400);
    }).catch(function (e) { setTimeout(function () { setup('<i class="bi bi-exclamation-triangle"></i> ' + esc(K('ui.bk-session-fail', 'The bank login didn’t finish: {m}', { m: e.message }))); }, 400); });
  }

  /* ---------- fetching ---------- */
  function balanceOf(j) {
    var L = (j && j.balances) || [], pref = ['CLBD', 'ITBD', 'XPCD', 'ITAV', 'CLAV', 'OPBD'];
    var b = pref.map(function (t) { return L.filter(function (x) { return x.balance_type === t; })[0]; }).filter(Boolean)[0] || L[0];
    return b ? +b.balance_amount.amount : NaN;
  }
  function descOf(t) {
    var cp = t.credit_debit_indicator === 'CRDT' ? (t.debtor && t.debtor.name) : (t.creditor && t.creditor.name);
    var rem = [].concat(t.remittance_information || []).join(' ').trim();
    var s = [cp, rem].filter(Boolean).join(' – ');
    return (s || t.note || t.bank_transaction_code && t.bank_transaction_code.description || K('ui.bk-payment', 'Payment')).replace(/\s+/g, ' ').slice(0, 140);
  }
  function startFor(a) {
    if (a.from) { var f = new Date(a.from + 'T12:00'); f.setDate(f.getDate() - 3); return dkey(f); }     /* a little overlap; duplicates are skipped */
    /* the first time: from the day after the newest row you already have for that account (from files), at most 90 days back */
    var d = V(), newest = (d.expenses || []).concat(d.extra || []).filter(function (e) { return e.src === 'bank' && e.acct === a.acct; }).reduce(function (m, e) { return e.date > m ? e.date : m; }, '');
    var min = dkey(Date.now() - 90 * 864e5);
    if (newest) { var n = new Date(newest + 'T12:00'); n.setDate(n.getDate() + 1); var nk = dkey(n); return nk > min ? nk : min; }
    return min;
  }
  function pull(a) {
    var from = startFor(a), all = [], pages = 0;
    function page(ck) {
      var p = '/accounts/' + a.uid + '/transactions?date_from=' + from + (ck ? '&continuation_key=' + encodeURIComponent(ck) : '');
      return api('GET', p).then(function (j) { all = all.concat(j.transactions || []); pages++; return j.continuation_key && pages < 25 ? page(j.continuation_key) : all; });
    }
    return Promise.all([page(null), api('GET', '/accounts/' + a.uid + '/balances').catch(function () { return null; })]).then(function (r) {
      var tx = r[0].filter(function (t) { return !t.status || t.status === 'BOOK'; }), bal = balanceOf(r[1]);
      var rows = [['Dato', 'Tekst', 'Beløp', 'Saldo', 'EB ' + a.uid.slice(0, 8)]], newest = '';
      tx.forEach(function (t) {
        var dt = t.booking_date || t.value_date || t.transaction_date; if (!dt) return;
        var amt = Math.abs(+t.transaction_amount.amount) * (t.credit_debit_indicator === 'CRDT' ? 1 : -1);
        rows.push([dt, descOf(t), String(amt), '', '']); if (dt > newest) newest = dt;
      });
      /* the bank's balance on the newest row, so the import moves the account's balance to it */
      if (!isNaN(bal)) { var top = rows.slice(1).filter(function (x) { return x[0] === newest; })[0]; if (top) top[3] = String(bal); }
      return { rows: rows, n: tx.length, bal: bal, newest: newest || dkey(Date.now()) };
    });
  }
  function mappedAccts() { var out = []; ((B() || {}).links || []).forEach(function (l) { (l.accts || []).forEach(function (a) { if (a.acct && a.uid) out.push({ link: l, a: a }); }); }); return out; }
  function markFrom(uid, k) {
    saveBank(function (b) { b.links.forEach(function (l) { (l.accts || []).forEach(function (a) { if (a.uid === uid) a.from = k; }); }); });
  }
  /* no new rows: still move the account's balance to what the bank says */
  function setBal(acctId, bal) {
    if (isNaN(bal) || !window.Accts) return;
    var d = V(), A = Accts.get(d, acctId); if (!A) return;
    var kind = Accts.kind(d, acctId), v = kind === 'credit' ? Math.abs(bal) : bal;
    d.budget = d.budget || {}; var L = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [], e = L.filter(function (x) { return x.id === acctId; })[0];
    if (!e) { e = { id: acctId, kind: kind }; L.push(e); }   /* one of the three you start with, never edited yet */
    if (e) { e.bal = Math.round(v * 100) / 100; e.balAt = dkey(Date.now()); e.balSrc = 'bank'; window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
  }
  var busy = false, cache = null;
  function fetchAll(pre) {
    if (busy) return; busy = true;
    var list = mappedAccts(), said = [];
    if (!list.length) { busy = false; setup(); return; }
    if (!pre) sheet('<h2 class="im-h"><i class="bi bi-bank"></i> ' + esc(K('ui.bk-fetching', 'Fetching from the bank …')) + '</h2><p class="muted im-p">' + list.map(function (x) { return esc(x.link.aspsp + ' · ' + x.a.name); }).join('<br>') + '</p>');
    var got = pre ? Promise.resolve(pre) : Promise.all(list.map(function (x) { return pull(x.a).then(function (r) { return { x: x, r: r }; }, function (e) { return { x: x, err: e }; }); }));
    got.then(function (res) {
      cache = null; notice(0);
      var i = 0;
      function next() {
        if (i >= res.length) {
          busy = false;
          if (window.BankImport) BankImport.close();
          toast('<i class="bi bi-bank"></i> ' + esc(said.length ? said.join(' · ') : K('ui.bk-done', 'Up to date with the bank')));
          return;
        }
        var it = res[i++], acct = it.x.a.acct, label = it.x.link.aspsp + ' ' + (it.x.a.last4 ? '••' + it.x.a.last4 : it.x.a.name);
        if (it.err) {
          var expired = it.err.status === 401 || it.err.status === 403 || /expired|EXPIRED|revoked|not valid/i.test(it.err.message);
          said.push(label + ': ' + (expired ? K('ui.bk-renew-needed', 'connect again') : K('ui.bk-failed', 'didn’t answer')));
          return next();
        }
        var test = window.BankImport.analyse(it.r.rows, { acct: acct, card: false });
        if (test.error || !test.rows.length) { setBal(acct, it.r.bal); markFrom(it.x.a.uid, it.r.newest); said.push(label + ': ' + K('ui.bk-nothing', 'nothing new')); return next(); }
        BankImport.show(it.r.rows, acct, function () { markFrom(it.x.a.uid, it.r.newest); next(); });
      }
      next();
    }).catch(function (e) { busy = false; setup('<i class="bi bi-exclamation-triangle"></i> ' + esc(e.message)); });
  }

  /* ---------- a quiet look when Finances opens (at most every six hours – banks allow a few looks a day without you) ---------- */
  function notice(n) {
    var card = document.querySelector('.card.spending .card-head'); if (!card) return;
    var el = card.querySelector('.bk-new');
    if (!n) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'bk-new'; el.setAttribute('data-bkreview', ''); card.insertBefore(el, card.querySelector('.im-btn')); }
    el.innerHTML = '<i class="bi bi-bank"></i> ' + esc(K(n === 1 ? 'ui.bk-new1' : 'ui.bk-newn', n === 1 ? '1 new from the bank' : '{n} new from the bank', { n: n }));
  }
  /* balances by themselves (JP 2026-11-20: "couldn't it say how much I have in my cards?"): when Finances opens, at
     most once an hour, every matched account's balance is set to the bank's – no review needed for a balance */
  function balances() {
    var list = mappedAccts(); if (!list.length) return Promise.resolve(0);
    try { localStorage.setItem('dash.bankBal', String(Date.now())); } catch (e) {}
    return Promise.all(list.map(function (x) { return api('GET', '/accounts/' + x.a.uid + '/balances').then(function (j) { return { acct: x.a.acct, bal: balanceOf(j) }; }, function () { return null; }); })).then(function (res) {
      var n = 0; res.forEach(function (r) { if (r && !isNaN(r.bal)) { setBal(r.acct, r.bal); n++; } }); return n;
    });
  }
  function quiet() {
    var b = B(); if (!b || !b.key || !mappedAccts().length || busy) return;
    if (Date.now() - (+localStorage.getItem('dash.bankBal') || 0) > 36e5) balances();
    var last = +localStorage.getItem('dash.bankLook') || 0; if (Date.now() - last < 6 * 36e5) return;
    try { localStorage.setItem('dash.bankLook', String(Date.now())); } catch (e) {}
    Promise.all(mappedAccts().map(function (x) { return pull(x.a).then(function (r) { return { x: x, r: r }; }, function (e) { return { x: x, err: e }; }); })).then(function (res) {
      var n = 0; res.forEach(function (it) { if (it.r) { var t = window.BankImport.analyse(it.r.rows, { acct: it.x.a.acct, card: false }); if (!t.error) n += t.rows.length; } });
      cache = res; notice(n);
    });
  }

  /* At a glance's "the connection ends in N days" is in budget.js (it runs on every page) */

  /* ---------- taps ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-bksetup],[data-bkkey],[data-bkconnect],[data-bkdrop],[data-bkfetch],[data-bkreview]'); if (!t) return;
    if (t.hasAttribute('data-bksetup')) return setup();
    if (t.hasAttribute('data-bkkey')) return kf.click();
    if (t.hasAttribute('data-bkfetch')) return fetchAll();
    if (t.hasAttribute('data-bkreview')) return fetchAll(cache || null);
    if (t.hasAttribute('data-bkconnect')) { var n = t.getAttribute('data-bkconnect') || (document.querySelector('[data-bkpick]') || {}).value; if (n) { t.disabled = true; connect(n); } return; }
    if (t.hasAttribute('data-bkdrop')) {
      var li = +t.getAttribute('data-bkdrop'), l = ((B() || {}).links || [])[li]; if (!l) return;
      (window.Ask ? Ask.confirm(K('ui.bk-drop-q', 'Remove the connection to {b}? What you already fetched stays.', { b: l.aspsp })) : Promise.resolve(true)).then(function (ok) {
        if (!ok) return;
        if (l.sid) api('DELETE', '/sessions/' + l.sid).catch(function () {});
        saveBank(function (b) { b.links.splice(li, 1); }); setup();
      });
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest('[data-bkmap]');
    if (s) {
      var p = s.getAttribute('data-bkmap').split(':'), lk = ((B() || {}).links || [])[+p[0]], ba = lk && lk.accts[+p[1]], val = s.value || null;
      if (val === '+new' && ba) { val = addAcct(lk.aspsp, ba); setTimeout(setup, 0); }
      saveBank(function (b) { var a = b.links[+p[0]] && b.links[+p[0]].accts[+p[1]]; if (a) a.acct = val; }); var f = document.querySelector('.qa-acts [data-bkfetch]'); if (!f) setup(); return; }
    var pk = e.target.closest('[data-bkpick]'); if (pk) pk.dataset.touched = '1';
  });
  function hash() { if (location.hash === '#bank') { history.replaceState(null, '', location.pathname + location.search); setTimeout(setup, 350); } }
  window.addEventListener('hashchange', hash);
  window.Vault.onUnlock(function () { back(); hash(); setTimeout(quiet, 2500); });

  window.BankLink = { block: block, setup: setup, fetch: fetchAll, balances: balances, jwt: jwt, der: der, pull: pull, _api: api };
})();
