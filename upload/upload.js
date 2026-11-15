/* Upload link for Team: a contractor sends files to a project without an account.
   The link is https://jplundberg.com/upload/#<team>.<link>.<key>.<project name>; the key and the name never leave this browser.
   Each file is encrypted here (AES-GCM, about 1 MB at a time) and sent to /upload/api/…, which passes it on to Team.
   Only the team can open what is sent. */
(function () {
  'use strict';
  var nb = /^(nb|no|nn)/i.test(navigator.language || '');
  function L(en, no) { return nb ? no : en; }
  document.documentElement.lang = nb ? 'nb' : 'en';
  var $app = document.getElementById('app'), C = crypto.subtle, TE = new TextEncoder(), CH = 1000000, MAX = 55e6;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function b64(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function ub64(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(n) { return [].map.call(crypto.getRandomValues(new Uint8Array(n)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function size(b) { return b > 1e6 ? (b / 1e6).toFixed(1).replace('.', nb ? ',' : '.') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB'; }
  var parts = location.hash.slice(1).split('.'), tid = parts[0], lid = parts[1], keyB = parts[2], label = '';
  try { label = decodeURIComponent(parts.slice(3).join('.') || ''); } catch (e) {}
  function stop(t) { $app.innerHTML = '<h1>' + esc(L('Send files', 'Send filer')) + '</h1><div class="u-card"><p>' + esc(t) + '</p></div>'; }
  if (!/^(team|[a-z0-9]{12})$/.test(tid || '') || !/^[a-f0-9]{16}$/.test(lid || '') || !keyB) return stop(L('This link is not complete. Ask for a new one.', 'Denne lenken er ikke hel. Be om en ny.'));
  var base = '/upload/api/' + tid + '/' + lid + '/', key = null;
  function call(what, opt) { return fetch(base + what, Object.assign({ cache: 'no-store', credentials: 'omit' }, opt || {})).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'HTTP ' + r.status); e.status = r.status; throw e; } return j; }); }); }
  async function seal(bytes, aad) { var iv = crypto.getRandomValues(new Uint8Array(12)); var ct = await C.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(aad) }, key, bytes); return { iv: b64(iv), ct: b64(ct) }; }
  async function send(file, row) {
    var bar = row.querySelector('.u-bar i'), st = row.querySelector('small');
    if (file.size > MAX) { st.textContent = L('Too big (over 55 MB)', 'For stor (over 55 MB)'); st.className = 'u-bad'; return false; }
    var fid = hex(16), name = await seal(TE.encode(JSON.stringify({ name: file.name, type: file.type || '', size: file.size })), lid + '|' + fid + '|name');
    var n = Math.max(1, Math.ceil(file.size / CH));
    for (var i = 0; i < n; i++) {
      var part = new Uint8Array(await file.slice(i * CH, (i + 1) * CH).arrayBuffer()), c = await seal(part, lid + '|' + fid + '|' + i);
      var body = { fid: fid, n: i, iv: c.iv, ct: c.ct }; if (i === 0) body.name = name;
      for (var t = 0; ; t++) { try { await call('chunk', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); break; } catch (e) { if (t >= 2 || e.status) throw e; await new Promise(function (r) { setTimeout(r, 1500); }); } }
      bar.style.width = Math.round((i + 1) / n * 100) + '%';
    }
    await call('done', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fid: fid }) });
    st.textContent = L('Sent', 'Sendt') + ' · ' + size(file.size); st.className = 'u-ok'; return true;
  }
  async function go(files) {
    var list = document.getElementById('list'), ok = 0;
    for (var i = 0; i < files.length; i++) {
      var li = document.createElement('li'); li.innerHTML = '<span class="grow">' + esc(files[i].name) + '<small>' + esc(L('Encrypting and sending …', 'Krypterer og sender …')) + '</small><span class="u-bar"><i></i></span></span>'; list.appendChild(li);
      try { if (await send(files[i], li)) ok++; } catch (e) { var s = li.querySelector('small'); s.className = 'u-bad'; s.textContent = e.status === 410 ? L('The link has run out', 'Lenken har gått ut') : e.status === 507 ? L('No more room on this link', 'Ikke mer plass på denne lenken') : L('Not sent – check the connection and try again', 'Ikke sendt – sjekk nettet og prøv igjen'); }
    }
    document.getElementById('done').textContent = ok ? L(ok + (ok === 1 ? ' file sent. Thank you!' : ' files sent. Thank you!'), ok + (ok === 1 ? ' fil sendt. Takk!' : ' filer sendt. Takk!')) : '';
  }
  C.importKey('raw', ub64(keyB), 'AES-GCM', false, ['encrypt']).then(function (k) { key = k; return call('info'); }).then(function (j) {
    $app.innerHTML = '<h1>' + esc(L('Send files', 'Send filer')) + '</h1><p class="u-muted">' + esc(label ? L('To the project ', 'Til prosjektet ') + label : L('To the project team', 'Til prosjektteamet')) + '</p>' +
      '<div class="u-card"><p>' + esc(L('Drawings, documents and photos – they are encrypted in your browser before they are sent, and only the team can open them.', 'Tegninger, dokumenter og bilder – de krypteres i nettleseren din før de sendes, og bare teamet kan åpne dem.')) + '</p>' +
      '<label class="u-btn">' + esc(L('Choose files', 'Velg filer')) + '<input type="file" multiple hidden id="pick"></label>' +
      '<label class="u-btn ghost">' + esc(L('Take a photo', 'Ta et bilde')) + '<input type="file" accept="image/*" capture="environment" hidden id="cam"></label>' +
      '<ul class="u-list" id="list"></ul><p class="u-ok" id="done"></p></div>' +
      '<p class="u-muted">' + esc(L('The link works until ', 'Lenken virker til ') + new Date(j.exp).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.') + '</p>';
    ['pick', 'cam'].forEach(function (id) { document.getElementById(id).addEventListener('change', function (e) { var f = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; if (f.length) go(f); }); });
  }).catch(function (e) { stop(e.status === 410 ? L('This link has run out or was switched off. Ask for a new one.', 'Denne lenken har gått ut eller er slått av. Be om en ny.') : L('Could not open the link. Check the connection and try again.', 'Klarte ikke å åpne lenken. Sjekk nettet og prøv igjen.')); });
})();
