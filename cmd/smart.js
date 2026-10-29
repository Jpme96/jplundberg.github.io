/* Smart: understands a line you type, in Norwegian or English, and works out what it is.
     "149 rema"              → expense, 149 kr, Groceries
     "lunsj 129 i går"       → expense yesterday, Eating out
     "tor 14 tannlege"       → event on Thursday at 14:00
     "møte med Ola kl 9.30"  → event today at 09:30
     "løp 5 km 30 min"       → workout
     "kjøp melk i morgen"    → task, due tomorrow
     "notat: …"              → note
   Also the shop → category rules shared with the bank import, and the dates used by to-dos.
   Nothing here saves anything – quick.js does that. */
window.Smart = (function () {
  "use strict";
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }

  /* ---------- categories (shop names) ---------- */
  var RULES = [
    ['groceries', /rema|kiwi|coop|extra\b|meny|joker|bunnpris|spar\b|obs\b|prix|matkroken|europris|oda\.com|oda\b|kolonial|nærbutikken|narvesen|7-?eleven|mix\b|deli de luca|bakeri|baker|point\b|dagligvare|matbutikk|groceries|melk|brød/i],
    ['eating', /restaurant|cafe|café|kaffe|coffee|espresso|foodora|wolt|just eat|mcdonald|burger|pizza|sushi|kebab|bar\b|pub\b|bryggeri|vinmonopol|peppes|egon|olivia|starbucks|dominos|max\b|sesam|bistro|kantine|eurest|iss\b|lunsj|lunch|middag|dinner|frokost|breakfast|takeaway|øl\b|beer/i],
    ['transport', /ruter|vy\b|vy app|vy\.no|flytoget|sas\b|norwegian|widerøe|wideroe|bolt\.eu|bolt\b|uber|taxi|circle k|shell|esso|uno-x|yx\b|bompeng|autopass|fjellinjen|parker|parkering|easypark|apcoa|q-park|onepark|bensin|diesel|lading|billett buss|bussbillett|t-bane|trikk/i],
    ['health', /apotek|vitus|boots|legesenter|lege\b|tannlege|tannhelse|sats|elixia|evo\b|fresh fitness|fysio|kiropraktor|optiker|specsavers|brilleland|synsam|lensway|solotica|linser|helse|volvat|aleris|dr\.dropin|medisin|vitamin/i],
    ['shopping', /zara|h&m|hm\.com|elkj|power\b|ikea|clas ohlson|amazon|zalando|xxl|jernia|kid interiør|princess|dressmann|cubus|lindex|bik bok|jysk|komplett|apple\b|eplehuset|samsung|nille|normal\b|kitch'n|tilbords|bohus|klær|sko\b|shoes|clothes/i],
    ['fun', /kino|netflix|spotify|hbo|disney|viaplay|tv 2|steam|playstation|xbox|nintendo|ticketmaster|billett|konsert|teater|museum|bowling|tusenfryd|strawberry|youtube|apple\.com\/bill|patreon|twitch|karaoke|cinema|concert/i],
    ['travel', /hotel|hotell|airbnb|booking\.com|hotels\.com|expedia|ryanair|lufthansa|klm|finnair|color line|fjord line|hurtigruten|avinor|gardermoen|scandic|thon|radisson|nordic choice|citybox|comfort hotel|quality|flybillett|flight/i]
  ];
  function norm(s) { return String(s || '').toLowerCase().replace(/\d{2}[./]\d{2}([./]\d{2,4})?/g, '').replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function guessCat(desc, memory) {
    var key = norm(desc);
    if (memory && memory[key]) return memory[key];
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(desc)) return RULES[i][0];
    return 'other';
  }
  var CAT_NAME = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };

  /* ---------- dates and times ---------- */
  var WD = { søndag: 0, sondag: 0, søn: 0, son: 0, sun: 0, sunday: 0, mandag: 1, man: 1, mon: 1, monday: 1, tirsdag: 2, tir: 2, tirs: 2, tue: 2, tues: 2, tuesday: 2,
    onsdag: 3, ons: 3, wed: 3, wednesday: 3, torsdag: 4, tor: 4, tors: 4, thu: 4, thur: 4, thurs: 4, thursday: 4, fredag: 5, fre: 5, fri: 5, friday: 5,
    lørdag: 6, lordag: 6, lør: 6, lor: 6, sat: 6, saturday: 6 };
  var MON = { jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mar: 3, mars: 3, march: 3, apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12 };
  var WDS = Object.keys(WD).sort(function (a, b) { return b.length - a.length; }).join('|');
  var MONS = Object.keys(MON).sort(function (a, b) { return b.length - a.length; }).join('|');
  var B = '(?:^|\\s)', E = '(?=$|[\\s,.!?])';

  /* Finds a date in the text. Returns { key, text, future } and removes what it used. */
  function takeDate(s, now) {
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), m;
    var rel = [[/(?:^|\s)(i\s*overmorgen|overmorgen|day after tomorrow)(?=$|[\s,.!?])/i, 2], [/(?:^|\s)(i\s*morgen|imorgen|tomorrow|tmrw)(?=$|[\s,.!?])/i, 1],
      [/(?:^|\s)(i\s*dag|idag|today)(?=$|[\s,.!?])/i, 0], [/(?:^|\s)(i\s*går|igår|i\s*gar|igar|yesterday)(?=$|[\s,.!?])/i, -1], [/(?:^|\s)(i\s*forgårs|forgårs)(?=$|[\s,.!?])/i, -2]];
    for (var i = 0; i < rel.length; i++) if ((m = s.match(rel[i][0]))) return { key: dkey(addDays(t0, rel[i][1])), used: m[0], rel: rel[i][1] };
    /* "neste fredag" / "next friday": the one in the coming week; "fredag" / "på fredag": the next one (today counts) */
    if ((m = s.match(new RegExp(B + '(?:neste|next)\\s+(' + WDS + ')' + E, 'i')))) {
      var want = WD[m[1].toLowerCase()], diff = (want - t0.getDay() + 7) % 7 || 7;
      if (diff < 7 - (t0.getDay() + 6) % 7) diff += 7;                     // still this week → the one after
      return { key: dkey(addDays(t0, diff)), used: m[0], rel: diff };
    }
    if ((m = s.match(new RegExp(B + '(?:på\\s+|on\\s+)?(' + WDS + ')\\.?' + E, 'i')))) {
      var w = WD[m[1].toLowerCase()], df = (w - t0.getDay() + 7) % 7;
      return { key: dkey(addDays(t0, df)), used: m[0], rel: df, wd: true };
    }
    /* "12. nov", "12 november", "nov 12" */
    if ((m = s.match(new RegExp(B + '(\\d{1,2})\\.?\\s*(' + MONS + ')\\.?(?:\\s+(\\d{4}))?' + E, 'i'))) || (m = s.match(new RegExp(B + '(' + MONS + ')\\.?\\s+(\\d{1,2})(?:\\s+(\\d{4}))?' + E, 'i')))) {
      var day = /\d/.test(m[1]) ? +m[1] : +m[2], mo = MON[(/\d/.test(m[1]) ? m[2] : m[1]).toLowerCase()];
      return fixYear(day, mo, m[3], t0, m[0]);
    }
    /* "12.11", "12/11", "12.11.2026" – a time like 14.30 is not a date (month > 12) */
    if ((m = s.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=$|[\s,!?])/)) && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31 &&
        !new RegExp('kl\\.?\\s*' + m[1] + '[./]' + m[2]).test(s)) {
      return fixYear(+m[1], +m[2], m[3], t0, m[0]);
    }
    return null;
  }
  function fixYear(day, mo, y, t0, used) {
    var year = y ? (+y < 100 ? 2000 + +y : +y) : t0.getFullYear();
    var d = new Date(year, mo - 1, day);
    if (d.getMonth() !== mo - 1) return null;
    if (!y && d < addDays(t0, -60)) d = new Date(year + 1, mo - 1, day);   // "3. jan" in December means next year
    return { key: dkey(d), used: used, rel: Math.round((d - t0) / 864e5) };
  }
  function takeTime(s, afterDate) {
    var m;
    if ((m = s.match(/(?:^|\s)(?:kl\.?|klokka|klokken|at)\s*(\d{1,2})(?:[:.](\d{2}))?(?=$|[\s,!?])/i))) return ok(m[1], m[2], m[0]);
    if ((m = s.match(/(?:^|\s)(\d{1,2})[:.](\d{2})(?=$|[\s,!?])/)) && +m[2] > 12) return ok(m[1], m[2], m[0]);   // 14.30 (12.11 is a date)
    if ((m = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?=$|[\s,!?])/))) return ok(m[1], m[2], m[0]);
    if ((m = s.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=$|[\s,!?])/i))) { var h = +m[1] % 12 + (/pm/i.test(m[3]) ? 12 : 0); return ok(h, m[2], m[0]); }
    /* "tor 14 tannlege": a bare hour right after the day */
    if (afterDate && (m = s.match(/^\s*(\d{1,2})(?=$|[\s,])/)) && +m[1] <= 23) return ok(m[1], null, m[0]);
    return null;
    function ok(h, mi, used) { h = +h; mi = +(mi || 0); if (h > 23 || mi > 59) return null; return { hm: pad(h) + ':' + pad(mi), used: used }; }
  }

  /* ---------- workouts ---------- */
  var SPORT = [['run', /\b(løp|løpe|løping|løpetur|jogg|jogge|jogging|run|ran|running)\b/i], ['strength', /\b(gym|styrke|styrketrening|vekter|strength|weights|crossfit)\b/i],
    ['bike', /\b(sykkel|sykle|syklet|sykling|spinning|bike|biking|cycling)\b/i], ['swim', /\b(svøm|svømme|svømte|svømming|swim|swimming)\b/i],
    ['walk', /\b(gåtur|gå tur|fjelltur|tur i skogen|walk|walking|hike|hiking|fottur)\b/i], ['yoga', /\b(yoga|tøying|tøye|mobility|stretch|stretching|pilates)\b/i],
    ['ball', /\b(fotball|football|soccer|basket|basketball|volleyball|padel|tennis|badminton|squash|innebandy|håndball)\b/i], ['other', /\b(trening|trent|workout|trained|økt)\b/i]];
  var SPORT_NAME = { strength: 'Strength', run: 'Running', walk: 'Walking', bike: 'Cycling', swim: 'Swimming', ball: 'Ball sports', yoga: 'Yoga / mobility', other: 'Workout' };
  var EVENT_WORDS = /\b(møte|meeting|avtale|appointment|tannlege|dentist|lege|legen|doctor|frisør|hairdresser|middag med|dinner with|lunsj med|lunch with|bursdag|birthday|fest|party|konsert|concert|kino|cinema|intervju|interview|kurs|course|fly|flight|tog|train to|bryllup|wedding|date)\b/i;

  function cap(s) { s = String(s || '').replace(/\s{2,}/g, ' ').replace(/^[\s,.:;–-]+|[\s,.:;–-]+$/g, ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function strip(s, used) { return used ? s.replace(used, ' ') : s; }
  function money(s) {
    var m = String(s).replace(/\s/g, '').replace(/kr|,-|nok/ig, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(m)) m = m.replace(/\./g, '');
    var n = parseFloat(m.replace(',', '.')); return isFinite(n) ? n : NaN;
  }

  /* ---------- the parser ---------- */
  function parse(line, opts) {
    opts = opts || {};
    var now = opts.now || new Date(), raw = String(line || '').trim();
    if (!raw) return null;
    var s = ' ' + raw + ' ', m, out;

    /* explicit: "notat: …", "todo: …", "husk å …" */
    if ((m = raw.match(/^(?:note|notat|noter|notér)\s*[:\-]\s*([\s\S]+)/i))) return { kind: 'note', text: cap(m[1].trim()), strong: true };
    var forceTodo = false;
    if ((m = raw.match(/^(?:todo|to-do|task|oppgave|gjøre|gjør)\s*[:\-]\s*(.+)/i))) { s = ' ' + m[1] + ' '; forceTodo = true; }
    else if ((m = raw.match(/^(?:husk(?:\s+å)?|remember\s+to|remind\s+me\s+to)\s+(.+)/i))) { s = ' ' + m[1] + ' '; forceTodo = true; }

    var date = takeDate(s, now);
    if (date) s = strip(s, date.used);
    var rest = s;
    /* a bare hour right after the day word: look at what followed it */
    var time = null;
    if (date && !forceTodo) {
      var idx = (' ' + raw + ' ').toLowerCase().indexOf(date.used.toLowerCase());
      var tail = (' ' + raw + ' ').slice(idx + date.used.length);
      time = takeTime(tail, true);
      if (time && /^\s*\d{1,2}\s*$/.test(time.used) && /^\s*\d{1,2}\s*(kr|,-)/i.test(tail)) time = null;   // "i går 149 kr"
      if (time) rest = strip(rest, time.used);
    }
    if (!time && !forceTodo) { time = takeTime(rest, false); if (time) rest = strip(rest, time.used); }

    /* workout */
    var sport = null;
    for (var i = 0; i < SPORT.length && !forceTodo; i++) if (SPORT[i][1].test(rest)) { sport = SPORT[i][0]; break; }
    var km = (m = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:km|kilometer)\b/i)) ? +m[1].replace(',', '.') : null;
    if (m && km != null) rest = strip(rest, m[0]);
    var min = null;
    if ((m = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:t|timer|time|h|hours?|hrs?)\b/i))) { min = Math.round(+m[1].replace(',', '.') * 60); rest = strip(rest, m[0]); }
    if ((m = rest.match(/(\d+)\s*(?:min|mins|minutter|minutes|m)\b/i))) { min = (min || 0) + +m[1]; rest = strip(rest, m[0]); }
    var hasKr = /\d\s*(kr|,-|nok)\b|\bkr\.?\s*\d/i.test(rest);

    if (sport && !hasKr && (km || min || !EVENT_WORDS.test(rest)) && !(time && !km && !min)) {
      out = { kind: 'workout', sport: sport, min: min || (km ? Math.round(km * 6) : 45), km: km, date: date && date.rel <= 0 ? date.key : (date ? date.key : dkey(now)),
        strong: !!(km || min) };
      out.note = cap(rest.replace(SPORT[i] ? SPORT[i][1] : /^$/, ' ').replace(/\d+/g, ' '));
      return out;
    }

    /* an amount: "149", "149 kr", "kr 149", "1 299,50" */
    var amt = NaN, amtUsed = null;
    if ((m = rest.match(/(?:^|\s)(?:kr\.?\s*)(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=$|[\s,!?])/i)) || (m = rest.match(/(?:^|\s)(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:kr|,-|nok)(?=$|[\s,.!?])/i))) { amt = money(m[1]); amtUsed = m[0]; }
    else if (!time) {
      var re = /(?:^|\s)(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=$|[\s!?])/g;
      while ((m = re.exec(rest))) { var v = money(m[1]); if (!(amt >= v)) { amt = v; amtUsed = m[0]; } re.lastIndex = m.index + m[0].length; }
    }

    if (!forceTodo && amt > 0 && !(time && !hasKr) && !(date && date.rel > 0 && !hasKr && EVENT_WORDS.test(rest))) {
      rest = strip(rest, amtUsed);
      var note = cap(rest.replace(/\b(på|hos|at|for|til|i)\s*$/i, '').replace(/^\s*(på|hos|at|for)\s+/i, ' '));
      /* spending is in the past: "fredag" means the Friday that's been */
      var ek = !date ? dkey(now) : date.rel <= 0 ? date.key : date.wd ? dkey(addDays(new Date(date.key + 'T12:00'), -7)) : dkey(now);
      return { kind: 'expense', amount: Math.round(amt * 100) / 100, note: note, cat: guessCat(note || raw, opts.memory), date: ek, strong: hasKr || !!note };
    }

    /* an event: a time, or an appointment word with a day */
    if (!forceTodo && (time || (date && EVENT_WORDS.test(rest)))) {
      var loc = '';
      if ((m = rest.match(/\s(?:@|hos|at)\s+([^,]+)$/i)) || (m = rest.match(/\s(?:på|i)\s+([A-ZÆØÅ][\wæøå\-]*(?:\s+[A-ZÆØÅ][\wæøå\-]*)*)\s*$/))) { loc = m[1].trim(); rest = strip(rest, m[0]); }
      var title = cap(rest);
      if (!title) return null;
      return { kind: 'event', title: title, date: date ? date.key : (time && time.hm < pad(now.getHours()) + ':' + pad(now.getMinutes()) && !date ? dkey(addDays(now, 1)) : dkey(now)),
        start: time ? time.hm : null, allDay: !time, location: loc, strong: true };
    }

    /* everything else: a task, with a due date if it had one */
    var text = cap(rest.replace(/^\s*å\s+/i, ' '));
    if (!text) return null;
    return { kind: 'todo', text: text, due: date ? date.key : null, strong: forceTodo || !!date };
  }

  /* one line describing what will happen */
  var nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf2 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf = { format: function (n) { return (n % 1 ? nf2 : nf0).format(n); } };
  function when(key, now) {
    var n = Math.round((new Date(key + 'T12:00') - new Date(dkey(now || new Date()) + 'T12:00')) / 864e5);
    if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; if (n === -1) return 'yesterday';
    return new Date(key + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function describe(p) {
    if (!p) return null;
    if (p.kind === 'expense') return { icon: 'receipt', label: 'Expense', bits: [nf.format(p.amount) + ' kr', CAT_NAME[p.cat] || 'Other', p.note, when(p.date)].filter(Boolean) };
    if (p.kind === 'event') return { icon: 'calendar-plus', label: 'Event', bits: [p.title, when(p.date) + (p.start ? ' ' + p.start : ' · all day'), p.location].filter(Boolean) };
    if (p.kind === 'workout') return { icon: 'heart-pulse', label: 'Workout', bits: [SPORT_NAME[p.sport], p.min + ' min', p.km ? String(p.km).replace('.', ',') + ' km' : '', when(p.date)].filter(Boolean) };
    if (p.kind === 'todo') return { icon: 'check2-square', label: 'Task', bits: [p.text, p.due ? 'due ' + when(p.due) : ''].filter(Boolean) };
    if (p.kind === 'note') return { icon: 'journal-text', label: 'Note', bits: [p.text.slice(0, 60)] };
    return null;
  }

  /* to-dos: "kjøp melk i morgen" → { text, due } */
  function todo(text, now) {
    var s = ' ' + String(text || '').trim() + ' ', d = takeDate(s, now || new Date());
    if (!d) return { text: String(text || '').trim(), due: null };
    var t = cap(strip(s, d.used));
    return t ? { text: t, due: d.key } : { text: String(text || '').trim(), due: null };
  }

  return { parse: parse, describe: describe, todo: todo, when: when, guessCat: guessCat, norm: norm, RULES: RULES, CAT_NAME: CAT_NAME, SPORT_NAME: SPORT_NAME, dkey: dkey };
})();
