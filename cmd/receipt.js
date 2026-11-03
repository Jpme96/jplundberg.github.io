/* Scan a receipt: take a photo (or pick one) and the shop, the total and the date are read from it
   and filled into the expense form – you check them and save. The text is read in the browser with
   Tesseract (loaded the first time you scan, about 4–6 MB incl. the Norwegian language data, then cached
   by the browser); the photo is never uploaded or stored. Used by Quick add → Expense and by
   Finances → Transactions. */
(function () {
  "use strict";
  var LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var worker = null, loading = null;
  function pad(n) { return String(n).padStart(2, '0'); }
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function load() {
    if (worker) return Promise.resolve(worker);
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      if (window.Tesseract) return ok();
      var s = document.createElement('script'); s.src = LIB; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = function () { ok(); }; s.onerror = function () { no(new Error('offline')); };
      document.head.appendChild(s);
    }).then(function () { return window.Tesseract.createWorker('nor+eng', 1); })
      .then(function (w) { worker = w; return w; })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }
  /* big phone photos: scale down (faster, and Tesseract reads ~1600 px just as well) */
  function shrink(file) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.25)'; g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(file); };
      img.src = url;
    });
  }

  /* ---------- from the text to { shop, amount, date } ---------- */
  var SHOPS = /rema ?1000|kiwi|coop (extra|mega|prix|obs|marked)|coop|extra|meny|joker|bunnpris|spar|obs|europris|narvesen|7-?eleven|circle ?k|uno-?x|esso|shell|vinmonopolet|apotek ?1|vitusapotek|boots|ark|norli|clas ohlson|jernia|biltema|xxl|elkjøp|power|ikea|jysk|h&m|cubus|lindex|dressmann|zara|normal|nille|tiger|søstrene grene|kitch'?n|peppes|mcdonald'?s|burger king|max|espresso house|starbucks|deli de luca|baker hansen|godt brød|kaffebrenneriet|wayne'?s|egon|o'learys|sushi|thai|pizza/i;
  function cap(s) { return s.toLowerCase().replace(/(^|[\s\-&(])([a-zæøå])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\bRema 1000\b/i, 'Rema 1000'); }
  function amountsIn(line) {
    var out = [], re = /(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?!\d)/g, m;
    while ((m = re.exec(line))) { var v = parseFloat(m[1].replace(/[ .]/g, '') + '.' + m[2]); if (v > 0 && v < 200000) out.push(v); }
    return out;
  }
  function parse(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var res = { shop: '', amount: 0, date: '', text: text };
    /* total: the biggest amount on a "total / to pay / card" line, else the biggest amount at all */
    var TOT = /(totalt?|sum\b|å betale|a betale|til betaling|betalt|bankkort|bank ?axept|visa|mastercard|kort|beløp|belop|amount|to pay|total)/i, NOT = /mva|moms|rabatt|spart|bonus|vekslepenger|kontant tilbake|retur|pant/i;
    var tot = [], all = [];
    lines.forEach(function (l) { var a = amountsIn(l); all = all.concat(a); if (TOT.test(l) && !NOT.test(l)) tot = tot.concat(a); });
    res.amount = (tot.length ? Math.max.apply(null, tot) : all.length ? Math.max.apply(null, all) : 0);
    /* date: the first sensible one, not in the future and not more than a year back */
    var now = new Date(), re = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b|\b(20\d{2})-(\d{2})-(\d{2})\b/g, m;
    while ((m = re.exec(lines.join('\n')))) {
      var y = m[4] ? +m[4] : +m[3] < 100 ? 2000 + +m[3] : +m[3], mo = m[4] ? +m[5] : +m[2], d = m[4] ? +m[6] : +m[1];
      var dt = new Date(y, mo - 1, d, 12);
      if (dt.getMonth() !== mo - 1 || dt > now || now - dt > 366 * 864e5) continue;
      res.date = dk(dt); break;
    }
    /* shop: a chain we know, else the first line that reads like a name */
    var sm = lines.join(' ').match(SHOPS);
    if (sm) res.shop = cap(sm[0]);
    else {
      var first = lines.filter(function (l) { return /[a-zæøå]{3}/i.test(l) && (l.replace(/[^a-zæøå]/gi, '').length / l.length) > 0.5 && !/kvittering|receipt|org\.? ?nr|mva|tlf|telefon|www|velkommen/i.test(l); })[0];
      if (first) res.shop = cap(first.replace(/[^a-zæøå0-9 &'\-]/gi, '').trim()).slice(0, 40);
    }
    return res;
  }

  /* ---------- the photo picker ---------- */
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment'); input.hidden = true;
  document.body.appendChild(input);
  var pending = null;
  function pick(cb) { pending = cb; input.value = ''; input.click(); }
  input.addEventListener('change', function () {
    var f = input.files && input.files[0], cb = pending; pending = null;
    if (!f || !cb) return;
    cb({ state: 'reading' });
    var t0 = Date.now();
    Promise.all([load(), shrink(f)]).then(function (r) {
      cb({ state: 'reading', ready: true });
      return r[0].recognize(r[1]);
    }).then(function (out) {
      var p = parse(out && out.data && out.data.text);
      p.ms = Date.now() - t0;
      cb(p.amount || p.shop ? Object.assign({ state: 'done' }, p) : { state: 'empty' });
    }).catch(function (e) { cb({ state: 'failed', offline: e && e.message === 'offline' }); });
  });

  /* Quick add → Expense: the "Scan receipt" button fills the form */
  function fill(form, r) {
    var st = form.querySelector('.qa-scanst');
    if (!st) { st = document.createElement('p'); st.className = 'qa-scanst muted'; st.setAttribute('role', 'status'); form.insertBefore(st, form.querySelector('.qa-acts')); }
    var btn = form.querySelector('[data-qascan]');
    if (btn) btn.disabled = r.state === 'reading';
    if (r.state === 'reading') { st.innerHTML = '<i class="bi bi-hourglass-split"></i> ' + (r.ready ? 'Reading the receipt …' : 'Getting the reader ready (first time takes a moment) …'); return; }
    if (r.state === 'failed') { st.innerHTML = '<i class="bi bi-wifi-off"></i> ' + (r.offline ? 'The receipt reader needs the internet the first time – type it in for now.' : 'Couldn’t read that photo – type it in, or try a sharper photo in good light.'); return; }
    if (r.state === 'empty') { st.innerHTML = '<i class="bi bi-question-circle"></i> No total found on that photo – try again closer, straight on, in good light.'; return; }
    if (r.amount && form.a) form.a.value = (r.amount % 1 ? r.amount.toFixed(2) : String(r.amount)).replace('.', ',');
    if (r.shop && form.n && !form.n.value) form.n.value = r.shop;
    if (r.date && form.d) form.d.value = r.date;
    if (r.shop && form.c && window.Smart && window.Smart.guessCat) {
      var d = window.Vault && window.Vault.get && window.Vault.get(), cat = window.Smart.guessCat(r.shop, (d && d.catMemory) || {});
      if (cat && cat !== 'other') form.c.value = cat;
    }
    st.innerHTML = '<i class="bi bi-check2-circle"></i> Read from the receipt' + (r.shop ? ': <b>' + esc(r.shop) + '</b>' : '') + ' – check the amount and save.';
    var sb = form.querySelector('button[type=submit]'); if (sb) sb.focus();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qascan]'); if (!b) return;
    var form = b.closest('form');
    if (form) { e.preventDefault(); pick(function (r) { fill(form, r); }); return; }
    /* outside a form (Finances → Transactions): open Quick add on Expense, then scan into it */
    if (window.Quick && window.Quick.open) {
      var opened = false;
      pick(function (r) {          /* the photo picker has to open straight from the tap (Safari), the form follows */
        if (!opened) { opened = true; window.Quick.open('expense', {}); }
        var f = document.querySelector('.qa-form[data-kind="expense"]'); if (f) fill(f, r);
      });
    }
  });
  window.Receipt = { parse: parse, pick: pick };
})();
