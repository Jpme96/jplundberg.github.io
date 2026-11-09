/* Shared space (Settings → Shared space), Nov 2026: the person you live with gets their own small app at
   /cmd/home/ with only what you share – shopping list, chores, money between you, calendar events you tick
   "Share with …", plants and the moving checklist. Everything else stays in your own vault, which they can't open.
   · Your data stays where it is; this keeps an encrypted copy of the shared parts in a separate box on the server
     (cleaned to the fields in ShareCore.ALLOW) and brings their changes back in.
   · Who they are: the partner in Finances → Shared expenses (nobody is hard-coded). Their login email lives
     only on the server (share:cfg), the key only in your vault (d.share.key) and, locked with their passcode,
     on the server.
   · Stop sharing removes their access, the box and the key. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features || !window.ShareCore) return;
  var V = window.Vault, Fe = window.Features, SC = window.ShareCore;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(h, undo) { if (window.Quick && window.Quick.toast) window.Quick.toast(h, undo); }
  function rj(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------- state ---------- */
  function st() { var d = V.get(); return d && d.share && d.share.key && d.share.on ? d.share : null; }
  function setSt(p) { var d = V.get(); if (!d) return; d.share = Object.assign({}, d.share || {}, p); V.save(d); }
  var WHAT = [['shop', 'Shopping list', 'cart3'], ['meals', 'Dinner plan', 'egg-fried'], ['pantry', 'Pantry', 'box-seam'], ['recipes', 'Recipes', 'journal-text'], ['chores', 'Chores', 'arrow-repeat'], ['money', 'Money between you', 'people'], ['bills', 'Home bills – their part', 'receipt'], ['cal', 'Calendar events you tick', 'calendar-heart'], ['trips', 'Trips you tick', 'airplane'], ['plants', 'Plants', 'flower1'], ['move', 'Moving checklist', 'box-seam'], ['notes', 'Home notes', 'sticky'], ['house', 'House projects and documents you tick', 'house-heart']];
  var PARTNER_ONLY = { pme: 1 };          /* records only the other person writes – never removed from here */
  var OFF_FIRST = { pantry: 1, recipes: 1 };
  /* what they may change, per area (view = they see it but can't change it) */
  var AREAS = [['shop', 'Shopping list'], ['meals', 'Dinner plan'], ['pantry', 'Pantry'], ['chores', 'Chores'], ['money', 'Money between you'], ['cal', 'Calendar'], ['trips', 'Trips'], ['plants', 'Plants'], ['move', 'Moving checklist'], ['notes', 'Home notes'], ['house', 'House projects']];
  var KIND_AREA = { shop: 'shop', meal: 'meals', pantry: 'pantry', chore: 'chores', cdone: 'chores', sx: 'money', pay: 'money', ev: 'cal', trip: 'trips', plant: 'plants', mv: 'move', note: 'notes', proj: 'house' };
  function perm() { var s0 = (V.get() || {}).share || {}, o = {}; AREAS.forEach(function (a) { o[a[0]] = (s0.perm && s0.perm[a[0]]) === 'view' ? 'view' : 'edit'; }); return o; }
  var NOTE_DEF = { cost: true, settle: true, event: true, shop: false, chore: false, note: false };
  function notifyMe() { var s0 = (V.get() || {}).share || {}; return Object.assign({}, NOTE_DEF, s0.notifyMe || {}); }
  function approveOver() { var s0 = (V.get() || {}).share || {}; return +s0.approveOver || 0; }
  function calCats() { var s0 = (V.get() || {}).share || {}; return Array.isArray(s0.calCats) ? s0.calCats : []; }
  function evShared(e) { return !!(e && (e.share || calCats().indexOf(e.cat) > -1)); }   /* added later: off until you turn them on */
  function what() { var s = (V.get() || {}).share || {}; var o = {}; WHAT.forEach(function (w) { o[w[0]] = s.what && s.what[w[0]] != null ? s.what[w[0]] !== false : !OFF_FIRST[w[0]]; }); return o; }
  function partner() { var S = window.Shared; var p = S && S.partner ? S.partner() : null; return p && p.name ? p : null; }
  function pname() { var p = partner(), s = (V.get() || {}).share || {}; return p ? p.name : (s.name || 'them'); }
  function owner() { var p = rj('dash.profile', {}) || {}, st0 = rj('dash.settings', {}) || {}; return String(p.name || st0.name || '').trim().split(/\s+/)[0] || ''; }

  /* ---------- what gets shared: the cleaned copies ---------- */
  function collect() {
    var w = what(), t = Fe.tools(), out = [], put = function (c, id, f) { var x = SC.clean(c, f); if (x && id) out.push({ c: c, id: String(id), f: x }); };
    var S = window.Shared, p = partner(), mv = t.hmove && typeof t.hmove === 'object' ? t.hmove : null;
    var info = { owner: owner(), partner: pname(), what: w, mvdate: mv && mv.date ? mv.date : '', olook: window.Avatar && window.Avatar.look ? window.Avatar.look() : null };
    if (w.money && S && p) {
      var pct = (function () { var c = S.cfg ? S.cfg() : {}; return +c.pct > 0 && +c.pct < 100 ? +c.pct : 50; })();
      info.split = { o: pct, p: 100 - pct };
      var sh = S.data(), simple = 0;
      sh.items.forEach(function (x) {
        var s2 = x.shares || {}; if (s2[p.id] == null && x.payer !== p.id) return;
        var payer = x.payer === 'me' ? 'o' : x.payer === p.id ? 'p' : null; if (!payer) return;
        var f = { date: x.date, note: String(x.note || '').slice(0, 80), total: +x.total || 0, payer: payer, shares: { o: +s2.me || 0, p: +s2[p.id] || 0 }, cat: x.cat || 'other' };
        put('sx', x.id, f); simple += payer === 'o' ? f.shares.p : -f.shares.o;
      });
      sh.pays.forEach(function (q) {
        var from = q.from === 'me' ? 'o' : q.from === p.id ? 'p' : null, to = q.to === 'me' ? 'o' : q.to === p.id ? 'p' : null; if (!from || !to || from === to) return;
        put('pay', q.id, { date: q.date, from: from, to: to, amount: +q.amount || 0 }); simple += from === 'o' ? +q.amount || 0 : -(+q.amount || 0);
      });
      /* plan payments, bill splits and paying back: each one as its own line, so they see why they owe what they owe */
      var led = [];
      (S.planPays ? S.planPays(null, p.id) : []).forEach(function (q) { var py = q.payer === 'me' ? 'o' : q.payer === p.id ? 'p' : null; if (!py) return; led.push({ id: 'l:' + q.loan + ':' + q.n, f: { date: q.date, note: (q.name || 'Payment') + ' · ' + q.n + '/' + q.of, kind: 'plan', payer: py, o: +q.mine || 0, p: +q.them || 0, amount: +q.amount || 0 } }); });
      (S.billClaims ? S.billClaims(null, p.id) : []).forEach(function (q) { var py = q.payer === 'me' ? 'o' : q.payer === p.id ? 'p' : null; if (!py) return; led.push({ id: 'b:' + q.bill + ':' + q.ym, f: { date: q.date, note: q.name || 'Bill', kind: 'bill', payer: py, o: +q.mine || 0, p: +q.them || 0, amount: +q.amount || 0 } }); });
      (S.owePays ? S.owePays(null, p.id) : []).forEach(function (q) { led.push({ id: 'o:' + q.loan + ':' + q.n + ':' + q.date, f: { date: q.date, note: q.name || 'Paying back', kind: 'back', payer: 'o', o: 0, p: 0, amount: +q.amount || 0 } }); });
      led.sort(function (a, b) { return a.f.date < b.f.date ? 1 : -1; }).slice(0, 150).forEach(function (x) {
        put('led', x.id, x.f); simple += x.f.kind === 'back' ? x.f.amount : x.f.payer === 'o' ? x.f.p : -x.f.o;
      });
      info.extra = Math.round((S.balance(p.id) - simple) * 100) / 100;
    }
    info.perm = perm(); var nm0 = notifyMe(); info.onotify = Object.keys(nm0).filter(function (k) { return nm0[k]; });
    var pend = ((V.get() || {}).share || {}).pending || {};
    if (w.money && Object.keys(pend).length) { info.pend = Object.keys(pend); Object.keys(pend).forEach(function (id) { put('sx', id, pend[id].f); }); }
    put('info', 'info', info);
    if (w.shop) (Array.isArray(t.shop) ? t.shop : []).forEach(function (x) { if (x && x.id) put('shop', x.id, { text: String(x.text || '').slice(0, 120), done: !!x.done }); });
    if (w.chores) {
      (Array.isArray(t.chores) ? t.chores : []).forEach(function (x) { if (x && x.id) put('chore', x.id, { name: String(x.name || '').slice(0, 80), every: x.every || '1w', day: +x.day || 0, who: x.who || 'rotate', start: x.start || '' }); });
      var cd = t.choreDone || {}, since = dkey(new Date(Date.now() - 70 * 864e5));
      Object.keys(cd).forEach(function (k) { if (k.slice(0, 7) >= since.slice(0, 7)) put('cdone', k, { k: k, who: cd[k] }); });
    }
    if (w.cal) (rj('dash.calendar', {}).events || []).forEach(function (e) { if (e && evShared(e) && e.id) put('ev', e.id, { title: String(e.title || '').slice(0, 120), date: e.date, end: e.end, allDay: !!e.allDay, start: e.start, stop: e.stop, repeat: e.repeat, until: e.until, location: String(e.location || '').slice(0, 160) }); });
    if (w.plants) (Array.isArray(t.plants) ? t.plants : []).forEach(function (x) { if (x && x.id) put('plant', x.id, { name: String(x.name || '').slice(0, 80), room: String(x.room || '').slice(0, 60), every: +x.every || 7, last: x.last || '' }); });
    if (w.meals) { var ms = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals) ? t.meals : {}, mf = dkey(new Date(Date.now() - 864e5)); Object.keys(ms).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k >= mf && ms[k]) put('meal', k, { date: k, text: String(ms[k]).slice(0, 80) }); }); }
    if (w.bills && p && !(window.Budget && window.Budget.fixedWhole)) out.unsure = { bill: 1 };    /* this page can't work bills out – leave them as they are */
    if (w.bills && p && window.Budget && window.Budget.fixedWhole) {
      ((V.get() || {}).budget || {}).fixed && V.get().budget.fixed.forEach(function (f) {
        var sp = f && f.split; if (!sp || sp.pid !== p.id || !f.id) return;
        var now = new Date(), day = Math.min(+f.day || 1, 28), nx = new Date(now.getFullYear(), now.getMonth(), day); if (dkey(nx) < dkey(now)) nx = new Date(now.getFullYear(), now.getMonth() + 1, day);
        var whole = window.Budget.fixedWhole(f, dkey(nx).slice(0, 7)); if (!(whole > 0)) return;
        var mine = Math.round(whole * window.Budget.splitPart(f) * 100) / 100;
        put('bill', f.id, { name: String(f.name || 'Bill').slice(0, 60), day: +f.day || 1, amount: Math.round(whole), part: Math.round(whole - mine), payer: sp.payer === 'me' ? 'o' : sp.payer === p.id ? 'p' : 'each', next: dkey(nx) });
      });
    }
    if (w.trips) { var tf = dkey(new Date(Date.now() - 7 * 864e5)); (rj('dash.travel', {}).trips || []).forEach(function (tr) { if (!tr || !tr.share || !tr.id || (tr.end || tr.start || '9') < tf) return; put('trip', tr.id, { name: String(tr.name || 'Trip').slice(0, 80), dest: String(tr.dest || '').slice(0, 80), start: tr.start, end: tr.end, pack: tr.pack }); }); }
    if (w.pantry) (Array.isArray(t.pantry) ? t.pantry : []).forEach(function (x) { if (x && x.id) put('pantry', x.id, { name: String(x.name || '').slice(0, 60), state: x.state === 'low' ? 'low' : 'ok' }); });
    if (w.recipes) (Array.isArray(t.recipes) ? t.recipes : []).forEach(function (x) { if (x && x.id) put('recipe', x.id, { title: String(x.title || 'Recipe').slice(0, 120), mins: x.mins, serves: x.serves, ingr: String(x.ingr || '').slice(0, 3000), steps: String(x.steps || '').slice(0, 4000), link: /^https?:\/\//.test(x.link || '') ? String(x.link).slice(0, 400) : undefined }); });
    if (w.chores) { var lcut = dkey(new Date(Date.now() - 120 * 864e5)); (Array.isArray(t.choreLog) ? t.choreLog : []).filter(function (x) { return x && x.at >= lcut; }).slice(-200).forEach(function (x) { put('clog', x.id, { cid: x.cid, name: x.name, who: x.who, at: x.at }); }); }
    if (w.house) {
      (Array.isArray(t.hproj) ? t.hproj : []).forEach(function (x) { if (!x || !x.share || !x.id) return; put('proj', x.id, { name: String(x.name || 'Project').slice(0, 80), kind: x.kind, room: x.room, status: x.status, budget: +x.budget || undefined, spent: (x.costs || []).reduce(function (a, c) { return a + (+c.amount || 0); }, 0) || undefined, start: x.start, end: x.end, tasks: x.tasks }); });
      var fm = ((V.get() || {}).share || {}).files || {};
      docs().forEach(function (dc) { var fl = dc.files.filter(function (f) { return fm[f.id]; }).map(function (f) { return { fid: fm[f.id], name: f.name, type: f.type, size: f.size }; }); put('doc', dc.src + ':' + dc.id, { name: dc.name, cat: dc.cat, src: dc.src, date: dc.date, files: fl }); });
    }
    if (w.notes) (Array.isArray(t.homenotes) ? t.homenotes : []).forEach(function (n) { if (n && n.id) put('note', n.id, { title: String(n.title || '').slice(0, 60), text: String(n.text || '').slice(0, 1500) }); });
    if (w.move && mv && Array.isArray(mv.items)) mv.items.forEach(function (x) { if (x && x.id) put('mv', x.id, { text: String(x.text || '').slice(0, 80), done: !!x.done }); });
    return out;
  }

  /* documents you ticked: House → Docs and Papers – with their files */
  function docs() {
    if (!st() || !what().house) return [];
    var t = Fe.tools(), out = [];
    (Array.isArray(t.hdocs) ? t.hdocs : []).forEach(function (d) { if (d && d.share && d.id && d.file && d.file.id) out.push({ src: 'house', id: d.id, name: String(d.name || 'Document').slice(0, 120), cat: String(d.cat || ''), date: d.date, files: [{ id: d.file.id, name: d.file.name || d.name, type: d.file.type || '', size: d.file.size || 0, get: function () { return window.HouseFiles ? window.HouseFiles.get(d.file.id) : Promise.resolve(null); } }] }); });
    (Array.isArray(t.papers) ? t.papers : []).forEach(function (pp) { if (!pp || !pp.share || !pp.id) return; out.push({ src: 'papers', id: pp.id, name: String(pp.title || 'Paper').slice(0, 120), cat: pp.kind || '', date: pp.date, files: (pp.files || []).map(function (f) { return { id: f.id, name: f.name || 'file', type: f.type || '', size: f.size || 0, get: function () { return window.Papers && window.Papers.getFile ? window.Papers.getFile(f.id) : Promise.resolve(null); } }; }) }); });
    return out;
  }
  /* upload the files of shared documents (encrypted with the shared key), remove the ones no longer shared */
  var filesBusy = false;
  function syncFiles() {
    var s = st(); if (!s || filesBusy) return Promise.resolve();
    filesBusy = true;
    var want = {}, jobs = [], fm = Object.assign({}, s.files || {}), changed = false;
    docs().forEach(function (dc) { dc.files.forEach(function (f) { want[f.id] = f; }); });
    Object.keys(want).forEach(function (fid) {
      if (fm[fid]) return; var f = want[fid];
      jobs.push(f.get().then(function (blob) {
        if (!blob) return; return blob.arrayBuffer().then(function (buf) { return Promise.all([SC.encryptBytes(s.key, buf), SC.rid(s.key, 'file', fid)]); }).then(function (r) {
          return fetch('/cmd/api/sfile?id=' + r[1], { method: 'PUT', body: r[0], credentials: 'same-origin' }).then(function (res) { if (res.ok) { fm[fid] = r[1]; changed = true; } });
        });
      }).catch(function () {}));
    });
    Object.keys(fm).forEach(function (fid) { if (want[fid]) return; var rid0 = fm[fid]; delete fm[fid]; changed = true; jobs.push(fetch('/cmd/api/sfile?id=' + rid0, { method: 'DELETE', credentials: 'same-origin' }).catch(function () {})); });
    return Promise.all(jobs).then(function () { filesBusy = false; if (changed) { setSt({ files: fm }); schedule(300); } }, function () { filesBusy = false; });
  }
  window.addEventListener('tools:change', function () { if (st()) setTimeout(syncFiles, 800); });
  V.onUnlock(function () { setTimeout(syncFiles, 3000); });

  /* ---------- their changes, back into your data ---------- */
  function profileOff(f) {
    var lk = SC.cleanLook(f.look), t = Fe.tools(), pl = Array.isArray(t.people) ? t.people : [], nm = String(((partner() || {}).name) || f.name || pname()).trim().toLowerCase();
    var pp = pl.filter(function (x) { return x && x.shp; })[0] || pl.filter(function (x) { return x && String(x.name || '').trim().toLowerCase() === nm; })[0] || pl.filter(function (x) { return x && String(x.name || '').trim().toLowerCase().split(/\s+/)[0] === nm.split(/\s+/)[0]; })[0];
    return !pp || !pp.shp || (lk && JSON.stringify(pp.look || {}) !== JSON.stringify(lk));
  }
  function applyAll(list) {
    var failed = [];
    if (!list.length) return failed;
    var t = Fe.tools(), toolsCh = false, cal = null, tv = null, p = partner(), pm = perm(), news = [], held = [];
    var sh0 = (V.get() || {}).share || {}, pend = Object.assign({}, sh0.pending || {}), pendCh = false, lim = approveOver();
    list.forEach(function (r) { try {
      var c = r.c, id = r.id, f = r.f || {}, del = !!r.del;
      if (KIND_AREA[c] && pm[KIND_AREA[c]] === 'view' && !(c === 'plant' || c === 'mv' || c === 'cdone') && pm[KIND_AREA[c]] === 'view') return;   /* view only: theirs is put back on the next sync */
      if (KIND_AREA[c] && pm[KIND_AREA[c]] === 'view') return;
      if (!r.heal) news.push(newsOf(c, f, del, t, id));
      /* a bigger shared cost waits for your OK */
      if (c === 'sx' && !del && lim && +f.total > lim && f.payer === 'p') {
        var known = ((t.shared || {}).items || []).some(function (x) { return x.id === id; });
        if (!known) { pend[id] = { f: f, t: Date.now() }; pendCh = true; held.push(f); return; }
      }
      if (c === 'sx' && del && pend[id]) { delete pend[id]; pendCh = true; return; }
      if (c === 'shop') { var l = Array.isArray(t.shop) ? t.shop : (t.shop = []), i = l.findIndex(function (x) { return x.id === id; });
        if (del) { if (i > -1) { l.splice(i, 1); toolsCh = true; } } else if (i > -1) { l[i] = Object.assign({}, l[i], { text: f.text, done: !!f.done }); toolsCh = true; } else { var pn = (t.pantry || []).filter(function (q) { return q.state === 'low' && String(q.name || '').toLowerCase() === String(f.text || '').toLowerCase(); })[0]; l.push({ id: id, text: f.text || '', done: !!f.done, from: pn ? 'pantry' : 'shared' }); toolsCh = true; } }
      else if (c === 'cdone') {
        t.choreDone = Object.assign({}, t.choreDone || {}); var ck = f.k || id;
        if (del) { delete t.choreDone[id]; t.choreLog = (Array.isArray(t.choreLog) ? t.choreLog : []).filter(function (x) { return x.k !== id; }); }
        else { t.choreDone[ck] = f.who === 'me' ? 'me' : 'them'; var ch = (t.chores || []).filter(function (x) { return x.id === String(ck).split('|')[1]; })[0]; if (ch && window.Chores && window.Chores.addLog) window.Chores.addLog(t, ch, ck, t.choreDone[ck], f.at); }
        toolsCh = true; }
      else if (c === 'chore') { var cl = Array.isArray(t.chores) ? t.chores : (t.chores = []), ci = cl.findIndex(function (x) { return x.id === id; });
        if (del) { if (ci > -1) cl.splice(ci, 1); } else { var co = { id: id, name: f.name || 'Chore', every: f.every || '1w', day: +f.day || 0, who: f.who || 'rotate', start: f.start || dkey(new Date()) }; if (ci > -1) cl[ci] = Object.assign({}, cl[ci], co); else cl.push(co); }
        toolsCh = true; }
      else if (c === 'proj' && !del) { (t.hproj || []).forEach(function (x) { if (x.id !== id || !Array.isArray(f.tasks)) return; var old = {}; (x.tasks || []).forEach(function (q) { old[q.id] = q; }); x.tasks = f.tasks.map(function (q) { return Object.assign({}, old[q.id] || {}, q); }); toolsCh = true; }); }
      else if ((c === 'sx' || c === 'pay') && p) {
        var sh = t.shared && typeof t.shared === 'object' ? t.shared : (t.shared = {}); sh.items = Array.isArray(sh.items) ? sh.items : []; sh.pays = Array.isArray(sh.pays) ? sh.pays : [];
        var arr = c === 'sx' ? sh.items : sh.pays, j = arr.findIndex(function (x) { return x.id === id; }), who = function (v) { return v === 'o' ? 'me' : p.id; };
        if (del) { if (j > -1) { arr.splice(j, 1); toolsCh = true; } }
        else {
          var o = c === 'sx' ? { id: id, date: f.date, note: f.note || 'Shared', total: +f.total || 0, payer: who(f.payer), shares: (function () { var s = { me: +(f.shares || {}).o || 0 }; s[p.id] = +(f.shares || {}).p || 0; return s; })(), cat: f.cat || 'other', mode: 'amount', by: 'partner' }
            : { id: id, date: f.date, from: who(f.from), to: who(f.to), amount: +f.amount || 0, by: 'partner' };
          if (j > -1) arr[j] = Object.assign({}, arr[j], o); else arr.push(o); toolsCh = true;
        }
      }
      else if (c === 'ev') { cal = cal || rj('dash.calendar', {}); cal.events = Array.isArray(cal.events) ? cal.events : []; var k = cal.events.findIndex(function (x) { return x.id === id; });
        if (del) { if (k > -1) cal.events.splice(k, 1); } else { var e = Object.assign({}, k > -1 ? cal.events[k] : { id: id, cat: 'personal' }, f, { share: true }); if (k > -1) cal.events[k] = e; else cal.events.push(e); } }
      else if (c === 'plant' && !del) { (t.plants || []).forEach(function (x) { if (x.id === id && f.last && (!x.last || f.last > x.last)) { x.last = f.last; toolsCh = true; } }); }
      else if (c === 'pantry' && !del) { (t.pantry || []).forEach(function (x) { if (x.id === id && x.state !== f.state) { x.state = f.state === 'low' ? 'low' : 'ok'; toolsCh = true; } }); }
      else if (c === 'meal') { t.meals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals) ? t.meals : {}; if (del) delete t.meals[id]; else if (f.text) t.meals[f.date || id] = f.text; toolsCh = true; }
      else if (c === 'note') { var nl = Array.isArray(t.homenotes) ? t.homenotes : (t.homenotes = []), ni = nl.findIndex(function (x) { return x.id === id; });
        if (del) { if (ni > -1) nl.splice(ni, 1); } else if (ni > -1) nl[ni] = Object.assign({}, nl[ni], { title: f.title || '', text: f.text || '' }); else nl.push({ id: id, title: f.title || '', text: f.text || '', by: 'partner' }); toolsCh = true; }
      else if (c === 'trip' && !del) { tv = tv || rj('dash.travel', {}); (tv.trips || []).forEach(function (tr) { if (tr.id !== id || !Array.isArray(f.pack)) return; var old = {}; (tr.pack || []).forEach(function (x) { old[x.t] = x; }); tr.pack = f.pack.map(function (x) { return Object.assign({}, old[x.t] || {}, { t: x.t, done: !!x.done }); }); }); }
      else if (c === 'pme' && !del) {
        var lk = SC.cleanLook(f.look), nm = (p && p.name) || f.name || pname(); t.people = Array.isArray(t.people) ? t.people : [];
        var low = function (v) { return String(v || '').trim().toLowerCase(); }, first = function (v) { return low(v).split(/\s+/)[0]; };
        /* the person found before (marked), else the same name, else the same first name */
        var pp = t.people.filter(function (x) { return x && x.shp; })[0] || t.people.filter(function (x) { return x && low(x.name) === low(nm); })[0] || t.people.filter(function (x) { return x && first(x.name) && first(x.name) === first(nm); })[0];
        if (!pp) { pp = { id: 'sh' + Date.now().toString(36), name: nm, rel: 'family' }; t.people.push(pp); toolsCh = true; }
        if (!pp.shp) { pp.shp = 1; toolsCh = true; }
        if (lk && JSON.stringify(pp.look || {}) !== JSON.stringify(lk)) { pp.look = lk; toolsCh = true; setTimeout(function () { toast('<i class="bi bi-person-bounding-box"></i> ' + esc(nm + '’s avatar is in People')); }, 400); } else if (!pp.look) toolsCh = true;
        if (f.bday && /^\d{1,2}\.\d{1,2}(\.\d{4})?$/.test(f.bday) && pp.bday !== f.bday) { pp.bday = f.bday; toolsCh = true; }
        if (f.phone && /^[+\d\s()-]{4,20}$/.test(f.phone) && pp.phone !== f.phone) { pp.phone = f.phone; toolsCh = true; }
      }
      else if (c === 'mv' && !del && t.hmove && Array.isArray(t.hmove.items)) { t.hmove.items.forEach(function (x) { if (x.id === id && !!x.done !== !!f.done) { x.done = !!f.done; toolsCh = true; } }); }
    } catch (e) { failed.push(r.rid); if (window.Diag && window.Diag.log) window.Diag.log('share', 'apply ' + r.c + ': ' + ((e && e.message) || e), 'share.js'); } });
    news = news.filter(Boolean);
    if (news.length) { t.sharenews = (Array.isArray(t.sharenews) ? t.sharenews : []).concat(news).filter(function (x) { return x.at > Date.now() - 14 * 864e5; }).slice(-60); toolsCh = true; }
    if (pendCh) setSt({ pending: pend });
    if (held.length) setTimeout(function () { toast('<i class="bi bi-hourglass-split"></i> ' + esc(pname() + ' added ' + held.map(function (f) { return f.note + ' ' + kr(f.total); }).join(', ') + ' – waiting for your OK')); }, 500);
    if (toolsCh) { quiet = true; Fe.saveTools(t); quiet = false; window.dispatchEvent(new Event('fin:change')); }
    if (cal) { wj('dash.calendar', cal); window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('cal:change')); }
    if (tv) { quiet = true; wj('dash.travel', tv); window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('travel:change')); quiet = false; }
    return failed;
  }

  var nfk = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  function kr(n) { return nfk.format(Math.round(+n || 0)) + ' kr'; }
  /* one line about what they changed – for At a glance and your phone */
  function newsOf(c, f, del, t, id) {
    var nm = pname(), at = Date.now(), had = function (arr) { return (arr || []).some(function (x) { return x.id === id; }); };
    if (c === 'sx' && !del && !had((t.shared || {}).items)) return { k: 'cost', at: at, text: nm + ' added a shared cost: ' + (f.note || 'Shared') + ' ' + kr(f.total) };
    if (c === 'pay' && !del && !had((t.shared || {}).pays)) return { k: 'settle', at: at, text: nm + ' settled up ' + kr(f.amount) };
    if (c === 'ev' && !del && !(rj('dash.calendar', {}).events || []).some(function (e) { return e.id === id; })) return { k: 'event', at: at, text: nm + ' added an event: ' + f.title + (f.date ? ' · ' + new Date(f.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '') };
    if (c === 'shop' && !del && !had(t.shop)) return { k: 'shop', at: at, text: nm + ' added ' + f.text + ' to the list' };
    if (c === 'cdone' && !del) { var ch = (t.chores || []).filter(function (x) { return x.id === String(f.k || id).split('|')[1]; })[0]; return ch ? { k: 'chore', at: at, text: nm + ' did: ' + ch.name } : null; }
    if (c === 'note' && !del) return { k: 'note', at: at, text: nm + (had(t.homenotes) ? ' changed a note: ' : ' added a note: ') + (f.title || '') };
    return null;
  }
  /* At a glance: what they changed (last 2 days), and bigger costs waiting for your OK */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!st()) return;
    var nm0 = notifyMe(), cut = Date.now() - 2 * 864e5, seenN = +rj('dash.share.newsSeen', 0) || 0;
    var l = (Fe.tools().sharenews || []).filter(function (x) { return x.at > cut && x.at > seenN && nm0[x.k] !== false && (nm0[x.k] || NOTE_DEF[x.k]); });
    if (l.length) add(58, 'people', '#22b35e', l.length === 1 ? l[0].text : l.length + ' changes from ' + pname(), l.length === 1 ? 'Shared space' : l.slice(-3).map(function (x) { return x.text.replace(pname() + ' ', ''); }).join(' · '), '/cmd/admin/#shared',
      { act: { id: 'shn:' + l[l.length - 1].at, label: 'Seen' }, run: function () { wj('dash.share.newsSeen', Date.now()); } });
    var pend = ((V.get() || {}).share || {}).pending || {};
    Object.keys(pend).forEach(function (id) { var f = pend[id].f;
      add(30, 'hourglass-split', '#c98500', pname() + ' added ' + (f.note || 'a shared cost') + ' · ' + kr(f.total), 'Over ' + kr(approveOver()) + ' – it counts once you say OK', '/cmd/admin/#shared',
        { main: true, act: { id: 'shok:' + id, label: 'OK' }, run: function () { approve(id, true); } }); });
  });
  function approve(id, yes) {
    var d = V.get(), pend = Object.assign({}, (d.share || {}).pending || {}), it = pend[id]; if (!it) return;
    delete pend[id]; setSt({ pending: pend });
    if (yes) { var p = partner(); if (p) { var t = Fe.tools(), sh = t.shared && typeof t.shared === 'object' ? t.shared : (t.shared = {}); sh.items = Array.isArray(sh.items) ? sh.items : []; var f = it.f, s2 = { me: +(f.shares || {}).o || 0 }; s2[p.id] = +(f.shares || {}).p || 0;
      sh.items.push({ id: id, date: f.date, note: f.note || 'Shared', total: +f.total || 0, payer: f.payer === 'o' ? 'me' : p.id, shares: s2, cat: f.cat || 'other', mode: 'amount', by: 'partner' }); Fe.saveTools(t); window.dispatchEvent(new Event('fin:change')); } }
    toast('<i class="bi bi-' + (yes ? 'check2' : 'x-lg') + '"></i> ' + esc((it.f.note || 'Shared cost') + (yes ? ' counted' : ' declined – removed for ' + pname())));
    schedule(200); if (document.getElementById('shPend')) draw();
  }

  /* ---------- sync ---------- */
  var healAt = 0;
  function missing(c, id) {
    var t = Fe.tools(), has = function (l) { return (Array.isArray(l) ? l : []).some(function (x) { return x && x.id === id; }); };
    if (c === 'ev') return !has(rj('dash.calendar', {}).events);
    if (c === 'shop') return !has(t.shop);
    if (c === 'note') return !has(t.homenotes);
    if (c === 'chore') return !has(t.chores);
    if (c === 'sx') return !has((t.shared || {}).items) && !(((V.get() || {}).share || {}).pending || {})[id];
    if (c === 'pay') return !has((t.shared || {}).pays);
    return false;
  }
  var unsure = {}, cache = {}, rids = {}, seen = rj('dash.share.seen2', {}), applyErr = 0, busy = false, again = false, quiet = false, lastOk = 0, lastErr = '';
  function ridOf(k, c, id) { var x = c + '|' + id; if (rids[x]) return Promise.resolve(rids[x]); return SC.rid(k, c, id).then(function (r) { rids[x] = r; return r; }); }
  var boxRev = null;
  function absorb(k, srv) {
    var recs = (srv && srv.recs) || {}, jobs = []; if (srv && srv.rev != null) boxRev = srv.rev;
    Object.keys(recs).forEach(function (rid) {
      var r = recs[rid], old = cache[rid];
      if (old && old.t === r.t) return;
      if (r.del) { cache[rid] = { t: r.t, by: r.by, del: 1, c: old && old.c, id: old && old.id }; return; }
      jobs.push(SC.decrypt(k, r).then(function (o) { cache[rid] = { t: r.t, by: r.by, c: o.c, id: o.id, f: SC.clean(o.c, o.f) || {} }; }, function () { cache[rid] = { t: r.t, by: r.by, bad: 1 }; }));
    });
    return Promise.all(jobs);
  }
  function sync() {
    var s = st(); if (!s) return Promise.resolve();
    if (busy) { again = true; return Promise.resolve(); }
    busy = true; var k = s.key;
    return SC.api('shared').then(function (srv) { return absorb(k, srv); }).then(function () {
      /* 1. their changes since last time */
      var mine = [];
      Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.by === 'p' && r.t > (seen[rid] || 0) && r.c) mine.push({ rid: rid, t: r.t, c: r.c, id: r.id, f: r.f, del: r.del }); });
      /* their profile is checked on every sync, not only when it changes: another device saving an older
         People list could otherwise lose the avatar for good */
      if (!mine.some(function (x) { return x.c === 'pme'; })) Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.by === 'p' && r.c === 'pme' && !r.del && r.f && profileOff(r.f)) mine.push({ rid: rid, t: r.t, c: r.c, id: r.id, f: r.f }); });
      /* data just came from another device: anything of theirs that the merge dropped is put back,
         not read as "deleted" (which would also remove it from their app) */
      if (healAt && Date.now() >= healAt) { healAt = 0; var inMine = {}; mine.forEach(function (x) { inMine[x.rid] = 1; });
        Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.by === 'p' && !r.del && !r.bad && r.c && r.f && !inMine[rid] && seen[rid] && missing(r.c, r.id)) mine.push({ rid: rid, t: r.t, c: r.c, id: r.id, f: r.f, heal: 1 }); }); }
      var bad = []; try { bad = applyAll(mine) || []; } catch (e) { bad = mine.map(function (x) { return x.rid; }); if (window.Diag && window.Diag.log) window.Diag.log('share', 'apply: ' + ((e && e.message) || e), 'share.js'); }
      applyErr = bad.length;
      mine.forEach(function (x) { if (bad.indexOf(x.rid) < 0) seen[x.rid] = Math.max(seen[x.rid] || 0, x.t); });
      wj('dash.share.seen2', seen);
      /* 2. your changes: what differs from the box */
      var loc = collect(); unsure = loc.unsure || {};
      return Promise.all(loc.map(function (x) { return ridOf(k, x.c, x.id).then(function (rid) { x.rid = rid; return x; }); }));
    }).then(function (loc) {
      var have = {}, push = {}, now = Date.now(), jobs = [];
      loc.forEach(function (x) {
        have[x.rid] = 1; var r = cache[x.rid];
        if (r && !r.del && r.c === x.c && SC.hash(r.f) === SC.hash(x.f)) return;
        jobs.push(SC.encrypt(k, { c: x.c, id: x.id, f: x.f }).then(function (e) { push[x.rid] = { t: now, iv: e.iv, ct: e.ct }; }));
      });
      Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (!have[rid] && !r.del && !r.bad && r.c && !PARTNER_ONLY[r.c] && !unsure[r.c] && !(healAt && r.by === 'p')) push[rid] = { t: now, del: 1 }; });
      /* new things from you, for their phone – only what they switched on in their app */
      var their = {}; Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.c === 'pme' && r.f && r.f.notif) their = r.f.notif; });
      var fresh = loc.filter(function (x) { return push[x.rid] && !push[x.rid].del && (!cache[x.rid] || cache[x.rid].del); }), lines = [];
      var me0 = owner() || 'Your partner', add1 = function (k, txt) { if (their[k]) lines.push(txt); };
      var items = fresh.filter(function (x) { return x.c === 'shop'; }).map(function (x) { return x.f.text; }); if (items.length) add1('list', me0 + ' added ' + items.slice(0, 4).join(', ') + (items.length > 4 ? ' …' : '') + ' to the list');
      fresh.filter(function (x) { return x.c === 'ev'; }).forEach(function (x) { add1('events', me0 + ' added an event: ' + x.f.title); });
      fresh.filter(function (x) { return x.c === 'sx'; }).forEach(function (x) { add1('money', me0 + ' added a shared cost: ' + (x.f.note || '') + ' ' + kr(x.f.total)); });
      fresh.filter(function (x) { return x.c === 'pay'; }).forEach(function (x) { add1('money', me0 + ' settled up ' + kr(x.f.amount)); });
      fresh.filter(function (x) { return x.c === 'meal'; }).forEach(function (x) { add1('dinner', 'Dinner ' + new Date(x.f.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' }) + ': ' + x.f.text); });
      fresh.filter(function (x) { return x.c === 'chore'; }).forEach(function (x) { add1('chores', me0 + ' added a chore: ' + x.f.name); });
      if (lines.length && Object.keys(cache).length) SC.api('push', { method: 'POST', body: { notify: { title: 'Home', body: lines.slice(0, 3).join(' · '), tag: 'o' + now } } }).catch(function () {});
      return Promise.all(jobs).then(function () {
        if (!Object.keys(push).length) return null;
        return SC.api('shared', { method: 'PUT', body: { recs: push } }).then(function (srv) { return absorb(k, srv); });
      });
    }).then(function () { lastOk = Date.now(); lastErr = ''; busy = false; paintSum(); chatInit(); chatButton(); if (again) { again = false; schedule(500); } },
      function (e) { busy = false; lastErr = (e && e.status === 401) ? 'Signed out – reload' : 'Couldn’t reach the server'; paintSum(); if (again) { again = false; schedule(5000); } });
  }
  /* their change shows up within seconds: the live check sees the box move on and syncs right away */
  SC.live(function (j) { if (st() && j && j.box != null && j.box !== boxRev && !busy) schedule(0); });
  var tm = null;
  function schedule(ms) { if (!st()) return; clearTimeout(tm); tm = setTimeout(sync, ms == null ? 1500 : ms); }
  ['tools:change', 'cal:change', 'fin:change', 'travel:change', 'avatar:change'].forEach(function (ev) { window.addEventListener(ev, function () { if (!quiet) schedule(); }); });
  /* also runs when another device's version is taken in; wait a little so a real delete there reaches the box first */
  V.onUnlock(function () { cache = {}; healAt = Date.now() + 6000; schedule(1200); setTimeout(function () { schedule(0); }, 6500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(300); });
  setInterval(function () { if (!document.hidden && st()) sync(); }, 45000);

  /* ---------- "Visible to …" on the cards that are shared ---------- */
  var VIS = [['#shop', 'shop'], ['#meals', 'meals'], ['#pantry', 'pantry'], ['#recipes', 'recipes'], ['#chores', 'chores'], ['#plants', 'plants'], ['#shared', 'money'], ['#hshared', 'money'], ['#fpAcctCard', 'bills', 'Split bills visible to ']];
  function marks() {
    var on = !!st(), w = on ? what() : {};
    VIS.forEach(function (v) {
      var h = document.querySelector(v[0] + ' > .card-head h2'); if (!h) return;
      var m = h.querySelector('.sh-vis'), shared = on && w[v[1]];
      if (shared && v[1] === 'bills') { var pp0 = partner(); if (!(pp0 && (((V.get() || {}).budget || {}).fixed || []).some(function (f) { return f && f.split && f.split.pid === pp0.id; }))) { if (m) m.remove(); return; } }
      if (!on) { if (m) m.remove(); return; }
      if (!m) { m = document.createElement('button'); m.type = 'button'; m.className = 'sh-vis'; m.innerHTML = '<i class="bi bi-people"></i> <span></span>'; h.appendChild(m); }
      m.dataset.shcard = v[1]; m.classList.toggle('off', !shared);
      var tx = shared ? (v[2] || 'Visible to ') + pname() : 'Share with ' + pname();
      if (m.lastChild.textContent !== tx) m.lastChild.textContent = tx;
      m.title = shared ? 'Shared with ' + pname() + ' – tap to stop sharing this' : 'Not shared – tap to share this with ' + pname();
      m.setAttribute('aria-pressed', String(!!shared));
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shcard]'); if (!b || !st()) return; e.preventDefault(); e.stopPropagation();
    var k = b.dataset.shcard, d = V.get(), was = Object.assign({}, (d.share || {}).what || {}), w = Object.assign({}, was), now = !what()[k];
    w[k] = now; setSt({ what: w }); marks(); calRow(); schedule(200);
    var lbl = (WHAT.filter(function (x) { return x[0] === k; })[0] || [k, k])[1];
    toast('<i class="bi bi-people"></i> ' + esc((now ? 'Shared with ' + pname() + ': ' : 'No longer shared: ') + lbl), function () { setSt({ what: was }); marks(); schedule(200); });
  }, true);
  var mt = null; new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(function () { marks(); tripRow(); }, 120); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- the calendar: "Share with …" on an event ---------- */
  function calRow() {
    var ed = document.getElementById('clEdit'); if (!ed) return;
    var row = document.getElementById('clShareRow'), want = !!st() && what().cal;
    if (!row && want) {
      row = document.createElement('div'); row.className = 'cl-group'; row.id = 'clShareRow';
      row.innerHTML = '<label class="st-row"><span><i class="bi bi-people"></i> <span id="clShareLbl"></span></span><input type="checkbox" class="switch" id="clShare"></label>';
      var g = ed.querySelector('.cl-group-text'); if (g) ed.insertBefore(row, g); else ed.appendChild(row);
    }
    if (row) { row.hidden = !want; var l = document.getElementById('clShareLbl'); if (l) l.textContent = 'Share with ' + pname(); }
  }
  /* Travel → a trip's overview: "Share with …" (dates, packing list) */
  function tripRow() {
    var notes = document.getElementById('tpNotes'); if (!notes) return;
    var id = notes.dataset.trip, row = document.getElementById('tpShareRow'), want = !!st() && what().trips && id;
    if (!want) { if (row) row.remove(); return; }
    var tr = (rj('dash.travel', {}).trips || []).filter(function (x) { return x.id === id; })[0]; if (!tr) return;
    if (!row) { row = document.createElement('label'); row.id = 'tpShareRow'; row.className = 'tp-share'; notes.parentNode.insertBefore(row, notes); }
    var html = '<span><i class="bi bi-people"></i> ' + esc('Share with ' + pname()) + '<small>' + esc('Dates and the packing list – you tick things off together') + '</small></span><input type="checkbox" class="switch" data-tpshare="' + esc(id) + '"' + (tr.share ? ' checked' : '') + '>';
    if (row.dataset.h !== html) { row.innerHTML = html; row.dataset.h = html; }
  }
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-tpshare]'); if (!i) return;
    var F = window.Flow, tv = F && F.travel ? F.travel() : rj('dash.travel', {}); (tv.trips || []).forEach(function (x) { if (x.id === i.dataset.tpshare) { if (i.checked) x.share = true; else delete x.share; } });
    if (F && F.saveTravel) F.saveTravel(tv); else { wj('dash.travel', tv); window.dispatchEvent(new Event('travel:change')); }
    window.dispatchEvent(new Event('dash:local'));
    toast('<i class="bi bi-people"></i> ' + esc(i.checked ? 'Shared with ' + pname() : 'No longer shared'));
  });
  var KITS = { hproj: 'Status, tasks and budget – you tick tasks off together', papers: 'Only this one – the file is encrypted for them, and removed from their app when you turn this off', hdocs: 'Only this one – the file is encrypted for them, and removed from their app when you turn this off' };
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-hdshare]'); if (!i) return;
    var t = Fe.tools(); (t.hdocs || []).forEach(function (d) { if (d.id === i.dataset.hdshare) { if (i.checked) d.share = true; else delete d.share; } }); Fe.saveTools(t);
    toast('<i class="bi bi-people"></i> ' + esc(i.checked ? 'Shared with ' + pname() : 'No longer shared'));
  });
  window.ShareSpace = { evShared: function (e) { return !!st() && what().cal && evShared(e); }, kitRow: function (k) { return st() && what().house && KITS[k] ? 'Share with ' + pname() : ''; }, kitHelp: function (k) { return KITS[k] || ''; }, syncFiles: syncFiles, on: function () { return !!st(); }, name: pname, calRow: calRow, sync: sync, collect: collect, what: what };

  /* ---------- Settings → Shared space ---------- */
  var srvInfo = null, showing = null;
  function paintSum() {
    var el = document.getElementById('sumShare'); if (el) el.textContent = st() ? 'With ' + pname() + (srvInfo && srvInfo.paused ? ' · paused' : '') + (lastErr ? ' · ' + lastErr : '') : 'Off';
    if (showing === 'status') { var s2 = document.getElementById('shStatus'); if (s2) s2.innerHTML = statusLine(); }
  }
  function statusLine() {
    if (lastErr) return '<i class="bi bi-exclamation-circle"></i> ' + esc(lastErr);
    if (applyErr) return '<i class="bi bi-exclamation-circle"></i> ' + esc(applyErr + ' change(s) from ' + pname() + ' couldn’t be added – Settings → Diagnostics has the details');
    if (!lastOk) return '<i class="bi bi-arrow-repeat"></i> Syncing …';
    var lastP = 0, prof = false, unread = 0, av = 0; Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.by === 'p') lastP = Math.max(lastP, r.t || 0); if (r.by === 'p' && r.bad) unread++; if (r.c === 'pme' && !r.del) { prof = true; av = (r.f && +r.f.v) || 0; } });
    if (unread) return '<i class="bi bi-exclamation-circle"></i> ' + esc(unread + ' change(s) from ' + pname() + ' can’t be read – their app has an old invite. Show the code again (Invite below) and let them scan it.');
    return '<i class="bi bi-check2-circle"></i> In sync · ' + new Date(lastOk).toTimeString().slice(0, 5) + (srvInfo && !srvInfo.joined ? ' · waiting for ' + esc(pname()) + ' to scan the code' : srvInfo && srvInfo.joined ? ' · ' + esc(pname()) + ' has joined' : '') +
      (lastP ? '<br><small class="muted">' + esc('Last change from ' + pname() + ': ' + new Date(lastP).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + ' · ' + esc(prof ? 'profile and avatar received' : 'no profile yet') + (av ? ' · their app v' + av : prof ? ' · their app is out of date – they should reopen it' : '') + '</small>' : '');
  }
  function link() { var s = st(); return s ? location.origin + '/cmd/home/#k=' + s.key : ''; }
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = '/cmd/vendor/qrcode.js'; sc.onload = function () { res(window.qrcode); }; sc.onerror = rej; document.head.appendChild(sc); });
  }
  function draw() {
    var box = document.getElementById('crShareBox'); if (!box) return;
    var s = st(), p = partner(), nm = pname(), sw = what();
    if (!s) {
      showing = 'setup';
      box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-people"></i> Share your home with ' + esc(p ? p.name : 'the person you live with') + '</p>' +
        '<div class="st-group"><p class="st-note">They get their own small app with only what you choose below – the shopping list, chores, money between you, events you tick, plants and the moving checklist. Your finances, health, papers and everything else stay locked with your passcode; they can’t open it.</p></div>' +
        (p ? '' : '<div class="st-group"><label class="st-row"><span>Their name<small class="st-rsub">For money between you, add them in Finances → Shared expenses</small></span><input class="st-input" id="shName" maxlength="40" value="' + esc(((V.get() || {}).share || {}).name || '') + '" placeholder="Name"></label></div>') +
        '<div class="st-group"><label class="st-row"><span>Their email<small class="st-rsub">The one they log in with – only kept on your server</small></span><input class="st-input" id="shEmail" type="email" inputmode="email" autocomplete="off" placeholder="name@example.com"></label></div>' +
        '<div class="st-group"><button type="button" class="st-row st-btn" id="shStart"><span><i class="bi bi-people"></i> Start sharing</span><i class="bi bi-chevron-right"></i></button></div>' +
        '<p class="st-note muted" id="shMsg" role="status"></p>' +
        '<p class="st-note muted">You also add their email in Cloudflare (Zero Trust → Access → Applications → your dashboard → policy) so they can log in at all.</p>';
      return;
    }
    showing = 'status';
    var joined = !!(srvInfo && srvInfo.joined), paused = !!(srvInfo && srvInfo.paused), pend = ((V.get() || {}).share || {}).pending || {};
    var nOn = WHAT.filter(function (w) { return sw[w[0]]; }).length, nNotes = (Array.isArray(Fe.tools().homenotes) ? Fe.tools().homenotes : []).length;
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-people"></i> Sharing with ' + esc(nm) + '</p>' +
      '<div class="st-group"><p class="st-note" id="shStatus">' + statusLine() + '</p>' +
        '<button type="button" class="st-row st-btn" id="shPrev"><span><i class="bi bi-phone"></i> Preview ' + esc(nm) + '’s app<small class="st-rsub">Exactly what they see – nothing can be changed in the preview</small></span><i class="bi bi-chevron-right"></i></button></div>' +
      pendHtml(nm, pend) +
      (joined ? '' : inviteSec(nm, false)) +
      '<p class="st-sub ap-sub"><i class="bi bi-sliders"></i> What you share</p>' +
      sec('sees', 'ui-checks', 'What ' + nm + ' sees', nOn + ' of ' + WHAT.length + ' shared',
        WHAT.map(function (w) {
          return '<label class="st-row"><span><i class="bi bi-' + w[2] + '"></i> ' + esc(w[1]) + (w[0] === 'money' && !p ? '<small class="st-rsub">Add them in Finances → Shared expenses first</small>' : '') + '</span><input type="checkbox" class="switch" data-shwhat="' + w[0] + '"' + (sw[w[0]] ? ' checked' : '') + '></label>';
        }).join('') + '<button type="button" class="st-row st-btn" id="shPeek"><span><i class="bi bi-eye"></i> List every shared item</span><i class="bi bi-chevron-down"></i></button><div id="shPeekBox" hidden></div>') +
      settingsMore(nm) +
      sec('chat', 'chat-heart', 'Chat', (window.HomeChat ? 'Messages ' + (HomeChat.ttl() ? 'disappear after ' + HomeChat.ttlName(HomeChat.ttl()) : 'are kept') : '') + (sw.notes && nNotes ? ' · ' + nNotes + ' pinned' : ''), chatSec(sw)) +
      '<p class="st-sub ap-sub"><i class="bi bi-person-gear"></i> Access</p>' +
      (joined ? inviteSec(nm, true) : '') +
      sec('acct', 'key', 'Login and pause', (paused ? 'Paused · ' : '') + (srvInfo && srvInfo.partner || 'Their email'),
        '<label class="st-row"><span>Their email<small class="st-rsub">Change it if they log in with another one</small></span><input class="st-input" id="shEmail" type="email" inputmode="email" autocomplete="off" value="' + esc(srvInfo && srvInfo.partner || '') + '"></label><button type="button" class="st-row st-btn" id="shSaveEmail" hidden><span>Save email</span><i class="bi bi-check2"></i></button>' +
        '<button type="button" class="st-row st-btn" id="shPause"><span><i class="bi bi-' + (paused ? 'play-circle' : 'pause-circle') + '"></i> ' + (paused ? 'Resume sharing' : 'Pause sharing') + '<small class="st-rsub">' + (paused ? esc(nm) + ' sees everything again – no new code needed' : esc(nm) + ' sees nothing for now. Nothing is deleted, and they need no new code to come back.') + '</small></span></button>' +
        '<button type="button" class="st-row st-btn danger-txt" id="shStop"><span><i class="bi bi-x-octagon"></i> <span id="shStopL">Stop sharing</span><small class="st-rsub">They lose access at once, the shared box and key are removed. Your own data stays as it is.</small></span></button>');
    SC.api('share').then(function (j) { var was = srvInfo ? { joined: !!srvInfo.joined, paused: !!srvInfo.paused, partner: srvInfo.partner } : null; srvInfo = j; paintSum();
      if (showing === 'status' && (!was || was.joined !== !!j.joined || was.paused !== !!j.paused || was.partner !== j.partner) && !document.activeElement.closest('#stShare input, #stShare textarea')) draw(); }, function () {});
  }
  /* one folding section of the Shared space settings: a title, a one-line summary, and what's inside */
  var secOpen = {};
  function sec(id, ic, title, sum, body) {
    return '<details class="st-group sh-sec" data-shsec="' + id + '"' + (secOpen[id] ? ' open' : '') + '><summary class="st-row"><span><i class="bi bi-' + ic + '"></i> ' + esc(title) + '<small class="st-rsub">' + esc(sum) + '</small></span><i class="bi bi-chevron-down sh-chev"></i></summary>' + body + '</details>';
  }
  /* keep the one-line summaries true after a switch or a choice changes */
  var sumT = null;
  function resum(e) { if (!e.target.closest || !e.target.closest('.sh-sec [data-shwhat], .sh-sec [data-shperm], .sh-sec [data-shappr], .sh-sec [data-shnote], .sh-sec [data-shcat]')) return; if (e.type === 'click' && e.target.closest('select')) return;      /* opening a picker isn't a change – redrawing then closed it at once */
    clearTimeout(sumT); sumT = setTimeout(function again() { var f = document.activeElement; if (f && f.tagName === 'SELECT' && f.closest('.sh-sec')) { sumT = setTimeout(again, 400); return; } if (showing === 'status') draw(); }, 400); }
  document.addEventListener('change', resum); document.addEventListener('click', resum);
  document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.classList && d.classList.contains('sh-sec')) secOpen[d.dataset.shsec] = d.open; }, true);
  function inviteSec(nm, joined) {
    var body = '<p class="st-note">' + esc('With ' + nm + ', on their phone: 1. Open ' + location.host + '/cmd/home and log in with their email. 2. Scan this code with the Camera app. 3. They choose their own passcode.') + '</p>' +
      '<div class="sh-qr" id="shQR"><button type="button" class="pill-btn" id="shShowQR"><i class="bi bi-qr-code"></i> Show the code</button></div>' +
      '<button type="button" class="st-row st-btn" id="shCopy"><span><i class="bi bi-link-45deg"></i> Copy the invite link instead<small class="st-rsub">Only send it somewhere private – it works like the code</small></span><i class="bi bi-copy"></i></button>';
    if (!joined) return '<p class="st-sub ap-sub"><i class="bi bi-qr-code"></i> Invite</p><div class="st-group sh-inv">' + body + '</div>';
    return sec('inv', 'qr-code', 'Invite again', nm + ' is set up · for a new phone or a forgotten passcode', body);
  }
  function pendHtml(nm, pend) {
    if (!Object.keys(pend).length) return '';
    return '<p class="st-sub ap-sub"><i class="bi bi-hourglass-split"></i> Waiting for your OK</p><div class="st-group" id="shPend">' + Object.keys(pend).map(function (id) { var f = pend[id].f; return '<div class="st-row sh-pend"><span>' + esc(f.note || 'Shared cost') + '<small class="st-rsub">' + esc(kr(f.total) + ' · ' + nm + ' paid · ' + new Date(f.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) + '</small></span><span class="sh-pend-b"><button type="button" class="text-btn danger" data-shpend="' + esc(id) + '|0">Decline</button><button type="button" class="pill-btn sm" data-shpend="' + esc(id) + '|1">OK</button></span></div>'; }).join('') + '</div>';
  }
  function sel(attr, v0, opts) { return '<select class="st-select" ' + attr + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v0) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function settingsMore(nm) {
    var pm = perm(), nmo = notifyMe(), cc = calCats();
    var cats = (function () { var c = rj('dash.calendar', {}).cats; return Array.isArray(c) && c.length ? c.map(function (x) { return [x.id, x.name]; }) : window.Cal && window.Cal.CAT_ORDER ? window.Cal.CAT_ORDER.map(function (id) { return [id, window.Cal.CATS[id].name]; }) : [['personal', 'Personal'], ['work', 'Work'], ['social', 'Social'], ['training', 'Training']]; })();
    var NOTE = [['cost', 'adds a shared cost'], ['settle', 'settles up'], ['event', 'adds an event'], ['shop', 'adds to the shopping list'], ['chore', 'does a chore'], ['note', 'adds or changes a note']];
    var nView = AREAS.filter(function (a) { return pm[a[0]] === 'view'; }).length, nNote = NOTE.filter(function (x) { return nmo[x[0]]; }).length, ap = approveOver();
    var catNames = cats.filter(function (c) { return cc.indexOf(c[0]) > -1; }).map(function (c) { return c[1]; });
    return sec('perm', 'pencil-square', 'What ' + nm + ' may change', nView ? (nView === AREAS.length ? 'Everything is view only' : nView + ' view only · the rest can change') : 'Can change everything shared',
        AREAS.map(function (a) { return '<label class="st-row"><span>' + esc(a[1]) + '</span>' + sel('data-shperm="' + a[0] + '"', pm[a[0]], [['edit', 'Can change'], ['view', 'View only']]) + '</label>'; }).join('')) +
      sec('cal', 'calendar-heart', 'Calendars shared automatically', catNames.length ? catNames.join(', ') : 'None – you tick events one by one',
        '<p class="st-note muted">Every event in these is shared – no need to tick each one.</p><div class="sh-cats">' + cats.map(function (c) { return '<button type="button" class="lf-chip" data-shcat="' + esc(c[0]) + '" aria-pressed="' + (cc.indexOf(c[0]) > -1) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>') +
      '<p class="st-sub ap-sub"><i class="bi bi-shield-check"></i> Rules</p>' +
      sec('money', 'cash-coin', 'Bigger shared costs', ap ? 'Ask me first above ' + kr(ap) : 'No OK needed',
        '<label class="st-row"><span>Ask me first above<small class="st-rsub">A cost ' + esc(nm) + ' paid and adds counts once you say OK – the samboer rule about agreeing on bigger buys</small></span>' + sel('data-shappr', ap, [[0, 'Never'], [1000, '1 000 kr'], [2000, '2 000 kr'], [5000, '5 000 kr'], [10000, '10 000 kr']]) + '</label>') +
      sec('note', 'bell', 'Tell me when ' + nm + '…', nNote ? nNote + ' of ' + NOTE.length + ' on' : 'Off',
        NOTE.map(function (x) { return '<label class="st-row"><span>…' + esc(x[1]) + '</span><input type="checkbox" class="switch" data-shnote="' + x[0] + '"' + (nmo[x[0]] ? ' checked' : '') + '></label>'; }).join('') +
        '<p class="st-note muted">In At a glance, and as a notification on your phone if notifications are on (Settings → Notifications).</p>');
  }
  document.addEventListener('change', function (e) {
    var t = e.target, a;
    if ((a = t.closest('[data-shperm]'))) { var pm = Object.assign({}, ((V.get() || {}).share || {}).perm || {}); pm[a.dataset.shperm] = a.value; setSt({ perm: pm }); schedule(200); toast('<i class="bi bi-check2"></i> Saved'); return; }
    if ((a = t.closest('[data-shappr]'))) { setSt({ approveOver: +a.value || 0 }); toast('<i class="bi bi-check2"></i> Saved'); return; }
    if ((a = t.closest('[data-shnote]'))) { var nn = Object.assign({}, notifyMe()); nn[a.dataset.shnote] = a.checked; setSt({ notifyMe: nn }); schedule(200); toast('<i class="bi bi-check2"></i> Saved'); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shcat], [data-shpend], #shPause'); if (!b) return; e.preventDefault();
    if (b.dataset.shcat) { var cc = calCats().slice(), i = cc.indexOf(b.dataset.shcat); if (i > -1) cc.splice(i, 1); else cc.push(b.dataset.shcat); setSt({ calCats: cc }); b.setAttribute('aria-pressed', String(i < 0)); schedule(200); window.dispatchEvent(new Event('cal:change')); return; }
    if (b.dataset.shpend) { var q = b.dataset.shpend.split('|'); approve(q[0], q[1] === '1'); return; }
    if (b.id === 'shPause') { var to = !(srvInfo && srvInfo.paused); b.disabled = true;
      SC.api('share?pause', { method: 'POST', body: { paused: to } }).then(function () { srvInfo = Object.assign({}, srvInfo || {}, { paused: to }); draw(); paintSum(); toast('<i class="bi bi-' + (to ? 'pause' : 'play') + '-circle"></i> ' + esc(to ? 'Sharing paused – ' + pname() + ' sees nothing for now' : 'Sharing resumed')); }, function () { b.disabled = false; toast('<i class="bi bi-exclamation-circle"></i> Couldn’t reach the server'); }); }
  });
  var noteEd = null;
  function notesHtml() {
    var l = Array.isArray(Fe.tools().homenotes) ? Fe.tools().homenotes : [];
    return '<p class="st-note muted">Pinned at the top of the chat – bin days, the Wi-Fi name, who to call when something breaks. You both see and change these. Don’t put passwords here.</p>' +
      l.map(function (n) {
        if (noteEd === n.id) return noteForm(n);
        return '<div class="st-row sh-note"><button type="button" class="sh-note-x" data-shnoteed="' + esc(n.id) + '"><b>' + esc(n.title || 'Note') + '</b><small>' + esc(String(n.text || '').split('\n')[0].slice(0, 80)) + '</small></button><button type="button" class="icon-btn sm" data-shnotedel="' + esc(n.id) + '" aria-label="Delete note"><i class="bi bi-trash3"></i></button></div>';
      }).join('') + (noteEd === 'new' ? noteForm(null) : '<button type="button" class="st-row st-btn" data-shnoteed="new"><span><i class="bi bi-plus-lg"></i> Add a note</span></button>');
  }
  function noteForm(n) {
    return '<form class="sh-noteform" data-shnoteform="' + esc(n ? n.id : 'new') + '"><input class="st-input" name="title" maxlength="60" placeholder="Title – e.g. Bins" value="' + esc(n ? n.title : '') + '" required><textarea class="st-input" name="text" rows="3" maxlength="1500" placeholder="e.g. Paper every other Tuesday, food waste Fridays">' + esc(n ? n.text : '') + '</textarea>' +
      '<div class="sh-noteacts"><button type="button" class="text-btn" data-shnotecancel>Cancel</button><button type="submit" class="pill-btn">Save</button></div></form>';
  }
  function drawNotes() { var b = document.getElementById('shNotes'); if (b) b.innerHTML = notesHtml(); var f = b && b.querySelector('[name=title]'); if (f && !f.value) f.focus(); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shnoteed], [data-shnotedel], [data-shnotecancel]'); if (!b) return; e.preventDefault();
    if (b.dataset.shnoteed) { noteEd = b.dataset.shnoteed; drawNotes(); return; }
    if (b.hasAttribute('data-shnotecancel')) { noteEd = null; drawNotes(); return; }
    var id = b.dataset.shnotedel, t = Fe.tools(), l = Array.isArray(t.homenotes) ? t.homenotes : [], at = l.findIndex(function (x) { return x.id === id; }); if (at < 0) return;
    var gone = l[at]; t.homenotes = l.filter(function (x) { return x.id !== id; }); Fe.saveTools(t); drawNotes();
    toast('<i class="bi bi-trash3"></i> ' + esc(gone.title || 'Note') + ' deleted', function () { var t2 = Fe.tools(), l2 = Array.isArray(t2.homenotes) ? t2.homenotes.slice() : []; l2.splice(at, 0, gone); t2.homenotes = l2; Fe.saveTools(t2); drawNotes(); });
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-shnoteform]'); if (!f) return; e.preventDefault();
    var title = f.title.value.trim(), text = f.text.value.trim(); if (!title) { f.title.focus(); return; }
    var t = Fe.tools(), l = Array.isArray(t.homenotes) ? t.homenotes : (t.homenotes = []), id = f.dataset.shnoteform;
    if (id === 'new') l.push({ id: 'n' + Date.now().toString(36), title: title, text: text }); else l.forEach(function (x) { if (x.id === id) { x.title = title; x.text = text; } });
    Fe.saveTools(t); noteEd = null; drawNotes(); toast('<i class="bi bi-check2"></i> Saved');
  });


  /* ---------- Chat (cmd/chat.js): a button in the bar, a panel on the right (computer) or the whole screen (phone) ---------- */
  function chatSec(sw) {
    var T = window.HomeChat ? HomeChat.TTLS : [], cur = window.HomeChat ? HomeChat.ttl() : 0;
    return '<button type="button" class="st-row st-btn" data-hcopen><span><i class="bi bi-chat-heart"></i> Open the chat<small class="st-rsub">Messages, photos and files – only your two phones can read them</small></span><i class="bi bi-chevron-right"></i></button>' +
      '<div class="st-row sh-ttl"><span><i class="bi bi-stopwatch"></i> Messages disappear after<small class="st-rsub">For both of you – ' + esc(pname()) + ' sees when you change it</small></span></div><div class="sh-ttlb">' +
      T.map(function (t) { return '<button type="button" class="lf-chip' + (cur === t[0] ? ' on' : '') + '" data-hcttl="' + t[0] + '" aria-pressed="' + (cur === t[0]) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
      (sw.notes ? '<p class="st-minor sh-pinh"><i class="bi bi-pin-angle"></i> Pinned</p><div id="shNotes">' + notesHtml() + '</div>' : '');
  }
  function partnerLook() { var lk = null; Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.c === 'pme' && !r.del && r.f && r.f.look) lk = r.f.look; }); if (lk) return lk; var pp = (Fe.tools().people || []).filter(function (x) { return x && x.shp; })[0]; return pp && pp.look || null; }
  function faceOf(side) {
    var A = window.Avatar, lk = side === 'o' ? (A && A.look ? A.look() : null) : partnerLook();
    if (!A || !A.figure || !lk) return '<span><i class="bi bi-person"></i></span>';
    try { return '<span>' + A.figure(A.MOMENTS && A.MOMENTS.day || { k: 'day', bg: '#1d2533', sky: 'sun', i: 'sun', c: '#f2c94c' }, lk) + '</span>'; } catch (e) { return '<span><i class="bi bi-person"></i></span>'; }
  }
  var chatOn = false, chatBtn = null, chatOv = null;
  function chatInit() {
    var s = st(); if (!s || !window.HomeChat) return;
    if (chatOn) return; chatOn = true;
    HomeChat.init({ key: s.key, me: 'o', no: false,
      name: function (side) { return side === 'o' ? (owner() || 'You') : pname(); },
      face: faceOf,
      notes: { on: function () { return !!what().notes; }, list: function () { return (Array.isArray(Fe.tools().homenotes) ? Fe.tools().homenotes : []).map(function (n) { return { id: n.id, title: n.title || '', text: n.text || '' }; }); },
        add: function (title, text) { var t = Fe.tools(); t.homenotes = (Array.isArray(t.homenotes) ? t.homenotes : []).concat([{ id: 'n' + Date.now().toString(36), title: title, text: text || '' }]); Fe.saveTools(t); drawNotes(); },
        remove: function (id) { var t = Fe.tools(); t.homenotes = (Array.isArray(t.homenotes) ? t.homenotes : []).filter(function (x) { return x.id !== id; }); Fe.saveTools(t); drawNotes(); } },
      onChange: chatBadge });
    chatButton();
  }
  function chatButton() {
    if (chatBtn && document.body.contains(chatBtn)) return;
    var host = document.querySelector('.mb-acts') || document.querySelector('.top-actions') || document.querySelector('#fp > .fp-top'); if (!host) return;
    chatBtn = document.createElement('button'); chatBtn.type = 'button'; chatBtn.className = 'icon-btn hc-barbtn'; chatBtn.setAttribute('data-hcopen', '');
    chatBtn.setAttribute('aria-label', 'Chat with ' + pname()); chatBtn.title = 'Chat with ' + pname();
    chatBtn.innerHTML = '<i class="bi bi-chat-heart"></i><b class="hc-badge" hidden></b>';
    host.insertBefore(chatBtn, host.querySelector('#quickAdd') || host.querySelector('[data-search]') || host.firstChild);
    chatBadge();
  }
  function chatBadge() {
    if (!chatBtn || !window.HomeChat) return; var n = HomeChat.unread(), b = chatBtn.querySelector('.hc-badge');
    b.hidden = !n || !!chatOv; b.textContent = n > 9 ? '9+' : String(n);
    chatBtn.setAttribute('aria-label', 'Chat with ' + pname() + (n ? ' – ' + n + ' new' : ''));
  }
  function openChat() {
    if (!window.HomeChat || !st()) return; chatInit();
    if (chatOv) return;
    chatOv = document.createElement('div'); chatOv.className = 'hc-ov'; chatOv.innerHTML = '<div class="hc-ovbox"></div>'; document.body.appendChild(chatOv);
    document.documentElement.classList.add('hc-open');
    requestAnimationFrame(function () { chatOv.classList.add('in'); });
    HomeChat.mount(chatOv.firstChild, { full: true, onClose: closeChat }); fitOv(); chatBadge();
    var ta = chatOv.querySelector('textarea'); if (ta && matchMedia('(hover: hover) and (pointer: fine)').matches) ta.focus();
  }
  function closeChat() { if (!chatOv) return; var o = chatOv; chatOv = null; if (HomeChat.isOpen()) HomeChat.unmount(); document.documentElement.classList.remove('hc-open'); o.classList.remove('in'); setTimeout(function () { o.remove(); }, 220); chatBadge(); }
  /* phone keyboard: the chat fills what is left of the screen */
  function fitOv() { if (!chatOv) return; var vv = window.visualViewport; if (!vv || innerWidth >= 900) { chatOv.style.top = ''; chatOv.style.height = ''; return; } chatOv.style.top = vv.offsetTop + 'px'; chatOv.style.height = vv.height + 'px'; }
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitOv); visualViewport.addEventListener('scroll', fitOv); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hcopen]'); if (b) { e.preventDefault(); var stp = document.getElementById('settings'); if (stp && !stp.hidden && b.closest('#settings')) { var cl = document.getElementById('stClose'); if (cl) cl.click(); } openChat(); return; }
    var t = e.target.closest('[data-hcttl]'); if (t && window.HomeChat) { HomeChat.setTtl(+t.dataset.hcttl); t.parentNode.querySelectorAll('[data-hcttl]').forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-pressed', String(x === t)); }); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && chatOv && !chatOv.querySelector('.hc-menu')) closeChat(); });
  if (/[?&#]chat\b/.test(location.search + location.hash)) V.onUnlock(function () { setTimeout(function () { chatInit(); openChat(); }, 600); });
  V.onUnlock(function () { setTimeout(chatInit, 1200); });
  window.addEventListener('hashchange', function () { if (location.hash === '#chat') { history.replaceState(null, '', location.pathname + location.search); openChat(); } });
  /* At a glance: new messages */
  (window.BriefExtra = window.BriefExtra || []).push(function (add) {
    if (!st() || !window.HomeChat) return; var n = HomeChat.unread(), m = HomeChat.last(); if (!n || !m) return;
    add(62, 'chat-heart', '#e5484d', n === 1 ? pname() + ': ' + (m.text || (m.files.length ? 'sent a file' : '')).slice(0, 80) : n + ' new messages from ' + pname(), 'Chat', '#chat', { act: { id: 'hc:' + m.id, label: 'Open' }, run: openChat });
  });
  /* their app, read-only, in a phone-sized frame */
  function previewApp() {
    var s = st(); if (!s) return;
    var bg = document.createElement('div'); bg.className = 'sh-prev-bg';
    bg.innerHTML = '<div class="sh-prev"><div class="sh-prev-head"><b><i class="bi bi-phone"></i> ' + esc(pname()) + '’s app</b><button type="button" class="icon-btn sm" data-shprevx aria-label="Close"><i class="bi bi-x-lg"></i></button></div><iframe title="Preview" src="/cmd/home/#preview&k=' + s.key + '"></iframe></div>';
    document.body.appendChild(bg); requestAnimationFrame(function () { bg.classList.add('open'); });
    var close = function () { bg.remove(); document.removeEventListener('keydown', esc1, true); }, esc1 = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc1, true);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-shprevx]')) close(); });
  }
  function peek() {
    var box = document.getElementById('shPeekBox'); if (!box) return;
    box.hidden = !box.hidden; if (box.hidden) return;
    box.innerHTML = '<p class="st-note muted">Looking …</p>';
    sync().then(function () {
      var by = {}; Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.del || !r.c || r.c === 'info') return; (by[r.c] = by[r.c] || []).push(r.f); });
      var NM = { pme: ['Their profile and avatar', 'name'], proj: ['House projects', 'name'], doc: ['Documents', 'name'], clog: ['Chore log', 'name'], meal: ['Dinner plan', 'text'], bill: ['Home bills', 'name'], trip: ['Trips', 'name'], note: ['Home notes', 'title'], shop: ['Shopping list', 'text'], chore: ['Chores', 'name'], cdone: ['Chores ticked off', 'k'], sx: ['Shared costs', 'note'], pay: ['Settled up', 'amount'], ev: ['Calendar events', 'title'], plant: ['Plants', 'name'], mv: ['Moving checklist', 'text'] };
      var keys = Object.keys(NM).filter(function (c) { return by[c] && by[c].length; });
      box.innerHTML = keys.length ? '<ul class="sh-peek">' + keys.map(function (c) { var l = by[c]; return '<li><b>' + esc(NM[c][0]) + ' · ' + l.length + '</b><small>' + esc(l.slice(0, 4).map(function (f) { return String(f[NM[c][1]] == null ? '' : f[NM[c][1]]); }).join(', ') + (l.length > 4 ? ' …' : '')) + '</small></li>'; }).join('') + '</ul><p class="st-note muted">That is all that is in the shared box – nothing else is sent.</p>'
        : '<p class="st-note muted">Nothing shared yet.</p>';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#shStart, #shShowQR, #shCopy, #shPeek, #shStop, #shSaveEmail, #shPrev'); if (!b) return;
    e.preventDefault();
    if (b.id === 'shPrev') { sync().then(previewApp); return; }
    if (b.id === 'shStart') {
      var em = (document.getElementById('shEmail') || {}).value || '', nmIn = document.getElementById('shName'), msg = document.getElementById('shMsg');
      if (!partner() && nmIn && !nmIn.value.trim()) { nmIn.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim())) { document.getElementById('shEmail').focus(); if (msg) msg.textContent = 'Type the email they log in with.'; return; }
      var name = partner() ? partner().name : nmIn.value.trim();
      b.disabled = true; if (msg) msg.textContent = 'Setting up …';
      SC.api('share', { method: 'PUT', body: { partner: em.trim(), name: name } }).then(function () {
        var d = V.get(), old = d.share || {};
        setSt({ key: old.key && old.on === false ? SC.genKey() : (old.key || SC.genKey()), on: true, name: name, since: dkey(new Date()) });
        cache = {}; seen = {}; wj('dash.share.seen2', {});
        draw(); sync(); toast('<i class="bi bi-people"></i> Sharing with ' + esc(name) + ' – show them the code');
      }, function (er) { b.disabled = false; if (msg) msg.textContent = er && er.status === 400 ? 'That email doesn’t look right.' : 'Couldn’t reach the server – try again.'; });
      return;
    }
    if (b.id === 'shShowQR') {
      var q = document.getElementById('shQR'); q.innerHTML = '<p class="muted">Making the code …</p>';
      loadQR().then(function (qr) { var c = qr(0, 'M'); c.addData(link()); c.make(); q.innerHTML = '<div class="sh-qrimg">' + c.createSvgTag({ cellSize: 5, margin: 3, scalable: true }) + '</div><button type="button" class="text-btn" id="shHideQR">Hide the code</button>'; },
        function () { q.innerHTML = '<p class="muted">Couldn’t make the code – use Copy the invite link.</p>'; });
      return;
    }
    if (b.id === 'shCopy') { var L = link(); (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(L) : Promise.reject()).then(function () { toast('<i class="bi bi-link-45deg"></i> Invite link copied'); }, function () { prompt('Invite link', L); }); return; }
    if (b.id === 'shPeek') { peek(); return; }
    if (b.id === 'shSaveEmail') {
      var e2 = document.getElementById('shEmail').value.trim();
      SC.api('share', { method: 'PUT', body: { partner: e2, name: pname() } }).then(function () { b.hidden = true; toast('<i class="bi bi-check2"></i> Saved – they scan the code again'); draw(); }, function () { toast('<i class="bi bi-exclamation-circle"></i> Couldn’t save the email'); });
      return;
    }
    if (b.id === 'shStop') {
      if (!b.dataset.armed) { b.dataset.armed = '1'; document.getElementById('shStopL').textContent = 'Tap again to stop sharing'; setTimeout(function () { delete b.dataset.armed; var l = document.getElementById('shStopL'); if (l) l.textContent = 'Stop sharing'; }, 4000); return; }
      SC.api('share', { method: 'DELETE' }).then(function () {
        setSt({ on: false, key: null, files: {} }); cache = {}; seen = {}; wj('dash.share.seen2', {}); draw(); marks(); calRow();
        toast('<i class="bi bi-x-octagon"></i> Stopped sharing – ' + esc(pname()) + ' no longer has access');
      }, function () { toast('<i class="bi bi-exclamation-circle"></i> Couldn’t reach the server – nothing changed'); });
    }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('#shHideQR')) { var q = document.getElementById('shQR'); if (q) q.innerHTML = '<button type="button" class="pill-btn" id="shShowQR"><i class="bi bi-qr-code"></i> Show the code</button>'; } });
  document.addEventListener('input', function (e) { if (e.target.id === 'shEmail' && st()) { var s = document.getElementById('shSaveEmail'); if (s) s.hidden = !e.target.value.trim() || (srvInfo && e.target.value.trim().toLowerCase() === srvInfo.partner); } });
  document.addEventListener('change', function (e) {
    var i = e.target.closest('[data-shwhat]'); if (!i) return;
    var d = V.get(), w = Object.assign({}, (d.share || {}).what || {}); w[i.dataset.shwhat] = i.checked; setSt({ what: w }); marks(); calRow(); schedule(200);
    toast('<i class="bi bi-check2"></i> ' + (i.checked ? 'Shared' : 'No longer shared'));
  });
  window.addEventListener('st:page', function (e) { if (e.detail === 'sharesp') setTimeout(draw, 0); });
  /* Admin → Shared home */
  window.ShareSpace.drawSettings = function () { draw(); };
  V.onUnlock(function () { setTimeout(function () { paintSum(); marks(); calRow(); }, 400); });
})();
