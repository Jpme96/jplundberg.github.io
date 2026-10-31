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
    win: { k: 'win', bg: '#1f1a10', sky: 'sun', i: 'trophy', c: '#f2c94c' }
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
  function figure(m, L) {
    L = L || look();
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
    var torso = MU
      ? '<path d="M84 86C92 83.5 110 83.5 118 86C130 87.5 134.5 92 134 101C133 110 126.5 117 123.5 124C122.5 128 119.5 130 116 130H86C82.5 130 79.5 128 78.5 124C75.5 117 69 110 68 101C67.5 92 72 87.5 84 86Z" fill="' + T + '"/>' +
        '<path d="M88 104q6.5 4 13 2q6.5 2 13-2" fill="none" stroke="' + T2 + '" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>'
      : L.build === 'athletic'
      ? '<path d="M86 86.5C93 84.5 109 84.5 116 86.5C126 88 131 92 130.5 101C129.5 110 126 117 124 124C123 128 120 130 116 130H86C82 130 79 128 78 124C76 117 72.5 110 71.5 101C71 92 76 88 86 86.5Z" fill="' + T + '"/>'
      : '<path d="M88 86.5C95 85 107 85 114 86.5C123 88 127 92 127 100C127 108 125.5 116 124.5 123C124 127.5 121 130 117 130H85C81 130 78 127.5 77.5 123C76.5 116 75 108 75 100C75 92 79 88 88 86.5Z" fill="' + T + '"/>';
    var detail = '';
    if (top === 'sweater') detail = '<path d="M92 88l9 9 9-9" fill="#f2f2f2"/><path d="M92 88l9 9 9-9" fill="none" stroke="#cfd6e4" stroke-width="1"/><path d="M95 88l6 6 6-6" fill="' + T + '"/><path d="M78.5 125q22.5 3 45 0" stroke="' + T2 + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    if (top === 'tee') detail = '<path d="M94 88q7 6 14 0" fill="none" stroke="' + T2 + '" stroke-width="2.5"/>';
    if (top === 'hoodie') detail = '<path d="M86 88q15 14 30 0" fill="' + T2 + '"/><path d="M96 94v12M106 94v12" stroke="#ddd" stroke-width="1.5" stroke-linecap="round"/><rect x="88" y="112" width="26" height="10" rx="3" fill="' + T2 + '"/>';
    if (top === 'shirt') detail = '<path d="M101 90v38" stroke="' + T2 + '" stroke-width="1.5"/><path d="M92 88l9 7 9-7-2 8-7-3-7 3z" fill="' + shade(T, .25) + '"/><circle cx="101" cy="104" r="1.2" fill="' + T2 + '"/><circle cx="101" cy="114" r="1.2" fill="' + T2 + '"/>';
    if (top === 'none') detail = '<path d="M86 104q7 5 14 1M102 105q7 4 14-1" fill="none" stroke="' + shade(L.skin, -.2) + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="101" cy="120" r="1.2" fill="' + shade(L.skin, -.25) + '"/>' + (L.build === 'athletic' ? '<path d="M101 108v10M95 113h12" stroke="' + shade(L.skin, -.15) + '" stroke-width="1.1" fill="none"/>' : '') +
      (MU ? '<path d="M101 98v24M95 108h12M95.5 114h11M96 120h10" stroke="' + shade(L.skin, -.2) + '" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M84 102q8 7 17 2q9 5 17-2" fill="none" stroke="' + shade(L.skin, -.22) + '" stroke-width="1.6" stroke-linecap="round"/>' : '');
    if (top === 'jacket') detail = '<path d="M92 88l9 10 9-10v40h-18z" fill="#f2f2f2"/><path d="M92 88l9 10v30M110 88l-9 10" stroke="' + T2 + '" stroke-width="2" fill="none"/>';
    var extra = '';
    if (L.extra === 'lanyard' && !bare && m.k !== 'gym' && m.k !== 'night') extra = '<path d="M93 90l6 22M109 90l-6 22" stroke="#1b1b1b" stroke-width="1.6" fill="none"/><rect x="97" y="111" width="8" height="10" rx="1.5" fill="#f2f2f2" stroke="#999" stroke-width=".6"/>';
    var cut = L.bottom === 'shorts' ? 142 : L.bottom === 'swim' ? 135 : 157;
    var LC = cut < 157 ? S : P;
    /* legs drawn at their own width for each body (not squeezed with the torso): they fill the hem, taper to the ankle */
    var hem = ((L.build === 'athletic' || MU) ? 45 : 47) * SX, G = { slim: 3, regular: 3.5, athletic: 4, muscular: 4.5, broad: 4 }[L.build] || 3.5;
    var LW = (hem - 3 - G) / 2, LB = LW * (MU ? .68 : L.build === 'athletic' ? .72 : .8), x0 = 101 - G / 2 - LW, x1 = 101 + G / 2;
    var leg = function (a) { var d = (LW - LB) / 2, q = function (n) { return n.toFixed(1); };
      return '<path d="M' + q(a) + ' 124H' + q(a + LW) + 'Q' + q(a + LW + .6) + ' 140 ' + q(a + LW - d) + ' 156H' + q(a + d) + 'Q' + q(a - .6) + ' 140 ' + q(a) + ' 124Z" fill="' + LC + '"/>'; };
    var hx0 = 101 - hem / 2 + 1, hw = hem - 2;
    /* a small shoe under each ankle, toe pointing a little outwards, a gap between them */
    var shoe = function (cx, dir) { var w = LB + 3, x = cx - w / 2 + dir * 1.5, q = function (n) { return n.toFixed(1); };
      return '<path d="M' + q(x + 2) + ' 155h' + q(w - 4) + 'c' + (dir > 0 ? '3 0 5 1.6 5 3.2 0 1.2-.8 1.8-2.2 1.8h-' + q(w + .8) + 'c-1.2 0-1.8-.8-1.8-2 0-1.8.9-3 2-3z' : '1.1 0 2 1.2 2 3 0 1.2-.6 2-1.8 2h-' + q(w + .8) + 'c-1.4 0-2.2-.6-2.2-1.8 0-1.6 2-3.2 5-3.2z') + '" fill="#1a1a1a"/>'; };
    var legs = '<g transform="translate(0 155) scale(1 1.27) translate(0 -155)">' + leg(x0) + leg(x1) +
      '<path d="M' + hx0.toFixed(1) + ' 122h' + hw.toFixed(1) + 'v5c0 3-2 5-5 5h-' + (hw / 2 - 5).toFixed(1) + 'l-0 -3-0 3h-' + (hw / 2 - 5).toFixed(1) + 'c-3 0-5-2-5-5z" fill="' + (cut < 157 ? P : shade(P, -.06)) + '"/>' +
      (cut < 157 ? '<path d="M' + hx0.toFixed(1) + ' 124h' + hw.toFixed(1) + 'v' + (cut - 127) + 'q0 3-3 3h-' + (hw / 2 - 3 - G / 2).toFixed(1) + 'l-' + (G / 2).toFixed(1) + '-5-' + (G / 2).toFixed(1) + ' 5h-' + (hw / 2 - 3 - G / 2).toFixed(1) + 'q-3 0-3-3z" fill="' + P + '"/>' + (L.bottom === 'swim' ? '<path d="M' + (hx0 + 1).toFixed(1) + ' 130h' + (hw - 2).toFixed(1) + '" stroke="' + shade(P, .3) + '" stroke-width="1.5"/>' : '') : '') +
      '</g>' + shoe(x0 + LW / 2, -1) + shoe(x1 + LW / 2, 1);
    /* arms + props */
    var arm = function (d) { return '<path d="' + d + '" stroke="' + T + '" stroke-width="' + AW + '" fill="none" stroke-linecap="round"/>' +
      (L.build === 'athletic' || MU ? '<path d="' + d + '" stroke="' + T + '" stroke-width="' + (AW + (MU ? 4 : 2.5)) + '" fill="none" stroke-linecap="round" stroke-dasharray="' + (MU ? 14 : 11) + ' 999"/>' : ''); }, hand = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="' + HR + '" fill="' + S + '"/>'; };
    var down = arm('M79 96c-8 10-9 22-6 30') + hand(73, 128), arms = arm('M123 96c8 10 9 22 6 30') + hand(129, 128), armsL = down, prop = '', propL = '', behind = '', lamp = '', front = '';
    var watch = L.extra === 'watch' ? function (x, y) { return '<rect x="' + (x - 4) + '" y="' + (y - 7) + '" width="8" height="4" rx="1.5" fill="#222"/>'; } : function () { return ''; };
    if (m.k === 'morning') { arms = arm('M123 96c8 6 12 12 12 18') + hand(135, 116) + watch(135, 116); prop = '<path d="M129 102h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#f4efe6"/><path d="M143 105h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#f4efe6" stroke-width="2"/><path class="steam" d="M133 98c-1-3 1-4 0-7M138 98c-1-3 1-4 0-7" stroke="#f4efe6" stroke-width="1.5" fill="none" opacity=".7"/>'; }
    if (m.k === 'rain') { arms = arm('M123 96c6-4 10-10 12-18') + hand(135, 78) + watch(135, 80); behind = '<path d="M74 38a44 30 0 0 1 88 0c-6-4-13-4-19 0-6-4-13-4-19 0-6-4-14-4-20 0-6-4-13-4-30 0z" fill="#e8743b"/><path d="M135 38v40" stroke="#ddd" stroke-width="2.2"/>'; }
    if (m.k === 'gym') { armsL = arm('M79 96c-10 4-16 0-20-8') + hand(59, 86) + '<rect x="49" y="84" width="20" height="4" rx="2" fill="#bbb"/><rect x="46" y="78" width="5" height="16" rx="1.5" fill="#666"/><rect x="67" y="78" width="5" height="16" rx="1.5" fill="#666"/>'; arms = arm('M123 96c10 4 16 0 20-8') + hand(143, 86); prop = '<rect x="133" y="84" width="20" height="4" rx="2" fill="#bbb"/><rect x="130" y="78" width="5" height="16" rx="1.5" fill="#666"/><rect x="151" y="78" width="5" height="16" rx="1.5" fill="#666"/>'; }
    if (m.k === 'trip') { arms = arm('M123 96c8 10 10 20 10 28') + hand(133, 126) + watch(133, 124); prop = '<path d="M133 126v-6" stroke="#999" stroke-width="2.5"/><rect x="129" y="128" width="34" height="28" rx="5" fill="#2f5d8a"/><circle cx="135" cy="158" r="2.5" fill="#111"/><circle cx="157" cy="158" r="2.5" fill="#111"/><rect x="151" y="132" width="16" height="10" rx="2" fill="#f2c94c"/><text x="159" y="140" font-size="7" font-weight="800" text-anchor="middle" fill="#333">' + (m.tag || '') + '</text>'; }
    if (m.k === 'day') { arms = arm('M123 96c8-4 12-12 12-22') + hand(135, 72); }
    if (m.k === 'evening') { arms = arm('M123 96c8 6 12 12 12 18') + hand(135, 116); prop = '<path d="M129 102h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#c98500"/><path d="M143 105h2a3 3 0 0 1 0 6h-2" fill="none" stroke="#c98500" stroke-width="2"/><path class="steam" d="M133 98c-1-3 1-4 0-7M138 98c-1-3 1-4 0-7" stroke="#f4efe6" stroke-width="1.5" fill="none" opacity=".7"/>'; lamp = '<path d="M22 54l10-16h14l10 16z" fill="#f6c85f"/><line x1="39" y1="54" x2="39" y2="160" stroke="#666" stroke-width="2.5"/><circle cx="39" cy="58" r="30" fill="#f6c85f" opacity=".12"/>'; }
    if (m.k === 'bday') { armsL = arm('M79 96c-4 10 0 18 10 20') + hand(89, 116); arms = arm('M123 96c4 10 0 18-10 20') + hand(113, 116); front = '<rect x="88" y="104" width="26" height="20" rx="2.5" fill="#d55181"/><rect x="99" y="104" width="4" height="20" fill="#f2c94c"/><path d="M95 102q6-8 6 2q0-10 6-2" stroke="#f2c94c" stroke-width="2.4" fill="none"/>'; }
    if (m.k === 'win') { armsL = arm('M79 96c-8-8-10-18-8-28') + hand(71, 66); arms = arm('M123 96c8-8 10-18 8-28') + hand(131, 66); front = '<g>' + ['#e8743b', '#f2c94c', '#14b8a6', '#d55181', '#3987e5'].map(function (c, i) { return '<rect x="' + (52 + i * 22) + '" y="' + (26 + (i % 2) * 14) + '" width="6" height="3" fill="' + c + '" transform="rotate(' + (i * 37) + ' ' + (55 + i * 22) + ' 30)"/>'; }).join('') + '</g>'; }
    if (m.k === 'night') { arms = arm('M123 96c8 10 9 22 6 30') + hand(129, 128); prop = '<text class="z" x="122" y="40" font-size="14" font-weight="800" fill="#9a9ca5">z</text><text class="z" x="132" y="28" font-size="10" font-weight="800" fill="#9a9ca5">z</text>'; }
    /* head */
    var hx = 101, sleep = m.k === 'night';
    var face = '<path d="M101 40c12.5 0 19 9 19 22s-8.5 22-19 22-19-9-19-22 6.5-22 19-22z" fill="' + S + '"/><ellipse cx="82.5" cy="63" rx="3.5" ry="5" fill="' + S2 + '"/><ellipse cx="119.5" cy="63" rx="3.5" ry="5" fill="' + S2 + '"/>';
    var hairBack = L.hair === 'long' ? '<path d="M80 60c-2-16 8-24 21-24s23 8 21 24v26c-4 4-8 0-8-6V62H88v18c0 6-4 10-8 6z" fill="' + H + '"/>' : '';
    var hairTop = {
      short: '<path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-1-6-4-10-8-12-6 3-16 3-23 0-3 3-5 7-6 12z" fill="' + H + '"/>',
      side: '<path d="M82 63c-3-18 7-27 20-27 14 0 20 10 18 24-8-8-20-12-30-8-4 2-6 6-8 11z" fill="' + H + '"/><path d="M94 38l-3 10" stroke="' + shade(H, .15) + '" stroke-width="1.3"/>',
      quiff: '<path d="M82 62c-2-14 4-21 12-23 0-6 8-9 15-6 8 3 12 10 10 29-2-7-5-11-9-12-6 3-15 3-21 0-3 3-5 7-7 12z" fill="' + H + '"/>',
      curly: '<g fill="' + H + '"><circle cx="86" cy="52" r="6.5"/><circle cx="94" cy="44" r="7"/><circle cx="104" cy="42" r="7.5"/><circle cx="113" cy="46" r="7"/><circle cx="118" cy="54" r="6"/><circle cx="83" cy="60" r="4.5"/><circle cx="120" cy="61" r="4.5"/></g>',
      buzz: '<path d="M82 60c-1-14 7-21 19-21s20 7 19 21c-3-9-10-13-19-13s-16 4-19 13z" fill="' + H + '" opacity=".75"/>',
      bald: '<path d="M88 46c6-4 16-4 22 0" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none" stroke-linecap="round"/>',
      long: '<path d="M81 63c-3-18 7-27 20-27 14 0 22 10 19 27-3-8-8-13-14-14-8 4-18 4-25 0z" fill="' + H + '"/>',
      bun: '<circle cx="101" cy="31" r="7" fill="' + H + '"/><path d="M82 62c-2-17 6-25 19-25 13 0 21 9 18 25-2-8-8-13-18-13s-16 5-19 13z" fill="' + H + '"/>'
    }[L.hair];
    var brows = '<path d="M90 56q4-2.5 8 0M104 56q4-2.5 8 0" stroke="' + (L.hair === 'bald' ? shade(S, -.45) : H) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    var tired = m.mood === 'tired', meh = m.mood === 'ok';
    if (tired) brows = '<path d="M90 55.5q4 1.5 8 1.5M104 57q4 0 8-1.5" stroke="' + (L.hair === 'bald' ? shade(S, -.45) : H) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    var eyes = tired ? '<g><circle cx="94" cy="63" r="2" fill="#2b211b"/><circle cx="108" cy="63" r="2" fill="#2b211b"/><path d="M90.5 61.6h7M104.5 61.6h7" stroke="' + S + '" stroke-width="2.6" stroke-linecap="round"/><path d="M90.5 61.4q3.5-1 7 0M104.5 61.4q3.5-1 7 0" stroke="#2b211b" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M91 67q3 1.4 6 0M105 67q3 1.4 6 0" stroke="' + shade(S, -.28) + '" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>' : sleep ? '<path d="M91 62q3 2 6 0M105 62q3 2 6 0" stroke="#2b211b" stroke-width="2" fill="none" stroke-linecap="round"/>' : '<g class="eyes"><circle cx="94" cy="62" r="2.2" fill="#2b211b"/><circle cx="108" cy="62" r="2.2" fill="#2b211b"/></g>';
    var nose = '<path d="M101 64c-1.6 3-2 5 .6 5.6" stroke="' + S2 + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    var mouth = tired ? '<path d="M97 74.5q2-1.6 4 0t4 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : meh ? '<path d="M96.5 73q4.5 2.4 9 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : sleep ? '<path d="M98 74q3 1.5 6 0" stroke="#8a4636" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : '<path d="M95 72q6 6 12 0" fill="#fff" stroke="#8a4636" stroke-width="1.8" stroke-linejoin="round"/>';
    var beard = { none: '', stubble: '<path d="M84 66c2 12 9 18 17 18s15-6 17-18c-3 6-9 9-17 9s-14-3-17-9z" fill="' + H + '" opacity=".22"/>',
      short: '<path d="M84 64c1 14 9 21 17 21s16-7 17-21c-2 5-6 8-9 8-2-2-5-3-8-3s-6 1-8 3c-3 0-7-3-9-8z" fill="' + H + '"/>',
      full: '<path d="M82 60c0 18 8 29 19 29s19-11 19-29c-2 8-6 12-10 12-2-2-5-3-9-3s-7 1-9 3c-4 0-8-4-10-12z" fill="' + H + '"/>',
      moustache: '<path d="M94 70.5q7-4 14 0q-3.5 2-7 .6-3.5 1.4-7-.6z" fill="' + H + '"/>' }[L.beard];
    var mouthOver = L.beard === 'short' || L.beard === 'full' ? (sleep ? '' : tired || meh ? mouth : '<path d="M96 73q5 4 10 0" fill="#fff" stroke="#8a4636" stroke-width="1.6"/>') : mouth;
    var glasses = L.glasses === 'round' ? '<g fill="rgba(255,255,255,.08)" stroke="#1d1d1d" stroke-width="1.5"><circle cx="94" cy="62" r="5"/><circle cx="108" cy="62" r="5"/><path d="M99 62h4M89 61l-6-2M113 61l6-2" fill="none"/></g>'
      : L.glasses === 'sun' ? '<g><path d="M86 58.5h13v4.5c0 2.5-2 4-4.5 4h-4c-2.5 0-4.5-1.5-4.5-4z" fill="#141414"/><path d="M103 58.5h13v4.5c0 2.5-2 4-4.5 4h-4c-2.5 0-4.5-1.5-4.5-4z" fill="#141414"/><path d="M99 60h4M86 59.5l-4-1.5M116 59.5l4-1.5" stroke="#141414" stroke-width="1.6"/><path d="M88.5 60.5l3 0M105.5 60.5l3 0" stroke="rgba(255,255,255,.4)" stroke-width="1.2" stroke-linecap="round"/></g>'
      : L.glasses === 'square' ? '<g fill="rgba(255,255,255,.08)" stroke="#1d1d1d" stroke-width="1.5"><rect x="88" y="58" width="11" height="8" rx="2"/><rect x="103" y="58" width="11" height="8" rx="2"/><path d="M99 61h4M88 61l-5-2M114 61l5-2" fill="none"/></g>' : '';
    var hat = '';
    if (m.k === 'gym') hat = '<path d="M82 52q19-8 38 0v5q-19-8-38 0z" fill="#e8743b"/>';
    else if (m.k === 'night') hat = '<path d="M80 56q6-28 24-26 17 2 17 24-19-12-41 2z" fill="#3b4d8a"/><circle cx="123" cy="50" r="4.5" fill="#e9edf5"/>';
    else if (m.k === 'trip') hat = '<rect x="87" y="58" width="13" height="8" rx="3" fill="#111"/><rect x="102" y="58" width="13" height="8" rx="3" fill="#111"/><path d="M100 61h2" stroke="#111" stroke-width="2"/>';
    else if (L.extra === 'cap') hat = '<path d="M81 56c0-12 9-19 20-19s20 7 20 19z" fill="' + shade(T, -.1) + '"/><path d="M118 55h14q2 0 0 3h-14z" fill="' + shade(T, -.25) + '"/>';
    var buds = L.extra === 'earbuds' ? '<circle cx="82" cy="65" r="2.2" fill="#f2f2f2"/><circle cx="120" cy="65" r="2.2" fill="#f2f2f2"/>' : '';
    var neck = MU ? '<path d="M93 80h16l3 10H90z" fill="' + S2 + '"/>' : '<rect x="95" y="80" width="12" height="10" rx="3" fill="' + S2 + '"/>';
    var head = '<g class="bob">' + hairBack + neck + face + beard + brows + eyes + nose + mouthOver + hairTop + (m.k === 'trip' ? '' : glasses) + hat + buds + '</g>';
    /* longer legs: the upper body sits 9 px higher, the legs are stretched to meet it */
    var body = '<g transform="translate(101 -9) scale(' + SX + ' 1) translate(-101 0)">' + torso + detail + extra + '</g>';
    if (m.plain) { sky = ''; lamp = ''; ground = '<ellipse cx="101" cy="160" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>'; }
    if (tired) prop += '<text class="z" x="124" y="40" font-size="13" font-weight="800" fill="#9a9ca5">z</text><text class="z" x="133" y="29" font-size="9" font-weight="800" fill="#9a9ca5">z</text>';
    return '<svg viewBox="0 0 200 200"' + (m.attrs || '') + '>' + (m.plain ? '' : '<rect width="200" height="200" rx="20" fill="' + m.bg + '"/>') + sky + lamp + ground + '<g transform="translate(' + (-DX).toFixed(1) + ' -3)">' + behind + '</g>' + legs + body +
      '<g transform="translate(0 -9)"><g transform="translate(' + DX.toFixed(1) + ' 0)">' + armsL + '</g><g transform="translate(' + (-DX).toFixed(1) + ' 0)">' + arms + '</g>' + head + '</g><g transform="translate(' + (-DX).toFixed(1) + ' ' + (m.k === 'trip' ? 0 : -9) + ')">' + prop + '</g><g transform="translate(0 -9)">' + front + '</g></svg>';
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
    if (!withM.length) return;
    var main = withM[0], pick = l[idx % l.length] || main, m = pick.m || main.m, hr = new Date().getHours();
    if ((hr >= 19 || hr < 6) && m.sky === 'sun') m = Object.assign({}, m, { sky: 'moon', bg: '#121426' });       /* the sky follows the clock */
    if (!box) { box = document.createElement('div'); box.id = 'avHome'; box.className = 'av-home'; box.setAttribute('data-noi18n', ''); hero.appendChild(box); hero.classList.add('has-av'); }
    var html = '<button type="button" class="av-fig" data-avnext aria-label="' + esc(L('Your avatar – tap for the next thing', 'Avataren din – trykk for neste')) + '">' + figure(m).replace('viewBox="0 0 200 200"', 'viewBox="26 16 148 150"') + '</button>' +
      '<p class="av-say" role="status">' + esc(pick.say) + (l.length > 1 ? ' <span class="av-dots">' + l.map(function (_, i) { return '<i' + (i === idx % l.length ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' : '') + '</p>';
    if (box.innerHTML !== html) box.innerHTML = html;
    badge(main.m);
  }
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
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-avnext]')) return;
    idx++; drawHome();
    var f = document.querySelector('#avHome .av-fig'); if (f) { f.classList.remove('hop'); void f.offsetWidth; f.classList.add('hop'); }
  });

  /* ---------- Settings → Pictures & touches → Your avatar ---------- */
  var prevM = 'morning';
  function maker() {
    var host = document.getElementById('dlSet'); if (!host) return;
    var box = document.getElementById('avSet');
    if (!box) { box = document.createElement('div'); box.id = 'avSet'; box.setAttribute('data-noi18n', ''); var first = host.querySelector('.st-sub'); host.firstElementChild ? host.firstElementChild.insertBefore(box, host.firstElementChild.querySelector('.st-sub')) : host.appendChild(box); }
    var Lk = look(), sw = function (k, label, sub) { return '<label class="st-row"><span>' + esc(label) + (sub ? '<small class="st-rsub">' + esc(sub) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-dltouch="' + k + '"' + (on(k) ? ' checked' : '') + '></label>'; };
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-person-bounding-box"></i> ' + L('Your avatar', 'Avataren din') + '</p><div class="st-group">' +
      sw('avatar', L('Avatar on Home', 'Avatar på Hjem'), L('A little you that follows your day', 'En liten deg som følger dagen din')) +
      sw('avBadge', L('Moment badge on your photo', 'Merke på bildet ditt'), L('Coffee, umbrella, gym, trip … in the top bar', 'Kaffe, paraply, trening, reise … i toppen')) +
      '<label class="st-row"><span>' + L('What it says', 'Hva den sier') + '<small class="st-rsub">' + L('The speech bubble is on screen for anyone nearby', 'Snakkeboblen vises for alle i nærheten') + '</small></span><select class="st-select" data-avsay>' +
        [['nomoney', L('All but money', 'Alt unntatt penger')], ['all', L('Everything', 'Alt')], ['fun', L('Only the fun bits', 'Bare det morsomme')]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sayMode() ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="st-group av-maker"><div class="av-prev">' + figure(MOMENTS[prevM], Lk) + '<div class="av-pm">' + ['morning', 'rain', 'gym', 'trip', 'night'].map(function (k) { return '<button type="button" data-avpm="' + k + '" aria-pressed="' + (k === prevM) + '" aria-label="' + k + '"><i class="bi bi-' + MOMENTS[k].i + '"></i></button>'; }).join('') + '</div>' +
      '<div class="av-acts"><button type="button" class="text-btn" data-avrand><i class="bi bi-shuffle"></i> ' + L('Surprise me', 'Overrask meg') + '</button><button type="button" class="text-btn" data-avreset>' + L('Start over', 'Start på nytt') + '</button></div></div>' +
      Object.keys(OPTS).map(function (k) { var g = OPTS[k];
        return '<div class="av-grp"><span>' + esc(g.t) + '</span><div class="av-opts">' + g.o.map(function (o) {
          return g.dots ? '<button type="button" class="av-dot" data-avk="' + k + '" data-avv="' + o[0] + '" aria-pressed="' + (Lk[k] === o[0]) + '" aria-label="' + esc(g.t) + '" style="--c:' + o[0] + '"></button>'
            : '<button type="button" data-avk="' + k + '" data-avv="' + o[0] + '" aria-pressed="' + (Lk[k] === o[0]) + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div></div>'; }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-avk]'); if (b) { var p = {}; p[b.dataset.avk] = b.dataset.avv; setLook(p); maker(); return; }
    if ((b = e.target.closest('[data-avpm]'))) { prevM = b.dataset.avpm; maker(); return; }
    if (e.target.closest('[data-avrand]')) { var r = {}; Object.keys(OPTS).forEach(function (k) { var o = OPTS[k].o; r[k] = o[Math.floor(Math.random() * o.length)][0]; }); setLook(r); maker(); return; }
    if (e.target.closest('[data-avreset]')) { var s = readJSON('dash.settings', {}) || {}; delete s.avatar; try { localStorage.setItem('dash.settings', JSON.stringify(s)); } catch (x) {} window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('avatar:change')); maker(); }
  });
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
  /* the same maker as yours, in a sheet – onSave(look) gets the full look */
  function editor(title, start, onSave) {
    var H = window.HomeLife; if (!H || !H.dialog) return;
    var cur = Object.assign({}, start), pm = 'day';
    var html = function () {
      return '<div class="ave"><div class="ave-head"><b>' + esc(title) + '</b><button type="button" class="icon-btn sm" data-aveclose aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button></div>' +
        '<div class="av-prev ave-prev">' + figure(MOMENTS[pm], cur) + '</div>' +
        '<div class="av-acts"><button type="button" class="text-btn" data-averand><i class="bi bi-shuffle"></i> ' + L('Surprise me', 'Overrask meg') + '</button><span class="spacer"></span><button type="button" class="pill-btn" data-avesave>' + L('Save', 'Lagre') + '</button></div>' +
        Object.keys(OPTS).filter(function (k) { return k !== 'extra'; }).map(function (k) { var g = OPTS[k];
          return '<div class="av-grp"><span>' + esc(g.t) + '</span><div class="av-opts">' + g.o.map(function (o) {
            return g.dots ? '<button type="button" class="av-dot" data-avek="' + k + '" data-avev="' + o[0] + '" aria-pressed="' + (cur[k] === o[0]) + '" aria-label="' + esc(g.t) + '" style="--c:' + o[0] + '"></button>'
              : '<button type="button" data-avek="' + k + '" data-avev="' + o[0] + '" aria-pressed="' + (cur[k] === o[0]) + '">' + esc(o[1]) + '</button>';
          }).join('') + '</div></div>'; }).join('') + '</div>';
    };
    var box;
    var dg = H.dialog('<div class="ave-host" data-noi18n></div>', function (e, close) {
      var b = e.target.closest('[data-avek]');
      if (b) { cur[b.dataset.avek] = b.dataset.avev; box.innerHTML = html(); return; }
      if (e.target.closest('[data-averand]')) { Object.keys(OPTS).forEach(function (k) { if (k === 'extra' || k === 'bottom') return; var o = OPTS[k].o; cur[k] = o[Math.floor(Math.random() * o.length)][0]; }); box.innerHTML = html(); return; }
      if (e.target.closest('[data-avesave]')) { onSave(cur); close(); return; }
      if (e.target.closest('[data-aveclose]')) close();
    });
    box = dg && dg.el.querySelector('.ave-host'); if (box) box.innerHTML = html();
  }
  window.Avatar = { figure: figure, look: look, moments: moments, personLook: personLook, editor: editor, MOMENTS: MOMENTS };
})();
