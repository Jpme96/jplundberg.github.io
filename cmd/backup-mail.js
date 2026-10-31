/* Weekly encrypted backup by email (Settings → Data & sync).
   Your server (the Worker) mails you the vault once a week, exactly as it is stored there – still
   encrypted with your passcode – using Resend (resend.com, free for this). The Worker needs
   RESEND_API_KEY and BACKUP_EMAIL; until they're there, this shows the one step to set it up.
   Restore a mailed file with Settings → Data & sync → Restore from a backup. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var API = '/cmd/api/backup', DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }
  function box() { return document.getElementById('stMailBk'); }
  var st = null, busy = false, NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function when(t) { var d = new Date(t); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function steps() {
    return '<details class="st-col bm-steps" data-noi18n>' + L(
      '<summary><i class="bi bi-info-circle"></i> Set it up – about 5 minutes, once</summary><ol>' +
      '<li>Make a free account at <a href="https://resend.com/signup" target="_blank" rel="noopener">resend.com</a> with the email address the backups should go to.</li>' +
      '<li>Resend → <b>API Keys</b> → <b>Create API Key</b>: name <i>Dashboard backup</i>, permission <i>Sending access</i>. Copy the key (starts with <code>re_</code>).</li>' +
      '<li>Cloudflare → Workers &amp; Pages → <b>dashboard-sync</b> → Settings → Variables and secrets → <b>Add</b>: <code>RESEND_API_KEY</code> as a <b>Secret</b> (the key), and <code>BACKUP_EMAIL</code> as Text (your address) → Deploy.</li>' +
      '<li>Check that the Worker has the newest <code>worker.js</code> and a <b>Cron Trigger</b> “every 5 minutes” (Settings → Triggers) – the same one notifications use.</li>' +
      '<li>Come back here, switch it on and tap <b>Send one now</b> to test.</li></ol>' +
      '<p class="muted hl-small">Without a verified domain, Resend only sends to your own account address – which is all this needs. To send from <code>backup@jplundberg.com</code>, verify the domain in Resend and add <code>BACKUP_FROM</code>.</p>',
      '<summary><i class="bi bi-info-circle"></i> Sett det opp – omtrent 5 minutter, én gang</summary><ol>' +
      '<li>Lag en gratis konto på <a href="https://resend.com/signup" target="_blank" rel="noopener">resend.com</a> med e-postadressen sikkerhetskopiene skal til.</li>' +
      '<li>Resend → <b>API Keys</b> → <b>Create API Key</b>: navn <i>Dashboard backup</i>, tilgang <i>Sending access</i>. Kopier nøkkelen (begynner med <code>re_</code>).</li>' +
      '<li>Cloudflare → Workers &amp; Pages → <b>dashboard-sync</b> → Settings → Variables and secrets → <b>Add</b>: <code>RESEND_API_KEY</code> som <b>Secret</b> (nøkkelen), og <code>BACKUP_EMAIL</code> som Text (adressen din) → Deploy.</li>' +
      '<li>Sjekk at Workeren har nyeste <code>worker.js</code> og en <b>Cron Trigger</b> «hvert 5. minutt» (Settings → Triggers) – den samme som varslene bruker.</li>' +
      '<li>Kom tilbake hit, slå det på og trykk <b>Send en nå</b> for å teste.</li></ol>' +
      '<p class="muted hl-small">Uten verifisert domene sender Resend bare til din egen kontoadresse – og det er alt som trengs. Vil du sende fra <code>backup@jplundberg.com</code>, verifiser domenet i Resend og legg til <code>BACKUP_FROM</code>.</p>') + '</details>';
  }
  function draw() {
    var b = box(); if (!b) return;
    if (!st) { b.innerHTML = '<div class="st-row"><span class="muted">Looking …</span></div>'; return; }
    if (st.err) {
      b.innerHTML = '<div class="st-col"><p class="st-note" data-noi18n>' + (st.err === 'old' ? L('Your server doesn’t know the weekly backup yet – paste the newest <code>_cloudflare/worker.js</code> into the Worker (Edit code → Deploy).', 'Serveren kjenner ikke den ukentlige sikkerhetskopien ennå – lim inn nyeste <code>_cloudflare/worker.js</code> i Workeren (Edit code → Deploy).') : L('Couldn’t reach your server – check again when you’re online.', 'Fikk ikke kontakt med serveren – sjekk igjen når du er på nett.')) + '</p></div>' + steps();
      return;
    }
    var c = st.cfg || {}, l = st.last;
    var last = l ? (l.ok ? '<i class="bi bi-check-circle" style="color:var(--accent)"></i> Last one sent ' + esc(when(l.at)) + (st.to ? ' to ' + esc(st.to) : '') : '<i class="bi bi-exclamation-triangle" style="color:var(--danger)"></i> ' + esc(when(l.at)) + ': ' + esc(l.err || 'failed')) : 'None sent yet';
    if (!st.ready) {
      b.innerHTML = '<div class="st-col"><p class="st-note" data-noi18n>' + L('One step left: the server needs an email service to send it. Until then, use <b>Download encrypted backup</b> above – At a glance reminds you.', 'Ett steg igjen: serveren trenger en e-posttjeneste for å sende den. Fram til da: bruk <b>Last ned kryptert sikkerhetskopi</b> over – Kort fortalt minner deg på det.') + '</p></div>' + steps();
      return;
    }
    b.innerHTML = '<label class="st-row"><span>Email me a backup every week<small class="st-rsub">' + last + '</small></span><input type="checkbox" class="switch" data-bmon' + (c.on ? ' checked' : '') + '></label>' +
      (c.on ? '<label class="st-row"><span>Day</span><select class="st-select" data-bmday>' + DAYS.map(function (d, i) { return '<option value="' + i + '"' + (i === c.day ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
        '<label class="st-row"><span>From</span><select class="st-select" data-bmhour>' + [6, 8, 12, 18, 20, 22].map(function (h) { return '<option value="' + h + '"' + (h === c.hour ? ' selected' : '') + '>' + pad(h) + ':00</option>'; }).join('') + '</select></label>' : '') +
      '<button type="button" class="st-row st-btn" data-bmnow' + (busy ? ' disabled' : '') + '><span><i class="bi bi-send"></i> ' + (busy ? 'Sending …' : 'Send one now') + '</span></button>' +
      '<div class="st-col"><p class="st-note" data-noi18n>' + L('The file is the same as a downloaded backup: encrypted with your passcode, so the email is useless without it. Open it with <b>Restore from a backup</b>.', 'Filen er den samme som en nedlastet sikkerhetskopi: kryptert med koden din, så e-posten er verdiløs uten den. Åpne den med <b>Gjenopprett fra sikkerhetskopi</b>.') + '</p></div>';
  }
  function load() {
    st = null; draw();
    fetch(API, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 404) return { err: 'old' };
      return r.json().then(function (j) { return r.ok ? j : { err: 'net' }; });
    }).then(function (j) { st = j; draw(); }, function () { st = { err: 'net' }; draw(); });
  }
  function save(patch) {
    var c = Object.assign({}, st.cfg, patch); st.cfg = c; draw();
    fetch(API, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
      .then(function (r) { toast(r.ok ? '<i class="bi bi-check2"></i> Saved' : '<i class="bi bi-exclamation-triangle"></i> Couldn’t save'); }, function () { toast('<i class="bi bi-wifi-off"></i> Offline – not saved'); });
  }
  document.addEventListener('change', function (e) {
    if (!st || !st.cfg) return;
    if (e.target.closest('[data-bmon]')) save({ on: e.target.checked });
    else if (e.target.closest('[data-bmday]')) save({ day: +e.target.value });
    else if (e.target.closest('[data-bmhour]')) save({ hour: +e.target.value });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-bmnow]') || busy) return;
    busy = true; draw();
    /* send what this device has right now: sync first, then mail */
    Promise.resolve(window.Vault.sync && window.Vault.sync()).catch(function () {}).then(function () {
      return fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function (r) { return r.json(); });
    }).then(function (j) {
      busy = false; if (st) st.last = j; draw();
      toast(j && j.ok ? '<i class="bi bi-envelope-check"></i> Backup sent – check your inbox' : '<i class="bi bi-exclamation-triangle"></i> ' + esc((j && (j.err || j.error)) || 'Couldn’t send'));
    }, function () { busy = false; draw(); toast('<i class="bi bi-wifi-off"></i> Offline – try again later'); });
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'data') load(); });
})();
