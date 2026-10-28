/* Import spending from your bank's CSV export (DNB, Sparebank 1, Nordea, Danske, Handelsbanken,
   Bulder and most others). Everything happens in the browser: the file is read here, nothing is
   uploaded. Columns are found by their headings, categories are guessed from the merchant name
   (and from what you've categorised before), and rows you already have are skipped. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var card = document.querySelector('.card.spending');
  if (!card || !window.Vault) return;

  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var CATS = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];
  /* merchant words → category (Norwegian everyday life first) */
  var RULES = [
    ['groceries', /rema|kiwi|coop|extra|meny|joker|bunnpris|spar\b|obs\b|prix|matkroken|europris|oda\b|kolonial|nærbutikken|narvesen|7-eleven|deli de luca|bakeri|baker/i],
    ['eating', /restaurant|cafe|café|kaffe|coffee|espresso|foodora|wolt|just eat|mcdonald|burger|pizza|sushi|kebab|bar\b|pub\b|bryggeri|vinmonopol|peppes|egon|olivia|starbucks|dominos|max\b|sesam|bistro|kantine|lunsj|lunch|bakehuset|kaffebrenneri/i],
    ['transport', /ruter|vy\b|vy\.no|flytoget|sas\b|norwegian|widerøe|wideroe|bolt|uber|taxi|circle k|shell|esso|uno-x|yx\b|bompeng|autopass|fjellinjen|parker|parkering|easypark|apcoa|q-park|onepark|bane nor|entur|kolumbus|skyss|atb\b|voi\b|tier\b|ryde|bilxtra|biltema|nsb/i],
    ['health', /apotek|vitus|boots|legesenter|lege\b|tannlege|tannhelse|sats|elixia|evo\b|fresh fitness|trening|fysio|kiropraktor|optiker|specsavers|brilleland|synsam|helse/i],
    ['shopping', /zara|h&m|hm\.com|elkjøp|elkjop|power\b|ikea|clas ohlson|amazon|zalando|xxl|jernia|kid interiør|princess|dressmann|cubus|lindex|bik bok|jysk|komplett|apple|samsung|nille|normal\b|kitch'n|tilbords|bohus|skeidar|g-sport|intersport|stormberg|bergans|vinmonopolet/i],
    ['fun', /kino|netflix|spotify|hbo|disney|viaplay|tv 2|steam|playstation|xbox|nintendo|ticketmaster|billett|konsert|teater|museum|bowling|tusenfryd|strawberry|youtube|apple\.com\/bill|patreon|twitch/i],
    ['travel', /hotel|hotell|airbnb|booking\.com|hotels\.com|expedia|ryanair|lufthansa|klm|finnair|color line|fjord line|hurtigruten|avinor|gardermoen|scandic|thon|radisson|nordic choice|trip\.com|momondo|sixt|hertz|avis|europcar/i]
  ];
  var TRANSFER = /overføring|overforing|til konto|fra konto|egen konto|sparing|spare|nettbank|vipps.*(til|fra)|innskudd|lønn|lonn|salary|skatt|nav\b|bsu|fond|aksje|nordnet|kron\b|renter/i;

  /* ---------- reading the file ---------- */
  function decode(buf) {
    var txt = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (/�/.test(txt)) txt = new TextDecoder('windows-1252').decode(buf);
    return txt.replace(/^﻿/, '');
  }
  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var head = lines[0] || '', delim = [';', '\t', ','].sort(function (a, b) { return head.split(b).length - head.split(a).length; })[0];
    function split(line) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return s.trim(); });
    }
    return lines.map(split);
  }
  function num(v) {
    var s = String(v || '').replace(/\s|kr|NOK/gi, '').replace(/−/g, '-');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');        // 1.234,56
    else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');                      // 1,234.56
    else s = s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : NaN;
  }
  function dateKey(v) {
    var s = String(v || '').trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/))) return '20' + m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return m[1] + '-' + m[2] + '-' + m[3];
    return null;
  }
  /* find the columns by their headings */
  function columns(head) {
    var h = head.map(function (x) { return x.toLowerCase(); });
    function find(res) { for (var r = 0; r < res.length; r++) for (var i = 0; i < h.length; i++) if (res[r].test(h[i])) return i; return -1; }
    return {
      date: find([/^bokf|^dato$|^date$|bokføringsdato|bokføringsdag|transaksjonsdato|^dato\b|date/]),
      desc: find([/beskrivelse|forklaring|^tekst|description|^text|tittel|mottaker|merchant|navn|melding/]),
      amount: find([/^beløp$|^belop$|^amount$|beløp|amount|^sum$/]),
      out: find([/^ut\b|ut fra konto|debet|utgående|withdraw|debit/]),
      inn: find([/^inn\b|inn på konto|kredit|innskudd|deposit|credit/])
    };
  }
  function guessCat(desc, memory) {
    var key = norm(desc);
    if (memory[key]) return memory[key];
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(desc)) return RULES[i][0];
    return 'other';
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/\d{2}[./]\d{2}([./]\d{2,4})?/g, '').replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function clean(desc) {
    return String(desc || '').replace(/^\*?\d{4}\s+\d{2}\.\d{2}\s+/, '').replace(/^(varekjøp|varekjop|betaling|visa|mastercard|kortkjøp|bruk av kort)\s*/i, '')
      .replace(/\s{2,}/g, ' ').replace(/\s+(nok|kurs).*$/i, '').trim().slice(0, 60);
  }

  /* ---------- turning rows into candidate expenses ---------- */
  function analyse(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { error: 'The file looks empty.' };
    var col = columns(rows[0]);
    if (col.date < 0 || col.desc < 0 || (col.amount < 0 && col.out < 0)) return { error: 'Couldn’t find the date, text and amount columns. Export the account as CSV from your bank and try again.' };
    var d = window.Vault.get() || {}, have = {}, memory = d.catMemory || {}, fixed = (d.budget && d.budget.fixed) || [];
    (d.expenses || []).forEach(function (e) {
      if (e.ref) have[e.ref] = 1;
      have[e.date + '|' + Math.round(e.amount) + '|' + norm(e.note)] = 1;
      if (e.note && e.cat && !e.src) memory[norm(e.note)] = memory[norm(e.note)] || e.cat;
    });
    var out = [], skipped = { income: 0, dup: 0, bad: 0 };
    rows.slice(1).forEach(function (r) {
      var date = dateKey(r[col.date]), desc = r[col.desc] || '';
      var amt = NaN;
      if (col.amount > -1 && !isNaN(num(r[col.amount]))) amt = num(r[col.amount]);
      else { var o = num(r[col.out]), i = col.inn > -1 ? num(r[col.inn]) : NaN; amt = !isNaN(o) && o !== 0 ? -Math.abs(o) : !isNaN(i) ? Math.abs(i) : NaN; }
      if (!date || isNaN(amt) || !desc) { skipped.bad++; return; }
      if (amt >= 0) { skipped.income++; return; }                       // money in: not spending
      var amount = Math.round(Math.abs(amt) * 100) / 100, note = clean(desc), ref = 'bank:' + date + '|' + amount + '|' + norm(desc);
      if (have[ref] || have[date + '|' + Math.round(amount) + '|' + norm(note)]) { skipped.dup++; return; }
      var bill = fixed.filter(function (f) { return f.name && norm(desc).indexOf(norm(f.name)) > -1; })[0];
      var transfer = TRANSFER.test(desc);
      out.push({ date: date, amount: amount, note: note, desc: desc, cat: bill ? 'fixed' : guessCat(desc, memory), ref: ref, on: !transfer, bill: bill || null, transfer: transfer });
    });
    out.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return { rows: out, skipped: skipped, memory: memory };
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'qa-bg im-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box im-box" role="dialog" aria-modal="true" aria-label="Import from bank"><div class="qa-handle"></div><div id="imBody"></div></div>';
  document.body.appendChild(bg);
  var file = document.createElement('input'); file.type = 'file'; file.accept = '.csv,.txt,text/csv,text/plain'; file.hidden = true; document.body.appendChild(file);
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'text-btn im-btn'; btn.innerHTML = '<i class="bi bi-upload"></i><span> Import</span>';
  btn.setAttribute('aria-label', 'Import from your bank (CSV)');
  card.querySelector('.card-head').appendChild(btn);
  var found = null;

  function open(html) { $('imBody').innerHTML = html; bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); }); }
  function close() { bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }
  function intro() {
    open('<h2 class="im-h"><i class="bi bi-bank"></i> Import from your bank</h2>' +
      '<p class="muted im-p">Export the account’s transactions as a <b>CSV</b> file from your bank (DNB, Sparebank 1, Nordea and the others all have it under the account’s history) and pick it here. ' +
      'Only money out is imported; rows you already have are skipped. Nothing leaves your browser.</p>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick><i class="bi bi-file-earmark-arrow-up"></i> Choose file</button></div>');
  }
  function preview(res) {
    found = res;
    var sk = res.skipped, note = [];
    if (sk.dup) note.push(sk.dup + ' already in Spending');
    if (sk.income) note.push(sk.income + ' money in');
    if (sk.bad) note.push(sk.bad + ' unreadable');
    var rows = res.rows;
    if (!rows.length) { open('<h2 class="im-h"><i class="bi bi-bank"></i> Nothing new</h2><p class="muted im-p">Every expense in that file is already in Spending' + (note.length ? ' (' + note.join(', ') + ')' : '') + '.</p><div class="qa-acts"><span class="spacer"></span><button type="button" class="pill-btn wide" data-close>OK</button></div>'); return; }
    var total = rows.filter(function (r) { return r.on && !r.bill; }).reduce(function (a, r) { return a + r.amount; }, 0);
    open('<h2 class="im-h"><i class="bi bi-bank"></i> ' + rows.length + ' new expense' + (rows.length === 1 ? '' : 's') + '</h2>' +
      '<p class="muted im-p">Check the categories – they’re guessed from the shop’s name and from what you’ve chosen before. A fixed cost (rent, power) isn’t added twice – it ticks the bill as paid instead. Transfers between your own accounts are left out unless you tick them.' + (note.length ? ' Skipped: ' + note.join(', ') + '.' : '') + '</p>' +
      '<ul class="im-list">' + rows.map(function (r, i) {
        return '<li class="im-row' + (r.on ? '' : ' off') + '"><input type="checkbox" data-i="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="Import ' + esc(r.note) + '">' +
          '<span class="im-x"><b>' + esc(r.note) + '</b><small>' + esc(new Date(r.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) +
          (r.bill ? ' · <i class="bi bi-calendar-check"></i> ' + esc(r.bill.name) + ' – a fixed cost, ticks it as paid' : r.transfer ? ' · transfer or income' : '') + '</small></span>' +
          '<span class="money">' + esc(nf.format(r.amount)) + '</span>' +
          (r.bill ? '<span class="im-fixed">Fixed cost</span>' : '<select data-cat="' + i + '" aria-label="Category">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === r.cat ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>') + '</li>';
      }).join('') + '</ul>' +
      '<div class="qa-acts im-foot"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><span class="muted" id="imSum">' + esc(nf.format(total)) + '</span><button type="button" class="pill-btn wide" data-import>Import</button></div>');
  }
  function sumLine() {
    var t = 0; found.rows.forEach(function (r) { if (r.on && !r.bill) t += r.amount; });
    var s = $('imSum'); if (s) s.textContent = nf.format(t);
  }
  function doImport() {
    var d = window.Vault.get(); d.expenses = d.expenses || []; d.catMemory = d.catMemory || {}; d.paid = d.paid || {};
    var n = 0, bills = 0, t0 = Date.now();
    found.rows.forEach(function (r, i) {
      if (!r.on) return;
      if (r.bill) { var k = r.date.slice(0, 7), l = d.paid[k] = d.paid[k] || []; if (l.indexOf(r.bill.id) < 0) l.push(r.bill.id); bills++; return; }
      d.expenses.push({ id: uid(), t: t0 + i, date: r.date, amount: r.amount, cat: r.cat, note: r.note, src: 'bank', ref: r.ref });
      d.catMemory[norm(r.desc)] = r.cat; n++;
    });
    /* keep the memory of merchants small */
    var keys = Object.keys(d.catMemory); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.catMemory[k]; });
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
    close();
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> ' + n + ' expense' + (n === 1 ? '' : 's') + ' imported' + (bills ? ' · ' + bills + ' bill' + (bills === 1 ? '' : 's') + ' ticked as paid' : ''));
  }

  btn.addEventListener('click', intro);
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-close]')) { close(); return; }
    if (e.target.closest('[data-pick]')) { file.value = ''; file.click(); return; }
    if (e.target.closest('[data-import]')) { doImport(); return; }
  });
  bg.addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-i]');
    if (cb) { found.rows[+cb.dataset.i].on = cb.checked; cb.closest('li').classList.toggle('off', !cb.checked); sumLine(); return; }
    var sel = e.target.closest('select[data-cat]');
    if (sel) found.rows[+sel.dataset.cat].cat = sel.value;
  });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var res = analyse(decode(buf));
      if (res.error) open('<h2 class="im-h"><i class="bi bi-bank"></i> Couldn’t read that file</h2><p class="muted im-p">' + esc(res.error) + '</p><div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick>Try another file</button></div>');
      else preview(res);
    });
  });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(close);
  window.BankImport = { analyse: analyse };     // for tests
})();
