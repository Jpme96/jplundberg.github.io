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
/* The everywhere part (made by cmd/split-page.js): hooks for other pages and the data they need. The rest is in people-plus.page.js, loaded only on its own page. */
(function () {
  "use strict";
  function __ui() { return (window.__ui || {})["peopleplus"] || {}; }   /* page-only things, when this is their page */
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features;
  var HL = window.HomeLife;
  if (!HL) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var dkey = Fe.dkey;
  var fromKey = Fe.fromKey;
  function today() { return dkey(new Date()); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }
  function fmt(k, o) { return fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short' }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function on() { return Fe.on('people'); }
  function cfg() { return HL.cfg('peoplecfg'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function restore(k, v) { var t = Fe.tools(); t[k] = v; Fe.saveTools(t); }
  function people() { return Fe.list('people'); }
  function person(id) { return people().filter(function (p) { return p.id === id; })[0]; }
  var PURPLE = '#8a6fdf';
  var AMBER = '#c98500';
  var ND = ';Dagfinn,Dagfrid;Alfred,Alf;Roar,Roger;Hanna,Hanne;Aslaug,Åslaug;Eldbjørg,Knut;Torfinn,Turid;Gunnar,Gunn;Sigmund,Sigrun;Børge,Børre;Reinhard,Reinert;Gisle,Gislaug;Herbjørn,Herbjørg;Laurits,Laura;Hjalmar,Hilmar;Anton,Tønnes,Tony;Hildur,Hild;Marius,Margunn;Fabian,Sebastian,Bastian;Agnes,Agnete;Ivan,Vanja;Emil,Emilie,Emma;Joar,Jarle,Jarl;Paul,Pål;Øystein,Esten;Gaute,Gurly,Gry;Karl,Karoline;Herdis,Hermod,Hermann;Gunnhild,Gunda;Idun,Ivar|Birte,Bjarte;Jomar,Jostein;Ansgar,Asgeir;Veronika,Vera;Agate,Ågot;Dortea,Dorte;Rikard,Rigmor,Riborg;Åshild,Åsne;Lone,Leikny;Ingfrid,Ingrid;Ingve,Yngve;Randulf,Randi,Ronja;Svanhild,Svanlaug;Hjørdis,Jardar;Sigfred,Sigbjørn;Julian,Juliane,Jill;Aleksandra,Sandra,Sondre;Frøydis,Frode;Ella,Elna;Halldis,Halldor;Samuel,Selma,Celine;Tina,Tine,Tim;Torstein,Torunn;Mattias,Mattis,Mats;Viktor,Viktoria;Inger,Ingjerd;Laila,Lill;Marina,Maren|Audny,Audun;Erna,Ernst;Gunnbjørg,Gunnveig;Ada,Adrian;Patrick,Patricia;Annfrid,Andor;Arild,Are;Beate,Betty,Bettina;Sverre,Sindre;Edel,Edle;Edvin,Tale;Gregor,Gro;Greta,Grete;Mathilde,Mette;Christel,Christer,Chris;Gudmund,Gudny;Gjertrud,Trude;Aleksander,Sander,Edvard;Josef,Josefine;Joakim,Kim;Bendik,Bengt,Bent;Paula,Pauline;Gerda,Gerd;Ulrikke,Rikke;Maria,Marie,Mari;Gabriel,Glenn;Rudolf,Rudi;Åsta,Åste;Jonas,Jonatan;Holger,Olga;Vebjørn,Vegard|Aron,Arve,Arvid;Sigvard,Sivert;Gunnvald,Gunnvor;Nanna,Nancy,Nina;Irene,Eirin,Eril;Åsmund,Asmund;Oddveig,Oddvin;Asle,Atle;Rannveig,Rønnaug;Ingvald,Ingveig;Ylva,Ulf;Julius,Julie;Asta,Astrid;Ellinor,Nora;Oda,Odin,Odd;Magnus,Mons;Elise,Else,Elsa;Eilen,Eilert;Arnfinn,Arnstein;Kjellaug,Kjellrun;Jeanette,Jannike;Oddgeir,Oddny;Georg,Jørgen,Jørg;Albert,Olaug;Markus,Mark;Terese,Tea;Charles,Charlotte,Lotte;Vivi,Vivian;Toralf,Torolf;Gina,Gitte|Filip,Valborg;Åsa,Åse;Gjermund,Gøril;Monika,Mona;Gudbrand,Gullborg;Guri,Gyri;Maia,Mai,Maiken;Åge,Åke;Kasper,Jesper;Asbjørg,Asbjørn,Espen;Magda,Malvin;Normann,Norvald;Linda,Line,Linn;Kristian,Kristen,Karsten;Hallvard,Hallvor;Sara,Siren;Harald,Ragnhild;Eirik,Erik,Erika;Torjus,Torje,Truls;Bjørnar,Bjørnhild;Helene,Ellen,Eli;Henning,Henny;Oddleif,Oddlaug;Ester,Iris;Ragna,Ragnar;Annbjørg,Annlaug;Katinka,Cato;Vilhelm,William,Willy;Magnar,Magnhild;Gard,Geir;Pernille,Preben|June,Juni;Runa,Runar,Rune;Rasmus,Rakel;Heidi,Heid;Torbjørg,Torbjørn,Torben;Gustav,Gyda;Robert,Robin;Renate,René;Kolbein,Kolbjørn;Ingolf,Ingunn;Borgar,Bjørge,Bjørg;Sigfrid,Sigrid,Siri;Tone,Tonje,Tanja;Erlend,Erland;Vigdis,Viggo;Torhild,Toril,Tiril;Botolf,Bodil;Bjarne,Bjørn;Erling,Elling;Salve,Sølve,Sølvi;Agnar,Annar;Håkon,Maud;Elfrid,Eldrid;Johannes,Jon,Hans;Jørund,Jorunn;Jenny,Jonny;Aina,Ina,Ine;Lea,Leo,Leon;Peter,Petter,Per;Solbjørg,Solgunn|Ask,Embla;Kjartan,Kjellfrid;Andrea,Andrine,André;Ulrik,Ulla;Mirjam,Mina;Torgrim,Torgunn;Håvard,Hulda;Sunniva,Synnøve,Synne;Gøran,Jøran,Ørjan;Anita,Anja;Kjetil,Kjell;Elias,Eldar;Mildrid,Melissa,Mia;Solfrid,Solrun;Oddmund,Oddrun;Susanne,Sanna;Guttorm,Gorm;Arnulf,Ørnulf;Gerhard,Gjert;Margareta,Margit,Marit;Johanne,Janne,Jane;Malene,Malin,Mali;Brita,Brit,Britt;Kristine,Kristin,Kristi;Jakob,Jack,Jim;Anna,Anne,Ane;Marita,Rita;Reidar,Reidun;Olav,Ola,Ole;Aurora,Audhild,Aud;Elin,Eline|Peder,Petra;Karen,Karin;Oline,Oliver,Olve;Arnhild,Arna,Arne;Osvald,Oskar;Gunnlaug,Gunnleiv;Didrik,Doris;Evy,Yvonne;Ronald,Ronny;Lorents,Lars,Lasse;Torvald,Tarald;Klara,Camilla;Anny,Anine,Ann;Hallgeir,Hallgjerd;Margot,Mary,Marielle;Brynjulf,Brynhild;Verner,Wenche;Tormod,Torodd;Sigvald,Sigve;Bernhard,Bernt;Ragnvald,Ragni;Harriet,Harry;Signe,Signy;Belinda,Bertil;Ludvig,Lovise,Louise;Øyvind,Eivind,Even;Roald,Rolf;Artur,August;Johan,Jone,Jo;Benjamin,Ben;Berta,Berte|Solveig,Solvår;Lisa,Lise,Liss;Alise,Alvhild,Vilde;Ida,Idar;Brede,Brian,Njål;Sollaug,Siril,Siv;Regine,Rose;Amalie,Alma,Allan;Trygve,Tyra,Trym;Tord,Tor;Dagny,Dag;Jofrid,Jorid;Stian,Stig;Ingebjørg,Ingeborg;Aslak,Eskil;Lillian,Lilly;Hildebjørg,Hildegunn;Henriette,Henry;Konstanse,Connie;Tobias,Tage;Trine,Trond;Kyrre,Kåre;Snorre,Snefrid;Jan,Jens;Ingvar,Yngvar;Einar,Endre;Dagmar,Dagrun;Lena,Lene;Mikael,Mikal,Mikkel;Helga,Helge,Hege|Rebekka,Remi;Live,Liv;Evald,Evelyn;Frans,Frank;Brynjar,Boye,Bo;Målfrid,Møyfrid;Birgitte,Birgit,Berit;Benedikte,Bente;Leidulf,Leif;Fridtjof,Frida,Frits;Kevin,Kennet,Kent;Valter,Vibeke;Torgeir,Terje,Tarjei;Kaia,Kai;Hedvig,Hedda;Flemming,Finn;Marta,Marte;Kjersti,Kjerstin;Tora,Tore;Henrik,Heine,Henrikke;Bergljot,Birger;Karianne,Karine,Kine;Severin,Søren;Eilif,Eivor;Margrete,Merete,Märtha;Amandus,Amanda;Sturla,Sture;Simon,Simen;Noralf,Norunn;Aksel,Åmund,Ove;Edit,Edna|Veslemøy,Vetle;Tove,Tuva;Raymond,Roy;Otto,Ottar;Egil,Egon;Leonard,Lennart;Ingebrigt,Ingelin;Ingvild,Yngvild;Tordis,Teodor;Gudbjørg,Gudveig;Martin,Morten,Martine;Torkjell,Torkil;Kirsten,Kirsti;Fredrik,Fred,Freddy;Oddfrid,Oddvar;Edmund,Edgar;Hugo,Hogne,Hauk;Magne,Magny;Elisabet,Lisbet;Halvdan,Helle;Mariann,Marianne;Cecilie,Silje,Sissel;Klement,Klaus;Gudrun,Guro;Katarina,Katrine,Kari;Konrad,Kurt;Torlaug,Torleif;Ruben,Rut;Sofie,Sonja;Andreas,Anders|Arnold,Arnljot,Arnt;Borghild,Borgny,Bård;Sveinung,Svein;Barbara,Barbro;Stine,Ståle;Nils,Nikolai;Hallfrid,Hallstein;Marlene,Marion,Morgan;Anniken,Annette;Judit,Jytte;Daniel,Dan;Pia,Peggy;Lucia,Lydia;Steinar,Stein;Hilda,Hilde;Oddbjørg,Oddbjørn;Inga,Inge;Kristoffer,Kate;Iselin,Isak;Abraham,Amund;Tomas,Tom,Tommy;Ingemar,Ingar;Sigurd,Sjur;Adam,Eva;;Stefan,Steffen;Narve,Natalie;Unni,Une,Unn;Vidar,Vemund;David,Diana,Dina;Sylfest,Sylvia,Sylvi';
  var ndMap = null;
  function names() {
    if (ndMap) return ndMap;
    ndMap = {};
    ND.split('|').forEach(function (mo, mi) { mo.split(';').forEach(function (day, di) { day.split(',').forEach(function (n) { n = n.trim().toLowerCase(); if (n && !ndMap[n]) ndMap[n] = [mi + 1, di + 1]; }); }); });
    return ndMap;
  }
  function firstName(n) { return String(n || '').trim().split(/[\s-]+/)[0].toLowerCase(); }
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
  function gifts() { return Fe.list('gifts'); }
  function gyear(g) { return String(g.date || '').slice(0, 4); }
  function askNote(id, old, idx) {
    var p = person(id); if (!p) return false;
    if (idx == null && !cfg().askNote) return false;
    var i = idx || 0, cur = ((p.log || [])[i] || {}).t || '';
    var dg = HL.dialog(HL.dhead('chat-heart', idx == null ? 'Talked with ' + p.name : 'Note', I18N.k('ui.what-did-you-talk-about-one-line-is-plen', 'What did you talk about? One line is plenty – it builds a short history.')) +
      '<form class="pp5-note"><input name="t" maxlength="200" autocomplete="off" enterkeyhint="done" placeholder="e.g. New job in Bergen, wants to meet in December" value="' + esc(cur) + '">' +
      '<div class="qa-acts"><button type="button" class="text-btn" data-hlclose>' + (idx == null ? 'Skip' : 'Cancel') + '</button><span class="spacer"></span><button type="submit" class="pill-btn" data-t="ui.save"><span data-t="ui.save">Save</span></button></div></form>');
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
  window.BriefExtra = window.BriefExtra || [];
  window.BriefExtra.push(function (add, now) {
    if (!on()) return;
    var c = cfg();
    people().forEach(function (p) {
      var tel = String(p.phone || '').replace(/[^\d+]/g, ''), nd = nameday(p);
      if (nd && nd.n === 0) add(44, 'calendar-heart', PURPLE, p.name + '’s name day today', I18N.k('ui.gratulerer-med-navnedagen', 'Gratulerer med navnedagen!'), tel ? 'sms:' + tel : '/cmd/people/#people=' + p.id);
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
  window.CommandExtra = window.CommandExtra || [];
  window.CommandExtra.push(function () { return on() ? [
    { i: 'gift', t: 'Note a gift', s: 'People', run: function () { if (/\/cmd\/people\//.test(location.pathname)) __ui().newGift({}); else location.href = '/cmd/people/#pgifts'; }, x: 'gift present gave gift gaver julegave bursdagsgave' },
    { i: 'person-down', t: 'Import contacts', s: 'People', run: function () { if (/\/cmd\/people\//.test(location.pathname)) __ui().openImport(''); else location.href = '/cmd/people/#import'; }, x: 'import contacts kontakter iphone vcf birthdays bursdager' }] : []; });
  window.PeoplePlus = { nameday: nameday, otherDates: otherDates, upcoming: upcoming, days: days, askNote: askNote, gifts: gifts, importBtn: function () { return '<button type="button" class="text-btn" data-ppimport aria-label="Import contacts" data-t-aria-label="ui.import-contacts"><i class="bi bi-person-down"></i> <span data-t="ui.import">Import</span></button>'; } };
  (window.__core = window.__core || {})["peopleplus"] = { on: on, Fe: Fe, kr: kr, nf: nf, gyear: gyear, gifts: gifts, today: today, dkey: dkey, fmt: fmt, fromKey: fromKey, inDays: inDays, AMBER: AMBER, otherDates: otherDates, nextOf: nextOf, PURPLE: PURPLE, nameday: nameday, firstName: firstName, names: names, ND: ND, ndMap: ndMap, cfg: cfg, HL: HL, people: people, askNote: askNote, restore: restore, toast: toast, esc: esc, person: person, days: days, upcoming: upcoming };
})();
