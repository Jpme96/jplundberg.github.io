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
  var CATS = [['groceries', I18N.k('ui.groceries', 'Groceries')], ['eating', I18N.k('ui.eating-out', 'Eating out')], ['transport', I18N.k('ui.transport', 'Transport')], ['shopping', I18N.k('ui.shopping', 'Shopping')], ['home', I18N.k('ui.home', 'Home')], ['fun', I18N.k('ui.fun', 'Fun')], ['health', I18N.k('ui.health', 'Health')], ['travel', I18N.k('ui.travel', 'Travel')], ['other', I18N.k('ui.other', 'Other')]];
  /* merchant words → category (Norwegian everyday life first) */
  var RULES = [
    ['groceries', /rema|kiwi|coop|extra\b|meny|joker|bunnpris|spar\b|obs\b|prix|matkroken|europris|oda\.com|oda\b|kolonial|nærbutikken|narvesen|7-?eleven|mix\b|deli de luca|bakeri|baker|point\b/i],
    ['eating', /restaurant|cafe|café|kaffe|coffee|espresso|foodora|wolt|just eat|mcdonald|burger|pizza|sushi|kebab|bar\b|pub\b|bryggeri|vinmonopol|peppes|egon|olivia|starbucks|dominos|max\b|sesam|bistro|kantine|eurest|iss\b|lunsj|lunch|bakehuset|kaffebrenneri|nordvegan|eathappy|vegan|chicken|subway|favrit|bit\b|kam nydalen|syng\b|grill|taco|thai|ramen|poke|bakery/i],
    ['transport', /ruter|vy\b|vy app|vy\.no|flytoget|sas\b|norwegian|widerøe|wideroe|bolt\.eu|bolt\b|uber|taxi|circle k|shell|esso|uno-x|yx\b|bompeng|autopass|fjellinjen|parker|parkering|easypark|apcoa|q-park|onepark|bane nor|entur|kolumbus|skyss|atb\b|voi\b|tier\b|ryde|bilxtra|biltema|nsb/i],
    ['health', /apotek|vitus|boots|legesenter|lege\b|tannlege|tannhelse|sats|elixia|evo\b|fresh fitness|trening|fysio|kiropraktor|optiker|specsavers|brilleland|synsam|lensway|solotica|linser|helse|volvat|aleris|dr\.dropin|bassenget|svømme|life\b|sunkost|lean studio|yoga|pilates/i],
    ['home', /ikea|bohus|jysk|skeidar|fagmøbler|møbelringen|mobelringen|kid interiør|princess|home & cottage|søstrene grene|kitch'n|tilbords|clas ohlson|jernia|byggmakker|maxbo|obs bygg|monter|xl-bygg|plantasjen|hageland|bauhaus|megaflis|flisekompaniet|fargerike|møbler|mobler|interiør/i],
    ['shopping', /zara|h&m|hm\.com|elkj|power\b|ikea|clas ohlson|amazon|zalando|xxl|jernia|kid interiør|princess|dressmann|cubus|lindex|bik bok|jysk|komplett|apple|eplehuset|samsung|nille|normal\b|kitch'n|tilbords|bohus|skeidar|g-sport|intersport|stormberg|bergans|steen & strøm|steen & strom|klarna|volt\b|mestergr|kondomeriet|lego|boozt|asos|shein|temu|ebay|etsy|black ember|sniffer/i],
    ['fun', /kino|netflix|spotify|hbo|disney|viaplay|tv 2|steam|playstation|xbox|nintendo|ticketmaster|billett|konsert|teater|museum|bowling|tusenfryd|strawberry|youtube|apple\.com\/bill|patreon|twitch|karaoke/i],
    ['travel', /hotel|hotell|airbnb|booking\.com|hotels\.com|expedia|ryanair|lufthansa|klm|finnair|color line|fjord line|hurtigruten|avinor|gardermoen|scandic|thon|radisson|nordic choice|citybox|comfort hotel|quality|trip\.com|momondo|sixt|hertz|avis|europcar/i]
  ];
  var TRANSFER = /overføring|overforing|til konto|fra konto|egen konto|sparing|spare|nettbank|vipps\*[a-zæøå]+ [a-zæøå]+ [a-zæøå]+,|vipps.*(til|fra)|innskudd|lønn|lonn|salary|skatt|nav\b|bsu|fond|aksje|nordnet|kron\b|renter|kredittkort|credit ?card|innbetaling|betaling mottatt|takk for betalingen|nedbetaling|avtalegiro.*(kort|card)|revolut|svea|klarna\b.*faktura|penger tilbake/i;

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
      date: find([/kjøpsdato|kjopsdato|transaksjonsdato|purchase date|transaction date/, /^bokf|bokføringsdato|bokføringsdag|posteringsdato|booking/, /^dato$|^date$|^dato\b|dato|date|dag$/]),
      desc: find([/beskrivelse|forklaring|^tekst|description|^text|tittel|mottaker|merchant|navn|melding/]),
      amount: find([/^beløp$|^belop$|^amount$|beløp|amount|^sum$/]),
      out: find([/^ut\b|ut fra konto|debet|utgående|withdraw|debit/]),
      inn: find([/^inn\b|inn på konto|kredit|innskudd|deposit|credit/]),
      bal: find([/^saldo$|^balance$|saldo|balance|disponibelt/])
    };
  }
  function guessCat(desc, memory) {
    if (window.Smart) return window.Smart.guessCat(desc, memory);       // the same shop rules as quick add
    var key = norm(desc);
    if (memory[key]) return memory[key];
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(desc)) return RULES[i][0];
    return 'other';
  }
  /* the shop name first (what you've taught it), then the bank's whole text */
  function guess2(note, desc, memory) { var g = guessCat(note, memory); return g === 'other' ? guessCat(desc, memory) : g; }
  function norm(s) { return String(s || '').toLowerCase().replace(/\d{2}[./]\d{2}([./]\d{2,4})?/g, '').replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function clean(desc) {
    var s = String(desc || '').replace(/^\*?\d{4}\s+\d{2}\.\d{2}\s+/, '').replace(/^(varekjøp|varekjop|betaling|visa|mastercard|kortkjøp|bruk av kort)\s*/i, '')
      .replace(/^vipps\*/i, '').replace(/,\s*[^,]*,\s*[A-Z]{3}\s*$/, '')          // "…, Oslo, NOR"
      .replace(/\s+\d{2,5}(\s|$)/g, ' ').replace(/[*\/]\s*[A-Z0-9]{6,}\s*$/i, '').replace(/\s+(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{6,}\s*$/i, '')  // shop numbers and booking codes
      .replace(/\s{2,}/g, ' ').replace(/\s+(nok|kurs).*$/i, '').replace(/[,\s]+$/, '').trim();
    if (s === s.toUpperCase() && /[A-ZÆØÅ]{3}/.test(s)) s = s.toLowerCase().replace(/(^|[\s\-&(])([a-zæøå])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s.slice(0, 60);
  }

  /* ---------- turning rows into candidate expenses ---------- */
  /* find the header line (banks sometimes put a title or the account above it) */
  function headerIndex(rows) {
    var best = -1, score = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var c = columns(rows[i]), sc = (c.date > -1) + (c.desc > -1) + (c.amount > -1 || c.out > -1);
      if (sc > score) { score = sc; best = i; }
      if (sc === 3) break;
    }
    return score >= 3 ? best : -1;
  }
  var CARDPAY = /kredittkort|credit ?card|visa.*(faktura|innbetaling)|mastercard.*faktura|kortfaktura|trumf visa|remember|bank norwegian|komplett bank|sas eurobonus|santander|re:member|coop mastercard|lånekassen nei|faktura.*kort/i;
  var OWNOUT = /til (egen|annen) konto|overføring til|overforing til|egen konto|mellom egne|brukskonto|regningskonto|sparekonto|til sparing|bsu/i;
  function shiftKey(k, by) { var y = +k.slice(0, 4), m = +k.slice(5, 7) - 1 + by; var dt = new Date(y, m, 1); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1); }
  function signature(rows, hi) {
    var top = rows.slice(0, hi + 1).map(function (r) { return r.join(' '); }).join(' ');
    var nums = (top.match(/\b\d{4}[ .]?\d{2}[ .]?\d{5}\b/g) || []).map(function (n) { return n.replace(/\D/g, ''); });
    var d = window.Vault.get() || {}, known = Object.keys(d.bankFiles || {}).filter(function (k) { return /^\d{11}$/.test(k); });
    return { head: 'h:' + rows[hi].join('|').toLowerCase().slice(0, 120), num: nums[0] || '', others: known.filter(function (k) { return k !== nums[0]; }) };
  }
  function acctList() { return window.Accts ? window.Accts.list(window.Vault.get() || {}) : [{ id: 'salary', label: 'Salary account', icon: 'cash-stack' }, { id: 'credit', label: 'Credit card', icon: 'credit-card' }, { id: 'card', label: 'Card account', icon: 'credit-card-2-front' }]; }
  function analyse(rows, opts) {
    opts = opts || {};
    if (typeof rows === 'string') rows = parseCSV(rows);
    if (!rows || rows.length < 2) return { error: 'The file looks empty.' };
    var hi = headerIndex(rows);
    if (hi < 0) return { error: 'Couldn’t find the date, text and amount columns. The first line reads: “' + rows[0].join(' ; ').slice(0, 120) + '”. Send me that line and I’ll add the layout.' };
    var col = columns(rows[hi]);
    /* which of your accounts the file is from – remembered by the file's layout and any account number in it */
    var sig = signature(rows, hi), mem = (window.Vault.get() || {}).bankFiles || {};
    var d = window.Vault.get() || {}, have = {}, memory = d.catMemory || {}, fixed = (d.budget && d.budget.fixed) || [];
    /* expenses you logged yourself (quick add, the Spending form): the bank row for the same purchase
       shouldn't count twice – same amount, within three days */
    var manual = (d.expenses || []).filter(function (e) { return (!e.src || e.src === 'trip') && !e.ref && +e.amount > 0; }), claimed = {};
    function dayN(k) { return Math.round(new Date(k + 'T12:00') / 864e5); }
    (d.expenses || []).forEach(function (e) {
      if (e.ref) have[e.ref] = 1;
      have[e.date + '|' + Math.round(e.amount) + '|' + norm(e.note)] = 1;
      if (e.full != null) have[e.date + '|' + Math.round(e.full) + '|' + norm(e.note)] = 1;     // split with someone: the bank shows the whole amount
      if (e.note && e.cat && !e.src) memory[norm(e.note)] = memory[norm(e.note)] || e.cat;
    });
    /* read every row first; then decide which sign means spending */
    var parsed = [];
    rows.slice(hi + 1).forEach(function (r) {
      var date = dateKey(r[col.date]), desc = r[col.desc] || '', amt = NaN;
      if (col.amount > -1 && !isNaN(num(r[col.amount]))) amt = num(r[col.amount]);
      else if (col.out > -1) { var o = num(r[col.out]), i = col.inn > -1 ? num(r[col.inn]) : NaN; amt = !isNaN(o) && o !== 0 ? -Math.abs(o) : !isNaN(i) ? Math.abs(i) : NaN; }
      parsed.push({ date: date, desc: desc, amt: amt, ok: !!(date && !isNaN(amt) && desc), saldo: col.bal > -1 && col.bal !== col.amount ? num(r[col.bal]) : NaN });
    });
    var good = parsed.filter(function (x) { return x.ok && x.amt !== 0; });
    var pos = good.filter(function (x) { return x.amt > 0; }).length;
    /* a credit-card statement lists purchases as positive amounts (and the payments as negative) */
    var looksCard = col.out < 0 && good.length >= 3 && pos / good.length >= 0.7;
    var AC = window.Accts, acct = opts.acct || mem[sig.num] || mem[sig.head] || (looksCard ? 'credit' : null);
    if (acct && AC && !AC.get(d, acct)) acct = null;                       // an account you've since removed
    var kind = acct ? (AC ? AC.kind(d, acct) : acct) : null;
    /* a credit-card file with one amount column usually lists purchases as positive numbers */
    var card = opts.card != null ? !!opts.card : kind === 'credit' ? col.out < 0 && pos / Math.max(1, good.length) >= 0.5 : kind ? false : looksCard;
    var haveIn = {};
    (d.extra || []).forEach(function (e) { if (e.ref) haveIn[e.ref] = 1; });
    var SALARY = /lønn|lonn|salary|feriepeng|utbetaling nav|skatteetaten|skatt til gode/i, OWN = /innbetaling|overføring|overforing|fra konto|egen konto|sparekonto|nettbank|revolut/i;
    var out = [], skipped = { income: 0, dup: 0, bad: 0 }, salaries = [];
    parsed.forEach(function (x) {
      if (!x.ok) { skipped.bad++; return; }
      var spend = card ? x.amt > 0 : x.amt < 0;
      var amount = Math.round(Math.abs(x.amt) * 100) / 100, note = clean(x.desc);
      if (!spend) {
        /* money in: salary is in the budget already and payments from your own account are not income –
           refunds, Vipps from friends and the like count as extra money this month */
        var salary = SALARY.test(x.desc), own = (OWN.test(x.desc) && !/tilbake|refusjon|refund|retur|tilbakebet/i.test(x.desc)) || (card && x.amt < 0 && !/tilbake|refusjon|refund|retur/i.test(x.desc));
        var rin = 'bankin:' + x.date + '|' + amount + '|' + norm(x.desc);
        if (haveIn[rin]) { skipped.dup++; return; }
        if (salary) {
          skipped.income++;
          /* the salary that actually came in: it becomes that month's pay in the budget (instead of the estimate) */
          if (kind !== 'credit' && amount >= 1000 && /lønn|lonn|salary/i.test(x.desc)) salaries.push({ date: x.date, amount: amount, desc: x.desc });
          return;
        }
        if ((kind === 'card' || kind === 'savings') && !/tilbake|refusjon|refund|retur|vipps/i.test(x.desc)) own = true;          // money in on the card account is your own transfer
        if (kind === 'credit' && x.amt !== 0 && !/tilbake|refusjon|refund|retur/i.test(x.desc)) own = true;  // money in on the credit card is the bill being paid
        out.push({ date: x.date, amount: amount, note: note, desc: x.desc, cat: 'in', ref: rin, on: !own, income: true, transfer: own, why: own ? (kind === 'credit' ? 'paying the card' : 'from your own account') : '' });
        return;
      }
      var ref = 'bank:' + x.date + '|' + amount + '|' + norm(x.desc);
      if (have[ref] || have[x.date + '|' + Math.round(amount) + '|' + norm(note)]) { skipped.dup++; return; }
      var bill = fixed.filter(function (f) { return f.name && norm(x.desc).indexOf(norm(f.name)) > -1; })[0];
      var transfer = TRANSFER.test(x.desc), why = transfer ? 'transfer' : '';
      /* the salary account pays the credit card and moves money to the card account: not spending –
         the purchases themselves come from the card's own file */
      var ccpay = false;
      if ((kind === 'salary' || kind === 'card' || kind === 'savings') && !bill) {
        if (CARDPAY.test(x.desc)) { transfer = true; ccpay = true; why = 'pays the credit card – its purchases count from the card’s file'; }
        else if (OWNOUT.test(x.desc) || (sig.others.length && sig.others.some(function (n) { return x.desc.replace(/\D/g, '').indexOf(n) > -1; }))) { transfer = true; why = 'to your own account'; }
      }
      var mine = bill ? null : manual.filter(function (m) { return !claimed[m.id] && Math.abs(+(m.full != null ? m.full : m.amount) - amount) < 1 && Math.abs(dayN(String(m.date).slice(0, 10)) - dayN(x.date)) <= 3; })
        .sort(function (a, b) { return Math.abs(dayN(a.date) - dayN(x.date)) - Math.abs(dayN(b.date) - dayN(x.date)); })[0] || null;
      if (mine) { claimed[mine.id] = 1; skipped.mine = (skipped.mine || 0) + 1; }
      /* the same shop, about the same amount, in two or more of the last three months → looks like a monthly bill */
      var rk = norm(x.desc), recur = false;
      if (!bill && !transfer && rk.length >= 3 && !(d.budget && (d.budget.notBills || []).indexOf(rk) > -1)) {
        var ms = {}; (d.expenses || []).forEach(function (e) { if (e.note && norm(e.ref ? String(e.ref).split('|').slice(2).join('|') : e.note) === rk || (e.note && norm(e.note) === norm(note))) { var mk = String(e.date).slice(0, 7); if (mk < x.date.slice(0, 7) && Math.abs(+e.amount - amount) <= Math.max(15, amount * .15)) ms[mk] = 1; } });
        recur = Object.keys(ms).filter(function (mk) { return mk >= shiftKey(x.date.slice(0, 7), -3); }).length >= 2;
      }
      out.push({ recur: recur, date: x.date, amount: amount, note: note, desc: x.desc, cat: bill ? 'fixed' : mine ? mine.cat : (memory[norm(note)] || guess2(note, x.desc, memory)), ref: ref, on: !transfer && !mine, bill: bill || null, transfer: transfer, why: why, mine: mine, acct: acct, ccpay: ccpay });
    });
    out.sort(function (a, b) { return b.date.localeCompare(a.date); });
    /* the account's balance after this file: the file's own balance column if it has one, otherwise the
       balance you typed in moved on by every row after that day (transfers and salary too – they're real money) */
    var bal = null, A0 = acct && AC ? AC.get(d, acct) : null;
    if (A0) {
      var withSaldo = good.filter(function (x) { return !isNaN(x.saldo); }), newest = good.reduce(function (m, x) { return x.date > m ? x.date : m; }, '');
      if (withSaldo.length) {
        var top = withSaldo.filter(function (x) { return x.date === withSaldo.reduce(function (m, y) { return y.date > m ? y.date : m; }, ''); })[0];
        bal = { to: kind === 'credit' ? Math.abs(top.saldo) : top.saldo, at: top.date, how: 'the balance in the file' };
      } else if (A0.bal != null) {
        var moveIn = good.filter(function (x) { return !A0.balAt || x.date > A0.balAt; }).reduce(function (m, x) { return m + (card ? -x.amt : x.amt); }, 0);
        if (moveIn) bal = { to: kind === 'credit' ? Math.max(0, A0.bal - moveIn) : A0.bal + moveIn, at: newest, how: 'your balance from ' + (A0.balAt ? new Date(A0.balAt + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'before') + ' + the rows after it' };
      }
      if (bal) bal.from = A0.bal;
    }
    /* one amount per month (a salary split in two rows is added up) */
    var pay = {}; salaries.forEach(function (x) { var k = x.date.slice(0, 7); pay[k] = (pay[k] || 0) + x.amount; });
    return { rows: out, skipped: skipped, memory: memory, card: card, acct: acct, kind: kind, sig: sig, source: rows, bal: bal, pay: pay };
  }

  /* ---------- Excel files (.xlsx): a zip of XML, read without any library ---------- */
  function readXlsx(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    function str(o, n) { return new TextDecoder('utf-8').decode(u8.subarray(o, o + n)); }
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('not a zip'));
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), entries = {};
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
      var name = str(off + 46, nl), lho = dv.getUint32(off + 42, true);
      entries[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nl + el + cl;
    }
    function get(name) {
      var e = entries[name]; if (!e) return Promise.resolve(null);
      var lnl = dv.getUint16(e.lho + 26, true), lel = dv.getUint16(e.lho + 28, true), start = e.lho + 30 + lnl + lel;
      var data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return Promise.resolve(new TextDecoder('utf-8').decode(data));
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('This browser can’t open Excel files – export as CSV instead.'));
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    var sheet = Object.keys(entries).filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); }).sort()[0];
    return Promise.all([get('xl/sharedStrings.xml'), get(sheet)]).then(function (r) {
      var ss = [], xp = new DOMParser();
      if (r[0]) Array.prototype.forEach.call(xp.parseFromString(r[0], 'application/xml').getElementsByTagName('si'), function (si) { ss.push(Array.prototype.map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
      if (!r[1]) throw new Error('no sheet');
      var rows = [];
      Array.prototype.forEach.call(xp.parseFromString(r[1], 'application/xml').getElementsByTagName('row'), function (row) {
        var cells = [];
        Array.prototype.forEach.call(row.getElementsByTagName('c'), function (c) {
          var ref = c.getAttribute('r') || '', colIdx = 0, m = ref.match(/^[A-Z]+/);
          if (m) for (var j = 0; j < m[0].length; j++) colIdx = colIdx * 26 + (m[0].charCodeAt(j) - 64);
          var t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0], val = '';
          if (t === 's' && v) val = ss[+v.textContent] || '';
          else if (t === 'inlineStr' && is) val = is.textContent;
          else if (v) val = v.textContent;
          /* Excel dates are day numbers since 1899-12-30 */
          if (t !== 's' && /^\d{5}(\.\d+)?$/.test(val) && +val > 30000 && +val < 80000) { var dt = new Date(Date.UTC(1899, 11, 30) + Math.round(+val) * 864e5); val = dt.toISOString().slice(0, 10); }
          cells[Math.max(0, colIdx - 1)] = String(val).trim();
        });
        for (var q = 0; q < cells.length; q++) if (cells[q] == null) cells[q] = '';
        if (cells.some(function (x) { return x; })) rows.push(cells);
      });
      return rows;
    });
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'qa-bg im-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box im-box" role="dialog" aria-modal="true" aria-label="Import from bank" data-t-aria-label="ui.import-from-bank"><div class="qa-handle"></div><div id="imBody"></div></div>';
  document.body.appendChild(bg);
  var file = document.createElement('input'); file.type = 'file'; file.accept = '.csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; file.hidden = true; document.body.appendChild(file);
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'icon-btn sm im-btn'; btn.innerHTML = '<i class="bi bi-upload"></i>';
  btn.setAttribute('aria-label', 'Import from your bank (CSV)'); btn.title = 'Import from your bank (CSV)'; btn.setAttribute('data-t-aria-label', 'ui.import-csv-btn'); btn.setAttribute('data-t-title', 'ui.import-csv-btn');
  card.querySelector('.card-head').appendChild(btn);
  var scan = document.createElement('button');          /* receipt.js: photo of a receipt → the expense form, filled in */
  scan.type = 'button'; scan.className = 'icon-btn sm im-btn'; scan.setAttribute('data-qascan', ''); scan.innerHTML = '<i class="bi bi-camera"></i>';
  scan.setAttribute('aria-label', 'Scan a receipt'); scan.title = 'Scan a receipt';
  card.querySelector('.card-head').insertBefore(scan, btn);
  var found = null;

  function open(html) { $('imBody').innerHTML = html; bg.hidden = false; document.body.classList.add('qa-open'); requestAnimationFrame(function () { bg.classList.add('open'); }); }
  function close() { bg.classList.remove('open'); document.body.classList.remove('qa-open'); setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320); }
  /* step 1: which account the file is from – picked before the file, so it's never a guess */
  var chosen = null;
  function intro() {
    var list = acctList();
    if (!chosen || !list.some(function (a) { return a.id === chosen; })) { try { chosen = localStorage.getItem('dash.imAcct'); } catch (e) {} }
    if (!list.some(function (a) { return a.id === chosen; })) chosen = null;
    open('<h2 class="im-h"><i class="bi bi-bank"></i> Import from your bank</h2>' +
      '<p class="muted im-p">Export the transactions as <b data-t="ui.csv-or-excel">CSV or Excel</b> in your bank app or online bank (under the account’s history), then pick the account the file is from and choose the file. Nothing leaves your browser.</p>' +
      '<p class="im-q">Which account is the file from?</p>' +
      '<div class="im-pick" role="radiogroup" aria-label="Account" data-t-aria-label="ui.account">' + list.map(function (a) {
        return '<button type="button" role="radio" data-pickacct="' + esc(a.id) + '" aria-checked="' + (chosen === a.id) + '"><span class="pa-ico" style="--c:' + a.c + '"><i class="bi bi-' + a.icon + '"></i></span><span><b>' + esc(a.label) + '</b><small>' +
          ({ salary: 'Salary lands here', credit: 'Credit card', card: 'Bills and other payments', savings: 'Savings', fund: 'Fund' }[a.kind] || '') + (a.bal != null ? ' · ' + esc(nf.format(a.kind === 'credit' ? -a.bal : a.bal)) : '') + '</small></span><i class="bi bi-check-circle-fill im-tick"></i></button>';
      }).join('') + '</div>' +
      '<p class="muted im-p im-small">Salary, card payments and transfers between your own accounts are left out, and rows you already have are skipped. The account’s balance is moved on by the file.</p>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-close data-t="ui.cancel">Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick' + (chosen ? '' : ' disabled') + '><i class="bi bi-file-earmark-arrow-up"></i> Choose file</button></div>');
  }
  function preview(res) {
    found = res;
    var sk = res.skipped, note = [];
    if (sk.dup) note.push(sk.dup + ' already imported');
    if (sk.mine) note.push(sk.mine + ' you logged yourself (left unticked so they don’t count twice)');
    var payKeys = Object.keys(res.pay || {}).sort();
    if (sk.income) note.push(payKeys.length ? 'your salary (' + payKeys.map(function (k) { return new Date(k + '-15T12:00').toLocaleDateString('en-GB', { month: 'short' }) + ' ' + nf.format(res.pay[k]); }).join(', ') + ') – used as that month’s pay in the budget' : sk.income + ' salary (already in your budget)');
    if (sk.bad) note.push(sk.bad + ' unreadable');
    var rows = res.rows, nIn = rows.filter(function (r) { return r.income; }).length, nOut = rows.length - nIn;
    var signRow = '<div class="im-acct"><span>' + (res.acct ? 'From <b>' + esc((acctList().filter(function (a) { return a.id === res.acct; })[0] || {}).label || '') + '</b> – change it here if that’s wrong' : '<b>Which account is this file from?</b>') + '</span><div class="seg im-seg" role="group" aria-label="Account" data-t-aria-label="ui.account">' +
        acctList().map(function (a) { return '<button type="button" data-acct="' + esc(a.id) + '" aria-pressed="' + (res.acct === a.id) + '"><i class="bi bi-' + a.icon + '"></i> ' + esc(a.label) + '</button>'; }).join('') + '</div>' +
        '<small class="muted">' + ({ salary: 'Salary is already in your budget; card bills and money you move to your other accounts are left out.', credit: 'Purchases count; paying off the card is left out.', card: 'Money coming in from your salary account is a transfer, not income.' }[res.kind] || 'Then salary, card payments and your own transfers are sorted out the right way.') + '</small></div>' +
      '<label class="qa-check im-sign"><input type="checkbox" data-card' + (res.card ? ' checked' : '') + '> Purchases are positive amounts in this file</label>';
    var per = window.Budget && window.Budget.period(window.Vault.get() || {}), inPer = per ? rows.filter(function (r) { return r.on && !r.bill && !r.income && per.has(r.date); }).reduce(function (a, r) { return a + r.amount; }, 0) : 0;
    var balLine = res.bal ? '<p class="muted im-p im-per"><i class="bi bi-bank2"></i> ' + (res.kind === 'credit' ? 'Owed on the card' : 'Balance') + ' after this file: <b>' + esc(nf.format(res.bal.to)) + '</b> (' + esc(res.bal.how) + ')</p>' : '';
    var perLine = balLine + (per ? '<p class="muted im-p im-per"><i class="bi bi-pie-chart"></i> <span id="imPer">' + esc(nf.format(inPer)) + '</span> of this counts in your budget now (' + esc(per.name) + ') – the rest is in earlier periods and shows in the statistics.</p>' : '');
    if (!rows.length) { open('<h2 class="im-h"><i class="bi bi-bank"></i> Nothing new</h2><p class="muted im-p">' + (sk.dup ? 'Every expense in that file is already in Spending' : 'No spending found in that file') + (note.length ? ' (' + note.join(', ') + ')' : '') + '.</p>' + signRow + '<div class="qa-acts"><span class="spacer"></span><button type="button" class="pill-btn wide" data-close>OK</button></div>'); return; }
    var total = rows.filter(function (r) { return r.on && !r.bill; }).reduce(function (a, r) { return a + (r.income ? -r.amount : r.amount); }, 0);
    open('<h2 class="im-h"><i class="bi bi-bank"></i> ' + nOut + ' new expense' + (nOut === 1 ? '' : 's') + (nIn ? ' · ' + nIn + ' in' : '') + '</h2>' +
      signRow + perLine + (note.length ? '<p class="muted im-p im-small">Skipped: ' + note.join(', ') + '.</p>' : '') +
      summary(rows) + groups(rows, function (r, i) {
        return '<li class="im-row' + (r.on ? '' : ' off') + (r.income ? ' in' : '') + '"><input type="checkbox" data-i="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="Import ' + esc(r.note) + '">' +
          '<span class="im-x"><b>' + esc(r.note) + '</b><small>' + esc(new Date(r.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) +
          (r.mine ? ' · <i class="bi bi-person-check"></i> you logged it already: ' + esc(r.mine.note || 'expense') + ', ' + esc(new Date(String(r.mine.date).slice(0, 10) + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : '') +
          (r.bill ? ' · <i class="bi bi-calendar-check"></i> ' + esc(r.bill.name) + ' – a fixed cost, ticks it as paid' : r.income ? (r.transfer ? ' · ' + esc(r.why || 'from your own account') : ' · adds to this period’s budget') : r.transfer ? ' · ' + esc(r.why || 'transfer') : '') + '</small></span>' +
          '<span class="money">' + (r.income ? '+' : '') + esc(nf.format(r.amount)) + '</span>' +
          (r.bill ? '<span class="im-fixed" data-t="ui.fixed-cost">Fixed cost</span>' : r.income ? '<span class="im-fixed im-in">Money in</span>' : '<select data-cat="' + i + '" aria-label="Category">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === r.cat ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>') +
          (r.recur && r.on && !r.bill && !r.income ? '<label class="im-mk"><input type="checkbox" data-mk="' + i + '"' + (r.mk ? ' checked' : '') + '> Comes every month – make it a fixed cost</label>' : '') + '</li>';
      }) +
      '<div class="qa-acts im-foot"><button type="button" class="text-btn" data-close data-t="ui.cancel">Cancel</button><span class="spacer"></span><span class="muted" id="imSum">' + esc(nf.format(total)) + '</span><button type="button" class="pill-btn wide" data-import data-t="ui.import">Import</button></div>');
  }
  /* the file at a glance, then the rows in groups – the ones worth a look first */
  function summary(rows) {
    var sp = rows.filter(function (r) { return r.on && !r.bill && !r.income; }), bills = rows.filter(function (r) { return r.on && r.bill; }), inn = rows.filter(function (r) { return r.on && r.income; }), off = rows.filter(function (r) { return !r.on; });
    var t = function (n, label, v, cls) { return n ? '<span class="' + (cls || '') + '"><b>' + n + '</b> ' + label + (v != null ? '<small>' + esc(nf.format(v)) + '</small>' : '') + '</span>' : ''; };
    return '<div class="im-sum">' + t(sp.length, 'spending', sp.reduce(function (a, r) { return a + r.amount; }, 0)) + t(bills.length, 'bills paid', bills.reduce(function (a, r) { return a + r.amount; }, 0)) +
      t(inn.length, 'money in', inn.reduce(function (a, r) { return a + r.amount; }, 0), 'in') + t(off.length, 'left out', null, 'off') + '</div>';
  }
  function groups(rows, row) {
    var G = [['check', 'Worth a look', 'Guessed as Other, or looks like a monthly bill', true], ['spend', 'Spending', '', false], ['bill', 'Bills ticked as paid', '', false], ['in', 'Money in', '', false], ['off', 'Left out', 'Transfers between your accounts, card payments, things you logged yourself', false]];
    var of = function (r) { return !r.on ? 'off' : r.bill ? 'bill' : r.income ? 'in' : (r.cat === 'other' || r.recur) ? 'check' : 'spend'; };
    return G.map(function (g) {
      var idx = []; rows.forEach(function (r, i) { if (of(r) === g[0]) idx.push(i); });
      if (!idx.length) return '';
      var tot = idx.reduce(function (a, i) { return a + rows[i].amount; }, 0);
      return '<details class="im-g im-g-' + g[0] + '"' + (g[3] || (g[0] === 'spend' && idx.length <= 12) ? ' open' : '') + '><summary><b>' + g[1] + '</b> · ' + idx.length + '<span class="muted">' + esc(nf.format(tot)) + '</span></summary>' +
        (g[2] ? '<p class="muted im-gp">' + g[2] + '</p>' : '') + '<ul class="im-list">' + idx.map(function (i) { return row(rows[i], i); }).join('') + '</ul></details>';
    }).join('');
  }
  function sumLine() {
    var t = 0; found.rows.forEach(function (r) { if (r.on && !r.bill) t += r.income ? -r.amount : r.amount; });
    var s = $('imSum'); if (s) s.textContent = nf.format(t);
    var per = window.Budget && window.Budget.period(window.Vault.get() || {}), p = $('imPer');
    if (per && p) p.textContent = nf.format(found.rows.filter(function (r) { return r.on && !r.bill && !r.income && per.has(r.date); }).reduce(function (a, r) { return a + r.amount; }, 0));
  }
  function doImport() {
    var d = window.Vault.get(); d.expenses = d.expenses || []; d.catMemory = d.catMemory || {}; d.paid = d.paid || {}; d.extra = d.extra || [];
    var n = 0, bills = 0, nin = 0, t0 = Date.now();
    found.rows.forEach(function (r, i) {
      /* a purchase you logged yourself: remember the bank row on it, so the next file skips it too */
      if (r.mine && !r.on) { (d.expenses || []).forEach(function (e) { if (e.id === r.mine.id && !e.ref) e.ref = r.ref; }); return; }
      if (!r.on) return;
      if (r.income) { d.extra.push({ id: uid(), date: r.date, amount: r.amount, note: r.note, src: 'bank', ref: r.ref, acct: found.acct || undefined }); nin++; return; }
      if (r.bill) {
        var k = r.date.slice(0, 7), l = d.paid[k] = d.paid[k] || []; if (l.indexOf(r.bill.id) < 0) l.push(r.bill.id); bills++;
        /* a bill whose amount changes: what the bank took is that month's amount (unless you typed one in) */
        ((d.budget && d.budget.fixed) || []).forEach(function (f) {
          if (f.id !== r.bill.id || !f.vary) return;
          f.months = f.months || {}; f.mbank = f.mbank || {};
          if (f.months[k] == null || f.mbank[k]) { f.months[k] = Math.round(r.amount); f.mbank[k] = 1; }
        });
        return;
      }
      if (r.mk) {
        /* a new fixed cost from now on; this period's charge is the bill being paid (no double counting) */
        d.budget = d.budget || { income: [], fixed: [] }; d.budget.fixed = d.budget.fixed || [];
        var have = d.budget.fixed.filter(function (f) { return norm(f.name) === norm(r.note); })[0], fid = have ? have.id : uid();
        if (!have) d.budget.fixed.push({ id: fid, name: r.note, amount: Math.round(r.amount), day: Math.min(28, +r.date.slice(8, 10)), acct: found.acct || undefined });
        var per0 = window.Budget && window.Budget.period(d);
        if (per0 && per0.has(r.date)) { var k2 = r.date.slice(0, 7), l2 = d.paid[k2] = d.paid[k2] || []; if (l2.indexOf(fid) < 0) l2.push(fid); bills++; return; }
      }
      d.expenses.push({ id: uid(), t: t0 + i, date: r.date, amount: r.amount, cat: r.cat, note: r.note, src: 'bank', ref: r.ref, acct: found.acct || undefined });
      d.catMemory[norm(r.desc)] = r.cat; n++;
    });
    /* a credit-card payment found in the salary/card account file marks that month's card bill as paid */
    var ccs = acctList().filter(function (a) { return a.kind === 'credit'; });
    found.rows.forEach(function (r) {
      if (!r.ccpay || !ccs.length) return;
      var c = ccs.filter(function (a) { return a.name && r.desc.toLowerCase().indexOf(a.name.toLowerCase().split(' ')[0]) > -1; })[0] || ccs[0];
      d.budget = d.budget || {}; d.budget.ccPaid = d.budget.ccPaid || {}; d.budget.ccPaid[c.id + ':' + r.date.slice(0, 7)] = true;
    });
    /* the salary seen in the file is the real pay for that month – unless you typed in a payslip for it */
    var pk = Object.keys(found.pay || {});
    if (pk.length) {
      d.budget = d.budget || {}; d.budget.payslips = d.budget.payslips || {};
      pk.forEach(function (k) { var cur = d.budget.payslips[k]; if (!cur || cur.src === 'bank') d.budget.payslips[k] = { net: Math.round(found.pay[k]), src: 'bank' }; });
    }
    if (found.bal && found.acct) {
      d.budget = d.budget || {}; var L = d.budget.acctList = Array.isArray(d.budget.acctList) ? d.budget.acctList : [];
      var ae = L.filter(function (x) { return x.id === found.acct; })[0];
      if (!ae) { ae = { id: found.acct, kind: found.kind || found.acct }; L.push(ae); }
      if (!ae.balAt || found.bal.at >= ae.balAt) { ae.bal = Math.round(found.bal.to * 100) / 100; ae.balAt = found.bal.at; ae.balSrc = 'import'; }
    }
    if (found.acct && found.sig) { d.bankFiles = d.bankFiles || {}; d.bankFiles[found.sig.head] = found.acct; if (found.sig.num) d.bankFiles[found.sig.num] = found.acct; }
    /* keep the memory of merchants small */
    var tn = new Date(); d.lastImport = tn.getFullYear() + '-' + String(tn.getMonth() + 1).padStart(2, '0') + '-' + String(tn.getDate()).padStart(2, '0');
    var keys = Object.keys(d.catMemory); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.catMemory[k]; });
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
    close();
    if (window.Quick && window.Quick.toast) window.Quick.toast('<i class="bi bi-check-lg"></i> ' + n + ' expense' + (n === 1 ? '' : 's') + ' imported' + (nin ? ' · ' + nin + ' in' : '') + (bills ? ' · ' + bills + ' bill' + (bills === 1 ? '' : 's') + ' ticked as paid' : ''));
  }

  btn.addEventListener('click', intro);
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-close]')) { close(); return; }
    var pa = e.target.closest('[data-pickacct]');
    if (pa) { chosen = pa.dataset.pickacct; try { localStorage.setItem('dash.imAcct', chosen); } catch (x) {} bg.querySelectorAll('[data-pickacct]').forEach(function (b) { b.setAttribute('aria-checked', b === pa); }); var pk = bg.querySelector('[data-pick]'); if (pk) pk.disabled = false; return; }
    if (e.target.closest('[data-pick]')) { if (!chosen && bg.querySelector('[data-pickacct]')) return; file.value = ''; file.click(); return; }
    if (e.target.closest('[data-import]')) { doImport(); return; }
    var ab = e.target.closest('[data-acct]');
    if (ab && found && found.source) { chosen = ab.dataset.acct; try { localStorage.setItem('dash.imAcct', chosen); } catch (x) {} preview(analyse(found.source, { acct: chosen })); return; }
  });
  bg.addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-i]');
    if (cb) { found.rows[+cb.dataset.i].on = cb.checked; cb.closest('li').classList.toggle('off', !cb.checked); sumLine(); return; }
    var mk = e.target.closest('input[data-mk]');
    if (mk) { found.rows[+mk.dataset.mk].mk = mk.checked; return; }
    var sel = e.target.closest('select[data-cat]');
    if (sel) { found.rows[+sel.dataset.cat].cat = sel.value; return; }
    var cc = e.target.closest('input[data-card]');
    if (cc && found && found.source) preview(analyse(found.source, { card: cc.checked, acct: found.acct || undefined }));
  });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf), isZip = u8[0] === 0x50 && u8[1] === 0x4b;
      return isZip ? readXlsx(buf) : decode(buf);
    }).then(function (rows) {
      var res = analyse(rows, chosen ? { acct: chosen } : {});
      if (res.error) open('<h2 class="im-h"><i class="bi bi-bank"></i> Couldn’t read that file</h2><p class="muted im-p">' + esc(res.error) + '</p><div class="qa-acts"><button type="button" class="text-btn" data-close data-t="ui.cancel">Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick>Try another file</button></div>');
      else preview(res);
    }).catch(function (e) {
      open('<h2 class="im-h"><i class="bi bi-bank"></i> Couldn’t read that file</h2><p class="muted im-p">' + esc(e && e.message || 'Unknown file') + '. CSV or Excel (.xlsx) from your bank works best.</p><div class="qa-acts"><button type="button" class="text-btn" data-close data-t="ui.cancel">Cancel</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-pick>Try another file</button></div>');
    });
  });
  document.addEventListener('keydown', function (e) { if (!bg.hidden && e.key === 'Escape') close(); });
  window.Vault.onLock(close);
  /* …/finance/#import (from the weekly check-in or search) opens it straight away */
  function fromHash() { if (location.hash === '#import') { history.replaceState(null, '', location.pathname + location.search); setTimeout(intro, 350); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);
  window.BankImport = { analyse: analyse };     // for tests
})();
