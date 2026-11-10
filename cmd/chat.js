/* Chat between the two of you – used by the dashboard (share.js) and the shared home app (home/app.js).
   Messages and files are encrypted on the phone with the shared key (ShareCore); the server only stores them
   (/cmd/api/chat, /cmd/api/cfile) and removes them when they are older than the time you chose.
   Live bits (typing, seen, new messages) come from ShareCore.live – checked every 1.5 s while the chat is open.
   HomeChat.init(opt) once, then HomeChat.mount(el, {full, onClose}) wherever it is shown.
   opt: { key, me: 'o'|'p', name(side), face(side) → html, no: bool, notes: { list() → [{id,title,text}], add(title, text), remove(id) }, onChange() } */
(function () {
  var SC = window.ShareCore; if (!SC) return;
  var other = function () { return C.opt.me === 'o' ? 'p' : 'o'; };
  var C = { opt: null, msgs: {}, rev: -1, ttl: 0, busy: false, again: false, typing: {}, seen: {}, skew: 0, el: null, mo: null, urls: {}, pend: [], open: false, picked: [], pinsOpen: false };
  var TTLS = [[0, 'Forever', 'For alltid'], [864e5, '24 hours', '24 timer'], [7 * 864e5, '1 week', '1 uke'], [30 * 864e5, '1 month', '1 måned']];
  function L(en, no) { return C.opt && C.opt.no ? no : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hex(n) { return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(n)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function rj(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ttlName(ms) { var t = TTLS.filter(function (x) { return x[0] === ms; })[0] || TTLS[0]; return L(t[1], t[2]); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace('.0', '') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB'; }
  function hm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function dayName(t) {
    var d = new Date(t), now = new Date(), k = function (x) { return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate(); }, y = new Date(); y.setDate(y.getDate() - 1);
    if (k(d) === k(now)) return L('Today', 'I dag'); if (k(d) === k(y)) return L('Yesterday', 'I går');
    return d.toLocaleDateString(C.opt.no ? 'nb-NO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  var readKey = function () { return 'hchat.read.' + C.opt.me; };
  function notes() { var n = C.opt && C.opt.notes; return n && (!n.on || n.on()) ? n : null; }

  /* ---------- data ---------- */
  function fetchChat() {
    if (!C.opt) return Promise.resolve();
    if (C.busy) { C.again = true; return Promise.resolve(); }
    C.busy = true;
    C.dTry = Date.now();
    return SC.api('chat').then(function (srv) {
      C.dOk = Date.now(); C.dSrv = { rev: srv.rev, n: Object.keys(srv.msgs || {}).filter(function (k) { return !(srv.msgs[k] || {}).del; }).length };
      var recs = srv.msgs || {}, jobs = [], seen = {}, bad = 0, badIds = [], H0 = hiddenHere();
      Object.keys(recs).forEach(function (id) {
        var r = recs[id]; seen[id] = 1;
        if (r.del) { delete C.msgs[id]; return; }
        if (C.msgs[id] && !C.msgs[id].pending) return;
        jobs.push(dec(r).then(function (o) { C.msgs[id] = shape(id, r, o); }, function () { if (!H0[id]) { bad++; badIds.push({ id: id, by: r.by }); } }));
      });
      return Promise.all(jobs).then(function () {
        Object.keys(C.msgs).forEach(function (id) { if (!seen[id] && !C.msgs[id].pending && !C.msgs[id].failed) delete C.msgs[id]; });   /* gone: removed or too old */
        C.rev = srv.rev; C.ttl = srv.ttl || 0; C.mute = srv.mute || {}; C.bad = bad; C.badIds = badIds; if (srv.fileMax) C.fileMax = srv.fileMax;
      });
    }).then(function () { C.busy = false; C.missing = false; changed(); if (C.again) { C.again = false; fetchChat(); } }, function (e) { C.busy = false; C.dErr = (e && (e.status || e.message)) || 'error'; if (e && e.status === 404 && !C.missing) { C.missing = true; changed(); } });
  }
  /* a message as shown here; reactions and mute are tiny messages of their own (hidden in the list) */
  function shape(id, r, o) {
    return { id: id, t: r.t, by: r.by, text: String(o.text || '').slice(0, 20000), files: Array.isArray(o.files) ? o.files.slice(0, 10) : [], sys: o.sys || null, ttl: +o.ttl || 0,
      react: o.react && o.react.to ? { to: String(o.react.to), e: String(o.react.e || '').slice(0, 16) } : null,
      mute: o.mute != null ? (+o.mute || 0) : null,
      re: o.re && o.re.id ? { id: String(o.re.id), by: o.re.by === 'o' ? 'o' : 'p', x: String(o.re.x || '').slice(0, 140) } : null };
  }
  function hid(m) { return !!(m.react || m.mute != null); }
  function hideKey() { return 'hchat.hide.' + C.opt.me; }
  function hiddenHere() { if (!C.hide) C.hide = rj(hideKey(), {}) || {}; return C.hide; }
  function visible() { var H = hiddenHere(); return list().filter(function (m) { return !hid(m) && !H[m.id]; }); }
  /* reactions: the newest one from each of you counts (an empty one takes yours away) */
  function reactions() { var R = {}; list().forEach(function (m) { if (m.react) { (R[m.react.to] = R[m.react.to] || {})[m.by] = m.react.e; } }); return R; }
  function muteOf(side) { if (C.mute && C.mute[side] != null) return +C.mute[side] || 0; var u = 0; list().forEach(function (m) { if (m.mute != null && m.by === side) u = m.mute; }); return u; }
  function list() {
    var now = Date.now();
    return Object.keys(C.msgs).map(function (id) { return C.msgs[id]; }).filter(function (m) { return !C.ttl || m.pending || now - m.t < C.ttl; }).sort(function (a, b) { return a.t - b.t; });
  }
  function unread() { var r = +rj(readKey(), 0) || 0, o = other(); return visible().filter(function (m) { return m.by === o && !m.sys && m.t > r; }).length; }
  function last() { var l = visible().filter(function (m) { return !m.sys; }); return l[l.length - 1] || null; }
  function markRead() {
    var l = list(); if (!l.length || !C.open || document.hidden) return;
    var mx = l[l.length - 1].t, r = +rj(readKey(), 0) || 0;
    if (mx > r) { wj(readKey(), mx); SC.livePost({ seen: mx }); if (C.opt.onChange) C.opt.onChange(); badge(); }
  }
  function changed() { if (C.opt.onChange) C.opt.onChange(); badge(); if (C.el) paintList(); }

  /* ---------- sending ---------- */
  function put(body) { return SC.api('chat', { method: 'PUT', body: body }); }
  function encFile(f) {
    /* pictures are made smaller (longest side 2048 px) and get a tiny preview that shows at once */
    var isImg = /^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
    /* … and a small copy (longest side 720 px) that the chat and the gallery load first – quick on mobile data; the full picture loads when you open it */
    var prep = isImg && !/gif/i.test(f.type) ? shrink(f, 2048, 0.85).then(function (big) { return Promise.all([shrink(f, 40, 0.5), shrink(f, 720, 0.72).catch(function () { return null; })]).then(function (r) { return { blob: big.blob, w: big.w, h: big.h, th: r[0].url, pv: big.w > 760 || big.h > 760 ? r[1] && r[1].blob : null, type: 'image/jpeg', name: f.name.replace(/\.\w+$/, '') + '.jpg' }; }); }, function () { return { blob: f, type: f.type, name: f.name }; })
      : Promise.resolve({ blob: f, type: f.type || 'application/octet-stream', name: f.name || 'file' });
    return prep.then(function (p) {
      var max = C.fileMax || 24 * 1048576; if (p.blob.size > max) throw new Error(L('Too big – the limit is ', 'For stor – grensen er ') + Math.round(max / 1048576) + ' MB');
      var fid = hex(16), pid = p.pv ? hex(16) : '';
      var up = function (id, blob) { return blob.arrayBuffer().then(function (buf) { return SC.encryptBytes(C.opt.key, buf); }).then(function (enc) { return fetch('/cmd/api/cfile?id=' + id, { method: 'PUT', body: enc, credentials: 'same-origin' }); }); };
      return Promise.all([up(fid, p.blob), pid ? up(pid, p.pv).catch(function () { return null; }) : null]).then(function (rs) { var r = rs[0], pr = rs[1];
        if (r.status === 413) throw new Error(L('Too big for the server', 'For stor for serveren')); if (!r.ok) throw new Error(L('The file could not be sent', 'Filen kunne ikke sendes')); C.urls[fid] = URL.createObjectURL(p.blob);
        if (!(pr && pr.ok)) pid = '';
        var o = { id: fid, name: String(p.name).slice(0, 120), type: String(p.type).slice(0, 60), size: p.blob.size, w: p.w || 0, h: p.h || 0, th: p.th || '', dur: +f._dur || 0 }; if (pid) o.pv = pid; return o; });
    });
  }
  function shrink(file, max, q) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(u);
        if (max <= 64) { res({ url: cv.toDataURL('image/jpeg', q), w: w, h: h }); return; }
        cv.toBlob(function (b) { b ? res({ blob: b, w: w, h: h }) : rej(new Error('no blob')); }, 'image/jpeg', q); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('not an image')); };
      im.src = u;
    });
  }
  function send(text, files, extra) {
    text = String(text || '').trim(); files = files || [];
    if (!text && !files.length && !extra) return Promise.resolve();
    var id = hex(16), t = Date.now() - C.skew * 0, m = { id: id, t: t, by: C.opt.me, text: text, files: files.map(function (f) { return { id: 'tmp', name: f.name, type: f.type, size: f.size, dur: +f._dur || 0, local: URL.createObjectURL(f) }; }), sys: extra && extra.sys || null, ttl: extra && extra.ttl || 0,
      react: extra && extra.react || null, mute: extra && extra.mute != null ? extra.mute : null, re: extra && extra.re || null, pending: true };
    C.msgs[id] = m; changed(); if (!hid(m)) scrollEnd(true);
    var go = function () {
      m.failed = false; m.pending = true; changed();
      return Promise.all(files.map(encFile)).then(function (fl) {
        var body = { text: text, files: fl }; if (m.sys) { body.sys = m.sys; body.ttl = m.ttl; } if (m.react) body.react = m.react; if (m.mute != null) body.mute = m.mute; if (m.re) body.re = m.re;
        return SC.encrypt(C.opt.key, body).then(function (e) { var b = { msgs: {} }; b.msgs[id] = { t: t, iv: e.iv, ct: e.ct, fl: fl.reduce(function (a, f) { a.push(f.id); if (f.pv) a.push(f.pv); return a; }, []) }; if (extra && extra.setTtl != null) b.ttl = extra.setTtl; return put(b); })
          .then(function (srv) { m.files = fl; m.pending = false; C.rev = -2; if (srv && srv.ttl != null) C.ttl = srv.ttl; changed(); fetchChat(); if (!m.react && m.mute == null && !m.sys) nudge(text, fl); });
      }).catch(function (e) { m.pending = false; m.failed = true; m.err = (e && e.message) || ''; changed(); });
    };
    m.retry = go;
    SC.livePost({ stop: 1 });
    return go();
  }
  /* a push to their phone – unless they are looking at the chat right now */
  function nudge(text, fl) {
    var o = other(), s = +C.seen[o] || 0, tp = +C.typing[o] || 0, now = Date.now() + C.skew;
    if (now - Math.max(s, tp) < 20000) return;
    if (muteOf(o) > Date.now()) return;                 /* they muted the chat */
    var body = text ? text.slice(0, 120) : fl.length ? (fl.some(function (f) { return /^audio\//.test(f.type); }) ? L('🎤 Voice message', '🎤 Talemelding') : fl.some(function (f) { return /^image\//.test(f.type); }) ? L('📷 Photo', '📷 Bilde') : fl.some(function (f) { return /^video\//.test(f.type); }) ? L('🎬 Video', '🎬 Video') : L('📎 File', '📎 Fil')) : '';
    if (!body) return;
    SC.api('push', { method: 'POST', body: { notify: { title: C.opt.name(C.opt.me), body: body, tag: 'chat' } } }).catch(function () {});
  }
  function remove(id) { var m = C.msgs[id]; if (!m || m.by !== C.opt.me) return; if (m.pending || m.failed) { delete C.msgs[id]; changed(); return; } delete C.msgs[id]; changed(); put({ del: [id] }).then(fetchChat, fetchChat); }
  function react(id, e) { var cur = (reactions()[id] || {})[C.opt.me] || ''; send('', [], { react: { to: id, e: cur === e ? '' : e } }); }
  /* muting is stored as a setting on the server (it doesn't disappear with disappearing messages) */
  function setMute(until) { C.mute = Object.assign({}, C.mute || {}); C.mute[C.opt.me] = until; changed(); put({ mute: until }).then(function (srv) { if (srv && srv.mute) C.mute = srv.mute; changed(); }, function () {}); }
  function setTtl(ms) { if (ms === C.ttl) return; send('', [], { sys: 'ttl', ttl: ms, setTtl: ms }); C.ttl = ms; }

  /* ---------- files on screen ---------- */
  /* the current key first, then earlier ones (messages sent before a new invite) */
  function allKeys() { var o = typeof C.opt.keys === 'function' ? C.opt.keys() : C.opt.keys; return [C.opt.key].concat((Array.isArray(o) ? o : []).filter(function (k) { return k && k !== C.opt.key; })); }
  function dec(r) { var ks = allKeys(), i = 0; var next = function () { if (i >= ks.length) return Promise.reject(new Error('no key')); var k = ks[i++]; return SC.decrypt(k, r).catch(next); }; return next(); }
  function decBytes(buf) { var ks = allKeys(), i = 0; var next = function () { if (i >= ks.length) return Promise.reject(new Error('no key')); var k = ks[i++]; return SC.decryptBytes(k, buf).catch(next); }; return next(); }
  function fileUrl(f) {
    if (f.local) return Promise.resolve(f.local);
    if (C.urls[f.id]) return Promise.resolve(C.urls[f.id]);
    if (C.urls[f.id + ':p']) return C.urls[f.id + ':p'];
    var p = fetch('/cmd/api/cfile?id=' + f.id, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('gone'); return r.arrayBuffer(); })
      .then(function (buf) { return decBytes(buf); }).then(function (pt) { var u = URL.createObjectURL(new Blob([pt], { type: f.type || 'application/octet-stream' })); C.urls[f.id] = u; return u; });
    C.urls[f.id + ':p'] = p; p.catch(function () { delete C.urls[f.id + ':p']; });
    return p;
  }
  /* a picture in the list or gallery: the small copy when there is one (and the full one isn't here already) */
  function smallUrl(f) { if (!f.pv || f.local || C.urls[f.id]) return fileUrl(f); return fileUrl({ id: f.pv, type: 'image/jpeg' }); }
  function loadImgs() {
    if (!C.el) return;
    C.el.querySelectorAll('img[data-fid]:not([data-ok]), video[data-fid]:not([data-ok])').forEach(function (im) {
      var m = C.msgs[im.dataset.mid], f = m && m.files.filter(function (x) { return x.id === im.dataset.fid; })[0]; if (!f) return;
      im.setAttribute('data-ok', '1'); (im.tagName === 'IMG' ? smallUrl(f) : fileUrl(f)).then(function (u) { im.src = u; im.classList.add('on'); }, function () { im.classList.add('gone'); });
      if (im.tagName === 'VIDEO') return;
    });
  }
  function download(f) {
    fileUrl(f).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = f.name || 'file'; document.body.appendChild(a); a.click(); a.remove(); }, function () { toast(L('That file is gone', 'Den filen er borte')); });
  }

  /* ---------- the screen ---------- */
  function css() {
    if (document.getElementById('hcCss')) return;
    var s = document.createElement('style'); s.id = 'hcCss';
    s.textContent = [
      '.hc{--hc-acc:var(--acc,var(--accent,#14b8a6));--hc-line:var(--line,rgba(127,127,127,.22));--hc-mut:var(--muted,#8a8f98);--hc-bg:var(--bg,#111);--hc-them:rgba(127,127,127,.16);display:flex;flex-direction:column;height:100%;min-height:0;background:var(--hc-bg);color:var(--text,inherit);position:relative;font-size:15px}',
      '.hc-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--hc-line);flex:none}',
      '.hc-head .hc-faces{display:flex;flex:none}.hc-head .hc-faces>*{width:38px;height:38px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:rgba(127,127,127,.15)}.hc-head .hc-faces>*+*{margin-left:-12px;box-shadow:0 0 0 2px var(--hc-bg)}',
      '.hc-head .hc-faces svg{width:100%;height:100%}',
      '.hc-note{display:block;font-size:.78em;opacity:.65;margin:-2px 0 6px;padding:0 24px;line-height:1.35}',
      '.hc-on{display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;margin-right:5px;vertical-align:1px}',
      '.hc-tt{flex:1;min-width:0}.hc-tt b{display:block;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hc-tt small{display:block;color:var(--hc-mut);font-size:12.5px;min-height:16px}',
      '.hc-tt small.typ{color:var(--hc-acc)}',
      '.hc-ib{flex:none;width:38px;height:38px;border-radius:50%;border:0;background:transparent;color:inherit;font-size:18px;display:grid;place-items:center;cursor:pointer}.hc-ib>i{display:block;line-height:1;width:1em;height:1em}.hc-ib>i::before{display:block;vertical-align:0;line-height:1}.hc-ib>svg{display:block;flex:none}.hc-ib:hover{background:rgba(127,127,127,.12)}',
      '.hc-pins{flex:none;border-bottom:1px solid var(--hc-line);font-size:13.5px}.hc-pins>button{width:100%;display:flex;align-items:center;gap:8px;padding:8px 14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.hc-pins>button .bi-pin-angle-fill{color:var(--hc-acc)}.hc-pins>button span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hc-pins ul{list-style:none;margin:0;padding:0 10px 8px;max-height:40vh;overflow:auto}',
      '.hc-pins li{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:10px;background:rgba(127,127,127,.08);margin-top:6px}.hc-pins li div{flex:1;min-width:0}.hc-pins li b{display:block;font-size:13.5px}.hc-pins li p{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--hc-mut)}',
      '.hc-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 6px;display:flex;flex-direction:column;gap:2px;-webkit-overflow-scrolling:touch}',
      '.hc-day{align-self:center;font-size:12px;color:var(--hc-mut);background:rgba(127,127,127,.1);padding:3px 10px;border-radius:999px;margin:10px 0 6px;text-transform:capitalize}',
      '.hc-sys{align-self:center;font-size:12.5px;color:var(--hc-mut);text-align:center;margin:6px 16px;display:flex;gap:6px;align-items:center}',
      '.hc-m{display:flex;max-width:82%;align-self:flex-start;flex-direction:column;align-items:flex-start}.hc-m.me{align-self:flex-end;align-items:flex-end}.hc-m.gap{margin-top:8px}',
      '.hc-b{padding:7px 12px;border-radius:18px;background:var(--hc-them);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.35;user-select:text;-webkit-user-select:text;max-width:100%}',
      '.hc-m.me .hc-b{background:var(--hc-acc);color:#fff}.hc-m:not(.me).cont .hc-b{border-top-left-radius:6px}.hc-m.me.cont .hc-b{border-top-right-radius:6px}',
      '.hc-b a{color:inherit;text-decoration:underline}',
      '.hc-m.pending{opacity:.6}.hc-m.failed .hc-b{background:rgba(224,85,85,.18);color:inherit}',
      '.hc-meta{font-size:11px;color:var(--hc-mut);margin:2px 6px 0;display:flex;gap:6px;align-items:center}.hc-meta .bi{font-size:12px}.hc-meta button{border:0;background:none;color:#e05555;font-size:11.5px;padding:0;cursor:pointer;text-decoration:underline}',
      '.hc-imgs{display:grid;gap:3px;margin-bottom:3px;border-radius:16px;overflow:hidden;max-width:min(280px,70vw)}.hc-imgs.n2,.hc-imgs.n3,.hc-imgs.n4{grid-template-columns:1fr 1fr}',
      '.hc-imgs button{border:0;padding:0;display:block;background-size:cover;background-position:center;cursor:zoom-in;position:relative;min-height:90px;background-color:rgba(127,127,127,.15)}',
      '.hc-imgs img{display:block;width:100%;height:100%;max-height:340px;object-fit:cover;opacity:0;transition:opacity .2s}.hc-imgs.n1 button{max-height:340px;min-height:0}.hc-imgs.n1 button[style*=aspect-ratio] img{max-height:none}.hc-imgs img.on{opacity:1}.hc-imgs.n2 img,.hc-imgs.n3 img,.hc-imgs.n4 img{aspect-ratio:1}',
      '.hc-file{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;background:var(--hc-them);border:0;color:inherit;margin-bottom:3px;cursor:pointer;text-align:left;max-width:100%}',
      '.hc-m.me .hc-file{background:color-mix(in srgb,var(--hc-acc) 22%,transparent)}.hc-file .bi{font-size:22px;color:var(--hc-acc)}.hc-file span{min-width:0}.hc-file b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.hc-file small{color:var(--hc-mut);font-size:12px}',
      '.hc-typing{align-self:flex-start;background:var(--hc-them);border-radius:18px;padding:10px 14px;display:flex;gap:4px;margin-top:8px}.hc-typing i{width:7px;height:7px;border-radius:50%;background:var(--hc-mut);animation:hcDot 1.2s infinite}.hc-typing i:nth-child(2){animation-delay:.15s}.hc-typing i:nth-child(3){animation-delay:.3s}',
      '@keyframes hcDot{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-3px)}}',
      '.hc-empty{margin:auto;text-align:center;color:var(--hc-mut);padding:20px;max-width:300px}.hc-empty .bi{font-size:34px;color:var(--hc-acc);display:block;margin-bottom:6px}',
      '.hc-down{position:absolute;right:14px;bottom:76px;border:0;border-radius:999px;background:var(--hc-acc);color:#fff;padding:7px 12px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}',
      '.hc-comp{flex:none;display:flex;flex-direction:column;gap:6px;padding:8px 10px calc(8px + var(--hc-safe,0px));border-top:1px solid var(--hc-line);background:var(--hc-bg)}',
      '.hc-row{display:flex;align-items:flex-end;gap:6px}.hc-row textarea{flex:1;min-width:0;resize:none;border:1px solid var(--hc-line);border-radius:20px;padding:9px 14px;font:inherit;font-size:max(16px,calc(16px / var(--hc-zoom,1)));line-height:1.3;max-height:140px;background:rgba(127,127,127,.08);color:inherit;outline:none}',
      '.hc-row textarea:focus{border-color:var(--hc-acc)}.hc-send{background:var(--hc-acc)!important;color:#fff!important}.hc-send:disabled{opacity:.4}',
      '.hc-chips{display:flex;gap:6px;overflow-x:auto}.hc-chips span{flex:none;display:flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:999px;background:rgba(127,127,127,.14);font-size:12.5px;max-width:200px}.hc-chips span em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.hc-chips button{border:0;background:none;color:inherit;cursor:pointer;padding:2px}',
      '.hc-menu{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;z-index:5}.hc-menu>div{width:100%;max-width:440px;background:var(--hc-bg);border-radius:18px 18px 0 0;padding:8px 8px calc(10px + var(--hc-safe,0px));box-shadow:0 -8px 30px rgba(0,0,0,.3)}',
      '.hc-diag{font-size:11.5px!important;opacity:.8;word-break:break-word}.hc-menu p{margin:8px 12px 6px;font-size:12.5px;color:var(--hc-mut)}.hc-menu button{width:100%;display:flex;align-items:center;gap:12px;padding:12px;border:0;background:none;color:inherit;font:inherit;text-align:left;border-radius:12px;cursor:pointer}.hc-menu button:hover{background:rgba(127,127,127,.1)}',
      '.hc-menu button .bi{font-size:18px;width:22px;text-align:center}.hc-menu button.on .bi-check2{color:var(--hc-acc)}.hc-menu button.red{color:#e05555}.hc-menu .hc-quote{margin:4px 12px 8px;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.1);font-size:13.5px;max-height:90px;overflow:hidden;white-space:pre-wrap}',
      '.hc-view{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100;display:flex;align-items:center;justify-content:center}.hc-view img{max-width:100vw;max-height:100vh;object-fit:contain}.hc-view .hc-ib{position:absolute;top:calc(12px + env(safe-area-inset-top));width:40px;height:40px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.22);box-shadow:0 2px 10px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}.hc-view .hc-ib:hover{background:rgba(0,0,0,.65)}',
      '.hc-q{display:flex;flex-direction:column;align-items:flex-start;gap:1px;max-width:100%;border:0;border-left:3px solid var(--hc-acc);background:rgba(127,127,127,.12);color:inherit;padding:5px 10px;border-radius:10px;margin-bottom:3px;font-size:12.5px;text-align:left;cursor:pointer}.hc-q b{font-size:12px;color:var(--hc-acc)}.hc-q span{opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}',
      '.hc-rx{display:flex;margin:-8px 10px 0;position:relative;z-index:1}.hc-rx button{display:inline-flex;align-items:center;gap:1px;height:22px;border:2px solid var(--hc-bg);background:color-mix(in srgb,var(--text,#888) 14%,var(--hc-bg));color:inherit;border-radius:999px;padding:0 5px;font-size:12px;line-height:1;cursor:pointer}.hc-rx button small{font-size:11px;margin-left:3px;opacity:.8;font-weight:600}',
      '.hc-voice{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:18px;background:var(--hc-them);min-width:190px;margin-bottom:3px}.hc-m.me .hc-voice{background:var(--hc-acc);color:#fff}.hc-voice button{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.22);color:inherit;font-size:18px;display:grid;place-items:center;cursor:pointer}.hc-m:not(.me) .hc-voice button{background:var(--hc-acc);color:#fff}',
      '.hc-vbar{flex:1;height:4px;border-radius:2px;background:rgba(127,127,127,.35);overflow:hidden}.hc-vbar i{display:block;height:100%;width:0;background:currentColor}.hc-voice small{font-size:11.5px;opacity:.85;font-variant-numeric:tabular-nums}',
      '.hc-vid{display:block;max-width:min(280px,70vw);max-height:340px;border-radius:16px;margin-bottom:3px;background:#000}',
      '.hc-m.hl .hc-b,.hc-m.hl .hc-imgs,.hc-m.hl .hc-voice{box-shadow:0 0 0 3px color-mix(in srgb,var(--hc-acc) 55%,transparent)}',
      '.hc-emos{display:flex;justify-content:space-between;gap:2px;padding:6px 6px 10px;border-bottom:1px solid var(--hc-line);margin-bottom:4px}.hc-menu .hc-emos button{width:auto;flex:1;justify-content:center;padding:6px 0;font-size:24px;border-radius:12px;gap:0}.hc-menu .hc-emos button.mine{background:color-mix(in srgb,var(--hc-acc) 22%,transparent)}',
      '.hc-emogrid{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;max-height:46vh;overflow:auto;padding:4px}.hc-menu .hc-emogrid button{justify-content:center;padding:6px 0;font-size:24px;gap:0}',
      '.hc-replybar{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-left:3px solid var(--hc-acc);background:rgba(127,127,127,.1);border-radius:10px;font-size:13px}.hc-replybar span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hc-replybar b{color:var(--hc-acc);margin-right:4px}.hc-replybar button{border:0;background:none;color:inherit;cursor:pointer;font-size:16px}',
      '.hc-rec{display:flex;align-items:center;gap:10px;padding:4px 4px 4px 12px;border-radius:22px;background:rgba(229,72,77,.12)}.hc-rec .dot{width:10px;height:10px;border-radius:50%;background:#e5484d;animation:hcRec 1s infinite}.hc-rec b{flex:1;font-variant-numeric:tabular-nums;font-weight:600}',
      '@keyframes hcRec{50%{opacity:.25}}',
      '.hc-plan{display:flex;flex-direction:column;gap:8px;padding:4px 12px 8px}.hc-plan input{font:inherit;font-size:16px;padding:9px 12px;border-radius:12px;border:1px solid var(--hc-line);background:rgba(127,127,127,.08);color:inherit}.hc-plan .row{display:flex;gap:8px}.hc-plan .row input{flex:1;min-width:0}.hc-menu .hc-plan button.go{justify-content:center;background:var(--hc-acc);color:#fff;font-weight:600}',
      '.hc-gal{position:absolute;inset:0;z-index:4;background:var(--hc-bg);display:flex;flex-direction:column}.hc-gal .g{flex:1;overflow:auto;padding:10px}.hc-gal .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}.hc-gal .grid button{aspect-ratio:1;border:0;padding:0;background:rgba(127,127,127,.15) center/cover;cursor:zoom-in;border-radius:4px;overflow:hidden}.hc-gal .grid img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}.hc-gal .grid img.on{opacity:1}',
      '.hc-gal h4{margin:14px 2px 6px;font-size:13px;color:var(--hc-mut);font-weight:600}.hc-gal .hc-file{width:100%}',
      '.hc-cam{position:absolute;inset:0;z-index:6;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}.hc-cam video{max-width:100%;max-height:75%;border-radius:12px}.hc-cam .acts{display:flex;gap:12px}.hc-cam .acts button{border:0;border-radius:999px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}.hc-cam .snap{background:#fff;color:#000}.hc-cam .no{background:rgba(255,255,255,.18);color:#fff}',
      '.hc [hidden]{display:none!important}',
      '.hc-msgs{display:flex;flex-direction:column;gap:5px;flex:1 0 auto}.hc-list>.hc-typing{flex:none}html.hc-lock,html.hc-lock body{overflow:hidden!important;overscroll-behavior:none}',
      '.hc-list{gap:5px;padding:12px 14px 8px}.hc-m.gap{margin-top:12px}.hc-meta{margin-top:3px;margin-bottom:2px}.hc-b{padding:8px 13px}.hc-rx{margin-bottom:2px}',
      '.hc-menu>div{max-height:78%;overflow-y:auto}.hc-chiprow{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px}.hc-menu .hc-chiprow .hc-chip{width:auto;flex:1 1 0;justify-content:center;gap:5px;padding:8px 10px;border-radius:999px;background:rgba(127,127,127,.12);font-size:14px;white-space:nowrap}.hc-menu .hc-chiprow .hc-chip.on{background:var(--hc-acc);color:#fff}.hc-menu .hc-chiprow .hc-chip .bi{width:auto;font-size:15px}.hc-menu p .bi{margin-right:4px}',
      '.hc.selecting .hc-m[data-mid]{cursor:pointer;position:relative;padding-left:30px}.hc.selecting .hc-m.me[data-mid]{padding-left:0;padding-right:0}.hc.selecting .hc-more{display:none}',
      '.hc.selecting .hc-m[data-mid]::before{content:"";position:absolute;left:4px;top:50%;width:18px;height:18px;margin-top:-9px;border-radius:50%;border:2px solid var(--hc-mut)}.hc.selecting .hc-m.me[data-mid]::before{left:auto;right:calc(100% + 10px)}',
      '.hc.selecting .hc-m.sel[data-mid]::before{background:var(--hc-acc);border-color:var(--hc-acc);box-shadow:inset 0 0 0 3px var(--hc-bg)}.hc-m.sel .hc-b,.hc-m.sel .hc-imgs,.hc-m.sel .hc-voice,.hc-m.sel .hc-file{opacity:.75}',
      '.hc-selbar{display:flex;align-items:center;gap:10px;padding:4px 2px}.hc-selbar b{flex:1;text-align:center;font-weight:600}.hc-selbar button{border:0;border-radius:999px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer}.hc-selx{background:rgba(127,127,127,.14);color:inherit}.hc-seldel{background:#e5484d;color:#fff}.hc-seldel:disabled{opacity:.4}',
      '.hc-menu,.hc-menu *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
      '@media (pointer:coarse){.hc-list,.hc-list *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}}',
      '.hc-list{touch-action:manipulation}.hc-pop-heart{position:absolute;z-index:7;font-size:44px;pointer-events:none;transform:translate(-50%,-50%) scale(.3);animation:hcHeart .7s ease-out forwards}@keyframes hcHeart{40%{transform:translate(-50%,-60%) scale(1.15);opacity:1}100%{transform:translate(-50%,-110%) scale(1);opacity:0}}',
      '.hc-toast{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);background:#222428;color:#fff;padding:8px 14px;border-radius:999px;font-size:13px;z-index:6;white-space:nowrap}',
      '@media (hover:hover){.hc-m{position:relative}.hc-more{position:absolute;top:2px;opacity:0;border:0;background:rgba(127,127,127,.18);color:inherit;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px}.hc-m:not(.me) .hc-more{right:-32px}.hc-m.me .hc-more{left:-32px}.hc-m:hover .hc-more{opacity:1}}',
      '@media (hover:none){.hc-more{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  /* online now / last active – only known over the instant line (LiveRoom) */
  function presence(o) {
    if (C.missing) return '';
    if (C.online && C.online[o]) return '<span class="hc-on"></span>' + esc(L('Active now', 'Aktiv nå'));
    var t = C.last && +C.last[o]; if (!t) return '';
    var m = Math.max(0, Math.round((Date.now() + C.skew - t) / 60000));
    if (m > 7 * 1440) return '';
    return esc(m < 1 ? L('Active just now', 'Aktiv akkurat nå') : m < 60 ? L('Active ' + m + ' min ago', 'Aktiv for ' + m + ' min siden') : m < 1440 ? L('Active ' + Math.round(m / 60) + ' h ago', 'Aktiv for ' + Math.round(m / 60) + ' t siden') : L('Active ' + Math.round(m / 1440) + ' d ago', 'Aktiv for ' + Math.round(m / 1440) + ' d siden'));
  }
  function head() {
    var o = other(), tp = +C.typing[o] || 0, now = Date.now() + C.skew, typing = now - tp < 7000;
    return '<div class="hc-head">' + (C.full ? '<button type="button" class="hc-ib" data-hcclose aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-chevron-left"></i></button>' : '') +
      '<div class="hc-faces">' + C.opt.face(o) + '</div>' +   /* only the person you're talking to, like any messenger */
      '<div class="hc-tt"><b>' + esc(C.opt.name(o)) + '</b><small class="' + (typing ? 'typ' : '') + '">' + (typing ? esc(L('typing …', 'skriver …')) : presence(o) ? presence(o) + (C.ttl ? ' · <i class="bi bi-stopwatch" title="' + esc(L('Messages disappear after ', 'Meldinger forsvinner etter ') + ttlName(C.ttl)) + '"></i>' : '') : C.ttl ? '<i class="bi bi-stopwatch"></i> ' + esc(L('Messages disappear after ', 'Meldinger forsvinner etter ') + ttlName(C.ttl)) : esc(L('Private – just you two', 'Privat – bare dere to'))) + (muteOf(C.opt.me) > Date.now() ? ' <i class="bi bi-bell-slash" title="' + esc(L('Muted until ', 'Dempet til ') + hm(muteOf(C.opt.me))) + '"></i>' : '') + '</small></div>' +
      '<button type="button" class="hc-ib" data-hcmenu aria-label="' + L('Chat settings', 'Chatinnstillinger') + '"><i class="bi bi-three-dots"></i></button>' + (C.pop ? '<button type="button" class="hc-ib" data-hcclose aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button>' : '') + '</div>';
  }
  function pins() {
    var l = notes() ? notes().list() : []; if (!l.length) return '';
    return '<div class="hc-pins"><button type="button" data-hcpins><i class="bi bi-pin-angle-fill"></i><span>' + esc(C.pinsOpen ? L('Pinned', 'Festet') + ' (' + l.length + ')' : l.map(function (n) { return n.title || L('Note', 'Notat'); }).join(' · ')) + '</span><i class="bi bi-chevron-' + (C.pinsOpen ? 'up' : 'down') + '"></i></button>' +
      (C.pinsOpen ? '<ul>' + l.map(function (n) { return '<li><div><b>' + esc(n.title || L('Note', 'Notat')) + '</b>' + (n.text ? '<p>' + linkify(n.text) + '</p>' : '') + '</div><button type="button" class="hc-ib" data-hcpin="' + esc(n.id) + '" aria-label="' + L('More', 'Mer') + '"><i class="bi bi-three-dots"></i></button></li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  function msgHtml(m, prev) {
    var me = m.by === C.opt.me, cont = prev && !prev.sys && prev.by === m.by && m.t - prev.t < 180000 && dayName(prev.t) === dayName(m.t);
    if (m.sys === 'ttl') return '<div class="hc-sys"><i class="bi bi-stopwatch"></i> ' + esc((me ? L('You', 'Du') : C.opt.name(m.by)) + (m.ttl ? L(' set messages to disappear after ', ' satte meldinger til å forsvinne etter ') + ttlName(m.ttl) : L(' turned off disappearing messages', ' slo av at meldinger forsvinner'))) + '</div>';
    var imgs = m.files.filter(function (f) { return /^image\//.test(f.type); }), voice = m.files.filter(function (f) { return /^audio\//.test(f.type); }), vids = m.files.filter(function (f) { return /^video\//.test(f.type); }),
      other = m.files.filter(function (f) { return !/^(image|audio|video)\//.test(f.type); });
    var h = '<div class="hc-m' + (me ? ' me' : '') + (cont ? ' cont' : ' gap') + (m.pending ? ' pending' : '') + (m.failed ? ' failed' : '') + (C.sel && C.sel[m.id] ? ' sel' : '') + '" data-mid="' + m.id + '">';
    if (m.re) h += '<button type="button" class="hc-q" data-hcgo="' + esc(m.re.id) + '"><b>' + esc(m.re.by === C.opt.me ? L('You', 'Du') : C.opt.name(m.re.by)) + '</b><span>' + esc(m.re.x || '…') + '</span></button>';
    voice.forEach(function (f) { h += '<div class="hc-voice" data-mid="' + m.id + '" data-fid="' + esc(f.id) + '"><button type="button" data-hcplay="' + esc(f.id) + '" aria-label="' + L('Play', 'Spill av') + '"><i class="bi bi-play-fill"></i></button><span class="hc-vbar"><i></i></span><small>' + dur(f.dur) + '</small></div>'; });
    vids.forEach(function (f) { var u = f.local || C.urls[f.id]; h += '<video class="hc-vid" controls playsinline preload="metadata" data-mid="' + m.id + '" data-fid="' + esc(f.id) + '"' + (u ? ' src="' + u + '" data-ok="1"' : '') + '></video>'; });
    if (imgs.length) h += '<div class="hc-imgs n' + Math.min(4, imgs.length) + '">' + imgs.map(function (f) { var u = f.local || C.urls[f.id] || (f.pv && C.urls[f.pv]), ar = f.w && f.h && imgs.length === 1 ? 'aspect-ratio:' + f.w + '/' + f.h + ';' : ''; return '<button type="button" data-hcimg="' + esc(f.id) + '" style="' + ar + (f.th ? 'background-image:url(' + f.th + ')' : '') + '"><img alt="" data-mid="' + m.id + '" data-fid="' + esc(f.id) + '"' + (u ? ' src="' + u + '" class="on" data-ok="1"' : '') + '></button>'; }).join('') + '</div>';
    other.forEach(function (f) { h += '<button type="button" class="hc-file" data-hcfile="' + esc(f.id) + '"><i class="bi bi-file-earmark' + (/pdf/.test(f.type) ? '-pdf' : '') + '"></i><span><b>' + esc(f.name) + '</b><small>' + kb(f.size || 0) + '</small></span></button>'; });
    if (m.text) h += '<div class="hc-b">' + linkify(m.text) + '</div>';
    var rx = (C._rx || {})[m.id], cnt = {}; if (rx) Object.keys(rx).forEach(function (who) { var e = rx[who]; if (e) { cnt[e] = cnt[e] || { n: 0, mine: false }; cnt[e].n++; if (who === C.opt.me) cnt[e].mine = true; } });
    var ek = Object.keys(cnt), tot = ek.reduce(function (a, e) { return a + cnt[e].n; }, 0);
    if (ek.length) h += '<div class="hc-rx"><button type="button" data-hcrx="' + m.id + '" aria-label="' + esc(L('Reactions', 'Reaksjoner')) + '">' + ek.map(esc).join('') + (tot > 1 ? '<small>' + tot + '</small>' : '') + '</button></div>';
    h += '<button type="button" class="hc-more" data-hcmore aria-label="' + L('More', 'Mer') + '"><i class="bi bi-three-dots"></i></button></div>';
    return h;
  }
  function dur(sec) { sec = Math.round(+sec || 0); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function metaFor(m, isLastMine) {
    if (m.failed) return '<div class="hc-meta">' + esc(m.err || L('Not sent', 'Ikke sendt')) + ' · <button type="button" data-hcretry="' + m.id + '">' + L('Try again', 'Prøv igjen') + '</button></div>';
    if (m.pending) return '<div class="hc-meta"><i class="bi bi-clock"></i> ' + L('Sending …', 'Sender …') + '</div>';
    var seenIt = isLastMine && (+C.seen[other()] || 0) >= m.t;
    return '<div class="hc-meta">' + hm(m.t) + (isLastMine ? ' · ' + (seenIt ? '<i class="bi bi-check2-all"></i> ' + L('Seen', 'Sett') : '<i class="bi bi-check2"></i> ' + L('Sent', 'Sendt')) : '') + '</div>';
  }
  function listHtml() {
    if (C.missing) return '<div class="hc-empty"><i class="bi bi-cloud-arrow-up"></i>' + esc(C.opt.missing || L('The chat is not switched on yet – the server needs an update.', 'Chatten er ikke slått på ennå – serveren må oppdateres.')) + '</div>';
    var l = visible(); C._rx = reactions(); var badN = C.bad ? '<div class="hc-sys" style="flex-wrap:wrap;justify-content:center"><i class="bi bi-exclamation-circle"></i> ' + esc(C.bad + L(' old message(s) can’t be opened – they were sent with an earlier invite.', ' gamle melding(er) kan ikke åpnes – de ble sendt med en tidligere invitasjon.')) + ' <button type="button" data-hcbadrm style="border:0;background:none;color:var(--hc-acc);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline">' + L('Remove them', 'Fjern dem') + '</button></div>' : '';
    if (!l.length) return badN + '<div class="hc-empty"><i class="bi bi-chat-heart"></i>' + esc(L('Say hi to ', 'Si hei til ') + C.opt.name(other())) + '<br><small>' + esc(L('Messages, photos and files – only your two phones can read them.', 'Meldinger, bilder og filer – bare telefonene deres kan lese dem.')) + '</small></div>';
    var out = C.bad ? '<div class="hc-sys" style="flex-wrap:wrap;justify-content:center"><i class="bi bi-exclamation-circle"></i> ' + esc(C.bad + L(' old message(s) can’t be opened – they were sent with an earlier invite.', ' gamle melding(er) kan ikke åpnes – de ble sendt med en tidligere invitasjon.')) + ' <button type="button" data-hcbadrm style="border:0;background:none;color:var(--hc-acc);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline">' + L('Remove them', 'Fjern dem') + '</button></div>' : '', prev = null, lastMine = null; l.forEach(function (m) { if (m.by === C.opt.me && !m.sys) lastMine = m; });
    l.forEach(function (m, i) {
      if (!prev || dayName(prev.t) !== dayName(m.t)) { out += '<div class="hc-day">' + esc(dayName(m.t)) + '</div>'; prev = null; }
      out += msgHtml(m, prev);
      var nx = l[i + 1], endGroup = !nx || nx.sys || nx.by !== m.by || nx.t - m.t >= 180000 || dayName(nx.t) !== dayName(m.t);
      if (!m.sys && (endGroup || m.failed || m.pending)) out += '<div class="hc-m' + (m.by === C.opt.me ? ' me' : '') + '" style="margin-top:0">' + metaFor(m, m === lastMine) + '</div>';
      prev = m;
    });
    return out;
  }
  function nearEnd() { var l = C.el && C.el.querySelector('.hc-list'); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 120; }
  function scrollEnd(force) { var l = C.el && C.el.querySelector('.hc-list'); if (!l) return; if (force || nearEnd()) requestAnimationFrame(function () { l.scrollTop = l.scrollHeight; }); }
  var lastList = '';
  function paintList() {
    if (!C.el) return;
    var hd = C.el.querySelector('.hc-headbox'); if (hd) { var h1 = head() + pins(); if (hd._h !== h1) { hd._h = h1; hd.innerHTML = h1; } }
    var box = C.el.querySelector('.hc-msgs'), lst = C.el.querySelector('.hc-list'), stick = nearEnd();
    /* the typing dots have their own spot, so they never redraw the messages */
    var o = other(), tp = +C.typing[o] || 0, ty = C.el.querySelector('.hc-list > .hc-typing'), on = !C.missing && Date.now() + C.skew - tp < 7000;
    if (ty && ty.hidden === on) { ty.hidden = !on; if (on && stick) lst.scrollTop = lst.scrollHeight; }
    var h = listHtml(); if (h === lastList) return;
    lastList = h; box.innerHTML = h; loadImgs(); box = lst;
    var n = visible().length, grew = n > (C.lastN || 0); C.lastN = n;
    if (stick || !C.painted) { C.painted = true; box.scrollTop = box.scrollHeight; } else if (grew) { var d = C.el.querySelector('.hc-down'); if (d) d.hidden = false; }
    markRead();
  }
  function chips() { var c = C.el.querySelector('.hc-chips'); c.hidden = !C.picked.length; c.innerHTML = C.picked.map(function (f, i) { return '<span><i class="bi bi-' + (/^image\//.test(f.type) ? 'image' : 'paperclip') + '"></i><em>' + esc(f.name) + '</em><button type="button" data-hcunpick="' + i + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></span>'; }).join(''); sendState(); }
  function sendState() { var t = C.el.querySelector('textarea'), b = C.el.querySelector('.hc-send'); if (b) b.disabled = !t.value.trim() && !C.picked.length; }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight + 2) + 'px'; }
  function toast(txt) { if (!C.el) return; var d = document.createElement('div'); d.className = 'hc-toast'; d.textContent = txt; C.el.querySelector('.hc').appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function menu(h, onClick) {
    var wrap = C.el.querySelector('.hc'), m = document.createElement('div'); m.className = 'hc-menu'; m.innerHTML = '<div>' + h + '</div>'; wrap.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) { m.remove(); return; } var b = e.target.closest('button'); if (b) { if (onClick(b, m) !== false) m.remove(); } });
    return m;
  }
  var QUICK = ['❤️', '😂', '👍', '😮', '😢', '🙏', '🔥', '🎉'];
  var EMOJI = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖', '😍', '🥰', '😘', '😊', '😁', '😂', '🤣', '😅', '😉', '😎', '🤩', '🥳', '😮', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤔', '🙄', '😴', '🤤', '🤗', '🫶', '👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '👋', '💯', '🔥', '✨', '🎉', '🎂', '🎁', '🏠', '🛒', '🍕', '🍷', '☕', '🍿', '🐶', '🌹', '☀️', '🌙', '⭐', '✅', '❌', '❓', '‼️', '💤', '🚀'];
  function excerpt(m) { return m.text ? m.text.slice(0, 140) : m.files.some(function (f) { return /^audio\//.test(f.type); }) ? L('🎤 Voice message', '🎤 Talemelding') : m.files.some(function (f) { return /^image\//.test(f.type); }) ? L('📷 Photo', '📷 Bilde') : m.files.length ? '📎 ' + m.files[0].name : ''; }
  function msgMenu(id) {
    var m = C.msgs[id]; if (!m || m.pending) return;
    var mine = m.by === C.opt.me, myE = ((reactions()[id] || {})[C.opt.me]) || '', A = C.opt.actions || {};
    menu('<div class="hc-emos">' + QUICK.map(function (e) { return '<button type="button" data-e="' + e + '" class="' + (myE === e ? 'mine' : '') + '" aria-label="' + e + '">' + e + '</button>'; }).join('') + '<button type="button" data-a="moreemo" aria-label="' + L('More emojis', 'Flere emojier') + '"><i class="bi bi-plus-circle"></i></button></div>' +
      (m.text ? '<div class="hc-quote">' + esc(m.text.slice(0, 300)) + '</div>' : '') +
      '<button type="button" data-a="reply"><i class="bi bi-reply"></i>' + L('Reply', 'Svar') + '</button>' +
      (m.text && A.shop ? '<button type="button" data-a="shop"><i class="bi bi-cart-plus"></i>' + L('Add to the shopping list', 'Legg til i handlelista') + '</button>' : '') +
      (m.text && A.plan ? '<button type="button" data-a="plan"><i class="bi bi-calendar-plus"></i>' + L('Add to plans', 'Legg til i planer') + '</button>' : '') +
      (m.text ? '<button type="button" data-a="copy"><i class="bi bi-copy"></i>' + L('Copy', 'Kopier') + '</button>' : '') +
      (m.text && notes() ? '<button type="button" data-a="pin"><i class="bi bi-pin-angle"></i>' + L('Pin to the top', 'Fest øverst') + '</button>' : '') +
      m.files.map(function (f, i) { return '<button type="button" data-a="dl" data-i="' + i + '"><i class="bi bi-download"></i>' + esc(L('Save ', 'Lagre ') + f.name) + '</button>'; }).join('') +
      '<button type="button" data-a="select"><i class="bi bi-check2-square"></i>' + L('Select several …', 'Velg flere …') + '</button>' +
      (mine ? '<button type="button" data-a="del" class="red"><i class="bi bi-trash3"></i>' + L('Delete for both of you', 'Slett for dere begge') + '</button>' : ''), function (b) {
      var a = b.dataset.a;
      if (b.dataset.e) { react(id, b.dataset.e); return; }
      if (a === 'moreemo') { setTimeout(function () { emojiGrid(id); }, 0); return; }
      if (a === 'reply') { setReply(m); return; }
      if (a === 'shop') { var items = m.text.split(/\n|,\s*/).map(function (x) { return x.replace(/^[-•*\s]+/, '').trim(); }).filter(Boolean).slice(0, 15); items.forEach(function (x) { A.shop(x.slice(0, 120)); }); toast(items.length === 1 ? L('Added to the shopping list', 'Lagt til i handlelista') : items.length + L(' things added to the list', ' ting lagt til i lista')); return; }
      if (a === 'plan') { setTimeout(function () { planForm(m.text); }, 0); return; }
      if (a === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(m.text) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () {}); }
      if (a === 'pin') { var ln = m.text.split('\n'), title = ln[0].slice(0, 60), rest = m.text.length > title.length ? m.text : ''; notes().add(title, rest); C.pinsOpen = true; toast(L('Pinned', 'Festet')); setTimeout(paintList, 50); }
      if (a === 'dl') download(m.files[+b.dataset.i]);
      if (a === 'del') remove(id);
      if (a === 'select') { C.sel = {}; C.sel[id] = 1; selBar(); paintList(); }
    });
  }
  /* tap a reaction under a message: change yours, see who reacted, or take yours away */
  function reactMenu(id) {
    var rx = reactions()[id] || {}, myE = rx[C.opt.me] || '';
    var who = Object.keys(rx).filter(function (k) { return rx[k]; }).map(function (k) { return '<button type="button" data-a="none" style="pointer-events:none"><span style="font-size:22px;width:22px;text-align:center">' + esc(rx[k]) + '</span>' + esc(k === C.opt.me ? L('You', 'Du') : C.opt.name(k)) + '</button>'; }).join('');
    menu('<div class="hc-emos">' + QUICK.map(function (e) { return '<button type="button" data-e="' + e + '" class="' + (myE === e ? 'mine' : '') + '" aria-label="' + e + '">' + e + '</button>'; }).join('') + '<button type="button" data-a="moreemo" aria-label="' + L('More emojis', 'Flere emojier') + '"><i class="bi bi-plus-circle"></i></button></div>' +
      who + (myE ? '<button type="button" data-a="rm" class="red"><i class="bi bi-x-circle"></i>' + L('Remove my reaction', 'Fjern reaksjonen min') + '</button>' : ''), function (b) {
      if (b.dataset.e) { if (b.dataset.e !== myE) react(id, b.dataset.e); return; }
      if (b.dataset.a === 'moreemo') { setTimeout(function () { emojiGrid(id); }, 0); return; }
      if (b.dataset.a === 'rm') { react(id, myE); return; }
      if (b.dataset.a === 'none') return false;
    });
  }
  function emojiGrid(id) {
    var myE = ((reactions()[id] || {})[C.opt.me]) || '';
    menu('<p>' + esc(L('React with', 'Reager med')) + '</p><div class="hc-emogrid">' + EMOJI.map(function (e) { return '<button type="button" data-e="' + e + '" style="' + (myE === e ? 'background:color-mix(in srgb,var(--hc-acc) 22%,transparent)' : '') + '">' + e + '</button>'; }).join('') + '</div>', function (b) { if (b.dataset.e) react(id, b.dataset.e); });
  }
  function setReply(m) { C.reply = { id: m.id, by: m.by, x: excerpt(m) }; replyBar(); var ta = C.el && C.el.querySelector('textarea'); if (ta) ta.focus(); }
  function replyBar() { var r = C.el && C.el.querySelector('.hc-replybar'); if (!r) return; r.hidden = !C.reply; r.innerHTML = C.reply ? '<i class="bi bi-reply"></i><span><b>' + esc(C.reply.by === C.opt.me ? L('You', 'Du') : C.opt.name(C.reply.by)) + '</b>' + esc(C.reply.x) + '</span><button type="button" data-hcnoreply aria-label="' + L('Cancel reply', 'Avbryt svar') + '"><i class="bi bi-x-lg"></i></button>' : ''; }
  function dkeyOf(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function planForm(text) {
    var A = C.opt.actions || {}; if (!A.plan) return;
    var guess = new Date(), low = text.toLowerCase(); if (/tomorrow|i morgen/.test(low)) guess.setDate(guess.getDate() + 1);
    var tm = (text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/) || [])[0];
    menu('<p>' + esc(L('Add to plans', 'Legg til i planer')) + '</p><div class="hc-plan"><input name="t" maxlength="120" value="' + esc(text.split('\n')[0].slice(0, 120)) + '" aria-label="' + L('Title', 'Tittel') + '"><div class="row"><input type="date" name="d" value="' + dkeyOf(guess) + '"><input type="time" name="h" value="' + (tm ? tm.replace('.', ':').padStart(5, '0') : '') + '" aria-label="' + L('Time (empty = all day)', 'Tid (tom = hele dagen)') + '"></div><button type="button" class="go" data-a="add">' + L('Add', 'Legg til') + '</button></div>', function (b, mm) {
      if (b.dataset.a !== 'add') return;
      var t = mm.querySelector('[name=t]').value.trim(), d = mm.querySelector('[name=d]').value, h = mm.querySelector('[name=h]').value;
      if (!t || !d) { (t ? mm.querySelector('[name=d]') : mm.querySelector('[name=t]')).focus(); return false; }
      A.plan(t, d, h || ''); toast(L('Added to plans', 'Lagt til i planer'));
    });
  }
  function pinMenu(id) {
    var n = ((notes() && notes().list()) || []).filter(function (x) { return x.id === id; })[0]; if (!n) return;
    menu('<div class="hc-quote"><b>' + esc(n.title) + '</b>' + (n.text ? '\n' + esc(n.text.slice(0, 300)) : '') + '</div><button type="button" data-a="copy"><i class="bi bi-copy"></i>' + L('Copy', 'Kopier') + '</button><button type="button" data-a="send"><i class="bi bi-reply"></i>' + L('Send it in the chat', 'Send den i chatten') + '</button><button type="button" data-a="unpin" class="red"><i class="bi bi-pin-angle"></i>' + L('Unpin', 'Løsne') + '</button>', function (b) {
      var a = b.dataset.a, full = n.title + (n.text && n.text !== n.title ? '\n' + n.text : '');
      if (a === 'copy' && navigator.clipboard) navigator.clipboard.writeText(full).then(function () { toast(L('Copied', 'Kopiert')); }, function () {});
      if (a === 'send') send(full, []);
      if (a === 'unpin' && notes()) { notes().remove(id); setTimeout(paintList, 50); }
    });
  }
  function settingsMenu() {
    var t = function (x) { return x ? new Date(x).toTimeString().slice(0, 8) : '–'; }, sv = C.dSrv || {}, lv = C.dLive || {};
    var diag = '<p class="hc-diag">' + esc(L('Connection', 'Tilkobling') + ': ' + L('server has ', 'serveren har ') + (sv.n == null ? '?' : sv.n) + L(' messages (v', ' meldinger (v') + (sv.rev == null ? '?' : sv.rev) + ') · ' + L('shown here ', 'vist her ') + list().filter(function (m) { return !m.sys; }).length + ' · ' + L('live v', 'live v') + (lv.chat == null ? '–' : lv.chat) + ' ' + t(lv.at) + ' · ' + L('fetched ', 'hentet ') + t(C.dOk) + (C.dErr ? ' · ' + L('error ', 'feil ') + C.dErr : '') + (C.bad ? ' · ' + L('can’t open ', 'kan ikke åpne ') + C.bad : '') + ' · ' + C.opt.me) + '</p>';
    var mu = muteOf(C.opt.me), muted = mu > Date.now(), trouble = !!(C.bad || C.dErr || C.missing);
    var MUTE = [[36e5, '1 h', '1 t'], [8 * 36e5, '8 h', '8 t'], [864e5, L('1 day', '1 dag')], [3650 * 864e5, L('Always', 'Alltid')]];
    var TTLX = [[0, L('Off', 'Av')], [864e5, '24 h'], [7 * 864e5, L('1 week', '1 uke')], [30 * 864e5, L('1 month', '1 mnd')]];
    menu(
      '<button type="button" data-a="gal"><i class="bi bi-images"></i>' + L('Photos & files', 'Bilder og filer') + '</button>' +
      '<p><i class="bi bi-bell' + (muted ? '-slash' : '') + '"></i> ' + esc(muted ? L('Muted until ', 'Dempet til ') + (mu - Date.now() > 3 * 864e5 ? L('you turn it on', 'du slår den på') : new Date(mu).toLocaleString(C.opt.no ? 'nb-NO' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })) : L('Mute notifications', 'Demp varsler')) + '</p>' +
      '<div class="hc-chiprow">' + (muted ? '<button type="button" class="hc-chip on" data-mute="0"><i class="bi bi-bell"></i> ' + L('Unmute', 'Slå på') + '</button>' : MUTE.map(function (x) { return '<button type="button" class="hc-chip" data-mute="' + x[0] + '">' + esc(L(x[1], x[2] || x[1])) + '</button>'; }).join('')) + '</div>' +
      '<p><i class="bi bi-stopwatch"></i> ' + esc(L('Disappearing messages – for both of you', 'Meldinger som forsvinner – for dere begge')) + '</p>' +
      '<div class="hc-chiprow">' + TTLX.map(function (x) { return '<button type="button" class="hc-chip' + (C.ttl === x[0] ? ' on' : '') + '" data-ttl="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
      (C.online ? '<p><i class="bi bi-circle-fill" style="color:' + (C.away ? '#999' : '#34c759') + ';font-size:.6em;vertical-align:2px"></i> ' + esc(L('Show when I’m active', 'Vis når jeg er aktiv')) + '</p>' +
        '<div class="hc-chiprow"><button type="button" class="hc-chip' + (C.away ? '' : ' on') + '" data-away="0">' + esc(L('On', 'På')) + '</button><button type="button" class="hc-chip' + (C.away ? ' on' : '') + '" data-away="1">' + esc(L('Off', 'Av')) + '</button></div>' +
        '<small class="hc-note">' + esc(L('Off: ' + C.opt.name(other()) + ' won’t see when you’re here – and you won’t see it for them either.', 'Av: ' + C.opt.name(other()) + ' ser ikke når du er her – og du ser det ikke for dem heller.')) + '</small>' : ''),
      function (b) { if (b.dataset.ttl != null) setTtl(+b.dataset.ttl); if (b.dataset.mute != null) { var ms = +b.dataset.mute; setMute(ms ? Date.now() + ms : 0); toast(ms ? L('Muted', 'Dempet') : L('Notifications on', 'Varsler på')); } if (b.dataset.a === 'gal') setTimeout(gallery, 0); if (b.dataset.away != null) { C.away = b.dataset.away === '1'; SC.livePost({ away: C.away }); toast(C.away ? L('You now appear offline', 'Du vises nå som frakoblet') : L('Your status is shown', 'Statusen din vises')); paintList(); } });
  }
  function viewImg(fid) {
    var m = null, f = null; Object.keys(C.msgs).forEach(function (id) { (C.msgs[id].files || []).forEach(function (x) { if (x.id === fid) { m = C.msgs[id]; f = x; } }); }); if (!f) return;
    /* computer: the same panel as PDFs and other files (Download, Expand, Close) instead of blacking out the whole window */
    if (window.FileView && matchMedia('(min-width: 700px)').matches) { fileUrl(f).then(function (u) { FileView.show(u, f.name || L('Photo', 'Bilde')); }, function () { toast(L('That file is gone', 'Den filen er borte')); }); return; }
    var v = document.createElement('div'); v.className = 'hc-view'; v.innerHTML = '<img alt=""><button type="button" class="hc-ib" style="left:12px" data-x aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button><button type="button" class="hc-ib" style="right:12px" data-dl aria-label="' + L('Save', 'Lagre') + '"><i class="bi bi-download"></i></button>';
    document.body.appendChild(v); fileUrl(f).then(function (u) { v.querySelector('img').src = u; });
    v.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-dl]')) { download(f); return; } C.viewShut = Date.now(); v.remove(); });
    ['touchend', 'pointerup'].forEach(function (n) { v.addEventListener(n, function (e) { e.stopPropagation(); }); });
  }
  /* every photo and file you sent each other */
  function gallery() {
    var all = []; visible().forEach(function (m) { m.files.forEach(function (f) { if (f.id !== 'tmp') all.push({ m: m, f: f }); }); }); all.reverse();
    var imgs = all.filter(function (x) { return /^image\//.test(x.f.type); }), rest = all.filter(function (x) { return !/^image\//.test(x.f.type); });
    var g = document.createElement('div'); g.className = 'hc-gal';
    g.innerHTML = '<div class="hc-head"><button type="button" class="hc-ib" data-x aria-label="' + L('Back', 'Tilbake') + '"><i class="bi bi-chevron-left"></i></button><div class="hc-tt"><b>' + L('Photos & files', 'Bilder og filer') + '</b><small>' + all.length + L(' in the chat', ' i chatten') + '</small></div></div><div class="g">' +
      (imgs.length ? '<div class="grid">' + imgs.map(function (x) { return '<button type="button" data-g="' + esc(x.f.id) + '" style="' + (x.f.th ? 'background-image:url(' + x.f.th + ')' : '') + '"><img alt="" data-mid="' + x.m.id + '" data-fid="' + esc(x.f.id) + '"></button>'; }).join('') + '</div>' : '') +
      (rest.length ? '<h4>' + L('Files and voice messages', 'Filer og talemeldinger') + '</h4>' + rest.map(function (x) { return '<button type="button" class="hc-file" data-gf="' + esc(x.f.id) + '" data-mid="' + x.m.id + '"><i class="bi bi-' + (/^audio\//.test(x.f.type) ? 'mic' : /^video\//.test(x.f.type) ? 'film' : 'file-earmark') + '"></i><span><b>' + esc(/^audio\//.test(x.f.type) ? L('Voice message', 'Talemelding') + ' · ' + dur(x.f.dur) : x.f.name) + '</b><small>' + esc(new Date(x.m.t).toLocaleDateString(C.opt.no ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }) + ' · ' + kb(x.f.size || 0)) + '</small></span></button>'; }).join('') : '') +
      (!all.length ? '<div class="hc-empty"><i class="bi bi-images"></i>' + L('Photos and files you send each other show up here.', 'Bilder og filer dere sender hverandre dukker opp her.') + '</div>' : '') + '</div>';
    C.el.querySelector('.hc').appendChild(g);
    g.querySelectorAll('img[data-fid]').forEach(function (im) { var x = all.filter(function (y) { return y.f.id === im.dataset.fid; })[0]; if (x) smallUrl(x.f).then(function (u) { im.src = u; im.classList.add('on'); }, function () {}); });
    g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-x')) { g.remove(); return; } if (b.dataset.g) { viewImg(b.dataset.g); return; } if (b.dataset.gf) { var x = all.filter(function (y) { return y.f.id === b.dataset.gf; })[0]; if (x) download(x.f); } });
  }
  function pick(files) { [].slice.call(files || []).slice(0, 10 - C.picked.length).forEach(function (f) { C.picked.push(f); }); chips(); }
  function attachMenu() {
    var touch = matchMedia('(pointer: coarse)').matches, canCam = touch || !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    menu((canCam ? '<button type="button" data-a="cam"><i class="bi bi-camera"></i>' + L('Take a photo', 'Ta et bilde') + '</button>' : '') +
      '<button type="button" data-a="pics"><i class="bi bi-images"></i>' + L('Photos & videos', 'Bilder og videoer') + '</button>' +
      '<button type="button" data-a="file"><i class="bi bi-paperclip"></i>' + L('File', 'Fil') + '</button>', function (b) {
      var a = b.dataset.a, root = C.el;
      if (a === 'cam') { if (touch) root.querySelector('input[data-in=cam]').click(); else camera(); }
      if (a === 'pics') root.querySelector('input[data-in=pics]').click();
      if (a === 'file') root.querySelector('input[data-in=file]').click();
    });
  }
  /* computer: take a photo with the built-in camera */
  function camera() {
    var wrap = C.el.querySelector('.hc'), c = document.createElement('div'), stream = null; c.className = 'hc-cam';
    c.innerHTML = '<video autoplay playsinline muted></video><div class="acts"><button type="button" class="no" data-x>' + L('Cancel', 'Avbryt') + '</button><button type="button" class="snap" data-snap><i class="bi bi-camera"></i> ' + L('Take photo', 'Ta bilde') + '</button></div>';
    wrap.appendChild(c);
    var stop = function () { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); c.remove(); };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (s2) { stream = s2; c.querySelector('video').srcObject = s2; }, function () { stop(); toast(L('No camera access', 'Ingen tilgang til kamera')); var i = C.el && C.el.querySelector('input[data-in=pics]'); if (i) i.click(); });
    c.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-x')) { stop(); return; }
      var v = c.querySelector('video'), cv = document.createElement('canvas'); cv.width = v.videoWidth || 1280; cv.height = v.videoHeight || 720; cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      cv.toBlob(function (bl) { if (bl) pick([new File([bl], 'photo.jpg', { type: 'image/jpeg' })]); stop(); }, 'image/jpeg', 0.9);
    });
  }
  /* voice: tap the microphone, talk, tap send (up to 2 minutes) */
  var REC = null;
  function recStart() {
    if (REC || !window.MediaRecorder || !navigator.mediaDevices) { toast(L('Voice messages aren’t supported here', 'Talemeldinger støttes ikke her')); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || '';
      var rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined), parts = [];
      REC = { rec: rec, stream: stream, t0: Date.now(), send: false, tm: null };
      rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); }); var r = REC; REC = null; recBar(); if (!r || !r.send) return;
        var mt = (rec.mimeType || type || 'audio/webm').split(';')[0], blob = new Blob(parts, { type: mt }), sec = Math.max(1, Math.round((Date.now() - r.t0) / 1000));
        if (blob.size < 200) return;
        var f = new File([blob], 'voice.' + (/mp4/.test(mt) ? 'm4a' : /ogg/.test(mt) ? 'ogg' : 'webm'), { type: mt }); f._dur = sec;
        var extra = C.reply ? { re: C.reply } : null; C.reply = null; replyBar(); send('', [f], extra);
      };
      rec.start(250); recBar();
      REC.tm = setInterval(function () { recBar(); if (REC && Date.now() - REC.t0 > 120000) recStop(true); }, 250);
    }, function () { toast(L('No microphone access', 'Ingen tilgang til mikrofon')); });
  }
  function recStop(send) { if (!REC) return; clearInterval(REC.tm); REC.send = !!send; try { REC.rec.stop(); } catch (e) { REC = null; recBar(); } }
  function recBar() {
    if (!C.el) return; var row = C.el.querySelector('.hc-row'), bar = C.el.querySelector('.hc-rec');
    if (!REC) { if (bar) bar.remove(); if (row) row.hidden = false; return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'hc-rec'; bar.innerHTML = '<i class="dot"></i><b>0:00</b><button type="button" class="hc-ib" data-hcrecno aria-label="' + L('Cancel', 'Avbryt') + '"><i class="bi bi-trash3"></i></button><button type="button" class="hc-ib hc-send" data-hcrecgo aria-label="' + L('Send', 'Send') + '"><svg class="hc-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>'; row.parentNode.insertBefore(bar, row); row.hidden = true; }
    bar.querySelector('b').textContent = dur((Date.now() - REC.t0) / 1000);
  }
  /* play a voice message (one at a time) */
  var PLAY = null;
  function play(fid, el) {
    if (PLAY && PLAY.fid === fid) { if (PLAY.a.paused) PLAY.a.play(); else PLAY.a.pause(); return; }
    if (PLAY) { PLAY.a.pause(); }
    var f = null; Object.keys(C.msgs).forEach(function (id) { (C.msgs[id].files || []).forEach(function (x) { if (x.id === fid) f = x; }); }); if (!f) return;
    fileUrl(f).then(function (u) {
      var a = new Audio(u); PLAY = { fid: fid, a: a };
      var ui = function () { var box = C.el && C.el.querySelector('.hc-voice[data-fid="' + fid + '"]'); if (!box) return; box.querySelector('i.bi').className = 'bi bi-' + (a.paused ? 'play-fill' : 'pause-fill'); var d = isFinite(a.duration) && a.duration ? a.duration : (f.dur || 1); box.querySelector('.hc-vbar i').style.width = Math.min(100, a.currentTime / d * 100) + '%'; box.querySelector('small').textContent = dur(a.paused && !a.currentTime ? f.dur : a.currentTime); };
      ['play', 'pause', 'timeupdate', 'ended'].forEach(function (ev) { a.addEventListener(ev, ui); });
      a.addEventListener('ended', function () { a.currentTime = 0; ui(); });
      a.play().catch(function () { toast(L('Can’t play this one here', 'Kan ikke spille av denne her')); });
    }, function () { toast(L('That message is gone', 'Den meldingen er borte')); });
  }
  function micState() { if (!C.el) return; var t = C.el.querySelector('textarea'), mic = C.el.querySelector('.hc-mic'), snd = C.el.querySelector('.hc-row .hc-send'); var empty = !t.value.trim() && !C.picked.length; if (mic) mic.hidden = !empty; if (snd) snd.hidden = empty; }
  function pop(el, x, y) { var h = document.createElement('div'); h.className = 'hc-pop-heart'; h.textContent = '❤️'; var r = C.el.querySelector('.hc').getBoundingClientRect(); h.style.left = (x - r.left) + 'px'; h.style.top = (y - r.top) + 'px'; C.el.querySelector('.hc').appendChild(h); setTimeout(function () { h.remove(); }, 700); }
  /* select several messages: yours are removed for both of you, theirs are hidden on this device */
  function selBar() {
    if (!C.el) return; var bar = C.el.querySelector('.hc-selbar'), row = C.el.querySelector('.hc-row'), rb = C.el.querySelector('.hc-replybar'), n = C.sel ? Object.keys(C.sel).length : 0;
    C.el.querySelector('.hc').classList.toggle('selecting', !!C.sel);
    if (!C.sel) { if (bar) bar.remove(); if (row) row.hidden = false; replyBar(); return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'hc-selbar'; row.parentNode.insertBefore(bar, row); }
    row.hidden = true; if (rb) rb.hidden = true;
    bar.innerHTML = '<button type="button" class="hc-selx" data-hcselx>' + L('Cancel', 'Avbryt') + '</button><b>' + n + L(' selected', ' valgt') + '</b><button type="button" class="hc-seldel" data-hcseldel' + (n ? '' : ' disabled') + '><i class="bi bi-trash3"></i> ' + L('Delete', 'Slett') + '</button>';
  }
  function deleteSelected() {
    var ids = Object.keys(C.sel || {}), mine = [], theirs = [];
    ids.forEach(function (id) { var m = C.msgs[id]; if (!m) return; (m.by === C.opt.me ? mine : theirs).push(id); });
    if (!ids.length) return;
    var go = function () {
      if (theirs.length) { var H = hiddenHere(); theirs.forEach(function (id) { H[id] = Date.now(); }); wj(hideKey(), H); }
      var onServer = mine.filter(function (id) { return !C.msgs[id].pending && !C.msgs[id].failed; });
      mine.forEach(function (id) { delete C.msgs[id]; });
      if (onServer.length) for (var i = 0; i < onServer.length; i += 150) put({ del: onServer.slice(i, i + 150) }).then(fetchChat, fetchChat);
      C.sel = null; selBar(); changed(); toast(ids.length === 1 ? L('Deleted', 'Slettet') : ids.length + L(' messages deleted', ' meldinger slettet'));
    };
    menu('<p>' + esc(ids.length + L(' message(s): ', ' melding(er): ') + (mine.length ? mine.length + L(' of yours disappear for both of you', ' av dine forsvinner for dere begge') : '') + (mine.length && theirs.length ? L('; ', '; ') : '') + (theirs.length ? theirs.length + L(' from ', ' fra ') + C.opt.name(other()) + L(' are hidden here only – only they can delete those', ' skjules bare her – bare de kan slette dem') : '') + '.') + '</p><button type="button" data-a="yes" class="red"><i class="bi bi-trash3"></i>' + L('Delete', 'Slett') + '</button><button type="button" data-a="no"><i class="bi bi-x-lg"></i>' + L('Cancel', 'Avbryt') + '</button>', function (b) { if (b.dataset.a === 'yes') go(); });
  }
  var typT = 0;
  function bind(root) {
    var ta = root.querySelector('textarea'), lst = root.querySelector('.hc-list');
    var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    ta.addEventListener('input', function () { grow(ta); sendState(); micState(); var n = Date.now(); if (ta.value.trim() && n - typT > 3000) { typT = n; SC.livePost({ typing: 1 }); } });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && fine && !e.isComposing) { e.preventDefault(); submit(); } });
    function submit() { var t = ta.value, f = C.picked.slice(); if (!t.trim() && !f.length) return; ta.value = ''; grow(ta); C.picked = []; chips(); typT = 0; var extra = C.reply ? { re: C.reply } : null; C.reply = null; replyBar(); send(t, f, extra); micState(); ta.focus(); }
    root.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    /* the keyboard stays up after sending (like Messages): tapping Send doesn't take the focus from the text box */
    var sb = root.querySelector('.hc-row .hc-send');
    if (sb) { sb.addEventListener('mousedown', function (e) { e.preventDefault(); }); sb.addEventListener('touchend', function (e) { if (sb.disabled) return; e.preventDefault(); submit(); }); }
    root.querySelectorAll('input[type=file]').forEach(function (inp) { inp.addEventListener('change', function () { pick(inp.files); inp.value = ''; micState(); }); });
    lst.addEventListener('scroll', function () { if (nearEnd()) { var d = root.querySelector('.hc-down'); if (d) d.hidden = true; markRead(); } }, { passive: true });
    /* hold a message (phone) for its menu */
    var hold = null; lst.addEventListener('touchstart', function (e) { var m = e.target.closest('.hc-m[data-mid]'); if (!m || e.target.closest('a') || C.sel) return; hold = setTimeout(function () { hold = null; if (navigator.vibrate) navigator.vibrate(10); msgMenu(m.dataset.mid); }, 480); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { lst.addEventListener(ev, function () { clearTimeout(hold); }, { passive: true }); });
    /* double-tap a message (phone): ❤️ – double-tap again to take it away */
    var tap = { id: null, t: 0, x: 0, y: 0 }, moved = false;
    lst.addEventListener('touchstart', function (e) { moved = false; var p = e.touches[0]; tap.sx = p.clientX; tap.sy = p.clientY; }, { passive: true });
    lst.addEventListener('touchmove', function (e) { var p = e.touches[0]; if (Math.abs(p.clientX - tap.sx) > 10 || Math.abs(p.clientY - tap.sy) > 10) moved = true; }, { passive: true });
    lst.addEventListener('touchend', function (e) {
      var m = e.target.closest('.hc-m[data-mid]'); if (!m || C.sel || moved || (e.target.closest('a, button, video, .hc-rx') && !e.target.closest('.hc-imgs button')) || e.touches.length) { tap.id = null; return; }
      var now = Date.now(), p = e.changedTouches[0];
      if (tap.id === m.dataset.mid && now - tap.t < 320 && Math.abs(p.clientX - tap.x) < 40 && Math.abs(p.clientY - tap.y) < 40) {
        e.preventDefault(); tap.id = null; clearTimeout(hold); C.dblAt = Date.now();
        var msg = C.msgs[m.dataset.mid]; if (!msg || msg.pending || msg.sys) return;
        var mineNow = ((reactions()[msg.id] || {})[C.opt.me]) || '';
        react(msg.id, mineNow && mineNow !== '❤️' ? '❤️' : '❤️');
        if (mineNow !== '❤️') pop(m, p.clientX, p.clientY);
        if (navigator.vibrate) navigator.vibrate(8);
        return;
      }
      tap = { id: m.dataset.mid, t: now, x: p.clientX, y: p.clientY, sx: tap.sx, sy: tap.sy };
    });
    lst.addEventListener('contextmenu', function (e) { var m = e.target.closest('.hc-m[data-mid]'); if (!m || e.target.closest('a') || C.sel) return; e.preventDefault(); msgMenu(m.dataset.mid); });
    root.addEventListener('click', function (e) {
      if (!C.sel || e.target.closest('.hc-selbar, .hc-menu, .hc-headbox')) return;
      var mm = e.target.closest('.hc-m[data-mid]'); if (!mm) return;
      e.preventDefault(); e.stopPropagation(); var id = mm.dataset.mid;
      if (C.sel[id]) delete C.sel[id]; else C.sel[id] = 1; selBar(); paintList();
    }, true);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var d = b.dataset;
      if (d.hcbadrm != null) { var bl = C.badIds || [], mineB = bl.filter(function (x) { return x.by === C.opt.me; }).map(function (x) { return x.id; }), H = hiddenHere(); bl.forEach(function (x) { H[x.id] = Date.now(); }); wj(hideKey(), H); if (mineB.length) put({ del: mineB.slice(0, 200) }).then(fetchChat, fetchChat); C.bad = 0; C.badIds = []; changed(); toast(L('Removed', 'Fjernet')); return; }
      if (d.hcselx != null) { C.sel = null; selBar(); paintList(); return; }
      if (d.hcseldel != null) { deleteSelected(); return; }
      if (d.hcclose != null) { unmount(); if (C.onClose) C.onClose(); return; }
      if (d.hcmenu != null) { settingsMenu(); return; }
      if (d.hcpins != null) { C.pinsOpen = !C.pinsOpen; paintList(); return; }
      if (d.hcpin) { pinMenu(d.hcpin); return; }
      if (d.hcmore != null) { msgMenu(b.closest('[data-mid]').dataset.mid); return; }
      if (d.hcimg) { if (matchMedia('(pointer: coarse)').matches) { var at = Date.now(), fid = d.hcimg; setTimeout(function () { if (!(C.dblAt > at - 50)) viewImg(fid); }, 330); } else viewImg(d.hcimg); return; }
      if (d.hcfile) { var m = C.msgs[b.closest('[data-mid]').dataset.mid]; var f = m && m.files.filter(function (x) { return x.id === d.hcfile; })[0]; if (f) download(f); return; }
      if (d.hcretry) { var r = C.msgs[d.hcretry]; if (r && r.retry) r.retry(); return; }
      if (d.hcunpick != null) { C.picked.splice(+d.hcunpick, 1); chips(); micState(); return; }
      if (d.hcattach != null) { attachMenu(); return; }
      if (d.hcrx) { reactMenu(d.hcrx); return; }
      if (d.hcgo) { var t2 = root.querySelector('.hc-m[data-mid="' + d.hcgo + '"]'); if (t2) { t2.scrollIntoView({ block: 'center', behavior: 'smooth' }); t2.classList.add('hl'); setTimeout(function () { t2.classList.remove('hl'); }, 1600); } else toast(L('That message is gone', 'Den meldingen er borte')); return; }
      if (d.hcplay) { play(d.hcplay, b); return; }
      if (d.hcnoreply != null) { C.reply = null; replyBar(); return; }
      if (d.hcmic != null) { recStart(); return; }
      if (d.hcrecno != null) { recStop(false); return; }
      if (d.hcrecgo != null) { recStop(true); return; }
      if (d.hcdown != null) { scrollEnd(true); b.hidden = true; return; }
    });
    /* paste a picture straight in (computer) */
    ta.addEventListener('paste', function (e) { var it = [].slice.call((e.clipboardData || {}).files || []); if (it.length) { e.preventDefault(); pick(it); micState(); } });
    root.addEventListener('dragover', function (e) { e.preventDefault(); });
    root.addEventListener('drop', function (e) { e.preventDefault(); pick((e.dataTransfer || {}).files); micState(); });
  }
  function mount(el, o) {
    o = o || {}; css(); if (C.el && C.el !== el) unmount();
    C.sel = null; C.lastN = 0; C.el = el; C.full = !!o.full; C.pop = !!o.pop; C.onClose = o.onClose || null; C.open = true; C.painted = false; lastList = '';
    el.innerHTML = '<div class="hc"><div class="hc-headbox"></div><div class="hc-list" role="log" aria-live="polite"><div class="hc-msgs"></div><div class="hc-typing" hidden><i></i><i></i><i></i></div></div><button type="button" class="hc-down" data-hcdown hidden><i class="bi bi-arrow-down"></i> ' + L('New messages', 'Nye meldinger') + '</button>' +
      '<form class="hc-comp"><div class="hc-replybar" hidden></div><div class="hc-chips" hidden></div><div class="hc-row"><button type="button" class="hc-ib" data-hcattach aria-label="' + L('Add a photo, camera or file', 'Legg til bilde, kamera eller fil') + '"><i class="bi bi-plus-lg"></i></button>' +
      '<textarea rows="1" placeholder="' + esc(L('Message', 'Melding')) + '" enterkeyhint="send" aria-label="' + L('Message', 'Melding') + '"></textarea><button type="button" class="hc-ib hc-mic" data-hcmic aria-label="' + L('Record a voice message', 'Spill inn en talemelding') + '"><i class="bi bi-mic"></i></button><button type="submit" class="hc-ib hc-send" hidden aria-label="' + L('Send', 'Send') + '"><svg class="hc-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div>' +
      '<input type="file" data-in="file" multiple hidden><input type="file" data-in="pics" multiple hidden accept="image/*,video/*"><input type="file" data-in="cam" hidden accept="image/*" capture="environment"></form></div>';
    bind(el); chips(); replyBar(); micState(); paintList(); SC.liveSpeed(true); fetchChat();
  }
  function unmount() { if (!C.el) return; if (REC) recStop(false); if (PLAY) { PLAY.a.pause(); PLAY = null; } if (C.open) SC.liveSpeed(false); C.open = false; C.el.innerHTML = ''; C.el = null; lastList = ''; }
  function onLive(j) {
    if (!C.opt || !j) return; C.dLive = { at: Date.now(), chat: j.chat };
    if (j.now) C.skew = j.now - Date.now();
    C.typing = j.typing || {}; C.seen = j.seen || {}; if (j.online) { C.online = j.online; C.last = j.last || {}; C.away = !!j.away; }
    if (j.chat != null && j.chat !== C.rev) fetchChat(); else if (C.el) paintList();
  }
  function init(opt) {
    var first = !C.opt, newKey = C.opt && (C.opt.key !== opt.key || String(C.opt.keys || '') !== String(opt.keys || '')); C.opt = opt; if (newKey) { C.msgs = {}; C.rev = -1; fetchChat(); } if (!first) return;
    SC.live(onLive); fetchChat();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { fetchChat(); markRead(); } });
  }

  /* ---------- the bubble: a small round button in the corner that opens the chat as a pop-up ----------
     HomeChat.bubble({ bottom: css length above the bottom edge, label }) – call after init. */
  var B = { btn: null, pop: null, opt: null };
  function bubbleCss() {
    if (document.getElementById('hcBubCss')) return;
    var s = document.createElement('style'); s.id = 'hcBubCss';
    s.textContent = [
      '.hc-bub{position:fixed;right:16px;bottom:var(--hc-bub-b,24px);z-index:40;width:52px;height:52px;border-radius:50%;border:0;background:var(--acc,var(--accent,#14b8a6));color:#fff;font-size:22px;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s,opacity .15s}',
      '.hc-bub:active{transform:scale(.92)}.hc-bub[hidden]{display:none}.hc-bub.on{opacity:0;pointer-events:none}',
      '.hc-bub b{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#e5484d;color:#fff;font:700 11.5px/20px system-ui,sans-serif;box-shadow:0 0 0 2px var(--bg-solid,var(--bg,#111))}.hc-bub b[hidden]{display:none}',
      '.hc-pop{position:fixed;z-index:60;right:16px;bottom:var(--hc-bub-b,24px);width:380px;height:min(600px,calc(100vh - 120px));border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35);border:1px solid var(--line,rgba(127,127,127,.22));opacity:0;transform:translateY(12px);transition:opacity .16s,transform .16s;background:var(--bg-solid,var(--bg,#111))}',
      '.hc-pop.in{opacity:1;transform:none}.hc-pop .hc{--hc-bg:var(--bg-solid,var(--bg,#111))}',
      '@media (max-width:699px){.hc-pop{left:8px;right:8px;width:auto;bottom:8px;height:72vh;border-radius:20px}.hc-popbg{position:fixed;inset:0;z-index:59;background:rgba(0,0,0,.3)}}',
      '@media (min-width:700px){.hc-popbg{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function bubble(o) {
    B.opt = o = o || {}; bubbleCss();
    if (!B.btn) {
      B.btn = document.createElement('button'); B.btn.type = 'button'; B.btn.className = 'hc-bub';
      B.btn.innerHTML = '<i class="bi bi-chat-heart-fill"></i><b hidden></b>'; document.body.appendChild(B.btn);
      B.btn.addEventListener('click', function () { B.pop ? closePop() : openPop(); });
      document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; var v = document.querySelector('.hc-view'); if (v) { v.remove(); C.viewShut = Date.now(); return; } if (B.pop && !B.pop.querySelector('.hc-menu') && !document.querySelector('.hc-gal, .fv-bg')) closePop(); });   /* Escape closes the photo first, then the chat */
      if (window.visualViewport) { visualViewport.addEventListener('resize', fitPop); visualViewport.addEventListener('scroll', fitPop); }
    }
    if (o.bottom) document.documentElement.style.setProperty('--hc-bub-b', o.bottom);
    if (o.zoom) document.documentElement.style.setProperty('--hc-zoom', o.zoom);
    B.btn.setAttribute('aria-label', o.label || L('Chat', 'Chat')); B.btn.title = o.label || '';
    B.btn.hidden = false; badge();
  }
  function badge() { if (!B.btn) return; var n = unread(), b = B.btn.querySelector('b'); b.hidden = !n || !!B.pop; b.textContent = n > 9 ? '9+' : String(n); }
  function openPop() {
    if (B.pop) return;
    var bg = document.createElement('div'); bg.className = 'hc-popbg'; document.body.appendChild(bg); bg.addEventListener('click', function () { if (document.querySelector('.hc-view, .hc-gal, .fv-bg') || Date.now() - (C.viewShut || 0) < 700) return; closePop(); });   /* a photo was open on top: the chat stays */
    B.pop = document.createElement('div'); B.pop.className = 'hc-pop'; B.pop.setAttribute('role', 'dialog'); B.pop.setAttribute('aria-label', B.opt.label || 'Chat'); B.pop._bg = bg; document.body.appendChild(B.pop);
    mount(B.pop, { pop: true, onClose: closePop }); B.btn.classList.add('on'); if (innerWidth < 700) document.documentElement.classList.add('hc-lock'); badge(); fitPop();
    requestAnimationFrame(function () { if (B.pop) B.pop.classList.add('in'); });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) { var ta = B.pop.querySelector('textarea'); if (ta) ta.focus(); }
    if (B.opt.onOpen) B.opt.onOpen();
  }
  function closePop() {
    if (!B.pop) return; var p = B.pop; B.pop = null; if (C.el === p.firstChild || C.el === p) unmount(); else if (isOpen()) unmount();
    document.documentElement.classList.remove('hc-lock'); if (p._bg) p._bg.remove(); p.classList.remove('in'); setTimeout(function () { p.remove(); }, 170); if (B.btn) B.btn.classList.remove('on'); badge();
  }
  /* phone keyboard: the pop-up sits on top of it and fills what is left of the screen */
  function fitPop() {
    if (!B.pop) return; var vv = window.visualViewport;
    if (!vv || innerWidth >= 700) { B.pop.style.top = ''; B.pop.style.height = ''; B.pop.style.bottom = ''; return; }
    var kb = innerHeight - vv.height > 120;
    if (kb) { B.pop.style.top = (vv.offsetTop + 8) + 'px'; B.pop.style.height = (vv.height - 16) + 'px'; B.pop.style.bottom = 'auto'; }
    else { B.pop.style.top = ''; B.pop.style.bottom = ''; B.pop.style.height = ''; }
  }
  function isOpen() { return !!C.el; }
  window.HomeChat = { _test: { mutedThem: function () { return muteOf(other()) > Date.now(); }, reactions: function () { return reactions(); } }, init: init, mount: mount, unmount: unmount, bubble: bubble, hideBubble: function () { if (B.btn) B.btn.hidden = true; closePop(); }, openPop: openPop, closePop: closePop, popOpen: function () { return !!B.pop; }, unread: unread, last: last, refresh: fetchChat, isOpen: function () { return !!C.el; }, ttlName: function (ms) { return ttlName(ms); }, ttl: function () { return C.ttl; }, setTtl: setTtl, TTLS: TTLS };
})();
