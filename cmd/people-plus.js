/* People, batch 5 (Oct 2026):
     Gift tracker      – what you gave whom and when, with a budget for Christmas, birthdays and other
                         occasions, a Christmas gift list, and each person's gifts in their card.
     Contacts import   – from an iPhone Shortcut (the list travels in the link after #, so it never
                         reaches a server) or a contact file (.vcf), with birthdays.
     A note after "Talked today" – one line, kept as a short history in the person's card.
     Name days and anniversaries – Norwegian name days (navnedager, from the almanac) by first name,
                         and "Other dates" (wedding, …) – in Coming up, At a glance and the calendar.
   Data in dash.tools: gifts [{id,pid,occ,date,what,cost,exp?}], people[].log [{d,t}], people[].dates,
   people[].xmas. Settings in peoplecfg (Settings → People). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, K = window.Kit, HL = window.HomeLife;
  if (!HL) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var dkey = Fe.dkey, fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function on() { return Fe.on('people'); }
  function cfg() { return HL.cfg('peoplecfg'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function snapshot(k) { return JSON.parse(JSON.stringify(Fe.tools()[k] || null)); }
  function restore(k, v) { var t = Fe.tools(); t[k] = v; Fe.saveTools(t); }
  function people() { return Fe.list('people'); }
  function person(id) { return people().filter(function (p) { return p.id === id; })[0]; }
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  var PINK = '#d55181', PURPLE = '#8a6fdf', AMBER = '#c98500';

  /* ======================= name days (Norwegian almanac) ======================= */
  /* month | day ; names , – 1 January and 25 December have none, 29 February isn't in the almanac */
  var ND = ';Dagfinn,Dagfrid;Alfred,Alf;Roar,Roger;Hanna,Hanne;Aslaug,Åslaug;Eldbjørg,Knut;Torfinn,Turid;Gunnar,Gunn;Sigmund,Sigrun;Børge,Børre;Reinhard,Reinert;Gisle,Gislaug;Herbjørn,Herbjørg;Laurits,Laura;Hjalmar,Hilmar;Anton,Tønnes,Tony;Hildur,Hild;Marius,Margunn;Fabian,Sebastian,Bastian;Agnes,Agnete;Ivan,Vanja;Emil,Emilie,Emma;Joar,Jarle,Jarl;Paul,Pål;Øystein,Esten;Gaute,Gurly,Gry;Karl,Karoline;Herdis,Hermod,Hermann;Gunnhild,Gunda;Idun,Ivar|Birte,Bjarte;Jomar,Jostein;Ansgar,Asgeir;Veronika,Vera;Agate,Ågot;Dortea,Dorte;Rikard,Rigmor,Riborg;Åshild,Åsne;Lone,Leikny;Ingfrid,Ingrid;Ingve,Yngve;Randulf,Randi,Ronja;Svanhild,Svanlaug;Hjørdis,Jardar;Sigfred,Sigbjørn;Julian,Juliane,Jill;Aleksandra,Sandra,Sondre;Frøydis,Frode;Ella,Elna;Halldis,Halldor;Samuel,Selma,Celine;Tina,Tine,Tim;Torstein,Torunn;Mattias,Mattis,Mats;Viktor,Viktoria;Inger,Ingjerd;Laila,Lill;Marina,Maren|Audny,Audun;Erna,Ernst;Gunnbjørg,Gunnveig;Ada,Adrian;Patrick,Patricia;Annfrid,Andor;Arild,Are;Beate,Betty,Bettina;Sverre,Sindre;Edel,Edle;Edvin,Tale;Gregor,Gro;Greta,Grete;Mathilde,Mette;Christel,Christer,Chris;Gudmund,Gudny;Gjertrud,Trude;Aleksander,Sander,Edvard;Josef,Josefine;Joakim,Kim;Bendik,Bengt,Bent;Paula,Pauline;Gerda,Gerd;Ulrikke,Rikke;Maria,Marie,Mari;Gabriel,Glenn;Rudolf,Rudi;Åsta,Åste;Jonas,Jonatan;Holger,Olga;Vebjørn,Vegard|Aron,Arve,Arvid;Sigvard,Sivert;Gunnvald,Gunnvor;Nanna,Nancy,Nina;Irene,Eirin,Eril;Åsmund,Asmund;Oddveig,Oddvin;Asle,Atle;Rannveig,Rønnaug;Ingvald,Ingveig;Ylva,Ulf;Julius,Julie;Asta,Astrid;Ellinor,Nora;Oda,Odin,Odd;Magnus,Mons;Elise,Else,Elsa;Eilen,Eilert;Arnfinn,Arnstein;Kjellaug,Kjellrun;Jeanette,Jannike;Oddgeir,Oddny;Georg,Jørgen,Jørg;Albert,Olaug;Markus,Mark;Terese,Tea;Charles,Charlotte,Lotte;Vivi,Vivian;Toralf,Torolf;Gina,Gitte|Filip,Valborg;Åsa,Åse;Gjermund,Gøril;Monika,Mona;Gudbrand,Gullborg;Guri,Gyri;Maia,Mai,Maiken;Åge,Åke;Kasper,Jesper;Asbjørg,Asbjørn,Espen;Magda,Malvin;Normann,Norvald;Linda,Line,Linn;Kristian,Kristen,Karsten;Hallvard,Hallvor;Sara,Siren;Harald,Ragnhild;Eirik,Erik,Erika;Torjus,Torje,Truls;Bjørnar,Bjørnhild;Helene,Ellen,Eli;Henning,Henny;Oddleif,Oddlaug;Ester,Iris;Ragna,Ragnar;Annbjørg,Annlaug;Katinka,Cato;Vilhelm,William,Willy;Magnar,Magnhild;Gard,Geir;Pernille,Preben|June,Juni;Runa,Runar,Rune;Rasmus,Rakel;Heidi,Heid;Torbjørg,Torbjørn,Torben;Gustav,Gyda;Robert,Robin;Renate,René;Kolbein,Kolbjørn;Ingolf,Ingunn;Borgar,Bjørge,Bjørg;Sigfrid,Sigrid,Siri;Tone,Tonje,Tanja;Erlend,Erland;Vigdis,Viggo;Torhild,Toril,Tiril;Botolf,Bodil;Bjarne,Bjørn;Erling,Elling;Salve,Sølve,Sølvi;Agnar,Annar;Håkon,Maud;Elfrid,Eldrid;Johannes,Jon,Hans;Jørund,Jorunn;Jenny,Jonny;Aina,Ina,Ine;Lea,Leo,Leon;Peter,Petter,Per;Solbjørg,Solgunn|Ask,Embla;Kjartan,Kjellfrid;Andrea,Andrine,André;Ulrik,Ulla;Mirjam,Mina;Torgrim,Torgunn;Håvard,Hulda;Sunniva,Synnøve,Synne;Gøran,Jøran,Ørjan;Anita,Anja;Kjetil,Kjell;Elias,Eldar;Mildrid,Melissa,Mia;Solfrid,Solrun;Oddmund,Oddrun;Susanne,Sanna;Guttorm,Gorm;Arnulf,Ørnulf;Gerhard,Gjert;Margareta,Margit,Marit;Johanne,Janne,Jane;Malene,Malin,Mali;Brita,Brit,Britt;Kristine,Kristin,Kristi;Jakob,Jack,Jim;Anna,Anne,Ane;Marita,Rita;Reidar,Reidun;Olav,Ola,Ole;Aurora,Audhild,Aud;Elin,Eline|Peder,Petra;Karen,Karin;Oline,Oliver,Olve;Arnhild,Arna,Arne;Osvald,Oskar;Gunnlaug,Gunnleiv;Didrik,Doris;Evy,Yvonne;Ronald,Ronny;Lorents,Lars,Lasse;Torvald,Tarald;Klara,Camilla;Anny,Anine,Ann;Hallgeir,Hallgjerd;Margot,Mary,Marielle;Brynjulf,Brynhild;Verner,Wenche;Tormod,Torodd;Sigvald,Sigve;Bernhard,Bernt;Ragnvald,Ragni;Harriet,Harry;Signe,Signy;Belinda,Bertil;Ludvig,Lovise,Louise;Øyvind,Eivind,Even;Roald,Rolf;Artur,August;Johan,Jone,Jo;Benjamin,Ben;Berta,Berte|Solveig,Solvår;Lisa,Lise,Liss;Alise,Alvhild,Vilde;Ida,Idar;Brede,Brian,Njål;Sollaug,Siril,Siv;Regine,Rose;Amalie,Alma,Allan;Trygve,Tyra,Trym;Tord,Tor;Dagny,Dag;Jofrid,Jorid;Stian,Stig;Ingebjørg,Ingeborg;Aslak,Eskil;Lillian,Lilly;Hildebjørg,Hildegunn;Henriette,Henry;Konstanse,Connie;Tobias,Tage;Trine,Trond;Kyrre,Kåre;Snorre,Snefrid;Jan,Jens;Ingvar,Yngvar;Einar,Endre;Dagmar,Dagrun;Lena,Lene;Mikael,Mikal,Mikkel;Helga,Helge,Hege|Rebekka,Remi;Live,Liv;Evald,Evelyn;Frans,Frank;Brynjar,Boye,Bo;Målfrid,Møyfrid;Birgitte,Birgit,Berit;Benedikte,Bente;Leidulf,Leif;Fridtjof,Frida,Frits;Kevin,Kennet,Kent;Valter,Vibeke;Torgeir,Terje,Tarjei;Kaia,Kai;Hedvig,Hedda;Flemming,Finn;Marta,Marte;Kjersti,Kjerstin;Tora,Tore;Henrik,Heine,Henrikke;Bergljot,Birger;Karianne,Karine,Kine;Severin,Søren;Eilif,Eivor;Margrete,Merete,Märtha;Amandus,Amanda;Sturla,Sture;Simon,Simen;Noralf,Norunn;Aksel,Åmund,Ove;Edit,Edna|Veslemøy,Vetle;Tove,Tuva;Raymond,Roy;Otto,Ottar;Egil,Egon;Leonard,Lennart;Ingebrigt,Ingelin;Ingvild,Yngvild;Tordis,Teodor;Gudbjørg,Gudveig;Martin,Morten,Martine;Torkjell,Torkil;Kirsten,Kirsti;Fredrik,Fred,Freddy;Oddfrid,Oddvar;Edmund,Edgar;Hugo,Hogne,Hauk;Magne,Magny;Elisabet,Lisbet;Halvdan,Helle;Mariann,Marianne;Cecilie,Silje,Sissel;Klement,Klaus;Gudrun,Guro;Katarina,Katrine,Kari;Konrad,Kurt;Torlaug,Torleif;Ruben,Rut;Sofie,Sonja;Andreas,Anders|Arnold,Arnljot,Arnt;Borghild,Borgny,Bård;Sveinung,Svein;Barbara,Barbro;Stine,Ståle;Nils,Nikolai;Hallfrid,Hallstein;Marlene,Marion,Morgan;Anniken,Annette;Judit,Jytte;Daniel,Dan;Pia,Peggy;Lucia,Lydia;Steinar,Stein;Hilda,Hilde;Oddbjørg,Oddbjørn;Inga,Inge;Kristoffer,Kate;Iselin,Isak;Abraham,Amund;Tomas,Tom,Tommy;Ingemar,Ingar;Sigurd,Sjur;Adam,Eva;;Stefan,Steffen;Narve,Natalie;Unni,Une,Unn;Vidar,Vemund;David,Diana,Dina;Sylfest,Sylvia,Sylvi';
  var ndMap = null;
  function names() {
    if (ndMap) return ndMap;
    ndMap = {};
    ND.split('|').forEach(function (mo, mi) { mo.split(';').forEach(function (day, di) { day.split(',').forEach(function (n) { n = n.trim().toLowerCase(); if (n && !ndMap[n]) ndMap[n] = [mi + 1, di + 1]; }); }); });
    return ndMap;
  }
  function firstName(n) { return String(n || '').trim().split(/[\s-]+/)[0].toLowerCase(); }
  /* the next time a day and month come round (29 Feb → 28 Feb in other years) */
  function nextOf(m, d) {
    var now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    function at(y) { var x = new Date(y, m - 1, d); if (x.getMonth() !== m - 1) x = new Date(y, m, 0); return x; }
    var nx = at(t0.getFullYear()); if (nx < t0) nx = at(t0.getFullYear() + 1);
    return { next: dkey(nx), n: Math.round((nx - t0) / 864e5), year: nx.getFullYear() };
  }
  function nameday(p) {
    if (!cfg().namedays) return null;
    var x = names()[firstName(p.name)]; if (!x) return null;
    var o = nextOf(x[0], x[1]);
    return { m: x[0], d: x[1], next: o.next, n: o.n, kind: 'nd', label: 'Name day', icon: 'calendar-heart', c: PURPLE };
  }
  /* "Wedding 12.06.2015" – one per line */
  function otherDates(p) {
    return String(p.dates || '').split('\n').map(function (line) {
      var m = line.trim().match(/^(.*?)[\s:–-]*(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\.?\s*$/); if (!m) return null;
      var d = +m[2], mo = +m[3], y = m[4] ? +m[4] : null; if (y && y < 100) y += y > 30 ? 1900 : 2000;
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      var o = nextOf(mo, d), label = m[1].trim().replace(/[:–-]\s*$/, '') || 'Anniversary';
      return { d: d, m: mo, y: y, next: o.next, n: o.n, years: y && o.year > y ? o.year - y : null, kind: 'ann', label: label, icon: /bryllup|wedding|gift|married/i.test(label) ? 'heart' : 'stars', c: AMBER };
    }).filter(Boolean);
  }
  function upcoming(max) {
    var out = [];
    people().forEach(function (p) {
      var nd = nameday(p); if (nd && nd.n <= max) out.push([nd, p]);
      otherDates(p).forEach(function (a) { if (a.n <= max) out.push([a, p]); });
    });
    return out;
  }
  function days(p) {
    var nd = nameday(p), od = otherDates(p);
    return (nd ? '<p class="hl-small muted pp5-day"><i class="bi bi-calendar-heart"></i> Name day ' + esc(fmt(nd.next, { day: 'numeric', month: 'long' })) + ' · ' + esc(inDays(nd.n)) + '</p>' : '') +
      od.map(function (a) { return '<p class="hl-small muted pp5-day"><i class="bi bi-' + a.icon + '"></i> <span data-noi18n>' + esc(a.label) + '</span> ' + esc(fmt(a.next, { day: 'numeric', month: 'long' })) + (a.years ? ' – ' + a.years + ' years' : '') + ' · ' + esc(inDays(a.n)) + '</p>'; }).join('');
  }
  /* in the calendar, yearly */
  window.EventsExtra = window.EventsExtra || [];
  window.EventsExtra.push(function () {
    if (!on() || !cfg().ndCal) return [];
    var out = [], y0 = new Date().getFullYear() - 1;
    people().forEach(function (p) {
      var nd = nameday(p);
      if (nd) out.push({ id: 'rem:nd:' + p.id, title: 'Name day: ' + p.name, allDay: true, start: new Date(y0, nd.m - 1, nd.d), days: 1, color: PURPLE, readOnly: true, reminder: true, noBrief: true,
        link: '/cmd/people/#people=' + p.id, location: '', notes: '', exDays: {}, rule: { freq: 'YEARLY', interval: 1 } });
      otherDates(p).forEach(function (a, i) {
        out.push({ id: 'rem:an:' + p.id + ':' + i, title: p.name + ': ' + a.label + (a.years ? ' (' + a.years + ')' : ''), allDay: true, start: new Date(a.y && a.y > 1900 ? a.y : y0, a.m - 1, a.d), days: 1, color: AMBER,
          readOnly: true, reminder: true, noBrief: true, link: '/cmd/people/#people=' + p.id, location: '', notes: '', exDays: {}, rule: { freq: 'YEARLY', interval: 1 } });
      });
    });
    return out;
  });

  /* ======================= gifts ======================= */
  var OCC = [['bday', 'Birthday', 'balloon', PINK], ['xmas', 'Christmas', 'tree', '#22b35e'], ['other', 'Other occasion', 'gift', PURPLE]];
  function occ(k) { return OCC.filter(function (o) { return o[0] === k; })[0] || OCC[2]; }
  function occName(o) { return L(o[1], { bday: 'Bursdag', xmas: 'Jul', other: 'Annen anledning' }[o[0]]); }
  function gifts() { return Fe.list('gifts'); }
  function gyear(g) { return String(g.date || '').slice(0, 4); }
  /* the form, with what you already know filled in */
  function giftCfg(def, after) {
    var defs = def || {};
    var f = [
      { k: 'what', type: 'title', label: 'What', ph: 'What you gave – e.g. a book, concert tickets', req: true },
      { k: 'pid', label: 'To', type: 'select', options: function () { return people().slice().sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); }).map(function (p) { return [p.id, p.name]; }); } },
      { k: 'occ', label: 'Occasion', type: 'select', options: OCC.map(function (o) { return [o[0], o[1]]; }), def: 'bday' },
      { k: 'cost', label: 'Cost', type: 'number', suffix: 'kr' },
      { k: 'date', label: 'Date', type: 'date', def: today }
    ].map(function (x) { return x.k in defs ? Object.assign({}, x, { def: defs[x.k] }) : x; });
    return { key: 'gifts', addTitle: 'Note a gift', editTitle: 'Edit gift', fields: f,
      beforeSave: function (it, isNew) { if (isNew && cfg().giftFin && +it.cost > 0) it.exp = uid(); },
      afterSave: function (it, isNew) {
        if (isNew && it.exp) {
          var d = window.Vault.get(), p = person(it.pid); d.expenses = d.expenses || [];
          d.expenses.push({ id: it.exp, t: Date.now(), date: it.date || today(), amount: +it.cost, cat: 'shopping', note: ('Gift: ' + it.what + (p ? ' (' + p.name + ')' : '')).slice(0, 80) });
          window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
        }
        toast('<i class="bi bi-gift"></i> ' + (isNew ? 'Gift noted' : 'Saved'));
        if (after) after(it, isNew);
      } };
  }
  function newGift(def, after) {
    if (!K) return;
    if (!people().length) { toast('<i class="bi bi-people"></i> Add the person first'); return; }
    K.edit(giftCfg(def, after), null);
  }
  /* which occasion a gift for this person is probably for, right now */
  function guessOcc(p) {
    var b = HL.bday(p), m = new Date().getMonth();
    if (b && b.n <= 30) return 'bday';
    if (m >= 9 && p.xmas) return 'xmas';
    return b && b.n <= 60 ? 'bday' : m >= 10 ? 'xmas' : 'other';
  }
  function detail(p) {
    var gl = gifts().filter(function (g) { return g.pid === p.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var log = Array.isArray(p.log) ? p.log : [], all = OPENLOG[p.id];
    var lookSec = window.Avatar && window.Avatar.personLook ? '<div class="pp5-sec pp5-look"><span class="pp5-face">' + window.Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none', attrs: ' width="56" height="56"' }, window.Avatar.personLook(p)).replace('viewBox="0 0 200 200"', 'viewBox="66 22 70 70"') + '</span><span class="muted hl-small">' + (p.look ? 'Their look in the People picture' : 'Picked from the name – make it look like them') + '</span><button type="button" class="text-btn" data-pplook="' + esc(p.id) + '"><i class="bi bi-person-bounding-box"></i> ' + (p.look ? 'Change look' : 'Customize look') + '</button></div>' : '';
    return lookSec + '<div class="pp5-sec"><div class="pp5-sh"><b><i class="bi bi-gift"></i> Gifts given</b><button type="button" class="text-btn" data-ppgift="' + esc(p.id) + '"><i class="bi bi-plus-lg"></i> Note a gift</button></div>' +
      (gl.length ? '<ul class="pp5-list">' + gl.slice(0, all ? 50 : 4).map(function (g) {
        var o = occ(g.occ);
        return '<li><span class="pp5-d">' + esc(fmt(g.date, { month: 'short', year: 'numeric' })) + '</span><span class="pp5-t"><i class="bi bi-' + o[2] + '" style="color:' + o[3] + '"></i> <span data-noi18n>' + esc(g.what) + '</span></span>' + (+g.cost ? '<span class="pp5-k">' + kr(g.cost) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="hl-small muted">Nothing noted yet – then you never give the same twice.</p>') + '</div>' +
      (log.length ? '<div class="pp5-sec"><div class="pp5-sh"><b><i class="bi bi-clock-history"></i> Talked</b>' + (log.length > 4 ? '<button type="button" class="text-btn" data-pplogall="' + esc(p.id) + '">' + (all ? 'Show less' : 'Show all ' + log.length) + '</button>' : '') + '</div><ul class="pp5-list">' +
        log.slice(0, all ? 40 : 4).map(function (x, i) { return '<li><span class="pp5-d">' + esc(fmt(x.d, { day: 'numeric', month: 'short', year: x.d.slice(0, 4) !== today().slice(0, 4) ? 'numeric' : undefined })) + '</span><span class="pp5-t"' + (x.t ? ' data-noi18n' : '') + '>' + (x.t ? esc(x.t) : '<span class="muted">–</span>') + '</span>' +
          '<button type="button" class="icon-btn sm" data-pplognote="' + esc(p.id) + '|' + i + '" aria-label="' + (x.t ? 'Change the note' : 'Add a note') + '"><i class="bi bi-pencil"></i></button></li>'; }).join('') + '</ul></div>' : '');
  }
  var OPENLOG = {};
  /* after "Talked today": one line about what you talked about */
  function askNote(id, old, idx) {
    var p = person(id); if (!p) return false;
    if (idx == null && !cfg().askNote) return false;
    var i = idx || 0, cur = ((p.log || [])[i] || {}).t || '';
    var dg = HL.dialog(HL.dhead('chat-heart', idx == null ? 'Talked with ' + p.name : 'Note', 'What did you talk about? One line is plenty – it builds a short history.') +
      '<form class="pp5-note"><input name="t" maxlength="200" autocomplete="off" enterkeyhint="done" placeholder="e.g. New job in Bergen, wants to meet in December" value="' + esc(cur) + '">' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-hlclose>' + (idx == null ? 'Skip' : 'Cancel') + '</button><span class="spacer"></span><button type="submit" class="pill-btn">Save</button></div></form>');
    var form = dg.el.querySelector('form'), inp = form.querySelector('input');
    setTimeout(function () { inp.focus(); }, 80);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim().slice(0, 200), t = Fe.tools();
      (t.people || []).forEach(function (x) { if (x.id === id && x.log && x.log[i]) { if (v) x.log[i].t = v; else delete x.log[i].t; } });
      Fe.saveTools(t); dg.close();
      toast('<i class="bi bi-chat-heart"></i> Noted', old ? function () { restore('people', old); } : null);
    });
    if (idx == null) toast('<i class="bi bi-chat-heart"></i> Noted', function () { dg.close(); restore('people', old); });
    return true;
  }

  /* the Gifts card */
  var GY = null;
  function drawGifts() {
    var el = $t('pgifts'); if (!el) return;
    var ok = on(); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
    var c = cfg(), y = GY || today().slice(0, 4), all = gifts(), gl = all.filter(function (g) { return gyear(g) === y; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var sum = function (l) { return l.reduce(function (s, g) { return s + (+g.cost || 0); }, 0); };
    var xm = gl.filter(function (g) { return g.occ === 'xmas'; }), bd = gl.filter(function (g) { return g.occ === 'bday'; }), ot = gl.filter(function (g) { return g.occ !== 'xmas' && g.occ !== 'bday'; });
    var years = {}; all.forEach(function (g) { years[gyear(g)] = 1; }); years[today().slice(0, 4)] = 1;
    var ys = Object.keys(years).filter(function (x) { return /^\d{4}$/.test(x); }).sort(), yi = ys.indexOf(y);
    var list = people().filter(function (p) { return p.xmas; }).sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); });
    var sorted = list.filter(function (p) { return xm.some(function (g) { return g.pid === p.id; }); }).length;
    var tl = function (k, label, val, sub) { return '<div class="kit-tile" data-tk="' + k + '"><span>' + label + '</span><b>' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var over = function (spent, budget) { return budget && spent > budget ? '<span class="neg">' + kr(spent) + '</span>' : kr(spent); };
    var tiles = '<div class="kit-tiles" id="ppGiftTiles">' +
      tl('spent', 'Spent', kr(sum(gl)), y + ' · ' + gl.length + ' gift' + (gl.length === 1 ? '' : 's')) +
      tl('xmas', 'Christmas gifts', over(sum(xm), +c.gbXmas), +c.gbXmas ? 'of ' + kr(c.gbXmas) : list.length ? sorted + ' of ' + list.length + ' sorted' : 'No budget set') +
      tl('bday', 'Birthdays', kr(sum(bd)), bd.length ? (+c.gbBday ? 'budget ' + kr(c.gbBday) + ' each' : bd.length + ' gift' + (bd.length === 1 ? '' : 's')) : (+c.gbBday ? 'budget ' + kr(c.gbBday) + ' each' : 'None yet')) + '</div>';
    var xmasBox = '';
    if (list.length && y === today().slice(0, 4)) {
      var bud = +c.gbXmas, sp = sum(xm), pct = list.length ? Math.round(sorted / list.length * 100) : 0;
      xmasBox = '<div class="pp5-xmas"><div class="hs-prog" style="--c:#22b35e"><span><b>' + sorted + ' / ' + list.length + '</b> Christmas gifts sorted' + (bud ? ' · ' + (sp > bud ? '<span class="neg">' + kr(sp - bud) + ' over</span>' : kr(bud - sp) + ' left') : '') + '</span><i><em style="width:' + pct + '%"></em></i></div>' +
        '<ul class="pp5-xl">' + list.map(function (p) {
          var g = xm.filter(function (x) { return x.pid === p.id; });
          return '<li class="' + (g.length ? 'done' : '') + '"><i class="bi bi-' + (g.length ? 'check-circle-fill' : 'circle') + '"></i><span class="pp5-t"><b>' + esc(p.name) + '</b><small' + (g.length ? ' data-noi18n' : '') + '>' + (g.length ? esc(g.map(function (x) { return x.what + (+x.cost ? ' · ' + kr(x.cost) : ''); }).join(', ')) : esc(String(p.gifts || '').split('\n')[0] ? 'Idea: ' + String(p.gifts).split('\n')[0] : 'Nothing yet')) + '</small></span>' +
            '<button type="button" class="icon-btn sm" data-ppgift="' + esc(p.id) + '|xmas" aria-label="Note a Christmas gift for ' + esc(p.name) + '"><i class="bi bi-plus-lg"></i></button></li>';
        }).join('') + '</ul></div>';
    }
    var shown = GALL ? gl : gl.slice(0, 6);
    var body = tiles + xmasBox +
      (gl.length ? '<p class="st-minor pp5-minor">Given in ' + y + '</p><ul class="kit-list">' + shown.map(function (g) {
        var o = occ(g.occ), p = person(g.pid);
        return '<li class="kit-item"><button type="button" class="kit-main" data-ppgedit="' + esc(g.id) + '"><span class="kit-ic" style="--c:' + o[3] + '"><i class="bi bi-' + o[2] + '"></i></span><span class="kit-x"><b data-noi18n>' + esc(g.what) + '</b><small data-noi18n>' + esc([p ? p.name : '–', occName(o), fmt(g.date)].join(' · ')) + '</small></span>' + (+g.cost ? '<span class="kit-r">' + kr(g.cost) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul>' + (gl.length > 6 ? '<button class="text-btn kit-more" type="button" data-ppgall>' + (GALL ? 'Show less' : 'Show all ' + gl.length) + '</button>' : '')
        : '<p class="empty kit-empty">Note what you give – then you never give the same twice, and you see what Christmas and birthdays cost. Put people on the Christmas list from their card (Edit → On the Christmas gift list).</p>');
    var nav = ys.length > 1 ? '<button type="button" class="icon-btn" data-ppgy="-1" aria-label="Previous year"' + (yi <= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button><button type="button" class="icon-btn" data-ppgy="1" aria-label="Next year"' + (yi >= ys.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' : '';
    el.innerHTML = '<section class="card kit-card" id="pgifts"><div class="card-head"><h2><i class="bi bi-gift"></i> Gifts</h2><div class="head-actions">' + nav +
      '<button type="button" class="text-btn" data-ppgift=""><i class="bi bi-plus-lg"></i> Add</button></div></div>' + body + '</section>';
    if (location.hash === '#pgifts' && document.documentElement.classList.contains('unlocked')) { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400); }
  }
  var GALL = false;
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawGifts.t); drawGifts.t = setTimeout(drawGifts, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawGifts, 50); setTimeout(fromHash, 400); });

  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-pplook]')) && window.Avatar && window.Avatar.editor) {
      var pl = person(b.dataset.pplook); if (!pl) return;
      window.Avatar.editor(pl.name, window.Avatar.personLook(pl), function (lk) {
        var t = Fe.tools(); (t.people || []).forEach(function (x) { if (x.id === pl.id) x.look = lk; }); Fe.saveTools(t);
        toast('<i class="bi bi-person-bounding-box"></i> ' + esc(pl.name) + (NB ? ' har fått nytt utseende' : '’s look is saved'));
      });
      return;
    }
    if ((b = e.target.closest('[data-ppgift]'))) {
      var q = b.dataset.ppgift.split('|'), p = q[0] && person(q[0]);
      return newGift(p ? { pid: p.id, occ: q[1] || guessOcc(p) } : {});
    }
    if ((b = e.target.closest('[data-ppgave]'))) {
      var r = b.dataset.ppgave.split('|'), pp = person(r[0]); if (!pp) return;
      var idea = String(pp.gifts || '').split('\n').filter(Boolean)[+r[1]]; if (!idea) return;
      return newGift({ pid: pp.id, occ: guessOcc(pp), what: idea }, function (it, isNew) {
        if (!isNew) return;
        var t = Fe.tools(); (t.people || []).forEach(function (x) { if (x.id === pp.id) { var l = String(x.gifts || '').split('\n').filter(Boolean); l.splice(+r[1], 1); x.gifts = l.join('\n'); } }); Fe.saveTools(t);
      });
    }
    if ((b = e.target.closest('[data-ppgedit]')) && K) { var g = gifts().filter(function (x) { return x.id === b.dataset.ppgedit; })[0]; if (g) K.edit(giftCfg(), g); return; }
    if ((b = e.target.closest('[data-ppgy]'))) {
      var ys = {}; gifts().forEach(function (x) { ys[gyear(x)] = 1; }); ys[today().slice(0, 4)] = 1;
      var l = Object.keys(ys).filter(function (x) { return /^\d{4}$/.test(x); }).sort(), i = l.indexOf(GY || today().slice(0, 4)) + (+b.dataset.ppgy);
      if (l[i]) { GY = l[i]; drawGifts(); } return;
    }
    if (e.target.closest('[data-ppgall]')) { GALL = !GALL; return drawGifts(); }
    if ((b = e.target.closest('[data-pplogall]'))) { OPENLOG[b.dataset.pplogall] = !OPENLOG[b.dataset.pplogall]; if (window.Dash && window.Dash.reload) window.Dash.reload(); return; }
    if ((b = e.target.closest('[data-pplognote]'))) { var s = b.dataset.pplognote.split('|'); askNote(s[0], snapshot('people'), +s[1]); return; }
    if (e.target.closest('[data-ppimport]')) { e.preventDefault(); openImport(''); }
  });

  /* At a glance: name days, anniversaries, the Christmas list */
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    if (!on()) return;
    var c = cfg();
    people().forEach(function (p) {
      var tel = String(p.phone || '').replace(/[^\d+]/g, ''), nd = nameday(p);
      if (nd && nd.n === 0) add(44, 'calendar-heart', PURPLE, p.name + '’s name day today', 'Gratulerer med navnedagen!', tel ? 'sms:' + tel : '/cmd/people/#people=' + p.id);
      otherDates(p).forEach(function (a) {
        if (a.n > +c.annLead) return;
        add(a.n === 0 ? 20 : 42, a.icon, AMBER, p.name + ': ' + a.label + ' ' + inDays(a.n), a.years ? a.years + ' years' : fmt(a.next, { weekday: 'long', day: 'numeric', month: 'long' }), '/cmd/people/#people=' + p.id);
      });
    });
    var m = now.getMonth(), d = now.getDate();
    if (c.xmasNudge && ((m === 10 && d >= 15) || (m === 11 && d <= 23))) {
      var y = today().slice(0, 4), list = people().filter(function (p) { return p.xmas; });
      var xm = gifts().filter(function (g) { return g.occ === 'xmas' && gyear(g) === y; });
      var left = list.filter(function (p) { return !xm.some(function (g) { return g.pid === p.id; }); });
      if (list.length && left.length) {
        var sp = xm.reduce(function (s, g) { return s + (+g.cost || 0); }, 0), bud = +c.gbXmas;
        add(m === 11 ? 36 : 62, 'gift', '#22b35e', 'Christmas gifts: ' + (list.length - left.length) + ' of ' + list.length + ' sorted',
          'Left: ' + left.slice(0, 3).map(function (p) { return p.name; }).join(', ') + (left.length > 3 ? ' +' + (left.length - 3) : '') + (bud ? ' · ' + kr(Math.max(0, bud - sp)) + ' left' : ''), '/cmd/people/#pgifts');
      }
    }
  });

  /* ======================= contacts import ======================= */
  var MON = { jan: 1, january: 1, januar: 1, feb: 2, february: 2, februar: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, okt: 10, october: 10, oktober: 10, nov: 11, november: 11, dec: 12, des: 12, december: 12, desember: 12 };
  /* a birthday in any of the ways the iPhone writes it → "24.12" or "24.12.1990" */
  function pdate(s) {
    s = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var m, d, mo, y = null;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^--(\d{2})-?(\d{2})$/))) { mo = +m[1]; d = +m[2]; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\.?$/))) { d = +m[1]; mo = +m[2]; y = m[3] ? +m[3] : null; if (y && y < 100) y += y > 30 ? 1900 : 2000; }
    else if ((m = s.match(/^(\d{1,2})\.? ([a-zæøå]+)\.?,? ?(\d{4})?$/)) && MON[m[2]]) { d = +m[1]; mo = MON[m[2]]; y = m[3] ? +m[3] : null; }
    else if ((m = s.match(/^([a-z]+)\.? (\d{1,2}),? ?(\d{4})?$/)) && MON[m[1]]) { mo = MON[m[1]]; d = +m[2]; y = m[3] ? +m[3] : null; }
    else return null;
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    if (y && (y < 1900 || y > new Date().getFullYear())) y = null;      // the iPhone saves "no year" as 1604
    return pad(d) + '.' + pad(mo) + (y ? '.' + y : '');
  }
  function isPhone(s) { return /^[+(]?\d[\d\s().-]{4,}$/.test(String(s).trim()) && String(s).replace(/\D/g, '').length >= 5; }
  function parseVcf(text) {
    var out = [];
    String(text).replace(/\r?\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1).forEach(function (card) {
      var r = { name: '', bday: null, phone: '' };
      card.split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^(?:item\d+\.)?([A-Z-]+)(?:;[^:]*)?:(.*)$/i); if (!m) return;
        var k = m[1].toUpperCase(), v = m[2].trim().replace(/\\,/g, ',').replace(/\\;/g, ';');
        if (k === 'FN' && !r.name) r.name = v;
        if (k === 'N' && !r.name) { var n = v.split(';'); r.nameN = [n[1], n[0]].filter(Boolean).join(' '); }
        if (k === 'BDAY') r.bday = pdate(v.replace(/T.*$/, ''));
        if (k === 'TEL' && !r.phone) r.phone = v;
      });
      r.name = r.name || r.nameN || ''; delete r.nameN;
      if (r.name) out.push(r);
    });
    return out;
  }
  function parseLines(text) {
    text = String(text || '');
    if (/BEGIN:VCARD/i.test(text)) return parseVcf(text);
    var out = [], seen = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var r = { name: '', bday: null, phone: '' };
      line.split(/\s*(?:;|\t|\s\|\s)\s*/).forEach(function (f) {
        if (!f) return;
        var d = !r.bday && pdate(f);
        if (d) r.bday = d; else if (isPhone(f)) { if (!r.phone) r.phone = f; } else if (!r.name) r.name = f.slice(0, 80);
      });
      if (!r.name) { var prev = out[out.length - 1]; if (prev) { if (r.phone && !prev.phone) prev.phone = r.phone; if (r.bday && !prev.bday) prev.bday = r.bday; } return; }
      var k = r.name.toLowerCase(); if (seen[k]) return; seen[k] = 1;
      out.push(r);
    });
    return out;
  }
  function status(r) {
    var ex = people().filter(function (p) { return String(p.name).trim().toLowerCase() === r.name.trim().toLowerCase(); })[0];
    if (!ex) return { s: 'new' };
    var adds = []; if (r.bday && !HL.bday(ex)) adds.push('birthday'); if (r.phone && !ex.phone) adds.push('phone');
    return adds.length ? { s: 'update', p: ex, adds: adds } : { s: 'same', p: ex };
  }
  var IMP = null;
  function openImport(text) {
    if (!on()) return;
    var dg = HL.dialog('<div class="pp5-imp"></div>', function (e, close) {
      var b;
      if (e.target.closest('[data-ppipaste]')) {
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) { IMP.rows = parseLines(t); IMP.only = IMP.rows.some(function (r) { return r.bday; }); draw(); } else draw('The clipboard is empty.'); }, function () { draw('Couldn’t read the clipboard – paste into the box instead.'); });
        return;
      }
      if (e.target.closest('[data-ppiread]')) { var ta = dg.el.querySelector('textarea'); IMP.rows = parseLines(ta ? ta.value : ''); IMP.only = IMP.rows.some(function (r) { return r.bday; }); if (!IMP.rows.length) draw('No names found – one person per line: Name; 24.12.1990; +47 …'); else draw(); return; }
      if (e.target.closest('[data-ppiback]')) { IMP.rows = null; return draw(); }
      if ((b = e.target.closest('[data-ppionly]'))) { IMP.only = b.checked; IMP.sel = null; return draw(); }
      if (e.target.closest('[data-ppigo]')) {
        var picked = [].slice.call(dg.el.querySelectorAll('[data-ppirow]:checked')).map(function (c) { return IMP.view[+c.dataset.ppirow]; });
        if (!picked.length) return;
        var old = snapshot('people'), t = Fe.tools(), l = Array.isArray(t.people) ? t.people : [], nNew = 0, nUp = 0, defEvery = +cfg().defEvery || 0;
        picked.forEach(function (r) {
          var st = status(r);
          if (st.s === 'new') { l.push({ id: uid(), name: r.name, rel: 'friend', bday: r.bday || '', phone: r.phone || '', every: defEvery }); nNew++; }
          else if (st.s === 'update') { l.forEach(function (p) { if (p.id === st.p.id) { if (r.bday && !HL.bday(p)) p.bday = r.bday; if (r.phone && !p.phone) p.phone = r.phone; } }); nUp++; }
        });
        t.people = l; Fe.saveTools(t); close();
        toast('<i class="bi bi-person-check"></i> ' + [nNew ? nNew + ' added' : '', nUp ? nUp + ' updated' : ''].filter(Boolean).join(', '), function () { restore('people', old); });
      }
    });
    IMP = { rows: text ? parseLines(text) : null, only: true, sel: null };
    if (IMP.rows) IMP.only = IMP.rows.some(function (r) { return r.bday; });
    dg.el.addEventListener('change', function (e) {
      var f = e.target.closest('[data-ppifile]');
      if (f && f.files[0]) f.files[0].text().then(function (t) { IMP.rows = parseLines(t); IMP.only = IMP.rows.some(function (r) { return r.bday; }); draw(IMP.rows.length ? '' : 'No contacts in that file.'); });
      if (e.target.closest('[data-ppirow]')) count();
    });
    function count() { var n = dg.el.querySelectorAll('[data-ppirow]:checked').length, b = dg.el.querySelector('[data-ppigo]'); if (b) { b.disabled = !n; b.textContent = n ? 'Import ' + n : 'Import'; } }
    function draw(msg) {
      var box = dg.el.querySelector('.pp5-imp'), h = HL.dhead('person-down', 'Import contacts', IMP.rows ? '' : 'From your iPhone, with birthdays. The list stays on this device until you pick who to add.');
      if (!IMP.rows || !IMP.rows.length) {
        box.innerHTML = h + (msg ? '<p class="pp5-msg">' + esc(msg) + '</p>' : '') +
          '<div class="pp5-way"><b><i class="bi bi-clipboard"></i> From the iPhone Shortcut</b><textarea rows="4" placeholder="Paste here – one person per line: Name; 24.12.1990; +47 912 34 567"></textarea>' +
          '<div class="hl-acts"><button type="button" class="pill-btn" data-ppiread>Read the list</button>' + (navigator.clipboard && navigator.clipboard.readText ? '<button type="button" class="text-btn" data-ppipaste><i class="bi bi-clipboard-check"></i> Paste</button>' : '') + '</div></div>' +
          '<div class="pp5-way"><b><i class="bi bi-person-vcard"></i> From a contact file</b><label class="text-btn pp5-file"><i class="bi bi-folder2-open"></i> Choose a .vcf file<input type="file" accept=".vcf,text/vcard,text/x-vcard" data-ppifile hidden></label><small class="muted" data-noi18n>' + L('Contacts on the iPhone: Lists → long-press a list → Export. On a Mac: select contacts → File → Export → vCard.', 'Kontakter på iPhone: Lister → hold inne en liste → Eksporter. På Mac: velg kontakter → Arkiv → Eksporter → vCard.') + '</small></div>' +
          '<details class="pp5-steps" data-noi18n>' + L(
          '<summary><i class="bi bi-lightning-charge"></i> Set up the iPhone Shortcut (3 minutes, once)</summary><ol>' +
          '<li>Shortcuts → <b>+</b>. Name it <i>Contacts to dashboard</i>.</li>' +
          '<li>Add <b>Find Contacts</b>. Optional: <b>Add Filter</b> (e.g. a group) – or keep everyone and pick here.</li>' +
          '<li>Add <b>Repeat with Each</b> (the contacts).</li>' +
          '<li>Inside it, add <b>Text</b> with: <b>Repeat Item</b> → tap it → <i>Name</i>, type <code>;</code>, <b>Repeat Item</b> → <i>Birthday</i> (tap it → Date Format: Custom <code>dd.MM.yyyy</code>), type <code>;</code>, <b>Repeat Item</b> → <i>Phone Numbers</i>.</li>' +
          '<li>After <b>End Repeat</b>: <b>Combine Text</b> (Repeat Results, New Lines).</li>' +
          '<li><b>Copy to Clipboard</b> (Combined Text) – a fallback if you have to log in first.</li>' +
          '<li><b>URL Encode</b> (Combined Text), then <b>Text</b>: <code>https://jplundberg.com/cmd/people/#import=</code> followed by <i>URL Encoded Text</i>.</li>' +
          '<li><b>Open URLs</b> (Text). Run it – this window opens with the list. If it opens empty, tap <b>Paste</b>.</li></ol>' +
          '<p class="muted hl-small">The list travels after the # in the link, which browsers never send to a server.</p>',
          '<summary><i class="bi bi-lightning-charge"></i> Sett opp snarveien på iPhone (3 minutter, én gang)</summary><ol>' +
          '<li>Snarveier → <b>+</b>. Kall den <i>Kontakter til dashbordet</i>.</li>' +
          '<li>Legg til <b>Finn kontakter</b>. Valgfritt: <b>Legg til filter</b> (f.eks. en gruppe) – eller ta med alle og velg her.</li>' +
          '<li>Legg til <b>Gjenta med hver</b> (kontaktene).</li>' +
          '<li>Inni den: <b>Tekst</b> med <b>Gjentatt objekt</b> → trykk på det → <i>Navn</i>, skriv <code>;</code>, <b>Gjentatt objekt</b> → <i>Fødselsdag</i> (trykk → Datoformat: Tilpasset <code>dd.MM.yyyy</code>), skriv <code>;</code>, <b>Gjentatt objekt</b> → <i>Telefonnumre</i>.</li>' +
          '<li>Etter <b>Slutt på gjentakelse</b>: <b>Kombiner tekst</b> (Gjentakelsesresultater, Ny linje).</li>' +
          '<li><b>Kopier til utklippstavle</b> (Kombinert tekst) – i tilfelle du må logge inn først.</li>' +
          '<li><b>URL-kode</b> (Kombinert tekst), så <b>Tekst</b>: <code>https://jplundberg.com/cmd/people/#import=</code> etterfulgt av <i>URL-kodet tekst</i>.</li>' +
          '<li><b>Åpne URL-er</b> (Tekst). Kjør den – dette vinduet åpnes med listen. Er det tomt, trykk <b>Lim inn</b>.</li></ol>' +
          '<p class="muted hl-small">Listen ligger etter # i lenken, og den delen sender nettleseren aldri til noen server.</p>') + '</details>';
        return;
      }
      var rows = IMP.rows.map(function (r) { return { r: r, st: status(r) }; });
      var view = rows.filter(function (x) { return !IMP.only || x.r.bday || x.st.s !== 'new'; });
      IMP.view = view.map(function (x) { return x.r; });
      var nb = IMP.rows.filter(function (r) { return r.bday; }).length;
      box.innerHTML = h + '<p class="muted hl-small">' + IMP.rows.length + ' found · ' + nb + ' with a birthday</p>' +
        (nb && nb < IMP.rows.length ? '<label class="st-row pp5-only"><span>Only those with a birthday</span><input type="checkbox" class="switch" data-ppionly' + (IMP.only ? ' checked' : '') + '></label>' : '') +
        '<ul class="pp5-rows">' + view.map(function (x, i) {
          var st = x.st, chip = st.s === 'new' ? '<span class="hl-chip" style="--c:#22b35e">New</span>' : st.s === 'update' ? '<span class="hl-chip" style="--c:#3987e5">Adds ' + st.adds.join(' + ') + '</span>' : '<span class="hl-chip" style="--c:#7a8794">Already there</span>';
          var b = x.r.bday ? x.r.bday.split('.') : null;
          return '<li><label><input type="checkbox" data-ppirow="' + i + '"' + (st.s !== 'same' && (x.r.bday || st.s === 'update') ? ' checked' : '') + (st.s === 'same' ? ' disabled' : '') + '><span class="pp5-t"><b data-noi18n>' + esc(x.r.name) + '</b><small>' +
            esc([b ? new Date(b[2] ? +b[2] : 2000, b[1] - 1, +b[0]).toLocaleDateString('en-GB', b[2] ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }) : 'No birthday', x.r.phone].filter(Boolean).join(' · ')) + '</small></span>' + chip + '</label></li>';
        }).join('') + '</ul>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-ppiback><i class="bi bi-chevron-left"></i> Back</button><span class="spacer"></span><button type="button" class="pill-btn" data-ppigo>Import</button></div>';
      count();
    }
    draw();
  }
  /* the Shortcut opens /cmd/people/#import=<the list> */
  function fromHash() {
    var m = location.hash.match(/^#import(?:=([\s\S]*))?$/); if (!m || !/\/cmd\/people\/$/.test(location.pathname)) return;
    var text = ''; try { text = decodeURIComponent(m[1] || ''); } catch (e) { text = m[1] || ''; }
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () { openImport(text); }, 200);
  }
  window.addEventListener('hashchange', function () { if (document.documentElement.classList.contains('unlocked')) fromHash(); });

  /* search (⌘K) and the cards use these */
  window.PeoplePlus = { nameday: nameday, otherDates: otherDates, upcoming: upcoming, days: days, detail: detail, askNote: askNote, gifts: gifts, openImport: openImport, parse: parseLines, pdate: pdate,
    importBtn: function () { return '<button type="button" class="text-btn" data-ppimport aria-label="Import contacts"><i class="bi bi-person-down"></i> Import</button>'; } };
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () { return on() ? [
    { i: 'gift', t: 'Note a gift', s: 'People', run: function () { if (/\/cmd\/people\//.test(location.pathname)) newGift({}); else location.href = '/cmd/people/#pgifts'; }, x: 'gift present gave gift gaver julegave bursdagsgave' },
    { i: 'person-down', t: 'Import contacts', s: 'People', run: function () { if (/\/cmd\/people\//.test(location.pathname)) openImport(''); else location.href = '/cmd/people/#import'; }, x: 'import contacts kontakter iphone vcf birthdays bursdager' }] : []; });
})();
