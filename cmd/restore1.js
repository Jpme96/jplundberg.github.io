/* Restore a single item (later features): Settings → Data & sync → a day → "Pick items" opens that day's copy (with
   your passcode, without switching to it) and lists what's gone since then – to-dos, things in your lists (recipes,
   people, chores …), expenses – each with its own Restore. Only that one thing comes back; nothing else changes. */
(function () {
  'use strict';
  if (window.Restore1) return;
  var NB = function () { return window.I18N && window.I18N.lang === 'nb'; };
  function L(en, nb) { return NB() ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rj(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function label(x) { return String(x.text || x.title || x.name || x.note || x.desc || x.id || '').slice(0, 90); }
  var NAMES = { 'dash.todos': ['To-dos', 'Gjøremål'], expenses: ['Expenses', 'Utgifter'] };
  var gone = [];
  /* what the old copy has that today's doesn't: [{ where, list, item }] */
  function diff(old) {
    var out = [], w = old._w || {}, Fe = window.Features, now = window.Vault.get() || {};
    var ids = function (l) { var o = {}; (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.id != null) o[x.id] = 1; }); return o; };
    var cmp = function (where, list, a, b) { var have = ids(b); (Array.isArray(a) ? a : []).forEach(function (x) { if (x && typeof x === 'object' && x.id != null && !have[x.id] && label(x)) out.push({ where: where, list: list, item: x }); }); };
    if (w['dash.todos']) cmp('w', 'dash.todos', w['dash.todos'], rj('dash.todos'));
    var ot = w['dash.tools'] || {}, nt = Fe ? Fe.rawTools ? Fe.rawTools() : Fe.tools() : (rj('dash.tools') || {});
    Object.keys(ot).forEach(function (k) { if (Array.isArray(ot[k])) cmp('t', k, ot[k], nt[k]); });
    Object.keys(old).forEach(function (k) { if (k !== '_w' && k !== '_pc' && Array.isArray(old[k])) cmp('v', k, old[k], now[k]); });
    return out;
  }
  function sheet(day, list) {
    var old = document.getElementById('r1Sheet'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'r1Sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('data-noi18n', '');
    el.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center';
    var groups = {}; list.forEach(function (x, i) { (groups[x.list] = groups[x.list] || []).push(i); });
    el.innerHTML = '<div style="width:100%;max-width:560px;max-height:86vh;overflow:auto;background:var(--card,#16191f);color:var(--text,inherit);border-radius:22px 22px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(L('Gone since ', 'Borte siden ') + new Date(day + 'T12:00').toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + '</b><button type="button" data-r1x aria-label="' + L('Close', 'Lukk') + '" style="width:40px;height:40px;border:0;background:transparent;color:inherit;font-size:18px"><i class="bi bi-x-lg"></i></button></div>' +
      (list.length ? Object.keys(groups).map(function (g) { var nm = NAMES[g] ? L(NAMES[g][0], NAMES[g][1]) : g.charAt(0).toUpperCase() + g.slice(1);
        return '<p style="margin:12px 0 4px;font-size:13px;opacity:.7">' + esc(nm) + '</p><ul style="list-style:none;margin:0;padding:0">' + groups[g].map(function (i) { return '<li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.15)"><span>' + esc(label(list[i].item)) + '</span><button type="button" class="text-btn" data-r1="' + i + '">' + L('Restore', 'Gjenopprett') + '</button></li>'; }).join('') + '</ul>'; }).join('')
        : '<p>' + L('Nothing is missing – everything from that day is still here.', 'Ingenting mangler – alt fra den dagen er fortsatt her.') + '</p>') + '</div>';
    document.body.appendChild(el); wire(el);
  }
  function put(x) {
    if (x.where === 'w') { var l = rj(x.list) || []; l.push(x.item); try { localStorage.setItem(x.list, JSON.stringify(l)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
    else if (x.where === 't') { var Fe = window.Features, t = Fe.tools(); t[x.list] = (Array.isArray(t[x.list]) ? t[x.list] : []).concat([x.item]); Fe.saveTools(t); }
    else { var d = window.Vault.get(); d[x.list] = (Array.isArray(d[x.list]) ? d[x.list] : []).concat([x.item]); window.Vault.save(d); }
  }
  function open(day, b) {
    if (b) b.disabled = true;
    fetch('/cmd/api/vault?snap=' + day, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (v) { return window.Vault.peek(v); }).then(function (old) { gone = diff(old || {}); sheet(day, gone); })
      .catch(function () { if (window.Quick && Quick.toast) Quick.toast(L('Couldn’t open that day – it may have another passcode.', 'Kunne ikke åpne den dagen – den kan ha en annen kode.')); })
      .then(function () { if (b) b.disabled = false; });
  }
  /* the sheet's own buttons (a listener on the sheet, so nothing is left on the page after it closes) */
  function wire(el) {
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-r1x]') || e.target === el) { el.remove(); return; }
      if ((b = e.target.closest('[data-r1]'))) { var x = gone[+b.dataset.r1]; if (!x) return; put(x); b.textContent = L('Restored', 'Gjenopprettet'); b.disabled = true; if (window.Quick && Quick.toast) Quick.toast('<i class="bi bi-arrow-counterclockwise"></i> ' + esc(label(x.item)) + L(' is back', ' er tilbake')); }
    });
  }
  window.Restore1 = { diff: diff, open: open };
})();
