/* Pictures at the top of the pages (batch 6, Oct 2026) – like the house on the House page:
     People    a table: a cake for a birthday soon, a gift while their Christmas gift isn't sorted,
               a speech bubble for someone you're overdue to talk to, a star on a name day
     Food      fridge, pantry shelf (what's running low looks half empty), tonight's pot, the shopping bag
     Work      a desk: clock with the flex balance, papers for open action points, a hard hat for an
               inspection this week, a coffee cup that fills as the work day goes, the laptop lit by a timer
     Health    rested or tired after last night's sleep, a step ring, a dumbbell on training days
     Finances  a jar with what's left this period – amber when you spend too fast, coins on payday
     Travel    a suitcase that fills as you pack, a countdown tag, a plane along a dotted line
   Tap a part to go to its card. Each one can be switched off in Settings → Pictures & touches
   (dash.settings.touch). Time of day and season come from delight.js (window.SceneDeco). */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var Fe = window.Features, NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { var a = new Date(k + 'T12:00'), b = new Date(today() + 'T12:00'); return Math.round((a - b) / 864e5); }
  function inDays(n) { return n === 0 ? L('today', 'i dag') : n === 1 ? L('tomorrow', 'i morgen') : L('in ' + n + ' days', 'om ' + n + ' dager'); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function on(k) { return window.Delight ? window.Delight.on(k) : true; }
  function deco(k) { return window.SceneDeco ? window.SceneDeco(k) : ''; }
  function badge(n, x, y) { return n ? '<g class="hs-b" transform="translate(' + x + ' ' + y + ')"><circle r="9"/><text y="3.6" text-anchor="middle">' + (n > 9 ? '9+' : n) + '</text></g>' : ''; }
  function part(go, cls, inner) { return '<g class="hs-part' + (cls ? ' ' + cls : '') + '" data-scgo="' + esc(go) + '">' + inner + '</g>'; }
  function ground() { return '<rect x="0" y="128" width="240" height="22" class="hs-ground"/>'; }

  var PAGE = (location.pathname.match(/\/cmd\/(people|food|work|habits|finance|travel)\/$/) || [])[1];
  if (!PAGE) return;
  var KEY = { people: 'scPeople', food: 'scFood', work: 'scWork', habits: 'scHealth', finance: 'scFin', travel: 'scTravel' }[PAGE];
  var FEAT = { people: 'people', food: 'food', work: 'work', habits: 'healthpage', finance: 'finance', travel: 'travel' }[PAGE];

  /* ---------------- People ---------------- */
  /* a person at the table in the same style as your avatar: look picked from the name, shirt in the relation colour */
  var SKINS = ['#f3d4bb', '#e3b893', '#c99a73', '#a8774f', '#82563a', '#5a3a27'], HAIRS = ['#1e140d', '#4a2f1d', '#7a4b2a', '#b98a4f', '#e2c27d', '#9a9a9a', '#a8432f'];
  function hash(t) { var h = 2166136261; t = String(t || ''); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
  function bust(x, p, c, ini, sc) {
    var h = hash(p.id || p.name), S = SKINS[h % 6], H = HAIRS[(h >>> 8) % 7], style = (h >>> 16) % 5;
    var hair = [
      '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-1-6-4-10-8-12-6 3-16 3-23 0-3 3-5 7-6 12z" fill="' + H + '"/>',
      '<path d="M81 63c-3-18 7-27 20-27 14 0 22 10 19 27-3-8-8-13-14-14-8 4-18 4-25 0z" fill="' + H + '"/>',
      '<g fill="' + H + '"><circle cx="86" cy="52" r="6.5"/><circle cx="94" cy="44" r="7"/><circle cx="104" cy="42" r="7.5"/><circle cx="113" cy="46" r="7"/><circle cx="118" cy="54" r="6"/><circle cx="83" cy="60" r="4.5"/><circle cx="120" cy="61" r="4.5"/></g>',
      '<circle cx="101" cy="31" r="7" fill="' + H + '"/><path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-2-8-8-13-18-13s-16 5-19 13z" fill="' + H + '"/>',
      '<path d="M82 63c-3-18 7-27 20-27 14 0 20 10 18 24-8-8-20-12-30-8-4 2-6 6-8 11z" fill="' + H + '"/>'][style];
    var back = style === 1 ? '<path d="M80 60c-2-16 8-24 21-24s23 8 21 24v24c-4 4-8 0-8-6V62H88v16c0 6-4 10-8 6z" fill="' + H + '"/>' : '';
    var g = '<rect x="80" y="70" width="42" height="64" rx="8" fill="#3a2a20"/><path d="M74 132v-26c0-12 12-18 27-18s27 6 27 18v26z" fill="' + c + '"/><path d="M93 88l8 9 8-9" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>' +
      back + '<rect x="95" y="80" width="12" height="10" rx="3" fill="' + S + '"/>' +
      '<path d="M101 40c12.5 0 19 9 19 22s-8.5 22-19 22-19-9-19-22 6.5-22 19-22z" fill="' + S + '"/><ellipse cx="82.5" cy="63" rx="3.5" ry="5" fill="' + S + '"/><ellipse cx="119.5" cy="63" rx="3.5" ry="5" fill="' + S + '"/>' +
      '<circle cx="94" cy="62" r="2.2" fill="#2b211b"/><circle cx="108" cy="62" r="2.2" fill="#2b211b"/><path d="M95 72q6 6 12 0" fill="#fff" stroke="#8a4636" stroke-width="1.8" stroke-linejoin="round"/>' + hair +
      (ini ? '<text x="101" y="113" text-anchor="middle" font-size="13" font-weight="800" fill="rgba(255,255,255,.9)">' + esc(ini) + '</text>' : '');
    sc = sc || .5;
    return '<g transform="translate(' + (x - 101 * sc).toFixed(1) + ' ' + (98 - 118 * sc).toFixed(1) + ') scale(' + sc + ')">' + g + '</g>';
  }
  function people() {
    var HL = window.HomeLife, PP = window.PeoplePlus; if (!HL) return null;
    var l = Fe.list('people'), m = new Date().getMonth(), d = new Date().getDate(), y = today().slice(0, 4);
    var xmasTime = (m === 10 && d >= 1) || (m === 11 && d <= 24), gifts = Fe.list('gifts').filter(function (g) { return g.occ === 'xmas' && String(g.date || '').slice(0, 4) === y; });
    var rows = l.map(function (p) {
      var b = HL.bday(p), nd = PP && PP.nameday(p), od = HL.overdue(p), marks = [];
      if (b && b.n <= 7) marks.push({ k: 'cake', t: p.name + ': ' + L('birthday ', 'bursdag ') + inDays(b.n), hot: b.n <= 1, w: b.n });
      if (nd && nd.n === 0) marks.push({ k: 'star', t: p.name + ': ' + L('name day today', 'navnedag i dag'), hot: true, w: 0.5 });
      if (xmasTime && p.xmas && !gifts.some(function (g) { return g.pid === p.id; })) marks.push({ k: 'gift', t: p.name + ': ' + L('no Christmas gift yet', 'ingen julegave ennå'), w: 20 });
      if (od != null) marks.push({ k: 'talk', t: L('Catch up with ', 'Ta kontakt med ') + p.name, w: 15 });
      return { p: p, marks: marks, w: marks.length ? Math.min.apply(null, marks.map(function (x) { return x.w; })) : 100 + (b ? b.n : 400) };
    }).sort(function (a, b) { return a.w - b.w; });
    var seat = rows.slice(0, 5), n = seat.length, REL = { family: '#d55181', friend: '#3987e5', work: '#e8743b', other: '#7a8794' };
    var svg = ground() + deco('people') +
      '';
    /* a little get-together: everyone standing on the grass, drawn like your avatar with their own look,
       gently swaying and taking turns to talk. A birthday person has a cake on a small table beside them. */
    var AV = window.Avatar && window.Avatar.personLook, H = [0, 104, 100, 94, 88, 82][n] || 82, W = H * 0.86;
    var gap = Math.min(W * 0.92, 210 / Math.max(1, n)), xs = seat.map(function (r, i) { return 120 + (i - (n - 1) / 2) * gap; });
    var talk = n > 1 ? (new Date().getMinutes() % n) : -1;
    svg += '<g class="sc-mingle">';
    /* a bit of depth: every other person stands a step back (smaller, higher); the back row is drawn first */
    var order = seat.map(function (r, i) { return i; }).sort(function (a, b) { return (b % 2) - (a % 2); });
    order.forEach(function (i) {
      var r = seat[i], back = n > 2 && i % 2 === 1, Hs = back ? H * 0.9 : H, Ws = Hs * 0.86, feet = back ? 131 : 136;
      var x = xs[i], c = REL[r.p.rel] || '#3987e5', ini = ((String(r.p.name || '').match(/\p{L}/u) || [''])[0]).toUpperCase();
      var hot = r.marks.some(function (q) { return q.hot; }) ? 'hot' : '', ks = r.marks.map(function (q) { return q.k; });
      var W = Ws, top = feet - Hs * 0.975, headTop = top + 0.065 * Hs, extra = '', above = '';
      if (ks.indexOf('cake') > -1) {           /* cake on a little round table, at the side facing the middle */
        /* the cake stands on a little table right in front of the birthday person */
        var cx = x, ty = feet - Hs * 0.36, k = Math.max(.7, Hs / 100);
        extra += '<g class="sc-cake" transform="translate(' + cx.toFixed(1) + ' ' + ty.toFixed(1) + ') scale(' + k.toFixed(2) + ')">' +
          '<rect x="-1.4" y="0" width="2.8" height="' + ((feet - ty) / k).toFixed(1) + '" fill="#6b4a36"/><ellipse cx="0" cy="' + ((feet - ty) / k).toFixed(1) + '" rx="6" ry="1.5" fill="rgba(0,0,0,.25)"/><ellipse cx="0" cy="0" rx="13" ry="3" fill="#8a5d43"/>' +
          '<rect x="-9" y="-11" width="18" height="10.5" rx="2.5" fill="#f2b8c6"/><rect x="-9" y="-7.5" width="18" height="2.4" fill="#d55181"/>' +
          '<line x1="0" y1="-17" x2="0" y2="-11" stroke="#f2c94c" stroke-width="1.8"/><ellipse class="sc-flame sc-flick" cx="0" cy="-18.6" rx="1.6" ry="2.6"/></g>';
      }
      if (ks.indexOf('gift') > -1) extra += '<g transform="translate(' + (x + (x <= 120 ? -1 : 1) * W * 0.36) + ' 119)"><rect x="-6" y="0" width="12" height="10" rx="1.5" fill="#22b35e"/><rect x="-1" y="0" width="2" height="10" fill="#f2c94c"/><path d="M-3.5 -1 q3.5 -4 3.5 1 q0 -5 3.5 -1" stroke="#f2c94c" fill="none" stroke-width="1.3"/></g>';
      if (ks.indexOf('star') > -1) above = '<path transform="translate(' + x + ' ' + (headTop - 9) + ')" d="M0 -6 l1.8 3.8 4.2.5 -3.1 2.8 .9 4.1 -3.8-2.2 -3.8 2.2 .9-4.1 -3.1-2.8 4.2-.5z" class="sc-star"/>';
      var bubble = ks.indexOf('talk') > -1 ? 'sc-say on' : n > 1 ? 'sc-say' + (i === talk ? ' show' : '') : '';
      if (bubble) above += '<g class="' + bubble + '" transform="translate(' + (x + W * 0.28) + ' ' + (headTop - 4) + ')"><rect x="-9" y="-12" width="18" height="11" rx="5" class="sc-bubble"/><path d="M-3 -1 l-1.5 4 5 -4z" class="sc-bubble"/><circle cx="-4.5" cy="-6.5" r="1.1" class="sc-dot"/><circle cx="0" cy="-6.5" r="1.1" class="sc-dot"/><circle cx="4.5" cy="-6.5" r="1.1" class="sc-dot"/></g>';
      var who = AV ? window.Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none', attrs: ' x="' + (x - W / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + W.toFixed(1) + '" height="' + Hs.toFixed(1) + '"' }, window.Avatar.personLook(r.p, r.p.look ? null : c))
          .replace('viewBox="0 0 200 200"', 'viewBox="40 22 122 142"')
        : bust(x, r.p, c, ini, .5);
      svg += part('people=' + r.p.id, hot, '<g class="sc-sway" style="animation-delay:-' + (i * 1.3).toFixed(1) + 's;transform-origin:' + x.toFixed(1) + 'px ' + feet + 'px">' + who + '</g>' + extra + above) +
        (r.marks.length > 1 ? badge(r.marks.length, x + W / 2 - 4, headTop + 4) : '');
    });
    svg += '</g>';
    if (!n) svg += '<text x="120" y="80" text-anchor="middle" class="sc-empty">' + L('Add the people who matter', 'Legg til de som betyr noe') + '</text>';
    var list = []; rows.forEach(function (r) { r.marks.forEach(function (m) { list.push({ t: m.t, h: '#people=' + r.p.id, w: m.w }); }); });
    list.sort(function (a, b) { return a.w - b.w; });
    return { svg: svg, label: L('Your people', 'Personene dine'), list: list, empty: n ? L('Everyone’s fine – nothing coming up this week.', 'Alle har det fint – ingenting denne uka.') : '' };
  }

  /* ---------------- Food ---------------- */
  function food() {
    var HL = window.HomeLife; if (!HL) return null;
    var T = Fe.tools(), pantry = Array.isArray(T.pantry) ? T.pantry : [], shop = (T.shop || []).filter(function (x) { return !x.done; }), dinner = (HL.meals() || {})[today()];
    var low = pantry.filter(function (x) { return x.state === 'low'; }), jars = low.concat(pantry.filter(function (x) { return x.state !== 'low'; })).slice(0, 12);
    var JC = ['#e8743b', '#c98500', '#8a6fdf', '#22b35e', '#3987e5', '#d55181'];
    var svg = ground() + deco('food') +
      part('meals', '', '<rect x="10" y="42" width="44" height="86" rx="5" class="sc-fridge"/><line x1="10" y1="72" x2="54" y2="72" class="sc-line"/><rect x="47" y="52" width="2.5" height="12" rx="1" class="sc-handle"/><rect x="47" y="80" width="2.5" height="16" rx="1" class="sc-handle"/>') +
      '<rect x="62" y="74" width="80" height="3" rx="1" class="sc-wood"/><rect x="62" y="104" width="80" height="3" rx="1" class="sc-wood"/>';
    var jarsSvg = jars.map(function (x, i) {
      var shelf = i < 6 ? 0 : 1, j = i % 6, X = 66 + j * 12.6, Y0 = shelf ? 104 : 74, h = 16, lw = x.state === 'low', fh = lw ? 5 : 12;
      return '<rect x="' + X + '" y="' + (Y0 - h) + '" width="9" height="' + h + '" rx="2" class="sc-jar' + (lw ? ' low' : '') + '"/><rect x="' + (X + 1.2) + '" y="' + (Y0 - fh - 1) + '" width="6.6" height="' + fh + '" rx="1" fill="' + (lw ? '#c98500' : JC[i % JC.length]) + '" opacity=".8"/><rect x="' + (X - .5) + '" y="' + (Y0 - h - 2) + '" width="10" height="3" rx="1" class="sc-lid"/>';
    }).join('');
    svg += part('pantry', low.length ? 'hot' : '', jarsSvg || '<text x="102" y="68" text-anchor="middle" class="sc-empty sm">' + L('pantry', 'matskap') + '</text>') + badge(low.length, 140, 58);
    svg += part('shop', shop.length ? '' : '', '<path d="M148 108 h20 l-2 20 h-16z" class="sc-bag"/><path d="M152 108 q6 -10 12 0" class="sc-bagh"/>') + badge(shop.length, 168, 102);
    svg += part('meals', dinner ? 'hot' : '', '<rect x="178" y="98" width="52" height="30" rx="3" class="sc-stove"/><circle cx="192" cy="113" r="5" class="sc-knob2"/><circle cx="214" cy="113" r="5" class="sc-knob2"/>' +
      '<rect x="186" y="84" width="34" height="14" rx="3" class="sc-pot"/><rect x="182" y="86" width="4" height="3" rx="1" class="sc-pot"/><rect x="220" y="86" width="4" height="3" rx="1" class="sc-pot"/><rect x="190" y="81" width="26" height="3" rx="1.5" class="sc-pot"/>' +
      (dinner ? '<path d="M196 77 q-3 -6 0 -12 M204 77 q-3 -6 0 -12 M212 77 q-3 -6 0 -12" class="sc-steam"/>' : ''));
    var list = [];
    if (dinner) list.push({ t: L('Tonight: ', 'I kveld: ') + dinner, h: '#meals' }); else list.push({ t: L('Nothing planned tonight', 'Ingenting planlagt i kveld'), h: '#meals', late: false });
    if (shop.length) list.push({ t: shop.length + L(' on the shopping list', ' på handlelista'), h: '#shop' });
    low.slice(0, 2).forEach(function (x) { list.push({ t: x.name + L(' is running out', ' er snart tom'), h: '#pantry' }); });
    return { svg: svg, label: L('Your kitchen', 'Kjøkkenet ditt'), list: list };
  }

  /* ---------------- Work ---------------- */
  function work() {
    var T = Fe.tools(), st = window.FlexTime && Fe.on('flex') ? window.FlexTime.stats() : null, norm = (+((T.flexcfg || {}).norm) || 7.5) * 60;
    var open = 0; if (Fe.on('meetings')) (T.meetings || []).forEach(function (m) { String(m.actions || '').split('\n').forEach(function (x, i) { if (x.trim() && !(m.done || {})[i]) open++; }); });
    var insp = Fe.on('fdv') ? (T.fdv || []).filter(function (r) { var n = daysTo(String(r.date || '')); return isFinite(n) && n >= -6 && n <= 6; }) : [];
    var timer = Fe.on('ptime') && T.ptrun, fill = st ? Math.min(1, (st.today || 0) / norm) : 0;
    var now = new Date(), ha = (now.getHours() % 12 + now.getMinutes() / 60) * 30, ma = now.getMinutes() * 6;
    var bal = st ? (st.balance < 0 ? '−' : '+') + window.FlexTime.dur(Math.abs(st.balance)) : '';
    var hand = function (a, len, cls) { var r = a * Math.PI / 180; return '<line x1="200" y1="38" x2="' + (200 + Math.sin(r) * len).toFixed(1) + '" y2="' + (38 - Math.cos(r) * len).toFixed(1) + '" class="' + cls + '"/>'; };
    var svg = ground() + deco('work') +
      part('flex', st ? '' : '', '<circle cx="200" cy="38" r="16" class="sc-clock"/>' + hand(ha, 8, 'sc-hh') + hand(ma, 12, 'sc-mh') + '<circle cx="200" cy="38" r="1.6" class="sc-dot"/>' +
        (st ? '<text x="200" y="66" text-anchor="middle" class="sc-lbl' + (st.balance < 0 ? ' neg' : '') + '">' + esc(bal) + '</text>' : '')) +
      (window.Avatar ? '<g class="sc-me">' + window.Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none', attrs: ' x="98" y="40" width="50" height="60"' }).replace('viewBox="0 0 200 200"', 'viewBox="56 24 90 108"').replace(/<ellipse cx="101" cy="160"[^>]*>/, '') + '</g>' : '') +
      '<rect x="24" y="96" width="192" height="6" rx="2" class="sc-wood"/><rect x="34" y="102" width="5" height="26" class="sc-wood"/><rect x="201" y="102" width="5" height="26" class="sc-wood"/>' +
      part('ptime', timer ? 'hot' : '', '<rect x="54" y="70" width="44" height="26" rx="2" class="sc-screen' + (timer ? ' lit' : '') + '"/><path d="M48 96 h56 l-4 -3 h-48z" class="sc-kbd"/>' + (timer ? '<path d="M72 78 l8 5 -8 5z" class="sc-play"/>' : ''));
    var stack = Math.min(6, open), papers = '';
    for (var i = 0; i < Math.max(1, stack); i++) papers += '<rect x="' + (114 + (i % 2)) + '" y="' + (93 - i * 3) + '" width="26" height="3" rx="1" class="sc-paper"/>';
    svg += part('meetings', open ? '' : '', papers) + badge(open, 142, 74 - stack * 3);
    svg += part('flex', '', '<path d="M150 80 h16 l-2 16 h-12z" class="sc-cup"/><clipPath id="scCup"><path d="M150 80 h16 l-2 16 h-12z"/></clipPath><rect x="148" y="' + (96 - 16 * fill).toFixed(1) + '" width="20" height="16" class="sc-coffee" clip-path="url(#scCup)"/><path d="M166 84 q6 0 5 5 q-1 4 -6 4" class="sc-cuph"/>');
    if (insp.length) svg += part('fdv', 'hot', '<path d="M176 96 q0 -14 14 -14 q14 0 14 14z" fill="#f2c94c"/><rect x="172" y="94" width="36" height="3" rx="1.5" fill="#d9a400"/>') + badge(insp.length, 206, 80);
    var list = [];
    if (st) list.push({ t: L('Flex ', 'Fleksi ') + bal, h: '#flex' });
    if (st && st.today) list.push({ t: window.FlexTime.dur(st.today) + L(' worked today', ' jobbet i dag'), h: '#flex' });
    if (timer) list.push({ t: L('A timer is running', 'En tidtaker går'), h: '#ptime' });
    if (open) list.push({ t: open + L(' open action points', ' åpne oppfølgingspunkter'), h: '#meetings', late: open > 5 });
    insp.slice(0, 1).forEach(function (r) { list.push({ t: L('Inspection: ', 'Befaring: ') + r.building, h: '#fdv=' + r.id }); });
    return { svg: svg, label: L('Your desk', 'Pulten din'), list: list, empty: L('Switch on Flex time, meetings or FDV to fill the desk.', 'Slå på fleksitid, møter eller FDV for å fylle pulten.') };
  }

  /* ---------------- Health ---------------- */
  function health() {
    var d = window.Vault.get() || {}, D = (d.health && d.health.days) || {}, td = today(), yd = dkey(new Date(Date.now() - 864e5));
    var day = D[td] || {}, ln = window.AHealth && window.AHealth.lastNight ? window.AHealth.lastNight() : null, sleep = ln ? (ln.partial ? 0 : ln.v) : (day.sleep || (D[yd] || {}).sleep || 0), steps = day.steps || 0;
    var s = readJSON('dash.settings', {}) || {}, goal = +((s.ahGoals || {}).steps) || 10000, pct = Math.min(1, steps / goal);
    var T = Fe.tools(), trained = (T.training || []).some(function (w) { return w.date === td; }) || (T.gym || []).some(function (g) { return String(g.date || '').slice(0, 10) === td; });
    var mood = !sleep ? 'ok' : sleep >= 7 ? 'good' : sleep >= 6 ? 'ok' : 'tired';
    var face = mood === 'good' ? '<circle cx="114" cy="50" r="1.8" class="sc-eye"/><circle cx="126" cy="50" r="1.8" class="sc-eye"/><path d="M113 57 q7 6 14 0" class="sc-mouth"/>'
      : mood === 'ok' ? '<circle cx="114" cy="50" r="1.6" class="sc-eye"/><circle cx="126" cy="50" r="1.6" class="sc-eye"/><path d="M114 58 h12" class="sc-mouth"/>'
        : '<path d="M111 51 h6 M123 51 h6" class="sc-mouth"/><path d="M115 59 q5 -3 10 0" class="sc-mouth"/><text x="140" y="38" class="sc-z">z</text><text x="147" y="30" class="sc-z sm">z</text>';
    var C = 2 * Math.PI * 30, ring = '<ellipse cx="120" cy="124" rx="30" ry="6" class="sc-ring"/><ellipse cx="120" cy="124" rx="30" ry="6" class="sc-ringv" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '"/>';
    var svg = ground() + deco('health') +
      part('ahealth', '', ring) +
      part('ahealth', window.Avatar ? 'sc-me' : mood === 'tired' ? 'hot' : '', window.Avatar ? window.Avatar.figure({ k: mood === 'good' ? 'day' : 'plain', mood: mood, plain: true, bg: '#000', sky: 'none', attrs: ' x="72" y="10" width="96" height="124" preserveAspectRatio="xMidYMax meet"' }).replace('viewBox="0 0 200 200"', 'viewBox="44 24 114 140"') : '<rect x="108" y="68" width="24" height="34" rx="10" class="sc-body"/><path d="M114 100 v22 M126 100 v22" class="sc-leg"/><path d="M108 76 l-10 14 M132 76 l10 14" class="sc-leg"/><circle cx="120" cy="52" r="13" class="sc-head"/>' + face) +
      part('training', trained ? 'hot lit' : '', '<rect x="176" y="114" width="34" height="3" rx="1.5" class="sc-bar"/><rect x="174" y="107" width="5" height="17" rx="1.5" class="sc-plate2"/><rect x="207" y="107" width="5" height="17" rx="1.5" class="sc-plate2"/>') +
      part('hpHabits', '', '<path d="M50 70 c-6 -8 -18 -2 -12 8 l12 12 12 -12 c6 -10 -6 -16 -12 -8z" class="sc-heart"/>');
    var list = [];
    if (sleep) list.push({ t: L('Slept ', 'Sov ') + Math.floor(sleep) + ' h ' + pad(Math.round((sleep % 1) * 60)), h: '#hreport', late: sleep < 6 });
    if (steps) list.push({ t: nf.format(steps) + L(' steps', ' skritt') + ' (' + Math.round(pct * 100) + ' %)', h: '#hreport' });
    if (trained) list.push({ t: L('Training done today', 'Trent i dag'), h: '#training' });
    return { svg: svg, label: L('How you’re doing', 'Hvordan du har det'), list: list, empty: L('Connect Apple Health to see sleep and steps here.', 'Koble til Apple Helse for å se søvn og skritt her.') };
  }

  /* ---------------- Finances ---------------- */
  function finance() {
    var B = window.Budget, d = window.Vault.get() || {}; if (!B) return null;
    var per = B.period(d), fixed = ((d.budget && d.budget.fixed) || []).reduce(function (a, f) { return a + (+f.amount || 0); }, 0);
    var room = per.income - fixed, spent = B.spent(d, per), left = room - spent, pace = B.pace(d);
    var ratio = room > 0 ? Math.max(0, Math.min(1, left / room)) : 0, state = left < 0 ? 'neg' : pace && !pace.ok ? 'warn' : 'ok';
    var payday = false; try { var np = B.nextPayday && B.nextPayday(d); payday = !!(np && np.days === 0); } catch (e) {}
    var H = 74, fy = 120 - H * ratio;
    var svg = ground() + deco('finance') +
      part('fin', state !== 'ok' ? 'hot' : '', '<clipPath id="scJar"><path d="M92 46 h56 q6 0 6 8 v62 q0 10 -10 10 h-48 q-10 0 -10 -10 v-62 q0 -8 6 -8z"/></clipPath>' +
        '<rect x="80" y="' + fy.toFixed(1) + '" width="80" height="90" class="sc-money ' + state + '" clip-path="url(#scJar)"/>' +
        '<path d="M92 46 h56 q6 0 6 8 v62 q0 10 -10 10 h-48 q-10 0 -10 -10 v-62 q0 -8 6 -8z" class="sc-jarg"/><rect x="96" y="36" width="48" height="10" rx="3" class="sc-lid"/>' +
        (room > 0 ? '<text x="120" y="92" text-anchor="middle" class="sc-jtxt">' + esc(kr(left)) + '</text>' : '')) +
      part('fin', '', '<rect x="30" y="92" width="34" height="34" rx="4" class="sc-cal"/><rect x="30" y="92" width="34" height="9" rx="3" fill="#e66767"/><text x="47" y="120" text-anchor="middle" class="sc-calt">' + per.daysLeft + '</text>') +
      (payday ? '<g class="sc-coins">' + [0, 1, 2].map(function (i) { return '<circle cx="' + (112 + i * 8) + '" cy="' + (20 - i * 6) + '" r="5" class="sc-coin c' + i + '"/>'; }).join('') + '</g>' : '') +
      (pace ? part('fin', '', '<path d="' + (pace.ok ? 'M184 112 l12 -14 l12 14' : 'M184 98 l12 14 l12 -14') + '" class="sc-arrow ' + (pace.ok ? 'ok' : 'warn') + '"/>') : '');
    var list = [];
    if (room > 0) list.push({ t: kr(left) + L(' left', ' igjen') + ' · ' + per.daysLeft + (per.daysLeft === 1 ? L(' day', ' dag') : L(' days', ' dager')), h: '#fin', late: left < 0 });
    if (pace) list.push({ t: pace.ok ? L('On track', 'I rute') : L('Spending faster than planned', 'Bruker raskere enn planlagt'), h: '#fin', late: !pace.ok });
    if (payday) list.push({ t: L('Payday today', 'Lønning i dag'), h: '#fin' });
    return { svg: svg, label: L('Your money jar', 'Pengekrukka di'), list: list, empty: L('Set up your budget to fill the jar.', 'Sett opp budsjettet for å fylle krukka.') };
  }

  /* ---------------- Travel ---------------- */
  function travel() {
    var tv = readJSON('dash.travel', {}) || {}, td = today();
    var trips = (tv.trips || []).filter(function (t) { return t.start && (t.end || t.start) >= td; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; }), t = trips[0];
    var n = t ? daysTo(t.start) : null, away = t && n <= 0, pack = t ? (t.pack || []) : [], packed = pack.filter(function (p) { return p.done; }).length, pf = pack.length ? packed / pack.length : 0;
    var prog = !t ? 0 : away ? 1 : Math.max(0.04, Math.min(1, 1 - n / 60));
    /* the plane along a curve from (112,112) to (222,40) */
    var P = function (u) { var x = (1 - u) * (1 - u) * 112 + 2 * (1 - u) * u * 150 + u * u * 222, y = (1 - u) * (1 - u) * 112 + 2 * (1 - u) * u * 30 + u * u * 40; return [x, y]; };
    var p = P(prog), q = P(Math.min(1, prog + .02)), ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
    var svg = ground() + deco('travel') +
      part('trips', pack.length && pf < 1 && n != null && n <= 3 ? 'hot' : '', '<clipPath id="scCase"><rect x="30" y="72" width="62" height="52" rx="6"/></clipPath><rect x="30" y="72" width="62" height="52" rx="6" class="sc-case"/>' +
        '<rect x="30" y="' + (124 - 52 * pf).toFixed(1) + '" width="62" height="52" class="sc-casef" clip-path="url(#scCase)"/><rect x="30" y="72" width="62" height="52" rx="6" class="sc-caseo"/>' +
        '<path d="M50 72 v-8 h22 v8" class="sc-handle2"/><line x1="44" y1="74" x2="44" y2="122" class="sc-strap"/><line x1="78" y1="74" x2="78" y2="122" class="sc-strap"/>' +
        '<circle cx="40" cy="126" r="3" class="sc-wheel"/><circle cx="82" cy="126" r="3" class="sc-wheel"/>' +
        (t ? '<path d="M92 82 l8 6" class="sc-strap"/><rect x="96" y="86" width="22" height="13" rx="2" class="sc-tag"/><text x="107" y="95.5" text-anchor="middle" class="sc-tagt">' + (away ? '✈' : n + 'd') + '</text>' : '')) +
      '<path d="M112 112 Q150 30 222 40" class="sc-route"/>' +
      (t ? '<g class="sc-pin"><path d="M222 40 c-6 0 -8 -5 -8 -8 a8 8 0 0 1 16 0 c0 3 -2 8 -8 8z" fill="#e66767"/><circle cx="222" cy="31" r="3" fill="#fff"/></g>' : '') +
      part('trips', '', '<g transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ') rotate(' + ang.toFixed(0) + ')"><path d="M-9 0 h16 q4 0 4 1.5 q0 1.5 -4 1.5 h-16z M-1 1 l-6 -7 h3 l8 6z M-1 2 l-6 7 h3 l8 -6z M-9 1 l-3 -4 h2 l4 3z" class="sc-plane"/></g>');
    var list = [];
    if (t) {
      list.push({ t: (t.name || t.dest) + ' – ' + (away ? L('you’re away', 'du er borte') : inDays(n)), h: '#trip=' + t.id });
      if (pack.length) list.push({ t: L('Packed ', 'Pakket ') + packed + '/' + pack.length, h: '#trip=' + t.id, late: pf < 1 && n <= 2 });
      else list.push({ t: L('No packing list yet', 'Ingen pakkeliste ennå'), h: '#trip=' + t.id });
    }
    return { svg: svg, label: L('Your next trip', 'Neste reise'), list: list, empty: L('No trip planned – plan one under Trips.', 'Ingen reise planlagt – planlegg en under Reiser.') };
  }

  var MAKE = { people: people, food: food, work: work, habits: health, finance: finance, travel: travel };
  function draw() {
    var hero = document.querySelector('.fp-hero, .tv-hero'); if (!hero) return;
    var box = document.getElementById('scIllu');
    var ok = on(KEY) && Fe.on(FEAT) && document.documentElement.classList.contains('unlocked');
    if (!ok) { if (box) box.remove(); hero.classList.remove('has-illu'); return; }
    var s; try { s = MAKE[PAGE](); } catch (e) { console.error(e); s = null; }
    if (!s) { if (box) box.remove(); hero.classList.remove('has-illu'); return; }
    if (!box) { box = document.createElement('figure'); box.id = 'scIllu'; box.className = 'hs-illu sc-illu'; box.setAttribute('data-noi18n', ''); hero.appendChild(box); hero.classList.add('has-illu'); }
    var cap = s.list.length ? s.list.slice(0, 3).map(function (x) { return '<a href="' + esc(x.h) + '"' + (x.late ? ' class="late"' : '') + '>' + esc(x.t) + '</a>'; }).join(' · ') + (s.list.length > 3 ? ' · +' + (s.list.length - 3) : '') : esc(s.empty || '');
    var html = '<svg viewBox="0 0 240 150" role="img" aria-label="' + esc(s.label) + '">' + s.svg + '</svg><figcaption>' + cap + '</figcaption>';
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function go(target) {
    if (/=/.test(target)) { location.hash = target; return; }
    var c = document.getElementById(target) || document.querySelector('[data-tool="' + target + '"]') || document.querySelector('.' + target);
    if (!c) return;
    c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('sr-flash'); setTimeout(function () { c.classList.remove('sr-flash'); }, 1600);
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('#scIllu [data-scgo]'), a = e.target.closest('#scIllu a[href^="#"]');
    if (!g && !a) return;
    e.preventDefault(); go(g ? g.dataset.scgo : a.getAttribute('href').slice(1));
  });
  var t = null;
  /* the chat in the People picture: every ~1.8 s a random other person gets the "…" bubble */
  var chatT = setInterval(function () {
    var rt = document.documentElement.classList; if (rt.contains('mo-off') || rt.contains('mo-reduced') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var b = document.querySelectorAll('#scIllu .sc-mingle .sc-say:not(.on)'); if (b.length < 2 || document.hidden) return;
    var cur = -1; b.forEach(function (x, i) { if (x.classList.contains('show')) cur = i; });
    var next = Math.floor(Math.random() * (b.length - 1)); if (next >= cur && cur > -1) next++;
    b.forEach(function (x, i) { x.classList.toggle('show', i === next); });
  }, 1800);
  function soon() { clearTimeout(t); t = setTimeout(draw, 60); }
  ['tools:change', 'features:change', 'touch:change', 'fin:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, soon); });
  window.Vault.onUnlock(function () { setTimeout(draw, 120); });
  setInterval(draw, 60e3);       // the clock hands and the coffee
})();
