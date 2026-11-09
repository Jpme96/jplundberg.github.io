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
  var WHAT = [['shop', 'Shopping list', 'cart3'], ['meals', 'Dinner plan', 'egg-fried'], ['chores', 'Chores', 'arrow-repeat'], ['money', 'Money between you', 'people'], ['bills', 'Home bills – their part', 'receipt'], ['cal', 'Calendar events you tick', 'calendar-heart'], ['trips', 'Trips you tick', 'airplane'], ['plants', 'Plants', 'flower1'], ['move', 'Moving checklist', 'box-seam'], ['notes', 'Home notes', 'sticky'], ['house', 'House projects and documents you tick', 'house-heart']];
  var PARTNER_ONLY = { pme: 1 };          /* records only the other person writes – never removed from here */
  function what() { var s = (V.get() || {}).share || {}; var o = {}; WHAT.forEach(function (w) { o[w[0]] = !(s.what && s.what[w[0]] === false); }); return o; }
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
      /* plan payments, bill splits and paying back come from your own budget: only their sum is shared */
      info.extra = Math.round((S.balance(p.id) - simple) * 100) / 100;
    }
    put('info', 'info', info);
    if (w.shop) (Array.isArray(t.shop) ? t.shop : []).forEach(function (x) { if (x && x.id) put('shop', x.id, { text: String(x.text || '').slice(0, 120), done: !!x.done }); });
    if (w.chores) {
      (Array.isArray(t.chores) ? t.chores : []).forEach(function (x) { if (x && x.id) put('chore', x.id, { name: String(x.name || '').slice(0, 80), every: x.every || '1w', day: +x.day || 0, who: x.who || 'rotate', start: x.start || '' }); });
      var cd = t.choreDone || {}, since = dkey(new Date(Date.now() - 70 * 864e5));
      Object.keys(cd).forEach(function (k) { if (k.slice(0, 7) >= since.slice(0, 7)) put('cdone', k, { k: k, who: cd[k] }); });
    }
    if (w.cal) (rj('dash.calendar', {}).events || []).forEach(function (e) { if (e && e.share && e.id) put('ev', e.id, { title: String(e.title || '').slice(0, 120), date: e.date, end: e.end, allDay: !!e.allDay, start: e.start, stop: e.stop, repeat: e.repeat, until: e.until, location: String(e.location || '').slice(0, 160) }); });
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
  function applyAll(list) {
    if (!list.length) return;
    var t = Fe.tools(), toolsCh = false, cal = null, tv = null, p = partner();
    list.forEach(function (r) {
      var c = r.c, id = r.id, f = r.f || {}, del = !!r.del;
      if (c === 'shop') { var l = Array.isArray(t.shop) ? t.shop : (t.shop = []), i = l.findIndex(function (x) { return x.id === id; });
        if (del) { if (i > -1) { l.splice(i, 1); toolsCh = true; } } else if (i > -1) { l[i] = Object.assign({}, l[i], { text: f.text, done: !!f.done }); toolsCh = true; } else { l.push({ id: id, text: f.text || '', done: !!f.done, from: 'shared' }); toolsCh = true; } }
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
      else if (c === 'meal') { t.meals = t.meals && typeof t.meals === 'object' && !Array.isArray(t.meals) ? t.meals : {}; if (del) delete t.meals[id]; else if (f.text) t.meals[f.date || id] = f.text; toolsCh = true; }
      else if (c === 'note') { var nl = Array.isArray(t.homenotes) ? t.homenotes : (t.homenotes = []), ni = nl.findIndex(function (x) { return x.id === id; });
        if (del) { if (ni > -1) nl.splice(ni, 1); } else if (ni > -1) nl[ni] = Object.assign({}, nl[ni], { title: f.title || '', text: f.text || '' }); else nl.push({ id: id, title: f.title || '', text: f.text || '', by: 'partner' }); toolsCh = true; }
      else if (c === 'trip' && !del) { tv = tv || rj('dash.travel', {}); (tv.trips || []).forEach(function (tr) { if (tr.id !== id || !Array.isArray(f.pack)) return; var old = {}; (tr.pack || []).forEach(function (x) { old[x.t] = x; }); tr.pack = f.pack.map(function (x) { return Object.assign({}, old[x.t] || {}, { t: x.t, done: !!x.done }); }); }); }
      else if (c === 'pme' && !del) {
        var lk = SC.cleanLook(f.look), nm = (p && p.name) || f.name || pname(); t.people = Array.isArray(t.people) ? t.people : [];
        var pp = t.people.filter(function (x) { return String(x.name || '').toLowerCase() === String(nm).toLowerCase(); })[0];
        if (!pp) { pp = { id: 'sh' + Date.now().toString(36), name: nm, rel: 'family' }; t.people.push(pp); }
        if (lk && JSON.stringify(pp.look || {}) !== JSON.stringify(lk)) { pp.look = lk; toolsCh = true; } else if (!pp.look) toolsCh = true;
        if (f.bday && /^\d{1,2}\.\d{1,2}(\.\d{4})?$/.test(f.bday) && pp.bday !== f.bday) { pp.bday = f.bday; toolsCh = true; }
        if (f.phone && /^[+\d\s()-]{4,20}$/.test(f.phone) && pp.phone !== f.phone) { pp.phone = f.phone; toolsCh = true; }
      }
      else if (c === 'mv' && !del && t.hmove && Array.isArray(t.hmove.items)) { t.hmove.items.forEach(function (x) { if (x.id === id && !!x.done !== !!f.done) { x.done = !!f.done; toolsCh = true; } }); }
    });
    if (toolsCh) { quiet = true; Fe.saveTools(t); quiet = false; window.dispatchEvent(new Event('fin:change')); }
    if (cal) { wj('dash.calendar', cal); window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('cal:change')); }
    if (tv) { quiet = true; wj('dash.travel', tv); window.dispatchEvent(new Event('dash:local')); window.dispatchEvent(new Event('travel:change')); quiet = false; }
  }

  /* ---------- sync ---------- */
  var unsure = {}, cache = {}, rids = {}, seen = rj('dash.share.seen', {}), busy = false, again = false, quiet = false, lastOk = 0, lastErr = '';
  function ridOf(k, c, id) { var x = c + '|' + id; if (rids[x]) return Promise.resolve(rids[x]); return SC.rid(k, c, id).then(function (r) { rids[x] = r; return r; }); }
  function absorb(k, srv) {
    var recs = (srv && srv.recs) || {}, jobs = [];
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
      Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.by === 'p' && r.t > (seen[rid] || 0) && r.c) mine.push({ c: r.c, id: r.id, f: r.f, del: r.del }); seen[rid] = Math.max(seen[rid] || 0, r.t); });
      applyAll(mine); wj('dash.share.seen', seen);
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
      Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (!have[rid] && !r.del && !r.bad && r.c && !PARTNER_ONLY[r.c] && !unsure[r.c]) push[rid] = { t: now, del: 1 }; });
      return Promise.all(jobs).then(function () {
        if (!Object.keys(push).length) return null;
        return SC.api('shared', { method: 'PUT', body: { recs: push } }).then(function (srv) { return absorb(k, srv); });
      });
    }).then(function () { lastOk = Date.now(); lastErr = ''; busy = false; paintSum(); if (again) { again = false; schedule(500); } },
      function (e) { busy = false; lastErr = (e && e.status === 401) ? 'Signed out – reload' : 'Couldn’t reach the server'; paintSum(); if (again) { again = false; schedule(5000); } });
  }
  var tm = null;
  function schedule(ms) { if (!st()) return; clearTimeout(tm); tm = setTimeout(sync, ms == null ? 1500 : ms); }
  ['tools:change', 'cal:change', 'fin:change', 'travel:change', 'avatar:change'].forEach(function (ev) { window.addEventListener(ev, function () { if (!quiet) schedule(); }); });
  V.onUnlock(function () { cache = {}; schedule(1200); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(300); });
  setInterval(function () { if (!document.hidden && st()) sync(); }, 45000);

  /* ---------- "Visible to …" on the cards that are shared ---------- */
  var VIS = [['#shop', 'shop'], ['#chores', 'chores'], ['#plants', 'plants'], ['#shared', 'money'], ['#hshared', 'money']];
  function marks() {
    var on = !!st(), w = on ? what() : {};
    VIS.forEach(function (v) {
      var h = document.querySelector(v[0] + ' > .card-head h2'); if (!h) return;
      var m = h.querySelector('.sh-vis'), want = on && w[v[1]];
      if (want && !m) { m = document.createElement('span'); m.className = 'sh-vis'; m.innerHTML = '<i class="bi bi-people"></i> <span></span>'; h.appendChild(m); }
      if (m && !want) m.remove(); else if (m) { var tx = 'Visible to ' + pname(); if (m.lastChild.textContent !== tx) { m.lastChild.textContent = tx; m.title = 'Shared with ' + pname() + ' – Settings → Shared space'; } }
    });
  }
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
  window.ShareSpace = { kitRow: function (k) { return st() && what().house && KITS[k] ? 'Share with ' + pname() : ''; }, kitHelp: function (k) { return KITS[k] || ''; }, syncFiles: syncFiles, on: function () { return !!st(); }, name: pname, calRow: calRow, sync: sync, collect: collect, what: what };

  /* ---------- Settings → Shared space ---------- */
  var srvInfo = null, showing = null;
  function paintSum() {
    var el = document.getElementById('sumShare'); if (el) el.textContent = st() ? 'With ' + pname() + (lastErr ? ' · ' + lastErr : '') : 'Off';
    if (showing === 'status') { var s2 = document.getElementById('shStatus'); if (s2) s2.innerHTML = statusLine(); }
  }
  function statusLine() {
    if (lastErr) return '<i class="bi bi-exclamation-circle"></i> ' + esc(lastErr);
    if (!lastOk) return '<i class="bi bi-arrow-repeat"></i> Syncing …';
    return '<i class="bi bi-check2-circle"></i> In sync · ' + new Date(lastOk).toTimeString().slice(0, 5) + (srvInfo && !srvInfo.joined ? ' · waiting for ' + esc(pname()) + ' to scan the code' : srvInfo && srvInfo.joined ? ' · ' + esc(pname()) + ' has joined' : '');
  }
  function link() { var s = st(); return s ? location.origin + '/cmd/home/#k=' + s.key : ''; }
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = '/cmd/vendor/qrcode.js'; sc.onload = function () { res(window.qrcode); }; sc.onerror = rej; document.head.appendChild(sc); });
  }
  function draw() {
    var box = document.getElementById('stShare'); if (!box) return;
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
    box.innerHTML = '<p class="st-sub ap-sub"><i class="bi bi-people"></i> Sharing with ' + esc(nm) + '</p>' +
      '<div class="st-group"><p class="st-note" id="shStatus">' + statusLine() + '</p></div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-qr-code"></i> Invite</p><div class="st-group sh-inv">' +
        '<p class="st-note">' + esc('With ' + nm + ', on their phone: 1. Open ' + location.host + '/cmd/home and log in with their email. 2. Scan this code with the Camera app. 3. They choose their own passcode.') + '</p>' +
        '<div class="sh-qr" id="shQR"><button type="button" class="pill-btn" id="shShowQR"><i class="bi bi-qr-code"></i> Show the code</button></div>' +
        '<button type="button" class="st-row st-btn" id="shCopy"><span><i class="bi bi-link-45deg"></i> Copy the invite link instead<small class="st-rsub">Only send it somewhere private – it works like the code</small></span><i class="bi bi-copy"></i></button></div>' +
      '<p class="st-sub ap-sub"><i class="bi bi-ui-checks"></i> What ' + esc(nm) + ' sees</p><div class="st-group">' + WHAT.map(function (w) {
        return '<label class="st-row"><span><i class="bi bi-' + w[2] + '"></i> ' + esc(w[1]) + (w[0] === 'money' && !p ? '<small class="st-rsub">Add them in Finances → Shared expenses first</small>' : '') + '</span><input type="checkbox" class="switch" data-shwhat="' + w[0] + '"' + (sw[w[0]] ? ' checked' : '') + '></label>';
      }).join('') + '<button type="button" class="st-row st-btn" id="shPeek"><span><i class="bi bi-eye"></i> Show exactly what ' + esc(nm) + ' sees</span><i class="bi bi-chevron-down"></i></button><div id="shPeekBox" hidden></div></div>' +
      (sw.notes ? '<p class="st-sub ap-sub"><i class="bi bi-sticky"></i> Home notes</p><div class="st-group" id="shNotes">' + notesHtml() + '</div>' : '') +
      '<div class="st-group"><label class="st-row"><span>Their email<small class="st-rsub">Change it if they log in with another one</small></span><input class="st-input" id="shEmail" type="email" inputmode="email" autocomplete="off" value="' + esc(srvInfo && srvInfo.partner || '') + '"></label><button type="button" class="st-row st-btn" id="shSaveEmail" hidden><span>Save email</span><i class="bi bi-check2"></i></button></div>' +
      '<div class="st-group"><button type="button" class="st-row st-btn danger-txt" id="shStop"><span><i class="bi bi-x-octagon"></i> <span id="shStopL">Stop sharing</span><small class="st-rsub">They lose access at once, the shared box and key are removed. Your own data stays as it is.</small></span></button></div>';
    SC.api('share').then(function (j) { srvInfo = j; var e = document.getElementById('shEmail'); if (e && !e.value) e.value = j.partner || ''; paintSum(); }, function () {});
  }
  var noteEd = null;
  function notesHtml() {
    var l = Array.isArray(Fe.tools().homenotes) ? Fe.tools().homenotes : [];
    return '<p class="st-note muted">Bin days, the Wi-Fi name, who to call when something breaks – you both see and change these. Don’t put passwords here.</p>' +
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
  function peek() {
    var box = document.getElementById('shPeekBox'); if (!box) return;
    box.hidden = !box.hidden; if (box.hidden) return;
    box.innerHTML = '<p class="st-note muted">Looking …</p>';
    sync().then(function () {
      var by = {}; Object.keys(cache).forEach(function (rid) { var r = cache[rid]; if (r.del || !r.c || r.c === 'info') return; (by[r.c] = by[r.c] || []).push(r.f); });
      var NM = { proj: ['House projects', 'name'], doc: ['Documents', 'name'], clog: ['Chore log', 'name'], meal: ['Dinner plan', 'text'], bill: ['Home bills', 'name'], trip: ['Trips', 'name'], note: ['Home notes', 'title'], shop: ['Shopping list', 'text'], chore: ['Chores', 'name'], cdone: ['Chores ticked off', 'k'], sx: ['Shared costs', 'note'], pay: ['Settled up', 'amount'], ev: ['Calendar events', 'title'], plant: ['Plants', 'name'], mv: ['Moving checklist', 'text'] };
      var keys = Object.keys(NM).filter(function (c) { return by[c] && by[c].length; });
      box.innerHTML = keys.length ? '<ul class="sh-peek">' + keys.map(function (c) { var l = by[c]; return '<li><b>' + esc(NM[c][0]) + ' · ' + l.length + '</b><small>' + esc(l.slice(0, 4).map(function (f) { return String(f[NM[c][1]] == null ? '' : f[NM[c][1]]); }).join(', ') + (l.length > 4 ? ' …' : '')) + '</small></li>'; }).join('') + '</ul><p class="st-note muted">That is all that is in the shared box – nothing else is sent.</p>'
        : '<p class="st-note muted">Nothing shared yet.</p>';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#shStart, #shShowQR, #shCopy, #shPeek, #shStop, #shSaveEmail'); if (!b) return;
    e.preventDefault();
    if (b.id === 'shStart') {
      var em = (document.getElementById('shEmail') || {}).value || '', nmIn = document.getElementById('shName'), msg = document.getElementById('shMsg');
      if (!partner() && nmIn && !nmIn.value.trim()) { nmIn.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim())) { document.getElementById('shEmail').focus(); if (msg) msg.textContent = 'Type the email they log in with.'; return; }
      var name = partner() ? partner().name : nmIn.value.trim();
      b.disabled = true; if (msg) msg.textContent = 'Setting up …';
      SC.api('share', { method: 'PUT', body: { partner: em.trim(), name: name } }).then(function () {
        var d = V.get(), old = d.share || {};
        setSt({ key: old.key && old.on === false ? SC.genKey() : (old.key || SC.genKey()), on: true, name: name, since: dkey(new Date()) });
        cache = {}; seen = {}; wj('dash.share.seen', {});
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
        setSt({ on: false, key: null, files: {} }); cache = {}; seen = {}; wj('dash.share.seen', {}); draw(); marks(); calRow();
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
  V.onUnlock(function () { setTimeout(function () { paintSum(); marks(); calRow(); }, 400); });
})();
