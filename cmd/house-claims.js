/* Reklamasjon (Nov 2026): report a fault to the seller, the builder, a tradesman or a shop – House → Claims.
   Each claim has what's wrong, where, when you found it, photos, what you want done, and its status
   (draft → sent → answered → agreed/fixed, or turned down). The deadlines follow the law that applies:
     avh   used home bought from the owner (avhendingslova)   – reasonable time, 5 years from take-over, 10 000 kr floor
     buofl new home from a builder (bustadoppføringslova)       – reasonable time, 5 years from take-over, one-year inspection
     hvtj  a tradesman's work (håndverkertjenesteloven)         – reasonable time, 5 years after the work
     fkjl  a product (forbrukerkjøpsloven)                       – 2 months after you found it is in time, 2 or 5 years
   It writes the letter (Norwegian or English) and an A4 report with the photos (Save as PDF), copies the text,
   shares it with the photos attached, and reminds you when an answer is late. Not legal advice – the card says so.
   Data: dash.tools.hclaims = [{id, title, against, law, who, email, ref, where, found, deliver, long, desc, want, cost,
     photos:[], status, sent, replyBy, log:[{id,d,t}], inProt, from}], dash.tools.hclaimcfg = { lang }. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit, HF = window.HouseFiles, mountEl = document.querySelector('[data-tool="hclaim"]');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isKey(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +(p[2] || 1)); }
  function today() { return dkey(new Date()); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function addYears(k, n) { var d = fromKey(k), day = d.getDate(); d.setDate(1); d.setFullYear(d.getFullYear() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return dkey(d); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function fmt(k, o) { return isKey(k) ? fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('house') && Fe.on('hclaim'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function list() { return Fe.list('hclaims'); }
  function byId(id) { return list().filter(function (x) { return x.id === id; })[0]; }
  function saveOne(id, fn) { var t = Fe.tools(); (t.hclaims || []).forEach(function (x) { if (x && x.id === id) fn(x); }); Fe.saveTools(t); }
  function cfg() { var c = Fe.tools().hclaimcfg; return Object.assign({ lang: 'nb', replyDays: 14, co: 'auto', coName: '' }, c && typeof c === 'object' ? c : {}); }
  /* who you live with – on the letters and reports for the home ("we"): your partner from Shared home, someone you name, or just you */
  function partner() { return window.Shared && window.Shared.partner && window.Shared.partner(); }
  function coName(h) { var H = window.Homes && window.Homes.get(hv(h)); if (H && H.co) { if (H.co === 'none') return ''; if (H.co === 'name') return String(H.coName || '').trim(); } var c = cfg(); if (c.co === 'none') return ''; if (c.co === 'name') return String(c.coName || '').trim(); var p = partner(); return p ? p.name : ''; }
  HF && HF.uses(function () { var ids = []; list().forEach(function (c) { ids = ids.concat(c.photos || []); }); return ids; });

  /* who it's against → the law, and its deadlines */
  var AGAINST = [
    ['seller', 'The seller of the home', 'A used home you bought – the seller (or their insurance)', 'house-door', '#a0673a', 'avh'],
    ['builder', 'The builder', 'A new home – the developer or builder', 'building', '#0891b2', 'buofl'],
    ['craftsman', 'A tradesman', 'Work done on the home – plumber, electrician, painter …', 'tools', '#e8743b', 'hvtj'],
    ['shop', 'A shop – a product', 'An appliance, furniture or something else you bought', 'box-seam', '#3987e5', 'fkjl'],
    ['other', 'Something else', 'Write it your own way', 'pencil', '#7a8794', 'other']];
  function ag(k) { return AGAINST.filter(function (a) { return a[0] === k; })[0] || AGAINST[4]; }
  var LAW = {
    avh: { n: 'Used home (avhendingslova)', nb: 'avhendingslova', deliver: 'Taken over', years: 5,
      rule: 'Tell the seller in writing within a reasonable time after you found it (or should have) – as soon as you can, and don’t wait more than about two months. 5 years after the take-over it’s too late.',
      more: 'A fault that costs less than 10 000 kr to fix can’t be claimed (since 2022), and what the condition report describes usually doesn’t count. The seller often has an insurance (boligselgerforsikring) that takes over the case.' },
    buofl: { n: 'New home (bustadoppføringslova)', nb: 'bustadoppføringslova', deliver: 'Taken over', years: 5,
      rule: 'Tell the builder in writing within a reasonable time after you found it – as soon as you can, about two months at most. 5 years after the take-over it’s too late.',
      more: 'Faults you found at the take-over should be in the protocol. The builder usually holds a one-year inspection (ettårsbefaring) – bring this list.' },
    hvtj: { n: 'Tradesman’s work (håndverkertjenesteloven)', nb: 'håndverkertjenesteloven', deliver: 'Work finished', years: 5,
      rule: 'Tell them in writing within a reasonable time after you found it – about two months at most. 5 years after the work was done it’s too late.',
      more: 'Keep the offer, the invoice and any documentation of the work (for wet rooms: the membrane and the tradesman’s papers).' },
    fkjl: { n: 'A product (forbrukerkjøpsloven)', nb: 'forbrukerkjøpsloven', deliver: 'Bought', years: 2,
      rule: 'Within two months after you found it is always in time. The limit is 2 years after you got it – 5 years for things meant to last much longer, like white goods or furniture.',
      more: 'Complain to the shop you bought it from, not the maker. A warranty from the maker comes on top of these rights.' },
    other: { n: 'Other', nb: '', deliver: 'Delivered', years: 0, rule: 'Tell them in writing as soon as you can after you found it.', more: '' } };
  var WANT = [['fix', 'Have it fixed'], ['price', 'A price reduction'], ['comp', 'Compensation for the cost'], ['new', 'A new one (replacement)'], ['back', 'My money back'], ['look', 'That they look at it first']];
  var STATUS = {
    draft: ['Draft', '#7a8794', 'pencil'], sent: ['Sent', '#3987e5', 'send'], reply: ['Answered', '#8a6fdf', 'reply'],
    agreed: ['Agreed', '#22b35e', 'hand-thumbs-up'], fixed: ['Fixed', '#22b35e', 'check2-circle'], no: ['Turned down', '#e66767', 'x-octagon'], closed: ['Closed', '#7a8794', 'archive'] };
  var OPEN = { draft: 1, sent: 1, reply: 1, agreed: 1 };
  function law(c) { return LAW[c.law] || LAW[ag(c.against)[5]] || LAW.other; }
  function lawKey(c) { return LAW[c.law] ? c.law : ag(c.against)[5]; }
  /* the dates that matter */
  function deadlines(c) {
    var L = law(c), lk = lawKey(c), out = {};
    if (isKey(c.found) && lk !== 'other') out.soft = addDays(c.found, 60);
    if (isKey(c.deliver) && L.years) out.hard = addYears(c.deliver, lk === 'fkjl' && c.long ? 5 : L.years);
    if (c.status === 'sent' && isKey(c.replyBy)) out.reply = c.replyBy;
    return out;
  }
  /* the home in view (house-homes.js): its take-over date and details */
  function hv(h) { return h || (window.Homes ? window.Homes.view() : null); }
  function takeDate(h) { if (window.HouseMove) return window.HouseMove.date(hv(h)) || ''; var m = Fe.tools().hmove; return m && isKey(m.date) ? m.date : ''; }
  function takeInfo(h) { var x = window.HouseMove ? window.HouseMove.data(hv(h)) : {}, H = window.Homes && window.Homes.get(hv(h)); return H ? Object.assign({}, x, { addr: x.addr || H.addr || '', seller: x.seller || H.seller || '', agent: x.agent || H.agent || '', kind: x.kind || H.kind }) : x; }
  function cur() { return window.Homes ? window.Homes.current() : null; }
  function inView(x) { return !window.Homes || window.Homes.inView(x); }

  /* ---------- the card ---------- */
  var FIELDS = [
    { k: 'title', type: 'title', label: 'What', ph: 'e.g. Water leak under the kitchen sink', req: true },
    { k: 'where', label: 'Where', ph: 'e.g. Bathroom, by the shower' },
    { k: 'found', label: 'You found it', type: 'date', def: today, help: 'The day you found it, or should have noticed it – the deadline runs from here.' },
    { k: 'desc', label: 'What’s wrong', type: 'textarea', rows: 4, help: 'Plainly: what you see, since when, what happens. This goes into the letter.' },
    { k: 'want', label: 'You want', type: 'select', options: WANT, def: 'fix' },
    { k: 'cost', label: 'Cost to fix, about', type: 'number', suffix: 'kr', help: 'Optional – from a quote or your own estimate' },
    { k: 'who', label: 'Send it to', ph: 'Name or firm' },
    { k: 'email', label: 'Their e-mail', ph: 'Optional', type: 'email' },
    { k: 'ref', label: 'Their reference', ph: 'Order, case or contract number' },
    { k: 'deliver', label: 'Taken over, bought or finished', type: 'date', help: 'The take-over date for the home, the purchase date for a product – the 2- or 5-year limit counts from here.' },
    { k: 'law', label: 'Rules', type: 'select', options: Object.keys(LAW).map(function (k) { return [k, LAW[k].n]; }), def: 'avh' },
    { k: 'long', label: 'Meant to last much longer', type: 'check', help: 'Products only: white goods, built-in or furniture – the limit is then 5 years, not 2.' }];
  var NEWK = null;
  function withDefs(d) { return { key: 'hclaims', addTitle: 'New claim', editTitle: 'Edit claim', fields: FIELDS.map(function (f) { return f.k in d ? Object.assign({}, f, { def: d[f.k] }) : f; }),
    beforeSave: function (it, isNew) { if (isNew) { if (window.Homes) it.home = window.Homes.view(); it.status = 'draft'; it.against = (NEWK && NEWK.against) || it.against || 'other'; it.photos = it.photos || []; it.log = [{ id: uid(), d: today(), t: 'Made the claim' }]; it.at = today(); } if (it.law !== 'fkjl') delete it.long; },
    afterSave: function (it, isNew) { if (isNew) { openId = it.id; toast('<i class="bi bi-check2"></i> Claim saved – add photos, then make the letter'); } NEWK = null; },
    onDelete: function (it) { HF && HF.release(it.photos || []); } };
  }
  var BASE = withDefs({}), openId = null;
  function pickKind() {
    var HL = window.HomeLife; if (!HL) return K.edit(BASE, null);
    var td = takeDate(), ti = takeInfo(), used = ti.kind !== 'new';
    var opts = AGAINST.map(function (a) { return { n: a[1], s: a[2], i: a[3], c: a[4], a: a }; });
    if (!used) { var b = opts.splice(1, 1)[0]; opts.unshift(b); }
    HL.dialog(HL.dhead('exclamation-diamond', 'New claim', 'Who is it to?') + '<div class="hl-pick">' + opts.map(function (o, i) {
      return '<button type="button" data-hcpick="' + i + '"><span class="kit-ic" style="--c:' + o.c + '"><i class="bi bi-' + o.i + '"></i></span><span><b>' + esc(o.n) + '</b><small>' + esc(o.s) + '</small></span></button>';
    }).join('') + '</div>', function (e, close) {
      var b = e.target.closest('[data-hcpick]'); if (!b) return; close();
      var a = opts[+b.dataset.hcpick].a, home = a[0] === 'seller' || a[0] === 'builder';
      NEWK = { against: a[0] };
      setTimeout(function () { K.edit(withDefs({ law: a[5], who: home ? (ti.seller || '') : '', deliver: home ? td : '', where: '' }), null); }, 120);
    });
  }
  function dl(c) {
    var d = deadlines(c), bits = [];
    if (c.status === 'draft' && d.soft) { var n = daysTo(d.soft); bits.push({ t: n < 0 ? 'Send it now – found ' + (-daysTo(c.found)) + ' days ago' : 'Send it by about ' + fmt(d.soft, { day: 'numeric', month: 'short' }), c: n < 0 ? '#e66767' : n <= 14 ? '#c98500' : '#7a8794' }); }
    if (d.reply) { var r = daysTo(d.reply); bits.push({ t: r < 0 ? 'Answer is ' + (-r) + ' days late' : 'Answer by ' + fmt(d.reply, { day: 'numeric', month: 'short' }), c: r < 0 ? '#e66767' : '#3987e5' }); }
    if (d.hard && OPEN[c.status]) { var h = daysTo(d.hard); if (h < 0) bits.push({ t: 'The ' + (law(c).years === 2 && !c.long ? '2' : '5') + '-year limit passed ' + fmt(d.hard), c: '#e66767' }); else if (h < 120) bits.push({ t: 'Final limit ' + fmt(d.hard), c: '#c98500' }); }
    return bits;
  }
  var col = K && mountEl ? K.collection({
    mount: mountEl, feature: 'hclaim', key: 'hclaims', filter: inView, icon: 'exclamation-diamond', title: 'Fault claims', addLabel: 'Claim', limit: 8,
    addTitle: BASE.addTitle, editTitle: BASE.editTitle, fields: BASE.fields, beforeSave: BASE.beforeSave, afterSave: BASE.afterSave, onDelete: BASE.onDelete,
    empty: 'Found a fault in the home, or something you bought broke? Make a claim with photos – the card writes the letter, keeps the deadlines and reminds you when the answer is late.',
    headExtra: function (l) { return (l.length ? '<button type="button" class="text-btn" data-hcall aria-label="Report of all claims" data-t-aria-label="ui.report-of-all-claims"><i class="bi bi-file-earmark-pdf"></i> Report</button>' : '') + '<button type="button" class="text-btn" data-hcset aria-label="Claim settings" data-t-aria-label="ui.claim-settings"><i class="bi bi-sliders"></i></button>'; },
    sort: function (a, b) { var oa = OPEN[a.status] ? 0 : 1, ob = OPEN[b.status] ? 0 : 1; return oa - ob || (b.found || '').localeCompare(a.found || ''); },
    summary: function (l) {
      if (!l.length) return '';
      var open = l.filter(function (c) { return OPEN[c.status]; }), wait = l.filter(function (c) { return c.status === 'sent'; }), late = wait.filter(function (c) { return isKey(c.replyBy) && daysTo(c.replyBy) < 0; });
      var next = open.map(function (c) { var d = deadlines(c); return c.status === 'draft' ? d.soft : d.reply; }).filter(isKey).sort()[0];
      return '<div class="kit-tiles"><div class="kit-tile" data-tk="open"><span data-t="ui.open">Open</span><b>' + open.length + '</b><small>' + (l.length - open.length ? (l.length - open.length) + ' closed' : '&nbsp;') + '</small></div>' +
        '<div class="kit-tile" data-tk="wait"><span data-t="ui.waiting-for-an-answer">Waiting for an answer</span><b>' + wait.length + '</b><small>' + (late.length ? '<span class="dn">' + late.length + ' late</span>' : '&nbsp;') + '</small></div>' +
        '<div class="kit-tile" data-tk="next"><span data-t="ui.next-date">Next date</span><b>' + (next ? esc(fmt(next, { day: 'numeric', month: 'short' })) : '–') + '</b><small>' + (next ? esc(daysTo(next) < 0 ? 'passed' : daysTo(next) === 0 ? 'today' : 'in ' + daysTo(next) + ' days') : '&nbsp;') + '</small></div></div>';
    },
    row: function (c) {
      var a = ag(c.against), S = STATUS[c.status] || STATUS.draft, b = dl(c)[0];
      return { icon: a[3], color: a[4], cls: OPEN[c.status] ? '' : 'hc-closed', title: c.title,
        sub: esc([c.where, c.who].filter(Boolean).join(' · ')) + (b ? (c.where || c.who ? ' · ' : '') + '<span style="color:' + b.c + '">' + esc(b.t) + '</span>' : '') + ((c.photos || []).length ? ' <i class="bi bi-image" title="Photos" data-t-title="ui.photos"></i>' : ''),
        right: '<span class="hl-chip" style="--c:' + S[1] + '"><i class="bi bi-' + S[2] + '"></i> ' + esc(S[0]) + '</span>' };
    },
    detail: function (c) {
      var L = law(c), S = STATUS[c.status] || STATUS.draft, d = dl(c);
      return (d.length ? '<ul class="hc-dl">' + d.map(function (x) { return '<li style="--c:' + x.c + '"><i class="bi bi-alarm"></i> ' + esc(x.t) + '</li>'; }).join('') + '</ul>' : '') +
        (c.desc ? '<p class="kit-notes">' + esc(c.desc) + '</p>' : '<p class="muted hl-small" data-t="ui.say-whats-wrong-edit-it-goes-into-the-le">Say what’s wrong (Edit) – it goes into the letter.</p>') +
        '<p class="muted hl-small">' + esc([c.found ? 'Found ' + fmt(c.found) : '', c.deliver ? L.deliver + ' ' + fmt(c.deliver) : '', 'wants: ' + ((WANT.filter(function (w) { return w[0] === c.want; })[0] || WANT[0])[1]).toLowerCase(), +c.cost ? 'about ' + kr(c.cost) : '', c.inProt ? 'in the take-over protocol' : ''].filter(Boolean).join(' · ')) + '</p>' +
        (HF ? HF.strip(c.photos, 'claim:' + c.id, { label: 'Add photos' }) : '') +
        '<div class="hl-acts">' +
        (c.status === 'draft' ? '<button type="button" class="pill-btn" data-hcletter="' + esc(c.id) + '"><i class="bi bi-envelope-paper"></i> Letter and report</button><button type="button" class="text-btn" data-hcsent="' + esc(c.id) + '"><i class="bi bi-send-check"></i> I’ve sent it</button>'
          : '<button type="button" class="text-btn" data-hcletter="' + esc(c.id) + '"><i class="bi bi-envelope-paper"></i> The letter</button>') +
        (c.status === 'sent' ? '<button type="button" class="text-btn" data-hcnudge="' + esc(c.id) + '"><i class="bi bi-bell"></i> Remind them</button>' : '') +
        (c.status !== 'draft' ? '<button type="button" class="text-btn" data-hcupd="' + esc(c.id) + '"><i class="bi bi-plus-lg"></i> Update</button>' : '') + '</div>' +
        '<details class="hc-law"><summary><i class="bi bi-book"></i> The rules: ' + esc(L.n) + '</summary><p>' + esc(L.rule) + '</p>' + (L.more ? '<p>' + esc(L.more) + '</p>' : '') + '<p class="muted" data-t="ui.a-guide-not-legal-advice-unsure-forbruke">A guide, not legal advice. Unsure? Forbrukerrådet, Huseierne or a lawyer can help.</p></details>' +
        ((c.log || []).length ? '<ol class="hc-log">' + c.log.slice().reverse().map(function (x) { return '<li><small>' + esc(fmt(x.d, { day: 'numeric', month: 'short' })) + '</small><span>' + esc(x.t) + '</span></li>'; }).join('') + '</ol>' : '') +
        '<p class="hc-st"><span class="hl-chip" style="--c:' + S[1] + '"><i class="bi bi-' + S[2] + '"></i> ' + esc(S[0]) + '</span></p>';
    },
    afterRender: function (el) { if (HF) HF.fill(el); },
    onClick: function (e) {
      var b;
      if ((b = e.target.closest('[data-hcletter]'))) return letter(b.dataset.hcletter);
      if ((b = e.target.closest('[data-hcsent]'))) return sentSheet(b.dataset.hcsent);
      if ((b = e.target.closest('[data-hcupd]'))) return updSheet(b.dataset.hcupd);
      if ((b = e.target.closest('[data-hcnudge]'))) return nudge(b.dataset.hcnudge);
      if (e.target.closest('[data-hcset]')) return setSheet();
      if (e.target.closest('[data-hcall]')) return reportAll();
    }
  }) : null;
  /* the card's "+": who it's to first */
  if (mountEl) mountEl.addEventListener('click', function (e) { if (e.target.closest('[data-kit-add]')) { e.stopPropagation(); e.preventDefault(); pickKind(); } }, true);
  if (HF) {
    HF.onAdd('claim', function (cid, ids) { saveOne(cid, function (c) { c.photos = (c.photos || []).concat(ids); }); });
    HF.onRemove('claim', function (cid, pid) {
      var old = null; saveOne(cid, function (c) { old = (c.photos || []).slice(); c.photos = (c.photos || []).filter(function (p) { return p !== pid; }); });
      HF.release(pid); toast('<i class="bi bi-trash3"></i> Photo removed', function () { saveOne(cid, function (c) { c.photos = old; }); });
    });
  }
  function logLine(c, t) { c.log = Array.isArray(c.log) ? c.log : []; c.log.push({ id: uid(), d: today(), t: t }); if (c.log.length > 40) c.log = c.log.slice(-40); }

  /* sent: when, how, the answer by */
  function sentSheet(id) {
    var c = byId(id); if (!c) return;
    var X = HF.sheet('Sent'), rd = cfg().replyDays;
    X.box.innerHTML = HF.head('send-check', 'Sent', 'Keep a copy of what you sent – an e-mail is fine, it’s in writing.') +
      '<form class="hx-form"><label class="hx-f"><span data-t="ui.sent-on">Sent on</span><input type="date" name="d" value="' + today() + '" required></label>' +
      '<p class="mp-lbl" data-t="ui.how">How</p><div class="lf-chips">' + ['E-mail', 'Letter', 'Text message', 'Their web form'].map(function (h, i) { return '<button type="button" class="lf-chip" data-hchow="' + esc(h) + '" aria-pressed="' + (i === 0) + '">' + esc(h) + '</button>'; }).join('') + '</div>' +
      '<label class="hx-f"><span data-t="ui.asked-for-an-answer-by">Asked for an answer by</span><input type="date" name="r" value="' + addDays(today(), rd) + '"></label>' +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> Save</button></div></form>';
    var how = 'E-mail';
    X.box.addEventListener('click', function (e) { var h = e.target.closest('[data-hchow]'); if (h) { how = h.dataset.hchow; X.box.querySelectorAll('[data-hchow]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === h)); }); } });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target;
      saveOne(id, function (x) { x.status = 'sent'; x.sent = f.d.value || today(); x.replyBy = isKey(f.r.value) ? f.r.value : addDays(x.sent, rd); logLine(x, 'Sent by ' + how.toLowerCase() + (x.who ? ' to ' + x.who : '')); });
      X.close(); toast('<i class="bi bi-send-check"></i> Marked as sent – you get a nudge if the answer is late');
    });
  }
  /* an update: their answer, agreed, fixed, turned down … */
  function updSheet(id) {
    var c = byId(id); if (!c) return;
    var X = HF.sheet('Update');
    var opts = [['reply', 'They answered'], ['agreed', 'We agreed what happens'], ['fixed', 'It’s fixed or paid'], ['no', 'They turned it down'], ['closed', 'Close the claim'], ['note', 'Just a note']];
    X.box.innerHTML = HF.head('plus-lg', 'Update', c.title) + '<form class="hx-form"><div class="lf-chips">' + opts.map(function (o, i) { return '<button type="button" class="lf-chip" data-hcst="' + o[0] + '" aria-pressed="' + (i === 0) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="hx-f"><span data-t="ui.what-happened">What happened</span><textarea name="t" rows="3" maxlength="400" placeholder="e.g. The seller’s insurance will send a surveyor on 14 January" data-t-placeholder="ui.e-g-the-sellers-insurance-will-send-a-su"></textarea></label>' +
      '<p class="muted hs2-note" data-hcno hidden data-t="ui.turned-down-and-you-dont-agree-forbruker">Turned down and you don’t agree? Forbrukerrådet can mediate for free; for homes, Boligtvistnemnda or Huseierne’s lawyers.</p>' +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> Save</button></div></form>';
    var st = 'reply';
    X.box.addEventListener('click', function (e) { var h = e.target.closest('[data-hcst]'); if (h) { st = h.dataset.hcst; X.box.querySelectorAll('[data-hcst]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === h)); }); X.box.querySelector('[data-hcno]').hidden = st !== 'no'; } });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var t = e.target.t.value.trim(), label = (opts.filter(function (o) { return o[0] === st; })[0] || opts[0])[1];
      saveOne(id, function (x) { if (st !== 'note') x.status = st; logLine(x, t ? label + ': ' + t : label); });
      X.close(); toast('<i class="bi bi-check2"></i> Saved');
    });
  }
  function setSheet() {
    var c = cfg(), X = HF.sheet('Claims');
    X.box.innerHTML = HF.head('sliders', 'Claims') + '<form class="hx-form"><p class="mp-lbl" data-t="ui.letters-in">Letters in</p><div class="lf-chips"><button type="button" class="lf-chip" data-hclang="nb" aria-pressed="' + (c.lang !== 'en') + '">Norsk</button><button type="button" class="lf-chip" data-hclang="en" aria-pressed="' + (c.lang === 'en') + '">English</button></div>' +
      '<p class="mp-lbl" data-t="ui.you-live-with">You live with</p><div class="lf-chips">' + (partner() ? '<button type="button" class="lf-chip" data-hcco="auto" aria-pressed="' + (c.co === 'auto') + '">' + esc(partner().name) + '</button>' : '') +
      '<button type="button" class="lf-chip" data-hcco="name" aria-pressed="' + (c.co === 'name' || (c.co === 'auto' && !partner())) + '">Someone else</button><button type="button" class="lf-chip" data-hcco="none" aria-pressed="' + (c.co === 'none') + '">Just me</button></div>' +
      '<label class="hx-f" data-hcconame' + (c.co === 'name' || (c.co === 'auto' && !partner()) ? '' : ' hidden') + '><span data-t="ui.name-2">Name</span><input name="cn" maxlength="60" value="' + esc(c.coName || '') + '" placeholder="Their full name" autocomplete="off"></label>' +
      '<p class="muted hs2-note" data-t="ui.letters-and-reports-about-the-home-are-s">Letters and reports about the home are signed by both of you (“we”). Just me = only your name.</p>' +
      '<label class="hx-f"><span data-t="ui.ask-for-an-answer-within-days">Ask for an answer within, days</span><input name="rd" inputmode="numeric" value="' + esc(c.replyDays) + '"></label>' +
      '<label class="lf-check"><input type="checkbox" name="gl"' + (c.glance !== false ? ' checked' : '') + '> <span data-t="ui.nudges-in-at-a-glance-send-it-late-answe">Nudges in At a glance (send it, late answers, the one-year inspection)</span></label>' +
      '<div class="lf-foot"><span></span><button type="submit" class="pill-btn"><i class="bi bi-check2"></i> Save</button></div></form>';
    var lang = c.lang === 'en' ? 'en' : 'nb', co = c.co === 'auto' && !partner() ? 'name' : c.co;
    X.box.addEventListener('click', function (e) {
      var h = e.target.closest('[data-hclang]'); if (h) { lang = h.dataset.hclang; X.box.querySelectorAll('[data-hclang]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === h)); }); }
      var o = e.target.closest('[data-hcco]'); if (o) { co = o.dataset.hcco; X.box.querySelectorAll('[data-hcco]').forEach(function (z) { z.setAttribute('aria-pressed', String(z === o)); }); X.box.querySelector('[data-hcconame]').hidden = co !== 'name'; if (co === 'name') X.box.querySelector('[name=cn]').focus(); }
    });
    X.box.addEventListener('submit', function (e) {
      e.preventDefault(); var rd = Math.round(+e.target.rd.value) || 14, t = Fe.tools();
      t.hclaimcfg = Object.assign({}, cfg(), { lang: lang, replyDays: Math.min(60, Math.max(3, rd)), glance: e.target.gl.checked, co: co === 'name' && !e.target.cn.value.trim() ? 'none' : co, coName: e.target.cn.value.trim().slice(0, 60) }); Fe.saveTools(t); X.close(); toast('<i class="bi bi-check2"></i> Saved');
    });
  }

  /* ---------- the letter ---------- */
  function me() { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } }
  function letterText(c, lang) {
    var p = me(), co = coName(c.home), ti = takeInfo(c.home), lk = lawKey(c), home = c.against === 'seller' || c.against === 'builder';
    var we = home && !!co, nb = lang !== 'en', addr = ti.addr || '';
    var dfmt = function (k) { return isKey(k) ? fromKey(k).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
    var replyBy = c.status === 'sent' && isKey(c.replyBy) ? c.replyBy : addDays(today(), cfg().replyDays);
    var want = { fix: nb ? 'at mangelen rettes' : 'that the fault is put right', price: nb ? 'prisavslag' : 'a price reduction', comp: nb ? 'erstatning for kostnadene med å rette mangelen' : 'compensation for the cost of putting it right', new: nb ? 'omlevering – en ny vare uten feil' : 'a replacement without the fault', back: nb ? 'heving av kjøpet og at pengene betales tilbake' : 'to cancel the purchase and have my money back', look: nb ? 'at dere ser på forholdet og kommer med et forslag til løsning' : 'that you look at it and propose a solution' }[c.want] || (nb ? 'at mangelen rettes' : 'that the fault is put right');
    var subj = (nb ? 'Reklamasjon – ' : 'Complaint about a defect – ') + c.title + (home && addr ? ' – ' + addr : '') + (c.ref ? ' (' + c.ref + ')' : '');
    var ref = {
      avh: nb ? 'Jeg viser til kjøpet av ' + (addr || 'boligen') + (isKey(c.deliver) ? ', som ' + (we ? 'vi' : 'jeg') + ' overtok ' + dfmt(c.deliver) : '') + '.' : 'I refer to the sale of ' + (addr || 'the home') + (isKey(c.deliver) ? ', taken over on ' + dfmt(c.deliver) : '') + '.',
      buofl: nb ? 'Jeg viser til kontrakten om ' + (addr || 'boligen') + (isKey(c.deliver) ? ', overtatt ' + dfmt(c.deliver) : '') + '.' : 'I refer to the contract for ' + (addr || 'the home') + (isKey(c.deliver) ? ', taken over on ' + dfmt(c.deliver) : '') + '.',
      hvtj: nb ? 'Jeg viser til arbeidet dere utførte' + (c.where ? ' (' + c.where + ')' : '') + (isKey(c.deliver) ? ', ferdig ' + dfmt(c.deliver) : '') + '.' : 'I refer to the work you did' + (c.where ? ' (' + c.where + ')' : '') + (isKey(c.deliver) ? ', finished on ' + dfmt(c.deliver) : '') + '.',
      fkjl: nb ? 'Jeg viser til kjøpet av ' + c.title + (isKey(c.deliver) ? ' ' + dfmt(c.deliver) : '') + '.' : 'I refer to my purchase of ' + c.title + (isKey(c.deliver) ? ' on ' + dfmt(c.deliver) : '') + '.',
      other: '' }[lk];
    if (nb && we) ref = ref.replace(/^Jeg viser/, 'Vi viser');
    if (!nb && we) ref = ref.replace(/^I refer/, 'We refer').replace(/my purchase/, 'our purchase');
    var I = nb ? (we ? 'Vi' : 'Jeg') : (we ? 'We' : 'I'), i2 = nb ? (we ? 'vi' : 'jeg') : (we ? 'we' : 'I');
    var lines = [];
    lines.push(nb ? 'Hei' + (c.who ? ' ' + c.who : '') + ',' : (c.who ? 'Dear ' + c.who + ',' : 'Hello,'));
    if (ref) lines.push(ref);
    lines.push(nb ? I + ' har oppdaget en mangel og reklamerer med dette skriftlig:' : I + ' have found a defect and hereby give written notice of it:');
    lines.push(String(c.desc || c.title).trim());
    var facts = [];
    if (c.where) facts.push((nb ? 'Hvor: ' : 'Where: ') + c.where);
    if (isKey(c.found)) facts.push((nb ? 'Oppdaget: ' : 'Found: ') + dfmt(c.found));
    if (c.inProt) facts.push(nb ? 'Forholdet ble påpekt ved overtakelsen og står i overtakelsesprotokollen.' : 'It was pointed out at the take-over and is in the take-over protocol.');
    if ((c.photos || []).length) facts.push(nb ? 'Bilder er vedlagt (' + c.photos.length + ').' : 'Photos are attached (' + c.photos.length + ').');
    if (facts.length) lines.push(facts.join('\n'));
    lines.push((nb ? I + ' krever ' : I + ' ask for ') + want + (+c.cost ? (nb ? '. Anslått kostnad: ' : '. Estimated cost: ') + kr(c.cost) : '') + '.' + (LAW[lk] && LAW[lk].nb ? (nb ? ' Reklamasjonen gjelder etter ' + LAW[lk].nb + '.' : ' This notice is given under the Norwegian ' + LAW[lk].nb + '.') : ''));
    lines.push(nb ? 'Vennligst gi ' + (we ? 'oss' : 'meg') + ' et skriftlig svar innen ' + dfmt(replyBy) + '.' : 'Please reply in writing by ' + dfmt(replyBy) + '.');
    if (lk === 'avh') lines.push(nb ? 'Hvis du har boligselgerforsikring, ber ' + i2 + ' deg sende reklamasjonen videre til forsikringsselskapet og si fra hvem som behandler saken.' : 'If you have a seller’s insurance (boligselgerforsikring), please pass this on to the insurer and tell ' + (we ? 'us' : 'me') + ' who is handling the case.');
    var sig = [nb ? 'Med vennlig hilsen' : 'Kind regards', [p.name, home && co ? co : ''].filter(Boolean).join(nb ? ' og ' : ' and '), [p.phone, p.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
    lines.push(sig);
    return { subject: subj, body: lines.join('\n\n'), replyBy: replyBy };
  }
  function letter(id) {
    var c = byId(id); if (!c) return;
    var lang = cfg().lang === 'en' ? 'en' : 'nb';
    var X = HF.sheet('The letter', 'hc-lbox');
    function drawL() {
      var L = letterText(c, lang);
      X.box.innerHTML = HF.head('envelope-paper', 'The letter', 'Check it, then send it by e-mail with the photos – that’s in writing.') +
        '<div class="lf-chips hc-lang"><button type="button" class="lf-chip" data-hcl="nb" aria-pressed="' + (lang === 'nb') + '">Norsk</button><button type="button" class="lf-chip" data-hcl="en" aria-pressed="' + (lang === 'en') + '">English</button></div>' +
        '<div class="hc-letter" data-noi18n><p class="hc-subj"><small>' + (lang === 'nb' ? 'Emne' : 'Subject') + '</small><b>' + esc(L.subject) + '</b></p><div class="hc-body">' + L.body.split('\n\n').map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div></div>' +
        ((c.photos || []).length ? '' : '<p class="muted hs2-note"><i class="bi bi-camera"></i> No photos yet – a photo makes the claim much clearer.</p>') +
        '<div class="hs2-acts"><button type="button" class="pill-btn" data-hcshare><i class="bi bi-box-arrow-up"></i> Share with photos</button>' +
        (c.email ? '<a class="text-btn" data-hcmail href="mailto:' + esc(encodeURIComponent(c.email)) + '?subject=' + esc(encodeURIComponent(L.subject)) + '&body=' + esc(encodeURIComponent(L.body.slice(0, 1800))) + '"><i class="bi bi-envelope"></i> E-mail</a>' : '') +
        '<button type="button" class="text-btn" data-hccopy><i class="bi bi-clipboard"></i> Copy</button><button type="button" class="text-btn" data-hcpdf><i class="bi bi-file-earmark-pdf"></i> Report (PDF)</button></div>' +
        (c.status === 'draft' ? '<div class="lf-foot"><span class="muted hs2-note" data-t="ui.sent-it">Sent it?</span><button type="button" class="pill-btn" data-hcdone><i class="bi bi-send-check"></i> I’ve sent it</button></div>' : '');
    }
    drawL();
    X.box.addEventListener('click', function (e) {
      var b, L = letterText(c, lang);
      if ((b = e.target.closest('[data-hcl]'))) { lang = b.dataset.hcl; drawL(); return; }
      if (e.target.closest('[data-hccopy]')) { copy(L.subject + '\n\n' + L.body); return; }
      if (e.target.closest('[data-hcpdf]')) { X.close(); return report(c.id, lang); }
      if (e.target.closest('[data-hcdone]')) { X.close(); return sentSheet(c.id); }
      if (e.target.closest('[data-hcshare]')) share(c, L);
    });
  }
  function copy(t) {
    var ok = function () { toast('<i class="bi bi-clipboard-check"></i> Copied – paste it into an e-mail'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { fallback(); }); else fallback();
    function fallback() { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) {} a.remove(); }
  }
  /* the share sheet with the photos attached (Mail on the iPhone takes them all); otherwise copy the text */
  function share(c, L) {
    var ids = (c.photos || []).slice(0, 10);
    Promise.all(ids.map(function (id, i) { return HF.get(id).then(function (b) { return b ? new File([b], 'photo-' + (i + 1) + '.jpg', { type: b.type || 'image/jpeg' }) : null; }); })).then(function (files) {
      files = files.filter(Boolean);
      var data = { title: L.subject, text: L.subject + '\n\n' + L.body };
      if (files.length && navigator.canShare && navigator.canShare({ files: files })) data.files = files;
      if (navigator.share && (!data.files || navigator.canShare(data))) navigator.share(data).catch(function () {});
      else { copy(data.text); if (files.length) toast('<i class="bi bi-info-circle"></i> Text copied – this browser can’t attach the photos; use the PDF report instead'); }
    });
  }
  function nudge(id) {
    var c = byId(id); if (!c) return;
    var nb = cfg().lang !== 'en', d = isKey(c.sent) ? fromKey(c.sent).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long' }) : '';
    var t = nb ? 'Hei' + (c.who ? ' ' + c.who : '') + ',\n\nJeg viser til reklamasjonen om «' + c.title + '» sendt ' + d + '. Jeg har ikke fått svar ennå, og ber om et skriftlig svar så snart som mulig, senest innen en uke.\n\nMed vennlig hilsen\n' + (me().name || '')
      : 'Hello' + (c.who ? ' ' + c.who : '') + ',\n\nI refer to my complaint about “' + c.title + '” sent on ' + d + '. I haven’t had an answer yet and ask for a written reply as soon as possible, at the latest within a week.\n\nKind regards\n' + (me().name || '');
    copy(t);
    saveOne(id, function (x) { logLine(x, 'Reminder sent'); x.replyBy = addDays(today(), 7); });
  }

  /* the report: A4, the letter and the photos – Save as PDF */
  function report(id, lang) {
    var c = byId(id); if (!c) return;
    var L = letterText(c, lang), nb = lang !== 'en', ti = takeInfo(c.home);
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-hcrclose><i class="bi bi-x-lg"></i> Close</button><span class="spacer"></span><button type="button" class="pill-btn" data-hcrprint><i class="bi bi-file-earmark-pdf"></i> Save as PDF</button></div>' +
      '<p class="rp-hint">In the print window, choose <b data-t="ui.save-as-pdf">Save as PDF</b> – then attach it to the e-mail.</p><article class="rp-doc" data-noi18n></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc'), dfmt = function (k) { return isKey(k) ? fromKey(k).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '–'; };
    var paras = L.body.split('\n\n');
    doc.innerHTML = '<header class="rp-head"><div><p class="rp-kick">' + (nb ? 'Reklamasjon' : 'Notice of defect') + '</p><h1>' + esc(c.title) + '</h1><p class="rp-addr">' + esc((c.against === 'seller' || c.against === 'builder') ? (ti.addr || '') : (c.where || '')) + '</p></div></header>' +
      '<table class="rp-meta"><tr><th>' + (nb ? 'Til' : 'To') + '</th><td>' + esc(c.who || '–') + (c.email ? '<br><small>' + esc(c.email) + '</small>' : '') + '</td><th>' + (nb ? 'Fra' : 'From') + '</th><td>' + esc(paras[paras.length - 1].split('\n').slice(1).join(', ') || '–') + '</td></tr>' +
      '<tr><th>' + (nb ? 'Dato' : 'Date') + '</th><td>' + esc(dfmt(c.status === 'draft' ? today() : c.sent)) + '</td><th>' + (nb ? 'Referanse' : 'Reference') + '</th><td>' + esc(c.ref || '–') + '</td></tr>' +
      '<tr><th>' + (nb ? 'Oppdaget' : 'Found') + '</th><td>' + esc(dfmt(c.found)) + '</td><th>' + (nb ? 'Svar innen' : 'Reply by') + '</th><td>' + esc(dfmt(L.replyBy)) + '</td></tr></table>' +
      '<div class="hc-rbody">' + paras.map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>' +
      ((c.photos || []).length ? '<h2>' + (nb ? 'Bilder' : 'Photos') + '</h2><div class="hc-rph">' + c.photos.map(function (p, i) { return '<figure><img data-hfimg="' + esc(p) + '" alt=""><figcaption>' + (nb ? 'Bilde ' : 'Photo ') + (i + 1) + '</figcaption></figure>'; }).join('') + '</div>' : '') +
      '<footer class="rp-foot">' + esc(L.subject) + '</footer>';
    HF.fill(doc);
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('click', function (e) {
      if (e.target.closest('[data-hcrclose]')) return close();
      if (e.target.closest('[data-hcrprint]')) { var tt = document.title; document.title = (nb ? 'Reklamasjon ' : 'Claim ') + c.title.slice(0, 40) + ' ' + today(); var done = function () { document.title = tt; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 400); setTimeout(done, 60000); }
    });
  }

  /* every claim in one report – a cover with the summary table, then one section per claim with its photos */
  var RL = {
    nb: { kick: 'Reklamasjonsrapport', home: 'Boligen', owners: 'Eiere', owner: 'Eier', seller: 'Selger / utbygger', agent: 'Megler', taken: 'Overtatt', count: 'Antall reklamasjoner', total: 'Anslått kostnad', made: 'Rapportdato',
      intro: function (n, d) { return 'Rapporten samler ' + n + (n === 1 ? ' reklamasjon' : ' reklamasjoner') + ' per ' + d + '. Hver mangel er beskrevet med sted, når den ble oppdaget, hva som kreves, status og bilder.'; },
      sum: 'Oversikt', no: 'Nr.', what: 'Mangel', where: 'Sted', found: 'Oppdaget', to: 'Gjelder', status: 'Status', next: 'Neste frist', cost: 'Kostnad', to2: 'Til', law: 'Regelverk', deliver: 'Overtatt / kjøpt', want: 'Krav', sent: 'Sendt', reply: 'Svarfrist', ref: 'Referanse', prot: 'Påpekt ved overtakelsen', yes: 'Ja',
      desc: 'Beskrivelse', log: 'Historikk', photos: 'Bilder', photo: 'Bilde', sign: 'Underskrift', place: 'Sted og dato', sendBy: 'send innen ', answer: 'svar innen ', none: '–', all: 'Alle', open: 'Bare åpne',
      foot: 'Reklamasjonsrapport', st: { draft: 'Utkast', sent: 'Sendt', reply: 'Besvart', agreed: 'Avtalt', fixed: 'Rettet', no: 'Avslått', closed: 'Lukket' },
      ag: { seller: 'Selger', builder: 'Utbygger', craftsman: 'Håndverker', shop: 'Butikk', other: 'Annet' }, wt: { fix: 'Retting', price: 'Prisavslag', comp: 'Erstatning', new: 'Omlevering', back: 'Heving', look: 'Vurdering først' },
      lw: { avh: 'Avhendingslova', buofl: 'Bustadoppføringslova', hvtj: 'Håndverkertjenesteloven', fkjl: 'Forbrukerkjøpsloven', other: '–' }, and: ' og ' },
    en: { kick: 'Claims report', home: 'The home', owners: 'Owners', owner: 'Owner', seller: 'Seller / builder', agent: 'Estate agent', taken: 'Taken over', count: 'Claims', total: 'Estimated cost', made: 'Report date',
      intro: function (n, d) { return 'This report brings together ' + n + (n === 1 ? ' claim' : ' claims') + ' as of ' + d + '. Each defect is described with where it is, when it was found, what is asked for, its status and photos.'; },
      sum: 'Summary', no: 'No.', what: 'Defect', where: 'Location', found: 'Found', to: 'Against', status: 'Status', next: 'Next deadline', cost: 'Cost', to2: 'To', law: 'Law', deliver: 'Taken over / bought', want: 'Claim', sent: 'Sent', reply: 'Reply by', ref: 'Reference', prot: 'Noted at the take-over', yes: 'Yes',
      desc: 'Description', log: 'History', photos: 'Photos', photo: 'Photo', sign: 'Signature', place: 'Place and date', sendBy: 'send by ', answer: 'reply by ', none: '–', all: 'All', open: 'Open only',
      foot: 'Claims report', st: { draft: 'Draft', sent: 'Sent', reply: 'Answered', agreed: 'Agreed', fixed: 'Fixed', no: 'Turned down', closed: 'Closed' },
      ag: { seller: 'Seller', builder: 'Builder', craftsman: 'Tradesman', shop: 'Shop', other: 'Other' }, wt: { fix: 'Put right', price: 'Price reduction', comp: 'Compensation', new: 'Replacement', back: 'Cancel the purchase', look: 'Assessment first' },
      lw: { avh: 'Avhendingslova (sale of real property)', buofl: 'Bustadoppføringslova (new homes)', hvtj: 'Håndverkertjenesteloven (tradesmen)', fkjl: 'Forbrukerkjøpsloven (consumer purchases)', other: '–' }, and: ' and ' } };
  /* the history is written in English; the Norwegian report says it in Norwegian */
  var LOGNB = [[/^Made the claim$/, 'Reklamasjonen ble laget'], [/^Made from a fault at the take-over$/, 'Laget fra en feil ved overtakelsen'], [/^Reminder sent$/, 'Påminnelse sendt'],
    [/^Sent by (e-mail|letter|text message|their web form)( to (.+))?$/, function (m, h, x, w) { return 'Sendt som ' + ({ 'e-mail': 'e-post', letter: 'brev', 'text message': 'SMS', 'their web form': 'skjemaet deres' })[h] + (w ? ' til ' + w : ''); }],
    [/^They answered(: (.+))?$/, 'De svarte$1'], [/^We agreed what happens(: (.+))?$/, 'Vi ble enige om hva som skjer$1'], [/^It’s fixed or paid(: (.+))?$/, 'Det er rettet eller betalt$1'],
    [/^They turned it down(: (.+))?$/, 'De avslo$1'], [/^Close the claim(: (.+))?$/, 'Reklamasjonen ble lukket$1'], [/^Just a note: (.+)$/, 'Notat: $1']];
  function logNb(t) { for (var i = 0; i < LOGNB.length; i++) if (LOGNB[i][0].test(t)) return t.replace(LOGNB[i][0], LOGNB[i][1]); return t; }
  function reportAll(o) {
    o = o || {};
    var lang = o.lang || (cfg().lang === 'en' ? 'en' : 'nb'), only = !!o.open, photos = o.photos !== false;
    var bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = '<div class="rp-bar"><button type="button" class="text-btn" data-hcaclose><i class="bi bi-x-lg"></i> Close</button><span class="spacer"></span>' +
      '<div class="lf-chips hc-aopt" data-noi18n><button type="button" class="lf-chip" data-hcaopen="0">Alle · All</button><button type="button" class="lf-chip" data-hcaopen="1">Åpne · Open</button></div>' +
      '<div class="lf-chips hc-aopt" data-noi18n><button type="button" class="lf-chip" data-hcalang="nb" data-t="ui.norsk">Norsk</button><button type="button" class="lf-chip" data-hcalang="en" data-t="ui.english">English</button></div>' +
      '<label class="rp-opt"><input type="checkbox" data-hcaph checked> Photos</label><button type="button" class="pill-btn" data-hcaprint><i class="bi bi-file-earmark-pdf"></i> Save as PDF</button></div>' +
      '<p class="rp-hint">One report with every claim – a summary first, then each claim on its own page with its photos. In the print window, choose <b data-t="ui.save-as-pdf">Save as PDF</b>.</p><article class="rp-doc hc-all" data-noi18n></article>';
    document.body.appendChild(bg); document.body.classList.add('rp-open');
    var doc = bg.querySelector('.rp-doc');
    function draw() {
      bg.querySelectorAll('[data-hcaopen]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.hcaopen === '1') === only)); });
      bg.querySelectorAll('[data-hcalang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.hcalang === lang)); });
      var T = RL[lang], nb = lang === 'nb', hid = o.home || hv(), ti = takeInfo(hid), p = me(), co = coName(hid), td = takeDate(hid);
      var dfmt = function (k, short) { return isKey(k) ? fromKey(k).toLocaleDateString(nb ? 'nb-NO' : 'en-GB', short ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' }) : T.none; };
      var L = list().filter(function (c) { return (!window.Homes || window.Homes.belongs(c, hid)) && (!only || OPEN[c.status]); }).sort(function (a, b) { return (a.found || a.at || '').localeCompare(b.found || b.at || ''); });
      var total = L.reduce(function (a, c) { return a + (+c.cost || 0); }, 0), owners = [p.name, co].filter(Boolean);
      var next = function (c) { var d = deadlines(c); return c.status === 'draft' && d.soft ? T.sendBy + dfmt(d.soft, true) : c.status === 'sent' && d.reply ? T.answer + dfmt(d.reply, true) : T.none; };
      var cnt = {}; L.forEach(function (c) { cnt[c.status] = (cnt[c.status] || 0) + 1; });
      var h = '<header class="rp-head"><div><p class="rp-kick">' + esc(T.kick) + '</p><h1>' + esc(ti.addr || T.home) + '</h1><p class="rp-addr">' + esc(dfmt(today())) + '</p></div>' +
        '<div class="iv-no"><small>' + esc(T.count) + '</small><b>' + L.length + '</b></div></header>' +
        '<table class="rp-meta"><tr><th>' + esc(owners.length > 1 ? T.owners : T.owner) + '</th><td>' + esc(owners.join(T.and) || T.none) + '</td><th>' + esc(T.seller) + '</th><td>' + esc(ti.seller || T.none) + '</td></tr>' +
        '<tr><th>' + esc(T.taken) + '</th><td>' + esc(dfmt(td)) + '</td><th>' + esc(T.agent) + '</th><td>' + esc(ti.agent || T.none) + '</td></tr>' +
        '<tr><th>' + esc(T.total) + '</th><td>' + (total ? esc(kr(total)) : T.none) + '</td><th>' + esc(T.made) + '</th><td>' + esc(dfmt(today())) + '</td></tr></table>' +
        '<p class="rp-intro">' + esc(T.intro(L.length, dfmt(today()))) + ' ' + Object.keys(cnt).map(function (k) { return esc(T.st[k] || k) + ': ' + cnt[k]; }).join(' · ') + '</p>' +
        '<h2>' + esc(T.sum) + '</h2><table class="rp-todo hc-sumt"><thead><tr><th>' + T.no + '</th><th>' + T.what + '</th><th>' + T.where + '</th><th>' + T.found + '</th><th>' + T.to + '</th><th>' + T.status + '</th><th>' + T.next + '</th><th class="hc-num">' + T.cost + '</th></tr></thead><tbody>' +
        L.map(function (c, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(c.title) + '</b></td><td>' + esc(c.where || T.none) + '</td><td>' + esc(dfmt(c.found, true)) + '</td><td>' + esc(T.ag[c.against] || T.ag.other) + (c.who ? '<br><small>' + esc(c.who) + '</small>' : '') + '</td><td>' + esc(T.st[c.status] || c.status) + '</td><td>' + esc(next(c)) + '</td><td class="hc-num">' + (+c.cost ? esc(kr(c.cost)) : T.none) + '</td></tr>'; }).join('') +
        (total ? '<tr class="hc-tot"><td></td><td colspan="6"><b>' + esc(T.total) + '</b></td><td class="hc-num"><b>' + esc(kr(total)) + '</b></td></tr>' : '') + '</tbody></table>' +
        L.map(function (c, i) {
          var d = (c.log || []).slice(), lk = lawKey(c), rows = [[T.to2, (c.who || T.none) + (c.email ? ' · ' + c.email : '')], [T.law, T.lw[lk] || T.none], [T.where, c.where || T.none], [T.found, dfmt(c.found)], [T.deliver, dfmt(c.deliver)], [T.want, T.wt[c.want] || T.wt.fix],
            [T.cost, +c.cost ? kr(c.cost) : T.none], [T.status, T.st[c.status] || c.status], [T.sent, dfmt(c.sent)], [T.reply, c.status === 'sent' ? dfmt(c.replyBy) : T.none], [T.ref, c.ref || T.none]];
          if (c.inProt) rows.push([T.prot, T.yes]);
          var meta = ''; for (var r = 0; r < rows.length; r += 2) meta += '<tr><th>' + esc(rows[r][0]) + '</th><td>' + esc(rows[r][1]) + '</td>' + (rows[r + 1] ? '<th>' + esc(rows[r + 1][0]) + '</th><td>' + esc(rows[r + 1][1]) + '</td>' : '<th></th><td></td>') + '</tr>';
          return '<section class="hc-rsec"><h2>' + (i + 1) + '. ' + esc(c.title) + '</h2><table class="rp-meta">' + meta + '</table>' +
            '<h3>' + esc(T.desc) + '</h3><p class="rp-notes">' + esc(c.desc || c.title).replace(/\n/g, '<br>') + '</p>' +
            (d.length ? '<h3>' + esc(T.log) + '</h3><table class="rp-todo hc-logt"><tbody>' + d.map(function (x) { return '<tr><td>' + esc(dfmt(x.d, true)) + '</td><td>' + esc(nb ? logNb(x.t) : x.t) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
            (photos && (c.photos || []).length ? '<h3>' + esc(T.photos) + '</h3><div class="hc-rph">' + c.photos.map(function (ph, j) { return '<figure><img data-hfimg="' + esc(ph) + '" alt=""><figcaption>' + esc(T.photo) + ' ' + (i + 1) + '.' + (j + 1) + '</figcaption></figure>'; }).join('') + '</div>' : '') + '</section>';
        }).join('') +
        '<div class="rg-sign hc-sign">' + (owners.length ? owners : ['']).map(function (n) { return '<div><span></span><p>' + esc(n || T.sign) + ' · ' + esc(T.place) + '</p></div>'; }).join('') + '</div>' +
        '<footer class="rp-foot">' + esc(T.foot) + ' · ' + esc(ti.addr || '') + ' · ' + esc(today()) + '</footer>';
      doc.innerHTML = h; HF.fill(doc);
    }
    function close() { bg.remove(); document.body.classList.remove('rp-open'); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    bg.addEventListener('change', function (e) { if (e.target.matches('[data-hcaph]')) { photos = e.target.checked; draw(); } });
    bg.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-hcaclose]')) return close();
      if ((b = e.target.closest('[data-hcaopen]'))) { only = b.dataset.hcaopen === '1'; return draw(); }
      if ((b = e.target.closest('[data-hcalang]'))) { lang = b.dataset.hcalang; return draw(); }
      if (e.target.closest('[data-hcaprint]')) { var tt = document.title; document.title = (lang === 'nb' ? 'Reklamasjonsrapport ' : 'Claims report ') + today(); var done = function () { document.title = tt; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 500); setTimeout(done, 60000); }
    });
    draw();
  }

  /* a new claim from elsewhere (a fault at the take-over) */
  function create(o) {
    var it = Object.assign({ id: uid(), status: 'draft', want: 'fix', photos: [], log: [{ id: uid(), d: today(), t: o.from === 'take' ? 'Made from a fault at the take-over' : 'Made the claim' }], at: today(), deliver: takeDate(cur()), home: cur() }, o);
    var t = Fe.tools(); t.hclaims = (Array.isArray(t.hclaims) ? t.hclaims : []).concat([it]); Fe.saveTools(t);
    return it.id;
  }

  /* ---------- the rest of the dashboard ---------- */
  var here = /\/cmd\/house\//.test(location.pathname);
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!on() || cfg().glance === false) return;
    list().forEach(function (c) {
      var d = deadlines(c), href = (here ? '' : '/cmd/house/') + '#hclaims=' + c.id;
      if (c.status === 'draft' && d.soft && daysTo(c.found) <= -7) { var n = daysTo(d.soft); add(n < 7 ? 12 : 34, 'exclamation-diamond', n < 7 ? '#e66767' : '#c98500', 'Send the claim: ' + c.title, n < 0 ? 'Found ' + (-daysTo(c.found)) + ' days ago – send it now' : 'Don’t wait – a claim should go out soon after you find the fault', href, { key: 'hc:d:' + c.id + ':' + (n < 7 ? 1 : 0) }); }
      if (c.status === 'sent' && isKey(c.replyBy) && daysTo(c.replyBy) < 0) add(24, 'hourglass-bottom', '#e66767', 'No answer on: ' + c.title, 'Asked for by ' + fmt(c.replyBy, { day: 'numeric', month: 'short' }) + ' – send a reminder', href, { key: 'hc:r:' + c.id + ':' + c.replyBy });
    });
    /* a new home: the one-year inspection */
    var ti = takeInfo(cur()), td = takeDate(cur());
    if (ti.kind === 'new' && td) { var y = addYears(td, 1), n1 = daysTo(y); if (n1 <= 45 && n1 >= -14) add(40, 'building-check', '#0891b2', 'One-year inspection (ettårsbefaring) ' + (n1 >= 0 ? 'around ' + fmt(y, { day: 'numeric', month: 'short' }) : 'is due'), 'Walk round the home and note what’s wrong – bring the list to the builder', (here ? '' : '/cmd/house/') + '#hclaim', { key: 'hc:y1:' + y, tip: true }); }
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    var out = [];
    list().forEach(function (c) { if (c.status === 'sent' && isKey(c.replyBy)) out.push({ id: 'rem:hc:' + c.id, title: 'Answer due: ' + c.title, allDay: true, start: fromKey(c.replyBy), days: 1, color: '#e66767', readOnly: true, reminder: true, link: '/cmd/house/#hclaims=' + c.id, location: '', notes: 'Reklamasjon', exDays: {} }); });
    var ti = takeInfo(cur()), td = takeDate(cur()); if (ti.kind === 'new' && td) out.push({ id: 'rem:hc:y1', title: 'One-year inspection (ettårsbefaring)', allDay: true, start: fromKey(addYears(td, 1)), days: 1, color: '#0891b2', readOnly: true, reminder: true, link: '/cmd/house/#hclaim', location: '', notes: 'A year since the take-over', exDays: {} });
    return out;
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'exclamation-diamond', t: 'New claim (reklamasjon)', s: 'House · Claims', run: function () { if (mountEl && K) { if (window.PageTabs) window.PageTabs.show('claims', true); pickKind(); } else location.href = '/cmd/house/#hclaim'; }, x: 'reklamasjon claim complaint klage mangel defect fault feil seller selger' },
      { i: 'file-earmark-pdf', t: 'Report of all claims (PDF)', s: 'House · Claims', run: function () { if (mountEl) reportAll(); else location.href = '/cmd/house/#hclaim'; }, x: 'reklamasjonsrapport report rapport claims pdf alle' }] : [];
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    list().forEach(function (c) { add('House', 'exclamation-diamond', c.title, 'Claim · ' + (STATUS[c.status] || STATUS.draft)[0] + (c.who ? ' · ' + c.who : ''), '/cmd/house/#hclaims=' + c.id, c.found || '', [c.desc, c.where, c.ref, 'reklamasjon claim'].join(' ')); });
  });
  window.HouseClaims = { co: coName, reportAll: function (o) { reportAll(o); }, create: create, list: list, letter: letterText, report: report, deadlines: deadlines };
})();
