/* Money that only moves, and spending you'd otherwise count twice.
   - Transfers between your own accounts (Finances → Your accounts → Transfer, or ⌘K "Transfer"):
     d.transfers = [{ id, date, from, to, amount, note }]. Not spending. Each account's balance moves
     with it when the transfer is on or after the balance you last typed or imported (a credit card's
     "what you owe" goes down when money goes to it). Deleting a transfer moves the balances back.
   - Logged it yourself, then imported the bank row (or the other way round): when a spending you typed
     has the same amount as an imported bank row within three days, they become one – your entry keeps
     its category and note and takes the bank row's reference, so it counts once and a new import of
     the same file skips it. Undo keeps them apart for good (d.noMerge). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var V = window.Vault;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function num(v) { var s = String(v == null ? '' : v).replace(/[\s kr]/gi, ''); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); var x = parseFloat(s.replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function dayN(k) { return Math.round(new Date(String(k).slice(0, 10) + 'T12:00') / 864e5); }

  /* ---------------- one spending, not two ---------------- */
  var lastToast = 0, quiet = false;
  function merge(d) {
    var fc = window.Features && window.Features.tools().fintools; if (fc && fc.merge === false) return [];     /* Settings → Finances */
    var ex = Array.isArray(d && d.expenses) ? d.expenses : null; if (!ex || !ex.length) return [];
    var no = Array.isArray(d.noMerge) ? d.noMerge : [];
    var bank = ex.filter(function (e) { return e && e.src === 'bank' && e.ref && +e.amount > 0; });
    if (!bank.length) return [];
    var byAmt = {}; bank.forEach(function (b) { var k = Math.round(+b.amount); (byAmt[k] = byAmt[k] || []).push(b); });
    /* every possible pair first, then the closest days win (same day before the next day …);
       the bank usually books a card purchase on the day or a few days after */
    var cands = [];
    ex.forEach(function (m) {
      if (!m || m.src || m.ref || !(+m.amount > 0) || no.indexOf(m.id) > -1) return;
      var amt = +(m.full != null ? m.full : m.amount), k = Math.round(amt);
      [k - 1, k, k + 1].forEach(function (kk) { (byAmt[kk] || []).forEach(function (b) {
        var gap = dayN(b.date) - dayN(m.date);
        if (Math.abs(+b.amount - amt) < 1 && gap >= -1 && gap <= 3) cands.push({ m: m, b: b, g: Math.abs(gap) + (gap < 0 ? 0.5 : 0) });
      }); });
    });
    cands.sort(function (x, y) { return x.g - y.g || (y.m.t || 0) - (x.m.t || 0); });
    var used = {}, took = {}, pairs = [];
    cands.forEach(function (c) { if (used[c.b.id] || took[c.m.id]) return; used[c.b.id] = took[c.m.id] = 1; pairs.push([c.m, c.b]); });
    if (!pairs.length) return [];
    var gone = {};
    pairs.forEach(function (p) {
      var m = p[0], b = p[1];
      m.ref = b.ref; if (b.acct && !m.acct) m.acct = b.acct; m.bank = { id: b.id, note: b.note || '', date: b.date, cat: b.cat || '', acct: b.acct || null, t: b.t || null };
      gone[b.id] = 1;
    });
    d.expenses = ex.filter(function (e) { return !gone[e.id]; });
    return pairs;
  }
  function unmerge(mid) {
    var d = V.get(); if (!d) return;
    var m = (d.expenses || []).filter(function (e) { return e.id === mid; })[0]; if (!m || !m.bank) return;
    var b = m.bank;
    d.expenses.push({ id: b.id, t: b.t || Date.now(), date: b.date, amount: +(m.full != null ? m.full : m.amount), cat: b.cat || m.cat, note: b.note, src: 'bank', ref: m.ref, acct: b.acct || undefined });
    delete m.ref; delete m.bank; if (b.acct && m.acct === b.acct) delete m.acct;
    d.noMerge = (Array.isArray(d.noMerge) ? d.noMerge : []).concat([mid]).slice(-500);
    quiet = true; V.save(d); quiet = false;
    window.dispatchEvent(new Event('fin:change'));
  }
  /* every save: if something you typed now matches an imported bank row (or an import brought one in), merge them */
  var orig = V.save;
  V.save = function (obj) {
    var pairs = [];
    if (!quiet) try { pairs = merge(obj); } catch (e) {}
    var r = orig.apply(this, arguments);
    if (pairs.length && Date.now() - lastToast > 1500) {
      lastToast = Date.now();
      var p = pairs[0][0];
      setTimeout(function () {
        toast('<i class="bi bi-link-45deg"></i> ' + (pairs.length === 1 ? esc(p.note || 'Your entry') + ' ' + esc(kr(p.amount)) + ' matched the bank row – counted once' : pairs.length + ' entries matched bank rows – counted once'),
          pairs.length === 1 ? function () { unmerge(p.id); } : null);
        window.dispatchEvent(new Event('fin:change'));
      }, 0);
    }
    return r;
  };
  V.onUnlock(function () { setTimeout(function () { var d = V.get(); if (d && merge(d).length) { V.save(d); window.dispatchEvent(new Event('fin:change')); } }, 400); });

  /* ---------------- transfers ---------------- */
  function A() { return window.Accts; }
  function setBal(d, id, delta, date, force) {
    if (!A()) return false;
    var a = A().get(d, id); if (!a || a.bal == null || (!force && a.balAt && date < a.balAt)) return false;
    var list = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
    var o = list.filter(function (x) { return x.id === id; })[0];
    if (!o) { o = { id: id, kind: a.kind }; list.push(o); }
    o.bal = Math.round(((+a.bal || 0) + delta) * 100) / 100;
    if (!force && (!o.balAt || date > o.balAt)) o.balAt = date;
    return true;
  }
  /* how a transfer moves each account: out of "from", into "to"; on a credit card in = less owed */
  function sign(d, id, into) { var k = A() ? A().kind(d, id) : null; return (k === 'credit' ? -1 : 1) * (into ? 1 : -1); }
  function apply(d, t, back, force) {
    var f = back ? -1 : 1;
    t.moved = t.moved || {};
    if (back) { if (t.moved.from) setBal(d, t.from, -sign(d, t.from, false) * t.amount, t.date, true); if (t.moved.to) setBal(d, t.to, -sign(d, t.to, true) * t.amount, t.date, true); return; }
    t.moved.from = setBal(d, t.from, f * sign(d, t.from, false) * t.amount, t.date, force);
    t.moved.to = setBal(d, t.to, f * sign(d, t.to, true) * t.amount, t.date, force);
  }
  /* a balance typed or imported after the transfer's date is taken to include it – unless you say it doesn't */
  function newer(d, id, date) { var a = A() && A().get(d, id); return a && a.bal != null && a.balAt && date < a.balAt ? a : null; }
  function notMoved(d, t) {
    var out = []; if (!t || !t.moved || !A()) return out;
    [['from', t.from], ['to', t.to]].forEach(function (s) { var a = A().get(d, s[1]); if (!t.moved[s[0]] && a && a.bal != null) out.push(s[0]); });
    return out;
  }
  function fix(id) {
    var d = V.get(); if (!d) return false;
    var t = (d.transfers || []).filter(function (x) { return x.id === id; })[0]; if (!t) return false;
    var l = notMoved(d, t); if (!l.length) return false;
    l.forEach(function (side) { t.moved[side] = setBal(d, t[side], sign(d, t[side], side === 'to') * t.amount, t.date, true); });
    V.save(d); window.dispatchEvent(new Event('fin:change'));
    return true;
  }
  function add(t) {
    var d = V.get(); if (!d) return null;
    d.budget = d.budget || { income: [], fixed: [] };
    d.transfers = Array.isArray(d.transfers) ? d.transfers : [];
    var x = { id: 'tr' + uid(), date: t.date || today(), from: t.from, to: t.to, amount: Math.round(t.amount * 100) / 100, note: (t.note || '').slice(0, 60) };
    if (t.moved && typeof t.moved === 'object') x.moved = t.moved;
    if (x.moved) { /* put back (Undo): only the sides that had moved */
      var mv = x.moved; x.moved = {}; ['from', 'to'].forEach(function (side) { if (mv[side]) x.moved[side] = setBal(d, x[side], sign(d, x[side], side === 'to') * x.amount, x.date, true); });
    } else apply(d, x, false, !!t.force);
    d.transfers.push(x);
    if (d.transfers.length > 300) d.transfers = list(d).slice(0, 300);        /* the oldest go, the list never grows without end */
    V.save(d); window.dispatchEvent(new Event('fin:change'));
    return x;
  }
  function remove(id) {
    var d = V.get(); if (!d) return;
    var x = (d.transfers || []).filter(function (t) { return t.id === id; })[0]; if (!x) return;
    apply(d, x, true);
    d.transfers = d.transfers.filter(function (t) { return t.id !== id; });
    V.save(d); window.dispatchEvent(new Event('fin:change'));
    return x;
  }
  /* repeating transfers: d.transferRules [{id, from, to, amount, day (1–28, 31 = last day), note, last: 'YYYY-MM'}] –
     made on the day each month (or the next time the dashboard is opened) */
  function rules(d) { return Array.isArray(d && d.transferRules) ? d.transferRules : []; }
  function addRule(r) { var d = V.get(); if (!d) return; d.transferRules = rules(d).concat([Object.assign({ id: 'tq' + uid() }, r)]); V.save(d); window.dispatchEvent(new Event('fin:change')); }
  function dropRule(id) { var d = V.get(); if (!d) return null; var r = rules(d).filter(function (x) { return x.id === id; })[0]; d.transferRules = rules(d).filter(function (x) { return x.id !== id; }); V.save(d); window.dispatchEvent(new Event('fin:change')); return r; }
  function dayOf(r, y, m) { var last = new Date(y, m + 1, 0).getDate(); return Math.min(+r.day || 1, last); }
  function runRules() {
    var d = V.get(); if (!d || !rules(d).length) return;
    var now = new Date(), ym = now.getFullYear() + '-' + pad(now.getMonth() + 1), made = [];
    rules(d).forEach(function (r) {
      if (r.last >= ym) return; var dd = dayOf(r, now.getFullYear(), now.getMonth()); if (now.getDate() < dd) return;
      r.last = ym; made.push({ from: r.from, to: r.to, amount: +r.amount, date: ym + '-' + pad(dd), note: r.note || 'Monthly' });
    });
    if (!made.length) return;
    V.save(d);
    made.forEach(function (t) { add(t); });
    toast('<i class="bi bi-arrow-repeat"></i> ' + (made.length === 1 ? 'Monthly transfer made: ' + esc(kr(made[0].amount)) + ' → ' + esc(label(V.get(), made[0].to)) : made.length + ' monthly transfers made'));
  }
  V.onUnlock(function () { setTimeout(runRules, 1800); });
  function list(d) { return (Array.isArray(d && d.transfers) ? d.transfers : []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function label(d, id) { var a = A() && A().get(d, id); return a ? a.label : 'Removed account'; }

  function sheet(pre) {
    var d = V.get(); if (!d || !A()) return;
    var accts = A().list(d); if (accts.length < 2) { toast('<i class="bi bi-bank2"></i> Add a second account first (Finances → Accounts → Bills → Edit accounts)'); return; }
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    var opt = function (sel) { return accts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join(''); };
    var ed = pre && pre.edit ? pre.edit : null;
    if (ed) pre = Object.assign({}, pre, { from: ed.from, to: ed.to });
    var from0 = (pre && pre.from) || (accts.filter(function (a) { return a.kind === 'salary'; })[0] || accts[0]).id;
    var to0 = (pre && pre.to) || (accts.filter(function (a) { return a.id !== from0 && (a.kind === 'savings' || a.kind === 'card'); })[0] || accts.filter(function (a) { return a.id !== from0; })[0]).id;
    function recent() {
      var l = list(V.get()).slice(0, 6);
      return l.length ? '<p class="mp-lbl" data-t="ui.recent-transfers">Recent transfers</p><ul class="mp-list tr-list">' + l.map(function (t) {
        return '<li class="mp-row"><span class="kit-ic" style="--c:#3987e5"><i class="bi bi-arrow-left-right"></i></span><span class="kit-x"><b>' + esc(label(V.get(), t.from)) + ' → ' + esc(label(V.get(), t.to)) + '</b><small>' +
          esc(new Date(t.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (t.note ? ' · ' + t.note : '')) + '</small></span><span class="money">' + esc(kr(t.amount)) + '</span>' +
          '<button type="button" class="icon-btn sm" data-trdel="' + esc(t.id) + '" aria-label="Delete transfer"><i class="bi bi-trash3"></i></button></li>';
      }).join('') + '</ul>' : '';
    }
    function draw() {
      bg.innerHTML = '<form class="fo-box lf-box mp-box" role="dialog" aria-modal="true" aria-label="Transfer" data-t-aria-label="ui.transfer"><div class="lf-head"><h3><i class="bi bi-arrow-left-right"></i> ' + (ed ? 'Edit transfer' : 'Transfer between accounts') + '</h3><button type="button" class="icon-btn sm" data-x aria-label="Close" data-t-aria-label="ui.close"><i class="bi bi-x-lg"></i></button></div>' +
        '<p class="muted" data-t="ui.money-you-move-between-your-own-accounts">Money you move between your own accounts – it isn’t spending. The balances move with it.</p>' +
        '<div class="mp-grid tr-grid"><label><span data-t="ui.from">From</span><select name="from">' + opt(from0) + '</select></label><button type="button" class="icon-btn sm tr-swap" data-trswap aria-label="Swap" data-t-aria-label="ui.swap"><i class="bi bi-arrow-down-up"></i></button><label><span data-t="ui.to">To</span><select name="to">' + opt(to0) + '</select></label></div>' +
        '<div class="mp-grid"><input name="amt" inputmode="decimal" placeholder="Amount, kr" autocomplete="off" required aria-label="Amount, kr" value="' + (ed ? esc(String(ed.amount).replace('.', ',')) : '') + '"><input name="date" type="date" value="' + (ed ? esc(ed.date) : today()) + '" aria-label="Date"></div>' +
        '<input name="note" maxlength="60" placeholder="Note (optional) – e.g. Savings" autocomplete="off" aria-label="Note" value="' + (ed ? esc(ed.note || '') : '') + '">' +
        (ed ? '' : '<label class="tr-rep"><span data-t="ui.repeat">Repeat</span><select name="rep"><option value="" data-t="ui.just-this-once">Just this once</option>' + (function () { var o = ''; for (var i = 1; i <= 28; i++) o += '<option value="' + i + '">Every month on the ' + i + (i % 10 === 1 && i !== 11 ? 'st' : i % 10 === 2 && i !== 12 ? 'nd' : i % 10 === 3 && i !== 13 ? 'rd' : 'th') + '</option>'; return o + '<option value="31" data-t="ui.every-month-on-the-last-day">Every month on the last day</option>'; })() + '</select></label>') +
        '<p class="mp-prev" id="trPrev"></p>' +
        '<div class="lf-foot"><span class="spacer"></span><button type="submit" class="pill-btn wide"><i class="bi bi-check2"></i> ' + (ed ? 'Save' : 'Move it') + '</button></div></form>';
      prev();
    }
    function prev() {
      var f = bg.querySelector('form'), el = bg.querySelector('#trPrev'); if (!f || !el) return;
      var dd = V.get(), a = A().get(dd, f.from.value), b = A().get(dd, f.to.value), n = num(f.amt.value);
      if (f.from.value === f.to.value) { el.innerHTML = '<span class="mp-neg" data-t="ui.pick-two-different-accounts">Pick two different accounts.</span>'; return; }
      if (!(n > 0)) { el.textContent = ''; return; }
      var after = function (x, into) { if (!x || x.bal == null) return null; var v = x.bal + sign(dd, x.id, into) * n; return x.kind === 'credit' ? 'you owe ' + kr(Math.max(0, v)) : kr(v); };
      var fa = after(a, false), ta = after(b, true);
      el.innerHTML = [fa ? '<span>' + esc(a.label + ' after: ' + fa) + '</span>' : '', ta ? '<span>' + esc(b.label + ' after: ' + ta) + '</span>' : ''].filter(Boolean).join('<br>');
      var dt = f.date.value || today(), nw = [newer(dd, f.from.value, dt), newer(dd, f.to.value, dt)].filter(Boolean), box = bg.querySelector('#trForce');
      if (nw.length) {
        var keep = box ? box.querySelector('input').checked : true;
        var txt = nw.map(function (x) { return x.label; }).join(' and ') + (nw.length > 1 ? ' were' : ' was') + ' updated ' + new Date(nw[0].balAt + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', after this date';
        if (!box) { box = document.createElement('label'); box.id = 'trForce'; box.className = 'tr-force'; el.after(box); }
        box.innerHTML = '<input type="checkbox" name="force"' + (keep ? ' checked' : '') + '><span>Move the balances anyway<small>' + esc(txt) + '. Untick if that balance already includes this transfer.</small></span>';
      } else if (box) box.remove();
    }
    document.body.appendChild(bg); draw(); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 180); };
    bg.addEventListener('input', prev); bg.addEventListener('change', prev);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-x]')) { close(); return; }
      if (e.target.closest('[data-trswap]')) { var f = bg.querySelector('form'), x = f.from.value; f.from.value = f.to.value; f.to.value = x; prev(); return; }
      var del = e.target.closest('[data-trdel]');
      if (del) { var gone = remove(del.dataset.trdel); var f2 = bg.querySelector('form'), keep = { from: f2.from.value, to: f2.to.value, amt: f2.amt.value }; from0 = keep.from; to0 = keep.to; draw(); bg.querySelector('[name=amt]').value = keep.amt;
        if (gone) toast('<i class="bi bi-trash3"></i> Transfer deleted – balances moved back', function () { add(gone); }); }
    });
    bg.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, n = num(f.amt.value);
      if (!(n > 0)) { f.amt.focus(); return; }
      if (f.from.value === f.to.value) { f.to.focus(); return; }
      var old = ed ? remove(ed.id) : null;
      var x = add({ from: f.from.value, to: f.to.value, amount: n, date: f.date.value || today(), note: f.note.value.trim(), force: !!(f.force && f.force.checked) || !!(old && old.moved && (old.moved.from || old.moved.to)) });
      if (f.rep && f.rep.value) addRule({ from: x.from, to: x.to, amount: n, day: +f.rep.value, note: x.note, last: x.date.slice(0, 7) });
      close();
      if (ed && x) { toast('<i class="bi bi-check2"></i> Transfer saved', function () { remove(x.id); add(old); }); return; }
      if (x) toast('<i class="bi bi-arrow-left-right"></i> ' + esc(kr(n)) + ' moved: ' + esc(label(V.get(), x.from)) + ' → ' + esc(label(V.get(), x.to)) + (notMoved(V.get(), x).length ? ' · balances not changed' : ''), function () { remove(x.id); });
    });
    setTimeout(function () { var i = bg.querySelector('[name=amt]'); if (i && !matchMedia('(pointer: coarse)').matches) i.focus(); }, 60);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-transfer]')) { e.preventDefault(); sheet(); return; }
    var ed = !e.target.closest('button') && e.target.closest('[data-tredit]'); if (ed) { e.preventDefault(); var t = (V.get().transfers || []).filter(function (x) { return x.id === ed.dataset.tredit; })[0]; if (t) sheet({ edit: t }); return; }
    var rq = e.target.closest('[data-trruledel]'); if (rq) { e.preventDefault(); var r = dropRule(rq.dataset.trruledel); if (r) toast('<i class="bi bi-arrow-repeat"></i> Monthly transfer stopped', function () { var d = V.get(); d.transferRules = rules(d).concat([r]); V.save(d); window.dispatchEvent(new Event('fin:change')); }); }
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () { return V.get() ? [{ i: 'arrow-left-right', t: 'Transfer between accounts', s: 'Finances', run: function () { sheet(); }, x: 'transfer move money overføring flytt penger konto sparing' }] : []; });
  /* opened from another page (Quick add → Transfer) */
  if (/[?&]transfer=1/.test(location.search)) V.onUnlock(function () { setTimeout(function () { if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.hash); sheet(); }, 500); });
  /* delete with Undo for anything in the vault: keep a copy, do it, Undo puts the copy back (5 s) */
  window.VaultUndo = function (html, fn) {
    var snap = JSON.parse(JSON.stringify(V.get() || {})); fn();
    toast(html, function () { V.save(snap); window.dispatchEvent(new Event('fin:change')); window.dispatchEvent(new Event('dash:local')); });
  };
  window.FinMoves = { rules: rules, transfer: sheet, add: add, remove: remove, list: list, notMoved: notMoved, fix: fix, merge: merge, unmerge: unmerge };
})();
