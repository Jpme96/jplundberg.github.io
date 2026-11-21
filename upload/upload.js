/* Upload link for Team: a contractor sends files to a project without an account.
   The link is https://jplundberg.com/upload/#<team>.<link>.<key>.<project name>; the key and the name never leave this browser.
   Choose the files (and say who you are and add a message), look over the list, then send. Each file is encrypted here
   (AES-GCM, about 1 MB at a time) and sent to /upload/api/…, which passes it on to Team. Only the team can open what is sent.
   "Sent on this link" lists what has been sent, opened here with the link's key, and whether the team has taken it in. */
(function () {
  'use strict';
  var nb = /^(nb|no|nn)/i.test(navigator.language || '');
  function L(en, no) { return nb ? no : en; }
  document.documentElement.lang = nb ? 'nb' : 'en';
  var $app = document.getElementById('app'), C = crypto.subtle, TE = new TextEncoder(), TD = new TextDecoder(), CH = 1000000, MAX = 55e6;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function b64(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function ub64(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(n) { return [].map.call(crypto.getRandomValues(new Uint8Array(n)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function size(b) { return b > 1e6 ? (b / 1e6).toFixed(1).replace('.', nb ? ',' : '.') + ' MB' : Math.max(1, Math.round((b || 0) / 1e3)) + ' kB'; }
  function when(t) { return new Date(t).toLocaleString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function icon(type, name) { var t = String(type || ''), n = String(name || '').toLowerCase(); return /^image\//.test(t) ? '🖼' : /pdf/.test(t) || /\.pdf$/.test(n) ? '📄' : /\.(dwg|dxf|ifc|rvt)$/.test(n) ? '📐' : /sheet|excel|\.xlsx?$/.test(t + n) ? '📊' : /word|\.docx?$/.test(t + n) ? '📝' : '📎'; }
  var parts = location.hash.slice(1).split('.'), tid = parts[0], lid = parts[1], keyB = parts[2], label = '';
  try { label = decodeURIComponent(parts.slice(3).join('.') || ''); } catch (e) {}
  function stop(t) { $app.innerHTML = '<h1>' + esc(L('Send files', 'Send filer')) + '</h1><div class="u-card"><p>' + esc(t) + '</p></div>'; }
  if (!/^(team|[a-z0-9]{12})$/.test(tid || '') || !/^[a-f0-9]{16}$/.test(lid || '') || !keyB) return stop(L('This link is not complete. Ask for a new one.', 'Denne lenken er ikke hel. Be om en ny.'));
  var base = '/upload/api/' + tid + '/' + lid + '/', key = null, picked = [], sending = false, exp = 0, ME = 'up.who.' + lid;
  function call(what, opt) { return fetch(base + what, Object.assign({ cache: 'no-store', credentials: 'omit' }, opt || {})).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'HTTP ' + r.status); e.status = r.status; throw e; } return j; }); }); }
  async function seal(bytes, aad) { var iv = crypto.getRandomValues(new Uint8Array(12)); var ct = await C.encrypt({ name: 'AES-GCM', iv: iv, additionalData: TE.encode(aad) }, key, bytes); return { iv: b64(iv), ct: b64(ct) }; }
  async function open(blob, aad) { return C.decrypt({ name: 'AES-GCM', iv: ub64(blob.iv), additionalData: TE.encode(aad) }, key, ub64(blob.ct)); }

  /* ---------- 1. choose ---------- */
  function add(list) {
    list.forEach(function (f) {
      if (picked.some(function (p) { return p.f.name === f.name && p.f.size === f.size && p.st !== 'sent'; })) return;
      picked.push({ id: hex(4), f: f, st: f.size > MAX ? 'big' : 'ready', pct: 0, url: /^image\//.test(f.type) && f.size < 15e6 ? URL.createObjectURL(f) : '' });
    });
    draw();
  }
  function ready() { return picked.filter(function (p) { return p.st === 'ready' || p.st === 'fail'; }); }
  function rowHtml(p) {
    var st = p.st === 'big' ? '<small class="u-bad">' + esc(L('Too big (over 55 MB) – will not be sent', 'For stor (over 55 MB) – blir ikke sendt')) + '</small>'
      : p.st === 'sending' ? '<small>' + esc(L('Encrypting and sending …', 'Krypterer og sender …')) + '</small><span class="u-bar"><i style="width:' + p.pct + '%"></i></span>'
      : p.st === 'sent' ? '<small class="u-ok">✓ ' + esc(L('Sent', 'Sendt')) + '</small>'
      : p.st === 'fail' ? '<small class="u-bad">' + esc(p.err || L('Not sent', 'Ikke sendt')) + '</small>'
      : '<small>' + esc(size(p.f.size)) + '</small>';
    return '<li data-id="' + p.id + '">' + (p.url ? '<img class="u-th" src="' + p.url + '" alt="">' : '<span class="u-ic">' + icon(p.f.type, p.f.name) + '</span>') +
      '<span class="grow">' + esc(p.f.name) + st + '</span>' + (p.st === 'ready' || p.st === 'big' || p.st === 'fail' ? '<button class="u-x" type="button" data-rm="' + p.id + '" aria-label="' + esc(L('Remove', 'Fjern')) + '">×</button>' : '') + '</li>';
  }
  function draw() {
    var list = document.getElementById('list'), r = ready(), btn = document.getElementById('send'), tot = r.reduce(function (a, p) { return a + p.f.size; }, 0);
    list.innerHTML = picked.map(rowHtml).join('');
    list.hidden = !picked.length; document.getElementById('empty').hidden = !!picked.length;
    btn.disabled = sending || !r.length;
    btn.textContent = sending ? L('Sending …', 'Sender …') : r.length ? L('Send ' + r.length + (r.length === 1 ? ' file' : ' files') + ' (' + size(tot) + ')', 'Send ' + r.length + (r.length === 1 ? ' fil' : ' filer') + ' (' + size(tot) + ')') : L('Send', 'Send');
    if (picked.some(function (p) { return p.st === 'fail'; }) && !sending) btn.textContent = L('Try again', 'Prøv igjen') + ' (' + r.length + ')';
  }
  function bar(p) { var li = document.querySelector('li[data-id="' + p.id + '"] .u-bar i'); if (li) li.style.width = p.pct + '%'; }

  /* ---------- 2. send ---------- */
  async function sendOne(p, who, msg, batch, n) {
    var f = p.f, fid = hex(16), meta = { name: f.name, type: f.type || '', size: f.size, who: who, msg: msg, b: batch, n: n, at: Date.now() };
    var name = await seal(TE.encode(JSON.stringify(meta)), lid + '|' + fid + '|name'), k = Math.max(1, Math.ceil(f.size / CH));
    for (var i = 0; i < k; i++) {
      var part = new Uint8Array(await f.slice(i * CH, (i + 1) * CH).arrayBuffer()), c = await seal(part, lid + '|' + fid + '|' + i);
      var body = { fid: fid, n: i, iv: c.iv, ct: c.ct }; if (i === 0) body.name = name;
      for (var t = 0; ; t++) { try { await call('chunk', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); break; } catch (e) { if (t >= 2 || e.status) throw e; await new Promise(function (r) { setTimeout(r, 1500 * (t + 1)); }); } }
      p.pct = Math.round((i + 1) / k * 100); bar(p);
    }
    await call('done', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fid: fid }) });
  }
  async function send() {
    var r = ready(); if (!r.length || sending) return;
    var who = document.getElementById('who').value.trim().slice(0, 120), msg = document.getElementById('msg').value.trim().slice(0, 1000);
    if (!who) { var w = document.getElementById('who'); w.focus(); w.classList.add('u-need'); document.getElementById('needWho').hidden = false; return; }
    try { localStorage.setItem(ME, who); } catch (e) {}
    sending = true; var batch = hex(6), ok = 0;
    r.forEach(function (p) { p.st = 'sending'; p.pct = 0; }); draw();
    for (var i = 0; i < r.length; i++) {
      try { await sendOne(r[i], who, msg, batch, r.length); r[i].st = 'sent'; ok++; }
      catch (e) { r[i].st = 'fail'; r[i].err = e.status === 410 ? L('The link has run out', 'Lenken har gått ut') : e.status === 507 ? L('No more room on this link', 'Ikke mer plass på denne lenken') : L('Not sent – check the connection and try again', 'Ikke sendt – sjekk nettet og prøv igjen'); }
      draw();
    }
    sending = false;
    var fails = picked.filter(function (p) { return p.st === 'fail'; }).length;
    document.getElementById('done').innerHTML = ok ? esc(L(ok + (ok === 1 ? ' file was sent' : ' files were sent') + (label ? ' to ' + label : '') + '. Thank you!', ok + (ok === 1 ? ' fil ble sendt' : ' filer ble sendt') + (label ? ' til ' + label : '') + '. Takk!')) + (fails ? ' ' + esc(L(fails + ' did not go – tap "Try again".', fails + ' ble ikke sendt – trykk «Prøv igjen».')) : '') : '';
    if (ok && !fails) { picked = picked.filter(function (p) { return p.st !== 'sent'; }); document.getElementById('msg').value = ''; }
    draw(); log(); needs();
  }

  /* ---------- 3. what was sent on this link ---------- */
  /* what the team is still waiting for on this project (2026-11-21, JP): kept up to date by the team's app, encrypted
     with this link's key – opened here */
  async function needs() {
    var box = document.getElementById('needs'); if (!box) return;
    try {
      var j = await call('needs'); if (!j.needs) { box.hidden = true; return; }
      var data = JSON.parse(TD.decode(await open(j.needs, lid + '|needs'))), items = (data && data.items) || [];
      var head = document.getElementById('needsH'); if (head) head.hidden = false; box.hidden = false;
      if (!items.length) { box.innerHTML = '<p class="u-ok">✓ ' + esc(L('Nothing is missing right now – thank you!', 'Ingenting mangler nå – takk!')) + '</p>'; return; }
      var back = items.filter(function (x) { return x.st !== 'missing'; }), miss = items.filter(function (x) { return x.st === 'missing'; });
      var today = new Date().toISOString().slice(0, 10);
      var row = function (x) { return '<li><span class="u-code">' + esc(x.c) + '</span><span class="grow">' + esc(x.t || x.s || '') + (x.p ? '<small>' + esc(x.p) + '</small>' : x.s && x.t ? '<small>' + esc(x.s) + '</small>' : '') + '</span>' + (x.due ? '<span class="u-tag' + (x.due < today ? ' late' : '') + '">' + esc(L('by ', 'innen ') + new Date(x.due + 'T12:00').toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' })) + '</span>' : '') + '</li>'; };
      box.innerHTML = '<p class="u-muted">' + esc(L(items.length + ' document' + (items.length === 1 ? '' : 's') + ' still needed · updated ', items.length + ' dokument' + (items.length === 1 ? '' : 'er') + ' mangler · oppdatert ') + when(j.at)) + '</p>' +
        (back.length ? '<p class="u-bh"><b>' + esc(L('Sent back – please send a new version', 'Sendt tilbake – send en ny versjon')) + '</b></p><ul class="u-list u-needs">' + back.map(row).join('') + '</ul>' : '') +
        (miss.length ? '<p class="u-bh"><b>' + esc(L('Missing', 'Mangler')) + '</b></p><ul class="u-list u-needs">' + miss.map(row).join('') + '</ul>' : '');
    } catch (e) { box.hidden = true; }
  }
  async function log() {
    var box = document.getElementById('log'); if (!box) return;
    try {
      var j = await call('list'), rows = [];
      for (var i = 0; i < j.files.length; i++) { var x = j.files[i], m = {}; try { m = JSON.parse(TD.decode(await open(x.name, lid + '|' + x.fid + '|name'))); } catch (e) { m = { name: L('(could not be read)', '(kunne ikke leses)') }; } rows.push({ m: m, x: x }); }
      if (!rows.length) { box.innerHTML = '<p class="u-muted">' + esc(L('Nothing has been sent on this link yet.', 'Ingenting er sendt med denne lenken ennå.')) + '</p>'; return; }
      var groups = {}, order = [];
      rows.forEach(function (r) { var g = r.m.b || r.x.fid; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); });
      order.sort(function (a, b) { return groups[b][0].x.t - groups[a][0].x.t; });
      var kept = rows.filter(function (r) { return r.x.kept; }).length;
      box.innerHTML = '<p class="u-muted">' + esc(L(rows.length + (rows.length === 1 ? ' file sent' : ' files sent') + ' · ' + kept + ' taken in by the team', rows.length + (rows.length === 1 ? ' fil sendt' : ' filer sendt') + ' · ' + kept + ' tatt inn av teamet')) + '</p>' + order.map(function (g) {
        var l = groups[g], m0 = l[0].m;
        return '<div class="u-batch"><p class="u-bh"><b>' + esc(when(l[0].x.t)) + '</b>' + (m0.who ? ' · ' + esc(m0.who) : '') + '</p>' + (m0.msg ? '<p class="u-msg">' + esc(m0.msg) + '</p>' : '') +
          '<ul class="u-list">' + l.map(function (r) { return '<li><span class="u-ic">' + icon(r.m.type, r.m.name) + '</span><span class="grow">' + esc(r.m.name) + '<small>' + esc(size(r.m.size || r.x.size)) + '</small></span>' +
            (r.x.kept ? '<span class="u-tag ok">✓ ' + esc(L('Received', 'Mottatt')) + '</span>' : '<span class="u-tag">' + esc(L('Waiting for the team', 'Venter på teamet')) + '</span>') + '</li>'; }).join('') + '</ul></div>';
      }).join('');
    } catch (e) { box.innerHTML = '<p class="u-muted">' + esc(e.status === 410 ? L('The link has run out.', 'Lenken har gått ut.') : L('Could not get the list right now.', 'Fikk ikke hentet listen nå.')) + '</p>'; }
  }

  C.importKey('raw', ub64(keyB), 'AES-GCM', false, ['encrypt', 'decrypt']).then(function (k) { key = k; return call('info'); }).then(function (j) {
    exp = j.exp; var who = ''; try { who = localStorage.getItem(ME) || ''; } catch (e) {}
    $app.innerHTML = '<h1>' + esc(L('Send files', 'Send filer')) + '</h1><p class="u-muted">' + esc(label ? L('To the project ', 'Til prosjektet ') + label : L('To the project team', 'Til prosjektteamet')) + '</p>' +
      /* how it works, in three lines (2026-11-20, the welcome guide for contractors) */
      '<ol class="u-how"><li>' + esc(L('Write who you are.', 'Skriv hvem du er.')) + '</li><li>' + esc(L('Pick the files, or take a photo – they are encrypted here in your browser before they leave.', 'Velg filene, eller ta et bilde – de krypteres her i nettleseren før de sendes.')) + '</li><li>' + esc(L('You see each file arrive; the team is told when they come in. No account needed.', 'Du ser hver fil komme fram; teamet får beskjed når de kommer. Du trenger ingen konto.')) + '</li></ol>' +
      '<div class="u-card">' +
        '<label class="u-lbl">' + esc(L('Your name and company', 'Navn og firma')) + '<input id="who" autocomplete="organization" maxlength="120" value="' + esc(who) + '" placeholder="' + esc(L('e.g. Kari Nordmann, Bygg AS', 'f.eks. Kari Nordmann, Bygg AS')) + '"></label>' +
        '<p class="u-bad" id="needWho" hidden>' + esc(L('Write who you are, so the team knows who sent it.', 'Skriv hvem du er, så teamet vet hvem som sendte det.')) + '</p>' +
        '<label class="u-lbl">' + esc(L('Message to the team (optional)', 'Melding til teamet (valgfritt)')) + '<textarea id="msg" rows="3" maxlength="1000" placeholder="' + esc(L('What is this? e.g. "Revised drawings, rev. C"', 'Hva er dette? f.eks. «Reviderte tegninger, rev. C»')) + '"></textarea></label>' +
        '<div class="u-drop" id="drop"><p>' + esc(L('Drawings, documents and photos. Drag them here, or:', 'Tegninger, dokumenter og bilder. Dra dem hit, eller:')) + '</p>' +
          '<div class="u-two"><label class="u-btn ghost">' + esc(L('Choose files', 'Velg filer')) + '<input type="file" multiple hidden id="pick"></label>' +
          '<label class="u-btn ghost">' + esc(L('Take a photo', 'Ta et bilde')) + '<input type="file" accept="image/*" capture="environment" hidden id="cam"></label></div></div>' +
        '<p class="u-muted" id="empty">' + esc(L('Nothing chosen yet. Files are only sent when you tap Send.', 'Ingenting valgt ennå. Filene sendes først når du trykker Send.')) + '</p>' +
        '<ul class="u-list" id="list" hidden></ul>' +
        '<button class="u-btn" type="button" id="send" disabled>' + esc(L('Send', 'Send')) + '</button>' +
        '<p class="u-ok" id="done" role="status"></p>' +
        '<p class="u-small">' + esc(L('Encrypted in your browser before it is sent – only the team can open it.', 'Krypteres i nettleseren din før det sendes – bare teamet kan åpne det.')) + '</p></div>' +
      '<h2 id="needsH" hidden>' + esc(L('What the team still needs', 'Hva teamet fortsatt trenger')) + '</h2><div class="u-card" id="needs" hidden></div>' +
      '<h2>' + esc(L('Sent on this link', 'Sendt med denne lenken')) + '</h2><div class="u-card" id="log"><p class="u-muted">…</p></div>' +
      '<p class="u-muted">' + esc(L('The link works until ', 'Lenken virker til ') + new Date(exp).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.') + '</p>';
    ['pick', 'cam'].forEach(function (id) { document.getElementById(id).addEventListener('change', function (e) { var f = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; if (f.length) add(f); }); });
    document.getElementById('send').addEventListener('click', send);
    document.getElementById('who').addEventListener('input', function (e) { e.target.classList.remove('u-need'); document.getElementById('needWho').hidden = true; });
    document.getElementById('list').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; picked = picked.filter(function (p) { if (p.id === b.dataset.rm && p.url) URL.revokeObjectURL(p.url); return p.id !== b.dataset.rm; }); draw(); });
    var drop = document.getElementById('drop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('on'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('on'); }); });
    drop.addEventListener('drop', function (e) { var f = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []); if (f.length) add(f); });
    window.addEventListener('beforeunload', function (e) { if (sending || ready().length) { e.preventDefault(); e.returnValue = ''; } });
    draw(); log(); needs();
  }).catch(function (e) { stop(e.status === 410 ? L('This link has run out or was switched off. Ask for a new one.', 'Denne lenken har gått ut eller er slått av. Be om en ny.') : L('Could not open the link. Check the connection and try again.', 'Klarte ikke å åpne lenken. Sjekk nettet og prøv igjen.')); });
})();
