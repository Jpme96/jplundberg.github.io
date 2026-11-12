/* Your avatar (batch 6, Oct 2026): a little drawn figure on Home that you dress yourself
   (Settings → Pictures & touches → Your avatar), and that changes with your day – coffee in the morning,
   an umbrella when it rains, gym kit on training days, a suitcase before a trip, a gift when someone's
   birthday is close, arms up when today's top 3 are done, a lamp and tea in the evening, asleep at night.
   A speech bubble says the one thing that matters now; tap the figure for the next one.
   Your profile photo in the top bar gets a small badge for the same moment.
   Look in dash.settings.avatar, switches in dash.settings.touch (avatar, avBadge) – both synced. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dkey(new Date()); }
  function daysTo(k) { return Math.round((new Date(k + 'T12:00') - new Date(today() + 'T12:00')) / 864e5); }
  var root = document.documentElement, Fe = window.Features;
  function on(k) { return window.Delight ? window.Delight.on(k) : true; }

  var START = { build: 'slim', bottom: 'trousers', skin: '#c99a73', hair: 'short', hairC: '#1e140d', beard: 'stubble', glasses: 'none', top: 'sweater', topC: '#2f7a55', legs: '#2a2f3a', extra: 'lanyard' };
  function look() { var s = readJSON('dash.settings', {}) || {}; return Object.assign({}, START, s.avatar || {}); }
  var OPTS = {
    build: { t: L('Body', 'Kropp'), o: [['slim', L('Slim', 'Slank')], ['regular', L('Regular', 'Vanlig')], ['athletic', L('Athletic', 'Atletisk')], ['muscular', L('Muscular', 'Muskuløs')], ['broad', L('Broad', 'Bred')]] },
    skin: { t: L('Skin', 'Hud'), dots: true, o: [['#f3d4bb'], ['#e3b893'], ['#c99a73'], ['#a8774f'], ['#82563a'], ['#5a3a27']] },
    hair: { t: L('Hair', 'Hår'), o: [['short', L('Short', 'Kort')], ['side', L('Side part', 'Sideskill')], ['quiff', L('Quiff', 'Quiff')], ['curly', L('Curly', 'Krøllete')], ['buzz', L('Buzz cut', 'Snauklipt')], ['bald', L('Bald', 'Skallet')], ['long', L('Long', 'Langt')], ['bun', L('Bun', 'Knute')]] },
    hairC: { t: L('Hair colour', 'Hårfarge'), dots: true, o: [['#1e140d'], ['#4a2f1b'], ['#7a4e2a'], ['#b5854a'], ['#e0bf7a'], ['#9b9b9b'], ['#a33d2b']] },
    beard: { t: L('Beard', 'Skjegg'), o: [['none', L('None', 'Ingen')], ['stubble', L('Stubble', 'Stubber')], ['short', L('Short', 'Kort')], ['full', L('Full', 'Fullskjegg')], ['moustache', L('Moustache', 'Bart')]] },
    glasses: { t: L('Glasses', 'Briller'), o: [['none', L('None', 'Ingen')], ['round', L('Round', 'Runde')], ['square', L('Square', 'Firkantede')], ['sun', L('Sunglasses', 'Solbriller')]] },
    top: { t: L('Top', 'Overdel'), o: [['sweater', L('Sweater + shirt', 'Genser + skjorte')], ['tee', L('T-shirt', 'T-skjorte')], ['hoodie', L('Hoodie', 'Hettegenser')], ['shirt', L('Shirt', 'Skjorte')], ['jacket', L('Jacket', 'Jakke')], ['none', L('No top', 'Uten overdel')]] },
    topC: { t: L('Top colour', 'Farge på overdelen'), dots: true, o: [['#d9c7a8'], ['#2e3340'], ['#e8743b'], ['#2f5d8a'], ['#2f7a55'], ['#8a6fdf'], ['#b8b8b8'], ['#f2f2f2']] },
    bottom: { t: L('Bottoms', 'Underdel'), o: [['trousers', L('Trousers', 'Bukse')], ['shorts', L('Shorts', 'Shorts')], ['swim', L('Swim shorts', 'Badeshorts')]] },
    legs: { t: L('Bottoms colour', 'Farge på underdelen'), dots: true, o: [['#2a2f3a'], ['#3c5a7d'], ['#5b4b3a'], ['#6e6e6e'], ['#c9b48a']] },
    extra: { t: L('Extra', 'Ekstra'), o: [['none', L('Nothing', 'Ingenting')], ['lanyard', L('Work lanyard', 'Adgangskort')], ['cap', L('Cap', 'Caps')]] }
  };
  var MOMENTS = {
    morning: { k: 'morning', bg: '#2c1f12', sky: 'sun', i: 'cup-hot', c: '#f2c94c' }, day: { k: 'day', bg: '#1d2533', sky: 'sun', i: 'sun', c: '#f2c94c' },
    evening: { k: 'evening', bg: '#22182a', sky: 'moon', i: 'lamp', c: '#f6c85f' }, night: { k: 'night', bg: '#0f1020', sky: 'moon', i: 'moon-stars', c: '#9ea3e6' },
    rain: { k: 'rain', bg: '#14202b', sky: 'cloud', i: 'umbrella', c: '#3b9de0' }, gym: { k: 'gym', bg: '#13241b', sky: 'sun', i: 'activity', c: '#22b35e' },
    trip: { k: 'trip', bg: '#161e30', sky: 'sun', i: 'airplane', c: '#3987e5' }, bday: { k: 'bday', bg: '#2a1622', sky: 'sun', i: 'gift', c: '#d55181' },
    win: { k: 'win', bg: '#1f1a10', sky: 'sun', i: 'trophy', c: '#f2c94c' },
    couple: { k: 'couple', bg: '#2a1622', sky: 'sun', i: 'heart', c: '#e5484d', couple: 1 }
  };
  /* time-of-day backgrounds also follow light mode */
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; var m = function (c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); }; return '#' + [m(r), m(g), m(b)].map(function (c) { return c.toString(16).padStart(2, '0'); }).join(''); }
  /* what you wear and how you look today, by itself (Settings → Pictures & touches): an umbrella when it rains, a
     beanie in snow, a Santa hat in December, a 17 May ribbon, sunglasses on July days; tired after a short night,
     a drop of sweat when bills are overdue. Only on your own avatar, never on the people in People. */
  function wear() {
    var out = {}, now = new Date(), mo = now.getMonth(), dd = now.getDate(), h = now.getHours();
    if (on('avWear')) {
      var wx = readJSON('dash.wxNow', null), c = wx && Date.now() - wx.at < 3 * 3600e3 ? +wx.code : null;
      if (c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95)) out.rain = 1;
      if (c != null && ((c >= 71 && c <= 77) || c === 85 || c === 86)) out.snow = 1;
      if (mo === 11 && dd <= 26) out.santa = 1;
      if (mo === 4 && dd === 17) out.ribbon = 1;
      if (mo === 6 && h >= 8 && h < 20 && !out.rain) out.sun = 1;
      /* the temperature (C10): a padded jacket, beanie and scarf when it's cold, a T-shirt when it's warm */
      var tc = wx && Date.now() - wx.at < 3 * 3600e3 && typeof wx.t === 'number' ? wx.t : null;
      if (tc != null && tc <= 3) out.cold = 1; else if (tc != null && tc >= 22) out.hot = 1;
    }
    if (on('avMood') && window.Vault && window.Vault.get) {
      try {
        var ln = window.AHealth && window.AHealth.lastNight ? window.AHealth.lastNight() : null;
        if (ln && !ln.partial && ln.v > 0 && ln.v < 6 && h < 15) out.tired = 1;
        var d = window.Vault.get() || {}, ym = today().slice(0, 7), paid = ((d.paid || {})[ym]) || [];
        var fixed = ((d.budget && d.budget.fixed) || []).filter(function (f) { return f.day && !f.src; });
        if (paid.length) out.stress = fixed.some(function (f) { return +f.day <= dd - 3 && paid.indexOf(f.id) < 0; }) ? 1 : 0;
      } catch (e) {}
    }
    return out;
  }
  /* your own look as today dresses it (C10, in 2.5D since F3): weather clothes – a beanie, a scarf and a padded jacket
     when it's cold or snowing, a T-shirt when it's warm, sunglasses on sunny July days, a Santa hat in December; the
     umbrella is held (o.wxHold) where nothing else is in the hand. */
  function dressed(L, W) {
    W = W || wear(); var o = Object.assign({}, L);
    if (W.santa && (!o.hat || o.hat === 'none' || o.hat === 'beanie')) o.hat = 'santa';
    if (W.sun && (!o.glasses || o.glasses === 'none')) o.glasses = 'sun';
    if (W.rain) o.wxHold = 'umbrella';
    if (W.cold || W.snow) { if (!o.hat || o.hat === 'none') o.hat = 'beanie'; o.wxScarf = 1; if (['puffer', 'jacket', 'rain', 'knit', 'suit', 'bunad', 'robe'].indexOf(o.top) < 0 && o.top !== 'none') o.top = 'puffer'; }
    else if (W.hot && ['sweater', 'knit', 'hoodie', 'puffer', 'jacket'].indexOf(o.top) > -1) o.top = 'tee';
    return o;
  }
  /* the newer keys (2026-11): old looks keep working – 'extra' becomes a hat, a neck thing, a watch or earbuds */
  /* F0 (2026-11-12): the settings and choices JP took out of the avatar. Every look goes through trimLook():
     in norm() whenever it's drawn (yours, people's, your partner's from the shared box) and once for what's saved
     (upgrades.js step 3). Removed settings fall back to the plain default; removed choices become the nearest kept one.
     Tops and shoes have one standard colour; the weather can still add a scarf (dressed()) and the season its outfit. */
  var TRIM_GONE = ['eyeS', 'brows', 'nose', 'earS', 'lines', 'mark', 'pierce', 'hair2', 'hairAge', 'shape', 'tat', 'pat', 'chest', 'shoeC', 'socks', 'ears', 'neck', 'hold', 'badge', 'scene'];
  var TRIM_TO = { faceS: { square: 'oval', heart: 'oval' }, expr: { silly: 'grin', love: 'smile', starry: 'wow' }, cheeks: { both: 'blush' },
    beard: { chinstrap: 'short', handlebar: 'moustache', curled: 'moustache' }, glasses: { hearts: 'sun', stars: 'sun', monocle: 'round' },
    hair: { buzz: 'short', spiky: 'quiff', mullet: 'side', slick: 'side', sideshave: 'undercut', bowl: 'bangs', bun: 'topknot', cornrows: 'braids' },
    hat: { bucket: 'cap', beret: 'beanie', flowers: 'none' } };
  var TOP_STD = '#2f7a55';   /* forest green, JP 2026-11-12 */
  function trimLook(l) {
    if (!l || typeof l !== 'object') return l;
    var o = Object.assign({}, l);
    TRIM_GONE.forEach(function (k) { delete o[k]; });
    Object.keys(TRIM_TO).forEach(function (k) { var to = TRIM_TO[k][o[k]]; if (to) o[k] = to; });
    if (o.extra === 'lanyard' || o.extra === 'earbuds') o.extra = 'none';   /* the old single extra: only the cap and the watch are left */
    if (!/^#[0-9a-f]{6}$/i.test(o.topC || '')) o.topC = TOP_STD;   /* forest green unless you picked a colour (the top colour came back, JP 2026-11-12) */
    return o;
  }
  function norm(L) {
    L = trimLook(L);
    var x = L.extra; if (x && x !== 'none') { if (x === 'cap' && !L.hat) { L.hat = 'cap'; L.oldCap = 1; } if (x === 'watch' && !L.watch) L.watch = 'yes'; }
    if (L.auto === 'on') { var dt = new Date(), mo = dt.getMonth() + 1, dd = dt.getDate();
      if (mo === 12 && dd <= 26) { L.top = 'knit'; L.topC = '#b3202c'; L.hat = 'santa'; L.pat = 'none'; }
      else if (mo === 5 && dd === 17) { L.top = 'bunad'; L.hold = 'flag'; L.hat = 'none'; }
      else if ((mo === 10 && dd >= 29) || (mo === 11 && dd === 1)) L.hat = 'witch';
      else if (mo === 7) { if (!L.glasses || L.glasses === 'none') L.glasses = 'sun'; L.bottom = 'shorts'; L.shoes = 'sandals'; } }
    /* clashes – one choice wins, so nothing is drawn on top of something it can't go with */
    if (L.top === 'dress' && L.bottom !== 'swim') L.bottom = 'trousers';                 /* the dress covers the bottoms */
    if (L.aid === 'crutches' || L.aid === 'chair') L.hold = 'none';                       /* both hands are busy */
    return L;
  }
  /* what each moment does in 2.5D (F1b): the angle, what the hand holds, a pose. Body points are [height, forward]:
     the shoulder is at 88, the hip at 140; forward is toward where the figure faces. R/L in the couple pictures: R stands on
     the left and turns right, L the other way. */
  /* small moves of the 2.5D figure (F1b): tap moves, cheers, the idle look and stretch on Home and the avatar page.
     The figure is redrawn each frame with a changing pose, then put back as it was. Reduced motion: no moves. */
  var F25N = 0, F25A = {};
  var ACT25 = {
    wave: function (t, a) { return { a: a, pose: { far: UP(48, 14 + 10 * Math.sin(t * 22)) }, expr: 'grin' }; },
    jump: function (t, a) { var e = Math.sin(t * Math.PI); return { a: a, pose: { lift: 14 * e, near: UP(122 - 22 * e, 22), far: UP(122 - 22 * e, 22) } }; },
    spin: function (t, a) { return { a: a + 360 * t }; },
    laugh: function (t, a) { return { a: a, pose: { lean: .05 * Math.sin(t * 25) }, expr: 'laugh' }; },
    cheer: function (t, a) { var e = Math.min(1, Math.sin(t * Math.PI) * 2); return { a: a, pose: { lift: 8 * Math.abs(Math.sin(t * 9)) * e, near: UP(118 - 80 * e, 10), far: UP(118 - 80 * e, 10) }, expr: 'laugh' }; },
    dance: function (t, a) { var s = Math.sin(t * 24); return { a: a + 30 * Math.sin(t * 6), ph: t * 30, w: .35, pose: { near: UP(68 + 18 * s, 32), far: UP(68 - 18 * s, 32), lean: .04 * s }, expr: 'laugh' }; },
    look: function (t, a) { return { a: a + 45 * Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) }; },
    stretch: function (t, a) { var e = Math.sin(t * Math.PI); return { a: a, pose: { near: UP(118 - 90 * e, 4), far: UP(118 - 90 * e, 4), lean: -.05 * e }, expr: e > .5 ? 'calm' : null }; }
  };
  function act25(f, kind, ms) {
    var sv = f && (f.matches && f.matches('svg[data-f25]') ? f : f.querySelector('svg[data-f25]')), rt = document.documentElement.classList;
    if (!sv || !ACT25[kind] || rt.contains('mo-off') || rt.contains('mo-reduced') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;
    var A = F25A[+sv.getAttribute('data-f25') % 48]; if (!A || A.id !== +sv.getAttribute('data-f25')) return false;
    var t0 = performance.now(), d = ms || 1000, my = (sv._a25 = (sv._a25 || 0) + 1);
    var put = function (o, L) { var g = sv.querySelector('g.av-all'); if (!g) return; var tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tmp.innerHTML = Fig25.group(L, o); g.replaceWith(tmp.firstChild); };
    (function step(now) {
      if (sv._a25 !== my || !sv.isConnected) return;
      var t = Math.min(1, (now - t0) / d), r = ACT25[kind](t, A.o.a), o = Object.assign({}, A.o, { a: r.a, ph: r.ph || 0, w: r.w || 0, pose: Object.assign({}, A.o.pose || {}, r.pose || {}) });
      if (r.pose && (r.pose.near || r.pose.far)) o.hold = null;
      put(t < 1 ? o : A.o, t < 1 && r.expr ? Object.assign({}, A.L, { expr: r.expr }) : A.L);
      if (t < 1) requestAnimationFrame(step);
    })(t0);
    return true;
  }
  var UP = function (y, z) { return { m: 1, b: [y, z] }; };
  var FIG25 = {
    morning: { hold: 'cup' }, evening: { hold: 'book' }, night: { expr: 'calm' }, rain: { hold: 'umbrella' }, gym: { hold: 'dumbbell' },
    trip: { hold: 'suitcase', a: 30 }, bday: { hold: 'gift' }, win: { hold: 'trophy', expr: 'laugh' }, day: { pose: { far: UP(52, 8) } },
    holdR: { a: 55, pose: { near: UP(128, 30) } }, holdL: { a: -55, pose: { near: UP(128, 30) } },
    hi5R: { a: 60, pose: { near: UP(58, 46) }, expr: 'laugh' }, hi5L: { a: -60, pose: { near: UP(58, 46) }, expr: 'laugh' },
    hugR: { a: 62, pose: { near: UP(96, 34), far: UP(96, 34) } }, hugL: { a: -62, pose: { near: UP(96, 34), far: UP(96, 34) } },
    kissR: { a: 60, pose: { lean: .08 } }, kissL: { a: -60, pose: { lean: .08 } },
    selfieR: { a: -20, hold: 'phone', expr: 'grin' }, selfieL: { a: 20 },
    danceR: { a: 40, pose: { near: UP(70, 28), far: UP(54, 4) }, expr: 'laugh' }, danceL: { a: -40, pose: { near: UP(70, 28), far: UP(54, 4) }, expr: 'laugh' },
    cookR: { a: 45, pose: { near: UP(118, 30) } }, cookL: { a: -45, pose: { near: UP(118, 30) } },
    sofaR: { a: 25, pose: { lift: -38, legNear: { m: 1, th: 1.5, kn: 1.5 }, legFar: { m: 1, th: 1.5, kn: 1.5 }, near: UP(134, 22), far: UP(134, 22) } },
    sofaL: { a: -25, pose: { lift: -38, legNear: { m: 1, th: 1.5, kn: 1.5 }, legFar: { m: 1, th: 1.5, kn: 1.5 }, near: UP(134, 22), far: UP(134, 22) } }
  };
  function figure(m, L) {
    var mine = !L, W = mine ? wear() : {};
    L = norm(mine ? dressed(look(), W) : L);
    if (W.tired && m && !m.mood && m.k !== 'night') m = Object.assign({}, m, { mood: 'tired' });
    /* light mode: the moment's colour becomes a soft tint instead of a dark night-sky box */
    if (m && m.bg && !m.plain && document.documentElement.getAttribute('data-theme') === 'light') m = Object.assign({}, m, { bg: shade(m.bg, .8) });
    var top = L.top === 'none' ? 'none' : m.k === 'gym' ? 'tee' : m.k === 'night' ? 'hoodie' : L.top;
    var sky = m.sky === 'moon' ? '<circle cx="160" cy="34" r="10" fill="#e9edf5"/><circle cx="165" cy="30" r="9" fill="' + m.bg + '"/><g fill="#e9edf5" opacity=".7"><circle cx="30" cy="30" r="1.3"/><circle cx="48" cy="56" r="1"/><circle cx="178" cy="70" r="1.1"/></g>'
      : m.sky === 'cloud' ? '<g fill="#7d838e"><circle cx="150" cy="36" r="10"/><circle cx="162" cy="32" r="12"/><circle cx="174" cy="38" r="9"/></g><g class="rain" stroke="rgba(170,200,230,.6)" stroke-width="2"><line x1="150" y1="52" x2="147" y2="62"/><line x1="166" y1="54" x2="163" y2="64"/><line x1="30" y1="40" x2="27" y2="50"/></g>'
        : '<circle cx="164" cy="34" r="11" fill="#f2c94c"/>';
    var ground = '<rect x="0" y="158" width="200" height="42" fill="rgba(34,179,94,.16)"/><ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>';
    var lamp = m.k === 'evening' ? '<path d="M22 54l10-16h14l10 16z" fill="#f6c85f"/><line x1="39" y1="54" x2="39" y2="160" stroke="#666" stroke-width="2.5"/><circle cx="39" cy="58" r="30" fill="#f6c85f" opacity=".12"/>' : '';
    var tired = m.mood === 'tired', meh = m.mood === 'ok';
    if (m.plain) { sky = ''; lamp = ''; ground = '<ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>'; }
    /* soft: no box – a glow in the moment's colour that fades into the page, and a patch of grass instead of a strip */
    var SCN = L.scene || 'none', sceneEl = '';
    if (SCN !== 'none' && !m.plain) {
      sceneEl = { city: '<g fill="' + shade(m.bg, .14) + '"><rect x="6" y="92" width="22" height="70"/><rect x="30" y="72" width="18" height="90"/><rect x="152" y="80" width="20" height="82"/><rect x="174" y="100" width="22" height="62"/></g><g fill="#f2c94c" opacity=".55"><rect x="10" y="100" width="3" height="4"/><rect x="18" y="112" width="3" height="4"/><rect x="34" y="80" width="3" height="4"/><rect x="40" y="96" width="3" height="4"/><rect x="157" y="90" width="3" height="4"/><rect x="164" y="106" width="3" height="4"/><rect x="180" y="110" width="3" height="4"/></g>',
        beach: '<rect x="0" y="118" width="200" height="40" fill="#2f6fa8" opacity=".75"/><path d="M0 124q12-3 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0" stroke="#bfe3ff" stroke-width="1.2" fill="none" opacity=".6"/><rect x="0" y="152" width="200" height="48" fill="#e7cf9a"/><path d="M168 152v-34" stroke="#8a5a2b" stroke-width="3"/><path d="M168 118q-12-4-20 4M168 118q10-8 22-2M168 118q-2-12-12-14M168 118q8-10 18-8" stroke="#2f7a55" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
        forest: '<g fill="' + shade('#2f7a55', -.25) + '">' + [[16, 70, 22], [38, 86, 16], [164, 74, 20], [186, 90, 14], [150, 98, 12]].map(function (t) { return '<path d="M' + t[0] + ' ' + t[1] + 'l' + t[2] + ' ' + (162 - t[1]) + 'h-' + (t[2] * 2) + 'z"/>'; }).join('') + '</g>',
        office: '<rect x="128" y="34" width="50" height="40" rx="3" fill="' + shade(m.bg, .18) + '"/><path d="M153 34v40M128 54h50" stroke="' + shade(m.bg, -.2) + '" stroke-width="2"/><rect x="128" y="120" width="66" height="5" rx="2" fill="#8a5a2b"/><rect x="140" y="104" width="22" height="15" rx="2" fill="#2b2f36"/><rect x="142" y="106" width="18" height="11" fill="#3987e5"/><path d="M182 120v-10" stroke="#2f7a55" stroke-width="2"/><path d="M182 110q-6-6-2-12M182 110q6-6 3-12M182 110q0-8 0-14" stroke="#2f7a55" stroke-width="2.4" fill="none"/><rect x="178" y="112" width="8" height="8" rx="1" fill="#e8743b"/>',
        oslo: '<rect x="0" y="134" width="200" height="26" fill="#2f5d8a" opacity=".6"/><g fill="' + shade(m.bg, .2) + '"><rect x="126" y="86" width="8" height="48"/><rect x="136" y="96" width="7" height="38"/><rect x="145" y="78" width="9" height="56"/><rect x="156" y="92" width="7" height="42"/><rect x="165" y="84" width="8" height="50"/><rect x="175" y="100" width="7" height="34"/></g><path d="M8 134l34-22 40 22z" fill="#e9edf5" opacity=".85"/><path d="M42 112v22" stroke="' + shade(m.bg, -.1) + '" stroke-width="1.2"/>' }[SCN] || '';
      if (SCN === 'beach' || SCN === 'office') ground = '<ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>' + (SCN === 'office' ? '<rect x="0" y="158" width="200" height="42" fill="' + shade(m.bg, -.15) + '"/>' : '');
    }
    var bgEl = m.plain ? '' : m.soft ? '<defs><radialGradient id="avSoft" cx="50%" cy="52%" r="50%"><stop offset="0" stop-color="' + m.bg + '" stop-opacity=".95"/><stop offset=".62" stop-color="' + m.bg + '" stop-opacity=".55"/><stop offset="1" stop-color="' + m.bg + '" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="98" r="98" fill="url(#avSoft)"/>' : '<rect width="200" height="200" rx="20" fill="' + m.bg + '"/>';
    if (m.soft) ground = '<ellipse cx="101" cy="161" rx="66" ry="10" fill="rgba(34,179,94,.16)"/><ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>';
    /* the body is drawn in 2.5D (avatar-25d.js) with what the moment puts in its hand; the moment's sky and ground stay (F4: the old flat drawing is gone) */
    if (!window.Fig25) return '<svg viewBox="0 0 200 200" class="av-m-' + esc(m.k || 'plain') + '"' + (m.attrs || '') + '>' + bgEl + sceneEl + ground + '</svg>';
    {
      var M25 = FIG25[m.k] || {}, L25 = Object.assign({}, L, { top: top, expr: tired ? 'calm' : meh ? 'calm' : (M25.expr || L.expr) });
      if (m.k === 'couple' || m.noPet) L25.pet = 'none';
      var o25 = { a: m.a != null ? m.a : M25.a != null ? M25.a : 18, cx: 101, gy: 159, k: .68, hold: M25.hold || (m.plain ? null : L.wxHold) || null, pose: m.pose || M25.pose, shadow: false, ph: m.ph, w: m.w }, body25 = Fig25.group(L25, o25), id25 = ++F25N;
      F25A[id25 % 48] = { id: id25, L: L25, o: o25 };
      return '<svg viewBox="0 0 200 200" data-f25="' + id25 + '" class="av-m-' + esc(m.k || 'plain') + ' av-25' + ((m.pose || M25.pose || {}).lift ? ' av-sit' : '') + '"' + (m.attrs || '') + '>' + bgEl + sceneEl + '<g class="av-sky ' + esc(m.sky || '') + '">' + sky + '</g>' + lamp + ground + body25 + (tired && !m.plain ? '<text x="132" y="40" font-size="13" font-weight="800" fill="#9a9ca5">z</text><text x="141" y="29" font-size="9" font-weight="800" fill="#9a9ca5">z</text>' : '') + '</svg>';
    }
  }
  
  /* ---------- what's going on: the moment and the line it says ---------- */
  function firstName() { var p = readJSON('dash.profile', {}) || {}; return String(p.name || '').trim().split(/\s+/)[0] || ''; }
  function wxCode() { var c = readJSON('dash.wxNow', null); return c && Date.now() - c.at < 3 * 3600e3 ? c.code : null; }
  /* what the bubble may say: everything, everything but money (default – it's on screen for anyone nearby), or only the fun moments */
  function sayMode() { var d = window.Delight && window.Delight.get ? window.Delight.get() : {}; return d.avSay === 'all' || d.avSay === 'fun' ? d.avSay : 'nomoney'; }
  function isMoney(x) { return /finance|budget|#fin|bill|money/i.test(String(x.href || '') + ' ' + String(x.key || '')) || /wallet|cash|coin|receipt|piggy|credit|bank|currency/.test(String(x.icon || '')) || /\bkr\b|\d\s?kr|NOK/.test(String(x.title || '') + ' ' + String(x.sub || '')); }
  function moments() {
    var out = [], h = new Date().getHours(), td = today(), T = Fe ? Fe.tools() : {}, name = firstName();
    var add = function (k, say, w) { out.push({ m: MOMENTS[k], say: say, w: w }); };
    if (h >= 23 || h < 5) add('night', L('It’s late' + (name ? ', ' + name : '') + ' – time for bed?', 'Det er sent' + (name ? ', ' + name : '') + ' – på tide å legge seg?'), 1);
    /* today's top 3 all done */
    var top = (readJSON('dash.todos', []) || []).filter(function (t) { return t.today === td; }).slice(0, 3);
    if (top.length && top.every(function (t) { return t.done; })) add('win', L('Today’s top 3 are done – nice work!', 'Dagens topp 3 er gjort – bra jobba!'), 2);
    /* a trip soon or now */
    var tv = readJSON('dash.travel', {}) || {}, trip = (tv.trips || []).filter(function (t) { return t.start && (t.end || t.start) >= td; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
    if (trip) {
      var n = daysTo(trip.start), pk = trip.pack || [], done = pk.filter(function (p) { return p.done; }).length, nm = trip.name || trip.dest || L('your trip', 'turen');
      MOMENTS.trip.tag = n <= 0 ? '✈' : n + 'd';
      if (n <= 14) add('trip', n <= 0 ? L('Enjoy ' + nm + '!', 'Kos deg i ' + nm + '!') : nm + ' ' + (n === 1 ? L('tomorrow', 'i morgen') : L('in ' + n + ' days', 'om ' + n + ' dager')) + (pk.length ? ' – ' + done + '/' + pk.length + L(' packed', ' pakket') : ''), n <= 2 ? 3 : 7);
    }
    /* training today */
    var trained = (T.training || []).some(function (w) { return w.date === td; }) || (T.gym || []).some(function (g) { return String(g.date || '').slice(0, 10) === td; });
    var planned = null;
    try { if (window.Cal && window.Cal.occurrences) { var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(a); b.setDate(b.getDate() + 1); planned = window.Cal.occurrences(a, b).filter(function (o) { return o.cat === 'training' && !o.readOnly; })[0]; } } catch (e) {}
    if (trained) add('gym', L('Workout done today 💪', 'Trent i dag 💪'), 4);
    else if (planned && h < 22) add('gym', (planned.allDay ? '' : pad(planned.start.getHours()) + ':' + pad(planned.start.getMinutes()) + ' ') + planned.title + L(' today', ' i dag'), 4);
    /* weather */
    var c = wxCode();
    if (c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95)) add('rain', L('Rain today – bring the umbrella.', 'Regn i dag – ta med paraplyen.'), 5);
    if (c != null && ((c >= 71 && c <= 77) || c === 85 || c === 86)) add('rain', L('Snow today – dress warm.', 'Snø i dag – kle deg godt.'), 5);
    /* birthdays */
    if (Fe && Fe.on('people') && window.HomeLife) Fe.list('people').forEach(function (p) {
      var bd = window.HomeLife.bday(p); if (!bd || bd.n > 2) return;
      add('bday', bd.n === 0 ? L(p.name + '’s birthday today!', p.name + ' har bursdag i dag!') : L(p.name + '’s birthday ' + (bd.n === 1 ? 'tomorrow' : 'in 2 days') + (p.gifts ? ' – idea: ' + String(p.gifts).split('\n')[0] : ''), p.name + ' har bursdag ' + (bd.n === 1 ? 'i morgen' : 'om 2 dager') + (p.gifts ? ' – idé: ' + String(p.gifts).split('\n')[0] : '')), bd.n === 0 ? 2.5 : 6);
    });
    /* the two of you (when you share your home and they made an avatar) – share.js tells who and which picture */
    var ci = window.CoupleInfo ? (function () { try { return window.CoupleInfo(); } catch (e) { return null; } })() : null;
    if (ci && ci.look) add('couple', ci.say, ci.w || 7);
    /* the time of day, with the top things from At a glance */
    var mode = sayMode(), items = mode === 'fun' ? [] : (window.BriefItems || []).filter(function (x) { return !x.fold && x.title && (mode === 'all' || !isMoney(x)); }).slice(0, 3);
    var tr = function (s) { return window.I18N && window.I18N.t ? window.I18N.t(s) : s; };
    if (h >= 5 && h < 11) add('morning', L('Morning' + (name ? ', ' + name : '') + '!', 'God morgen' + (name ? ', ' + name : '') + '!') + (items[0] ? ' ' + tr(items[0].title) + '.' : L(' Nothing pressing today.', ' Ingenting som haster i dag.')), 8);
    else if (h >= 11 && h < 17) add('day', items[0] ? tr(items[0].title) : L('All good – enjoy the day.', 'Alt vel – nyt dagen.'), 8);
    else if (h >= 17 && h < 23) { var dn = (readJSON('dash.todos', []) || []).filter(function (t) { return t.done && t.doneAt && dkey(new Date(t.doneAt)) === td; }).length; add('evening', dn ? L(dn + (dn === 1 ? ' task' : ' tasks') + ' done today – time to relax.', dn + (dn === 1 ? ' oppgave' : ' oppgaver') + ' gjort i dag – tid for å slappe av.') : L('Evening – time to slow down.', 'Kveld – tid for å roe ned.'), 8); }
    items.slice(1).forEach(function (x, i) { out.push({ m: null, say: tr(x.title), w: 10 + i }); });
    out.sort(function (a, b) { return a.w - b.w; });
    return out;
  }
  var idx = 0;
  function current() { var l = moments(); return l; }

  /* ---------- Home: the figure and its line ---------- */
  function drawHome() {
    var hero = document.querySelector('.mhero'), box = document.getElementById('avHome');
    var ok = hero && on('avatar') && root.classList.contains('unlocked');
    if (!ok) { if (box) box.remove(); if (hero) hero.classList.remove('has-av'); return; }
    var l = current(), withM = l.filter(function (x) { return x.m; });
    if (react && Date.now() < react.until) { l = [{ m: react.m, say: react.say }].concat(l); idx = 0; withM = l; }
    if (!withM.length) return;
    var main = withM[0], pick = l[idx % l.length] || main, m = pick.m || main.m, hr = new Date().getHours();
    if ((hr >= 19 || hr < 6) && m.sky === 'sun') m = Object.assign({}, m, { sky: 'moon', bg: '#121426' });       /* the sky follows the clock */
    if (!box) { box = document.createElement('div'); box.id = 'avHome'; box.className = 'av-home'; box.setAttribute('data-noi18n', ''); hero.appendChild(box); hero.classList.add('has-av'); }
    var ci2 = m.couple && window.CoupleInfo ? window.CoupleInfo() : null;
    var pic = null; if (ci2 && ci2.look) try { pic = couple(ci2.kind, dressed(look()), ci2.look, { label: ci2.say, pet: ci2.pet && ci2.pet !== 'none' ? ci2.pet : null }); } catch (e) { pic = null; ci2 = null; }
    pic = pic || figure(Object.assign({}, m.couple ? MOMENTS.day : m, { soft: true })).replace('viewBox="0 0 200 200"', 'viewBox="12 8 176 164"');
    var html = '<button type="button" class="av-fig' + (ci2 && ci2.look ? ' av-two' : '') + '" data-avnext aria-label="' + esc(L('Your avatar – tap for the next thing', 'Avataren din – trykk for neste')) + '">' + pic + '</button>' +
      '<button type="button" class="av-edit" data-avp-open aria-label="' + esc(L('Edit your avatar', 'Rediger avataren din')) + '" style="position:absolute;top:4px;right:4px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(127,127,127,.18);color:inherit;display:grid;place-items:center;cursor:pointer;z-index:2"><i class="bi bi-pencil" aria-hidden="true"></i></button>' +
      '<p class="av-say" role="status">' + esc(pick.say) + (l.length > 1 ? ' <span class="av-dots">' + l.map(function (_, i) { return '<i' + (i === idx % l.length ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' : '') + '</p>';
    if (box._h !== html) { box._h = html; box.innerHTML = html; }   /* compare with what we drew last time, not innerHTML: Safari writes the svg back differently, which redrew the picture on every change and restarted its animations */
    badge(main.m);
  }
  /* ---------- he reacts to what you do: a task done, a habit ticked, a workout or an expense logged ---------- */
  var react = null, seen = null;
  function counts() {
    var td = today(), T = Fe ? Fe.tools() : {}, d = window.Vault && window.Vault.get ? window.Vault.get() || {} : {};
    var todos = readJSON('dash.todos', []) || [], hb = readJSON('dash.habits', { log: {} }) || {};
    return { done: todos.filter(function (t) { return t.done; }).length, top: todos.filter(function (t) { return t.today === td; }).every(function (t) { return t.done; }) && todos.some(function (t) { return t.today === td; }),
      ticks: ((hb.log || {})[td] || []).length, train: (T.training || []).length + (T.gym || []).length, exp: (d.expenses || []).length };
  }
  function reactTo(kind) {
    var M = { top: [MOMENTS.win, L('All of today’s top 3 – you did it!', 'Hele dagens topp 3 – du klarte det!')], task: [MOMENTS.win, L('Nice, one less thing!', 'Fint, én ting mindre!')],
      habit: [MOMENTS.day, L('Habit ticked – keep the streak going.', 'Vane krysset av – hold rekka gående.')], train: [MOMENTS.gym, L('Workout logged 💪', 'Økt logget 💪')], exp: [MOMENTS.day, L('Logged. Your budget is up to date.', 'Logget. Budsjettet er oppdatert.')] }[kind];
    if (!M) return;
    react = { m: M[0], say: M[1], until: Date.now() + 4500 };
    drawHome(); var f = document.querySelector('#avHome .av-fig'); if (f) { f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); }
    clearTimeout(reactTo.t); reactTo.t = setTimeout(function () { react = null; drawHome(); }, 4600);
  }
  /* a happy moment from outside (together.js: a high five or a heart from the one you live with) */
  function cheer(say) {
    react = { m: MOMENTS.win, say: say, until: Date.now() + 5500 };
    drawHome(); var f = document.querySelector('#avHome .av-fig'); if (f) { f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); }
    clearTimeout(reactTo.t); reactTo.t = setTimeout(function () { react = null; drawHome(); }, 5600);
  }
  function watch() {
    if (!root.classList.contains('unlocked')) return;
    var c = counts(); if (!seen) { seen = c; return; }
    var k = c.top && !seen.top ? 'top' : c.train > seen.train ? 'train' : c.done > seen.done ? 'task' : c.ticks > seen.ticks ? 'habit' : c.exp > seen.exp ? 'exp' : null;
    seen = c; if (k && document.getElementById('avHome')) reactTo(k);
  }
  ['todos:change', 'habits:change', 'tools:change', 'fin:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(watch, 120); }); });
  window.Vault.onUnlock(function () { seen = null; setTimeout(watch, 600); });
  window.Vault.onLock && window.Vault.onLock(function () { seen = null; react = null; });

  /* ---------- the badge on your photo in the top bar ---------- */
  function badge(m) {
    if (!m) { var l = current().filter(function (x) { return x.m; }); m = l[0] && l[0].m; }
    document.querySelectorAll('.me-btn[data-me]').forEach(function (b) {
      var el = b.querySelector('.av-badge');
      if (!on('avBadge') || !m || !root.classList.contains('unlocked')) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('span'); el.className = 'av-badge'; el.setAttribute('aria-hidden', 'true'); b.appendChild(el); }
      var h = '<i class="bi bi-' + m.i + '"></i>'; if (el.innerHTML !== h) el.innerHTML = h; el.style.setProperty('--c', m.c);
    });
  }
  (function idle() {
    setTimeout(function () {
      var f = document.querySelector('#avHome .av-fig'), rt = document.documentElement.classList;
      if (f && !document.hidden && !rt.contains('mo-off') && !rt.contains('mo-reduced') && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        var fx = ['hop', 'av-look', 'av-stretch'][Math.floor(Math.random() * 3)];
        f.classList.remove('hop', 'av-look', 'av-stretch'); void f.offsetWidth; f.classList.add(fx); if (fx !== 'hop') act25(f, fx.slice(3), 1400);
        setTimeout(function () { f.classList.remove(fx); }, 1600);
      }
      idle();
    }, 9000 + Math.random() * 6000);
  })();
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-avnext]')) return;
    idx++; drawHome();
    var f = document.querySelector('#avHome .av-fig'); if (f) { f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); }
  });

  /* ---------- the maker (2026-11): one for Settings, People and the shared home – tabs, picture tiles drawn with the
     person's own look, colour dots + any colour. MK.html(cur, tab) draws it, MK.act(el, cur) applies a tap. ---------- */
  var MKT = [
    ['face', 'Face', 'Ansikt', [['faceS', 'Face shape', 'Ansiktsform'], ['expr', 'Mood', 'Humør'], ['eyeC', 'Eye colour', 'Øyefarge'], ['makeup', 'Make-up', 'Sminke'], ['cheeks', 'Cheeks', 'Kinn'], ['beard', 'Beard', 'Skjegg'], ['glasses', 'Glasses', 'Briller']]],
    ['hair', 'Hair', 'Hår', [['hair', 'Style', 'Frisyre'], ['hairC', 'Colour', 'Farge']]],
    ['body', 'Body', 'Kropp', [['build', 'Build', 'Kroppsbygning'], ['height', 'Height', 'Høyde'], ['skin', 'Skin tone', 'Hudfarge'], ['aid', 'Mobility & hearing', 'Bevegelse og hørsel']]],
    ['style', 'Style', 'Klær', [['top', 'Top', 'Overdel'], ['topC', 'Top colour', 'Farge på overdelen'], ['bottom', 'Bottom', 'Underdel'], ['legs', 'Bottom colour', 'Farge på underdelen'], ['shoes', 'Shoes', 'Sko']]],
    ['extras', 'Extras', 'Tilbehør', [['hat', 'Headwear', 'Hodeplagg'], ['hatC', 'Hat colour', 'Farge på hatten'], ['addons', 'Add-ons', 'Ekstra'], ['pet', 'Sidekick', 'Følgesvenn']]],
    ['day', 'Your day', 'Dagen din', [['auto', 'Dress for the season', 'Kle deg etter sesongen']]]
  ];
  var MKO = {
    faceS: [['oval', 'Oval', 'Oval'], ['round', 'Round', 'Rund'], ['long', 'Long', 'Lang']],
    expr: [['smile', 'Smile', 'Smil'], ['grin', 'Big grin', 'Stort glis'], ['laugh', 'Laugh', 'Ler'], ['wink', 'Wink', 'Blunk'], ['cool', 'Cool', 'Kul'], ['calm', 'Happy', 'Glad'], ['shy', 'Shy', 'Sjenert'], ['wow', 'Wow', 'Wow']],
    makeup: [['none', 'None', 'Ingen'], ['lashes', 'Lashes', 'Vipper'], ['lips', 'Lipstick', 'Leppestift'], ['both', 'Both', 'Begge']],
    cheeks: [['none', 'None', 'Ingen'], ['blush', 'Blush', 'Rødme'], ['freckles', 'Freckles', 'Fregner']],
    beard: [['none', 'None', 'Ingen'], ['stubble', 'Stubble', 'Stubber'], ['short', 'Short', 'Kort'], ['full', 'Full', 'Fullskjegg'], ['goatee', 'Goatee', 'Bukkeskjegg'], ['moustache', 'Moustache', 'Bart']],
    glasses: [['none', 'None', 'Ingen'], ['round', 'Round', 'Runde'], ['square', 'Square', 'Firkantede'], ['cateye', 'Cat-eye', 'Katteøye'], ['sun', 'Shades', 'Solbriller'], ['aviator', 'Aviator', 'Pilotbriller']],
    hair: [['short', 'Short', 'Kort'], ['side', 'Side part', 'Sideskill'], ['quiff', 'Quiff', 'Quiff'], ['curly', 'Curly', 'Krøllete'], ['fade', 'Fade', 'Fade'], ['mohawk', 'Mohawk', 'Hanekam'], ['afro', 'Afro', 'Afro'], ['undercut', 'Undercut', 'Undercut'], ['waves', 'Waves', 'Bølger'], ['bangs', 'Curtain bangs', 'Gardinpannelugg'], ['long', 'Long', 'Langt'], ['ponytail', 'Ponytail', 'Hestehale'], ['topknot', 'Top knot', 'Topknute'], ['braids', 'Braids', 'Fletter'], ['pigtails', 'Space buns', 'Doble knuter'], ['dreads', 'Dreads', 'Dreads'], ['bald', 'Bald', 'Skallet']],
    build: [['slim', 'Slim', 'Slank'], ['regular', 'Regular', 'Vanlig'], ['athletic', 'Athletic', 'Atletisk'], ['muscular', 'Muscular', 'Muskuløs'], ['broad', 'Broad', 'Bred']],
    height: [['short', 'Short', 'Lav'], ['regular', 'Regular', 'Vanlig'], ['tall', 'Tall', 'Høy']],
    aid: [['none', 'None', 'Ingen'], ['chair', 'Wheelchair', 'Rullestol'], ['crutches', 'Crutches', 'Krykker'], ['hearing', 'Hearing aid', 'Høreapparat'], ['arm', 'Prosthetic arm', 'Armprotese']],
    top: [['tee', 'T-shirt', 'T-skjorte'], ['tank', 'Tank top', 'Singlet'], ['polo', 'Polo', 'Piké'], ['sweater', 'Sweater + shirt', 'Genser + skjorte'], ['knit', 'Nordic knit', 'Lusekofte'], ['hoodie', 'Hoodie', 'Hettegenser'], ['shirt', 'Shirt', 'Skjorte'], ['jersey', 'Jersey', 'Drakt'], ['kit', 'Football kit', 'Fotballdrakt'], ['varsity', 'Varsity jacket', 'College-jakke'], ['suit', 'Suit', 'Dress'], ['puffer', 'Puffer', 'Boblejakke'], ['rain', 'Raincoat', 'Regnjakke'], ['jacket', 'Jacket', 'Jakke'], ['dress', 'Dress', 'Kjole'], ['bunad', 'Bunad (Norwegian folk dress)', 'Bunad'], ['scrubs', 'Scrubs', 'Arbeidsklær (helse)'], ['chef', 'Chef jacket', 'Kokkejakke'], ['pjs', 'Pyjamas', 'Pyjamas'], ['robe', 'Bathrobe', 'Morgenkåpe'], ['none', 'No top', 'Uten overdel']],
    bottom: [['trousers', 'Trousers', 'Bukse'], ['jeans', 'Ripped jeans', 'Revne jeans'], ['joggers', 'Joggers', 'Joggebukse'], ['cargo', 'Cargo', 'Cargobukse'], ['shorts', 'Shorts', 'Shorts'], ['skirt', 'Skirt', 'Skjørt'], ['overalls', 'Overalls', 'Snekkerbukse'], ['swim', 'Swim shorts', 'Badeshorts']],
    shoes: [['sneakers', 'Sneakers', 'Joggesko'], ['hightops', 'High-tops', 'Høye joggesko'], ['boots', 'Boots', 'Støvler'], ['sandals', 'Sandals', 'Sandaler'], ['slippers', 'Slippers', 'Tøfler'], ['cleats', 'Football boots', 'Fotballsko']],
    hat: [['none', 'None', 'Ingen'], ['cap', 'Cap', 'Caps'], ['beanie', 'Beanie', 'Lue'], ['bandana', 'Bandana', 'Bandana'], ['cowboy', 'Cowboy hat', 'Cowboyhatt'], ['phones', 'Headphones', 'Hodetelefoner'], ['party', 'Party hat', 'Festhatt'], ['wizard', 'Wizard hat', 'Trollmannshatt'], ['santa', 'Santa hat', 'Nisselue'], ['witch', 'Witch hat', 'Heksehatt'], ['chef', 'Chef hat', 'Kokkelue'], ['crown', 'Crown', 'Krone']],
    pet: [['none', 'None', 'Ingen'], ['cat', 'Cat', 'Katt'], ['dog', 'Dog', 'Hund'], ['bunny', 'Bunny', 'Kanin'], ['bird', 'Parrot pal', 'Papegøye']],
  };
  /* Moves (avatar page): which hand it uses for things, and how it walks in the living scenes */
  MKO.hand = [['right', 'Right-handed', 'Høyrehendt'], ['left', 'Left-handed', 'Venstrehendt']];
  MKO.walk = [['calm', 'Calm', 'Rolig'], ['bouncy', 'Bouncy', 'Sprettende'], ['quick', 'Quick', 'Rask']];
  var MKC = {
    skin: ['#fbe2cf', '#f3d4bb', '#e3b893', '#c99a73', '#a8774f', '#82563a', '#5a3a27', '#3e2618'], eyeC: ['#2b211b', '#5b3a1e', '#3a6ea5', '#3f7d4e', '#7a8794'],
    hairC: ['#1e140d', '#4a2f1b', '#7a4e2a', '#b5854a', '#e0bf7a', '#9b9b9b', '#a33d2b', '#2f6fd6', '#e0559a', '#2fae6a', '#8a5cf0', '#eeeeee'],
    legs: ['#2a2f3a', '#3c5a7d', '#5b4b3a', '#6e6e6e', '#c9b48a', '#2f7a55', '#8a5cf0'],
    hatC: ['#e8743b', '#2e3340', '#d93a3a', '#3987e5', '#2f7a55', '#f2c94c', '#e0559a', '#8a5a2b', '#3b4d8a', '#f2f2f2'],
    topC: ['#2f7a55', '#2f5d8a', '#2e3340', '#d93a3a', '#e8743b', '#f2c94c', '#8a6fdf', '#e0559a', '#d9c7a8', '#b8b8b8', '#f2f2f2', '#5b4b3a']
  };
  var MKFACE = { faceS: 1, expr: 1, eyeC: 1, makeup: 1, cheeks: 1, beard: 1, glasses: 1, hair: 1, hairC: 1, hat: 1 };
  var MKNONE = { makeup: 1, cheeks: 1, aid: 1, hat: 1, pet: 1 };
  var MKPLAIN = { k: 'plain', plain: true, bg: 'none' };
  function mkCrop(svg, vb) { return svg.replace('viewBox="0 0 200 200"', 'viewBox="' + vb + '"').replace(/<g class="av-sky[^"]*">[\s\S]*?<\/g>/, ''); }
  function mkCss() {
    if (document.getElementById('avMkCss')) return;
    var st = document.createElement('style'); st.id = 'avMkCss';
    st.textContent = '.avm{display:grid;gap:12px}.avm-fig{position:relative;border-radius:22px;overflow:hidden;max-width:360px;width:100%;margin:0 auto;aspect-ratio:1/1;background:rgba(127,127,127,.08)}.avm-fig>svg{width:100%;height:100%;display:block}' +
      '.avm-face{position:absolute;right:10px;bottom:10px;width:58px;height:58px;border-radius:50%;overflow:hidden;background:rgba(0,0,0,.25);border:2px solid var(--accent,#8a5cf0)}.avm-face svg{width:100%;height:100%;display:block}' +
      '.avm-acts{position:absolute;left:10px;top:10px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}.avm-acts button{min-height:34px;padding:0 12px;border-radius:17px;border:1px solid rgba(255,255,255,.18);background:rgba(20,22,30,.78);color:#eceef4;font:inherit;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.avm-acts button.hot{background:var(--accent,#8a5cf0);border-color:transparent;color:#fff}' +
      '.avm-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.avm-tabs::-webkit-scrollbar{display:none}.avm-tabs button{flex:none;min-height:38px;padding:0 14px;border-radius:19px;border:0;background:rgba(127,127,127,.14);color:inherit;font:inherit;font-weight:500;cursor:pointer}.avm-tabs button[aria-selected="true"]{background:var(--accent,#8a5cf0);color:#fff;font-weight:600}' +
      '.avm-sec{display:grid;gap:8px}.avm-sec>b{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.7}.avm-sec>b em{font-style:normal;text-transform:none;letter-spacing:0;color:var(--accent,#8a5cf0);opacity:1}' +
      '.avm-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.avm-t{position:relative;border:0;padding:0;background:none;color:inherit;font:inherit;font-size:11.5px;line-height:1.2;display:grid;gap:4px;justify-items:center;text-align:center;cursor:pointer}' +
      '.avm-t>span:first-child{width:100%;aspect-ratio:1/1.06;border-radius:14px;background:rgba(127,127,127,.12);overflow:hidden;display:grid;place-items:center}.avm-t>span:first-child>svg{width:100%;height:100%;display:block}.avm-t[aria-pressed="true"]>span:first-child{box-shadow:inset 0 0 0 2.5px var(--accent,#8a5cf0)}.avm-t[aria-pressed="true"]{font-weight:600}' +
      '.avm-t .avm-x{width:26px;height:26px;opacity:.45}.avm-dots{display:flex;flex-wrap:wrap;gap:6px}.avm-d{position:relative;width:40px;height:40px;border-radius:50%;border:0;padding:0;background:none;display:grid;place-items:center;cursor:pointer}.avm-d i{width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(127,127,127,.4)}.avm-d[aria-pressed="true"]::after{content:"";position:absolute;inset:0;border-radius:50%;border:2.5px solid var(--accent,#8a5cf0)}' +
      '.avm-d.avm-any i{background:conic-gradient(#e5484d,#f2c94c,#2fae6a,#2f9ee0,#8a5cf0,#e0559a,#e5484d)}.avm-d.avm-any input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}' +
      '.avm-txt{min-height:42px;max-width:200px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font:inherit;font-size:16px;padding:0 12px;text-transform:uppercase;letter-spacing:.06em}' +
      '.avm-sw{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;font-size:14px}.avm-fig .av-tail{animation:avmwag .5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:0 100%}@keyframes avmwag{from{transform:rotate(-10deg)}to{transform:rotate(14deg)}}' +
      '@media (prefers-reduced-motion:reduce){.avm-fig *{animation:none!important}}';
    document.head.appendChild(st);
  }
  function mkTile(cur, k, v, label) {
    var lk = Object.assign({}, cur); lk[k] = v; if (!MKFACE[k] && k !== 'pet') lk.pet = 'none';
    var none = MKNONE[k] && v === 'none';
    var pic = none ? '<svg class="avm-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 18.4 18.4 5.6"/></svg>'
      : k === 'scene' ? figure(MOMENTS.day, Object.assign(lk, { pet: 'none' }))
      : mkCrop(figure(MKPLAIN, lk), MKFACE[k] ? '58 12 84 80' : k === 'pet' ? '8 14 172 156' : k === 'badge' ? '66 70 70 60' : k === 'hold' && v === 'balloon' ? '32 -14 136 184' : '32 10 136 160');
    var on = k === 'watch' || k === 'bag' ? cur[k] === 'yes' : (cur[k] || (MKO[k] && MKO[k][0][0])) === v;
    return '<button type="button" class="avm-t" data-avm-k="' + k + '" data-avm-v="' + esc(v) + '" aria-pressed="' + on + '"><span>' + pic + '</span><span>' + esc(label) + '</span></button>';
  }
  function mkSec(cur, s) {
    var k = s[0], title = L(s[1], s[2]), body, now = '';
    if (k === 'addons') { body = '<div class="avm-tiles">' + mkTile(cur, 'watch', 'yes', L('Watch', 'Klokke')) + mkTile(cur, 'bag', 'yes', L('Backpack', 'Ryggsekk')) + '</div>'; }
    else if (k === 'auto') return '<div class="avm-sec"><label class="avm-sw"><span>' + esc(title) + '<small style="display:block;opacity:.7;font-size:12.5px">' + esc(L('Christmas jumper in December, a bunad on 17 May (Norway’s national day), a witch hat at Halloween, shorts in July', 'Julegenser i desember, bunad på 17. mai, heksehatt til Halloween, shorts i juli')) + '</small></span><input type="checkbox" class="switch" data-avm-auto' + (cur.auto === 'on' ? ' checked' : '') + '></label></div>';
    else if (MKO[k]) { var o = MKO[k].filter(function (x) { return x[0] === (cur[k] || MKO[k][0][0]); })[0]; now = o ? L(o[1], o[2]) : '';
      body = '<div class="avm-tiles">' + MKO[k].map(function (x) { return mkTile(cur, k, x[0], L(x[1], x[2])); }).join('') + '</div>'; }
    else { var c = MKC[k], own = !!cur[k] && c.indexOf(cur[k]) < 0; now = own ? L('Your own colour', 'Din egen farge') : '';
      body = '<div class="avm-dots">' + c.map(function (h, i) { return '<button type="button" class="avm-d" data-avm-k="' + k + '" data-avm-v="' + h + '" aria-pressed="' + ((cur[k] || '') === h) + '" aria-label="' + esc(title + ' ' + (h ? i + 1 : L('none', 'ingen'))) + '"><i style="background:' + (h || 'transparent') + '"></i></button>'; }).join('') +
        '<label class="avm-d avm-any" aria-pressed="' + own + '"><i></i><input type="color" data-avm-k="' + k + '" value="' + (own && /^#[0-9a-f]{6}$/i.test(cur[k]) ? cur[k] : '#8a5cf0') + '" aria-label="' + esc(L('Any colour', 'Valgfri farge') + ': ' + title) + '"></label></div>'; }
    return '<div class="avm-sec"><b>' + esc(title) + '<em>' + esc(now) + '</em></b>' + body + '</div>';
  }


  function mkRand() {
    var r = {}, pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    Object.keys(MKO).forEach(function (k) { r[k] = MKNONE[k] && Math.random() < .65 ? 'none' : pick(MKO[k])[0]; });
    Object.keys(MKC).forEach(function (k) { r[k] = pick(MKC[k]); });
    r.aid = 'none'; r.watch = Math.random() < .3 ? 'yes' : 'no'; r.bag = Math.random() < .2 ? 'yes' : 'no'; r.extra = 'none'; return r;
  }
  /* a tap inside the maker: returns the new look (or null), tab changes return { tab } */
  function mkAct(e, cur) {
    var b = e.target.closest('[data-avm-tab]'); if (b) return { tab: b.dataset.avmTab };
    if (e.target.closest('[data-avm-rand]')) return { look: mkRand() };
    if (e.target.closest('[data-avm-reset]')) return { look: Object.assign({}, PLAIN0) };
    b = e.target.closest('button[data-avm-k]'); if (!b) return null;
    var k = b.dataset.avmK, v = b.dataset.avmV, n = Object.assign({}, cur);
    if (k === 'watch' || k === 'bag') v = cur[k] === 'yes' ? 'no' : 'yes';
    n[k] = v; if (k === 'hat' || k === 'neck' || k === 'ears' || k === 'watch') n.extra = 'none';   /* the newer keys win over the old 'extra' */
    return { look: n };
  }
  var PLAIN0 = { faceS: 'oval', build: 'regular', skin: '#c99a73', hair: 'short', hairC: '#4a2f1b', beard: 'none', glasses: 'none', expr: 'smile', top: 'tee', topC: '#2f5d8a', bottom: 'trousers', legs: '#2a2f3a', extra: 'none', hat: 'none', neck: 'none', ears: 'none', pet: 'none' };
  /* old looks keep 'extra'; the maker turns it into the newer keys before the first change, so nothing is lost */
  function mkMigrate(l) { var n = Object.assign({}, START, l || {}), x = n.extra;
    if (x === 'cap' && !n.hat) n.hat = 'cap'; if (x === 'watch') n.watch = 'yes'; n.extra = 'none'; return trimLook(n); }
  /* ---------- Settings → Pictures & touches → Your avatar ---------- */
  function saveWhole(l) { var s = readJSON('dash.settings', {}) || {}; s.avatar = l; try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('avatar:change')); }
  function maker() {
    var host = document.getElementById('dlSet'); if (!host) return;
    var box = document.getElementById('avSet');
    if (!box) { box = document.createElement('div'); box.id = 'avSet'; box.setAttribute('data-noi18n', ''); host.firstElementChild ? host.firstElementChild.insertBefore(box, host.firstElementChild.querySelector('.st-sub')) : host.appendChild(box); }
    /* the maker has its own page now ("Your avatar"): Settings keeps one row that opens it */
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-person-bounding-box"></i> ' + L('Your avatar', 'Avataren din') + '</p><div class="st-group">' +
      '<button type="button" class="st-row avp-open" data-avp-open style="width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;cursor:pointer">' +
      '<span style="display:flex;align-items:center;gap:12px"><span style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex:none;background:rgba(127,127,127,.15)">' + mkCrop(figure(MKPLAIN, Object.assign({}, mkMigrate(look()), { pet: 'none' })), '58 12 84 80') + '</span>' +
      '<span>' + L('Your avatar', 'Avataren din') + '<small class="st-rsub">' + L('Look, how it moves, and its settings', 'Utseende, hvordan den beveger seg, og innstillinger') + '</small></span></span><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>';
  }
  /* opens your own avatar page (avatar-page.js) */
  function openMine() { var S = window.ShareSpace, pl = null; try { pl = S && S.partnerLook ? S.partnerLook() : null; } catch (e) {} if (window.Avatar && window.Avatar.page) window.Avatar.page(L('Your avatar', 'Avataren din'), mkMigrate(look()), function (lk) { saveWhole(lk); }, { mine: true, match: pl ? { look: pl, name: S.partnerName ? S.partnerName() : '' } : null }); }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-avp-open]')) { e.preventDefault(); openMine(); } });
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('[data-avsay]') && window.Delight && window.Delight.set) { window.Delight.set({ avSay: e.target.value }); idx = 0; } });
  window.addEventListener('st:page', function (e) { if (e.detail === 'touches') setTimeout(maker, 0); });
  window.addEventListener('touch:change', function () { if (document.getElementById('avSet')) setTimeout(maker, 0); });

  /* ---------- wiring ---------- */
  function soon() { clearTimeout(soon.t); soon.t = setTimeout(function () { drawHome(); badge(); }, 80); }
  ['brief:items', 'tools:change', 'dash:local', 'touch:change', 'avatar:change', 'profile:change', 'todos:change'].forEach(function (ev) { window.addEventListener(ev, soon); });
  window.Vault.onUnlock(function () { setTimeout(soon, 300); });
  setInterval(soon, 5 * 60e3);
  /* ---------- friends: a look per person (people[].look), picked from the name until you change it ---------- */
  function hashOf(t) { var h = 2166136261; t = String(t || ''); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return h >>> 0; }
  function seedLook(seed, topC) {
    var h = hashOf(seed), pick = function (arr, sh) { return arr[(h >>> sh) % arr.length]; };
    return { build: pick(['slim', 'regular', 'athletic', 'regular'], 2), skin: pick(OPTS.skin.o, 5)[0], hair: pick(['short', 'side', 'quiff', 'curly', 'buzz'], 8), hairC: pick(OPTS.hairC.o.slice(0, 6), 11)[0],
      beard: pick(['none', 'none', 'stubble', 'none'], 14), glasses: pick(['none', 'none', 'none', 'round'], 17), top: pick(['tee', 'sweater', 'hoodie', 'shirt'], 20), topC: topC || pick(OPTS.topC.o, 23)[0],
      bottom: 'trousers', legs: pick(OPTS.legs.o.slice(0, 4), 26)[0], extra: 'none' };
  }
  var RELC = { family: '#d55181', friend: '#3987e5', work: '#e8743b', other: '#7a8794' };
  function personLook(p, topC) { return Object.assign({}, seedLook((p && (p.id || p.name)) || '', topC || (p && RELC[p.rel]) || '#3987e5'), (p && p.look) || {}); }
  /* the same maker as yours, on its own page (avatar-page.js) – onSave(look) gets the full look */
  function editor(title, start, onSave, opts) { if (window.Avatar && window.Avatar.page) window.Avatar.page(title, mkMigrate(start), onSave, opts || {}); }

  /* ---------- the two of you (shared home): holding hands, a high five, a hug or a kiss ----------
     a, b = the two looks (a stands on the left). Two figures side by side in one picture; tap the picture to
     try the next one. kind: hold | hi5 | hug | kiss */
  var COUPLE = { hold: { gap: 80, a: 'holdR', b: 'holdL', bg: '#1d2533' }, hi5: { gap: 70, a: 'hi5R', b: 'hi5L', bg: '#1f1a10' }, hug: { gap: 58, a: 'hugR', b: 'hugL', bg: '#2a1622' }, kiss: { gap: 70, a: 'plain', b: 'plain', bg: '#2a1622', tilt: 6, closed: true },
    selfie: { gap: 62, a: 'plain', b: 'selfieR', bg: '#1d2533', tilt: -4 }, dance: { gap: 78, a: 'danceR', b: 'danceL', bg: '#22182a' }, cook: { gap: 96, a: 'cookR', b: 'cookL', bg: '#2c1f12' }, sofa: { gap: 66, a: 'plain', b: 'plain', bg: '#1d2533', sofa: true } };
  /* the 2.5D couple stands closer: hands meet between them */
  var GAP25 = { hold: 46, hi5: 50, hug: 38, kiss: 40, selfie: 44, dance: 52, cook: 60, sofa: 56 };
  function couple(kind, a, b, opt) {
    opt = opt || {}; a = Object.assign({}, START, a || {}); b = Object.assign({}, START, b || {}); var c = COUPLE[kind] || COUPLE.hold; if (window.Fig25) c = Object.assign({}, c, { gap: GAP25[kind] || c.gap }); var W = 200 + c.gap, light = document.documentElement.getAttribute('data-theme') === 'light' || opt.light;
    var bg = light ? shade(c.bg, .82) : c.bg, cx = W / 2, uid = 'cp-' + kind + (opt.uid || '');
    var one = function (look, k, x, rot) {
      if (window.Fig25) { k = kind === 'selfie' ? (k === 'plain' ? 'selfieL' : 'selfieR') : (FIG25[kind + (x ? 'L' : 'R')] ? kind + (x ? 'L' : 'R') : k); rot = 0; }
      var f = figure({ k: k, plain: true, bg: '#000', sky: 'none', closed: c.closed, seat: !!c.sofa, attrs: ' x="' + x + '" y="0" width="200" height="200"' }, Object.assign({}, look || look0(), opt.pet ? { pet: 'none' } : {}));
      return rot ? '<g transform="rotate(' + rot + ' ' + (x + 101) + ' 165)">' + f + '</g>' : f;
    };
    var heart = function (x, y, s, cl) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path class="' + cl + '" d="M0 4C0-2-8-3-8 3C-8 8 0 12 0 14C0 12 8 8 8 3C8-3 0-2 0 4Z" fill="#e5484d"/></g>'; };
    var fx = kind === 'kiss' ? heart(cx, 12, 1.2, 'cp-up') + heart(cx - 18, 20, .65, 'cp-up cp-d1') + heart(cx + 17, 24, .55, 'cp-up cp-d2')
      : kind === 'hug' ? heart(cx, 22, 1, 'cp-beat')
      : kind === 'hi5' ? '<g class="cp-pop" transform="translate(' + cx + ' 52)">' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (r) { return '<path d="M0-10v-7" transform="rotate(' + r + ')" stroke="#f2c94c" stroke-width="2.4" stroke-linecap="round"/>'; }).join('') + '</g>'
      : kind === 'dance' ? '<g fill="#f2c94c"><path class="cp-up" d="M' + (cx - 30) + ' 30l2 5 5 .6-4 3.4 1.2 5-4.2-2.6-4.2 2.6 1.2-5-4-3.4 5-.6z"/><path class="cp-up cp-d1" d="M' + (cx + 26) + ' 22l1.6 4 4 .5-3 2.6 1 4-3.6-2-3.4 2 .9-4-3-2.6 4-.5z"/></g><path class="cp-up cp-d2" d="M' + (cx - 4) + ' 18v12a3 3 0 1 1-2-2.8V18h8" stroke="#e9edf5" stroke-width="1.6" fill="none"/>'
      : kind === 'selfie' || kind === 'cook' || kind === 'sofa' ? ''
      : heart(cx, 104, .55, 'cp-beat');
    /* the right-hand person's own pet stands on the right, facing in (the left one's stays on the left) */
    var petB = '';
    if (window.Fig25) { var p25 = function (kind, x, ang) { return kind && kind !== 'none' && kind !== 'bird' ? '<g class="av-pet">' + Fig25.petG(kind, ang, x, 159, .68) + '</g>' : ''; };
      if (!opt.pet) petB = p25(b.pet, W - 18, -60); }
    else if (!opt.pet && b.pet && b.pet !== 'none' && b.pet !== 'bird') { var bf = figure({ k: 'plain', plain: true, bg: 'none' }, Object.assign({}, START, { pet: b.pet, petC: b.petC })), bm = bf.match(/<g class="av-pet"[\s\S]*?<\/g>(?=<g class="av-all">)/); if (bm) petB = '<g transform="translate(' + (W + 6) + ' 4) scale(-1 1)">' + bm[0] + '</g>'; }
    var sofa = c.sofa ? '<rect x="' + (cx - 82) + '" y="112" width="164" height="40" rx="12" fill="#3b4d8a"/><rect x="' + (cx - 90) + '" y="120" width="18" height="40" rx="8" fill="#334477"/><rect x="' + (cx + 72) + '" y="120" width="18" height="40" rx="8" fill="#334477"/><rect x="' + (cx - 72) + '" y="140" width="144" height="18" rx="6" fill="#4a5ea0"/>' : '';
    var pet = '';
    if (window.Fig25) { if (opt.pet) pet = p25(opt.pet, 22, 60); }
    else if (opt.pet && opt.pet !== 'none') { var pf = figure({ k: 'plain', plain: true, bg: 'none' }, Object.assign({}, START, { pet: opt.pet })), pm = pf.match(/<g class="av-pet"[\s\S]*?<\/g>(?=<g class="av-all">)/); if (pm) pet = '<g transform="translate(-12 4)">' + pm[0] + '</g>'; }
    var css = '<style>.' + uid + ' .cp-up{animation:cpUp 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.' + uid + ' .cp-d1{animation-delay:.5s}.' + uid + ' .cp-d2{animation-delay:1.1s}' +
      '.' + uid + ' .cp-beat{animation:cpBeat 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.' + uid + ' .cp-pop{animation:cpPop 1.4s ease-out infinite}' +
      '@keyframes cpUp{0%{transform:translateY(6px);opacity:0}30%{opacity:1}100%{transform:translateY(-10px);opacity:0}}@keyframes cpBeat{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(.96)}45%{transform:scale(1.1)}}' +
      '@keyframes cpPop{0%{opacity:0;transform:translate(' + cx + 'px,52px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translate(' + cx + 'px,52px) scale(1.25)}}' +
      '@media (prefers-reduced-motion:reduce){.' + uid + ' *{animation:none!important}}</style>';
    var glow = '<defs><radialGradient id="' + uid + 'g" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="' + bg + '" stop-opacity=".95"/><stop offset=".65" stop-color="' + bg + '" stop-opacity=".5"/><stop offset="1" stop-color="' + bg + '" stop-opacity="0"/></radialGradient></defs>' +
      '<ellipse cx="' + cx + '" cy="100" rx="' + (W / 2) + '" ry="100" fill="url(#' + uid + 'g)"/><ellipse cx="' + cx + '" cy="161" rx="' + (W / 2 - 20) + '" ry="10" fill="rgba(34,179,94,.16)"/>';
    return '<svg viewBox="0 0 ' + W + ' 200" class="av-couple ' + uid + '" role="img" aria-label="' + esc(opt.label || '') + '">' + css + glow +
      sofa + one(a, c.a, 0, c.tilt || 0) + one(opt.pet ? b : Object.assign({}, b, { pet: 'none' }), c.b, c.gap, -(c.tilt || 0)) + pet + petB + fx + '</svg>';
  }
  function look0() { return look(); }
  /* which picture fits today: a high five when a chore was done, a hug on your day together or a birthday, a kiss in the evening */
  function coupleKind(ctx) {
    ctx = ctx || {}; var h = new Date().getHours();
    if (ctx.hi5) return 'hi5'; if (ctx.hug) return 'hug'; if (h >= 20 || h < 1) return 'kiss'; return 'hold';
  }
  window.Avatar = { trimLook: trimLook, act25: act25, cheer: function (say) { cheer(say); }, dressed: function (L) { return dressed(L); }, couple: couple, coupleKind: coupleKind, COUPLE_KINDS: ['hold', 'hi5', 'hug', 'kiss', 'selfie', 'dance', 'cook', 'sofa'], figure: figure, look: look, moments: moments, personLook: personLook, editor: editor, MOMENTS: MOMENTS, openMine: openMine,
    _mk: { MKT: MKT, MKO: MKO, MKC: MKC, sec: mkSec, rand: mkRand, migrate: mkMigrate, act: mkAct, css: mkCss, crop: mkCrop, figure: figure, MOMENTS: MOMENTS, PLAIN: MKPLAIN, PLAIN0: PLAIN0, save: saveWhole, look: look, esc: esc } };
})();
