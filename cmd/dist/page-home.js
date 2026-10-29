/* Built by cmd/build.py from: settings.js, website.js, texts.js, script.js, budget.js, money.js, places.js, today.js, flow.js, calendar/cal-core.js, calendar/cal-settings.js, cal-card.js, upnext.js, review.js, brief.js, checkin.js, checklists.js, kit.js, tools.js, profile.js, links.js, tidy.js – edit those files, not this one. */
/* ===== settings.js ===== */
try {
/* Settings: appearance, dashboard, security and data.
   Stored in dash.settings and included in the encrypted, synced vault,
   so your choices follow you to every device. */
(function () {
  "use strict";

  var KEY = 'dash.settings';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  var ACCENTS = {
    teal:   { hex: '#14b8a6', rgb: '20, 184, 166', name: 'Teal' },
    blue:   { hex: '#3987e5', rgb: '57, 135, 229', name: 'Blue' },
    purple: { hex: '#8a6fdf', rgb: '138, 111, 223', name: 'Purple' },
    pink:   { hex: '#d55181', rgb: '213, 81, 129', name: 'Pink' },
    orange: { hex: '#e8743b', rgb: '232, 116, 59', name: 'Orange' },
    green:  { hex: '#22b35e', rgb: '34, 179, 94', name: 'Green' }
  };
  var CARDS = [
    ['brief', 'At a glance'], ['weather', 'Weather'], ['calendar', 'Calendar'], ['transit', 'Travel & departures'], ['habits', 'Habits'], ['flex', 'Work today (flex time)'],
    ['fin', 'Money'], ['todo', 'To-do'], ['goals', 'Goals'], ['links', 'Quick links'], ['notes', 'Notes']
  ];
  /* Cards can be moved within their section; finances keep their own layout */
  var GROUPS = [
    { id: 'today', name: 'Today', cards: ['brief', 'weather', 'calendar', 'transit', 'habits', 'flex', 'fin'], move: true },
    { id: 'tasks', name: 'Tasks & notes', cards: ['todo', 'goals', 'links', 'notes'], move: true }
  ];
  /* cards that belong to a part you can switch off in Settings → Features */
  var CARD_FEATURE = { calendar: 'calendar', transit: 'travel', habits: 'habits', flex: 'flex', fin: 'finance' };
  function featureOn(id) { return !window.Features || !CARD_FEATURE[id] || window.Features.on(CARD_FEATURE[id]); }
  var CARD_NAME = {};
  CARDS.forEach(function (c) { CARD_NAME[c[0]] = c[1]; });
  function ordered(s, g) {
    var o = Array.isArray(s.order) ? s.order : [];
    return g.cards.slice().sort(function (a, b) {
      var ia = o.indexOf(a), ib = o.indexOf(b);
      return (ia < 0 ? 99 + g.cards.indexOf(a) : ia) - (ib < 0 ? 99 + g.cards.indexOf(b) : ib);
    });
  }
  /* The time of day moves a few Today cards up, right under At a glance (your order stays as it is):
     mornings – departures and weather; evenings – habits and money. Off in Settings → Dashboard. */
  var TIME_UP = { morning: ['transit', 'weather'], evening: ['habits', 'fin'] };
  function partOfDay(h) { return h >= 5 && h < 10 ? 'morning' : h >= 17 && h < 24 ? 'evening' : ''; }
  function byTime(s, g, list) {
    if (g.id !== 'today' || s.adapt === false) return list;
    var up = TIME_UP[partOfDay(new Date().getHours())];
    if (!up) return list;
    var first = list.filter(function (id) { return id === 'brief'; }), boosted = up.filter(function (id) { return list.indexOf(id) > -1; });
    return first.concat(boosted, list.filter(function (id) { return id !== 'brief' && boosted.indexOf(id) < 0; }));
  }
  var BGS = [['moon', 'Moon'], ['aurora', 'Aurora'], ['dusk', 'Dusk'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['none', 'None'], ['custom', 'Your photo']];
  /* Your own colour: any hex value, with readable text on top */
  function hexOk(h) { return /^#[0-9a-f]{6}$/i.test(h || ''); }
  function hexRgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function accentOf(s) {
    if (s.accent === 'custom' && hexOk(s.accentHex)) {
      var c = hexRgb(s.accentHex);
      return { hex: s.accentHex, rgb: c.join(', '), name: 'Custom', custom: true, light: bright(c) > 150 };
    }
    return ACCENTS[s.accent] || ACCENTS.teal;
  }
  /* perceived brightness 0–255: light colours get dark text, dark colours white text */
  function bright(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  var DEFAULTS = { theme: 'dark', accent: 'teal', bgType: 'moon', bgStrength: null, name: 'Lundberg', seconds: true, quotes: true, hide: {}, lockMins: 60, glass: false, glassStrength: 60, cardStyle: null, density: 'comfortable', corners: 'round', textSize: 'm', clock: 'big', tips: 'fold' };

  /* Your own photo is kept on this device only (IndexedDB), resized to save space. */
  var customUrl = null, customLoaded = false;
  function bgDb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('dash-bg', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('img'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result, tx = db.transaction('img', mode), q = fn(tx.objectStore('img'));
        tx.oncomplete = function () { db.close(); resolve(q && q.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function useCustom(blob) {
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = blob ? URL.createObjectURL(blob) : null;
    customLoaded = true;
    root.style.setProperty('--bg-custom', customUrl ? 'url("' + customUrl + '")' : 'none');
    apply();
  }
  function loadCustom() {
    if (!window.indexedDB) { useCustom(null); return; }
    bgDb('readonly', function (st) { return st.get('custom'); }).then(useCustom, function () { useCustom(null); });
  }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 2200, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', .85);
      };
      img.onerror = function () { reject(new Error('read')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function get() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    if (!s.bgType && s.bg === false) s.bgType = 'none';
    var out = Object.assign({}, DEFAULTS, s);
    out.hide = Object.assign({}, s.hide || {});
    return out;
  }
  function set(patch) {
    var s = Object.assign(get(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    apply();
    window.dispatchEvent(new Event('dash:local'));      // lock.js adds it to the synced vault
    window.dispatchEvent(new Event('dash:settings'));   // script.js updates greeting, clock, quotes
  }

  var media = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;

  var media2 = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function cardStyleOf(s) { return ['solid', 'glass', 'minimal', 'soft'].indexOf(s.cardStyle) > -1 ? s.cardStyle : (s.glass ? 'glass' : 'solid'); }
  function motionOf(s) { return s.motion || (media2 && media2.matches ? 'off' : 'full'); }
  function apply() {
    var s = get();
    var mo = motionOf(s);
    ['full', 'subtle', 'off'].forEach(function (m) { root.classList.toggle('mo-' + m, m === mo); });
    var theme = s.theme === 'auto' ? (media && media.matches ? 'light' : 'dark') : s.theme;
    root.setAttribute('data-theme', theme);
    var a = accentOf(s);
    root.style.setProperty('--accent', a.hex);
    root.style.setProperty('--accent-rgb', a.rgb);
    if (a.custom) root.style.setProperty('--on-accent', a.light ? '#0a0b0c' : '#ffffff');
    else root.style.removeProperty('--on-accent');
    var bg = s.bgType;
    if (bg === 'custom' && !customUrl) bg = 'moon';      // photo not on this device (yet)
    root.setAttribute('data-bg', bg);
    if (s.bgStrength) root.style.setProperty('--bg-strength', s.bgStrength / 100);
    else root.style.removeProperty('--bg-strength');
    var cst = cardStyleOf(s);
    ['solid', 'minimal', 'soft'].forEach(function (k) { root.classList.toggle('card-' + k, cst === k); });
    root.classList.toggle('glass', cst === 'glass');
    root.style.setProperty('--glass', (+s.glassStrength || 60) / 100);
    root.classList.toggle('dens-compact', s.density === 'compact');
    root.classList.toggle('corners-sharp', s.corners === 'sharp');
    root.classList.toggle('text-lg', s.textSize === 'l');
    root.classList.toggle('text-sm', s.textSize === 's');
    root.classList.toggle('clock-compact', s.clock === 'compact');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f3f5' : '#0e0f11');
    CARDS.forEach(function (c) { root.classList.toggle('hide-' + c[0], !!s.hide[c[0]]); });
    /* your order: CSS order inside each grid, so nothing on the page has to be rebuilt */
    GROUPS.forEach(function (g) {
      if (!g.move) return;
      byTime(s, g, ordered(s, g)).forEach(function (id, i) {
        document.querySelectorAll(id === 'fin' ? '.grid > #fin' : '.grid > .card.' + id).forEach(function (el) { el.style.order = i; });   // the Money card is #fin
      });
    });
    /* Hide a section heading when every card in it is hidden */
    document.querySelectorAll('.dash-sec').forEach(function (sec) {
      var cards = sec.querySelectorAll('.card');
      sec.hidden = cards.length > 0 && Array.prototype.every.call(cards, function (c) {
        return CARDS.some(function (k) { return s.hide[k[0]] && c.classList.contains(k[0]); });
      });
    });
    if ($('settings') && !$('settings').hidden) fill();
    if (typeof balanceSoon === 'function') balanceSoon();
  }
  if (media && media.addEventListener) media.addEventListener('change', apply);

  /* ---------- panel ---------- */
  function fill() {
    var s = get();
    document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeOpt === s.theme));
    });
    var mo = motionOf(s);
    document.querySelectorAll('[data-motion-opt]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.motionOpt === mo)); });
    $('stMotionNote').textContent = { full: 'Cards rise in, pages cross-fade.', subtle: 'Pages cross-fade, nothing else moves.', off: 'No animation at all.' }[mo] +
      (!s.motion && media2 && media2.matches ? ' Your device asks for reduced motion.' : '');
    var own = accentOf(s);
    $('stAccents').innerHTML = Object.keys(ACCENTS).map(function (k) {
      return '<button type="button" class="swatch" data-accent="' + k + '" style="--sw:' + ACCENTS[k].hex + '" aria-label="' +
        ACCENTS[k].name + '" aria-pressed="' + (s.accent === k) + '"></button>';
    }).join('') +
      '<label class="swatch swatch-own' + (own.custom ? ' on' : '') + '"' + (own.custom ? ' style="--sw:' + own.hex + '"' : '') + ' title="Choose your own colour">' +
      '<input type="color" id="stAccentPick" value="' + (hexOk(s.accentHex) ? s.accentHex : '#14b8a6') + '" aria-label="Choose your own accent colour"></label>';
    $('stAccentHex').hidden = !own.custom;
    if (own.custom) {
      var c = hexRgb(own.hex), b = bright(c), dark = root.getAttribute('data-theme') !== 'light';
      if (document.activeElement !== $('stAccentHex').querySelector('input')) $('stAccentHex').querySelector('input').value = own.hex.toUpperCase();
      $('stAccentHex').querySelector('small').textContent = 'RGB ' + c.join(', ') +
        (dark && b < 70 ? ' · very dark: text in this colour may be hard to read' : !dark && b > 200 ? ' · very light: text in this colour may be hard to read' : '');
    }
    $('stBgTiles').innerHTML = BGS.map(function (b) {
      var k = b[0];
      var prev = k === 'none' ? '<i class="bi bi-slash-circle ico"></i>'
        : k === 'custom' ? (customUrl ? '<span class="prev custom"></span>' : '<i class="bi bi-image ico"></i>')
        : '<span class="prev ' + (k === 'moon' ? 'moon' : 'bg-' + k) + '"></span>';
      return '<button type="button" class="bg-tile ' + k + (k === 'custom' && !customUrl ? ' add' : '') + '" data-bg="' + k +
        '" aria-pressed="' + (s.bgType === k) + '">' + prev + '<span class="lbl">' + (k === 'custom' && !customUrl ? 'Add photo' : b[1]) + '</span></button>';
    }).join('');
    $('stBgNote').innerHTML = s.bgType === 'custom'
      ? (customUrl ? 'Your photo is saved on this device only.<button type="button" class="st-linkbtn" id="stBgChange">Change photo</button>'
                   : 'Your photo is on another device. Add it here too, or pick another background.')
      : '';
    $('stStrengthRow').hidden = s.bgType === 'none';
    var cst = cardStyleOf(s);
    document.querySelectorAll('[data-cardstyle]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cardstyle === cst)); });
    document.querySelectorAll('[data-density]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.density === (s.density || 'comfortable'))); });
    document.querySelectorAll('[data-corners]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.corners === (s.corners || 'round'))); });
    document.querySelectorAll('[data-textsize]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.textsize === (s.textSize || 'm'))); });
    document.querySelectorAll('[data-langopt]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.langopt === (s.lang === 'nb' ? 'nb' : 'en'))); });
    document.querySelectorAll('[data-clockstyle]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.clockstyle === (s.clock || 'big'))); });
    document.querySelectorAll('[data-tipsmode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tipsmode === (s.tips || 'fold'))); });
    $('stGlassRow').hidden = cst !== 'glass';
    if (document.activeElement !== $('stGlassStr')) $('stGlassStr').value = +s.glassStrength || 60;
    $('stCardNote').textContent = { solid: 'Calm, dark cards – the original look.', glass: s.bgType === 'none' ? 'Frosted and see-through. Shows best on a background – pick one above.' : 'Frosted and see-through. Use the slider for how much.',
      minimal: 'No boxes – just lines between sections.', soft: 'Raised cards with soft shadows, like phone widgets.' }[cst];
    var cs = getComputedStyle(document.querySelector('.bg'));
    $('stStrength').value = s.bgStrength || Math.round(parseFloat(cs.opacity) * 100) || 30;
    if (document.activeElement !== $('stName')) $('stName').value = s.name;
    $('stSeconds').checked = !!s.seconds;
    $('stQuotes').checked = !!s.quotes;
    if ($('stAdapt')) $('stAdapt').checked = s.adapt !== false;
    $('stCards').innerHTML = GROUPS.map(function (g) {
      var all = ordered(s, g), list = all.filter(featureOn);
      if (!list.length) return '';
      return '<p class="st-cardgroup">' + g.name + '</p>' + list.map(function (id, i) {
        var tools = g.move
          ? '<button type="button" data-cmove="' + g.id + ':' + id + ':-1" aria-label="Move ' + CARD_NAME[id] + ' up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button>' +
            '<button type="button" data-cmove="' + g.id + ':' + id + ':1" aria-label="Move ' + CARD_NAME[id] + ' down"' + (i === list.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>'
          : '';
        return '<div class="st-row st-card' + (s.hide[id] ? ' off' : '') + '" data-cid="' + id + '"' + (g.move ? ' draggable="true"' : '') + '>' +
          (g.move ? '<i class="bi bi-grip-vertical st-grip" aria-hidden="true"></i>' : '') + '<span>' + CARD_NAME[id] + '</span>' +
          '<span class="ws-tools">' + tools + '<input type="checkbox" class="switch" data-card="' + id + '" aria-label="Show ' + CARD_NAME[id] + '"' +
          (s.hide[id] ? '' : ' checked') + '></span></div>';
      }).join('');
    }).join('');
    $('stLock').value = String(s.lockMins);
    var sync = $('syncState');
    $('stSync').innerHTML = sync ? sync.innerHTML : '';

    /* One-line summaries on the main menu */
    var a = accentOf(s);
    var bgName = (BGS.filter(function (b) { return b[0] === s.bgType; })[0] || BGS[0])[1];
    $('sumAppearance').textContent = { dark: 'Dark', light: 'Light', auto: 'Auto' }[s.theme] + ' · ' + a.name + ' · ' + bgName + ' · ' + { solid: 'Solid', glass: 'Glass', minimal: 'Minimal', soft: 'Soft' }[cardStyleOf(s)] + ' cards';
    var avail = CARDS.filter(function (c) { return featureOn(c[0]); });
    var shown = avail.filter(function (c) { return !s.hide[c[0]]; }).length;
    $('sumDashboard').textContent = shown + ' of ' + avail.length + ' cards' + (s.name ? ' · ' + s.name : '');
    var m = +s.lockMins;
    $('sumSecurity').textContent = 'Locks after ' + (m >= 1440 ? '1 day' : m >= 60 ? (m / 60) + ' hour' + (m > 60 ? 's' : '') : m + ' min');
    var st = sync ? sync.className : '';
    $('sumData').textContent = /sync-ok/.test(st) ? 'Synced' : /sync-busy/.test(st) ? 'Syncing…' : /offline/.test(st) ? 'Offline' : 'This device only';
  }

  /* ---------- pages (like iPhone Settings) ---------- */
  var page = 'home';
  /* Pages slide like on a phone: the new one comes in from the right while the old one
     glides away to the left (and the other way round going back). */
  function go(name, back) {
    var prev = page, panel = document.querySelector('.st-panel');
    page = name;
    var old = document.querySelector('.st-page[data-page="' + prev + '"]');
    var cur = document.querySelector('.st-page[data-page="' + name + '"]');
    var anim = old && old !== cur && !old.hidden && $('settings').classList.contains('open') &&
      !document.documentElement.classList.contains('mo-off') && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (anim) {
      old.style.top = (old.offsetTop - panel.scrollTop) + 'px';
      old.style.left = old.offsetLeft + 'px';
      old.style.width = old.offsetWidth + 'px';
      old.classList.remove('in-fwd', 'in-back');
      old.classList.add(back ? 'out-back' : 'out-fwd');
      clearTimeout(old._t);
      old._t = setTimeout(function () {
        old.classList.remove('out-fwd', 'out-back');
        old.style.top = old.style.left = old.style.width = '';
        old.hidden = page !== old.dataset.page;
      }, 470);
    }
    document.querySelectorAll('.st-page').forEach(function (el) {
      var on = el === cur;
      if (anim && el === old) return;
      if (on) { clearTimeout(el._t); el.classList.remove('out-fwd', 'out-back'); el.style.top = el.style.left = el.style.width = ''; }
      el.hidden = !on;
      el.classList.remove('in-fwd', 'in-back');
      if (on && anim) { void el.offsetWidth; el.classList.add(back ? 'in-back' : 'in-fwd'); }
    });
    var t = $('stTitle');
    t.innerHTML = name === 'home' ? 'Settings' : cur.dataset.title;
    $('stBack').hidden = name === 'home';
    if (anim) [t, $('stBack')].forEach(function (x) { x.classList.remove('st-fade'); void x.offsetWidth; x.classList.add('st-fade'); });
    $('stMsg').textContent = '';
    $('pcForm').hidden = true;
    panel.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('st:page', { detail: name }));   // website.js listens
  }
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.go); });
  });
  $('stBack').addEventListener('click', function () { fill(); go('home', true); });

  function openPanel() {
    fill();
    go('home');
    $('settings').hidden = false;
    document.body.classList.add('st-open');
    requestAnimationFrame(function () { $('settings').classList.add('open'); });
  }
  function closePanel() {
    var el = $('settings');
    el.classList.remove('open');
    var pn = el.querySelector('.st-panel'); pn.style.transition = ''; pn.style.transform = ''; el.style.background = '';
    document.body.classList.remove('st-open');
    $('pcForm').hidden = true;
    $('stMsg').textContent = '';
    setTimeout(function () { if (!el.classList.contains('open')) el.hidden = true; }, 460);
    /* opened from another page (the avatar there): go back to that page */
    var back = null;
    try { back = sessionStorage.getItem('dash.stFrom'); sessionStorage.removeItem('dash.stFrom'); } catch (e) {}
    if (back && /^\/cmd\/[a-z]+\/$/.test(back)) setTimeout(function () { location.href = back; }, 180);
  }

  $('settingsBtn').addEventListener('click', openPanel);
  $('stClose').addEventListener('click', closePanel);
  $('settings').addEventListener('click', function (e) { if (e.target === this) closePanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('settings').hidden) { if (page !== 'home') { fill(); go('home', true); } else closePanel(); } });

  document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
    b.addEventListener('click', function () { set({ theme: b.dataset.themeOpt }); });
  });
  document.querySelectorAll('[data-motion-opt]').forEach(function (b) {
    b.addEventListener('click', function () { set({ motion: b.dataset.motionOpt }); });
  });
  $('stAccents').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accent]');
    if (b) set({ accent: b.dataset.accent });
  });
  /* live preview while dragging the colour picker, saved when you let go */
  $('stAccents').addEventListener('input', function (e) {
    if (e.target.id !== 'stAccentPick') return;
    var h = e.target.value, c = hexRgb(h);
    root.style.setProperty('--accent', h);
    root.style.setProperty('--accent-rgb', c.join(', '));
    root.style.setProperty('--on-accent', bright(c) > 150 ? '#0a0b0c' : '#ffffff');
    e.target.parentNode.style.setProperty('--sw', h);
  });
  $('stAccents').addEventListener('change', function (e) {
    if (e.target.id === 'stAccentPick') set({ accent: 'custom', accentHex: e.target.value.toLowerCase() });
  });
  $('stAccentHex').querySelector('input').addEventListener('change', function () {
    var v = this.value.trim();
    if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
    var m = v.match(/^\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*$/);   // also accepts "20, 184, 166"
    if (m) v = '#' + [m[1], m[2], m[3]].map(function (n) { return Math.min(255, +n).toString(16).padStart(2, '0'); }).join('');
    if (hexOk(v)) { set({ accent: 'custom', accentHex: v.toLowerCase() }); this.value = v.toUpperCase(); this.blur(); }
    else this.value = (get().accentHex || '').toUpperCase();
  });
  $('stBgTiles').addEventListener('click', function (e) {
    var t = e.target.closest('[data-bg]');
    if (!t) return;
    var k = t.dataset.bg;
    if (k === 'custom' && !customUrl) { $('stBgFile').click(); return; }
    set({ bgType: k, bgStrength: null });
  });
  $('stBgNote').addEventListener('click', function (e) { if (e.target.id === 'stBgChange') $('stBgFile').click(); });
  $('stBgFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    $('stBgNote').textContent = 'Preparing your photo…';
    shrink(f).then(function (blob) {
      return bgDb('readwrite', function (st) { return st.put(blob, 'custom'); }).then(function () {
        useCustom(blob);
        set({ bgType: 'custom', bgStrength: null });
      });
    }).catch(function () { $('stBgNote').textContent = 'That photo couldn’t be used. Try a JPEG or PNG.'; });
  });
  $('stStrength').addEventListener('input', function () {
    root.style.setProperty('--bg-strength', this.value / 100);
  });
  $('stStrength').addEventListener('change', function () { set({ bgStrength: +this.value }); });
  /* Glass: frosted, see-through cards. The slider previews live and saves when you let go. */
  $('stCardStyle').addEventListener('click', function (e) { var b = e.target.closest('[data-cardstyle]'); if (b) set({ cardStyle: b.dataset.cardstyle, glass: b.dataset.cardstyle === 'glass' }); });
  document.querySelectorAll('[data-density]').forEach(function (b) { b.addEventListener('click', function () { set({ density: b.dataset.density }); }); });
  document.querySelectorAll('[data-corners]').forEach(function (b) { b.addEventListener('click', function () { set({ corners: b.dataset.corners }); }); });
  document.querySelectorAll('[data-textsize]').forEach(function (b) { b.addEventListener('click', function () { set({ textSize: b.dataset.textsize }); }); });
  /* language: the page reloads in the new language (settings are saved and synced first) */
  document.querySelectorAll('[data-langopt]').forEach(function (b) { b.addEventListener('click', function () {
    var was = (get().lang === 'nb' ? 'nb' : 'en'); if (b.dataset.langopt === was) return;
    set({ lang: b.dataset.langopt });
    setTimeout(function () { location.href = location.pathname + '?settings=appearance'; }, 600);
  }); });
  document.querySelectorAll('[data-clockstyle]').forEach(function (b) { b.addEventListener('click', function () { set({ clock: b.dataset.clockstyle }); }); });
  document.querySelectorAll('[data-tipsmode]').forEach(function (b) { b.addEventListener('click', function () { set({ tips: b.dataset.tipsmode }); window.dispatchEvent(new Event('tips:change')); }); });
  $('stGlassStr').addEventListener('input', function () { root.style.setProperty('--glass', this.value / 100); });
  $('stGlassStr').addEventListener('change', function () { set({ glassStrength: +this.value }); });
  $('stName').addEventListener('change', function () { set({ name: this.value.trim() }); });
  $('stSeconds').addEventListener('change', function () { set({ seconds: this.checked }); });
  $('stQuotes').addEventListener('change', function () { set({ quotes: this.checked }); });
  if ($('stAdapt')) $('stAdapt').addEventListener('change', function () { set({ adapt: this.checked }); });
  /* No lonely card at the end of Today: "This week" (habits) only spans two columns when that fills the rows */
  function balance() {
    var br = document.querySelector('.grid > .card.brief'), g = br && br.parentNode, hb = g && g.querySelector(':scope > .card.habits');
    if (!hb) return;
    hb.classList.remove('hb-narrow');
    var cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    if (cols < 2 || !hb.offsetParent) return;
    function units() {
      var n = 0;
      Array.prototype.forEach.call(g.children, function (c) {
        if (!c.offsetParent || c === br) return;
        var r = c.getBoundingClientRect(), w = g.getBoundingClientRect().width;
        n += Math.max(1, Math.round(r.width / (w / cols)));
      });
      return n;
    }
    if (units() % cols === 0) return;
    hb.classList.add('hb-narrow');
    if (units() % cols !== 0) hb.classList.remove('hb-narrow');
  }
  var balT = null;
  function balanceSoon() { clearTimeout(balT); balT = setTimeout(balance, 60); }
  window.addEventListener('resize', balanceSoon);
  ['features:change', 'tools:change', 'dash:local'].forEach(function (ev) { window.addEventListener(ev, balanceSoon); });
  if (window.Vault) { window.Vault.onUnlock(function () { setTimeout(balance, 150); setTimeout(balance, 900); }); }
  window.Dash = window.Dash || {};
  var prevBal = window.Dash.reload;
  window.Dash.reload = function () { if (prevBal) prevBal(); balanceSoon(); };

  /* the part of the day changes while the page is open */
  var lastPart = partOfDay(new Date().getHours());
  setInterval(function () { var p = partOfDay(new Date().getHours()); if (p !== lastPart) { lastPart = p; apply(); } }, 5 * 60000);
  $('stCards').addEventListener('change', function (e) {
    var c = e.target.dataset.card;
    if (!c) return;
    var hide = get().hide;
    hide[c] = !e.target.checked;
    set({ hide: hide });
  });
  /* move cards: arrows everywhere, drag and drop on a computer */
  function moveCard(gid, id, to) {
    var s = get(), g = GROUPS.filter(function (x) { return x.id === gid; })[0];
    var list = ordered(s, g), from = list.indexOf(id);
    if (from < 0 || to < 0 || to >= list.length || to === from) return;
    list.splice(from, 1); list.splice(to, 0, id);
    var order = [];
    GROUPS.forEach(function (x) { order = order.concat(x.id === gid ? list : ordered(s, x)); });
    set({ order: order });
  }
  $('stCards').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cmove]');
    if (!b) return;
    var p = b.dataset.cmove.split(':'), g = GROUPS.filter(function (x) { return x.id === p[0]; })[0];
    var all = ordered(get(), g), vis = all.filter(featureOn), nb = vis[vis.indexOf(p[1]) + +p[2]];
    if (nb) moveCard(p[0], p[1], all.indexOf(nb));
    var again = document.querySelector('[data-cmove="' + b.dataset.cmove + '"]');
    if (again && !again.disabled) again.focus();
  });
  var dragId = null;
  function groupOf(id) { return GROUPS.filter(function (g) { return g.cards.indexOf(id) > -1; })[0]; }
  $('stCards').addEventListener('dragstart', function (e) {
    var row = e.target.closest('[data-cid]');
    if (!row) return;
    dragId = row.dataset.cid; row.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
  });
  $('stCards').addEventListener('dragover', function (e) {
    var row = e.target.closest('[data-cid]');
    if (!row || !dragId || groupOf(row.dataset.cid) !== groupOf(dragId)) return;
    e.preventDefault();
    document.querySelectorAll('.st-card.drop').forEach(function (r) { if (r !== row) r.classList.remove('drop'); });
    row.classList.add('drop');
  });
  $('stCards').addEventListener('drop', function (e) {
    var row = e.target.closest('[data-cid]');
    if (!row || !dragId) return;
    e.preventDefault();
    var g = groupOf(dragId);
    if (g === groupOf(row.dataset.cid)) moveCard(g.id, dragId, ordered(get(), g).indexOf(row.dataset.cid));
  });
  $('stCards').addEventListener('dragend', function () {
    dragId = null;
    document.querySelectorAll('.st-card.dragging, .st-card.drop').forEach(function (r) { r.classList.remove('dragging', 'drop'); });
  });
  /* move cards with your finger: hold the grip and slide up or down */
  var td = null;
  $('stCards').addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.st-grip');
    if (!g || e.pointerType === 'mouse') return;
    var row = g.closest('.st-card');
    e.preventDefault();
    td = { row: row, id: row.dataset.cid, y0: e.clientY, before: undefined };
    try { g.setPointerCapture(e.pointerId); } catch (x) {}
    row.classList.add('lifting');
    if (navigator.vibrate) navigator.vibrate(8);
  });
  $('stCards').addEventListener('pointermove', function (e) {
    if (!td) return;
    td.row.style.transform = 'translateY(' + (e.clientY - td.y0) + 'px)';
    var g = groupOf(td.id), rows = Array.prototype.filter.call(document.querySelectorAll('#stCards .st-card'), function (r) { return r !== td.row && groupOf(r.dataset.cid) === g; });
    var before = null;
    for (var i = 0; i < rows.length; i++) { var r = rows[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = rows[i]; break; } }
    rows.forEach(function (r) { r.classList.toggle('drop', r === before); r.classList.toggle('drop-end', !before && r === rows[rows.length - 1]); });
    td.before = before;
  });
  function tdEnd(cancel) {
    if (!td) return;
    var d = td; td = null;
    d.row.classList.remove('lifting'); d.row.style.transform = '';
    document.querySelectorAll('.st-card.drop, .st-card.drop-end').forEach(function (r) { r.classList.remove('drop', 'drop-end'); });
    if (cancel || d.before === undefined) return;
    var g = groupOf(d.id), rest = ordered(get(), g).filter(function (x) { return x !== d.id; });
    moveCard(g.id, d.id, d.before ? rest.indexOf(d.before.dataset.cid) : rest.length);
  }
  $('stCards').addEventListener('pointerup', function () { tdEnd(false); });
  $('stCards').addEventListener('pointercancel', function () { tdEnd(true); });

  /* On a phone: pull the sheet down to close it, swipe from the left edge to go back */
  (function () {
    var bd = $('settings'), pn = bd.querySelector('.st-panel'), sd = null;
    pn.addEventListener('touchstart', function (e) {
      if (td || e.target.closest('input[type=range], .st-grip, textarea')) return;
      var t = e.touches[0];
      sd = { x0: t.clientX, y0: t.clientY, t0: Date.now(), mode: null, top: pn.scrollTop <= 0, dy: 0, dx: 0 };
    }, { passive: true });
    pn.addEventListener('touchmove', function (e) {
      if (!sd) return;
      var t = e.touches[0], dx = t.clientX - sd.x0, dy = t.clientY - sd.y0;
      sd.dx = dx; sd.dy = dy;
      if (!sd.mode) {
        if (sd.top && window.innerWidth <= 600 && dy > 8 && dy > Math.abs(dx)) sd.mode = 'down';
        else if (page !== 'home' && sd.x0 < 32 && dx > 10 && dx > Math.abs(dy)) sd.mode = 'back';
        else if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { sd = null; return; }
        else return;
        pn.style.transition = 'none';
      }
      e.preventDefault();
      if (sd.mode === 'down') {
        pn.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
        bd.style.background = 'rgba(0,0,0,' + (0.45 * Math.max(0, 1 - dy / pn.offsetHeight)).toFixed(3) + ')';
      }
    }, { passive: false });
    pn.addEventListener('touchend', function () {
      if (!sd) return;
      var d = sd; sd = null;
      if (!d.mode) return;
      pn.style.transition = '';
      var fast = (Date.now() - d.t0) < 260;
      if (d.mode === 'down') {
        if (d.dy > 120 || (fast && d.dy > 40)) closePanel();
        else { pn.style.transform = ''; bd.style.background = ''; }
      } else if (d.dx > 90 || (fast && d.dx > 40)) { fill(); go('home', true); }
    });
  })();

  $('stLock').addEventListener('change', function () { set({ lockMins: +this.value }); });

  /* Security */
  function stMsg(t, ok) { $('stMsg').textContent = t; $('stMsg').classList.toggle('ok', !!ok); }
  $('stChangePc').addEventListener('click', function () {
    $('pcForm').hidden = !$('pcForm').hidden;
    stMsg('');
    if (!$('pcForm').hidden) $('pcNew').focus();
  });
  $('pcCancel').addEventListener('click', function () { $('pcForm').hidden = true; });
  $('pcForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('pcNew').value;
    if (p.length < 6) { stMsg('Use at least 6 characters.'); return; }
    if (p !== $('pcConfirm').value) { stMsg('The two passcodes don’t match.'); return; }
    window.Vault.changePasscode(p).then(function () {
      $('pcNew').value = '';
      $('pcConfirm').value = '';
      $('pcForm').hidden = true;
      stMsg('Passcode changed. Your other devices will ask for the new one.', true);
    }, function () { stMsg('Couldn’t change the passcode. Try again.'); });
  });
  $('stLockNow').addEventListener('click', function () { closePanel(); window.Vault.lock(); });

  /* Data */
  $('stSyncNow').addEventListener('click', function () {
    window.Vault.sync().then(function () { setTimeout(fill, 300); });
    setTimeout(fill, 50);
  });
  /* restore: pick the file, check it, ask, then replace */
  var restoreText = null;
  function backupWhen() {
    var d = window.Vault && window.Vault.get(), t = (d && d.lastBackup) || +localStorage.getItem('dash.lastBackup') || 0;
    if ($('stBackupWhen')) $('stBackupWhen').textContent = t ? 'Last one ' + new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'You haven’t taken one yet';
  }
  window.addEventListener('dash:backup', backupWhen);
  /* What's saved: a quick count, so you can see your data is there (and where a CSV import went) */
  function inventory() {
    var box = $('stInventory'); if (!box || !window.Vault) return;
    var d = window.Vault.get() || {}, ex = d.expenses || [], bank = ex.filter(function (e) { return e.src === 'bank'; });
    var dates = ex.map(function (e) { return e.date; }).filter(Boolean).sort();
    var mon = function (k) { return new Date(k + 'T12:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
    var rd = function (k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
    var todos = rd('dash.todos') || [], cal = rd('dash.calendar') || {}, evs = (cal.events || cal.list || []).length;
    var lines = [
      ['wallet2', ex.length ? ex.length + ' expense' + (ex.length === 1 ? '' : 's') + (dates.length ? ' · ' + (mon(dates[0]) === mon(dates[dates.length - 1]) ? mon(dates[0]) : mon(dates[0]) + ' – ' + mon(dates[dates.length - 1])) : '') : 'No expenses'],
      ['upload', bank.length ? bank.length + ' from bank files' + (d.lastImport ? ' · last import ' + new Date(d.lastImport + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '') : (d.lastImport ? 'Bank file imported ' + new Date(d.lastImport + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – no expenses kept' : 'No bank file imported')],
      ['pie-chart', d.budget && ((d.budget.income || []).length || (d.budget.fixed || []).length) ? 'Budget set up' : 'No budget yet'],
      ['check2-square', todos.length + ' to-do' + (todos.length === 1 ? '' : 's') + (evs ? ' · ' + evs + ' calendar events' : '')],
      ['heart-pulse', d.health && d.health.days ? Object.keys(d.health.days).length + ' days from Apple Health' : 'No Apple Health data']
    ];
    box.innerHTML = lines.map(function (l) { return '<li><i class="bi bi-' + l[0] + '"></i> ' + l[1] + '</li>'; }).join('');
  }
  window.addEventListener('st:page', function (e) { if (e.detail === 'data') inventory(); });
  window.addEventListener('fin:change', inventory);
  if (window.Vault) window.Vault.onUnlock(function () { setTimeout(backupWhen, 0); });
  $('stRestore').addEventListener('click', function () { $('stRestoreFile').value = ''; $('stRestoreFile').click(); });
  $('stRestoreFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    f.text().then(function (t) {
      var v = JSON.parse(t);
      if (!v || v.v !== 1 || !v.ct || !v.iv || !v.salt) throw new Error('bad');
      restoreText = t;
      var m = String(f.name).match(/(\d{4}-\d{2}-\d{2})/);
      $('stRestoreInfo').textContent = 'The file is ' + (m ? 'from ' + new Date(m[1] + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '“' + f.name + '”') + '.';
      $('stRestoreAsk').hidden = false;
      $('stRestoreAsk').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () { stMsg('That file isn’t a dashboard backup.', false); });
  });
  $('stRestoreNo').addEventListener('click', function () { restoreText = null; $('stRestoreAsk').hidden = true; });
  $('stRestoreYes').addEventListener('click', function () {
    if (!restoreText) return;
    var t = restoreText; restoreText = null; $('stRestoreAsk').hidden = true;
    window.Vault.restore(t).catch(function (e) { stMsg(e.message || 'Couldn’t restore that file.', false); });
  });

  $('stBackup').addEventListener('click', function () {
    window.Vault.backup().then(function () {
      stMsg('Backup downloaded. It’s encrypted, so only your passcode can open it.', true);
    });
  });

  window.addEventListener('features:change', function () { if ($('settings') && !$('settings').hidden) fill(); });
  window.addEventListener('dash:local', function () { setTimeout(apply, 0); });
  if (window.Vault) window.Vault.onLock(closePanel);

  window.DashSettings = { get: get, set: set, apply: apply };
  apply();
  loadCustom();
})();
} catch (e) { console.error("settings.js", e); }
/* ===== website.js ===== */
try {
/* Settings → jplundberg.com: announcement, front page sections, featured content, visitors.
   Changes are saved by the dashboard's Cloudflare Worker to _data/site.json in GitHub,
   and GitHub Pages publishes them in about a minute. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var SECTION = {
    about: ['person', 'About'], resume: ['briefcase', 'Experience'], courses: ['mortarboard', 'Courses & certificates'],
    projects: ['kanban', 'Projects'], articles: ['journal-text', 'Latest articles']
  };
  var EDIT_PAGES = ['announce', 'sections', 'featured', 'socials', 'courses', 'progress', 'cv'];
  var cvLang = 'en', jobEdit = null, eduEdit = null;
  var DEFAULT_SOCIALS = [{ net: 'linkedin', url: 'https://www.linkedin.com/in/john-paul-lundberg-8a804623b/' }, { net: 'instagram', url: 'https://www.instagram.com/jp.lundberg.official/' }];
  /* each page has its own Publish button; what it publishes, in words */
  var PART = { announce: [['announcement'], 'Announcement'], sections: [['sections', 'now'], 'Front page'], featured: [['featured'], 'Featured'], socials: [['socials'], 'Socials'],
    courses: [['courses'], 'Courses & certificates'], progress: [['goals'], 'Project progress'], cv: [['cv', 'experience'], 'CV'] };
  function partDirty(keys) { return saved && draft && keys.some(function (key) { return JSON.stringify(saved[key] == null ? null : saved[key]) !== JSON.stringify(draft[key] == null ? null : draft[key]); }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  /* what the dashboard would publish right now: courses marked public, goals marked public */
  function coursesNow() {
    var F = window.Features; if (!F) return [];
    return F.list('learning').filter(function (c) { return c.pub; }).sort(function (a, b) { return String(b.date || '') > String(a.date || '') ? 1 : -1; }).map(function (c) {
      return { title: String(c.title || '').slice(0, 120), org: String(c.provider || '').slice(0, 120), year: String(c.date || '').slice(0, 4), kind: ['course', 'certificate', 'book', 'standard', 'other'].indexOf(c.kind) > -1 ? c.kind : 'course', cv: !!c.cv };
    });
  }
  function goalsNow() {
    return readJSON('dash.goals', []).filter(function (g) { return g.pub; }).map(function (g) {
      return { name: String(g.name || '').slice(0, 120), value: +g.value || 0, target: +g.target || 0, updated: new Date().toISOString().slice(0, 10) };
    });
  }
  /* the saved date is kept when the numbers haven't changed, so nothing looks "unpublished" by itself */
  function syncDerived() {
    if (!draft) return;
    draft.courses = coursesNow();
    draft.goals = goalsNow().map(function (g) {
      var old = (saved.goals || []).filter(function (x) { return x.name === g.name; })[0];
      return old && old.value === g.value && old.target === g.target ? old : g;
    });
  }

  var saved = null, draft = null, sha = null, content = null, loading = null, publishing = false, problem = '';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dirty() { return saved && JSON.stringify(strip(saved)) !== JSON.stringify(strip(draft)); }
  function strip(o) { var c = clone(o); delete c.updated; return c; }

  function load() {
    if (loading) return loading;
    status('Loading…');
    loading = Promise.all([
      fetch('api/site', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }),
      fetch('content.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return { articles: [], projects: [] }; })
    ]).then(function (res) {
      var j = res[0];
      content = res[1];
      if (!j.settings) {
        problem = j.error === 'github not configured' ? 'setup' : 'error';
        throw new Error(j.error || 'failed');
      }
      problem = '';
      saved = j.settings; sha = j.sha;
      /* nothing published yet: the site shows these (_data/socials_default.yml) */
      if (!Array.isArray(saved.socials) || !saved.socials.length && !j.settings.updated) saved.socials = DEFAULT_SOCIALS.slice();
      draft = clone(saved);
      fill(); summary(); status('');
    }).catch(function () {
      loading = null;
      status(problem === 'setup'
        ? 'Connect GitHub first: add GITHUB_TOKEN to the Worker (see the guide).'
        : 'Couldn’t load the website settings. Check your connection and try again.', true);
      summary();
    });
    return loading;
  }

  /* ---------- fill the pages from the draft ---------- */
  function fill() {
    if (!draft) return;
    var a = draft.announcement;
    $('wsAnnOn').checked = a.on;
    if (document.activeElement !== $('wsAnnEn')) $('wsAnnEn').value = a.en;
    if (document.activeElement !== $('wsAnnNb')) $('wsAnnNb').value = a.nb;
    var opts = '<option value="">No link</option>' + groupTitles(content.articles).map(function (x) {
      return '<option value="' + esc(x.url) + '">Article: ' + esc(x.title) + '</option>';
    }).join('') + groupTitles(content.projects).map(function (x) {
      return '<option value="' + esc(x.url) + '">Project: ' + esc(x.title) + '</option>';
    }).join('') + '<option value="custom">Other address…</option>';
    $('wsAnnPick').innerHTML = opts;
    var known = Array.prototype.some.call($('wsAnnPick').options, function (o) { return o.value === a.link; });
    $('wsAnnPick').value = !a.link ? '' : known ? a.link : 'custom';
    $('wsAnnLink').hidden = $('wsAnnPick').value !== 'custom';
    if (document.activeElement !== $('wsAnnLink')) $('wsAnnLink').value = a.link;
    preview();

    var n = draft.sections.length;
    $('wsSections').innerHTML =
      '<div class="st-row ws-fixed"><span><i class="bi bi-image"></i> Intro (name and title)</span><i class="bi bi-lock" title="Always first"></i></div>' +
      draft.sections.map(function (s, i) {
        var m = SECTION[s.id];
        return '<div class="st-row ws-sec' + (s.on ? '' : ' off') + '">' +
          '<span><i class="bi bi-' + m[0] + '"></i> ' + m[1] + '</span>' +
          '<span class="ws-tools"><button type="button" data-move="' + i + ':-1" aria-label="Move ' + m[1] + ' up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button>' +
          '<button type="button" data-move="' + i + ':1" aria-label="Move ' + m[1] + ' down"' + (i === n - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
          '<input type="checkbox" class="switch" data-sec="' + i + '"' + (s.on ? ' checked' : '') + ' aria-label="Show ' + m[1] + '"></span></div>';
      }).join('') +
      '<div class="st-row ws-fixed"><span><i class="bi bi-envelope"></i> Contact</span><i class="bi bi-lock" title="Always last"></i></div>';

    draft.now = draft.now || { en: '', nb: '' };
    if (document.activeElement !== $('wsNowEn')) $('wsNowEn').value = draft.now.en || '';
    if (document.activeElement !== $('wsNowNb')) $('wsNowNb').value = draft.now.nb || '';
    draft.cv = draft.cv || { on: false, courses: true, projects: true, articles: false };
    draft.cv.profile = draft.cv.profile || { en: '', nb: '' };
    ['education', 'skills', 'languages', 'hobbies'].forEach(function (k) { draft.cv[k] = draft.cv[k] || { en: [], nb: [] }; });
    draft.cv.contact = draft.cv.contact || { phone: '', address: '', born: '', nationality: '' };
    draft.experience = draft.experience || { en: [], nb: [] };
    $('wsCvOn').checked = !!draft.cv.on; $('wsCvCourses').checked = draft.cv.courses !== false; $('wsCvProjects').checked = draft.cv.projects !== false; $('wsCvArticles').checked = !!draft.cv.articles;
    fillCv();
    syncDerived();
    var F = window.Features, items = F ? F.list('learning').slice().sort(function (a, b) { return String(b.date || '') > String(a.date || '') ? 1 : -1; }) : [];
    $('wsCourses').innerHTML = items.length ? items.map(function (c) {
      return '<div class="st-row ws-course' + (c.pub ? '' : ' off') + '"><span class="st-label">' + esc(c.title || '') + '<small>' + esc([c.provider, String(c.date || '').slice(0, 4), c.status === 'done' ? '' : (c.status === 'progress' ? 'in progress' : 'planned')].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="ws-tools ws-course-sw"><label class="ws-mini"><input type="checkbox" class="switch" data-cpub="' + esc(c.id) + '"' + (c.pub ? ' checked' : '') + '> Site</label>' +
        '<label class="ws-mini"' + (c.pub ? '' : ' hidden') + '><input type="checkbox" class="switch" data-ccv="' + esc(c.id) + '"' + (c.cv ? ' checked' : '') + '> CV</label></span></div>';
    }).join('') : '<p class="st-note">No courses yet. Add them on the Work page (switch on “Courses & certificates” under Features).</p>';
    var goals = readJSON('dash.goals', []);
    $('wsGoals').innerHTML = goals.length ? goals.map(function (g) {
      var pct = g.target > 0 ? Math.round((+g.value || 0) / g.target * 100) : 0;
      return '<label class="st-row"><span class="st-label">' + esc(g.name || '') + '<small>' + esc(String(g.value || 0)) + ' / ' + esc(String(g.target || 0)) + ' · ' + pct + ' %</small></span><input type="checkbox" class="switch" data-gpub="' + esc(g.id) + '"' + (g.pub ? ' checked' : '') + '></label>';
    }).join('') : '<p class="st-note">No goals yet. Add one on the dashboard’s Goals card.</p>';

    $('wsFeatArticle').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.articles).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatProject').innerHTML = '<option value="">Newest (automatic)</option>' + groupTitles(content.projects).map(function (x) {
      return '<option value="' + esc(x.ref) + '">' + esc(x.title) + '</option>';
    }).join('');
    $('wsFeatArticle').value = draft.featured.article;
    $('wsFeatProject').value = draft.featured.project;
  }

  /* ---------- CV: profile text and experience, per language ---------- */
  function fillCv() {
    $('cvLang').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === cvLang)); });
    if (document.activeElement !== $('cvProfile')) $('cvProfile').value = draft.cv.profile[cvLang] || '';
    $('cvProfile').placeholder = content && content.profile && content.profile[cvLang] ? content.profile[cvLang].slice(0, 160) + '…' : 'Two or three sentences about what you do.';
    var jobs = draft.experience[cvLang] || [];
    $('cvExpNote').textContent = jobs.length ? jobs.length + ' job' + (jobs.length === 1 ? '' : 's') : 'from the site';
    $('cvJobsImport').hidden = jobs.length > 0 || !(content && content.jobs && content.jobs[cvLang] && content.jobs[cvLang].length);
    $('cvJobs').innerHTML = jobs.map(function (j, i) {
      if (jobEdit === i) return jobForm(j, i);
      return '<div class="st-row ws-job"><button type="button" class="b-open" data-jedit="' + i + '"><span>' + esc(j.title) + '</span><small class="muted">' + esc([j.company, j.dates].filter(Boolean).join(' · ')) + (j.points && j.points.length ? ' · ' + j.points.length + ' point' + (j.points.length === 1 ? '' : 's') : '') + '</small></button>' +
        '<span class="ws-tools"><button type="button" data-jmove="' + i + ':-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button><button type="button" data-jmove="' + i + ':1" aria-label="Move down"' + (i === jobs.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
        '<button type="button" class="del" data-jdel="' + i + '" aria-label="Remove"><i class="bi bi-x"></i></button></span></div>';
    }).join('') + (jobEdit === 'new' ? jobForm(null, 'new') : '');
    /* education, skills, languages, interests, contact */
    var edu = draft.cv.education[cvLang] || [];
    $('cvEduNote').textContent = edu.length ? edu.length + ' entr' + (edu.length === 1 ? 'y' : 'ies') : '';
    $('cvEdu').innerHTML = edu.map(function (e, i) {
      if (eduEdit === i) return eduForm(e, i);
      return '<div class="st-row ws-job"><button type="button" class="b-open" data-eedit="' + i + '"><span>' + esc(e.title) + '</span><small class="muted">' + esc([e.school, e.dates].filter(Boolean).join(' · ')) + '</small></button>' +
        '<span class="ws-tools"><button type="button" data-emove="' + i + ':-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-chevron-up"></i></button><button type="button" data-emove="' + i + ':1" aria-label="Move down"' + (i === edu.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-down"></i></button>' +
        '<button type="button" class="del" data-edel="' + i + '" aria-label="Remove"><i class="bi bi-x"></i></button></span></div>';
    }).join('') + (eduEdit === 'new' ? eduForm(null, 'new') : '');
    var lines = function (l) { return (l || []).map(function (x) { return x.name + ', ' + x.level; }).join('\n'); };
    if (document.activeElement !== $('cvSkills')) $('cvSkills').value = lines(draft.cv.skills[cvLang]);
    if (document.activeElement !== $('cvLangs')) $('cvLangs').value = lines(draft.cv.languages[cvLang]);
    if (document.activeElement !== $('cvHobbies')) $('cvHobbies').value = (draft.cv.hobbies[cvLang] || []).join('\n');
    [['cvPhone', 'phone'], ['cvAddress', 'address'], ['cvBorn', 'born'], ['cvNat', 'nationality']].forEach(function (x) { if (document.activeElement !== $(x[0])) $(x[0]).value = draft.cv.contact[x[1]] || ''; });
  }
  function eduForm(e, i) {
    return '<form class="ws-jobform" data-ei="' + i + '">' +
      '<input name="title" placeholder="e.g. FDVU Technician" value="' + esc(e ? e.title : '') + '" required autocomplete="off">' +
      '<div class="row2"><input name="school" placeholder="School" value="' + esc(e ? e.school : '') + '" autocomplete="off"><input name="dates" placeholder="Dates" value="' + esc(e ? e.dates : '') + '" autocomplete="off"></div>' +
      '<input name="note" placeholder="Note (optional)" value="' + esc(e ? e.note : '') + '" autocomplete="off">' +
      '<div class="form-actions"><button type="button" class="text-btn" data-ecancel>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">' + (e ? 'Save' : 'Add') + '</button></div></form>';
  }
  function levels(text) {
    return String(text || '').split('\n').map(function (l) { var m = l.match(/^(.*?)(?:[,;:\s]\s*(\d{1,3})\s*%?)?\s*$/); return m && m[1].trim() ? { name: m[1].trim().slice(0, 60), level: Math.max(0, Math.min(100, +m[2] || 80)) } : null; }).filter(Boolean).slice(0, 12);
  }
  $('cvSkills').addEventListener('input', function () { draft.cv.skills[cvLang] = levels(this.value); changed(); });
  $('cvLangs').addEventListener('input', function () { draft.cv.languages[cvLang] = levels(this.value); changed(); });
  $('cvHobbies').addEventListener('input', function () { draft.cv.hobbies[cvLang] = this.value.split('\n').map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 10); changed(); });
  [['cvPhone', 'phone'], ['cvAddress', 'address'], ['cvBorn', 'born'], ['cvNat', 'nationality']].forEach(function (x) { $(x[0]).addEventListener('input', function () { draft.cv.contact[x[1]] = this.value.trim(); changed(); }); });
  $('cvEduAdd').addEventListener('click', function () { eduEdit = 'new'; fillCv(); var f = $('cvEdu').querySelector('input[name=title]'); if (f) f.focus(); });
  $('cvEdu').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-eedit]'))) { eduEdit = +b.dataset.eedit; fillCv(); return; }
    if (e.target.closest('[data-ecancel]')) { eduEdit = null; fillCv(); return; }
    if ((b = e.target.closest('[data-edel]'))) { draft.cv.education[cvLang].splice(+b.dataset.edel, 1); eduEdit = null; fillCv(); changed(); return; }
    if ((b = e.target.closest('[data-emove]'))) { var p = b.dataset.emove.split(':'), i = +p[0], j = i + +p[1], l = draft.cv.education[cvLang]; if (j < 0 || j >= l.length) return; var x = l[i]; l[i] = l[j]; l[j] = x; fillCv(); changed(); }
  });
  $('cvEdu').addEventListener('submit', function (e) {
    var f = e.target.closest('.ws-jobform'); if (!f || f.dataset.ei == null) return;
    e.preventDefault();
    var en = { title: f.title.value.trim(), school: f.school.value.trim(), dates: f.dates.value.trim(), note: f.note.value.trim() };
    if (!en.title) { f.title.focus(); return; }
    var l = draft.cv.education[cvLang];
    if (f.dataset.ei === 'new') l.push(en); else l[+f.dataset.ei] = en;
    eduEdit = null; fillCv(); changed();
  });
  function jobForm(j, i) {
    return '<form class="ws-jobform" data-ji="' + i + '">' +
      '<input name="title" placeholder="Title, e.g. FDVU Advisor" value="' + esc(j ? j.title : '') + '" required autocomplete="off">' +
      '<div class="row2"><input name="company" placeholder="Company, city" value="' + esc(j ? j.company : '') + '" autocomplete="off"><input name="dates" placeholder="Dates, e.g. 2020 – 2025" value="' + esc(j ? j.dates : '') + '" autocomplete="off"></div>' +
      '<textarea name="points" rows="3" placeholder="What you did – one point per line">' + esc(j && j.points ? j.points.join('\n') : '') + '</textarea>' +
      '<div class="form-actions"><button type="button" class="text-btn" data-jcancel>Cancel</button><span class="spacer"></span><button class="pill-btn wide" type="submit">' + (j ? 'Save' : 'Add') + '</button></div></form>';
  }
  $('cvLang').addEventListener('click', function (e) { var b = e.target.closest('[data-lang]'); if (!b) return; cvLang = b.dataset.lang; jobEdit = null; eduEdit = null; fillCv(); });
  $('cvProfile').addEventListener('input', function () { draft.cv.profile[cvLang] = this.value; changed(); });
  $('cvJobsImport').addEventListener('click', function () {
    draft.experience[cvLang] = clone(content.jobs[cvLang]).map(function (j) { return { title: j.title || '', dates: j.dates || '', company: j.company || '', points: j.points || [] }; });
    fillCv(); changed();
  });
  $('cvJobAdd').addEventListener('click', function () { jobEdit = 'new'; fillCv(); var f = $('cvJobs').querySelector('input[name=title]'); if (f) f.focus(); });
  $('cvJobs').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-jedit]'))) { jobEdit = +b.dataset.jedit; fillCv(); return; }
    if (e.target.closest('[data-jcancel]')) { jobEdit = null; fillCv(); return; }
    if ((b = e.target.closest('[data-jdel]'))) { draft.experience[cvLang].splice(+b.dataset.jdel, 1); jobEdit = null; fillCv(); changed(); return; }
    if ((b = e.target.closest('[data-jmove]'))) { var p = b.dataset.jmove.split(':'), i = +p[0], j = i + +p[1], l = draft.experience[cvLang]; if (j < 0 || j >= l.length) return; var x = l[i]; l[i] = l[j]; l[j] = x; fillCv(); changed(); }
  });
  $('cvJobs').addEventListener('submit', function (e) {
    var f = e.target.closest('.ws-jobform'); if (!f) return;
    e.preventDefault();
    var j = { title: f.title.value.trim(), company: f.company.value.trim(), dates: f.dates.value.trim(), points: f.points.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) };
    if (!j.title) { f.title.focus(); return; }
    var l = draft.experience[cvLang];
    if (f.dataset.ji === 'new') l.push(j); else l[+f.dataset.ji] = j;
    jobEdit = null; fillCv(); changed();
  });

  /* one entry per article/project (Norwegian and English versions share a ref) */
  function groupTitles(list) {
    var by = {};
    (list || []).forEach(function (x) {
      if (!by[x.ref] || x.lang === 'en') by[x.ref] = x;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  function preview() {
    var a = draft.announcement, el = $('wsAnnPreview');
    el.hidden = !(a.on && (a.en || a.nb));
    el.querySelector('span').textContent = a.en || a.nb;
  }

  function summary() {
    var s = draft || saved;
    var mark = dirty() ? ' · not published' : '';
    if (!s) {
      $('sumAnnounce').textContent = $('sumSections').textContent = $('sumFeatured').textContent = $('sumCourses').textContent = $('sumProgress').textContent = $('sumCv').textContent = problem === 'setup' ? 'Needs GitHub connection' : '–';
      return;
    }
    $('sumAnnounce').textContent = (s.announcement.on ? 'On' : 'Off') + mark;
    var on = s.sections.filter(function (x) { return x.on; }).length;
    $('sumSections').textContent = on + ' of ' + s.sections.length + ' sections shown' + mark;
    var f = [s.featured.article && 'article', s.featured.project && 'project'].filter(Boolean);
    $('sumFeatured').textContent = (f.length ? 'Pinned ' + f.join(' and ') : 'Newest first') + mark;
    var nc = (s.courses || []).length, ncv = (s.courses || []).filter(function (c) { return c.cv; }).length;
    $('sumCourses').textContent = (nc ? nc + ' on the site · ' + ncv + ' in the CV' : 'None published') + mark;
    var ng = (s.goals || []).length;
    $('sumProgress').textContent = (ng ? ng + ' goal' + (ng === 1 ? '' : 's') + ' published' : 'None published') + mark;
    var ne = s.experience ? (s.experience.en || []).length : 0;
    $('sumCv').textContent = (s.cv && s.cv.on ? 'On · jplundberg.com/cv' : 'Off') + (ne ? ' · ' + ne + ' jobs' : '') + mark;
  }

  /* ---------- edits ---------- */
  function changed() { preview(); summary(); bar(); }
  $('wsAnnOn').addEventListener('change', function () { draft.announcement.on = this.checked; changed(); });
  $('wsAnnEn').addEventListener('input', function () { draft.announcement.en = this.value; changed(); });
  $('wsAnnNb').addEventListener('input', function () { draft.announcement.nb = this.value; changed(); });
  $('wsAnnPick').addEventListener('change', function () {
    $('wsAnnLink').hidden = this.value !== 'custom';
    if (this.value === 'custom') { $('wsAnnLink').focus(); draft.announcement.link = $('wsAnnLink').value; }
    else draft.announcement.link = this.value;
    changed();
  });
  $('wsAnnLink').addEventListener('input', function () { draft.announcement.link = this.value.trim(); changed(); });
  $('wsSections').addEventListener('click', function (e) {
    var b = e.target.closest('[data-move]');
    if (!b) return;
    var p = b.dataset.move.split(':'), i = +p[0], j = i + +p[1];
    var list = draft.sections, x = list[i];
    list[i] = list[j]; list[j] = x;
    fill(); changed();
    var again = document.querySelector('[data-move="' + j + ':' + p[1] + '"]');
    if (again && !again.disabled) again.focus();
  });
  $('wsSections').addEventListener('change', function (e) {
    var c = e.target.closest('[data-sec]');
    if (!c) return;
    draft.sections[+c.dataset.sec].on = c.checked;
    c.closest('.ws-sec').classList.toggle('off', !c.checked);
    changed();
  });
  $('wsNowEn').addEventListener('input', function () { draft.now.en = this.value; changed(); });
  $('wsNowNb').addEventListener('input', function () { draft.now.nb = this.value; changed(); });
  ['wsCvOn', 'wsCvCourses', 'wsCvProjects', 'wsCvArticles'].forEach(function (id) {
    $(id).addEventListener('change', function () { draft.cv[{ wsCvOn: 'on', wsCvCourses: 'courses', wsCvProjects: 'projects', wsCvArticles: 'articles' }[id]] = this.checked; changed(); });
  });
  /* which courses go public / in the CV: stored on the course itself (synced), published with the button */
  $('wsCourses').addEventListener('change', function (e) {
    var F = window.Features, el = e.target, id = el.dataset.cpub || el.dataset.ccv;
    if (!F || !id) return;
    var t = F.tools(); (t.learning || []).forEach(function (c) { if (c.id === id) { if (el.dataset.cpub) { c.pub = el.checked; if (!el.checked) c.cv = false; } else c.cv = el.checked; } });
    F.saveTools(t);
    fill(); changed();
  });
  $('wsGoals').addEventListener('change', function (e) {
    var el = e.target; if (!el.dataset.gpub) return;
    var goals = readJSON('dash.goals', []); goals.forEach(function (g) { if (g.id === el.dataset.gpub) g.pub = el.checked; });
    try { localStorage.setItem('dash.goals', JSON.stringify(goals)); } catch (x) {}
    window.dispatchEvent(new Event('dash:local'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
    syncDerived(); changed();
  });
  window.addEventListener('tools:change', function () { if (draft && current === 'courses') { fill(); changed(); } else if (draft) { syncDerived(); summary(); bar(); } });
  window.addEventListener('dash:local', function () { if (draft) { syncDerived(); summary(); bar(); } });
  $('wsFeatArticle').addEventListener('change', function () { draft.featured.article = this.value; changed(); });
  $('wsFeatProject').addEventListener('change', function () { draft.featured.project = this.value; changed(); });

  /* ---------- publish ---------- */
  var current = 'home';
  function status(t, warn) {
    $('wsStatus').textContent = t;
    $('wsStatus').classList.toggle('warn', !!warn);
  }
  function bar() {
    var show = EDIT_PAGES.indexOf(current) > -1;
    $('wsBar').hidden = !show;
    if (!show) return;
    var P = PART[current], mine = partDirty(P[0]);
    var others = Object.keys(PART).filter(function (k) { return k !== current && partDirty(PART[k][0]); }).map(function (k) { return PART[k][1].toLowerCase(); });
    $('wsPublish').innerHTML = '<i class="bi bi-cloud-upload"></i> Publish ' + P[1].toLowerCase();
    $('wsPublish').disabled = !mine || publishing;
    $('wsUndo').hidden = !mine || publishing;
    if (!publishing && saved) status(mine ? 'Not published yet' + (others.length ? ' · also includes your ' + others.join(' and ') + ' changes' : '')
      : others.length ? 'Unpublished changes in ' + others.join(' and ')
      : (saved.updated ? 'Live · last change ' + new Date(saved.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Live'));
  }
  /* Undo only undoes this page */
  $('wsUndo').addEventListener('click', function () {
    var ks = PART[current] && PART[current][0];
    if (!ks) return;
    ks.forEach(function (k) { if (saved[k] == null) delete draft[k]; else draft[k] = clone(saved[k]); });
    if (ks[0] === 'socials' && window.Profile) window.Profile.resetSocials(saved.socials);
    fill(); changed();
  });
  /* Socials come from Settings → jplundberg.com → Socials (profile.js) */
  window.addEventListener('socials:change', function () {
    if (!draft || !window.Profile) return;
    draft.socials = window.Profile.publicSocials();
    changed();
  });
  $('wsPublish').addEventListener('click', function () {
    if (!dirty()) return;
    publishing = true; bar();
    status('Publishing…');
    fetch('api/site', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: draft, sha: sha })
    }).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); }).then(function (j) {
      publishing = false;
      if (j.ok) {
        saved = j.settings; sha = j.sha; draft = clone(saved);
        fill(); summary(); bar();
        status('Published ✓ Live on jplundberg.com in about a minute');
      } else if (j._status === 409) {
        loading = null;
        status('The settings changed somewhere else. Loading the newest version…', true);
        load();
      } else { bar(); status('Couldn’t publish (' + (j.error || j._status) + '). Try again.', true); }
    }).catch(function () { publishing = false; bar(); status('Couldn’t publish. Check your connection.', true); });
  });

  /* ---------- visitors ---------- */
  var days = 7, vCache = {};
  function visitors() {
    var box = $('wsVisitors');
    if (vCache[days]) return drawVisitors(vCache[days]);
    box.innerHTML = '<p class="st-intro">Loading…</p>';
    fetch('api/visitors?days=' + days, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
    }).then(function (j) {
      if (j._status === 503) {
        box.innerHTML = '<p class="st-intro">Visitor statistics aren’t connected yet. They need Cloudflare Web Analytics switched on for jplundberg.com and three settings on the Worker (see the guide).</p>';
        $('sumVisitors').textContent = 'Not connected';
        return;
      }
      if (j.error) { box.innerHTML = '<p class="st-intro">Couldn’t load statistics right now.' + (j.detail ? ' <small>(' + esc(j.detail) + ')</small>' : '') + '</p>'; return; }
      vCache[days] = j;
      drawVisitors(j);
    }).catch(function () { box.innerHTML = '<p class="st-intro">Couldn’t load statistics. Check your connection.</p>'; });
  }
  function drawVisitors(j) {
    $('sumVisitors').textContent = j.visits + ' visits · last ' + j.days + ' days';
    var max = Math.max.apply(null, j.perDay.map(function (d) { return d.visits; }).concat([1]));
    var W = 320, H = 90, bw = W / Math.max(j.perDay.length, 1);
    var bars = j.perDay.map(function (d, i) {
      var h = Math.max(2, d.visits / max * (H - 18));
      var day = new Date(d.name + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      return '<rect x="' + (i * bw + bw * .18).toFixed(1) + '" y="' + (H - 14 - h).toFixed(1) + '" width="' + (bw * .64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"><title>' + esc(day) + ': ' + d.visits + ' visits, ' + d.views + ' page views</title></rect>';
    }).join('');
    var first = j.perDay[0], last = j.perDay[j.perDay.length - 1];
    var lbl = function (d) { return d ? new Date(d.name + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; };
    var list = function (title, rows, icon, fmt) {
      if (!rows.length) return '';
      var top = rows[0].views || 1;
      return '<p class="st-sub">' + title + '</p><ul class="ws-list">' + rows.map(function (r) {
        return '<li><span class="n"><i class="bi bi-' + icon + '"></i>' + esc(fmt ? fmt(r.name) : r.name || '(direct)') + '</span><b>' + r.views + '</b><i class="bar" style="width:' + (r.views / top * 100).toFixed(0) + '%"></i></li>';
      }).join('') + '</ul>';
    };
    $('wsVisitors').innerHTML =
      '<div class="ws-tiles"><div><span>Visits</span><b>' + j.visits + '</b></div><div><span>Page views</span><b>' + j.views + '</b></div></div>' +
      '<section class="st-group ws-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visits per day, last ' + j.days + ' days">' + bars +
      '<text x="0" y="' + (H - 2) + '">' + esc(lbl(first)) + '</text><text x="' + W + '" y="' + (H - 2) + '" text-anchor="end">' + esc(lbl(last)) + '</text></svg></section>' +
      list('Most read pages', j.pages, 'file-earmark-text', pageName) +
      list('Where visitors come from', j.referrers, 'box-arrow-in-right') +
      list('Countries', j.countries, 'geo-alt', countryName) +
      '<p class="st-foot muted">From Cloudflare Web Analytics · no cookies, no personal data.</p>';
  }
  /* "/articles/…/" → the article's title; "NO" → "Norway" */
  function pageName(p) {
    if (p === '/') return 'Front page (English)';
    if (p === '/no/') return 'Front page (Norwegian)';
    var all = content ? (content.articles || []).concat(content.projects || []) : [];
    var hit = all.filter(function (x) { return x.url === p || x.url === p + '/'; })[0];
    return hit ? hit.title : p === '/articles/' ? 'All articles' : p === '/projects/' ? 'All projects' : p;
  }
  var regions = null;
  try { regions = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  function countryName(c) {
    if (regions && /^[A-Z]{2}$/.test(c || '')) { try { return regions.of(c); } catch (e) {} }
    return c || 'Unknown';
  }
  $('wsDays').addEventListener('click', function (e) {
    var b = e.target.closest('[data-days]');
    if (!b) return;
    days = +b.dataset.days;
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    visitors();
  });

  /* ---------- articles and projects: hide / show ---------- */
  var items = null, itemsLoading = null, busyRef = '';
  function loadItems() {
    if (itemsLoading) return itemsLoading;
    itemsLoading = fetch('api/content', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
    }).then(function (j) {
      itemsLoading = null;
      if (!j.items) {
        $('wsContent').innerHTML = '<p class="st-intro">' + (j._status === 503 ? 'Connect GitHub first (see the guide).' : j._status === 404 ? 'Update the Worker code to use this (see the guide).' : 'Couldn’t load your articles right now.') + '</p>';
        $('sumContent').textContent = '–';
        return;
      }
      items = j.items; drawItems();
    }).catch(function () { itemsLoading = null; $('wsContent').innerHTML = '<p class="st-intro">Couldn’t load your articles. Check your connection.</p>'; });
    return itemsLoading;
  }
  /* one row per article/project; language versions share a ref */
  function grouped(col) {
    var by = {};
    items.filter(function (i) { return i.collection === col; }).forEach(function (i) {
      var g = by[i.ref] || (by[i.ref] = { ref: i.ref, col: col, langs: [], title: '', date: '', published: false });
      g.langs.push(i.lang === 'nb' ? 'NO' : 'EN');
      if (!g.title || i.lang === 'en') g.title = i.title;
      if (i.date > g.date) g.date = i.date;
      if (i.published) g.published = true;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
  }
  function drawItems() {
    var html = [['articles', 'Articles', 'journal-text'], ['projects', 'Projects', 'kanban']].map(function (c) {
      var rows = grouped(c[0]);
      if (!rows.length) return '';
      return '<p class="st-sub">' + c[1] + '</p><section class="st-group">' + rows.map(function (g) {
        var busy = busyRef === c[0] + ':' + g.ref;
        var d = g.date ? new Date(g.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        return '<label class="st-row ws-item' + (g.published ? '' : ' off') + '"><span class="st-label"><span><i class="bi bi-' + c[2] + '"></i> ' + esc(g.title) + '</span>' +
          '<small>' + (busy ? (g.published ? 'Hiding…' : 'Showing…') : (g.published ? 'Shown' : 'Hidden') + ' · ' + g.langs.sort().join(' + ') + (d ? ' · ' + d : '')) + '</small></span>' +
          '<input type="checkbox" class="switch" data-col="' + c[0] + '" data-ref="' + esc(g.ref) + '"' + (g.published ? ' checked' : '') + (busyRef ? ' disabled' : '') +
          ' aria-label="Show ' + esc(g.title) + ' on the website"></label>';
      }).join('') + '</section>';
    }).join('');
    $('wsContent').innerHTML = html || '<p class="st-intro">No articles or projects yet.</p>';
    var all = grouped('articles').concat(grouped('projects')), hidden = all.filter(function (g) { return !g.published; }).length;
    $('sumContent').textContent = hidden ? hidden + ' hidden' : 'All shown';
  }
  $('wsContent').addEventListener('change', function (e) {
    var c = e.target.closest('[data-ref]');
    if (!c || busyRef) return;
    var on = c.checked;
    busyRef = c.dataset.col + ':' + c.dataset.ref;
    drawItems();
    fetch('api/content', {
      method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: c.dataset.col, ref: c.dataset.ref, published: on })
    }).then(function (r) { return r.json(); }).then(function (j) {
      busyRef = '';
      if (j.items) { items = j.items; drawItems(); stMsg((on ? 'Shown again' : 'Hidden') + ' ✓ Live on jplundberg.com in about a minute', true); }
      else { drawItems(); stMsg('Couldn’t change it (' + (j.error || 'error') + '). Try again.'); }
    }).catch(function () { busyRef = ''; drawItems(); stMsg('Couldn’t change it. Check your connection.'); });
  });
  function stMsg(t, ok) { var m = document.getElementById('stMsg'); m.textContent = t; m.classList.toggle('ok', !!ok); }

  /* ---------- page changes in the settings panel ---------- */
  window.addEventListener('st:page', function (e) {
    current = e.detail;
    if (current === 'home' || EDIT_PAGES.indexOf(current) > -1) {
      (saved ? Promise.resolve() : load()).then(function () {
        if (current === 'socials' && draft && window.Profile) { draft.socials = window.Profile.publicSocials(); }
        if (draft) { fill(); summary(); bar(); }
      });
    }
    if (current === 'visitors') { if (!content) load(); visitors(); }
    if (current === 'content') { if (items) drawItems(); else { $('wsContent').innerHTML = '<p class="st-intro">Loading…</p>'; loadItems(); } }
    if (current === 'home' && !items) loadItems();
    bar();
    if (EDIT_PAGES.indexOf(current) > -1 && !saved) status(problem ? $('wsStatus').textContent : 'Loading…', !!problem);
  });
  if (window.Vault) window.Vault.onLock(function () { saved = draft = sha = null; loading = null; vCache = {}; items = null; });
})();
} catch (e) { console.error("website.js", e); }
/* ===== texts.js ===== */
try {
/* Settings → jplundberg.com → Texts: edit the website's texts in English and Norwegian.
   Your versions are saved by the Worker to _data/texts.json in GitHub; an empty field
   means the original text (from _data/home.yml) is used. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* The originals contain a little HTML (&amp;, <strong>) – show them as plain text */
  function plain(s) { var d = document.createElement('div'); d.innerHTML = String(s || ''); return d.textContent.replace(/\s+/g, ' ').trim(); }

  var GROUPS = [
    { title: 'Front page', icon: 'house', fields: [
      { k: 'hero_items', label: 'Your roles', hint: 'Separated by commas. They rotate under your name.', max: 200, rows: 1 } ] },
    { title: 'About', icon: 'person', fields: [
      { k: 'about_intro', label: 'Introduction', max: 700, rows: 4 },
      { k: 'about_heading', label: 'Heading', max: 80, rows: 1 },
      { k: 'about_p1', label: 'First paragraph', max: 900, rows: 5 },
      { k: 'about_p2', label: 'Second paragraph', max: 900, rows: 5 },
      { k: 'fact_city', label: 'City', max: 60, rows: 1 },
      { k: 'fact_degree', label: 'Education', max: 120, rows: 1 } ] },
    { title: 'Experience', icon: 'briefcase', fields: [
      { k: 'exp_intro', label: 'Introduction', max: 300, rows: 2 } ] },
    { title: 'Contact', icon: 'envelope', fields: [
      { k: 'contact_intro', label: 'Text above the contact cards', max: 700, rows: 4 },
      { k: 'contact_form_note', label: 'Under “Send a message”', max: 200, rows: 2 } ] },
    { title: 'End of each article', icon: 'journal-text', fields: [
      { k: 'cta_title', label: 'Question', max: 140, rows: 2 },
      { k: 'cta_text', label: 'Text', max: 400, rows: 3 },
      { k: 'author_bio', label: 'Short bio', max: 200, rows: 2 } ] },
    { title: 'Footer', icon: 'layout-text-window', fields: [
      { k: 'footer_tagline', label: 'About you, in the footer', max: 300, rows: 3 } ] },
    { title: 'Google', icon: 'search', fields: [
      { k: 'description', label: 'Description in search results', hint: 'Best under 155 characters.', max: 200, rows: 3, warn: 155 } ] }
  ];
  var KEYS = [];
  GROUPS.forEach(function (g) { g.fields.forEach(function (f) { KEYS.push(f.k); }); });

  var lang = 'en', defaults = null, saved = null, draft = null, sha = null, loading = null, busy = false, problem = '';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dirty() { return saved && JSON.stringify(saved) !== JSON.stringify(draft); }
  function status(t, warn) { $('txStatus').textContent = t; $('txStatus').classList.toggle('warn', !!warn); }

  function load() {
    if (loading) return loading;
    status('Loading…');
    loading = Promise.all([
      fetch('api/texts', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }),
      fetch('texts-defaults.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      var j = res[0];
      defaults = { en: {}, nb: {} };
      ['en', 'nb'].forEach(function (l) { KEYS.forEach(function (k) { defaults[l][k] = plain(res[1][l] && res[1][l][k]); }); });
      if (!j.texts) { problem = j._status === 404 ? 'worker' : j.error === 'github not configured' ? 'setup' : 'error'; throw new Error('load'); }
      problem = '';
      saved = { en: j.texts.en || {}, nb: j.texts.nb || {} }; sha = j.sha; draft = clone(saved);
      draw(); bar();
    }).catch(function () {
      loading = null;
      $('txFields').innerHTML = '<p class="st-intro">' + (problem === 'worker'
        ? 'Update the Worker code to use this (Worker → Edit code → paste the new code → Deploy).'
        : problem === 'setup' ? 'Connect GitHub first: add GITHUB_TOKEN to the Worker.'
        : 'Couldn’t load the texts. Check your connection and try again.') + '</p>';
      status('');
    });
    return loading;
  }

  function value(k) { return draft[lang][k] != null ? draft[lang][k] : defaults[lang][k]; }
  function isOwn(k) { return draft[lang][k] != null && draft[lang][k] !== defaults[lang][k]; }

  function draw() {
    document.querySelectorAll('#txLang [data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    $('txFields').innerHTML = GROUPS.map(function (g) {
      return '<p class="st-sub tx-head"><i class="bi bi-' + g.icon + '"></i> ' + g.title + '</p><section class="st-group tx-group">' + g.fields.map(function (f) {
        var v = value(f.k);
        return '<div class="st-col tx-field' + (isOwn(f.k) ? ' own' : '') + '" data-k="' + f.k + '">' +
          '<span class="tx-label">' + f.label + '<button type="button" class="text-btn tx-reset" data-reset="' + f.k + '"' + (isOwn(f.k) ? '' : ' hidden') + '>Original</button></span>' +
          '<textarea class="st-wide tx-in" data-k="' + f.k + '" rows="' + f.rows + '" maxlength="' + f.max + '" placeholder="' + esc(defaults[lang][f.k]) + '">' + esc(v) + '</textarea>' +
          '<small class="tx-meta"><span>' + (f.hint || '') + '</span><span class="tx-count" data-count="' + f.k + '">' + count(f, v) + '</span></small></div>';
      }).join('') + '</section>';
    }).join('');
    document.querySelectorAll('.tx-in').forEach(grow);
  }
  function fieldOf(k) { var r = null; GROUPS.forEach(function (g) { g.fields.forEach(function (f) { if (f.k === k) r = f; }); }); return r; }
  function count(f, v) { var n = (v || '').length; return n + ' / ' + (f.warn || f.max) + (f.warn && n > f.warn ? ' · long' : ''); }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 44) + 'px'; }

  $('txFields').addEventListener('input', function (e) {
    var t = e.target.closest('.tx-in');
    if (!t) return;
    var k = t.dataset.k, v = t.value.replace(/\s+/g, ' ');
    if (!v.trim() || v.trim() === defaults[lang][k]) delete draft[lang][k]; else draft[lang][k] = v.trim();
    grow(t);
    var f = fieldOf(k), c = document.querySelector('[data-count="' + k + '"]');
    if (c) { c.textContent = count(f, t.value); c.classList.toggle('warn', !!(f.warn && t.value.length > f.warn)); }
    var box = t.closest('.tx-field');
    box.classList.toggle('own', isOwn(k));
    box.querySelector('.tx-reset').hidden = !isOwn(k);
    bar();
  });
  $('txFields').addEventListener('click', function (e) {
    var b = e.target.closest('[data-reset]');
    if (!b) return;
    delete draft[lang][b.dataset.reset];
    draw(); bar();
  });
  $('txLang').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b || !draft) return;
    lang = b.dataset.lang; draw();
  });

  function bar() {
    $('txPublish').disabled = !dirty() || busy;
    $('txUndo').hidden = !dirty() || busy;
    if (!busy && saved) {
      var own = Object.keys(saved.en).length + Object.keys(saved.nb).length;
      status(dirty() ? 'Not published yet' : own ? 'Live · ' + own + ' text' + (own > 1 ? 's' : '') + ' changed' : 'Live · original texts');
    }
    var n = draft ? Object.keys(draft.en).length + Object.keys(draft.nb).length : 0;
    if ($('sumTexts')) $('sumTexts').textContent = n ? n + ' text' + (n > 1 ? 's' : '') + ' changed' : 'About, roles, contact, footer';
  }
  $('txUndo').addEventListener('click', function () { draft = clone(saved); draw(); bar(); });
  $('txPublish').addEventListener('click', function () {
    if (!dirty() || busy) return;
    busy = true; bar(); status('Publishing…');
    fetch('api/texts', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: draft, sha: sha }) })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); })
      .then(function (j) {
        busy = false;
        if (j.ok) { saved = { en: j.texts.en, nb: j.texts.nb }; draft = clone(saved); sha = j.sha; draw(); bar(); status('Published · live on jplundberg.com in about a minute'); return; }
        if (j._status === 409) { status('Changed somewhere else. Reloading the latest version…', true); saved = null; loading = null; load(); return; }
        bar(); status('Couldn’t publish (' + (j.error || j._status) + ').', true);
      }).catch(function () { busy = false; bar(); status('Couldn’t publish. Check your connection.', true); });
  });

  window.addEventListener('st:page', function (e) {
    if (e.detail === 'texts') { if (!saved) load(); else { draw(); bar(); } }
  });
})();
} catch (e) { console.error("texts.js", e); }
/* ===== script.js ===== */
try {
/* Personal dashboard. Everything you enter is stored on this device only. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Storage (never breaks the page if storage is blocked) ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  /* Saving a widget also tells lock.js, which adds it to the encrypted, synced vault. */
  var SYNCED = ['dash.goals', 'dash.todos', 'dash.links', 'dash.notes', 'dash.settings'];
  function save(key, value) {
    try {
      var s = JSON.stringify(value);
      if (localStorage.getItem(key) === s) return;
      localStorage.setItem(key, s);
      if (SYNCED.indexOf(key) > -1) window.dispatchEvent(new Event('dash:local'));
    } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Date, clock and greeting ---------- */
  var PERIODS = [
    { from: 0, to: 6, text: 'Good night' },
    { from: 6, to: 12, text: 'Good morning' },
    { from: 12, to: 18, text: 'Good afternoon' },
    { from: 18, to: 24, text: 'Good evening' }
  ];
  var period = null;
  function prefs() { return window.DashSettings ? window.DashSettings.get() : { name: 'Lundberg', seconds: true, quotes: true }; }

  function tick() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    var pr = prefs();
    $('clock').innerHTML = hh + ':' + mm + (pr.seconds ? '<span class="sec">' + ss + '</span>' : '');
    var hol = window.Features && window.Features.holiday(window.Features.dkey(now));
    $('date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      (window.Cal && window.Cal.prefs().weekNums ? ' · Week ' + window.Cal.isoWeek(now) : '') + (hol && (!window.Cal || window.Cal.prefs().holidays) ? ' · ' + hol.name : '');

    var p = PERIODS.filter(function (x) { return now.getHours() >= x.from && now.getHours() < x.to; })[0];
    var greet = p.text + (pr.name ? ', ' + pr.name : '');
    if (p !== period || $('greeting').textContent !== greet) {
      period = p;
      $('greeting').textContent = greet;
    }
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Quotes ---------- */
  var QUOTES = [
    "The best time to plant a tree was 20 years ago. The second best time is now.",
    "Believe you can and you're halfway there.",
    "It does not matter how slowly you go as long as you do not stop.",
    "You are never too old to set another goal or to dream a new dream.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Don't watch the clock; do what it does. Keep going.",
    "It always seems impossible until it's done.",
    "The only way to do great work is to love what you do.",
    "You have power over your mind, not outside events. Realize this, and you will find strength.",
    "The happiness of your life depends upon the quality of your thoughts.",
    "Waste no more time arguing about what a good man should be. Be one.",
    "What we do now echoes in eternity.",
    "If it is not right, do not do it; if it is not true, do not say it.",
    "Be tolerant with others and strict with yourself.",
    "The art of living is more like wrestling than dancing.",
    "Well begun is half done.",
    "Small daily improvements are the key to staggering long-term results.",
    "Discipline is choosing between what you want now and what you want most.",
    "We are what we repeatedly do.",
    "Do the hard jobs first. The easy jobs will take care of themselves."
  ];
  var lastQuote = -1;
  function newQuote() {
    if (!prefs().quotes) return;
    var i;
    do { i = Math.floor(Math.random() * QUOTES.length); } while (i === lastQuote && QUOTES.length > 1);
    lastQuote = i;
    var q = $('quote');
    q.classList.add('fading');
    setTimeout(function () { q.textContent = QUOTES[i]; q.classList.remove('fading'); }, lastQuote === -1 ? 0 : 600);
  }
  $('quote').textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  function quotesOnOff() { $('quote').hidden = !prefs().quotes; }
  quotesOnOff();
  window.addEventListener('dash:settings', function () { quotesOnOff(); tick(); });
  setInterval(newQuote, 60000);

  /* ---------- Weather (Open-Meteo, no account needed) ---------- */
  var WMO = {
    0: ['Clear sky', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'cloud-sun'], 3: ['Overcast', 'clouds'],
    45: ['Fog', 'cloud-fog2'], 48: ['Freezing fog', 'cloud-fog2'],
    51: ['Light drizzle', 'cloud-drizzle'], 53: ['Drizzle', 'cloud-drizzle'], 55: ['Heavy drizzle', 'cloud-drizzle'],
    56: ['Freezing drizzle', 'cloud-sleet'], 57: ['Freezing drizzle', 'cloud-sleet'],
    61: ['Light rain', 'cloud-rain'], 63: ['Rain', 'cloud-rain'], 65: ['Heavy rain', 'cloud-rain-heavy'],
    66: ['Freezing rain', 'cloud-sleet'], 67: ['Freezing rain', 'cloud-sleet'],
    71: ['Light snow', 'cloud-snow'], 73: ['Snow', 'cloud-snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'cloud-snow'],
    80: ['Rain showers', 'cloud-rain'], 81: ['Rain showers', 'cloud-rain'], 82: ['Heavy showers', 'cloud-rain-heavy'],
    85: ['Snow showers', 'cloud-snow'], 86: ['Snow showers', 'cloud-snow'],
    95: ['Thunderstorm', 'cloud-lightning-rain'], 96: ['Thunderstorm', 'cloud-lightning-rain'], 99: ['Thunderstorm', 'cloud-lightning-rain']
  };
  function wmo(code) { return WMO[code] || ['–', 'cloud']; }
  /* Weather for the city in your profile (Oslo until you set one) */
  var OSLO = { name: 'Oslo', lat: 59.91, lon: 10.75, tz: 'Europe/Oslo' };
  function wUrl(c) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=' + encodeURIComponent(c.tz || 'auto') + '&forecast_days=5&wind_speed_unit=ms';
  }
  function profileCity() { var p = load('dash.profile', null); return p && p.city ? String(p.city).trim() : ''; }
  function weatherPlace() {
    var name = profileCity();
    if (!name || /^oslo$/i.test(name)) return Promise.resolve(OSLO);
    var known = load('dash.weatherPlace', null);
    if (known && known.q === name.toLowerCase()) return Promise.resolve(known);
    return fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(name))
      .then(function (r) { return r.json(); }).then(function (j) {
        var g = j.results && j.results[0];
        if (!g) return OSLO;
        var c = { q: name.toLowerCase(), name: g.name, lat: g.latitude, lon: g.longitude, tz: g.timezone };
        save('dash.weatherPlace', c);
        return c;
      }).catch(function () { return OSLO; });
  }

  function showWeather(d, time) {
    var c = d.current, w = wmo(c.weather_code);
    $('wIcon').className = 'bi bi-' + w[1];
    $('wTemp').textContent = Math.round(c.temperature_2m) + '°';
    $('wDesc').textContent = w[0] + ' · feels like ' + Math.round(c.apparent_temperature) + '° · wind ' + Math.round(c.wind_speed_10m) + ' m/s';
    $('weatherUpdated').textContent = 'Updated ' + new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var html = '';
    for (var i = 0; i < Math.min(4, d.daily.time.length); i++) {
      var day = i === 0 ? 'Today' : new Date(d.daily.time[i] + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short' });
      var dw = wmo(d.daily.weather_code[i]);
      var rain = d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i] : null;
      html += '<li><span class="d">' + day + '</span><i class="bi bi-' + dw[1] + '" title="' + dw[0] + '"></i>' +
        '<span class="hi">' + Math.round(d.daily.temperature_2m_max[i]) + '°</span> <span class="lo">' + Math.round(d.daily.temperature_2m_min[i]) + '°</span>' +
        (rain != null ? '<span class="rain"><i class="bi bi-droplet" style="display:inline;font-size:11px;color:inherit"></i> ' + rain + '%</span>' : '') + '</li>';
    }
    $('wDays').innerHTML = html;
  }

  function loadWeather() {
    var cached = load('dash.weather', null), want = (profileCity() || 'Oslo').toLowerCase();
    if (cached && cached.city !== undefined && cached.city !== want) cached = null;     // you moved: fetch again
    if (cached && cached.data) { showWeather(cached.data, cached.time); setCity(cached.name); }
    if (cached && Date.now() - cached.time < 30 * 60 * 1000) return;
    weatherPlace().then(function (c) {
      return fetch(wUrl(c)).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.current) throw new Error('no data');
        var t = Date.now();
        save('dash.weather', { data: d, time: t, city: want, name: c.name });
        showWeather(d, t);
        setCity(c.name);
      });
    }).catch(function () {
      if (!cached) $('wDesc').textContent = 'Weather is unavailable right now.';
    });
  }
  function setCity(n) { var h = document.querySelector('#weatherCard .card-head h2'); if (h) h.innerHTML = '<i class="bi bi-cloud-sun"></i> ' + esc(n || 'Oslo'); }
  var cityTimer = null;
  window.addEventListener('profile:change', function () {      /* wait until you've finished typing the city */
    clearTimeout(cityTimer);
    cityTimer = setTimeout(function () {
      var c = load('dash.weather', null), want = (profileCity() || 'Oslo').toLowerCase();
      if (!c || c.city !== want) loadWeather();
    }, 1500);
  });
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);

  /* ---------- Goals ---------- */
  var goals = load('dash.goals', null) || [
    { id: uid(), name: 'Asset structure clean-up (%)', value: 55, target: 100 },
    { id: uid(), name: 'Gym sessions this week', value: 0, target: 4 }
  ];
  var editingGoal = null;
  var RING = 2 * Math.PI * 24;

  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('en-GB'); }

  /* A goal can follow a habit ("Gym sessions this week" ↔ the Training habit): it then counts this
     week's ticks, and its target IS the habit's weekly target – change either one and both change. */
  function habits() { return load('dash.habits', null) || { list: [], log: {} }; }
  function weekCount(hb, id) {
    var t = new Date(), mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getDay() + 6) % 7), n = 0;
    for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); if (((hb.log || {})[dkey(d)] || []).indexOf(id) > -1) n++; }
    return n;
  }
  function linkedHabit(g, hb) { return g.habit ? (hb.list || []).filter(function (h) { return h.id === g.habit; })[0] || null : null; }
  /* one-time: link the existing gym/training goal to the training habit (once habits exist) */
  function autoLink() {
    var hb = habits();
    if (!(hb.list || []).length || goals.every(function (x) { return x.linkChecked; })) return;
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|økt/i.test(x.name); })[0];
    var g = goals.filter(function (x) { return !x.habit && !x.linkChecked && /gym|train|trening|workout|økt/i.test(x.name) && /week|uke/i.test(x.name); })[0];
    goals.forEach(function (x) { x.linkChecked = true; });
    if (h && g) {
      g.habit = h.id;
      if (g.target > 0 && g.target <= 7 && g.target !== h.target) { h.target = Math.round(g.target); save('dash.habits', hb); setTimeout(function () { window.dispatchEvent(new Event('habits:change')); }, 0); }
    }
  }
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function renderGoals() {
    autoLink();
    save('dash.goals', goals);
    var hb = habits();
    $('goalList').innerHTML = goals.map(function (g) {
      var h = linkedHabit(g, hb);
      if (h) { g = Object.assign({}, g, { value: weekCount(hb, h.id), target: h.target }); }
      var pct = g.target > 0 ? Math.max(0, Math.min(1, g.value / g.target)) : 0;
      return '<li class="goal' + (pct >= 1 ? ' done' : '') + '" data-id="' + g.id + '">' +
        '<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="track" cx="28" cy="28" r="24"></circle>' +
        '<circle class="val" cx="28" cy="28" r="24" stroke-dasharray="' + RING + '" stroke-dashoffset="' + (RING * (1 - pct)) + '"></circle></svg>' +
        '<div class="goal-text"><strong>' + esc(g.name) + '</strong><span>' + fmt(g.value) + ' / ' + fmt(g.target) + ' · ' + Math.round(pct * 100) + '%' +
        (h ? ' · <i class="bi bi-link-45deg"></i> ' + esc(h.name) + ' habit' : '') + '</span></div>' +
        '<div class="stepper"><button type="button" data-step="-1" aria-label="Decrease">−</button><button type="button" data-step="1" aria-label="Increase">+</button></div></li>';
    }).join('');
  }

  $('goalList').addEventListener('click', function (e) {
    var li = e.target.closest('.goal'); if (!li) return;
    var g = goals.filter(function (x) { return x.id === li.dataset.id; })[0]; if (!g) return;
    var stepBtn = e.target.closest('[data-step]');
    var hb = habits(), h = linkedHabit(g, hb);
    if (stepBtn && h) {           /* linked: + ticks today in the habit (or the latest free day this week), − removes the latest tick */
      var t = new Date(), days = [];
      for (var i = 0; i <= (t.getDay() + 6) % 7; i++) { var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i); days.push(dkey(d)); }
      hb.log = hb.log || {};
      var on = function (k) { return (hb.log[k] || []).indexOf(h.id) > -1; };
      if (+stepBtn.dataset.step > 0) { var free = days.filter(function (k) { return !on(k); })[0]; if (free) (hb.log[free] = hb.log[free] || []).push(h.id); }
      else { var last = days.filter(on)[0]; if (last) { hb.log[last] = hb.log[last].filter(function (x) { return x !== h.id; }); if (!hb.log[last].length) delete hb.log[last]; } }
      save('dash.habits', hb);
      window.dispatchEvent(new Event('habits:change'));
      renderGoals();
      return;
    }
    if (stepBtn) {
      var step = g.target >= 100 ? 5 : 1;
      g.value = Math.max(0, Math.round((g.value + step * Number(stepBtn.dataset.step)) * 100) / 100);
      renderGoals();
      return;
    }
    openGoalForm(g);
  });

  function openGoalForm(g) {
    editingGoal = g || null;
    $('goalName').value = g ? g.name : '';
    var hb = habits(), h = g ? linkedHabit(g, hb) : null;
    $('goalValue').value = h ? weekCount(hb, h.id) : g ? g.value : '';
    $('goalTarget').value = h ? h.target : g ? g.target : '';
    $('goalValue').disabled = !!h;
    $('goalHabit').innerHTML = '<option value="">Not linked</option>' + (hb.list || []).map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (g && g.habit === x.id ? ' selected' : '') + '>Count ticks in “' + esc(x.name) + '” this week</option>';
    }).join('');
    $('goalHabitRow').hidden = !(hb.list || []).length;
    $('goalDelete').hidden = !g;
    $('goalForm').hidden = false;
    $('goalName').focus();
  }
  function closeGoalForm() { $('goalForm').hidden = true; editingGoal = null; }

  $('goalAddBtn').addEventListener('click', function () { openGoalForm(null); });
  $('goalCancel').addEventListener('click', closeGoalForm);
  $('goalDelete').addEventListener('click', function () {
    if (!editingGoal) return;
    goals = goals.filter(function (x) { return x !== editingGoal; });
    closeGoalForm(); renderGoals();
  });
  $('goalForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('goalName').value.trim(), target = parseFloat($('goalTarget').value), value = parseFloat($('goalValue').value) || 0;
    if (!name || !(target > 0)) return;
    var habitId = $('goalHabit').value, hb = habits();
    var h = habitId ? (hb.list || []).filter(function (x) { return x.id === habitId; })[0] : null;
    if (h) {                                   /* the target is the habit's weekly target */
      target = Math.max(1, Math.min(7, Math.round(target)));
      if (h.target !== target) { h.target = target; save('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); }
    }
    if (editingGoal) { editingGoal.name = name; editingGoal.target = target; if (!h) editingGoal.value = value; editingGoal.habit = h ? h.id : undefined; }
    else goals.push({ id: uid(), name: name, value: h ? 0 : value, target: target, habit: h ? h.id : undefined });
    closeGoalForm(); renderGoals();
  });
  renderGoals();
  window.addEventListener('habits:change', renderGoals);
  $('goalHabit').addEventListener('change', function () {
    var hb = habits(), h = (hb.list || []).filter(function (x) { return x.id === this.value; }, this)[0];
    $('goalValue').disabled = !!h;
    if (h) { $('goalValue').value = weekCount(hb, h.id); $('goalTarget').value = h.target; }
  });

  /* ---------- To-do ---------- */
  /* A task can have a due day – type it ("kjøp melk i morgen", "betale strøm 15.11") and it's
     picked up. Due ones come first, and show in the calendar and in At a glance. */
  var todos = load('dash.todos', []);
  function tkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dueChip(t) {
    if (!t.due || t.done) return '';
    var n = Math.round((new Date(t.due + 'T12:00') - new Date(tkey(new Date()) + 'T12:00')) / 864e5);
    var txt = n < 0 ? (n === -1 ? 'Yesterday' : -n + ' days ago') : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 7 ? new Date(t.due + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' }) : new Date(t.due + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return '<span class="due' + (n < 0 ? ' late' : n === 0 ? ' now' : '') + '"><i class="bi bi-' + (t.repeat ? 'arrow-repeat' : 'calendar-event') + '"></i> ' + esc(txt) + '</span>';
  }
  function shownTodos() {
    var big = '9999-99-99';
    return todos.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
      var x = a.t, y = b.t;
      if (!!x.done !== !!y.done) return x.done ? 1 : -1;
      if (!!x.focus !== !!y.focus) return x.focus ? -1 : 1;
      var dx = x.due || big, dy = y.due || big;
      return dx < dy ? -1 : dx > dy ? 1 : a.i - b.i;
    }).map(function (x) { return x.t; });
  }
  var todoAll = false;
  document.addEventListener('click', function (e) { if (e.target.closest('[data-tdall]')) { todoAll = !todoAll; renderTodos(); } });
  function renderTodos() {
    save('dash.todos', todos);
    /* the soonest few; the rest fold away so the card stays about as tall as Goals and Quick links */
    var all = shownTodos(), TOP = 7, more = all.length - TOP;
    $('todoList').innerHTML = all.map(function (t, i) {
      return '<li class="todo-item' + (t.done ? ' done' : '') + (i >= TOP && !todoAll ? ' td-more' : '') + (t.focus && !t.done ? ' focus' : '') + '" data-id="' + t.id + '">' +
        '<button type="button" class="check" aria-label="' + (t.done ? 'Mark as not done' : 'Mark as done') + '"><i class="bi bi-check-lg"></i></button>' +
        '<span class="label">' + (t.focus && !t.done ? '<i class="bi bi-star-fill td-star" aria-label="Focus this week"></i> ' : '') + (t.list ? '<i class="bi bi-house-gear td-list" aria-label="From a checklist"></i> ' : '') + esc(t.text) + dueChip(t) + '</span>' +
        '<button type="button" class="del" aria-label="Delete task"><i class="bi bi-x"></i></button></li>';
    }).join('') + (more > 0 ? '<li class="td-toggle"><button type="button" class="text-btn" data-tdall><i class="bi bi-chevron-' + (todoAll ? 'up' : 'down') + '"></i> ' + (todoAll ? 'Show fewer' : more + ' more task' + (more === 1 ? '' : 's')) + '</button></li>' : '');
    $('todoEmpty').hidden = todos.length > 0;
    $('todoClear').hidden = !todos.some(function (t) { return t.done; });
    window.dispatchEvent(new Event('todos:change'));
  }
  $('todoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('todoInput').value.trim(); if (!v) return;
    var p = window.Smart ? window.Smart.todo(v) : { text: v, due: null }, item = { id: uid(), text: p.text, done: false };
    if (p.due) item.due = p.due;
    if (p.repeat) { item.repeat = p.repeat; if (p.rday) item.rday = p.rday; }
    todos.push(item);
    $('todoInput').value = '';
    renderTodos();
    if (p.repeat && window.Quick) window.Quick.toast('<i class="bi bi-arrow-repeat"></i> ' + esc(window.Smart.REPEAT_NAME[p.repeat]) + ', first ' + esc(window.Smart.when(p.due)));
    else if (p.due && window.Quick) window.Quick.toast('<i class="bi bi-calendar-event"></i> Due ' + esc(window.Smart.when(p.due)) + ' – it’s in your calendar');
  });
  $('todoList').addEventListener('click', function (e) {
    var li = e.target.closest('.todo-item'); if (!li) return;
    var t = todos.filter(function (x) { return x.id === li.dataset.id; })[0]; if (!t) return;
    if (e.target.closest('.del')) {
      li.classList.add('removing');
      var at = todos.indexOf(t);
      setTimeout(function () {
        todos = todos.filter(function (x) { return x !== t; }); renderTodos();
        if (window.Quick) window.Quick.toast('<i class="bi bi-trash3"></i> Task deleted', function () { todos = load('dash.todos', todos); todos.splice(Math.min(at, todos.length), 0, t); renderTodos(); });
      }, 250);
    } else if (e.target.closest('.check') || e.target.closest('.label')) {
      /* a repeating task moves on to its next day instead of being done */
      if (!t.done && t.repeat && window.Smart) {
        var was = t.due, nx = window.Smart.nextDue(t.due || tkey(new Date()), t.repeat, t.rday);
        /* if it was long overdue, the next one is the first after today */
        while (nx && nx < tkey(new Date())) nx = window.Smart.nextDue(nx, t.repeat, t.rday);
        li.classList.add('ticked');
        setTimeout(function () {
          t.due = nx; renderTodos();
          if (window.Quick) window.Quick.toast('<i class="bi bi-arrow-repeat"></i> Done – next ' + esc(window.Smart.when(nx)), function () { t.due = was; renderTodos(); });
        }, 260);
        return;
      }
      t.done = !t.done; renderTodos();
    }
  });
  $('todoClear').addEventListener('click', function () {
    var before = todos.slice();
    todos = todos.filter(function (t) { return !t.done; }); renderTodos();
    if (window.Quick) window.Quick.toast('<i class="bi bi-check2-all"></i> Done tasks cleared', function () { todos = before; renderTodos(); });
  });
  renderTodos();

  /* ---------- Quick links ---------- */
  var links = load('dash.links', null) || [
    { name: 'Website', url: 'https://jplundberg.com/' },
    { name: 'Site editor', url: 'https://app.pagescms.org/' },
    { name: 'GitHub', url: 'https://github.com/Jpme96/jplundberg.github.io' },
    { name: 'Tally', url: 'https://tally.so/dashboard' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/john-paul-lundberg-8a804623b/' },
    { name: 'Instagram', url: 'https://www.instagram.com/jp.lundberg.official/' },
    { name: 'Claude', url: 'https://claude.ai/' }
  ];
  function linkIcon(url, name) {
    var map = [['linkedin', 'linkedin'], ['instagram', 'instagram'], ['github', 'github'], ['jplundberg', 'house'],
      ['pagescms', 'pencil-square'], ['tally', 'ui-checks'], ['claude', 'stars'], ['sharepoint', 'microsoft'],
      ['office', 'microsoft'], ['outlook', 'envelope'], ['mail', 'envelope'], ['plania', 'buildings'], ['teams', 'microsoft-teams'],
      ['youtube', 'youtube'], ['spotify', 'spotify'], ['google', 'google']];
    var u = (url + ' ' + name).toLowerCase();
    for (var i = 0; i < map.length; i++) if (u.indexOf(map[i][0]) > -1) return '<i class="bi bi-' + map[i][1] + '"></i>';
    return esc((name || '?').trim().charAt(0).toUpperCase());
  }
  function renderLinks() {
    save('dash.links', links);
    $('linkGrid').innerHTML = links.map(function (l, i) {
      return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener"><span class="ico">' + linkIcon(l.url, l.name) + '</span><span class="name">' + esc(l.name) + '</span></a>' +
        '<button type="button" class="remove" data-i="' + i + '" aria-label="Remove ' + esc(l.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
  }
  function setEditing(on) {
    document.querySelector('.links').classList.toggle('editing', on);
    $('linkForm').hidden = !on;
    $('linkEditBtn').textContent = on ? 'Done' : 'Edit';
  }
  $('linkEditBtn').addEventListener('click', function () { setEditing(!document.querySelector('.links').classList.contains('editing')); });
  $('linkCancel').addEventListener('click', function () { setEditing(false); });
  $('linkGrid').addEventListener('click', function (e) {
    var rm = e.target.closest('.remove');
    if (rm) { e.preventDefault(); links.splice(Number(rm.dataset.i), 1); renderLinks(); return; }
    if (document.querySelector('.links').classList.contains('editing') && e.target.closest('a')) e.preventDefault();
  });
  $('linkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('linkName').value.trim(), url = $('linkUrl').value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    links.push({ name: name, url: url });
    $('linkName').value = ''; $('linkUrl').value = '';
    renderLinks();
  });
  renderLinks();

  /* ---------- Notes (your old notes are carried over once) ---------- */
  var notes = load('dash.notes', null);
  if (notes === null) {
    notes = [];
    try {
      (localStorage.getItem('taskList') || '').split(';').forEach(function (t) {
        if (t.trim()) notes.push({ id: uid(), text: t.trim() });
      });
    } catch (e) {}
  }
  var editingNote = null;

  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var label = u; try { label = new URL(u.replace(/&amp;/g, '&')).hostname; } catch (e) {}
      return '<a href="' + u + '" target="_blank" rel="noopener">' + label + '</a>';
    });
  }
  function renderNotes() {
    save('dash.notes', notes);
    $('noteList').innerHTML = notes.map(function (n) {
      return '<li class="note' + (editingNote === n ? ' editing' : '') + '" data-id="' + n.id + '"><span class="body">' + linkify(n.text) + '</span>' +
        '<button type="button" class="del" aria-label="Delete note"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('noteEmpty').hidden = notes.length > 0;
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  $('noteInput').addEventListener('input', function () { grow(this); });
  $('noteInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('noteForm').requestSubmit(); }
  });
  $('noteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('noteInput').value.trim();
    var url = /^[a-z0-9-]+(\.[a-z]{2,})+(\/\S*)?$/i;
    if (url.test(v)) v = 'https://' + v;
    if (editingNote) {
      if (v) editingNote.text = v; else notes = notes.filter(function (x) { return x !== editingNote; });
      editingNote = null;
    } else if (v) {
      notes.unshift({ id: uid(), text: v });
    }
    $('noteInput').value = ''; grow($('noteInput'));
    $('noteSubmit').innerHTML = '<i class="bi bi-plus-lg"></i>';
    renderNotes();
  });
  $('noteList').addEventListener('click', function (e) {
    var li = e.target.closest('.note'); if (!li) return;
    if (e.target.closest('a')) return;
    var n = notes.filter(function (x) { return x.id === li.dataset.id; })[0]; if (!n) return;
    if (e.target.closest('.del')) {
      li.classList.add('removing');
      setTimeout(function () {
        notes = notes.filter(function (x) { return x !== n; });
        if (editingNote === n) { editingNote = null; $('noteInput').value = ''; }
        renderNotes();
      }, 250);
      return;
    }
    editingNote = n;
    $('noteInput').value = n.text; grow($('noteInput'));
    $('noteSubmit').innerHTML = '<i class="bi bi-check-lg"></i>';
    $('noteInput').focus();
    renderNotes();
  });
  renderNotes();

  /* Called by lock.js when newer data arrives from another device. */
  var prevDashReload = window.Dash && window.Dash.reload;      // features.js and others hook in too
  window.Dash = window.Dash || {};
  Object.assign(window.Dash, {
    reload: function () {
      if (prevDashReload) prevDashReload();
      goals = load('dash.goals', goals);
      todos = load('dash.todos', todos);
      links = load('dash.links', links);
      notes = load('dash.notes', notes);
      if (editingNote && notes.indexOf(editingNote) < 0) editingNote = null;
      renderGoals(); renderTodos(); renderLinks(); renderNotes();
      if (window.DashSettings) window.DashSettings.apply();
      quotesOnOff(); tick();
    }
  });
})();
} catch (e) { console.error("script.js", e); }
/* ===== budget.js ===== */
try {
/* Budget maths shared by the dashboard, the Finances page, the calendar and the reviews.
   An income can be entered as the net amount that lands in your account, or as the gross
   salary with the tax (skattetrekk) and other deductions – pension, union fees and so on –
   and the dashboard works out what you're actually paid, month by month:
     · June: holiday pay (feriepenger) instead of salary, no tax taken
     · December: half tax
   Each income can have a payday, so you also see when the next one comes. */
window.Budget = (function () {
  "use strict";
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }

  /* one income row → what it pays out in the month 'YYYY-MM'
     r: { amount (net, ordinary month) | gross, taxPct, taxExtra (kr), benefits (taxable, not paid out),
          deductions [{name, amount|pct}], payYear, holidayPay (kr, earned last year), holidayWeeks (4|5), day } */
  function rowFor(r, key) {
    var out = { name: r.name, net: +r.amount || 0, gross: 0, tax: 0, extra: 0, items: [], note: '', day: r.day || null, holiday: false };
    if (!(r.gross > 0)) return out;
    var m = +key.slice(5, 7), gross = +r.gross, pct = +r.taxPct || 0, benefits = +r.benefits || 0, taxExtra = +r.taxExtra || 0;
    var ded = (r.deductions || []).map(function (x) {
      var v = x.pct ? gross * (+x.pct || 0) / 100 : +x.amount || 0;
      return { name: x.name, amount: v };
    });
    var extra = ded.reduce(function (a, x) { return a + x.amount; }, 0);
    out.items = ded; out.extra = extra;
    var salary = gross, tax, note = '';
    if (r.payYear && m === 6) {
      /* June: holiday pay (earned last year, not taxed) is paid, and the salary for the holiday
         weeks is held back – 30/26 of a month for 5 weeks, 25/26 for 4 */
      var hol = r.holidayPay != null && r.holidayPay !== '' ? +r.holidayPay || 0 : gross * 12 * 0.12;
      if (hol > 0) {
        var held = gross * ((+r.holidayWeeks || 5) === 4 ? 25 : 30) / 26;
        salary = gross - held;
        tax = Math.max(0, (salary + benefits) * pct / 100);
        out.gross = hol + salary; out.tax = tax; out.net = hol + salary - tax - extra; out.holiday = true; out.note = 'Holiday pay, no tax';
        return out;
      }
      note = 'No holiday pay earned last year – a normal month';
    }
    tax = (salary + benefits) * pct / 100 + taxExtra;
    if (r.payYear && m === 12) { tax = tax / 2; note = 'Half tax in December'; }
    out.gross = salary; out.tax = tax; out.net = salary - tax - extra; out.note = note;
    return out;
  }
  /* the net amount in an ordinary month (what's stored as r.amount) */
  function ordinary(r) {
    var g = +r.gross || 0;
    if (!(g > 0)) return +r.amount || 0;
    var extra = (r.deductions || []).reduce(function (a, x) { return a + (x.pct ? g * (+x.pct || 0) / 100 : +x.amount || 0); }, 0);
    return g - (g + (+r.benefits || 0)) * (+r.taxPct || 0) / 100 - (+r.taxExtra || 0) - extra;
  }
  /* a logged payslip for a month overrides the model (d.budget.payslips['YYYY-MM'] = {net, gross, tax}) */
  function slip(d, key) { var p = d && d.budget && d.budget.payslips; return p && p[key] && p[key].net > 0 ? p[key] : null; }
  /* all incomes for a month */
  function incomeOf(d, key) {
    var rows = ((d && d.budget && d.budget.income) || []).map(function (r) { return rowFor(r, key); });
    var t = { net: 0, gross: 0, tax: 0, extra: 0, rows: rows, note: '', logged: false };
    rows.forEach(function (r) { t.net += r.net; t.gross += r.gross; t.tax += r.tax; t.extra += r.extra; if (r.note && !t.note) t.note = r.note; });
    var s = slip(d, key);
    if (s) {
      var others = rows.filter(function (r) { return !r.gross; }).reduce(function (a, r) { return a + r.net; }, 0);   // plain net incomes stay
      t.net = (+s.net || 0) + others; t.logged = true;
      if (s.gross > 0) { t.gross = +s.gross; t.tax = +s.tax || 0; t.extra = Math.max(0, +s.gross - (+s.tax || 0) - +s.net); }
      t.note = 'From your payslip';
    }
    return t;
  }
  /* this year so far: logged payslips where you have them, the model for the other months up to now */
  function yearSoFar(d, now) {
    now = now || new Date();
    var y = now.getFullYear(), out = { gross: 0, tax: 0, net: 0, months: 0, logged: 0 };
    for (var m = 1; m <= now.getMonth() + 1; m++) {
      var key = y + '-' + pad(m), t = incomeOf(d, key);
      if (!t.net) continue;
      out.gross += t.gross; out.tax += t.tax; out.net += t.net; out.months++; if (t.logged) out.logged++;
    }
    return out;
  }
  function income(d, key) { return incomeOf(d, key || ym(new Date())).net; }

  /* paydays: the date of each income's payday in a month (weekend → the Friday before, as banks do) */
  function paydayIn(r, y, m) {
    if (!r.day) return null;
    var dt = new Date(y, m - 1, Math.min(+r.day, daysIn(y, m)));
    if (r.day === 'last' || +r.day > 28) dt = new Date(y, m - 1, Math.min(r.day === 'last' ? 31 : +r.day, daysIn(y, m)));
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() - 1);
    return dt;
  }
  function paydays(d, from, to) {
    var out = [], rows = (d && d.budget && d.budget.income) || [];
    for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
      for (var m = 1; m <= 12; m++) rows.forEach(function (r) {
        var dt = paydayIn(r, y, m);
        if (!dt || dt < from || dt > to) return;
        var row = rowFor(r, y + '-' + pad(m));
        out.push({ date: dt, row: row, src: r, title: row.holiday ? 'Holiday pay' : 'Payday' + (rows.length > 1 ? ' · ' + r.name : ''), net: row.net });
      });
    }
    return out.sort(function (a, b) { return a.date - b.date; });
  }
  /* the next payday from today (today counts if it hasn't passed) */
  function nextPayday(d, from) {
    from = from || new Date();
    var start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    var end = new Date(start); end.setMonth(end.getMonth() + 2);
    var list = paydays(d, start, end);
    if (!list.length) return null;
    var p = list[0], days = Math.round((p.date - start) / 864e5);
    return { date: p.date, days: days, title: p.title, net: p.net, name: p.src.name };
  }
  function hasPayday(d) { return ((d && d.budget && d.budget.income) || []).some(function (r) { return r.day; }); }

  /* The budget period: a calendar month, or – when d.budget.period is 'payday' and an income has a
     payday – from one payday up to the day before the next. */
  function dk(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function period(d, now) {
    now = now || new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var byPay = d && d.budget && d.budget.period === 'payday' && hasPayday(d);
    var start, end, label, income;
    if (byPay) {
      var back = new Date(t0); back.setMonth(back.getMonth() - 2);
      var fwd = new Date(t0); fwd.setMonth(fwd.getMonth() + 2);
      /* boundaries follow the main income (the biggest one) */
      var rows = d.budget.income.filter(function (r) { return r.day; });
      var main = rows.slice().sort(function (a, b) { return ordinary(b) - ordinary(a); })[0];
      var all = paydays(d, back, fwd), mine = all.filter(function (p) { return p.src === main; });
      var prev = mine.filter(function (p) { return p.date <= t0; }).pop(), next = mine.filter(function (p) { return p.date > t0; })[0];
      if (prev && next) {
        start = prev.date; end = new Date(next.date); end.setDate(end.getDate() - 1);
        income = all.filter(function (p) { return p.date >= start && p.date <= end; }).reduce(function (a, p) { return a + p.net; }, 0);
        label = 'until payday';
      }
    }
    if (!start) {
      start = new Date(t0.getFullYear(), t0.getMonth(), 1); end = new Date(t0.getFullYear(), t0.getMonth() + 1, 0);
      income = incomeOf(d, ym(t0)).net; label = 'this month'; byPay = false;
    }
    var sk = dk(start), ek = dk(end);
    /* money in that isn't salary – refunds, Vipps from friends, things you sold (from bank imports) */
    var extra = ((d && d.extra) || []).filter(function (e) { var k = String(e.date || '').slice(0, 10); return k >= sk && k <= ek; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
    return {
      byPayday: byPay, start: start, end: end, startKey: sk, endKey: ek, income: income + extra, salary: income, extra: extra, label: label,
      days: Math.round((end - start) / 864e5) + 1, daysLeft: Math.round((end - t0) / 864e5) + 1,
      has: function (dateStr) { var k = String(dateStr).slice(0, 10); return k >= sk && k <= ek; },
      name: byPay ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' + end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : t0.toLocaleDateString('en-GB', { month: 'long' })
    };
  }
  /* pace: where this period ends up if you keep spending like you have so far
     { projected, room, end (what's left at the end), perDay, elapsed, ok } – null early in the period */
  function pace(d, now) {
    now = now || new Date();
    var per = period(d, now), fixed = ((d && d.budget && d.budget.fixed) || []).reduce(function (a, f) { return a + (+f.amount || 0); }, 0);
    if (!(per.income > 0)) return null;
    var elapsed = per.days - per.daysLeft + 1, sp = spent(d, per), room = per.income - fixed;
    if (elapsed < 5 || per.daysLeft < 2) return null;
    var projected = sp / elapsed * per.days;
    return { per: per, spent: sp, room: room, projected: projected, end: room - projected, perDay: sp / elapsed, elapsed: elapsed, ok: projected <= room };
  }
  /* a savings goal: what to put aside each month – your own amount, or worked out from "reach it by" */
  function saveMonthly(g, now) {
    now = now || new Date();
    var left = (+g.target || 0) - (+g.saved || 0);
    if (!(left > 0)) return 0;
    if (+g.monthly > 0) return Math.min(+g.monthly, left);
    if (!/^\d{4}-\d{2}/.test(g.by || '')) return 0;
    var y = +g.by.slice(0, 4), m = +g.by.slice(5, 7) - 1;
    var months = Math.max(1, (y - now.getFullYear()) * 12 + (m - now.getMonth()) + 1);
    return Math.ceil(left / months / 10) * 10;
  }
  function spent(d, per) { return ((d && d.expenses) || []).filter(function (e) { return per.has(e.date); }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }

  return { saveMonthly: saveMonthly, period: period, spent: spent, pace: pace, slip: slip, yearSoFar: yearSoFar, rowFor: rowFor, ordinary: ordinary, incomeOf: incomeOf, income: income, paydays: paydays, nextPayday: nextPayday, hasPayday: hasPayday, ym: ym };
})();
} catch (e) { console.error("budget.js", e); }
/* ===== money.js ===== */
try {
/* Money card on the dashboard: what's left, the next payday and bills due soon.
   Logging and editing live on the Finances page – this is the glance. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var box = $('moneyBody');
  if (!box) return;
  var B = window.Budget, Fe = window.Features;
  var nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)); }
  function money(n, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + esc(kr(n)) + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function sum(l, f) { return (l || []).reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }

  function render() {
    var d = window.Vault && window.Vault.get();
    if (!d) { box.innerHTML = ''; return; }
    var now = new Date(), key = ym(now), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var b = d.budget || { income: [], fixed: [] };
    var per = B.period(d, now), income = per.income, fixed = sum(b.fixed), spent = B.spent(d, per);
    var left = income - fixed - spent;
    if (!income && !fixed && !spent) {
      box.innerHTML = '<p class="empty">Set up your budget on the Finances page – salary, fixed costs – and this shows what you can spend each day.</p>' +
        '<div class="mo-acts"><a class="pill-btn wide" href="finance/#c=budget"><i class="bi bi-pie-chart"></i> Set up budget</a></div>';
      return;
    }
    var pay = B.nextPayday(d, now), untilPay = per.byPayday || (pay && pay.days > 0 && pay.days <= dim);
    var perDay = left > 0 ? left / (per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1) : 0;
    var base = Math.max(income, fixed + spent, 1), w = function (v) { return Math.max(0, v / base * 100).toFixed(2) + '%'; };

    /* bills: overdue or due within a week */
    var paid = (d.paid && d.paid[key]) || [], today = now.getDate();
    var due = (b.fixed || []).filter(function (f) { return f.day && paid.indexOf(f.id) < 0 && !(f.src === 'sub' && Math.min(f.day, dim) <= today); })
      .map(function (f) { return { f: f, diff: Math.min(f.day, dim) - today }; })
      .filter(function (x) { return x.diff <= 7; }).sort(function (a, b) { return a.diff - b.diff; }).slice(0, 3);

    /* where the period ends up at this pace, and what today has cost */
    var pc = B.pace ? B.pace(d, now) : null, tk = key + '-' + String(now.getDate()).padStart(2, '0');
    var todaySum = sum((d.expenses || []).filter(function (e) { return e.date === tk; }));
    var paceHtml = !pc || left < 0 ? '' : pc.ok
      ? '<p class="mo-pace ok"><i class="bi bi-check-circle"></i><span>On track – about ' + money(pc.end) + ' left ' + (per.byPayday ? 'at payday' : 'at the end of the month') + '</span></p>'
      : '<p class="mo-pace warn"><i class="bi bi-speedometer2"></i><span>At this pace ' + money(-pc.end) + ' over ' + (per.byPayday ? 'by payday' : 'this month') + ' · keep to ' + money(Math.max(0, (pc.room - pc.spent) / per.daysLeft)) + '/day</span></p>';
    box.innerHTML =
      '<div class="mo-top"><div><div class="big-num' + (left < 0 ? ' neg' : '') + '">' + money(left) + '</div>' +
        '<div class="muted">' + (left < 0 ? 'over budget this month' : 'left' + (untilPay ? ' until payday' : ' this month') + (left > 0 ? ' · ' + money(perDay) + '/day' : '')) + '</div></div></div>' +
      '<div class="stack" role="img" aria-label="Fixed ' + esc(kr(fixed)) + ', spent ' + esc(kr(spent)) + ', left ' + esc(kr(left)) + '">' +
        '<span class="s-fixed" style="width:' + w(fixed) + '"></span><span class="s-spent" style="width:' + w(spent) + '"></span><span class="s-left" style="width:' + w(Math.max(left, 0)) + '"></span></div>' +
      paceHtml +
      '<ul class="mo-rows">' +
        (todaySum > 0 ? '<li><i class="bi bi-bag"></i><span>Spent today</span>' + money(todaySum) + '</li>' : '') +
        '<li><i class="bi bi-receipt"></i><span>Spent ' + (per.byPayday ? 'since payday' : 'in ' + esc(now.toLocaleDateString('en-GB', { month: 'short' }))) + '</span>' + money(spent) + '</li>' +
        (per.extra ? '<li><i class="bi bi-arrow-down-left-circle"></i><span>Money in (refunds, Vipps)</span><span class="money">+' + esc(kr(per.extra)) + '</span></li>' : '') +
        (pay ? '<li><i class="bi bi-cash-stack"></i><span>' + esc(pay.title) + (pay.days === 0 ? ' <b>today</b>' : pay.days === 1 ? ' <b>tomorrow</b>' : ' ' + pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · in ' + pay.days + ' days') + '</span>' + (pay.net ? money(pay.net) : '') + '</li>' : '') +
        due.map(function (x) {
          return '<li' + (x.diff < 0 ? ' class="late"' : '') + '><i class="bi bi-' + (x.diff < 0 ? 'exclamation-circle' : 'calendar-check') + '"></i><span>' + esc(x.f.name) +
            (x.diff < 0 ? ' <b>overdue</b> ' + (-x.diff) + ' day' + (x.diff === -1 ? '' : 's') : x.diff === 0 ? ' <b>due today</b>' : ' due in ' + x.diff + ' day' + (x.diff === 1 ? '' : 's')) + '</span>' + money(x.f.amount) + '</li>';
        }).join('') +
      '</ul>' +
      '<div class="mo-acts"><button type="button" class="pill-btn wide" data-quick="expense"><i class="bi bi-plus-lg"></i> Log expense</button>' +
        (due.length ? '<a class="text-btn" href="finance/#c=bills">Bills</a>' : '') + '</div>';
  }

  /* hide amounts (shared with the Finances page) */
  var hb = $('finHide');
  function setHidden(on) {
    document.body.classList.toggle('fin-hidden', on);
    hb.innerHTML = '<i class="bi bi-eye' + (on ? '-slash' : '') + '"></i>';
    hb.setAttribute('aria-label', on ? 'Show amounts' : 'Hide amounts');
    try { localStorage.setItem('dash.finHide', on ? '1' : '0'); } catch (e) {}
  }
  if (hb && !hb.dataset.bound) {
    hb.dataset.bound = '1';
    hb.addEventListener('click', function () { setHidden(!document.body.classList.contains('fin-hidden')); });
    try { setHidden(localStorage.getItem('dash.finHide') === '1'); } catch (e) { setHidden(false); }
  }

  window.Vault.onUnlock(function () { setTimeout(render, 0); });
  window.Vault.onLock(function () { box.innerHTML = ''; });
  ['fin:change', 'features:change', 'tools:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(render, 0); }); });
  setInterval(render, 60000);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
} catch (e) { console.error("money.js", e); }
/* ===== places.js ===== */
try {
/* Shared place search (Entur Geocoder v3) and trip search (Entur Journey Planner v3).
   Used by the dashboard's travel card and by /cmd/travel. Open data, no account needed. */
(function () {
  "use strict";

  var CLIENT = 'jplundberg-dashboard';
  var GEO = 'https://api.entur.io/geocoder/v3/autocomplete';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- geocoder ---------- */
  function search(q, opts) {
    opts = opts || {};
    var url = GEO + '?q=' + encodeURIComponent(q) + '&lang=no&limit=' + (opts.limit || 7) + (opts.layers ? '&layers=' + opts.layers : '');
    return fetch(url, { headers: { 'ET-Client-Name': CLIENT } }).then(function (r) { return r.json(); }).then(function (j) {
      return (j.features || []).map(function (f) {
        var p = f.properties || {}, names = p.names || {}, c = (f.geometry && f.geometry.coordinates) || [];
        var modes = (p.transportModes || []).map(function (m) { return m.mode || m; });
        return {
          id: p.id || '', name: names.default || p.name || names.display || p.label || '',
          sub: [(p.address && p.address.locality) || p.locality || ''].concat(modes.slice(0, 3)).filter(Boolean).join(' · '),
          lon: c[0], lat: c[1], stop: /^NSR:StopPlace/.test(p.id || '')
        };
      }).filter(function (x) { return x.name; });
    });
  }

  /* Where a trip starts or ends, in the form the journey planner wants */
  function toLocation(p) {
    if (p.stop && p.id) return { place: p.id, name: p.name };
    return { name: p.name, coordinates: { latitude: p.lat, longitude: p.lon } };
  }

  /* ---------- trips ---------- */
  var RICH = 'tripPatterns { expectedStartTime aimedStartTime expectedEndTime duration walkDistance ' +
    'legs { mode distance duration realtime aimedStartTime expectedStartTime expectedEndTime ' +
    'fromPlace { name quay { publicCode } } toPlace { name } ' +
    'line { publicCode name transportMode presentation { colour textColour } } ' +
    'fromEstimatedCall { destinationDisplay { frontText } } } } nextPageCursor';
  var PLAIN = 'tripPatterns { expectedStartTime expectedEndTime duration ' +
    'legs { mode duration expectedStartTime expectedEndTime fromPlace { name } toPlace { name } line { publicCode transportMode } } }';
  var rich = true;

  function trips(from, to, when, cursor) {
    var vars = { from: toLocation(from), to: toLocation(to), dateTime: (when && when.time) || new Date().toISOString(), arriveBy: !!(when && when.arriveBy) };
    var args = 'from: $from, to: $to, dateTime: $dateTime, arriveBy: $arriveBy, numTripPatterns: 6' + (cursor && rich ? ', pageCursor: $cursor' : '');
    var q = 'query($from: Location!, $to: Location!, $dateTime: DateTime, $arriveBy: Boolean' + (cursor && rich ? ', $cursor: String' : '') + ') { trip(' + args + ') { ' + (rich ? RICH : PLAIN) + ' } }';
    if (cursor && rich) vars.cursor = cursor;
    return fetch(JP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT },
      body: JSON.stringify({ query: q, variables: vars })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && rich) { rich = false; return trips(from, to, when, null); }   // retry with fewer fields
      if (!j.data || !j.data.trip) throw new Error('no trips');
      return j.data.trip;
    });
  }

  /* ---------- autocomplete field ---------- */
  function field(input, opts) {
    opts = opts || {};
    var wrap = input.closest('.ps-wrap');
    var list = document.createElement('ul');
    list.className = 'ps-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    wrap.appendChild(list);
    var items = [], seq = 0, timer = null, active = -1;

    function show(rows, msg) {
      items = rows;
      active = -1;
      var mine = opts.myLocation && navigator.geolocation ? '<li><button type="button" data-i="me" role="option"><i class="bi bi-crosshair"></i><span>My location</span></button></li>' : '';
      list.innerHTML = (msg ? '' : mine) + (msg ? '<li class="ps-msg">' + msg + '</li>' : rows.map(function (x, i) {
        return '<li><button type="button" data-i="' + i + '" role="option"><i class="bi bi-' + (x.stop ? 'signpost' : 'geo-alt') + '"></i><span>' + esc(x.name) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span></button></li>';
      }).join(''));
      list.hidden = false;
    }
    function hide() { list.hidden = true; }
    function pick(p) {
      input.value = p.name;
      input.dataset.picked = '1';
      hide();
      if (opts.onPick) opts.onPick(p);
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', function () {
      if (!input.value && opts.myLocation && navigator.geolocation) show([]);
      if (opts.recent && !input.value) { var r = opts.recent(); if (r.length) show(r); }
    });
    input.addEventListener('input', function () {
      input.dataset.picked = '';
      if (opts.onPick) opts.onPick(null);
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { if (!q && opts.myLocation) show([]); else hide(); return; }
      timer = setTimeout(function () {
        var s = ++seq;
        (opts.search || search)(q, { layers: opts.layers }).then(function (rows) {
          if (s !== seq) return;
          rows.length ? show(rows) : show([], 'No places found');
        }).catch(function () { if (s === seq) show([], 'Couldn’t search right now'); });
      }, 220);
    });
    input.addEventListener('keydown', function (e) {
      var btns = list.querySelectorAll('button');
      if (list.hidden || !btns.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
        btns.forEach(function (b, i) { b.classList.toggle('on', i === active); });
      } else if (e.key === 'Enter' && active > -1) {
        e.preventDefault(); btns[active].click();
      } else if (e.key === 'Escape') hide();
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus while choosing
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (!b) return;
      if (b.dataset.i === 'me') {
        input.value = 'Finding you…';
        navigator.geolocation.getCurrentPosition(function (pos) {
          pick({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude, stop: false, mine: true });
        }, function () { input.value = ''; show([], 'Location isn’t available. Allow it in the browser, or type a place.'); }, { timeout: 10000, maximumAge: 60000 });
        return;
      }
      pick(items[+b.dataset.i]);
    });
    input.addEventListener('blur', function () { setTimeout(hide, 150); });
    return { set: function (p) { input.value = p ? p.name : ''; input.dataset.picked = p ? '1' : ''; }, hide: hide };
  }

  window.Places = { search: search, trips: trips, field: field, esc: esc };
})();
} catch (e) { console.error("places.js", e); }
/* ===== today.js ===== */
try {
/* "Today" section: real-time departures (Entur, open data) and the habits week view.
   Your stops and habit log are synced in the encrypted vault like your to-dos. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try {
      var s = JSON.stringify(value);
      if (localStorage.getItem(key) === s) return;
      localStorage.setItem(key, s);
      window.dispatchEvent(new Event('dash:local'));   // lock.js adds it to the synced vault
    } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  var unlocked = false;

  /* ================= Departures (Entur) ================= */
  var CLIENT = 'jplundberg-dashboard';
  var GEO = 'https://api.entur.io/geocoder/v3/autocomplete';
  var JP = 'https://api.entur.io/journey-planner/v3/graphql';
  var MODE = {
    bus: ['#e60000', 'bus-front'], coach: ['#75a300', 'bus-front'], metro: ['#ec700c', 'train-lightrail-front'],
    tram: ['#0b91ef', 'train-lightrail-front'], rail: ['#003087', 'train-front'], water: ['#682c88', 'water'],
    air: ['#6b6d73', 'airplane']
  };
  var tr = load('dash.transit', null) || { stops: [], active: 0 };
  var calls = [], lastFetch = 0, fetchTimer = null, tickTimer = null, failed = false, rich = true;

  function activeStop() { return tr.stops[Math.min(tr.active || 0, tr.stops.length - 1)] || null; }

  function query(id) {
    return '{ stopPlace(id: ' + JSON.stringify(id) + ') { name estimatedCalls(timeRange: 7200, numberOfDepartures: 12) { ' +
      'realtime cancellation aimedDepartureTime expectedDepartureTime quay { publicCode } destinationDisplay { frontText } ' +
      'serviceJourney { line { publicCode transportMode' + (rich ? ' presentation { colour textColour }' : '') + ' } } } } }';
  }

  function fetchDepartures() {
    var stop = activeStop();
    clearTimeout(fetchTimer);
    if (!stop || !unlocked) return;
    fetch(JP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ET-Client-Name': CLIENT },
      body: JSON.stringify({ query: query(stop.id) })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && rich) { rich = false; return fetchDepartures(); }   // retry without optional fields
      if (!j.data || !j.data.stopPlace) throw new Error('no data');
      calls = j.data.stopPlace.estimatedCalls || [];
      failed = false;
      lastFetch = Date.now();
      renderDepartures();
    }).catch(function () {
      failed = true;
      renderDepartures();
    }).then(function () {
      fetchTimer = setTimeout(fetchDepartures, document.hidden ? 120000 : 30000);
    });
  }

  function renderDepartures() {
    var stop = activeStop();
    planHint();
    $('trEmpty').hidden = !!stop;
    $('trTabs').hidden = tr.stops.length < 2;
    $('trTabs').innerHTML = tr.stops.map(function (s, i) {
      return '<button type="button" data-tab="' + i + '" aria-pressed="' + (s === stop) + '">' + esc(s.name) + '</button>';
    }).join('');
    if (!stop) { $('trList').innerHTML = ''; $('trFoot').textContent = ''; return; }

    var now = Date.now();
    var upcoming = calls.filter(function (c) { return new Date(c.expectedDepartureTime).getTime() > now - 30000; }).slice(0, 6);
    if (!upcoming.length) {
      $('trList').innerHTML = '<li class="empty">' + (failed ? 'Couldn’t reach Entur right now. Trying again shortly.' : lastFetch ? 'No departures in the next two hours.' : 'Loading departures…') + '</li>';
    } else {
      $('trList').innerHTML = upcoming.map(function (c) {
        var line = (c.serviceJourney && c.serviceJourney.line) || {};
        var mode = MODE[line.transportMode] || MODE.bus;
        var col = line.presentation && line.presentation.colour ? '#' + line.presentation.colour : mode[0];
        var txt = line.presentation && line.presentation.textColour ? '#' + line.presentation.textColour : '#fff';
        var exp = new Date(c.expectedDepartureTime), aim = new Date(c.aimedDepartureTime);
        var mins = Math.round((exp - now) / 60000);
        var late = Math.round((exp - aim) / 60000);
        var when = mins <= 0 ? 'Now' : mins < 15 ? mins + ' min' : hm(exp);
        var sub = c.cancellation ? 'Cancelled' : late >= 2 ? hm(aim) + ' · ' + late + ' min late' : (mins >= 15 ? '' : hm(exp));
        var plat = c.quay && c.quay.publicCode ? (line.transportMode === 'rail' || line.transportMode === 'metro' ? 'Platform ' : 'Stop ') + esc(c.quay.publicCode) : '';
        return '<li' + (c.cancellation ? ' class="tr-cancel"' : '') + '>' +
          '<span class="tr-line" style="--lc:' + col + ';color:' + txt + '" title="' + esc(line.transportMode || '') + '">' + esc(line.publicCode || '·') + '</span>' +
          '<span class="tr-dest">' + esc((c.destinationDisplay && c.destinationDisplay.frontText) || '') + (plat ? '<small>' + plat + '</small>' : '') + '</span>' +
          '<span class="tr-time' + (mins <= 1 ? ' now' : '') + '">' + (c.realtime ? '<i class="tr-rt" title="Real time"></i>' : '') + when +
          (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></li>';
      }).join('');
    }
    $('trFoot').innerHTML = (tr.stops.length < 2 ? esc(stop.name) + ' · ' : '') + 'Real time from Entur' +
      (lastFetch ? ' · updated ' + hm(new Date(lastFetch)) : '');
  }

  /* Stop search and saved stops */
  var searchTimer = null, searchSeq = 0;
  function renderSaved() {
    $('trSaved').innerHTML = tr.stops.map(function (s, i) {
      return '<li>' + esc(s.name) + '<button type="button" data-rm="' + i + '" aria-label="Remove ' + esc(s.name) + '"><i class="bi bi-x"></i></button></li>';
    }).join('');
    $('trSearch').placeholder = tr.stops.length >= 3 ? 'You can save up to 3 stops' : 'Search for a stop, e.g. Jernbanetorget';
    $('trSearch').disabled = tr.stops.length >= 3;
  }
  $('trEdit').addEventListener('click', function () {
    var box = $('trEditBox');
    box.hidden = !box.hidden;
    $('trEdit').textContent = box.hidden ? 'Stops' : 'Done';
    if (!box.hidden) { renderSaved(); $('trSearch').value = ''; $('trResults').innerHTML = ''; $('trSearch').focus(); }
  });
  $('trSearch').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) { $('trResults').innerHTML = ''; return; }
    searchTimer = setTimeout(function () {
      var seq = ++searchSeq;
      fetch(GEO + '?q=' + encodeURIComponent(q) + '&lang=no&limit=6&layers=stopPlace', { headers: { 'ET-Client-Name': CLIENT } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (seq !== searchSeq) return;
          var f = (j.features || []).map(function (x) {
            var p = x.properties || {};
            var names = p.names || {};
            var modes = (p.transportModes || []).map(function (m) { return m.mode || m; });
            return { id: p.id, name: names.default || p.name || names.display || p.label, place: (p.address && p.address.locality) || p.locality || '', modes: modes };
          }).filter(function (x) { return x.id && x.name; });
          $('trResults').innerHTML = f.length ? f.map(function (x, i) {
            return '<li><button type="button" data-pick="' + i + '">' + esc(x.name) + '<small>' + esc([x.place].concat(x.modes.slice(0, 3)).filter(Boolean).join(' · ')) + '</small></button></li>';
          }).join('') : '<li class="empty">No stops found.</li>';
          $('trResults').__items = f;
        })
        .catch(function () { if (seq === searchSeq) $('trResults').innerHTML = '<li class="empty">Couldn’t search right now.</li>'; });
    }, 250);
  });
  $('trResults').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var x = this.__items[+b.dataset.pick];
    if (!tr.stops.some(function (s) { return s.id === x.id; })) tr.stops.push({ id: x.id, name: x.name });
    tr.active = tr.stops.length - 1;
    save('dash.transit', tr);
    $('trSearch').value = ''; $('trResults').innerHTML = '';
    renderSaved();
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  $('trSaved').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    tr.stops.splice(+b.dataset.rm, 1);
    tr.active = 0;
    save('dash.transit', tr);
    renderSaved();
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  $('trTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    tr.active = +b.dataset.tab;
    save('dash.transit', tr);
    calls = []; lastFetch = 0;
    renderDepartures(); fetchDepartures();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && unlocked && Date.now() - lastFetch > 20000) fetchDepartures();
  });

  /* Compact from/to: picking both opens the travel page with the trips */
  var pf = null, pt = null;
  function openTrip() {
    var home = window.Flow && window.Flow.travel().places.home;
    var from = pf || home || (activeStop() ? { id: activeStop().id, name: activeStop().name, stop: true } : null);
    if (!from || !pt) return;
    try { sessionStorage.setItem('dash.tripQuery', JSON.stringify({ from: from, to: pt })); } catch (e) {}
    location.href = 'travel/';
  }
  if (window.Places) {
    var fromF = window.Places.field($('trFrom'), { myLocation: true, onPick: function (p) { pf = p; if (p) { if (pt) openTrip(); else $('trTo').focus(); } } });
    var toF = window.Places.field($('trTo'), { onPick: function (p) { pt = p; if (p) openTrip(); } });
    $('trSwap').addEventListener('click', function () {
      var a = pf; pf = pt; pt = a; fromF.set(pf); toF.set(pt);
      this.classList.remove('spin'); void this.offsetWidth; this.classList.add('spin');
    });
    $('trPlan').addEventListener('submit', function (e) { e.preventDefault(); openTrip(); });
  }
  /* your usual trip: Home → Work before midday, Work → Home after (weekdays), one tap */
  function routine() {
    var el = $('trRoutine'); if (!el) return;
    var pl = window.Flow && window.Flow.travel().places, now = new Date();
    if (!pl || !pl.home || !pl.work || now.getDay() % 6 === 0) { el.hidden = true; return; }
    var morning = now.getHours() < 12, a = morning ? pl.home : pl.work, b = morning ? pl.work : pl.home;
    el.hidden = false;
    el.innerHTML = '<button type="button" class="tr-chip" data-routine><i class="bi bi-' + (morning ? 'house-door' : 'briefcase') + '"></i> ' + (morning ? 'Home' : 'Work') +
      ' <i class="bi bi-arrow-right"></i> <i class="bi bi-' + (morning ? 'briefcase' : 'house-door') + '"></i> ' + (morning ? 'Work' : 'Home') + ' <span>leave now</span></button>';
    el.querySelector('[data-routine]').onclick = function () {
      try { sessionStorage.setItem('dash.tripQuery', JSON.stringify({ from: a, to: b })); } catch (e) {}
      location.href = 'travel/';
    };
  }
  window.addEventListener('travel:change', routine);
  setInterval(routine, 10 * 60e3);
  function planHint() {
    routine();
    var s = activeStop();
    $('trFrom').placeholder = s ? 'From ' + s.name : 'From';
    $('trSub').hidden = !s;
  }

  /* ================= Habits (this week) ================= */
  var hb = load('dash.habits', null) || { list: [{ id: uid(), name: 'Training', target: 3 }], log: {} };
  var editingHabit = null;
  var DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function monday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    return x;
  }
  function renderHabits() {
    save('dash.habits', hb);
    var today = new Date(), mon = monday(today), tk = dkey(today);
    var days = [];
    for (var i = 0; i < 7; i++) { var d = new Date(mon); d.setDate(mon.getDate() + i); days.push(d); }
    var head = '<div class="hb-days hb-heads">' + days.map(function (d, i) {
      return '<span class="hb-head' + (dkey(d) === tk ? ' today' : '') + '" title="' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + '">' + DAYS[i] + '</span>';
    }).join('') + '</div>';
    if (!hb.list.length) { $('hbWeek').innerHTML = '<p class="empty">Add a habit, like training three times a week.</p>'; return; }
    $('hbWeek').innerHTML = head + hb.list.map(function (h) {
      var n = 0;
      var cells = days.map(function (d) {
        var k = dkey(d), on = (hb.log[k] || []).indexOf(h.id) > -1, future = k > tk;
        if (on) n++;
        return '<button type="button" class="hb-day' + (on ? ' on' : '') + (k === tk ? ' today' : '') + (future ? ' future' : '') + '" data-h="' + h.id + '" data-d="' + k + '"' +
          (future ? ' disabled' : '') + ' aria-pressed="' + on + '" aria-label="' + esc(h.name) + ', ' + d.toLocaleDateString('en-GB', { weekday: 'long' }) + '"><i class="bi bi-check-lg"></i></button>';
      }).join('');
      return '<div class="hb-item"><div class="hb-top"><button type="button" class="hb-name" data-edit="' + h.id + '" title="Edit ' + esc(h.name) + '">' + esc(h.name) + '</button>' +
        '<span class="hb-count' + (n >= h.target ? ' met' : '') + '">' + (n >= h.target ? '<i class="bi bi-check-circle-fill"></i> ' : '') + n + ' of ' + h.target + '</span></div>' +
        '<div class="hb-days">' + cells + '</div></div>';
    }).join('');
  }
  $('hbWeek').addEventListener('click', function (e) {
    var d = e.target.closest('.hb-day');
    if (d && !d.disabled) {
      var list = hb.log[d.dataset.d] || (hb.log[d.dataset.d] = []);
      var i = list.indexOf(d.dataset.h);
      if (i > -1) list.splice(i, 1); else list.push(d.dataset.h);
      if (!list.length) delete hb.log[d.dataset.d];
      renderHabits();
      window.dispatchEvent(new Event('habits:change'));
      return;
    }
    var n = e.target.closest('[data-edit]');
    if (n) openHabit(hb.list.filter(function (h) { return h.id === n.dataset.edit; })[0]);
  });
  function openHabit(h) {
    editingHabit = h || null;
    $('hbForm').hidden = false;
    $('hbName').value = h ? h.name : '';
    $('hbTarget').value = String(h ? h.target : 3);
    $('hbDelete').hidden = !h;
    $('hbName').focus();
  }
  function closeHabit() { $('hbForm').hidden = true; editingHabit = null; }
  $('hbAddBtn').addEventListener('click', function () { $('hbForm').hidden ? openHabit(null) : closeHabit(); });
  $('hbCancel').addEventListener('click', closeHabit);
  $('hbDelete').addEventListener('click', function () {
    var id = editingHabit && editingHabit.id;
    hb.list = hb.list.filter(function (h) { return h.id !== id; });
    Object.keys(hb.log).forEach(function (k) {
      hb.log[k] = hb.log[k].filter(function (x) { return x !== id; });
      if (!hb.log[k].length) delete hb.log[k];
    });
    closeHabit(); renderHabits();
    window.dispatchEvent(new Event('habits:change'));
  });
  $('hbForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('hbName').value.trim(), t = +$('hbTarget').value;
    if (!name) return;
    if (editingHabit) { editingHabit.name = name; editingHabit.target = t; }
    else hb.list.push({ id: uid(), name: name, target: t });
    closeHabit(); renderHabits();
    window.dispatchEvent(new Event('habits:change'));
  });
  /* the Goals card changed a habit (linked goal) */
  window.addEventListener('habits:change', function (e) {
    var fresh = load('dash.habits', hb);
    if (JSON.stringify(fresh) !== JSON.stringify(hb)) { hb = fresh; renderHabits(); }
  });

  /* A new day or a new week: redraw at midnight */
  var dayShown = dkey(new Date());
  setInterval(function () {
    if (dkey(new Date()) !== dayShown) { dayShown = dkey(new Date()); renderHabits(); }
    if (unlocked) renderDepartures();   // keeps "3 min" counting down between fetches
  }, 20000);

  /* Newer data from another device */
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () {
    if (prevReload) prevReload();
    hb = load('dash.habits', hb);
    var t = load('dash.transit', tr);
    var changed = JSON.stringify(t) !== JSON.stringify(tr);
    tr = t;
    renderHabits();
    if (changed) { calls = []; lastFetch = 0; fetchDepartures(); }
    renderDepartures();
  };

  renderHabits(); window.dispatchEvent(new Event("habits:change"));
  renderDepartures();
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; renderHabits(); window.dispatchEvent(new Event('habits:change')); fetchDepartures(); });
    window.Vault.onLock(function () { unlocked = false; clearTimeout(fetchTimer); calls = []; });
  }
})();
} catch (e) { console.error("today.js", e); }
/* ===== flow.js ===== */
try {
/* Flow: small hand-offs between the parts of the dashboard.
   - route():    open the journey planner with a destination and "arrive by" time
   - addEvent(): put something in your calendar
   - logSpend(): put a cost in Finances (needs the vault to be unlocked)
   - travel():   trips, saved places and recent journeys ("dash.travel", synced)
   - leaveBy():  when to leave home to reach a place on time (Entur) */
(function () {
  "use strict";

  var TRAVEL_COLOR = '#0891b2';
  var TYPES = {
    flight: { name: 'Flight', icon: 'airplane', buffer: 90, move: true },
    train: { name: 'Train', icon: 'train-front', buffer: 10, move: true },
    bus: { name: 'Bus', icon: 'bus-front', buffer: 10, move: true },
    boat: { name: 'Ferry', icon: 'water', buffer: 30, move: true },
    car: { name: 'Car', icon: 'car-front', buffer: 10, move: true },
    hotel: { name: 'Stay', icon: 'building', buffer: 0 },
    activity: { name: 'Activity', icon: 'ticket-perforated', buffer: 10 },
    other: { name: 'Other', icon: 'pin-map', buffer: 10 }
  };

  var DOCS = {
    passport: { name: 'Passport', icon: 'passport' }, id: { name: 'National ID', icon: 'person-vcard' },
    ehic: { name: 'EU health card', icon: 'heart-pulse' }, insurance: { name: 'Travel insurance', icon: 'shield-check' },
    license: { name: 'Driving licence', icon: 'car-front' }, visa: { name: 'Visa', icon: 'globe2' }, other: { name: 'Other', icon: 'file-earmark-text' }
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }

  /* ---------- trips, places, recent ---------- */
  function travel() {
    var t = readJSON('dash.travel');
    t = t && typeof t === 'object' ? t : {};
    t.recent = Array.isArray(t.recent) ? t.recent : [];
    t.trips = Array.isArray(t.trips) ? t.trips : [];
    t.places = t.places && typeof t.places === 'object' ? t.places : {};
    t.docs = Array.isArray(t.docs) ? t.docs : [];
    return t;
  }
  function saveTravel(t) {
    writeJSON('dash.travel', t);
    window.dispatchEvent(new Event('cal:change'));
    window.dispatchEvent(new Event('travel:change'));
  }

  /* A booking's start and end as dates (time optional) */
  function when(item) {
    if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return null;
    var p = item.date.split('-'), t = /^\d{2}:\d{2}$/.test(item.time || '') ? item.time.split(':') : null;
    var start = new Date(+p[0], p[1] - 1, +p[2], t ? +t[0] : 0, t ? +t[1] : 0);
    var end = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.endDate || '') || /^\d{2}:\d{2}$/.test(item.endTime || '')) {
      var q = (item.endDate || item.date).split('-'), u = /^\d{2}:\d{2}$/.test(item.endTime || '') ? item.endTime.split(':') : null;
      end = new Date(+q[0], q[1] - 1, +q[2], u ? +u[0] : (t ? +t[0] : 0), u ? +u[1] : (t ? +t[1] : 0));
      if (t && end <= start) end = new Date(end.getTime() + 864e5);     // lands after midnight
    }
    return { start: start, end: end, timed: !!t };
  }

  /* ---------- hand-offs ---------- */
  /* q: { to: place | toText, from: place | fromText, arriveBy: Date|ISO, departAt: Date|ISO,
          context: { title, note, cat } } */
  function route(q) {
    q = Object.assign({}, q);
    ['arriveBy', 'departAt'].forEach(function (k) { if (q[k] instanceof Date) q[k] = q[k].toISOString(); });
    try { sessionStorage.setItem('dash.tripQuery', JSON.stringify(q)); } catch (e) {}
    location.href = '/cmd/travel/';
  }

  function addEvent(e) {
    var d = readJSON('dash.calendar') || {};
    d.events = Array.isArray(d.events) ? d.events : [];
    var ev = Object.assign({ id: uid(), cat: 'life' }, e);
    d.events.push(ev);
    writeJSON('dash.calendar', d);
    window.dispatchEvent(new Event('cal:change'));
    return ev.id;
  }

  function logSpend(x) {
    if (!window.Vault || !window.Vault.get()) return false;
    var d = window.Vault.get();
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var id = uid();
    d.expenses.push({ id: id, t: Date.now(), date: x.date || dkey(new Date()), amount: Math.round(x.amount * 100) / 100,
      cat: x.cat || 'travel', note: String(x.note || '').slice(0, 80) });
    window.Vault.save(d);
    return id;
  }
  function unlogSpend(id) {
    if (!id || !window.Vault || !window.Vault.get()) return;
    var d = window.Vault.get();
    d.expenses = (d.expenses || []).filter(function (e) { return e.id !== id; });
    window.Vault.save(d);
  }

  /* ---------- "leave by" for a place and a time ---------- */
  var LB_KEY = 'dash.leaveBy';
  function leaveBy(placeText, arrive, home) {
    if (!window.Places || !home || !placeText) return Promise.resolve(null);
    var key = home.name + '|' + placeText + '|' + new Date(arrive).toISOString();
    var cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(LB_KEY)) || {}; } catch (e) {}
    var c = cache[key];
    if (c && Date.now() - c.at < 10 * 60e3) return Promise.resolve(c.r);
    return window.Places.search(placeText, { limit: 1 }).then(function (list) {
      var to = list && list[0];
      if (!to) return null;
      return window.Places.trips(home, to, { time: new Date(arrive).toISOString(), arriveBy: true }).then(function (t) {
        var best = (t.tripPatterns || []).filter(function (p) { return new Date(p.expectedEndTime) <= new Date(arrive); })
          .sort(function (a, b) { return new Date(b.expectedStartTime) - new Date(a.expectedStartTime); })[0];
        if (!best) return null;
        var rides = (best.legs || []).filter(function (l) { return l.mode !== 'foot'; });
        var r = { leave: best.expectedStartTime, arrive: best.expectedEndTime, minutes: Math.round(best.duration / 60), to: to,
          lines: rides.map(function (l) { return (l.line && l.line.publicCode) || ''; }).filter(Boolean).slice(0, 3) };
        cache[key] = { at: Date.now(), r: r };
        try { sessionStorage.setItem(LB_KEY, JSON.stringify(cache)); } catch (e) {}
        return r;
      });
    }).catch(function () { return null; });
  }

  window.Flow = {
    TRAVEL_COLOR: TRAVEL_COLOR, TYPES: TYPES, DOCS: DOCS,
    travel: travel, saveTravel: saveTravel, when: when,
    route: route, addEvent: addEvent, logSpend: logSpend, unlogSpend: unlogSpend, leaveBy: leaveBy,
    uid: uid, dkey: dkey, hm: hm
  };
})();
} catch (e) { console.error("flow.js", e); }
/* ===== calendar/cal-core.js ===== */
try {
/* Calendar engine, shared by the calendar page and the dashboard card.
   - Your own events live in "dash.calendar" and are synced in the encrypted vault.
   - Phone calendars (iCloud, Google, Outlook links) are read through the Worker
     (/cmd/api/calendar) and shown read-only. The links are kept in the vault too. */
(function () {
  "use strict";

  var KEY = 'dash.calendar';
  var API = '/cmd/api/calendar';
  var FRESH_MS = 10 * 60 * 1000;
  /* Your categories (Calendar settings). These are the defaults; "Life" from before became "Personal". */
  var DEFAULT_CATS = [
    { id: 'work', name: 'Work', color: '#3987e5' },
    { id: 'study', name: 'Study', color: '#8a6fdf' },
    { id: 'training', name: 'Training', color: '#d55181' },
    { id: 'social', name: 'Social', color: '#e8743b' },
    { id: 'personal', name: 'Personal', color: '#22b35e' }
  ];
  var CATS = {};                 // id → {name, color}, kept up to date by load()
  var CAT_ORDER = [];
  function setCats(list) {
    Object.keys(CATS).forEach(function (k) { delete CATS[k]; });
    CAT_ORDER.length = 0;
    list.forEach(function (c) { CATS[c.id] = { name: c.name, color: c.color }; CAT_ORDER.push(c.id); });
  }
  setCats(DEFAULT_CATS);
  function catOf(id) {
    if (CATS[id]) return id;
    if (id === 'life' && CATS.personal) return 'personal';
    return CATS.personal ? 'personal' : CAT_ORDER[CAT_ORDER.length - 1];
  }
  var HOLIDAY_COLOR = '#e66767';
  var PREFS = { weekNums: true, holidays: true, view: 'last', dur: 60, cat: 'last', dayStart: 7, cardHide: {} };
  function prefs(d) {
    var p = (d || load()).prefs || {}, out = {};
    Object.keys(PREFS).forEach(function (k) { out[k] = p[k] == null ? PREFS[k] : p[k]; });
    if (!out.cardHide || typeof out.cardHide !== 'object') out.cardHide = {};
    return out;
  }
  /* ISO week number (uke) */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  var FEED_COLORS = ['#e8743b', '#d55181', '#14b8a6', '#c9a227', '#7a8794'];
  var WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds()); }
  function monday(d) { var x = day0(d); return addDays(x, -((x.getDay() + 6) % 7)); }
  function occKey(d) { return dkey(d) + 'T' + hm(d); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- your own events ---------- */
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    d = d && typeof d === 'object' ? d : {};
    d.events = Array.isArray(d.events) ? d.events : [];
    d.feeds = Array.isArray(d.feeds) ? d.feeds : [];
    d.hidden = d.hidden && typeof d.hidden === 'object' ? d.hidden : {};
    var ok = Array.isArray(d.cats) && d.cats.length && d.cats.every(function (c) { return c && c.id && c.name && /^#[0-9a-f]{6}$/i.test(c.color || ''); });
    setCats(ok ? d.cats : DEFAULT_CATS);
    if (d.hidden.life && !CATS.life) { d.hidden.personal = 1; delete d.hidden.life; }
    return d;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
    window.dispatchEvent(new Event('cal:change'));
  }

  var REPEATS = {
    '': null,
    daily: { freq: 'DAILY', interval: 1 },
    weekdays: { freq: 'WEEKLY', interval: 1, byday: [1, 2, 3, 4, 5].map(function (w) { return { wd: w, n: 0 }; }) },
    weekly: { freq: 'WEEKLY', interval: 1 },
    '2weeks': { freq: 'WEEKLY', interval: 2 },
    monthly: { freq: 'MONTHLY', interval: 1 },
    quarterly: { freq: 'MONTHLY', interval: 3 },
    yearly: { freq: 'YEARLY', interval: 1 }
  };
  var REPEAT_NAMES = { '': 'Never', daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', '2weeks': 'Every 2 weeks', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

  /* Turns a stored event into the common shape used for both sources */
  function fromOwn(e) {
    var base = fromKey(e.date);
    var ev = { id: e.id, own: e, title: e.title || 'Untitled', cat: catOf(e.cat), allDay: !!e.allDay,
               location: e.location || '', notes: e.notes || '', exDays: {} };
    ev.color = CATS[ev.cat].color;
    if (ev.allDay) {
      ev.start = base;
      var end = e.end ? fromKey(e.end) : base;
      ev.days = Math.max(1, Math.round((day0(end) - base) / 864e5) + 1);
    } else {
      var a = String(e.start || '09:00').split(':'), b = String(e.stop || '').split(':');
      ev.start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), +a[0] || 0, +a[1] || 0);
      var stop = b.length === 2 ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), +b[0] || 0, +b[1] || 0) : null;
      if (!stop || stop <= ev.start) stop = stop && stop < ev.start ? addDays(stop, 1) : new Date(ev.start.getTime() + 3600e3);
      ev.dur = stop - ev.start;
    }
    var r = REPEATS[e.repeat || ''];
    if (r) {
      ev.rule = Object.assign({}, r, { clamp: true });
      if (e.until) { var u = fromKey(e.until); ev.rule.until = new Date(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59); }
    }
    (e.skip || []).forEach(function (k) { ev.exDays[k] = 1; });
    return ev;
  }

  /* ---------- repeats (RFC 5545 subset: the rules phones actually use) ---------- */
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthDays(y, m, r, s0) {
    var dim = daysInMonth(y, m), out = [];
    if (r.bymonthday) {
      r.bymonthday.forEach(function (n) { var d = n > 0 ? n : dim + 1 + n; if (d >= 1 && d <= dim) out.push(d); });
    } else if (r.byday && r.byday.length) {
      r.byday.forEach(function (b) {
        var first = (b.wd - new Date(y, m, 1).getDay() + 7) % 7 + 1, all = [];
        for (var d = first; d <= dim; d += 7) all.push(d);
        if (!b.n) out = out.concat(all);
        else { var pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) out.push(pick); }
      });
    } else if (s0.getDate() <= dim) out.push(s0.getDate());
    else if (r.clamp) out.push(dim);                    // your own "every month" on the 31st: last day
    out = out.filter(function (d, i) { return out.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    if (r.setpos && out.length) {
      out = r.setpos.map(function (p) { return p > 0 ? out[p - 1] : out[out.length + p]; }).filter(Boolean);
    }
    return out;
  }

  /* Start times of every occurrence of ev that overlaps [from, to) */
  function expand(ev, from, to) {
    var out = [], s0 = ev.start, r = ev.rule;
    function endOf(s) { return ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0)); }
    function take(s) {
      if (ev.exDays && ev.exDays[dkey(s)]) return;
      if (ev.exTimes && ev.exTimes[occKey(s)]) return;
      var e = endOf(s);
      if ((e > from || (+e === +s && s >= from)) && s < to) out.push(s);
    }
    if (!r) { take(s0); return out; }

    var n = 0, count = r.count || Infinity, until = r.until, iv = r.interval || 1, guard = 0, stop = false;
    var H = s0.getHours(), M = s0.getMinutes(), S = s0.getSeconds();
    function at(y, m, d) { return new Date(y, m, d, H, M, S); }
    function emit(s) {
      if (s < s0) return;
      if ((until && s > until) || n >= count || s >= to) { stop = true; return; }
      n++; take(s);
    }
    /* Without a count we can jump close to the window instead of walking from the start */
    var lookBack = ev.allDay ? (ev.days || 1) : Math.ceil((ev.dur || 0) / 864e5) + 1;
    var jumpTo = !r.count && from > s0 ? addDays(day0(from), -lookBack - 1) : null;

    if (r.freq === 'DAILY') {
      var d = day0(s0);
      if (jumpTo) { var k = Math.floor((jumpTo - d) / (864e5 * iv)); if (k > 0) d = addDays(d, k * iv); }
      for (; !stop && guard++ < 40000; d = addDays(d, iv)) {
        if (r.byday && !r.byday.some(function (b) { return b.wd === d.getDay(); })) continue;
        if (r.bymonth && r.bymonth.indexOf(d.getMonth()) < 0) continue;
        emit(at(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    } else if (r.freq === 'WEEKLY') {
      var wds = (r.byday && r.byday.length ? r.byday.map(function (b) { return b.wd; }) : [s0.getDay()])
        .map(function (w) { return (w + 6) % 7; }).sort();
      var w = monday(s0);
      if (jumpTo) { var kw = Math.floor((monday(jumpTo) - w) / (7 * 864e5 * iv)); if (kw > 0) w = addDays(w, kw * 7 * iv); }
      for (; !stop && guard++ < 6000; w = addDays(w, 7 * iv)) {
        for (var i = 0; i < wds.length && !stop; i++) emit(at(w.getFullYear(), w.getMonth(), w.getDate() + wds[i]));
      }
    } else if (r.freq === 'MONTHLY') {
      for (var mi = 0; !stop && guard++ < 2400; mi += iv) {
        var first = new Date(s0.getFullYear(), s0.getMonth() + mi, 1);
        if (first >= to) break;
        var ds = monthDays(first.getFullYear(), first.getMonth(), r, s0);
        for (var j = 0; j < ds.length && !stop; j++) emit(at(first.getFullYear(), first.getMonth(), ds[j]));
      }
    } else if (r.freq === 'YEARLY') {
      var months = r.bymonth && r.bymonth.length ? r.bymonth.slice().sort(function (a, b) { return a - b; }) : [s0.getMonth()];
      for (var yi = 0; !stop && guard++ < 400; yi += iv) {
        var y = s0.getFullYear() + yi;
        if (new Date(y, 0, 1) >= to) break;
        for (var q = 0; q < months.length && !stop; q++) {
          var mdays = monthDays(y, months[q], r, s0);
          for (var z = 0; z < mdays.length && !stop; z++) emit(at(y, months[q], mdays[z]));
        }
      }
    }
    return out;
  }

  /* ---------- phone calendar files (.ics) ---------- */
  var WIN_TZ = {
    'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
    'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'FLE Standard Time': 'Europe/Helsinki', 'E. Europe Standard Time': 'Europe/Chisinau',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
    'Pacific Standard Time': 'America/Los_Angeles', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC'
  };
  var tzOk = {}, fmts = {};
  function tzName(raw) {
    var tz = String(raw || '').replace(/^"|"$/g, '').replace(/^\/[^/]*\/[^/]*\//, '');   // also "/mozilla.org/20050126_1/Europe/Oslo"
    tz = WIN_TZ[tz] || tz;
    if (!(tz in tzOk)) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); tzOk[tz] = true; } catch (e) { tzOk[tz] = false; } }
    return tzOk[tz] ? tz : null;
  }
  function tzOffset(ms, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  }
  function parseDT(v, params) {
    var m = String(v || '').trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    var Y = +m[1], Mo = m[2] - 1, D = +m[3];
    if (!m[4]) return { d: new Date(Y, Mo, D), allDay: true };
    var h = +m[4], mi = +m[5], s = +(m[6] || 0);
    if (m[7]) return { d: new Date(Date.UTC(Y, Mo, D, h, mi, s)), allDay: false };
    var tz = params && params.TZID ? tzName(params.TZID) : null;
    if (tz) {
      var g = Date.UTC(Y, Mo, D, h, mi, s), t = g - tzOffset(g, tz);
      t = g - tzOffset(t, tz);
      return { d: new Date(t), allDay: false };
    }
    return { d: new Date(Y, Mo, D, h, mi, s), allDay: false };
  }
  function parseDuration(v) {
    var m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return 0;
    var ms = (((+m[2] || 0) * 7 + (+m[3] || 0)) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }
  function parseRule(v) {
    var r = {};
    String(v).split(';').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) r[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); });
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.FREQ)) return null;
    var out = { freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1) };
    if (r.COUNT) out.count = +r.COUNT;
    if (r.UNTIL) {
      var u = parseDT(r.UNTIL, {});
      if (u) out.until = u.allDay ? new Date(u.d.getFullYear(), u.d.getMonth(), u.d.getDate(), 23, 59, 59) : u.d;
    }
    if (r.BYDAY) out.byday = r.BYDAY.split(',').map(function (x) {
      var m = x.trim().match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
      return m ? { n: +(m[1] || 0), wd: WD.indexOf(m[2]) } : null;
    }).filter(Boolean);
    if (r.BYMONTHDAY) out.bymonthday = r.BYMONTHDAY.split(',').map(Number).filter(Boolean);
    if (r.BYMONTH) out.bymonth = r.BYMONTH.split(',').map(function (n) { return n - 1; });
    if (r.BYSETPOS) out.setpos = r.BYSETPOS.split(',').map(Number).filter(Boolean);
    return out;
  }
  function unescapeText(s) {
    return String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function parseICS(text, feed) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var raw = [], cur = null, depth = 0;
    lines.forEach(function (line) {
      if (/^BEGIN:VEVENT$/i.test(line)) { cur = { p: {}, ex: [] }; depth = 0; return; }
      if (!cur) return;
      if (/^END:VEVENT$/i.test(line)) { raw.push(cur); cur = null; return; }
      if (/^BEGIN:/i.test(line)) { depth++; return; }           // VALARM and friends
      if (/^END:/i.test(line)) { depth--; return; }
      if (depth > 0) return;
      var m = line.match(/^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^:;]*))*):([\s\S]*)$/);
      if (!m) return;
      var name = m[1].toUpperCase(), params = {};
      (m[2].match(/;[^:;=]+=(?:"[^"]*"|[^:;]*)/g) || []).forEach(function (kv) {
        var i = kv.indexOf('='); params[kv.slice(1, i).toUpperCase()] = kv.slice(i + 1).replace(/^"|"$/g, '');
      });
      if (name === 'EXDATE') cur.ex.push({ v: m[3], params: params });
      else cur.p[name] = { v: m[3], params: params };
    });

    var events = [], masters = {}, overrides = [];
    raw.forEach(function (x, i) {
      var P = x.p;
      if (!P.DTSTART) return;
      var st = parseDT(P.DTSTART.v, P.DTSTART.params);
      if (!st) return;
      var allDay = st.allDay || (P.DTSTART.params.VALUE || '').toUpperCase() === 'DATE';
      var ev = {
        id: feed.id + ':' + (P.UID ? P.UID.v : i) + (P['RECURRENCE-ID'] ? ':' + P['RECURRENCE-ID'].v : ''),
        title: unescapeText(P.SUMMARY ? P.SUMMARY.v : '') || 'Busy',
        location: unescapeText(P.LOCATION ? P.LOCATION.v : ''),
        notes: unescapeText(P.DESCRIPTION ? P.DESCRIPTION.v : '').slice(0, 2000),
        allDay: allDay, start: allDay ? day0(st.d) : st.d, color: feed.color, feed: feed.id, src: feed.name, readOnly: true,
        exDays: {}, exTimes: {}, cancelled: P.STATUS && /CANCELLED/i.test(P.STATUS.v)
      };
      var en = P.DTEND ? parseDT(P.DTEND.v, P.DTEND.params) : null;
      var dur = P.DURATION ? parseDuration(P.DURATION.v) : null;
      if (allDay) {
        var endD = en ? day0(en.d) : (dur ? addDays(ev.start, Math.round(dur / 864e5)) : addDays(ev.start, 1));
        ev.days = Math.max(1, Math.round((endD - ev.start) / 864e5));
      } else {
        ev.dur = Math.max(0, en ? en.d - ev.start : (dur || 0));
      }
      if (P.RRULE) ev.rule = parseRule(P.RRULE.v);
      x.ex.forEach(function (e) {
        e.v.split(',').forEach(function (v) {
          var t = parseDT(v, e.params);
          if (!t) return;
          if (t.allDay || allDay) ev.exDays[dkey(t.d)] = 1; else ev.exTimes[occKey(t.d)] = 1;
        });
      });
      if (P['RECURRENCE-ID']) {
        var rid = parseDT(P['RECURRENCE-ID'].v, P['RECURRENCE-ID'].params);
        if (rid) overrides.push({ uid: P.UID ? P.UID.v : '', rid: rid, ev: ev });
        return;
      }
      if (ev.cancelled) return;
      if (P.UID) masters[P.UID.v] = ev;
      events.push(ev);
    });
    /* A moved or cancelled single occurrence replaces that day in the series */
    overrides.forEach(function (o) {
      var m = masters[o.uid];
      if (m) { if (o.rid.allDay || m.allDay) m.exDays[dkey(o.rid.d)] = 1; else m.exTimes[occKey(o.rid.d)] = 1; }
      if (!o.ev.cancelled) { delete o.ev.rule; events.push(o.ev); }
    });
    return events;
  }

  /* ---------- fetching phone calendars ---------- */
  var feedState = {};          // id -> { events, at, error, loading }
  function cacheKey(id) { return 'dash.calfeed.' + id; }
  function fromCache(f) {
    if (feedState[f.id]) return feedState[f.id];
    var c = null;
    try { c = JSON.parse(sessionStorage.getItem(cacheKey(f.id))); } catch (e) {}
    if (c && c.url === f.url && c.text) {
      feedState[f.id] = { events: parseICS(c.text, f), at: c.at };
      return feedState[f.id];
    }
    return null;
  }
  var ERRORS = {
    'unsupported link': 'This isn’t an iCloud, Google or Outlook calendar link.',
    'not a link': 'That doesn’t look like a link.',
    'calendar not found': 'The calendar wasn’t found. The link may have been turned off or changed.',
    'not a calendar': 'The link didn’t return a calendar.',
    'not found': 'Update the Worker code to use phone calendars.',
    'unauthorized': 'Not signed in. Reload the page.'
  };
  function fetchFeed(f) {
    var st = feedState[f.id] = feedState[f.id] || {};
    st.loading = true;
    return fetch(API, { method: 'POST', cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: f.url }) })
      .then(function (r) {
        if (r.ok) return r.text();
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(ERRORS[j.error] || (j.error ? 'Couldn’t load it (' + j.error + ').' : 'Couldn’t load it (' + r.status + ').'));
        });
      })
      .then(function (text) {
        st.events = parseICS(text, f); st.at = Date.now(); st.error = ''; st.loading = false;
        try { sessionStorage.setItem(cacheKey(f.id), JSON.stringify({ url: f.url, at: st.at, text: text })); } catch (e) {}
      })
      .catch(function (e) {
        st.loading = false;
        st.error = e && e.message && !/fetch|network/i.test(e.message) ? e.message : 'No connection to the calendar right now.';
      });
  }
  function refreshFeeds(force) {
    var d = load();
    var jobs = d.feeds.map(function (f) {
      var c = fromCache(f);
      if (!force && c && c.at && Date.now() - c.at < FRESH_MS) return null;
      return fetchFeed(f);
    }).filter(Boolean);
    if (!jobs.length) return Promise.resolve();
    window.dispatchEvent(new Event('cal:change'));
    return Promise.all(jobs).then(function () { window.dispatchEvent(new Event('cal:change')); });
  }
  function clearFeeds() {
    feedState = {};
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('dash.calfeed.') === 0) sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ---------- trips and bookings from the Travel page ---------- */
  function travelEvents() {
    if (!window.Flow) return [];
    var F = window.Flow, out = [];
    F.travel().trips.forEach(function (tr) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tr.start || '')) {
        var s = fromKey(tr.start), e = tr.end && tr.end >= tr.start ? fromKey(tr.end) : s;
        out.push({ id: 'trip:' + tr.id, title: tr.name || tr.dest || 'Trip', allDay: true, start: s,
          days: Math.round((e - s) / 864e5) + 1, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id,
          location: '', notes: tr.dest ? 'Trip to ' + tr.dest : '', exDays: {} });
      }
      (tr.items || []).forEach(function (it) {
        var w = F.when(it), T = F.TYPES[it.type] || F.TYPES.other;
        if (!w) return;
        var title = it.title || T.name;
        if (T.move && it.from && it.to) title += ' · ' + it.from + ' → ' + it.to;
        var ev = { id: 'trip:' + tr.id + ':' + it.id, title: title, color: F.TRAVEL_COLOR, readOnly: true, trip: tr.id, item: it,
          location: it.from || it.to || '', notes: it.ref ? 'Booking reference: ' + it.ref : '', exDays: {}, buffer: T.buffer };
        if (w.timed) { ev.allDay = false; ev.start = w.start; ev.dur = w.end ? w.end - w.start : 3600e3; }
        else { ev.allDay = true; ev.start = w.start; ev.days = 1; }
        out.push(ev);
        /* online check-in opens 24 h before a flight */
        if (it.type === 'flight' && w.timed && !(tr.done && tr.done['checkin:' + it.id])) {
          out.push({ id: ev.id + ':checkin', title: 'Check-in opens: ' + (it.title || 'flight'), color: F.TRAVEL_COLOR, readOnly: true,
            trip: tr.id, allDay: false, start: new Date(w.start.getTime() - 864e5), dur: 15 * 60e3, location: '',
            notes: 'Check in online for ' + (it.title || 'your flight') + (it.ref ? ' (booking reference ' + it.ref + ')' : '') + '.', exDays: {} });
        }
      });
    });
    /* travel documents: the expiry date, and a reminder to renew */
    F.travel().docs.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return;
      var K = (F.DOCS[d.kind] || F.DOCS.other), name = d.name || K.name, exp = fromKey(d.expires);
      out.push({ id: 'doc:' + d.id, title: name + ' expires', allDay: true, start: exp, days: 1, color: F.TRAVEL_COLOR, readOnly: true,
        doc: d.id, location: '', notes: d.note || '', exDays: {} });
      var months = +d.remind || 6, rem = new Date(exp.getFullYear(), exp.getMonth() - months, exp.getDate());
      out.push({ id: 'doc:' + d.id + ':renew', title: 'Renew ' + name.charAt(0).toLowerCase() + name.slice(1), allDay: true, start: rem, days: 1,
        color: F.TRAVEL_COLOR, readOnly: true, doc: d.id, location: '',
        notes: name + ' expires ' + exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.', exDays: {} });
    });
    return out;
  }

  /* ---------- everything in a time window ---------- */
  function occurrences(from, to, opts) {
    opts = opts || {};
    var d = load(), list = [];
    function add(ev) {
      expand(ev, from, to).forEach(function (s) {
        var end = ev.allDay ? addDays(day0(s), ev.days || 1) : new Date(s.getTime() + (ev.dur || 0));
        list.push({ ev: ev, start: s, end: end, allDay: ev.allDay, title: ev.title, color: ev.color, key: ev.id + '@' + occKey(s) });
      });
    }
    d.events.forEach(function (e) {
      var ev = fromOwn(e);
      if (!opts.all && d.hidden[ev.cat]) return;
      add(ev);
    });
    d.feeds.forEach(function (f) {
      if (!opts.all && d.hidden['feed:' + f.id]) return;
      var st = fromCache(f) || feedState[f.id];
      if (st && st.events) st.events.forEach(function (ev) { ev.color = f.color; ev.src = f.name; ev.feedId = f.id; add(ev); });
    });
    var Fe = window.Features;
    if ((opts.all || !d.hidden.travel) && (!Fe || Fe.on('travel'))) travelEvents().forEach(add);
    /* reminders from the tools in Settings → Features (renewals, warranties, certificates) */
    /* from your tools: workouts and courses go in their category, the rest under Reminders */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat) {
        var cid = catOf(ev.cat);
        if (!opts.all && d.hidden[cid]) return;
        ev.color = CATS[cid].color;
      } else if (!opts.all && d.hidden.reminders) return;
      add(ev);
    });
    /* paydays from your budget (under Reminders) */
    var Bu = window.Budget, vault = window.Vault && window.Vault.get();
    if (Bu && vault && (!Fe || Fe.on('finance')) && (opts.all || !d.hidden.reminders)) Bu.paydays(vault, from, to).forEach(function (p) {
      add({ id: 'pay:' + p.date.getTime(), title: p.title, allDay: true, start: p.date, days: 1, color: '#11a597', readOnly: true, reminder: true,
        link: '/cmd/#fin', location: '', notes: (p.net ? 'About ' + Math.round(p.net).toLocaleString('nb-NO') + ' kr' + (p.row.note ? ' · ' + p.row.note : '') + '. ' : '') + 'From your budget on the dashboard.', exDays: {} });
    });
    /* Norwegian public holidays */
    var p = prefs(d);
    if (Fe && p.holidays && (opts.all || !d.hidden.holidays)) {
      for (var y = from.getFullYear(); y <= to.getFullYear(); y++) Fe.holidays(y).forEach(function (h) {
        add({ id: 'hol:' + h.date, title: h.name, allDay: true, start: fromKey(h.date), days: 1, color: HOLIDAY_COLOR, readOnly: true,
          holiday: true, location: '', notes: h.no + ' – a public holiday in Norway.', exDays: {} });
      });
    }
    if (opts.card) list = list.filter(function (o) {
      var ch = p.cardHide;
      if (o.ev.own) return !ch[o.ev.cat];
      if (o.ev.src) return !ch['feed:' + o.ev.feedId];
      if (o.ev.holiday) return !ch.holidays;
      if (o.ev.tool) return !ch[catOf(o.ev.cat)];
      if (o.ev.reminder) return !ch.reminders;
      return !ch.travel;
    });
    list.sort(function (a, b) {
      if (a.allDay !== b.allDay && dkey(a.start) === dkey(b.start)) return a.allDay ? -1 : 1;
      return a.start - b.start || b.end - a.end || (a.title > b.title ? 1 : -1);
    });
    return list;
  }

  /* ---------- small display helpers ---------- */
  function sameDay(a, b) { return dkey(a) === dkey(b); }
  function dayLabel(d, long) {
    var t = day0(new Date()), diff = Math.round((day0(d) - t) / 864e5);
    var date = d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
    if (diff === 0) return 'Today · ' + date;
    if (diff === 1) return 'Tomorrow · ' + date;
    if (diff === -1) return 'Yesterday · ' + date;
    return date;
  }
  function timeLabel(o, onDay) {
    if (o.allDay) return 'All day';
    var s = o.start, e = o.end;
    if (onDay && !sameDay(s, onDay)) return sameDay(e, onDay) ? 'Until ' + hm(e) : 'All day';
    return hm(s) + (o.end > o.start ? '–' + hm(e) : '');
  }

  window.Cal = {
    CATS: CATS, CAT_ORDER: CAT_ORDER, DEFAULT_CATS: DEFAULT_CATS, catOf: catOf, prefs: prefs, isoWeek: isoWeek, HOLIDAY_COLOR: HOLIDAY_COLOR, TRAVEL_COLOR: '#0891b2', FEED_COLORS: FEED_COLORS, REPEAT_NAMES: REPEAT_NAMES,
    load: load, save: save, uid: uid, esc: esc,
    occurrences: occurrences, expand: expand, fromOwn: fromOwn, parseICS: parseICS,
    refreshFeeds: refreshFeeds, fetchFeed: fetchFeed, clearFeeds: clearFeeds,
    feedState: function (id) { return feedState[id] || null; },
    dkey: dkey, hm: hm, fromKey: fromKey, day0: day0, addDays: addDays, monday: monday, sameDay: sameDay,
    dayLabel: dayLabel, timeLabel: timeLabel
  };

  if (window.Vault) window.Vault.onLock(clearFeeds);
})();
} catch (e) { console.error("calendar/cal-core.js", e); }
/* ===== calendar/cal-settings.js ===== */
try {
/* Calendar settings: views, week numbers, holidays, defaults for new events, your own
   categories and what the dashboard card shows. Used in Settings → Calendar on the
   dashboard and in the gear sheet on the calendar page. Saved in dash.calendar (synced). */
(function () {
  "use strict";
  var C = window.Cal;
  if (!C) return;
  var esc = C.esc;
  var SWATCHES = ['#3987e5', '#8a6fdf', '#d55181', '#e8743b', '#22b35e', '#14b8a6', '#c98500', '#7a8794'];

  function update(fn) { var d = C.load(); d.prefs = C.prefs(d); fn(d, d.prefs); C.save(d); }
  function cats() { return C.CAT_ORDER.map(function (id) { return { id: id, name: C.CATS[id].name, color: C.CATS[id].color }; }); }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function sw(key, on, label, sub) {
    return '<label class="st-row"><span class="st-label"><span class="cs-l">' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<input type="checkbox" class="switch" data-cs="' + key + '"' + (on ? ' checked' : '') + '></label>';
  }

  function mount(box) {
    var armed = null;
    function render() {
      var d = C.load(), p = C.prefs(d), cs = cats();
      var hours = ''; for (var h = 5; h <= 10; h++) hours += opt(h, String(h).padStart(2, '0') + ':00', p.dayStart);
      var feeds = d.feeds || [];
      box.innerHTML =
        '<p class="st-sub"><i class="bi bi-eye"></i> View</p><section class="st-group">' +
        '<label class="st-row"><span>Open in</span><select class="st-select" data-cs="view">' +
          opt('last', 'Last used', p.view) + opt('month', 'Month', p.view) + opt('week', 'Week', p.view) + opt('list', 'List', p.view) + '</select></label>' +
        sw('weekNums', p.weekNums, 'Week numbers', 'Like “Week 44” in the month and week views') +
        '<label class="st-row"><span class="st-label">Day starts<small>Where the week view opens</small></span><select class="st-select" data-cs="dayStart">' + hours + '</select></label>' +
        sw('holidays', p.holidays, 'Norwegian public holidays', '17. mai, Easter, Christmas … also counted in Flex time') +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-plus-circle"></i> New events</p><section class="st-group">' +
        '<label class="st-row"><span>Length</span><select class="st-select" data-cs="dur">' +
          [15, 30, 45, 60, 90, 120].map(function (m) { return opt(m, m < 60 ? m + ' min' : (m / 60) + ' hour' + (m > 60 ? 's' : ''), p.dur); }).join('') + '</select></label>' +
        '<label class="st-row"><span>Category</span><select class="st-select" data-cs="cat">' + opt('last', 'Last used', p.cat) +
          cs.map(function (c) { return opt(c.id, c.name, p.cat); }).join('') + '</select></label>' +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-tags"></i> Categories <span class="st-hint">Tap the colour to change it</span></p><section class="st-group cs-cats">' +
        cs.map(function (c) {
          return '<div class="st-row cs-cat" data-cid="' + esc(c.id) + '">' +
            '<label class="cs-col" style="--c:' + c.color + '" title="Colour"><input type="color" value="' + c.color + '" data-ccol="' + esc(c.id) + '" aria-label="Colour for ' + esc(c.name) + '"></label>' +
            '<input class="cs-name" value="' + esc(c.name) + '" maxlength="24" data-cname="' + esc(c.id) + '" aria-label="Category name">' +
            (cs.length > 1 ? '<button type="button" class="text-btn danger cs-del" data-cdel="' + esc(c.id) + '">' + (armed === c.id ? 'Delete?' : '<i class="bi bi-trash3"></i>') + '</button>' : '') +
            '</div>';
        }).join('') +
        (cs.length < 8 ? '<button type="button" class="st-row st-btn cs-add" data-cadd><span><i class="bi bi-plus-lg"></i> Add category</span></button>' : '') +
        '</section><p class="st-note">Events in a deleted category move to ' + esc((C.CATS.personal || C.CATS[C.CAT_ORDER[C.CAT_ORDER.length - 1]]).name) + '.</p>' +

        '<p class="st-sub"><i class="bi bi-grid-1x2"></i> Dashboard card <span class="st-hint">What the calendar card on the dashboard shows</span></p><section class="st-group">' +
        cs.map(function (c) { return sw('card:' + c.id, !p.cardHide[c.id], '<i class="dot" style="--c:' + c.color + '"></i> ' + esc(c.name)); }).join('') +
        feeds.map(function (f) { return sw('card:feed:' + f.id, !p.cardHide['feed:' + f.id], '<i class="bi bi-phone"></i> ' + esc(f.name)); }).join('') +
        sw('card:travel', !p.cardHide.travel, '<i class="bi bi-suitcase-lg"></i> Travel') +
        sw('card:reminders', !p.cardHide.reminders, '<i class="bi bi-bell"></i> Reminders') +
        sw('card:holidays', !p.cardHide.holidays, '<i class="bi bi-flag"></i> Holidays') +
        '</section>';
    }
    box.addEventListener('change', function (e) {
      var t = e.target, k = t.dataset.cs;
      if (k) {
        update(function (d, p) {
          if (k.indexOf('card:') === 0) { var id = k.slice(5); if (t.checked) delete p.cardHide[id]; else p.cardHide[id] = 1; }
          else if (t.type === 'checkbox') p[k] = t.checked;
          else p[k] = /^(dur|dayStart)$/.test(k) ? +t.value : t.value;
          if (k === 'holidays' && t.checked) delete d.hidden.holidays;
        });
        return;
      }
      if (t.dataset.ccol || t.dataset.cname) {
        var id = t.dataset.ccol || t.dataset.cname;
        update(function (d) {
          d.cats = cats().map(function (c) {
            if (c.id !== id) return c;
            if (t.dataset.ccol && /^#[0-9a-f]{6}$/i.test(t.value)) c.color = t.value;
            if (t.dataset.cname && t.value.trim()) c.name = t.value.trim().slice(0, 24);
            return c;
          });
        });
        render();
      }
    });
    box.addEventListener('input', function (e) {    /* live colour preview */
      if (e.target.dataset.ccol) e.target.parentNode.style.setProperty('--c', e.target.value);
    });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-cdel]'))) {
        var id = b.dataset.cdel;
        if (armed !== id) { armed = id; render(); return; }
        armed = null;
        update(function (d) { d.cats = cats().filter(function (c) { return c.id !== id; }); delete d.hidden[id]; });
        render();
      } else if (e.target.closest('[data-cadd]')) {
        var used = cats().map(function (c) { return c.color; });
        var color = SWATCHES.filter(function (c) { return used.indexOf(c) < 0; })[0] || SWATCHES[0];
        var nid = 'c' + C.uid();
        update(function (d) { d.cats = cats().concat([{ id: nid, name: 'New category', color: color }]); });
        render();
        var inp = box.querySelector('[data-cname="' + nid + '"]');
        if (inp) { inp.focus(); inp.select(); }
      }
    });
    return { render: render };
  }

  window.CalSettings = { mount: mount };

  /* Settings → Calendar on the dashboard */
  var home = document.getElementById('csHome');
  if (home) {
    var m = mount(home);
    window.addEventListener('st:page', function (e) { if (e.detail === 'calendar') m.render(); if (e.detail === 'home') summary(); });
    function summary() {
      var s = document.getElementById('sumCalendar');
      if (!s) return;
      var p = C.prefs();
      s.textContent = C.CAT_ORDER.length + ' categories' + (p.weekNums ? ' · week numbers' : '') + (p.holidays ? ' · holidays' : '');
    }
    window.addEventListener('cal:change', summary);
    if (window.Vault) window.Vault.onUnlock(summary);
  }
})();
} catch (e) { console.error("calendar/cal-settings.js", e); }
/* ===== cal-card.js ===== */
try {
/* Dashboard card: the next 7 days from your calendar (own events + phone calendars). */
(function () {
  "use strict";
  var C = window.Cal;
  if (!C || !document.getElementById('calCard')) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc, unlocked = false;

  function render() {
    if (!unlocked) return;
    var now = new Date(), t0 = C.day0(now), end = C.addDays(t0, 7);
    var list = C.occurrences(t0, end, { card: true });
    var by = {};
    list.forEach(function (o) {
      for (var d = C.day0(o.start < t0 ? t0 : o.start); d < end; d = C.addDays(d, 1)) {
        (by[C.dkey(d)] = by[C.dkey(d)] || []).push(o);
        if (C.addDays(d, 1) >= o.end) break;
      }
    });
    var strip = '';
    for (var i = 0; i < 7; i++) {
      var d = C.addDays(t0, i), k = C.dkey(d), evs = by[k] || [];
      strip += '<a class="cc-day' + (i === 0 ? ' today' : '') + '" href="calendar/#d=' + k + '" aria-label="' +
        esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) + ', ' + evs.length + ' events">' +
        '<span>' + d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2) + '</span><b>' + d.getDate() + '</b>' +
        '<i class="cc-dots">' + evs.slice(0, 3).map(function (o) { return '<i style="--c:' + o.color + '"></i>'; }).join('') + '</i></a>';
    }
    /* upcoming: skip what's already over today */
    var next = list.filter(function (o) { return o.allDay ? o.end > now : o.end > now || (+o.end === +o.start && o.start >= t0 && o.start > now); }).slice(0, 5);
    var html = '', lastDay = '';
    next.forEach(function (o) {
      var s = o.start < t0 ? t0 : o.start, k = C.dkey(s);
      if (k !== lastDay) { html += '<li class="cc-h">' + esc(C.dayLabel(s)) + '</li>'; lastDay = k; }
      var sub = o.ev.location ? esc(o.ev.location) : (o.ev.src ? '<i class="bi bi-phone"></i> ' + esc(o.ev.src) : '');
      html += '<li><a class="cc-ev" href="calendar/#d=' + k + '" style="--c:' + o.color + '"><span class="t">' + (o.allDay || !C.sameDay(o.start, s) ? C.timeLabel(o, s) : C.hm(o.start)) + '</span>' +
        '<span class="bar"></span><span class="x"><b>' + esc(o.title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></a></li>';
    });
    $('ccStrip').innerHTML = strip;
    var h2 = document.querySelector('#calCard .card-head h2'), wk = h2 && h2.querySelector('.cc-wk');
    if (h2 && !wk) { wk = document.createElement('span'); wk.className = 'cc-wk'; h2.appendChild(wk); }
    if (wk) wk.textContent = C.prefs().weekNums ? 'Week ' + C.isoWeek(now) : '';
    $('ccList').innerHTML = html;
    $('ccEmpty').hidden = next.length > 0;
  }

  window.addEventListener('cal:change', render);
  window.addEventListener('todos:change', function () { setTimeout(render, 0); });
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
  var shownDay = C.dkey(new Date());
  setInterval(function () { if (C.dkey(new Date()) !== shownDay) shownDay = C.dkey(new Date()); render(); }, 60000);
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; render(); C.refreshFeeds(false); });
    window.Vault.onLock(function () { unlocked = false; });
  }
})();
} catch (e) { console.error("cal-card.js", e); }
/* ===== upnext.js ===== */
try {
/* Dashboard: "up next" in the Travel card. Ties the calendar, trips and Entur together:
   your next event with a place (and when to leave home), and your next trip. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var F = window.Flow, C = window.Cal;
  if (!F || !C || !$('trNext')) return;
  var esc = C.esc, unlocked = false, seq = 0, ev = null;

  function render() {
    if (!unlocked) return;
    var now = new Date(), t = F.travel(), rows = [];
    /* online check-in is open (24 h before a flight) */
    t.trips.forEach(function (tr) {
      (tr.items || []).forEach(function (it) {
        var w = F.when(it);
        if (it.type !== 'flight' || !w || !w.timed || (tr.done && tr.done['checkin:' + it.id])) return;
        if (now >= new Date(w.start.getTime() - 864e5) && now < w.start) {
          rows.push('<a class="un-row un-alert" href="travel/#trip=' + encodeURIComponent(tr.id) + '" style="--c:#e8b43b"><i class="bi bi-airplane un-ic"></i>' +
            '<span class="x"><b>Check in for ' + esc(it.title || 'your flight') + '</b><span class="s">Departs ' + C.hm(w.start) +
            (C.sameDay(w.start, now) ? ' today' : ' tomorrow') + (it.ref ? ' · ref ' + esc(it.ref) : '') + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
        }
      });
    });
    /* a travel document that has run out or runs out soon */
    t.docs.forEach(function (d) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires || '')) return;
      var exp = C.fromKey(d.expires), soon = new Date(exp.getFullYear(), exp.getMonth() - 1, exp.getDate());
      if (now < soon) return;
      rows.push('<a class="un-row un-alert" href="travel/#docs" style="--c:var(--danger)"><i class="bi bi-person-vcard un-ic"></i>' +
        '<span class="x"><b>' + esc(d.name || 'Document') + (exp < now ? ' has expired' : ' expires soon') + '</b><span class="s">' +
        esc(exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
    });
    ev = C.occurrences(now, C.addDays(C.day0(now), 2)).filter(function (o) {
      return !o.allDay && o.ev.location && o.start > now && !(o.ev.item && o.ev.item.type === 'hotel');
    })[0] || null;
    if (ev) rows.push('<button type="button" class="un-row" data-go style="--c:' + ev.color + '"><i class="bi bi-signpost-split un-ic"></i>' +
      '<span class="x"><b>' + esc(ev.title) + '</b><span class="s" id="unLeave">' + (C.sameDay(ev.start, now) ? 'Today ' : 'Tomorrow ') + C.hm(ev.start) +
      ' · ' + esc(ev.ev.location) + '</span></span><span class="un-cta">Route</span></button>');
    var trip = t.trips.filter(function (x) { return (x.end || x.start) >= F.dkey(now); }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
    if (trip) {
      var d = Math.round((C.fromKey(trip.start) - C.day0(now)) / 864e5), pack = trip.pack || [];
      var packed = pack.filter(function (p) { return p.done; }).length;
      rows.push('<a class="un-row" href="travel/#trip=' + encodeURIComponent(trip.id) + '" style="--c:' + F.TRAVEL_COLOR + '"><i class="bi bi-suitcase-lg un-ic"></i>' +
        '<span class="x"><b>' + esc(trip.name) + '</b><span class="s">' + (d > 0 ? 'In ' + d + ' day' + (d > 1 ? 's' : '') : 'Travelling now') +
        (pack.length ? ' · packed ' + packed + '/' + pack.length : '') + '</span></span><i class="bi bi-chevron-right un-go"></i></a>');
    }
    $('trNext').innerHTML = rows.join('');
    $('trNext').hidden = !rows.length;
    var home = t.places.home, s = ++seq;
    if (ev && home) {
      var buf = (ev.ev.buffer || 0) * 60e3;
      F.leaveBy(ev.ev.location, new Date(ev.start.getTime() - buf), home).then(function (r) {
        if (s !== seq || !r || !$('unLeave')) return;
        var mins = Math.round((new Date(r.leave) - Date.now()) / 60000);
        $('unLeave').innerHTML = '<span class="un-leave">Leave ' + C.hm(new Date(r.leave)) + '</span>' +
          (mins >= 0 && mins <= 90 ? ' (in ' + mins + ' min)' : '') + ' · ' + r.minutes + ' min' + (r.lines.length ? ' · ' + esc(r.lines.join(', ')) : '');
      });
    }
  }
  $('trNext').addEventListener('click', function (e) {
    if (!e.target.closest('[data-go]') || !ev) return;
    var buf = (ev.ev.buffer || 0) * 60e3;
    F.route({ toText: ev.ev.location, arriveBy: new Date(ev.start.getTime() - buf),
      context: { title: ev.title, note: buf ? ev.ev.buffer + ' min before ' + C.hm(ev.start) : 'starts ' + C.hm(ev.start), cat: ev.ev.cat } });
  });
  window.addEventListener('cal:change', render);
  window.addEventListener('travel:change', render);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
  setInterval(function () { if (!document.hidden) render(); }, 5 * 60e3);
  if (window.Vault) {
    window.Vault.onUnlock(function () { unlocked = true; render(); });
    window.Vault.onLock(function () { unlocked = false; });
  }
})();
} catch (e) { console.error("upnext.js", e); }
/* ===== review.js ===== */
try {
/* Reviews: a monthly check-in (last month + the month ahead) and a year in review.
   Everything is worked out here from your own data – nothing is stored or sent.
   Open from "At a glance" (it offers them on the 1st–7th, and from mid-December), or the
   Reviews button on that card, or search "review". */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, C = window.Cal, Fl = window.Flow;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ymOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function shiftYm(k, n) { var p = k.split('-'); return ymOf(new Date(+p[0], +p[1] - 1 + n, 1)); }
  function mName(k, o) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', o || { month: 'long' }); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function sum(l, f) { return (l || []).reduce(function (a, x) { return a + (+(f ? f(x) : x.amount) || 0); }, 0); }
  function hm(min) { var h = Math.floor(Math.abs(min) / 60), m = Math.round(Math.abs(min) % 60); return (min < 0 ? '−' : '') + (h ? h + 'h ' : '') + m + 'm'; }
  var CATNAME = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', travel: 'Travel', other: 'Other' };

  /* ---------- the numbers ---------- */
  function money(keyOf, test) {
    var d = window.Vault.get() || {}, ex = (d.expenses || []).filter(function (e) { return test(String(e.date)); });
    var by = {}; ex.forEach(function (e) { var c = CATNAME[e.cat] ? e.cat : 'other'; by[c] = (by[c] || 0) + (+e.amount || 0); });
    var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    /* income for the month (a year: the ordinary monthly net – June and December differ, so the year uses the sum) */
    var Bu = window.Budget, income, yearNet = 0;
    if (Bu && /^\d{4}-\d{2}$/.test(keyOf)) income = Bu.income(d, keyOf);
    else if (Bu) { for (var i = 1; i <= 12; i++) yearNet += Bu.income(d, keyOf + '-' + String(i).padStart(2, '0')); income = yearNet / 12; }
    else income = sum((d.budget || {}).income);
    var fixed = sum((d.budget || {}).fixed);
    return { spent: sum(ex), by: by, cats: cats, income: income, fixed: fixed, list: ex };
  }
  function habitsIn(from, to) {          /* weeks on target and ticks between two day keys */
    var hb = readJSON('dash.habits') || { list: [], log: {} }, out = [];
    (hb.list || []).forEach(function (h) {
      var ticks = 0, weeks = 0, met = 0;
      Object.keys(hb.log || {}).forEach(function (k) { if (k >= from && k <= to && hb.log[k].indexOf(h.id) > -1) ticks++; });
      var d = new Date(from + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      for (; dkey(d) <= to; d.setDate(d.getDate() + 7)) {
        var n = 0; for (var i = 0; i < 7; i++) { var x = new Date(d); x.setDate(d.getDate() + i); var k = dkey(x); if ((hb.log[k] || []).indexOf(h.id) > -1) n++; }
        weeks++; if (n >= h.target) met++;
      }
      out.push({ name: h.name, ticks: ticks, weeks: weeks, met: met, target: h.target });
    });
    return out;
  }
  function list(key) { return Fe && Fe.on(key) ? Fe.list(key) : []; }
  function tripsIn(from, to) {
    if (!Fl) return [];
    return Fl.travel().trips.filter(function (t) { return t.start && t.start <= to && (t.end || t.start) >= from; });
  }
  function flexMinutes(from, to) {
    var norm = ((Fe && Fe.tools().flexcfg) || {}).norm || 7.5, days = {};
    list('flex').forEach(function (e) {
      if (e.date < from || e.date > to) return;
      var r = days[e.date] = days[e.date] || { w: 0, free: false };
      if (e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday') r.free = true;
      if ((e.type === 'work' || e.type === 'course') && e.in && e.out) {
        var a = e.in.split(':'), b = e.out.split(':'), m = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]); if (m < 0) m += 1440;
        r.w += Math.max(0, m - (+e.brk || 0));
      }
    });
    var worked = 0, delta = 0;
    Object.keys(days).forEach(function (k) { worked += days[k].w; if (!days[k].free) delta += days[k].w - (Fe && Fe.holiday(k) ? 0 : norm * 60); });
    return { worked: worked, delta: delta, days: Object.keys(days).length };
  }

  /* ---------- building blocks ---------- */
  function big(icon, color, value, label, sub) {
    return '<div class="rv-big" style="--c:' + color + '"><i class="bi bi-' + icon + '"></i><b>' + value + '</b><span>' + esc(label) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }
  function section(title, icon, body) { return body ? '<section class="rv-sec"><h3><i class="bi bi-' + icon + '"></i> ' + esc(title) + '</h3>' + body + '</section>' : ''; }
  function bars(rows, max) {
    return '<ul class="rv-bars">' + rows.map(function (r) {
      return '<li><span class="n">' + esc(r[0]) + '</span><span class="b"><i style="width:' + Math.max(3, Math.round(r[1] / (max || 1) * 100)) + '%;--c:' + (r[3] || 'var(--accent)') + '"></i></span><span class="v">' + r[2] + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---------- monthly check-in ---------- */
  function monthHtml(ym) {
    var from = ym + '-01', last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0), to = dkey(last);
    var M = money(ym, function (k) { return k.slice(0, 7) === ym; });
    var prev3 = [1, 2, 3].map(function (i) { var k = shiftYm(ym, -i); return money(k, function (x) { return x.slice(0, 7) === k; }); });
    var avg = sum(prev3, function (m) { return m.spent; }) / 3;
    var left = M.income - M.fixed - M.spent;
    var html = '<p class="rv-kicker">Monthly check-in</p><h2>' + esc(mName(ym, { month: 'long', year: 'numeric' })) + '</h2>';
    var tiles = '';
    if (M.income || M.spent) tiles += big('wallet2', '#11a597', kr(M.spent), 'spent', avg ? (M.spent > avg ? '<span class="dn">' : '<span class="up">') + Math.round(Math.abs(M.spent - avg) / Math.max(avg, 1) * 100) + '% ' + (M.spent > avg ? 'more' : 'less') + '</span> than usual' : '');
    if (M.income) tiles += big('piggy-bank', left >= 0 ? '#22b35e' : '#e66767', kr(Math.abs(left)), left >= 0 ? 'left over' : 'over budget', left >= 0 ? Math.round(left / M.income * 100) + '% of income' : '');
    var trips = tripsIn(from, to);
    if (trips.length) tiles += big('suitcase-lg', '#0891b2', trips.length, 'trip' + (trips.length > 1 ? 's' : ''), esc(trips.map(function (t) { return t.name; }).join(', ')));
    var wo = list('training').filter(function (w) { return w.date >= from && w.date <= to; });
    if (wo.length) tiles += big('heart-pulse', '#d55181', wo.length, 'workouts', hm(sum(wo, function (w) { return w.min; })) + (sum(wo, function (w) { return w.km; }) ? ' · ' + Math.round(sum(wo, function (w) { return w.km; })) + ' km' : ''));
    var fx = flexMinutes(from, to);
    if (fx.worked) tiles += big('stopwatch', '#e8743b', (fx.delta >= 0 ? '+' : '') + hm(fx.delta), 'flex', hm(fx.worked) + ' worked');
    /* Apple Health: steps and sleep for the month */
    var AH = window.AHealth;
    if (AH && (!Fe || Fe.on('ahealth'))) {
      var ah = AH.stats(from, to);
      if (ah.steps.n) tiles += big('person-walking', '#22b35e', AH.fmt('steps', ah.steps.avg), 'steps a day', ah.sleep.n ? AH.fmt('sleep', ah.sleep.avg) + ' sleep a night' : '');
      else if (ah.sleep.n) tiles += big('moon-stars', '#8a6fdf', AH.fmt('sleep', ah.sleep.avg), 'sleep a night', '');
    }
    html += tiles ? '<div class="rv-grid">' + tiles + '</div>' : '<p class="muted">Not much logged this month yet.</p>';
    if (M.cats.length) html += section('Where the money went', 'pie-chart', bars(M.cats.slice(0, 5).map(function (c) {
      var p = sum(prev3, function (m) { return m.by[c] || 0; }) / 3, diff = p ? Math.round((M.by[c] - p) / p * 100) : null;
      return [CATNAME[c], M.by[c], kr(M.by[c]) + (diff !== null && Math.abs(diff) >= 15 ? ' <small class="' + (diff > 0 ? 'dn' : 'up') + '">' + (diff > 0 ? '+' : '') + diff + '%</small>' : '')];
    }), M.by[M.cats[0]]));
    var hb = habitsIn(from, to);
    if (hb.length) html += section('Habits', 'activity', bars(hb.map(function (h) { return [h.name, h.met, h.met + ' of ' + h.weeks + ' weeks on target', '#d55181']; }), Math.max.apply(null, hb.map(function (h) { return h.weeks; }))));
    var jr = list('journal').filter(function (j) { return j.date >= from && j.date <= to; });
    if (jr.length) {
      var avgMood = sum(jr, function (j) { return j.mood; }) / jr.length, best = jr.slice().sort(function (a, b) { return b.mood - a.mood; })[0];
      html += section('How it felt', 'emoji-smile', '<p>' + jr.length + ' day' + (jr.length > 1 ? 's' : '') + ' written · average mood <b>' + ['', 'bad', 'meh', 'OK', 'good', 'great'][Math.round(avgMood)] + '</b></p>' + (best ? '<p class="rv-quote">“' + esc(best.line) + '” <small>' + esc(new Date(best.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small></p>' : ''));
    }
    /* the month ahead (only for the month that just ended) */
    if (ym === shiftYm(ymOf(new Date()), -1)) {
      var nf0 = new Date(), n0 = new Date(nf0.getFullYear(), nf0.getMonth(), 1), n1 = new Date(nf0.getFullYear(), nf0.getMonth() + 1, 1), ahead = [];
      if (C) {
        var occ = C.occurrences(n0, n1).filter(function (o) { return o.ev.own || o.ev.src; });
        if (occ.length) ahead.push('<li><i class="bi bi-calendar3"></i>' + occ.length + ' event' + (occ.length > 1 ? 's' : '') + ' in your calendar</li>');
        var hol = Fe ? Fe.holidays(n0.getFullYear()).filter(function (h) { return h.date.slice(0, 7) === ymOf(n0); }) : [];
        if (hol.length) ahead.push('<li><i class="bi bi-flag"></i>' + esc(hol.map(function (h) { return h.name; }).join(', ')) + '</li>');
      }
      tripsIn(dkey(n0), dkey(new Date(n1 - 864e5))).forEach(function (t) { ahead.push('<li><i class="bi bi-suitcase-lg"></i>' + esc(t.name) + ' · ' + esc(new Date(t.start + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</li>'); });
      var d = window.Vault.get() || {}, bills = ((d.budget || {}).fixed || []).filter(function (f) { return f.day; });
      if (bills.length) ahead.push('<li><i class="bi bi-receipt"></i>' + bills.length + ' bills · ' + kr(sum(bills)) + '</li>');
      if (Fe) Fe.events().forEach(function (ev) {
        if (ev.cat || ev.rule) return;
        if (dkey(ev.start).slice(0, 7) === ymOf(n0)) ahead.push('<li><i class="bi bi-bell"></i>' + esc(ev.title) + '</li>');
      });
      if (ahead.length) html += section(mName(ymOf(n0)) + ' ahead', 'arrow-right-circle', '<ul class="rv-ahead">' + ahead.slice(0, 8).join('') + '</ul>');
    }
    return html;
  }

  /* ---------- year in review ---------- */
  function yearHtml(y) {
    y = String(y);
    var from = y + '-01-01', to = y + '-12-31';
    var M = money(y, function (k) { return k.slice(0, 4) === y; });
    var html = '<p class="rv-kicker">Year in review</p><h2>' + esc(y) + '</h2>', tiles = '';
    var trips = tripsIn(from, to), countries = {}, daysAway = 0;
    trips.forEach(function (t) {
      if (t.place && t.place.cc && t.place.cc !== 'NO') countries[t.place.cc] = t.place.country;
      var a = new Date((t.start < from ? from : t.start) + 'T12:00'), b = new Date(((t.end || t.start) > to ? to : (t.end || t.start)) + 'T12:00');
      daysAway += Math.round((b - a) / 864e5) + 1;
    });
    if (trips.length) tiles += big('globe-europe-africa', '#0891b2', trips.length, 'trips', daysAway + ' days away' + (Object.keys(countries).length ? ' · ' + Object.keys(countries).length + ' countr' + (Object.keys(countries).length > 1 ? 'ies' : 'y') : ''));
    if (M.spent) tiles += big('wallet2', '#11a597', kr(M.spent), 'spent', M.cats[0] ? 'most on ' + CATNAME[M.cats[0]].toLowerCase() : '');
    /* only months where you actually logged spending count – the rest would be guesses */
    var logged = {}; M.list.forEach(function (e) { logged[String(e.date).slice(0, 7)] = 1; });
    var months = Object.keys(logged).filter(function (k) { return k <= ymOf(new Date()); }).length;
    if (M.income && months) { var saved = M.income * months - M.fixed * months - M.spent; tiles += big('piggy-bank', saved >= 0 ? '#22b35e' : '#e66767', kr(Math.abs(saved)), saved >= 0 ? 'left over' : 'over budget', 'after fixed costs, over the ' + months + ' month' + (months > 1 ? 's' : '') + ' you logged'); }
    var wo = list('training').filter(function (w) { return w.date >= from && w.date <= to; });
    if (wo.length) tiles += big('heart-pulse', '#d55181', wo.length, 'workouts', hm(sum(wo, function (w) { return w.min; })) + (sum(wo, function (w) { return w.km; }) ? ' · ' + Math.round(sum(wo, function (w) { return w.km; })) + ' km' : ''));
    var done = list('learning').filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; });
    if (done.length) tiles += big('mortarboard', '#8a6fdf', done.length, 'courses done', esc(done.slice(0, 2).map(function (c) { return c.title; }).join(', ')));
    var fx = flexMinutes(from, to), vac = list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    if (fx.worked) tiles += big('stopwatch', '#e8743b', hm(fx.worked).replace(/ \d+m$/, ''), 'worked', vac ? vac + ' holiday days' : '');
    else if (vac) tiles += big('sun', '#e8743b', vac, 'holiday days', '');
    html += tiles ? '<div class="rv-grid">' + tiles + '</div>' : '<p class="muted">Nothing logged for ' + esc(y) + ' yet.</p>';
    /* money per month */
    var per = []; for (var i = 1; i <= 12; i++) { var key = y + '-' + pad(i); per.push([mName(key, { month: 'short' }), sum(M.list.filter(function (e) { return String(e.date).slice(0, 7) === key; }))]); }
    var maxM = Math.max.apply(null, per.map(function (p) { return p[1]; }));
    if (maxM) {
      var top = per.slice().sort(function (a, b) { return b[1] - a[1]; })[0];
      html += section('Spending through the year', 'bar-chart', '<div class="rv-cols">' + per.map(function (p) {
        return '<span title="' + esc(p[0] + ': ' + kr(p[1])) + '"><i style="height:' + Math.max(2, Math.round(p[1] / maxM * 100)) + '%"></i><small>' + esc(p[0].charAt(0)) + '</small></span>';
      }).join('') + '</div><p class="muted">Biggest month: <b>' + esc(top[0]) + '</b> · ' + kr(top[1]) + '</p>');
    }
    if (M.cats.length) html += section('Where the money went', 'pie-chart', bars(M.cats.slice(0, 6).map(function (c) { return [CATNAME[c], M.by[c], kr(M.by[c])]; }), M.by[M.cats[0]]));
    if (trips.length) html += section('Trips', 'suitcase-lg', '<ul class="rv-ahead">' + trips.map(function (t) { return '<li><i class="bi bi-geo-alt"></i>' + esc(t.name) + (t.place ? ' · ' + esc(t.place.country) : '') + ' · ' + esc(new Date(t.start + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</li>'; }).join('') + '</ul>');
    var hb = habitsIn(from, to < dkey(new Date()) ? to : dkey(new Date()));
    if (hb.length) html += section('Habits', 'activity', bars(hb.map(function (h) { return [h.name, h.met, h.met + ' of ' + h.weeks + ' weeks · ' + h.ticks + ' times', '#d55181']; }), Math.max.apply(null, hb.map(function (h) { return h.weeks; }))));
    var jr = list('journal').filter(function (j) { return String(j.date).slice(0, 4) === y; });
    if (jr.length) {
      var best = jr.slice().sort(function (a, b) { return b.mood - a.mood || (a.date < b.date ? 1 : -1); }).slice(0, 3);
      html += section('Best days', 'stars', best.map(function (j) { return '<p class="rv-quote">“' + esc(j.line) + '” <small>' + esc(new Date(j.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small></p>'; }).join(''));
    }
    return html;
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg rv-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box rv-box" role="dialog" aria-modal="true" aria-label="Review"><div class="rv-top">' +
    '<div class="seg" id="rvKind"><button type="button" data-rk="month">Month</button><button type="button" data-rk="year">Year</button></div>' +
    '<select id="rvPick" aria-label="Which"></select><button type="button" class="text-btn" data-rvclose>Close</button></div><div class="rv-body" id="rvBody"></div></div>';
  document.body.appendChild(bg);
  var kind = 'month', key = '';
  function years() {
    var ys = {}, d = window.Vault.get() || {}; ys[new Date().getFullYear()] = 1;
    (d.expenses || []).forEach(function (e) { ys[String(e.date).slice(0, 4)] = 1; });
    if (Fl) Fl.travel().trips.forEach(function (t) { if (t.start) ys[t.start.slice(0, 4)] = 1; });
    return Object.keys(ys).filter(function (y) { return /^\d{4}$/.test(y); }).sort().reverse();
  }
  function draw() {
    bg.querySelectorAll('[data-rk]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.rk === kind)); });
    var opts = [];
    if (kind === 'month') { var cur = ymOf(new Date()); for (var i = 0; i < 24; i++) { var k = shiftYm(cur, -i); opts.push([k, mName(k, { month: 'long', year: 'numeric' })]); } }
    else years().forEach(function (y) { opts.push([y, y]); });
    if (!opts.some(function (o) { return o[0] === key; })) key = kind === 'month' ? shiftYm(ymOf(new Date()), -1) : String(new Date().getFullYear());
    bg.querySelector('#rvPick').innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === key ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    bg.querySelector('#rvBody').innerHTML = kind === 'month' ? monthHtml(key) : yearHtml(key);
    bg.querySelector('#rvBody').scrollTop = 0;
  }
  function open(k, which) {
    if (!window.Vault.get()) return;
    kind = k || 'month'; key = which || '';
    draw();
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    try { localStorage.setItem('dash.reviewSeen.' + kind + '.' + key, '1'); } catch (e) {}
    window.dispatchEvent(new Event('review:seen'));
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); }
  bg.addEventListener('click', function (e) {
    var b;
    if (e.target === bg || e.target.closest('[data-rvclose]')) return close();
    if ((b = e.target.closest('[data-rk]'))) { kind = b.dataset.rk; key = ''; draw(); }
  });
  bg.querySelector('#rvPick').addEventListener('change', function () { key = this.value; draw(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-review]'); if (b) { e.preventDefault(); var p = b.dataset.review.split(':'); open(p[0], p[1]); } });
  /* arriving from search (…/#review=month) */
  function fromHash() { var m = location.hash.match(/^#review=(month|year)$/); if (m) { history.replaceState(null, '', location.pathname); setTimeout(function () { open(m[1]); }, 300); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);

  /* what At a glance should offer right now */
  function due() {
    var now = new Date(), out = [];
    if (now.getDate() <= 7) {
      var last = shiftYm(ymOf(now), -1);
      if (!readJSON('dash.reviewSeen.month.' + last)) out.push({ kind: 'month', key: last, title: 'Your ' + mName(last) + ' check-in', sub: 'Last month at a glance – and the month ahead' });
    }
    var y = now.getMonth() === 11 && now.getDate() >= 15 ? now.getFullYear() : now.getMonth() === 0 && now.getDate() <= 15 ? now.getFullYear() - 1 : null;
    if (y && !readJSON('dash.reviewSeen.year.' + y)) out.push({ kind: 'year', key: String(y), title: 'Your ' + y + ' in review', sub: 'Trips, money, workouts and habits' });
    return out;
  }
  window.Review = { open: open, due: due };
})();
} catch (e) { console.error("review.js", e); }
/* ===== brief.js ===== */
try {
/* "Today at a glance": one card that pulls the important things from every part of the
   dashboard – what's next, money left today, bills and renewals, things that expire,
   habits that need you this week, your next trip. Each line opens where it came from. */
(function () {
  "use strict";
  var box = document.getElementById('briefList');
  if (!box || !window.Vault) return;
  var Fe = window.Features, C = window.Cal, Fl = window.Flow;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function daysTo(k) { var t = new Date(); return Math.round((fromKey(k) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); }
  function inDays(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? (-n) + ' day' + (n === -1 ? '' : 's') + ' ago' : 'in ' + n + ' days'; }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n)) + ' kr'; }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* suggestions you've waved away stay away (on this device) */
  function dismissed(k) { var d = readJSON('dash.dismiss') || {}; return d[k] && d[k] > Date.now(); }
  function dismiss(k, days) {
    var d = readJSON('dash.dismiss') || {};
    Object.keys(d).forEach(function (x) { if (d[x] < Date.now()) delete d[x]; });
    d[k] = Date.now() + (days || 60) * 864e5;
    try { localStorage.setItem('dash.dismiss', JSON.stringify(d)); } catch (e) {}
  }
  var ACTIONS = {};

  function items() {
    var out = [], now = new Date(), today = dkey(now);
    function add(pri, icon, color, title, sub, href, opt) {
      var it = { pri: pri, icon: icon, color: color, title: title, sub: sub, href: href };
      if (opt) { if (opt.key && dismissed(opt.key)) return; it.key = opt.key; it.act = opt.act; it.review = opt.review; it.tip = opt.tip; it.badge = opt.badge; it.checkin = opt.checkin; }
      out.push(it);
    }
    ACTIONS = {};

    /* reviews: the monthly check-in (1st–7th) and the year in review (mid-December) */
    if (window.Review) window.Review.due().forEach(function (r) {
      add(r.kind === 'year' ? 3 : 4, r.kind === 'year' ? 'stars' : 'calendar-heart', '#8a6fdf', r.title, r.sub, '#', { review: r.kind + ':' + r.key });
    });

    /* public holiday today / tomorrow */
    if (Fe) {
      var h0 = Fe.holiday(today), h1 = Fe.holiday(dkey(new Date(now.getTime() + 864e5)));
      if (h0) add(5, 'flag', '#e66767', h0.name, 'Public holiday today', 'calendar/');
      else if (h1) add(40, 'flag', '#e66767', h1.name + ' tomorrow', 'Public holiday', 'calendar/');
    }

    /* what's next in the calendar (rest of today and tomorrow morning) */
    if (C && (!Fe || Fe.on('calendar'))) {
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
      var occ = C.occurrences(new Date(now.getFullYear(), now.getMonth(), now.getDate()), end, { card: true })
        .filter(function (o) { return !o.ev.holiday && !o.ev.reminder; });
      var timed = occ.filter(function (o) { return !o.allDay && o.end > now; });
      var next = timed[0];
      if (next) {
        var mins = Math.round((next.start - now) / 60000), when;
        if (mins <= 0) when = 'now, until ' + hm(next.end);
        else if (C.sameDay(next.start, now)) when = mins < 60 ? 'in ' + mins + ' min' : 'at ' + hm(next.start);
        else when = 'tomorrow at ' + hm(next.start);
        add(mins <= 120 ? 10 : 30, 'calendar-event', next.color, next.title, when.charAt(0).toUpperCase() + when.slice(1) +
          (next.ev.location ? ' · ' + next.ev.location : '') + (timed.length > 1 && C.sameDay(timed[1].start, now) ? ' · then ' + timed[1].title + ' ' + hm(timed[1].start) : ''),
          'calendar/#d=' + dkey(next.start));
      }
      var allDay = occ.filter(function (o) { return o.allDay && C.sameDay(o.start, now) && !o.ev.trip; });
      if (allDay.length && !next) add(35, 'calendar-check', allDay[0].color, allDay[0].title + (allDay.length > 1 ? ' + ' + (allDay.length - 1) + ' more' : ''), 'Today', 'calendar/#d=' + today);
    }

    /* money: what you can spend today, bills coming up */
    var d = window.Vault.get();
    if (d && d.budget && (!Fe || Fe.on('finance'))) {
      var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
      var Bu = window.Budget;
      var ym = today.slice(0, 7), income = Bu ? Bu.income(d, ym) : sum(d.budget.income), fixed = sum(d.budget.fixed);
      var pay = Bu ? Bu.nextPayday(d, now) : null;
      if (income > 0) {
        var per = Bu ? Bu.period(d, now) : null;
        var spent = per ? Bu.spent(d, per) : sum((d.expenses || []).filter(function (e) { return String(e.date).slice(0, 7) === ym; }));
        var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = (per ? per.income : income) - fixed - spent;
        var untilPay = (per && per.byPayday) || (pay && pay.days > 0 && pay.days <= dim);
        var perDay = left / (per && per.byPayday ? per.daysLeft : untilPay ? pay.days : dim - now.getDate() + 1);
        add(left < 0 ? 8 : 50, 'wallet2', left < 0 ? '#e66767' : '#11a597', left < 0 ? kr(-left) + ' over budget' : kr(perDay) + ' to spend today',
          left < 0 ? (per && per.byPayday ? 'Until payday' : 'This month') + ', after fixed costs' : kr(left) + ' left' + (untilPay ? ' until payday' : ' this month'), '#fin');
      }
      if (pay && pay.days <= 2) add(pay.days === 0 ? 12 : 40, 'cash-stack', '#11a597', pay.days === 0 ? pay.title + ' today' : pay.title + ' ' + inDays(pay.days),
        (pay.net ? kr(pay.net) + ' · ' : '') + pay.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), '#fin', { key: 'pay:' + ym });
      var paid = (d.paid && d.paid[ym]) || [];
      (d.budget.fixed || []).forEach(function (f) {
        if (!f.day || f.src === 'sub' || paid.indexOf(f.id) > -1) return;
        var dd = Math.min(f.day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) - now.getDate();
        if (dd < 0) add(6, 'exclamation-circle', '#e66767', f.name + ' is overdue', kr(f.amount) + ' · was due ' + (-dd) + ' day' + (dd === -1 ? '' : 's') + ' ago', '#fin', { badge: true });
        else if (dd <= 3) add(15, 'calendar-check', '#c98500', f.name + ' due ' + inDays(dd), kr(f.amount), '#fin', { badge: dd === 0 });
      });
    }

    /* reminders from your tools: renewals, expiring certificates, warranties, health, birthday */
    if (Fe) Fe.events().forEach(function (ev) {
      if (ev.cat || ev.id.indexOf('todo:') === 0) return;
      var start = ev.start, k = dkey(start), n = daysTo(k);
      if (ev.rule) { var nx = ev.id.indexOf('sub:') > -1 ? Fe.nextRenewal(Fe.list('subs').filter(function (s) { return 'rem:sub:' + s.id === ev.id; })[0] || {}) : null;
        if (ev.id === 'rem:bday') { var b = new Date(now.getFullYear(), start.getMonth(), start.getDate()); if (b < new Date(now.getFullYear(), now.getMonth(), now.getDate())) b.setFullYear(b.getFullYear() + 1); nx = dkey(b); }
        if (!nx) return; k = nx; n = daysTo(k); }
      if (n < 0 || n > (ev.id === 'rem:bday' ? 0 : ev.id.indexOf('sub:') > -1 ? 3 : 14)) return;
      add(n <= 2 ? 12 : 45, ev.id === 'rem:bday' ? 'balloon' : 'bell', '#c9a227', ev.id === 'rem:bday' ? 'Happy birthday!' : ev.title,
        ev.id === 'rem:bday' ? 'Have a great day' : inDays(n).charAt(0).toUpperCase() + inDays(n).slice(1), (ev.link || '').replace(/^\/cmd\//, ''));
    });

    /* travel: documents that run out, the next trip */
    if (Fl && (!Fe || Fe.on('travel'))) {
      var t = Fl.travel();
      var trip = t.trips.filter(function (x) { return (x.end || x.start) >= today; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; })[0];
      if (trip) {
        var n2 = daysTo(trip.start), name = trip.name || trip.dest;
        if (n2 <= 0) {
          var day = -n2 + 1, total = daysTo(trip.end || trip.start) - n2 + 1;
          add(20, 'suitcase-lg', '#0891b2', name, 'Day ' + day + ' of ' + total, 'travel/#trip=' + trip.id);
        } else if (n2 <= 60) add(n2 <= 7 ? 18 : 55, 'suitcase-lg', '#0891b2', name + ' ' + inDays(n2), new Date(fromKey(trip.start)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
          (n2 <= 14 && !(trip.pack || []).length ? ' · no packing list yet' : ''), 'travel/#trip=' + trip.id);
      }
      t.docs.forEach(function (doc) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.expires || '')) return;
        var n3 = daysTo(doc.expires), beforeTrip = trip && doc.expires <= (trip.end || trip.start);
        if (n3 < 0) add(7, 'person-vcard', '#e66767', (doc.name || 'A travel document') + ' has expired', 'Renew it', 'travel/#docs', { badge: true });
        else if (beforeTrip) add(9, 'person-vcard', '#e66767', (doc.name || 'A travel document') + ' runs out before ' + (trip.name || 'your trip'), 'Expires ' + inDays(n3), 'travel/#docs');
        else if (n3 <= 60) add(42, 'person-vcard', '#c98500', (doc.name || 'Document') + ' expires ' + inDays(n3), 'Time to renew', 'travel/#docs');
      });
    }

    /* habits: which ones need you this week */
    var hb = readJSON('dash.habits');
    if (hb && hb.list && (!Fe || Fe.on('habits'))) {
      var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7), daysLeft = 7 - (now.getDay() + 6) % 7;
      hb.list.forEach(function (h) {
        var n4 = 0, doneToday = ((hb.log || {})[today] || []).indexOf(h.id) > -1;
        for (var i = 0; i < 7; i++) { var k2 = dkey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)); if (((hb.log || {})[k2] || []).indexOf(h.id) > -1) n4++; }
        var need = h.target - n4;
        if (need <= 0) return;
        var tight = need >= daysLeft - (doneToday ? 1 : 0);
        if (tight || daysLeft <= 3) add(tight ? 16 : 48, 'activity', '#d55181', h.name + ': ' + n4 + ' of ' + h.target + ' this week',
          need + ' more · ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left' + (doneToday ? '' : ' – today counts'), 'habits/');
      });
    }

    /* to-dos with a day: overdue, today – and tomorrow's in the evening */
    (readJSON('dash.todos') || []).forEach(function (t) {
      if (!t || t.done || !/^\d{4}-\d{2}-\d{2}$/.test(t.due || '')) return;
      var n5 = daysTo(t.due);
      if (n5 < 0) add(13, 'exclamation-square', '#e66767', t.text, 'To-do · was due ' + inDays(n5), '#c=todo');
      else if (n5 === 0) add(22, 'check2-square', '#22b35e', t.text, 'To-do · today', '#c=todo');
      else if (n5 === 1 && now.getHours() >= 17) add(44, 'check2-square', '#22b35e', t.text, 'To-do · tomorrow', '#c=todo');
    });

    /* the weekly check-in: Sunday afternoon and Monday */
    if (window.Checkin) { var ci = window.Checkin.due(now); if (ci) add(26, 'clipboard-check', '#8a6fdf', 'Weekly check-in', ci.sub, '#checkin', { checkin: true }); }

    /* work: clocked in */
    if (Fe && Fe.on('flex')) {
      var open = Fe.list('flex').filter(function (e) { return e.date === today && e.in && !e.out; })[0];
      if (open) add(25, 'stopwatch', '#e8743b', 'Clocked in at ' + open.in, 'Remember to clock out', 'work/');
    }
    suggestions(add, now, today);
    return out.sort(function (a, b) { return a.pri - b.pri; });
  }

  /* ---------- smart suggestions: noticed from your own data, each can be waved away ---------- */
  function suggestions(add, now, today) {
    var d = window.Vault.get(), ym = today.slice(0, 7), day = now.getDate(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var sum = function (l) { return (l || []).reduce(function (a, x) { return a + (+x.amount || 0); }, 0); };
    var shiftYm = function (n) { var x = new Date(now.getFullYear(), now.getMonth() + n, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); };
    var NAMES = { groceries: 'Groceries', eating: 'Eating out', transport: 'Transport', shopping: 'Shopping', fun: 'Fun', health: 'Health', other: 'Other' };

    if (d && (!Fe || Fe.on('finance'))) {
      var ex = d.expenses || [], income = window.Budget ? window.Budget.income(d, ym) : sum((d.budget || {}).income), fixed = sum((d.budget || {}).fixed);
      /* a category well above your usual pace (not counting travel) */
      if (day >= 7) Object.keys(NAMES).forEach(function (c) {
        var now_ = sum(ex.filter(function (e) { return e.cat === c && String(e.date).slice(0, 7) === ym; }));
        var prev = [1, 2, 3].map(function (i) { var k = shiftYm(-i); return sum(ex.filter(function (e) { return e.cat === c && String(e.date).slice(0, 7) === k; })); });
        var avg = prev.reduce(function (a, x) { return a + x; }, 0) / 3, expected = avg * day / dim;
        if (avg > 0 && now_ > expected * 1.3 && now_ - expected > 500)
          add(58, 'graph-up-arrow', '#e8743b', NAMES[c] + ': ' + Math.round((now_ / expected - 1) * 100) + '% more than usual', kr(now_) + ' so far this month · usually about ' + kr(expected) + ' by now', '#fin', { key: 'sp:' + c + ':' + ym, tip: true });
      });
      /* at this pace … (the same period as the Money card: the month, or payday to payday) */
      var pc = window.Budget && window.Budget.pace ? window.Budget.pace(d, now) : null;
      if (pc && !pc.ok && pc.room > 0) add(24, 'speedometer2', '#e8743b', 'At this pace: ' + kr(-pc.end) + ' over by ' + (pc.per.byPayday ? 'payday' : 'the end of the month'),
        'You spend about ' + kr(pc.perDay) + ' a day – ' + kr(Math.max(0, (pc.room - pc.spent) / pc.per.daysLeft)) + ' a day keeps you on budget', '#fin', { key: 'pace:' + pc.per.startKey + ':' + Math.round(-pc.end / 500) });
      recurring(add, d, now);
      if (!income && !(d.expenses || []).length) add(90, 'pie-chart', '#11a597', 'Set up your monthly budget', 'Then you’ll see what you can spend each day', '#fin', { key: 'setup:budget', tip: true });
    }

    if (Fl) {
      var trips = Fl.travel().trips.filter(function (t) { return t.start > today; }).sort(function (a, b) { return a.start > b.start ? 1 : -1; });
      /* workdays during a trip → holiday in Flex time */
      if (Fe && Fe.on('flex')) trips.filter(function (t) { return daysTo(t.start) <= 90; }).forEach(function (t) {
        var logged = {}; Fe.list('flex').forEach(function (e) { logged[e.date] = 1; });
        var days = [], x = fromKey(t.start), end = fromKey(t.end || t.start);
        for (var i = 0; x <= end && i < 60; i++, x.setDate(x.getDate() + 1)) { var k = dkey(x), wd = x.getDay(); if (wd && wd < 6 && !Fe.holiday(k) && !logged[k]) days.push(k); }
        if (!days.length) return;
        var id = 'flex:' + t.id;
        ACTIONS[id] = function () {
          var tl = Fe.tools(); tl.flex = tl.flex || [];
          days.forEach(function (k) { tl.flex.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: k, type: 'vacation', note: t.name }); });
          Fe.saveTools(tl);
        };
        add(52, 'sun', '#e8743b', days.length + ' workday' + (days.length > 1 ? 's' : '') + ' during ' + (t.name || 'your trip'), 'Mark ' + (days.length > 1 ? 'them' : 'it') + ' as holiday (ferie) in Flex time?', 'work/', { key: id, act: { id: id, label: 'Mark as holiday' } });
      });
    }

    /* Apple Health: a short night, or the Shortcut has gone quiet */
    if (window.AHealth && Fe && Fe.on('ahealth')) {
      var AH = window.AHealth, sl = AH.latest('sleep'), lastH = ((d || {}).health || {}).last;
      if (sl && sl.date >= dkey(new Date(now.getTime() - 864e5)) && sl.v < 6 && sl.v > 0)
        add(57, 'moon-stars', '#8a6fdf', 'Short night: ' + AH.fmt('sleep', sl.v), 'Go easy today – and maybe to bed a bit earlier', 'habits/', { key: 'sleep:' + sl.date, tip: true });
      if (lastH && Date.now() - lastH > 3 * 864e5)
        add(64, 'apple', '#e66767', 'Nothing from Apple Health for ' + Math.floor((Date.now() - lastH) / 864e5) + ' days', 'Check that the Shortcut automation still runs', '?settings=ahealth', { key: 'ahstale:' + today, tip: true });
    }

    /* a backup once a month (the encrypted file, kept wherever you like) */
    if (d) {
      var lb = d.lastBackup || +localStorage.getItem('dash.lastBackup') || 0, age = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
      var much = (d.expenses || []).length + (readJSON('dash.todos') || []).length > 8;
      if ((age === null && much) || age >= 30) {
        ACTIONS['backup:' + ym] = function () { window.Vault.backup(); };
        add(56, 'shield-check', '#11a597', 'Time for a backup', age === null ? 'You haven’t downloaded one yet – it takes a second' : 'Last one ' + age + ' days ago', '?settings=data',
          { key: 'backupx:' + ym, act: { id: 'backup:' + ym, label: 'Download' } });
      }
    }

    /* habits going well */
    var hb = readJSON('dash.habits');
    if (hb && hb.list) hb.list.forEach(function (h) {
      var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7), streak = 0;
      for (var w = 1; w < 60; w++) {
        var n = 0;
        for (var i = 0; i < 7; i++) { var k = dkey(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7 * w + i)); if (((hb.log || {})[k] || []).indexOf(h.id) > -1) n++; }
        if (n >= h.target) streak++; else break;
      }
      if (streak >= 3) add(70, 'fire', '#d55181', h.name + ': ' + streak + ' weeks in a row', 'Keep it going this week', 'habits/', { key: 'streak:' + h.id + ':' + streak, tip: true });
    });

    /* journal in the evening */
    if (Fe && Fe.on('journal') && now.getHours() >= 19 && !Fe.list('journal').some(function (j) { return j.date === today; }))
      add(65, 'journal-bookmark', '#c9a227', 'How was today?', 'One line in your journal', 'habits/#journal', { key: 'journal:' + today, tip: true });
  }

  /* charges that come back every month: a subscription you haven't added – or one whose price went up */
  function recurring(add, d, now) {
    var S = window.Smart; if (!S) return;
    var since = dkey(new Date(now.getFullYear(), now.getMonth() - 3, 1)), by = {};
    (d.expenses || []).forEach(function (e) {
      if (!e.note || String(e.date) < since || e.cat === 'groceries' || e.cat === 'travel') return;
      var k = S.norm(e.note); if (k.length < 3) return;
      (by[k] = by[k] || []).push(e);
    });
    var subs = Fe && Fe.on('subs') ? Fe.list('subs') : [], fixed = (d.budget && d.budget.fixed) || [];
    var known = function (k) { return subs.concat(fixed).some(function (x) { var n = S.norm(x.name); return n && (k.indexOf(n) > -1 || n.indexOf(k) > -1); }); };
    var subOf = function (k) { return subs.filter(function (x) { var n = S.norm(x.name); return n && !x.paused && (k.indexOf(n) > -1 || n.indexOf(k) > -1); })[0]; };
    Object.keys(by).forEach(function (k) {
      var l = by[k].sort(function (a, b) { return a.date > b.date ? 1 : -1; }), months = {};
      l.forEach(function (e) { var m = String(e.date).slice(0, 7); months[m] = (months[m] || 0) + 1; });
      var ms = Object.keys(months);
      if (ms.length < 2 || ms.some(function (m) { return months[m] > 1; })) return;          // once a month, at least twice
      var last = l[l.length - 1], prev = l[l.length - 2], days = l.map(function (e) { return +String(e.date).slice(8, 10); });
      if (Math.max.apply(null, days) - Math.min.apply(null, days) > 6) return;               // around the same day
      var amts = l.map(function (e) { return +e.amount; }), lo = Math.min.apply(null, amts), hi = Math.max.apply(null, amts);
      var sub = subOf(k), name = last.note;
      if (sub) {
        if (Math.abs(+sub.amount - last.amount) >= 5 && Math.abs(+sub.amount - last.amount) / last.amount > .03) {
          var id1 = 'subprice:' + sub.id + ':' + Math.round(last.amount);
          ACTIONS[id1] = function () { var t = Fe.tools(); (t.subs || []).forEach(function (x) { if (x.id === sub.id) x.amount = last.amount; }); Fe.saveTools(t); };
          add(46, 'tags', '#e8743b', sub.name + ' now costs ' + kr(last.amount), 'Your subscription says ' + kr(+sub.amount) + ' – your bank says ' + kr(last.amount), '#fin', { key: id1, act: { id: id1, label: 'Update price' } });
        }
        return;
      }
      if (known(k)) return;
      if (ms.length < 3 && !(last.cat === 'fun' || hi === lo)) return;                     // two months is enough only for the obvious ones
      if (hi - lo > lo * .1 && hi - lo >= 10) {
        /* not steady enough for a subscription – but did it just get more expensive? */
        if (l.length >= 2 && last.amount > prev.amount * 1.03 && last.amount - prev.amount >= 5 && Math.abs(prev.amount - l[0].amount) <= prev.amount * .03)
          add(60, 'tags', '#e8743b', name + ' went up', kr(prev.amount) + ' → ' + kr(last.amount) + ' a month', '#fin', { key: 'up:' + k + ':' + Math.round(last.amount), tip: true });
        return;
      }
      var id = 'recur:' + k, day = +String(last.date).slice(8, 10);
      ACTIONS[id] = function () {
        var dd = window.Vault.get(), per = window.Budget ? window.Budget.period(dd, now) : null;
        /* from now on it's a fixed cost: this period's charge is already counted by it */
        if (per) dd.expenses = (dd.expenses || []).filter(function (e) { return !(e.note && S.norm(e.note) === k && per.has(e.date)); });
        if (Fe && Fe.on('subs')) {
          var nx = new Date(now.getFullYear(), now.getMonth() + (day <= now.getDate() ? 1 : 0), day);
          window.Vault.save(dd);
          var t = Fe.tools(); t.subs = t.subs || [];
          t.subs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, amount: last.amount, period: 'monthly', renews: dkey(nx), cat: last.cat === 'fun' ? 'streaming' : 'other', notes: 'Found in your bank import' });
          Fe.saveTools(t);
        } else {
          dd.budget = dd.budget || { income: [], fixed: [] }; dd.budget.fixed = dd.budget.fixed || [];
          var fid = Date.now().toString(36);
          dd.budget.fixed.push({ id: fid, name: name, amount: Math.round(last.amount), day: day });
          /* this month's charge has been paid already */
          if (String(last.date).slice(0, 7) === dkey(now).slice(0, 7)) { dd.paid = dd.paid || {}; var pk = dkey(now).slice(0, 7); (dd.paid[pk] = dd.paid[pk] || []).push(fid); }
          window.Vault.save(dd);
        }
        window.dispatchEvent(new Event('fin:change'));
      };
      add(47, 'arrow-repeat', '#11a597', name + ' looks like a subscription', kr(last.amount) + ' around the ' + day + '. every month · ' + ms.length + ' months so far', '#fin',
        { key: id, act: { id: id, label: Fe && Fe.on('subs') ? 'Add to subscriptions' : 'Make it a fixed cost' } });
    });
  }

  var unlocked = false, showAll = false, tipsOpen = false;
  /* tips (streaks, unusual spending, suggestions): shown, folded into one line, or off – Settings → Dashboard */
  function tipsMode() { var s = readJSON('dash.settings') || {}; return s.tips === 'show' || s.tips === 'off' ? s.tips : 'fold'; }
  function render() {
    if (!unlocked) return;
    var all = items(), mode = tipsMode(), folding = mode !== 'show';
    var tips = folding ? all.filter(function (x) { return x.tip || x.act; }) : [];
    var main = folding ? all.filter(function (x) { return !(x.tip || x.act); }) : all;
    var shown = showAll ? main.slice() : main.slice(0, 5);
    if (mode === 'fold' && tips.length) {
      shown.push({ fold: true, icon: 'lightbulb', color: '#c9a227', title: tips.length + ' tip' + (tips.length === 1 ? '' : 's'),
        sub: tips.slice(0, 2).map(function (x) { return x.title; }).join(' · ') + (tips.length > 2 ? ' …' : '') });
      if (tipsOpen) shown = shown.concat(tips);
    }
    /* the app icon shows how many things need you right now (overdue bills, bills due today, expired documents) */
    var urgent = all.filter(function (x) { return x.badge; }).length;
    try { if (navigator.setAppBadge) { if (urgent) navigator.setAppBadge(urgent); else navigator.clearAppBadge(); } } catch (e) {}
    box.innerHTML = shown.length ? shown.map(function (x) {
      if (x.fold) return '<li class="br-li br-fold"><button type="button" class="br-item" data-brfold aria-expanded="' + tipsOpen + '" style="--c:' + x.color + '"><span class="br-ic"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="br-x"><b>' + esc(x.title) + '</b><small>' + esc(tipsOpen ? 'Tap to fold them away' : x.sub) + '</small></span><i class="bi bi-chevron-' + (tipsOpen ? 'up' : 'down') + ' br-go"></i></button></li>';
      return '<li class="br-li' + (x.tip || x.act ? ' br-tip' : '') + '"><a class="br-item" href="' + esc(x.href) + '"' + (x.review ? ' data-review="' + esc(x.review) + '"' : '') + ' style="--c:' + x.color + '"><span class="br-ic"><i class="bi bi-' + x.icon + '"></i></span>' +
        '<span class="br-x"><b>' + esc(x.title) + '</b><small>' + esc(x.sub) + '</small></span>' + (x.act || x.key ? '' : '<i class="bi bi-chevron-right br-go"></i>') + '</a>' +
        (x.act ? '<button type="button" class="pill-btn br-act" data-bract="' + esc(x.act.id) + '">' + esc(x.act.label) + '</button>' : '') +
        (x.key ? '<button type="button" class="br-x-btn" data-brx="' + esc(x.key) + '" aria-label="Not now" title="Not now"><i class="bi bi-x"></i></button>' : '') + '</li>';
    }).join('') + (main.length > 5 ? '<li><button type="button" class="text-btn br-more" data-brmore>' + (showAll ? 'Show less' : 'Show all ' + main.length) + '</button></li>' : '')
      : '<li class="br-calm"><i class="bi bi-check2-circle"></i> Nothing needs you right now. Enjoy the day.</li>';
  }
  box.addEventListener('click', function (e) {
    var b;
    if (e.target.closest('[data-brmore]')) { showAll = !showAll; render(); return; }
    if (e.target.closest('[data-brfold]')) { tipsOpen = !tipsOpen; render(); return; }
    if ((b = e.target.closest('[data-brx]'))) { dismiss(b.dataset.brx); var li = b.closest('li'); li.classList.add('br-gone'); setTimeout(render, 220); return; }
    if ((b = e.target.closest('[data-bract]'))) { if (ACTIONS[b.dataset.bract]) ACTIONS[b.dataset.bract](); dismiss(b.dataset.bract, 365); b.textContent = 'Done ✓'; setTimeout(render, 700); return; }
    var ck = e.target.closest('a[href="#checkin"]');
    if (ck) { e.preventDefault(); if (window.Checkin) window.Checkin.open(); return; }
    var td = e.target.closest('a[href="#c=todo"]');
    if (td) { e.preventDefault(); var tc = document.querySelector('.card.todo'); if (tc) { tc.scrollIntoView({ behavior: 'smooth', block: 'center' }); tc.classList.add('sr-flash'); setTimeout(function () { tc.classList.remove('sr-flash'); }, 1600); } return; }
    var a = e.target.closest('a[href="#fin"]');
    if (a) { e.preventDefault(); var f = document.getElementById('fin'); if (f) f.scrollIntoView({ behavior: 'smooth' }); }
  });
  ['review:seen', 'checkin:done', 'tips:change', 'dash:backup', 'todos:change', 'cal:change', 'tools:change', 'travel:change', 'fin:change', 'habits:change', 'features:change', 'profile:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(render, 0); }); });
  setInterval(render, 60000);
  window.Vault.onUnlock(function () { unlocked = true; setTimeout(render, 50); });
  window.Vault.onLock(function () { unlocked = false; box.innerHTML = ''; });
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
})();
} catch (e) { console.error("brief.js", e); }
/* ===== checkin.js ===== */
try {
/* Weekly check-in: five minutes on Sunday (or Monday) that keep the dashboard right.
     1. Money – what the week cost, expenses to sort, when you last imported from the bank
     2. The week ahead – day by day, with tasks that are due
     3. Focus – pick up to three tasks for the week (they go to the top of To-do)
     4. Habits – how last week went
   "Done" is remembered in the vault, so it's done on every device.
   Offered in At a glance from Sunday noon and on Monday; open any time from search. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var Fe = window.Features, C = window.Cal;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function day0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = day0(d); x.setDate(x.getDate() + n); return x; }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  var CATS = [['groceries', 'Groceries'], ['eating', 'Eating out'], ['transport', 'Transport'], ['shopping', 'Shopping'], ['fun', 'Fun'], ['health', 'Health'], ['travel', 'Travel'], ['other', 'Other']];

  /* weekOf(day): the Monday–Sunday week that day is in */
  function weekOf(ref) {
    var mon = addDays(ref, -((ref.getDay() + 6) % 7));
    var sun = addDays(mon, 6), thu = addDays(mon, 3);
    var y = thu.getFullYear(), w = 1 + Math.round(((thu - new Date(y, 0, 4)) / 864e5 - 3 + (new Date(y, 0, 4).getDay() + 6) % 7) / 7);
    return { mon: mon, sun: sun, key: y + '-W' + pad(w), n: w };
  }
  function doneSet() { var d = window.Vault.get() || {}; return d.checkins || []; }
  function due(now) {
    now = now || new Date();
    var sunday = now.getDay() === 0 && now.getHours() >= 12, monday = now.getDay() === 1;
    if (!sunday && !monday) return null;
    var wk = weekOf(sunday ? now : addDays(now, -1));
    if (doneSet().indexOf(wk.key) > -1) return null;
    return { key: wk.key, sub: '5 minutes: spending, the week ahead, focus and habits' };
  }

  /* ---------- the sheet ---------- */
  var bg = document.createElement('div');
  bg.className = 'sr-bg rv-bg ci-bg'; bg.hidden = true;
  bg.innerHTML = '<div class="sr-box rv-box ci-box" role="dialog" aria-modal="true" aria-label="Weekly check-in"><div class="rv-top">' +
    '<b class="ci-title"><i class="bi bi-clipboard-check"></i> Weekly check-in</b><span class="spacer"></span><button type="button" class="text-btn" data-ciclose>Close</button></div>' +
    '<div class="rv-body" id="ciBody"></div></div>';
  document.body.appendChild(bg);
  var wk = null;

  function sum(l) { return l.reduce(function (a, e) { return a + (+e.amount || 0); }, 0); }
  function moneyHtml(d) {
    var from = dkey(wk.mon), to = dkey(wk.sun), ex = d.expenses || [];
    var week = ex.filter(function (e) { return e.date >= from && e.date <= to; });
    var prev = [1, 2, 3, 4].map(function (i) { var a = dkey(addDays(wk.mon, -7 * i)), b = dkey(addDays(wk.sun, -7 * i)); return sum(ex.filter(function (e) { return e.date >= a && e.date <= b; })); });
    var avg = prev.reduce(function (a, x) { return a + x; }, 0) / 4, spent = sum(week);
    var sortFrom = dkey(addDays(wk.sun, -20));
    var unsorted = ex.filter(function (e) { return e.cat === 'other' && e.date >= sortFrom; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12);
    var lastImp = d.lastImport || (ex.filter(function (e) { return e.src === 'bank'; }).map(function (e) { return e.t ? dkey(new Date(e.t)) : e.date; }).sort().pop());
    var impDays = lastImp ? Math.round((day0(new Date()) - new Date(lastImp + 'T00:00')) / 864e5) : null;
    var pc = window.Budget && window.Budget.pace ? window.Budget.pace(d) : null;
    var by = {}; week.forEach(function (e) { by[e.cat] = (by[e.cat] || 0) + (+e.amount || 0); });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];
    return '<section class="rv-sec"><h3><span class="ci-n">1</span> Money</h3>' +
      '<div class="rv-grid ci-grid"><div class="rv-big" style="--c:#11a597"><i class="bi bi-receipt"></i><b class="money">' + esc(kr(spent)) + '</b><span>spent this week</span>' +
        (avg > 0 ? '<small class="' + (spent > avg * 1.15 ? 'dn' : spent < avg * .85 ? 'up' : '') + '">' + (spent > avg ? kr(spent - avg) + ' more' : kr(avg - spent) + ' less') + ' than usual</small>' : '<small>' + week.length + ' expense' + (week.length === 1 ? '' : 's') + '</small>') + '</div>' +
        (top ? '<div class="rv-big" style="--c:#e8743b"><i class="bi bi-pie-chart"></i><b>' + esc((CATS.filter(function (c) { return c[0] === top; })[0] || ['', 'Other'])[1]) + '</b><span>most of it</span><small class="money">' + esc(kr(by[top])) + '</small></div>' : '') +
        (pc ? '<div class="rv-big" style="--c:' + (pc.ok ? '#22b35e' : '#e66767') + '"><i class="bi bi-speedometer2"></i><b class="money">' + esc(kr(Math.abs(pc.end))) + '</b><span>' + (pc.ok ? 'left' : 'over') + ' at ' + (pc.per.byPayday ? 'payday' : 'month end') + '</span><small>at this pace</small></div>' : '') +
      '</div>' +
      '<div class="ci-imp"><i class="bi bi-bank"></i><span>' + (impDays == null ? 'You haven’t imported from your bank yet.' : 'Last bank import ' + (impDays === 0 ? 'today' : impDays === 1 ? 'yesterday' : impDays + ' days ago') + '.') + '</span>' +
        (impDays == null || impDays >= 3 ? '<a class="pill-btn" href="finance/#import"><i class="bi bi-upload"></i> Import</a>' : '<i class="bi bi-check-circle-fill ci-ok"></i>') + '</div>' +
      backupHtml(d) +
      (unsorted.length ? '<p class="muted ci-p">These are filed under Other – pick a category and the bank import remembers the shop next time.</p><ul class="ci-sort">' + unsorted.map(function (e) {
        return '<li><span class="ci-x"><b>' + esc(e.note || 'Expense') + '</b><small>' + esc(new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + ' · <span class="money">' + esc(kr(e.amount)) + '</span></small></span>' +
          '<select data-ciexp="' + esc(e.id) + '" aria-label="Category for ' + esc(e.note || 'expense') + '">' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === e.cat ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></li>';
      }).join('') + '</ul>' : '') + '</section>';
  }
  function backupHtml(d) {
    var lb = d.lastBackup || +localStorage.getItem('dash.lastBackup') || 0, age = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
    return '<div class="ci-imp"><i class="bi bi-shield-check"></i><span>' + (age === null ? 'No backup downloaded yet.' : 'Last backup ' + (age === 0 ? 'today' : age === 1 ? 'yesterday' : age + ' days ago') + '.') + '</span>' +
      (age === null || age >= 30 ? '<button type="button" class="pill-btn" data-cibackup><i class="bi bi-download"></i> Backup</button>' : '<i class="bi bi-check-circle-fill ci-ok"></i>') + '</div>';
  }
  function aheadHtml() {
    var start = new Date().getDay() === 0 ? addDays(new Date(), 1) : day0(new Date()), rows = '';
    var todos = readJSON('dash.todos', []).filter(function (t) { return !t.done && t.due; });
    for (var i = 0; i < 7; i++) {
      var dd = addDays(start, i), k = dkey(dd), evs = [];
      if (C && (!Fe || Fe.on('calendar'))) evs = C.occurrences(dd, addDays(dd, 1), { card: true }).filter(function (o) { return !o.ev.holiday && String(o.ev.id).indexOf('todo:') !== 0 && dkey(o.start) === k; });
      var hol = Fe && Fe.holiday(k), tds = todos.filter(function (t) { return t.due === k; });
      var bits = evs.slice(0, 3).map(function (o) { return (o.allDay ? '' : '<b>' + pad(o.start.getHours()) + ':' + pad(o.start.getMinutes()) + '</b> ') + esc(o.title); })
        .concat(tds.map(function (t) { return '<span class="ci-td"><i class="bi bi-check2-square"></i> ' + esc(t.text) + '</span>'; }));
      if (evs.length > 3) bits.push('+' + (evs.length - 3) + ' more');
      rows += '<li' + (bits.length ? '' : ' class="free"') + '><span class="ci-day">' + esc(dd.toLocaleDateString('en-GB', { weekday: 'short' })) + '<small>' + dd.getDate() + '</small></span>' +
        '<span class="ci-evs">' + (hol ? '<span class="ci-hol">' + esc(hol.name) + '</span> ' : '') + (bits.length ? bits.join(' · ') : '<span class="muted">Free</span>') + '</span></li>';
    }
    var overdue = readJSON('dash.todos', []).filter(function (t) { return !t.done && t.due && t.due < dkey(new Date()); });
    return '<section class="rv-sec"><h3><span class="ci-n">2</span> The week ahead</h3><ul class="ci-week">' + rows + '</ul>' +
      (overdue.length ? '<p class="ci-warn"><i class="bi bi-exclamation-circle"></i> ' + overdue.length + ' task' + (overdue.length === 1 ? ' is' : 's are') + ' overdue – give ' + (overdue.length === 1 ? 'it' : 'them') + ' a new day or tick ' + (overdue.length === 1 ? 'it' : 'them') + ' off below.</p>' : '') + '</section>';
  }
  function focusHtml() {
    var open = readJSON('dash.todos', []).filter(function (t) { return !t.done; }), n = open.filter(function (t) { return t.focus; }).length;
    return '<section class="rv-sec"><h3><span class="ci-n">3</span> Focus this week</h3>' +
      (open.length ? '<p class="muted ci-p">Star up to three – they go to the top of your To-do.</p><ul class="ci-focus">' + open.slice(0, 15).map(function (t) {
        var late = t.due && t.due < dkey(new Date());
        return '<li><button type="button" class="ci-star' + (t.focus ? ' on' : '') + '" data-cistar="' + esc(t.id) + '" aria-pressed="' + !!t.focus + '" aria-label="Focus on ' + esc(t.text) + '"' + (!t.focus && n >= 3 ? ' disabled' : '') + '><i class="bi bi-star' + (t.focus ? '-fill' : '') + '"></i></button>' +
          '<span class="ci-x"><b>' + esc(t.text) + '</b>' + (t.due ? '<small' + (late ? ' class="late"' : '') + '>' + (late ? 'Overdue · ' : 'Due ') + esc(new Date(t.due + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })) + '</small>' : '') + '</span>' +
          '<label class="ci-cal' + (t.due ? ' set' : '') + '" title="' + (t.due ? 'Change the day' : 'Give it a day') + '"><i class="bi bi-calendar' + (t.due ? '-check' : '-plus') + '"></i><input type="date" data-cidue="' + esc(t.id) + '" value="' + esc(t.due || '') + '" aria-label="Day for ' + esc(t.text) + '"></label>' +
          '<button type="button" class="ci-tick" data-citick="' + esc(t.id) + '" aria-label="Done: ' + esc(t.text) + '"><i class="bi bi-check-lg"></i></button></li>';
      }).join('') + '</ul>' : '<p class="muted ci-p">No open tasks. Add one with + or in the To-do card.</p>') + '</section>';
  }
  function habitsHtml() {
    var hb = readJSON('dash.habits', { list: [], log: {} });
    if (!hb.list || !hb.list.length || (Fe && !Fe.on('habits'))) return '';
    var AH = window.AHealth, ah = '';
    if (AH && (!Fe || Fe.on('ahealth'))) {
      var st = AH.stats(dkey(wk.mon), dkey(wk.sun));
      if (st.n) ah = '<p class="ci-health"><i class="bi bi-apple"></i> ' + [st.steps.avg != null ? AH.fmt('steps', st.steps.avg) + ' steps a day' : '', st.sleep.avg != null ? AH.fmt('sleep', st.sleep.avg) + ' sleep' : '', st.exercise.avg != null ? AH.fmt('exercise', st.exercise.sum) + ' exercise' : ''].filter(Boolean).join(' · ') + '</p>';
    }
    return '<section class="rv-sec"><h3><span class="ci-n">4</span> Habits last week</h3>' + ah + '<ul class="ci-hab">' + hb.list.map(function (h) {
      var n = 0;
      for (var i = 0; i < 7; i++) if (((hb.log || {})[dkey(addDays(wk.mon, i))] || []).indexOf(h.id) > -1) n++;
      var ok = n >= h.target;
      return '<li class="' + (ok ? 'ok' : '') + '"><i class="bi bi-' + (ok ? 'check-circle-fill' : 'circle') + '"></i><span>' + esc(h.name) + '</span><b>' + n + ' / ' + h.target + '</b></li>';
    }).join('') + '</ul></section>';
  }
  function draw() {
    var d = window.Vault.get() || {};
    $('ciBody').innerHTML = '<p class="rv-kicker">Week ' + wk.n + ' · ' + esc(wk.mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + ' – ' + esc(wk.sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</p>' +
      '<h2>How was the week?</h2>' + ((!Fe || Fe.on('finance')) ? moneyHtml(d) : '') + aheadHtml() + focusHtml() + habitsHtml() +
      '<div class="qa-acts ci-foot"><span class="spacer"></span>' + (doneSet().indexOf(wk.key) > -1 ? '<span class="muted"><i class="bi bi-check2-circle"></i> Done for this week</span>' : '<button type="button" class="pill-btn wide" data-cidone><i class="bi bi-check2-circle"></i> Done for this week</button>') + '</div>';
  }
  function $(id) { return document.getElementById(id); }
  function open() {
    if (!window.Vault.get()) return;
    var now = new Date();
    /* Sunday: this week; any other day: the week that ended last Sunday */
    wk = weekOf(now.getDay() === 0 ? now : addDays(now, -((now.getDay() + 6) % 7) - 1));
    draw();
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
    $('ciBody').scrollTop = 0;
  }
  function close() { bg.classList.remove('open'); document.documentElement.classList.remove('cl-modal'); setTimeout(function () { bg.hidden = true; }, 180); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  function todos(fn) { var l = readJSON('dash.todos', []); fn(l); writeJSON('dash.todos', l); }

  bg.addEventListener('click', function (e) {
    var b;
    if (e.target === bg || e.target.closest('[data-ciclose]')) return close();
    if ((b = e.target.closest('[data-cistar]'))) { todos(function (l) { l.forEach(function (t) { if (t.id === b.dataset.cistar) t.focus = !t.focus; }); }); draw(); return; }
    if ((b = e.target.closest('[data-citick]'))) {
      var li = b.closest('li'); li.classList.add('gone');
      setTimeout(function () { todos(function (l) { l.forEach(function (t) {
        if (t.id !== b.dataset.citick) return;
        if (t.repeat && window.Smart) { var nx = window.Smart.nextDue(t.due || dkey(new Date()), t.repeat, t.rday); while (nx && nx < dkey(new Date())) nx = window.Smart.nextDue(nx, t.repeat, t.rday); t.due = nx; }   // repeating: on to the next time
        else { t.done = true; t.focus = false; }
      }); }); draw(); }, 220); return;
    }
    if (e.target.closest('[data-cibackup]')) { window.Vault.backup().then(function () { setTimeout(draw, 300); }); return; }
    if (e.target.closest('[data-cidone]')) {
      var d = window.Vault.get(); d.checkins = (d.checkins || []).concat(wk.key).slice(-30); window.Vault.save(d);
      window.dispatchEvent(new Event('checkin:done'));
      close();
      if (window.Quick) window.Quick.toast('<i class="bi bi-check2-circle"></i> Week ' + wk.n + ' checked – have a good week');
    }
  });
  /* the calendar button: open the date picker where the browser lets us */
  bg.addEventListener('click', function (e) { var i = e.target.closest('.ci-cal input'); if (i && i.showPicker) { try { i.showPicker(); } catch (x) {} } });
  bg.addEventListener('change', function (e) {
    var s = e.target.closest('[data-ciexp]');
    if (s) {
      var d = window.Vault.get(), S = window.Smart;
      (d.expenses || []).forEach(function (x) { if (x.id === s.dataset.ciexp) { x.cat = s.value; if (S && x.note) { d.catMemory = d.catMemory || {}; d.catMemory[S.norm(x.note)] = s.value; } } });
      window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
      var li = s.closest('li'); li.classList.add('ci-done');
      return;
    }
    var dd = e.target.closest('[data-cidue]');
    if (dd) { todos(function (l) { l.forEach(function (t) { if (t.id === dd.dataset.cidue) { if (dd.value) t.due = dd.value; else delete t.due; } }); }); draw(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
  /* from search: …/#checkin */
  function fromHash() { if (location.hash === '#checkin') { history.replaceState(null, '', location.pathname + location.search); setTimeout(open, 300); } }
  window.Vault.onUnlock(fromHash);
  window.addEventListener('hashchange', fromHash);
  window.Vault.onLock(function () { if (!bg.hidden) close(); });
  window.Checkin = { open: open, due: due, weekOf: weekOf };
})();
} catch (e) { console.error("checkin.js", e); }
/* ===== checklists.js ===== */
try {
/* Checklists: ready-made sets of repeating tasks you can switch on and off
   (Settings → Dashboard → Checklists). They are ordinary to-dos with a day and a repeat –
   so they show in To-do, the calendar, At a glance, the weekly check-in and notifications.
   Switching a list off removes its open tasks again (with Undo). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nb() { return ((readJSON('dash.settings', {}) || {}).lang) === 'nb'; }

  /* first day: in n days, or the next given month/day */
  function inDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dkey(d); }
  function nextDate(m, day) { var t = new Date(), d = new Date(t.getFullYear(), m - 1, day); if (d < new Date(t.getFullYear(), t.getMonth(), t.getDate())) d.setFullYear(d.getFullYear() + 1); return dkey(d); }
  var LISTS = {
    home: { icon: 'house-gear', name: 'Home maintenance', nameNb: 'Vedlikehold hjemme', desc: 'FDVU for your own home – smoke alarms, filters, drains, the boring things that save money', descNb: 'FDVU for ditt eget hjem – røykvarslere, filtre, sluk og det andre som sparer penger',
      tasks: function () { return [
        ['Test smoke alarms', 'Teste røykvarslerne', 'monthly', inDays(2)],
        ['Change smoke alarm batteries', 'Bytte batteri i røykvarslerne', 'yearly', nextDate(12, 1)],
        ['Check fire extinguisher and fire blanket', 'Sjekke brannslukker og brannteppe', 'yearly', nextDate(12, 1)],
        ['Clean the kitchen hood filter', 'Rengjøre filteret i kjøkkenviften', 'quarterly', inDays(9)],
        ['Change or clean ventilation filters', 'Bytte eller rengjøre ventilasjonsfiltre', 'quarterly', inDays(16)],
        ['Clean bathroom drains', 'Rense sluk på badet', 'quarterly', inDays(23)],
        ['Check under the sink and dishwasher for leaks', 'Sjekke under vasken og oppvaskmaskinen for lekkasjer', 'quarterly', inDays(30)],
        ['Hot cleaning cycle in the washing machine', 'Rengjøringsprogram på vaskemaskinen', 'monthly', inDays(12)],
        ['Clean the fridge, check the freezer', 'Vaske kjøleskapet, sjekke fryseren', 'quarterly', inDays(37)],
        ['Bleed the radiators', 'Lufte radiatorene', 'yearly', nextDate(10, 15)],
        ['Wash the windows', 'Vaske vinduene', 'yearly', nextDate(5, 1)],
        ['Update the contents list for the home insurance', 'Oppdatere innboliste for forsikringen', 'yearly', nextDate(1, 15)]
      ]; } }
  };

  function has(id) { return readJSON('dash.todos', []).some(function (t) { return t.list === id && !t.done; }); }
  function add(id) {
    var L = LISTS[id], todos = readJSON('dash.todos', []), no = nb();
    L.tasks().forEach(function (x) {
      var text = no ? x[1] : x[0];
      if (todos.some(function (t) { return t.list === id && (t.text === x[0] || t.text === x[1]); })) return;
      todos.push({ id: uid(), text: text, done: false, due: x[3], repeat: x[2], list: id });
    });
    writeJSON('dash.todos', todos);
    changed();
    if (window.Quick) window.Quick.toast('<i class="bi bi-' + L.icon + '"></i> ' + (no ? L.nameNb : L.name) + ' added – ' + L.tasks().length + ' repeating tasks');
  }
  function remove(id) {
    var before = readJSON('dash.todos', []), L = LISTS[id];
    writeJSON('dash.todos', before.filter(function (t) { return t.list !== id; }));
    changed();
    if (window.Quick) window.Quick.toast('<i class="bi bi-' + L.icon + '"></i> ' + (nb() ? L.nameNb : L.name) + ' removed', function () { writeJSON('dash.todos', before); changed(); });
  }
  function changed() {
    window.dispatchEvent(new Event('todos:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
    fill();
  }
  function fill() {
    var box = $('stLists'); if (!box) return;
    var no = nb();
    box.innerHTML = Object.keys(LISTS).map(function (id) {
      var L = LISTS[id], n = readJSON('dash.todos', []).filter(function (t) { return t.list === id; }).length;
      return '<label class="st-row"><span class="st-ico" style="--c:#c98500"><i class="bi bi-' + L.icon + '"></i></span><span class="st-label">' + (no ? L.nameNb : L.name) +
        '<small>' + (n ? n + (no ? ' oppgaver i Gjøremål' : ' tasks in your To-do') : (no ? L.descNb : L.desc)) + '</small></span><input type="checkbox" class="switch" data-list="' + id + '"' + (n ? ' checked' : '') + '></label>';
    }).join('');
  }
  document.addEventListener('change', function (e) {
    var c = e.target.closest('[data-list]'); if (!c) return;
    if (c.checked) add(c.dataset.list); else remove(c.dataset.list);
  });
  /* checklist tasks follow the dashboard's language (only the ones still in their original words) */
  function relang() {
    var todos = readJSON('dash.todos', []), no = nb(), ch = false;
    Object.keys(LISTS).forEach(function (id) {
      LISTS[id].tasks().forEach(function (x) {
        todos.forEach(function (t) { if (t.list === id && t.text === (no ? x[0] : x[1])) { t.text = no ? x[1] : x[0]; ch = true; } });
      });
    });
    if (ch) { writeJSON('dash.todos', todos); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  }
  window.Vault.onUnlock(function () { setTimeout(function () { relang(); fill(); }, 0); });
  window.addEventListener('todos:change', function () { setTimeout(fill, 0); });
  window.Checklists = { LISTS: LISTS, has: has, add: add, remove: remove };
})();
} catch (e) { console.error("checklists.js", e); }
/* ===== kit.js ===== */
try {
/* Kit: one building block for the smaller tools – a card with a summary, a list and an
   add/edit sheet generated from a list of fields. Data lives in Features.tools()[key]. */
(function () {
  "use strict";
  var F = window.Features;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return F.dkey(new Date()); }
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nf.format(Math.round(n || 0)) + ' kr'; }
  function fmt(k, o) { return k ? F.fromKey(k).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  /* ---------- one shared sheet ---------- */
  var sheet = null;
  function ensureSheet() {
    if (sheet) return sheet;
    var bg = document.createElement('div');
    bg.className = 'cl-sheet-bg kit-bg'; bg.hidden = true;
    bg.innerHTML = '<form class="cl-sheet kit-sheet" role="dialog" aria-modal="true" autocomplete="off">' +
      '<div class="cl-sheet-head"><button class="text-btn" type="button" data-close>Cancel</button><h2></h2><button class="pill-btn" type="submit">Save</button></div>' +
      '<div class="cl-edit kit-fields"></div><div class="cl-del kit-del" hidden><button class="text-btn danger" type="button"><i class="bi bi-trash3"></i> <span>Delete</span></button></div></form>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
    sheet = { bg: bg, form: bg.querySelector('form'), fields: bg.querySelector('.kit-fields'), title: bg.querySelector('h2'), del: bg.querySelector('.kit-del') };
    return sheet;
  }
  function open() {
    var s = ensureSheet();
    s.bg.hidden = false;
    requestAnimationFrame(function () { s.bg.classList.add('open'); });
    document.documentElement.classList.add('cl-modal');
  }
  function close() {
    if (!sheet) return;
    sheet.bg.classList.remove('open');
    document.documentElement.classList.remove('cl-modal');
    setTimeout(function () { sheet.bg.hidden = true; }, 220);
  }

  function input(f, v) {
    var id = 'kf-' + f.k, req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    var val = v == null ? '' : v;
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + ph + req + ' maxlength="' + (f.max || 2000) + '">' + esc(val) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '" class="st-wide">' + (typeof f.options === 'function' ? f.options() : f.options).map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
    if (f.type === 'check') return '<input type="checkbox" class="switch" id="' + id + '"' + (val ? ' checked' : '') + '>';
    var t = f.type === 'number' ? 'text" inputmode="decimal' : (f.type || 'text');
    return '<input id="' + id + '" type="' + t + '"' + ph + req + ' maxlength="' + (f.max || 200) + '" value="' + esc(val) + '">';
  }
  function edit(cfg, item) {
    var s = ensureSheet(), isNew = !item;
    item = item ? JSON.parse(JSON.stringify(item)) : {};
    s.title.textContent = isNew ? (cfg.addTitle || 'Add') : (cfg.editTitle || 'Edit');
    var rows = '', inline = '';
    cfg.fields.forEach(function (f) {
      var v = item[f.k] != null ? item[f.k] : (isNew && f.def != null ? (typeof f.def === 'function' ? f.def() : f.def) : '');
      if (f.type === 'title') { rows += '<input class="cl-in-title" id="kf-' + f.k + '" placeholder="' + esc(f.ph || f.label) + '"' + (f.req ? ' required' : '') + ' maxlength="' + (f.max || 120) + '" value="' + esc(v) + '">'; return; }
      var line = '<label class="st-row kit-row' + (f.type === 'textarea' ? ' kit-tall' : '') + '"><span>' + esc(f.label) + '</span>' + input(f, v) + (f.suffix ? '<em>' + esc(f.suffix) + '</em>' : '') + '</label>';
      if (f.type === 'textarea') rows += '<div class="cl-group cl-group-text kit-text"><span class="kit-lbl">' + esc(f.label) + '</span>' + input(f, v) + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
      else rows += '<div class="cl-group">' + line + (f.help ? '<small class="kit-help">' + esc(f.help) + '</small>' : '') + '</div>';
    });
    s.fields.innerHTML = rows;
    s.del.hidden = isNew;
    var delArmed = false;
    s.del.querySelector('span').textContent = 'Delete';
    s.del.querySelector('button').onclick = function () {
      if (!delArmed) { delArmed = true; s.del.querySelector('span').textContent = 'Tap again to delete'; return; }
      var t = F.tools(); t[cfg.key] = (t[cfg.key] || []).filter(function (x) { return x.id !== item.id; });
      if (cfg.onDelete) cfg.onDelete(item);
      F.saveTools(t); close();
    };
    s.form.onsubmit = function (e) {
      e.preventDefault();
      var bad = null;
      cfg.fields.forEach(function (f) {
        var el = document.getElementById('kf-' + f.k);
        if (!el) return;
        var v = f.type === 'check' ? el.checked : el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : (num(v) == null ? (bad = bad || el, '') : num(v));
        if (f.req && (v === '' || v == null)) bad = bad || el;
        item[f.k] = v;
      });
      if (bad) { bad.focus(); bad.classList.add('kit-bad'); return; }
      if (!item.id) item.id = uid();
      if (cfg.beforeSave) cfg.beforeSave(item, isNew);
      var t = F.tools(), l = Array.isArray(t[cfg.key]) ? t[cfg.key] : [];
      var i = l.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) l[i] = item; else l.push(item);
      t[cfg.key] = l;
      F.saveTools(t);
      if (cfg.afterSave) cfg.afterSave(item, isNew);
      close();
    };
    open();
    if (isNew && innerWidth >= 700) setTimeout(function () { var first = s.fields.querySelector('input,textarea'); if (first) first.focus(); }, 60);
  }

  /* ---------- a collection card ---------- */
  function collection(cfg) {
    var el = cfg.mount, showAll = false, openId = null, scrolled = false;
    if (!el) return null;
    function render() {
      var on = F.on(cfg.feature);
      el.hidden = !on;
      if (!on) { el.innerHTML = ''; return; }
      var items = F.list(cfg.key).slice();
      if (cfg.sort) items.sort(cfg.sort);
      var lim = cfg.limit || 8, shown = showAll ? items : items.slice(0, lim);
      el.innerHTML = '<section class="card kit-card" id="' + cfg.key + '">' +
        '<div class="card-head"><h2><i class="bi bi-' + cfg.icon + '"></i> ' + esc(cfg.title) + '</h2>' +
        '<div class="head-actions">' + (cfg.headExtra ? cfg.headExtra(items) : '') + '<button class="text-btn" type="button" data-kit-add><i class="bi bi-plus-lg"></i> ' + esc(cfg.addLabel || 'Add') + '</button></div></div>' +
        (cfg.summary ? '<div class="kit-sum">' + cfg.summary(items) + '</div>' : '') +
        (cfg.above ? cfg.above(items) : '') +
        (items.length ? '<ul class="kit-list">' + shown.map(function (it) {
          var r = cfg.row(it);
          return '<li class="kit-item' + (r.cls ? ' ' + r.cls : '') + (openId === it.id ? ' open' : '') + '" data-id="' + esc(it.id) + '">' +
            '<button type="button" class="kit-main" data-kit-' + (cfg.detail ? 'toggle' : 'edit') + '="' + esc(it.id) + '">' +
            (r.icon ? '<span class="kit-ic" style="--c:' + (r.color || 'var(--accent)') + '"><i class="bi bi-' + r.icon + '"></i></span>' : '') +
            '<span class="kit-x"><b>' + esc(r.title) + '</b>' + (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
            (r.right ? '<span class="kit-r">' + r.right + '</span>' : '') + '</button>' +
            (cfg.detail && openId === it.id ? '<div class="kit-detail">' + cfg.detail(it) + '<button type="button" class="text-btn" data-kit-edit="' + esc(it.id) + '"><i class="bi bi-pencil"></i> Edit</button></div>' : '') +
            '</li>';
        }).join('') + '</ul>' : '<p class="empty kit-empty">' + esc(cfg.empty || 'Nothing here yet.') + '</p>') +
        (items.length > lim ? '<button class="text-btn kit-more" type="button" data-kit-more>' + (showAll ? 'Show less' : 'Show all ' + items.length) + '</button>' : '') +
        '</section>';
      if (cfg.afterRender) cfg.afterRender(el, items);
      /* arriving from a calendar reminder (…/#subs): scroll to the card once */
      if (!scrolled && location.hash === '#' + cfg.key && document.documentElement.classList.contains('unlocked')) {
        scrolled = true;
        /* wait until the rest of the page has drawn (charts, lists), then scroll */
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      }
    }
    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-kit-add]')) return edit(cfg, null);
      if ((b = e.target.closest('[data-kit-edit]'))) return edit(cfg, F.list(cfg.key).filter(function (x) { return x.id === b.dataset.kitEdit; })[0]);
      if ((b = e.target.closest('[data-kit-toggle]'))) { openId = openId === b.dataset.kitToggle ? null : b.dataset.kitToggle; return render(); }
      if (e.target.closest('[data-kit-more]')) { showAll = !showAll; return render(); }
      if (cfg.onClick) cfg.onClick(e, render);
    });
    window.addEventListener('tools:change', render);
    window.addEventListener('features:change', render);
    var prevReload = window.Dash && window.Dash.reload;
    window.Dash = window.Dash || {};
    window.Dash.reload = function () { if (prevReload) prevReload(); render(); };
    if (window.Vault) window.Vault.onUnlock(render);
    return { render: render, edit: function (it) { edit(cfg, it); } };
  }

  window.Kit = { collection: collection, edit: edit, close: close, esc: esc, uid: uid, num: num, kr: kr, fmt: fmt, today: today };
})();
} catch (e) { console.error("kit.js", e); }
/* ===== tools.js ===== */
try {
/* The optional tools (Settings → Features). Each one mounts into a [data-tool="…"]
   container on the page where it belongs:
   Work page:      flex time, meeting notes, courses & certificates
   Habits page:    training log, journal
   Travel page:    places to visit
   Finance page:   subscriptions, warranties & receipts
   Dashboard:      a small "Work today" card for flex time */
(function () {
  "use strict";
  var F = window.Features, K = window.Kit;
  if (!F || !K) return;
  var esc = K.esc, today = K.today, fmt = K.fmt, kr = K.kr;
  function $t(name) { return document.querySelector('[data-tool="' + name + '"]'); }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function addDays(k, n) { var d = F.fromKey(k); d.setDate(d.getDate() + n); return F.dkey(d); }
  function tile(label, value, sub) { return '<div class="kit-tile" data-tk="' + String(label).replace(/\b(19|20)\d\d\b/g, 'Y').replace(/"/g, '') + '"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function hm(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min');
  }
  /* short form for the number tiles: 15 h 26 → "15h 26m" */
  function hms(min) {
    var neg = min < 0; min = Math.abs(Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return (neg ? '−' : '') + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function nowHM() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ================= WORK: flex time ================= */
  var FLEX_TYPES = { work: 'Work', vacation: 'Holiday (ferie)', sick: 'Sick', flexoff: 'Flex day off (avspasering)', holiday: 'Public holiday', course: 'Course / travel' };
  function flexCfg() { var c = F.tools().flexcfg || {}; return { norm: +c.norm || 7.5, vacation: +c.vacation || 25 }; }
  function worked(e, isToday) {
    if (e.type !== 'work' && e.type !== 'course') return 0;
    var a = toMin(e.in), b = toMin(e.out);
    if (a == null) return 0;
    if (b == null) { if (!isToday) return 0; b = toMin(nowHM()); }
    var w = b - a; if (w < 0) w += 1440;
    return Math.max(0, w - (+e.brk || 0));
  }
  function flexDays() {
    var by = {}, td = today();
    F.list('flex').forEach(function (e) { (by[e.date] = by[e.date] || []).push(e); });
    var norm = flexCfg().norm * 60;
    return Object.keys(by).sort().map(function (k) {
      var es = by[k], open = es.some(function (e) { return (e.type === 'work' || e.type === 'course') && e.in && !e.out; });
      var w = es.reduce(function (a, e) { return a + worked(e, k === td); }, 0);
      var free = es.some(function (e) { return e.type === 'vacation' || e.type === 'sick' || e.type === 'holiday'; });
      var hol = F.holiday(k) && F.fromKey(k).getDay() % 6 !== 0;   // public holiday on a weekday: all work is extra
      var delta = free ? 0 : hol ? w : w - norm;
      return { date: k, entries: es, worked: w, delta: delta, open: open, free: free };
    });
  }
  function flexStats() {
    var days = flexDays(), td = today(), y = td.slice(0, 4), mon = F.dkey(monday(new Date()));
    var balance = days.filter(function (d) { return d.date < td || (d.date === td && !d.open); }).reduce(function (a, d) { return a + d.delta; }, 0);
    var t = days.filter(function (d) { return d.date === td; })[0];
    var week = days.filter(function (d) { return d.date >= mon && d.date <= td; });
    var weekWorked = week.reduce(function (a, d) { return a + d.worked; }, 0);
    var wd = Math.min(5, ((new Date().getDay() + 6) % 7) + 1), off = {};
    week.forEach(function (d) { if (d.free) off[d.date] = 1; });
    for (var i = 0; i < wd; i++) { var hk = addDays(mon, i); if (F.holiday(hk)) off[hk] = 1; }
    var weekFree = Object.keys(off).filter(function (k) { var g = F.fromKey(k).getDay(); return g > 0 && g < 6; }).length;
    var weekTarget = Math.max(0, wd - weekFree) * flexCfg().norm * 60;
    var vac = F.list('flex').filter(function (e) { return e.type === 'vacation' && String(e.date).slice(0, 4) === y; }).length;
    var openE = F.list('flex').filter(function (e) { return e.date === td && (e.type === 'work' || e.type === 'course') && e.in && !e.out; })[0];
    return { balance: balance, today: t ? t.worked : 0, open: openE, week: weekWorked, weekTarget: weekTarget, vac: vac };
  }
  function clock() {
    var t = F.tools(), l = Array.isArray(t.flex) ? t.flex : [], td = today();
    var open = l.filter(function (e) { return e.date === td && e.in && !e.out && e.type === 'work'; })[0];
    if (open) open.out = nowHM();
    else l.push({ id: K.uid(), date: td, type: 'work', in: nowHM(), out: '', brk: l.some(function (e) { return e.date === td && e.type === 'work'; }) ? 0 : (+(t.flexcfg || {}).brk || 0) });
    t.flex = l;
    F.saveTools(t);
  }
  function clockBlock(s) {
    return '<div class="flex-clock">' +
      '<div class="fc-now"><span class="fc-dot' + (s.open ? ' on' : '') + '"></span><span>' + (s.open ? 'Clocked in at <b>' + esc(s.open.in) + '</b>' : 'Not clocked in') + '</span></div>' +
      '<b class="fc-time" data-flex-live>' + hm(s.today) + '</b><small>today</small>' +
      '<button type="button" class="pill-btn fc-btn' + (s.open ? ' out' : '') + '" data-flex-clock><i class="bi bi-' + (s.open ? 'stop-fill' : 'play-fill') + '"></i> ' + (s.open ? 'Clock out' : 'Clock in') + '</button></div>';
  }
  var flex = K.collection({
    mount: $t('flex'), feature: 'flex', key: 'flex', title: 'Flex time', icon: 'stopwatch', addLabel: 'Add day',
    addTitle: 'Add a day', editTitle: 'Edit day', limit: 6,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'type', label: 'Type', type: 'select', options: Object.keys(FLEX_TYPES).map(function (k) { return [k, FLEX_TYPES[k]]; }), def: 'work' },
      { k: 'in', label: 'In', type: 'time' }, { k: 'out', label: 'Out', type: 'time' },
      { k: 'brk', label: 'Unpaid break', type: 'number', suffix: 'min', def: 0, help: 'Only if lunch is not part of your paid time.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 }
    ],
    sort: function (a, b) { return (b.date + (b.in || '')) > (a.date + (a.in || '')) ? 1 : -1; },
    summary: function () {
      var s = flexStats(), c = flexCfg();
      return clockBlock(s) + '<div class="kit-tiles">' +
        tile('Flex balance', '<span class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hms(s.balance) + '</span>', 'logged days') +
        tile('This week', hms(s.week), 'of ' + hms(s.weekTarget)) +
        tile('Holiday ' + today().slice(0, 4), s.vac + ' <small>/ ' + c.vacation + '</small>', 'days used') + '</div>';
    },
    row: function (e) {
      var isT = e.date === today(), w = worked(e, isT), lbl = FLEX_TYPES[e.type] || 'Work';
      return { icon: e.type === 'vacation' ? 'sun' : e.type === 'sick' ? 'thermometer-half' : e.type === 'flexoff' ? 'cup-hot' : e.type === 'holiday' ? 'flag' : 'briefcase',
        color: e.type === 'work' || e.type === 'course' ? '#e8743b' : '#7a8794',
        title: fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (e.type !== 'work' ? ' · ' + lbl : ''),
        sub: (e.in ? esc(e.in) + '–' + (e.out ? esc(e.out) : 'now') : '') + (e.brk ? ' · ' + e.brk + ' min break' : '') + (e.note ? ' · ' + esc(e.note) : ''),
        right: e.type === 'work' || e.type === 'course' ? hm(w) : '' };
    },
    empty: 'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.',
    afterRender: function (el) {
      var c = flexCfg();
      el.querySelector('.kit-card').insertAdjacentHTML('beforeend', '<p class="kit-foot">Normal day ' + String(c.norm).replace('.', ',') + ' h · ' + c.vacation + ' holiday days a year · <a href="/cmd/?settings=work">Change</a></p>' +
        '<div class="fr-bar"><span class="muted"><i class="bi bi-file-earmark-text"></i> Monthly report</span><select class="fr-month" aria-label="Month for the report">' + reportMonths() + '</select>' +
        '<button type="button" class="text-btn" data-frcsv>CSV</button><button type="button" class="text-btn" data-frpdf>PDF</button></div>');
    },
    onClick: function (e) {
      if (e.target.closest('[data-flex-clock]')) clock();
      var m = e.target.closest('.kit-card') && e.target.closest('.kit-card').querySelector('.fr-month');
      if (e.target.closest('[data-frcsv]') && m) reportCsv(m.value);
      if (e.target.closest('[data-frpdf]') && m) reportPdf(m.value);
    }
  });

  /* ---------- monthly report: every day, hours, flex and days off – CSV or a printable page (Save as PDF) ---------- */
  function reportMonths() {
    var out = '', d = new Date(), have = {};
    F.list('flex').forEach(function (e) { have[String(e.date).slice(0, 7)] = 1; });
    for (var i = 0; i < 13; i++) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
      if (i > 0 && !have[k]) continue;
      out += '<option value="' + k + '">' + x.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</option>';
    }
    return out;
  }
  function report(ym) {
    var c = flexCfg(), days = flexDays(), inM = days.filter(function (d) { return d.date.slice(0, 7) === ym; });
    var end = ym + '-31', bal = days.filter(function (d) { return d.date <= end && !d.open; }).reduce(function (a, d) { return a + d.delta; }, 0);
    var rows = [];
    inM.forEach(function (d) {
      d.entries.forEach(function (e) {
        rows.push({ date: d.date, wd: F.fromKey(d.date).toLocaleDateString('en-GB', { weekday: 'short' }), type: FLEX_TYPES[e.type] || 'Work', in: e.in || '', out: e.out || '', brk: +e.brk || 0, worked: worked(e, false), note: e.note || '' });
      });
    });
    var tot = inM.reduce(function (a, d) { return a + d.worked; }, 0), delta = inM.reduce(function (a, d) { return a + d.delta; }, 0);
    var count = function (t) { return F.list('flex').filter(function (e) { return e.type === t && String(e.date).slice(0, 7) === ym; }).length; };
    return { ym: ym, name: new Date(ym + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), rows: rows, total: tot, delta: delta, balance: bal, norm: c.norm,
      vacation: count('vacation'), sick: count('sick'), flexoff: count('flexoff'), days: inM.filter(function (d) { return d.worked > 0; }).length };
  }
  function hmPlain(m) { var s = m < 0 ? '-' : ''; m = Math.abs(Math.round(m)); return s + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
  function download(name, type, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function reportCsv(ym) {
    var r = report(ym), q = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['Date', 'Day', 'Type', 'In', 'Out', 'Break (min)', 'Worked (h:mm)', 'Note'].join(';')]
      .concat(r.rows.map(function (x) { return [x.date, x.wd, x.type, x.in, x.out, x.brk, hmPlain(x.worked), x.note].map(q).join(';'); }))
      .concat(['', 'Total worked;' + hmPlain(r.total), 'Flex this month;' + hmPlain(r.delta), 'Flex balance at month end;' + hmPlain(r.balance),
        'Holiday days;' + r.vacation, 'Sick days;' + r.sick, 'Flex days off;' + r.flexoff, 'Normal day (h);' + String(r.norm).replace('.', ',')]);
    download('flex-' + ym + '.csv', 'text/csv;charset=utf-8', '\ufeff' + lines.join('\r\n'));
  }
  function reportPdf(ym) {
    var r = report(ym), me = (function () { try { return JSON.parse(localStorage.getItem('dash.profile')) || {}; } catch (e) { return {}; } })();
    var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Flex time ' + esc(r.name) + '</title><style>' +
      'body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px auto;max-width:760px;padding:0 20px}h1{font-size:22px;margin:0 0 2px}p.s{color:#555;margin:0 0 18px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.sum div{border:1px solid #ddd;border-radius:8px;padding:10px}.sum b{display:block;font-size:18px}.sum span{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em}' +
      '.tip{color:#555;font-size:12px;margin-top:24px}.wrap{overflow-x:auto}@media (max-width:600px){body{margin:20px auto}th,td{padding:5px 4px;font-size:12px}.sum b{font-size:16px}}@media print{.tip{display:none}body{margin:0 auto}}</style></head><body>' +
      '<h1>Flex time – ' + esc(r.name) + '</h1><p class="s">' + esc(me.name || 'John Paul Lundberg') + (me.employer ? ' · ' + esc(me.employer) : '') + ' · normal day ' + String(r.norm).replace('.', ',') + ' h</p>' +
      '<div class="sum"><div><span>Worked</span><b>' + hmPlain(r.total) + '</b>' + r.days + ' days</div><div><span>Flex this month</span><b>' + (r.delta > 0 ? '+' : '') + hmPlain(r.delta) + '</b>balance ' + (r.balance > 0 ? '+' : '') + hmPlain(r.balance) + '</div>' +
      '<div><span>Days off</span><b>' + r.vacation + '</b>holiday · ' + r.sick + ' sick · ' + r.flexoff + ' flex</div></div>' +
      '<div class="wrap"><table><thead><tr><th>Date</th><th>Type</th><th>In</th><th>Out</th><th class="n">Break</th><th class="n">Worked</th><th>Note</th></tr></thead><tbody>' +
      (r.rows.length ? r.rows.map(function (x) { return '<tr><td>' + esc(x.wd + ' ' + x.date.slice(8) + '.' + x.date.slice(5, 7)) + '</td><td>' + esc(x.type) + '</td><td>' + esc(x.in) + '</td><td>' + esc(x.out) + '</td><td class="n">' + (x.brk ? x.brk + ' min' : '') + '</td><td class="n">' + (x.worked ? hmPlain(x.worked) : '') + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') : '<tr><td colspan="7">Nothing logged this month.</td></tr>') +
      '</tbody></table></div><p class="tip">Use Print → Save as PDF (on iPhone: Share → Print, then pinch out on the preview to get the PDF).</p>' +
      '<script>setTimeout(function(){try{window.print()}catch(e){}},400)<\/script></body></html>';
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) {}
    if (w && w.document) { w.document.open(); w.document.write(html); w.document.close(); }
    else download('flex-' + ym + '.html', 'text/html;charset=utf-8', html);
  }
  document.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.flexcfg;
    if (!k) return;
    var v = K.num(e.target.value);
    if (v == null || v <= 0) return;
    var t = F.tools(); t.flexcfg = t.flexcfg || {}; t.flexcfg[k] = v; F.saveTools(t);
  });
  /* keep the running time fresh */
  setInterval(function () {
    if (!F.on('flex')) return;
    var s = flexStats();
    if (!s.open) return;
    document.querySelectorAll('[data-flex-live]').forEach(function (el) { el.textContent = hm(s.today); });
  }, 30000);

  /* Dashboard card: Work today */
  var home = document.getElementById('flexCard');
  function renderHome() {
    if (!home) return;
    var on = F.on('flex');
    home.hidden = !on;
    if (!on) return;
    var s = flexStats();
    home.innerHTML = '<div class="card-head"><h2><i class="bi bi-stopwatch"></i> Work today</h2><a class="text-btn" href="work/">Details</a></div>' +
      clockBlock(s) + '<p class="fc-bal">Flex balance <b class="' + (s.balance < 0 ? 'neg' : 'pos') + '">' + (s.balance > 0 ? '+' : '') + hm(s.balance) + '</b> · this week ' + hm(s.week) + '</p>';
  }
  if (home) {
    home.addEventListener('click', function (e) { if (e.target.closest('[data-flex-clock]')) clock(); });
    window.addEventListener('tools:change', renderHome);
    window.addEventListener('features:change', renderHome);
    if (window.Vault) window.Vault.onUnlock(renderHome);
  }

  /* ================= WORK: meeting notes ================= */
  K.collection({
    mount: $t('meetings'), feature: 'meetings', key: 'meetings', title: 'Meeting notes', icon: 'people', addLabel: 'New',
    addTitle: 'New meeting note', editTitle: 'Edit meeting note',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'Meeting, e.g. Status FDVU handover', req: true },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'who', label: 'With', ph: 'Who was there' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      { k: 'actions', label: 'Action points', type: 'textarea', rows: 3, help: 'One per line. Tick them off here or send them to your to-do list.' }
    ],
    beforeSave: function (it) { it.done = it.done || {}; },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    row: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); }), done = acts.filter(function (_, i) { return (m.done || {})[i]; }).length;
      return { icon: 'people', color: '#3987e5', title: m.title || 'Meeting', sub: fmt(m.date) + (m.who ? ' · ' + esc(m.who) : '') + (acts.length ? ' · ' + done + '/' + acts.length + ' actions' : ''),
        cls: acts.length && done < acts.length ? 'has-open' : '' };
    },
    detail: function (m) {
      var acts = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); });
      return (m.notes ? '<p class="kit-notes">' + esc(m.notes) + '</p>' : '') +
        (acts.length ? '<ul class="kit-checks">' + acts.map(function (a, i) {
          var d = (m.done || {})[i];
          return '<li class="' + (d ? 'done' : '') + '"><label><input type="checkbox" data-mact="' + esc(m.id) + ':' + i + '"' + (d ? ' checked' : '') + '><span>' + esc(a) + '</span></label>' +
            '<button type="button" class="text-btn" data-mtodo="' + esc(m.id) + ':' + i + '"><i class="bi bi-box-arrow-in-right"></i> To-do</button></li>';
        }).join('') + '</ul>' : '');
    },
    empty: 'Write down what was decided and who does what. Action points can go straight to your to-do list.',
    onClick: function (e, render) {
      var b = e.target.closest('[data-mtodo]');
      if (!b) return;
      var p = b.dataset.mtodo.split(':'), m = F.list('meetings').filter(function (x) { return x.id === p[0]; })[0];
      if (!m) return;
      var text = String(m.actions || '').split('\n').filter(function (x) { return x.trim(); })[+p[1]];
      var todos = readJSON('dash.todos') || [];
      todos.push({ id: K.uid(), text: text.trim() + (m.title ? ' (' + m.title + ')' : ''), done: false });
      writeJSON('dash.todos', todos);
      b.innerHTML = '<i class="bi bi-check2"></i> Added';
      b.disabled = true;
    }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.dataset && e.target.dataset.mact;
    if (!a) return;
    var p = a.split(':'), t = F.tools();
    (t.meetings || []).forEach(function (m) { if (m.id === p[0]) { m.done = m.done || {}; if (e.target.checked) m.done[p[1]] = true; else delete m.done[p[1]]; } });
    F.saveTools(t);
  });

  /* ================= WORK: courses & certificates ================= */
  var KINDS = [['course', 'Course'], ['certificate', 'Certificate'], ['book', 'Book'], ['standard', 'Standard / regulation'], ['other', 'Other']];
  var KIND_ICON = { course: 'mortarboard', certificate: 'award', book: 'book', standard: 'file-earmark-text', other: 'lightbulb' };
  var STATUS = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];
  function expiryBadge(k) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">Expired</span>';
    if (days < 183) return '<span class="kit-badge warn">Expires ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
    return '<span class="kit-badge">Until ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('learning'), feature: 'learning', key: 'learning', title: 'Courses & certificates', icon: 'mortarboard',
    addTitle: 'Add course or certificate',
    fields: [
      { k: 'title', type: 'title', label: 'Title', ph: 'e.g. Varme arbeider, NS 3456, Plania advanced', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: KINDS, def: 'course' },
      { k: 'provider', label: 'From', ph: 'Provider or author' },
      { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'planned' },
      { k: 'date', label: 'Date', type: 'date', help: 'When you took it or plan to.' },
      { k: 'expires', label: 'Expires', type: 'date', help: 'For certificates that must be renewed – you get a reminder in your calendar 2 months before.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ],
    sort: function (a, b) { var o = { progress: 0, planned: 1, done: 2 }; return (o[a.status] - o[b.status]) || ((b.date || '') > (a.date || '') ? 1 : -1); },
    summary: function (items) {
      var y = today().slice(0, 4);
      var done = items.filter(function (c) { return c.status === 'done' && String(c.date || '').slice(0, 4) === y; }).length;
      var prog = items.filter(function (c) { return c.status === 'progress'; }).length;
      var soon = items.filter(function (c) { return c.expires && c.expires < F.addMonths(today(), 6); }).length;
      return items.length ? '<div class="kit-tiles">' + tile('Done in ' + y, done) + tile('In progress', prog) + tile('Expiring soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 6 months') + '</div>' : '';
    },
    row: function (c) {
      return { icon: KIND_ICON[c.kind] || 'lightbulb', color: '#8a6fdf', title: c.title, cls: c.status === 'done' ? 'is-done' : '',
        sub: [c.provider ? esc(c.provider) : '', (STATUS.filter(function (s) { return s[0] === c.status; })[0] || ['', ''])[1], c.date ? fmt(c.date, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '),
        right: expiryBadge(c.expires) };
    },
    empty: 'Courses you want to take, certificates that need renewing (like varme arbeider or first aid), and standards you’re reading up on.'
  });

  /* ================= HABITS: training log ================= */
  var SPORTS = [['strength', 'Strength', 'trophy'], ['run', 'Running', 'person-walking'], ['walk', 'Walking', 'person-walking'], ['bike', 'Cycling', 'bicycle'],
    ['swim', 'Swimming', 'water'], ['ball', 'Ball sports', 'dribbble'], ['yoga', 'Yoga / mobility', 'person-arms-up'], ['other', 'Other', 'heart-pulse']];
  var EFFORT = [['1', 'Easy'], ['2', 'Light'], ['3', 'Moderate'], ['4', 'Hard'], ['5', 'All out']];
  function habitOptions() {
    var hb = readJSON('dash.habits') || { list: [] };
    return [['', 'Don’t tick a habit']].concat((hb.list || []).map(function (h) { return [h.id, 'Tick “' + h.name + '”']; }));
  }
  function defaultHabit() {
    var hb = readJSON('dash.habits') || { list: [] };
    var h = (hb.list || []).filter(function (x) { return /train|trening|gym|workout|løp|run|exercise/i.test(x.name); })[0];
    return h ? h.id : '';
  }
  K.collection({
    mount: $t('training'), feature: 'training', key: 'training', title: 'Training log', icon: 'heart-pulse', addLabel: 'Log workout',
    addTitle: 'Log a workout', editTitle: 'Edit workout',
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'kind', label: 'Type', type: 'select', options: SPORTS.map(function (s) { return [s[0], s[1]]; }), def: 'strength' },
      { k: 'min', label: 'Time', type: 'number', suffix: 'min', req: true, def: 60 },
      { k: 'km', label: 'Distance', type: 'number', suffix: 'km' },
      { k: 'effort', label: 'How hard', type: 'select', options: EFFORT, def: '3' },
      { k: 'habit', label: 'Habit', type: 'select', options: habitOptions, def: defaultHabit },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Exercises, weights, how it felt.' }
    ],
    afterSave: function (w) {
      if (!w.habit) return;
      var hb = readJSON('dash.habits') || { list: [], log: {} };
      hb.log = hb.log || {};
      var l = hb.log[w.date] = hb.log[w.date] || [];
      if (l.indexOf(w.habit) < 0) { l.push(w.habit); writeJSON('dash.habits', hb); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var mon = F.dkey(monday(new Date())), m = today().slice(0, 7);
      var wk = items.filter(function (w) { return w.date >= mon; }), mo = items.filter(function (w) { return String(w.date).slice(0, 7) === m; });
      var sum = function (l, k) { return l.reduce(function (a, w) { return a + (+w[k] || 0); }, 0); };
      return '<div class="kit-tiles">' + tile('This week', wk.length + ' <small>sessions</small>', hms(sum(wk, 'min'))) +
        tile('This month', mo.length + ' <small>sessions</small>', hms(sum(mo, 'min'))) +
        tile('Distance this month', (Math.round(sum(mo, 'km') * 10) / 10).toString().replace('.', ',') + ' <small>km</small>') + '</div>';
    },
    row: function (w) {
      var s = SPORTS.filter(function (x) { return x[0] === w.kind; })[0] || SPORTS[7];
      return { icon: s[2], color: '#d55181', title: s[1], sub: fmt(w.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hm(+w.min || 0) + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : '') + (w.notes ? ' · ' + esc(String(w.notes).slice(0, 60)) : ''),
        right: '<span class="kit-dots">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= +w.effort ? 'on' : '') + '"></i>'; }).join('') + '</span>' };
    },
    empty: 'Log a workout and it also ticks your training habit for that day.'
  });

  /* ================= HEALTH: check-ups, vaccines, medicine ================= */
  var HKINDS = [['checkup', 'Appointment / check-up'], ['vaccine', 'Vaccine'], ['medicine', 'Medicine / prescription']];
  var HICON = { checkup: 'clipboard2-pulse', vaccine: 'shield-plus', medicine: 'capsule' };
  var HNEXT = { checkup: 'Next check-up', vaccine: 'Booster due', medicine: 'Renew by' };
  function dueBadge(k, word) {
    if (!k) return '';
    var days = Math.round((F.fromKey(k) - F.fromKey(today())) / 864e5);
    if (days < 0) return '<span class="kit-badge bad">' + word + ' overdue</span>';
    if (days <= 60) return '<span class="kit-badge warn">' + word + ' ' + fmt(k, { day: 'numeric', month: 'short' }) + '</span>';
    return '<span class="kit-badge">' + word + ' ' + fmt(k, { month: 'short', year: 'numeric' }) + '</span>';
  }
  K.collection({
    mount: $t('health'), feature: 'health', key: 'health', title: 'Check-ups & medicine', icon: 'clipboard2-pulse',
    addTitle: 'Add to health', editTitle: 'Edit',
    fields: [
      { k: 'title', type: 'title', label: 'What', ph: 'e.g. Dentist, Tetanus booster, Allergy pills', req: true },
      { k: 'kind', label: 'Type', type: 'select', options: HKINDS, def: 'checkup' },
      { k: 'date', label: 'Date', type: 'date', def: today, help: 'The appointment, when you took the vaccine, or when it was prescribed.' },
      { k: 'time', label: 'Time', type: 'time', help: 'For appointments – it goes in your calendar.' },
      { k: 'where', label: 'Where / who', ph: 'Clinic, doctor, pharmacy' },
      { k: 'next', label: 'Next / renew by', type: 'date', help: 'Next check-up, when a booster is due, or when the prescription runs out. You get a reminder in your calendar.' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, help: 'Dose, what was said, questions for next time …' }
    ],
    sort: function (a, b) {
      var ka = a.kind === 'checkup' && a.date >= today() ? a.date : (a.next || '9999'), kb = b.kind === 'checkup' && b.date >= today() ? b.date : (b.next || '9999');
      return ka > kb ? 1 : ka < kb ? -1 : 0;
    },
    summary: function (items) {
      if (!items.length) return '';
      var td = today();
      var up = items.filter(function (h) { return h.kind === 'checkup' && h.date >= td; }).sort(function (a, b) { return a.date > b.date ? 1 : -1; })[0];
      var due = items.filter(function (h) { return h.next && h.next <= F.addMonths(td, 2); }).length;
      var vac = items.filter(function (h) { return h.kind === 'vaccine'; }).length;
      return '<div class="kit-tiles">' + tile('Next appointment', up ? fmt(up.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '–', up ? esc(up.title) + (up.time ? ' · ' + esc(up.time) : '') : 'nothing booked') +
        tile('Due soon', '<span class="' + (due ? 'neg' : '') + '">' + due + '</span>', 'within 2 months') + tile('Vaccines', vac, 'on record') + '</div>';
    },
    row: function (h) {
      var past = h.kind === 'checkup' && h.date && h.date < today();
      return { icon: HICON[h.kind] || 'clipboard2-pulse', color: '#e66767', title: h.title,
        sub: [{ checkup: 'Check-up', vaccine: 'Vaccine', medicine: 'Medicine' }[h.kind] || '', h.date ? fmt(h.date) + (h.time && !past ? ' ' + esc(h.time) : '') : '', h.where ? esc(h.where) : ''].filter(Boolean).join(' · '),
        right: dueBadge(h.next, h.kind === 'medicine' ? 'Renew' : h.kind === 'vaccine' ? 'Booster' : 'Next') };
    },
    empty: 'Doctor and dentist appointments, vaccines (useful before trips) and prescriptions. You get reminders in your calendar before things are due.'
  });

  /* ================= HABITS: journal ================= */
  var MOODS = [['1', 'Bad', 'emoji-frown', '#e66767'], ['2', 'Meh', 'emoji-neutral', '#e8743b'], ['3', 'OK', 'emoji-smile', '#c9a227'], ['4', 'Good', 'emoji-laughing', '#22b35e'], ['5', 'Great', 'emoji-heart-eyes', '#14b8a6']];
  function mood(v) { return MOODS.filter(function (m) { return m[0] === String(v); })[0] || MOODS[2]; }
  K.collection({
    mount: $t('journal'), feature: 'journal', key: 'journal', title: 'Journal', icon: 'journal-bookmark', addLabel: 'Today',
    addTitle: 'Journal', editTitle: 'Journal', limit: 7,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true, def: today },
      { k: 'mood', label: 'Mood', type: 'select', options: MOODS.map(function (m) { return [m[0], m[1]]; }), def: '4' },
      { k: 'line', type: 'title', label: 'Today in one line', ph: 'Today in one sentence', req: true, max: 200 },
      { k: 'notes', label: 'More (optional)', type: 'textarea', rows: 4 }
    ],
    beforeSave: function (it) {    /* one entry per day */
      var t = F.tools();
      t.journal = (t.journal || []).filter(function (x) { return x.date !== it.date || x.id === it.id; });
      F.saveTools(t);
    },
    sort: function (a, b) { return a.date < b.date ? 1 : -1; },
    summary: function (items) {
      var by = {}; items.forEach(function (j) { by[j.date] = j; });
      var cells = '', t = today();
      for (var i = 27; i >= 0; i--) {
        var k = addDays(t, -i), j = by[k];
        cells += '<i title="' + fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }) + (j ? ': ' + mood(j.mood)[1] : '') + '" style="' + (j ? 'background:' + mood(j.mood)[3] : '') + '"></i>';
      }
      var streak = 0; for (var d = 0; d < 400; d++) { if (by[addDays(t, -d)]) streak++; else if (d > 0) break; }
      var last7 = items.filter(function (j) { return j.date > addDays(t, -7); });
      var avg = last7.length ? last7.reduce(function (a, j) { return a + (+j.mood || 0); }, 0) / last7.length : 0;
      return '<div class="kit-mood">' + cells + '</div><p class="kit-moodlbl">Last 4 weeks' + (streak ? ' · ' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row' : '') + (avg ? ' · this week: ' + mood(Math.round(avg))[1].toLowerCase() : '') + '</p>';
    },
    row: function (j) { var m = mood(j.mood); return { icon: m[2], color: m[3], title: j.line, sub: fmt(j.date, { weekday: 'long', day: 'numeric', month: 'short' }) + (j.notes ? ' · ' + esc(String(j.notes).slice(0, 70)) : '') }; },
    empty: 'One line a day is enough. Over time you’ll see how your weeks really were.'
  });

  /* ================= TRAVEL: places to visit ================= */
  K.collection({
    mount: $t('bucket'), feature: 'bucket', key: 'bucket', title: 'Places to visit', icon: 'pin-map',
    addTitle: 'A place you want to visit',
    fields: [
      { k: 'place', type: 'title', label: 'Place', ph: 'City or place, e.g. Lisbon', req: true },
      { k: 'notes', label: 'Why / what to do', type: 'textarea', rows: 3 },
      { k: 'visited', label: 'Been there', type: 'check' }
    ],
    afterSave: function (it) {      /* find it on the map */
      if (!window.World || (it.geo && it.geo.q === it.place)) return;
      window.World.search(it.place).then(function (l) {
        if (!l || !l[0]) return;
        var t = F.tools();
        (t.bucket || []).forEach(function (x) { if (x.id === it.id) x.geo = Object.assign({ q: it.place }, l[0]); });
        F.saveTools(t);
      }).catch(function () {});
    },
    sort: function (a, b) { return (a.visited ? 1 : 0) - (b.visited ? 1 : 0) || (a.place > b.place ? 1 : -1); },
    summary: function (items) {
      var v = items.filter(function (x) { return x.visited; }).length;
      return items.length ? '<p class="kit-moodlbl">' + items.length + ' place' + (items.length > 1 ? 's' : '') + ' · ' + v + ' visited · they show on the map under History</p>' : '';
    },
    row: function (b) { return { icon: b.visited ? 'check-circle-fill' : 'pin-map', color: b.visited ? '#22b35e' : '#0891b2', title: b.place, cls: b.visited ? 'is-done' : '', sub: [b.geo ? esc(b.geo.country) : '', b.notes ? esc(String(b.notes).slice(0, 70)) : ''].filter(Boolean).join(' · ') }; },
    detail: function (b) {
      return (b.notes ? '<p class="kit-notes">' + esc(b.notes) + '</p>' : '') +
        (b.visited ? '' : '<span class="kit-acts"><button type="button" class="text-btn" data-plantrip="' + esc(b.id) + '"><i class="bi bi-suitcase-lg"></i> Plan a trip</button>' +
          (window.World ? '<a class="text-btn" href="' + esc(window.World.flightsLink((b.geo && b.geo.name) || b.place)) + '" target="_blank" rel="noopener"><i class="bi bi-airplane"></i> Flight prices</a>' : '') + '</span>');
    },
    empty: 'Cities and places you want to see. Turn one into a trip when you’re ready.',
    onClick: function (e) {
      var b = e.target.closest('[data-plantrip]');
      if (!b || !window.Flow) return;
      var it = F.list('bucket').filter(function (x) { return x.id === b.dataset.plantrip; })[0];
      if (!it) return;
      var tr = window.Flow.travel(), start = F.addMonths(today(), 1);
      var trip = { id: K.uid(), name: it.place, dest: it.geo ? it.geo.name : it.place, start: start, end: addDays(start, 3), items: [], pack: [], notes: it.notes || '' };
      if (it.geo) trip.place = { name: it.geo.name, region: it.geo.region, country: it.geo.country, cc: it.geo.cc, lat: it.geo.lat, lon: it.geo.lon, tz: it.geo.tz };
      tr.trips.push(trip);
      window.Flow.saveTravel(tr);
      location.href = '/cmd/travel/#trip=' + trip.id;
    }
  });

  /* ================= FINANCE: subscriptions ================= */
  var PERIODS = [['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  var SUB_CATS = [['streaming', 'Streaming & music'], ['software', 'Apps & software'], ['phone', 'Phone & internet'], ['training', 'Training'], ['news', 'News & magazines'], ['insurance', 'Insurance'], ['other', 'Other']];
  K.collection({
    mount: $t('subs'), feature: 'subs', key: 'subs', title: 'Subscriptions', icon: 'arrow-repeat',
    addTitle: 'Add subscription', editTitle: 'Edit subscription',
    fields: [
      { k: 'name', type: 'title', label: 'Name', ph: 'e.g. Spotify, iCloud+, SATS', req: true },
      { k: 'amount', label: 'Price', type: 'number', suffix: 'kr', req: true },
      { k: 'period', label: 'Paid', type: 'select', options: PERIODS, def: 'monthly' },
      { k: 'renews', label: 'Next payment', type: 'date', req: true, def: today, help: 'It shows in your calendar every time it renews.' },
      { k: 'cat', label: 'Category', type: 'select', options: SUB_CATS, def: 'streaming' },
      { k: 'paused', label: 'Paused / cancelled', type: 'check' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'e.g. how to cancel, or the account it’s on.' }
    ],
    sort: function (a, b) { return (a.paused ? 1 : 0) - (b.paused ? 1 : 0) || (F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1); },
    summary: function (items) {
      var act = items.filter(function (s) { return !s.paused; });
      var m = act.reduce(function (a, s) { return a + (+s.amount || 0) * (PER_MONTH[s.period] || 1); }, 0);
      var next = act.slice().sort(function (a, b) { return F.nextRenewal(a) > F.nextRenewal(b) ? 1 : -1; })[0];
      return items.length ? '<div class="kit-tiles">' + tile('Per month', kr(m)) + tile('Per year', kr(m * 12)) +
        (next ? tile('Next', esc(next.name), fmt(F.nextRenewal(next), { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</div>' : '';
    },
    row: function (s) {
      var per = { monthly: '/ month', quarterly: '/ 3 months', yearly: '/ year' }[s.period] || '';
      return { icon: 'arrow-repeat', color: '#11a597', title: s.name, cls: s.paused ? 'is-done' : '',
        sub: kr(+s.amount) + ' ' + per + (s.paused ? ' · paused' : ' · next ' + fmt(F.nextRenewal(s), { day: 'numeric', month: 'short' })),
        right: s.period !== 'monthly' && !s.paused ? '<small class="muted">' + kr((+s.amount || 0) * (PER_MONTH[s.period] || 1)) + '/mo</small>' : '' };
    },
    empty: 'Streaming, apps, phone, gym … see what it all costs per month and year, and get a reminder before each payment.'
  });

  /* ================= FINANCE: warranties & receipts ================= */
  K.collection({
    mount: $t('warranty'), feature: 'warranty', key: 'warranty', title: 'Warranties & receipts', icon: 'receipt-cutoff',
    addTitle: 'Add a purchase', editTitle: 'Edit purchase',
    fields: [
      { k: 'item', type: 'title', label: 'What', ph: 'e.g. MacBook Air, washing machine', req: true },
      { k: 'store', label: 'Store', ph: 'Where you bought it' },
      { k: 'bought', label: 'Bought', type: 'date', req: true, def: today },
      { k: 'price', label: 'Price', type: 'number', suffix: 'kr' },
      { k: 'years', label: 'Complaint period', type: 'select', def: '2', options: [['2', '2 years (most things)'], ['5', '5 years (meant to last: phone, PC, white goods…)'], ['1', '1 year'], ['3', '3 years']],
        help: 'In Norway you can complain (reklamere) for 2 years, or 5 years for things meant to last much longer.' },
      { k: 'receipt', label: 'Receipt', ph: 'Where it is, e.g. email, Vipps, folder' },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, help: 'Serial number, model, insurance …' }
    ],
    sort: function (a, b) { return F.warrantyEnd(a) > F.warrantyEnd(b) ? 1 : -1; },
    summary: function (items) {
      var td = today(), act = items.filter(function (w) { return F.warrantyEnd(w) >= td; });
      var soon = act.filter(function (w) { return F.warrantyEnd(w) < F.addMonths(td, 3); }).length;
      var val = act.reduce(function (a, w) { return a + (+w.price || 0); }, 0);
      return items.length ? '<div class="kit-tiles">' + tile('Covered', act.length, 'things still under warranty') + tile('Ending soon', '<span class="' + (soon ? 'neg' : '') + '">' + soon + '</span>', 'within 3 months') + tile('Value covered', kr(val)) + '</div>' : '';
    },
    row: function (w) {
      var end = F.warrantyEnd(w), over = end < today();
      return { icon: 'receipt-cutoff', color: '#c98500', title: w.item, cls: over ? 'is-done' : '',
        sub: [w.store ? esc(w.store) : '', fmt(w.bought), w.price ? kr(+w.price) : '', w.receipt ? 'receipt: ' + esc(w.receipt) : ''].filter(Boolean).join(' · '),
        right: over ? '<span class="kit-badge">Ended</span>' : expiryBadge(end).replace('Until', 'Until').replace('Expires', 'Ends') };
    },
    empty: 'Keep track of what you bought, where the receipt is, and when you can no longer complain. You get a reminder in your calendar.'
  });

  /* Work page with nothing switched on */
  var wkEmpty = document.getElementById('wkEmpty');
  function workEmpty() { if (wkEmpty) wkEmpty.hidden = F.on('work'); }
  if (wkEmpty) { window.addEventListener('features:change', workEmpty); workEmpty(); }
})();
} catch (e) { console.error("tools.js", e); }
/* ===== profile.js ===== */
try {
/* Your profile: photo, details you use across the dashboard, and your socials.
   Stored in "dash.profile" (synced and encrypted with your passcode).
   - the avatar in the top corner opens Profile & settings
   - home and office address become Home / Work in Travel
   - normal working day is the one Flex time uses
   - your birthday goes in the calendar
   - socials you mark as public can be published to jplundberg.com */
(function () {
  "use strict";
  var KEY = 'dash.profile';
  var $ = function (id) { return document.getElementById(id); };
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var NETS = {
    linkedin: { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/{h}/', host: 'linkedin.com' },
    instagram: { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/{h}/', host: 'instagram.com' },
    facebook: { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/{h}', host: 'facebook.com' },
    tiktok: { name: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@{h}', host: 'tiktok.com' },
    x: { name: 'X', icon: 'twitter-x', url: 'https://x.com/{h}', host: 'x.com' },
    threads: { name: 'Threads', icon: 'threads', url: 'https://www.threads.net/@{h}', host: 'threads.net' },
    youtube: { name: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@{h}', host: 'youtube.com' },
    snapchat: { name: 'Snapchat', icon: 'snapchat', url: 'https://www.snapchat.com/add/{h}', host: 'snapchat.com' },
    strava: { name: 'Strava', icon: 'strava', url: 'https://www.strava.com/athletes/{h}', host: 'strava.com' },
    github: { name: 'GitHub', icon: 'github', url: 'https://github.com/{h}', host: 'github.com' }
  };
  /* the two already on jplundberg.com */
  var START_SOCIALS = [
    { net: 'linkedin', handle: 'john-paul-lundberg-8a804623b', pub: true },
    { net: 'instagram', handle: 'jp.lundberg.official', pub: true }
  ];
  function socialUrl(s) {
    var N = NETS[s.net], h = String(s.handle || '').trim();
    if (!N || !h) return '';
    if (/^https:\/\//i.test(h)) {
      try { var u = new URL(h); return (u.hostname === N.host || u.hostname.slice(-N.host.length - 1) === '.' + N.host) ? u.href : ''; } catch (e) { return ''; }
    }
    h = h.replace(/^@/, '').replace(/[^\w.\-]/g, '');
    return h ? N.url.replace('{h}', h) : '';
  }

  function load() {
    var p = readJSON(KEY);
    p = p && typeof p === 'object' ? p : {};
    if (!Array.isArray(p.socials)) {
      p.socials = START_SOCIALS.map(function (s) { return Object.assign({ id: uid() }, s); });
      if (window.Vault && document.documentElement.classList.contains('unlocked')) {      /* keep the same ids from now on */
        try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
      }
    }
    return p;
  }
  function save(p) {
    var before = null;
    try { before = JSON.stringify((JSON.parse(localStorage.getItem(KEY)) || {}).socials || null); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('profile:change'));
    if (before !== JSON.stringify(p.socials || null)) window.dispatchEvent(new Event('socials:change'));
  }
  function initials(p) {
    var n = String(p.name || (readJSON('dash.settings') || {}).name || '').trim().split(/\s+/).filter(Boolean);
    return n.length ? (n[0][0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase() : '';
  }
  function avatar(p, cls) {
    p = p || load();
    return '<span class="me-av ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' :
      (initials(p) ? '<b>' + esc(initials(p)) + '</b>' : '<i class="bi bi-person"></i>')) + '</span>';
  }
  function age(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
    var b = k.split('-').map(Number), t = new Date(), a = t.getFullYear() - b[0];
    if (t.getMonth() + 1 < b[1] || (t.getMonth() + 1 === b[1] && t.getDate() < b[2])) a--;
    return a;
  }

  /* ---------- the avatar button(s) ---------- */
  function paintButtons() {
    var p = load();
    document.querySelectorAll('[data-me]').forEach(function (b) { b.innerHTML = avatar(p); });
  }
  /* other pages: a small avatar in the top corner that opens Profile & settings */
  var main = $('fp');
  if (main && !$('settingsBtn')) {
    var a = document.createElement('a');
    a.className = 'me-btn me-sub'; a.href = '/cmd/?settings'; a.setAttribute('data-me', '');
    a.addEventListener('click', function () { try { sessionStorage.setItem('dash.stFrom', location.pathname); } catch (e) {} });
    a.setAttribute('aria-label', 'Profile and settings');
    /* in the page's top row (same height as on the dashboard, below the iPhone status bar) */
    var host = document.querySelector('#fp > .fp-top');
    if (host) { a.classList.add('me-in'); host.appendChild(a); } else document.body.appendChild(a);
  }
  window.addEventListener('profile:change', paintButtons);
  if (window.Vault) window.Vault.onUnlock(paintButtons);
  paintButtons();

  /* the links that should be on jplundberg.com (switched on, with a valid address) */
  function publicSocials() {
    return load().socials.filter(function (s) { return s.pub && socialUrl(s); }).map(function (s) { return { net: s.net, url: socialUrl(s) }; });
  }
  /* Undo on the Socials page: back to what's live */
  function resetSocials(live) {
    if (!Array.isArray(live)) return;
    var p = load(), used = {};
    p.socials.forEach(function (s) { var u = socialUrl(s); s.pub = live.some(function (l) { return l.url === u; }); used[u] = 1; });
    live.forEach(function (l) { if (!used[l.url]) p.socials.push({ id: uid(), net: l.net, handle: l.url, pub: true }); });
    save(p);
    window.dispatchEvent(new Event('socials:reset'));
  }
  window.Profile = { load: load, save: save, avatar: avatar, NETS: NETS, socialUrl: socialUrl, age: age, publicSocials: publicSocials, resetSocials: resetSocials };

  /* ---------- Health page: medical info card ---------- */
  var med = $('meHealth');
  function renderMed() {
    if (!med) return;
    var p = load(), rows = [['GP (fastlege)', p.gp], ['Blood type', p.blood], ['Allergies', p.allergies], ['Medicines', p.meds]].filter(function (r) { return r[1]; });
    var ice = p.iceName ? esc(p.iceName) + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') + (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
    med.hidden = !rows.length && !ice;
    med.innerHTML = '<div class="card-head"><h2><i class="bi bi-person-vcard"></i> Medical info</h2><a class="text-btn" href="/cmd/?settings=profile">Edit</a></div>' +
      '<dl class="me-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      (ice ? '<dt>Emergency contact</dt><dd>' + ice + '</dd>' : '') + '</dl>';
  }
  /* Travel page: emergency contact under travel documents */
  var docs = $('tpDocsCard');
  function renderIce() {
    if (!docs) return;
    var p = load(), el = $('meIce');
    if (!el) { el = document.createElement('p'); el.id = 'meIce'; el.className = 'me-ice'; docs.appendChild(el); }
    el.hidden = !p.iceName;
    el.innerHTML = p.iceName ? '<i class="bi bi-telephone"></i> Emergency contact: <b>' + esc(p.iceName) + '</b>' + (p.iceRel ? ' (' + esc(p.iceRel) + ')' : '') +
      (p.icePhone ? ' · <a href="tel:' + esc(p.icePhone.replace(/\s/g, '')) + '">' + esc(p.icePhone) + '</a>' : '') : '';
  }
  [renderMed, renderIce].forEach(function (fn) {
    window.addEventListener('profile:change', fn);
    if (window.Vault) window.Vault.onUnlock(fn);
  });

  /* ---------- Profile & settings panel (dashboard only) ---------- */
  var head = $('stProfile'), box = $('meBox'), soBox = $('soBox');
  var area = box && (box.closest('.st-panel') || box);     // profile and socials pages share the handlers below
  if (!head || !box) return;

  function renderHead() {
    var p = load(), F = window.Features, sub = [p.role, p.employer].filter(Boolean).join(' · ');
    head.innerHTML = avatar(p, 'lg') + '<span class="st-label"><b>' + esc(p.name || 'Your profile') + '</b><small>' +
      esc(sub || 'Your details and photo – private') + '</small></span><i class="bi bi-chevron-right"></i>';
  }

  var FIELDS = [
    { sec: 'About you', icon: 'person', rows: [
      ['name', 'Name', 'text', 'Full name'], ['birthday', 'Birthday', 'date'], ['phone', 'Phone', 'tel', '+47'], ['email', 'Email', 'email', 'you@example.com'],
      ['city', 'City', 'text', 'Oslo']] },
    { sec: 'Home', icon: 'house-door', rows: [['home', 'Address', 'place', 'Search for your address', 'home']],
      note: 'Becomes “Home” in Travel, so departures and “leave by” start from here.' },
    { sec: 'Work', icon: 'briefcase', rows: [['employer', 'Employer', 'text', 'Company'], ['role', 'Role', 'text', 'Job title'],
      ['office', 'Office', 'place', 'Search for the office address', 'work'], ['norm', 'Normal working day', 'hours']],
      note: 'The office becomes “Work” in Travel. The working day is what Flex time counts against.' },
    { sec: 'Emergency contact', icon: 'telephone', rows: [['iceName', 'Name', 'text'], ['iceRel', 'Relation', 'text', 'e.g. Mother, partner'], ['icePhone', 'Phone', 'tel']],
      note: 'Shown with your travel documents and on the Health page.' },
    { sec: 'Health', icon: 'heart-pulse', rows: [['gp', 'GP (fastlege)', 'text', 'Name and clinic'],
      ['blood', 'Blood type', 'select', ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−']], ['allergies', 'Allergies', 'text', 'None'], ['meds', 'Medicines', 'text', 'Anything you take regularly']] },
    { sec: 'Sizes', icon: 'rulers', rows: [['sizeTop', 'Shirts & jackets', 'text', 'M'], ['sizeBottom', 'Trousers', 'text', '32/32'], ['sizeShoe', 'Shoes', 'text', '43'], ['sizeOther', 'Other', 'text', 'Ring, hat …']] }
  ];

  function travelPlace(k) { return window.Flow ? (window.Flow.travel().places || {})[k] : null; }
  function flexNorm() { return window.Features ? +((window.Features.tools().flexcfg || {}).norm) || 7.5 : 7.5; }

  function render() {
    renderSocials();
    var p = load();
    var photo = '<div class="me-photo">' + avatar(p, 'xl') + '<div><button type="button" class="pill-btn" id="mePick"><i class="bi bi-camera"></i> ' + (p.photo ? 'Change photo' : 'Add photo') + '</button>' +
      (p.photo ? '<button type="button" class="text-btn danger" id="meNoPhoto">Remove</button>' : '') +
      '<p class="st-note">' + (p.birthday && age(p.birthday) != null ? age(p.birthday) + ' years · ' : '') + 'Saved encrypted, only for you.</p></div>' +
      '<input type="file" id="meFile" accept="image/*" hidden></div>';
    var secs = FIELDS.map(function (S) {
      return '<p class="st-sub"><i class="bi bi-' + S.icon + '"></i> ' + S.sec + '</p><section class="st-group">' + S.rows.map(function (r) {
        var k = r[0], v = p[k], ph = typeof r[3] === 'string' ? ' placeholder="' + esc(r[3]) + '"' : '';
        var input;
        if (r[2] === 'place') {
          var tp = travelPlace(r[4]);
          input = '<span class="ps-wrap me-place"><input data-mplace="' + k + '" data-tp="' + r[4] + '" value="' + esc((tp && tp.name) || (p[k] && p[k].name) || '') + '"' + ph + ' aria-label="' + r[1] + '"></span>';
        } else if (r[2] === 'select') {
          input = '<select class="st-select" data-mk="' + k + '">' + r[3].map(function (o) { return '<option' + (o === (v || '') ? ' selected' : '') + ' value="' + o + '">' + (o || '–') + '</option>'; }).join('') + '</select>';
        } else if (r[2] === 'hours') {
          input = '<span class="me-hours"><input data-mnorm inputmode="decimal" value="' + String(flexNorm()).replace('.', ',') + '" aria-label="Normal working day in hours"> h</span>';
        } else {
          input = '<input class="st-input" type="' + r[2] + '" data-mk="' + k + '" value="' + esc(v || '') + '"' + ph + ' maxlength="120" aria-label="' + r[1] + '">';
        }
        return '<label class="st-row me-row"><span>' + r[1] + '</span>' + input + '</label>';
      }).join('') + '</section>' + (S.note ? '<p class="st-note me-note">' + S.note + '</p>' : '');
    }).join('');
    box.innerHTML = '<p class="me-private"><i class="bi bi-lock"></i><span><b>Private.</b> Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.</span></p>' + photo + secs +
      '<p class="st-sub"><i class="bi bi-pencil"></i> Notes</p><section class="st-group"><textarea class="me-notes" data-mk="notes" rows="3" maxlength="2000" placeholder="Anything else you want to keep handy">' + esc(p.notes || '') + '</textarea></section>';
    if (window.Places) box.querySelectorAll('[data-mplace]').forEach(function (inp) {
      window.Places.field(inp, { onPick: function (pl) {
        if (!pl) return;
        var q = load(), plain = { id: pl.id || '', name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, stop: !!pl.stop };
        q[inp.dataset.mplace] = plain; save(q);
        if (window.Flow) { var t = window.Flow.travel(); t.places = t.places || {}; t.places[inp.dataset.tp] = plain; window.Flow.saveTravel(t); }
        flash(inp);
      } });
    });
  }
  function flash(el) { var row = el.closest('.st-row'); if (!row) return; row.classList.add('me-saved'); setTimeout(function () { row.classList.remove('me-saved'); }, 900); }

  /* ---------- socials ---------- */
  var pubMsg = '';
  function renderSocials() { if (soBox) soBox.innerHTML = socialsHtml(load()); }
  window.addEventListener('socials:reset', renderSocials);
  function socialsHtml(p) {
    var opts = function (cur) { return Object.keys(NETS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + NETS[k].name + '</option>'; }).join(''); };
    return '<p class="st-sub"><i class="bi bi-share"></i> Your profiles <span class="st-hint">Username or link. The switch decides if it’s shown on jplundberg.com</span></p>' +
      '<section class="st-group me-socials">' + p.socials.map(function (s) {
        var url = socialUrl(s), N = NETS[s.net] || NETS.linkedin;
        return '<div class="st-row me-soc" data-sid="' + esc(s.id) + '">' +
          '<span class="me-soc-ic"><i class="bi bi-' + N.icon + '"></i></span>' +
          '<select class="me-soc-net" data-snet aria-label="Network">' + opts(s.net) + '</select>' +
          '<input class="me-soc-h" data-shandle value="' + esc(s.handle || '') + '" placeholder="username" maxlength="200" aria-label="' + N.name + ' username or link" spellcheck="false" autocapitalize="off">' +
          '<a class="icon-btn me-soc-open" href="' + esc(url || '#') + '"' + (url ? '' : ' hidden') + ' target="_blank" rel="noopener" aria-label="Open ' + N.name + '"><i class="bi bi-box-arrow-up-right"></i></a>' +
          '<input type="checkbox" class="switch" data-spub' + (s.pub ? ' checked' : '') + ' aria-label="Show ' + N.name + ' on jplundberg.com">' +
          '<button type="button" class="text-btn danger me-soc-del" data-sdel aria-label="Remove"><i class="bi bi-x-lg"></i></button></div>';
      }).join('') +
      (p.socials.length < 10 ? '<button type="button" class="st-row st-btn cs-add" data-sadd><span><i class="bi bi-plus-lg"></i> Add social</span></button>' : '') +
      '</section>';
  }
  /* ---------- editing ---------- */
  var timer = null;
  area.addEventListener('input', function (e) {
    var t = e.target, k = t.dataset.mk;
    if (k) {
      clearTimeout(timer);
      timer = setTimeout(function () { var p = load(); p[k] = t.value.trim().slice(0, k === 'notes' ? 2000 : 120); save(p); renderHead(); }, 350);
    }
    if (t.hasAttribute('data-shandle')) {
      var p2 = load(), id = t.closest('[data-sid]').dataset.sid;
      var link = t.closest('[data-sid]').querySelector('.me-soc-open');
      p2.socials.forEach(function (s) {
        if (s.id !== id) return;
        s.handle = t.value.trim().slice(0, 200);
        var u = socialUrl(s); link.hidden = !u; link.href = u || '#';
      });
      save(p2);
    }
  });
  area.addEventListener('change', function (e) {
    var t = e.target, p = load(), row = t.closest('[data-sid]');
    if (t.dataset.mk) { p[t.dataset.mk] = t.value.trim(); save(p); flash(t); renderHead(); return; }
    if (t.hasAttribute('data-mnorm') && window.Features) {
      var n = parseFloat(t.value.replace(',', '.'));
      if (n > 0 && n < 16) { var tl = window.Features.tools(); tl.flexcfg = tl.flexcfg || {}; tl.flexcfg.norm = n; window.Features.saveTools(tl); flash(t); }
      return;
    }
    if (row) {
      p.socials.forEach(function (s) {
        if (s.id !== row.dataset.sid) return;
        if (t.hasAttribute('data-snet')) s.net = t.value;
        if (t.hasAttribute('data-spub')) s.pub = t.checked;
      });
      save(p);
      if (t.hasAttribute('data-snet')) render();
    }
  });
  area.addEventListener('click', function (e) {
    var p;
    if (e.target.closest('#mePick')) return $('meFile').click();
    if (e.target.closest('#meNoPhoto')) { p = load(); delete p.photo; save(p); render(); renderHead(); return; }
    if (e.target.closest('[data-sadd]')) {
      p = load(); var used = p.socials.map(function (s) { return s.net; });
      p.socials.push({ id: uid(), net: Object.keys(NETS).filter(function (k) { return used.indexOf(k) < 0; })[0] || 'instagram', handle: '', pub: false });
      save(p); render();
      var last = area.querySelectorAll('[data-shandle]'); if (last.length) last[last.length - 1].focus();
      return;
    }
    var del = e.target.closest('[data-sdel]');
    if (del) {
      var id = del.closest('[data-sid]').dataset.sid;
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.innerHTML = 'Remove?'; return; }
      p = load(); p.socials = p.socials.filter(function (s) { return s.id !== id; }); save(p); render();
    }
  });
  /* photo: cropped to a square and made small (about 20 KB) so it syncs quickly */
  area.addEventListener('change', function (e) {
    if (e.target.id !== 'meFile' || !e.target.files[0]) return;
    var img = new Image(), url = URL.createObjectURL(e.target.files[0]);
    img.onload = function () {
      var s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      var p = load(); p.photo = c.toDataURL('image/jpeg', 0.82); save(p); render(); renderHead();
    };
    img.src = url;
  });

  window.addEventListener('st:page', function (e) { if (e.detail === 'profile' || e.detail === 'socials') render(); if (e.detail === 'home') renderHead(); });
  window.addEventListener('profile:change', renderHead);
  if (window.Vault) window.Vault.onUnlock(renderHead);
  renderHead();
})();
} catch (e) { console.error("profile.js", e); }
/* ===== links.js ===== */
try {
/* Connections: when you change something in one place, the places that depend on it follow.
   Runs on every dashboard page, after the vault is unlocked.
   - Subscriptions → Monthly budget: each active subscription is a fixed cost (per month;
     yearly and quarterly ones spread out), monthly ones also get a due day in Upcoming bills
   - Trips → Finances: booking costs and a trip's other costs are spending (Travel), old trips too
   - Trips → Places to visit: a place you've now been to is ticked off as visited
   - Workouts → your training habit: a logged workout ticks the habit that day
   (workouts, courses and health → calendar in features.js) */
(function () {
  "use strict";
  var F = window.Features;
  if (!F || !window.Vault) return;
  var PER_MONTH = { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

  /* ---------- subscriptions → budget fixed costs ---------- */
  function syncSubs() {
    var d = window.Vault.get();
    if (!d) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = F.on('subs') ? F.list('subs').filter(function (s) { return !s.paused && +s.amount > 0; }).map(function (s) {
      var monthly = (s.period || 'monthly') === 'monthly', old = fixed.filter(function (f) { return f.id === 'sub-' + s.id; })[0];
      var day = monthly && /^\d{4}-\d{2}-\d{2}$/.test(s.renews || '') ? +s.renews.slice(8, 10) : null;
      return { id: 'sub-' + s.id, name: s.name + (monthly ? '' : ' (' + (s.period === 'yearly' ? 'yearly' : 'every 3 months') + ')'),
        amount: Math.round((+s.amount) * (PER_MONTH[s.period] || 1)), day: day, src: 'sub' };
    }) : [];
    var mine = fixed.filter(function (f) { return f.src !== 'sub'; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'sub'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = mine.concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }

  /* ---------- savings goals → budget: "set aside every month" becomes a fixed cost ---------- */
  function syncSave() {
    var d = window.Vault.get(), B = window.Budget;
    if (!d || !B || !B.saveMonthly) return;
    d.budget = d.budget || { income: [], fixed: [] };
    var fixed = Array.isArray(d.budget.fixed) ? d.budget.fixed : [];
    var want = (d.savings || []).filter(function (g) { return g.aside; }).map(function (g) {
      return { id: 'save-' + g.id, name: 'Savings: ' + (g.name || 'goal'), amount: B.saveMonthly(g), day: null, src: 'save' };
    }).filter(function (f) { return f.amount > 0; });
    var before = JSON.stringify(fixed.filter(function (f) { return f.src === 'save'; }));
    if (before === JSON.stringify(want)) return;
    d.budget.fixed = fixed.filter(function (f) { return f.src !== 'save'; }).concat(want);
    window.Vault.save(d);
    window.dispatchEvent(new Event('fin:change'));
  }
  window.Links = { syncSave: syncSave };

  /* ---------- trips → places to visit ---------- */
  function near(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return false;
    var dx = (a.lat - b.lat) * 111, dy = (a.lon - b.lon) * 111 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 30;                 // within 30 km counts as the same place
  }
  function syncBucket() {
    if (!window.Flow || !F.on('bucket')) return;
    var today = F.dkey(new Date()), been = window.Flow.travel().trips.filter(function (t) { return t.start && t.start <= today && t.place; });
    if (!been.length) return;
    var t = F.tools(), changed = false;
    (t.bucket || []).forEach(function (b) {
      if (b.visited) return;
      var hit = been.filter(function (tr) {
        return near(tr.place, b.geo) || String(tr.place.name).toLowerCase() === String(b.place).toLowerCase();
      })[0];
      if (hit) { b.visited = true; b.visitedTrip = hit.id; changed = true; }
    });
    if (changed) F.saveTools(t);
  }

  /* ---------- trips → Finances ----------
     Every booking cost and a trip's "other costs" are spending in Finances (category Travel).
     Older trips and bookings made before this was automatic are added too: past ones on
     their own date, upcoming ones today (that's when you paid). Removed in Finances = left out. */
  function num(v) {
    var s = String(v == null ? '' : v).replace(/[\s kr]/gi, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  }
  var syncingTrips = false;
  function syncTrips() {
    var d = window.Vault.get(), Fl = window.Flow;
    if (!d || !Fl || syncingTrips) return;
    d.expenses = Array.isArray(d.expenses) ? d.expenses : [];
    var byId = {}; d.expenses.forEach(function (e) { byId[e.id] = e; });
    var today = F.dkey(new Date()), tr = Fl.travel(), finChanged = false, travelChanged = false;
    function want(owner, idKey, amount, date, note, keepOutKey) {
      var ex = owner[idKey] && byId[owner[idKey]];
      if (owner[idKey] && !ex) { delete owner[idKey]; owner[keepOutKey] = true; travelChanged = true; return; }   // deleted in Finances
      if (!amount) { if (ex) { d.expenses = d.expenses.filter(function (x) { return x !== ex; }); delete owner[idKey]; finChanged = travelChanged = true; } return; }
      if (ex) {
        if (ex.amount !== amount || ex.note !== note) { ex.amount = amount; ex.note = note; finChanged = true; }
        return;
      }
      if (owner[keepOutKey]) return;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      d.expenses.push({ id: id, t: Date.now(), date: date, amount: Math.round(amount * 100) / 100, cat: 'travel', note: note, src: 'trip' });
      owner[idKey] = id; finChanged = travelChanged = true;
    }
    tr.trips.forEach(function (t) {
      var name = t.name || t.dest || 'Trip', past = (t.end || t.start || today) < today;
      (t.items || []).forEach(function (it) {
        var label = it.title || ({ flight: 'Flight', train: 'Train', bus: 'Bus', boat: 'Boat', car: 'Car', hotel: 'Hotel', activity: 'Activity' }[it.type] || 'Booking');
        want(it, 'spendId', num(it.cost), past && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : today, (name + ': ' + label).slice(0, 80), 'noFin');
      });
      want(t, 'spentId', num(t.spent), past ? (t.start || today) : today, (name + ': other costs').slice(0, 80), 'noFinSpent');
    });
    if (!finChanged && !travelChanged) return;
    syncingTrips = true;
    try {
      if (finChanged) { window.Vault.save(d); window.dispatchEvent(new Event('fin:change')); }
      if (travelChanged) Fl.saveTravel(tr);
    } finally { syncingTrips = false; }
  }

  /* ---------- workouts → the training habit ----------
     A logged workout ticks its habit that day (the one picked when logging, else your
     training/gym habit). Only adds ticks – ticking a day by hand still works as before. */
  function syncWorkouts() {
    if (!F.on('training')) return;
    var hb = null; try { hb = JSON.parse(localStorage.getItem('dash.habits')); } catch (e) {}
    if (!hb || !Array.isArray(hb.list) || !hb.list.length) return;
    var def = hb.list.filter(function (h) { return /train|trening|gym|workout|løp|run|exercise|økt/i.test(h.name); })[0];
    var ids = {}; hb.list.forEach(function (h) { ids[h.id] = 1; });
    hb.log = hb.log || {};
    var changed = false;
    F.list('training').forEach(function (w) {
      var hid = w.habit === '' ? null : (w.habit && ids[w.habit] ? w.habit : def && def.id);
      if (!hid || !/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) return;
      var day = hb.log[w.date] = hb.log[w.date] || [];
      if (day.indexOf(hid) < 0) { day.push(hid); changed = true; }
    });
    if (!changed) return;
    try { localStorage.setItem('dash.habits', JSON.stringify(hb)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));
    window.dispatchEvent(new Event('habits:change'));
    if (window.Dash && window.Dash.reload) window.Dash.reload();
  }

  function run() {
    try { syncWorkouts(); } catch (e) { console.error(e); }
    try { syncSubs(); } catch (e) { console.error(e); }
    try { syncSave(); } catch (e) { console.error(e); }
    try { syncTrips(); } catch (e) { console.error(e); }
    try { syncBucket(); } catch (e) { console.error(e); }
  }
  window.Vault.onUnlock(function () { setTimeout(run, 0); });
  window.addEventListener('tools:change', function () { if (window.Vault.get()) { syncSubs(); syncWorkouts(); } });
  window.addEventListener('features:change', function () { if (window.Vault.get()) run(); });
  window.addEventListener('travel:change', function () { if (window.Vault.get()) { syncTrips(); syncBucket(); } });
})();
} catch (e) { console.error("links.js", e); }
/* ===== tidy.js ===== */
try {
/* Empty cards fold down to one line (the heading plus a short hint) until they have something
   in them, so the dashboard stays short. Tap the heading to open one anyway. */
(function () {
  "use strict";
  var dash = document.getElementById('dash');
  if (!dash) return;
  /* card → is it empty? */
  var CHECK = {
    todo: function (c) { return !c.querySelector('#todoList li'); },
    notes: function (c) { return !c.querySelector('#noteList li'); },
    goals: function (c) { return !c.querySelector('#goalList li') && c.querySelector('#goalForm').hidden; },
    links: function (c) { return !c.querySelector('#linkGrid li'); },
    savings: function (c) { return !c.querySelector('#svList li') && c.querySelector('#svForm').hidden; },
    networth: function (c) { return !c.querySelector('#nwList li') && c.querySelector('#nwForm').hidden; },
    bills: function (c) { return !c.querySelector('#billsBody li'); }
  };
  var HINT = {
    todo: 'Nothing to do', notes: 'No notes', goals: 'No goals yet', links: 'No links yet',
    savings: 'No savings goals', networth: 'No accounts yet', bills: 'No fixed costs with a due date'
  };
  var opened = {};
  function pass() {
    Object.keys(CHECK).forEach(function (id) {
      var c = document.querySelector('.card.' + id);
      if (!c) return;
      var empty = false;
      try { empty = CHECK[id](c); } catch (e) {}
      var fold = empty && !opened[id];
      if (c.classList.contains('card-folded') === fold) return;
      c.classList.toggle('card-folded', fold);
      var h = c.querySelector('.card-head');
      if (!h) return;
      var hint = h.querySelector('.fold-hint');
      if (fold) {
        if (!hint) { hint = document.createElement('button'); hint.type = 'button'; hint.className = 'fold-hint'; h.appendChild(hint); }
        hint.innerHTML = '<span>' + HINT[id] + '</span><i class="bi bi-plus-lg"></i>';
      } else if (hint) hint.remove();
    });
  }
  document.addEventListener('click', function (e) {
    var h = e.target.closest('.card-folded .card-head');
    if (!h || e.target.closest('a, [data-review], [data-quick]')) return;
    var c = h.closest('.card'), id = Object.keys(CHECK).filter(function (k) { return c.classList.contains(k); })[0];
    if (!id) return;
    opened[id] = true; pass();
    var f = c.querySelector('input:not([type=hidden]), textarea, button.text-btn');
    if (id === 'goals') { var b = c.querySelector('#goalAddBtn'); if (b) b.click(); }
    else if (id === 'savings') { var sb = c.querySelector('#svAddBtn'); if (sb) sb.click(); }
    else if (id === 'networth') { var nb = c.querySelector('#nwAddBtn'); if (nb) nb.click(); }
    else if (f && matchMedia('(hover: hover)').matches) f.focus();
  });
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(pass, 60); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  if (window.Vault) { window.Vault.onUnlock(function () { opened = {}; setTimeout(pass, 100); }); }
  setTimeout(pass, 0);
})();
} catch (e) { console.error("tidy.js", e); }
