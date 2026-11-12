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
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in house-claims.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["claims"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HF = window.HouseFiles;
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
  function on() { return Fe.on('house') && Fe.on('hclaim'); }
  function list() { return Fe.list('hclaims'); }
  function cfg() { var c = Fe.tools().hclaimcfg; return Object.assign({ lang: 'nb', replyDays: 14, co: 'auto', coName: '' }, c && typeof c === 'object' ? c : {}); }
  function partner() { return window.Shared && window.Shared.partner && window.Shared.partner(); }
  function coName(h) { var H = window.Homes && window.Homes.get(hv(h)); if (H && H.co) { if (H.co === 'none') return ''; if (H.co === 'name') return String(H.coName || '').trim(); } var c = cfg(); if (c.co === 'none') return ''; if (c.co === 'name') return String(c.coName || '').trim(); var p = partner(); return p ? p.name : ''; }
  HF && HF.uses(function () { var ids = []; list().forEach(function (c) { ids = ids.concat(c.photos || []); }); return ids; });
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
  var STATUS = {
    draft: ['Draft', '#7a8794', 'pencil'], sent: ['Sent', '#3987e5', 'send'], reply: ['Answered', '#8a6fdf', 'reply'],
    agreed: ['Agreed', '#22b35e', 'hand-thumbs-up'], fixed: ['Fixed', '#22b35e', 'check2-circle'], no: ['Turned down', '#e66767', 'x-octagon'], closed: ['Closed', '#7a8794', 'archive'] };
  function law(c) { return LAW[c.law] || LAW[ag(c.against)[5]] || LAW.other; }
  function lawKey(c) { return LAW[c.law] ? c.law : ag(c.against)[5]; }
  function deadlines(c) {
    var L = law(c), lk = lawKey(c), out = {};
    if (isKey(c.found) && lk !== 'other') out.soft = addDays(c.found, 60);
    if (isKey(c.deliver) && L.years) out.hard = addYears(c.deliver, lk === 'fkjl' && c.long ? 5 : L.years);
    if (c.status === 'sent' && isKey(c.replyBy)) out.reply = c.replyBy;
    return out;
  }
  function hv(h) { return h || (window.Homes ? window.Homes.view() : null); }
  function takeDate(h) { if (window.HouseMove) return window.HouseMove.date(hv(h)) || ''; var m = Fe.tools().hmove; return m && isKey(m.date) ? m.date : ''; }
  function takeInfo(h) { var x = window.HouseMove ? window.HouseMove.data(hv(h)) : {}, H = window.Homes && window.Homes.get(hv(h)); return H ? Object.assign({}, x, { addr: x.addr || H.addr || '', seller: x.seller || H.seller || '', agent: x.agent || H.agent || '', kind: x.kind || H.kind }) : x; }
  function cur() { return window.Homes ? window.Homes.current() : null; }
  function create(o) {
    var it = Object.assign({ id: uid(), status: 'draft', want: 'fix', photos: [], log: [{ id: uid(), d: today(), t: o.from === 'take' ? 'Made from a fault at the take-over' : 'Made the claim' }], at: today(), deliver: takeDate(cur()), home: cur() }, o);
    var t = Fe.tools(); t.hclaims = (Array.isArray(t.hclaims) ? t.hclaims : []).concat([it]); Fe.saveTools(t);
    return it.id;
  }
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
    if (ti.kind === 'new' && td) { var y = addYears(td, 1), n1 = daysTo(y); if (n1 <= 45 && n1 >= -14) add(40, 'building-check', '#0891b2', 'One-year inspection (ettårsbefaring) ' + (n1 >= 0 ? 'around ' + fmt(y, { day: 'numeric', month: 'short' }) : 'is due'), I18N.k('ui.walk-round-the-home-and-note-whats-wrong', 'Walk round the home and note what’s wrong – bring the list to the builder'), (here ? '' : '/cmd/house/') + '#hclaim', { key: 'hc:y1:' + y, tip: true }); }
  });
  (window.EventsExtra = window.EventsExtra || []).push(function () {
    if (!on()) return [];
    var out = [];
    list().forEach(function (c) { if (c.status === 'sent' && isKey(c.replyBy)) out.push({ id: 'rem:hc:' + c.id, title: 'Answer due: ' + c.title, allDay: true, start: fromKey(c.replyBy), days: 1, color: '#e66767', readOnly: true, reminder: true, link: '/cmd/house/#hclaims=' + c.id, location: '', notes: 'Reklamasjon', exDays: {} }); });
    var ti = takeInfo(cur()), td = takeDate(cur()); if (ti.kind === 'new' && td) out.push({ id: 'rem:hc:y1', title: 'One-year inspection (ettårsbefaring)', allDay: true, start: fromKey(addYears(td, 1)), days: 1, color: '#0891b2', readOnly: true, reminder: true, link: '/cmd/house/#hclaim', location: '', notes: 'A year since the take-over', exDays: {} });
    return out;
  });
  (window.CommandExtra = window.CommandExtra || []).push(function () {
    return on() ? [{ i: 'exclamation-diamond', t: 'New claim (reklamasjon)', s: 'House · Claims', run: function () { if (__ui().mountEl && __ui().K) { if (window.PageTabs) window.PageTabs.show('claims', true); __ui().pickKind(); } else location.href = '/cmd/house/#hclaim'; }, x: 'reklamasjon claim complaint klage mangel defect fault feil seller selger' },
      { i: 'file-earmark-pdf', t: 'Report of all claims (PDF)', s: 'House · Claims', run: function () { if (__ui().mountEl) __ui().reportAll(); else location.href = '/cmd/house/#hclaim'; }, x: 'reklamasjonsrapport report rapport claims pdf alle' }] : [];
  });
  (window.SearchExtra = window.SearchExtra || []).push(function (add) {
    if (!on()) return;
    list().forEach(function (c) { add('House', 'exclamation-diamond', c.title, 'Claim · ' + (STATUS[c.status] || STATUS.draft)[0] + (c.who ? ' · ' + c.who : ''), '/cmd/house/#hclaims=' + c.id, c.found || '', [c.desc, c.where, c.ref, 'reklamasjon claim'].join(' ')); });
  });
  window.HouseClaims = { co: coName, create: create, list: list, deadlines: deadlines };
  (window.__core = window.__core || {})["claims"] = { STATUS: STATUS, list: list, Fe: Fe, on: on, addYears: addYears, dkey: dkey, pad: pad, fromKey: fromKey, takeDate: takeDate, isKey: isKey, hv: hv, cur: cur, takeInfo: takeInfo, fmt: fmt, daysTo: daysTo, today: today, here: here, deadlines: deadlines, addDays: addDays, lawKey: lawKey, ag: ag, AGAINST: AGAINST, LAW: LAW, law: law, cfg: cfg, HF: HF, create: create, uid: uid, coName: coName, partner: partner };
})();
