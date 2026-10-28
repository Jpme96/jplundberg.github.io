/* App bits shared by every /cmd page:
   - install as an app (service worker, so it opens fast and works offline once loaded)
   - a gentle monthly reminder to download an encrypted backup
   - Settings → Features: switch each part of the dashboard on or off */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- app install ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/cmd/sw.js', { scope: '/cmd/' }).catch(function () {});
    });
  }

  /* ---------- backup reminder (home page) ---------- */
  var DAY = 864e5;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function backupNote() {
    var el = $('backupNote');
    if (!el) return;
    var last = +lsGet('dash.lastBackup') || 0, snooze = +lsGet('dash.backupSnooze') || 0, now = Date.now();
    var first = +lsGet('dash.firstUse') || 0;
    if (!first) { lsSet('dash.firstUse', String(now)); first = now; }
    var due = last ? now - last > 30 * DAY : now - first > 7 * DAY;     // give a new setup a week first
    if (!due || now < snooze) { el.hidden = true; return; }
    var ago = last ? Math.floor((now - last) / DAY) : 0;
    el.innerHTML = '<i class="bi bi-shield-check"></i><span><b>Time for a backup.</b> ' +
      (last ? 'Your last one was ' + ago + ' days ago.' : 'You haven’t downloaded one yet.') +
      ' It’s encrypted with your passcode – keep it in iCloud Drive or OneDrive.</span>' +
      '<button type="button" class="pill-btn" data-backup-now><i class="bi bi-download"></i> Download</button>' +
      '<button type="button" class="text-btn" data-backup-later>Later</button>';
    el.hidden = false;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-backup-now]') && window.Vault) {
      window.Vault.backup().then(backupNote);
    } else if (e.target.closest('[data-backup-later]')) {
      lsSet('dash.backupSnooze', String(Date.now() + 7 * DAY));
      backupNote();
    }
  });
  window.addEventListener('dash:backup', backupNote);
  if (window.Vault) window.Vault.onUnlock(backupNote);

  /* ---------- Settings → Features ---------- */
  var F = window.Features;
  var box = $('ftList');
  if (!F || !box) return;
  var GROUP_ICON = { Everyday: 'grid-1x2', Work: 'briefcase', Habits: 'activity', Travel: 'airplane', Finance: 'wallet2' };
  var GROUP_NOTE = {
    Everyday: 'The main parts. Switching one off hides its page, card and calendar items – nothing is deleted.',
    Work: 'Turning on any of these adds a Work page to the menu.',
    Habits: 'Shown on the Habits page.',
    Travel: 'Shown under Trips on the Travel page.',
    Finance: 'Shown on the Finances page. Renewals and warranty dates also go in your calendar.'
  };
  function render() {
    var groups = [];
    F.LIST.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
    box.innerHTML = groups.map(function (g) {
      return '<p class="st-cardgroup"><i class="bi bi-' + GROUP_ICON[g] + '"></i> ' + g + '</p>' +
        F.LIST.filter(function (x) { return x.group === g; }).map(function (x) {
          return '<label class="st-row ft-row"><span class="st-ico" style="--c:' + x.c + '"><i class="bi bi-' + x.icon + '"></i></span>' +
            '<span class="st-label">' + x.name + '<small>' + x.desc + '</small></span>' +
            '<input type="checkbox" class="switch" data-feat="' + x.id + '"' + (F.on(x.id) ? ' checked' : '') + ' aria-label="' + x.name + '"></label>';
        }).join('') + '<p class="st-note ft-note">' + GROUP_NOTE[g] + '</p>';
    }).join('');
    summary();
  }
  function summary() {
    var s = $('sumFeatures');
    if (!s) return;
    var extra = F.LIST.filter(function (x) { return !x.def && F.on(x.id); }).length;
    s.textContent = F.LIST.filter(function (x) { return F.on(x.id); }).length + ' of ' + F.LIST.length + ' on' + (extra ? ' · ' + extra + ' extra' : '');
  }
  box.addEventListener('change', function (e) {
    var id = e.target.dataset && e.target.dataset.feat;
    if (id) F.set(id, e.target.checked);
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'features') render(); if (e.detail === 'home') summary(); });
  window.addEventListener('features:change', summary);
  if (window.Vault) window.Vault.onUnlock(summary);
  summary();
})();
