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

  var START = { build: 'slim', bottom: 'trousers', skin: '#c99a73', hair: 'short', hairC: '#1e140d', beard: 'stubble', glasses: 'none', top: 'sweater', topC: '#d9c7a8', legs: '#2a2f3a', extra: 'lanyard' };
  function look() { var s = readJSON('dash.settings', {}) || {}; return Object.assign({}, START, s.avatar || {}); }
  function setLook(patch) {
    var s = readJSON('dash.settings', {}) || {}; s.avatar = Object.assign({}, look(), patch);
    try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('avatar:change'));
  }
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
  var MOM = [
    { k: 'morning', t: 'Morning', bg: '#2c1f12', sky: 'sun' },
    { k: 'rain', t: 'Rain today', bg: '#14202b', sky: 'cloud' },
    { k: 'gym', t: 'Training day', bg: '#13241b', sky: 'sun' },
    { k: 'trip', t: 'Trip soon', bg: '#161e30', sky: 'sun' },
    { k: 'night', t: 'Late evening', bg: '#0f1020', sky: 'moon' }
  ];
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
    }
    if (on('avMood') && window.Vault && window.Vault.get) {
      try {
        var ln = window.AHealth && window.AHealth.lastNight ? window.AHealth.lastNight() : null;
        if (ln && !ln.partial && ln.v > 0 && ln.v < 6 && h < 15) out.tired = 1;
        var d = window.Vault.get() || {}, ym = today().slice(0, 7), paid = ((d.paid || {})[ym]) || [];
        if (paid.length) out.stress = ((d.budget && d.budget.fixed) || []).some(function (f) { return f.day && !f.src && +f.day <= dd - 3 && paid.indexOf(f.id) < 0; }) ? 1 : 0;
      } catch (e) {}
    }
    return out;
  }
  /* the newer keys (2026-11): old looks keep working – 'extra' becomes a hat, a neck thing, a watch or earbuds */
  function norm(L) {
    L = Object.assign({}, L);
    var x = L.extra; if (x && x !== 'none') { if (x === 'cap' && !L.hat) { L.hat = 'cap'; L.oldCap = 1; } if (x === 'lanyard' && !L.neck) L.neck = 'lanyard'; if (x === 'watch' && !L.watch) L.watch = 'yes'; if (x === 'earbuds' && !L.ears) L.ears = 'buds'; }
    if (L.auto === 'on') { var dt = new Date(), mo = dt.getMonth() + 1, dd = dt.getDate();
      if (mo === 12 && dd <= 26) { L.top = 'knit'; L.topC = '#b3202c'; L.hat = 'santa'; L.pat = 'none'; }
      else if (mo === 5 && dd === 17) { L.top = 'bunad'; L.hold = 'flag'; L.hat = 'none'; }
      else if ((mo === 10 && dd >= 29) || (mo === 11 && dd === 1)) L.hat = 'witch';
      else if (mo === 7) { if (!L.glasses || L.glasses === 'none') L.glasses = 'sun'; L.bottom = 'shorts'; L.shoes = 'sandals'; } }
    /* clashes – one choice wins, so nothing is drawn on top of something it can't go with */
    if (L.top === 'dress' && L.bottom !== 'swim') L.bottom = 'trousers';                 /* the dress covers the bottoms */
    if (L.hat === 'phones' && L.ears && L.ears !== 'none') L.ears = 'none';             /* the headphones cover the ears */
    if (L.aid === 'crutches' || L.aid === 'chair') L.hold = 'none';                       /* both hands are busy */
    if (L.chest && ['star', 'heart', 'flame', 'bolt', 'pumpkin', 'bones'].indexOf(L.pat) >= 0) L.pat = 'none';   /* text and a chest print would overlap */
    if (L.top === 'suit' && L.neck === 'tie') L.neck = 'none';                           /* the suit has its own tie */
    if (L.top === 'none' && (L.neck === 'tie' || L.neck === 'lanyard')) L.neck = 'none';
    return L;
  }
  var UID = 0;
  function figure(m, L) {
    var mine = !L, W = mine ? wear() : {};
    L = norm(L || look());
    if (W.tired && m && !m.mood && m.k !== 'night') m = Object.assign({}, m, { mood: 'tired' });
    /* light mode: the moment's colour becomes a soft tint instead of a dark night-sky box */
    if (m && m.bg && !m.plain && document.documentElement.getAttribute('data-theme') === 'light') m = Object.assign({}, m, { bg: shade(m.bg, .8) });
    var S = L.skin, S2 = shade(L.skin, -.14), H = L.hairC, bare = L.top === 'none', T = bare ? L.skin : m.k === 'gym' ? '#2f7a55' : L.topC, T2 = shade(T, -.18), P = L.legs, top = bare ? 'none' : m.k === 'gym' ? 'tee' : m.k === 'night' ? 'hoodie' : L.top;
    /* body shape: the torso and legs get narrower or wider, the arms move with the shoulders */
    var MU = L.build === 'muscular', SX = { slim: .76, regular: .86, athletic: .9, muscular: 1, broad: 1.02 }[L.build] || .86,
      DX = 26 - (L.build === 'athletic' ? 29 : MU ? 31 : 26) * SX,          /* the arms start at the edge of the shoulders */
      AW = { slim: 7, regular: 7.8, athletic: 10.5, muscular: 13, broad: 9.5 }[L.build] || 7.8, HR = MU ? 5.4 : L.build === 'athletic' ? 4.8 : 4.2;
    var sky = m.sky === 'moon' ? '<circle cx="160" cy="34" r="10" fill="#e9edf5"/><circle cx="165" cy="30" r="9" fill="' + m.bg + '"/><g fill="#e9edf5" opacity=".7"><circle cx="30" cy="30" r="1.3"/><circle cx="48" cy="56" r="1"/><circle cx="178" cy="70" r="1.1"/></g>'
      : m.sky === 'cloud' ? '<g fill="#7d838e"><circle cx="150" cy="36" r="10"/><circle cx="162" cy="32" r="12"/><circle cx="174" cy="38" r="9"/></g><g class="rain" stroke="rgba(170,200,230,.6)" stroke-width="2"><line x1="150" y1="52" x2="147" y2="62"/><line x1="166" y1="54" x2="163" y2="64"/><line x1="30" y1="40" x2="27" y2="50"/></g>'
        : '<circle cx="164" cy="34" r="11" fill="#f2c94c"/>';
    var ground = '<rect x="0" y="158" width="200" height="42" fill="rgba(34,179,94,.16)"/><ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>';
    /* body */
    /* rounded shoulders, a soft waist, rounded hem */
    var TD = MU ? 'M84 86C92 83.5 110 83.5 118 86C130 87.5 134.5 92 134 101C133 110 126.5 117 123.5 124C122.5 128 119.5 130 116 130H86C82.5 130 79.5 128 78.5 124C75.5 117 69 110 68 101C67.5 92 72 87.5 84 86Z'
      : L.build === 'athletic' ? 'M86 86.5C93 84.5 109 84.5 116 86.5C126 88 131 92 130.5 101C129.5 110 126 117 124 124C123 128 120 130 116 130H86C82 130 79 128 78 124C76 117 72.5 110 71.5 101C71 92 76 88 86 86.5Z'
      : 'M88 86.5C95 85 107 85 114 86.5C123 88 127 92 127 100C127 108 125.5 116 124.5 123C124 127.5 121 130 117 130H85C81 130 78 127.5 77.5 123C76.5 116 75 108 75 100C75 92 79 88 88 86.5Z';
    var BS = L.shape || 'straight';
    var torso = (BS === 'hips' ? '<path d="M77 114q-5 8-3 16h54q2-8-3-16z" fill="' + (L.bottom === 'skirt' || top === 'dress' ? (top === 'dress' ? T : P) : L.bottom === 'shorts' || L.bottom === 'swim' ? P : P) + '"/>' : '') + '<path d="' + TD + '" fill="' + T + '"/>' + (BS === 'belly' ? '<path d="M78 106q-4 10 0 21h46q4-11 0-21z" fill="' + T + '"/><path d="M84 124q17 5 34 0" stroke="' + T2 + '" stroke-width="1.2" fill="none" opacity=".6"/>' : '') + (MU ? '<path d="M88 104q6.5 4 13 2q6.5 2 13-2" fill="none" stroke="' + T2 + '" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>' : '');
    /* a pattern on the top, kept inside the torso */
    var PT = bare || top === 'suit' ? 'none' : L.pat || 'none';
    if (PT !== 'none') {
      var cid = 'avc' + (++UID), pc = shade(T, .35), lines = '';
      if (PT === 'stripes') for (var sy = 92; sy < 130; sy += 7) lines += '<path d="M60 ' + sy + 'h82" stroke="' + pc + '" stroke-width="2.6"/>';
      if (PT === 'check') { for (var cy = 90; cy < 130; cy += 9) lines += '<path d="M60 ' + cy + 'h82" stroke="' + T2 + '" stroke-width="3" opacity=".55"/>'; for (var cx = 70; cx < 135; cx += 9) lines += '<path d="M' + cx + ' 84v48" stroke="' + T2 + '" stroke-width="3" opacity=".55"/>'; }
      if (PT === 'star') lines = '<path d="M101 99l3.2 6.6 7.2 1-5.2 5 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.2-5 7.2-1z" fill="' + pc + '"/>';
      if (PT === 'heart') lines = '<path d="M101 117c-8-5.5-11-9.5-11-13.5 0-3 2.4-5 5-5 2.6 0 4.6 1.6 6 3.6 1.4-2 3.4-3.6 6-3.6 2.6 0 5 2 5 5 0 4-3 8-11 13.5z" fill="#e5484d"/>';
      if (PT === 'bolt') lines = '<path d="M104 96l-9 13h6l-4 11 10-14h-6l5-10z" fill="#f2c94c" stroke="' + shade(T, -.35) + '" stroke-width=".8" stroke-linejoin="round"/>';
      if (PT === 'camo') lines = '<g opacity=".8"><ellipse cx="84" cy="96" rx="7" ry="4" fill="#5d6b3f"/><ellipse cx="108" cy="92" rx="8" ry="3.5" fill="#3e4a2b"/><ellipse cx="96" cy="108" rx="9" ry="4" fill="#8a8a5c"/><ellipse cx="118" cy="110" rx="6" ry="4.5" fill="#5d6b3f"/><ellipse cx="86" cy="120" rx="7" ry="3.5" fill="#3e4a2b"/><ellipse cx="108" cy="124" rx="8" ry="3.5" fill="#5d6b3f"/></g>';
      if (PT === 'tiedye') lines = '<g opacity=".6"><circle cx="101" cy="108" r="30" fill="#e0559a"/><circle cx="101" cy="108" r="22" fill="#f2c94c"/><circle cx="101" cy="108" r="14" fill="#2fae6a"/><circle cx="101" cy="108" r="7" fill="#2f9ee0"/></g>';
      if (PT === 'flag') lines = '<g transform="translate(106 95)"><rect width="12" height="8.5" rx=".8" fill="#ba0c2f"/><path d="M3.6 0v8.5M0 4.25h12" stroke="#fff" stroke-width="2.6"/><path d="M3.6 0v8.5M0 4.25h12" stroke="#00205b" stroke-width="1.3"/></g>';
      if (PT === 'pumpkin') lines = '<ellipse cx="101" cy="110" rx="10" ry="8.4" fill="#f2851f"/><path d="M101 101.6v-3" stroke="#2f7a55" stroke-width="2"/><path d="M95 107l2.4-2.4 2.4 2.4zM102.2 107l2.4-2.4 2.4 2.4zM94.6 112q6.4 4 12.8 0l-2 1.6-2-1.4-2 1.6-2-1.6-2 1.6z" fill="#2a1a10"/>';
      if (PT === 'bones') lines = '<g stroke="#e9edf5" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M101 90v32"/><path d="M89 98q12 4 24 0M88 106q13 4 26 0M89 114q12 4 24 0"/></g>';
      if (PT === 'flame') lines = '<path d="M101 98c5 5 9 9 9 14a9 9 0 0 1-18 0c0-3 2-5 4-7 0 3 1 5 3 5 0-4-1-8 2-12z" fill="#f2a024"/><path d="M101 108c2 2 4 4 4 6a4 4 0 0 1-8 0c0-2 2-4 4-6z" fill="#f2e04a"/>';
      torso += '<defs><clipPath id="' + cid + '"><path d="' + TD + '"/></clipPath></defs><g clip-path="url(#' + cid + ')">' + lines + '</g>';
    }
    var detail = '';
    if (top === 'sweater') detail = '<path d="M92 88l9 9 9-9" fill="#f2f2f2"/><path d="M92 88l9 9 9-9" fill="none" stroke="#cfd6e4" stroke-width="1"/><path d="M95 88l6 6 6-6" fill="' + T + '"/><path d="M78.5 125q22.5 3 45 0" stroke="' + T2 + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    if (top === 'tee') detail = '<path d="M94 88q7 6 14 0" fill="none" stroke="' + T2 + '" stroke-width="2.5"/>';
    if (top === 'hoodie') detail = '<path d="M86 88q15 14 30 0" fill="' + T2 + '"/><path d="M96 94v12M106 94v12" stroke="#ddd" stroke-width="1.5" stroke-linecap="round"/><rect x="88" y="112" width="26" height="10" rx="3" fill="' + T2 + '"/>';
    if (top === 'shirt') detail = '<path d="M101 90v38" stroke="' + T2 + '" stroke-width="1.5"/><path d="M92 88l9 7 9-7-2 8-7-3-7 3z" fill="' + shade(T, .25) + '"/><circle cx="101" cy="104" r="1.2" fill="' + T2 + '"/><circle cx="101" cy="114" r="1.2" fill="' + T2 + '"/>';
    if (top === 'none') detail = '<path d="M86 104q7 5 14 1M102 105q7 4 14-1" fill="none" stroke="' + shade(L.skin, -.2) + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="101" cy="120" r="1.2" fill="' + shade(L.skin, -.25) + '"/>' + (L.build === 'athletic' ? '<path d="M101 108v10M95 113h12" stroke="' + shade(L.skin, -.15) + '" stroke-width="1.1" fill="none"/>' : '') +
      (MU ? '<path d="M101 98v24M95 108h12M95.5 114h11M96 120h10" stroke="' + shade(L.skin, -.2) + '" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M84 102q8 7 17 2q9 5 17-2" fill="none" stroke="' + shade(L.skin, -.22) + '" stroke-width="1.6" stroke-linecap="round"/>' : '');
    if (top === 'jersey') detail = '<path d="M94 88q7 6 14 0" fill="none" stroke="#f2f2f2" stroke-width="2.6"/><path d="M80 96v28M122 96v28" stroke="#f2f2f2" stroke-width="2.2" opacity=".85"/><text x="101" y="118" font-size="17" font-weight="900" text-anchor="middle" fill="#f2f2f2" font-family="system-ui,sans-serif">' + esc(L.num || '7') + '</text>';
    if (top === 'suit') detail = '<path d="M92 87l9 10 9-10v41h-18z" fill="#f2f2f2"/><path d="M99 96l2-2 2 2-1.2 3 2 14-2.8 4-2.8-4 2-14z" fill="' + (L.hatC || '#d93a3a') + '"/><path d="M92 87l-2 13 7 3-6 3 10 22M110 87l2 13-7 3 6 3-10 22" fill="none" stroke="' + T2 + '" stroke-width="2.2" stroke-linejoin="round"/><circle cx="104" cy="120" r="1.2" fill="' + T2 + '"/>';
    if (top === 'puffer') detail = '<path d="M76 100q25 4 50 0M76 111q25 4 50 0M78 122q23 4 46 0" stroke="' + T2 + '" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M89 84q12 6 24 0l2 6q-14 6-28 0z" fill="' + T2 + '"/><path d="M101 90v38" stroke="' + shade(T, -.35) + '" stroke-width="1.4"/>';
    if (top === 'tank') detail = '<path d="M89 86.4q12 13 24 0z" fill="' + S + '"/><path d="M78 92q3-4 9-5.6M124 92q-3-4-9-5.6" stroke="' + T2 + '" stroke-width="1.6" fill="none"/>';
    if (top === 'polo') detail = '<path d="M101 92v11" stroke="' + T2 + '" stroke-width="1.4"/><circle cx="101" cy="96" r="1" fill="' + T2 + '"/><circle cx="101" cy="100" r="1" fill="' + T2 + '"/><path d="M92 86.5l9 6 9-6-1.5 6-7.5 2-7.5-2z" fill="' + shade(T, .2) + '"/>';
    if (top === 'knit') detail = '<path d="M78 92q23 9 46 0v9q-23 9-46 0z" fill="#f2f2f2"/>' + [83, 89, 95, 101, 107, 113, 119].map(function (x, i) { return '<path d="M' + x + ' ' + (95.5 + (Math.abs(x - 101) < 10 ? 2.4 : Math.abs(x - 101) < 16 ? 1.6 : .4)) + 'l2.2 2.2-2.2 2.2-2.2-2.2z" fill="' + T + '"/>'; }).join('') + '<g fill="#f2f2f2">' + [[86, 108], [96, 112], [106, 108], [116, 112], [91, 120], [101, 122], [111, 120]].map(function (q) { return '<path d="M' + q[0] + ' ' + (q[1] - 1.4) + 'v2.8M' + (q[0] - 1.4) + ' ' + q[1] + 'h2.8" stroke="#f2f2f2" stroke-width="1"/>'; }).join('') + '</g><path d="M78.5 125q22.5 3 45 0" stroke="#f2f2f2" stroke-width="2.6" fill="none"/>';
    if (top === 'varsity') detail = '<path d="M92 87.5q9 6 18 0" stroke="#f2f2f2" stroke-width="2.4" fill="none"/><path d="M101 92v36" stroke="' + T2 + '" stroke-width="1.2"/><circle cx="101" cy="100" r="1.1" fill="#f2f2f2"/><circle cx="101" cy="108" r="1.1" fill="#f2f2f2"/><circle cx="101" cy="116" r="1.1" fill="#f2f2f2"/><path d="M78.5 125q22.5 3 45 0" stroke="#f2f2f2" stroke-width="2.6" fill="none"/><circle cx="91" cy="101" r="5" fill="#f2f2f2"/><path d="M91.0 97.6L91.9 99.8L94.2 99.9L92.5 101.5L93.0 103.8L91.0 102.5L89.0 103.8L89.5 101.5L87.8 99.9L90.1 99.8z" fill="' + T + '"/>';
    if (top === 'rain') detail = '<path d="M86 86q15-7 30 0l-2 4q-13-5-26 0z" fill="' + T2 + '"/><path d="M101 90v38" stroke="' + T2 + '" stroke-width="1.6"/><path d="M97 98h3M97 106h3M97 114h3" stroke="' + shade(T, -.4) + '" stroke-width="1.8" stroke-linecap="round"/><path d="M83 112h10M109 112h10" stroke="' + T2 + '" stroke-width="2" stroke-linecap="round"/>';
    if (top === 'dress') detail = '<path d="M91 87q10 8 20 0" fill="none" stroke="' + T2 + '" stroke-width="2"/><path d="M80 116q21 4 42 0" stroke="' + T2 + '" stroke-width="2" fill="none"/>';
    if (top === 'scrubs') detail = '<path d="M92 87l9 11 9-11" fill="none" stroke="' + T2 + '" stroke-width="2.2" stroke-linejoin="round"/><rect x="106" y="102" width="10" height="9" rx="1.5" fill="none" stroke="' + T2 + '" stroke-width="1.4"/><path d="M109 101v5" stroke="#3987e5" stroke-width="1.4"/>';
    if (top === 'chef') detail = '<path d="M91 87q10 6 20 0l-1 4q-9 5-18 0z" fill="' + shade(T, -.08) + '"/><path d="M101 91l12 6v30" stroke="' + shade(T, -.15) + '" stroke-width="1.3" fill="none"/>' + [99, 108, 117].map(function (y) { return '<circle cx="96" cy="' + y + '" r="1.3" fill="' + shade(T, -.3) + '"/><circle cx="108" cy="' + y + '" r="1.3" fill="' + shade(T, -.3) + '"/>'; }).join('');
    if (top === 'kit') detail = '<path d="M93 87.5l8 6 8-6" fill="none" stroke="#f2f2f2" stroke-width="2.4"/><path d="M75.5 100h4M122.5 100h4" stroke="#f2f2f2" stroke-width="3"/><path d="M88 99h8v6q0 4-4 5.4-4-1.4-4-5.4z" fill="#f2c94c"/><text x="111" y="108" font-size="8" font-weight="900" text-anchor="middle" fill="#f2f2f2" font-family="system-ui,sans-serif">' + esc(L.num || '10') + '</text>';
    if (top === 'pjs') detail = '<path d="M92 87l9 8 9-8-2 6-7 3-7-3z" fill="' + shade(T, .3) + '"/><path d="M101 95v33" stroke="' + shade(T, .3) + '" stroke-width="1.4"/>' + [101, 110, 119].map(function (y) { return '<circle cx="101" cy="' + y + '" r="1.2" fill="' + shade(T, .4) + '"/>'; }).join('');
    if (top === 'robe') detail = '<path d="M91 86l14 30M111 86l-14 26" stroke="' + shade(T, -.2) + '" stroke-width="3" fill="none"/><path d="M78 113q23 5 46 0" stroke="' + shade(T, -.25) + '" stroke-width="3.4" fill="none"/><path d="M106 115l3 10M108 115l6 8" stroke="' + shade(T, -.25) + '" stroke-width="2.2" stroke-linecap="round"/>';
    if (top === 'bunad') detail = '<path d="M82 92q4-4 9-5l3 41H80q-3-18 2-36zM120 92q-4-4-9-5l-3 41h14q3-18-2-36z" fill="#b3202c"/><path d="M84 112h9M109 112h9M84 120h9M109 120h9" stroke="#f2c94c" stroke-width="1.3"/><circle cx="101" cy="94" r="3.6" fill="#d8dce4" stroke="#9aa3b2" stroke-width=".8"/><circle cx="101" cy="94" r="1.3" fill="#9aa3b2"/><path d="M99 97.4l-1 3.6M103 97.4l1 3.6" stroke="#9aa3b2" stroke-width="1"/>';
    if (L.chest && !bare && ['tee', 'sweater', 'hoodie', 'tank', 'polo', 'pjs'].indexOf(top) >= 0) detail += '<text x="101" y="' + (top === 'hoodie' ? 107 : 110) + '" font-size="' + ({ 4: 7.6, 3: 9 }[String(L.chest).length] || 12) + '" font-weight="900" text-anchor="middle" fill="' + shade(T, T === '#f2f2f2' || T === '#f2c94c' ? -.6 : .55) + '" font-family="system-ui,sans-serif">' + esc(String(L.chest).slice(0, 4).toUpperCase()) + '</text>';
    var BG = L.badge || 'none';
    if (BG !== 'none' && !bare) detail += '<g transform="translate(' + (top === 'varsity' || top === 'kit' ? 112 : 90) + ' 101)">' + ({ streak: '<circle r="5" fill="#2e3340" stroke="#f2a024" stroke-width="1.2"/><path d="M0-3.4c2 2 3.4 3.6 3.4 5.4a3.4 3.4 0 0 1-6.8 0c0-1.2.8-2 1.6-2.8 0 1.2.4 2 1.2 2 0-1.6-.4-3 .6-4.6z" fill="#f2a024"/>',
      trophy: '<circle r="5" fill="#2e3340" stroke="#f2c94c" stroke-width="1.2"/><path d="M-2.6-2.6h5.2v2a2.6 2.6 0 0 1-5.2 0zM-.8 2h1.6v1.4h1.4v1h-4.4v-1h1.4z" fill="#f2c94c"/>',
      top3: '<circle r="5" fill="#f2c94c"/><text y="2.8" font-size="7.4" font-weight="900" text-anchor="middle" fill="#2a2100" font-family="system-ui,sans-serif">3</text>',
      paid: '<circle r="5" fill="#2fae6a"/><path d="M-2.4.2l1.6 1.6 3.2-3.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' }[BG] || '') + '</g>';
    if (top === 'jacket') detail = '<path d="M92 88l9 10 9-10v40h-18z" fill="#f2f2f2"/><path d="M92 88l9 10v30M110 88l-9 10" stroke="' + T2 + '" stroke-width="2" fill="none"/>';
    var extra = '';
    var NK = L.neck || 'none';
    if (NK === 'chain') extra += '<path d="M91 88q10 10 20 0" stroke="#f2c94c" stroke-width="1.7" fill="none"/><circle cx="101" cy="98" r="2.2" fill="#f2c94c"/>';
    if (NK === 'scarf' && m.k !== 'gym') extra += '<path d="M88 84q13 8 26 0l1 6q-14 9-28 0z" fill="' + (L.hatC || '#e8743b') + '"/><path d="M106 89h6l1 17h-7z" fill="' + shade(L.hatC || '#e8743b', -.12) + '"/><path d="M106.5 104h6M107 101h5.5" stroke="' + shade(L.hatC || '#e8743b', .3) + '" stroke-width="1"/>';
    if (NK === 'bowtie') extra += '<path d="M101 89l-7.5-4.5v9zM101 89l7.5-4.5v9z" fill="' + (L.hatC || '#d93a3a') + '"/><circle cx="101" cy="89" r="2" fill="' + shade(L.hatC || '#d93a3a', -.2) + '"/>';
    if (NK === 'tie' && !bare) extra += '<path d="M99 87.5h4l-1 3 3 19-4 4.5-4-4.5 3-19z" fill="' + (L.hatC || '#d93a3a') + '"/><path d="M98 97l6-2M97.6 103l6.6-2.2" stroke="' + shade(L.hatC || '#d93a3a', .3) + '" stroke-width="1"/>';
    if (NK === 'pearls') extra += '<g fill="#f6f1e7" stroke="#d8cdb8" stroke-width=".4">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { var a = Math.PI * (.12 + i * .095); return '<circle cx="' + (101 - Math.cos(a) * 11).toFixed(1) + '" cy="' + (85 + Math.sin(a) * 9).toFixed(1) + '" r="1.5"/>'; }).join('') + '</g>';
    if (NK === 'medal') extra += '<path d="M94 86l7 15 7-15" fill="none" stroke="#d93a3a" stroke-width="3.2"/><path d="M96 86l5 11 5-11" fill="none" stroke="#3987e5" stroke-width="1.2"/><circle cx="101" cy="105" r="5" fill="#f2c94c" stroke="#c98500" stroke-width="1"/><path d="M101.0 102.2L101.7 104.0L103.7 104.1L102.2 105.4L102.6 107.3L101.0 106.3L99.4 107.3L99.8 105.4L98.3 104.1L100.3 104.0z" fill="#c98500"/>';
    if (L.bag === 'yes' && !bare) extra += '<path d="M88 87v40M114 87v40" stroke="#2e3340" stroke-width="4" stroke-linecap="round"/><rect x="85.5" y="104" width="5" height="4" rx="1" fill="#b8bdcc"/><rect x="111.5" y="104" width="5" height="4" rx="1" fill="#b8bdcc"/>';
    if (L.bottom === 'overalls') extra += '<path d="M89 103h24v25H89z" fill="' + P + '"/><path d="M89.5 88l1.5 16M112.5 88l-1.5 16" stroke="' + P + '" stroke-width="3.4" stroke-linecap="round"/><circle cx="91" cy="104" r="1.6" fill="#f2c94c"/><circle cx="111" cy="104" r="1.6" fill="#f2c94c"/><rect x="96" y="108" width="10" height="7" rx="1.5" fill="none" stroke="' + shade(P, .25) + '" stroke-width="1"/>';
    if (NK === 'lanyard' && !bare && m.k !== 'gym' && m.k !== 'night') extra += '<path d="M93 90l6 22M109 90l-6 22" stroke="#1b1b1b" stroke-width="1.6" fill="none"/><rect x="97" y="111" width="8" height="10" rx="1.5" fill="#f2f2f2" stroke="#999" stroke-width=".6"/>';
    var cut = L.bottom === 'shorts' ? 142 : L.bottom === 'swim' ? 135 : 157;
    var LC = cut < 157 || L.bottom === 'skirt' || top === 'dress' ? S : P;
    /* legs drawn at their own width for each body (not squeezed with the torso): they fill the hem, taper to the ankle */
    var hem = ((L.build === 'athletic' || MU) ? 45 : 47) * SX, G = { slim: 3, regular: 3.5, athletic: 4, muscular: 4.5, broad: 4 }[L.build] || 3.5;
    var LW = (hem - 3 - G) / 2, LB = LW * (MU ? .68 : L.build === 'athletic' ? .72 : .8), x0 = 101 - G / 2 - LW, x1 = 101 + G / 2;
    var leg = function (a) { var d = (LW - LB) / 2, q = function (n) { return n.toFixed(1); };
      return '<path d="M' + q(a) + ' 124H' + q(a + LW) + 'Q' + q(a + LW + .6) + ' 140 ' + q(a + LW - d) + ' 156H' + q(a + d) + 'Q' + q(a - .6) + ' 140 ' + q(a) + ' 124Z" fill="' + LC + '"/>' +
        '<path class="av-knee" d="M' + q(a + LW * .22) + ' 140.6q' + q(LW * .28) + ' 1.1 ' + q(LW * .56) + ' 0" stroke="rgba(0,0,0,.1)" stroke-width=".6" fill="none" stroke-linecap="round"/>'; };
    var hx0 = 101 - hem / 2 + 1, hw = hem - 2;
    /* a small shoe under each ankle, toe pointing a little outwards, a gap between them */
    var shoe = function (cx, dir) { var w = LB + 3, x = cx - w / 2 + dir * 1.5, q = function (n) { return n.toFixed(1); };
      return '<path d="M' + q(x + 2) + ' 155h' + q(w - 4) + 'c' + (dir > 0 ? '3 0 5 1.6 5 3.2 0 1.2-.8 1.8-2.2 1.8h-' + q(w + .8) + 'c-1.2 0-1.8-.8-1.8-2 0-1.8.9-3 2-3z' : '1.1 0 2 1.2 2 3 0 1.2-.6 2-1.8 2h-' + q(w + .8) + 'c-1.4 0-2.2-.6-2.2-1.8 0-1.6 2-3.2 5-3.2z') + '" fill="' + (L.shoes === 'sandals' ? S : (L.shoeC || '#1a1a1a')) + '"/>' +
        (L.socks && (cut < 157 || L.bottom === 'skirt' || top === 'dress') && L.shoes !== 'boots' && L.shoes !== 'sandals' ? '<rect x="' + q(x + 1.2) + '" y="150.6" width="' + q(w - 2.4) + '" height="5" rx="1" fill="' + L.socks + '"/><path d="M' + q(x + 1.2) + ' 152h' + q(w - 2.4) + '" stroke="' + shade(L.socks, -.25) + '" stroke-width=".8"/>' : '') +
        (L.shoes === 'slippers' ? '<ellipse cx="' + q(cx + dir * 1.5) + '" cy="157.4" rx="' + q(w / 2 + 1.4) + '" ry="3.2" fill="' + (L.shoeC || '#e0559a') + '"/><circle cx="' + q(cx + dir * 1.5) + '" cy="155.2" r="2" fill="' + shade(L.shoeC || '#e0559a', .45) + '"/>' : '') +
        (L.shoes === 'cleats' ? '<path d="M' + q(x + 1) + ' 160.8h1.4M' + q(x + w / 2 - .4) + ' 160.8h1.4M' + q(x + w - 1.4) + ' 160.8h1.4" stroke="#f2f2f2" stroke-width="1.4"/><path d="M' + q(x + 2) + ' 157h' + q(w - 3) + '" stroke="#f2c94c" stroke-width="1.1"/>' : '') +
        (L.shoes === 'boots' ? '<rect x="' + q(x + .5) + '" y="148" width="' + q(w - 1) + '" height="9" rx="1.5" fill="' + (L.shoeC || '#5b3a1e') + '"/><path d="M' + q(x + .5) + ' 150.5h' + q(w - 1) + '" stroke="' + shade(L.shoeC || '#5b3a1e', -.3) + '" stroke-width="1"/>' : '') +
        (L.shoes === 'hightops' ? '<rect x="' + q(x + .8) + '" y="150.5" width="' + q(w - 1.6) + '" height="6" rx="1.5" fill="' + (L.shoeC || '#d93a3a') + '"/><circle cx="' + q(cx) + '" cy="152.5" r=".7" fill="#f2f2f2"/><circle cx="' + q(cx) + '" cy="154.6" r=".7" fill="#f2f2f2"/>' : '') +
        (L.shoes === 'sandals' ? '<path d="M' + q(x + 1.5) + ' 157.6h' + q(w - 1) + '" stroke="' + (L.shoeC || '#5b3a1e') + '" stroke-width="1.8" stroke-linecap="round"/>' : '') +
        (L.shoeC && L.shoeC !== '#1a1a1a' && L.shoes !== 'sandals' ? '<path d="M' + q(x - .5) + ' 159.6h' + q(w + 3) + '" stroke="#f2f2f2" stroke-width="1.3" stroke-linecap="round"/>' : ''); };
    /* each leg (with its shoe) in its own group, so the pictures can make you walk (styles.css: .av-legL / .av-legR);
       the trousers' top is drawn over both, which hides the hinge */
    /* L1: the body sits UP higher and the legs get that room (the feet stay on the ground); not when seated */
    var UP = L.aid === 'chair' ? 0 : 5, S0 = function (y) { return 155 + (y - 155) * 1.27; }, LK = (S0(156) - (S0(124) - UP)) / 32;
    var SC = '<g transform="translate(0 ' + S0(156).toFixed(2) + ') scale(1 ' + LK.toFixed(4) + ') translate(0 -156)">';
    var legs = '<g class="av-legL">' + SC + leg(x0) + '</g>' + shoe(x0 + LW / 2, -1) + '</g><g class="av-legR">' + SC + leg(x1) + '</g>' + shoe(x1 + LW / 2, 1) + '</g>' + SC +
      '<path d="M' + hx0.toFixed(1) + ' 122h' + hw.toFixed(1) + 'v5c0 3-2 5-5 5h-' + (hw / 2 - 5).toFixed(1) + 'l-0 -3-0 3h-' + (hw / 2 - 5).toFixed(1) + 'c-3 0-5-2-5-5z" fill="' + (cut < 157 ? P : shade(P, -.06)) + '"/>' +
      (cut < 157 ? '<path d="M' + hx0.toFixed(1) + ' 124h' + hw.toFixed(1) + 'v' + (cut - 127) + 'q0 3-3 3h-' + (hw / 2 - 3 - G / 2).toFixed(1) + 'l-' + (G / 2).toFixed(1) + '-5-' + (G / 2).toFixed(1) + ' 5h-' + (hw / 2 - 3 - G / 2).toFixed(1) + 'q-3 0-3-3z" fill="' + P + '"/>' + (L.bottom === 'swim' ? '<path d="M' + (hx0 + 1).toFixed(1) + ' 130h' + (hw - 2).toFixed(1) + '" stroke="' + shade(P, .3) + '" stroke-width="1.5"/>' : '') : '') +
      (L.bottom === 'jeans' ? '<path d="M' + (x0 + LW / 2 - 2.5).toFixed(1) + ' 139h5M' + (x0 + LW / 2 - 2).toFixed(1) + ' 141h4M' + (x1 + LW / 2 - 2.5).toFixed(1) + ' 137h5" stroke="#dfe6f0" stroke-width="1.2" stroke-linecap="round"/><path d="M' + (x0 + 1.5).toFixed(1) + ' 126v6M' + (x1 + LW - 1.5).toFixed(1) + ' 126v6" stroke="#c98500" stroke-width=".8" opacity=".7"/>' : '') +
      (L.bottom === 'joggers' ? '<path d="M' + (x0 + .8).toFixed(1) + ' 127L' + (x0 + LW / 2 - LB / 2 + .6).toFixed(1) + ' 152M' + (x1 + LW - .8).toFixed(1) + ' 127L' + (x1 + LW / 2 + LB / 2 - .6).toFixed(1) + ' 152" stroke="#f2f2f2" stroke-width="1.3"/><path d="M' + (x0 + (LW - LB) / 2).toFixed(1) + ' 152.5h' + LB.toFixed(1) + 'M' + (x1 + (LW - LB) / 2).toFixed(1) + ' 152.5h' + LB.toFixed(1) + '" stroke="' + shade(P, -.25) + '" stroke-width="3"/>' : '') +
      (L.bottom === 'cargo' ? '<rect x="' + (x0 - .3).toFixed(1) + '" y="134" width="5" height="7" rx="1" fill="' + shade(P, -.14) + '"/><rect x="' + (x1 + LW - 4.7).toFixed(1) + '" y="134" width="5" height="7" rx="1" fill="' + shade(P, -.14) + '"/>' : '') +
      '</g>';
    if (L.bottom === 'skirt' || top === 'dress') { var SKC = top === 'dress' ? T : P; legs += '<path d="M' + (hx0 - 1).toFixed(1) + ' 119h' + (hw + 2).toFixed(1) + 'l7 ' + (top === 'dress' ? 24 : 21) + 'q-' + (hw / 2 + 8).toFixed(1) + ' 5-' + (hw + 16).toFixed(1) + ' 0z" fill="' + SKC + '"/><path d="M' + (hx0 - 5).toFixed(1) + ' ' + (top === 'dress' ? 141 : 138) + 'q' + (hw / 2 + 6).toFixed(1) + ' 4 ' + (hw + 10).toFixed(1) + ' 0" stroke="' + shade(SKC, -.2) + '" stroke-width="1.4" fill="none"/>'; }
    /* arms + props */
    var AC = top === 'tank' ? S : top === 'varsity' ? '#f2f2f2' : T;
    /* ---------- the body built for moving (Phase L1, 2026-11-11) ----------
       Each arm is an upper arm and a forearm with an elbow (A1 + A2, longer than before, so a hand reaches above the
       head), ending in a mitten hand with a thumb on the inside. A pose still names the shoulder and where the hand
       goes (the old 'M sx sy c … x y' curves): free poses stretch to the longer arm, poses that touch something
       (holding hands, a cake, a pan, the suitcase, crutches) keep the hand where it was and bend the elbow more.
       What the hand holds is drawn after arm() and sits in .av-hand, which is moved to where the hand ends up. */
    var A1 = 23, A2 = 21, A0 = 34, KEEP = /^(hold|hi5|hug|cook)/.test(m.k || '') || /^(bday|trip|gym|rain)$/.test(m.k || '') || L.aid === 'crutches';
    var shift = { R: [0, 0], L: [0, 0] }, fAng = { R: 90, L: 90 }, cur = 'R';
    var q2 = function (n) { return (Math.round(n * 100) / 100).toString(); };
    var arm = function (d) {
      var n = String(d).match(/-?\d*\.?\d+/g).map(Number), Sx = n[0], Sy = n[1], vx = n[6], vy = n[7], cx1 = n[2], cy1 = n[3];
      var side = Sx > 101 ? 'R' : 'L'; cur = side;
      var dist = Math.hypot(vx, vy) || 1, tot = A1 + A2;
      var r = KEEP ? Math.min(dist, tot * .99) : tot * Math.min(.97, .3 + dist / A0 * .7);   /* free poses: nearly straight, a soft elbow */
      r = Math.max(r, Math.abs(A1 - A2) + 2);
      var ux = vx / dist, uy = vy / dist, Ex = Sx + ux * r, Ey = Sy + uy * r;
      /* a resting arm hangs almost straight down, close to the body (not bowed out at the elbow) */
      if (!KEEP && vy > 24 && Math.abs(vx) < 12) { var sdx = side === 'R' ? 1 : -1; r = tot * .985; Ex = Sx + sdx * 4; Ey = Sy + Math.sqrt(r * r - 16); ux = (Ex - Sx) / r; uy = (Ey - Sy) / r; }
      var cr = vx * cy1 - vy * cx1, sg = cr < 0 ? -1 : cr > 0 ? 1 : (side === 'R' ? -1 : 1);
      var a = Math.acos(Math.max(-1, Math.min(1, (A1 * A1 + r * r - A2 * A2) / (2 * A1 * r)))) * sg, th = Math.atan2(uy, ux);
      var Elx = Sx + Math.cos(th + a) * A1, Ely = Sy + Math.sin(th + a) * A1;
      shift[side] = [Ex - (Sx + vx), Ey - (Sy + vy)];
      fAng[side] = Math.atan2(Ey - Ely, Ex - Elx) * 180 / Math.PI;
      var up = 'M' + q2(Sx) + ' ' + q2(Sy) + 'L' + q2(Elx) + ' ' + q2(Ely), lo = 'M' + q2(Elx) + ' ' + q2(Ely) + 'L' + q2(Ex) + ' ' + q2(Ey);
      /* the dark edge starts a third down the upper arm, so the sleeve flows out of the shoulder instead of a rim around it */
      var edge = 'M' + q2(Sx + (Elx - Sx) * .35) + ' ' + q2(Sy + (Ely - Sy) * .35) + 'L' + q2(Elx) + ' ' + q2(Ely) + 'L' + q2(Ex) + ' ' + q2(Ey);
      var line = function (dd, col, w, extra) { return '<path d="' + dd + '" stroke="' + col + '" stroke-width="' + w + '" fill="none" stroke-linecap="round"' + (extra || '') + '/>'; };
      return '<g class="av-limb" data-s="' + q2(Sx) + ' ' + q2(Sy) + '" data-e="' + q2(Elx) + ' ' + q2(Ely) + '" data-w="' + q2(Ex) + ' ' + q2(Ey) + '" data-h="' + q2(Sx + vx) + ' ' + q2(Sy + vy) + '" data-l="' + A1 + ' ' + A2 + '">' +
        line(edge, shade(AC, -.3), AW + 1.8, ' stroke-linejoin="round" opacity=".55"') +
        '<circle cx="' + q2(Sx - (side === 'R' ? 1 : -1) * AW * .12) + '" cy="' + q2(Sy + AW * .1) + '" r="' + q2(AW * .58) + '" fill="' + AC + '"/>' +
        line(up, AC, AW) + line(lo, AC, AW * .86) +
        '<circle cx="' + q2(Elx) + '" cy="' + q2(Ely) + '" r="' + q2(AW * .47) + '" fill="' + AC + '"/>' +
        (L.build === 'athletic' || MU ? line(up, AC, AW + (MU ? 3 : 2), ' stroke-dasharray="' + (MU ? 10 : 8) + ' 999" stroke-dashoffset="-6"') : '') +
        '</g><g class="av-hand" transform="translate(' + q2(shift[side][0]) + ' ' + q2(shift[side][1]) + ')">';
    }, hand = function (x, y) {
      /* a mitten along the forearm: one rounded shape a bit longer than wide, the thumb a small curve lying on its inside edge */
      var sd = cur === 'R' ? 1 : -1, ang = fAng[cur] - 90, hr = Math.min(HR, 4.6), HS2 = shade(S, -.25), w = Math.max(hr * .92, AW * .86 * .5), h = w * 1.28, x0 = x; hr = w / .92;   /* as wide as the forearm */
      y = y + hr * .7;   /* the hand comes out of the sleeve, past the wrist */
      var mit = 'M' + q2(x - w) + ' ' + q2(y - h * .55) + 'Q' + q2(x - w) + ' ' + q2(y + h) + ' ' + x + ' ' + q2(y + h) + 'Q' + q2(x + w) + ' ' + q2(y + h) + ' ' + q2(x + w) + ' ' + q2(y - h * .55) + 'Z';
      var tx = x - sd * w * .78, th = 'M' + q2(tx) + ' ' + q2(y - h * .45) + 'q' + q2(-sd * hr * .55) + ' ' + q2(hr * .5) + ' ' + q2(sd * hr * .1) + ' ' + q2(hr * 1.05);
      return '<g class="av-mit" transform="rotate(' + q2(ang) + ' ' + x0 + ' ' + q2(y - hr * .7) + ')"><path d="' + mit + '" fill="' + S + '" stroke="' + HS2 + '" stroke-width=".7" stroke-linejoin="round"/>' +
        '<path d="' + th + '" stroke="' + HS2 + '" stroke-width=".75" fill="none" stroke-linecap="round"/></g>';
    };
    var holdAt = function (x, y, up) { var H0 = L.hold || 'none'; if (H0 === 'none') return '';
      return { phone: '<rect x="' + (x - 3.2) + '" y="' + (y - 10) + '" width="6.4" height="11" rx="1.4" fill="#1d2230"/><rect x="' + (x - 2.2) + '" y="' + (y - 9) + '" width="4.4" height="7.6" rx=".6" fill="#3987e5"/>',
        coffee: '<path d="M' + (x - 5) + ' ' + (y - 9) + 'h10v7a3.5 3.5 0 0 1-3.5 3.5h-3a3.5 3.5 0 0 1-3.5-3.5z" fill="#f4efe6"/><rect x="' + (x - 5) + '" y="' + (y - 6) + '" width="10" height="3" fill="#2f7a55"/><path d="M' + (x - 4) + ' ' + (y - 10) + 'h8" stroke="#2b2f36" stroke-width="2" stroke-linecap="round"/>',
        laptop: '<path d="M' + (x - 2) + ' ' + (y - 14) + 'l-2 14h' + 4 + 'z" fill="#2b2f36"/><rect x="' + (x - 18) + '" y="' + (y - 2) + '" width="22" height="3" rx="1" fill="#9aa3b2"/><rect x="' + (x - 17) + '" y="' + (y - 16) + '" width="15" height="13" rx="1.2" fill="#b8bdcc"/><path d="' + 'M' + (x - 11.5) + ' ' + (y - 11) + 'a2 2 0 1 0 .1 0" fill="#f2f2f2"/>',
        bag: '<path d="M' + (x - 3) + ' ' + (y + 2) + 'q3-6 6 0" stroke="#8a5a2b" stroke-width="1.4" fill="none"/><path d="M' + (x - 7) + ' ' + (y + 2) + 'h14l-1.4 15h-11.2z" fill="#d9a066"/><path d="M' + (x - 4) + ' ' + (y + 7) + 'q4 3 8 0" stroke="#8a5a2b" stroke-width="1" fill="none"/>',
        flowers: '<path d="M' + x + ' ' + (y + 2) + 'l-3-14M' + x + ' ' + (y + 2) + 'l0-15M' + x + ' ' + (y + 2) + 'l3-14" stroke="#2f7a55" stroke-width="1.3"/><circle cx="' + (x - 3) + '" cy="' + (y - 13) + '" r="3" fill="#e0559a"/><circle cx="' + x + '" cy="' + (y - 15) + '" r="3" fill="#f2c94c"/><circle cx="' + (x + 3) + '" cy="' + (y - 13) + '" r="3" fill="#8a5cf0"/>',
        icecream: '<path d="M' + (x - 3.5) + ' ' + (y - 4) + 'h7l-3.5 9z" fill="#d9a066"/><circle cx="' + x + '" cy="' + (y - 7) + '" r="4.4" fill="#f3a9b8"/><circle cx="' + (x + 1.4) + '" cy="' + (y - 10.4) + '" r="2.6" fill="#f4efe6"/>',
        balloon: '<g class="av-balloon"><path d="M' + x + ' ' + y + 'q-6 -20 4 -' + (up ? 30 : 46) + '" stroke="#b8bdcc" stroke-width=".8" fill="none"/><ellipse cx="' + (x + 4) + '" cy="' + (y - (up ? 40 : 56)) + '" rx="8" ry="10" fill="#e5484d"/><path d="M' + (x + 1) + ' ' + (y - (up ? 44 : 60)) + 'q1-3 3-3.6" stroke="rgba(255,255,255,.5)" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>',
        flag: '<path d="M' + x + ' ' + (y + 4) + 'v-' + (up ? 24 : 30) + '" stroke="#8a5a2b" stroke-width="1.4"/><g transform="translate(' + (x + .6) + ' ' + (y - (up ? 20 : 26)) + ')"><rect width="14" height="10" fill="#ba0c2f"/><path d="M4.2 0v10M0 5h14" stroke="#fff" stroke-width="3"/><path d="M4.2 0v10M0 5h14" stroke="#00205b" stroke-width="1.5"/></g>' }[H0] || ''; };
    var CR = L.aid === 'crutches';   /* with crutches the resting hands hold the grips (front: x 72 / 130, y 136) */
    var down = CR ? arm('M79 96c-8 10-9 24-7 40') + hand(72, 136) : arm('M79 96c-8 10-9 22-6 30') + hand(73, 128), arms = (CR ? arm('M123 96c8 10 9 24 7 40') + hand(130, 136) : arm('M123 96c8 10 9 22 6 30') + hand(129, 128)) + (L.watch === 'yes' ? '<rect x="' + (CR ? 126 : 125) + '" y="' + (CR ? 127 : 119) + '" width="8" height="4" rx="1.5" fill="#222" transform="rotate(' + q2(fAng.R - 90) + ' ' + (CR ? 130 : 129) + ' ' + (CR ? 136 : 128) + ')"/>' : '') + holdAt(CR ? 130 : 129, CR ? 136 : 128) + (L.tat === 'arm' && (top === 'tank' || bare) ? '<path d="M128.4 110.5l2.4-3 2.4 3-2.4 3z" fill="none" stroke="#2b3a55" stroke-width=".9"/><path d="M130.8 113.5v3" stroke="#2b3a55" stroke-width=".9"/>' : ''), armsL = down, prop = '', propL = '', behind = '', lamp = '', front = '';
    var watch = L.watch === 'yes' ? function (x, y) { return '<rect x="' + (x - 4) + '" y="' + (y - 7) + '" width="8" height="4" rx="1.5" fill="#222" transform="rotate(' + q2(fAng[cur] - 90) + ' ' + x + ' ' + y + ')"/>'; } : function () { return ''; };
    if (m.k === 'morning') { arms = arm('M123 96c8 6 12 12 12 18') + hand(135, 116) + watch(135, 116); prop = '<path d="M129 102h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#f4efe6"/><path d="M143 105h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#f4efe6" stroke-width="2"/><path class="steam" d="M133 98c-1-3 1-4 0-7M138 98c-1-3 1-4 0-7" stroke="#f4efe6" stroke-width="1.5" fill="none" opacity=".7"/>'; }
    if (m.k === 'rain') { arms = arm('M123 96c6-4 10-10 12-18') + hand(135, 78) + watch(135, 80); behind = '<path d="M74 38a44 30 0 0 1 88 0c-6-4-13-4-19 0-6-4-13-4-19 0-6-4-14-4-20 0-6-4-13-4-30 0z" fill="#e8743b"/><path d="M135 38v40" stroke="#ddd" stroke-width="2.2"/>'; }
    if (m.k === 'gym') { armsL = arm('M79 96c-10 4-16 0-20-8') + hand(59, 86) + '<rect x="49" y="84" width="20" height="4" rx="2" fill="#bbb"/><rect x="46" y="78" width="5" height="16" rx="1.5" fill="#666"/><rect x="67" y="78" width="5" height="16" rx="1.5" fill="#666"/>'; arms = arm('M123 96c10 4 16 0 20-8') + hand(143, 86); prop = '<rect x="133" y="84" width="20" height="4" rx="2" fill="#bbb"/><rect x="130" y="78" width="5" height="16" rx="1.5" fill="#666"/><rect x="151" y="78" width="5" height="16" rx="1.5" fill="#666"/>'; }
    if (m.k === 'trip') { arms = arm('M123 96c8 10 10 20 10 28') + hand(133, 126) + watch(133, 124); prop = '<path d="M133 126v-6" stroke="#999" stroke-width="2.5"/><rect x="129" y="128" width="34" height="28" rx="5" fill="#2f5d8a"/><circle cx="135" cy="158" r="2.5" fill="#111"/><circle cx="157" cy="158" r="2.5" fill="#111"/><rect x="151" y="132" width="16" height="10" rx="2" fill="#f2c94c"/><text x="159" y="140" font-size="7" font-weight="800" text-anchor="middle" fill="#333">' + (m.tag || '') + '</text>'; }
    if (m.k === 'day') { arms = arm('M123 96c8-4 12-12 12-22') + hand(135, 72) + watch(135, 72) + holdAt(135, 72, 1); }
    if (m.k === 'evening') { arms = arm('M123 96c8 6 12 12 12 18') + hand(135, 116); prop = '<path d="M129 102h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#c98500"/><path d="M143 105h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#c98500" stroke-width="2"/><path class="steam" d="M133 98c-1-3 1-4 0-7M138 98c-1-3 1-4 0-7" stroke="#f4efe6" stroke-width="1.5" fill="none" opacity=".7"/>'; lamp = '<path d="M22 54l10-16h14l10 16z" fill="#f6c85f"/><line x1="39" y1="54" x2="39" y2="160" stroke="#666" stroke-width="2.5"/><circle cx="39" cy="58" r="30" fill="#f6c85f" opacity=".12"/>'; }
    if (m.k === 'bday') { armsL = arm('M79 96c-4 10 0 18 10 20') + hand(89, 116); arms = arm('M123 96c4 10 0 18-10 20') + hand(113, 116); front = '<rect x="88" y="104" width="26" height="20" rx="2.5" fill="#d55181"/><rect x="99" y="104" width="4" height="20" fill="#f2c94c"/><path d="M95 102q6-8 6 2q0-10 6-2" stroke="#f2c94c" stroke-width="2.4" fill="none"/>'; }
    if (m.k === 'win') { armsL = arm('M79 96c-8-8-10-18-8-28') + hand(71, 66); arms = arm('M123 96c8-8 10-18 8-28') + hand(131, 66); front = '<g>' + ['#e8743b', '#f2c94c', '#14b8a6', '#d55181', '#3987e5'].map(function (c, i) { return '<rect x="' + (52 + i * 22) + '" y="' + (26 + (i % 2) * 14) + '" width="6" height="3" fill="' + c + '" transform="rotate(' + (i * 37) + ' ' + (55 + i * 22) + ' 30)"/>'; }).join('') + '</g>'; }
    /* together (Avatar.couple): R = this one stands on the left and reaches right, L = the other way */
    if (m.k === 'holdR') arms = arm('M123 96c9 8 16 18 22 28') + hand(145, 124);
    if (m.k === 'holdL') armsL = arm('M79 96c-9 8-16 18-22 28') + hand(57, 124);
    if (m.k === 'hi5R') arms = arm('M123 96c8-6 14-18 18-34') + hand(141, 62);
    if (m.k === 'hi5L') armsL = arm('M79 96c-8-6-14-18-18-34') + hand(61, 62);
    if (m.k === 'hugR') arms = arm('M123 96c10 2 18 6 22 14') + hand(145, 110);
    if (m.k === 'hugL') armsL = arm('M79 96c-10 2-18 6-22 14') + hand(57, 110);
    if (m.k === 'selfieR') { arms = arm('M123 96c10-6 18-18 20-30') + hand(143, 66); prop = '<g transform="rotate(-12 143 56)"><rect x="138.5" y="49" width="9" height="14" rx="1.8" fill="#b8bdcc"/><rect x="139.8" y="50.4" width="6.4" height="10.4" rx=".8" fill="#3987e5"/></g>'; }
    if (m.k === 'danceR' || m.k === 'danceL') { arms = arm('M123 96c8-6 12-16 10-30') + hand(133, 66); armsL = arm('M79 96c-8-6-12-16-10-30') + hand(69, 66); }
    if (m.k === 'cookR') { arms = arm('M123 96c8 6 12 12 14 20') + hand(137, 118); prop = '<path d="M137 120h8" stroke="#2b2f36" stroke-width="3" stroke-linecap="round"/><path d="M144 118h24q-1 7-12 7t-12-7z" fill="#2b2f36"/><circle cx="152" cy="117.4" r="2.4" fill="#f2c94c"/><circle cx="158" cy="118" r="2" fill="#e5484d"/><circle cx="163" cy="117.6" r="1.6" fill="#2fae6a"/><path class="steam" d="M150 112c-1-3 1-4 0-7M157 112c-1-3 1-4 0-7" stroke="#f4efe6" stroke-width="1.4" fill="none" opacity=".6"/>'; }
    if (m.k === 'cookL') { armsL = arm('M79 96c-8 6-12 12-14 18') + hand(65, 114) + '<path d="M65 114l-6 9" stroke="#c9a227" stroke-width="2" stroke-linecap="round"/><ellipse cx="58" cy="124.5" rx="2.4" ry="1.6" fill="#c9a227"/>'; }
    if (m.k === 'night') { arms = arm('M123 96c8 10 9 22 6 30') + hand(129, 128); prop = '<text class="z" x="122" y="40" font-size="14" font-weight="800" fill="#9a9ca5">z</text><text class="z" x="132" y="28" font-size="10" font-weight="800" fill="#9a9ca5">z</text>'; }
    var AID = L.aid || 'none';
    if (AID === 'arm') armsL = armsL.replace(new RegExp('stroke="' + AC.replace('#', '\\#') + '"', 'g'), 'stroke="#9aa3b2"').replace(new RegExp('stroke="' + shade(AC, -.3).replace('#', '\\#') + '"', 'g'), 'stroke="#6b7385"') + '<circle cx="77" cy="112" r="2.4" fill="#6b7385"/>';
    if (AID === 'crutches') front += '<g stroke="#9aa3b2" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M' + (72 + DX).toFixed(1) + ' 126L' + (66 + DX).toFixed(1) + ' 168M' + (130 - DX).toFixed(1) + ' 126L' + (136 - DX).toFixed(1) + ' 168"/><path d="M' + (68 + DX).toFixed(1) + ' 136h8M' + (126 - DX).toFixed(1) + ' 136h8" stroke-width="3.2"/></g>';
    /* head */
    var hx = 101, sleep = m.k === 'night' || !!m.closed;
    /* face shapes: round and long stretch the whole head (hair, hats, ears and glasses stretch with it, so they always fit);
       square and heart change only the jaw – the forehead and temples stay the oval's, so every hairstyle and hat sits the same */
    var FD = { square: 'M101 40c12.5 0 19 9 19 22v5c0 9-6.5 17-12 17h-14c-5.5 0-12-8-12-17v-5c0-13 6.5-22 19-22z', heart: 'M101 40c12.5 0 19 9 19 22 0 10-11.5 22-19 22s-19-12-19-22c0-13 6.5-22 19-22z' }[L.faceS] || 'M101 40c12.5 0 19 9 19 22s-8.5 22-19 22-19-9-19-22 6.5-22 19-22z';
    var HS = { round: [1.1, .98], long: [.92, 1.07], square: [1.04, 1], heart: [1.05, 1] }[L.faceS];
    /* ears sit behind the face (only the outer half shows), skin-coloured with a small inner curve – on top of the cheek they looked pasted on */
    var face = '<ellipse cx="82.5" cy="63" rx="3.5" ry="5" fill="' + shade(S, -.05) + '"/><ellipse cx="119.5" cy="63" rx="3.5" ry="5" fill="' + shade(S, -.05) + '"/><path d="M81.4 60.2q-2 2.8 0 5.6M120.6 60.2q2 2.8 0 5.6" stroke="' + S2 + '" stroke-width="1.1" fill="none" stroke-linecap="round"/><path class="av-faceshape" d="' + FD + '" fill="' + S + '"/>';
    if (L.earS === 'small') face = face.replace(/rx="3.5" ry="5"/g, 'rx="2.6" ry="3.7"');
    if (L.earS === 'big') face = face.replace(/rx="3.5" ry="5"/g, 'rx="5" ry="6.6"');
    if (L.earS === 'elf') face = face.replace('<ellipse cx="82.5" cy="63" rx="3.5" ry="5"', '<path d="M84 59l-8-9 3 14 4 4z"').replace('<ellipse cx="119.5" cy="63" rx="3.5" ry="5"', '<path d="M118 59l8-9-3 14-4 4z"');
    var hairBack = { long: '<path d="M80 60c-2-16 8-24 21-24s23 8 21 24v26c-4 4-8 0-8-6V62H88v18c0 6-4 10-8 6z" fill="' + H + '"/>',

      afro: '<circle cx="101" cy="52" r="28" fill="' + H + '"/>',
      mullet: '<path d="M81 60v22c0 6 5 8 9 5V64zM121 60v22c0 6-5 8-9 5V64z" fill="' + H + '"/>',
      ponytail: '<path d="M115 47q15 3 14 24-1 11-7 15 2-13-3-21-3-6-7-9z" fill="' + H + '"/>',
      braids: '<g fill="' + H + '">' + [62, 68, 74, 80, 86].map(function (y, i) { return '<ellipse cx="80" cy="' + y + '" rx="' + (3.6 - i * .2) + '" ry="3.4"/><ellipse cx="122" cy="' + y + '" rx="' + (3.6 - i * .2) + '" ry="3.4"/>'; }).join('') + '</g><circle cx="80" cy="90" r="1.8" fill="#e0559a"/><circle cx="122" cy="90" r="1.8" fill="#e0559a"/>',
      pigtails: '<circle cx="75" cy="58" r="8" fill="' + H + '"/><circle cx="127" cy="58" r="8" fill="' + H + '"/><circle cx="80.5" cy="56" r="2" fill="#2f9ee0"/><circle cx="121.5" cy="56" r="2" fill="#2f9ee0"/>',
      dreads: '<g fill="' + H + '">' + [79, 84, 89, 113, 118, 123].map(function (x, i) { return '<rect x="' + (x - 2.4) + '" y="48" width="4.8" height="' + (34 + (i % 3) * 5) + '" rx="2.4"/>'; }).join('') + '</g>' }[L.hair] || '';
    var hairTop = {
      short: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-1-6-4-10-8-12-6 3-16 3-23 0-3 3-5 7-6 12z" fill="' + H + '"/>',
      side: '<path d="M82 63c-3-18 7-27 20-27 14 0 20 10 18 24-8-8-20-12-30-8-4 2-6 6-8 11z" fill="' + H + '"/><path d="M94 38l-3 10" stroke="' + shade(H, .15) + '" stroke-width="1.3"/>',
      quiff: '<path d="M82 62c-2-14 4-21 12-23 0-6 8-9 15-6 8 3 12 10 10 29-2-7-5-11-9-12-6 3-15 3-21 0-3 3-5 7-7 12z" fill="' + H + '"/>',
      curly: '<g fill="' + H + '"><circle cx="86" cy="52" r="6.5"/><circle cx="94" cy="44" r="7"/><circle cx="104" cy="42" r="7.5"/><circle cx="113" cy="46" r="7"/><circle cx="118" cy="54" r="6"/><circle cx="83" cy="60" r="4.5"/><circle cx="120" cy="61" r="4.5"/></g>',
      buzz: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '" opacity=".75"/>',
      bald: '<path d="M88 46c6-4 16-4 22 0" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none" stroke-linecap="round"/>',
      long: '<path d="M81 63c-3-18 7-27 20-27 14 0 22 10 19 27-3-8-8-13-14-14-8 4-18 4-25 0z" fill="' + H + '"/>',
      bun: '<circle cx="101" cy="31" r="7" fill="' + H + '"/><path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-2-8-8-13-18-13s-16 5-19 13z" fill="' + H + '"/>',
      mohawk: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '" opacity=".35"/><path d="M95 47l-3-12 5 3 1-14 4 11 4-10 1 13 5-3-3 12q-7 2-14 0z" fill="' + H + '"/>',
      afro: '<path d="M82 60c4-7 11-10 19-10s15 3 19 10H127.8A28 28 0 1 0 74.2 60z" fill="' + H + '"/><g fill="' + shade(H, .12) + '" opacity=".5"><circle cx="84" cy="36" r="2"/><circle cx="118" cy="38" r="2"/><circle cx="101" cy="27" r="2"/></g>',
      spiky: '<path d="M82 61c-2-9 0-15 4-19l-2-8 7 4 3-9 5 7 4-9 4 8 6-6 0 9c5 4 7 11 5 23-3-8-10-12-19-12s-16 4-19 12z" fill="' + H + '"/>',
      mullet: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-1-6-4-10-8-12-6 3-16 3-23 0-3 3-5 7-6 12z" fill="' + H + '"/>',
      fade: '<path d="M82 62c-1-6 0-10 2-13 1 4 1 9-2 13zM120 62c1-6 0-10-2-13-1 4-1 9 2 13z" fill="' + H + '" opacity=".4"/><path d="M84 53c0-10 7-16 17-16s17 6 17 16c-5-4-11-5-17-5s-12 1-17 5z" fill="' + H + '"/><path d="M90 44l3-3M98 41l3-2M107 42l3-2" stroke="' + shade(H, .2) + '" stroke-width="1.1" stroke-linecap="round"/>',
      sideshave: '<path d="M82 62c-1-6 0-10 2-13 1 4 1 9-2 13z" fill="' + H + '" opacity=".3"/><path d="M85 53c2-10 9-16 18-16 10 0 17 6 17 25-3-6-7-10-12-11-8-1-15 0-23 2z" fill="' + H + '"/>',
      bangs: '<path d="M82 63c-3-18 7-27 19-27s22 9 19 27c-2-7-6-11-10-12-3 2-6 4-9 4s-6-2-9-4c-4 1-8 5-10 12z" fill="' + H + '"/><path d="M101 38v12" stroke="' + shade(H, -.3) + '" stroke-width="1.1"/>',
      bowl: '<path d="M80 59c0-14 9-22 21-22s21 8 21 22z" fill="' + H + '"/><path d="M80 59h42" stroke="' + shade(H, -.25) + '" stroke-width="1.2"/>',
      topknot: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '"/><circle cx="101" cy="34" r="5.4" fill="' + H + '"/><rect x="98" y="37.6" width="6" height="2.2" rx="1" fill="' + shade(H, -.35) + '"/>',
      cornrows: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '"/><path d="M89 43q2 6 2 12M95 40.5q1 7 1 13M101 39.6v14M107 40.5q-1 7-1 13M113 43q-2 6-2 12" stroke="' + shade(H, .3) + '" stroke-width="1.1" fill="none" stroke-dasharray="2 1.4"/>',
      ponytail: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-2-8-8-13-18-13s-16 5-19 13z" fill="' + H + '"/><circle cx="118" cy="48.5" r="2.4" fill="#e0559a"/>',
      braids: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-3-8-9-12-18-12s-15 4-19 12z" fill="' + H + '"/><path d="M101 38v9" stroke="' + shade(H, -.35) + '" stroke-width="1.2"/>',
      pigtails: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-3-8-9-12-18-12s-15 4-19 12z" fill="' + H + '"/><path d="M101 38v9" stroke="' + shade(H, -.35) + '" stroke-width="1.2"/>',
      undercut: '<path d="M82 62c-1-6 0-10 2-13 1 4 1 9-2 13zM120 62c1-6 0-10-2-13-1 4-1 9 2 13z" fill="' + H + '" opacity=".25"/><path d="M83 52c1-11 10-17 20-17 9 0 17 5 17 14-6-3-14-4-22-3-6 1-11 3-15 6z" fill="' + H + '"/>',
      slick: '<path d="M82 60c0-14 8-21 19-21s19 7 19 21c-4-7-11-10-19-10s-15 3-19 10z" fill="' + H + '"/><path d="M89 46q12-6 24 0M87 52q14-6 28 0" stroke="' + shade(H, .22) + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
      waves: '<path d="M82 61c-2-15 6-23 19-23s21 8 19 23c-1-4-4-7-7-8q-3 3-6 0q-3 3-6 0q-3 3-6 0q-3 3-6 0c-3 1-6 4-7 8z" fill="' + H + '"/><path d="M88 46q3-2 6 0t6 0 6 0 6 0" stroke="' + shade(H, .2) + '" stroke-width="1.1" fill="none"/>',
      dreads: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '"/><g fill="' + shade(H, .14) + '"><circle cx="90" cy="45" r="1.4"/><circle cx="98" cy="42" r="1.4"/><circle cx="106" cy="42" r="1.4"/><circle cx="113" cy="45" r="1.4"/></g>'
    }[L.hair] || '';
    var COVER = !L.oldCap && ['cap', 'beanie', 'bucket', 'beret', 'bandana', 'cowboy', 'santa', 'witch', 'chef', 'wizard'].indexOf(L.hat) >= 0 && m.k !== 'gym' && m.k !== 'night' && m.k !== 'trip';
    if (COVER && ['mohawk', 'spiky', 'quiff', 'topknot', 'bun', 'cornrows', 'waves', 'fade'].indexOf(L.hair) >= 0) hairTop = '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-1-6-4-10-8-12-6 3-16 3-23 0-3 3-5 7-6 12z" fill="' + H + '"/>';
    if (COVER && L.hair === 'afro') { hairBack = '<ellipse cx="101" cy="62" rx="26" ry="20" fill="' + H + '"/>'; hairTop = '<path d="M82 60c-1-12 7-20 19-20s20 8 19 20c-4-7-11-10-19-10s-15 3-19 10z" fill="' + H + '"/>'; }
    var hair2 = '';
    if (L.hair2 && L.hair !== 'bald' && L.hair !== 'buzz') hair2 = '<path d="M104 38.6q9 1.6 13 12l-3.4 1.4q-3.4-7.6-10-10.4z" fill="' + L.hair2 + '"/>';
    if (L.hairAge === 'grey') hair2 += '<path d="M82 62c-1-6 0-10 2-12 1 4 1 8-2 12zM120 62c1-6 0-10-2-12-1 4-1 8 2 12z" fill="#c4c4c4"/>';
    if (L.hairAge === 'receding' && L.hair !== 'bald') hair2 += '<path d="M87 43.5q4 6 5 13l-6.4 1q-2.2-8 1.4-14zM115 43.5q-4 6-5 13l6.4 1q2.2-8-1.4-14z" fill="' + S + '"/>';
    var brows = '<path d="M90 56q4-2.5 8 0M104 56q4-2.5 8 0" stroke="' + (L.hair === 'bald' ? shade(S, -.45) : H) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    var tired = m.mood === 'tired', meh = m.mood === 'ok';
    if (tired) brows = '<path d="M90 55.5q4 1.5 8 1.5M104 57q4 0 8-1.5" stroke="' + (L.hair === 'bald' ? shade(S, -.45) : H) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    var eyes = tired ? '<g><circle cx="94" cy="63" r="2" fill="#2b211b"/><circle cx="108" cy="63" r="2" fill="#2b211b"/><path d="M90.5 61.6h7M104.5 61.6h7" stroke="' + S + '" stroke-width="2.6" stroke-linecap="round"/><path d="M90.5 61.4q3.5-1 7 0M104.5 61.4q3.5-1 7 0" stroke="#2b211b" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M91 67q3 1.4 6 0M105 67q3 1.4 6 0" stroke="' + shade(S, -.28) + '" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>' : sleep ? '<path d="M91 62q3 2 6 0M105 62q3 2 6 0" stroke="#2b211b" stroke-width="2" fill="none" stroke-linecap="round"/>' : '<g class="eyes"><circle cx="94" cy="62" r="2.2" fill="#2b211b"/><circle cx="108" cy="62" r="2.2" fill="#2b211b"/></g>';
    var EX = tired || meh || sleep ? '' : L.expr || 'smile', EC = L.eyeC && L.eyeC !== '#2b211b' ? L.eyeC : '';
    var BC = L.hair === 'bald' ? shade(S, -.45) : H;
    if (EX === 'wink') eyes = '<g class="eyes"><circle cx="94" cy="62" r="2.2" fill="' + (EC || '#2b211b') + '"/></g><path d="M105 62.5q3-2.6 6 0" stroke="#2b211b" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (EX === 'calm') eyes = '<path d="M91 63q3-3 6 0M105 63q3-3 6 0" stroke="#2b211b" stroke-width="2" fill="none" stroke-linecap="round"/>';
    else if (EX === 'cool') eyes = '<g class="eyes"><path d="M91 62.5h6M105 62.5h6" stroke="#2b211b" stroke-width="2.6" stroke-linecap="round"/></g>';
    else if (EC && !tired && !sleep) eyes = '<g class="eyes"><circle cx="94" cy="62" r="2.3" fill="' + shade(EC, -.3) + '"/><circle cx="108" cy="62" r="2.3" fill="' + shade(EC, -.3) + '"/><circle cx="94.8" cy="61.2" r=".5" fill="rgba(255,255,255,.7)"/><circle cx="108.8" cy="61.2" r=".5" fill="rgba(255,255,255,.7)"/></g>';
    if (EX === 'laugh' || EX === 'shy' && false) eyes = '<path d="M91 63q3-3 6 0M105 63q3-3 6 0" stroke="#2b211b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    if (EX === 'silly') eyes = '<g class="eyes"><circle cx="94" cy="62" r="2.2" fill="' + (EC || '#2b211b') + '"/></g><path d="M105 62.5q3-2.6 6 0" stroke="#2b211b" stroke-width="2" fill="none" stroke-linecap="round"/>';
    if (EX === 'love') eyes = '<g fill="#e5484d"><path d="M94 66c-3.4-2.2-5-4.2-5-6 0-1.5 1.1-2.5 2.5-2.5 1.1 0 2 .6 2.5 1.5.5-.9 1.4-1.5 2.5-1.5 1.4 0 2.5 1 2.5 2.5 0 1.8-1.6 3.8-5 6z"/><path d="M108 66c-3.4-2.2-5-4.2-5-6 0-1.5 1.1-2.5 2.5-2.5 1.1 0 2 .6 2.5 1.5.5-.9 1.4-1.5 2.5-1.5 1.4 0 2.5 1 2.5 2.5 0 1.8-1.6 3.8-5 6z"/></g>';
    if (EX === 'starry') eyes = '<g fill="#f2c94c" stroke="#c98500" stroke-width=".6" stroke-linejoin="round"><path d="M94.0 57.8L95.1 60.5L98.0 60.7L95.8 62.6L96.5 65.4L94.0 63.9L91.5 65.4L92.2 62.6L90.0 60.7L92.9 60.5z"/><path d="M108.0 57.8L109.1 60.5L112.0 60.7L109.8 62.6L110.5 65.4L108.0 63.9L105.5 65.4L106.2 62.6L104.0 60.7L106.9 60.5z"/></g>';
    if (EX === 'shy') eyes = '<g class="eyes"><circle cx="93" cy="63.6" r="2" fill="' + (EC || '#2b211b') + '"/><circle cx="107" cy="63.6" r="2" fill="' + (EC || '#2b211b') + '"/></g>';
    var EYC = EC || '#2b211b';
    if (L.eyeS && L.eyeS !== 'round' && /class="eyes"/.test(eyes) && ['cool', 'wink', 'silly', 'shy'].indexOf(EX) < 0) {
      eyes = L.eyeS === 'almond' ? '<g class="eyes"><ellipse cx="94" cy="62" rx="3" ry="1.7" fill="' + EYC + '"/><ellipse cx="108" cy="62" rx="3" ry="1.7" fill="' + EYC + '"/><circle cx="94.8" cy="61.5" r=".55" fill="#fff"/><circle cx="108.8" cy="61.5" r=".55" fill="#fff"/></g>'
        : L.eyeS === 'big' ? '<g class="eyes"><circle cx="94" cy="62" r="2.9" fill="' + shade(EYC, -.2) + '"/><circle cx="108" cy="62" r="2.9" fill="' + shade(EYC, -.2) + '"/><circle cx="94.9" cy="61" r=".75" fill="rgba(255,255,255,.8)"/><circle cx="108.9" cy="61" r=".75" fill="rgba(255,255,255,.8)"/></g>'
        : '<g class="eyes"><circle cx="94" cy="62.6" r="2.1" fill="' + EYC + '"/><circle cx="108" cy="62.6" r="2.1" fill="' + EYC + '"/><path d="M90.8 61.2h6.4M104.8 61.2h6.4" stroke="' + S + '" stroke-width="2.4"/><path d="M90.8 61.6q3.2-1 6.4 0M104.8 61.6q3.2-1 6.4 0" stroke="#2b211b" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>';
    }
    var BW = { thick: 3.2, thin: 1.25 }[L.brows] || 2;
    if (!tired) { if (L.brows === 'arched') brows = '<path d="M89.5 57q4-5 9-1M103.5 56q5-4 9 1" stroke="' + BC + '" stroke-width="2" fill="none" stroke-linecap="round"/>'; else if (L.brows === 'uni') brows = '<path d="M89.5 56.5q5.5-3 11 0 5.5-3 11 0" stroke="' + BC + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; else if (BW !== 2) brows = brows.replace('stroke-width="2"', 'stroke-width="' + BW + '"'); }
    if (EX === 'shy') brows = '<path d="M90 55.5q4 1 8-.5M104 55q4 1.5 8 .5" stroke="' + BC + '" stroke-width="' + BW + '" fill="none" stroke-linecap="round"/>';
    if (EX === 'wow') brows = '<path d="M90 53.5q4-3 8 0M104 53.5q4-3 8 0" stroke="' + BC + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    if (EX === 'cool') brows = '<path d="M90 56q4-1.5 8 0M104 54q4-3 8-.5" stroke="' + BC + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    var DT = L.lines || 'none', TT = L.tat || 'none', PI = L.pierce || 'none';
    var extraFace = (DT === 'dimples' || DT === 'both' ? '<path d="M93.5 72.5q-1 1.2-.4 2.4M108.5 72.5q1 1.2.4 2.4" stroke="' + shade(S, -.3) + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>' : '') +
      (DT === 'wrinkles' || DT === 'both' ? '<path d="M93 50q8-2 16 0M95 47.6q6-1.4 12 0M89.5 64.5l-2 .8M89.6 66.4l-2 .1M112.5 64.5l2 .8M112.4 66.4l2 .1" stroke="' + shade(S, -.25) + '" stroke-width=".9" fill="none" stroke-linecap="round"/>' : '') +
      (TT === 'face' ? '<path d="M114.5 64c-1.7-1.1-2.5-2.1-2.5-3 0-.75.55-1.25 1.25-1.25.55 0 1 .3 1.25.75.25-.45.7-.75 1.25-.75.7 0 1.25.5 1.25 1.25 0 .9-.8 1.9-2.5 3z" fill="none" stroke="#2b3a55" stroke-width=".8"/>' : '') +
      (TT === 'neck' ? '<path d="M105.5 82.1L106.1 83.6L107.8 83.8L106.5 84.8L106.9 86.4L105.5 85.6L104.1 86.4L104.5 84.8L103.2 83.8L104.9 83.6z" fill="none" stroke="#2b3a55" stroke-width=".9"/>' : '');
    var pierce = PI === 'nose' ? '<circle cx="103.6" cy="68.4" r="1.6" fill="none" stroke="#c9ccd6" stroke-width=".9"/>'
      : PI === 'brow' ? '<circle cx="111.6" cy="53.6" r=".9" fill="#c9ccd6"/><circle cx="112.4" cy="56.2" r=".9" fill="#c9ccd6"/>'
      : PI === 'lip' ? '<circle cx="104" cy="76.2" r="1.8" fill="none" stroke="#c9ccd6" stroke-width="1"/>'
      : PI === 'septum' ? '<path d="M99.4 69.4q1.6 2.6 3.2 0" stroke="#c9ccd6" stroke-width="1.1" fill="none"/>' : '';
    var cheeks = (EX === 'shy' && L.cheeks !== 'blush' && L.cheeks !== 'both' ? '<ellipse cx="88.5" cy="69" rx="3.6" ry="2.1" fill="#ff6b81" opacity=".45"/><ellipse cx="113.5" cy="69" rx="3.6" ry="2.1" fill="#ff6b81" opacity=".45"/>' : '') +
      (L.makeup === 'lashes' || L.makeup === 'both' ? '<path d="M90.6 60.6l-2.2-1.4M91.2 59.4l-1.6-2M111.4 60.6l2.2-1.4M110.8 59.4l1.6-2" stroke="#2b211b" stroke-width="1" stroke-linecap="round"/>' : '') +
      ({ mole: '<circle cx="111.5" cy="71" r="1" fill="' + shade(S, -.55) + '"/>', star: '<path d="M112.5 66.4L113.2 68.1L115.0 68.2L113.6 69.4L114.0 71.1L112.5 70.2L111.0 71.1L111.4 69.4L110.0 68.2L111.8 68.1z" fill="#f2c94c"/>', heart: '<path d="M89 72c-2.3-1.5-3.4-2.9-3.4-4.1 0-1 .8-1.7 1.7-1.7.7 0 1.3.4 1.7 1 .4-.6 1-1 1.7-1 .9 0 1.7.7 1.7 1.7 0 1.2-1.1 2.6-3.4 4.1z" fill="#e5484d"/>', plaster: '<g transform="rotate(-25 113 52)"><rect x="107" y="50" width="12" height="4.4" rx="2.2" fill="#f0c9a0"/><rect x="111" y="50" width="4" height="4.4" fill="#e3b48a"/></g>' }[L.mark] || '') +
      (L.cheeks === 'blush' || L.cheeks === 'both' ? '<ellipse cx="88.5" cy="69" rx="3.6" ry="2.1" fill="#ff6b81" opacity=".33"/><ellipse cx="113.5" cy="69" rx="3.6" ry="2.1" fill="#ff6b81" opacity=".33"/>' : '') +
      (L.cheeks === 'freckles' || L.cheeks === 'both' ? '<g fill="' + shade(S, -.38) + '"><circle cx="91" cy="67" r=".75"/><circle cx="94" cy="68.6" r=".75"/><circle cx="89" cy="69.4" r=".7"/><circle cx="108" cy="68.6" r=".75"/><circle cx="111" cy="67" r=".75"/><circle cx="113" cy="69.4" r=".7"/></g>' : '');
    var nose = '<path d="M101 64c-1.6 3-2 5 .6 5.6" stroke="' + S2 + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    if (L.nose === 'button') nose = '<ellipse cx="101" cy="67.5" rx="2.4" ry="1.8" fill="' + S2 + '"/>';
    if (L.nose === 'pointy') nose = '<path d="M101 62l-3.2 7.6h3.6" stroke="' + S2 + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    if (L.nose === 'wide') nose = '<path d="M97 68.6q4 2.4 8 0M98 65q-1.6 3.4-1 3.6M104 65q1.6 3.4 1 3.6" stroke="' + S2 + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    var mouth = tired ? '<path d="M97 74.5q2-1.6 4 0t4 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : meh ? '<path d="M96.5 73q4.5 2.4 9 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : sleep ? '<path d="M98 74q3 1.5 6 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : '<path d="M95 72q6 6 12 0" fill="#fff" stroke="#8a4636" stroke-width="1.8" stroke-linejoin="round"/>';
    if (EX === 'grin') mouth = '<path d="M93.5 71h15q-1 8-7.5 8t-7.5-8z" fill="#5a2a22" stroke="#8a4636" stroke-width="1.4" stroke-linejoin="round"/><path d="M94.5 71.2h13v2.2h-13z" fill="#fff"/><path d="M98 77q3-2 6 0" fill="#e06b6b"/>';
    if (EX === 'wink' || EX === 'cool') mouth = '<path d="M96 73.5q6 3 11-1.5" stroke="#8a4636" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
    if (EX === 'calm') mouth = '<path d="M96.5 72.5q4.5 3.4 9 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    if (EX === 'laugh' || EX === 'starry') mouth = '<path d="M93 70h16q-1 9.5-8 9.5t-8-9.5z" fill="#5a2a22" stroke="#8a4636" stroke-width="1.4" stroke-linejoin="round"/><path d="M94 70.2h14v2.2H94z" fill="#fff"/><path d="M97.5 77.5q3.5-2.4 7 0" fill="#e06b6b"/>';
    if (EX === 'silly') mouth = '<path d="M95 72q6 4 12 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M99.5 73.5h5v3.4a2.5 2.5 0 0 1-5 0z" fill="#e06b6b"/>';
    if (EX === 'love') mouth = '<path d="M95 72q6 5 12 0" fill="#fff" stroke="#8a4636" stroke-width="1.8" stroke-linejoin="round"/>';
    if (EX === 'shy') mouth = '<path d="M98.5 73.6q2.5 1.6 5 0" stroke="#8a4636" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
    if (L.makeup === 'lips' || L.makeup === 'both') mouth = mouth.replace(/#8a4636/g, '#c2185b').replace('fill="none" stroke="#c2185b" stroke-width="1.8"', 'fill="none" stroke="#c2185b" stroke-width="2.6"');
    if (EX === 'wow') mouth = '<ellipse cx="101" cy="74" rx="3" ry="3.8" fill="#5a2a22"/>';
    var beard = { none: '', goatee: '<path d="M96 77q5 3 10 0l-1 6q-4 3-8 0z" fill="' + H + '"/><path d="M95 70.5q6-3 12 0" stroke="' + H + '" stroke-width="2" fill="none" stroke-linecap="round"/>', stubble: '<path d="M84 66c2 12 9 18 17 18s15-6 17-18c-3 6-9 9-17 9s-14-3-17-9z" fill="' + H + '" opacity=".22"/>',
      short: '<path d="M84 64c1 14 9 21 17 21s16-7 17-21c-2 5-6 8-9 8-2-2-5-3-8-3s-6 1-8 3c-3 0-7-3-9-8z" fill="' + H + '"/>',
      full: '<path d="M82 60c0 18 8 29 19 29s19-11 19-29c-2 8-6 12-10 12-2-2-5-3-9-3s-7 1-9 3c-4 0-8-4-10-12z" fill="' + H + '"/>',
      moustache: '<path d="M94 70.5q7-4 14 0q-3.5 2-7 .6-3.5 1.4-7-.6z" fill="' + H + '"/>',
      chinstrap: '<path d="M83 63c1.5 13 9 21 18 21s16.5-8 18-21l-2.4.4c-1.6 10-8 16.2-15.6 16.2s-14-6.2-15.6-16.2z" fill="' + H + '"/>',
      handlebar: '<path d="M93.5 70.5q3.5-3 7.5-1 4-2 7.5 1 3 1.4 4.4-2.8.6 6.4-4.8 5.4-4-2-7.1-1.2-3.1-.8-7.1 1.2-5.4 1-4.8-5.4 1.4 4.2 4.4 2.8z" fill="' + H + '"/>',
      curled: '<path d="M101 70q-5-2.5-9 0-2.5 1.5-3.5-.5 0 4 4 3.2 4-1 8.5-1.2 4.5.2 8.5 1.2 4 .8 4-3.2-1 2-3.5.5-4-2.5-9 0z" fill="' + H + '"/>' }[L.beard] || '';
    var mouthOver = L.beard === 'short' || L.beard === 'full' ? (sleep ? '' : tired || meh || (EX && EX !== 'smile') ? mouth : '<path d="M96 73q5 4 10 0" fill="#fff" stroke="#8a4636" stroke-width="1.6"/>') : mouth;
    var GL = W.sun && L.glasses === 'none' && m.k !== 'night' && m.k !== 'trip' ? 'sun' : L.glasses;
    var glasses = GL === 'round' ? '<g fill="rgba(255,255,255,.08)" stroke="#1d1d1d" stroke-width="1.5"><circle cx="94" cy="62" r="5"/><circle cx="108" cy="62" r="5"/><path d="M99 62h4M89 61l-6-2M113 61l6-2" fill="none"/></g>'
      : L.glasses === 'sun' ? '<g><path d="M86 58.5h13v4.5c0 2.5-2 4-4.5 4h-4c-2.5 0-4.5-1.5-4.5-4z" fill="#141414"/><path d="M103 58.5h13v4.5c0 2.5-2 4-4.5 4h-4c-2.5 0-4.5-1.5-4.5-4z" fill="#141414"/><path d="M99 60h4M86 59.5l-4-1.5M116 59.5l4-1.5" stroke="#141414" stroke-width="1.6"/><path d="M88.5 60.5l3 0M105.5 60.5l3 0" stroke="rgba(255,255,255,.4)" stroke-width="1.2" stroke-linecap="round"/></g>'
      : GL === 'aviator' ? '<path d="M86 58h12c1 6-2 10-6 10s-7-4-6-10zM104 58h12c1 6-2 10-6 10s-7-4-6-10z" fill="#39414f" stroke="#c9a227" stroke-width="1.2"/><path d="M98 59h6M86 59l-4-1.5M116 59l4-1.5" stroke="#c9a227" stroke-width="1.2"/><path d="M88.5 60.5l2.5 0M106.5 60.5l2.5 0" stroke="rgba(255,255,255,.45)" stroke-width="1.1" stroke-linecap="round"/>'
      : GL === 'cateye' ? '<g fill="rgba(255,255,255,.1)" stroke="#c2185b" stroke-width="1.7" stroke-linejoin="round"><path d="M85.5 56.5l13.5 2v4q-1 4-6 4t-6.5-4z"/><path d="M116.5 56.5l-13.5 2v4q1 4 6 4t6.5-4z"/></g><path d="M99 60h4" stroke="#c2185b" stroke-width="1.7"/>'
      : GL === 'hearts' ? '<g fill="#e5484d" stroke="#a5202a" stroke-width=".8"><path d="M93.5 67.5c-4.6-3-7-5.6-7-8 0-2 1.5-3.4 3.4-3.4 1.6 0 2.8.9 3.6 2.1.8-1.2 2-2.1 3.6-2.1 1.9 0 3.4 1.4 3.4 3.4 0 2.4-2.4 5-7 8z"/><path d="M108.5 67.5c-4.6-3-7-5.6-7-8 0-2 1.5-3.4 3.4-3.4 1.6 0 2.8.9 3.6 2.1.8-1.2 2-2.1 3.6-2.1 1.9 0 3.4 1.4 3.4 3.4 0 2.4-2.4 5-7 8z"/></g><path d="M100 59h2M86.5 59l-4-1.5M115.5 59l4-1.5" stroke="#a5202a" stroke-width="1.3"/>'
      : GL === 'stars' ? '<g fill="#f2c94c" stroke="#c98500" stroke-width=".9" stroke-linejoin="round"><path d="M94.0 55.6L95.9 59.4L100.1 60.0L97.0 63.0L97.8 67.2L94.0 65.2L90.2 67.2L91.0 63.0L87.9 60.0L92.1 59.4z"/><path d="M108.0 55.6L109.9 59.4L114.1 60.0L111.0 63.0L111.8 67.2L108.0 65.2L104.2 67.2L105.0 63.0L101.9 60.0L106.1 59.4z"/></g><path d="M100 61h2M88 59.5l-5-1.5M114 59.5l5-1.5" stroke="#c98500" stroke-width="1.3"/>'
      : GL === 'monocle' ? '<circle cx="108" cy="62" r="5.6" fill="rgba(255,255,255,.1)" stroke="#c9a227" stroke-width="1.5"/><path d="M113.2 64.5q4 9-1.5 20" stroke="#c9a227" stroke-width=".8" fill="none"/>'
      : L.glasses === 'square' ? '<g fill="rgba(255,255,255,.08)" stroke="#1d1d1d" stroke-width="1.5"><rect x="88" y="58" width="11" height="8" rx="2"/><rect x="103" y="58" width="11" height="8" rx="2"/><path d="M99 61h4M88 61l-5-2M114 61l5-2" fill="none"/></g>' : '';
    var hat = '';
    if (m.k === 'gym') hat = '<path d="M82 52q19-8 38 0v5q-19-8-38 0z" fill="#e8743b"/>';
    else if (m.k === 'night') hat = '<path d="M80 56q6-28 24-26 17 2 17 24-19-12-41 2z" fill="#3b4d8a"/><circle cx="123" cy="50" r="4.5" fill="#e9edf5"/>';
    else if (m.k === 'trip') hat = '<rect x="87" y="58" width="13" height="8" rx="3" fill="#111"/><rect x="102" y="58" width="13" height="8" rx="3" fill="#111"/><path d="M100 61h2" stroke="#111" stroke-width="2"/>';
    else if (L.hat && L.hat !== 'none') { var HC = L.hatC || shade(T, -.1);
      hat = { cap: '<path d="M81 56c0-12 9-19 20-19s20 7 20 19z" fill="' + HC + '"/><path d="M118 55h14q2 0 0 3h-14z" fill="' + (L.hatC ? shade(HC, -.25) : shade(T, -.25)) + '"/>',
        beanie: '<path d="M81 56c0-13 9-21 20-21s20 8 20 21z" fill="' + HC + '"/><path d="M80.5 51h41v5h-41z" fill="' + shade(HC, -.18) + '"/><path d="M86 51v5M92 51v5M98 51v5M104 51v5M110 51v5M116 51v5" stroke="' + shade(HC, -.32) + '" stroke-width="1"/><circle cx="101" cy="33" r="5" fill="' + shade(HC, .4) + '"/>',
        bucket: '<path d="M81.5 54c0-12 8.5-18.5 19.5-18.5s19.5 6.5 19.5 18.5z" fill="' + HC + '"/><path d="M73 53q28-7 56 0l-3 4.6q-25-6-50 0z" fill="' + shade(HC, -.15) + '"/>',
        phones: '<path d="M80 63c-3-20 8-30 21-30s24 10 21 30" stroke="#232323" stroke-width="3.6" fill="none" stroke-linecap="round"/><rect x="75.5" y="56" width="8" height="14" rx="3.5" fill="' + HC + '"/><rect x="118.5" y="56" width="8" height="14" rx="3.5" fill="' + HC + '"/>',
        beret: '<ellipse cx="98" cy="44" rx="21" ry="7.5" fill="' + HC + '" transform="rotate(-9 98 44)"/><path d="M95 37q1-3 3-3" stroke="' + HC + '" stroke-width="2" fill="none" stroke-linecap="round"/>',
        cowboy: '<g transform="translate(0 -2.5)"><path d="M87 49c0-9 2-14 6-14 3 0 5 2 8 2s5-2 8-2c4 0 6 5 6 14z" fill="' + HC + '"/><path d="M87 46h28v3H87z" fill="' + shade(HC, -.3) + '"/><path d="M72 49q29 6 58 0-2 7-10 7-19-2-38 0-8 0-10-7z" fill="' + shade(HC, -.08) + '"/></g>',
        party: '<path d="M101 16l-12 30h24z" fill="' + HC + '"/><path d="M97.6 24.6l7-1.4M94.6 32l12.8-2.6M91.6 39.6l18.6-3.6" stroke="#f2c94c" stroke-width="2.2"/><circle cx="101" cy="16" r="3.2" fill="#f2c94c"/>',
        bandana: '<path d="M81 55c1-12 9-19 20-19s19 7 20 19q-20-7-40 0z" fill="' + HC + '"/><g fill="#f2f2f2"><circle cx="90" cy="46" r="1.1"/><circle cx="98" cy="42" r="1.1"/><circle cx="106" cy="43" r="1.1"/><circle cx="113" cy="48" r="1.1"/><circle cx="97" cy="50" r="1.1"/><circle cx="106" cy="50" r="1.1"/></g><path d="M119 52l8-4-1.5 7zM119 52l7 3-5 3z" fill="' + shade(HC, -.15) + '"/>',
        wizard: '<path d="M81.5 53c0-11 8.5-17 19.5-17s19.5 6 19.5 17z" fill="' + HC + '"/><path d="M86 51l17-33 11 33z" fill="' + HC + '"/><path d="M78 52q23-8 46 0l-2 4.5q-21-6.5-42 0z" fill="' + shade(HC, -.2) + '"/><path d="M98.0 38.8L98.8 40.8L101.0 41.0L99.4 42.4L99.9 44.6L98.0 43.4L96.1 44.6L96.6 42.4L95.0 41.0L97.2 40.8z" fill="#f2c94c"/><circle cx="105" cy="31" r="1.2" fill="#f2c94c"/>',
        flowers: [[84, 47, '#e0559a'], [91, 42, '#f2f2f2'], [101, 40, '#f2c94c'], [111, 42, '#e0559a'], [118, 47, '#8a5cf0']].map(function (f) { return '<g transform="translate(' + f[0] + ' ' + f[1] + ')"><circle cx="0" cy="-2.6" r="2.2" fill="' + f[2] + '"/><circle cx="2.5" cy="-.8" r="2.2" fill="' + f[2] + '"/><circle cx="1.5" cy="2.1" r="2.2" fill="' + f[2] + '"/><circle cx="-1.5" cy="2.1" r="2.2" fill="' + f[2] + '"/><circle cx="-2.5" cy="-.8" r="2.2" fill="' + f[2] + '"/><circle r="1.4" fill="#f2a024"/></g>'; }).join(''),
        santa: '<path d="M80 55c2-16 12-23 23-22 9 1 15 8 18 14l6 9-7 1c-2-4-5-7-8-9-9-4-22-2-32 7z" fill="#d93a3a"/><path d="M79 52q22-8 43 2l-1 6q-21-9-41-1z" fill="#f4f4f4"/><circle cx="127" cy="64" r="4" fill="#f4f4f4"/>',
        witch: '<path d="M81.5 52c0-11 8.5-17 19.5-17s19.5 6 19.5 17z" fill="#22252e"/><path d="M86 50l14-30 4 4 10 26z" fill="#22252e"/><path d="M74 51q27-8 54 0l-3 5q-24-6-48 0z" fill="#2b2f36"/><path d="M88 46q13-3 25 0v3q-12-3-25 0z" fill="#8a5cf0"/>',
        chef: '<path d="M81.5 51c0-10 8.5-15 19.5-15s19.5 5 19.5 15z" fill="#f4f4f4"/><path d="M86 50v-6c-7-1-8-12 0-13 1-6 10-8 15-3 5-5 14-3 15 3 8 1 7 12 0 13v6z" fill="#f4f4f4"/><path d="M86 47h30" stroke="#d8dce4" stroke-width="1.4"/>',
        crown: '<path d="M87 42l2-12 6 6 6-9 6 9 6-6 2 12z" fill="#f2c94c" stroke="#c98500" stroke-width="1" stroke-linejoin="round"/><circle cx="101" cy="37" r="1.6" fill="#e5484d"/><circle cx="92" cy="39" r="1.2" fill="#3987e5"/><circle cx="110" cy="39" r="1.2" fill="#3987e5"/>' }[L.hat] || ''; }
    if (W.santa && m.k !== 'night' && m.k !== 'gym') hat = '<path d="M80 55c2-16 12-23 23-22 9 1 15 8 18 14l6 9-7 1c-2-4-5-7-8-9-9-4-22-2-32 7z" fill="#d93a3a"/><path d="M79 52q22-8 43 2l-1 6q-21-9-41-1z" fill="#f4f4f4"/><circle cx="127" cy="64" r="4" fill="#f4f4f4"/>';
    else if (W.snow && !hat && m.k !== 'night') hat = '<path d="M81 56c0-13 9-20 20-20s20 7 20 20z" fill="#2f5d8a"/><path d="M80 55h42v5H80z" fill="#244a6e"/><circle cx="101" cy="34" r="4" fill="#e9edf5"/>';
    if (W.stress && m.k !== 'night') hat += '<path class="av-sweat" d="M122 50q3 5 0 7q-3-2 0-7z" fill="#7cc4ff"/>';
    if (W.ribbon) front += '<g transform="translate(112 99)"><path d="M0 0l-6-3v6zM0 0l6-3v6z" fill="#ba0c2f"/><circle r="1.7" fill="#fff"/><path d="M-1 1l-2 6M1 1l2 6" stroke="#00205b" stroke-width="1.6"/></g>';
    if (W.rain && m.k !== 'rain' && m.k !== 'night') behind += '<g class="av-umb"><path d="M44 36q27-28 54 0q-7-5-13.5 0q-7-5-13.5 0q-7-5-13.5 0q-7-5-13.5 0z" fill="#3987e5"/><line x1="71" y1="36" x2="71" y2="124" stroke="#2b2f36" stroke-width="2"/><path d="M71 124q0 6-5 6" stroke="#2b2f36" stroke-width="2" fill="none"/></g>';
    var buds = L.ears === 'studs' ? '<circle cx="82.5" cy="68.5" r="1.5" fill="#f2c94c"/><circle cx="119.5" cy="68.5" r="1.5" fill="#f2c94c"/>' : L.ears === 'hoops' ? '<circle cx="82.5" cy="71.5" r="3" fill="none" stroke="#f2c94c" stroke-width="1.3"/><circle cx="119.5" cy="71.5" r="3" fill="none" stroke="#f2c94c" stroke-width="1.3"/>' : L.ears === 'buds' ? '<circle cx="82" cy="65" r="2.2" fill="#f2f2f2"/><circle cx="120" cy="65" r="2.2" fill="#f2f2f2"/>' : '';
    if (AID === 'hearing') buds += '<path d="M120.5 57.5q4.4 1 3.8 6.6l-1.8 3.4" stroke="#d9c7a8" stroke-width="2.8" fill="none" stroke-linecap="round"/>';
    /* the neck in skin colour, a little wider at the bottom, with a soft shadow under the chin (a dark block looked stuck on) */
    var neck = (MU ? '<path d="M93 77h16l3 13H90z" fill="' + S + '"/>' : '<path d="M95.4 77h11.2l1 13h-13.2z" fill="' + S + '"/>') + '<path d="M95.2 83q5.8 3.4 11.6 0v2.6q-5.8 2.8-11.6 0z" fill="' + S2 + '" opacity=".7"/>';
    if (L.faceS === 'heart' && beard) { var bcid = 'avb' + (++UID); beard = '<defs><clipPath id="' + bcid + '"><path d="' + FD + '"/><path d="M93 78h16l-2 14h-12z"/></clipPath></defs><g clip-path="url(#' + bcid + ')">' + beard + '</g>'; }
    var head = '<g class="bob">' + (HS ? '<g transform="translate(101 62) scale(' + HS[0] + ' ' + HS[1] + ') translate(-101 -62)">' : '') + hairBack + neck + face + '<g class="av-feat">' + cheeks + extraFace + beard + brows + eyes + nose + mouthOver + pierce + '</g><g class="av-hairf">' + hairTop + hair2 + '</g><g class="av-feat">' + (m.k === 'trip' ? '' : glasses) + '</g>' + hat + buds + (HS ? '</g>' : '') + '</g>';
    /* longer legs: the upper body sits 9 px higher, the legs are stretched to meet it */
    var body = '<g transform="translate(101 -9) scale(' + SX + ' 1) translate(-101 0)">' + torso + '<g class="av-chest">' + detail + extra + '</g></g>';
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
    if (tired) prop += '<text class="z" x="124" y="40" font-size="13" font-weight="800" fill="#9a9ca5">z</text><text class="z" x="133" y="29" font-size="9" font-weight="800" fill="#9a9ca5">z</text>';
    if (m.k === 'day' || m.k === 'win') arms = '<g class="av-wave">' + arms + '</g>';
    /* every part that moves sits in its own group (CSS animates the group, the SVG transform stays on the parent);
       --rx/--lx are the shoulders in picture coordinates, so arms swing from the right place on every body type */
    if (L.pet === 'bird') { var bx = 101 + 22 * SX; front += '<g class="av-pet" transform="translate(' + bx.toFixed(1) + ' 81)"><path d="M-5 2l-6 3 6-1z" fill="' + shade(L.petC || '#2f9ee0', -.25) + '"/><ellipse cx="0" cy="0" rx="6" ry="4.6" fill="' + (L.petC || '#2f9ee0') + '"/><circle cx="4" cy="-4.4" r="3.4" fill="' + (L.petC || '#2f9ee0') + '"/><path d="M7 -4.8l3.2 1.2-3.2 1z" fill="#f2a024"/><circle cx="5" cy="-5.2" r=".8" fill="#1a1a1a"/><path d="M-2 0q2 3 5 0" stroke="' + shade(L.petC || '#2f9ee0', .3) + '" stroke-width="1.2" fill="none"/></g>'; }
    var HT = L.height === 'short' ? 'translate(101 160) scale(.9) translate(-101 -160)' : L.height === 'tall' ? 'translate(101 160) scale(1.08) translate(-101 -160)' : '';
    var WS = AID === 'chair' ? 14 : 0, chair = '';
    if (WS) { legs = '<g transform="translate(0 160) scale(1 .5) translate(0 -160)">' + legs + '</g>';
      behind += '<path d="M78 70v58M124 70v58" stroke="#3a3f4a" stroke-width="3" stroke-linecap="round"/>';
      chair = '<g fill="none" stroke="#3a3f4a"><circle cx="' + (70 + DX * .4).toFixed(1) + '" cy="142" r="18" stroke-width="3.2"/><circle cx="' + (132 - DX * .4).toFixed(1) + '" cy="142" r="18" stroke-width="3.2"/><circle cx="' + (70 + DX * .4).toFixed(1) + '" cy="142" r="14.5" stroke="#9aa3b2" stroke-width="1"/><circle cx="' + (132 - DX * .4).toFixed(1) + '" cy="142" r="14.5" stroke="#9aa3b2" stroke-width="1"/></g><circle cx="' + (70 + DX * .4).toFixed(1) + '" cy="142" r="2.4" fill="#9aa3b2"/><circle cx="' + (132 - DX * .4).toFixed(1) + '" cy="142" r="2.4" fill="#9aa3b2"/><path d="M84 156h34" stroke="#3a3f4a" stroke-width="2.4" stroke-linecap="round"/>'; }
    var rx = (123 - DX).toFixed(1), lx = (79 + DX).toFixed(1);
    /* L1: what a stretched hand holds outside its arm group moves with the hand; the open .av-hand groups are closed */
    var closeHand = function (x) { return x + new Array(((x || '').match(/class="av-hand"/g) || []).length + 1).join('</g>'); };
    if (!KEEP && /^(morning|evening|selfieR)$/.test(m.k || '')) prop = '<g transform="translate(' + q2(shift.R[0]) + ' ' + q2(shift.R[1]) + ')">' + prop + '</g>';
    var propG = '<g transform="translate(' + (-DX).toFixed(1) + ' ' + (m.k === 'trip' ? 0 : -9) + ')"><g class="av-prop">' + prop + '</g></g>';
    /* the neck: behind the collar and the chin */
    var neck = '<g class="av-neck" transform="translate(0 -9)"><path d="M97 78h8v14q-4 2.4-8 0z" fill="' + shade(S, -.07) + '"/></g>';
    var PC = L.petC || (L.pet === 'dog' ? '#c9935a' : '#f2a65a'), pet = L.pet === 'cat' ? '<g class="av-pet"><path class="av-tail" d="M52 150q8-8 6-20" stroke="' + PC + '" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="42" cy="151" rx="11" ry="7.5" fill="' + PC + '"/><circle cx="31" cy="141" r="7" fill="' + PC + '"/><path d="M25.5 137l1-7 5 4zM36.5 137l-1-7-5 4z" fill="' + PC + '"/><circle cx="28.5" cy="141" r="1" fill="#1a1a1a"/><circle cx="33.5" cy="141" r="1" fill="#1a1a1a"/><path d="M30 144q1 1 2 0" stroke="#1a1a1a" stroke-width=".8" fill="none"/><rect x="34" y="154" width="3" height="5" rx="1.5" fill="' + PC + '"/><rect x="46" y="154" width="3" height="5" rx="1.5" fill="' + PC + '"/></g>'
      : L.pet === 'bunny' ? '<g class="av-pet"><ellipse cx="42" cy="152" rx="10" ry="7" fill="' + (L.petC || '#e9e4dc') + '"/><circle cx="52" cy="150" r="2.6" fill="#ffffff"/><ellipse cx="28" cy="132" rx="2.2" ry="7" fill="' + (L.petC || '#e9e4dc') + '" transform="rotate(-10 28 132)"/><ellipse cx="34.5" cy="131.5" rx="2.2" ry="7" fill="' + (L.petC || '#e9e4dc') + '" transform="rotate(8 34.5 131.5)"/><ellipse cx="28" cy="132" rx="1" ry="4.6" fill="#f3a9b8" transform="rotate(-10 28 132)"/><ellipse cx="34.5" cy="131.5" rx="1" ry="4.6" fill="#f3a9b8" transform="rotate(8 34.5 131.5)"/><circle cx="31" cy="143" r="6.4" fill="' + (L.petC || '#e9e4dc') + '"/><circle cx="29" cy="142" r="1" fill="#1a1a1a"/><circle cx="33.4" cy="142" r="1" fill="#1a1a1a"/><circle cx="31.2" cy="145" r=".9" fill="#f3a9b8"/></g>'
      : L.pet === 'dog' ? '<g class="av-pet"><path class="av-tail" d="M55 145q6-6 5-12" stroke="' + PC + '" stroke-width="3.2" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="149" rx="12" ry="8" fill="' + PC + '"/><circle cx="31" cy="139" r="8" fill="' + PC + '"/><ellipse cx="24.5" cy="140" rx="3" ry="6" fill="' + shade(PC, -.3) + '"/><ellipse cx="37.5" cy="140" rx="3" ry="6" fill="' + shade(PC, -.3) + '"/><ellipse cx="31" cy="143.5" rx="4" ry="3" fill="' + shade(PC, .35) + '"/><circle cx="31" cy="142" r="1.4" fill="#1a1a1a"/><circle cx="28" cy="137.5" r="1" fill="#1a1a1a"/><circle cx="34" cy="137.5" r="1" fill="#1a1a1a"/><rect x="35" y="153" width="3.4" height="6" rx="1.7" fill="' + PC + '"/><rect x="49" y="153" width="3.4" height="6" rx="1.7" fill="' + PC + '"/></g>' : '';
    return '<svg viewBox="0 0 200 200" class="av-m-' + esc(m.k || 'plain') + '" style="--rx:' + rx + 'px;--lx:' + lx + 'px"' + (m.attrs || '') + '>' + bgEl + sceneEl + '<g class="av-sky ' + esc(m.sky || '') + '">' + sky + '</g>' + lamp + ground + (pet && AID === 'chair' ? '<g transform="translate(-12 0)">' + pet + '</g>' : pet) + '<g class="av-all">' + (HT ? '<g transform="' + HT + '">' : '') + '<g class="av-up" transform="translate(0 ' + (-UP) + ')"><g transform="translate(' + (-DX).toFixed(1) + ' -3)"><g class="av-behind">' + behind + '</g></g></g>' + legs + (WS ? '<g transform="translate(0 ' + WS + ')">' : '') + '<g class="av-up" transform="translate(0 ' + (-UP) + ')">' + neck + body +
      '<g transform="translate(0 -9)"><g transform="translate(' + DX.toFixed(1) + ' 0)"><g class="av-armL">' + closeHand(armsL) + '</g></g><g transform="translate(' + (-DX).toFixed(1) + ' 0)"><g class="av-armR">' + closeHand(arms) + '</g></g>' + head + '</g>' + (m.k === 'trip' ? '' : propG) + '<g transform="translate(0 -9)"><g class="av-front">' + front + '</g></g></g>' + (m.k === 'trip' ? propG : '') + (WS ? '</g>' : '') + chair + (HT ? '</g>' : '') + '</g></svg>';
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
    var pic = null; if (ci2 && ci2.look) try { pic = couple(ci2.kind, look(), ci2.look, { label: ci2.say }); } catch (e) { pic = null; ci2 = null; }
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
        f.classList.remove('hop', 'av-look', 'av-stretch'); void f.offsetWidth; f.classList.add(fx);
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
    ['face', 'Face', 'Ansikt', [['faceS', 'Face shape', 'Ansiktsform'], ['expr', 'Mood', 'Humør'], ['eyeS', 'Eye shape', 'Øyeform'], ['eyeC', 'Eye colour', 'Øyefarge'], ['brows', 'Eyebrows', 'Øyenbryn'], ['nose', 'Nose', 'Nese'], ['earS', 'Ears', 'Ører'], ['makeup', 'Make-up', 'Sminke'], ['cheeks', 'Cheeks', 'Kinn'], ['lines', 'Dimples & lines', 'Smilehull og linjer'], ['mark', 'Face sticker', 'Klistremerke'], ['pierce', 'Piercings', 'Piercinger'], ['beard', 'Beard', 'Skjegg'], ['glasses', 'Glasses', 'Briller']]],
    ['hair', 'Hair', 'Hår', [['hair', 'Style', 'Frisyre'], ['hairC', 'Colour', 'Farge'], ['hair2', 'Coloured streak', 'Farget stripe'], ['hairAge', 'Grey & hairline', 'Grått og hårfeste']]],
    ['body', 'Body', 'Kropp', [['build', 'Build', 'Kroppsbygning'], ['height', 'Height', 'Høyde'], ['shape', 'Shape', 'Fasong'], ['skin', 'Skin tone', 'Hudfarge'], ['tat', 'Tattoo', 'Tatovering'], ['aid', 'Mobility & hearing', 'Bevegelse og hørsel']]],
    ['style', 'Style', 'Klær', [['top', 'Top', 'Overdel'], ['pat', 'Print', 'Trykk'], ['topC', 'Top colour', 'Farge på overdelen'], ['chest', 'Text on your top', 'Tekst på overdelen'], ['bottom', 'Bottom', 'Underdel'], ['legs', 'Bottom colour', 'Farge på underdelen'], ['shoes', 'Shoes', 'Sko'], ['shoeC', 'Shoe colour', 'Farge på skoene'], ['socks', 'Socks', 'Sokker']]],
    ['extras', 'Extras', 'Tilbehør', [['hat', 'Headwear', 'Hodeplagg'], ['hatC', 'Hat, scarf & tie colour', 'Farge på hatt, skjerf og slips'], ['ears', 'Ears', 'Ører'], ['neck', 'Neck', 'Hals'], ['addons', 'Add-ons', 'Ekstra'], ['pet', 'Sidekick', 'Følgesvenn']]],
    ['day', 'Your day', 'Dagen din', [['auto', 'Dress for the season', 'Kle deg etter sesongen'], ['hold', 'In your hand', 'I hånden'], ['badge', 'Badge', 'Merke'], ['scene', 'Background', 'Bakgrunn']]]
  ];
  var MKO = {
    faceS: [['oval', 'Oval', 'Oval'], ['round', 'Round', 'Rund'], ['square', 'Square', 'Firkantet'], ['long', 'Long', 'Lang'], ['heart', 'Heart', 'Hjerte']],
    expr: [['smile', 'Smile', 'Smil'], ['grin', 'Big grin', 'Stort glis'], ['laugh', 'Laugh', 'Ler'], ['wink', 'Wink', 'Blunk'], ['silly', 'Silly', 'Tullete'], ['cool', 'Cool', 'Kul'], ['calm', 'Happy', 'Glad'], ['love', 'In love', 'Forelsket'], ['starry', 'Starstruck', 'Stjerneøyne'], ['shy', 'Shy', 'Sjenert'], ['wow', 'Wow', 'Wow']],
    eyeS: [['round', 'Round', 'Runde'], ['almond', 'Almond', 'Mandel'], ['big', 'Big', 'Store'], ['sleepy', 'Sleepy', 'Søvnige']],
    brows: [['normal', 'Normal', 'Vanlige'], ['thick', 'Thick', 'Tykke'], ['thin', 'Thin', 'Tynne'], ['arched', 'Arched', 'Buede'], ['uni', 'Unibrow', 'Sammenvokste']],
    nose: [['normal', 'Normal', 'Vanlig'], ['button', 'Button', 'Knappenese'], ['pointy', 'Pointy', 'Spiss'], ['wide', 'Wide', 'Bred']],
    earS: [['normal', 'Normal', 'Vanlige'], ['small', 'Small', 'Små'], ['big', 'Big', 'Store'], ['elf', 'Elf', 'Alv']],
    makeup: [['none', 'None', 'Ingen'], ['lashes', 'Lashes', 'Vipper'], ['lips', 'Lipstick', 'Leppestift'], ['both', 'Both', 'Begge']],
    cheeks: [['none', 'None', 'Ingen'], ['blush', 'Blush', 'Rødme'], ['freckles', 'Freckles', 'Fregner'], ['both', 'Both', 'Begge']],
    lines: [['none', 'None', 'Ingen'], ['dimples', 'Dimples', 'Smilehull'], ['wrinkles', 'Laugh lines', 'Smilerynker'], ['both', 'Both', 'Begge']],
    mark: [['none', 'None', 'Ingen'], ['mole', 'Beauty spot', 'Føflekk'], ['star', 'Star', 'Stjerne'], ['heart', 'Heart', 'Hjerte'], ['plaster', 'Plaster', 'Plaster']],
    pierce: [['none', 'None', 'Ingen'], ['nose', 'Nose ring', 'Nesering'], ['brow', 'Eyebrow', 'Øyenbryn'], ['lip', 'Lip ring', 'Leppering'], ['septum', 'Septum', 'Septum']],
    beard: [['none', 'None', 'Ingen'], ['stubble', 'Stubble', 'Stubber'], ['short', 'Short', 'Kort'], ['full', 'Full', 'Fullskjegg'], ['goatee', 'Goatee', 'Bukkeskjegg'], ['chinstrap', 'Chinstrap', 'Kjakeskjegg'], ['moustache', 'Moustache', 'Bart'], ['handlebar', 'Handlebar', 'Sykkelstyre'], ['curled', 'Curled', 'Krøllet bart']],
    glasses: [['none', 'None', 'Ingen'], ['round', 'Round', 'Runde'], ['square', 'Square', 'Firkantede'], ['cateye', 'Cat-eye', 'Katteøye'], ['sun', 'Shades', 'Solbriller'], ['aviator', 'Aviator', 'Pilotbriller'], ['hearts', 'Hearts', 'Hjerter'], ['stars', 'Stars', 'Stjerner'], ['monocle', 'Monocle', 'Monokkel']],
    hair: [['short', 'Short', 'Kort'], ['side', 'Side part', 'Sideskill'], ['quiff', 'Quiff', 'Quiff'], ['curly', 'Curly', 'Krøllete'], ['buzz', 'Buzz cut', 'Snauklipt'], ['fade', 'Fade', 'Fade'], ['spiky', 'Spiky', 'Piggete'], ['mohawk', 'Mohawk', 'Hanekam'], ['afro', 'Afro', 'Afro'], ['mullet', 'Mullet', 'Hockeysveis'], ['slick', 'Slicked', 'Glattet bakover'], ['undercut', 'Undercut', 'Undercut'], ['waves', 'Waves', 'Bølger'], ['sideshave', 'Side shave', 'Barbert side'], ['bangs', 'Curtain bangs', 'Gardinpannelugg'], ['bowl', 'Bowl cut', 'Potteklipp'], ['long', 'Long', 'Langt'], ['ponytail', 'Ponytail', 'Hestehale'], ['bun', 'Bun', 'Knute'], ['topknot', 'Top knot', 'Topknute'], ['braids', 'Braids', 'Fletter'], ['pigtails', 'Space buns', 'Doble knuter'], ['cornrows', 'Cornrows', 'Cornrows'], ['dreads', 'Dreads', 'Dreads'], ['bald', 'Bald', 'Skallet']],
    hairAge: [['none', 'None', 'Ingen'], ['grey', 'Grey sides', 'Grå sider'], ['receding', 'Receding', 'Viker']],
    build: [['slim', 'Slim', 'Slank'], ['regular', 'Regular', 'Vanlig'], ['athletic', 'Athletic', 'Atletisk'], ['muscular', 'Muscular', 'Muskuløs'], ['broad', 'Broad', 'Bred']],
    height: [['short', 'Short', 'Lav'], ['regular', 'Regular', 'Vanlig'], ['tall', 'Tall', 'Høy']],
    shape: [['straight', 'Straight', 'Rett'], ['belly', 'Belly', 'Mage'], ['hips', 'Hips', 'Hofter']],
    tat: [['none', 'None', 'Ingen'], ['arm', 'Arm', 'Arm'], ['neck', 'Neck', 'Hals'], ['face', 'Face', 'Ansikt']],
    aid: [['none', 'None', 'Ingen'], ['chair', 'Wheelchair', 'Rullestol'], ['crutches', 'Crutches', 'Krykker'], ['hearing', 'Hearing aid', 'Høreapparat'], ['arm', 'Prosthetic arm', 'Armprotese']],
    top: [['tee', 'T-shirt', 'T-skjorte'], ['tank', 'Tank top', 'Singlet'], ['polo', 'Polo', 'Piké'], ['sweater', 'Sweater + shirt', 'Genser + skjorte'], ['knit', 'Nordic knit', 'Lusekofte'], ['hoodie', 'Hoodie', 'Hettegenser'], ['shirt', 'Shirt', 'Skjorte'], ['jersey', 'Jersey', 'Drakt'], ['kit', 'Football kit', 'Fotballdrakt'], ['varsity', 'Varsity jacket', 'College-jakke'], ['suit', 'Suit', 'Dress'], ['puffer', 'Puffer', 'Boblejakke'], ['rain', 'Raincoat', 'Regnjakke'], ['jacket', 'Jacket', 'Jakke'], ['dress', 'Dress', 'Kjole'], ['bunad', 'Bunad (Norwegian folk dress)', 'Bunad'], ['scrubs', 'Scrubs', 'Arbeidsklær (helse)'], ['chef', 'Chef jacket', 'Kokkejakke'], ['pjs', 'Pyjamas', 'Pyjamas'], ['robe', 'Bathrobe', 'Morgenkåpe'], ['none', 'No top', 'Uten overdel']],
    pat: [['none', 'Plain', 'Ensfarget'], ['stripes', 'Stripes', 'Striper'], ['check', 'Check', 'Rutete'], ['star', 'Star', 'Stjerne'], ['heart', 'Heart', 'Hjerte'], ['flame', 'Flame', 'Flamme'], ['bolt', 'Bolt', 'Lyn'], ['camo', 'Camo', 'Kamuflasje'], ['tiedye', 'Tie-dye', 'Batikk'], ['flag', 'Norway flag', 'Norsk flagg'], ['pumpkin', 'Pumpkin', 'Gresskar'], ['bones', 'Skeleton', 'Skjelett']],
    bottom: [['trousers', 'Trousers', 'Bukse'], ['jeans', 'Ripped jeans', 'Revne jeans'], ['joggers', 'Joggers', 'Joggebukse'], ['cargo', 'Cargo', 'Cargobukse'], ['shorts', 'Shorts', 'Shorts'], ['skirt', 'Skirt', 'Skjørt'], ['overalls', 'Overalls', 'Snekkerbukse'], ['swim', 'Swim shorts', 'Badeshorts']],
    shoes: [['sneakers', 'Sneakers', 'Joggesko'], ['hightops', 'High-tops', 'Høye joggesko'], ['boots', 'Boots', 'Støvler'], ['sandals', 'Sandals', 'Sandaler'], ['slippers', 'Slippers', 'Tøfler'], ['cleats', 'Football boots', 'Fotballsko']],
    hat: [['none', 'None', 'Ingen'], ['cap', 'Cap', 'Caps'], ['beanie', 'Beanie', 'Lue'], ['bucket', 'Bucket hat', 'Bøttehatt'], ['beret', 'Beret', 'Alpelue'], ['bandana', 'Bandana', 'Bandana'], ['cowboy', 'Cowboy hat', 'Cowboyhatt'], ['phones', 'Headphones', 'Hodetelefoner'], ['flowers', 'Flower crown', 'Blomsterkrans'], ['party', 'Party hat', 'Festhatt'], ['wizard', 'Wizard hat', 'Trollmannshatt'], ['santa', 'Santa hat', 'Nisselue'], ['witch', 'Witch hat', 'Heksehatt'], ['chef', 'Chef hat', 'Kokkelue'], ['crown', 'Crown', 'Krone']],
    ears: [['none', 'None', 'Ingen'], ['studs', 'Studs', 'Ørepynt'], ['hoops', 'Hoops', 'Ringer'], ['buds', 'Earbuds', 'Øreplugger']],
    neck: [['none', 'None', 'Ingen'], ['chain', 'Chain', 'Kjede'], ['pearls', 'Pearls', 'Perler'], ['scarf', 'Scarf', 'Skjerf'], ['bowtie', 'Bow tie', 'Sløyfe'], ['tie', 'Tie', 'Slips'], ['medal', 'Medal', 'Medalje'], ['lanyard', 'Work lanyard', 'Adgangskort']],
    pet: [['none', 'None', 'Ingen'], ['cat', 'Cat', 'Katt'], ['dog', 'Dog', 'Hund'], ['bunny', 'Bunny', 'Kanin'], ['bird', 'Parrot pal', 'Papegøye']],
    hold: [['none', 'Nothing', 'Ingenting'], ['phone', 'Phone', 'Mobil'], ['coffee', 'Coffee', 'Kaffe'], ['laptop', 'Laptop', 'PC'], ['bag', 'Shopping bag', 'Handlepose'], ['flowers', 'Flowers', 'Blomster'], ['icecream', 'Ice cream', 'Is'], ['balloon', 'Balloon', 'Ballong'], ['flag', 'Norway flag', 'Norsk flagg']],
    badge: [['none', 'None', 'Ingen'], ['streak', 'Streak', 'Rekke'], ['trophy', 'Trophy', 'Pokal'], ['top3', 'Top 3 done', 'Topp 3 gjort'], ['paid', 'Paid off', 'Nedbetalt']],
    scene: [['none', 'None', 'Ingen'], ['city', 'City', 'By'], ['beach', 'Beach', 'Strand'], ['forest', 'Forest', 'Skog'], ['office', 'Home office', 'Hjemmekontor'], ['oslo', 'Oslo fjord', 'Oslofjorden']]
  };
  /* Moves (avatar page): which hand it uses for things, and how it walks in the living scenes */
  MKO.hand = [['right', 'Right-handed', 'Høyrehendt'], ['left', 'Left-handed', 'Venstrehendt']];
  MKO.walk = [['calm', 'Calm', 'Rolig'], ['bouncy', 'Bouncy', 'Sprettende'], ['quick', 'Quick', 'Rask']];
  var MKC = {
    skin: ['#fbe2cf', '#f3d4bb', '#e3b893', '#c99a73', '#a8774f', '#82563a', '#5a3a27', '#3e2618'], eyeC: ['#2b211b', '#5b3a1e', '#3a6ea5', '#3f7d4e', '#7a8794'],
    hairC: ['#1e140d', '#4a2f1b', '#7a4e2a', '#b5854a', '#e0bf7a', '#9b9b9b', '#a33d2b', '#2f6fd6', '#e0559a', '#2fae6a', '#8a5cf0', '#eeeeee'], hair2: ['', '#e0559a', '#2f9ee0', '#2fae6a', '#f2c94c', '#eeeeee', '#8a5cf0'],
    topC: ['#d9c7a8', '#2e3340', '#e8743b', '#2f5d8a', '#2f7a55', '#8a6fdf', '#b8b8b8', '#f2f2f2', '#e0559a', '#f2c94c', '#d93a3a'], legs: ['#2a2f3a', '#3c5a7d', '#5b4b3a', '#6e6e6e', '#c9b48a', '#2f7a55', '#8a5cf0'],
    shoeC: ['#1a1a1a', '#f2f2f2', '#d93a3a', '#3987e5', '#f2c94c', '#2fae6a', '#5b3a1e'], socks: ['', '#f2f2f2', '#2e3340', '#d93a3a', '#f2c94c', '#2fae6a', '#e0559a'],
    hatC: ['#e8743b', '#2e3340', '#d93a3a', '#3987e5', '#2f7a55', '#f2c94c', '#e0559a', '#8a5a2b', '#3b4d8a', '#f2f2f2']
  };
  var MKFACE = { faceS: 1, expr: 1, eyeS: 1, eyeC: 1, brows: 1, nose: 1, earS: 1, makeup: 1, cheeks: 1, lines: 1, mark: 1, pierce: 1, beard: 1, glasses: 1, hair: 1, hairC: 1, hair2: 1, hairAge: 1, hat: 1, ears: 1 };
  var MKNONE = { makeup: 1, cheeks: 1, lines: 1, mark: 1, pierce: 1, hairAge: 1, tat: 1, aid: 1, hat: 1, ears: 1, neck: 1, pet: 1, hold: 1, badge: 1, scene: 1 };
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
    else if (k === 'chest') return '<div class="avm-sec"><b>' + esc(title) + '<em>' + esc(L('Up to 4 letters', 'Opptil 4 tegn')) + '</em></b><input class="avm-txt" data-avm-chest maxlength="4" autocomplete="off" aria-label="' + esc(title) + '" placeholder="' + esc(L('e.g. JP or 7', 'f.eks. JP eller 7')) + '" value="' + esc(cur.chest || '') + '"></div>';
    else if (MKO[k]) { var o = MKO[k].filter(function (x) { return x[0] === (cur[k] || MKO[k][0][0]); })[0]; now = o ? L(o[1], o[2]) : '';
      body = '<div class="avm-tiles">' + MKO[k].map(function (x) { return mkTile(cur, k, x[0], L(x[1], x[2])); }).join('') + '</div>'; }
    else { var c = MKC[k], own = !!cur[k] && c.indexOf(cur[k]) < 0; now = own ? L('Your own colour', 'Din egen farge') : '';
      body = '<div class="avm-dots">' + c.map(function (h, i) { return '<button type="button" class="avm-d" data-avm-k="' + k + '" data-avm-v="' + h + '" aria-pressed="' + ((cur[k] || '') === h) + '" aria-label="' + esc(title + ' ' + (h ? i + 1 : L('none', 'ingen'))) + '"><i style="background:' + (h || 'transparent') + '"></i></button>'; }).join('') +
        '<label class="avm-d avm-any" aria-pressed="' + own + '"><i></i><input type="color" data-avm-k="' + k + '" value="' + (own && /^#[0-9a-f]{6}$/i.test(cur[k]) ? cur[k] : '#8a5cf0') + '" aria-label="' + esc(L('Any colour', 'Valgfri farge') + ': ' + title) + '"></label></div>'; }
    return '<div class="avm-sec"><b>' + esc(title) + '<em>' + esc(now) + '</em></b>' + body + '</div>';
  }
  function mkFig(cur) {
    return figure(MOMENTS.day, cur) + '<div class="avm-face">' + mkCrop(figure(MKPLAIN, Object.assign({}, cur, { pet: 'none' })), '58 12 84 80') + '</div>' +
      '<div class="avm-acts"><button type="button" class="hot" data-avm-rand><i class="bi bi-shuffle"></i> ' + L('Surprise me', 'Overrask meg') + '</button><button type="button" data-avm-reset><i class="bi bi-arrow-counterclockwise"></i> ' + L('Start over', 'Start på nytt') + '</button></div>';
  }
  function mkHtml(cur, tab) {
    mkCss(); var t = MKT.filter(function (x) { return x[0] === tab; })[0] || MKT[0];
    return '<div class="avm"><div class="avm-fig av-prev">' + mkFig(cur) + '</div><div class="avm-tabs" role="tablist">' + MKT.map(function (x) { return '<button type="button" role="tab" data-avm-tab="' + x[0] + '" aria-selected="' + (x[0] === t[0]) + '">' + esc(L(x[1], x[2])) + '</button>'; }).join('') + '</div>' +
      t[3].map(function (s) { return mkSec(cur, s); }).join('') + '</div>';
  }
  function mkRand() {
    var r = {}, pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    Object.keys(MKO).forEach(function (k) { r[k] = MKNONE[k] && Math.random() < .65 ? 'none' : pick(MKO[k])[0]; });
    Object.keys(MKC).forEach(function (k) { r[k] = k === 'hair2' || k === 'socks' ? (Math.random() < .7 ? '' : pick(MKC[k])) : pick(MKC[k]); });
    r.aid = 'none'; r.scene = 'none'; r.watch = Math.random() < .3 ? 'yes' : 'no'; r.bag = Math.random() < .2 ? 'yes' : 'no'; r.extra = 'none'; r.chest = ''; return r;
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
    if (x === 'cap' && !n.hat) n.hat = 'cap'; if (x === 'lanyard' && !n.neck) n.neck = 'lanyard'; if (x === 'watch') n.watch = 'yes'; if (x === 'earbuds' && !n.ears) n.ears = 'buds'; n.extra = 'none'; return n; }
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
  function openMine() { if (window.Avatar && window.Avatar.page) window.Avatar.page(L('Your avatar', 'Avataren din'), mkMigrate(look()), function (lk) { saveWhole(lk); }, { mine: true }); }
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
  function editor(title, start, onSave) { if (window.Avatar && window.Avatar.page) window.Avatar.page(title, mkMigrate(start), onSave, {}); }

  /* ---------- the two of you (shared home): holding hands, a high five, a hug or a kiss ----------
     a, b = the two looks (a stands on the left). Two figures side by side in one picture; tap the picture to
     try the next one. kind: hold | hi5 | hug | kiss */
  var COUPLE = { hold: { gap: 80, a: 'holdR', b: 'holdL', bg: '#1d2533' }, hi5: { gap: 70, a: 'hi5R', b: 'hi5L', bg: '#1f1a10' }, hug: { gap: 58, a: 'hugR', b: 'hugL', bg: '#2a1622' }, kiss: { gap: 70, a: 'plain', b: 'plain', bg: '#2a1622', tilt: 6, closed: true },
    selfie: { gap: 62, a: 'plain', b: 'selfieR', bg: '#1d2533', tilt: -4 }, dance: { gap: 78, a: 'danceR', b: 'danceL', bg: '#22182a' }, cook: { gap: 96, a: 'cookR', b: 'cookL', bg: '#2c1f12' }, sofa: { gap: 66, a: 'plain', b: 'plain', bg: '#1d2533', sofa: true } };
  function couple(kind, a, b, opt) {
    opt = opt || {}; a = Object.assign({}, START, a || {}); b = Object.assign({}, START, b || {}); var c = COUPLE[kind] || COUPLE.hold, W = 200 + c.gap, light = document.documentElement.getAttribute('data-theme') === 'light' || opt.light;
    var bg = light ? shade(c.bg, .82) : c.bg, cx = W / 2, uid = 'cp-' + kind + (opt.uid || '');
    var one = function (look, k, x, rot) {
      var f = figure({ k: k, plain: true, bg: '#000', sky: 'none', closed: c.closed, attrs: ' x="' + x + '" y="0" width="200" height="200"' }, Object.assign({}, look || look0(), opt.pet ? { pet: 'none' } : {}));
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
    if (!opt.pet && b.pet && b.pet !== 'none' && b.pet !== 'bird') { var bf = figure({ k: 'plain', plain: true, bg: 'none' }, Object.assign({}, START, { pet: b.pet, petC: b.petC })), bm = bf.match(/<g class="av-pet"[\s\S]*?<\/g>(?=<g class="av-all">)/); if (bm) petB = '<g transform="translate(' + (W + 6) + ' 4) scale(-1 1)">' + bm[0] + '</g>'; }
    var sofa = c.sofa ? '<rect x="' + (cx - 82) + '" y="112" width="164" height="40" rx="12" fill="#3b4d8a"/><rect x="' + (cx - 90) + '" y="120" width="18" height="40" rx="8" fill="#334477"/><rect x="' + (cx + 72) + '" y="120" width="18" height="40" rx="8" fill="#334477"/><rect x="' + (cx - 72) + '" y="140" width="144" height="18" rx="6" fill="#4a5ea0"/>' : '';
    var pet = '';
    if (opt.pet && opt.pet !== 'none') { var pf = figure({ k: 'plain', plain: true, bg: 'none' }, Object.assign({}, START, { pet: opt.pet })), pm = pf.match(/<g class="av-pet"[\s\S]*?<\/g>(?=<g class="av-all">)/); if (pm) pet = '<g transform="translate(-12 4)">' + pm[0] + '</g>'; }
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
  window.Avatar = { couple: couple, coupleKind: coupleKind, COUPLE_KINDS: ['hold', 'hi5', 'hug', 'kiss', 'selfie', 'dance', 'cook', 'sofa'], figure: figure, look: look, moments: moments, personLook: personLook, editor: editor, MOMENTS: MOMENTS, openMine: openMine,
    _mk: { MKT: MKT, MKO: MKO, MKC: MKC, sec: mkSec, rand: mkRand, migrate: mkMigrate, act: mkAct, css: mkCss, crop: mkCrop, figure: figure, MOMENTS: MOMENTS, PLAIN: MKPLAIN, PLAIN0: PLAIN0, save: saveWhole, look: look, esc: esc } };
})();
