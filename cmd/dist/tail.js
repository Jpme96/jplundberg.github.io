/* Built by cmd/build.py from: smart.js, search.js, app.js, quick.js, notify.js, ahealth.js, tilekit.js, pagekit.js, focus.js, keys.js, nav.js, life.js, life-pages.js, modern.js – edit those files, not this one. */
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
    var out = commands().filter(function (c) { return c.g === 'Commands'; });
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
  /* things to do, not find: shown when the box is empty, and found by name ("plan", "focus", "dark") */
  function commands() {
    var K = window.Keys || {}, Q = window.Quick, out = [];
    function cmd(i, t, s, k, run, x) { out.push({ g: 'Commands', i: i, t: t, s: s, k: k, run: run, h: '#', x: (x || '').toLowerCase(), d: '' }); }
    cmd('sunrise', 'Plan my day', 'Pick your top 3 and put them in the calendar', 'P', function () { K.plan ? K.plan() : (location.href = home + '#plan'); }, 'plan day top 3 schedule planlegg dagen');
    cmd('check2-square', 'New task', 'Add something to your to-do list', 'N', function () { K.newTask ? K.newTask() : Q && Q.open('todo'); }, 'todo task oppgave');
    if (Q) cmd('plus-lg', 'Quick add', 'Expense, event, workout, task or note', 'A', function () { Q.open(); }, 'add expense event note utgift');
    if (window.Focus) cmd('stopwatch', window.Focus.running() ? 'Pause or resume the focus timer' : 'Start a focus timer', '25 minutes on one task, then a break', 'F', function () { window.Focus.pick(); }, 'focus pomodoro timer fokus');
    (K.pages ? K.pages() : []).forEach(function (a, n) { var nm = (a.textContent || '').trim(); out.push({ g: 'Go to', i: (((a.querySelector('i.bi') || {}).className || '').match(/bi-([a-z0-9-]+)/) || [0, 'arrow-right'])[1], t: nm, s: '', k: String(n + 1), h: a.getAttribute('href'), x: 'go page ' + nm.toLowerCase(), d: '' }); });
    if (K.theme) cmd(document.documentElement.getAttribute('data-theme') === 'light' ? 'moon-stars' : 'sun', document.documentElement.getAttribute('data-theme') === 'light' ? 'Dark mode' : 'Light mode', 'Switch the look', 'D', K.theme, 'theme dark light mørk lys');
    cmd('lock', 'Lock now', 'Lock the dashboard on this device', 'L', function () { window.Vault.lock(); }, 'lock lås');
    if (K.help) cmd('keyboard', 'Keyboard shortcuts', 'All the keys', '?', K.help, 'keys shortcuts hurtigtaster');
    (window.CommandExtra || []).forEach(function (f) { try { f().forEach(function (c) { cmd(c.i, c.t, c.s, c.k || '', c.run, c.x); }); } catch (e) {} });
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
  var kbd = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function draw() {
    var q = input.value.trim();
    results = search(q);
    var ad = q ? addRow(q) : null;
    if (ad) { if (results.length) results.push(ad); else results = [ad]; }
    if (!q) results = commands();
    active = results.length ? 0 : -1;
    var hint = q ? '' : '<p class="sr-hint">Search everything – or type something to add: “149 rema”, “fre 18 middag”, “løp 5 km”.</p>';
    if (!results.length) { res.innerHTML = '<p class="sr-hint">Nothing found for “' + esc(q) + '”.</p>'; return; }
    var last = '', html = '';
    results.forEach(function (r, i) {
      if (r.g !== last) { html += '<p class="sr-g">' + esc(r.g) + '</p>'; last = r.g; }
      html += '<a class="sr-item' + (i === active ? ' on' : '') + '" data-i="' + i + '" href="' + esc(r.h) + '"' + (/^https?:/.test(r.h) && r.h.indexOf(location.host) < 0 ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<span class="sr-ic"><i class="bi bi-' + r.i + '"></i></span><span class="sr-x"><b>' + esc(r.t) + '</b>' + (r.s ? '<small>' + esc(r.s) + '</small>' : '') + '</span>' + (r.k && kbd ? '<kbd class="sr-k">' + esc(r.k) + '</kbd>' : '') + '</a>';
    });
    res.innerHTML = hint + html;
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
    if (a && results[+a.dataset.i] && results[+a.dataset.i].run) { e.preventDefault(); var fn = results[+a.dataset.i].run; close(); setTimeout(fn, 200); return; }
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

  /* shared from another app (Android share sheet → Dashboard): /cmd/?stitle=…&stext=…&surl=… opens a new task with it */
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has('stitle') && !q.has('stext') && !q.has('surl')) return;
    var u = (q.get('surl') || '').trim(), x = (q.get('stext') || '').trim(), ti = (q.get('stitle') || '').trim();
    if (!u) { var m = x.match(/https?:\/\/\S+/); if (m) { u = m[0]; x = x.replace(m[0], '').trim(); } }
    var text = [ti, x].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' – ') || u;
    if (u && text !== u) text += ' ' + u;
    ['stitle', 'stext', 'surl'].forEach(function (k) { q.delete(k); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    window.Vault.onUnlock(function () { setTimeout(function () { open('todo', { t: text.slice(0, 300) }, ''); }, 350); });
  })();

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
  var F = ['steps', 'sleep', 'exercise', 'active', 'stand', 'distance', 'flights', 'hr', 'rhr', 'hrv', 'vo2', 'weight', 'mindful', 'water', 'daylight'];
  var LABEL = { steps: 'Steps', sleep: 'Sleep', rhr: 'Resting heart rate', active: 'Active energy', exercise: 'Exercise', weight: 'Weight', distance: 'Walking + running', flights: 'Flights climbed',
    hr: 'Heart rate', stand: 'Stand hours', hrv: 'Heart rate variability', vo2: 'Cardio fitness', mindful: 'Mindfulness', water: 'Water', daylight: 'Time in daylight' };
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
  /* units differ between iPhones – metres or km, ml or litres */
  function norm(f, v) { if (v == null) return v; if (f === 'distance' && v > 300) return v / 1000; if (f === 'water' && v > 20) return v / 1000; return v; }
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function fmt(f, v) {
    if (v == null) return '–';
    if (f === 'sleep') return hm(v);
    if (f === 'rhr' || f === 'hr') return Math.round(v) + ' bpm';
    if (f === 'active') return nf.format(v) + ' kcal';
    if (f === 'exercise') return Math.round(v) + ' min';
    if (f === 'weight') return nf1.format(v) + ' kg';
    if (f === 'distance') return nf1.format(v) + ' km';
    if (f === 'stand') return Math.round(v) + ' h';
    if (f === 'hrv') return Math.round(v) + ' ms';
    if (f === 'vo2') return nf1.format(v);
    if (f === 'mindful' || f === 'daylight') return Math.round(v) + ' min';
    if (f === 'water') return nf1.format(v) + ' l';
    if (f === 'flights') return Math.round(v) + ' floors';
    return nf.format(v);
  }

  /* 0 h sleep, 0 bpm or 0 kg means the Shortcut found nothing – treat it as no number, not a real one */
  var ZERO_IS_EMPTY = { sleep: 1, hr: 1, rhr: 1, weight: 1, hrv: 1, vo2: 1 };
  function days() {
    var d = window.Vault.get() || {}, D = (d.health && d.health.days) || {}, out = {};
    Object.keys(D).forEach(function (k) { var x = {}; Object.keys(D[k]).forEach(function (f) { if (!(ZERO_IS_EMPTY[f] && D[k][f] === 0)) x[f] = D[k][f]; }); out[k] = x; });
    return out;
  }
  /* put days in the vault, tick habits that follow a number, tell the rest of the dashboard */
  function merge(list, source) {
    var d = window.Vault.get(); if (!d || !list.length) return 0;
    d.health = d.health || {}; d.health.days = d.health.days || {};
    var n = 0;
    list.forEach(function (x) {
      var k = /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) ? String(x.date).slice(0, 10) : dkey(new Date());
      var cur = d.health.days[k] || {}, ch = false;
      F.forEach(function (f) { var v = f === 'sleep' ? hours(x[f]) : norm(f, num(x[f])); if (v === 0 && ZERO_IS_EMPTY[f]) v = null; if (v != null) { cur[f] = Math.round(v * 100) / 100; ch = true; } });
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
      if (hours(last.sleep)) bits.push(fmt('sleep', hours(last.sleep)) + ' sleep');
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
  var METRICS = [['steps', 'Steps', 'person-walking', '#22b35e'], ['sleep', 'Sleep', 'moon-stars', '#8a6fdf'], ['exercise', 'Exercise', 'activity', '#e8743b'],
    ['active', 'Energy', 'fire', '#c98500'], ['stand', 'Stand', 'person-standing', '#2aa7c9'], ['distance', 'Distance', 'signpost-split', '#3fa36b'], ['flights', 'Flights', 'bar-chart-steps', '#9b7b4f'],
    ['hr', 'Heart rate', 'heart-pulse-fill', '#e0475b'], ['rhr', 'Resting HR', 'heart', '#e66767'], ['hrv', 'HRV', 'heart-pulse', '#d0568f'], ['vo2', 'Fitness', 'lungs', '#e0577a'], ['weight', 'Weight', 'speedometer', '#3987e5'],
    ['mindful', 'Mindful', 'flower1', '#5bb5a2'], ['water', 'Water', 'droplet', '#3b9de0'], ['daylight', 'Daylight', 'sun', '#d9a400']];
  /* lower is better for these */
  var LOWER = { rhr: 1, weight: 1 };
  /* no better or worse direction: the change is shown without colour */
  var NEUTRAL = { hr: 1 };
  var chartM = 'steps', range = 14, selDay = null, editGoal = false, editLayout = false, dayOpen = false, stackIdx = 0;
  /* which numbers are main tiles, which sit in the swipeable stack and which are hidden – per person, synced */
  function layout(have) {
    var L = (readJSON('dash.settings', {}) || {}).ahLayout || {}, where = L.where || {}, order = L.order || [];
    var keys = have.map(function (m) { return m[0]; });
    keys.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 + keys.indexOf(a) : ia) - (ib < 0 ? 99 + keys.indexOf(b) : ib); });
    var out = { tile: [], stack: [], off: [], order: keys }, nTile = 0;
    keys.forEach(function (k) { var w = where[k] || (nTile < 4 ? 'tile' : 'stack'); if (!where[k] && w === 'tile') nTile++; out[w].push(k); });
    return out;
  }
  function saveLayout(fn) { var st = readJSON('dash.settings', {}) || {}; st.ahLayout = st.ahLayout || {}; fn(st.ahLayout); writeJSON('dash.settings', st); }
  try { range = +localStorage.getItem('dash.ahRange') || 14; } catch (e) {}
  /* goals: the dashed line, the tile progress and "Goal reached" – change them on the card */
  var GOAL_DEF = { steps: 10000, sleep: 7, exercise: 30, active: 500, stand: 12, distance: 5, flights: 10, mindful: 10, water: 2, daylight: 30 };
  var GOALABLE = { weight: 1, rhr: 1, hrv: 1, vo2: 1 };          // no default goal, but one can be set
  function reached(m, v, g) { return g != null && v != null && (LOWER[m] ? v <= g : v >= g); }
  /* chart kind: a line shows a trend (weight going down), bars show daily totals */
  var LINE_DEF = { weight: 1, rhr: 1, hrv: 1, vo2: 1, hr: 1 };
  function chartKind(m) { var c = ((readJSON('dash.settings', {}) || {}).ahChart || {})[m]; return c || (LINE_DEF[m] ? 'line' : 'bars'); }
  function goals() { var g = (readJSON('dash.settings', {}) || {}).ahGoals || {}, out = {}; Object.keys(GOAL_DEF).concat(Object.keys(g)).forEach(function (k) { out[k] = g[k] != null ? g[k] : GOAL_DEF[k]; }); return out; }
  function setGoal(m, v) { var st = readJSON('dash.settings', {}) || {}; st.ahGoals = st.ahGoals || {}; if (v) st.ahGoals[m] = v; else delete st.ahGoals[m]; writeJSON('dash.settings', st); }
  function dayName(k, today) {
    if (k === today) return 'Today';
    if (k === addDays(today, -1)) return 'Yesterday';
    return new Date(k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }
  function card() {
    var host = document.querySelector('.kit-grid'), box = $('ahCard');
    var onP = Fe ? Fe.on('ahealth') : true;
    if (!host || !/\/habits\//.test(location.pathname)) return;
    if (!box) { box = document.createElement('section'); box.className = 'card ah-card kit-wide'; box.id = 'ahCard'; host.insertBefore(box, host.firstChild); }
    box.hidden = !onP; if (!onP) return;
    var D = days(), keys = Object.keys(D).sort(), today = dkey(new Date()), G = goals();
    var head = '<div class="card-head"><h2><i class="bi bi-apple"></i> Apple Health</h2><span class="ah-head-btns">' + (keys.length ? '<button type="button" class="text-btn" data-ahlayout aria-pressed="' + editLayout + '"><i class="bi bi-grid-1x2"></i> ' + (editLayout ? 'Done' : 'Customize') + '</button>' : '') + '<a class="text-btn" href="../?settings=ahealth">' + (keys.length ? 'Settings' : 'Set up') + '</a></span></div>';
    if (!keys.length) { box.innerHTML = head + '<p class="muted ah-empty">Steps, sleep, resting heart rate and exercise from your iPhone – sent by a Shortcut every evening, kept encrypted with the rest. <a href="../?settings=ahealth">Set it up</a> (about 10 minutes, once).</p>'; return; }
    var w = stats(addDays(today, -6), today), pw = stats(addDays(today, -13), addDays(today, -7));
    var have = METRICS.filter(function (m) { return keys.some(function (k) { return D[k][m[0]] != null; }); });
    if (!have.some(function (m) { return m[0] === chartM; })) chartM = have[0] ? have[0][0] : 'steps';
    var M = METRICS.filter(function (m) { return m[0] === chartM; })[0], goal = G[chartM] || null;

    /* tiles: latest number, progress to the goal, 7-day average and the change from the week before */
    var LY = layout(have), byKey = {}; have.forEach(function (m) { byKey[m[0]] = m; });
    var visible = LY.tile.concat(LY.stack);
    if (visible.length && visible.indexOf(chartM) < 0) { chartM = visible[0]; M = byKey[chartM]; goal = G[chartM] || null; }
    var tileOf = function (m) {
      var l = latest(m[0]), a = w[m[0]].avg, pa = pw[m[0]].avg, diff = a != null && pa ? (a - pa) / pa : null, g = G[m[0]];
      var pct = g && l ? Math.min(100, (LOWER[m[0]] ? g / l.v : l.v / g) * 100) : null;
      return '<button type="button" class="ah-tile' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" aria-pressed="' + (m[0] === chartM) + '" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + (l && l.date !== today ? ' <em>· ' + esc(l.date === addDays(today, -1) ? 'yesterday' : new Date(l.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</em>' : '') + '</span>' +
        '<b>' + esc(l ? fmt(m[0], l.v) : '–') + '</b>' +
        (pct != null ? '<span class="ah-prog' + (pct >= 100 ? ' full' : '') + '" title="' + Math.round(pct) + '% of ' + esc(fmt(m[0], g)) + '"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '') +
        '<small>' + (a != null ? '7-day avg ' + esc(fmt(m[0], a)) : '') +
        (diff != null && Math.abs(diff) >= .05 ? ' <span class="' + (NEUTRAL[m[0]] ? 'nt' : (diff > 0) === !LOWER[m[0]] ? 'up' : 'dn') + '">' + (diff > 0 ? '+' : '−') + Math.round(Math.abs(diff) * 100) + '%</span>' : '') + '</small></button>';
    };
    var tiles = LY.tile.map(function (k) { return tileOf(byKey[k]); }).join('');
    if (LY.stack.length) {
      var si = LY.stack.indexOf(chartM); if (si >= 0) stackIdx = si; if (stackIdx >= LY.stack.length) stackIdx = 0;
      tiles += '<div class="ah-stack" role="group" aria-label="More numbers – swipe">' +
        '<div class="ah-stack-track" id="ahStack">' + LY.stack.map(function (k) { return tileOf(byKey[k]); }).join('') + '</div>' +
        (LY.stack.length > 1 ? '<div class="ah-dots">' + LY.stack.map(function (k, i) { return '<button type="button" data-ahdot="' + i + '" aria-label="' + esc(byKey[k][1]) + '"' + (i === stackIdx ? ' class="on"' : '') + ' style="--c:' + byKey[k][3] + '"></button>'; }).join('') + '</div>' : '') + '</div>';
    }
    /* customize: tile / stack / hidden, and the order */
    if (editLayout) {
      tiles = '<div class="ah-edit"><p class="muted">Main tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.</p>' + LY.order.map(function (k, i) {
        var m = byKey[k], wv = LY.tile.indexOf(k) >= 0 ? 'tile' : LY.stack.indexOf(k) >= 0 ? 'stack' : 'off';
        return '<div class="ah-edit-row" style="--c:' + m[3] + '"><span class="ah-l"><i class="bi bi-' + m[2] + '"></i> ' + m[1] + '</span>' +
          '<span class="seg" role="group" aria-label="' + esc(m[1]) + '">' + [['tile', 'Tile'], ['stack', 'Stack'], ['off', 'Hide']].map(function (o) { return '<button type="button" data-ahwhere="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (wv === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</span>' +
          '<span class="ah-edit-mv"><button type="button" class="icon-btn" data-ahmove="' + k + '" data-d="-1" aria-label="Move ' + esc(m[1]) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button><button type="button" class="icon-btn" data-ahmove="' + k + '" data-d="1" aria-label="Move ' + esc(m[1]) + ' down"' + (i < LY.order.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('') + '<div class="ah-edit-foot"><button type="button" class="text-btn" data-ahlayreset>Reset</button><button type="button" class="pill-btn" data-ahlayout>Done</button></div></div>';
    }

    /* the chart: 7, 14 or 30 days; tap a bar to see that day */
    var vals = [], max = 0;
    for (var i = range - 1; i >= 0; i--) { var k = addDays(today, -i), v = D[k] ? D[k][chartM] : null; if (v == null) v = null; vals.push({ k: k, v: v }); if (v > max) max = v; }
    var withData = vals.filter(function (x) { return x.v != null; });
    if (!selDay || selDay < vals[0].k || selDay > today) selDay = withData.length ? withData[withData.length - 1].k : today;
    var kind = chartKind(chartM), min = Infinity;
    withData.forEach(function (x) { if (x.v < min) min = x.v; });
    var bot = 0, top = Math.max(max, goal || 0) * 1.08 || 1;
    if (kind === 'line' && withData.length) {        // a line zooms in on the range, so small changes show
      var lo = Math.min(min, goal != null ? goal : min), hi = Math.max(max, goal != null ? goal : max), pad = Math.max((hi - lo) * .2, Math.abs(hi) * .01, .5);
      bot = lo - pad; top = hi + pad;
    }
    var yOf = function (v) { return (v - bot) / (top - bot) * 100; };
    var ctl = '<div class="ah-ctl"><span class="seg ah-kind" role="group" aria-label="Chart type"><button type="button" data-ahkind="bars" aria-pressed="' + (kind === 'bars') + '" aria-label="Bars"><i class="bi bi-bar-chart-fill"></i></button><button type="button" data-ahkind="line" aria-pressed="' + (kind === 'line') + '" aria-label="Line"><i class="bi bi-graph-up"></i></button></span><span class="seg ah-range" role="group" aria-label="Days shown">' + [7, 14, 30].map(function (n) { return '<button type="button" data-ahrange="' + n + '" aria-pressed="' + (n === range) + '">' + n + ' days</button>'; }).join('') + '</span></div>';
    var line = '';
    if (kind === 'line' && withData.length) {
      var pts = vals.map(function (x, i) { return x.v == null ? null : [((i + .5) / range * 100).toFixed(2), (100 - yOf(x.v)).toFixed(2)]; }).filter(Boolean);
      var poly = pts.map(function (q) { return q.join(','); }).join(' ');
      line = '<svg class="ah-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        (pts.length > 1 ? '<polygon points="' + pts[0][0] + ',100 ' + poly + ' ' + pts[pts.length - 1][0] + ',100" /><polyline points="' + poly + '" />' : '') + '</svg>';
      /* the highest and lowest value as a scale, since the line doesn't start at zero */
      if (max > min) line += [max, min].map(function (v) { return '<span class="ah-yl" style="bottom:calc(18px + (100% - 18px) * ' + (yOf(v) / 100).toFixed(3) + ')">' + esc(fmt(chartM, v)) + '</span>'; }).join('');
    }
    var bars = '<div class="ah-chart" style="--c:' + M[3] + '"><div class="ah-bars r' + range + (kind === 'line' ? ' line' : '') + '" role="group" aria-label="' + esc(LABEL[chartM]) + ', last ' + range + ' days">' + vals.map(function (x, idx) {
      var dd = new Date(x.k + 'T12:00'), hgt = x.v != null ? Math.max(3, yOf(x.v)) : 0;
      var lab = range === 30 ? (idx % 5 === 4 || x.k === today ? String(dd.getDate()) : '') : dd.toLocaleDateString('en-GB', { weekday: range === 7 ? 'short' : 'narrow' });
      return '<button type="button" class="ah-bar' + (x.v == null ? ' none' : '') + (reached(chartM, x.v, goal) ? ' hit' : '') + (x.k === selDay ? ' sel' : '') + (x.k === today ? ' today' : '') + '" data-ahday="' + x.k + '" aria-pressed="' + (x.k === selDay) + '" aria-label="' + esc(dayName(x.k, today) + ': ' + (x.v == null ? 'no data' : fmt(chartM, x.v))) + '"><span class="ah-col"><i style="height:' + hgt.toFixed(1) + '%"></i>' + (kind === 'line' && x.v != null ? '<b class="ah-pt" style="bottom:' + yOf(x.v).toFixed(1) + '%"></b>' : '') + '</span><small>' + esc(lab) + '</small></button>';
    }).join('') + line + (goal ? '<em class="ah-goal" style="bottom:calc(18px + (100% - 18px) * ' + (yOf(goal) / 100).toFixed(3) + ')"><span>' + esc(fmt(chartM, goal)) + '</span></em>' : '') + '</div></div>';

    /* the chosen day: every number from it, the goal and what it ticked */
    var day = D[selDay] || {}, hb = readJSON('dash.habits', { list: [] }), sv = day[chartM];
    var chips = visible.map(function (k) { return byKey[k]; }).map(function (m) { return day[m[0]] != null && m[0] !== chartM ? '<button type="button" class="ah-chip' + (m[0] === chartM ? ' on' : '') + '" data-ahm="' + m[0] + '" style="--c:' + m[3] + '"><i class="bi bi-' + m[2] + '"></i> ' + esc(fmt(m[0], day[m[0]])) + '</button>' : ''; }).join('');
    var status = '';
    if (sv != null && goal) status = reached(chartM, sv, goal) ? '<span class="ah-ok"><i class="bi bi-check-circle-fill"></i> Goal reached</span>' : '<span class="ah-left">' + esc(fmt(chartM, Math.abs(goal - sv))) + ' ' + (LOWER[chartM] ? 'above the goal' : selDay === today && chartM !== 'sleep' ? 'to go' : 'short of the goal') + '</span>';
    var ticks = (hb.list || []).filter(function (h) { return h.auto && day[h.auto.m] != null && (h.auto.m === 'sleep' ? day.sleep : day[h.auto.m]) >= h.auto.min; }).map(function (h) { return '<span class="ah-tick"><i class="bi bi-check2"></i> ' + esc(h.name) + ' ticked</span>'; }).join('');
    var di = vals.map(function (x) { return x.k; }).indexOf(selDay);
    var nOther = visible.filter(function (k) { return k !== chartM && day[k] != null; }).length;
    var dayBox = '<div class="ah-day" style="--c:' + M[3] + '"><div class="ah-day-h"><button type="button" class="icon-btn" data-ahstep="-1" aria-label="Day before"' + (di <= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button><b>' + esc(dayName(selDay, today)) + '</b><button type="button" class="icon-btn" data-ahstep="1" aria-label="Day after"' + (di >= vals.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' +
      '<span class="ah-dv"><i class="bi bi-' + M[2] + '"></i> ' + esc(sv != null ? fmt(chartM, sv) : '–') + '</span></div>' +
      (status || ticks ? '<div class="ah-day-s">' + status + (ticks ? '<span class="ah-ticks">' + ticks + '</span>' : '') + '</div>' : '') +
      (nOther ? '<details class="ah-more"' + (dayOpen ? ' open' : '') + '><summary>All numbers this day (' + nOther + ')</summary><div class="ah-chips">' + chips + '</div></details>' : (sv == null && !nOther ? '<p class="muted ah-nodata">Nothing from Apple Health this day.</p>' : '')) + '</div>';

    /* a line that says something about the period */
    var ins = [];
    if (withData.length) {
      var avg = withData.reduce(function (t, x) { return t + x.v; }, 0) / withData.length;
      var best = withData.reduce(function (b2, x) { return LOWER[chartM] ? (x.v < b2.v ? x : b2) : (x.v > b2.v ? x : b2); });
      if (goal) ins.push('Goal reached ' + withData.filter(function (x) { return reached(chartM, x.v, goal); }).length + ' of ' + withData.length + ' day' + (withData.length === 1 ? '' : 's'));
      if (kind === 'line' && withData.length > 1) {
        var ch = withData[withData.length - 1].v - withData[0].v;
        ins.push(Math.abs(ch) < 1e-9 ? 'no change in ' + range + ' days' : (ch > 0 ? 'up ' : 'down ') + fmt(chartM, Math.abs(ch)) + ' in ' + range + ' days');
      }
      ins.push('average ' + fmt(chartM, avg));
      if (withData.length > 1) ins.push((LOWER[chartM] ? 'lowest ' : 'best ') + new Date(best.k + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) + ' ' + fmt(chartM, best.v));
    }
    var short = keys.length < range ? '<p class="muted ah-grow"><i class="bi bi-hourglass-split"></i> History builds up by itself – one more day every evening (since ' + esc(new Date(keys[0] + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ').</p>' : '';
    var lastT = (window.Vault.get().health || {}).last;
    var goalCtl = GOAL_DEF[chartM] != null || GOALABLE[chartM] ? (editGoal ? '<span class="ah-goaledit">Goal <input id="ahGoalIn" inputmode="decimal" value="' + esc(goal == null ? '' : goal) + '" aria-label="Goal for ' + esc(LABEL[chartM]) + '">' + ({ weight: ' kg', rhr: ' bpm', hrv: ' ms', sleep: ' h', exercise: ' min', active: ' kcal', stand: ' h', distance: ' km', mindful: ' min', water: ' l', daylight: ' min', flights: ' floors' }[chartM] || '') + ' <button type="button" class="text-btn" data-ahgoalsave>Save</button></span>' : '<button type="button" class="text-btn ah-goalbtn" data-ahgoal><i class="bi bi-flag"></i> Goal ' + esc(fmt(chartM, goal)) + '</button>') : '';
    box.innerHTML = head + '<div class="ah-tiles' + (editLayout ? ' editing' : '') + '">' + tiles + '</div>' + ctl + bars + dayBox +
      (ins.length ? '<p class="ah-ins">' + esc(ins.join(' · ')) + '</p>' : '') + short +
      '<div class="ah-foot muted"><span>' + (lastT ? 'Updated ' + esc(new Date(lastT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '') + '</span>' + goalCtl + '</div>';
    if (editGoal && $('ahGoalIn')) { $('ahGoalIn').focus(); $('ahGoalIn').select(); }
    var tr = $('ahStack');
    if (tr) {
      tr.scrollLeft = stackIdx * tr.clientWidth;
      tr.addEventListener('scroll', function () {
        var n = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (n === stackIdx) return; stackIdx = n;
        box.querySelectorAll('[data-ahdot]').forEach(function (d, i) { d.classList.toggle('on', i === n); });
      }, { passive: true });
    }
    var det = box.querySelector('.ah-more'); if (det) det.addEventListener('toggle', function () { dayOpen = det.open; });
  }
  function saveGoal() { var v = num(($('ahGoalIn') || {}).value); setGoal(chartM, v && v > 0 ? v : null); editGoal = false; card(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ahm]'); if (b) { chartM = b.dataset.ahm; editGoal = false; card(); return; }
    var r = e.target.closest('[data-ahrange]'); if (r) { range = +r.dataset.ahrange; try { localStorage.setItem('dash.ahRange', range); } catch (x) {} card(); return; }
    var d = e.target.closest('[data-ahday]'); if (d) { selDay = d.dataset.ahday; card(); var nb = document.querySelector('[data-ahday="' + selDay + '"]'); if (nb) nb.focus(); return; }
    var st = e.target.closest('[data-ahstep]'); if (st) { selDay = addDays(selDay, +st.dataset.ahstep); card(); var nb2 = document.querySelector('[data-ahstep="' + st.dataset.ahstep + '"]'); if (nb2 && !nb2.disabled) nb2.focus(); return; }
    if (e.target.closest('[data-ahgoal]')) { editGoal = true; card(); return; }
    var dt = e.target.closest('[data-ahdot]'); if (dt) { stackIdx = +dt.dataset.ahdot; var t = $('ahStack'); if (t) t.scrollTo({ left: stackIdx * t.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    var kd = e.target.closest('[data-ahkind]'); if (kd) { var st = readJSON('dash.settings', {}) || {}; st.ahChart = st.ahChart || {}; st.ahChart[chartM] = kd.dataset.ahkind; writeJSON('dash.settings', st); card(); return; }
    if (e.target.closest('[data-ahlayout]')) { editLayout = !editLayout; card(); return; }
    if (e.target.closest('[data-ahlayreset]')) { saveLayout(function (L) { delete L.where; delete L.order; }); card(); return; }
    var wh = e.target.closest('[data-ahwhere]'); if (wh) { saveLayout(function (L) { L.where = L.where || {}; L.where[wh.dataset.ahwhere] = wh.dataset.v; }); card(); return; }
    var mv = e.target.closest('[data-ahmove]'); if (mv) { var D0 = days(), ks = Object.keys(D0), hv = METRICS.filter(function (m) { return ks.some(function (k) { return D0[k][m[0]] != null; }); }), ord = layout(hv).order, ix = ord.indexOf(mv.dataset.ahmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return; ord.splice(to, 0, ord.splice(ix, 1)[0]); saveLayout(function (L) { L.order = ord; }); card(); var b2 = document.querySelector('[data-ahmove="' + mv.dataset.ahmove + '"][data-d="' + mv.dataset.d + '"]'); if (b2 && !b2.disabled) b2.focus(); return; }
    if (e.target.closest('[data-ahgoalsave]')) { saveGoal(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'ahGoalIn') { if (e.key === 'Enter') { e.preventDefault(); saveGoal(); } else if (e.key === 'Escape') { editGoal = false; card(); } return; }
    var d = e.target.closest && e.target.closest('[data-ahday]'); if (!d || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); var n = addDays(d.dataset.ahday, e.key === 'ArrowLeft' ? -1 : 1), t = document.querySelector('[data-ahday="' + n + '"]');
    if (t) { selDay = n; card(); document.querySelector('[data-ahday="' + n + '"]').focus(); }
  });

  /* ---------- Settings → Apple Health ---------- */
  function settingsPage() {
    var box = $('ahSet'); if (!box) return;
    if ($('ahUrl')) $('ahUrl').textContent = location.origin + API;
    var hb = readJSON('dash.habits', { list: [] }), D = days(), n = Object.keys(D).length;
    $('ahStatus').textContent = n ? n + ' day' + (n === 1 ? '' : 's') + ' from Apple Health · last ' + new Date(((window.Vault.get() || {}).health || {}).last || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Nothing received yet';
    $('ahOn').checked = Fe ? Fe.on('ahealth') : true;
    if ($('ahSetup') && !settingsPage.done) { $('ahSetup').open = !n; settingsPage.done = true; }   // set-up open until numbers arrive
    $('ahHabits').innerHTML = (hb.list || []).length ? hb.list.map(function (h) {
      var a = h.auto || {};
      return '<div class="st-row ah-rule"><span class="st-label">' + esc(h.name) + '<small>Tick it automatically when…</small></span><span class="ah-rule-in">' +
        '<select data-ahrule="' + esc(h.id) + '" aria-label="Number for ' + esc(h.name) + '"><option value="">Never</option>' +
        [['steps', 'Steps ≥'], ['exercise', 'Exercise min ≥'], ['sleep', 'Sleep hours ≥'], ['active', 'Active kcal ≥'], ['stand', 'Stand hours ≥'], ['distance', 'Km walked ≥'], ['flights', 'Floors ≥'], ['mindful', 'Mindful min ≥'], ['water', 'Water litres ≥'], ['daylight', 'Daylight min ≥']].map(function (o) { return '<option value="' + o[0] + '"' + (a.m === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
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
/* ===== tilekit.js ===== */
try {
/* Customize any group of number tiles – the key numbers at the top of Finances, Health and Travel,
   and the tiles in Training, Flex time, Subscriptions and the other cards.

   Each tile can be a Tile (always shown), go into the Stack (one tile you swipe through, like an
   iPhone widget) or be hidden, and the order can be changed. Nothing changes until you customize.
   Stored per group in dash.settings.tiles, so it follows you to every device.

   Works on whatever the page draws: a tile needs data-tk (its key) and its group is the container's
   id or the card's data-tool. The Apple Health card has its own, richer version (ahealth.js). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var SEL = '.fp-tiles, .kit-tiles', TILE = '.fp-tile[data-tk], .kit-tile[data-tk]';
  var editing = {};                 // group → true while its editor is open
  var stackAt = {};                 // group → which stacked tile is showing
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function groupOf(box) {
    if (box.id) return box.id;
    var t = box.closest('[data-tool]'); return t ? 'tool:' + t.dataset.tool : null;
  }
  function conf(g) { return ((readJSON('dash.settings', {}) || {}).tiles || {})[g] || {}; }
  function save(g, fn) {
    var st = readJSON('dash.settings', {}) || {}; st.tiles = st.tiles || {};
    var c = st.tiles[g] || {}; fn(c);
    if (!c.order && !c.where) delete st.tiles[g]; else st.tiles[g] = c;
    writeJSON('dash.settings', st);
  }
  /* a key that stays the same next month and next year ("Income in Oct" → "Income in M") */
  var MON = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/gi;
  function key(t) { return (t.dataset.tk || '').replace(MON, 'M'); }
  function tilesIn(box) { return Array.prototype.slice.call(box.querySelectorAll(TILE)); }
  function labelOf(t) { var l = t.querySelector('.lbl, :scope > span'); return (l ? l.textContent : key(t)).trim(); }

  /* put the tiles in order, move some into the stack, hide the rest */
  function apply(box) {
    var g = groupOf(box); if (!g) return;
    var tiles = tilesIn(box); if (!tiles.length) return;
    tiles.forEach(function (t) { t.dataset.tkd = '1'; });
    var c = conf(g), where = c.where || {}, order = c.order || [];
    var plain = !c.order && !c.where;
    var old = box.querySelector(':scope > .tk-stack'); if (old) { tilesIn(old).forEach(function (t) { box.appendChild(t); }); old.remove(); }
    tiles.sort(function (a, b) {
      var ia = order.indexOf(key(a)), ib = order.indexOf(key(b)), na = tiles.indexOf(a), nb = tiles.indexOf(b);
      return (ia < 0 ? 99 + na : ia) - (ib < 0 ? 99 + nb : ib);
    });
    var stacked = [];
    tiles.forEach(function (t) {
      var w = where[key(t)] || 'tile';
      t.hidden = w === 'off';
      if (w === 'stack') stacked.push(t); else if (!plain) box.appendChild(t);
    });
    var bar = box.parentNode && box.nextElementSibling && box.nextElementSibling.classList.contains('tk-bar') ? box.nextElementSibling : null;
    if (stacked.length) {
      var s = document.createElement('div'); s.className = 'tk-stack'; s.setAttribute('role', 'group'); s.setAttribute('aria-label', 'More numbers – swipe');
      var tr = document.createElement('div'); tr.className = 'tk-track'; s.appendChild(tr);
      stacked.forEach(function (t) { tr.appendChild(t); });
      if (stacked.length > 1) {
        var dots = document.createElement('div'); dots.className = 'tk-dots';
        dots.innerHTML = stacked.map(function (t, i) { return '<button type="button" data-tkdot="' + i + '" aria-label="' + esc(labelOf(t)) + '"></button>'; }).join('');
        s.appendChild(dots);
      }
      box.appendChild(s);
      var at = Math.min(stackAt[g] || 0, stacked.length - 1);
      var mark = function (n) { s.querySelectorAll('[data-tkdot]').forEach(function (d, i) { d.classList.toggle('on', i === n); }); };
      mark(at); requestAnimationFrame(function () { tr.scrollLeft = at * tr.clientWidth; });
      tr.addEventListener('scroll', function () { var n = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (n !== stackAt[g]) { stackAt[g] = n; mark(n); } }, { passive: true });
    }
    box.classList.toggle('tk-has-stack', stacked.length > 0);
    /* the Customize button under the group, and the editor when it is open */
    if (!bar) { bar = document.createElement('div'); bar.className = 'tk-bar'; box.parentNode.insertBefore(bar, box.nextSibling); }
    bar.dataset.tkg = g;
    if (!editing[g]) {
      bar.innerHTML = '<button type="button" class="text-btn tk-edit" data-tkedit="' + esc(g) + '"><i class="bi bi-grid-1x2"></i> Customize</button>';
      box.hidden = false; return;
    }
    var all = tilesIn(box);
    box.hidden = true;
    bar.innerHTML = '<div class="tk-editor"><p class="muted">Tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.</p>' +
      all.map(function (t, i) {
        var k = key(t), w = where[k] || 'tile';
        return '<div class="tk-row"><span class="tk-name">' + esc(labelOf(t)) + '</span><span class="seg" role="group" aria-label="' + esc(labelOf(t)) + '">' +
          [['tile', 'Tile'], ['stack', 'Stack'], ['off', 'Hide']].map(function (o) { return '<button type="button" data-tkwhere="' + esc(k) + '" data-v="' + o[0] + '" aria-pressed="' + (w === o[0]) + '">' + o[1] + '</button>'; }).join('') +
          '</span><span class="tk-mv"><button type="button" class="icon-btn" data-tkmove="' + esc(k) + '" data-d="-1" aria-label="Move ' + esc(labelOf(t)) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
          '<button type="button" class="icon-btn" data-tkmove="' + esc(k) + '" data-d="1" aria-label="Move ' + esc(labelOf(t)) + ' down"' + (i < all.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('') +
      '<div class="tk-foot"><button type="button" class="text-btn" data-tkreset="' + esc(g) + '">Reset</button><button type="button" class="pill-btn" data-tkedit="' + esc(g) + '">Done</button></div></div>';
  }
  function boxOf(g) {
    var b = null; document.querySelectorAll(SEL).forEach(function (x) { if (groupOf(x) === g) b = x; }); return b;
  }
  function again(g) { var b = boxOf(g); if (b) apply(b); }

  /* draw on whatever appears or is redrawn */
  var queued = false;
  function scan() {
    queued = false;
    document.querySelectorAll(SEL).forEach(function (box) {
      if (tilesIn(box).some(function (t) { return !t.dataset.tkd; })) apply(box);
    });
  }
  new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(scan); } }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-tkedit]');
    if (ed) { var g = ed.dataset.tkedit; editing[g] = !editing[g]; again(g); var nb = document.querySelector('.tk-bar[data-tkg="' + g + '"] button'); if (nb) nb.focus(); return; }
    var wh = e.target.closest('[data-tkwhere]');
    if (wh) { var g2 = wh.closest('.tk-bar').dataset.tkg; save(g2, function (c) { c.where = c.where || {}; if (wh.dataset.v === 'tile') delete c.where[wh.dataset.tkwhere]; else c.where[wh.dataset.tkwhere] = wh.dataset.v; if (!Object.keys(c.where).length) delete c.where; }); again(g2); return; }
    var mv = e.target.closest('[data-tkmove]');
    if (mv) {
      var g3 = mv.closest('.tk-bar').dataset.tkg, box = boxOf(g3); if (!box) return;
      var ord = tilesIn(box).map(function (t) { return key(t); }), ix = ord.indexOf(mv.dataset.tkmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return;
      ord.splice(to, 0, ord.splice(ix, 1)[0]); save(g3, function (c) { c.order = ord; }); again(g3);
      var b2 = document.querySelector('.tk-bar[data-tkg="' + g3 + '"] [data-tkmove="' + mv.dataset.tkmove + '"][data-d="' + mv.dataset.d + '"]'); if (b2 && !b2.disabled) b2.focus();
      return;
    }
    var rs = e.target.closest('[data-tkreset]');
    if (rs) { save(rs.dataset.tkreset, function (c) { delete c.order; delete c.where; }); again(rs.dataset.tkreset); return; }
    var dt = e.target.closest('[data-tkdot]');
    if (dt) { var tr = dt.closest('.tk-stack').querySelector('.tk-track'), n = +dt.dataset.tkdot; tr.scrollTo({ left: n * tr.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  });
  window.TileKit = { apply: apply };
})();
} catch (e) { console.error("tilekit.js", e); }
/* ===== pagekit.js ===== */
try {
/* Customize a page: change the order of its sections and cards, and hide the ones you don't use.
   Opened from Settings → Menu & pages (…/finance/?customize), shown at the top of the page.

   Sections (data-pk on the page) move up and down the page; cards move inside their group
   (Apple Health, Training, Check-ups … or Pace, Change by category …). Saved per page in
   dash.settings.pages, so it follows you to every device. Cards a Feature has switched off
   stay off – this only orders and hides what is on. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var main = document.querySelector('main.fp'); if (!main) return;
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1]; if (!page) return;
  var editing = false;
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* the groups that can be ordered: the page itself, and each grid of cards */
  function zones() {
    var z = [];
    if (main.querySelector(':scope > [data-pk]')) z.push({ key: 'main', name: 'Sections', el: main });
    main.querySelectorAll('.kit-grid, .fp-grid').forEach(function (g, i) {
      z.push({ key: g.dataset.pk ? 'cards:' + g.dataset.pk : g.classList.contains('fp-grid') ? 'stats' : 'cards' + (i ? i : ''), name: g.dataset.pkName || (g.classList.contains('fp-grid') ? 'Statistics' : 'Cards'), el: g });
    });
    return z;
  }
  function keyOf(el) {
    if (el.dataset.pk) return el.dataset.pk;
    if (el.dataset.tool) return 'tool:' + el.dataset.tool;
    if (el.id) return el.id;
    var h = el.querySelector('h2'); return h ? 'h:' + h.textContent.trim().replace(/\s+/g, ' ') : null;
  }
  function nameOf(el) {
    if (el.dataset.pkName) return el.dataset.pkName;
    var h = el.querySelector('h2'); if (h) return h.textContent.trim().replace(/\s+/g, ' ');
    return el.dataset.tool || el.id || 'Card';
  }
  /* what can move in a zone: sections marked data-pk, or the cards in a grid (not those a Feature turned off) */
  function items(z) {
    return Array.prototype.filter.call(z.el.children, function (c) {
      if (z.key === 'main') return !!c.dataset.pk;
      if (c.classList.contains('pk-bar')) return false;
      return keyOf(c) && (!c.hidden || c.classList.contains('pk-off'));
    });
  }
  function conf() { return (((readJSON('dash.settings', {}) || {}).pages || {})[page]) || {}; }
  function save(fn) {
    var st = readJSON('dash.settings', {}) || {}; st.pages = st.pages || {};
    var c = st.pages[page] || {}; fn(c);
    Object.keys(c).forEach(function (k) { var v = c[k]; if (v && !(v.order && v.order.length) && !(v.off && v.off.length)) delete c[k]; });
    if (Object.keys(c).length) st.pages[page] = c; else delete st.pages[page];
    writeJSON('dash.settings', st);
  }

  /* put each zone in the saved order; only touches the page when something has to move */
  function apply() {
    var C = conf();
    zones().forEach(function (z) {
      var c = C[z.key] || {}, order = c.order || [], off = c.off || [], list = items(z);
      list.forEach(function (el) { var o = off.indexOf(keyOf(el)) >= 0; el.classList.toggle('pk-off', o); });
      if (!order.length) return;
      var sorted = list.slice().sort(function (a, b) {
        var ia = order.indexOf(keyOf(a)), ib = order.indexOf(keyOf(b));
        return (ia < 0 ? 99 + list.indexOf(a) : ia) - (ib < 0 ? 99 + list.indexOf(b) : ib);
      });
      if (sorted.every(function (el, i) { return el === list[i]; })) return;
      var marks = list.map(function (el) { var m = document.createComment('pk'); z.el.insertBefore(m, el); return m; });
      sorted.forEach(function (el, i) { z.el.insertBefore(el, marks[i]); });
      marks.forEach(function (m) { m.remove(); });
    });
  }

  /* the button at the bottom of the page and the editor it opens */
  var bar = document.createElement('div'); bar.className = 'pk-bar';
  var hero = main.querySelector(':scope > .fp-hero, :scope > .tv-hero'); main.insertBefore(bar, hero ? hero.nextSibling : main.firstChild);
  editing = /[?&]customize/.test(location.search);
  function draw() {
    bar.hidden = !editing;
    if (!editing) { bar.innerHTML = ''; return; }
    var C = conf();
    bar.innerHTML = '<section class="card pk-editor" aria-label="Customize this page"><div class="card-head"><h2><i class="bi bi-layout-text-window-reverse"></i> Customize this page</h2></div>' +
      '<p class="muted pk-intro">Move sections and cards up or down, and switch off what you don’t use. Number tiles have their own Customize button. Open this again from Settings → Menu & pages.</p>' +
      zones().map(function (z) {
        var list = items(z); if (list.length < 2 && z.key !== 'main') return '';
        var off = (C[z.key] || {}).off || [];
        return '<p class="st-sub">' + esc(z.name) + '</p>' + list.map(function (el, i) {
          var k = keyOf(el), on = off.indexOf(k) < 0;
          return '<div class="pk-row' + (on ? '' : ' is-off') + '"><span class="pk-name">' + esc(nameOf(el)) + '</span>' +
            '<span class="pk-mv"><button type="button" class="icon-btn" data-pkmove="' + esc(k) + '" data-z="' + esc(z.key) + '" data-d="-1" aria-label="Move ' + esc(nameOf(el)) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
            '<button type="button" class="icon-btn" data-pkmove="' + esc(k) + '" data-z="' + esc(z.key) + '" data-d="1" aria-label="Move ' + esc(nameOf(el)) + ' down"' + (i < list.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span>' +
            '<input type="checkbox" class="switch" data-pkshow="' + esc(k) + '" data-z="' + esc(z.key) + '"' + (on ? ' checked' : '') + ' aria-label="Show ' + esc(nameOf(el)) + '"></div>';
        }).join('');
      }).join('') +
      (zones().some(function (z) { return items(z).length > 1; }) ? '' : '<p class="muted pk-intro">Nothing to arrange on this page yet – switch on more cards under Settings → Features.</p>') +
      '<div class="pk-foot"><button type="button" class="text-btn" data-pkreset>Reset</button><button type="button" class="pill-btn" data-pkedit>Done</button></div></section>';
  }
  function zoneBy(key) { return zones().filter(function (z) { return z.key === key; })[0]; }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-pkedit]')) {
      editing = false; draw();
      history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    var mv = e.target.closest('[data-pkmove]');
    if (mv) {
      var z = zoneBy(mv.dataset.z); if (!z) return;
      var ord = items(z).map(keyOf), ix = ord.indexOf(mv.dataset.pkmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return;
      ord.splice(to, 0, ord.splice(ix, 1)[0]);
      save(function (c) { c[z.key] = c[z.key] || {}; c[z.key].order = ord; });
      apply(); draw();
      var nb = bar.querySelector('[data-pkmove="' + mv.dataset.pkmove + '"][data-z="' + mv.dataset.z + '"][data-d="' + mv.dataset.d + '"]'); if (nb && !nb.disabled) nb.focus();
      return;
    }
    if (e.target.closest('[data-pkreset]')) { save(function (c) { Object.keys(c).forEach(function (k) { delete c[k]; }); }); location.reload(); }
  });
  document.addEventListener('change', function (e) {
    var sw = e.target.closest('[data-pkshow]'); if (!sw) return;
    save(function (c) {
      var z = c[sw.dataset.z] = c[sw.dataset.z] || {}, off = z.off = z.off || [], i = off.indexOf(sw.dataset.pkshow);
      if (sw.checked && i >= 0) off.splice(i, 1); else if (!sw.checked && i < 0) off.push(sw.dataset.pkshow);
    });
    apply(); var row = sw.closest('.pk-row'); if (row) row.classList.toggle('is-off', !sw.checked);
  });

  /* cards appear after unlocking (and Apple Health is added later): order them when they do */
  var queued = false;
  new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } })
    .observe(main, { childList: true, subtree: false });
  main.querySelectorAll('.kit-grid, .fp-grid').forEach(function (g) {
    new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; apply(); }); } }).observe(g, { childList: true, attributes: true, attributeFilter: ['hidden'], subtree: false });
  });
  window.Vault.onUnlock(function () { setTimeout(function () { apply(); draw(); }, 60); });
  draw();
  window.PageKit = { apply: apply };
})();
} catch (e) { console.error("pagekit.js", e); }
/* ===== focus.js ===== */
try {
/* Focus timer: 25 minutes on one task, then a 5-minute break (Pomodoro).
   Start it from a task's menu (long-press or right-click), from Plan my day, from search/⌘K or with F.
   A small pill floats above the menu bar on every page and keeps counting when you change page,
   because the timer is a start time saved on this device (dash.focus), not a ticking script.
   Finished sessions are kept in dash.focusLog (this device only) so the pill can say how long
   you focused today. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var KEY = 'dash.focus', LOG = 'dash.focusLog', WORK = 25, REST = 5;
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function toast(h) { if (window.Quick && window.Quick.toast) window.Quick.toast(h); }

  /* state: { text, id, mode: 'work'|'rest', end (ms), paused (ms left) } */
  function st() { return readJSON(KEY, null); }
  function left(s) { return s.paused != null ? s.paused : Math.max(0, s.end - Date.now()); }
  function minsToday() { return (readJSON(LOG, []) || []).filter(function (x) { return x.d === today(); }).reduce(function (a, x) { return a + (x.m || 0); }, 0); }

  function start(text, id, mins) {
    writeJSON(KEY, { text: text || '', id: id || null, mode: 'work', mins: mins || WORK, end: Date.now() + (mins || WORK) * 60000 });
    if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    draw(); tick();
  }
  function stop(logIt) {
    var s = st(); if (!s) return;
    if (logIt && s.mode === 'work') { var done = Math.round(((s.mins || WORK) * 60000 - left(s)) / 60000); if (done >= 1) logMins(done, s.text); }
    writeJSON(KEY, null); draw();
  }
  function logMins(m, text) { var l = readJSON(LOG, []) || []; l.push({ d: today(), m: m, t: text || '' }); writeJSON(LOG, l.slice(-300)); }
  function pause() { var s = st(); if (!s) return; if (s.paused != null) { s.end = Date.now() + s.paused; delete s.paused; } else s.paused = left(s); writeJSON(KEY, s); draw(); }

  function ring(msg) {
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    try { if (window.Notification && Notification.permission === 'granted' && document.hidden) new Notification('Focus', { body: msg, icon: '/cmd/assets/icons/icon-192.png', tag: 'focus' }); } catch (e) {}
    toast('<i class="bi bi-stopwatch"></i> ' + esc(msg));
  }
  /* one step forward when a session runs out: work → break → done */
  function roll() {
    var s = st(); if (!s || s.paused != null || s.end > Date.now()) return;
    if (s.mode === 'work') {
      logMins(s.mins || WORK, s.text);
      writeJSON(KEY, { text: s.text, id: s.id, mode: 'rest', mins: REST, end: s.end + REST * 60000 });
      if (Date.now() < s.end + REST * 60000) ring('Well done – take a ' + REST + '-minute break.');
      roll();
    } else { writeJSON(KEY, null); if (Date.now() - s.end < 60000) ring('Break over – ready for the next one?'); }
  }

  /* ---------- the pill ---------- */
  var pill = document.createElement('div'); pill.className = 'fo-pill'; pill.hidden = true; pill.setAttribute('role', 'timer');
  document.body.appendChild(pill);
  function mmss(ms) { var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), x = t % 60; return m + ':' + String(x).padStart(2, '0'); }
  function draw() {
    roll();
    var s = st(), unlocked = document.documentElement.classList.contains('unlocked');
    pill.hidden = !s || !unlocked;
    document.documentElement.classList.toggle('fo-on', !pill.hidden);
    if (!s) { pill.innerHTML = ''; return; }
    var ms = left(s), tot = (s.mins || (s.mode === 'rest' ? REST : WORK)) * 60000, pct = Math.max(0, Math.min(1, 1 - ms / tot));
    var label = s.mode === 'rest' ? 'Break' : (s.text || 'Focus');
    var html = '<span class="fo-ring" style="--p:' + pct.toFixed(3) + '"><i class="bi bi-' + (s.mode === 'rest' ? 'cup-hot' : 'stopwatch') + '"></i></span>' +
      '<span class="fo-x"><b class="fo-time">' + mmss(ms) + '</b><small>' + esc(label) + '</small></span>' +
      '<button type="button" class="icon-btn" data-fopause aria-label="' + (s.paused != null ? 'Resume' : 'Pause') + '"><i class="bi bi-' + (s.paused != null ? 'play-fill' : 'pause-fill') + '"></i></button>' +
      '<button type="button" class="icon-btn" data-fostop aria-label="Stop"><i class="bi bi-stop-fill"></i></button>';
    if (pill.dataset.k !== s.mode + (s.paused != null) + label) { pill.innerHTML = html; pill.dataset.k = s.mode + (s.paused != null) + label; pill.classList.toggle('rest', s.mode === 'rest'); pill.classList.toggle('paused', s.paused != null); }
    else { pill.querySelector('.fo-time').textContent = mmss(ms); pill.querySelector('.fo-ring').style.setProperty('--p', pct.toFixed(3)); }
    pill.setAttribute('aria-label', label + ' – ' + mmss(ms) + ' left');
  }
  var timer = null;
  function tick() { clearInterval(timer); if (st()) timer = setInterval(function () { draw(); if (!st()) clearInterval(timer); }, 1000); }
  pill.addEventListener('click', function (e) {
    if (e.target.closest('[data-fopause]')) return pause();
    if (e.target.closest('[data-fostop]')) { var s = st(); stop(true); var m = minsToday(); toast('<i class="bi bi-stopwatch"></i> Stopped' + (m ? ' · ' + m + ' min focused today' : '')); return; }
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { draw(); tick(); } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) draw(); });
  window.Vault.onUnlock(function () { draw(); tick(); });
  if (window.Vault.onLock) window.Vault.onLock(function () { pill.hidden = true; });

  /* ---------- choose what to focus on ---------- */
  function pick() {
    var s = st(); if (s) { pause(); return; }
    var td = today(), list = (readJSON('dash.todos', []) || []).filter(function (t) { return !t.done; });
    list.sort(function (a, b) { var ra = a.today === td ? (a.rank || 4) : 9, rb = b.today === td ? (b.rank || 4) : 9; return ra - rb; });
    var top = list.slice(0, 5);
    var bg = document.createElement('div'); bg.className = 'fo-bg';
    bg.innerHTML = '<div class="fo-box" role="dialog" aria-modal="true" aria-label="Start a focus timer"><h3><i class="bi bi-stopwatch"></i> Focus for ' + WORK + ' minutes</h3>' +
      '<p class="muted">Pick a task – or just start.</p>' +
      top.map(function (t) { return '<button type="button" class="fo-opt" data-fotask="' + esc(t.id) + '">' + (t.today === td && t.rank ? '<span class="td-rank">' + t.rank + '</span> ' : '') + esc(t.text) + '</button>'; }).join('') +
      '<button type="button" class="fo-opt" data-fotask=""><i class="bi bi-play-fill"></i> Just start</button>' +
      '<div class="fo-foot"><button type="button" class="text-btn" data-foclose>Cancel</button></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var first = bg.querySelector('.fo-opt'); if (first) first.focus();
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('[data-foclose]')) return close();
      var b = e.target.closest('[data-fotask]'); if (!b) return;
      var t = top.filter(function (x) { return x.id === b.dataset.fotask; })[0];
      close(); start(t ? t.text : '', t ? t.id : null);
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-focus]'); if (!b) return;
    e.preventDefault(); if (window.Plan && window.Plan.isOpen()) window.Plan.close();
    if (b.dataset.focus) start(b.dataset.focusText || '', b.dataset.focus); else pick();
  });
  window.Focus = { start: start, stop: stop, pause: pause, pick: pick, running: function () { return !!st(); }, minsToday: minsToday };
  draw(); tick();
})();
} catch (e) { console.error("focus.js", e); }
/* ===== keys.js ===== */
try {
/* Keyboard shortcuts on a computer. Press ? to see them all.
     ⌘K or /   search and commands        1–6   go to a page (in menu order)
     N         new task                    P     plan my day
     A         quick add                   F     focus timer (start / pause)
     ,         settings                    D     dark / light
     L         lock                        ?     this list
   Single keys only work when you are not typing in a field and no window is open.
   The calendar keeps its own keys (← → T N). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  var home = '/cmd/';
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }

  function pages() {
    var nav = document.querySelector('nav'); if (!nav) return [];
    return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth || a.offsetHeight; })
      .sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
  }
  function plan() { if (window.Plan) window.Plan.open(); else location.href = home + '#plan'; }
  function newTask() {
    var i = document.getElementById('todoInput');
    if (i && i.offsetParent) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus({ preventScroll: true }); }
    else if (window.Quick) window.Quick.open('todo');
  }
  function settings() { var b = document.getElementById('settingsBtn'); if (b) b.click(); else location.href = home + '?settings'; }
  function theme() {
    var s = readJSON('dash.settings', {}) || {}, cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var b = document.querySelector('[data-theme-opt="' + (cur === 'light' ? 'dark' : 'light') + '"]');
    if (b) { b.click(); return; }
    s.theme = cur === 'light' ? 'dark' : 'light'; writeJSON('dash.settings', s); document.documentElement.setAttribute('data-theme', s.theme);
  }
  var ACT = { n: newTask, p: plan, a: function () { if (window.Quick) window.Quick.open(); }, f: function () { if (window.Focus) window.Focus.pick(); },
    ',': settings, d: theme, l: function () { window.Vault.lock(); }, '?': help };

  /* is a window open on top of the page? then single keys are left alone */
  function busy() {
    var r = document.documentElement;
    if (r.classList.contains('cl-modal')) return true;
    if (document.querySelector('.qa-bg:not([hidden]), .fo-bg, .kb-bg, .td-menu')) return true;
    if (document.body.classList.contains('st-open') || (window.Plan && window.Plan.isOpen())) return true;
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (!document.documentElement.classList.contains('unlocked')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    var t = e.target; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable) return;
    if (busy()) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (page === 'calendar' && (k === 'n' || k === 't')) return;            // the calendar's own keys
    if (/^[1-9]$/.test(k)) { var l = pages()[+k - 1]; if (l) { e.preventDefault(); l.click(); } return; }
    if (ACT[k]) { e.preventDefault(); ACT[k](); }
  });

  /* ---------- the list (?) ---------- */
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function help() {
    if (document.querySelector('.kb-bg')) return;
    var names = pages().map(function (a, i) { return [String(i + 1), (a.textContent || '').trim()]; });
    var rows = [[(mac ? '⌘' : 'Ctrl') + ' K', 'Search and commands'], ['/', 'Search'], ['N', 'New task'], ['A', 'Quick add – expense, event, note …'], ['P', 'Plan my day'], ['F', 'Focus timer – start or pause'], [',', 'Settings'], ['D', 'Dark or light'], ['L', 'Lock'], ['?', 'Keyboard shortcuts']];
    var cal = [['← →', 'Previous / next'], ['T', 'Today'], ['N', 'New event']];
    var kb = function (r) { return '<div class="kb-row"><span>' + r[1] + '</span><span>' + r[0].split(' ').map(function (x) { return '<kbd>' + x + '</kbd>'; }).join('') + '</span></div>'; };
    var bg = document.createElement('div'); bg.className = 'kb-bg';
    bg.innerHTML = '<div class="kb-box" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div class="kb-head"><h3><i class="bi bi-keyboard"></i> Keyboard shortcuts</h3><button type="button" class="icon-btn" data-kbclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="kb-cols"><div><p class="st-sub">Everywhere</p>' + rows.map(kb).join('') + '</div><div><p class="st-sub">Go to</p>' + names.map(function (n) { return kb([n[0], n[1]]); }).join('') +
      '<p class="st-sub">Calendar</p>' + cal.map(kb).join('') + '<p class="st-sub">To-do</p>' + kb(['Right-click', 'Task menu – top 3, move, focus']) + '</div></div></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var x = bg.querySelector('[data-kbclose]'); x.focus();
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-kbclose]')) close(); });
  }
  window.Keys = { help: help, plan: plan, newTask: newTask, theme: theme, settings: settings, pages: pages };
})();
} catch (e) { console.error("keys.js", e); }
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

  /* ---------- your own menu order (Settings → Dashboard → Menu). Home stays first. ----------
     The head script sets --nav-<page> before the first frame; here the links are also put in that
     order, so keyboard and screen readers follow what you see. */
  function navOrder() { try { var o = (JSON.parse(localStorage.getItem('dash.settings')) || {}).navOrder; return Array.isArray(o) ? o : null; } catch (e) { return null; } }
  function pages() { return Array.prototype.map.call(nav ? nav.querySelectorAll('a[data-pg]') : [], function (a) { return a.dataset.pg; }).filter(function (k) { return k !== 'home'; }); }
  function sortedPages() {
    var o = navOrder() || [], def = ['calendar', 'travel', 'finance', 'habits', 'work'];
    return pages().sort(function (a, b) { var ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 50 + def.indexOf(a) : ia) - (ib < 0 ? 50 + def.indexOf(b) : ib); });
  }
  function applyOrder() {
    if (!nav) return;
    var r = document.documentElement, list = sortedPages();
    list.forEach(function (k, i) { r.style.setProperty('--nav-' + k, i + 1); var a = nav.querySelector('a[data-pg="' + k + '"]'); if (a) nav.appendChild(a); });
    var box = document.getElementById('stNav'); if (!box) return;
    var name = function (k) { var a = nav.querySelector('a[data-pg="' + k + '"] span:last-child'); return a ? a.textContent : k; };
    var icon = function (k) { var i = nav.querySelector('a[data-pg="' + k + '"] .bi'); return i ? i.className : 'bi bi-circle'; };
    var ico = function (k) { return '<span class="st-ico" style="--c:var(--accent)"><i class="' + icon(k) + '"></i></span>'; };
    box.innerHTML = '<div class="st-row st-nav-row is-fixed">' + ico('home') + '<span class="st-label">' + name('home') + '<small>Always first</small></span></div>' +
      list.map(function (k, i) {
        return '<div class="st-row st-nav-row">' + ico(k) + '<span class="st-label">' + name(k) + '</span><span class="pk-mv">' +
          '<button type="button" class="icon-btn" data-navmove="' + k + '" data-d="-1" aria-label="Move ' + name(k) + ' left"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
          '<button type="button" class="icon-btn" data-navmove="' + k + '" data-d="1" aria-label="Move ' + name(k) + ' right"' + (i < list.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('');
  }
  applyOrder();
  window.addEventListener('dash:local', function () { var o = JSON.stringify(navOrder()); if (o !== applyOrder.last) { applyOrder.last = o; applyOrder(); } });
  applyOrder.last = JSON.stringify(navOrder());
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(applyOrder, 0); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-navmove]'); if (!b) return;
    var list = sortedPages(), ix = list.indexOf(b.dataset.navmove), to = ix + (+b.dataset.d);
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(ix, 1)[0]);
    try { var st = JSON.parse(localStorage.getItem('dash.settings')) || {}; st.navOrder = list; localStorage.setItem('dash.settings', JSON.stringify(st)); } catch (x) {}
    applyOrder.last = JSON.stringify(list); applyOrder(); window.dispatchEvent(new Event('dash:local'));
    var nb = document.querySelector('[data-navmove="' + b.dataset.navmove + '"][data-d="' + b.dataset.d + '"]'); if (nb && !nb.disabled) nb.focus();
  });
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
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return a.offsetWidth; }).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; }); }
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
/* ===== life.js ===== */
try {
/* Optional helpers (Settings → Features), on every page:
     Talk to add        a mic in the top bar – say it, and Quick add fills itself in
     Shutdown ritual    end the workday: clock out, move what's left, pick tomorrow's top 3
     Find time          a free slot this week for anything, booked in one tap
     Meeting prep       before a meeting: notes and open action points from last time
     Trip budget mode   while you're away: what you can spend today
     Rest-day advisor   ready to train, go easy or rest – from sleep, heart rate and training
   Their lines in At a glance come through window.BriefExtra; commands for ⌘K through window.CommandExtra. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features;
  function on(k) { return !!(Fe && Fe.on(k)); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function hm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function reloadAll() { window.dispatchEvent(new Event('todos:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); window.dispatchEvent(new Event('brief:refresh')); }
  window.BriefExtra = window.BriefExtra || [];
  window.CommandExtra = window.CommandExtra || [];

  /* ---------- one dialog for all of them (centred, closes with Esc or a tap outside) ---------- */
  function dialog(cls, html, onClick) {
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box ' + cls + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-lfclose]')) return close(); if (onClick) onClick(e, close, bg.firstChild); });
    var f = bg.querySelector('input, button:not([data-lfclose])'); if (f && matchMedia('(hover: hover)').matches) setTimeout(function () { f.focus(); }, 30);
    return { el: bg.firstChild, close: close };
  }
  function head(icon, title, sub) { return '<div class="lf-head"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3><button type="button" class="icon-btn sm" data-lfclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' + (sub ? '<p class="muted lf-sub">' + esc(sub) + '</p>' : ''); }

  /* the button host: the modern bar, or the top corner of the page */
  function addButton(btn) {
    var host = document.querySelector('.mb-acts') || document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
    if (!host) return;
    var before = host.querySelector('#quickAdd') || host.querySelector('[data-search]') || null;
    host.insertBefore(btn, before);
  }

  /* ================= Talk to add ================= */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var mic = null;
  function voiceButton() {
    var want = on('voice') && !!SR && document.documentElement.classList.contains('unlocked');
    if (!want) { if (mic) mic.hidden = true; return; }
    if (!mic) {
      mic = document.createElement('button'); mic.type = 'button'; mic.className = 'icon-btn mic-btn'; mic.id = 'micBtn';
      mic.setAttribute('aria-label', 'Talk to add'); mic.title = 'Talk to add'; mic.innerHTML = '<i class="bi bi-mic"></i>';
      mic.addEventListener('click', listen);
    }
    if (!mic.isConnected) addButton(mic);
    mic.hidden = false;
  }
  function listen() {
    if (!SR) return;
    var lang = (readJSON('dash.settings', {}) || {}).voiceLang || ((readJSON('dash.settings', {}) || {}).lang === 'en' ? 'en-GB' : 'nb-NO');
    var r = new SR(); r.lang = lang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    var pill = document.createElement('div'); pill.className = 'mic-pill'; pill.setAttribute('role', 'status');
    pill.innerHTML = '<span class="mic-dot"></span><span class="mic-tx">' + (lang === 'nb-NO' ? 'Lytter … si f.eks. «149 Rema»' : 'Listening … say e.g. “149 Rema”') + '</span><button type="button" class="icon-btn sm" aria-label="Stop"><i class="bi bi-stop-fill"></i></button>';
    document.body.appendChild(pill); mic.classList.add('on');
    var text = '', done = false;
    function end() { if (done) return; done = true; pill.remove(); mic.classList.remove('on'); if (text.trim() && window.Quick) window.Quick.open(null, null, text.trim()); }
    pill.querySelector('button').addEventListener('click', function () { try { r.stop(); } catch (e) {} });
    r.onresult = function (e) { text = Array.prototype.map.call(e.results, function (x) { return x[0].transcript; }).join(' '); pill.querySelector('.mic-tx').textContent = text; };
    r.onerror = function (e) { if (e.error === 'not-allowed') toast('<i class="bi bi-mic-mute"></i> Allow the microphone for this site to talk to add'); end(); };
    r.onend = end;
    try { r.start(); } catch (e) { end(); }
  }
  window.CommandExtra.push(function () { return on('voice') && SR ? [{ i: 'mic', t: 'Talk to add', s: 'Say it, and it’s added', run: listen, x: 'voice speak mic snakk tale' }] : []; });

  /* ================= Shutdown ritual ================= */
  function shutdownDue(now) {
    var d = now.getDay(); if (d === 0 || d === 6) return false;
    return now.getHours() >= 15 && now.getHours() < 23 && localStorage.getItem('dash.shutdown') !== dkey(now);
  }
  function shutdown() {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1);
    var todos = readJSON('dash.todos', []) || [];
    var left = todos.filter(function (t) { return !t.done && (t.today === tk || (t.due && t.due <= tk)); });
    var open = todos.filter(function (t) { return !t.done; });
    var flexOpen = on('flex') ? Fe.list('flex').filter(function (e) { return e.date === tk && e.in && !e.out; })[0] : null;
    var nowHM = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var picks = open.filter(function (t) { return t.today === tom; }).map(function (t) { return t.id; });
    var tomEv = [];
    if (window.Cal && window.Cal.occurrences) { try { var a = fromKey(tom), b = fromKey(tom); b.setHours(23, 59); tomEv = window.Cal.occurrences(a, b).filter(function (o) { return !o.allDay && !(o.ev && o.ev.holiday); }).slice(0, 3); } catch (e) {} }
    var html = head('moon-stars', 'End your workday', 'Close today in one go – and know what tomorrow holds.') +
      (flexOpen ? '<section class="lf-sec"><h4>Work time</h4><label class="lf-check"><input type="checkbox" id="sdOut" checked> Clock out now (' + nowHM + ') – clocked in at ' + esc(flexOpen.in) + '</label></section>' : '') +
      '<section class="lf-sec"><h4>Left from today</h4>' + (left.length ? left.map(function (t) { return '<label class="lf-check"><input type="checkbox" data-sdmove="' + esc(t.id) + '" checked> <span>Move <b>' + esc(t.text) + '</b> to tomorrow</span></label>'; }).join('') : '<p class="muted">Nothing left – nice work.</p>') + '</section>' +
      '<section class="lf-sec"><h4>Tomorrow’s top 3 <small class="muted" id="sdCount"></small></h4><div class="lf-chips" id="sdPick">' +
      (open.length ? open.slice(0, 14).map(function (t) { return '<button type="button" class="lf-chip" data-sdpick="' + esc(t.id) + '" aria-pressed="' + (picks.indexOf(t.id) > -1) + '">' + esc(t.text) + '</button>'; }).join('') : '<p class="muted">No open tasks.</p>') + '</div></section>' +
      (tomEv.length ? '<section class="lf-sec"><h4>Tomorrow</h4>' + tomEv.map(function (o) { return '<p class="lf-ev"><b>' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + '</b> ' + esc(o.title) + '</p>'; }).join('') + '</section>' : '') +
      '<div class="lf-foot"><button type="button" class="text-btn" data-lfclose>Not now</button><button type="button" class="pill-btn wide" data-sddo><i class="bi bi-check2"></i> End my day</button></div>';
    var d = dialog('lf-shutdown', html, function (e, close, box) {
      var p = e.target.closest('[data-sdpick]');
      if (p) {
        var onNow = p.getAttribute('aria-pressed') === 'true';
        if (!onNow && box.querySelectorAll('[data-sdpick][aria-pressed="true"]').length >= 3) { toast('<i class="bi bi-trophy"></i> Three is the limit – take one out first'); return; }
        p.setAttribute('aria-pressed', String(!onNow)); count(box); return;
      }
      if (!e.target.closest('[data-sddo]')) return;
      var l = readJSON('dash.todos', []) || [];
      var moves = Array.prototype.map.call(box.querySelectorAll('[data-sdmove]:checked'), function (x) { return x.dataset.sdmove; });
      var chosen = Array.prototype.map.call(box.querySelectorAll('[data-sdpick][aria-pressed="true"]'), function (x) { return x.dataset.sdpick; });
      l.forEach(function (t) {
        if (moves.indexOf(t.id) > -1) { t.due = tom; if (t.today === tk) { delete t.today; delete t.rank; } }
        if (t.today === tom && chosen.indexOf(t.id) < 0) { delete t.today; delete t.rank; }
      });
      chosen.forEach(function (id, i) { l.forEach(function (t) { if (t.id === id) { t.today = tom; t.rank = i + 1; } }); });
      writeJSON('dash.todos', l);
      var out = box.querySelector('#sdOut');
      if (out && out.checked && flexOpen) { var tt = Fe.tools(); (tt.flex || []).forEach(function (x) { if (x.id === flexOpen.id) x.out = nowHM; }); Fe.saveTools(tt); }
      try { localStorage.setItem('dash.shutdown', tk); } catch (x) {}
      close(); reloadAll(); window.dispatchEvent(new Event('plan:change'));
      toast('<i class="bi bi-moon-stars"></i> Workday closed' + (moves.length ? ' · ' + moves.length + ' moved to tomorrow' : '') + '. See you tomorrow.');
    });
    function count(box) { var n = box.querySelectorAll('[data-sdpick][aria-pressed="true"]').length; box.querySelector('#sdCount').textContent = n + ' of 3'; }
    count(d.el);
  }
  window.BriefExtra.push(function (add, now) {
    if (on('shutdown') && shutdownDue(now)) add(30, 'moon-stars', '#6b4bc4', 'End your workday', 'Move what’s left and pick tomorrow’s top 3', '#shutdown');
  });
  window.CommandExtra.push(function () { return on('shutdown') ? [{ i: 'moon-stars', t: 'End my workday', s: 'Clock out, move what’s left, pick tomorrow’s top 3', run: shutdown, x: 'shutdown end day close avslutt' }] : []; });

  /* ================= Find time ================= */
  function busy(dayKey) {
    var C = window.Cal; if (!C || !C.occurrences) return [];
    var a = fromKey(dayKey), b = fromKey(dayKey); b.setHours(23, 59);
    try { return C.occurrences(a, b).filter(function (o) { return !o.allDay; }).map(function (o) { return [o.start.getHours() * 60 + o.start.getMinutes(), o.end ? (o.end.getHours() * 60 + o.end.getMinutes() || 1440) : o.start.getHours() * 60 + o.start.getMinutes() + 60]; }); } catch (e) { return []; }
  }
  function slots(len, range, win, weekends) {
    var now = new Date(), tk = dkey(now), out = [], startDay = range === 'next' ? addDays(tk, 7 - ((now.getDay() + 6) % 7)) : tk;
    var days = range === 'week' ? 7 - ((now.getDay() + 6) % 7) : range === 'next' ? 7 : 14;
    for (var i = 0; i < days; i++) {
      var k = addDays(startDay, i), dow = fromKey(k).getDay();
      if (!weekends && (dow === 0 || dow === 6)) continue;
      if (Fe && Fe.holiday && Fe.holiday(k) && win[0] < 17 * 60) continue;
      var b = busy(k).map(function (x) { return [x[0] - 15, x[1] + 15]; }).sort(function (x, y) { return x[0] - y[0]; });
      var t = win[0];
      if (k === tk) t = Math.max(t, Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30);
      var dayOut = [];
      while (t + len <= win[1]) {
        var clash = b.filter(function (x) { return x[0] < t + len && x[1] > t; })[0];
        if (clash) { t = Math.ceil(clash[1] / 30) * 30; continue; }
        dayOut.push({ date: k, start: t }); t += Math.max(len, 60);
      }
      if (dayOut.length) out.push(dayOut);
    }
    /* one per day first (the earliest that isn't too early), then the rest */
    var first = out.map(function (d) { return d[0]; }), rest = [];
    out.forEach(function (d) { rest = rest.concat(d.slice(1)); });
    return first.concat(rest).slice(0, 8);
  }
  function findTime(preTitle) {
    if (!window.Cal) { location.href = '/cmd/calendar/#findtime'; return; }
    var st = { len: 60, range: 'week', win: 'work', wk: false };
    var WIN = { work: [8 * 60, 16 * 60], evening: [17 * 60, 22 * 60], any: [8 * 60, 22 * 60] };
    var seg = function (k, opts) { return '<div class="seg lf-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-ft="' + k + ':' + o[0] + '" aria-pressed="' + (String(st[k]) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    function body() {
      var list = slots(st.len, st.range, WIN[st.win], st.wk);
      return seg('len', [[30, '30 min'], [60, '1 h'], [120, '2 h'], [180, '3 h']]) + seg('range', [['week', 'This week'], ['next', 'Next week'], ['two', '2 weeks']]) +
        seg('win', [['work', 'Work hours'], ['evening', 'Evenings'], ['any', 'Any time']]) +
        '<label class="lf-check"><input type="checkbox" data-ftwk' + (st.wk ? ' checked' : '') + '> Weekends too</label>' +
        '<div class="lf-slots">' + (list.length ? list.map(function (s) {
          var d = fromKey(s.date);
          return '<button type="button" class="lf-slot" data-ftbook="' + s.date + '|' + s.start + '"><b>' + esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</b><span>' + hm(s.start) + '–' + hm(s.start + st.len) + '</span><i class="bi bi-plus-lg"></i></button>';
        }).join('') : '<p class="muted">No free slot that long – try a shorter time, or more days.</p>') + '</div>';
    }
    var d = dialog('lf-find', head('calendar2-range', 'Find time', 'What do you need time for?') +
      '<input id="ftTitle" placeholder="e.g. Write the FDV report, gym, call mum" maxlength="120" value="' + esc(preTitle || '') + '"><div id="ftBody">' + body() + '</div>',
      function (e, close, box) {
        var b = e.target.closest('[data-ft]');
        if (b) { var p = b.dataset.ft.split(':'); st[p[0]] = p[0] === 'len' ? +p[1] : p[1]; box.querySelector('#ftBody').innerHTML = body(); return; }
        if (e.target.matches('[data-ftwk]')) { st.wk = e.target.checked; box.querySelector('#ftBody').innerHTML = body(); return; }
        var bk = e.target.closest('[data-ftbook]'); if (!bk) return;
        var title = box.querySelector('#ftTitle').value.trim();
        if (!title) { box.querySelector('#ftTitle').focus(); box.querySelector('#ftTitle').classList.add('kit-bad'); return; }
        var q = bk.dataset.ftbook.split('|'), C = window.Cal, cal = C.load();
        var cat = window.Smart && window.Smart.guessCat ? window.Smart.guessCat(title) : null; if (!cat || !C.CATS[cat]) cat = C.CATS.personal ? 'personal' : C.CAT_ORDER[0];
        var ev = { id: C.uid(), title: title, cat: cat, date: q[0], allDay: false, start: hm(+q[1]), stop: hm(Math.min(+q[1] + st.len, 1439)) };
        cal.events.push(ev); if (cal.hidden && cal.hidden[cat]) delete cal.hidden[cat]; C.save(cal);
        window.dispatchEvent(new Event('cal:change')); close();
        toast('<i class="bi bi-calendar-check"></i> ' + esc(title) + ' · ' + esc(fromKey(q[0]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + ev.start, function () { var c2 = C.load(); c2.events = c2.events.filter(function (x) { return x.id !== ev.id; }); C.save(c2); window.dispatchEvent(new Event('cal:change')); });
      });
    d.el.addEventListener('change', function (e) { if (e.target.matches('[data-ftwk]')) { st.wk = e.target.checked; d.el.querySelector('#ftBody').innerHTML = body(); } });
  }
  window.CommandExtra.push(function () { return on('findtime') ? [{ i: 'calendar2-range', t: 'Find time', s: 'A free slot this week for anything', run: function () { findTime(); }, x: 'find time free slot schedule ledig tid' }] : []; });
  /* a "Find time" button next to New on the calendar page */
  function calButton() {
    var nw = document.getElementById('clNew'); if (!nw) return;
    var b = document.getElementById('clFind');
    if (!on('findtime')) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'clFind'; b.className = 'icon-btn cl-find'; b.setAttribute('aria-label', 'Find time'); b.title = 'Find time'; b.innerHTML = '<i class="bi bi-calendar2-range"></i>'; b.addEventListener('click', function () { findTime(); }); nw.parentNode.insertBefore(b, nw); }
    b.hidden = false;
  }
  if (location.hash === '#findtime') window.Vault.onUnlock(function () { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { findTime(); }, 400); });

  /* ================= Meeting prep ================= */
  var STOP = { the: 1, and: 1, med: 1, til: 1, for: 1, och: 1, meeting: 1, 'møte': 1, with: 1, 'på': 1, 'og': 1, 'i': 1, 'om': 1, 'av': 1 };
  function words(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(function (w) { return w.length >= 3 && !STOP[w]; }); }
  function lastMeeting(title) {
    if (!Fe || !Fe.on('meetings')) return null;
    var w = words(title); if (!w.length) return null;
    var best = null, bestScore = 0;
    Fe.list('meetings').forEach(function (m) {
      var mw = words(m.title + ' ' + (m.who || '')), hit = w.filter(function (x) { return mw.indexOf(x) > -1; }).length;
      var score = hit / Math.min(w.length, Math.max(1, mw.length));
      if (hit && (score > bestScore || (score === bestScore && best && m.date > best.date))) { best = m; bestScore = score; }
    });
    return bestScore >= .5 || (best && words(best.title).length && bestScore > 0 && w.length <= 2) ? best : null;
  }
  function openActs(m) { return String(m.actions || '').split('\n').map(function (x, i) { return { t: x.trim(), i: i }; }).filter(function (a) { return a.t && !(m.done || {})[a.i]; }); }
  var prepFor = {};
  window.BriefExtra.push(function (add, now) {
    if (!on('prep') || !window.Cal || !window.Cal.occurrences) return;
    var end = new Date(now.getTime() + 3 * 36e5), occ = [];
    try { occ = window.Cal.occurrences(now, end).filter(function (o) { return !o.allDay && o.start > now && !(o.ev && (o.ev.todo || o.ev.holiday || o.ev.reminder)); }); } catch (e) {}
    occ.slice(0, 2).forEach(function (o) {
      var m = lastMeeting(o.title), notes = o.ev && o.ev.notes;
      if (!m && !notes) return;
      var id = 'prep' + Object.keys(prepFor).length; prepFor[id] = { o: o, m: m };
      var acts = m ? openActs(m) : [];
      add(9, 'clipboard-check', '#3987e5', 'Prep: ' + o.title + ' at ' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()),
        m ? 'Last time ' + new Date(m.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (acts.length ? ' · ' + acts.length + ' open action' + (acts.length === 1 ? '' : 's') : ' · notes ready') : 'Notes in the event', '#' + id);
    });
  });
  function showPrep(p) {
    var o = p.o, m = p.m, acts = m ? openActs(m) : [];
    var html = head('clipboard-check', o.title, pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + (o.ev && o.ev.location ? ' · ' + o.ev.location : '')) +
      (o.ev && o.ev.notes ? '<section class="lf-sec"><h4>In the event</h4><p class="lf-notes">' + esc(o.ev.notes) + '</p></section>' : '') +
      (m ? '<section class="lf-sec"><h4>Last time · ' + esc(new Date(m.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })) + (m.who ? ' · ' + esc(m.who) : '') + '</h4>' +
        (m.notes ? '<p class="lf-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<h4>Open action points</h4>' + acts.map(function (a) { return '<label class="lf-check"><input type="checkbox" data-prepact="' + esc(m.id) + ':' + a.i + '"> ' + esc(a.t) + '</label>'; }).join('') : '<p class="muted">All action points done.</p>') + '</section>' : '') +
      '<div class="lf-foot"><a class="text-btn" href="/cmd/work/#meetings"><i class="bi bi-people"></i> Meeting notes</a><button type="button" class="pill-btn wide" data-lfclose>Ready</button></div>';
    var d = dialog('lf-prep', html);
    d.el.addEventListener('change', function (e) {
      var a = e.target.dataset.prepact; if (!a) return;
      var q = a.split(':'), t = Fe.tools(); (t.meetings || []).forEach(function (x) { if (x.id === q[0]) { x.done = x.done || {}; if (e.target.checked) x.done[q[1]] = true; else delete x.done[q[1]]; } }); Fe.saveTools(t);
    });
  }

  /* ================= Trip budget mode ================= */
  function tripToday() {
    if (!on('tripbudget') || !window.Flow || !window.Flow.travel) return null;
    var now = new Date(), tk = dkey(now);
    var tr = (window.Flow.travel().trips || []).filter(function (t) { return t.start <= tk && (t.end || t.start) >= tk && +t.budget > 0; })[0];
    if (!tr) return null;
    var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
    var items = tr.items || [], booked = items.reduce(function (a, it) { return a + n(it.cost); }, 0);
    var linked = {}; items.forEach(function (it) { if (it.spendId) linked[it.spendId] = 1; });
    var ex = ((window.Vault.get() || {}).expenses || []).filter(function (e) { return e.date >= tr.start && e.date <= (tr.end || tr.start) && !linked[e.id]; });
    var before = ex.filter(function (e) { return e.date < tk; }).reduce(function (a, e) { return a + n(e.amount); }, 0);
    var today = ex.filter(function (e) { return e.date === tk; }).reduce(function (a, e) { return a + n(e.amount); }, 0);
    var daysLeft = Math.round((fromKey(tr.end || tr.start) - fromKey(tk)) / 864e5) + 1;
    var perDay = (n(tr.budget) - booked - before) / Math.max(1, daysLeft);
    return { trip: tr, perDay: perDay, spentToday: today, left: perDay - today, daysLeft: daysLeft };
  }
  window.TripBudget = { today: tripToday };
  window.BriefExtra.push(function (add) {
    var t = tripToday(); if (!t) return;
    var nm = t.trip.name || t.trip.dest || 'Trip';
    add(6, 'cash-coin', t.left < 0 ? '#e66767' : '#0891b2', t.left < 0 ? nm + ': ' + kr(-t.left) + ' over today' : nm + ': ' + kr(t.left) + ' left today',
      (t.perDay > 0 ? kr(t.perDay) + ' a day' : 'Budget used') + ' · ' + t.daysLeft + ' day' + (t.daysLeft === 1 ? '' : 's') + ' left', '/cmd/travel/#trip=' + t.trip.id);
  });

  /* ================= Rest-day advisor ================= */
  function readiness() {
    if (!on('rest')) return null;
    var D = ((window.Vault.get() || {}).health || {}).days || {}, now = new Date(), tk = dkey(now);
    var day = D[tk] || D[addDays(tk, -1)] || null;
    function base(f) { var v = []; for (var i = 1; i <= 15; i++) { var x = D[addDays(tk, -i)]; if (x && x[f] != null) v.push(+x[f]); } return v.length >= 4 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
    var why = [], score = 100, data = 0;
    if (day && day.hrv != null) { data++; var bh = base('hrv'); if (bh) { var drop = (bh - day.hrv) / bh * 100; if (drop > 5) { score -= Math.min(40, drop * 1.5); why.push('HRV ' + Math.round(drop) + ' % below your normal'); } else if (drop < -5) why.push('HRV above your normal'); } }
    if (day && day.rhr != null) { data++; var br = base('rhr'); if (br) { var rise = day.rhr - br; if (rise > 2) { score -= Math.min(25, rise * 4); why.push('Resting pulse +' + Math.round(rise) + ' bpm'); } } }
    if (day && day.sleep != null) { data++; if (day.sleep < 7) { score -= (7 - day.sleep) * 12; why.push('Slept ' + String(Math.round(day.sleep * 10) / 10).replace('.', ',') + ' h'); } else why.push('Slept well'); }
    /* training: days in a row with a workout or a gym session */
    var trained = {};
    if (Fe) { (Fe.tools().training || []).forEach(function (w) { trained[w.date] = 1; }); (Fe.tools().gym || []).forEach(function (s) { trained[s.date] = 1; }); }
    var streak = 0; for (var i = 1; i <= 7; i++) { if (trained[addDays(tk, -i)]) streak++; else break; }
    if (streak >= 3) { score -= streak >= 4 ? 25 : 15; why.push(streak + ' training days in a row'); }
    if (!data && !streak) return { score: null, level: 'none', why: [] };
    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score: score, level: score >= 75 ? 'go' : score >= 55 ? 'easy' : 'rest', why: why, streak: streak };
  }
  window.Readiness = readiness;
  window.BriefExtra.push(function (add) {
    var r = readiness(); if (!r || r.score == null || r.level === 'go') return;
    add(r.level === 'rest' ? 11 : 32, 'battery-half', r.level === 'rest' ? '#e66767' : '#c98500', r.level === 'rest' ? 'Take a rest day' : 'Go easy today', r.why.slice(0, 2).join(' · ') + ' · readiness ' + r.score, '/cmd/habits/#rest', { key: 'rest:' + dkey(new Date()) });
  });

  /* ---------- clicks on At a glance lines ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#prep"], a[href="#shutdown"]');
    if (!a) return;
    e.preventDefault();
    var h = a.getAttribute('href').slice(1);
    if (h === 'shutdown') shutdown(); else if (prepFor[h]) showPrep(prepFor[h]);
  });

  function refresh() { voiceButton(); calButton(); }
  window.addEventListener('features:change', function () { refresh(); window.dispatchEvent(new Event('brief:refresh')); });
  window.Vault.onUnlock(function () { setTimeout(refresh, 80); });
  refresh();
  window.Life = { shutdown: shutdown, findTime: findTime, listen: listen, readiness: readiness };
})();
} catch (e) { console.error("life.js", e); }
/* ===== life-pages.js ===== */
try {
/* Optional cards on the pages they belong to (Settings → Features):
     Finances   Strømpris (hour-by-hour price in NO1), Savings jars
     Work       FDV inspection notes (findings with TG, a summary to send), Holiday planner
     Health     Gym log (sets × reps × kg, progress, next weight), Rest-day advisor
     Travel     Smart packing (from the trip's length and weather)
   Each mounts into a [data-tool="…"] box in the page, like the other tools. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, K = window.Kit;
  if (!Fe) return;
  function on(k) { return Fe.on(k); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function card(id, icon, title, actions, body, cls) {
    return '<section class="card kit-card lp-card ' + (cls || '') + '" id="' + id + '"><div class="card-head"><h2><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h2>' +
      (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>' + body + '</section>';
  }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + esc(label).replace(/\b(19|20)\d\d\b/g, 'Y') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  var mounts = [];
  function mount(name, render) {
    var el = $t(name); if (!el) return;
    function draw() { var ok = on(name); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; } render(el); }
    mounts.push(draw);
  }
  function drawAll() { mounts.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  ['tools:change', 'features:change', 'fin:change', 'habits:change', 'health:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawAll.t); drawAll.t = setTimeout(drawAll, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawAll, 60); });

  /* ======================= Strømpris (NO1) ======================= */
  var PW = { day: 'today' }, pwLoading = {};
  function pwKey(k) { return 'pw:' + k; }
  function prices(k) {
    var c = readJSON('dash.power', {}) || {};
    if (c[k]) return c[k];
    if (pwLoading[k]) return null;
    pwLoading[k] = true;
    var d = fromKey(k), url = 'https://www.hvakosterstrommen.no/api/v1/prices/' + d.getFullYear() + '/' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_NO1.json';
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (l) {
      /* by the hour (the market gives 15-minute prices since autumn 2025) – incl. 25 % VAT, in øre */
      var h = []; for (var i = 0; i < 24; i++) h.push([]);
      l.forEach(function (x) { var t = new Date(x.time_start); if (dkey(t) === k) h[t.getHours()].push(x.NOK_per_kWh * 125); });
      var out = h.map(function (v) { return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; });
      var cc = readJSON('dash.power', {}) || {}; Object.keys(cc).forEach(function (x) { if (x < addDays(dkey(new Date()), -2)) delete cc[x]; });
      cc[k] = out; try { localStorage.setItem('dash.power', JSON.stringify(cc)); } catch (e) {}
      pwLoading[k] = false; drawAll(); window.dispatchEvent(new Event('brief:refresh'));
    }).catch(function () { pwLoading[k] = 'fail'; drawAll(); });
    return null;
  }
  function cheapest(h, len, from) {
    var best = null;
    for (var i = from || 0; i + len <= 24; i++) {
      var v = h.slice(i, i + len); if (v.some(function (x) { return x == null; })) continue;
      var a = v.reduce(function (s, x) { return s + x; }, 0) / len;
      if (!best || a < best.avg) best = { h: i, avg: a };
    }
    return best;
  }
  function support(p) { return p - .9 * Math.max(0, p - 93.75); }     // strømstøtte: 90 % above 93,75 øre incl. VAT
  mount('power', function (el) {
    var now = new Date(), tk = dkey(now), tom = addDays(tk, 1), k = PW.day === 'tomorrow' ? tom : tk;
    var h = prices(k), hTom = now.getHours() >= 13 ? prices(tom) : null;
    var cfg = (Fe.tools().powercfg) || {};
    var acts = '<div class="seg lp-seg"><button type="button" data-pwday="today" aria-pressed="' + (PW.day === 'today') + '">Today</button>' +
      (hTom || PW.day === 'tomorrow' ? '<button type="button" data-pwday="tomorrow" aria-pressed="' + (PW.day === 'tomorrow') + '">Tomorrow</button>' : '') + '</div>';
    if (!h) { el.innerHTML = card('power', 'lightning-charge', 'Strømpris', '', '<p class="muted">' + (pwLoading[k] === 'fail' ? 'Couldn’t reach the price service right now – try again later.' : 'Getting today’s prices …') + '</p>'); return; }
    var valid = h.filter(function (x) { return x != null; }), avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
    var max = Math.max.apply(null, valid), min = Math.min.apply(null, valid), cur = k === tk ? h[now.getHours()] : null;
    var c3 = cheapest(h, 3, k === tk ? now.getHours() : 0), exp = h.indexOf(max);
    var lvl = function (p) { return p <= avg * .85 ? 'cheap' : p >= avg * 1.2 ? 'dear' : 'mid'; };
    var big = cur != null ? cur : avg;
    var body = '<div class="pw-now"><div><span class="muted">' + (cur != null ? 'Now, ' + pad(now.getHours()) + '–' + pad((now.getHours() + 1) % 24) : 'Average ' + (k === tom ? 'tomorrow' : 'today')) + '</span>' +
      '<b class="pw-big">' + nf.format(Math.round(big)) + ' <small>øre/kWh</small></b>' +
      '<span class="pw-lvl ' + lvl(big) + '">' + ({ cheap: 'Cheap', mid: 'Normal', dear: 'Expensive' })[lvl(big)] + '</span>' +
      (cfg.norgespris ? '<small class="muted">You pay 50 øre with Norgespris</small>' : big > 93.75 ? '<small class="muted">≈ ' + nf.format(Math.round(support(big))) + ' øre after strømstøtte</small>' : '') + '</div>' +
      '<div class="pw-side"><span><i class="bi bi-arrow-down-circle"></i> Cheapest ' + (c3 ? pad(c3.h) + '–' + pad(c3.h + 3) + ' · ' + nf.format(Math.round(c3.avg)) + ' øre' : '–') + '</span>' +
      '<span><i class="bi bi-arrow-up-circle"></i> Most expensive ' + pad(exp) + '–' + pad((exp + 1) % 24) + ' · ' + nf.format(Math.round(max)) + ' øre</span>' +
      '<span><i class="bi bi-dash-circle"></i> Average ' + nf.format(Math.round(avg)) + ' øre</span></div></div>' +
      '<div class="pw-bars" role="img" aria-label="Price per hour">' + h.map(function (p, i) {
        var inC = c3 && i >= c3.h && i < c3.h + 3, isNow = k === tk && i === now.getHours();
        return '<i class="' + (p == null ? 'na ' : '') + lvl(p || avg) + (inC ? ' best' : '') + (isNow ? ' now' : '') + (k === tk && i < now.getHours() ? ' past' : '') + '" style="--h:' + (p == null ? 2 : Math.max(4, Math.round(p / max * 100))) + '%" title="' + pad(i) + ':00 · ' + (p == null ? '–' : nf.format(Math.round(p)) + ' øre') + '"></i>';
      }).join('') + '</div><div class="pw-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
      '<p class="kit-foot">Spot price in NO1 with VAT, before grid rent (nettleie). Prices from hvakosterstrommen.no. <label class="lp-inl"><input type="checkbox" data-pwnorge' + (cfg.norgespris ? ' checked' : '') + '> I have Norgespris</label></p>';
    el.innerHTML = card('power', 'lightning-charge', 'Strømpris', acts, body, 'lp-power');
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-pwday]'); if (b) { PW.day = b.dataset.pwday; drawAll(); } });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-pwnorge]')) { var t = Fe.tools(); t.powercfg = Object.assign({}, t.powercfg, { norgespris: e.target.checked }); Fe.saveTools(t); } });
  /* At a glance: tell when it's cheap now, or very expensive */
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    if (!on('power')) return;
    var tk = dkey(now), h = prices(tk); if (!h) return;
    var cfg = Fe.tools().powercfg || {}; if (cfg.norgespris) return;
    var c3 = cheapest(h, 3, now.getHours()), cur = h[now.getHours()];
    if (c3 && c3.h === now.getHours()) add(36, 'lightning-charge', '#22b35e', 'Cheap power now – ' + nf.format(Math.round(cur)) + ' øre', 'Good time to wash, dry or charge · until ' + pad(c3.h + 3) + ':00', '/cmd/finance/#power');
    else if (c3 && now.getHours() >= 17 && now.getHours() < 23) add(48, 'lightning-charge', '#c98500', 'Cheapest power ' + pad(c3.h) + '–' + pad(c3.h + 3), nf.format(Math.round(c3.avg)) + ' øre/kWh · now ' + nf.format(Math.round(cur)) + ' øre', '/cmd/finance/#power');
  });

  /* ======================= Savings jars ======================= */
  var svList = document.getElementById('svList');
  function jars() {
    if (!svList) return;
    var want = on('jars'); svList.classList.toggle('sv-jars', want);
    if (!want) return;
    var d = window.Vault.get() || {}, B = window.Budget;
    svList.querySelectorAll('li.goal[data-id]').forEach(function (li) {
      var g = (d.savings || []).filter(function (x) { return x.id === li.dataset.id; })[0]; if (!g) return;
      var pct = g.target > 0 ? Math.min(1, (+g.saved || 0) / g.target) : 0;
      var mo = B && B.saveMonthly ? B.saveMonthly(g) : 0, left = Math.max(0, (+g.target || 0) - (+g.saved || 0));
      var weeks = pct >= 1 ? 0 : mo > 0 ? Math.ceil(left / (mo / 4.345)) : null;
      var j = li.querySelector('.jar');
      var html = '<svg viewBox="0 0 60 76" aria-hidden="true"><defs><clipPath id="jc' + esc(g.id) + '"><path d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/></clipPath></defs>' +
        '<rect class="jar-lid" x="10" y="3" width="40" height="9" rx="3"/><g clip-path="url(#jc' + esc(g.id) + ')"><rect class="jar-glass" x="0" y="0" width="60" height="76"/><rect class="jar-fill" x="0" y="' + (74 - 60 * pct).toFixed(1) + '" width="60" height="76"/></g>' +
        '<path class="jar-edge" d="M12 14h36v6c6 3 8 8 8 14v30c0 6-4 10-10 10H14C8 74 4 70 4 64V34c0-6 2-11 8-14z"/><text x="30" y="52" text-anchor="middle">' + Math.round(pct * 100) + '%</text></svg>' +
        '<small class="jar-weeks">' + (pct >= 1 ? 'Full 🎉' : weeks != null ? weeks + ' week' + (weeks === 1 ? '' : 's') + ' to go' : kr(left) + ' to go') + '</small>';
      if (!j) { j = document.createElement('div'); j.className = 'jar'; li.insertBefore(j, li.firstChild); }
      if (j.innerHTML !== html) j.innerHTML = html;
    });
  }
  if (svList) { new MutationObserver(function () { if (on('jars') && svList.querySelector('li.goal:not(:has(.jar))')) jars(); }).observe(svList, { childList: true }); mounts.push(jars); }

  /* ======================= FDV inspection notes ======================= */
  var PARTS = ['Roof', 'Facade', 'Windows and doors', 'Wet rooms', 'Kitchen', 'Electrical', 'Plumbing (VVS)', 'Ventilation', 'Heating', 'Fire safety', 'Structure', 'Outdoor areas', 'Other'];
  var TG = { 0: ['TG 0', 'No issues', '#22b35e'], 1: ['TG 1', 'Minor issues', '#3987e5'], 2: ['TG 2', 'Significant issues', '#c98500'], 3: ['TG 3', 'Serious issues', '#e66767'], iu: ['TG IU', 'Not examined', '#8b8f9a'] };
  /* photos stay on this device (IndexedDB), the text is in your synced vault */
  var idb = null;
  function db() { return idb || (idb = new Promise(function (res, rej) { var r = indexedDB.open('dash-fdv', 1); r.onupgradeneeded = function () { r.result.createObjectStore('photos'); }; r.onsuccess = function () { res(r.result); }; r.onerror = rej; })); }
  function putPhoto(id, blob) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('photos', 'readwrite'); t.objectStore('photos').put(blob, id); t.oncomplete = res; }); }); }
  function getPhoto(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('photos').objectStore('photos').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function delPhoto(id) { return db().then(function (d) { d.transaction('photos', 'readwrite').objectStore('photos').delete(id); }).catch(function () {}); }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { b ? res(b) : rej(); }, 'image/jpeg', .82); URL.revokeObjectURL(img.src); };
      img.onerror = rej; img.src = URL.createObjectURL(file);
    });
  }
  var fdvOpen = null;
  function summary(r) {
    var f = r.findings || [], by = function (t) { return f.filter(function (x) { return String(x.tg) === t; }); };
    var lines = ['FDV inspection – ' + (r.building || ''), [r.address, fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' }), r.client ? 'For ' + r.client : ''].filter(Boolean).join(' · '), ''];
    lines.push('Summary: ' + ['3', '2', '1', '0', 'iu'].map(function (t) { return by(t).length ? by(t).length + ' × ' + TG[t][0] : ''; }).filter(Boolean).join(', '), '');
    ['3', '2', '1', 'iu', '0'].forEach(function (t) {
      if (!by(t).length) return;
      lines.push(TG[t][0] + ' – ' + TG[t][1]);
      by(t).forEach(function (x) { lines.push('• ' + x.part + ': ' + x.text + (x.action ? ' → ' + x.action : '')); });
      lines.push('');
    });
    if (r.notes) lines.push('Notes: ' + r.notes);
    return lines.join('\n').trim();
  }
  mount('fdv', function (el) {
    var list = (Fe.list('fdv') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var body = list.length ? '<ul class="kit-list">' + list.map(function (r) {
      var f = r.findings || [], worst = ['3', '2', '1', '0'].filter(function (t) { return f.some(function (x) { return String(x.tg) === t; }); })[0];
      var open = fdvOpen === r.id;
      return '<li class="kit-item' + (open ? ' open' : '') + '"><button type="button" class="kit-main" data-fdvopen="' + esc(r.id) + '"><span class="kit-ic" style="--c:' + (worst ? TG[worst][2] : '#0891b2') + '"><i class="bi bi-building-check"></i></span>' +
        '<span class="kit-x"><b>' + esc(r.building) + '</b><small>' + esc([fmt(r.date), r.address, f.length + ' finding' + (f.length === 1 ? '' : 's')].filter(Boolean).join(' · ')) + '</small></span>' +
        (worst ? '<span class="kit-r"><span class="tg-b" style="--c:' + TG[worst][2] + '">' + TG[worst][0] + '</span></span>' : '') + '</button>' +
        (open ? fdvDetail(r) : '') + '</li>';
    }).join('') + '</ul>' : '<p class="empty kit-empty">Walk a building, note each finding with its condition grade (TG) and a photo – and get a tidy summary you can send or paste into a report.</p>';
    el.innerHTML = card('fdv', 'building-check', 'FDV inspection notes', '<button type="button" class="text-btn" data-fdvnew><i class="bi bi-plus-lg"></i> New</button>', body, 'lp-fdv');
    el.querySelectorAll('img[data-ph]').forEach(function (im) { getPhoto(im.dataset.ph).then(function (b) { if (b) im.src = URL.createObjectURL(b); else im.closest('.fdv-ph').remove(); }); });
  });
  function fdvDetail(r) {
    var f = r.findings || [];
    return '<div class="kit-detail fdv-detail">' +
      (f.length ? '<ul class="fdv-list">' + f.map(function (x) {
        return '<li><span class="tg-b" style="--c:' + TG[x.tg][2] + '">' + TG[x.tg][0] + '</span><div><b>' + esc(x.part) + '</b> ' + esc(x.text) + (x.action ? '<small>→ ' + esc(x.action) + '</small>' : '') +
          (x.photo ? '<span class="fdv-ph"><img data-ph="' + esc(x.photo) + '" alt="Photo: ' + esc(x.part) + '"></span>' : '') + '</div>' +
          '<button type="button" class="icon-btn sm" data-fdvdel="' + esc(r.id) + ':' + esc(x.id) + '" aria-label="Remove finding"><i class="bi bi-x"></i></button></li>';
      }).join('') + '</ul>' : '<p class="muted">No findings yet – add the first one below.</p>') +
      '<form class="fdv-add" data-fdvadd="' + esc(r.id) + '"><div class="row2"><select name="part" aria-label="Building part">' + PARTS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select>' +
      '<select name="tg" aria-label="Condition grade">' + ['0', '1', '2', '3', 'iu'].map(function (t) { return '<option value="' + t + '"' + (t === '2' ? ' selected' : '') + '>' + TG[t][0] + ' – ' + TG[t][1] + '</option>'; }).join('') + '</select></div>' +
      '<input name="text" placeholder="What you found, e.g. Cracked sealant around window, 2nd floor" required maxlength="300">' +
      '<input name="action" placeholder="What should be done (optional)" maxlength="200">' +
      '<div class="fdv-row"><label class="text-btn fdv-photo"><i class="bi bi-camera"></i> <span>Photo</span><input type="file" name="photo" accept="image/*" capture="environment" hidden></label><span class="spacer"></span><button type="submit" class="pill-btn"><i class="bi bi-plus-lg"></i> Add finding</button></div></form>' +
      (r.notes ? '<p class="kit-notes">' + esc(r.notes) + '</p>' : '') +
      '<div class="fdv-acts"><button type="button" class="text-btn" data-fdvcopy="' + esc(r.id) + '"><i class="bi bi-clipboard"></i> Copy summary</button>' +
      (navigator.share ? '<button type="button" class="text-btn" data-fdvshare="' + esc(r.id) + '"><i class="bi bi-share"></i> Share</button>' : '') +
      '<button type="button" class="text-btn" data-fdvtodo="' + esc(r.id) + '"><i class="bi bi-box-arrow-in-right"></i> TG 2–3 to to-do</button>' +
      '<button type="button" class="text-btn" data-fdvedit="' + esc(r.id) + '"><i class="bi bi-pencil"></i> Edit</button></div></div>';
  }
  var FDV_FIELDS = { key: 'fdv', addTitle: 'New inspection', editTitle: 'Edit inspection', fields: [
    { k: 'building', type: 'title', label: 'Building', ph: 'Building or property, e.g. Storgata 12', req: true },
    { k: 'address', label: 'Address', ph: 'Street, town' }, { k: 'date', label: 'Date', type: 'date', req: true, def: function () { return dkey(new Date()); } },
    { k: 'client', label: 'Client', ph: 'Who it’s for' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }],
    beforeSave: function (it) { it.findings = it.findings || []; }, afterSave: function (it, isNew) { if (isNew) fdvOpen = it.id; },
    onDelete: function (it) { (it.findings || []).forEach(function (x) { if (x.photo) delPhoto(x.photo); }); } };
  function saveFdv(id, fn) { var t = Fe.tools(); (t.fdv || []).forEach(function (r) { if (r.id === id) fn(r); }); Fe.saveTools(t); }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-fdvnew]') && K) return K.edit(FDV_FIELDS, null);
    if ((b = e.target.closest('[data-fdvedit]')) && K) return K.edit(FDV_FIELDS, Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvedit; })[0]);
    if ((b = e.target.closest('[data-fdvopen]'))) { fdvOpen = fdvOpen === b.dataset.fdvopen ? null : b.dataset.fdvopen; drawAll(); return; }
    if ((b = e.target.closest('[data-fdvdel]'))) {
      var q = b.dataset.fdvdel.split(':'), gone = null;
      saveFdv(q[0], function (r) { r.findings = (r.findings || []).filter(function (x) { if (x.id === q[1]) { gone = x; return false; } return true; }); });
      toast('<i class="bi bi-trash3"></i> Finding removed', function () { saveFdv(q[0], function (r) { r.findings.push(gone); }); });
      return;
    }
    var r;
    if ((b = e.target.closest('[data-fdvcopy]'))) { r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvcopy; })[0]; if (r && navigator.clipboard) navigator.clipboard.writeText(summary(r)).then(function () { toast('<i class="bi bi-clipboard-check"></i> Summary copied'); }); return; }
    if ((b = e.target.closest('[data-fdvshare]'))) {
      r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvshare; })[0]; if (!r) return;
      var ids = (r.findings || []).filter(function (x) { return x.photo; });
      Promise.all(ids.map(function (x) { return getPhoto(x.photo).then(function (bl) { return bl ? new File([bl], (x.part + '-' + x.id).replace(/[^\w-]+/g, '_') + '.jpg', { type: 'image/jpeg' }) : null; }); })).then(function (files) {
        files = files.filter(Boolean);
        var data = { title: 'FDV – ' + r.building, text: summary(r) };
        if (files.length && navigator.canShare && navigator.canShare({ files: files })) data.files = files;
        navigator.share(data).catch(function () {});
      });
      return;
    }
    if ((b = e.target.closest('[data-fdvtodo]'))) {
      r = Fe.list('fdv').filter(function (x) { return x.id === b.dataset.fdvtodo; })[0]; if (!r) return;
      var todos = readJSON('dash.todos', []) || [], n = 0;
      (r.findings || []).filter(function (x) { return x.tg === '2' || x.tg === '3'; }).forEach(function (x) { todos.push({ id: uid(), text: (r.building + ': ' + x.part + ' – ' + (x.action || x.text)).slice(0, 200), done: false, focus: x.tg === '3' }); n++; });
      writeJSON('dash.todos', todos); window.dispatchEvent(new Event('todos:change'));
      toast('<i class="bi bi-check2-square"></i> ' + n + ' task' + (n === 1 ? '' : 's') + ' added to your to-do list');
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'photo' && e.target.closest('.fdv-add')) { var l = e.target.closest('label'); l.classList.toggle('has', !!e.target.files.length); l.querySelector('span').textContent = e.target.files.length ? 'Photo ✓' : 'Photo'; }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-fdvadd]'); if (!f) return;
    e.preventDefault();
    var id = f.dataset.fdvadd, fid = uid(), file = f.photo.files[0];
    var item = { id: fid, part: f.part.value, tg: f.tg.value, text: f.text.value.trim(), action: f.action.value.trim() };
    if (!item.text) return;
    var go = function () { saveFdv(id, function (r) { r.findings = r.findings || []; r.findings.push(item); }); };
    if (file) shrink(file).then(function (bl) { item.photo = 'ph-' + fid; return putPhoto(item.photo, bl); }).then(go, go); else go();
  });

  /* ======================= Holiday planner ======================= */
  function offDay(k) { var d = fromKey(k).getDay(); return d === 0 || d === 6 || !!Fe.holiday(k); }
  function breaks() {
    var today = dkey(new Date()), out = [], seen = {};
    for (var i = 1; i < 380; i++) {
      var k = addDays(today, i), h = Fe.holiday(k);
      if (!h || fromKey(k).getDay() % 6 === 0 || seen[h.name + k.slice(0, 4)]) continue;
      if (out.length && k <= addDays(out[out.length - 1].b, 2)) continue;          // part of the break just found (Easter, Christmas)
      seen[h.name + k.slice(0, 4)] = 1;
      /* every way to use 1–5 work days next to this holiday; keep the best ratio, then the longest */
      var best = null;
      for (var s = -6; s <= 0; s++) for (var len = 1; len <= 9; len++) {
        var from = addDays(k, s), to = addDays(from, len - 1); if (from <= today) continue;
        if (to < k) continue;
        var used = 0, j; for (j = 0; j < len; j++) if (!offDay(addDays(from, j))) used++;
        if (!used || used > 5) continue;
        var a = from, b = to; while (offDay(addDays(a, -1))) a = addDays(a, -1); while (offDay(addDays(b, 1))) b = addDays(b, 1);
        var total = Math.round((fromKey(b) - fromKey(a)) / 864e5) + 1, sc = total / used;
        if (total < 4) continue;
        if (sc < 2.5) continue;
        var wd = workDays(from, to);
        /* the longest break that still gives 2,5+ days off per day used; equal length → fewer days used */
        if (!best || total > best.total || (total === best.total && used < best.used)) best = { sc: sc, total: total, used: used, a: a, b: b, take: wd[0], takeTo: wd[wd.length - 1], name: h.name };
      }
      if (best) out.push(best);
    }
    var uniq = {}; return out.filter(function (x) { var u = x.a + x.b; if (uniq[u]) return false; uniq[u] = 1; return true; }).slice(0, 6);
  }
  function workDays(a, b) { var l = [], k = a; while (k <= b) { if (!offDay(k)) l.push(k); k = addDays(k, 1); } return l; }
  mount('holiday', function (el) {
    var y = dkey(new Date()).slice(0, 4), cfg = Fe.tools().holidaycfg || {};
    var total = on('flex') ? (+((Fe.tools().flexcfg || {}).vacation) || 25) : (+cfg.total || 25);
    var used = on('flex') ? Fe.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length : (+cfg.used || 0);
    var planned = (cfg.plans || []).filter(function (p) { return p.take.slice(0, 4) === y && p.take > dkey(new Date()); }).reduce(function (a, p) { return a + p.used; }, 0);
    var next = null; for (var i = 0; i < 370 && !next; i++) { var k = addDays(dkey(new Date()), i), h = Fe.holiday(k); if (h) next = { k: k, h: h }; }
    var br = breaks();
    var body = '<div class="kit-tiles">' + tile('Days left ' + y, (total - used - planned) + ' <small>/ ' + total + '</small>', used + ' used' + (planned ? ' · ' + planned + ' planned' : '')) +
      (next ? tile('Next public holiday', esc(next.h.name), fmt(next.k, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' +
      '<h3 class="lp-h3">Longest breaks for the fewest days</h3>' +
      (br.length ? '<ul class="hp-list">' + br.map(function (x) {
        var plannedAlready = (cfg.plans || []).some(function (p) { return p.take === x.take; });
        return '<li><div class="hp-ratio"><b>' + x.total + '</b><small>days off</small></div><div class="hp-x"><b>' + esc(x.name) + '</b><span>Take ' + x.used + ' day' + (x.used === 1 ? '' : 's') + ': ' + esc(fmt(x.take, { weekday: 'short', day: 'numeric', month: 'short' })) + (x.takeTo !== x.take ? ' – ' + esc(fmt(x.takeTo, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</span><small>Off ' + esc(fmt(x.a, { weekday: 'short', day: 'numeric', month: 'short' })) + ' – ' + esc(fmt(x.b, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small></div>' +
          (plannedAlready ? '<span class="kit-badge">In calendar</span>' : '<button type="button" class="text-btn" data-hpplan="' + x.take + '|' + x.takeTo + '|' + x.a + '|' + x.b + '|' + x.used + '|' + esc(x.name) + '"><i class="bi bi-calendar-plus"></i> Plan it</button>') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">No clever breaks in the next 12 months.</p>') +
      (on('flex') ? '' : '<p class="kit-foot">Holiday days a year: <input class="lp-num" type="number" min="0" max="60" value="' + total + '" data-hpcfg="total" aria-label="Holiday days a year"> · used so far: <input class="lp-num" type="number" min="0" max="60" value="' + used + '" data-hpcfg="used" aria-label="Holiday days used"></p>');
    el.innerHTML = card('holiday', 'sun', 'Holiday planner', '', body, 'lp-holiday');
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hpplan]'); if (!b) return;
    var q = b.dataset.hpplan.split('|'), cal = readJSON('dash.calendar', null) || { events: [], hidden: {}, feeds: [] };
    cal.events = cal.events || [];
    var ev = { id: uid(), title: 'Ferie – ' + q[5], cat: 'personal', date: q[2], end: q[3], allDay: true };
    cal.events.push(ev); writeJSON('dash.calendar', cal); window.dispatchEvent(new Event('cal:change'));
    var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg.plans = (t.holidaycfg.plans || []).concat([{ take: q[0], takeTo: q[1], used: +q[4], ev: ev.id }]);
    if (on('flex')) workDays(q[0], q[1]).forEach(function (k) { t.flex = t.flex || []; t.flex.push({ id: uid(), date: k, type: 'vacation' }); });
    Fe.saveTools(t);
    toast('<i class="bi bi-sun"></i> ' + esc(q[5]) + ' break in your calendar' + (on('flex') ? ' and flex time' : ''));
  });
  document.addEventListener('change', function (e) { var c = e.target.dataset && e.target.dataset.hpcfg; if (!c) return; var t = Fe.tools(); t.holidaycfg = t.holidaycfg || {}; t.holidaycfg[c] = +e.target.value || 0; Fe.saveTools(t); });

  /* ======================= Gym log ======================= */
  var EX = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups', 'Lat pulldown', 'Leg press', 'Lunges', 'Romanian deadlift', 'Biceps curl', 'Triceps pushdown', 'Dips', 'Seated row', 'Leg curl', 'Calf raise', 'Plank'];
  function sessions() { return (Fe.list('gym') || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function e1rm(s) { return (+s.kg || 0) * (1 + (+s.r || 0) / 30); }
  function history(name) {
    var out = []; sessions().slice().reverse().forEach(function (s) { (s.ex || []).forEach(function (x) { if (x.n.toLowerCase() === name.toLowerCase() && x.sets && x.sets.length) out.push({ date: s.date, sets: x.sets, best: Math.max.apply(null, x.sets.map(e1rm)) }); }); });
    return out;
  }
  /* last time + a suggestion: all sets reached the reps → a bit heavier */
  function suggest(name) {
    var h = history(name); if (!h.length) return null;
    var last = h[h.length - 1], top = Math.max.apply(null, last.sets.map(function (s) { return +s.kg || 0; }));
    var topSets = last.sets.filter(function (s) { return (+s.kg || 0) === top; }), reps = Math.min.apply(null, topSets.map(function (s) { return +s.r || 0; }));
    var step = top >= 40 ? 2.5 : top >= 10 ? 1 : .5, up = reps >= 8;
    return { last: last, text: topSets.length + '×' + reps + ' @ ' + nf1.format(top) + ' kg', next: up ? top + step : top, reps: up ? Math.max(5, reps - 2) : reps + 1, up: up };
  }
  mount('gym', function (el) {
    var l = sessions(), tk = dkey(new Date()), mon = addDays(tk, -((new Date().getDay() + 6) % 7));
    var wk = l.filter(function (s) { return s.date >= mon; }), vol = 0;
    wk.forEach(function (s) { (s.ex || []).forEach(function (x) { (x.sets || []).forEach(function (t) { vol += (+t.r || 0) * (+t.kg || 0); }); }); });
    var names = {}; l.forEach(function (s) { (s.ex || []).forEach(function (x) { names[x.n] = (names[x.n] || 0) + 1; }); });
    var top = Object.keys(names).sort(function (a, b) { return names[b] - names[a]; }).slice(0, 5);
    var prs = 0; top.forEach(function (n) { var h = history(n); if (h.length > 1 && h[h.length - 1].best >= Math.max.apply(null, h.slice(0, -1).map(function (x) { return x.best; })) && h[h.length - 1].date >= addDays(tk, -30)) prs++; });
    var body = '<div class="kit-tiles">' + tile('This week', wk.length, 'session' + (wk.length === 1 ? '' : 's')) + tile('Volume', nf.format(Math.round(vol)) + ' <small>kg</small>', 'this week') + tile('New bests', prs, 'last 30 days') + '</div>' +
      (top.length ? '<h3 class="lp-h3">Progress</h3><ul class="gym-prog">' + top.map(function (n) {
        var h = history(n).slice(-10), mx = Math.max.apply(null, h.map(function (x) { return x.best; })), mn = Math.min.apply(null, h.map(function (x) { return x.best; })), sg = suggest(n);
        var pts = h.map(function (x, i) { return (h.length === 1 ? 50 : i / (h.length - 1) * 100).toFixed(1) + ',' + (mx === mn ? 50 : 90 - (x.best - mn) / (mx - mn) * 80).toFixed(1); }).join(' ');
        return '<li><div class="gym-x"><b>' + esc(n) + '</b><small>' + esc(sg ? 'Last ' + sg.text : '') + '</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" class="gym-spark" aria-hidden="true"><polyline points="' + pts + '"/></svg>' +
          '<div class="gym-next"><small>Next</small><b>' + (sg ? nf1.format(sg.next) + ' kg × ' + sg.reps : '–') + '</b></div></li>';
      }).join('') + '</ul>' : '') +
      (l.length ? '<h3 class="lp-h3">Recent</h3><ul class="kit-list">' + l.slice(0, 4).map(function (s) { return '<li class="kit-item"><button type="button" class="kit-main" data-gymedit="' + esc(s.id) + '"><span class="kit-ic" style="--c:#d55181"><i class="bi bi-person-arms-up"></i></span><span class="kit-x"><b>' + esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</b><small>' + esc((s.ex || []).map(function (x) { return x.n + ' ' + (x.sets || []).length + '×'; }).join(' · ')) + '</small></span></button></li>'; }).join('') + '</ul>' :
        '<p class="empty kit-empty">Log sets, reps and kilos per exercise. It shows your progress and suggests the weight for next time.</p>');
    el.innerHTML = card('gym', 'person-arms-up', 'Gym log', '<button type="button" class="text-btn" data-gymstart><i class="bi bi-play-fill"></i> Start workout</button>', body, 'lp-gym');
  });
  function gymSheet(sess) {
    var s = sess ? JSON.parse(JSON.stringify(sess)) : { id: uid(), date: dkey(new Date()), ex: [] }, isNew = !sess;
    var bg = document.createElement('div'); bg.className = 'fo-bg lf-bg';
    bg.innerHTML = '<div class="fo-box lf-box gym-box" role="dialog" aria-modal="true" aria-label="Workout"></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var box = bg.firstChild;
    function close() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape' && !e.target.closest('input')) { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    function draw() {
      box.innerHTML = '<div class="lf-head"><h3><i class="bi bi-person-arms-up"></i> ' + (isNew ? 'Workout' : 'Edit workout') + '</h3><button type="button" class="icon-btn sm" data-gclose aria-label="Close"><i class="bi bi-x-lg"></i></button></div>' +
        '<label class="gym-date">Date <input type="date" data-gdate value="' + s.date + '"></label>' +
        s.ex.map(function (x, xi) {
          var sg = suggest(x.n);
          return '<section class="gym-ex"><div class="gym-exh"><b>' + esc(x.n) + '</b>' + (sg ? '<small>Last ' + esc(sg.text) + ' · try <b>' + nf1.format(sg.next) + ' kg × ' + sg.reps + '</b>' + (sg.up ? ' ↑' : '') + '</small>' : '') + '<button type="button" class="icon-btn sm" data-gexdel="' + xi + '" aria-label="Remove ' + esc(x.n) + '"><i class="bi bi-trash3"></i></button></div>' +
            '<div class="gym-sets">' + x.sets.map(function (t, si) {
              return '<div class="gym-set"><span>' + (si + 1) + '</span><input inputmode="numeric" data-gs="' + xi + ':' + si + ':r" value="' + esc(t.r) + '" aria-label="Reps"><em>reps</em><input inputmode="decimal" data-gs="' + xi + ':' + si + ':kg" value="' + esc(t.kg) + '" aria-label="Kilos"><em>kg</em><button type="button" class="icon-btn sm" data-gsdel="' + xi + ':' + si + '" aria-label="Remove set"><i class="bi bi-x"></i></button></div>';
            }).join('') + '</div><button type="button" class="text-btn" data-gsadd="' + xi + '"><i class="bi bi-plus-lg"></i> Set</button></section>';
        }).join('') +
        '<form class="gym-addex"><input list="gymEx" name="n" placeholder="Add exercise, e.g. Bench press" autocomplete="off" maxlength="60"><datalist id="gymEx">' + Object.keys(EX.concat(sessions().reduce(function (a, q) { return a.concat((q.ex || []).map(function (x) { return x.n; })); }, [])).reduce(function (o, n) { o[n] = 1; return o; }, {})).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist><button class="pill-btn" type="submit" aria-label="Add exercise"><i class="bi bi-plus-lg"></i></button></form>' +
        '<div class="lf-foot">' + (isNew ? '<span class="spacer"></span>' : '<button type="button" class="text-btn danger" data-gdel><i class="bi bi-trash3"></i> Delete</button>') + '<button type="button" class="pill-btn wide" data-gsave><i class="bi bi-check2"></i> Save workout</button></div>';
    }
    box.addEventListener('submit', function (e) {
      e.preventDefault(); var n = e.target.n.value.trim(); if (!n) return;
      var sg = suggest(n); s.ex.push({ n: n, sets: [{ r: sg ? sg.reps : 8, kg: sg ? sg.next : '' }] }); draw();
      var last = box.querySelectorAll('[data-gs$=":kg"]'); if (last.length) last[last.length - 1].focus();
    });
    box.addEventListener('input', function (e) { var g = e.target.dataset.gs; if (g) { var q = g.split(':'); s.ex[+q[0]].sets[+q[1]][q[2]] = q[2] === 'kg' ? (num(e.target.value) == null ? '' : num(e.target.value)) : (parseInt(e.target.value, 10) || ''); } if (e.target.matches('[data-gdate]')) s.date = e.target.value || s.date; });
    box.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-gclose]')) return close();
      if ((b = e.target.closest('[data-gsadd]'))) { var x = s.ex[+b.dataset.gsadd], l = x.sets[x.sets.length - 1] || { r: 8, kg: '' }; x.sets.push({ r: l.r, kg: l.kg }); draw(); return; }
      if ((b = e.target.closest('[data-gsdel]'))) { var q = b.dataset.gsdel.split(':'); s.ex[+q[0]].sets.splice(+q[1], 1); if (!s.ex[+q[0]].sets.length) s.ex.splice(+q[0], 1); draw(); return; }
      if ((b = e.target.closest('[data-gexdel]'))) { s.ex.splice(+b.dataset.gexdel, 1); draw(); return; }
      if (e.target.closest('[data-gdel]')) { var t0 = Fe.tools(); t0.gym = (t0.gym || []).filter(function (x) { return x.id !== s.id; }); Fe.saveTools(t0); close(); toast('<i class="bi bi-trash3"></i> Workout deleted', function () { var t1 = Fe.tools(); t1.gym = (t1.gym || []).concat([sess]); Fe.saveTools(t1); }); return; }
      if (e.target.closest('[data-gsave]')) {
        s.ex = s.ex.filter(function (x) { x.sets = x.sets.filter(function (t) { return t.r || t.kg; }); return x.sets.length; });
        if (!s.ex.length) { close(); return; }
        var t = Fe.tools(); t.gym = (t.gym || []).filter(function (x) { return x.id !== s.id; }); t.gym.push(s); Fe.saveTools(t);
        /* tick the training habit for that day */
        var hb = readJSON('dash.habits', null);
        if (hb && hb.list) { var h = hb.list.filter(function (x) { return /train|gym|trening|styrke|strength/i.test(x.name); })[0]; if (h) { hb.log = hb.log || {}; var day = hb.log[s.date] = hb.log[s.date] || []; if (day.indexOf(h.id) < 0) { day.push(h.id); writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); } } }
        close(); toast('<i class="bi bi-person-arms-up"></i> Workout saved – ' + s.ex.length + ' exercise' + (s.ex.length === 1 ? '' : 's'));
      }
    });
    draw();
    var inp = box.querySelector('.gym-addex input'); if (inp && isNew) setTimeout(function () { inp.focus(); }, 40);
  }
  document.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-gymstart]')) return gymSheet(null);
    if ((b = e.target.closest('[data-gymedit]'))) gymSheet(Fe.list('gym').filter(function (x) { return x.id === b.dataset.gymedit; })[0]);
  });

  /* ======================= Rest-day advisor ======================= */
  mount('rest', function (el) {
    var r = window.Readiness ? window.Readiness() : null;
    if (!r || r.score == null) { el.innerHTML = card('rest', 'battery-half', 'Rest-day advisor', '', '<p class="empty kit-empty">Needs a few days of sleep, heart rate (HRV, resting pulse) from Apple Health, or your training log, to know your normal.</p>'); return; }
    var col = { go: '#22b35e', easy: '#c98500', rest: '#e66767' }[r.level], C = 2 * Math.PI * 34;
    var title = { go: 'Ready to train', easy: 'Go easy today', rest: 'Take a rest day' }[r.level];
    var tip = { go: 'Your body is recovered – a good day for a hard session.', easy: 'Train light: technique, mobility, a walk or an easy run.', rest: 'Rest, sleep early and eat well – you’ll come back stronger.' }[r.level];
    el.innerHTML = card('rest', 'battery-half', 'Rest-day advisor', '', '<div class="rd-row"><svg class="rd-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="trk"/><circle cx="40" cy="40" r="34" class="val" style="stroke:' + col + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - r.score / 100)).toFixed(1) + '"/><text x="40" y="46" text-anchor="middle">' + r.score + '</text></svg>' +
      '<div><b class="rd-t" style="color:' + col + '">' + title + '</b><p class="rd-tip">' + tip + '</p>' + (r.why.length ? '<ul class="rd-why">' + r.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>', 'lp-rest');
  });

  /* ======================= Smart packing (Travel → trip → Prepare) ======================= */
  var packBtn = document.getElementById('tpPackBasics');
  if (packBtn) {
    var sp = document.createElement('button'); sp.type = 'button'; sp.className = 'text-btn'; sp.id = 'tpSmartPack'; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
    packBtn.parentNode.insertBefore(sp, packBtn.nextSibling);
    var spShow = function () { sp.hidden = !on('smartpack'); if (on('smartpack')) packBtn.hidden = true; };
    window.addEventListener('features:change', spShow); window.addEventListener('travel:change', spShow); spShow();
    sp.addEventListener('click', function () {
      var m = location.hash.match(/trip=([\w-]+)/), F = window.Flow; if (!m || !F) return;
      var data = F.travel(), tr = (data.trips || []).filter(function (t) { return t.id === m[1]; })[0]; if (!tr) return;
      sp.disabled = true; sp.innerHTML = '<i class="bi bi-hourglass-split"></i> Checking the weather …';
      var nights = Math.max(1, Math.round((fromKey(tr.end || tr.start) - fromKey(tr.start)) / 864e5)), days = nights + 1;
      var soon = (fromKey(tr.start) - new Date()) / 864e5 < 15, p = tr.place;
      var wx = soon && p && p.lat != null ? fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=' + tr.start + '&end_date=' + (tr.end || tr.start))
        .then(function (r) { return r.json(); }).then(function (d) { var dd = d.daily || {}; return { max: Math.max.apply(null, dd.temperature_2m_max || [20]), min: Math.min.apply(null, dd.temperature_2m_min || [10]), rain: Math.max.apply(null, dd.precipitation_probability_max || [0]) }; }).catch(function () { return null; }) : Promise.resolve(null);
      wx.then(function (w) {
        if (!w) { var mo = fromKey(tr.start).getMonth(), lat = p && p.lat != null ? Math.abs(p.lat) : 55, winter = mo <= 2 || mo >= 10, summer = mo >= 5 && mo <= 7;
          w = { max: lat < 45 ? (summer ? 30 : winter ? 15 : 22) : (summer ? 22 : winter ? 2 : 12), min: lat < 45 ? (winter ? 8 : 15) : (winter ? -4 : 6), rain: 40, guess: true }; }
        var L = ['Passport or ID', 'Phone charger', 'Wallet and cards', 'Toothbrush and toiletries', 'Medicine', 'Headphones'];
        var n = Math.min(days, 7); L.push(n + ' × underwear', n + ' × socks', Math.min(days, 5) + ' × T-shirts');
        if (w.max >= 24) L.push('Sunglasses', 'Sunscreen', 'Shorts', 'Swimwear', 'Sandals', 'Cap or hat'); else if (w.max >= 15) L.push('Light jacket', 'Sunglasses');
        if (w.min <= 10) L.push('Warm sweater', 'Long trousers'); if (w.min <= 3) L.push('Winter jacket', 'Hat and gloves', 'Warm shoes');
        if (w.rain >= 50) L.push('Umbrella', 'Rain jacket');
        if (nights >= 5) L.push('Laundry bag'); if (p && p.cc && p.cc !== 'NO') L.push('Travel adapter', 'EU health card', 'Travel insurance details');
        if (/work|jobb|kurs|conference|konferanse|møte/i.test((tr.name || '') + ' ' + (tr.notes || ''))) L.push('Laptop and charger', 'Smart clothes', 'Business cards');
        if (/ski|hytte|cabin|fjell/i.test((tr.name || '') + ' ' + (tr.dest || '') + ' ' + (tr.notes || ''))) L.push('Wool layer', 'Ski goggles', 'Thermos');
        tr.pack = tr.pack || []; var added = 0;
        L.forEach(function (x) { var base = x.replace(/^\d+ × /, '').toLowerCase(); if (!tr.pack.some(function (q) { return q.text.toLowerCase().replace(/^\d+ × /, '') === base; })) { tr.pack.push({ id: uid(), text: x, done: false }); added++; } });
        F.saveTravel(data); window.dispatchEvent(new Event('travel:change'));
        sp.disabled = false; sp.innerHTML = '<i class="bi bi-bag-check"></i> Smart list';
        toast('<i class="bi bi-bag-check"></i> ' + added + ' things added' + (w.guess ? ' (weather from the season – forecast comes 2 weeks before)' : ' · ' + Math.round(w.min) + '–' + Math.round(w.max) + '°' + (w.rain >= 50 ? ', rain likely' : '')));
      });
    });
  }

  drawAll();
  window.LifePages = { redraw: drawAll, summary: summary };
})();
} catch (e) { console.error("life-pages.js", e); }
/* ===== modern.js ===== */
try {
/* The Modern look (Settings → Appearance → Look; the styles are in modern.css).
   - One bar: you on the left, the menu in the middle, search and buttons on the right. On a computer
     it floats at the top and slides away while you scroll down; on a phone you and the buttons sit at
     the top of the page and the menu stays at the bottom.
   - More pages than fit: names fold to icons, then the rest go under "More" (a list on a computer,
     app icons on a phone – 4 pages + More). Which pages come first is Settings → Menu & pages.
   - Card buttons become small icons (the words stay as labels for screen readers and on hover).
   - Home: a short sentence about your day, the key numbers as chips, and today's top 3.
   Classic turns all of this off without a reload. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var root = document.documentElement, nav = document.getElementById('tabbar');
  var page = (location.pathname.match(/\/cmd\/([a-z]+)\//) || [])[1] || 'home';
  var wideMQ = matchMedia('(min-width: 760px)');
  function modern() { return root.classList.contains('modern'); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function week(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n)) + ' kr'; }

  /* ================= the bar ================= */
  var bar = document.createElement('div'); bar.className = 'mbar'; bar.setAttribute('role', 'banner');
  bar.innerHTML = '<div class="mb-me"><span class="mb-av"></span><span class="mb-who"><b></b><small></small></span></div><div class="mb-acts"></div>';
  var meBox = bar.querySelector('.mb-av'), acts = bar.querySelector('.mb-acts');
  var host = document.querySelector('header.top') || document.getElementById('fp');
  if (host) host.insertBefore(bar, host.firstChild);
  function who() {
    var s = readJSON('dash.settings', {}) || {}, p = readJSON('dash.profile', {}) || {}, d = new Date();
    bar.querySelector('.mb-who b').textContent = p.first || s.name || 'Lundberg';
    bar.querySelector('.mb-who small').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · week ' + week(d);
  }
  /* the buttons that used to sit in the top corner of each page move into the bar (and back for Classic) */
  var moved = [];
  function gather() {
    var src = document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top');
    if (!src) return;
    Array.prototype.slice.call(src.children).forEach(function (el) {
      if (el.classList.contains('fp-back') || el === bar) return;
      moved.push({ el: el, from: src });
      if (el.hasAttribute('data-me')) meBox.appendChild(el); else acts.appendChild(el);
    });
  }
  function scatter() { moved.forEach(function (m) { m.from.appendChild(m.el); }); moved = []; }
  /* the menu goes into the bar on a computer, and back to the bottom of the screen on a phone */
  var navHome = nav && { parent: nav.parentNode, next: nav.nextSibling };
  function placeNav() {
    if (!nav) return;
    var inBar = modern() && wideMQ.matches;
    if (inBar && nav.parentNode !== bar) bar.insertBefore(nav, acts);
    else if (!inBar && nav.parentNode === bar) navHome.parent.insertBefore(nav, navHome.next && navHome.next.parentNode === navHome.parent ? navHome.next : null);
    fit();
  }
  function build() {
    if (modern()) { if (!moved.length) gather(); who(); }
    else scatter();
    placeNav();
  }

  /* ---------- More: pages that don't fit ---------- */
  var more = null;
  if (nav) {
    more = document.createElement('a'); more.className = 'tb-more'; more.href = '#'; more.setAttribute('role', 'button');
    more.setAttribute('aria-haspopup', 'true'); more.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i><span>More</span>';
    nav.appendChild(more);
  }
  function tabs() { return Array.prototype.filter.call(nav.querySelectorAll('a[data-pg]'), function (a) { return getComputedStyle(a).display !== 'none' || a.classList.contains('tb-hide'); }); }
  function fit() {
    if (!nav || !more) return;
    if (more.nextSibling) nav.appendChild(more);          // More is always last (the menu order may have moved the tabs)
    var all = tabs(); all.forEach(function (a) { a.classList.remove('tb-hide'); });
    nav.classList.remove('has-more'); bar.classList.remove('tb-icons');
    if (!modern()) return;
    var cur = all.filter(function (a) { return a.getAttribute('aria-current'); })[0];
    function keep(n) {          // the first n pages stay, the page you're on always stays
      var shown = all.slice(0, n);
      if (cur && shown.indexOf(cur) < 0) shown[n - 1] = cur;
      all.forEach(function (a) { a.classList.toggle('tb-hide', shown.indexOf(a) < 0); });
      nav.classList.add('has-more');
    }
    if (!wideMQ.matches) { if (all.length > 5) keep(4); return; }
    /* computer: names → icons → More, until the menu fits between you and the buttons */
    var room = function () { var me = bar.querySelector('.mb-me').getBoundingClientRect(), ac = acts.getBoundingClientRect(), n = nav.getBoundingClientRect(); return n.left > me.right + 12 && n.right < ac.left - 12; };
    if (room()) return;
    bar.classList.add('tb-icons'); if (room()) return;
    for (var n = all.length - 1; n >= 2; n--) { keep(n); if (room()) return; }
  }
  function openMore(e) {
    e.preventDefault(); e.stopPropagation();
    if (closeMore()) return;
    var all = tabs(), hidden = all.filter(function (a) { return a.classList.contains('tb-hide'); });
    var item = function (a, i) { var ic = a.querySelector('.bi'); return '<a href="' + a.getAttribute('href') + '"' + (a.getAttribute('aria-current') ? ' aria-current="page"' : '') + '><i class="' + (ic ? ic.className : 'bi bi-circle') + '"></i><span>' + esc((a.textContent || '').trim()) + '</span>' + (wideMQ.matches ? '<kbd>' + (i + 1) + '</kbd>' : '') + '</a>'; };
    var edit = '<a class="mut" href="/cmd/?settings=layout"><i class="bi bi-sliders"></i> Choose what’s in the bar</a>';
    if (wideMQ.matches) {
      var m = document.createElement('div'); m.className = 'tb-menu'; m.id = 'tbMenu'; m.setAttribute('role', 'menu');
      m.innerHTML = '<p>More pages</p>' + hidden.map(function (a) { return item(a, all.indexOf(a)); }).join('') + '<hr>' + edit;
      document.body.appendChild(m);
      var r = more.getBoundingClientRect(); m.style.top = (r.bottom + 10) + 'px'; m.style.left = Math.min(innerWidth - 262, Math.max(12, r.right - 250)) + 'px';
      var f = m.querySelector('a'); if (f) f.focus();
    } else {
      var bg = document.createElement('div'); bg.className = 'tb-sheet-bg'; bg.id = 'tbSheetBg';
      var s = document.createElement('div'); s.className = 'tb-sheet'; s.id = 'tbMenu'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'All pages');
      s.innerHTML = '<div class="grab"></div><p>All pages</p><div class="tb-grid">' + all.map(function (a, i) { return item(a, i); }).join('') + '</div>' + edit.replace('class="mut"', 'class="tb-edit"').replace('what’s in the bar', 'your 4 in the bar');
      document.body.appendChild(bg); document.body.appendChild(s);
      requestAnimationFrame(function () { bg.classList.add('open'); s.classList.add('open'); });
      bg.addEventListener('click', closeMore);
    }
    more.setAttribute('aria-expanded', 'true');
  }
  function closeMore() {
    var m = document.getElementById('tbMenu'), bg = document.getElementById('tbSheetBg');
    if (!m) return false;
    m.remove(); if (bg) bg.remove(); if (more) more.setAttribute('aria-expanded', 'false');
    return true;
  }
  if (more) more.addEventListener('click', openMore);
  /* the menu order can change (Settings, another device): keep More last and fit again */
  if (nav) new MutationObserver(function () { if (more.nextSibling) requestAnimationFrame(fit); }).observe(nav, { childList: true });
  document.addEventListener('click', function (e) { if (!e.target.closest('#tbMenu, .tb-more')) closeMore(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMore(); });
  window.addEventListener('resize', function () { closeMore(); requestAnimationFrame(fit); });
  wideMQ.addEventListener('change', placeNav);

  /* ---------- the bar slides away while you scroll down (computer) ---------- */
  var lastY = scrollY, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = scrollY, down = y > lastY + 4, up = y < lastY - 4;
      if (wideMQ.matches && modern() && !document.getElementById('tbMenu')) {
        if (down && y > 140) bar.classList.add('away'); else if (up || y < 80) bar.classList.remove('away');
      }
      if (down || up) lastY = y;
    });
  }, { passive: true });
  bar.addEventListener('focusin', function () { bar.classList.remove('away'); });

  /* ================= card buttons → icons ================= */
  var ICON = { open: 'arrow-up-right', details: 'arrow-up-right', all: 'arrow-up-right', 'see all': 'arrow-up-right', edit: 'pencil', add: 'plus-lg', new: 'plus-lg',
    'clear done': 'check2-all', stops: 'geo-alt', reviews: 'calendar-heart', import: 'upload', export: 'download', settings: 'sliders', customize: 'grid-1x2', history: 'clock-history', map: 'map', more: 'three-dots' };
  function iconify(scope) {
    if (!modern()) {          /* Classic: the words come back */
      document.querySelectorAll('.card-head .text-btn.mi').forEach(function (b) { b.classList.remove('mi'); b.querySelectorAll('.mi-i').forEach(function (x) { x.remove(); }); });
      return;
    }
    (scope || document).querySelectorAll('.card-head .text-btn:not(.mp):not(.fold-hint):not(.danger)').forEach(function (b) {
      if (b.closest('.fp-hero, .tk-bar, .pk-bar')) return;
      if (b.classList.contains('mi')) { if (b.querySelector('.bi')) return; b.classList.remove('mi'); }   // redrawn by its card: do it again
      var label = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label) return;
      if (b.hasAttribute('data-plan')) { b.classList.add('mp'); return; }   // the one that stays words
      var key = (b.dataset.i18nSrc || label).toLowerCase().replace(/[^a-z ]/g, '').trim();
      var have = b.querySelector('.bi:not(.bi-chevron-right):not(.bi-chevron-down)');
      var ic = have ? null : ICON[key] || ICON[key.split(' ')[0]] || null;
      if (!have && !ic) return;                       // nothing sensible to show: keep the word
      if (ic) b.insertAdjacentHTML('afterbegin', '<i class="bi bi-' + ic + ' mi-i"></i>');
      b.querySelectorAll('.bi-chevron-right, .bi-chevron-down').forEach(function (x) { x.remove(); });
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', label);
      if (!b.title) b.title = label;
      b.classList.add('mi');
    });
  }
  var iq = false;
  /* only when a card's heading changed (the clock and lists change all the time – those are skipped) */
  function headChange(recs) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], t = r.target;
      if (t.nodeType === 1 && t.closest('.card-head')) return true;
      for (var j = 0; j < r.addedNodes.length; j++) { var n = r.addedNodes[j]; if (n.nodeType === 1 && (n.matches('.card-head, .card') || n.querySelector('.card-head'))) return true; }
    }
    return false;
  }
  new MutationObserver(function (recs) { if (!iq && headChange(recs)) { iq = true; requestAnimationFrame(function () { iq = false; iconify(); }); } }).observe(document.body, { childList: true, subtree: true });

  /* ================= home: the hero ================= */
  var hero = null;
  if (page === 'home' && document.querySelector('header.top')) {
    hero = document.createElement('section'); hero.className = 'mhero'; hero.setAttribute('aria-label', 'Your day');
    hero.innerHTML = '<div class="mh-txt"><div class="mh-when"></div><h1 class="mh-line"></h1><p class="mh-sub"></p><div class="mh-chips"></div></div>' +
      '<section class="card mh-top3"><div class="card-head"><h2><i class="bi bi-trophy"></i> Today’s top 3</h2><button type="button" class="text-btn mh-planbtn" data-plan><i class="bi bi-sunrise"></i> Plan day</button></div><div class="mh-body"></div></section>';
    document.querySelector('header.top').appendChild(hero);
  }
  function part(h) { return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function moneyToday() {
    var d = window.Vault.get(), Bu = window.Budget, now = new Date(), today = dkey(now);
    if (!d || !d.budget || (window.Features && !window.Features.on('finance'))) return null;
    var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
    var ym = today.slice(0, 7), income = Bu ? Bu.income(d, ym) : sum(d.budget.income), fixed = sum(d.budget.fixed);
    if (!(income > 0)) return null;
    var pay = Bu ? Bu.nextPayday(d, now) : null, per = Bu ? Bu.period(d, now) : null;
    var spent = per ? Bu.spent(d, per) : sum((d.expenses || []).filter(function (e) { return String(e.date).slice(0, 7) === ym; }));
    var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = (per ? per.income : income) - fixed - spent;
    var untilPay = (per && per.byPayday) || (pay && pay.days > 0 && pay.days <= dim);
    var perDay = left / (per && per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1);
    return { left: left, perDay: perDay };
  }
  function nextEvents(now) {
    var C = window.Cal; if (!C || !C.occurrences || (window.Features && !window.Features.on('calendar'))) return [];
    var to = new Date(now); to.setDate(to.getDate() + 2); to.setHours(23, 59);
    try { return C.occurrences(now, to).filter(function (o) { return !o.allDay && o.start > now && !(o.ev && o.ev.trip); }).sort(function (a, b) { return a.start - b.start; }); } catch (e) { return []; }
  }
  function drawHero() {
    if (!hero || !modern()) return;
    var now = new Date(), tk = dkey(now), hh = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var todos = readJSON('dash.todos', []) || [];
    var top = todos.filter(function (t) { return t.today === tk; }).sort(function (a, b) { return (a.rank || 9) - (b.rank || 9); });
    var openTop = top.filter(function (t) { return !t.done; });
    var due = todos.filter(function (t) { return !t.done && t.due && t.due <= tk; });
    var openToday = openTop.length + due.filter(function (t) { return t.today !== tk; }).length;
    var evs = nextEvents(now), tom = new Date(now); tom.setDate(tom.getDate() + 1);
    var nextToday = evs.filter(function (o) { return o.start.toDateString() === now.toDateString() && !(o.ev && o.ev.todo); })[0];
    var firstTom = evs.filter(function (o) { return o.start.toDateString() === tom.toDateString(); })[0];
    var tr = window.Flow && window.Flow.travel ? (window.Flow.travel().trips || []).filter(function (t) { return t.start > tk; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; })[0] : null;
    var tripDays = tr ? Math.round((new Date(tr.start + 'T12:00') - new Date(tk + 'T12:00')) / 864e5) : null;
    var tm = function (o) { return pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()); };
    /* the sentence */
    var a = openToday === 0 ? (top.length ? 'Top 3 done today,' : 'A clear day,') : openToday === 1 ? 'One task left today,' : (openToday < 10 ? ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][openToday] : openToday) + ' tasks left today,';
    var b = nextToday ? 'next up: ' + nextToday.title + ' at ' + tm(nextToday) + '.'
      : firstTom && firstTom.start.getHours() < 10 ? 'and an early start tomorrow.'
      : tripDays != null && tripDays <= 14 ? (tr.name || tr.dest) + ' in ' + tripDays + ' day' + (tripDays === 1 ? '' : 's') + '.'
      : now.getHours() >= 17 ? 'enjoy the evening.' : now.getHours() < 12 ? 'make it a good one.' : 'keep it going.';
    var sub = [];
    if (firstTom) sub.push(firstTom.title + ' at ' + tm(firstTom) + ' tomorrow.');
    var m = moneyToday();
    if (m) sub.push(m.left < 0 ? 'You’re over budget this month – take it easy on spending.' : 'You’re on track with money this month.');
    var hb = readJSON('dash.habits', { list: [], log: {} }) || {}, mon = new Date(now); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7);
    var habitLine = '';
    (hb.list || []).some(function (h) {
      var n = 0; for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); if (((hb.log || {})[dkey(d)] || []).indexOf(h.id) > -1) n++; }
      var left = (h.target || 0) - n;
      if (left === 1) { habitLine = 'One more ' + String(h.name).toLowerCase() + ' session hits your weekly goal.'; return true; }
      if (left > 1 && left <= 7 - ((now.getDay() + 6) % 7)) { habitLine = left + ' more ' + String(h.name).toLowerCase() + ' sessions this week to hit your goal.'; return true; }
      return false;
    });
    if (habitLine) sub.push(habitLine);
    hero.querySelector('.mh-when').innerHTML = '<i class="bi bi-' + (now.getHours() >= 18 || now.getHours() < 6 ? 'moon-stars' : 'sun') + '"></i> ' + hh + ' · ' + part(now.getHours());
    var line = a + ' <span>' + esc(b) + '</span>';
    if (hero.querySelector('.mh-line').innerHTML !== line) hero.querySelector('.mh-line').innerHTML = line;
    var subH = (sub.length ? sub.slice(0, 2) : ['Everything is in order.']).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join(' ');
    if (hero.querySelector('.mh-sub').innerHTML !== subH) hero.querySelector('.mh-sub').innerHTML = subH;
    /* the chips */
    var chips = [], hide = readJSON('dash.finHide', '0') === '1' || localStorage.getItem('dash.finHide') === '1';
    if (m && m.left >= 0) chips.push('<a class="mh-chip" href="#fin"><i class="bi bi-wallet2"></i><b>' + (hide ? '•••' : kr(m.perDay)) + '</b> left today</a>');
    var wt = document.getElementById('wTemp'), wd = document.getElementById('wDesc'), wi = document.getElementById('wIcon');
    if (wt && /\d/.test(wt.textContent) && !document.documentElement.classList.contains('hide-weather')) chips.push('<a class="mh-chip" href="#weatherCard"><i class="' + (wi ? wi.className : 'bi bi-cloud') + '"></i><b>' + esc(wt.textContent) + '</b> ' + esc(((wd && wd.textContent) || '').split(' · ')[0].toLowerCase()) + '</a>');
    if (tr && tripDays <= 60) chips.push('<a class="mh-chip" href="travel/"><i class="bi bi-suitcase-lg"></i><b>' + esc(tr.name || tr.dest) + '</b> in ' + tripDays + ' day' + (tripDays === 1 ? '' : 's') + '</a>');
    var H = ((window.Vault.get() || {}).health || {}).days || {}, ht = H[tk];
    if (ht && ht.steps) chips.push('<a class="mh-chip" href="habits/"><i class="bi bi-activity"></i><b>' + nf.format(ht.steps) + '</b> steps</a>');
    var fm = window.Focus && window.Focus.minsToday ? window.Focus.minsToday() : 0;
    if (fm) chips.push('<span class="mh-chip"><i class="bi bi-stopwatch"></i><b>' + fm + ' min</b> focused</span>');
    var ch = chips.join('');
    if (hero.querySelector('.mh-chips').innerHTML !== ch) hero.querySelector('.mh-chips').innerHTML = ch;
    /* today's top 3 */
    var body;
    if (top.length) {
      var done = top.length - openTop.length;
      body = '<ul>' + top.map(function (t, i) {
        var ev = window.Cal && t.block ? (window.Cal.load().events || []).filter(function (e) { return e.id === t.block; })[0] : null;
        return '<li class="' + (t.done ? 'dn' : '') + '" data-id="' + esc(t.id) + '"><span class="mh-rk">' + (t.rank || i + 1) + '</span><span class="mh-tx">' + esc(t.text) + '</span>' +
          (ev && ev.start && !t.done ? '<span class="mh-tm">' + esc(ev.start) + '</span>' : '') +
          '<button type="button" class="mh-ck" data-mhdone="' + esc(t.id) + '" aria-label="' + (t.done ? 'Mark as not done' : 'Mark as done') + '"><i class="bi bi-check-lg"></i></button></li>';
      }).join('') + '</ul><div class="mh-prog"><div class="mh-bar"><i style="width:' + Math.round(done / top.length * 100) + '%"></i></div>' + done + ' of ' + top.length + ' done' + (fm ? ' · ' + fm + ' min focused' : '') + '</div>';
    } else {
      var n = todos.filter(function (t) { return !t.done; }).length;
      body = '<p class="mh-empty">' + (n ? 'Pick the three things that matter most today and give them a time.' : 'Nothing on your list. Add a task, or enjoy the free time.') + '</p>' +
        '<button type="button" class="pill-btn wide mh-plan" data-plan><i class="bi bi-sunrise"></i> Plan my day</button>';
    }
    var bx = hero.querySelector('.mh-body'); if (bx.innerHTML !== body) bx.innerHTML = body;
    hero.querySelector('.mh-planbtn').hidden = !top.length;
  }
  if (hero) {
    hero.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mhdone]'); if (!b) return;
      var real = document.querySelector('#todoList .todo-item[data-id="' + b.dataset.mhdone + '"] .check');
      if (real) { real.click(); return; }
      var l = readJSON('dash.todos', []); l.forEach(function (t) { if (t.id === b.dataset.mhdone) t.done = !t.done; });
      writeJSON('dash.todos', l); window.dispatchEvent(new Event('todos:change')); if (window.Dash && window.Dash.reload) window.Dash.reload();
    });
    var dq = false, soon = function () { if (!dq) { dq = true; setTimeout(function () { dq = false; drawHero(); }, 40); } };
    ['todos:change', 'plan:change', 'cal:change', 'habits:change', 'fin:change', 'travel:change', 'health:change', 'dash:local', 'features:change', 'storage'].forEach(function (ev) { window.addEventListener(ev, soon); });
    var w = document.getElementById('weatherCard'); if (w) new MutationObserver(soon).observe(w, { childList: true, subtree: true, characterData: true });
    var tl = document.getElementById('todoList'); if (tl) new MutationObserver(soon).observe(tl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setInterval(drawHero, 30000);
  }

  /* ================= switching between Modern and Classic ================= */
  var was = modern();
  new MutationObserver(function () { var m = modern(); if (m !== was) { was = m; build(); iconify(); drawHero(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.Vault.onUnlock(function () { setTimeout(function () { build(); iconify(); drawHero(); }, 30); setTimeout(fit, 400); });
  window.addEventListener('profile:change', who);
  build(); iconify();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.Modern = { fit: fit, hero: drawHero };
})();
} catch (e) { console.error("modern.js", e); }
