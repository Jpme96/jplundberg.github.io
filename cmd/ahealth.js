/* Apple Health: steps, sleep, resting heart rate, exercise and weight from your iPhone.

   An iPhone Shortcut sends the day's numbers to your server (/cmd/api/health, with an Access
   service token that can do nothing else). The next time the dashboard opens it takes them,
   puts them in your encrypted vault (d.health.days) and deletes them from the server.
   A link works too: /cmd/?health=1&date=2026-10-28&steps=8234&sleep=7.2 …

   Connected to: Health page (card + habit ticks), At a glance (short nights), the weekly
   check-in, the monthly review, search. Switch on/off in Settings → Features → Apple Health. */
(function () {
  "use strict";
  if (!window.Vault) return;
  var $ = function (id) { return document.getElementById(id); };
  var Fe = window.Features;
  var API = '/cmd/api/health';
  var F = ['steps', 'sleep', 'exercise', 'active', 'stand', 'distance', 'flights', 'hr', 'rhr', 'hrv', 'vo2', 'weight', 'mindful', 'water', 'daylight'];
  var LABEL = { steps: 'Steps', sleep: 'Sleep', rhr: 'Resting heart rate', active: 'Active energy', exercise: 'Exercise', weight: 'Weight', distance: 'Walking + running', flights: 'Flights climbed',
    hr: 'Heart rate', stand: 'Stand hours', hrv: 'Heart rate variability', vo2: 'Cardio fitness', mindful: 'Mindfulness', water: 'Water', daylight: 'Time in daylight' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(k, n) { var d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return dkey(d); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  var nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; }
  /* sleep can arrive as hours, minutes or seconds – whatever the Shortcut produced */
  function hours(v) { v = num(v); if (v == null) return null; return v > 1440 ? v / 3600 : v > 24 ? v / 60 : v; }
  /* units differ between iPhones – metres or km, ml or litres */
  function norm(f, v) { if (v == null) return v; if (f === 'distance' && v > 300) return v / 1000; if (f === 'water' && v > 20) return v / 1000; return v; }
  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
  function fmt(f, v) {
    if (v == null) return '–';
    if (f === 'sleep') return hm(v);
    if (f === 'rhr' || f === 'hr') return Math.round(v) + ' bpm';
    if (f === 'active') return nf.format(v) + ' kcal';
    if (f === 'exercise') return Math.round(v) + ' min';
    if (f === 'weight') return nf1.format(v) + ' kg';
    if (f === 'distance') return nf1.format(v) + ' km';
    if (f === 'stand') return Math.round(v) + (STANDMIN ? ' min' : ' h');   /* some Shortcuts send stand minutes, not stand hours */
    if (f === 'hrv') return Math.round(v) + ' ms';
    if (f === 'vo2') return nf1.format(v);
    if (f === 'mindful' || f === 'daylight') return Math.round(v) + ' min';
    if (f === 'water') return nf1.format(v) + ' l';
    if (f === 'flights') return Math.round(v) + ' floors';
    return nf.format(v);
  }

  /* 0 h sleep, 0 bpm or 0 kg means the Shortcut found nothing – treat it as no number, not a real one */
  var STANDMIN = false;
  var ZERO_IS_EMPTY = { sleep: 1, hr: 1, rhr: 1, weight: 1, hrv: 1, vo2: 1 };
  function days() {
    var d = window.Vault.get() || {}, D = (d.health && d.health.days) || {}, out = {};
    Object.keys(D).forEach(function (k) { var x = {}; Object.keys(D[k]).forEach(function (f) { if (!(ZERO_IS_EMPTY[f] && D[k][f] === 0)) x[f] = D[k][f]; }); out[k] = x; });
    STANDMIN = Object.keys(out).some(function (k) { return out[k].stand > 24; });   /* more than 24 in a day can only be minutes (JP's showed 26 h, 59 h on average – 2026-11-15) */
    return out;
  }
  /* put days in the vault, tick habits that follow a number, tell the rest of the dashboard */
  function merge(list, source) {
    var d = window.Vault.get(); if (!d || !list.length) return 0;
    d.health = d.health || {}; d.health.days = d.health.days || {};
    /* the inbox keeps every sending (an early one with fewer steps, then the full day), so a day can change and change
       back while going through it – only days that really end up different count (and show the "Apple Health" note) */
    var before = {}, touched = {}, sig = function (o) { var c = {}; F.forEach(function (f) { if (o && o[f] != null) c[f] = o[f]; }); return JSON.stringify(c); };
    list.forEach(function (x) {
      var k = /^\d{4}-\d{2}-\d{2}/.test(String(x.date || '')) ? String(x.date).slice(0, 10) : dkey(new Date());
      if (!(k in before)) before[k] = sig(d.health.days[k]);
      var cur = d.health.days[k] || {};
      F.forEach(function (f) { var v = f === 'sleep' ? hours(x[f]) : norm(f, num(x[f])); if (v === 0 && ZERO_IS_EMPTY[f]) v = null; if (v != null) { v = Math.round(v * 100) / 100; if (cur[f] !== v) cur[f] = v; } });
      d.health.days[k] = cur; touched[k] = 1;
    });
    var n = 0;
    Object.keys(touched).forEach(function (k) { if (sig(d.health.days[k]) !== before[k]) { d.health.days[k].t = Date.now(); n++; } else if (before[k] === '{}') delete d.health.days[k]; });
    if (!n) return 0;                                                  // nothing new: no save, no toast
    var keys = Object.keys(d.health.days).sort(); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete d.health.days[k]; });
    d.health.last = Date.now();
    window.Vault.save(d);
    if (Fe && !Fe.on('ahealth')) Fe.set('ahealth', true);          // first numbers: show the card
    tickHabits();
    window.dispatchEvent(new Event('health:change'));
    /* no note on screen: new numbers simply show up on the Health card */
    return n;
  }
  /* habits can follow a number: "Exercise ≥ 30 min" ticks Training that day */
  function tickHabits() {
    var hb = readJSON('dash.habits', null); if (!hb || !hb.list) return;
    var D = days(), ch = false; hb.log = hb.log || {};
    hb.list.forEach(function (h) {
      if (!h.auto || !h.auto.m || !(+h.auto.min > 0)) return;
      Object.keys(D).forEach(function (k) {
        var v = D[k][h.auto.m]; if (v == null || v < +h.auto.min) return;
        var l = hb.log[k] = hb.log[k] || [];
        if (l.indexOf(h.id) < 0) { l.push(h.id); ch = true; }
      });
    });
    if (ch) { writeJSON('dash.habits', hb); window.dispatchEvent(new Event('habits:change')); if (window.Dash && window.Dash.reload) window.Dash.reload(); }
  }

  /* ---------- picking up what the Shortcut sent ---------- */
  /* a failed fetch is tried again (5 s, 20 s, 1 min); after that one calm message with Try again.
     Nothing is lost while it waits: the server keeps every sending until it's picked up. */
  var pulling = false;
  function pull(manual) {
    if (!window.Vault.get() || pulling) return;
    pulling = true;
    var D = window.Diag, once = function () {
      return fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
        if (r.status === 404 || r.status === 403) return null;          // no inbox / the Worker doesn't know it: not an outage
        if (!r.ok) throw new Error('health ' + r.status);
        return r.json();
      });
    };
    (D ? D.retry(once, { waits: [5000, 20000, 60000], stop: function () { return navigator.onLine === false; } }) : once()).then(function (j) {
      pulling = false;
      if (D) { D.mark('healthPull'); D.hide('health'); }
      if (!j || !j.items || !j.items.length) return;
      /* remember the newest sending, so Settings can show exactly what the iPhone sent */
      var li = j.items[j.items.length - 1];
      if (li && JSON.stringify(li) !== JSON.stringify(lastIn())) { writeJSON('dash.health.lastIn', li); if (typeof settingsPage === 'function') try { settingsPage(); } catch (e) {} card(); }
      /* the inbox is kept on the server (last 120 sendings), so every device – and a device that
         was locked before its save reached the server – picks up every day; numbers only change
         when they're new, so taking them again does nothing */
      merge(j.items, 'server');
    }, function (e) {
      pulling = false;
      if (!D) return;
      D.mark('healthFail'); D.log('health', (e && e.message) || 'fetch failed', 'ahealth.js');
      if (navigator.onLine === false || !(Fe && Fe.on('ahealth'))) return;   // offline: sync's message covers it
      var nbl = window.I18N && window.I18N.lang === 'nb';
      D.notice('health', nbl ? 'Fikk ikke hentet tallene fra Apple Helse. De ligger trygt på serveren til neste gang.' : 'Couldn’t fetch your Apple Health numbers. They wait safely on your server until next time.', nbl ? 'Prøv igjen' : 'Try again', function () { pull(true); }, 'heart-pulse');
    });
  }
  /* …or a link: ?health=1&steps=…&sleep=… */
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has('health')) return;
    var x = { date: q.get('date') || '' };
    F.forEach(function (f) { if (q.has(f)) x[f] = q.get(f); });
    ['health', 'date'].concat(F).forEach(function (f) { q.delete(f); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    var pend = readJSON('dash.healthPending', []); pend.push(x); try { localStorage.setItem('dash.healthPending', JSON.stringify(pend.slice(-30))); } catch (e) {}
  })();
  function pending() {
    var p = readJSON('dash.healthPending', []);
    if (!p.length) return;
    try { localStorage.removeItem('dash.healthPending'); } catch (e) {}
    merge(p, 'link');
  }
  /* days that went missing (two devices saving at once, before the merge got smarter): look in the
     server's daily snapshots of the last two weeks and take back any day this copy doesn't have. Once a day. */
  function recover() {
    var tk = dkey(new Date()); if (localStorage.getItem('dash.healthRecover') === tk || !window.Vault.peek) return;
    fetch('/cmd/api/vault?snaps=1', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j) try { localStorage.setItem('dash.healthRecover', tk); } catch (e) {}     // done for today only once the server answered
      var list = ((j && (j.snaps || j.items || j)) || []); if (!Array.isArray(list)) return;
      var dates = list.map(function (x) { return typeof x === 'string' ? x : x.date; }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x || ''); }).sort().reverse().slice(0, 14);
      return dates.reduce(function (p, dt) {
        return p.then(function (found) {
          return fetch('/cmd/api/vault?snap=' + dt, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
            .then(function (v) { return v ? window.Vault.peek(v) : null; }).then(function (obj) {
              var hd = obj && obj.health && obj.health.days; if (!hd) return found;
              var cur = (window.Vault.get().health || {}).days || {};
              Object.keys(hd).forEach(function (k) { if (!cur[k] && !found[k]) found[k] = Object.assign({ date: k }, hd[k]); });
              return found;
            }).catch(function () { return found; });
        });
      }, Promise.resolve({})).then(function (found) {
        var l = Object.keys(found).map(function (k) { return found[k]; });
        if (l.length) merge(l, 'snapshot');
      });
    }).catch(function () {});
  }
  window.Vault.onUnlock(function () { setTimeout(function () { pending(); pull(); }, 600); setTimeout(recover, 5000); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && window.Vault.get()) pull(); });

  /* ---------- summaries other parts use ---------- */
  function stats(from, to) {
    var D = days(), out = { n: 0 };
    F.forEach(function (f) { out[f] = { sum: 0, n: 0 }; });
    Object.keys(D).forEach(function (k) {
      if (k < from || k > to) return; out.n++;
      F.forEach(function (f) { if (D[k][f] != null) { out[f].sum += D[k][f]; out[f].n++; } });
    });
    F.forEach(function (f) { out[f].avg = out[f].n ? out[f].sum / out[f].n : null; });
    return out;
  }
  /* last night's sleep: a Shortcut run before the night is fully recorded (or mid-day) can send only a
     part of it – under 3 h today, while yesterday had a real night, counts as a partial and is not trusted */
  function lastNight() {
    var D = days(), n = new Date(), p2 = function (x) { return String(x).padStart(2, '0'); }, k = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
    var td = k(n), yd = k(new Date(n.getTime() - 864e5)), t = D[td] && D[td].sleep, y = D[yd] && D[yd].sleep;
    t = t > 0 ? +t : null; y = y > 0 ? +y : null;
    if (t != null && (t >= 3 || y == null)) return { date: td, v: t, partial: t < 3 && n.getHours() < 20 };
    if (t != null) return { date: t > y ? td : yd, v: Math.max(t, y), partial: false, skipped: t };
    if (y != null) return { date: yd, v: y, partial: false };
    return null;
  }
  function latest(f) { var D = days(), ks = Object.keys(D).sort().reverse(); for (var i = 0; i < ks.length; i++) if (D[ks[i]][f] != null) return { date: ks[i], v: D[ks[i]][f] }; return null; }

  /* ---------- the card on the Health page ---------- */
  function card() { if (window.__ahCard) window.__ahCard(); }   /* the Habits page's card lives in ahealth.page.js (2026-11-21: lighter pages) */
  /* ---------- what the last sending had: the answer to "sleep didn't come through" ---------- */
  function lastIn() { return readJSON('dash.health.lastIn', null); }
  function sleepCheck(li) {
    if (!li) return null;
    var has = Object.prototype.hasOwnProperty.call(li, 'sleep'), h = has ? hours(li.sleep) : null;
    if (!has) return { bad: true, title: 'The last sending had no sleep number', fix: 'Shortcuts leaves a field out when its value is empty. Check that <b>Get Contents of URL</b> has a field <b>sleep</b> linked to the sleep step’s sum (tap it → Reveal Action). If it is, the sum comes out empty: summing “Duration” fails on some iPhones – time each sample instead (Repeat with Each → Get Minutes between Start Date and End Date → Calculate Statistics Sum), as in the set-up steps below.' };
    if (!h) return { bad: true, title: 'Sleep came as 0', fix: 'The sleep step found nothing. Open Health → Sleep → <b>Show More Sleep Data</b>: if you only see <b>In Bed</b> (no Core, Deep or REM), remove the “Value is not …” filters and use one filter, <b>Value is In Bed</b>. If you see Core/Deep/REM, keep <b>Value is not Asleep</b>, <b>is not Awake</b> <span data-t="ui.and">and</span> <b>is not In Bed</b>.' };
    if (h > 14) return { bad: true, title: 'Sleep came as ' + fmt('sleep', h) + ' – too much', fix: 'In Bed is counted on top of Core, Deep and REM. In the sleep step add the filter <b>Value is not In Bed</b>.' };
    if (h < 2) return { bad: true, title: 'Sleep came as only ' + fmt('sleep', h), fix: 'Only part of the night was found. In the sleep step switch <b>Limit</b> off, and let the automation run in the evening (a morning run can miss the end of the night).' };
    return { bad: false, title: 'Sleep ' + fmt('sleep', h) };
  }
  function lastInHtml() {
    var li = lastIn(); if (!li) return '';
    var when = li.t ? new Date(li.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    var got = Object.keys(li).filter(function (f) { return f !== 't' && f !== 'date'; }).map(function (f) { return '<code>' + esc(f) + '</code> ' + esc(f === 'sleep' ? li[f] + (hours(li[f]) ? ' → ' + fmt('sleep', hours(li[f])) : '') : li[f]); }).join(' · ');
    var sc = sleepCheck(li);
    return '<div class="st-row ah-last"><span class="st-label">' + I18N.k('ui.ah-last-send', 'Last sending from your iPhone') + '<small>' + esc(when) + (li.date ? ' · ' + I18N.k('ui.ah-for', 'for') + ' ' + esc(li.date) : '') + '</small><small class="ah-got">' + (got || I18N.k('ui.ah-no-numbers', 'No numbers')) + '</small>' +
      (sc ? '<small class="' + (sc.bad ? 'ah-bad' : 'ah-good') + '"><i class="bi bi-' + (sc.bad ? 'exclamation-triangle' : 'check-circle') + '"></i> ' + esc(sc.title) + (sc.fix ? '</small><small class="ah-fix">' + sc.fix : '') + '</small>' : '') + '</span></div>';
  }

  /* the set-up steps (one place for every page; JP 2026-11-16: they were English in Norwegian). In Norwegian the Shortcut
     actions are named the way a Norwegian iPhone shows them; Cloudflare's menus are English on every phone. */
  function setupHtml() {
    var nb = I18N.lang === 'nb', T = function (en, no) { return nb ? no : en; }, b = function (s) { return '<b>' + s + '</b>'; }, c = function (s) { return '<code>' + s + '</code>'; };
    var keys = [['exercise', T('Exercise Minutes · Sum', 'Treningsminutter · Sum')], ['active', T('Active Energy · Sum', 'Aktiv energi · Sum')], ['stand', T('Stand Minutes · Sum', 'Ståminutter · Sum')],
      ['distance', T('Walking + Running Distance · Sum', 'Gå- og løpedistanse · Sum')], ['flights', T('Flights Climbed · Sum', 'Etasjer gått · Sum')], ['daylight', T('Time in Daylight · Sum', 'Tid i dagslys · Sum')],
      ['hr', T('Heart Rate · Average, today', 'Puls · Gjennomsnitt, i dag')], ['rhr', T('Resting Heart Rate · Average', 'Hvilepuls · Gjennomsnitt')], ['hrv', T('Heart Rate Variability · Average', 'Pulsvariasjon · Gjennomsnitt')],
      ['vo2', T('Cardio Fitness (VO₂ max) · Average, last 30 days', 'Kondisjon (VO₂-maks) · Gjennomsnitt, siste 30 dager')], ['weight', T('Weight · Average, last 30 days', 'Vekt · Gjennomsnitt, siste 30 dager')],
      ['mindful', T('Mindful Minutes · Sum', 'Mindfulness-minutter · Sum')], ['water', T('Water · Sum', 'Vann · Sum')]];
    var FHS = b(T('Find Health Samples', 'Finn helseprøver')), CS = b(T('Calculate Statistics', 'Beregn statistikk'));
    return '<p class="st-sub"><i class="bi bi-1-circle"></i> ' + T('Once, in Cloudflare (3 minutes)', 'Én gang, i Cloudflare (3 minutter)') + '</p><section class="st-group sc-steps"><ol>' +
      '<li>' + T('Paste the newest ', 'Lim inn nyeste ') + c('worker.js') + T(' into the Worker, if you haven’t.', ' i Workeren, hvis du ikke har gjort det.') + '</li>' +
      '<li>Zero Trust → ' + b('Access → Service auth → Create service token') + T('. Name: ', '. Navn: ') + '<i>iPhone Shortcut</i>' + T(', duration: non-expiring. Copy the ', ', varighet: utløper ikke. Kopier ') + b('Client ID') + T(' and ', ' og ') + b('Client Secret') + T(' straight into the Shortcut below – nowhere else.', ' rett inn i snarveien under – ikke noe annet sted.') + '</li>' +
      '<li>' + b('Access → Applications') + T(' → your dashboard → ', ' → dashbordet ditt → ') + b('Policies → Add a policy') + T('. Action: ', '. Action: ') + b('Service Auth') + T('. Include: ', '. Include: ') + b('Service Token') + ' → <i>iPhone Shortcut</i>' + T('. Save.', '. Lagre.') + '</li>' +
      '</ol><p class="muted">' + T('The token can only hand in health numbers – it can’t read or change anything else.', 'Tokenet kan bare levere helsetall – det kan ikke lese eller endre noe annet.') + '</p></section>' +
      '<p class="st-sub"><i class="bi bi-2-circle"></i> ' + T('On your iPhone (5 minutes)', 'På iPhonen (5 minutter)') + '</p><section class="st-group sc-steps"><ol>' +
      '<li>' + T('Shortcuts → ', 'Snarveier → ') + b('+') + T(', name it ', ', kall den ') + '<i>' + T('Health to dashboard', 'Helse til dashbord') + '</i>.</li>' +
      '<li>' + FHS + T(' – Type: Steps, Start Date: is today. Then ', ' – Type: Skritt, Startdato: er i dag. Deretter ') + CS + ' → Sum.</li>' +
      '<li>' + b(T('Sleep', 'Søvn')) + T(' (summing “Duration” doesn’t work on every iPhone, so each piece of the night is timed from its start to its end):', ' (å summere «Varighet» virker ikke på alle iPhoner, så hver bit av natten tas fra start til slutt):') + '<ol type="a">' +
        '<li>' + b(T('Adjust Date', 'Juster dato')) + T(': Subtract ', ': Trekk fra ') + b(T('24 hours', '24 timer')) + T(' from ', ' fra ') + b(T('Current Date', 'Gjeldende dato')) + '.</li>' +
        '<li>' + FHS + T(' – Type: Sleep, Start Date: is in the last 1 day, ', ' – Type: Søvn, Startdato: er i løpet av siste 1 dag, ') + b(T('Value is not Awake', 'Verdi er ikke Våken')) + ', ' + b(T('is not In Bed', 'er ikke I seng')) + ', ' + b(T('is not Asleep', 'er ikke Sover')) +
          T(' (keeps the Watch’s Core, Deep and REM, so nothing is counted twice). Limit off. No Watch – only In Bed in the Health app? Use one filter instead: ', ' (beholder klokkas kjerne-, dyp- og REM-søvn, så ingenting telles to ganger). Grense av. Ingen klokke – bare I seng i Helse-appen? Bruk ett filter i stedet: ') + b(T('Value is In Bed', 'Verdi er I seng')) + '.</li>' +
        '<li>' + b(T('Repeat with Each', 'Gjenta med hver')) + T(' item in Health Samples → ', ' i Helseprøver → ') + b(T('If', 'Hvis')) + T(' Repeat Item’s Start Date ', ' Gjenta-objektets startdato ') + b(T('is after', 'er etter')) + T(' Adjusted Date → ', ' Justert dato → ') + b(T('Get Minutes between', 'Hent minutter mellom')) +
          T(' Repeat Item’s Start Date and End Date → ', ' Gjenta-objektets startdato og sluttdato → ') + b(T('Otherwise', 'Ellers')) + ' → ' + b(T('Number', 'Tall')) + T(' 0 → End If → End Repeat.', ' 0 → Slutt hvis → Slutt gjenta.') + '</li>' +
        '<li>' + CS + T(' → Sum of Repeat Results, renamed ', ' → Sum av Gjenta-resultater, kalt ') + '<i>' + T('Sleep sum', 'Søvnsum') + '</i>' + T('. That’s minutes – the dashboard turns it into hours.', '. Det er minutter – dashbordet gjør det om til timer.') + '</li></ol></li>' +
      '<li>' + b(T('Get Contents of URL', 'Hent innhold i URL')) + ': <span class="sc-url" id="ahUrl">' + esc(location.origin + API) + '</span> <button type="button" class="text-btn" id="ahCopy"><i class="bi bi-copy"></i> ' + T('Copy', 'Kopier') + '</button><br>' +
        T('Method ', 'Metode ') + b('POST') + T('. Headers: ', '. Overskrifter: ') + c('CF-Access-Client-Id') + T(' and ', ' og ') + c('CF-Access-Client-Secret') + T(' with your two values. Request Body: ', ' med de to verdiene dine. Forespørselsinnhold: ') + b('JSON') + ' → ' + b(T('Number', 'Tall')) +
        T(' fields ', '-felt ') + c('steps') + T(' and ', ' og ') + c('sleep') + T(', each set with ', ', hver satt med ') + b(T('Select Variable', 'Velg variabel')) + T(' → the blue ', ' → den blå ') + b('Sum') + T(' under its own Calculate action. No date needed – today’s is used.', ' under sin egen Beregn-handling. Ingen dato trengs – dagens brukes.') + '</li>' +
      '<li>' + b(T('More numbers', 'Flere tall')) + T(' (optional): one ', ' (valgfritt): én ') + FHS + T(' (Start Date is today) + one ', ' (Startdato er i dag) + én ') + CS + T(' each, and a Number field with this name. Each gets its own tile, chart and goal.', ' hver, og et Tall-felt med dette navnet. Hvert får sin egen flis, graf og mål.') +
        '<div class="ah-keys">' + keys.map(function (x) { return '<span>' + c(x[0]) + ' ' + esc(x[1]) + '</span>'; }).join('') + '</div></li>' +
      '<li>' + T('Run it once. Open the dashboard – a note says what arrived.', 'Kjør den én gang. Åpne dashbordet – en melding sier hva som kom.') + '</li>' +
      '<li>' + T('Shortcuts → ', 'Snarveier → ') + b(T('Automation → +', 'Automatisering → +')) + T(' → Time of Day, 22:30, Daily → ', ' → Tidspunkt, 22:30, Daglig → ') + b(T('Run Immediately', 'Kjør umiddelbart')) + T(' → Health to dashboard.', ' → Helse til dashbord.') + '</li>' +
      '</ol><p class="muted">' + T('Sleep can come as hours, minutes or seconds – the dashboard works it out. Missing numbers are simply left out.', 'Søvn kan komme som timer, minutter eller sekunder – dashbordet finner ut av det. Tall som mangler, blir bare utelatt.') + '</p></section>';
  }
  /* ---------- Settings → Apple Health ---------- */
  function settingsPage() {
    var box = $('ahSet'); if (!box) return;
    var sb = $('ahSetupBody'); if (sb && sb.dataset.lang !== I18N.lang) { sb.innerHTML = setupHtml(); sb.dataset.lang = I18N.lang; }
    if ($('ahUrl')) $('ahUrl').textContent = location.origin + API;
    var hb = readJSON('dash.habits', { list: [] }), D = days(), n = Object.keys(D).length;
    $('ahStatus').textContent = n ? n + ' day' + (n === 1 ? '' : 's') + ' from Apple Health · last ' + new Date(((window.Vault.get() || {}).health || {}).last || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Nothing received yet';
    $('ahOn').checked = Fe ? Fe.on('ahealth') : true;
    var lg = $('ahLast'); if (!lg) { lg = document.createElement('section'); lg.className = 'st-group'; lg.id = 'ahLast'; var g0 = $('ahOn').closest('.st-group'); g0.parentNode.insertBefore(lg, g0.nextSibling); }
    var lh = lastInHtml(); lg.hidden = !lh; if (lg.innerHTML !== lh) lg.innerHTML = lh;
    if ($('ahSetup') && !settingsPage.done) { $('ahSetup').open = !n; settingsPage.done = true; }   // set-up open until numbers arrive
    $('ahHabits').innerHTML = (hb.list || []).length ? hb.list.map(function (h) {
      var a = h.auto || {};
      return '<div class="st-row ah-rule"><span class="st-label">' + esc(h.name) + '<small data-t="ui.tick-it-automatically-when">Tick it automatically when…</small></span><span class="ah-rule-in">' +
        '<select data-ahrule="' + esc(h.id) + '" aria-label="' + esc(I18N.k('ui.number-for', 'Number for {n}', { n: h.name })) + '"><option value="" data-t="ui.never">Never</option>' +
        [['steps', I18N.k('ui.steps-3', 'Steps ≥')], ['exercise', I18N.k('ui.exercise-min', 'Exercise min ≥')], ['sleep', I18N.k('ui.sleep-hours', 'Sleep hours ≥')], ['active', I18N.k('ui.active-kcal', 'Active kcal ≥')], ['stand', I18N.k('ui.stand-hours', 'Stand hours ≥')], ['distance', I18N.k('ui.km-walked', 'Km walked ≥')], ['flights', I18N.k('ui.floors', 'Floors ≥')], ['mindful', I18N.k('ui.mindful-min', 'Mindful min ≥')], ['water', I18N.k('ui.water-litres', 'Water litres ≥')], ['daylight', I18N.k('ui.daylight-min', 'Daylight min ≥')]].map(function (o) { return '<option value="' + o[0] + '"' + (a.m === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select><input data-ahmin="' + esc(h.id) + '" inputmode="decimal" value="' + esc(a.min || '') + '" placeholder="' + (a.m === 'steps' ? '10000' : a.m === 'sleep' ? '7' : '30') + '" aria-label="Threshold" data-t-aria-label="ui.threshold"' + (a.m ? '' : ' disabled') + '></span></div>';
    }).join('') : '<p class="muted st-pad">Add a habit on the dashboard first.</p>';
  }
  function saveRule(id) {
    var hb = readJSON('dash.habits', null); if (!hb) return;
    var sel = document.querySelector('[data-ahrule="' + id + '"]'), inp = document.querySelector('[data-ahmin="' + id + '"]');
    hb.list.forEach(function (h) { if (h.id !== id) return; if (sel.value) h.auto = { m: sel.value, min: num(inp.value) || (sel.value === 'steps' ? 10000 : sel.value === 'sleep' ? 7 : 30) }; else delete h.auto; });
    writeJSON('dash.habits', hb); tickHabits(); settingsPage();
  }
  document.addEventListener('change', function (e) {
    var s = e.target.closest('[data-ahrule]'); if (s) { saveRule(s.dataset.ahrule); return; }
    var m = e.target.closest('[data-ahmin]'); if (m) { saveRule(m.dataset.ahmin); return; }
    if (e.target.id === 'ahOn' && Fe) { Fe.set('ahealth', e.target.checked); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#ahCopy')) { var t = location.origin + API; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('ahCopy').innerHTML = '<i class="bi bi-check-lg"></i> Copied'; }); else window.Ask.prompt(I18N.k('ui.copy-this-link', 'Copy this link'), t, { ok: I18N.k('ui.close', 'Close') }); return; }
    if (e.target.closest('#ahClear')) {
      var dd = window.Vault.get(); if (dd && dd.health) { var keep = dd.health; delete dd.health; window.Vault.save(dd); window.dispatchEvent(new Event('health:change')); settingsPage(); card();
        if (window.Quick) window.Quick.toast('<i class="bi bi-trash3"></i> Apple Health data removed', function () { var x = window.Vault.get(); x.health = keep; window.Vault.save(x); window.dispatchEvent(new Event('health:change')); settingsPage(); card(); }); }
    }
  });

  window.Vault.onUnlock(function () { setTimeout(function () { card(); settingsPage(); }, 50); });
  ['health:change', 'features:change', 'habits:change'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(function () { card(); settingsPage(); }, 0); }); });
  (window.__core = window.__core || {}).ahealth = { readJSON: readJSON, writeJSON: writeJSON, standMin: function () { return STANDMIN; }, addDays: addDays, $: $, Fe: Fe, days: days, dkey: dkey, stats: stats, latest: latest, esc: esc, fmt: fmt, pad: pad, LABEL: LABEL, sleepCheck: sleepCheck, lastIn: lastIn, num: num };
  window.AHealth = { days: days, stats: stats, latest: latest, lastNight: lastNight, fmt: fmt, merge: merge, pull: pull };
})();
