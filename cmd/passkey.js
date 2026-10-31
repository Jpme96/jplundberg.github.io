/* Unlock with Face ID / Touch ID / fingerprint (a passkey with the WebAuthn PRF extension).
   The passcode still encrypts everything. This device keeps a copy of the passcode, encrypted with a key
   that only the phone's or computer's secure chip can give back after Face ID / fingerprint (PRF output).
   Stored in localStorage dash.pk on this device only (never synced). Changing the passcode turns it off.
   Settings → Security → Unlock with Face ID or fingerprint. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  var KEY = 'dash.pk', enc = new TextEncoder(), dec = new TextDecoder();
  var $ = function (id) { return document.getElementById(id); };
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function saved() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v && v.id && v.ct ? v : null; } catch (e) { return null; } }
  function drop() { try { localStorage.removeItem(KEY); } catch (e) {} paint(); }
  var IOS = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  var NAME = IOS ? 'Face ID' : /Mac/.test(navigator.platform || '') ? 'Touch ID' : L('fingerprint or face', 'fingeravtrykk eller ansikt');

  var supported = null;
  function support() {
    if (supported) return supported;
    supported = window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }) : Promise.resolve(false);
    return supported;
  }
  function aesFrom(prf) {
    return crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('dashboard passkey unlock v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function prfGet(id, salt) {
    return navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: id }], userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: salt } } } } })
      .then(function (a) { var r = a && a.getClientExtensionResults().prf; if (!r || !r.results || !r.results.first) throw new Error('noprf'); return r.results.first; });
  }

  /* ---------- turn on ----------
     iPhone/Safari only allows Face ID straight after a tap: create() is called first, in the tap itself (the passcode
     is checked afterwards). Most devices only hand out the secret on a sign-in, not when the passkey is made –
     then a second tap ("Finish with Face ID") does that sign-in. */
  function userId() { var u = null; try { u = localStorage.getItem('dash.pkUser'); } catch (e) {} if (!u) { u = b64(rnd(16)); try { localStorage.setItem('dash.pkUser', u); } catch (e) {} } return unb64(u); }
  var pending = null;   /* { id, salt, pass } in memory only, between the two taps */
  function store(prf, id, salt, pass) {
    return aesFrom(prf).then(function (k) {
      var iv = rnd(12);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(pass)).then(function (ct) {
        localStorage.setItem(KEY, JSON.stringify({ id: b64(id), salt: b64(salt), iv: b64(iv), ct: b64(ct), at: Date.now() }));
      });
    });
  }
  function enable(pass) {
    var salt = rnd(32), id, first = null;
    var made = navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: 'Dashboard', id: location.hostname },
      user: { id: userId(), name: 'Dashboard', displayName: 'Dashboard' },   /* the same id every time, so a retry replaces the passkey instead of piling up new ones */
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      timeout: 60000, extensions: { prf: { eval: { first: salt } } } } });
    return made.then(function (c) {
      id = new Uint8Array(c.rawId);
      var r = c.getClientExtensionResults().prf;
      if (r && r.enabled === false) throw new Error('noprf');
      first = r && r.results && r.results.first;
      return window.Vault.tryPass(pass);
    }).then(function (ok) {
      if (!ok) throw new Error('wrong');
      if (first) return store(first, id, salt, pass).then(function () { return 'done'; });
      pending = { id: id, salt: salt, pass: pass };
      return 'finish';
    });
  }
  function finish() {
    var p = pending; if (!p) return Promise.reject(new Error('gone'));
    return prfGet(p.id, p.salt).then(function (prf) { return store(prf, p.id, p.salt, p.pass); }).then(function () { pending = null; });
  }

  /* ---------- unlock ---------- */
  var busy = false;
  function unlock() {
    var v = saved(); if (!v || busy) return;
    busy = true; var m = $('lockMsg');
    prfGet(unb64(v.id), unb64(v.salt)).then(aesFrom).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, k, unb64(v.ct));
    }).then(function (pt) {
      var pass = dec.decode(pt);
      return window.Vault.tryPass(pass).then(function (ok) {
        busy = false;
        if (ok) window.Vault.unlockWith(pass);
        else { drop(); if (m) m.textContent = L('The passcode has changed – use it once, then turn ' + NAME + ' on again in Security.', 'Koden er endret – bruk den én gang, og slå på ' + NAME + ' igjen under Sikkerhet.'); }
      });
    }).catch(function (e) {
      busy = false;
      if (m && e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') m.textContent = L(NAME + ' didn’t work here – use the passcode.', NAME + ' virket ikke her – bruk koden.');
    });
  }

  /* ---------- lock screen button ---------- */
  function lockBtn() {
    var f = $('lockForm'); if (!f) return;
    var b = $('lockPk');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'lockPk'; b.className = 'text-btn lock-pk';
      f.appendChild(b); b.addEventListener('click', unlock);
    }
    b.innerHTML = '<i class="bi bi-person-bounding-box"></i> ' + L('Unlock with ' + NAME, 'Lås opp med ' + NAME);
    b.hidden = !saved();
    /* with Face ID on, don't pop the keyboard on a phone – the button is the quick way in */
    if (saved() && matchMedia('(pointer: coarse)').matches) setTimeout(function () { var i = $('lockPass'); if (i && document.activeElement === i) i.blur(); }, 140);
  }

  /* ---------- Settings → Security ---------- */
  function paint() {
    lockBtn();
    var anchor = $('stRecovery'); if (!anchor) return;
    support().then(function (ok) {
      var row = $('stPasskey');
      if (!ok) { if (row) row.hidden = true; return; }
      if (!row) {
        row = document.createElement('div'); row.id = 'stPasskey';
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
      }
      var on = !!saved();
      row.innerHTML = '<label class="st-row"><span>' + L('Unlock with ' + NAME, 'Lås opp med ' + NAME) + '<small class="st-rsub">' +
        (on ? L('On for this device – the passcode is still needed on new devices', 'På for denne enheten – koden trengs fortsatt på nye enheter') : L('Skip typing the passcode on this device', 'Slipp å skrive koden på denne enheten')) +
        '</small></span><input type="checkbox" class="switch" data-pkswitch' + (on ? ' checked' : '') + '></label>' +
        '<form class="inline-form" id="pkForm" hidden><input type="text" name="username" value="dashboard" autocomplete="username" hidden>' +
        '<input id="pkPass" type="password" placeholder="' + L('Your passcode, once', 'Koden din, én gang') + '" autocomplete="current-password" required>' +
        '<p class="muted pk-msg" id="pkMsg"></p><div class="form-actions"><span class="spacer"></span><button type="button" class="text-btn" data-pkcancel>' + L('Cancel', 'Avbryt') + '</button><button type="submit" class="pill-btn">' + L('Turn on', 'Slå på') + '</button></div></form>';
    });
  }
  document.addEventListener('change', function (e) {
    var sw = e.target.closest && e.target.closest('[data-pkswitch]'); if (!sw) return;
    if (!sw.checked) { drop(); return; }
    sw.checked = false; var f = $('pkForm'); if (f) { f.hidden = false; setTimeout(function () { $('pkPass').focus(); }, 30); }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-pkcancel]')) { var f = $('pkForm'); if (f) f.hidden = true; } });
  function errText(err) {
    var w = err && err.message;
    return w === 'wrong' ? L('That isn’t the passcode.', 'Det er ikke koden.')
      : w === 'noprf' ? L('The place it was saved can’t give back the key this needs. Try again and save it in Passwords (iCloud Keychain) instead of another password manager – it needs iOS 18 or newer.', 'Stedet den ble lagret kan ikke gi tilbake nøkkelen dette trenger. Prøv igjen og lagre i Passord (iCloud-nøkkelring) i stedet for en annen passordbehandler – det krever iOS 18 eller nyere.')
      : err && err.name === 'NotAllowedError' ? L('Face ID was cancelled or timed out. Try again – and tap the button straight after typing the passcode.', 'Face ID ble avbrutt eller tok for lang tid. Prøv igjen – og trykk på knappen rett etter at du har skrevet koden.')
      : err && err.name === 'InvalidStateError' ? L('This device already has a passkey for the dashboard. Turn the switch off and on again.', 'Denne enheten har allerede en passkey for dashbordet. Slå bryteren av og på igjen.')
      : err && err.name === 'SecurityError' ? L('The browser blocked it (it only works on jplundberg.com, opened in Safari or the Home Screen app).', 'Nettleseren stoppet det (det virker bare på jplundberg.com, i Safari eller appen på Hjem-skjermen).')
      : L('It didn’t work: ', 'Det virket ikke: ') + (err && ((err.name || '') + ' ' + (err.message || ''))).trim();
  }
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'pkForm') return;
    e.preventDefault();
    var m = $('pkMsg'), pass = $('pkPass').value;
    m.textContent = L('Your phone asks where to save the passkey – choose Passwords (iCloud Keychain), then Face ID.', 'Telefonen spør hvor passkeyen skal lagres – velg Passord (iCloud-nøkkelring), deretter Face ID.');
    var hint = setTimeout(function () { if (!saved()) m.textContent = L('If a password manager (1Password, Bitwarden …) opened: tap “Other options” and save in Passwords (iCloud Keychain) – other managers can’t give back the key this needs.', 'Hvis en passordbehandler (1Password, Bitwarden …) åpnet seg: trykk «Andre valg» og lagre i Passord (iCloud-nøkkelring) – andre passordbehandlere kan ikke gi tilbake nøkkelen dette trenger.'); }, 9000);
    enable(pass).then(function (st) { clearTimeout(hint);
      if (st === 'done') { paint(); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-person-bounding-box"></i> ' + L(NAME + ' unlock is on', NAME + '-opplåsing er på')); return; }
      m.innerHTML = esc(L('Almost there – one more Face ID to finish.', 'Nesten ferdig – én Face ID til for å fullføre.')) + ' <button type="button" class="pill-btn" data-pkfinish>' + esc(L('Finish with ' + NAME, 'Fullfør med ' + NAME)) + '</button>';
    }).catch(function (err) { clearTimeout(hint); m.textContent = errText(err); });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-pkfinish]')) return;
    var m = $('pkMsg');
    finish().then(function () { paint(); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-person-bounding-box"></i> ' + L(NAME + ' unlock is on', NAME + '-opplåsing er på')); })
      .catch(function (err) { if (m) m.textContent = errText(err); });
  });
  window.addEventListener('passcode:change', function () { if (saved()) { drop(); if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-person-bounding-box"></i> ' + L(NAME + ' unlock was turned off – turn it on again in Security.', NAME + '-opplåsing ble slått av – slå den på igjen under Sikkerhet.')); } });
  window.Vault.onLock(function () { setTimeout(lockBtn, 0); });
  window.Vault.onUnlock(function () { setTimeout(paint, 200); });
  window.addEventListener('st:page', function (e) { if (e.detail === 'security') paint(); });
  paint();
  window.Passkey = { enable: enable, unlock: unlock, on: function () { return !!saved(); } };
})();
