/* "Your avatar" – the avatar maker on its own full-screen page (Phase L1b). The same page for your own avatar in cmd
   (Settings → Your avatar, or the edit button on the Home avatar), a person in People, and Iago's shared-home app.
     top      your avatar large, turn it around (front, three-quarter, side, back) and "See it move" (a small stage
              where it walks, picks up a cup, climbs a step and waves – the living-scene engine, so what you pick is
              what the scenes will show)
     tabs     Face, Hair, Body, Style, Extras, Pet, Moves (+ Settings for your own) – tap or swipe between them
     tiles    the maker's picture tiles and colour dots (avatar.js), bigger
     bar      Surprise me, Undo and Save always at the bottom; leaving with changes asks first
   Avatar.page(title, look, onSave, { mine }) opens it. */
(function () {
  'use strict';
  var A = window.Avatar; if (!A || !A._mk) return;
  var M = A._mk, esc = M.esc, NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  function sec(k) { for (var i = 0; i < M.MKT.length; i++) { var s = M.MKT[i][3].filter(function (x) { return x[0] === k; })[0]; if (s) return s; } return null; }
  function group(k) { return (M.MKT.filter(function (x) { return x[0] === k; })[0] || [0, 0, 0, []])[3]; }
  var TABS = [
    ['face', 'Face', 'Ansikt', group('face')],
    ['hair', 'Hair', 'Hår', group('hair')],
    ['body', 'Body', 'Kropp', group('body')],
    ['style', 'Style', 'Klær', group('style')],
    ['extras', 'Extras', 'Tilbehør', group('extras').filter(function (s) { return s[0] !== 'pet'; })],
    ['pet', 'Pet', 'Kjæledyr', [sec('pet')].filter(Boolean)],
    ['moves', 'Moves', 'Bevegelse', [['hand', 'The hand it uses for things', 'Hånden den bruker til ting'], ['walk', 'How it walks', 'Hvordan den går']]],
    ['settings', 'Settings', 'Innstillinger', null]
  ];
  var VIEWS = [['front', 'Front', 'Forfra'], ['q', '¾', '¾'], ['side', 'Side', 'Siden'], ['back', 'Back', 'Bakfra']];

  function css() {
    if (document.getElementById('avpCss')) return; M.css();
    var st = document.createElement('style'); st.id = 'avpCss';
    st.textContent = '.avp{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:var(--bg,#0e1117);color:var(--text,#eef0f4);font-family:inherit}' +
      '@media (prefers-color-scheme:light){.avp{background:var(--bg,#f6f4ef);color:var(--text,#1d2330)}}' +
      '.avp-top{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;border-bottom:1px solid rgba(127,127,127,.18)}' +
      '.avp-top b{flex:1;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.avp-ib{width:44px;height:44px;border-radius:50%;border:0;background:rgba(127,127,127,.14);color:inherit;font-size:20px;display:grid;place-items:center;cursor:pointer}' +
      '.avp-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
      '.avp-stage{padding:12px 16px 4px;display:grid;gap:10px;justify-items:center}' +
      '.avp-fig{width:min(100%,340px);aspect-ratio:1/1;border-radius:24px;overflow:hidden;background:radial-gradient(120% 90% at 50% 20%,#2a3346,#151a24)}.avp-fig svg{display:block;width:100%;height:100%}' +
      '.avp-testw{width:min(100%,460px)}.avp-testw[hidden]{display:none}.avp-test{width:100%;border-radius:18px;background:linear-gradient(#1e2636,#141925);display:block}' +
      '.avp-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.avp-row button{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer}' +
      '.avp-row button[aria-pressed="true"]{background:var(--accent,#8a5cf0);border-color:transparent;color:#fff}' +
      '.avp-tabs{position:sticky;top:0;z-index:2;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:10px 16px;background:inherit;border-bottom:1px solid rgba(127,127,127,.12)}.avp-tabs::-webkit-scrollbar{display:none}' +
      '.avp-tabs button{flex:none;min-height:40px;padding:0 16px;border-radius:999px;border:0;background:rgba(127,127,127,.14);color:inherit;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer}.avp-tabs button[aria-selected="true"]{background:var(--accent,#8a5cf0);color:#fff}' +
      '.avp-pane{padding:12px 16px 24px;display:grid;gap:18px;touch-action:pan-y}.avp-pane .avm-tiles{grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}' +
      '.avp-pane [data-avm-k="hand"][data-avm-v="left"] svg{transform:scaleX(-1)}' +
      '.avp-set{display:grid;gap:2px}.avp-set label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;font-size:15px;border-bottom:1px solid rgba(127,127,127,.12)}.avp-set small{display:block;opacity:.7;font-size:12.5px}' +
      '.avp-set select{min-height:40px;border-radius:10px;font:inherit;font-size:15px;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.35);padding:0 8px}' +
      '.avp-bar{display:flex;gap:8px;padding:10px 16px calc(env(safe-area-inset-bottom,0px) + 10px);border-top:1px solid rgba(127,127,127,.18);background:inherit}' +
      '.avp-bar button{flex:1;min-height:46px;padding:0 6px;white-space:nowrap;border-radius:14px;border:0;background:rgba(127,127,127,.16);color:inherit;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer}.avp-bar button:disabled{opacity:.4}.avp-bar .hot{background:var(--accent,#8a5cf0);color:#fff}' +
      '.avp-ask{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);padding:14px;border-radius:16px;background:#232a38;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.4);display:grid;gap:10px}.avp-ask[hidden]{display:none}' +
      '.avp-ask div{display:flex;gap:8px;flex-wrap:wrap}.avp-ask button{flex:1;min-height:42px;border-radius:12px;border:0;font:inherit;font-weight:600;cursor:pointer;background:rgba(255,255,255,.12);color:#fff}.avp-ask .hot{background:var(--accent,#8a5cf0)}' +
      '@media (prefers-reduced-motion:reduce){.avp *{animation:none!important;transition:none!important}}';
    document.head.appendChild(st);
  }
  function on(k) { return window.Delight && window.Delight.on ? window.Delight.on(k) : true; }
  function dget() { return window.Delight && window.Delight.get ? window.Delight.get() : {}; }
  function settings(cur) {
    var sw = function (k, t, s) { return '<label><span>' + esc(t) + (s ? '<small>' + esc(s) + '</small>' : '') + '</span><input type="checkbox" class="switch" data-dltouch="' + k + '"' + (on(k) ? ' checked' : '') + '></label>'; };
    var say = dget().avSay === 'all' || dget().avSay === 'fun' ? dget().avSay : 'nomoney', live = dget().avLive || 'normal';
    var sel = function (attr, val, opts) { return '<select ' + attr + '>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    return '<div class="avp-set">' +
      sw('avatar', L('Avatar on Home', 'Avatar på Hjem'), L('A little you that follows your day', 'En liten deg som følger dagen din')) +
      sw('scMe', L('You in the page pictures', 'Deg i sidebildene'), L('Finances, Calendar, Travel, Goals and more', 'Økonomi, Kalender, Reise, Mål og mer')) +
      '<label><span>' + L('How lively', 'Hvor livlig') + '<small>' + L('What it does in the page pictures', 'Hva den gjør i sidebildene') + '</small></span>' + sel('data-avlive', live, [['lively', L('Lively', 'Livlig')], ['normal', L('Normal', 'Vanlig')], ['calm', L('Calm', 'Rolig')], ['still', L('Still pictures', 'Stillbilder')]]) + '</label>' +
      '<label><span>' + L('What it says', 'Hva den sier') + '<small>' + L('The speech bubble is on screen for anyone nearby', 'Snakkeboblen vises for alle i nærheten') + '</small></span>' + sel('data-avsay', say, [['nomoney', L('All but money', 'Alt unntatt penger')], ['all', L('Everything', 'Alt')], ['fun', L('Only the fun bits', 'Bare det morsomme')]]) + '</label>' +
      '<label><span>' + L('Dress for the season', 'Kle seg etter sesongen') + '<small>' + L('Christmas jumper in December, a bunad on 17 May (Norway’s national day), shorts in July', 'Julegenser i desember, bunad på 17. mai, shorts i juli') + '</small></span><input type="checkbox" class="switch" data-avm-auto' + (cur.auto === 'on' ? ' checked' : '') + '></label>' +
      sw('avWear', L('Dress for the weather', 'Kle seg for været'), L('Umbrella in rain, a warm jacket, beanie and scarf when it’s cold, a T-shirt when it’s warm, sunglasses in July', 'Paraply i regn, varm jakke, lue og skjerf når det er kaldt, T-skjorte når det er varmt, solbriller i juli')) +
      sw('avMood', L('Mood from your day', 'Humør fra dagen din'), L('Tired after a short night, a drop of sweat when bills are overdue', 'Trøtt etter en kort natt, en svettedråpe når regninger er forfalt')) +
      sw('avBadge', L('Moment badge on your photo', 'Merke på bildet ditt'), L('Coffee, umbrella, gym, trip … in the top bar', 'Kaffe, paraply, trening, reise … i toppen')) +
      '</div>';
  }

  function page(title, start, onSave, opts) {
    opts = opts || {}; css();
    var old = document.querySelector('.avp'); if (old) old.remove();
    var cur = M.migrate(start), saved = JSON.stringify(cur), undo = [], tab = 'face', view = 'front', playing = null;
    var tabs = TABS.filter(function (t) { return t[0] !== 'settings' || opts.mine; });
    var el = document.createElement('div'); el.className = 'avp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title); el.setAttribute('data-noi18n', '');
    el.innerHTML = '<header class="avp-top"><button type="button" class="avp-ib" data-avp-back aria-label="' + esc(L('Back', 'Tilbake')) + '"><i class="bi bi-chevron-left"></i></button><b>' + esc(title) + '</b></header>' +
      '<div class="avp-scroll"><section class="avp-stage"><div class="avp-fig av-prev"></div>' +
      '<div class="avp-row" role="group" aria-label="' + esc(L('Turn it around', 'Snu den')) + '">' + VIEWS.map(function (v) { return '<button type="button" data-avp-view="' + v[0] + '" aria-pressed="' + (v[0] === view) + '">' + esc(L(v[1], v[2])) + '</button>'; }).join('') +
      '<button type="button" data-avp-play><i class="bi bi-play-fill"></i> ' + esc(L('See it move', 'Se den bevege seg')) + '</button>' +
      /* Match with the one you share your home with (C10): their top and its colour, one tap, Undo brings yours back */
      (opts.match && opts.match.look ? '<button type="button" data-avp-match><i class="bi bi-people"></i> ' + esc(L('Match with ' + (opts.match.name || 'them'), 'Match med ' + (opts.match.name || 'dem'))) + '</button>' : '') + '</div>' +
      '<div class="avp-testw" hidden><svg class="avp-test" viewBox="0 0 240 120" aria-hidden="true"></svg></div></section>' +
      '<nav class="avp-tabs" role="tablist"></nav><div class="avp-pane" role="tabpanel"></div></div>' +
      '<footer class="avp-bar"><button type="button" data-avp-rand><i class="bi bi-shuffle"></i> ' + esc(L('Surprise me', 'Overrask meg')) + '</button><button type="button" data-avp-undo disabled><i class="bi bi-arrow-counterclockwise"></i> ' + esc(L('Undo', 'Angre')) + '</button><button type="button" class="hot" data-avp-save>' + esc(L('Save', 'Lagre')) + '</button></footer>' +
      '<div class="avp-ask" hidden role="alertdialog"><b>' + esc(L('Save your changes?', 'Lagre endringene?')) + '</b><div><button type="button" class="hot" data-avp-save>' + esc(L('Save', 'Lagre')) + '</button><button type="button" data-avp-drop>' + esc(L('Don’t save', 'Ikke lagre')) + '</button><button type="button" data-avp-stay>' + esc(L('Keep editing', 'Fortsett')) + '</button></div></div>';
    document.body.appendChild(el);
    var fig = el.querySelector('.avp-fig'), pane = el.querySelector('.avp-pane'), nav = el.querySelector('.avp-tabs'), test = el.querySelector('.avp-test'), testW = el.querySelector('.avp-testw'), scroll = el.querySelector('.avp-scroll');
    var prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    function dirty() { return JSON.stringify(cur) !== saved; }
    function drawFig() {
      var A25 = { front: 18, q: 40, side: 90, back: 180 };
      fig.innerHTML = M.figure(Object.assign({}, M.PLAIN, window.Fig25 ? { a: A25[view] != null ? A25[view] : 18 } : {}), Object.assign({}, cur)).replace('viewBox="0 0 200 200"', 'viewBox="22 8 156 172"');
      if (view !== 'front' && window.Rig && !window.Fig25) {
        var svg = fig.querySelector('svg'), r = window.Rig(svg, cur);
        if (view === 'back') { Rig.turn(r, .001); Rig.back(r, true, cur); } else Rig.turn(r, view === 'q' ? .55 : 1);
      }
    }
    function drawTabs() { nav.innerHTML = tabs.map(function (t) { return '<button type="button" role="tab" data-avp-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + esc(L(t[1], t[2])) + '</button>'; }).join(''); var b = nav.querySelector('[aria-selected="true"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    function drawPane() {
      var t = tabs.filter(function (x) { return x[0] === tab; })[0] || tabs[0];
      pane.innerHTML = t[0] === 'settings' ? settings(cur) : t[3].map(function (s) { return M.sec(cur, s); }).join('');
    }
    function redraw(keepPane) { drawFig(); if (!keepPane) { var y = scroll.scrollTop; drawPane(); scroll.scrollTop = y; } el.querySelector('[data-avp-undo]').disabled = !undo.length; if (playing) stopPlay(); }
    function change(n) { undo.push(JSON.stringify(cur)); if (undo.length > 40) undo.shift(); cur = n; redraw(); }
    function close() { stopPlay(); el.remove(); document.documentElement.style.overflow = prevOverflow; document.removeEventListener('keydown', key); if (opts.onClose) opts.onClose(); }
    function save() { try { onSave(Object.assign({}, cur)); } catch (e) {} saved = JSON.stringify(cur); close(); }
    function leave() { if (dirty()) el.querySelector('.avp-ask').hidden = false; else close(); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); leave(); } }
    document.addEventListener('keydown', key);
    function setTab(t) { tab = t; drawTabs(); drawPane(); var top = el.querySelector('.avp-stage').offsetHeight; if (scroll.scrollTop > top) scroll.scrollTop = top; }

    /* ---- see it move: a little stage with a table and a cup, and a step ---- */
    function stopPlay() { if (playing) { playing.R.tok++; playing = null; } test.innerHTML = ''; testW.hidden = true; }
    function play() {
      var Lv = window.Live; if (!Lv || !window.Rig) return;
      stopPlay(); testW.hidden = false;
      /* a person ≈ 1.75 m stands 86 tall here: the table top is at hip height, the cup fits the hand, the step is a stair step */
      test.innerHTML = '<rect x="0" y="108" width="240" height="12" fill="rgba(255,255,255,.06)"/>' +
        '<g class="avp-table"><rect x="128" y="74" width="34" height="3.5" rx="1.5" fill="#8a5d43"/><rect x="131" y="77" width="3" height="31" fill="#6b4a36"/><rect x="156" y="77" width="3" height="31" fill="#6b4a36"/></g>' +
        '<g class="avp-cup"><rect x="140" y="67.4" width="6" height="6.6" rx="1.3" fill="#f2f2f2"/><path d="M146 69q3 0 3 2t-3 2" stroke="#f2f2f2" stroke-width="1.1" fill="none"/></g>' +
        '<rect x="188" y="99" width="34" height="9" rx="1.5" fill="#596276"/><rect x="188" y="99" width="34" height="2" fill="#7a849a"/>';
      var H = Lv.Hero(test, null, { x: 34, y: 22, w: 60, h: 86 }, cur), R = Lv.Run(), base = H.pos.slice(), cup = test.querySelector('.avp-cup'), mug = null;
      R.alive = function () { return test.isConnected && !testW.hidden; };
      playing = { H: H, R: R };
      var main = cur.hand === 'left' ? 'L' : 'R', sp = cur.walk === 'quick' ? 34 : cur.walk === 'calm' ? 18 : 24, chair = cur.aid === 'chair', crutch = cur.aid === 'crutches';
      H.bounce = cur.walk === 'bouncy' ? 1.8 : cur.walk === 'calm' ? .7 : 1;
      var go = function (to) { return chair ? Lv.pos(R, H, to, Math.abs(to[0] - H.pos[0]) * 30) : Lv.walk(R, H, to, sp); };
      var seq = function (fns) { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); };
      var steps = [function () { return Lv.wait(R, 300); }, function () { return go([116, base[1]]); }];
      if (!crutch) steps.push(
        function () { H.gaze = [143, 70]; return Lv.turnTo(R, H, main === 'R' ? .6 : -.6, 250); },
        function () { return Lv.reach(R, H, main, [143, 70], 450); },
        function () { cup.style.display = 'none'; mug = Lv.Obj(H, main, '<rect x="-3" y="-3.3" width="6" height="6.6" rx="1.3" fill="#f2f2f2"/><path d="M3 -1.6q3 0 3 2t-3 2" stroke="#f2f2f2" stroke-width="1.1" fill="none"/>', [0, 1.5], { flip: main === 'L' }); H.gaze = null; return Lv.turnTo(R, H, 'front', 300); },
        function () { return Lv.drink(R, H, main, mug, 900); },
        function () { Lv.say(H, L('Mmm, coffee!', 'Mmm, kaffe!'), 1300); return Lv.reach(R, H, main, Lv.chest(H).map(function (v, i) { return v + (i ? 6 : (main === 'R' ? 10 : -10)) * H.s; }), 400); },
        function () { return Lv.wait(R, 700); },
        function () { H.gaze = [143, 70]; return Lv.turnTo(R, H, main === 'R' ? .6 : -.6, 250); },
        function () { return Lv.reach(R, H, main, [143, 70], 450); },
        function () { Lv.letGo(H, main); cup.style.display = ''; H.gaze = null; return Lv.reach(R, H, main, null, 350); });
      if (!chair) steps.push(
        function () { return go([182, base[1]]); },
        function () { return Lv.tw(R, 300, function (u) { H.legs.R = u * .7; }); },
        function () { return Lv.tw(R, 420, function (u) { H.pos = [182 + 18 * u, base[1] - 9 * Lv.ease(u)]; H.legs.R = .7 * (1 - u); H.legs.L = Math.sin(u * Math.PI) * .5; }); },
        function () { Lv.face(H, 'grin'); Lv.say(H, L('Hi!', 'Hei!'), 1400); return Lv.wave(R, H, main, 1700); },
        function () { return Lv.tw(R, 420, function (u) { H.pos = [200 - 18 * u, base[1] - 9 + 9 * Lv.ease(u)]; H.legs.L = Math.sin(u * Math.PI) * .5; }); });
      steps.push(function () { return Lv.settle(R, H, 300); }, function () { return go(base); }, function () { return Lv.turnTo(R, H, 'front', 250); });
      seq(steps).then(function () { if (playing && playing.R === R) setTimeout(function () { if (playing && playing.R === R) stopPlay(); }, 600); });
    }

    el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-avp-back]')) { leave(); return; }
      if (e.target.closest('[data-avp-stay]')) { el.querySelector('.avp-ask').hidden = true; return; }
      if (e.target.closest('[data-avp-drop]')) { close(); return; }
      if (e.target.closest('[data-avp-save]')) { save(); return; }
      if (e.target.closest('[data-avp-match]')) { var ml = opts.match.look || {}; undo.push(JSON.stringify(cur)); cur = Object.assign({}, cur, { top: ml.top || cur.top, bottom: ml.bottom || cur.bottom, legs: ml.legs || cur.legs });   /* the same outfit (tops have one standard colour since F0) */ redraw(); return; }
      if (e.target.closest('[data-avp-undo]')) { if (undo.length) { cur = JSON.parse(undo.pop()); redraw(); } return; }
      if (e.target.closest('[data-avp-rand]')) { change(Object.assign({}, M.rand(), { hand: cur.hand, walk: cur.walk, auto: cur.auto })); return; }
      if ((b = e.target.closest('[data-avp-tab]'))) { setTab(b.dataset.avpTab); return; }
      if ((b = e.target.closest('[data-avp-view]'))) { view = b.dataset.avpView; el.querySelectorAll('[data-avp-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); stopPlay(); drawFig(); return; }
      if (e.target.closest('[data-avp-play]')) { if (playing) stopPlay(); else play(); return; }
      if (e.target.closest('.avp-pane button[data-avm-k]')) { var r = M.act(e, cur); if (r && r.look) change(r.look); }
    });
    el.addEventListener('input', function (e) {
      var t = e.target, n = Object.assign({}, cur);
      if (t.matches('input[type="color"][data-avm-k]')) n[t.dataset.avmK] = t.value;
      else if (t.matches('[data-avm-chest]')) n.chest = t.value.replace(/[^0-9A-Za-zÆØÅæøå]/g, '').slice(0, 4);
      else if (t.matches('[data-avm-auto]')) n.auto = t.checked ? 'on' : 'off'; else return;
      undo.push(JSON.stringify(cur)); cur = n; redraw(true);   /* the field you're in stays as it is */
    });
    el.addEventListener('change', function (e) { var t = e.target; if (t.matches('[data-avlive]') && window.Delight && window.Delight.set) window.Delight.set({ avLive: t.value }); });
    /* swipe left/right on the choices to change tab */
    var sx = null, sy = 0;
    pane.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    pane.addEventListener('touchend', function (e) {
      if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || e.target.closest('input')) return;
      var i = tabs.map(function (x) { return x[0]; }).indexOf(tab), j = Math.max(0, Math.min(tabs.length - 1, i + (dx < 0 ? 1 : -1))); if (j !== i) setTab(tabs[j][0]);
    }, { passive: true });
    drawTabs(); redraw();
    var first = el.querySelector('[data-avp-back]'); if (first) first.focus();
    return { el: el, close: close, get: function () { return cur; } };
  }
  A.page = page;
})();
