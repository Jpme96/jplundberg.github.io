/* Insurance overview (Papers) and plant care (House → Upkeep), Nov 2026.
   · Insurance: every paper of the kind Insurance in one table – who with, what it covers, the excess, the price a
     year and when it renews, with the total; At a glance asks you to compare prices before one renews.
   · Plants: each plant with how often it wants water; tick it when you've watered, and At a glance tells you which
     are thirsty. Data: dash.tools.plants [{id, name, room, every (days), last}], settings dash.tools.homemore. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit || null;
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function days(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function chip(t, c) { return '<span class="hl-chip" style="--c:' + c + '">' + t + '</span>'; }
  function cfg() { var c = Fe.tools().homemore; return Object.assign({ compare: true, compareLead: 45, plantBrief: true }, c && typeof c === 'object' ? c : {}); }
  function setCfg(p) { var t = Fe.tools(); t.homemore = Object.assign({}, t.homemore || {}, p); Fe.saveTools(t); }

  /* ================= Insurance overview ================= */
  function policies() { return Fe.on('papers') ? Fe.list('papers').filter(function (x) { return x.kind === 'insurance'; }) : []; }
  function drawIns() {
    var el = $t('pins'); if (!el) return;
    var l = policies(), P = window.Papers;
    if (!l.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var total = l.reduce(function (a, x) { return a + (+x.cost || 0); }, 0);
    el.innerHTML = '<section class="card kit-card" id="pins"><div class="card-head"><h2><i class="bi bi-shield-check"></i> Your insurance</h2><span class="muted">' + (total ? esc(kr(total)) + ' a year' : '') + '</span></div>' +
      '<ul class="ins-l">' + l.slice().sort(function (a, b) { var sa = P && P.status ? P.status(a) : null, sb = P && P.status ? P.status(b) : null; return (sa ? sa.n : 1e6) - (sb ? sb.n : 1e6); }).map(function (x) {
        var st = P && P.status ? P.status(x) : null;
        return '<li><a href="#papers=' + esc(x.id) + '"><b>' + esc(x.title) + '</b><small>' + esc([x.who, x.covers].filter(Boolean).join(' · ') || 'Add what it covers on the paper') + '</small></a>' +
          '<span class="ins-n"><b class="money">' + (x.cost ? esc(kr(x.cost)) + '<small>/yr</small>' : '–') + '</b><small>' + (x.excess ? 'excess ' + esc(kr(x.excess)) : 'no excess noted') + '</small></span>' +
          (st ? chip(esc(st.rel), st.over ? '#e66767' : st.soon ? '#c98500' : '#7a8794') : '') + '</li>';
      }).join('') + '</ul>' +
      '<p class="muted hl-small">Before one renews, compare a couple of offers (finn.no/forsikring, or ask your bank) – it’s often cheaper to move. Fill in “What it covers” and the excess on each insurance paper.</p></section>';
  }

  /* ================= Plant care ================= */
  var EV = [[3, 'Every 3 days'], [5, 'Every 5 days'], [7, 'Every week'], [10, 'Every 10 days'], [14, 'Every 2 weeks'], [21, 'Every 3 weeks'], [30, 'Once a month']];
  function due(p) { return isKey(p.last) ? addDays(p.last, +p.every || 7) : today(); }
  function water(id) {
    var t = Fe.tools(), was = null; (t.plants || []).forEach(function (p) { if (p.id === id) { was = p.last; p.last = today(); } }); Fe.saveTools(t);
    toast('<i class="bi bi-droplet"></i> Watered', function () { var t2 = Fe.tools(); (t2.plants || []).forEach(function (p) { if (p.id === id) p.last = was; }); Fe.saveTools(t2); });
  }
  var plantsCol = K && $t('hplants') ? K.collection({
    mount: $t('hplants'), feature: 'house', key: 'plants', icon: 'flower1', title: 'Plants', addLabel: 'Add', limit: 8,
    addTitle: 'New plant', editTitle: 'Edit plant', fields: [
      { k: 'name', type: 'title', label: 'Plant', ph: 'e.g. Monstera, basil, the fig tree', req: true },
      { k: 'room', label: 'Where', ph: 'e.g. Living room window' },
      { k: 'every', label: 'Water', type: 'select', options: EV, def: 7 },
      { k: 'last', label: 'Last watered', type: 'date', def: today },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Light, fertiliser, when to repot …' }],
    beforeSave: function (it) { it.every = +it.every || 7; },
    empty: 'Add your plants with how often they want water – tick them off when you’ve watered and you’re told which ones are thirsty.',
    sort: function (a, b) { return due(a) < due(b) ? -1 : 1; },
    row: function (p) {
      var n = days(today(), due(p)), c = n < 0 ? '#e66767' : n === 0 ? '#c98500' : '#22b35e';
      return { icon: 'flower1', color: '#2f9e57', title: p.name, sub: esc([p.room, (EV.filter(function (x) { return x[0] === +p.every; })[0] || [0, ''])[1].toLowerCase()].filter(Boolean).join(' · ')),
        right: chip(n < 0 ? 'Thirsty' : n === 0 ? 'Today' : 'In ' + n + (n === 1 ? ' day' : ' days'), c) + '<span role="button" tabindex="0" class="check pl-w" data-plwater="' + esc(p.id) + '" aria-label="Watered ' + esc(p.name) + '"><i class="bi bi-droplet-fill"></i></span>' };
    }
  }) : null;
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-plwater]'); if (b) { e.preventDefault(); e.stopPropagation(); water(b.dataset.plwater); } }, true);

  /* ================= At a glance ================= */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    var c = cfg(), t = today();
    if (c.compare) policies().forEach(function (x) {
      var st = window.Papers && window.Papers.status ? window.Papers.status(x) : null; if (!st || st.over || st.n > +c.compareLead) return;
      if (st.n === +c.compareLead || st.n === 14 || st.n <= 3) add(64, 'shield-check', '#22b35e', 'Compare prices for ' + x.title, 'Renews ' + st.rel + (x.cost ? ' · ' + kr(x.cost) + ' a year now' : ''), '/cmd/papers/#papers=' + x.id);
    });
    if (c.plantBrief && Fe.on('house')) {
      var th = Fe.list('plants').filter(function (p) { return due(p) <= t; });
      if (th.length) add(56, 'droplet', '#2f9e57', th.length === 1 ? 'Water ' + th[0].name : 'Water ' + th.length + ' plants', th.slice(0, 3).map(function (p) { return p.name; }).join(', '), '/cmd/house/#hplants',
        { main: true, act: { id: 'plw:' + t, label: 'Watered' }, run: function () { var tt = Fe.tools(); (tt.plants || []).forEach(function (p) { if (due(p) <= t) p.last = t; }); Fe.saveTools(tt); } });
    }
  });

  /* ================= Settings: Papers (insurance) under Settings → Pages → … and House ================= */
  function setFill(page) {
    var id = page === 'house' ? 'hlSet-house4' : null; var box = id && document.getElementById(id); if (!box || box.contains(document.activeElement)) return;
    var c = cfg(), sw = function (f, l, s) { return '<label class="st-row"><span>' + esc(l) + '<small class="st-rsub">' + esc(s) + '</small></span><input type="checkbox" class="switch" data-hmcfg="' + f + '"' + (c[f] ? ' checked' : '') + '></label>'; };
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-flower1"></i> Plants and insurance</p><div class="st-group">' + sw('plantBrief', 'Thirsty plants in At a glance', 'With a Watered button') +
      sw('compare', 'Compare insurance prices before they renew', '45 days, 2 weeks and a few days before – from the insurance papers in Papers') + '</div>';
  }
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-hmcfg]'); if (!i) return; var p = {}; p[i.dataset.hmcfg] = i.checked; setCfg(p); toast('<i class="bi bi-check2"></i> Saved'); });
  window.addEventListener('st:page', function (e) { setTimeout(function () { setFill(e.detail); }, 0); });
  if ($t('pins')) { ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(drawIns, 30); }); }); window.Vault.onUnlock(function () { setTimeout(drawIns, 100); }); }
})();
