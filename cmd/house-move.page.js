/* Take-over day (Nov 2026): a step-by-step guide for the day you get the keys – House → Shared.
     1 Before the day   – what to bring and have ready
     2 Meter readings   – electricity (also saved in Electricity meter), water, heating … each with a photo
     3 Keys and codes   – how many you should get and how many you got
     4 Walk-through     – what to test, and faults with photos; a fault can become a reklamasjon claim in one tap
     5 Sign the protocol – check the agent's protocol has it all, make your own record (PDF), keep the signed one
     6 After            – the moving checklist, and how to report what you find later
   The date is the take-over date from the Shared home card (dash.tools.hmove.date).
   Data: dash.tools.htake = { prep:{id:1}, meters:[{id,kind,label,value,unit,photo}], keys:[{id,label,want,got}],
     checks:{id:1}, faults:[{id,room,text,big,photos:[],claim}], seller, agent, addr, kind 'used'|'new', notes,
     signed, protocol (FDV binder doc id), open (step), hide }. Photos: house-files.js (tk-…). */
/* The page part of house-move.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is house-move.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["move"]; if (!__c) return;
  var Fe = __c.Fe, T = __c.T, arr = __c.arr, num = __c.num, CHECKS = __c.CHECKS, fmt = __c.fmt, move = __c.move, date = __c.date, daysTo = __c.daysTo, esc = __c.esc, fromKey = __c.fromKey, HF = __c.HF, METERS = __c.METERS, nf = __c.nf, today = __c.today, isKey = __c.isKey, record = __c.record;
  var el = document.querySelector('[data-tool="htake"]');
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function save(fn) { var t = Fe.tools(), x = t.htake && typeof t.htake === 'object' && !Array.isArray(t.htake) ? t.htake : {}; fn(x); t.htake = x; Fe.saveTools(t); }
  var PREP = [['id', 'ID for both of you', 'person-vcard'], ['phone', 'A charged phone – for photos of meters and faults', 'phone'], ['torch', 'A torch and a tape measure', 'flashlight'],
    ['papers', 'The purchase contract and the condition report (tilstandsrapport)', 'file-earmark-text'], ['time', 'A time agreed with the estate agent or the seller', 'clock'],
    ['power', 'Power contract and contents insurance from the day', 'lightning-charge']];
  var KEYS = [['House or flat keys', 2], ['Entrance key or tag (brikke)', 2], ['Mailbox', 1], ['Storage room (bod)', 1], ['Garage or remote', 0]];
  var ROOMS = ['Hall', 'Living room', 'Kitchen', 'Bathroom', 'Bedroom', 'Storage', 'Balcony or outdoors', 'Other'];
  var STEPS = [['prep', 'Before the day', 'bag-check'], ['meters', 'Meter readings', 'speedometer2'], ['keys', 'Keys and codes', 'key'], ['walk', 'Walk-through', 'search'], ['sign', 'Sign the protocol', 'pen'], ['after', 'After moving in', 'house-check']];
  function ensure() {
    var t = T(); if (t.meters && t.keys) return;
    save(function (x) {
      if (!Array.isArray(x.meters)) x.meters = [{ id: 'mp', kind: 'power', label: '', value: '', photo: '' }];
      if (!Array.isArray(x.keys)) x.keys = KEYS.map(function (k, i) { return { id: 'k' + i, label: k[0], want: k[1], got: '' }; });
      if (!Array.isArray(x.faults)) x.faults = [];
    });
  }
  function stepState(id, t) {
    if (id === 'prep') { var n = PREP.filter(function (p) { return (t.prep || {})[p[0]]; }).length; return { done: n === PREP.length, text: n + ' of ' + PREP.length }; }
    if (id === 'meters') { var m = arr(t.meters), w = m.filter(function (x) { return num(x.value) != null; }).length; return { done: m.length && w === m.length, text: w ? w + ' read' : 'not read yet' }; }
    if (id === 'keys') { var k = arr(t.keys).filter(function (x) { return +x.want > 0 || num(x.got) != null; }), g = k.filter(function (x) { return num(x.got) != null; }), miss = k.filter(function (x) { return num(x.got) != null && +x.got < +x.want; }).length; return { done: k.length && g.length === k.length && !miss, warn: miss > 0, text: miss ? miss + ' missing' : g.length ? g.length + ' of ' + k.length + ' counted' : 'not counted yet' }; }
    if (id === 'walk') { var c = CHECKS.filter(function (x) { return (t.checks || {})[x[0]]; }).length, f = arr(t.faults).length; return { done: c === CHECKS.length, warn: f > 0, text: c + ' of ' + CHECKS.length + ' checked' + (f ? ' · ' + f + (f === 1 ? ' fault' : ' faults') : '') }; }
    if (id === 'sign') return { done: !!t.signed, text: t.signed ? 'signed ' + fmt(t.signed) : 'not yet' };
    var mv = move(), items = mv ? arr(mv.items) : [], left = items.filter(function (x) { return !x.done; }).length;
    return { done: items.length && !left, text: items.length ? (left ? left + ' left on the moving list' : 'moving list done') : '' };
  }
  function visible() {
    if (!el || !Fe.on('house')) return false;
    var t = T(); if (t.hide) return false;
    var d = date(); if (!d) return true;
    return daysTo(d) >= -90;
  }
  function typing() { var a = document.activeElement; return a && el && el.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|file|button|submit)$/.test(a.type))); }
  if (el) el.addEventListener('focusout', function () { setTimeout(function () { if (el._wait && !typing()) { el._wait = false; draw(); } }, 400); });
  function draw() {
    if (!el) return;
    if (typing()) { el._wait = true; return; }
    if (!visible()) { el.hidden = true; if (el.innerHTML) el.innerHTML = ''; return; }
    el.hidden = false;
    var t = T(), d = date(), html;
    if (!d) {
      html = '<section class="card kit-card hx-card" id="htake"><div class="card-head"><h2><i class="bi bi-key"></i> <span data-t="ui.take-over-day">Take-over day</span></h2></div>' +
        '<p class="muted hx-lead" data-t="ui.getting-the-keys-to-a-new-home-a-step-by">Getting the keys to a new home? A step-by-step for the day itself: meter readings with photos, keys, the walk-through with faults, and the protocol.</p>' +
        '<form class="hx-row" data-tkdate><label class="hx-f"><span data-t="ui.take-over-date"><span data-t="ui.take-over-date">Take-over date</span></span><input type="date" name="d" required></label><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.start">Start</span></button><button type="button" class="text-btn" data-tkhide data-t="ui.not-moving-hide">Not moving – hide</button></form></section>';
      el.innerHTML = html; return;
    }
    ensure(); t = T();
    var n = daysTo(d), open = t.open || (n > 1 ? 'prep' : n >= 0 ? 'meters' : 'after');
    var states = STEPS.map(function (s) { return stepState(s[0], t); }), done = states.filter(function (s) { return s.done; }).length;
    html = '<section class="card kit-card hx-card" id="htake"><div class="card-head"><h2><i class="bi bi-key"></i> <span data-t="ui.take-over-day">Take-over day</span> <small class="fold-sum">' + esc(n > 1 ? 'in ' + n + ' days' : n === 1 ? 'tomorrow' : n === 0 ? 'today' : (-n) + ' days ago') + ' · ' + done + '/' + STEPS.length + '</small></h2><div class="head-actions">' +
      '<button type="button" class="text-btn" data-tkpdf><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.record">Record</span></button><button type="button" class="text-btn" data-tkset aria-label="Details" data-t-aria-label="ui.details"><i class="bi bi-sliders"></i></button></div></div>' +
      '<div class="hx-when"><span class="hx-day"><b>' + esc(fromKey(d).getDate()) + '</b><small>' + esc(fromKey(d).toLocaleDateString('en-GB', { month: 'short' })) + '</small></span><span><b>' + esc(n > 1 ? 'In ' + n + ' days' : n === 1 ? 'Tomorrow' : n === 0 ? 'Today – good luck!' : (-n) + ' days ago') + '</b><small>' +
      esc([t.addr, t.seller ? 'from ' + t.seller : ''].filter(Boolean).join(' · ') || 'Add the address and seller under the sliders') + '</small></span><span class="hx-prog"><b>' + done + '/' + STEPS.length + '</b><small data-t="ui.steps-2"><span data-t="ui.steps-2">steps</span></small></span></div>' +
      '<ol class="hx-steps">' + STEPS.map(function (s, i) {
        var st = states[i], isOpen = open === s[0];
        return '<li class="hx-step' + (isOpen ? ' open' : '') + (st.done ? ' done' : '') + (st.warn ? ' warn' : '') + '"><button type="button" class="hx-sh" data-tkstep="' + s[0] + '" aria-expanded="' + isOpen + '"><span class="hx-n">' + (st.done ? '<i class="bi bi-check-lg"></i>' : i + 1) + '</span><span class="hx-st"><b>' + esc(s[1]) + '</b>' + (st.text ? '<small>' + esc(st.text) + '</small>' : '') + '</span><i class="bi bi-chevron-down hx-chev"></i></button>' +
          (isOpen ? '<div class="hx-sb">' + body(s[0], t) + '</div>' : '') + '</li>';
      }).join('') + '</ol>' +
      (n < -7 ? '<p class="hx-foot"><button type="button" class="text-btn" data-tkhide><i class="bi bi-eye-slash"></i> <span data-t="ui.hide-the-guide">Hide the guide</span></button></p>' : '') + '</section>';
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
    if (HF) HF.fill(el);
  }
  function checkRow(attr, id, on, text, icon) {
    return '<li><label class="lf-check hx-ck"><input type="checkbox" ' + attr + '="' + esc(id) + '"' + (on ? ' checked' : '') + '><i class="bi bi-' + icon + '"></i><span>' + esc(text) + '</span></label></li>';
  }
  function body(id, t) {
    if (id === 'prep') return '<ul class="hx-cks">' + PREP.map(function (p) { return checkRow('data-tkprep', p[0], (t.prep || {})[p[0]], p[1], p[2]); }).join('') + '</ul>' +
      '<p class="muted hx-tip"><i class="bi bi-info-circle"></i> <span data-t="ui.what-the-condition-report-already-descri">What the condition report already describes usually can’t be claimed later – read it once more before the day.</span></p>';
    if (id === 'meters') return '<ul class="hx-meters">' + arr(t.meters).map(function (m) {
      var M = METERS[m.kind] || METERS.other;
      return '<li class="hx-meter"><span class="kit-ic" style="--c:' + M[3] + '"><i class="bi bi-' + M[2] + '"></i></span><div class="hx-mx"><div class="hx-mrow"><b>' + esc(m.label || M[0]) + '</b>' +
        '<label class="hx-num"><input inputmode="decimal" autocomplete="off" placeholder="Reading" value="' + esc(m.value) + '" data-tkmval="' + esc(m.id) + '" aria-label="' + esc((m.label || M[0]) + ' – reading') + '"><em>' + esc(m.unit || M[1]) + '</em></label>' +
        (m.kind !== 'power' ? '<button type="button" class="icon-btn sm" data-tkmdel="' + esc(m.id) + '" aria-label="Remove"><i class="bi bi-x"></i></button>' : '') + '</div>' +
        (m.photo ? '<div class="hf-strip"><span class="hf-th"><button type="button" class="hf-thb" data-hfview="' + esc(m.photo) + '" aria-label="Open the photo"><img data-hfimg="' + esc(m.photo) + '" alt=""></button></span><label class="text-btn hx-sm"><i class="bi bi-camera"></i> <span data-t="ui.new-photo">New photo</span><input type="file" accept="image/*" capture="environment" data-tkmph="' + esc(m.id) + '" hidden></label></div>'
          : '<label class="text-btn hx-sm"><i class="bi bi-camera"></i> <span data-t="ui.photo-of-the-meter">Photo of the meter</span><input type="file" accept="image/*" capture="environment" data-tkmph="' + esc(m.id) + '" hidden></label>') + '</div></li>';
    }).join('') + '</ul><div class="lf-chips hx-add">' + ['water', 'heat', 'oil', 'other'].map(function (k) { return '<button type="button" class="lf-chip" data-tkmadd="' + k + '"><i class="bi bi-plus"></i> ' + esc(METERS[k][0]) + '</button>'; }).join('') + '</div>' +
      '<p class="muted hx-tip"><i class="bi bi-info-circle"></i> <span data-t="ui.the-electricity-reading-also-goes-into-e">The electricity reading also goes into Electricity meter on the Energy tab, so the power use starts from the day you took over.</span></p>';
    if (id === 'keys') return '<table class="hx-keys"><thead><tr><th data-t="ui.key"><span data-t="ui.key">Key</span></th><th data-t="ui.should-get"><span data-t="ui.should-get">Should get</span></th><th data-t="ui.got"><span data-t="ui.got">Got</span></th></tr></thead><tbody>' + arr(t.keys).map(function (k) {
      var miss = num(k.got) != null && +k.got < +k.want;
      return '<tr' + (miss ? ' class="miss"' : '') + '><td>' + esc(k.label) + '</td><td><input inputmode="numeric" value="' + esc(k.want) + '" data-tkkw="' + esc(k.id) + '" aria-label="' + esc(k.label) + ' – should get"></td><td><input inputmode="numeric" value="' + esc(k.got) + '" data-tkkg="' + esc(k.id) + '" aria-label="' + esc(k.label) + ' – got"></td></tr>';
    }).join('') + '</tbody></table><form class="hx-row" data-tkkadd><input name="t" placeholder="Another key, e.g. Bike shed" data-t-placeholder="ui.another-key-e-g-bike-shed" maxlength="40" autocomplete="off"><button type="submit" class="icon-btn sm" aria-label="Add" data-t-aria-label="ui.add"><i class="bi bi-plus-lg"></i></button></form>' +
      '<p class="muted hx-tip"><i class="bi bi-info-circle"></i> <span data-t="ui.codes-alarm-wi-fi-the-door-code-belong-i">Codes (alarm, Wi-Fi, the door code) belong in</span> <a href="#hinfo" data-tkgo="hinfo" data-t="ui.good-to-know"><span data-t="ui.good-to-know">Good to know</span></a> <span data-t="ui.on-the-things-tab-theyre-hidden-until-yo">on the Things tab – they’re hidden until you tap Show.</span></p>';
    if (id === 'walk') {
      var f = arr(t.faults), hasClaim = Fe.on('hclaim') && window.HouseClaims;
      return '<ul class="hx-cks">' + CHECKS.map(function (c) { return checkRow('data-tkcheck', c[0], (t.checks || {})[c[0]], c[1], c[2]); }).join('') + '</ul>' +
        '<div class="hx-fh"><h3 class="lp-h3">Faults ' + (f.length ? '(' + f.length + ')' : '') + '</h3><button type="button" class="pill-btn sm" data-tkfault><i class="bi bi-plus-lg"></i> <span data-t="ui.fault">Fault</span></button></div>' +
        (f.length ? '<ul class="hx-faults">' + f.map(function (x) {
          return '<li class="hx-fault' + (x.big ? ' big' : '') + '"><div class="hx-ft"><button type="button" class="hx-fb" data-tkfedit="' + esc(x.id) + '"><b>' + esc(x.text || 'Fault') + '</b><small>' + esc([x.room, x.big ? 'serious' : ''].filter(Boolean).join(' · ')) + '</small></button>' +
            (x.claim ? '<a class="hl-chip hx-cl" style="--c:#e66767" href="#hclaim=' + esc(x.claim) + '" data-tkclaimgo="' + esc(x.claim) + '"><i class="bi bi-exclamation-diamond"></i> <span data-t="ui.claim">Claim</span></a>' : hasClaim ? '<button type="button" class="text-btn hx-sm" data-tkclaim="' + esc(x.id) + '"><i class="bi bi-exclamation-diamond"></i> <span data-t="ui.make-it-a-claim">Make it a claim</span></button>' : '') + '</div>' +
            (HF ? HF.strip(x.photos, 'take:' + x.id, { label: 'Photos' }) : '') + '</li>';
        }).join('') + '</ul>' : '<p class="muted hx-tip" data-t="ui.found-something-wrong-add-it-with-a-phot">Found something wrong? Add it with a photo – it goes on the protocol, and you can turn it into a claim later.</p>');
    }
    if (id === 'sign') {
      var f2 = arr(t.faults), m2 = arr(t.meters).filter(function (x) { return num(x.value) != null; });
      return '<ul class="hx-cks">' + checkRow('data-tkprot', 'meters', (t.prot || {}).meters, 'The meter readings are in the protocol' + (m2.length ? ' (' + m2.map(function (x) { return nf.format(num(x.value)) + ' ' + ((METERS[x.kind] || METERS.other)[1]); }).join(', ') + ')' : ''), 'speedometer2') +
        checkRow('data-tkprot', 'faults', (t.prot || {}).faults, f2.length ? 'All ' + f2.length + (f2.length === 1 ? ' fault is' : ' faults are') + ' written in the protocol' : 'No faults found – or they’re written in the protocol', 'exclamation-triangle') +
        checkRow('data-tkprot', 'keys', (t.prot || {}).keys, I18N.k('ui.the-number-of-keys-is-in-the-protocol', 'The number of keys is in the protocol'), 'key') +
        checkRow('data-tkprot', 'copy', (t.prot || {}).copy, I18N.k('ui.you-got-a-copy-of-the-signed-protocol', 'You got a copy of the signed protocol'), 'file-earmark-check') + '</ul>' +
        '<p class="muted hx-tip"><i class="bi bi-info-circle"></i> <span data-t="ui.something-you-point-out-now-and-is-writt">Something you point out now and is written down is much easier to claim later. Don’t sign a protocol that leaves out a fault you found.</span></p>' +
        '<div class="hs2-acts"><button type="button" class="pill-btn" data-tkpdf><i class="bi bi-file-earmark-pdf"></i> <span data-t="ui.your-own-record-pdf">Your own record (PDF)</span></button>' +
        '<label class="text-btn"><i class="bi bi-upload"></i> ' + (t.protocol ? 'Replace the signed protocol' : 'Add the signed protocol') + '<input type="file" accept="application/pdf,.pdf,image/*" data-tkprotfile hidden></label>' +
        (t.signed ? '' : '<button type="button" class="text-btn" data-tksigned><i class="bi bi-pen"></i> <span data-t="ui.signed-today">Signed today</span></button>') + '</div>' +
        (t.protocol ? '<p class="hx-tip"><i class="bi bi-journal-check"></i> <span data-t="ui.the-signed-protocol-is-in-the">The signed protocol is in the</span> <a href="#hdocs" data-tkgo="hdocs" data-t="ui.fdv-binder"><span data-t="ui.fdv-binder">FDV binder</span></a> <span data-t="ui.under-purchase-and-take-over">under Purchase and take-over.</span></p>' : '');
    }
    var mv = move(), left = mv ? arr(mv.items).filter(function (x) { return !x.done; }) : [];
    return '<ul class="hx-after">' +
      '<li><a href="#hshared" data-tkgo="hshared"><i class="bi bi-list-check"></i><span><b data-t="ui.moving-checklist"><span data-t="ui.moving-checklist">Moving checklist</span></b><small>' + esc(left.length ? left.length + ' left: ' + left.slice(0, 2).map(function (x) { return x.text; }).join(' · ') : 'all done') + '</small></span></a></li>' +
      '<li><a href="https://www.skatteetaten.no/person/folkeregister/flytte/" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i><span><b data-t="ui.moving-notice-flyttemelding">Moving notice (flyttemelding)</b><small data-t="ui.to-folkeregisteret-within-8-days-skattee">to Folkeregisteret within 8 days – Skatteetaten</small></span></a></li>' +
      '<li><a href="#hmeter" data-tkgo="hmeter"><i class="bi bi-speedometer2"></i><span><b data-t="ui.read-the-meter-again-in-a-month">Read the meter again in a month</b><small data-t="ui.energy-tab-then-you-see-your-use-per-day">Energy tab – then you see your use per day</small></span></a></li>' +
      (Fe.on('hdocs') ? '<li><a href="#hdocs" data-tkgo="hdocs"><i class="bi bi-journal-bookmark"></i><span><b data-t="ui.keep-the-documents-you-got">Keep the documents you got</b><small data-t="ui.manuals-drawings-the-fdv-papers-fdv-bind">manuals, drawings, the FDV papers – FDV binder</small></span></a></li>' : '') +
      (Fe.on('hclaim') ? '<li><a href="#hclaim" data-tkgo="hclaim"><i class="bi bi-exclamation-diamond"></i><span><b data-t="ui.found-a-fault-later">Found a fault later?</b><small data-t="ui.tell-the-seller-in-writing-as-soon-as-yo">tell the seller in writing as soon as you can – Claims tab</small></span></a></li>' : '') + '</ul>';
  }
  function setStep(s) { save(function (x) { x.open = x.open === s ? '-' : s; }); }
  document.addEventListener('change', function (e) {
    if (!el || !el.contains(e.target)) return;
    var c = e.target, k;
    if ((k = c.dataset.tkprep)) return save(function (x) { x.prep = x.prep || {}; if (c.checked) x.prep[k] = 1; else delete x.prep[k]; });
    if ((k = c.dataset.tkcheck)) return save(function (x) { x.checks = x.checks || {}; if (c.checked) x.checks[k] = 1; else delete x.checks[k]; });
    if ((k = c.dataset.tkprot)) return save(function (x) { x.prot = x.prot || {}; if (c.checked) x.prot[k] = 1; else delete x.prot[k]; });
    if ((k = c.dataset.tkmval)) return saveMeter(k, c.value);
    if ((k = c.dataset.tkkw) || (k = c.dataset.tkkg)) { var w = 'tkkw' in c.dataset; return save(function (x) { arr(x.keys).forEach(function (y) { if (y.id === k) y[w ? 'want' : 'got'] = c.value === '' ? '' : (num(c.value) == null ? '' : num(c.value)); }); }); }
    if ((k = c.dataset.tkmph) && c.files && c.files[0] && HF) {
      var f = c.files[0]; c.value = '';
      HF.put(f, 'tk').then(function (m) { var old = null; save(function (x) { arr(x.meters).forEach(function (y) { if (y.id === k) { old = y.photo; y.photo = m.id; } }); }); if (old) HF.release(old); toast('<i class="bi bi-check2"></i> Photo saved'); }, function () { toast('<i class="bi bi-exclamation-triangle"></i> Couldn’t read that photo'); });
      return;
    }
    if (c.matches('[data-tkprotfile]') && c.files && c.files[0]) {
      var pf = c.files[0]; c.value = '';
      if (!window.HouseDocs) return toast('<i class="bi bi-exclamation-triangle"></i> Switch on the FDV binder to keep it');
      window.HouseDocs.addFile(pf, { cat: 'sale', name: 'Take-over protocol (overtakelsesprotokoll)', date: date() }).then(function (docId) {
        var old = T().protocol; save(function (x) { x.protocol = docId; if (!x.signed) x.signed = today(); });
        if (old && window.HouseDocs.remove) window.HouseDocs.remove(old, true);
        toast('<i class="bi bi-journal-check"></i> Saved in the FDV binder');
      }, function (er) { toast('<i class="bi bi-exclamation-triangle"></i> ' + esc(er && er.message === 'big' ? 'That file is over 20 MB' : 'Couldn’t read that file')); });
    }
  });
  function saveMeter(id, v) {
    var val = v === '' ? '' : num(v);
    if (v !== '' && val == null) return toast('<i class="bi bi-exclamation-triangle"></i> That isn’t a number');
    var kind = null;
    save(function (x) { arr(x.meters).forEach(function (y) { if (y.id === id) { y.value = val; kind = y.kind; } }); });
    /* the electricity reading also goes into the Electricity meter list, dated the take-over day */
    if (kind === 'power') {
      var t = Fe.tools(), l = Array.isArray(t.hmeter) ? t.hmeter : [], d = date() || today(), i = l.findIndex(function (y) { return y && y.id === 'tk-meter'; });
      if (val === '' || val == null) { if (i > -1) l.splice(i, 1); }
      else if (i > -1) { l[i].value = val; l[i].date = d; }
      else l.push({ id: 'tk-meter', date: d, value: val, notes: 'Take-over' });
      t.hmeter = l; Fe.saveTools(t);
    }
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-tkdate]')) { e.preventDefault(); var d = f.d.value; if (!isKey(d)) return; if (window.SharedHome && window.SharedHome.moveDate) window.SharedHome.moveDate(d); else { var t = Fe.tools(); t.hmove = Object.assign({}, t.hmove || {}, { date: d }); Fe.saveTools(t); } save(function (x) { delete x.hide; }); toast('<i class="bi bi-key"></i> Take-over ' + esc(fmt(d))); return; }
    if (f.matches('[data-tkkadd]')) { e.preventDefault(); var v = f.t.value.trim(); if (!v) return; save(function (x) { x.keys = arr(x.keys); x.keys.push({ id: 'k' + uid(), label: v.slice(0, 40), want: 1, got: '' }); }); }
  });
  document.addEventListener('click', function (e) {
    if (!el || !el.contains(e.target)) return;
    var b;
    if ((b = e.target.closest('[data-tkstep]'))) return setStep(b.dataset.tkstep);
    if (e.target.closest('[data-tkhide]')) { save(function (x) { x.hide = 1; }); toast('<i class="bi bi-eye-slash"></i> The take-over guide is hidden', function () { save(function (x) { delete x.hide; }); }); return; }
    if (e.target.closest('[data-tkset]')) return detailsSheet();
    if (e.target.closest('[data-tkpdf]')) return record();
    if (e.target.closest('[data-tksigned]')) return save(function (x) { x.signed = today(); });
    if ((b = e.target.closest('[data-tkmadd]'))) { var k = b.dataset.tkmadd; return save(function (x) { x.meters = arr(x.meters); x.meters.push({ id: 'm' + uid(), kind: k, label: '', value: '', unit: METERS[k][1], photo: '' }); }); }
    if ((b = e.target.closest('[data-tkmdel]'))) {
      var id = b.dataset.tkmdel, old = JSON.parse(JSON.stringify(arr(T().meters))), gone = old.filter(function (m) { return m.id === id; })[0];
      save(function (x) { x.meters = arr(x.meters).filter(function (m) { return m.id !== id; }); });
      if (gone && gone.photo) HF.release(gone.photo);
      return toast('<i class="bi bi-trash3"></i> Removed', function () { save(function (x) { x.meters = old; }); });
    }
    if (e.target.closest('[data-tkfault]')) return faultSheet(null);
    if ((b = e.target.closest('[data-tkfedit]'))) return faultSheet(b.dataset.tkfedit);
    if ((b = e.target.closest('[data-tkclaim]'))) return toClaim(b.dataset.tkclaim);
    if ((b = e.target.closest('[data-tkgo]'))) { e.preventDefault(); go(b.dataset.tkgo); }
  });
  function go(id) {
    location.hash = id;
    setTimeout(function () { var c = document.getElementById(id) || document.querySelector('[data-tool="' + id + '"]'); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('sr-flash'); setTimeout(function () { c.classList.remove('sr-flash'); }, 1600); } }, 80);
  }
  if (HF) {
    HF.onAdd('take', function (fid, ids) { save(function (x) { arr(x.faults).forEach(function (f) { if (f.id === fid) f.photos = (f.photos || []).concat(ids); }); }); });
    HF.onRemove('take', function (fid, pid) {
      var old = null;
      save(function (x) { arr(x.faults).forEach(function (f) { if (f.id === fid) { old = (f.photos || []).slice(); f.photos = (f.photos || []).filter(function (p) { return p !== pid; }); } }); });
      HF.release(pid);
      toast('<i class="bi bi-trash3"></i> Photo removed', function () { save(function (x) { arr(x.faults).forEach(function (f) { if (f.id === fid && old) f.photos = old; }); }); });
    });
  }
  function faultSheet(id) {
    var t = T(), f = id ? arr(t.faults).filter(function (x) { return x.id === id; })[0] : null; if (id && !f) return;
    var X = HF.sheet(f ? 'Fault' : 'New fault');
    X.box.innerHTML = HF.head('exclamation-triangle', f ? 'Fault' : 'New fault', I18N.k('ui.say-where-it-is-and-whats-wrong-add-phot', 'Say where it is and what’s wrong – add photos after saving.')) +
      '<form class="hx-form" data-tkfform><p class="mp-lbl" data-t="ui.where"><span data-t="ui.where">Where</span></p><div class="lf-chips">' + ROOMS.map(function (r) { return '<button type="button" class="lf-chip" data-tkroom="' + esc(r) + '" aria-pressed="' + (!!f && f.room === r) + '">' + esc(r) + '</button>'; }).join('') + '</div>' +
      '<label class="hx-f"><span data-t="ui.whats-wrong">What’s wrong</span><textarea name="text" rows="3" maxlength="600" placeholder="e.g. Crack in the tile by the shower, the kitchen tap drips" data-t-placeholder="ui.e-g-crack-in-the-tile-by-the-shower-the" required>' + esc(f ? f.text : '') + '</textarea></label>' +
      '<label class="lf-check"><input type="checkbox" name="big"' + (f && f.big ? ' checked' : '') + '> <span data-t="ui.serious-it-stops-you-using-something-or">Serious – it stops you using something, or may get worse (water, power, the roof)</span></label>' +
      '<div class="lf-foot">' + (f ? '<button type="button" class="text-btn danger" data-tkfdel><i class="bi bi-trash3"></i> <span data-t="ui.delete">Delete</span></button>' : '<span></span>') + '<button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.save">Save</span></button></div></form>';
    var room = f ? f.room : '';
    X.box.addEventListener('click', function (e) {
      var r = e.target.closest('[data-tkroom]'); if (r) { room = r.dataset.tkroom; X.box.querySelectorAll('[data-tkroom]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === r)); }); return; }
      if (e.target.closest('[data-tkfdel]')) {
        var b = e.target.closest('[data-tkfdel]'); if (!b.dataset.armed) { b.dataset.armed = 1; b.lastChild.textContent = ' Tap again to delete'; return; }
        var old = JSON.parse(JSON.stringify(arr(T().faults)));
        save(function (x) { x.faults = arr(x.faults).filter(function (y) { return y.id !== f.id; }); });
        HF.release(f.photos || []); X.close();
        toast('<i class="bi bi-trash3"></i> Fault deleted', function () { save(function (x) { x.faults = old; }); });
      }
    });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var fm = e.target, txt = fm.text.value.trim(); if (!txt) return fm.text.focus();
      var nid = f ? f.id : 'f' + uid();
      save(function (x) {
        x.faults = arr(x.faults);
        if (f) x.faults.forEach(function (y) { if (y.id === f.id) { y.text = txt; y.room = room; y.big = fm.big.checked; } });
        else x.faults.push({ id: nid, text: txt, room: room, big: fm.big.checked, photos: [], at: today() });
        x.open = 'walk';
      });
      X.close();
      if (!f) toast('<i class="bi bi-check2"></i> Fault added – now add a photo');
    });
  }
  function toClaim(fid) {
    var t = T(), f = arr(t.faults).filter(function (x) { return x.id === fid; })[0]; if (!f || !window.HouseClaims) return;
    var cid = window.HouseClaims.create({ title: String(f.text).split(/[.\n]/)[0].slice(0, 80), desc: f.text, where: f.room, found: date() || today(), photos: (f.photos || []).slice(), from: 'take', who: t.seller || '', law: t.kind === 'new' ? 'buofl' : 'avh', against: t.kind === 'new' ? 'builder' : 'seller', inProt: !!(t.prot || {}).faults });
    save(function (x) { arr(x.faults).forEach(function (y) { if (y.id === fid) y.claim = cid; }); });
    toast('<i class="bi bi-exclamation-diamond"></i> Claim made – find it on the Claims tab', null);
  }
  function detailsSheet() {
    var t = T(), d = date();
    var X = HF.sheet(I18N.k('ui.the-take-over', 'The take-over'));
    X.box.innerHTML = HF.head('key', I18N.k('ui.the-take-over', 'The take-over')) +
      '<form class="hx-form" data-tkdet><label class="hx-f"><span data-t="ui.take-over-date"><span data-t="ui.take-over-date">Take-over date</span></span><input type="date" name="d" value="' + esc(d || '') + '" required></label>' +
      '<label class="hx-f"><span data-t="ui.address"><span data-t="ui.address">Address</span></span><input name="addr" maxlength="120" value="' + esc(t.addr || '') + '" placeholder="Street and number, postcode"></label>' +
      '<label class="hx-f"><span data-t="ui.seller-or-builder">Seller or builder</span><input name="seller" maxlength="80" value="' + esc(t.seller || '') + '" placeholder="Name"></label>' +
      '<label class="hx-f"><span data-t="ui.estate-agent"><span data-t="ui.estate-agent">Estate agent</span></span><input name="agent" maxlength="80" value="' + esc(t.agent || '') + '" placeholder="Name and firm"></label>' +
      '<p class="mp-lbl" data-t="ui.the-home-is">The home is</p><div class="lf-chips"><button type="button" class="lf-chip" data-tkkind="used" aria-pressed="' + (t.kind !== 'new') + '"><span data-t="ui.used-bought-from-the-owner">Used – bought from the owner</span></button><button type="button" class="lf-chip" data-tkkind="new" aria-pressed="' + (t.kind === 'new') + '"><span data-t="ui.new-from-a-builder">New – from a builder</span></button></div>' +
      '<p class="muted hs2-note" data-t="ui.this-decides-which-rules-a-claim-follows">This decides which rules a claim follows (avhendingslova or bustadoppføringslova).</p>' +
      '<div class="lf-foot"><button type="button" class="text-btn danger" data-tkreset><i class="bi bi-arrow-counterclockwise"></i> <span data-t="ui.start-the-guide-over">Start the guide over</span></button><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> <span data-t="ui.save">Save</span></button></div></form>';
    var kind = t.kind === 'new' ? 'new' : 'used';
    X.box.addEventListener('click', function (e) {
      var k = e.target.closest('[data-tkkind]'); if (k) { kind = k.dataset.tkkind; X.box.querySelectorAll('[data-tkkind]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === k)); }); return; }
      var r = e.target.closest('[data-tkreset]'); if (r) {
        if (!r.dataset.armed) { r.dataset.armed = 1; r.lastChild.textContent = ' Tap again – ticks, readings and faults are cleared'; return; }
        var old = JSON.parse(JSON.stringify(T()));
        save(function (x) { Object.keys(x).forEach(function (q) { if (!/^(addr|seller|agent|kind)$/.test(q)) delete x[q]; }); });
        X.close(); toast('<i class="bi bi-arrow-counterclockwise"></i> Started over', function () { var tt = Fe.tools(); tt.htake = old; Fe.saveTools(tt); });
      }
    });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var fm = e.target;
      if (isKey(fm.d.value) && fm.d.value !== d && window.SharedHome && window.SharedHome.moveDate) window.SharedHome.moveDate(fm.d.value);
      save(function (x) { x.addr = fm.addr.value.trim(); x.seller = fm.seller.value.trim(); x.agent = fm.agent.value.trim(); x.kind = kind; });
      X.close(); toast('<i class="bi bi-check2"></i> Saved');
    });
  }
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(draw.t); draw.t = setTimeout(draw, 40); }); });
  window.Vault.onUnlock(function () { setTimeout(draw, 70); });
  window.Vault.onLock(function () { if (el) { el.innerHTML = ''; el._h = ''; el.hidden = true; } });
  Object.assign(window.HouseMove, { draw: draw });
  (window.__ui = window.__ui || {})["move"] = { el: el, save: save, go: go };
})();
