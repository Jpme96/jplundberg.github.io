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
    return SC.api('chat').then(function (srv) {
      var recs = srv.msgs || {}, jobs = [], seen = {}, bad = 0;
      Object.keys(recs).forEach(function (id) {
        var r = recs[id]; seen[id] = 1;
        if (r.del) { delete C.msgs[id]; return; }
        if (C.msgs[id] && !C.msgs[id].pending) return;
        jobs.push(SC.decrypt(C.opt.key, r).then(function (o) { C.msgs[id] = { id: id, t: r.t, by: r.by, text: String(o.text || '').slice(0, 20000), files: Array.isArray(o.files) ? o.files.slice(0, 10) : [], sys: o.sys || null, ttl: +o.ttl || 0 }; }, function () { bad++; }));
      });
      return Promise.all(jobs).then(function () {
        Object.keys(C.msgs).forEach(function (id) { if (!seen[id] && !C.msgs[id].pending && !C.msgs[id].failed) delete C.msgs[id]; });   /* gone: removed or too old */
        C.rev = srv.rev; C.ttl = srv.ttl || 0; C.bad = bad;
      });
    }).then(function () { C.busy = false; C.missing = false; changed(); if (C.again) { C.again = false; fetchChat(); } }, function (e) { C.busy = false; if (e && e.status === 404 && !C.missing) { C.missing = true; changed(); } });
  }
  function list() {
    var now = Date.now();
    return Object.keys(C.msgs).map(function (id) { return C.msgs[id]; }).filter(function (m) { return !C.ttl || m.pending || now - m.t < C.ttl; }).sort(function (a, b) { return a.t - b.t; });
  }
  function unread() { var r = +rj(readKey(), 0) || 0, o = other(); return list().filter(function (m) { return m.by === o && !m.sys && m.t > r; }).length; }
  function last() { var l = list().filter(function (m) { return !m.sys; }); return l[l.length - 1] || null; }
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
    var prep = isImg && !/gif/i.test(f.type) ? shrink(f, 2048, 0.85).then(function (big) { return shrink(f, 40, 0.5).then(function (th) { return { blob: big.blob, w: big.w, h: big.h, th: th.url, type: 'image/jpeg', name: f.name.replace(/\.\w+$/, '') + '.jpg' }; }); }, function () { return { blob: f, type: f.type, name: f.name }; })
      : Promise.resolve({ blob: f, type: f.type || 'application/octet-stream', name: f.name || 'file' });
    return prep.then(function (p) {
      if (p.blob.size > 24 * 1048576) throw new Error(L('Too big – the limit is 24 MB', 'For stor – grensen er 24 MB'));
      var fid = hex(16);
      return p.blob.arrayBuffer().then(function (buf) { return SC.encryptBytes(C.opt.key, buf); }).then(function (enc) {
        return fetch('/cmd/api/cfile?id=' + fid, { method: 'PUT', body: enc, credentials: 'same-origin' });
      }).then(function (r) { if (!r.ok) throw new Error(L('The file could not be sent', 'Filen kunne ikke sendes')); C.urls[fid] = URL.createObjectURL(p.blob);
        return { id: fid, name: String(p.name).slice(0, 120), type: String(p.type).slice(0, 60), size: p.blob.size, w: p.w || 0, h: p.h || 0, th: p.th || '' }; });
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
    var id = hex(16), t = Date.now() - C.skew * 0, m = { id: id, t: t, by: C.opt.me, text: text, files: files.map(function (f) { return { id: 'tmp', name: f.name, type: f.type, size: f.size, local: URL.createObjectURL(f) }; }), sys: extra && extra.sys || null, ttl: extra && extra.ttl || 0, pending: true };
    C.msgs[id] = m; changed(); scrollEnd(true);
    var go = function () {
      m.failed = false; m.pending = true; changed();
      return Promise.all(files.map(encFile)).then(function (fl) {
        var body = { text: text, files: fl }; if (m.sys) { body.sys = m.sys; body.ttl = m.ttl; }
        return SC.encrypt(C.opt.key, body).then(function (e) { var b = { msgs: {} }; b.msgs[id] = { t: t, iv: e.iv, ct: e.ct, fl: fl.map(function (f) { return f.id; }) }; if (extra && extra.setTtl != null) b.ttl = extra.setTtl; return put(b); })
          .then(function (srv) { m.files = fl; m.pending = false; C.rev = -2; if (srv && srv.ttl != null) C.ttl = srv.ttl; changed(); fetchChat(); nudge(text, fl); });
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
    var body = text ? text.slice(0, 120) : fl.length ? (fl.some(function (f) { return /^image\//.test(f.type); }) ? L('📷 Photo', '📷 Bilde') : L('📎 File', '📎 Fil')) : '';
    if (!body) return;
    SC.api('push', { method: 'POST', body: { notify: { title: C.opt.name(C.opt.me), body: body, tag: 'chat' } } }).catch(function () {});
  }
  function remove(id) { var m = C.msgs[id]; if (!m || m.by !== C.opt.me) return; if (m.pending || m.failed) { delete C.msgs[id]; changed(); return; } delete C.msgs[id]; changed(); put({ del: [id] }).then(fetchChat, fetchChat); }
  function setTtl(ms) { if (ms === C.ttl) return; send('', [], { sys: 'ttl', ttl: ms, setTtl: ms }); C.ttl = ms; }

  /* ---------- files on screen ---------- */
  function fileUrl(f) {
    if (f.local) return Promise.resolve(f.local);
    if (C.urls[f.id]) return Promise.resolve(C.urls[f.id]);
    if (C.urls[f.id + ':p']) return C.urls[f.id + ':p'];
    var p = fetch('/cmd/api/cfile?id=' + f.id, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('gone'); return r.arrayBuffer(); })
      .then(function (buf) { return SC.decryptBytes(C.opt.key, buf); }).then(function (pt) { var u = URL.createObjectURL(new Blob([pt], { type: f.type || 'application/octet-stream' })); C.urls[f.id] = u; return u; });
    C.urls[f.id + ':p'] = p; p.catch(function () { delete C.urls[f.id + ':p']; });
    return p;
  }
  function loadImgs() {
    if (!C.el) return;
    C.el.querySelectorAll('img[data-fid]:not([data-ok])').forEach(function (im) {
      var m = C.msgs[im.dataset.mid], f = m && m.files.filter(function (x) { return x.id === im.dataset.fid; })[0]; if (!f) return;
      im.setAttribute('data-ok', '1'); fileUrl(f).then(function (u) { im.src = u; im.classList.add('on'); }, function () { im.classList.add('gone'); });
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
      '.hc-tt{flex:1;min-width:0}.hc-tt b{display:block;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hc-tt small{display:block;color:var(--hc-mut);font-size:12.5px;min-height:16px}',
      '.hc-tt small.typ{color:var(--hc-acc)}',
      '.hc-ib{flex:none;width:38px;height:38px;border-radius:50%;border:0;background:transparent;color:inherit;font-size:18px;display:grid;place-items:center;cursor:pointer}.hc-ib:hover{background:rgba(127,127,127,.12)}',
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
      '.hc-imgs img{display:block;width:100%;height:100%;max-height:340px;object-fit:cover;opacity:0;transition:opacity .2s}.hc-imgs img.on{opacity:1}.hc-imgs.n2 img,.hc-imgs.n3 img,.hc-imgs.n4 img{aspect-ratio:1}',
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
      '.hc-menu p{margin:8px 12px 6px;font-size:12.5px;color:var(--hc-mut)}.hc-menu button{width:100%;display:flex;align-items:center;gap:12px;padding:12px;border:0;background:none;color:inherit;font:inherit;text-align:left;border-radius:12px;cursor:pointer}.hc-menu button:hover{background:rgba(127,127,127,.1)}',
      '.hc-menu button .bi{font-size:18px;width:22px;text-align:center}.hc-menu button.on .bi-check2{color:var(--hc-acc)}.hc-menu button.red{color:#e05555}.hc-menu .hc-quote{margin:4px 12px 8px;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.1);font-size:13.5px;max-height:90px;overflow:hidden;white-space:pre-wrap}',
      '.hc-view{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100;display:flex;align-items:center;justify-content:center}.hc-view img{max-width:100vw;max-height:100vh;object-fit:contain}.hc-view .hc-ib{position:absolute;top:calc(12px + env(safe-area-inset-top));color:#fff;background:rgba(255,255,255,.12)}',
      '.hc-toast{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);background:#222428;color:#fff;padding:8px 14px;border-radius:999px;font-size:13px;z-index:6;white-space:nowrap}',
      '@media (hover:hover){.hc-m{position:relative}.hc-more{position:absolute;top:2px;opacity:0;border:0;background:rgba(127,127,127,.18);color:inherit;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px}.hc-m:not(.me) .hc-more{right:-32px}.hc-m.me .hc-more{left:-32px}.hc-m:hover .hc-more{opacity:1}}',
      '@media (hover:none){.hc-more{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function head() {
    var o = other(), tp = +C.typing[o] || 0, now = Date.now() + C.skew, typing = now - tp < 7000;
    return '<div class="hc-head">' + (C.full ? '<button type="button" class="hc-ib" data-hcclose aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-chevron-left"></i></button>' : '') +
      '<div class="hc-faces">' + C.opt.face(o) + C.opt.face(C.opt.me) + '</div>' +
      '<div class="hc-tt"><b>' + esc(C.opt.name(o)) + '</b><small class="' + (typing ? 'typ' : '') + '">' + (typing ? esc(L('typing …', 'skriver …')) : C.ttl ? '<i class="bi bi-stopwatch"></i> ' + esc(L('Messages disappear after ', 'Meldinger forsvinner etter ') + ttlName(C.ttl)) : esc(L('Private – just you two', 'Privat – bare dere to'))) + '</small></div>' +
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
    var imgs = m.files.filter(function (f) { return /^image\//.test(f.type); }), other = m.files.filter(function (f) { return !/^image\//.test(f.type); });
    var h = '<div class="hc-m' + (me ? ' me' : '') + (cont ? ' cont' : ' gap') + (m.pending ? ' pending' : '') + (m.failed ? ' failed' : '') + '" data-mid="' + m.id + '">';
    if (imgs.length) h += '<div class="hc-imgs n' + Math.min(4, imgs.length) + '">' + imgs.map(function (f) { return '<button type="button" data-hcimg="' + esc(f.id) + '" style="' + (f.th ? 'background-image:url(' + f.th + ')' : '') + '"><img alt="" data-mid="' + m.id + '" data-fid="' + esc(f.id) + '"' + (f.local ? ' src="' + f.local + '" class="on" data-ok="1"' : '') + (f.w && f.h && imgs.length === 1 ? ' width="' + f.w + '" height="' + f.h + '"' : '') + '></button>'; }).join('') + '</div>';
    other.forEach(function (f) { h += '<button type="button" class="hc-file" data-hcfile="' + esc(f.id) + '"><i class="bi bi-file-earmark' + (/pdf/.test(f.type) ? '-pdf' : '') + '"></i><span><b>' + esc(f.name) + '</b><small>' + kb(f.size || 0) + '</small></span></button>'; });
    if (m.text) h += '<div class="hc-b">' + linkify(m.text) + '</div>';
    h += '<button type="button" class="hc-more" data-hcmore aria-label="' + L('More', 'Mer') + '"><i class="bi bi-three-dots"></i></button></div>';
    return h;
  }
  function metaFor(m, isLastMine) {
    if (m.failed) return '<div class="hc-meta">' + esc(m.err || L('Not sent', 'Ikke sendt')) + ' · <button type="button" data-hcretry="' + m.id + '">' + L('Try again', 'Prøv igjen') + '</button></div>';
    if (m.pending) return '<div class="hc-meta"><i class="bi bi-clock"></i> ' + L('Sending …', 'Sender …') + '</div>';
    var seenIt = isLastMine && (+C.seen[other()] || 0) >= m.t;
    return '<div class="hc-meta">' + hm(m.t) + (isLastMine ? ' · ' + (seenIt ? '<i class="bi bi-check2-all"></i> ' + L('Seen', 'Sett') : '<i class="bi bi-check2"></i> ' + L('Sent', 'Sendt')) : '') + '</div>';
  }
  function listHtml() {
    if (C.missing) return '<div class="hc-empty"><i class="bi bi-cloud-arrow-up"></i>' + esc(C.opt.missing || L('The chat is not switched on yet – the server needs an update.', 'Chatten er ikke slått på ennå – serveren må oppdateres.')) + '</div>';
    var l = list(); if (!l.length) return '<div class="hc-empty"><i class="bi bi-chat-heart"></i>' + esc(L('Say hi to ', 'Si hei til ') + C.opt.name(other())) + '<br><small>' + esc(L('Messages, photos and files – only your two phones can read them.', 'Meldinger, bilder og filer – bare telefonene deres kan lese dem.')) + '</small></div>';
    var out = C.bad ? '<div class="hc-sys"><i class="bi bi-exclamation-circle"></i> ' + esc(C.bad + L(' message(s) couldn’t be opened – one of your apps has an old invite. Scan the code again.', ' melding(er) kunne ikke åpnes – en av appene har en gammel invitasjon. Skann koden på nytt.')) + '</div>' : '', prev = null, lastMine = null; l.forEach(function (m) { if (m.by === C.opt.me && !m.sys) lastMine = m; });
    l.forEach(function (m, i) {
      if (!prev || dayName(prev.t) !== dayName(m.t)) { out += '<div class="hc-day">' + esc(dayName(m.t)) + '</div>'; prev = null; }
      out += msgHtml(m, prev);
      var nx = l[i + 1], endGroup = !nx || nx.sys || nx.by !== m.by || nx.t - m.t >= 180000 || dayName(nx.t) !== dayName(m.t);
      if (!m.sys && (endGroup || m.failed || m.pending)) out += '<div class="hc-m' + (m.by === C.opt.me ? ' me' : '') + '" style="margin-top:0">' + metaFor(m, m === lastMine) + '</div>';
      prev = m;
    });
    var o = other(), tp = +C.typing[o] || 0; if (Date.now() + C.skew - tp < 7000) out += '<div class="hc-typing" aria-label="' + esc(C.opt.name(o)) + ' ' + L('is typing', 'skriver') + '"><i></i><i></i><i></i></div>';
    return out;
  }
  function nearEnd() { var l = C.el && C.el.querySelector('.hc-list'); return !l || l.scrollHeight - l.scrollTop - l.clientHeight < 120; }
  function scrollEnd(force) { var l = C.el && C.el.querySelector('.hc-list'); if (!l) return; if (force || nearEnd()) requestAnimationFrame(function () { l.scrollTop = l.scrollHeight; }); }
  var lastList = '';
  function paintList() {
    if (!C.el) return;
    var hd = C.el.querySelector('.hc-headbox'); if (hd) { var h1 = head() + pins(); if (hd._h !== h1) { hd._h = h1; hd.innerHTML = h1; } }
    var box = C.el.querySelector('.hc-list'), h = listHtml(); if (h === lastList) return;
    var stick = nearEnd(), grew = list().length; lastList = h; box.innerHTML = h; loadImgs();
    if (stick || !C.painted) { C.painted = true; box.scrollTop = box.scrollHeight; } else { var d = C.el.querySelector('.hc-down'); if (d) d.hidden = false; }
    markRead();
  }
  function chips() { var c = C.el.querySelector('.hc-chips'); c.hidden = !C.picked.length; c.innerHTML = C.picked.map(function (f, i) { return '<span><i class="bi bi-' + (/^image\//.test(f.type) ? 'image' : 'paperclip') + '"></i><em>' + esc(f.name) + '</em><button type="button" data-hcunpick="' + i + '" aria-label="' + L('Remove', 'Fjern') + '"><i class="bi bi-x"></i></button></span>'; }).join(''); sendState(); }
  function sendState() { var t = C.el.querySelector('textarea'), b = C.el.querySelector('.hc-send'); if (b) b.disabled = !t.value.trim() && !C.picked.length; }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight + 2) + 'px'; }
  function toast(txt) { if (!C.el) return; var d = document.createElement('div'); d.className = 'hc-toast'; d.textContent = txt; C.el.querySelector('.hc').appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function menu(h, onClick) {
    var wrap = C.el.querySelector('.hc'), m = document.createElement('div'); m.className = 'hc-menu'; m.innerHTML = '<div>' + h + '</div>'; wrap.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) { m.remove(); return; } var b = e.target.closest('button'); if (b) { m.remove(); onClick(b); } });
  }
  function msgMenu(id) {
    var m = C.msgs[id]; if (!m) return;
    var mine = m.by === C.opt.me;
    menu((m.text ? '<div class="hc-quote">' + esc(m.text.slice(0, 300)) + '</div>' : '') +
      (m.text ? '<button type="button" data-a="copy"><i class="bi bi-copy"></i>' + L('Copy', 'Kopier') + '</button>' : '') +
      (m.text && notes() ? '<button type="button" data-a="pin"><i class="bi bi-pin-angle"></i>' + L('Pin to the top', 'Fest øverst') + '</button>' : '') +
      m.files.map(function (f, i) { return '<button type="button" data-a="dl" data-i="' + i + '"><i class="bi bi-download"></i>' + esc(L('Save ', 'Lagre ') + f.name) + '</button>'; }).join('') +
      (mine ? '<button type="button" data-a="del" class="red"><i class="bi bi-trash3"></i>' + L('Delete for both of you', 'Slett for dere begge') + '</button>' : ''), function (b) {
      var a = b.dataset.a;
      if (a === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(m.text) : Promise.reject()).then(function () { toast(L('Copied', 'Kopiert')); }, function () {}); }
      if (a === 'pin') { var ln = m.text.split('\n'), title = ln[0].slice(0, 60), rest = m.text.length > title.length ? m.text : ''; notes().add(title, rest); C.pinsOpen = true; toast(L('Pinned', 'Festet')); setTimeout(paintList, 50); }
      if (a === 'dl') download(m.files[+b.dataset.i]);
      if (a === 'del') remove(id);
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
    menu('<p>' + esc(L('Disappearing messages – for both of you', 'Meldinger som forsvinner – for dere begge')) + '</p>' + TTLS.map(function (t) { return '<button type="button" data-ttl="' + t[0] + '" class="' + (C.ttl === t[0] ? 'on' : '') + '"><i class="bi bi-' + (C.ttl === t[0] ? 'check2' : 'circle') + '"></i>' + esc(L(t[1], t[2])) + '</button>'; }).join(''), function (b) { if (b.dataset.ttl != null) setTtl(+b.dataset.ttl); });
  }
  function viewImg(fid) {
    var m = null, f = null; Object.keys(C.msgs).forEach(function (id) { (C.msgs[id].files || []).forEach(function (x) { if (x.id === fid) { m = C.msgs[id]; f = x; } }); }); if (!f) return;
    var v = document.createElement('div'); v.className = 'hc-view'; v.innerHTML = '<img alt=""><button type="button" class="hc-ib" style="left:12px" data-x aria-label="' + L('Close', 'Lukk') + '"><i class="bi bi-x-lg"></i></button><button type="button" class="hc-ib" style="right:12px" data-dl aria-label="' + L('Save', 'Lagre') + '"><i class="bi bi-download"></i></button>';
    document.body.appendChild(v); fileUrl(f).then(function (u) { v.querySelector('img').src = u; });
    v.addEventListener('click', function (e) { if (e.target.closest('[data-dl]')) { download(f); return; } v.remove(); });
  }
  var typT = 0;
  function bind(root) {
    var ta = root.querySelector('textarea'), fileIn = root.querySelector('input[type=file]'), lst = root.querySelector('.hc-list');
    var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    ta.addEventListener('input', function () { grow(ta); sendState(); var n = Date.now(); if (ta.value.trim() && n - typT > 3000) { typT = n; SC.livePost({ typing: 1 }); } });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && fine && !e.isComposing) { e.preventDefault(); submit(); } });
    function submit() { var t = ta.value, f = C.picked.slice(); if (!t.trim() && !f.length) return; ta.value = ''; grow(ta); C.picked = []; chips(); typT = 0; send(t, f); if (!fine) ta.blur(); else ta.focus(); }
    root.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    fileIn.addEventListener('change', function () { [].slice.call(fileIn.files || []).slice(0, 10 - C.picked.length).forEach(function (f) { C.picked.push(f); }); fileIn.value = ''; chips(); ta.focus(); });
    lst.addEventListener('scroll', function () { if (nearEnd()) { var d = root.querySelector('.hc-down'); if (d) d.hidden = true; markRead(); } }, { passive: true });
    /* hold a message (phone) for its menu */
    var hold = null; lst.addEventListener('touchstart', function (e) { var m = e.target.closest('.hc-m[data-mid]'); if (!m || e.target.closest('a')) return; hold = setTimeout(function () { hold = null; if (navigator.vibrate) navigator.vibrate(10); msgMenu(m.dataset.mid); }, 480); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { lst.addEventListener(ev, function () { clearTimeout(hold); }, { passive: true }); });
    lst.addEventListener('contextmenu', function (e) { var m = e.target.closest('.hc-m[data-mid]'); if (!m || e.target.closest('a')) return; e.preventDefault(); msgMenu(m.dataset.mid); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var d = b.dataset;
      if (d.hcclose != null) { unmount(); if (C.onClose) C.onClose(); return; }
      if (d.hcmenu != null) { settingsMenu(); return; }
      if (d.hcpins != null) { C.pinsOpen = !C.pinsOpen; paintList(); return; }
      if (d.hcpin) { pinMenu(d.hcpin); return; }
      if (d.hcmore != null) { msgMenu(b.closest('[data-mid]').dataset.mid); return; }
      if (d.hcimg) { viewImg(d.hcimg); return; }
      if (d.hcfile) { var m = C.msgs[b.closest('[data-mid]').dataset.mid]; var f = m && m.files.filter(function (x) { return x.id === d.hcfile; })[0]; if (f) download(f); return; }
      if (d.hcretry) { var r = C.msgs[d.hcretry]; if (r && r.retry) r.retry(); return; }
      if (d.hcunpick != null) { C.picked.splice(+d.hcunpick, 1); chips(); return; }
      if (d.hcattach != null) { fileIn.click(); return; }
      if (d.hcdown != null) { scrollEnd(true); b.hidden = true; return; }
    });
    /* paste a picture straight in (computer) */
    ta.addEventListener('paste', function (e) { var it = [].slice.call((e.clipboardData || {}).files || []); if (it.length) { e.preventDefault(); it.slice(0, 10 - C.picked.length).forEach(function (f) { C.picked.push(f); }); chips(); } });
    root.addEventListener('dragover', function (e) { e.preventDefault(); });
    root.addEventListener('drop', function (e) { e.preventDefault(); [].slice.call((e.dataTransfer || {}).files || []).slice(0, 10 - C.picked.length).forEach(function (f) { C.picked.push(f); }); chips(); });
  }
  function mount(el, o) {
    o = o || {}; css(); if (C.el && C.el !== el) unmount();
    C.el = el; C.full = !!o.full; C.pop = !!o.pop; C.onClose = o.onClose || null; C.open = true; C.painted = false; lastList = '';
    el.innerHTML = '<div class="hc"><div class="hc-headbox"></div><div class="hc-list" role="log" aria-live="polite"></div><button type="button" class="hc-down" data-hcdown hidden><i class="bi bi-arrow-down"></i> ' + L('New messages', 'Nye meldinger') + '</button>' +
      '<form class="hc-comp"><div class="hc-chips" hidden></div><div class="hc-row"><button type="button" class="hc-ib" data-hcattach aria-label="' + L('Add a photo or file', 'Legg til bilde eller fil') + '"><i class="bi bi-plus-lg"></i></button>' +
      '<textarea rows="1" placeholder="' + esc(L('Message', 'Melding')) + '" enterkeyhint="send" aria-label="' + L('Message', 'Melding') + '"></textarea><button type="submit" class="hc-ib hc-send" disabled aria-label="' + L('Send', 'Send') + '"><i class="bi bi-arrow-up"></i></button></div>' +
      '<input type="file" multiple hidden accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.heic,video/*"></form></div>';
    bind(el); chips(); paintList(); SC.liveSpeed(true); fetchChat();
  }
  function unmount() { if (!C.el) return; if (C.open) SC.liveSpeed(false); C.open = false; C.el.innerHTML = ''; C.el = null; lastList = ''; }
  function onLive(j) {
    if (!C.opt || !j) return;
    if (j.now) C.skew = j.now - Date.now();
    C.typing = j.typing || {}; C.seen = j.seen || {};
    if (j.chat != null && j.chat !== C.rev) fetchChat(); else if (C.el) paintList();
  }
  function init(opt) {
    var first = !C.opt; C.opt = opt; if (!first) return;
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
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && B.pop && !B.pop.querySelector('.hc-menu')) closePop(); });
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
    var bg = document.createElement('div'); bg.className = 'hc-popbg'; document.body.appendChild(bg); bg.addEventListener('click', closePop);
    B.pop = document.createElement('div'); B.pop.className = 'hc-pop'; B.pop.setAttribute('role', 'dialog'); B.pop.setAttribute('aria-label', B.opt.label || 'Chat'); B.pop._bg = bg; document.body.appendChild(B.pop);
    mount(B.pop, { pop: true, onClose: closePop }); B.btn.classList.add('on'); badge(); fitPop();
    requestAnimationFrame(function () { if (B.pop) B.pop.classList.add('in'); });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) { var ta = B.pop.querySelector('textarea'); if (ta) ta.focus(); }
    if (B.opt.onOpen) B.opt.onOpen();
  }
  function closePop() {
    if (!B.pop) return; var p = B.pop; B.pop = null; if (C.el === p.firstChild || C.el === p) unmount(); else if (isOpen()) unmount();
    if (p._bg) p._bg.remove(); p.classList.remove('in'); setTimeout(function () { p.remove(); }, 170); if (B.btn) B.btn.classList.remove('on'); badge();
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
  window.HomeChat = { init: init, mount: mount, unmount: unmount, bubble: bubble, hideBubble: function () { if (B.btn) B.btn.hidden = true; closePop(); }, openPop: openPop, closePop: closePop, popOpen: function () { return !!B.pop; }, unread: unread, last: last, refresh: fetchChat, isOpen: function () { return !!C.el; }, ttlName: function (ms) { return ttlName(ms); }, ttl: function () { return C.ttl; }, setTtl: setTtl, TTLS: TTLS };
})();
