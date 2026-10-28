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
    ['weather', 'Weather'], ['calendar', 'Calendar'], ['transit', 'Travel & departures'], ['habits', 'Training & habits'],
    ['todo', 'To-do'], ['goals', 'Goals'], ['links', 'Quick links'], ['notes', 'Notes'],
    ['bills', 'Upcoming bills'], ['fin', 'Finances']
  ];
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
  var DEFAULTS = { theme: 'dark', accent: 'teal', bgType: 'moon', bgStrength: null, name: 'Lundberg', seconds: true, quotes: true, hide: {}, lockMins: 60 };

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

  function apply() {
    var s = get();
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
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f3f5' : '#0e0f11');
    CARDS.forEach(function (c) { root.classList.toggle('hide-' + c[0], !!s.hide[c[0]]); });
    /* Hide a section heading when every card in it is hidden */
    document.querySelectorAll('.dash-sec').forEach(function (sec) {
      var cards = sec.querySelectorAll('.card');
      sec.hidden = cards.length > 0 && Array.prototype.every.call(cards, function (c) {
        return CARDS.some(function (k) { return s.hide[k[0]] && c.classList.contains(k[0]); });
      });
    });
    if ($('settings') && !$('settings').hidden) fill();
  }
  if (media && media.addEventListener) media.addEventListener('change', apply);

  /* ---------- panel ---------- */
  function fill() {
    var s = get();
    document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeOpt === s.theme));
    });
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
    var cs = getComputedStyle(document.querySelector('.bg'));
    $('stStrength').value = s.bgStrength || Math.round(parseFloat(cs.opacity) * 100) || 30;
    if (document.activeElement !== $('stName')) $('stName').value = s.name;
    $('stSeconds').checked = !!s.seconds;
    $('stQuotes').checked = !!s.quotes;
    $('stCards').innerHTML = CARDS.map(function (c) {
      return '<label class="st-row"><span>' + c[1] + '</span><input type="checkbox" class="switch" data-card="' + c[0] + '"' +
        (s.hide[c[0]] ? '' : ' checked') + '></label>';
    }).join('');
    $('stLock').value = String(s.lockMins);
    var sync = $('syncState');
    $('stSync').innerHTML = sync ? sync.innerHTML : '';

    /* One-line summaries on the main menu */
    var a = accentOf(s);
    var bgName = (BGS.filter(function (b) { return b[0] === s.bgType; })[0] || BGS[0])[1];
    $('sumAppearance').textContent = { dark: 'Dark', light: 'Light', auto: 'Auto' }[s.theme] + ' · ' + a.name + ' · ' + bgName;
    var shown = CARDS.filter(function (c) { return !s.hide[c[0]]; }).length;
    $('sumDashboard').textContent = shown + ' of ' + CARDS.length + ' cards' + (s.name ? ' · ' + s.name : '');
    var m = +s.lockMins;
    $('sumSecurity').textContent = 'Locks after ' + (m >= 1440 ? '1 day' : m >= 60 ? (m / 60) + ' hour' + (m > 60 ? 's' : '') : m + ' min');
    var st = sync ? sync.className : '';
    $('sumData').textContent = /sync-ok/.test(st) ? 'Synced' : /sync-busy/.test(st) ? 'Syncing…' : /offline/.test(st) ? 'Offline' : 'This device only';
  }

  /* ---------- pages (like iPhone Settings) ---------- */
  var page = 'home';
  function go(name, back) {
    page = name;
    document.querySelectorAll('.st-page').forEach(function (el) {
      var on = el.dataset.page === name;
      el.hidden = !on;
      el.classList.remove('in-fwd', 'in-back');
      if (on) { void el.offsetWidth; el.classList.add(back ? 'in-back' : 'in-fwd'); }
    });
    var cur = document.querySelector('.st-page[data-page="' + name + '"]');
    $('stTitle').innerHTML = name === 'home' ? 'Settings' : cur.dataset.title;
    $('stBack').hidden = name === 'home';
    $('stMsg').textContent = '';
    $('pcForm').hidden = true;
    document.querySelector('.st-panel').scrollTop = 0;
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
    document.body.classList.remove('st-open');
    $('pcForm').hidden = true;
    $('stMsg').textContent = '';
    setTimeout(function () { if (!el.classList.contains('open')) el.hidden = true; }, 320);
  }

  $('settingsBtn').addEventListener('click', openPanel);
  $('stClose').addEventListener('click', closePanel);
  $('settings').addEventListener('click', function (e) { if (e.target === this) closePanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('settings').hidden) { if (page !== 'home') { fill(); go('home', true); } else closePanel(); } });

  document.querySelectorAll('[data-theme-opt]').forEach(function (b) {
    b.addEventListener('click', function () { set({ theme: b.dataset.themeOpt }); });
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
  $('stName').addEventListener('change', function () { set({ name: this.value.trim() }); });
  $('stSeconds').addEventListener('change', function () { set({ seconds: this.checked }); });
  $('stQuotes').addEventListener('change', function () { set({ quotes: this.checked }); });
  $('stCards').addEventListener('change', function (e) {
    var c = e.target.dataset.card;
    if (!c) return;
    var hide = get().hide;
    hide[c] = !e.target.checked;
    set({ hide: hide });
  });
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
  $('stBackup').addEventListener('click', function () {
    window.Vault.backup().then(function () {
      stMsg('Backup downloaded. It’s encrypted, so only your passcode can open it.', true);
    });
  });

  window.addEventListener('dash:local', function () { setTimeout(apply, 0); });
  if (window.Vault) window.Vault.onLock(closePanel);

  window.DashSettings = { get: get, set: set, apply: apply };
  apply();
  loadCustom();
})();
