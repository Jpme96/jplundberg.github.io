/* Travel: fill things in for you (2026-11-22, JP: "european passport uses nfc" → "Yeah").
   1. Passport / ID card from the two (or three) lines at the bottom of the photo page – the machine-readable zone (MRZ).
      A website can't read the chip (Safari has no Web NFC; Chrome's Web NFC is NDEF only, the chip needs ISO-DEP), so the
      lines are pasted (the iPhone's Live Text copies them from the photo) or typed. Every field is checked with its check
      digit (ICAO 9303: weights 7-3-1). Nothing leaves the phone.
   2. A booking confirmation (the email text, or its PDF) → the flights and the stay for the trip: Norwegian (DY/D8) and
      other airlines by flight number, Airbnb and other stays by check-in/check-out. You see what was found before it's added.
   Page module for the Travel page (after trips.js). window.TravelImport = { mrz, booking } for the tests. */
(function () {
  'use strict';
  var K = function (k, e, o) { return window.I18N ? I18N.k(k, e, o) : String(e).replace(/\{(\w+)\}/g, function (m, x) { return o && o[x] != null ? o[x] : m; }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return ('0' + n).slice(-2); }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(k) { if (!k) return ''; var d = new Date(k + 'T12:00'); return d.toLocaleDateString(window.I18N && I18N.lang === 'nb' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* ================= 1. the machine-readable zone ================= */
  function val(c) { return c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55; }
  function check(s) { var w = [7, 3, 1], n = 0; for (var i = 0; i < s.length; i++) n += val(s[i]) * w[i % 3]; return String(n % 10); }
  var DIG = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
  function digits(s) { return s.replace(/[A-Z]/g, function (c) { return DIG[c] || c; }); }      /* letters a camera reads in a number field */
  function ymd(s, future) {
    if (!/^\d{6}$/.test(s)) return '';
    var yy = +s.slice(0, 2), now = new Date().getFullYear() % 100, y = future ? (yy < 70 ? 2000 + yy : 1900 + yy) : (yy > now ? 1900 + yy : 2000 + yy);
    return y + '-' + s.slice(2, 4) + '-' + s.slice(4, 6);
  }
  function names(s) {
    var p = s.replace(/<+$/, '').split('<<'), sur = (p[0] || '').replace(/</g, ' ').trim(), giv = (p.slice(1).join(' ') || '').replace(/</g, ' ').trim();
    var cap = function (x) { return x.toLowerCase().replace(/(^|[\s-])\S/g, function (m) { return m.toUpperCase(); }); };
    return { surname: cap(sur), given: cap(giv) };
  }
  function mrz(text) {
    var t = String(text || '').toUpperCase().replace(/[«‹]/g, '<').replace(/[ \t]+/g, '').replace(/[^A-Z0-9<\n]/g, '');
    var lines = t.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length >= 28; });
    if (lines.length === 1 && lines[0].length >= 86) lines = [lines[0].slice(0, 44), lines[0].slice(44, 88)];
    if (lines.length === 1 && lines[0].length >= 88) lines = [lines[0].slice(0, 30), lines[0].slice(30, 60), lines[0].slice(60, 90)];
    var fix = function (l, n) { l = l.slice(0, n); while (l.length < n) l += '<'; return l; };
    var out, ok = [];
    if (lines.length >= 2 && lines[0].length >= 40) {          /* TD3 – passports: 2 × 44 */
      var a = fix(lines[0], 44), b = fix(lines[1], 44);
      var no = b.slice(0, 9), noC = digits(b[9]), born = digits(b.slice(13, 19)), bornC = digits(b[19]), exp = digits(b.slice(21, 27)), expC = digits(b[27]), pers = b.slice(28, 42), persC = digits(b[42]), all = digits(b[43]);
      ok = [check(no) === noC, check(born) === bornC, check(exp) === expC, (pers.replace(/</g, '') === '' && (persC === '<' || persC === '0')) || check(pers) === persC,
        check(no + noC + born + bornC + exp + expC + pers + persC) === all];
      var nm = names(a.slice(5));
      out = { format: 'TD3', type: a[0] === 'P' ? 'passport' : 'id', country: a.slice(2, 5).replace(/</g, ''), number: no.replace(/</g, ''), nationality: b.slice(10, 13).replace(/</g, ''),
        born: ymd(born, false), sex: b[20] === '<' ? '' : b[20], expires: ymd(exp, true), surname: nm.surname, given: nm.given };
    } else if (lines.length >= 3) {                              /* TD1 – national ID cards: 3 × 30 */
      var c1 = fix(lines[0], 30), c2 = fix(lines[1], 30), c3 = fix(lines[2], 30);
      var no1 = c1.slice(5, 14), no1C = digits(c1[14]), born1 = digits(c2.slice(0, 6)), born1C = digits(c2[6]), exp1 = digits(c2.slice(8, 14)), exp1C = digits(c2[14]);
      ok = [check(no1) === no1C, check(born1) === born1C, check(exp1) === exp1C, check(c1.slice(5, 30) + born1 + born1C + exp1 + exp1C + c2.slice(18, 29)) === digits(c2[29])];
      var nm1 = names(c3);
      out = { format: 'TD1', type: 'id', country: c1.slice(2, 5).replace(/</g, ''), number: no1.replace(/</g, ''), nationality: c2.slice(15, 18).replace(/</g, ''),
        born: ymd(born1, false), sex: c2[7] === '<' ? '' : c2[7], expires: ymd(exp1, true), surname: nm1.surname, given: nm1.given };
    } else return null;
    out.checks = ok; out.valid = ok.every(Boolean);
    return out;
  }

  /* ================= 2. booking confirmations ================= */
  var MON = { jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mar: 3, mars: 3, march: 3, apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };
  var MW = Object.keys(MON).sort(function (a, b) { return b.length - a.length; }).join('|');
  var DATE_RX = new RegExp('(\\d{4})-(\\d{2})-(\\d{2})|(\\d{1,2})[./](\\d{1,2})[./](\\d{2,4})|(\\d{1,2})\\.?\\s*(' + MW + ')\\.?,?\\s*(\\d{4})?|(' + MW + ')\\.?\\s+(\\d{1,2}),?\\s*(\\d{4})?', 'gi');
  function dates(s, now) {
    var out = [], m; DATE_RX.lastIndex = 0; now = now || new Date();
    while ((m = DATE_RX.exec(s))) {
      var y, mo, d;
      if (m[1]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
      else if (m[4]) { d = +m[4]; mo = +m[5]; y = +m[6]; if (y < 100) y += 2000; }
      else if (m[7]) { d = +m[7]; mo = MON[m[8].toLowerCase()]; y = m[9] ? +m[9] : 0; }
      else { mo = MON[m[10].toLowerCase()]; d = +m[11]; y = m[12] ? +m[12] : 0; }
      if (!mo || mo > 12 || !d || d > 31) continue;
      if (!y) { y = now.getFullYear(); if (new Date(y, mo - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) y++; }   /* no year: the next time it comes round */
      out.push({ k: y + '-' + pad(mo) + '-' + pad(d), at: m.index, end: m.index + m[0].length });
    }
    return out;
  }
  function times(s) { var out = [], rx = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm)?\b/gi, m; while ((m = rx.exec(s))) { var h = +m[1]; if (m[3]) { if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; } out.push({ v: pad(h) + ':' + m[2], at: m.index }); } return out; }
  function money(s) {
    var rx = /(totalt?|totalpris|total price|totalbeløp|sum|å betale|amount paid|you paid|betalt|grand total|pris totalt)[^0-9\n]{0,40}?((?:nok|kr)\.?\s*)?(\d[\d .,\u00a0\u202f]*\d|\d)/gi, m, best = 0;
    while ((m = rx.exec(s))) {
      var raw = m[3].trim(), dec = raw.match(/[.,](\d{1,2})$/), whole = (dec ? raw.slice(0, -dec[0].length) : raw).replace(/[ .,\u00a0\u202f]/g, '');   /* "1 849,00", "2,499", "3.210,50" */
      var v = +(whole + (dec ? '.' + dec[1] : '')); if (v > best && v < 1e6) best = v;
    }
    return best ? Math.round(best) : '';
  }
  var AIR = { OSL: 'Oslo', BGO: 'Bergen', TRD: 'Trondheim', SVG: 'Stavanger', TOS: 'Tromsø', BOO: 'Bodø', KRS: 'Kristiansand', AES: 'Ålesund', HAU: 'Haugesund', EVE: 'Harstad/Narvik', TRF: 'Sandefjord Torp',
    CPH: 'Copenhagen', ARN: 'Stockholm', HEL: 'Helsinki', KEF: 'Reykjavík', LGW: 'London Gatwick', LHR: 'London Heathrow', STN: 'London Stansted', BER: 'Berlin', AMS: 'Amsterdam', CDG: 'Paris', ORY: 'Paris Orly',
    BCN: 'Barcelona', MAD: 'Madrid', AGP: 'Málaga', ALC: 'Alicante', PMI: 'Palma', LPA: 'Gran Canaria', TFS: 'Tenerife', FCO: 'Rome', MXP: 'Milan', NCE: 'Nice', LIS: 'Lisbon', ATH: 'Athens', PRG: 'Prague',
    VIE: 'Vienna', BUD: 'Budapest', DBV: 'Dubrovnik', SPU: 'Split', IST: 'Istanbul', DXB: 'Dubai', JFK: 'New York', EWR: 'New York Newark', MIA: 'Miami', LAX: 'Los Angeles', BKK: 'Bangkok' };
  function place(code, txt) { var m = txt.match(new RegExp('([A-ZÆØÅ][\\wæøåÆØÅ .\\-/]{1,40}?)\\s*\\(' + code + '\\)')); return (m ? m[1].trim().replace(/^.*\b(fra|til|from|to)\s+/i, '').replace(/^.*\b(?:DY|D8|SK|WF|FR|U2|W6|LH|KL|AF|BA|AY|TK|LX|OS|DL|UA|IB|VY|EK|QR|SN|EW|LO)\s?-?\d{1,4}\s+/, '').replace(/^\d{1,2}[:.]\d{2}\s+/, '') : AIR[code] || code) + ' (' + code + ')'; }
  function booking(text, now) {
    var s = String(text || '').replace(/\r/g, '').replace(/[  ]/g, ' '), found = [], m;
    var ref = (m = s.match(/(bestillingsreferanse|booking reference|bookingreferanse|referansenummer|reservation code|reservasjonskode|bekreftelseskode|confirmation code|bookingnummer|booking number|pnr)\s*[:#]?\s*([A-Z0-9]{5,12})\b/i)) ? m[2].toUpperCase() : '';
    var cost = money(s);
    /* flights: every flight number, with the nearest date, the two times and the airports around it */
    var FRX = /\b(DY|D8|SK|WF|FR|U2|W6|LH|KL|AF|BA|AY|TK|LX|OS|DL|UA|IB|VY|EK|QR|SN|EW|LO)\s?-?(\d{1,4})\b/g, legs = [];
    var hits = []; while ((m = FRX.exec(s))) hits.push({ m: m, at: m.index });
    hits.forEach(function (h, hi) {
      m = h.m;
      /* this flight's own part of the text: from the end of the one before to the start of the next */
      var prevEnd = hi ? hits[hi - 1].at + hits[hi - 1].m[0].length : 0, nextAt = hits[hi + 1] ? hits[hi + 1].at : s.length;
      var from = Math.max(prevEnd, m.index - 120), win = s.slice(from, Math.min(nextAt, m.index + 320)), rel = m.index - from;
      var ds = dates(win, now), ts = times(win), codes = [], cm, crx = /\(([A-Z]{3})\)|\b([A-Z]{3})\s*(?:[-–→>]|til|to)\s*([A-Z]{3})\b/g;
      while ((cm = crx.exec(win))) { if (cm[1]) codes.push({ c: cm[1], at: cm.index }); else { codes.push({ c: cm[2], at: cm.index }); codes.push({ c: cm[3], at: cm.index + 1 }); } }
      codes = codes.filter(function (c) { return !/^(NOK|EUR|USD|SEK|DKK|GBP|PNR|REF|DAG)$/.test(c.c); });
      var near = function (l) { return l.slice().sort(function (a, b) { return Math.abs(a.at - rel) - Math.abs(b.at - rel); }); };
      var after = function (l) { return l.filter(function (x) { return x.at >= rel; }); };
      var d0 = near(ds)[0], tt = after(ts).slice(0, 2), cc = after(codes).length >= 2 ? after(codes).slice(0, 2) : codes.slice(0, 2);
      if (!d0) return;
      var no = m[1] + ' ' + m[2], dup = legs.filter(function (l) { return l.title === no && l.date === d0.k; })[0]; if (dup) return;
      var leg = { type: 'flight', title: no, date: d0.k, time: tt[0] ? tt[0].v : '', endTime: tt[1] ? tt[1].v : '', from: cc[0] ? place(cc[0].c, win) : '', to: cc[1] ? place(cc[1].c, win) : '', ref: ref };
      if (leg.endTime && leg.time && leg.endTime < leg.time && /\+1|neste dag|next day/i.test(win)) { var nx = new Date(leg.date + 'T12:00'); nx.setDate(nx.getDate() + 1); leg.endDate = key(nx); }
      legs.push(leg);
    });
    legs.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    found = found.concat(legs);
    /* a stay: check-in and check-out (Airbnb, hotels) */
    var ci = s.search(/innsjekk(ing)?|check[\s-]?in|ankomst(?!\s*\d{1,2}[:.])/i), co = s.search(/utsjekk(ing)?|check[\s-]?out|avreise(?!\s*\d{1,2}[:.])/i);
    if (ci > -1 && co > -1 && !legs.length || (/airbnb|booking\.com|hotels\.com|hotel|hotell/i.test(s) && ci > -1 && co > -1)) {
      var dci = dates(s.slice(ci, ci + 140), now)[0], dco = dates(s.slice(co, co + 140), now)[0];
      if (dci && dco && dco.k >= dci.k) {
        var tci = times(s.slice(ci, ci + 140))[0], tco = times(s.slice(co, co + 140))[0];
        var addr = (m = s.match(/(?:adresse|address|veibeskrivelse|location)\s*[:\n]\s*([^\n]{6,120})/i)) ? m[1].trim() : '';
        var city = (m = s.match(/(?:reisen din til|turen din til|your trip to|reservasjon i|reservation in|stay in|opphold i)\s+([A-ZÆØÅ][\wæøåÆØÅ\- ]{1,30})/)) ? m[1].trim() : '';
        var host = /airbnb/i.test(s) ? 'Airbnb' : /booking\.com/i.test(s) ? 'Booking.com' : /hotels\.com/i.test(s) ? 'Hotels.com' : K('ui.ti-stay', 'Stay');
        var sref = (m = s.match(/(bekreftelseskode|confirmation code|reservasjonskode|reservation code|bookingnummer|booking number|bekreftelsesnummer|confirmation number)\s*[:#]?\s*([A-Z0-9]{6,14})\b/i)) ? m[2].toUpperCase() : ref;
        found.push({ type: 'hotel', title: host + (city ? ' · ' + city : ''), date: dci.k, time: tci ? tci.v : '', endDate: dco.k, endTime: tco ? tco.v : '', from: addr, to: '', ref: sref });
      }
    }
    if (found.length && cost) found[0].cost = String(cost);   /* the total goes on the first one – Finances gets it once */
    return found;
  }

  window.TravelImport = { mrz: mrz, booking: booking, check: check };

  /* ================= the forms ================= */
  function paperOpts(sel) {
    var Fe = window.Features, l = Fe && Fe.list ? Fe.list('papers') : [];
    l = l.slice().sort(function (a, b) { return (b.kind === 'id') - (a.kind === 'id') || String(a.title || '').localeCompare(b.title || ''); });
    return '<option value="">' + esc(K('ui.ti-doc-noscan', 'None')) + '</option>' + l.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.title || p.name || '') + '</option>'; }).join('');
  }
  function mount() {   /* the two boxes on this page's forms; the listeners again for each new page (an instant page change takes them away) */
  var docForm = document.getElementById('docForm'), tiForm = document.getElementById('tiForm');
  /* the passport box at the top of "Add document" */
  if (docForm && !document.getElementById('docMrzBox')) {
    var head = docForm.querySelector('.cl-sheet-head');
    var box = document.createElement('div'); box.id = 'docMrzBox'; box.className = 'ti-imp';
    box.innerHTML = '<details><summary><i class="bi bi-upc-scan"></i> ' + esc(K('ui.ti-mrz', 'Read from the passport')) + '</summary>' +
      '<p class="muted">' + esc(K('ui.ti-mrz-how', 'Copy the two lines with <<< at the bottom of the photo page – on an iPhone, open the photo, press on the text and Copy (Live Text) – and paste them here. National ID cards have three lines. Everything is read and checked on this phone.')) + '</p>' +
      '<textarea id="docMrz" rows="3" spellcheck="false" autocapitalize="characters" placeholder="P<NOR…&#10;…"></textarea>' +
      '<button type="button" class="pill-btn" id="docMrzGo"><i class="bi bi-magic"></i> ' + esc(K('ui.ti-mrz-go', 'Read')) + '</button><p class="ti-imp-out" id="docMrzOut" aria-live="polite"></p></details>' +
      '<label class="ti-imp-row"><span>' + esc(K('ui.ti-doc-no', 'Number')) + '</span><input id="docNo" maxlength="20" autocomplete="off"></label>' +
      '<label class="ti-imp-row"><span>' + esc(K('ui.ti-doc-holder', 'Name in it')) + '</span><input id="docHolder" maxlength="60" autocomplete="off"></label>' +
      '<input type="hidden" id="docCC"><input type="hidden" id="docBorn">' +
      '<label class="ti-imp-row"><span>' + esc(K('ui.ti-doc-scan', 'The scan in Papers')) + '</span><select id="docPaper"></select></label>';
    head.after(box);
  }
  if (tiForm && !document.getElementById('tiImpBox')) {
    var h2 = tiForm.querySelector('.cl-sheet-head');
    var ib = document.createElement('div'); ib.id = 'tiImpBox'; ib.className = 'ti-imp';
    ib.innerHTML = '<details><summary><i class="bi bi-envelope-paper"></i> ' + esc(K('ui.ti-imp', 'Fill in from a confirmation')) + '</summary>' +
      '<p class="muted">' + esc(K('ui.ti-imp-how', 'Paste the confirmation email from Norwegian, Airbnb or another airline or stay – or choose its PDF. You see what was found before anything is added.')) + '</p>' +
      '<textarea id="tiImpText" rows="4" placeholder="' + esc(K('ui.ti-imp-ph', 'Paste the email here')) + '"></textarea>' +
      '<div class="ti-imp-acts"><button type="button" class="pill-btn" id="tiImpGo"><i class="bi bi-magic"></i> ' + esc(K('ui.ti-imp-go', 'Find the bookings')) + '</button>' +
      '<label class="text-btn"><i class="bi bi-file-earmark-pdf"></i> ' + esc(K('ui.ti-imp-pdf', 'Choose a PDF')) + '<input type="file" id="tiImpPdf" accept="application/pdf,.pdf" hidden></label></div>' +
      '<div id="tiImpOut" aria-live="polite"></div></details>';
    h2.after(ib);
  }
    if (mount.form !== docForm) { mount.form = docForm; wire(); }
  }
  window.TravelImport.mount = mount;
  window.TravelImport.fillDoc = function (d) {
    var g = function (id) { return document.getElementById(id); }; if (!g('docNo')) return;
    g('docNo').value = d && d.number || ''; g('docHolder').value = d && d.holder || ''; g('docCC').value = d && d.cc || ''; g('docBorn').value = d && d.born || '';
    g('docPaper').innerHTML = paperOpts(d && d.paper); g('docMrz').value = ''; g('docMrzOut').textContent = '';
    var det = document.querySelector('#docMrzBox details'); if (det) det.open = !d;
  };
  window.TravelImport.readDoc = function () {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    return { number: g('docNo').slice(0, 20), holder: g('docHolder').slice(0, 60), cc: g('docCC').slice(0, 3), born: g('docBorn'), paper: g('docPaper') };
  };
  var lastFound = [];
  var TYPE_ICON = { flight: 'airplane', hotel: 'house-door' };
  function showFound(list) {
    lastFound = list; var out = document.getElementById('tiImpOut'); if (!out) return;
    if (!list.length) { out.innerHTML = '<p class="ti-imp-out bad">' + esc(K('ui.ti-imp-none', 'Found no flight or stay in that – check that the dates and flight numbers are in the text, or fill in below.')) + '</p>'; return; }
    out.innerHTML = '<ul class="ti-imp-list">' + list.map(function (it) {
      var when = fmt(it.date) + (it.time ? ' ' + it.time : '') + (it.type === 'hotel' && it.endDate ? ' – ' + fmt(it.endDate) : it.endTime ? '–' + it.endTime : '');
      return '<li><i class="bi bi-' + (TYPE_ICON[it.type] || 'calendar') + '"></i><span><b>' + esc(it.title) + '</b><small>' + esc([when, it.from && it.to ? it.from + ' → ' + it.to : it.from, it.ref ? 'Ref ' + it.ref : '', it.cost ? it.cost + ' kr' : ''].filter(Boolean).join(' · ')) + '</small></span></li>';
    }).join('') + '</ul><div class="ti-imp-acts"><button type="button" class="pill-btn" id="tiImpAdd"><i class="bi bi-plus-lg"></i> ' + esc(list.length > 1 ? K('ui.ti-imp-addn', 'Add all {n}', { n: list.length }) : K('ui.ti-imp-add1', 'Add it')) + '</button>' +
      '<button type="button" class="text-btn" id="tiImpEdit">' + esc(K('ui.ti-imp-edit', 'Fill in the form to change it first')) + '</button></div>';
  }
  var pdfjs = null;
  function pdfText(file) {
    var base = '/cmd/vendor/', load = function (src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); };
    if (!pdfjs) pdfjs = (window.pdfjsLib ? Promise.resolve() : load(base + 'pdf.min.js?v=3.11.174')).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js?v=3.11.174'; return window.pdfjsLib; });
    return file.arrayBuffer().then(function (buf) { return pdfjs.then(function (lib) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }); }).then(function (pdf) {
      var n = Math.min(pdf.numPages, 10), txt = [], chain = Promise.resolve();
      for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return pdf.getPage(i).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
        var line = '', ly = null; tc.items.forEach(function (it) { if (!('str' in it)) return; var y = Math.round(it.transform[5]); if (ly !== null && Math.abs(y - ly) > 2) { txt.push(line); line = ''; } line += (line && !/\s$/.test(line) ? ' ' : '') + it.str; ly = y; }); if (line) txt.push(line); }); }); })(i);
      return chain.then(function () { return txt.join('\n'); });
    });
  }
  function wire() {
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#docMrzGo')) return;
    var r = mrz(document.getElementById('docMrz').value), out = document.getElementById('docMrzOut');
    if (!r) { out.className = 'ti-imp-out bad'; out.textContent = K('ui.ti-mrz-none', 'Couldn’t find the lines – paste both lines with <<< (three on an ID card).'); return; }
    var b = function (id, v) { var el = document.getElementById(id); if (el && v) el.value = v; };
    b('docNo', r.number); b('docHolder', (r.given + ' ' + r.surname).trim()); b('docCC', r.nationality || r.country); b('docBorn', r.born); b('docExp', r.expires);
    var kb = document.querySelector('#docKinds [data-kind="' + (r.type === 'passport' ? 'passport' : 'id') + '"]'); if (kb) kb.click();
    var nm = document.getElementById('docName'); if (nm && r.country) nm.value = (r.type === 'passport' ? K('ui.ti-passport', 'Passport') : K('ui.ti-idcard', 'ID card')) + ' (' + r.country + ')';
    out.className = 'ti-imp-out ' + (r.valid ? 'ok' : 'bad');
    out.textContent = (r.valid ? K('ui.ti-mrz-ok', 'Read and checked: ') : K('ui.ti-mrz-bad', 'Read, but a check digit doesn’t match – compare with the passport: ')) +
      [(r.given + ' ' + r.surname).trim(), r.number, r.nationality, K('ui.ti-exp-x', 'expires {d}', { d: fmt(r.expires) })].filter(Boolean).join(' · ');
  });

  /* the confirmation box at the top of "Add to plan" */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#tiImpGo')) { showFound(booking(document.getElementById('tiImpText').value)); return; }
    if (e.target.closest('#tiImpAdd')) { if (window.TripsApi && lastFound.length) { window.TripsApi.addItems(lastFound); lastFound = []; } return; }
    if (e.target.closest('#tiImpEdit') && lastFound[0] && window.TripsApi) { window.TripsApi.fillItem(lastFound[0]); document.querySelector('#tiImpBox details').open = false; }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('#tiImpPdf') || !e.target.files[0]) return;
    var out = document.getElementById('tiImpOut'); out.innerHTML = '<p class="muted">' + esc(K('ui.loading', 'Loading…')) + '</p>';
    pdfText(e.target.files[0]).then(function (t) { document.getElementById('tiImpText').value = t.slice(0, 20000); showFound(booking(t)); })
      .catch(function () { out.innerHTML = '<p class="ti-imp-out bad">' + esc(K('ui.ti-imp-pdfbad', 'Couldn’t read that PDF – paste the email text instead.')) + '</p>'; });
    e.target.value = '';
  });
  }
  mount();
})();
