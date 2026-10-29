/* Built by cmd/build.py from: smart.js, search.js, app.js, quick.js, notify.js, ahealth.js, nav.js – edit those files, not this one. */
/* ===== smart.js ===== */
try {
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

  /* ---------- repeats: "hver mandag", "every month", "hvert kvartal", "den 15. hver måned" ---------- */
  var REPEAT_NAME = { daily: 'every day', weekdays: 'every weekday', weekly: 'every week', '2weeks': 'every 2 weeks', monthly: 'every month', quarterly: 'every 3 months', yearly: 'every year' };
  function takeRepeat(s, now) {
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), m;
    function nextWd(w, step) { var df = (w - t0.getDay() + 7) % 7; return { key: dkey(addDays(t0, df)) }; }
    function out(key, used, first, extra) { var o = { key: key, used: used, first: first || dkey(t0) }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
    if ((m = s.match(new RegExp(B + '(?:annenhver|hver\\s+annen|every\\s+other)\\s+(' + WDS + ')' + E, 'i')))) return out('2weeks', m[0], nextWd(WD[m[1].toLowerCase()]).key);
    if ((m = s.match(new RegExp(B + '(?:hver|hvert|alle|every|each)\\s+(' + WDS + ')' + E, 'i')))) return out('weekly', m[0], nextWd(WD[m[1].toLowerCase()]).key);
    if ((m = s.match(/(?:^|\s)(?:annenhver\s+uke|hver\s+annen\s+uke|hver\s+2\.\s*uke|every\s+other\s+week|every\s+2\s+weeks|biweekly)(?=$|[\s,.!?])/i))) return out('2weeks', m[0]);
    if ((m = s.match(/(?:^|\s)(?:alle\s+hverdager|hver\s+hverdag|hverdager|every\s+weekday|weekdays)(?=$|[\s,.!?])/i))) {
      var d = t0; while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1); return out('weekdays', m[0], dkey(d));
    }
    if ((m = s.match(/(?:^|\s)(?:hver\s+dag|daglig|alle\s+dager|every\s+day|daily)(?=$|[\s,.!?])/i))) return out('daily', m[0]);
    if ((m = s.match(/(?:^|\s)(?:hver\s+uke|ukentlig|every\s+week|weekly)(?=$|[\s,.!?])/i))) return out('weekly', m[0]);
    if ((m = s.match(/(?:^|\s)(?:den\s+)?(\d{1,2})\.\s*(?:hver\s+måned|i\s+måneden|hver\s+mnd)(?=$|[\s,.!?])/i)) || (m = s.match(/(?:^|\s)hver\s+(\d{1,2})\.(?=$|[\s,!?])/i)) ||
        (m = s.match(/(?:^|\s)(?:on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)\s+(?:of\s+)?every\s+month(?=$|[\s,.!?])/i))) {
      var md = Math.min(31, Math.max(1, +m[1])), f = new Date(t0.getFullYear(), t0.getMonth(), Math.min(md, new Date(t0.getFullYear(), t0.getMonth() + 1, 0).getDate()));
      if (f < t0) f = new Date(t0.getFullYear(), t0.getMonth() + 1, Math.min(md, new Date(t0.getFullYear(), t0.getMonth() + 2, 0).getDate()));
      return out('monthly', m[0], dkey(f), { rday: md });
    }
    if ((m = s.match(/(?:^|\s)(?:hver\s+måned|hver\s+mnd|månedlig|every\s+month|monthly)(?=$|[\s,.!?])/i))) return out('monthly', m[0]);
    if ((m = s.match(/(?:^|\s)(?:hvert\s+kvartal|kvartalsvis|hver\s+3\.\s*måned|every\s+quarter|quarterly|every\s+3\s+months)(?=$|[\s,.!?])/i))) return out('quarterly', m[0]);
    if ((m = s.match(/(?:^|\s)(?:hvert\s+år|årlig|every\s+year|yearly|annually)(?=$|[\s,.!?])/i))) return out('yearly', m[0]);
    return null;
  }
  /* the next time after `key` (YYYY-MM-DD); monthly ones keep their day (31 → 30 in shorter months → 31 again) */
  function nextDue(key, rep, rday) {
    var d = new Date(String(key).slice(0, 10) + 'T12:00'), y = d.getFullYear(), mo = d.getMonth(), day = rday || d.getDate();
    function mAdd(n) { var t = new Date(y, mo + n, 1, 12); return new Date(t.getFullYear(), t.getMonth(), Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()), 12); }
    if (rep === 'daily') d.setDate(d.getDate() + 1);
    else if (rep === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    else if (rep === 'weekly') d.setDate(d.getDate() + 7);
    else if (rep === '2weeks') d.setDate(d.getDate() + 14);
    else if (rep === 'monthly') d = mAdd(1);
    else if (rep === 'quarterly') d = mAdd(3);
    else if (rep === 'yearly') d = new Date(y + 1, mo, Math.min(day, new Date(y + 1, mo + 1, 0).getDate()), 12);
    else return null;
    return dkey(d);
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

    var rep = takeRepeat(s, now);
    if (rep) s = strip(s, rep.used);
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
    if (!time && !forceTodo && rep) {
      var ri = (' ' + raw + ' ').toLowerCase().indexOf(rep.used.toLowerCase()), rt = takeTime((' ' + raw + ' ').slice(ri + rep.used.length), true);
      if (rt) { time = rt; rest = strip(rest, rt.used); }
    }
    if (!time && !forceTodo) { time = takeTime(rest, false); if (time) rest = strip(rest, time.used); }
    /* something that repeats is a task (or an event when it has a time) – never an expense or a workout */
    if (rep) {
      var rtext = cap(rest.replace(/^\s*å\s+/i, ' '));
      if (!rtext) return null;
      var first = date ? date.key : rep.first;
      if (time && !forceTodo) return { kind: 'event', title: rtext, date: first, start: time.hm, allDay: false, location: '', repeat: rep.key, strong: true };
      return { kind: 'todo', text: rtext, due: first, repeat: rep.key, rday: rep.rday || null, strong: true };
    }

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
    if (p.kind === 'event') return { icon: 'calendar-plus', label: 'Event', bits: [p.title, (p.repeat ? 'from ' : '') + when(p.date) + (p.start ? ' ' + p.start : ' · all day'), p.repeat ? REPEAT_NAME[p.repeat] : '', p.location].filter(Boolean) };
    if (p.kind === 'workout') return { icon: 'heart-pulse', label: 'Workout', bits: [SPORT_NAME[p.sport], p.min + ' min', p.km ? String(p.km).replace('.', ',') + ' km' : '', when(p.date)].filter(Boolean) };
    if (p.kind === 'todo') return { icon: p.repeat ? 'arrow-repeat' : 'check2-square', label: 'Task', bits: [p.text, p.repeat ? REPEAT_NAME[p.repeat] + ' · first ' + when(p.due) : p.due ? 'due ' + when(p.due) : ''].filter(Boolean) };
    if (p.kind === 'note') return { icon: 'journal-text', label: 'Note', bits: [p.text.slice(0, 60)] };
    return null;
  }

  /* to-dos: "kjøp melk i morgen" → { text, due } */
  function todo(text, now) {
    now = now || new Date();
    var s = ' ' + String(text || '').trim() + ' ', rp = takeRepeat(s, now);
    if (rp) s = strip(s, rp.used);
    var d = takeDate(s, now);
    if (d) s = strip(s, d.used);
    var t = cap(s);
    if (!t) return { text: String(text || '').trim(), due: null };
    return { text: t, due: d ? d.key : rp ? rp.first : null, repeat: rp ? rp.key : null, rday: rp && rp.rday || null };
  }

  return { nextDue: nextDue, REPEAT_NAME: REPEAT_NAME, parse: parse, describe: describe, todo: todo, when: when, guessCat: guessCat, norm: norm, RULES: RULES, CAT_NAME: CAT_NAME, SPORT_NAME: SPORT_NAME, dkey: dkey };
})();
} catch (e) { console.error("smart.js", e); }
/* ===== search.js ===== */
try {
/* Search everything: calendar, trips and bookings, to-dos, notes, goals, links, spending,
   subscriptions, meetings, courses, health, journal, places, warranties – and the settings.
   Opens with the magnifier, "/" or Ctrl/⌘ K. Nothing leaves this browser. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function fmt(k) { return /^\d{4}-\d{2}-\d{2}/.test(k || '') ? new Date(k.slice(0, 10) + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  var home = location.pathname.replace(/[a-z]+\/$/, '').replace(/index\.html$/, '');
  if (!/\/cmd\/$/.test(home)) home = '/cmd/';

  /* ---------- everything you can find ---------- */
  var SETTINGS = [['appearance', 'Appearance', 'Theme, colours, background, cards, glass, motion'], ['dashboard', 'Dashboard', 'Greeting, cards and their order'],
    ['features', 'Features', 'Switch parts on or off'], ['calendar', 'Calendar settings', 'Categories, week numbers, holidays'], ['profile', 'Your profile', 'Photo, details, home, work, health'],
    ['security', 'Security', 'Passcode, auto-lock'], ['data', 'Data & sync', 'Backup, sync'], ['notify', 'Notifications', 'Reminders on this device'], ['ahealth', 'Apple Health', 'Steps, sleep, heart rate from your iPhone'], ['shortcuts', 'Siri & Shortcuts', 'Links for Siri, Shortcuts, Back Tap'], ['socials', 'Socials', 'Links on jplundberg.com'],
    ['announce', 'Announcement', 'Banner on jplundberg.com'], ['sections', 'Front page', 'Sections on jplundberg.com'], ['texts', 'Texts', 'Website texts'],
    ['featured', 'Featured', 'Pinned article and project'], ['content', 'Articles & projects', 'Show or hide'], ['visitors', 'Visitors', 'Website statistics']];
  function index() {
    var out = [];
    function add(group, icon, title, sub, href, date, extra) { out.push({ g: group, i: icon, t: String(title || ''), s: sub || '', h: href, d: date || '', x: String(extra || '').toLowerCase() }); }
    var cal = readJSON('dash.calendar') || {};
    (cal.events || []).forEach(function (e) { add('Calendar', 'calendar-event', e.title, fmt(e.date) + (e.start && !e.allDay ? ' ' + e.start : '') + (e.location ? ' · ' + e.location : ''), home + 'calendar/#d=' + e.date, e.date, (e.location || '') + ' ' + (e.notes || '')); });
    var tr = readJSON('dash.travel') || {};
    (tr.trips || []).forEach(function (t) {
      add('Trips', 'suitcase-lg', t.name || t.dest, [t.dest, fmt(t.start)].filter(Boolean).join(' · '), home + 'travel/#trip=' + t.id, t.start, (t.dest || '') + ' ' + (t.notes || '') + ' ' + ((t.place || {}).country || ''));
      (t.items || []).forEach(function (it) { add('Trips', 'ticket-perforated', it.title || it.type, (t.name || '') + ' · ' + fmt(it.date) + (it.ref ? ' · ' + it.ref : ''), home + 'travel/#trip=' + t.id, it.date, (it.from || '') + ' ' + (it.to || '') + ' ' + (it.ref || '') + ' ' + (it.notes || '')); });
    });
    (tr.docs || []).forEach(function (d) { add('Trips', 'person-vcard', d.name || d.kind, 'Expires ' + fmt(d.expires), home + 'travel/#docs', d.expires, d.note); });
    (readJSON('dash.todos') || []).forEach(function (t) { add('To-do', t.done ? 'check2-square' : 'square', t.text, t.done ? 'Done' : 'To-do', home + '#c=todo'); });
    (readJSON('dash.notes') || []).forEach(function (n) { var x = String(n.text || ''); add('Notes', 'sticky', x.split('\n')[0].slice(0, 80), x.length > 80 ? x.slice(80, 160) : 'Note', home + '#c=notes', '', x); });
    (readJSON('dash.goals') || []).forEach(function (g) { add('Goals', 'bullseye', g.name, (g.value || 0) + ' / ' + g.target, home + '#c=goals'); });
    (readJSON('dash.links') || []).forEach(function (l) { add('Links', 'link-45deg', l.name, l.url, l.url, '', l.url); });
    var hb = readJSON('dash.habits') || {};
    (hb.list || []).forEach(function (h) { add('Health', 'activity', h.name, h.target + '× per week', home + 'habits/'); });
    var d = window.Vault.get();
    if (d) (d.expenses || []).forEach(function (e) { add('Spending', 'receipt', e.note || e.cat, kr(e.amount) + ' · ' + fmt(e.date) + ' · ' + e.cat, home + 'finance/#c=spending', e.date, e.cat); });
    if (d && d.budget) (d.budget.fixed || []).concat(d.budget.income || []).forEach(function (b) { add('Budget', 'pie-chart', b.name, kr(b.amount) + ' a month', home + 'finance/#c=budget'); });
    if (Fe) {
      var T = Fe.tools();
      var tool = function (key, group, icon, title, sub, href, date, extra) { if (Fe.on(key)) (T[key] || []).forEach(function (x) { add(group, icon, title(x), sub(x), home + href, date ? x[date] : '', extra ? extra(x) : ''); }); };
      tool('meetings', 'Work', 'people', function (m) { return m.title; }, function (m) { return 'Meeting · ' + fmt(m.date) + (m.who ? ' · ' + m.who : ''); }, 'work/#meetings', 'date', function (m) { return (m.notes || '') + ' ' + (m.actions || '') + ' ' + (m.who || ''); });
      tool('learning', 'Work', 'mortarboard', function (c) { return c.title; }, function (c) { return [c.provider, c.expires ? 'expires ' + fmt(c.expires) : ''].filter(Boolean).join(' · ') || 'Course'; }, 'work/#learning', 'date', function (c) { return c.notes; });
      tool('flex', 'Work', 'stopwatch', function (f) { return 'Work day ' + fmt(f.date); }, function (f) { return (f.in || '') + '–' + (f.out || '') + (f.note ? ' · ' + f.note : ''); }, 'work/#flex', 'date', function (f) { return f.note; });
      tool('training', 'Health', 'heart-pulse', function (w) { return 'Workout ' + fmt(w.date); }, function (w) { return (w.kind || '') + ' · ' + (w.min || 0) + ' min'; }, 'habits/#training', 'date', function (w) { return (w.kind || '') + ' ' + (w.notes || ''); });
      tool('health', 'Health', 'clipboard2-pulse', function (h) { return h.title; }, function (h) { return [fmt(h.date), h.where].filter(Boolean).join(' · '); }, 'habits/#health', 'date', function (h) { return (h.notes || '') + ' ' + (h.where || ''); });
      tool('journal', 'Health', 'journal-bookmark', function (j) { return j.line; }, function (j) { return 'Journal · ' + fmt(j.date); }, 'habits/#journal', 'date', function (j) { return j.notes; });
      tool('bucket', 'Trips', 'pin-map', function (b) { return b.place; }, function (b) { return b.visited ? 'Visited' : 'Want to visit'; }, 'travel/#bucket', '', function (b) { return b.notes; });
      tool('subs', 'Finances', 'arrow-repeat', function (s) { return s.name; }, function (s) { return kr(s.amount) + ' · ' + (s.period || 'monthly'); }, 'finance/#subs', '', function (s) { return s.notes; });
      tool('warranty', 'Finances', 'receipt-cutoff', function (w) { return w.item; }, function (w) { return [w.store, fmt(w.bought), w.receipt ? 'receipt: ' + w.receipt : ''].filter(Boolean).join(' · '); }, 'finance/#warranty', 'bought', function (w) { return (w.store || '') + ' ' + (w.notes || '') + ' ' + (w.receipt || ''); });
    }
    add('Reviews', 'clipboard-check', 'Weekly check-in', 'Spending, the week ahead, focus and habits', home + '#checkin', '', 'review week weekly sunday plan uke');
    add('Do', 'upload', 'Import from bank', 'CSV or Excel from your bank or credit card', home + 'finance/#import', '', 'import bank csv excel kort sparebank dnb nordea');
    add('Reviews', 'calendar-heart', 'Monthly check-in', 'Last month and the month ahead', home + '#review=month', '', 'review month summary');
    add('Reviews', 'stars', 'Year in review', 'Trips, money, workouts and habits', home + '#review=year', '', 'review year summary annual');
    SETTINGS.forEach(function (s) { add('Settings', 'gear', s[1], s[2], home + '?settings=' + s[0], '', s[2]); });
    return out;
  }
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index().map(function (r) {
      var hay = (r.t + ' ' + r.s + ' ' + r.x + ' ' + r.g).toLowerCase(), t = r.t.toLowerCase(), score = 0;
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) < 0) return null;
        score += t.indexOf(words[i]) === 0 ? 6 : t.indexOf(words[i]) > -1 ? 4 : 1;
      }
      if (r.g === 'Settings') score -= .5;
      return { r: r, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || (b.r.d > a.r.d ? 1 : -1); }).slice(0, 40).map(function (x) { return x.r; });
  }

  /* ---------- the search window ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box" role="dialog" aria-modal="true" aria-label="Search"><div class="sr-top"><i class="bi bi-search"></i>' +
    '<input id="srIn" type="search" placeholder="Search everything – trips, events, notes, spending…" autocomplete="off" spellcheck="false" aria-label="Search">' +
    '<button type="button" class="text-btn" data-srclose>Close</button></div><div class="sr-res" id="srRes"></div></div>';
  document.body.appendChild(bg);
  var input = bg.querySelector('#srIn'), res = bg.querySelector('#srRes'), active = -1, results = [];
  /* typed something that reads like a thing to add ("149 rema", "fre 18 middag")? offer it */
  function addRow(q) {
    var S = window.Smart; if (!S || !window.Quick || !window.Quick.add) return null;
    var p = S.parse(q, { memory: ((window.Vault.get() || {}).catMemory) || {} });
    if (!p || !p.strong || p.kind === 'note') return null;
    var dsc = S.describe(p);
    return { g: 'Add', i: dsc.icon, t: 'Add ' + dsc.label.toLowerCase() + ': ' + dsc.bits[0], s: dsc.bits.slice(1).join(' · '), h: '#', act: p };
  }
  function draw() {
    var q = input.value.trim();
    results = search(q);
    var ad = q ? addRow(q) : null;
    if (ad) { if (results.length) results.push(ad); else results = [ad]; }
    active = results.length ? 0 : -1;
    if (!q) { res.innerHTML = '<p class="sr-hint">Search everything – or type something to add: “149 rema”, “fre 18 middag”, “løp 5 km”.</p>'; return; }
    if (!results.length) { res.innerHTML = '<p class="sr-hint">Nothing found for “' + esc(q) + '”.</p>'; return; }
    var last = '', html = '';
    results.forEach(function (r, i) {
      if (r.g !== last) { html += '<p class="sr-g">' + esc(r.g) + '</p>'; last = r.g; }
      html += '<a class="sr-item' + (i === active ? ' on' : '') + '" data-i="' + i + '" href="' + esc(r.h) + '"' + (/^https?:/.test(r.h) && r.h.indexOf(location.host) < 0 ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<span class="sr-ic"><i class="bi bi-' + r.i + '"></i></span><span class="sr-x"><b>' + esc(r.t) + '</b><small>' + esc(r.s) + '</small></span></a>';
    });
    res.innerHTML = html;
  }
  function mark() { res.querySelectorAll('.sr-item').forEach(function (a) { a.classList.toggle('on', +a.dataset.i === active); }); var on = res.querySelector('.sr-item.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  function open() {
    if (!document.documentElement.classList.contains('unlocked')) return;
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    input.value = ''; draw(); setTimeout(function () { input.focus(); }, 30);
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); }
  input.addEventListener('input', draw);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; mark(); } }
    else if (e.key === 'Enter' && active > -1) { e.preventDefault(); var a = res.querySelector('.sr-item.on'); if (a) a.click(); }
    else if (e.key === 'Escape') close();
  });
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-srclose]')) return close();
    var a = e.target.closest('.sr-item');
    if (a && results[+a.dataset.i] && results[+a.dataset.i].act) {
      e.preventDefault();
      if (window.Quick.add(results[+a.dataset.i].act)) { close(); setTimeout(function () { if (window.Dash && window.Dash.reload) window.Dash.reload(); }, 0); }
      return;
    }
    if (a) {
      var h = a.getAttribute('href');
      if (/[?&]settings=/.test(h)) { try { if (location.pathname !== '/cmd/') sessionStorage.setItem('dash.stFrom', location.pathname); } catch (x) {} }
      if (h.split('#')[0] === location.pathname && h.indexOf('#') > -1) { e.preventDefault(); close(); location.hash = h.split('#')[1]; goHash(); }
      else close();
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable)) {
      if (bg.hidden) { e.preventDefault(); open(); }
    }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-search]')) open(); });

  /* the magnifier: next to the avatar in the top corner */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'icon-btn sr-btn'; btn.setAttribute('data-search', ''); btn.setAttribute('aria-label', 'Search (/)');
  btn.innerHTML = '<i class="bi bi-search"></i>';
  var acts = document.querySelector('.top-actions');
  if (acts && document.getElementById('settingsBtn')) acts.insertBefore(btn, acts.firstChild);
  else {
    var host = document.querySelector('#fp > .fp-top');
    if (host) { btn.classList.add('sr-in'); var me = host.querySelector('[data-me]'); host.insertBefore(btn, me || null); }
    else { btn.classList.add('sr-sub'); document.body.appendChild(btn); }
  }

  /* arriving from a search on another page: the dashboard cards */
  function goHash() {
    var m = location.hash.match(/^#c=([a-z]+)$/);
    if (!m) return;
    var card = document.querySelector('.card.' + m[1]);
    if (!card) return;
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('sr-flash'); setTimeout(function () { card.classList.remove('sr-flash'); }, 1600);
    }, 350);
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.Vault.onUnlock(goHash);
  window.addEventListener('hashchange', goHash);
})();
} catch (e) { console.error("search.js", e); }
/* ===== app.js ===== */
try {
/* App bits shared by every /cmd page:
   - install as an app (service worker, so it opens fast and works offline once loaded)
   - a gentle monthly reminder to download an encrypted backup
   - Settings → Features: switch each part of the dashboard on or off */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- app install ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/cmd/sw.js', { scope: '/cmd/' }).catch(function () {});
    });
  }

  /* ---------- backup reminder (home page) ---------- */
  var DAY = 864e5;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function backupNote() {
    var el = $('backupNote');
    if (!el) return;
    var last = +lsGet('dash.lastBackup') || 0, snooze = +lsGet('dash.backupSnooze') || 0, now = Date.now();
    var first = +lsGet('dash.firstUse') || 0;
    if (!first) { lsSet('dash.firstUse', String(now)); first = now; }
    var due = last ? now - last > 30 * DAY : now - first > 7 * DAY;     // give a new setup a week first
    if (!due || now < snooze) { el.hidden = true; return; }
    var ago = last ? Math.floor((now - last) / DAY) : 0;
    el.innerHTML = '<i class="bi bi-shield-check"></i><span><b>Time for a backup.</b> ' +
      (last ? 'Your last one was ' + ago + ' days ago.' : 'You haven’t downloaded one yet.') +
      ' It’s encrypted with your passcode – keep it in iCloud Drive or OneDrive.</span>' +
      '<button type="button" class="pill-btn" data-backup-now><i class="bi bi-download"></i> Download</button>' +
      '<button type="button" class="text-btn" data-backup-later>Later</button>';
    el.hidden = false;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-backup-now]') && window.Vault) {
      window.Vault.backup().then(backupNote);
    } else if (e.target.closest('[data-backup-later]')) {
      lsSet('dash.backupSnooze', String(Date.now() + 7 * DAY));
      backupNote();
    }
  });
  window.addEventListener('dash:backup', backupNote);
  if (window.Vault) window.Vault.onUnlock(backupNote);

  /* ---------- Settings → Features ---------- */
  var F = window.Features;
  var box = $('ftList');
  if (!F || !box) return;
  var GROUP_ICON = { Everyday: 'grid-1x2', Work: 'briefcase', Health: 'heart-pulse', Travel: 'airplane', Finance: 'wallet2' };
  var GROUP_NOTE = {
    Everyday: 'The main parts. Switching one off hides its page, card and calendar items – nothing is deleted.',
    Work: 'Turning on any of these adds a Work page to the menu.',
    Health: 'Shown on the Health page (the menu tab shows when any of these or Habits is on).',
    Travel: 'Shown under Trips on the Travel page.',
    Finance: 'Shown on the Finances page. Renewals and warranty dates also go in your calendar.'
  };
  function render() {
    var groups = [];
    F.LIST.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
    box.innerHTML = groups.map(function (g) {
      return '<p class="st-cardgroup"><i class="bi bi-' + GROUP_ICON[g] + '"></i> ' + g + '</p>' +
        F.LIST.filter(function (x) { return x.group === g; }).map(function (x) {
          return '<label class="st-row ft-row"><span class="st-ico" style="--c:' + x.c + '"><i class="bi bi-' + x.icon + '"></i></span>' +
            '<span class="st-label">' + x.name + '<small>' + x.desc + '</small></span>' +
            '<input type="checkbox" class="switch" data-feat="' + x.id + '"' + (F.on(x.id) ? ' checked' : '') + ' aria-label="' + x.name + '"></label>';
        }).join('') + '<p class="st-note ft-note">' + GROUP_NOTE[g] + '</p>';
    }).join('');
    summary();
  }
  function summary() {
    var s = $('sumFeatures');
    if (!s) return;
    var extra = F.LIST.filter(function (x) { return !x.def && F.on(x.id); }).length;
    s.textContent = F.LIST.filter(function (x) { return F.on(x.id); }).length + ' of ' + F.LIST.length + ' on' + (extra ? ' · ' + extra + ' extra' : '');
  }
  box.addEventListener('change', function (e) {
    var id = e.target.dataset && e.target.dataset.feat;
    if (id) F.set(id, e.target.checked);
  });
  /* ---------- Settings → Work (flex time preferences; shown when a Work part is on) ---------- */
  function wkCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, brk: +c.brk || 0, vacation: +c.vacation || 25 }; }
  function wkFill() {
    var row = $('stWorkRow'); if (!row) return;
    var on = F.WORK.some(F.on), c = wkCfg();
    row.hidden = !on;
    $('sumWork').textContent = String(c.norm).replace('.', ',') + ' h day · ' + c.vacation + ' holiday days' + (c.brk ? ' · ' + c.brk + ' min break' : '');
    if (document.activeElement !== $('wkNorm')) $('wkNorm').value = String(c.norm).replace('.', ',');
    if (document.activeElement !== $('wkBrk')) $('wkBrk').value = c.brk || '';
    if (document.activeElement !== $('wkVac')) $('wkVac').value = c.vacation;
  }
  ['wkNorm', 'wkBrk', 'wkVac'].forEach(function (id) {
    var el = $(id); if (!el) return;
    el.addEventListener('change', function () {
      var v = parseFloat(String(el.value).replace(',', '.')), k = { wkNorm: 'norm', wkBrk: 'brk', wkVac: 'vacation' }[id];
      if (!isFinite(v) || v < 0 || (k === 'norm' && !(v > 0 && v < 16))) { wkFill(); return; }
      var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t); wkFill();
    });
  });
  window.addEventListener('tools:change', wkFill);
  window.addEventListener('st:page', function (e) { if (e.detail === 'features') render(); if (e.detail === 'home') { summary(); wkFill(); } if (e.detail === 'work') wkFill(); });
  if (window.Vault) window.Vault.onUnlock(wkFill);
  window.addEventListener('features:change', function () { summary(); wkFill(); });
  if (window.Vault) window.Vault.onUnlock(summary);
  summary();
})();
} catch (e) { console.error("app.js", e); }
/* ===== quick.js ===== */
try {
/* Quick add: one "+" on every page. Type a line – "149 rema", "tor 14 tannlege", "løp 5 km" –
   and it works out what it is (smart.js), or use the forms below for an expense, event, workout,
   task or note. Press "+" on a keyboard to open it.
   Links can fill it in too, for Siri, Shortcuts and Back Tap:
     /cmd/?add=149 rema            → the line, ready to confirm
     /cmd/?add=expense&kr=149&note=Rema&cat=groceries */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var Fe = window.Features;
  var on = function (k, d) { return Fe ? Fe.on(k) : d; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function num(v) {
    var s = String(v || '').replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.')); return isFinite(n) ? n : NaN;
  }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  var SPEND = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];
  var REPEATS = [['', 'Doesn’t repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['2weeks', 'Every 2 weeks'], ['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  function repeatSelect(v) { return '<select name="rep" aria-label="Repeat">' + REPEATS.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === (v || '') ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>'; }
  var SPORTS = [['strength', 'Strength'], ['run', 'Running'], ['walk', 'Walking'], ['bike', 'Cycling'], ['swim', 'Swimming'], ['ball', 'Ball sports'], ['yoga', 'Yoga / mobility'], ['other', 'Other']];

  /* ---------- the button ---------- */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'qa-btn'; btn.id = 'quickAdd'; btn.setAttribute('aria-label', 'Add (expense, event, workout, task or note)');
  btn.innerHTML = '<i class="bi bi-plus-lg"></i>';
  var host = document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
  if (host) host.insertBefore(btn, host.querySelector('[data-search]') || host.querySelector('[data-me]') || null); else document.body.appendChild(btn);

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'qa-bg'; bg.id = 'quickSheet'; bg.hidden = true;
  bg.innerHTML = '<div class="qa-box" role="dialog" aria-modal="true" aria-label="Add"><div class="qa-handle"></div>' +
    '<form class="qa-smart" id="qaSmart" autocomplete="off"><i class="bi bi-stars" aria-hidden="true"></i>' +
      '<input id="qaLine" enterkeyhint="done" placeholder="Type it: 149 rema · tor 14 tannlege · løp 5 km" aria-label="Type what to add" spellcheck="false">' +
      '<button type="button" class="qa-clear" id="qaClear" aria-label="Clear" hidden><i class="bi bi-x-circle-fill"></i></button></form>' +
    '<div class="qa-prev" id="qaPrev" hidden></div>' +
    '<div class="qa-manual"><div class="qa-tabs" role="tablist" id="qaTabs"></div><div class="qa-body" id="qaBody"></div></div></div>';
  document.body.appendChild(bg);
  var kind = 'expense';
  try { kind = localStorage.getItem('dash.quickKind') || 'expense'; } catch (e) {}

  function kinds() {
    var k = [];
    if (on('finance', true)) k.push(['expense', 'receipt', 'Expense']);
    if (on('calendar', true)) k.push(['event', 'calendar-plus', 'Event']);
    if (on('training', false)) k.push(['workout', 'heart-pulse', 'Workout']);
    k.push(['todo', 'check2-square', 'Task']);
    k.push(['note', 'journal-text', 'Note']);
    return k;
  }
  /* open(kind, prefill, line): a tab (and its fields filled in), or a typed line */
  function open(k, pre, line) {
    if (!window.Vault || !window.Vault.get()) return;          // locked
    var ks = kinds();
    if (k && ks.some(function (x) { return x[0] === k; })) kind = k;
    if (!ks.some(function (x) { return x[0] === kind; })) kind = ks[0][0];
    $('qaTabs').innerHTML = ks.map(function (x) {
      return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (x[0] === kind) + '"><i class="bi bi-' + x[1] + '"></i><span>' + x[2] + '</span></button>';
    }).join('');
    $('qaBody').innerHTML = FORMS[kind](pre || {});
    var wasOpen = !bg.hidden && bg.classList.contains('open');
    $('qaLine').value = line || ''; preview();
    bg.hidden = false; document.body.classList.add('qa-open');
    requestAnimationFrame(function () {
      bg.classList.add('open');
      if (!matchMedia('(hover: hover)').matches || wasOpen && !pre) return;  // phones: no keyboard until you tap
      var f = pre ? $('qaBody').querySelector('button[type=submit]') : $('qaLine');
      if (f) f.focus();
    });
    try { localStorage.setItem('dash.quickKind', kind); } catch (e) {}
  }

  /* ---------- the typed line ---------- */
  var parsed = null;
  function memory() { var d = window.Vault.get() || {}; return d.catMemory || {}; }
  function allowed(p) { return p && kinds().some(function (x) { return x[0] === p.kind; }); }
  function preview() {
    var v = $('qaLine').value.trim(), box = $('qaPrev'), S = window.Smart;
    $('qaClear').hidden = !v;
    parsed = v && S ? S.parse(v, { memory: memory() }) : null;
    var off = parsed && !allowed(parsed) ? parsed.kind : null;
    if (off) parsed = null;
    bg.classList.toggle('qa-typing', !!v);
    if (!v) { box.hidden = true; box.innerHTML = ''; return; }
    var d = S && S.describe(parsed);
    box.hidden = false;
    box.innerHTML = d ? '<div class="qa-guess"><span class="qa-gi"><i class="bi bi-' + d.icon + '"></i></span><span class="qa-gx"><small>' + esc(d.label) + '</small><b>' + d.bits.map(esc).join(' · ') + '</b></span></div>' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-qaedit>Edit</button><span class="spacer"></span><button type="button" class="pill-btn wide" data-addline><i class="bi bi-plus-lg"></i> Add ' + esc(d.label.toLowerCase()) + '</button></div>'
      : off ? '<p class="muted qa-hint">' + ({ workout: 'Logging workouts needs the Training log – switch it on in Settings → Features.', expense: 'Expenses need Finances – switch it on in Settings → Features.', event: 'Events need the Calendar – switch it on in Settings → Features.' }[off] || 'That part is switched off.') + '</p>'
      : '<p class="muted qa-hint">Didn’t get that – try “149 rema”, “fre 18 middag”, “løp 5 km” or “kjøp melk i morgen”.</p>';
  }
  function addLine() {
    if (!parsed) return false;
    var p = parsed, ok = ADD[p.kind](p);
    if (ok) { $('qaLine').value = ''; preview(); }
    return ok;
  }
  /* "Edit": the matching form, filled in */
  function editLine() {
    if (!parsed) return;
    var p = parsed, pre = {};
    if (p.kind === 'expense') pre = { a: p.amount, c: p.cat, n: p.note, d: p.date };
    else if (p.kind === 'event') pre = { t: p.title, d: p.date, s: p.start, all: p.allDay, l: p.location, rep: p.repeat };
    else if (p.kind === 'workout') pre = { k: p.sport, m: p.min, km: p.km, d: p.date };
    else if (p.kind === 'todo') pre = { t: p.text, due: p.due, rep: p.repeat };
    else if (p.kind === 'note') pre = { t: p.text };
    open(p.kind, pre, '');
  }
  function close() {
    bg.classList.remove('open'); document.body.classList.remove('qa-open');
    setTimeout(function () { if (!bg.classList.contains('open')) bg.hidden = true; }, 320);
  }
  /* toast(html, undo): a short note at the bottom; with undo, an Undo button for a few seconds */
  function toast(html, undo) {
    var t = $('qaToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'qaToast'; t.className = 'qa-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
      t.addEventListener('click', function (e) {
        if (!e.target.closest('[data-undo]') || !t._undo) return;
        var u = t._undo; t._undo = null; u(); t.classList.remove('show'); setTimeout(reload, 0);
      });
    }
    t._undo = undo || null;
    t.innerHTML = '<span>' + html + '</span>' + (undo ? '<button type="button" class="qa-undo" data-undo>Undo</button>' : '');
    t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); t._undo = null; }, undo ? 5000 : 2600);
  }

  /* recent expenses as one-tap chips (the same note, category and amount) */
  function recentChips() {
    var d = window.Vault.get() || {}, seen = {}, out = [];
    (d.expenses || []).slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); }).forEach(function (e) {
      var k = (e.note || '').toLowerCase() + '|' + e.cat + '|' + e.amount;
      if (seen[k] || out.length >= 6 || !e.note || e.src) return;
      seen[k] = 1; out.push(e);
    });
    return out;
  }
  var FORMS = {
    expense: function (p) {
      var chips = p.a ? [] : recentChips();
      return '<form class="qa-form" data-kind="expense">' +
        '<div class="qa-row"><input name="a" class="qa-amt" placeholder="Amount, kr" inputmode="decimal" autocomplete="off" required value="' + esc(p.a ? (p.a % 1 ? (+p.a).toFixed(2) : String(p.a)).replace('.', ',') : '') + '">' +
          '<select name="c" aria-label="Category">' + SPEND.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === p.c ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="qa-row"><input name="n" placeholder="What was it? (optional)" autocomplete="off" value="' + esc(p.n || '') + '"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"></div>' +
        (chips.length ? '<div class="qa-chips">' + chips.map(function (e) {
          return '<button type="button" data-chip data-a="' + esc(e.amount) + '" data-c="' + esc(e.cat) + '" data-n="' + esc(e.note) + '">' + esc(e.note) + ' <b>' + esc(nf.format(e.amount)) + '</b></button>';
        }).join('') + '</div>' : '') +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log expense</button></div></form>';
    },
    event: function (p) {
      var cats = window.Cal ? window.Cal.CAT_ORDER.map(function (id) { return [id, window.Cal.CATS[id].name]; }) :
        (function () { var c = readJSON('dash.calendar', {}).cats; return Array.isArray(c) && c.length ? c.map(function (x) { return [x.id, x.name]; }) : [['personal', 'Personal'], ['work', 'Work'], ['study', 'Study'], ['training', 'Training'], ['social', 'Social']]; })();
      var last = ''; try { last = localStorage.getItem('dash.calLastCat') || ''; } catch (e) {}
      var n = new Date(), hh = p.s || pad(Math.min(23, n.getHours() + 1)) + ':00';
      return '<form class="qa-form" data-kind="event">' +
        '<input name="t" placeholder="What? e.g. Dentist" autocomplete="off" required value="' + esc(p.t || '') + '">' +
        '<div class="qa-row"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"><input name="s" type="time" value="' + esc(hh) + '" aria-label="Start"' + (p.all ? ' disabled' : '') + '><label class="qa-check"><input type="checkbox" name="all"' + (p.all ? ' checked' : '') + '> All day</label></div>' +
        '<div class="qa-row"><select name="c" aria-label="Category">' + cats.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === last ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select>' +
          '<input name="l" placeholder="Where (optional)" autocomplete="off" value="' + esc(p.l || '') + '"></div>' +
        '<div class="qa-row qa-row1">' + repeatSelect(p.rep).replace(/<option value="quarterly"[^<]*<\/option>/, '') + '</div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add event</button></div></form>';
    },
    workout: function (p) {
      return '<form class="qa-form" data-kind="workout">' +
        '<div class="qa-row"><select name="k" aria-label="Type">' + SPORTS.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === p.k ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
          '<input name="m" placeholder="Minutes" inputmode="numeric" value="' + esc(p.m || 60) + '" aria-label="Minutes" required></div>' +
        '<div class="qa-row"><input name="km" placeholder="km (optional)" inputmode="decimal" aria-label="Distance" value="' + esc(p.km ? String(p.km).replace('.', ',') : '') + '"><input name="d" type="date" value="' + esc(p.d || today()) + '" aria-label="Date"></div>' +
        '<div class="qa-effort" role="radiogroup" aria-label="How hard">' + [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']].map(function (e) {
          return '<label><input type="radio" name="e" value="' + e[0] + '"' + (e[0] === '3' ? ' checked' : '') + '><span>' + e[1] + '</span></label>';
        }).join('') + '</div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Log workout</button></div></form>';
    },
    todo: function (p) {
      return '<form class="qa-form" data-kind="todo"><input name="t" placeholder="Something to do…" autocomplete="off" required value="' + esc(p.t || '') + '">' +
        '<div class="qa-row"><input id="qaDue" name="due" type="date" value="' + esc(p.due || '') + '" aria-label="Due date (optional)">' + repeatSelect(p.rep) + '</div>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Add task</button></div></form>';
    },
    note: function (p) {
      return '<form class="qa-form" data-kind="note"><textarea name="t" rows="3" placeholder="Write something…" required>' + esc(p.t || '') + '</textarea>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-close>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">Save note</button></div></form>';
    }
  };

  /* ---------- saving: straight into the same places the pages use ---------- */
  function reload() { if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  /* ADD: the data, from the typed line or a form – straight into the same places the pages use */
  var ADD = {
    expense: function (p) {
      var a = +p.amount; if (!(a > 0)) return false;
      var d = window.Vault.get(); d.expenses = d.expenses || [];
      var e = { id: uid(), t: Date.now(), date: p.date || today(), amount: a, cat: p.cat || 'other', note: String(p.note || '').trim().slice(0, 80) };
      d.expenses.push(e);
      if (e.note && window.Smart) { d.catMemory = d.catMemory || {}; d.catMemory[window.Smart.norm(e.note)] = e.cat; }
      window.Vault.save(d);
      window.dispatchEvent(new Event('fin:change'));
      toast('<i class="bi bi-check-lg"></i> ' + esc(nf.format(a)) + (e.note ? ' · ' + esc(e.note) : '') + ' logged', function () {
        var x = window.Vault.get(); x.expenses = (x.expenses || []).filter(function (y) { return y.id !== e.id; }); window.Vault.save(x); window.dispatchEvent(new Event('fin:change'));
      });
      return true;
    },
    event: function (p) {
      var t = String(p.title || '').trim(); if (!t) return false;
      var date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today(), all = !!p.allDay || !p.start;
      var cat = p.cat;
      if (!cat) { try { cat = localStorage.getItem('dash.calLastCat') || ''; } catch (e) {} }
      if (window.Cal && !window.Cal.CATS[cat]) cat = window.Cal.CAT_ORDER[0];
      var ev = { id: uid(), title: t.slice(0, 120), cat: cat || 'personal', date: date, allDay: all, location: String(p.location || '').trim().slice(0, 160), notes: '' };
      if (p.repeat) ev.repeat = p.repeat;
      if (!all) { var s = /^\d{2}:\d{2}$/.test(p.start) ? p.start : '09:00'; ev.start = s; var m = +s.slice(0, 2) * 60 + +s.slice(3) + 60; ev.stop = pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
      function store(fn) {
        if (window.Cal) { var cd = window.Cal.load(); fn(cd); window.Cal.save(cd); }
        else { var raw = readJSON('dash.calendar', {}); raw.events = Array.isArray(raw.events) ? raw.events : []; raw.hidden = raw.hidden || {}; fn(raw); writeJSON('dash.calendar', raw); window.dispatchEvent(new Event('cal:change')); }
      }
      store(function (cd) { cd.events.push(ev); if (cd.hidden && cd.hidden[ev.cat]) delete cd.hidden[ev.cat]; });
      try { localStorage.setItem('dash.calLastCat', ev.cat); } catch (e) {}
      toast('<i class="bi bi-check-lg"></i> ' + esc(t) + ' added ' + (window.Smart ? window.Smart.when(date) : date) + (ev.start ? ' ' + ev.start : ''), function () {
        store(function (cd) { cd.events = cd.events.filter(function (x) { return x.id !== ev.id; }); });
      });
      return true;
    },
    workout: function (p) {
      var min = +p.min; if (!(min > 0)) return false;
      var hb = readJSON('dash.habits', { list: [], log: {} });
      var habit = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
      var w = { id: uid(), date: p.date || today(), kind: p.sport || 'other', min: min, km: +p.km || '', effort: p.effort || '3', habit: habit ? habit.id : '', notes: String(p.note || '') };
      var t = Fe.tools(); t.training = Array.isArray(t.training) ? t.training : []; t.training.push(w); Fe.saveTools(t);
      var ticked = false;
      if (habit) { hb.log = hb.log || {}; var l = hb.log[w.date] = hb.log[w.date] || []; if (l.indexOf(habit.id) < 0) { l.push(habit.id); ticked = true; writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } }
      toast('<i class="bi bi-check-lg"></i> Workout logged' + (ticked ? ' · “' + esc(habit.name) + '” ticked' : ''), function () {
        var tl = Fe.tools(); tl.training = (tl.training || []).filter(function (x) { return x.id !== w.id; }); Fe.saveTools(tl);
        if (ticked) { var h2 = readJSON('dash.habits', { list: [], log: {} }); h2.log[w.date] = (h2.log[w.date] || []).filter(function (x) { return x !== habit.id; }); writeJSON('dash.habits', h2); window.dispatchEvent(new Event('habits:change')); }
      });
      return true;
    },
    todo: function (p) {
      var t = String(p.text || '').trim(); if (!t) return false;
      var todos = readJSON('dash.todos', []), item = { id: uid(), text: t.slice(0, 200), done: false };
      if (/^\d{4}-\d{2}-\d{2}$/.test(p.due || '')) item.due = p.due;
      if (p.repeat) { item.repeat = p.repeat; if (!item.due) item.due = today(); if (p.rday) item.rday = p.rday; }
      todos.push(item); writeJSON('dash.todos', todos);
      toast('<i class="bi bi-check-lg"></i> Task added' + (item.repeat && window.Smart ? ' · ' + window.Smart.REPEAT_NAME[item.repeat] : item.due && window.Smart ? ' · due ' + window.Smart.when(item.due) : ''), function () {
        writeJSON('dash.todos', readJSON('dash.todos', []).filter(function (x) { return x.id !== item.id; }));
      });
      return true;
    },
    note: function (p) {
      var t = String(p.text || '').trim(); if (!t) return false;
      var notes = readJSON('dash.notes', []), n = { id: uid(), text: t }; notes.unshift(n); writeJSON('dash.notes', notes);
      toast('<i class="bi bi-check-lg"></i> Note saved', function () { writeJSON('dash.notes', readJSON('dash.notes', []).filter(function (x) { return x.id !== n.id; })); });
      return true;
    }
  };
  /* the forms → ADD */
  var SAVE = {
    expense: function (f) { var a = num(f.a.value); if (!(a > 0)) { f.a.focus(); return false; } return ADD.expense({ amount: a, cat: f.c.value, note: f.n.value, date: f.d.value }); },
    event: function (f) { if (!f.t.value.trim()) { f.t.focus(); return false; } return ADD.event({ title: f.t.value, date: f.d.value, start: f.all.checked ? null : f.s.value, allDay: f.all.checked, cat: f.c.value, location: f.l.value, repeat: f.rep.value }); },
    workout: function (f) { if (!(+f.m.value > 0)) { f.m.focus(); return false; } return ADD.workout({ sport: f.k.value, min: +f.m.value, km: num(f.km.value), date: f.d.value, effort: f.e.value }); },
    todo: function (f) { return ADD.todo({ text: f.t.value, due: f.due.value, repeat: f.rep.value }); },
    note: function (f) { return ADD.note({ text: f.t.value }); }
  };

  /* ---------- wiring ---------- */
  btn.addEventListener('click', function () { open(); });
  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-quick]');
    if (q) { e.preventDefault(); open(q.dataset.quick); }
  });
  bg.addEventListener('click', function (e) {
    if (e.target === bg || e.target.closest('[data-close]')) { close(); return; }
    var tab = e.target.closest('[data-tab]');
    if (tab) { kind = tab.dataset.tab; try { localStorage.setItem('dash.quickKind', kind); } catch (x) {} open(kind); return; }
    if (e.target.closest('[data-addline]')) { if (addLine()) { close(); setTimeout(reload, 0); } return; }
    if (e.target.closest("[data-qaedit]")) { editLine(); return; }
    if (e.target.closest('#qaClear')) { $('qaLine').value = ''; preview(); $('qaLine').focus(); return; }
    var chip = e.target.closest('[data-chip]');
    if (chip) { var f = chip.closest('form'); f.a.value = chip.dataset.a; f.c.value = chip.dataset.c; f.n.value = chip.dataset.n; f.querySelector('button[type=submit]').focus(); }
  });
  bg.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.id === 'qaSmart') { if (addLine()) { close(); setTimeout(reload, 0); } return; }
    if (SAVE[f.dataset.kind](f)) { close(); setTimeout(reload, 0); }
  });
  bg.addEventListener('input', function (e) { if (e.target.id === 'qaLine') preview(); });
  bg.addEventListener('change', function (e) {
    if (e.target.name === 'all') { var s = e.target.closest('form').s; s.disabled = e.target.checked; }
  });
  document.addEventListener('keydown', function (e) {
    if (!bg.hidden && e.key === 'Escape') { close(); return; }
    if (e.key === '+' && !/input|textarea|select/i.test(document.activeElement.tagName) && bg.hidden) { e.preventDefault(); open(); }
  });
  /* phone: pull the sheet down to close */
  (function () {
    var box = bg.firstElementChild, sd = null;
    box.addEventListener('touchstart', function (e) { var t = e.touches[0]; sd = { y0: t.clientY, dy: 0, t0: Date.now(), go: box.scrollTop <= 0 && !e.target.closest('input, select, textarea') }; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!sd || !sd.go) return;
      sd.dy = e.touches[0].clientY - sd.y0;
      if (sd.dy > 0) { box.style.transition = 'none'; box.style.transform = 'translateY(' + sd.dy + 'px)'; }
    }, { passive: true });
    box.addEventListener('touchend', function () {
      if (!sd) return; var d = sd; sd = null; box.style.transition = ''; box.style.transform = '';
      if (d.go && (d.dy > 110 || (d.dy > 40 && Date.now() - d.t0 < 260))) close();
    });
  })();
  window.Vault.onLock(close);

  /* links from Siri, Shortcuts or Back Tap: /cmd/?add=… opens the sheet filled in, ready to confirm */
  (function () {
    var q = new URLSearchParams(location.search), a = q.get('add');
    if (!a) return;
    var line = a, pre = null, k = null;
    if (/^(expense|event|workout|task|todo|note)$/i.test(a)) {
      k = a.toLowerCase() === 'task' ? 'todo' : a.toLowerCase(); line = '';
      if (k === 'expense') pre = { a: num(q.get('kr') || q.get('amount')) || '', n: q.get('note') || '', c: q.get('cat') || '', d: q.get('date') || '' };
      else if (k === 'event') pre = { t: q.get('title') || q.get('note') || '', d: q.get('date') || '', s: q.get('time') || '', l: q.get('where') || '' };
      else if (k === 'workout') pre = { k: q.get('type') || '', m: q.get('min') || '', km: q.get('km') || '' };
      else pre = { t: q.get('text') || q.get('note') || '' };
    }
    q.delete('add'); ['kr', 'amount', 'note', 'cat', 'date', 'title', 'time', 'where', 'type', 'min', 'km', 'text'].forEach(function (x) { q.delete(x); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    window.Vault.onUnlock(function () { setTimeout(function () { open(k, pre, line); }, 350); });
  })();
  window.Quick = { open: open, close: close, toast: toast, add: function (p) { return allowed(p) && ADD[p.kind](p); } };
})();
} catch (e) { console.error("quick.js", e); }
/* ===== notify.js ===== */
try {
/* Notifications and Siri & Shortcuts.

   Notifications are off until you switch them on (Settings → Notifications), and only on the
   device where you did. While the dashboard is open it plans the reminders for the next 7 days
   and gives them to the server (Worker), which sends each one at its time – also when the app is
   closed. "Private" text (the default) never sends titles or amounts: just "A bill is due today".
   "Full" sends the titles, so the reminder can say "Rent · 12 000 kr".
   Settings for this device are in localStorage "dash.push" (not synced – each device decides). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var API = '/cmd/api/push', KEY = 'dash.push';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function at(key, hh, mm) { var p = String(key).split('-'); return new Date(+p[0], p[1] - 1, +p[2], hh, mm || 0).getTime(); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(+n || 0)) + ' kr'; }
  var DEF = { on: false, ev: 15, k: { bills: true, tasks: true, pay: true, trips: true, checkin: true }, detail: 'private' };
  function prefs() { var p = readJSON(KEY, {}); var o = Object.assign({}, DEF, p); o.k = Object.assign({}, DEF.k, p.k || {}); return o; }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function devId() { var p = prefs(); if (!p.id) { p.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(p); } return p.id; }

  /* ================= Siri & Shortcuts ================= */
  function shortcuts() {
    var box = $('scList'); if (!box) return;
    var o = location.origin, Fe = window.Features, on = function (k, d) { return Fe ? Fe.on(k) : d; };
    var L = [['stars', 'Type a line – for Siri', o + '/cmd/?add=', 'Add what you say after it: “149 rema”, “fre 18 middag”, “løp 5 km”']];
    if (on('finance', true)) L.push(['receipt', 'Log expense', o + '/cmd/?add=expense', 'Opens the expense form']);
    if (on('calendar', true)) L.push(['calendar-plus', 'New event', o + '/cmd/?add=event', '']);
    L.push(['check2-square', 'New task', o + '/cmd/?add=task', '']);
    if (on('training', false)) L.push(['heart-pulse', 'Log workout', o + '/cmd/?add=workout', '']);
    L.push(['clipboard-check', 'Weekly check-in', o + '/cmd/#checkin', '']);
    if (on('finance', true)) L.push(['upload', 'Import from bank', o + '/cmd/finance/#import', '']);
    box.innerHTML = L.map(function (l) {
      return '<div class="st-row sc-row"><span class="st-ico" style="--c:#8a6fdf"><i class="bi bi-' + l[0] + '"></i></span><span class="st-label">' + esc(l[1]) +
        '<small class="sc-url">' + esc(l[2].replace(/^https?:\/\//, '')) + '</small>' + (l[3] ? '<small>' + esc(l[3]) + '</small>' : '') + '</span>' +
        '<button type="button" class="text-btn" data-sccopy="' + esc(l[2]) + '"><i class="bi bi-copy"></i> Copy</button></div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sccopy]'); if (!b) return;
    var t = b.dataset.sccopy, done = function () { b.innerHTML = '<i class="bi bi-check-lg"></i> Copied'; setTimeout(function () { b.innerHTML = '<i class="bi bi-copy"></i> Copy'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { window.prompt('Copy this link', t); });
    else window.prompt('Copy this link', t);
  });

  /* ================= what to remind you of ================= */
  function plan() {
    var d = window.Vault && window.Vault.get(); if (!d) return [];
    var p = prefs(), full = p.detail === 'full', now = Date.now(), end = now + 7 * 864e5, out = [];
    var Fe = window.Features, C = window.Cal, Bu = window.Budget, Fl = window.Flow;
    var on = function (k, def) { return Fe ? Fe.on(k) : def; };
    function add(id, t, title, body, url) { if (t > now + 60e3 && t < end) out.push({ id: id, at: t, title: title, body: body, url: url || '/cmd/' }); }
    var tKey = dkey(new Date());
    /* events in your calendar (your own and your phone calendars), not all-day ones */
    if (+p.ev > 0 && C && on('calendar', true)) {
      try {
        C.occurrences(new Date(now), new Date(end), { card: true }).forEach(function (o) {
          if (o.allDay || o.ev.holiday || o.ev.reminder) return;
          var hm = pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()), mins = +p.ev;
          add('ev:' + o.ev.id + ':' + o.start.getTime(), o.start.getTime() - mins * 60e3,
            full ? o.title : 'Coming up', full ? hm + (o.ev.location ? ' · ' + o.ev.location : '') + ' – in ' + (mins >= 60 ? mins / 60 + ' h' : mins + ' min') : 'Something in your calendar in ' + (mins >= 60 ? mins / 60 + ' hour' : mins + ' minutes'),
            '/cmd/calendar/#d=' + dkey(o.start));
        });
      } catch (e) {}
    }
    /* bills due (not subscriptions – those are paid automatically) */
    if (p.k.bills && d.budget && on('finance', true)) {
      for (var m = 0; m < 2; m++) {
        var base = new Date(); base = new Date(base.getFullYear(), base.getMonth() + m, 1);
        var ym = base.getFullYear() + '-' + pad(base.getMonth() + 1), dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate(), paid = (d.paid && d.paid[ym]) || [];
        (d.budget.fixed || []).forEach(function (f) {
          if (!f.day || f.src === 'sub' || paid.indexOf(f.id) > -1) return;
          var k = ym + '-' + pad(Math.min(f.day, dim));
          add('bill:' + f.id + ':' + k, at(k, 9), full ? f.name + ' is due today' : 'A bill is due today', full ? kr(f.amount) : 'Open Finances to see it', '/cmd/finance/#c=bills');
        });
      }
    }
    /* tasks with a day */
    if (p.k.tasks) (readJSON('dash.todos', []) || []).forEach(function (t) {
      if (t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.due || '')) return;
      add('task:' + t.id + ':' + t.due, at(t.due, 9), full ? t.text : 'A task is due today', full ? 'To-do · today' : 'Open your to-do list', '/cmd/#c=todo');
    });
    /* payday */
    if (p.k.pay && Bu && on('finance', true)) {
      try { Bu.paydays(d, new Date(), new Date(end)).forEach(function (x) { var k = dkey(x.date); add('pay:' + k, at(k, 8), x.title + ' today', full && x.net ? 'About ' + kr(x.net) : '', '/cmd/#fin'); }); } catch (e) {}
    }
    /* trips: the evening before */
    if (p.k.trips && Fl && on('travel', true)) {
      Fl.travel().trips.forEach(function (t) {
        if (!t.start || t.start <= tKey) return;
        var dt = new Date(t.start + 'T12:00'); dt.setDate(dt.getDate() - 1);
        add('trip:' + t.id, at(dkey(dt), 19), full ? (t.name || t.dest) + ' tomorrow' : 'Your trip starts tomorrow', full ? 'Check tickets, passport and packing list' : 'Check your packing list', '/cmd/travel/#trip=' + t.id);
      });
    }
    /* the weekly check-in, Sunday 18:00 */
    if (p.k.checkin && window.Checkin) {
      var sun = new Date(); sun.setDate(sun.getDate() + (7 - sun.getDay()) % 7);
      var wk = window.Checkin.weekOf(sun);
      if ((d.checkins || []).indexOf(wk.key) < 0) add('checkin:' + wk.key, at(dkey(sun), 18), 'Weekly check-in', '5 minutes: spending, the week ahead and habits', '/cmd/#checkin');
    }
    return out.sort(function (a, b) { return a.at - b.at; }).slice(0, 80);
  }

  /* ================= talking to the server ================= */
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function iosNotInstalled() { return /iP(hone|ad|od)/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches); }
  function u8(b64) { var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function api(method, body) {
    return fetch(API, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('error ' + r.status)); return j; }); });
  }
  function subscription(create) {
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub || !create) return sub;
        return api('GET').then(function (j) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(j.key) }); });
      });
    });
  }
  var lastSent = '', timer = null;
  function sync(force) {
    var p = prefs();
    if (!p.on || !supported() || !window.Vault || !window.Vault.get()) return Promise.resolve();
    return subscription(false).then(function (sub) {
      if (!sub) return;
      var items = plan(), sig = JSON.stringify([items, p.detail]);
      if (!force && sig === lastSent && Date.now() - (p.synced || 0) < 6 * 3600e3) return;
      return api('PUT', { id: devId(), sub: sub.toJSON(), items: items }).then(function () {
        lastSent = sig; var q = prefs(); q.synced = Date.now(); q.count = items.length; save(q); fill();
      });
    }).catch(function (e) { var s = $('ntState'); if (s) s.textContent = 'Couldn’t reach the server: ' + e.message; });
  }
  function soon() { clearTimeout(timer); timer = setTimeout(sync, 4000); }

  /* ================= Settings → Notifications ================= */
  function fill() {
    var p = prefs(), box = $('ntOn'); if (!box) return;
    box.checked = !!p.on;
    $('ntMore').hidden = !p.on;
    var perm = 'Notification' in window ? Notification.permission : 'unsupported';
    $('ntState').textContent = !supported() ? 'This browser can’t show notifications' : iosNotInstalled() ? 'Open the dashboard from its Home Screen icon to use this' :
      !p.on ? 'Off' : perm === 'denied' ? 'Blocked – allow notifications for the app in the phone’s settings' :
      'On · ' + (p.count != null ? p.count + ' reminder' + (p.count === 1 ? '' : 's') + ' planned for the next 7 days' : 'planning…');
    document.querySelectorAll('[data-ntev]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.ntev === +p.ev)); });
    document.querySelectorAll('[data-ntk]').forEach(function (c) { c.checked = !!p.k[c.dataset.ntk]; });
    document.querySelectorAll('[data-ntdetail]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ntdetail === p.detail)); });
    $('ntDetailNote').textContent = p.detail === 'full' ? 'Shows titles and amounts. They pass through your server to send them.' : 'No titles or amounts leave your device – “A bill is due today”.';
    $('ntHelp').textContent = 'Reminders are planned 7 days ahead each time you open the dashboard. Haven’t opened it for a week? Then they pause until you do.';
    var sum = $('sumNotify'); if (sum) sum.textContent = p.on ? 'On on this device' : 'Off';
  }
  function setP(patch) { var p = prefs(); Object.keys(patch).forEach(function (k) { p[k] = patch[k]; }); save(p); fill(); sync(true); }
  function turnOn() {
    if (!supported() || iosNotInstalled()) { $('ntOn').checked = false; fill(); return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { $('ntOn').checked = false; var p = prefs(); p.on = false; save(p); fill(); $('ntState').textContent = 'Not allowed – you can allow it in the phone’s settings for the app'; return; }
      return subscription(true).then(function () { var p = prefs(); p.on = true; save(p); fill(); return sync(true); });
    }).catch(function (e) { $('ntOn').checked = false; $('ntState').textContent = 'Couldn’t switch on: ' + e.message; });
  }
  function turnOff() {
    var p = prefs(); p.on = false; save(p); fill();
    subscription(false).then(function (sub) {
      api('DELETE', { id: devId() }).catch(function () {});
      if (sub) sub.unsubscribe().catch(function () {});
    }).catch(function () {});
  }
  if ($('ntOn')) {
    $('ntOn').addEventListener('change', function () { if (this.checked) turnOn(); else turnOff(); });
    document.querySelectorAll('[data-ntev]').forEach(function (b) { b.addEventListener('click', function () { setP({ ev: +b.dataset.ntev }); }); });
    document.querySelectorAll('[data-ntk]').forEach(function (c) { c.addEventListener('change', function () { var p = prefs(); p.k[c.dataset.ntk] = c.checked; save(p); fill(); sync(true); }); });
    document.querySelectorAll('[data-ntdetail]').forEach(function (b) { b.addEventListener('click', function () { setP({ detail: b.dataset.ntdetail }); }); });
    $('ntTest').addEventListener('click', function () {
      var b = this; b.disabled = true;
      sync(true).then(function () { return api('POST', { id: devId(), test: true }); })
        .then(function () { if (window.Quick) window.Quick.toast('<i class="bi bi-send"></i> Test sent – it should arrive in a few seconds'); })
        .catch(function (e) { if (window.Quick) window.Quick.toast('<i class="bi bi-exclamation-circle"></i> ' + esc(e.message)); })
        .then(function () { b.disabled = false; });
    });
  }

  if (window.Vault) {
    window.Vault.onUnlock(function () { shortcuts(); fill(); setTimeout(sync, 2500); });
    ['dash:local', 'fin:change', 'cal:change', 'todos:change', 'travel:change', 'tools:change', 'checkin:done', 'features:change'].forEach(function (ev) { window.addEventListener(ev, soon); });
    setInterval(sync, 3 * 3600e3);
  }
  window.addEventListener('features:change', shortcuts);
  window.Notify = { plan: plan, sync: sync, prefs: prefs };
})();
} catch (e) { console.error("notify.js", e); }
/* ===== ahealth.js ===== */
try {
/* Apple Health: steps, sleep, resting heart rate, exercise and weight from your iPhone.

   An iPhone Shortcut sends the day's numbers to your server (/cmd/api/health, with an Access
   service token that can do nothing else). The next time the dashboard opens it takes them,
   puts them in your encrypted vault (d.health.days) and deletes them from the server.
   A link works too: /cmd/?health=1&date=2026-10-28&steps=8234&sleep=7.2 …

   Connected to: Health page (card + habit ticks), At a glance (short nights), the weekly
   check-in, the monthly review, search. Switch on/off in Settings → Features → Apple Health. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  var Fe = window.Features;
  var API = '/cmd/api/health';
  var F = ['steps', 'sleep', 'rhr', 'active', 'exercise', 'weight', 'distance', 'flights'];
  var LABEL = { steps: 'Steps', sleep: 'Sleep', rhr: 'Resting heart rate', active: 'Active energy', exercise: 'Exercise', weight: 'Weight', distance: 'Walking + running', flights: 'Flights climbed' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(k, n) { var d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return dkey(d); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; }
  /* sleep can arrive as hours, minutes or seconds – whatever the Shortcut produced */
  function hours(v) { v = num(v); if (v == null) return null; return v > 1440 ? v / 3600 : v > 24 ? v / 60 : v; }
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function fmt(f, v) {
    if (v == null) return '–';
    if (f === 'sleep') return hm(v);
    if (f === 'rhr') return Math.round(v) + ' bpm';
    if (f === 'active') return nf.format(v) + ' kcal';
    if (f === 'exercise') return Math.round(v) + ' min';
    if (f === 'weight') return nf1.format(v) + ' kg';
    if (f === 'distance') return nf1.format(v) + ' km';
    return nf.format(v);
  }

  function days() { var d = window.Vault.get() || {}; return (d.health && d.health.days) || {}; }
  /* put days in the vault, tick habits that follow a number, tell the rest of the dashboard */
  function merge(list, source) {
    var d = window.Vault.get(); if (!d || !list.length) return 0;
    d.health = d.health || {}; d.health.days = d.health.days || {};
    var n = 0;
    list.forEach(function (x) {
      var k = /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) ? String(x.date).slice(0, 10) : dkey(new Date());
      var cur = d.health.days[k] || {}, ch = false;
      F.forEach(function (f) { var v = f === 'sleep' ? hours(x[f]) : num(x[f]); if (v != null) { cur[f] = Math.round(v * 100) / 100; ch = true; } });
      if (ch) { cur.t = Date.now(); d.health.days[k] = cur; n++; }
    });
    var keys = Object.keys(d.health.days).sort(); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.health.days[k]; });
    d.health.last = Date.now();
    window.Vault.save(d);
    if (Fe && !Fe.on('ahealth')) Fe.set('ahealth', true);          // first numbers: show the card
    tickHabits();
    window.dispatchEvent(new Event('health:change'));
    if (n && window.Quick) {
      var last = list[list.length - 1], bits = [];
      if (last.steps != null) bits.push(fmt('steps', num(last.steps)) + ' steps');
      if (last.sleep != null) bits.push(fmt('sleep', hours(last.sleep)) + ' sleep');
      window.Quick.toast('<i class="bi bi-heart-pulse"></i> Apple Health' + (n > 1 ? ': ' + n + ' days' : bits.length ? ': ' + esc(bits.join(' · ')) : ' updated'));
    }
    return n;
  }
  /* habits can follow a number: "Exercise ≥ 30 min" ticks Training that day */
  function tickHabits() {
    var hb = readJSON('dash.habits', null); if (!hb || !hb.list) return;
    var D = days(), ch = false; hb.log = hb.log || {};
    hb.list.forEach(function (h) {
      if (!h.auto || !h.auto.m || !(+h.auto.min > 0)) return;
      Object.keys(D).forEach(function (k) {
        var v = D[k][h.auto.m]; if (v == null || v < +h.auto.min) return;
        var l = hb.log[k] = hb.log[k] || [];
        if (l.indexOf(h.id) < 0) { l.push(h.id); ch = true; }
      });
    });
    if (ch) { writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  }

  /* ---------- picking up what the Shortcut sent ---------- */
  function pull() {
    if (!window.Vault.get()) return;
    fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.items || !j.items.length) return;
      merge(j.items, 'server');
      return fetch(API, { method: 'DELETE', credentials: 'same-origin' });
    }).catch(function () {});
  }
  /* …or a link: ?health=1&steps=…&sleep=… */
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has('health')) return;
    var x = { date: q.get('date') || '' };
    F.forEach(function (f) { if (q.has(f)) x[f] = q.get(f); });
    ['health', 'date'].concat(F).forEach(function (f) { q.delete(f); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    var pend = readJSON('dash.healthPending', []); pend.push(x); try { localStorage.setItem('dash.healthPending', JSON.stringify(pend.slice(-30))); } catch (e) {}
  })();
  function pending() {
    var p = readJSON('dash.healthPending', []);
    if (!p.length) return;
    try { localStorage.removeItem('dash.healthPending'); } catch (e) {}
    merge(p, 'link');
  }
  window.Vault.onUnlock(function () { setTimeout(function () { pending(); pull(); }, 600); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && window.Vault.get()) pull(); });

  /* ---------- summaries other parts use ---------- */
  function stats(from, to) {
    var D = days(), out = { n: 0 };
    F.forEach(function (f) { out[f] = { sum: 0, n: 0 }; });
    Object.keys(D).forEach(function (k) {
      if (k < from || k > to) return; out.n++;
      F.forEach(function (f) { if (D[k][f] != null) { out[f].sum += D[k][f]; out[f].n++; } });
    });
    F.forEach(function (f) { out[f].avg = out[f].n ? out[f].sum / out[f].n : null; });
    return out;
  }
  function latest(f) { var D = days(), ks = Object.keys(D).sort().reverse(); for (var i = 0; i < ks.length; i++) if (D[ks[i]][f] != null) return { date: ks[i], v: D[ks[i]][f] }; return null; }

  /* ---------- the card on the Health page ---------- */
  var METRICS = [['steps', 'Steps', 'person-walking', '#22b35e'], ['sleep', 'Sleep', 'moon-stars', '#8a6fdf'], ['exercise', 'Exercise', 'activity', '#e8743b'], ['rhr', 'Resting HR', 'heart', '#e66767'], ['weight', 'Weight', 'speedometer', '#3987e5'], ['active', 'Active energy', 'fire', '#c98500']];
  var chartM = 'steps';
  function card() {
    var host = document.querySelector('.kit-grid'), box = $('ahCard');
    var onP = Fe ? Fe.on('ahealth') : true;
    if (!host || !/\/habits\//.test(location.pathname)) return;
    if (!box) { box = document.createElement('section'); box.className = 'card ah-card kit-wide'; box.id = 'ahCard'; host.insertBefore(box, host.firstChild); }
    box.hidden = !onP; if (!onP) return;
    var D = days(), keys = Object.keys(D).sort(), today = dkey(new Date());
    var head = '<div class="card-head"><h2><i class="bi bi-apple"></i> Apple Health</h2><a class="text-btn" href="../?settings=ahealth">' + (keys.length ? 'Settings' : 'Set up') + '</a></div>';
    if (!keys.length) { box.innerHTML = head + '<p class="muted ah-empty">Steps, sleep, resting heart rate and exercise from your iPhone – sent by a Shortcut every evening, kept encrypted with the rest. <a href="../?settings=ahealth">Set it up</a> (about 10 minutes, once).</p>'; return; }
    var w = stats(addDays(today, -6), today), pw = stats(addDays(today, -13), addDays(today, -7));
    var have = METRICS.filter(function (m) { return keys.some(function (k) { return D[k][m[0]] != null; }); });
    if (!have.some(function (m) { return m[0] === chartM; })) chartM = have[0] ? have[0][0] : 'steps';
    var tiles = have.slice(0, 6).map(function (m) {
      var l = latest(m[0]), a = w[m[0]].avg, pa = pw[m[0]].avg, diff = a != null && pa ? (a - pa) / pa : null;
      return '<button type="button" class="ah-tile' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + '</span>' +
        '<b>' + esc(l ? fmt(m[0], l.v) : '–') + '</b><small>' + (a != null ? '7-day avg ' + esc(fmt(m[0], a)) : '') +
        (diff != null && Math.abs(diff) >= .05 ? ' <span class="' + ((diff > 0) === (m[0] !== 'rhr' && m[0] !== 'weight') ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '−') + Math.round(Math.abs(diff) * 100) + '%</span>' : '') + '</small></button>';
    }).join('');
    /* the last 14 days of the chosen number */
    var vals = [], max = 0;
    for (var i = 13; i >= 0; i--) { var k = addDays(today, -i), v = D[k] ? D[k][chartM] : null; vals.push({ k: k, v: v }); if (v > max) max = v; }
    var goal = chartM === 'steps' ? 10000 : chartM === 'sleep' ? 7 : chartM === 'exercise' ? 30 : null;
    var bars = '<div class="ah-bars" role="img" aria-label="' + esc(LABEL[chartM]) + ', last 14 days">' + vals.map(function (x) {
      var hgt = x.v != null && max ? Math.max(4, x.v / Math.max(max, goal || 0) * 100) : 0, dd = new Date(x.k + 'T12:00');
      return '<span title="' + esc(dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + fmt(chartM, x.v)) + '"><i style="height:' + hgt.toFixed(1) + '%"' + (goal && x.v >= goal ? ' class="hit"' : '') + '></i><small>' + dd.toLocaleDateString('en-GB', { weekday: 'narrow' }) + '</small></span>';
    }).join('') + (goal ? '<em class="ah-goal" style="bottom:calc(' + (goal / Math.max(max, goal) * 100).toFixed(1) + '% * .82 + 18px)"></em>' : '') + '</div>';
    var lastT = (window.Vault.get().health || {}).last;
    box.innerHTML = head + '<div class="ah-tiles">' + tiles + '</div>' + bars +
      '<p class="muted ah-foot">' + esc(LABEL[chartM]) + ', last 14 days' + (goal ? ' · line: ' + fmt(chartM, goal) : '') + (lastT ? ' · updated ' + esc(new Date(lastT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '') + '</p>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-ahm]'); if (b) { chartM = b.dataset.ahm; card(); } });

  /* ---------- Settings → Apple Health ---------- */
  function settingsPage() {
    var box = $('ahSet'); if (!box) return;
    if ($('ahUrl')) $('ahUrl').textContent = location.origin + API;
    var hb = readJSON('dash.habits', { list: [] }), D = days(), n = Object.keys(D).length;
    $('ahStatus').textContent = n ? n + ' day' + (n === 1 ? '' : 's') + ' from Apple Health · last ' + new Date(((window.Vault.get() || {}).health || {}).last || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Nothing received yet';
    $('ahOn').checked = Fe ? Fe.on('ahealth') : true;
    $('ahHabits').innerHTML = (hb.list || []).length ? hb.list.map(function (h) {
      var a = h.auto || {};
      return '<div class="st-row ah-rule"><span class="st-label">' + esc(h.name) + '<small>Tick it automatically when…</small></span><span class="ah-rule-in">' +
        '<select data-ahrule="' + esc(h.id) + '" aria-label="Number for ' + esc(h.name) + '"><option value="">Never</option>' +
        [['steps', 'Steps ≥'], ['exercise', 'Exercise min ≥'], ['sleep', 'Sleep hours ≥'], ['active', 'Active kcal ≥'], ['distance', 'Km walked ≥']].map(function (o) { return '<option value="' + o[0] + '"' + (a.m === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select><input data-ahmin="' + esc(h.id) + '" inputmode="decimal" value="' + esc(a.min || '') + '" placeholder="' + (a.m === 'steps' ? '10000' : a.m === 'sleep' ? '7' : '30') + '" aria-label="Threshold"' + (a.m ? '' : ' disabled') + '></span></div>';
    }).join('') : '<p class="muted st-pad">Add a habit on the dashboard first.</p>';
  }
  function saveRule(id) {
    var hb = readJSON('dash.habits', null); if (!hb) return;
    var sel = document.querySelector('[data-ahrule="' + id + '"]'), inp = document.querySelector('[data-ahmin="' + id + '"]');
    hb.list.forEach(function (h) { if (h.id !== id) return; if (sel.value) h.auto = { m: sel.value, min: num(inp.value) || (sel.value === 'steps' ? 10000 : sel.value === 'sleep' ? 7 : 30) }; else delete h.auto; });
    writeJSON('dash.habits', hb); tickHabits(); settingsPage();
  }
  document.addEventListener('change', function (e) {
    var s = e.target.closest('[data-ahrule]'); if (s) { saveRule(s.dataset.ahrule); return; }
    var m = e.target.closest('[data-ahmin]'); if (m) { saveRule(m.dataset.ahmin); return; }
    if (e.target.id === 'ahOn' && Fe) { Fe.set('ahealth', e.target.checked); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#ahCopy')) { var t = location.origin + API; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('ahCopy').innerHTML = '<i class="bi bi-check-lg"></i> Copied'; }); else window.prompt('Copy', t); return; }
    if (e.target.closest('#ahClear')) {
      var dd = window.Vault.get(); if (dd && dd.health) { var keep = dd.health; delete dd.health; window.Vault.save(dd); window.dispatchEvent(new Event('health:change')); settingsPage(); card();
        if (window.Quick) window.Quick.toast('<i class="bi bi-trash3"></i> Apple Health data removed', function () { var x = window.Vault.get(); x.health = keep; window.Vault.save(x); window.dispatchEvent(new Event('health:change')); settingsPage(); card(); }); }
    }
  });

  window.Vault.onUnlock(function () { setTimeout(function () { card(); settingsPage(); }, 50); });
  ['health:change', 'features:change', 'habits:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(function () { card(); settingsPage(); }, 0); }); });
  window.AHealth = { days: days, stats: stats, latest: latest, fmt: fmt, merge: merge, pull: pull };
})();
} catch (e) { console.error("ahealth.js", e); }
/* ===== nav.js ===== */
try {
/* Page menu: a floating pill – at the bottom on phones, at the top on larger screens.
   The highlight slides to the page you tap, on every device (and from the last page on arrival). */
(function () {
  "use strict";
  var path = location.pathname.replace(/index\.html$/, '');
  var base = path.replace(/(finance|habits|travel|calendar|work)\/$/, '');          // the /cmd/ folder
  var page = (path.match(/(finance|habits|travel|calendar|work)\/$/) || [, 'home'])[1];
  var Fe = window.Features;
  /* The menu is written into every page (so it's there from the very first frame and the
     highlight can glide between pages). Here it only follows Settings → Features. */
  var SHOWS = { calendar: ['calendar'], travel: ['travel', 'bucket'], finance: ['finance', 'subs', 'warranty'], habits: ['healthpage'], work: ['work'] };
  var nav = document.getElementById('tabbar');
  function draw() {
    if (!Fe) return;
    Object.keys(SHOWS).forEach(function (k) { document.documentElement.classList.toggle('tab-off-' + k, !SHOWS[k].some(Fe.on)); });
  }
  draw();
  window.addEventListener('features:change', draw);
  document.documentElement.classList.add('has-tabbar');

  /* ---------- the highlight: one continuous slide to the page you tap ----------
     Browsers that animate between pages (Safari 18.2+, Chrome) move the highlight themselves,
     from the old tab to the new one, while the page changes (view-transition-name: tb-pill).
     Older browsers: it slides first, then the page changes. */
  var crossDoc = 'onpagereveal' in window || typeof window.PageRevealEvent === 'function';
  try { sessionStorage.removeItem('dash.tbFrom'); } catch (e) {}
  /* While pages swap, the menu is drawn solid: a frosted (blurred) background can't be carried
     through the animation and turned into a smear. */
  /* (the pagereveal listener that adds vt-active/vt-in lives in each page's head script) */
  /* Only one page change at a time: extra taps while a page is on its way are ignored
     (each tap used to start loading again, which made the change stutter). */
  var leaving = false;
  window.addEventListener('pageshow', function (e) {
    leaving = false;
    if (e.persisted) { document.documentElement.classList.remove('vt-active'); nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); }
  });
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-pg]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (leaving) { e.preventDefault(); return; }
    /* the page you're on: back to the top instead of loading it again */
    if (a.getAttribute('aria-current')) {
      e.preventDefault();
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: document.documentElement.classList.contains('mo-off') ? 'auto' : 'smooth' });
      return;
    }
    leaving = true;
    var off = document.documentElement.classList.contains('mo-off');
    if (crossDoc || off) { document.documentElement.classList.add('vt-active'); return; }   // the browser does the rest (the sliding highlight is the feedback)
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a); });
    e.preventDefault();
    var pill = nav.querySelector('.tb-pill'), cur = pill && pill.parentNode;
    if (pill) {
      pill.style.transform = 'translateX(' + (a.offsetLeft - cur.offsetLeft) + 'px)';
      pill.style.width = a.offsetWidth + 'px';
    }
    setTimeout(function () { location.href = a.href; }, 400);
  });

  /* Slide your finger along the menu: the highlight follows, let go to open that page */
  var drag = null;
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth; }); }
  function tabAt(x) { var l = tabs(); for (var i = 0; i < l.length; i++) { var r = l[i].getBoundingClientRect(); if (x < r.right) return l[i]; } return l[l.length - 1]; }
  nav.addEventListener('touchstart', function (e) {
    var t = e.touches[0], pill = nav.querySelector('.tb-pill');
    if (!pill || leaving) return;
    drag = { x0: t.clientX, moved: false, pill: pill, home: pill.parentNode, target: null };
  }, { passive: true });
  nav.addEventListener('touchmove', function (e) {
    if (!drag) return;
    var t = e.touches[0];
    if (!drag.moved && Math.abs(t.clientX - drag.x0) < 12) return;
    drag.moved = true;
    var a = tabAt(t.clientX), h = drag.home.getBoundingClientRect(), r = a.getBoundingClientRect();
    drag.pill.style.transition = 'transform .24s cubic-bezier(.45,0,.2,1), width .24s cubic-bezier(.45,0,.2,1)';
    drag.pill.style.transform = 'translateX(' + (r.left - h.left) + 'px)';
    drag.pill.style.width = r.width + 'px';
    nav.querySelectorAll('a').forEach(function (x) { x.classList.toggle('going', x === a && !a.getAttribute('aria-current')); });
    if (drag.target !== a && navigator.vibrate) navigator.vibrate(6);
    drag.target = a;
  }, { passive: true });
  nav.addEventListener('touchend', function (e) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) return;                       // a normal tap: the click does the rest
    e.preventDefault();
    var a = d.target;
    if (!a || a.getAttribute('aria-current') || leaving) { d.pill.style.transform = ''; d.pill.style.width = ''; nav.querySelectorAll('a.going').forEach(function (x) { x.classList.remove('going'); }); return; }
    leaving = true;
    document.documentElement.classList.add('vt-active');
    setTimeout(function () { location.href = a.href; }, 120);
  });
  nav.addEventListener('touchcancel', function () { if (drag) { drag.pill.style.transform = ''; drag.pill.style.width = ''; drag = null; } });

  nav.addEventListener('click', function (e) {
    var s = e.target.closest('[data-settings]');
    if (s && page === 'home' && document.getElementById('settingsBtn')) { e.preventDefault(); document.getElementById('settingsBtn').click(); }
  });
  /* Arriving from another page via "Settings": open the panel once unlocked */
  if (page === 'home' && /[?&]settings/.test(location.search) && window.Vault) {
    window.Vault.onUnlock(function () {
      var m = location.search.match(/[?&]settings=([a-z]+)/);
      history.replaceState(null, '', location.pathname);
      setTimeout(function () {
        var b = document.getElementById('settingsBtn'); if (b) b.click();
        if (m) setTimeout(function () { var g = document.querySelector('[data-go="' + m[1] + '"]'); if (g) g.click(); }, 80);
      }, 300);
    });
  }
})();
} catch (e) { console.error("nav.js", e); }
