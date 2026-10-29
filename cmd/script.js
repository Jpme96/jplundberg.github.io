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
