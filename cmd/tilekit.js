/* Customize any group of number tiles – the key numbers at the top of Finances, Health and Travel,
   and the tiles in Training, Flex time, Subscriptions and the other cards.

   Each tile can be a Tile (always shown), go into the Stack (one tile you swipe through, like an
   iPhone widget) or be hidden, and the order can be changed. Nothing changes until you customize.
   Stored per group in dash.settings.tiles, so it follows you to every device.

   Works on whatever the page draws: a tile needs data-tk (its key) and its group is the container's
   id or the card's data-tool. The Apple Health card has its own, richer version (ahealth.js). */
(function () {
  "use strict";
  if (!window.Vault) return;
  var SEL = '.fp-tiles, .kit-tiles', TILE = '.fp-tile[data-tk], .kit-tile[data-tk]';
  var editing = {};                 // group → true while its editor is open
  var stackAt = {};                 // group → which stacked tile is showing
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} window.dispatchEvent(new Event('dash:local')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function groupOf(box) {
    if (box.id) return box.id;
    var t = box.closest('[data-tool]'); return t ? 'tool:' + t.dataset.tool : null;
  }
  function conf(g) { return ((readJSON('dash.settings', {}) || {}).tiles || {})[g] || {}; }
  function save(g, fn) {
    var st = readJSON('dash.settings', {}) || {}; st.tiles = st.tiles || {};
    var c = st.tiles[g] || {}; fn(c);
    if (!c.order && !c.where) delete st.tiles[g]; else st.tiles[g] = c;
    writeJSON('dash.settings', st);
  }
  /* a key that stays the same next month and next year ("Income in Oct" → "Income in M") */
  var MON = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/gi;
  function key(t) { return (t.dataset.tk || '').replace(MON, 'M'); }
  function tilesIn(box) { return Array.prototype.slice.call(box.querySelectorAll(TILE)); }
  function labelOf(t) { var l = t.querySelector('.lbl, :scope > span'); return (l ? l.textContent : key(t)).trim(); }

  /* put the tiles in order, move some into the stack, hide the rest */
  function apply(box) {
    var g = groupOf(box); if (!g) return;
    var tiles = tilesIn(box); if (!tiles.length) return;
    tiles.forEach(function (t) { t.dataset.tkd = '1'; });
    var c = conf(g), where = c.where || {}, order = c.order || [];
    var plain = !c.order && !c.where;
    var old = box.querySelector(':scope > .tk-stack'); if (old) { tilesIn(old).forEach(function (t) { box.appendChild(t); }); old.remove(); }
    tiles.sort(function (a, b) {
      var ia = order.indexOf(key(a)), ib = order.indexOf(key(b)), na = tiles.indexOf(a), nb = tiles.indexOf(b);
      return (ia < 0 ? 99 + na : ia) - (ib < 0 ? 99 + nb : ib);
    });
    var stacked = [];
    tiles.forEach(function (t) {
      var w = where[key(t)] || 'tile';
      t.hidden = w === 'off';
      if (w === 'stack') stacked.push(t); else if (!plain) box.appendChild(t);
    });
    var bar = box.parentNode && box.nextElementSibling && box.nextElementSibling.classList.contains('tk-bar') ? box.nextElementSibling : null;
    if (stacked.length) {
      var s = document.createElement('div'); s.className = 'tk-stack'; s.setAttribute('role', 'group'); s.setAttribute('aria-label', 'More numbers – swipe');
      var tr = document.createElement('div'); tr.className = 'tk-track'; s.appendChild(tr);
      stacked.forEach(function (t) { tr.appendChild(t); });
      if (stacked.length > 1) {
        var dots = document.createElement('div'); dots.className = 'tk-dots';
        dots.innerHTML = stacked.map(function (t, i) { return '<button type="button" data-tkdot="' + i + '" aria-label="' + esc(labelOf(t)) + '"></button>'; }).join('');
        s.appendChild(dots);
      }
      box.appendChild(s);
      var at = Math.min(stackAt[g] || 0, stacked.length - 1);
      var mark = function (n) { s.querySelectorAll('[data-tkdot]').forEach(function (d, i) { d.classList.toggle('on', i === n); }); };
      mark(at); requestAnimationFrame(function () { tr.scrollLeft = at * tr.clientWidth; });
      tr.addEventListener('scroll', function () { var n = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (n !== stackAt[g]) { stackAt[g] = n; mark(n); } }, { passive: true });
    }
    box.classList.toggle('tk-has-stack', stacked.length > 0);
    /* the Customize button under the group, and the editor when it is open */
    if (!bar) { bar = document.createElement('div'); bar.className = 'tk-bar'; box.parentNode.insertBefore(bar, box.nextSibling); }
    bar.dataset.tkg = g;
    if (!editing[g]) {
      bar.innerHTML = '<button type="button" class="text-btn tk-edit" data-tkedit="' + esc(g) + '"><i class="bi bi-grid-1x2"></i> Customize</button>';
      box.hidden = false; return;
    }
    var all = tilesIn(box);
    box.hidden = true;
    bar.innerHTML = '<div class="tk-editor"><p class="muted">Tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.</p>' +
      all.map(function (t, i) {
        var k = key(t), w = where[k] || 'tile';
        return '<div class="tk-row"><span class="tk-name">' + esc(labelOf(t)) + '</span><span class="seg" role="group" aria-label="' + esc(labelOf(t)) + '">' +
          [['tile', 'Tile'], ['stack', 'Stack'], ['off', 'Hide']].map(function (o) { return '<button type="button" data-tkwhere="' + esc(k) + '" data-v="' + o[0] + '" aria-pressed="' + (w === o[0]) + '">' + o[1] + '</button>'; }).join('') +
          '</span><span class="tk-mv"><button type="button" class="icon-btn" data-tkmove="' + esc(k) + '" data-d="-1" aria-label="Move ' + esc(labelOf(t)) + ' up"' + (i ? '' : ' disabled') + '><i class="bi bi-arrow-up"></i></button>' +
          '<button type="button" class="icon-btn" data-tkmove="' + esc(k) + '" data-d="1" aria-label="Move ' + esc(labelOf(t)) + ' down"' + (i < all.length - 1 ? '' : ' disabled') + '><i class="bi bi-arrow-down"></i></button></span></div>';
      }).join('') +
      '<div class="tk-foot"><button type="button" class="text-btn" data-tkreset="' + esc(g) + '">Reset</button><button type="button" class="btn-primary" data-tkedit="' + esc(g) + '">Done</button></div></div>';
  }
  function boxOf(g) {
    var b = null; document.querySelectorAll(SEL).forEach(function (x) { if (groupOf(x) === g) b = x; }); return b;
  }
  function again(g) { var b = boxOf(g); if (b) apply(b); }

  /* draw on whatever appears or is redrawn */
  var queued = false;
  function scan() {
    queued = false;
    document.querySelectorAll(SEL).forEach(function (box) {
      if (tilesIn(box).some(function (t) { return !t.dataset.tkd; })) apply(box);
    });
  }
  new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(scan); } }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-tkedit]');
    if (ed) { var g = ed.dataset.tkedit; editing[g] = !editing[g]; again(g); var nb = document.querySelector('.tk-bar[data-tkg="' + g + '"] button'); if (nb) nb.focus(); return; }
    var wh = e.target.closest('[data-tkwhere]');
    if (wh) { var g2 = wh.closest('.tk-bar').dataset.tkg; save(g2, function (c) { c.where = c.where || {}; if (wh.dataset.v === 'tile') delete c.where[wh.dataset.tkwhere]; else c.where[wh.dataset.tkwhere] = wh.dataset.v; if (!Object.keys(c.where).length) delete c.where; }); again(g2); return; }
    var mv = e.target.closest('[data-tkmove]');
    if (mv) {
      var g3 = mv.closest('.tk-bar').dataset.tkg, box = boxOf(g3); if (!box) return;
      var ord = tilesIn(box).map(function (t) { return key(t); }), ix = ord.indexOf(mv.dataset.tkmove), to = ix + (+mv.dataset.d);
      if (to < 0 || to >= ord.length) return;
      ord.splice(to, 0, ord.splice(ix, 1)[0]); save(g3, function (c) { c.order = ord; }); again(g3);
      var b2 = document.querySelector('.tk-bar[data-tkg="' + g3 + '"] [data-tkmove="' + mv.dataset.tkmove + '"][data-d="' + mv.dataset.d + '"]'); if (b2 && !b2.disabled) b2.focus();
      return;
    }
    var rs = e.target.closest('[data-tkreset]');
    if (rs) { save(rs.dataset.tkreset, function (c) { delete c.order; delete c.where; }); again(rs.dataset.tkreset); return; }
    var dt = e.target.closest('[data-tkdot]');
    if (dt) { var tr = dt.closest('.tk-stack').querySelector('.tk-track'), n = +dt.dataset.tkdot; tr.scrollTo({ left: n * tr.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  });
  window.TileKit = { apply: apply };
})();
