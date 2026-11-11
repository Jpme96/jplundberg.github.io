/* Together (Phase E) – things for the two of you, the same code in cmd and in the shared app (cmd/home/):
     on my way home · a high five or a heart · the Sunday summary · countdowns · guests · a shared packing list ·
     date-night ideas · nudges (a reminder on the other's phone at a time) · dinners → the shopping list.
   Everything is shared records in the box (kinds in share-core.js ALLOW: omw, react, cd, idea, tpk, ndg, guest – read
   with the ones that already exist: clog, sx, meal, ev, recipe, pantry, trip, shop). Each app plugs in an adapter:
     Together.use({ role: 'o' | 'p', list(kind) → [{ id, f, t, by }], put(kind, id, f, del), me(), other(),
                    push(title, body, { at, id, cancel }), toast(html), shopAdd([texts]), onReact(kind, by, what) })
   cmd: share.js's ShareSpace (set up at the bottom); the shared app: app.js. Texts in English and Norwegian. */
(function () {
  'use strict';
  if (window.Together) return;
  var A = null;                                                     /* the app's adapter */
  var NB = function () { return window.I18N ? window.I18N.lang === 'nb' : (navigator.language || '').slice(0, 2) === 'nb' || (navigator.language || '').slice(0, 2) === 'no'; };
  function L(en, nb) { return NB() ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var a = String(k).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function days(k) { var a = fromKey(k), b = fromKey(dkey(new Date())); return Math.round((a - b) / 864e5); }
  function fday(k) { var n = days(k); return n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : n > 1 && n < 7 ? fromKey(k).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { weekday: 'long' }) : fromKey(k).toLocaleDateString(NB() ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }); }
  function list(c) { try { return A ? A.list(c) || [] : []; } catch (e) { return []; } }
  function mine(r) { return r && r.f && r.f.by === A.role; }
  function other() { return A.role === 'o' ? 'p' : 'o'; }
  function kr(n) { return Math.round(+n || 0).toLocaleString(NB() ? 'nb-NO' : 'en-GB') + ' kr'; }

  /* ---------- on my way home ---------- */
  function omwOf(who) { var r = list('omw').filter(function (x) { return x.id === who; })[0]; return r && r.f && +r.f.until > Date.now() - 10 * 60e3 ? r.f : null; }
  function goHome(mins) {
    var now = Date.now(), until = now + mins * 60e3;
    A.put('omw', A.role, { by: A.role, at: now, until: until });
    A.push(A.me(), L('On my way – home around ', 'På vei – hjemme rundt ') + hm(until), { id: 'omw' + A.role });
    A.toast('<i class="bi bi-house-heart"></i> ' + esc(A.other()) + L(' knows you’re on the way', ' vet at du er på vei'));
  }
  function omwBanner() {
    var o = omwOf(other()), m = omwOf(A.role), out = '';
    if (o) {
      var p = Math.max(0, Math.min(1, (Date.now() - o.at) / Math.max(60e3, o.until - o.at))), home = Date.now() >= o.until;
      var face = window.Avatar && A.otherLook && A.otherLook() ? Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, A.otherLook()).replace('viewBox="0 0 200 200"', 'viewBox="60 20 82 150"') : '';
      out += '<div class="tg-omw"><div class="tg-road"><span class="tg-walker" style="left:calc(' + (p * 82).toFixed(1) + '% )">' + face + '</span><i class="bi bi-house-heart-fill tg-house"></i></div>' +
        '<b>' + (home ? esc(A.other()) + L(' should be home now', ' burde være hjemme nå') : esc(A.other()) + L(' is on the way – home around ', ' er på vei – hjemme rundt ') + hm(o.until)) + '</b></div>';
    }
    if (m) out += '<div class="tg-row"><span><i class="bi bi-signpost-split"></i> ' + L('You’re on the way – home around ', 'Du er på vei – hjemme rundt ') + hm(m.until) + '</span><button type="button" class="tg-mini" data-tg-home>' + L('I’m home', 'Hjemme') + '</button></div>';
    return out;
  }

  /* ---------- a high five or a heart ---------- */
  function seenKey() { return 'tg.seen.' + A.role; }
  function reactNew() {
    var seen = +(localStorage.getItem(seenKey()) || 0), l = list('react').filter(function (r) { return r.f && r.f.by === other() && +r.f.at > seen; });
    if (!l.length) return null; l.sort(function (a, b) { return b.f.at - a.f.at; }); return l[0].f;
  }
  function choresByOther() {
    var tk = dkey(new Date()), them = A.role === 'o' ? 'them' : 'me', gave = {};
    list('react').forEach(function (r) { if (r.f && r.f.by === A.role) gave[r.f.what] = 1; });
    return list('clog').filter(function (r) { return r.f && r.f.who === them && String(r.f.at || '').slice(0, 10) === tk; })
      .map(function (r) { return { id: r.id, name: r.f.name, done: !!gave[r.id] }; });
  }
  function giveReact(kind, what, name) {
    A.put('react', 'r' + uid(), { by: A.role, kind: kind, at: Date.now(), what: what });
    A.push(A.me(), (kind === 'heart' ? '❤️ ' : '👏 ') + (name ? L('for ', 'for ') + name : L('for you', 'til deg')), { id: 'rx' + uid() });
    A.toast(kind === 'heart' ? '❤️' : '👏');
  }

  /* ---------- the Sunday summary (Sunday, and Monday morning) ---------- */
  function week() {
    var now = new Date(), wd = now.getDay(); if (!(wd === 0 || (wd === 1 && now.getHours() < 12))) return null;
    var from = dkey(new Date(now.getTime() - 7 * 864e5)), to = dkey(new Date(now.getTime() + 7 * 864e5)), tk = dkey(now);
    var meWho = A.role === 'o' ? 'me' : 'them', ch = { me: 0, other: 0 };
    list('clog').forEach(function (r) { var d = String(r.f.at || '').slice(0, 10); if (d >= from && d <= tk) ch[r.f.who === meWho ? 'me' : 'other']++; });
    var spent = 0; list('sx').forEach(function (r) { if (r.f.date >= from && r.f.date <= tk) spent += +r.f.total || 0; });
    var meals = list('meal').filter(function (r) { var d = r.f.date || r.id; return d > tk && d <= to && r.f.text; }).sort(function (a, b) { return (a.f.date || a.id) < (b.f.date || b.id) ? -1 : 1; });
    var evs = list('ev').filter(function (r) { return r.f.date > tk && r.f.date <= to; }).sort(function (a, b) { return a.f.date < b.f.date ? -1 : 1; });
    return { ch: ch, spent: spent, meals: meals, evs: evs };
  }
  function weekHtml() {
    var w = week(); if (!w) return '';
    return '<div class="tg-week"><b><i class="bi bi-calendar-week"></i> ' + L('Your week at home', 'Uka deres hjemme') + '</b><ul>' +
      '<li>' + L('Chores: you ', 'Husarbeid: du ') + w.ch.me + ', ' + esc(A.other()) + ' ' + w.ch.other + '</li>' +
      (w.spent ? '<li>' + L('Spent together: ', 'Brukt sammen: ') + kr(w.spent) + '</li>' : '') +
      (w.meals.length ? '<li>' + L('Dinners: ', 'Middager: ') + esc(w.meals.slice(0, 4).map(function (r) { return fday(r.f.date || r.id) + ' ' + r.f.text; }).join(' · ')) + '</li>' : '') +
      (w.evs.length ? '<li>' + L('Coming up: ', 'Kommer: ') + esc(w.evs.slice(0, 4).map(function (r) { return fday(r.f.date) + ' ' + r.f.title; }).join(' · ')) + '</li>' : '') + '</ul></div>';
  }

  /* ---------- countdowns, guests, nudges for you ---------- */
  function countdowns() { var tk = dkey(new Date()); return list('cd').filter(function (r) { return r.f.date >= tk; }).sort(function (a, b) { return a.f.date < b.f.date ? -1 : 1; }); }
  function guests() { var tk = dkey(new Date()); return list('guest').filter(function (r) { return (r.f.to || r.f.from) >= tk; }).sort(function (a, b) { return a.f.from < b.f.from ? -1 : 1; }); }
  function nudgesForMe() { var now = Date.now(); return list('ndg').filter(function (r) { return r.f.for === A.role && +r.f.at > now - 12 * 3600e3; }).sort(function (a, b) { return a.f.at - b.f.at; }); }

  /* ---------- the card on Today / Home ---------- */
  function card() {
    if (!A) return '';
    var rn = reactNew(), cds = countdowns().slice(0, 3), gs = guests().slice(0, 2), nds = nudgesForMe().slice(0, 2), cb = choresByOther().filter(function (x) { return !x.done; }).slice(0, 2);
    var html = omwBanner() +
      (rn ? '<div class="tg-row tg-hot"><span>' + (rn.kind === 'heart' ? '❤️ ' : '👏 ') + esc(A.other()) + (rn.kind === 'heart' ? L(' sent you a heart', ' sendte deg et hjerte') : L(' gave you a high five', ' ga deg en high five')) + '</span><button type="button" class="tg-mini" data-tg-seen>' + L('Thanks', 'Takk') + '</button></div>' : '') +
      cb.map(function (x) { return '<div class="tg-row"><span><i class="bi bi-check2-circle"></i> ' + esc(A.other()) + ': ' + esc(x.name) + '</span><span><button type="button" class="tg-mini" data-tg-react="hi5" data-what="' + esc(x.id) + '" data-name="' + esc(x.name) + '" aria-label="' + L('High five', 'High five') + '">👏</button><button type="button" class="tg-mini" data-tg-react="heart" data-what="' + esc(x.id) + '" data-name="' + esc(x.name) + '" aria-label="' + L('Heart', 'Hjerte') + '">❤️</button></span></div>'; }).join('') +
      nds.map(function (r) { return '<div class="tg-row"><span><i class="bi bi-bell"></i> ' + esc(A.other()) + ': ' + esc(r.f.text) + ' <small>' + fday(dkey(new Date(+r.f.at))) + ' ' + hm(+r.f.at) + '</small></span></div>'; }).join('') +
      gs.map(function (r) { return '<div class="tg-row"><span><i class="bi bi-door-open"></i> ' + esc(r.f.name) + L(' stays ', ' bor hos dere ') + fday(r.f.from) + (r.f.to && r.f.to !== r.f.from ? '–' + fday(r.f.to) : '') + (days(r.f.from) === 1 ? ' · ' + L('get the guest room ready', 'gjør gjesterommet klart') : '') + '</span></div>'; }).join('') +
      weekHtml() +
      (cds.length ? '<div class="tg-cds">' + cds.map(function (r) { var n = days(r.f.date); return '<span class="tg-cd"><b>' + (n === 0 ? L('Today', 'I dag') : n) + '</b><small>' + (n === 0 ? '' : n === 1 ? L('day', 'dag') : L('days', 'dager')) + '</small>' + esc(r.f.title) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="tg-acts">' + [['omw', 'signpost-split', L('On my way', 'På vei hjem')], ['nudge', 'bell', L('Nudge', 'Påminnelse')], ['ideas', 'stars', L('Date ideas', 'Date-idéer')], ['cd', 'hourglass-split', L('Countdown', 'Nedtelling')], ['guest', 'door-open', L('Guests', 'Gjester')], ['pack', 'suitcase', L('Packing', 'Pakking')], ['dinner', 'basket', L('Dinners → list', 'Middager → liste')]]
        .map(function (x) { return '<button type="button" class="tg-act" data-tg-open="' + x[0] + '"><i class="bi bi-' + x[1] + '"></i>' + esc(x[2]) + '</button>'; }).join('') + '</div>';
    if (rn && A.onReact && reactNew.shown !== rn.at) { reactNew.shown = rn.at; try { A.onReact(rn.kind, rn.by, rn.what); } catch (e) {} }
    return '<section class="tg-card" data-noi18n><h2 class="tg-h"><i class="bi bi-heart"></i> ' + L('The two of you', 'Dere to') + '</h2>' + html + '</section>';
  }

  /* ---------- sheets (its own small one, the same in both apps) ---------- */
  function sheet(title, body, onOk, okLabel) {
    var old = document.querySelector('.tg-sheet'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'tg-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('data-noi18n', '');
    el.innerHTML = '<form class="tg-in"><header><b>' + esc(title) + '</b><button type="button" class="tg-x" data-tg-x aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button></header><div class="tg-b">' + body + '</div>' +
      (onOk ? '<button type="submit" class="tg-ok">' + esc(okLabel || L('Save', 'Lagre')) + '</button>' : '') + '</form>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-tg-x]')) el.remove(); });
    el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); if (onOk && onOk(e.target, el) !== false) el.remove(); });
    return el;
  }
  function chips(name, opts, on) { return '<div class="tg-chips">' + opts.map(function (o) { return '<label><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (o[0] === on ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>'; }).join('') + '</div>'; }
  var OPEN = {
    omw: function () {
      sheet(L('On my way home', 'På vei hjem'), '<p>' + L('How long until you’re home? ', 'Hvor lenge til du er hjemme? ') + esc(A.other()) + L(' gets a note, and sees you on the way.', ' får beskjed og ser deg på vei.') + '</p>' +
        chips('m', [['10', '10 min'], ['20', '20 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 h']], String(A.travelMins ? A.travelMins() || 30 : 30)), function (f) { goHome(+((f.querySelector('[name=m]:checked') || {}).value || 30)); }, L('Send', 'Send'));
    },
    nudge: function () {
      var P = [L('Take out the bins', 'Ta ut søpla'), L('Buy milk on the way home', 'Kjøp melk på vei hjem'), L('Water the plants', 'Vann plantene'), L('Pay the shared bill', 'Betal den felles regningen')];
      var now = new Date(), ev = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0), mo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0); if (ev < now) ev = new Date(ev.getTime() + 864e5);
      sheet(L('Remind ', 'Minn ') + A.other(), '<label class="tg-lbl">' + L('What', 'Hva') + '<input name="t" maxlength="120" required list="tgNdg"><datalist id="tgNdg">' + P.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></label>' +
        '<p class="tg-small">' + L('When', 'Når') + '</p>' + chips('w', [['now', L('Now', 'Nå')], ['1h', L('In an hour', 'Om en time')], [String(ev.getTime()), L('Tonight 20:00', 'I kveld 20:00')], [String(mo.getTime()), L('Tomorrow 08:00', 'I morgen 08:00')]], 'now'), function (f) {
          var t = f.t.value.trim(); if (!t) return false; var w = (f.querySelector('[name=w]:checked') || {}).value || 'now', at = w === 'now' ? Date.now() : w === '1h' ? Date.now() + 3600e3 : +w, id = 'n' + uid();
          A.put('ndg', id, { text: t, at: at, by: A.role, for: other() });
          A.push(A.me(), t, { at: w === 'now' ? 0 : at, id: id });
          A.toast('<i class="bi bi-bell"></i> ' + (w === 'now' ? L('Sent', 'Sendt') : L('Reminder set for ', 'Påminnelse satt til ') + hm(at)));
        }, L('Send', 'Send'));
    },
    ideas: function () {
      var draw = function () {
        var l = list('idea').sort(function (a, b) { return (a.f.done ? 1 : 0) - (b.f.done ? 1 : 0) || a.t - b.t; });
        return (l.length ? '<ul class="tg-list">' + l.map(function (r) { return '<li' + (r.f.done ? ' class="done"' : '') + '><label><input type="checkbox" data-tg-idea="' + esc(r.id) + '"' + (r.f.done ? ' checked' : '') + '> ' + esc(r.f.text) + '</label><button type="button" class="tg-del" data-tg-del="idea" data-id="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '<p class="tg-small">' + L('Nothing yet – add the first idea.', 'Ingenting ennå – legg til den første idéen.') + '</p>') +
          '<div class="tg-pick" hidden></div><button type="button" class="tg-act wide" data-tg-surprise><i class="bi bi-shuffle"></i> ' + L('Surprise me', 'Overrask meg') + '</button>' +
          '<label class="tg-lbl">' + L('New idea', 'Ny idé') + '<input name="t" maxlength="120" placeholder="' + L('Picnic by the sea', 'Piknik ved sjøen') + '"></label>';
      };
      var el = sheet(L('Date-night ideas', 'Date-idéer'), draw(), function (f) { var t = f.t.value.trim(); if (!t) return false; A.put('idea', 'i' + uid(), { text: t, by: A.role, done: false }); f.t.value = ''; el.querySelector('.tg-b').innerHTML = draw(); return false; }, L('Add', 'Legg til'));
      el._redraw = function () { el.querySelector('.tg-b').innerHTML = draw(); };
    },
    cd: function () {
      var draw = function () { return (countdowns().length ? '<ul class="tg-list">' + countdowns().map(function (r) { return '<li><span><b>' + days(r.f.date) + '</b> ' + L('days', 'dager') + ' · ' + esc(r.f.title) + '</span><button type="button" class="tg-del" data-tg-del="cd" data-id="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '') +
        '<label class="tg-lbl">' + L('What', 'Hva') + '<input name="t" maxlength="60" placeholder="' + L('Christmas at home', 'Jul hjemme') + '"></label><label class="tg-lbl">' + L('Date', 'Dato') + '<input name="d" type="date"></label>'; };
      var el = sheet(L('Countdowns', 'Nedtellinger'), draw(), function (f) { var t = f.t.value.trim(), d = f.d.value; if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; A.put('cd', 'c' + uid(), { title: t, date: d, by: A.role }); el._redraw(); return false; }, L('Add', 'Legg til'));
      el._redraw = function () { el.querySelector('.tg-b').innerHTML = draw(); };
    },
    guest: function () {
      sheet(L('Guests', 'Gjester'), (guests().length ? '<ul class="tg-list">' + guests().map(function (r) { return '<li><span>' + esc(r.f.name) + ' · ' + fday(r.f.from) + (r.f.to && r.f.to !== r.f.from ? '–' + fday(r.f.to) : '') + '</span><button type="button" class="tg-del" data-tg-del="guest" data-id="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '') +
        '<label class="tg-lbl">' + L('Who', 'Hvem') + '<input name="n" maxlength="40" required placeholder="' + L('Mum', 'Mamma') + '"></label><label class="tg-lbl">' + L('From', 'Fra') + '<input name="a" type="date" required></label><label class="tg-lbl">' + L('To', 'Til') + '<input name="b" type="date"></label>' +
        '<p class="tg-small">' + L('The day before, you both get a reminder to get the guest room ready.', 'Dagen før får dere begge en påminnelse om å gjøre gjesterommet klart.') + '</p>', function (f) {
          var n = f.n.value.trim(), a = f.a.value, b = f.b.value || a; if (!n || !a) return false; var id = 'g' + uid();
          A.put('guest', id, { name: n, from: a, to: b < a ? a : b, by: A.role });
          var before = fromKey(a); before.setDate(before.getDate() - 1); before.setHours(18, 0, 0, 0);
          if (before.getTime() > Date.now() + 60e3) { var txt = L('Get the guest room ready – ', 'Gjør gjesterommet klart – ') + n + L(' comes tomorrow', ' kommer i morgen'); A.put('ndg', id + 'r', { text: txt, at: before.getTime(), by: A.role, for: other() }); A.push(A.me(), txt, { at: before.getTime(), id: id + 'r' }); }
          A.toast('<i class="bi bi-door-open"></i> ' + esc(n) + L(' is on your shared plan', ' er på den felles planen'));
        }, L('Add', 'Legg til'));
    },
    pack: function () {
      var tk = dkey(new Date()), trips = list('trip').filter(function (r) { return (r.f.end || r.f.start || '') >= tk; }).sort(function (a, b) { return a.f.start < b.f.start ? -1 : 1; });
      if (!trips.length) { sheet(L('Packing', 'Pakking'), '<p>' + L('No shared trip coming up. Share a trip in Travel and its packing list shows here for both of you.', 'Ingen felles tur på vei. Del en tur under Reiser, så kommer pakkelisten hit for dere begge.') + '</p>'); return; }
      var tr = trips[0], draw = function () {
        var items = list('tpk').filter(function (r) { return r.f.trip === tr.id; }).sort(function (a, b) { return (a.f.done ? 1 : 0) - (b.f.done ? 1 : 0) || a.t - b.t; });
        return '<p class="tg-small">' + esc(tr.f.name || tr.f.dest || L('Trip', 'Tur')) + ' · ' + fday(tr.f.start) + '</p>' +
          (items.length ? '<ul class="tg-list">' + items.map(function (r) { return '<li' + (r.f.done ? ' class="done"' : '') + '><label><input type="checkbox" data-tg-pk="' + esc(r.id) + '"' + (r.f.done ? ' checked' : '') + '> ' + esc(r.f.text) + '</label><button type="button" class="tg-del" data-tg-del="tpk" data-id="' + esc(r.id) + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></li>'; }).join('') + '</ul>' : '') +
          '<button type="button" class="tg-act wide" data-tg-wx="' + esc(tr.id) + '"><i class="bi bi-cloud-sun"></i> ' + L('Suggest from the weather there', 'Forslag fra været der') + '</button>' +
          '<label class="tg-lbl">' + L('Add', 'Legg til') + '<input name="t" maxlength="60" placeholder="' + L('Charger', 'Lader') + '"></label>';
      };
      var el = sheet(L('Packing together', 'Pakk sammen'), draw(), function (f) { var t = f.t.value.trim(); if (!t) return false; A.put('tpk', tr.id + ':' + uid(), { trip: tr.id, text: t, done: false, by: A.role }); el._redraw(); return false; }, L('Add', 'Legg til'));
      el._redraw = function () { el.querySelector('.tg-b').innerHTML = draw(); }; el._trip = tr;
    },
    dinner: function () {
      var tk = dkey(new Date()), to = dkey(new Date(Date.now() + 7 * 864e5)), recipes = list('recipe'), have = {}, onList = {};
      list('pantry').forEach(function (r) { if (r.f.state !== 'low') have[String(r.f.name || '').toLowerCase()] = 1; });
      list('shop').forEach(function (r) { if (!r.f.done) onList[String(r.f.text || '').toLowerCase()] = 1; });
      var want = [];
      list('meal').filter(function (r) { var d = r.f.date || r.id; return d >= tk && d <= to && r.f.text; }).forEach(function (r) {
        var rc = recipes.filter(function (x) { var a = String(x.f.title || '').toLowerCase(), b = String(r.f.text).toLowerCase(); return a && (a === b || b.indexOf(a) > -1 || a.indexOf(b) > -1); })[0];
        if (!rc) return;
        String(rc.f.ingr || '').split(/\n+/).map(function (x) { return x.replace(/^[-•*\s]+/, '').trim(); }).filter(Boolean).forEach(function (line) {
          var low = line.toLowerCase(), skip = Object.keys(have).some(function (h) { return h && low.indexOf(h) > -1; }) || onList[low];
          if (!skip && want.indexOf(line) < 0) want.push(line);
        });
      });
      if (!want.length) { sheet(L('Dinners → shopping list', 'Middager → handleliste'), '<p>' + L('Nothing to add: no dinner this week has a recipe with ingredients you don’t have.', 'Ingenting å legge til: ingen middag denne uka har en oppskrift med noe dere mangler.') + '</p>'); return; }
      sheet(L('Dinners → shopping list', 'Middager → handleliste'), '<p class="tg-small">' + L('From this week’s dinners – what the pantry has and what’s already on the list is left out.', 'Fra ukas middager – det dere har i skapet og det som allerede står på lista er utelatt.') + '</p><ul class="tg-list">' +
        want.map(function (x, i) { return '<li><label><input type="checkbox" name="i' + i + '" checked> ' + esc(x) + '</label></li>'; }).join('') + '</ul>', function (f) {
          var pick = want.filter(function (x, i) { return f['i' + i] && f['i' + i].checked; }); if (!pick.length) return;
          A.shopAdd(pick); A.toast('<i class="bi bi-cart-plus"></i> ' + pick.length + L(' on the list', ' på lista'));
        }, L('Add to the list', 'Legg på lista'));
    }
  };
  /* the weather where you're going (open-meteo, like the weather behind the page) → things to pack */
  function packFromWeather(tr, el) {
    var place = encodeURIComponent(tr.f.dest || tr.f.name || ''); if (!place) return;
    fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + place).then(function (r) { return r.json(); }).then(function (g) {
      var p = g && g.results && g.results[0]; if (!p) throw new Error('place');
      return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=16&timezone=auto').then(function (r) { return r.json(); });
    }).then(function (w) {
      var d = (w && w.daily) || {}, tm = d.temperature_2m_max || [], tn = d.temperature_2m_min || [], pr = d.precipitation_probability_max || [];
      var hi = Math.max.apply(null, tm.length ? tm : [15]), lo = Math.min.apply(null, tn.length ? tn : [10]), wet = Math.max.apply(null, pr.length ? pr : [0]);
      var s = [L('Chargers', 'Ladere'), L('Toothbrush', 'Tannbørste')];
      if (wet >= 50) s.push(L('Rain jacket', 'Regnjakke'), L('Umbrella', 'Paraply'));
      if (lo <= 5) s.push(L('Warm jacket', 'Varm jakke'), L('Hat and gloves', 'Lue og votter'));
      if (hi >= 22) s.push(L('Swimwear', 'Badetøy'), L('Sunscreen', 'Solkrem'), L('Sunglasses', 'Solbriller'));
      var have = {}; list('tpk').forEach(function (r) { if (r.f.trip === tr.id) have[String(r.f.text).toLowerCase()] = 1; });
      var add = s.filter(function (x) { return !have[x.toLowerCase()]; });
      add.forEach(function (x) { A.put('tpk', tr.id + ':' + uid(), { trip: tr.id, text: x, done: false, by: A.role }); });
      A.toast('<i class="bi bi-cloud-sun"></i> ' + (add.length ? add.length + L(' added from the weather there', ' lagt til fra været der') : L('Already on the list', 'Står allerede på lista')));
      if (el && el._redraw) el._redraw();
    }).catch(function () { A.toast(L('Couldn’t get the weather there', 'Fikk ikke tak i været der')); });
  }

  /* ---------- taps (one listener for both apps) ---------- */
  document.addEventListener('click', function (e) {
    if (!A) return; var t = e.target, b;
    if ((b = t.closest('[data-tg-open]'))) { var f = OPEN[b.dataset.tgOpen]; if (f) f(); return; }
    if (t.closest('[data-tg-home]')) { A.put('omw', A.role, null, true); A.push(A.me(), L('Home now', 'Hjemme nå'), { id: 'omw' + A.role }); A.refresh && A.refresh(); return; }
    if (t.closest('[data-tg-seen]')) { try { localStorage.setItem(seenKey(), String(Date.now())); } catch (er) {} A.refresh && A.refresh(); return; }
    if ((b = t.closest('[data-tg-react]'))) { giveReact(b.dataset.tgReact, b.dataset.what, b.dataset.name); A.refresh && A.refresh(); return; }
    if ((b = t.closest('[data-tg-del]'))) { A.put(b.dataset.tgDel, b.dataset.id, null, true); var sh = b.closest('.tg-sheet'); if (sh && sh._redraw) sh._redraw(); else if (b.closest('li')) b.closest('li').remove(); return; }
    if (t.closest('[data-tg-surprise]')) { var l = list('idea').filter(function (r) { return !r.f.done; }), pk = t.closest('.tg-b').querySelector('.tg-pick'); if (!pk) return; pk.hidden = false; pk.innerHTML = l.length ? '<i class="bi bi-stars"></i> ' + esc(l[Math.floor(Math.random() * l.length)].f.text) : L('Add an idea first', 'Legg til en idé først'); return; }
    if ((b = t.closest('[data-tg-wx]'))) { var sh2 = b.closest('.tg-sheet'); packFromWeather(sh2._trip, sh2); return; }
  });
  document.addEventListener('change', function (e) {
    if (!A) return; var t = e.target, r;
    if (t.matches('[data-tg-idea]')) { r = list('idea').filter(function (x) { return x.id === t.dataset.tgIdea; })[0]; if (r) A.put('idea', r.id, Object.assign({}, r.f, { done: t.checked })); }
    if (t.matches('[data-tg-pk]')) { r = list('tpk').filter(function (x) { return x.id === t.dataset.tgPk; })[0]; if (r) A.put('tpk', r.id, Object.assign({}, r.f, { done: t.checked })); }
  });

  /* ---------- styles (both apps) ---------- */
  function css() {
    if (document.getElementById('tgCss')) return; var s = document.createElement('style'); s.id = 'tgCss';
    s.textContent = '.tg-card{margin:12px 0;padding:14px;border-radius:18px;background:rgba(127,127,127,.08);border:1px solid rgba(127,127,127,.18)}.tg-h{margin:0 0 8px;font-size:15px;display:flex;gap:6px;align-items:center}' +
      '.tg-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;font-size:14px;border-top:1px solid rgba(127,127,127,.14)}.tg-row small{opacity:.7}.tg-hot{font-weight:600}' +
      '.tg-mini{min-width:40px;min-height:36px;padding:4px 10px;border-radius:12px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font:inherit;margin-left:4px}' +
      '.tg-omw{padding:8px 0 10px}.tg-road{position:relative;height:56px;border-bottom:3px dashed rgba(127,127,127,.4);margin-bottom:6px}.tg-walker{position:absolute;bottom:0;width:30px;height:54px;transform:translateX(-50%)}.tg-walker svg{width:30px;height:54px}.tg-house{position:absolute;right:0;bottom:2px;font-size:28px;color:#f2a024}' +
      '.tg-week{padding:8px 0;border-top:1px solid rgba(127,127,127,.14);font-size:14px}.tg-week ul{margin:6px 0 0;padding-left:18px}.tg-cds{display:flex;gap:8px;overflow-x:auto;padding:8px 0}.tg-cd{flex:0 0 auto;min-width:86px;padding:8px 10px;border-radius:14px;background:rgba(127,127,127,.1);font-size:12px;display:flex;flex-direction:column}.tg-cd b{font-size:20px}' +
      '.tg-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.tg-act{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font:inherit;font-size:13.5px}.tg-act.wide{width:100%;justify-content:center;margin:8px 0}' +
      '.tg-sheet{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}.tg-in{width:100%;max-width:520px;max-height:88vh;overflow:auto;background:var(--card,var(--bg,#16191f));color:var(--text,inherit);border-radius:22px 22px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}' +
      '.tg-in header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.tg-x{width:40px;height:40px;border:0;background:transparent;color:inherit;font-size:18px}.tg-lbl{display:flex;flex-direction:column;gap:4px;margin:10px 0;font-size:13px}.tg-lbl input{font:inherit;font-size:16px;padding:10px 12px;border-radius:12px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit}' +
      '.tg-chips{display:flex;flex-wrap:wrap;gap:6px}.tg-chips input{position:absolute;opacity:0}.tg-chips span{display:inline-block;padding:9px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.3)}.tg-chips input:checked+span{background:var(--accent,#2fae6a);border-color:transparent;color:#fff}' +
      '.tg-ok{width:100%;min-height:46px;margin-top:12px;border:0;border-radius:14px;background:var(--accent,#2fae6a);color:#fff;font:inherit;font-weight:700}.tg-small{font-size:13px;opacity:.75}.tg-list{list-style:none;margin:6px 0;padding:0}.tg-list li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.14)}.tg-list li.done label{opacity:.55;text-decoration:line-through}.tg-list input[type=checkbox]{width:20px;height:20px}' +
      '.tg-del{width:36px;height:36px;border:0;background:transparent;color:inherit;opacity:.6}.tg-pick{padding:10px;border-radius:12px;background:rgba(242,201,76,.16);margin:8px 0;font-weight:600}';
    document.head.appendChild(s);
  }

  window.Together = {
    use: function (a) { A = a; css(); },
    card: card, open: function (k) { if (OPEN[k]) OPEN[k](); }, week: week, omw: function (who) { return omwOf(who); }
  };

  /* ---------- cmd: the adapter and the card on Home ---------- */
  if (!/\/cmd\/home\//.test(location.pathname)) {
    var S = function () { return window.ShareSpace; }, SC = function () { return window.ShareCore; };
    var on = function () { var s = S(); return !!(s && s.list && window.CoupleInfo && window.CoupleInfo()); };
    Together.use({
      role: 'o', list: function (c) { return S() ? S().list(c) : []; }, put: function (c, id, f, del) { if (S()) S().put(c, id, f, del); },
      me: function () { return S() && S().ownerName ? S().ownerName() : ''; }, other: function () { return S() && S().partnerName ? S().partnerName() : ''; },
      otherLook: function () { return S() && S().partnerLook ? S().partnerLook() : null; },
      push: function (title, body, o) { o = o || {}; var sc = SC(); if (sc && sc.send) sc.send('push', { method: 'POST', body: { notify: { title: title, body: body, tag: o.id || 'tg', id: o.id, at: o.at || 0 } } }, o.id ? 'push:' + o.id : '').catch(function () {}); },
      toast: function (h) { if (window.Quick && Quick.toast) Quick.toast(h); },
      shopAdd: function (texts) { var Fe = window.Features; if (!Fe) return; var t = Fe.tools(); t.shop = (Array.isArray(t.shop) ? t.shop : []).concat(texts.map(function (x) { return { id: 's' + uid(), text: x.slice(0, 120), done: false }; })); Fe.saveTools(t); },
      onReact: function (kind) { if (window.Avatar && Avatar.cheer) Avatar.cheer(kind === 'heart' ? L(S().partnerName() + ' sent you a heart ❤️', S().partnerName() + ' sendte deg et hjerte ❤️') : L(S().partnerName() + ' gave you a high five 👏', S().partnerName() + ' ga deg en high five 👏')); },
      refresh: function () { draw(); }
    });
    /* on Home: under your avatar */
    var draw = function () {
      var home = /\/cmd\/(index\.html)?$/.test(location.pathname), box = document.getElementById('tgCard');
      if (!home || !on() || !document.documentElement.classList.contains('unlocked')) { if (box) box.remove(); return; }
      var hero = document.getElementById('avHome'); var at = hero && hero.parentNode; if (!at) return;
      if (!box) { box = document.createElement('div'); box.id = 'tgCard'; at.parentNode.insertBefore(box, at.nextSibling); }
      var h = card(); if (box._h !== h) { box._h = h; box.innerHTML = h; }
    };
    ['together:change', 'sync:state', 'tools:change', 'softnav:done'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(draw, 30); }); });
    setInterval(draw, 60e3); setTimeout(draw, 1500);
  }
})();
