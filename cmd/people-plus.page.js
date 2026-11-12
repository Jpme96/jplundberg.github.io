/* People, batch 5 (Oct 2026):
     Gift tracker      – what you gave whom and when, with a budget for Christmas, birthdays and other
                         occasions, a Christmas gift list, and each person's gifts in their card.
     Contacts import   – from an iPhone Shortcut (the list travels in the link after #, so it never
                         reaches a server) or a contact file (.vcf), with birthdays.
     A note after "Talked today" – one line, kept as a short history in the person's card.
     Name days and anniversaries – Norwegian name days (navnedager, from the almanac) by first name,
                         and "Other dates" (wedding, …) – in Coming up, At a glance and the calendar.
   Data in dash.tools: gifts [{id,pid,occ,date,what,cost,exp?}], people[].log [{d,t}], people[].dates,
   people[].xmas. Settings in peoplecfg (Settings → People). */
/* The page part of people-plus.js (made by cmd/split-page.js): loaded on its own page after tail.js; the everywhere part is people-plus.js. */
(function () {
  "use strict";
  if (!window.Vault || !window.Features) return;
  var __c = (window.__core || {})["peopleplus"]; if (!__c) return;
  var fromKey = __c.fromKey, today = __c.today, Fe = __c.Fe, PURPLE = __c.PURPLE, people = __c.people, cfg = __c.cfg, person = __c.person, toast = __c.toast, HL = __c.HL, gifts = __c.gifts, esc = __c.esc, fmt = __c.fmt, kr = __c.kr, on = __c.on, gyear = __c.gyear, askNote = __c.askNote, restore = __c.restore;
  var K = window.Kit;
  if (!HL) return;
  function pad(n) { return String(n).padStart(2, '0'); }
  function daysTo(k) { return Math.round((fromKey(k) - fromKey(today())) / 864e5); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $t(n) { return document.querySelector('[data-tool="' + n + '"]'); }
  function snapshot(k) { return JSON.parse(JSON.stringify(Fe.tools()[k] || null)); }
  var NB = window.I18N && window.I18N.lang === 'nb';
  function L(en, nb) { return NB ? nb : en; }
  var PINK = '#d55181';
  var OCC = [['bday', 'Birthday', 'balloon', PINK], ['xmas', 'Christmas', 'tree', '#22b35e'], ['other', 'Other occasion', 'gift', PURPLE]];
  function occ(k) { return OCC.filter(function (o) { return o[0] === k; })[0] || OCC[2]; }
  function occName(o) { return L(o[1], { bday: 'Bursdag', xmas: 'Jul', other: 'Annen anledning' }[o[0]]); }
  function giftCfg(def, after) {
    var defs = def || {};
    var f = [
      { k: 'what', type: 'title', label: 'What', ph: 'What you gave – e.g. a book, concert tickets', req: true },
      { k: 'pid', label: 'To', type: 'select', options: function () { return people().slice().sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); }).map(function (p) { return [p.id, p.name]; }); } },
      { k: 'occ', label: 'Occasion', type: 'select', options: OCC.map(function (o) { return [o[0], o[1]]; }), def: 'bday' },
      { k: 'cost', label: 'Cost', type: 'number', suffix: 'kr' },
      { k: 'date', label: 'Date', type: 'date', def: today }
    ].map(function (x) { return x.k in defs ? Object.assign({}, x, { def: defs[x.k] }) : x; });
    return { key: 'gifts', addTitle: 'Note a gift', editTitle: 'Edit gift', fields: f,
      beforeSave: function (it, isNew) { if (isNew && cfg().giftFin && +it.cost > 0) it.exp = uid(); },
      afterSave: function (it, isNew) {
        if (isNew && it.exp) {
          var d = window.Vault.get(), p = person(it.pid); d.expenses = d.expenses || [];
          d.expenses.push({ id: it.exp, t: Date.now(), date: it.date || today(), amount: +it.cost, cat: 'shopping', note: ('Gift: ' + it.what + (p ? ' (' + p.name + ')' : '')).slice(0, 80) });
          window.Vault.save(d); window.dispatchEvent(new Event('fin:change'));
        }
        toast('<i class="bi bi-gift"></i> ' + (isNew ? 'Gift noted' : 'Saved'));
        if (after) after(it, isNew);
      } };
  }
  function newGift(def, after) {
    if (!K) return;
    if (!people().length) { toast('<i class="bi bi-people"></i> Add the person first'); return; }
    K.edit(giftCfg(def, after), null);
  }
  function guessOcc(p) {
    var b = HL.bday(p), m = new Date().getMonth();
    if (b && b.n <= 30) return 'bday';
    if (m >= 9 && p.xmas) return 'xmas';
    return b && b.n <= 60 ? 'bday' : m >= 10 ? 'xmas' : 'other';
  }
  function detail(p) {
    var gl = gifts().filter(function (g) { return g.pid === p.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var log = Array.isArray(p.log) ? p.log : [], all = OPENLOG[p.id];
    var lookSec = window.Avatar && window.Avatar.personLook ? '<div class="pp5-sec pp5-look"><span class="pp5-face">' + window.Avatar.figure({ k: 'plain', plain: true, bg: '#000', sky: 'none', attrs: ' width="56" height="56"' }, window.Avatar.personLook(p)).replace('viewBox="0 0 200 200"', 'viewBox="66 22 70 70"') + '</span><span class="muted hl-small">' + (p.look ? 'Their look in the People picture' : 'Picked from the name – make it look like them') + '</span><button type="button" class="text-btn" data-pplook="' + esc(p.id) + '"><i class="bi bi-person-bounding-box"></i> ' + (p.look ? 'Change look' : 'Customize look') + '</button></div>' : '';
    return lookSec + '<div class="pp5-sec"><div class="pp5-sh"><b><i class="bi bi-gift"></i> <span data-t="ui.gifts-given">Gifts given</span></b><button type="button" class="text-btn" data-ppgift="' + esc(p.id) + '"><i class="bi bi-plus-lg"></i> <span data-t="ui.note-a-gift">Note a gift</span></button></div>' +
      (gl.length ? '<ul class="pp5-list">' + gl.slice(0, all ? 50 : 4).map(function (g) {
        var o = occ(g.occ);
        return '<li><span class="pp5-d">' + esc(fmt(g.date, { month: 'short', year: 'numeric' })) + '</span><span class="pp5-t"><i class="bi bi-' + o[2] + '" style="color:' + o[3] + '"></i> <span data-noi18n>' + esc(g.what) + '</span></span>' + (+g.cost ? '<span class="pp5-k">' + kr(g.cost) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="hl-small muted" data-t="ui.nothing-noted-yet-then-you-never-give-th">Nothing noted yet – then you never give the same twice.</p>') + '</div>' +
      (log.length ? '<div class="pp5-sec"><div class="pp5-sh"><b><i class="bi bi-clock-history"></i> <span data-t="ui.talked">Talked</span></b>' + (log.length > 4 ? '<button type="button" class="text-btn" data-pplogall="' + esc(p.id) + '">' + (all ? 'Show less' : 'Show all ' + log.length) + '</button>' : '') + '</div><ul class="pp5-list">' +
        log.slice(0, all ? 40 : 4).map(function (x, i) { return '<li><span class="pp5-d">' + esc(fmt(x.d, { day: 'numeric', month: 'short', year: x.d.slice(0, 4) !== today().slice(0, 4) ? 'numeric' : undefined })) + '</span><span class="pp5-t"' + (x.t ? ' data-noi18n' : '') + '>' + (x.t ? esc(x.t) : '<span class="muted">–</span>') + '</span>' +
          '<button type="button" class="icon-btn sm" data-pplognote="' + esc(p.id) + '|' + i + '" aria-label="' + (x.t ? 'Change the note' : 'Add a note') + '"><i class="bi bi-pencil"></i></button></li>'; }).join('') + '</ul></div>' : '');
  }
  var OPENLOG = {};
  var GY = null;
  function drawGifts() {
    var el = $t('pgifts'); if (!el) return;
    var ok = on(); el.hidden = !ok; if (!ok) { el.innerHTML = ''; return; }
    var c = cfg(), y = GY || today().slice(0, 4), all = gifts(), gl = all.filter(function (g) { return gyear(g) === y; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var sum = function (l) { return l.reduce(function (s, g) { return s + (+g.cost || 0); }, 0); };
    var xm = gl.filter(function (g) { return g.occ === 'xmas'; }), bd = gl.filter(function (g) { return g.occ === 'bday'; }), ot = gl.filter(function (g) { return g.occ !== 'xmas' && g.occ !== 'bday'; });
    var years = {}; all.forEach(function (g) { years[gyear(g)] = 1; }); years[today().slice(0, 4)] = 1;
    var ys = Object.keys(years).filter(function (x) { return /^\d{4}$/.test(x); }).sort(), yi = ys.indexOf(y);
    var list = people().filter(function (p) { return p.xmas; }).sort(function (a, b) { return String(a.name).localeCompare(b.name, 'nb'); });
    var sorted = list.filter(function (p) { return xm.some(function (g) { return g.pid === p.id; }); }).length;
    var tl = function (k, label, val, sub) { return '<div class="kit-tile" data-tk="' + k + '"><span>' + label + '</span><b>' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    var over = function (spent, budget) { return budget && spent > budget ? '<span class="neg">' + kr(spent) + '</span>' : kr(spent); };
    var tiles = '<div class="kit-tiles" id="ppGiftTiles">' +
      tl('spent', 'Spent', kr(sum(gl)), y + ' · ' + gl.length + ' gift' + (gl.length === 1 ? '' : 's')) +
      tl('xmas', I18N.k('ui.christmas-gifts', 'Christmas gifts'), over(sum(xm), +c.gbXmas), +c.gbXmas ? 'of ' + kr(c.gbXmas) : list.length ? sorted + ' of ' + list.length + ' sorted' : 'No budget set') +
      tl('bday', 'Birthdays', kr(sum(bd)), bd.length ? (+c.gbBday ? 'budget ' + kr(c.gbBday) + ' each' : bd.length + ' gift' + (bd.length === 1 ? '' : 's')) : (+c.gbBday ? 'budget ' + kr(c.gbBday) + ' each' : 'None yet')) + '</div>';
    var xmasBox = '';
    if (list.length && y === today().slice(0, 4)) {
      var bud = +c.gbXmas, sp = sum(xm), pct = list.length ? Math.round(sorted / list.length * 100) : 0;
      xmasBox = '<div class="pp5-xmas"><div class="hs-prog" style="--c:#22b35e"><span><b>' + sorted + ' / ' + list.length + '</b> Christmas gifts sorted' + (bud ? ' · ' + (sp > bud ? '<span class="neg">' + kr(sp - bud) + ' over</span>' : kr(bud - sp) + ' left') : '') + '</span><i><em style="width:' + pct + '%"></em></i></div>' +
        '<ul class="pp5-xl">' + list.map(function (p) {
          var g = xm.filter(function (x) { return x.pid === p.id; });
          return '<li class="' + (g.length ? 'done' : '') + '"><i class="bi bi-' + (g.length ? 'check-circle-fill' : 'circle') + '"></i><span class="pp5-t"><b>' + esc(p.name) + '</b><small' + (g.length ? ' data-noi18n' : '') + '>' + (g.length ? esc(g.map(function (x) { return x.what + (+x.cost ? ' · ' + kr(x.cost) : ''); }).join(', ')) : esc(String(p.gifts || '').split('\n')[0] ? 'Idea: ' + String(p.gifts).split('\n')[0] : 'Nothing yet')) + '</small></span>' +
            '<button type="button" class="icon-btn sm" data-ppgift="' + esc(p.id) + '|xmas" aria-label="Note a Christmas gift for ' + esc(p.name) + '"><i class="bi bi-plus-lg"></i></button></li>';
        }).join('') + '</ul></div>';
    }
    var shown = GALL ? gl : gl.slice(0, 6);
    var body = tiles + xmasBox +
      (gl.length ? '<p class="st-minor pp5-minor">Given in ' + y + '</p><ul class="kit-list">' + shown.map(function (g) {
        var o = occ(g.occ), p = person(g.pid);
        return '<li class="kit-item"><button type="button" class="kit-main" data-ppgedit="' + esc(g.id) + '"><span class="kit-ic" style="--c:' + o[3] + '"><i class="bi bi-' + o[2] + '"></i></span><span class="kit-x"><b data-noi18n>' + esc(g.what) + '</b><small data-noi18n>' + esc([p ? p.name : '–', occName(o), fmt(g.date)].join(' · ')) + '</small></span>' + (+g.cost ? '<span class="kit-r">' + kr(g.cost) + '</span>' : '') + '</button></li>';
      }).join('') + '</ul>' + (gl.length > 6 ? '<button class="text-btn kit-more" type="button" data-ppgall>' + (GALL ? 'Show less' : 'Show all ' + gl.length) + '</button>' : '')
        : '<p class="empty kit-empty" data-t="ui.note-what-you-give-then-you-never-give-t">Note what you give – then you never give the same twice, and you see what Christmas and birthdays cost. Put people on the Christmas list from their card (Edit → On the Christmas gift list).</p>');
    var nav = ys.length > 1 ? '<button type="button" class="icon-btn" data-ppgy="-1" aria-label="Previous year"' + (yi <= 0 ? ' disabled' : '') + '><i class="bi bi-chevron-left"></i></button><button type="button" class="icon-btn" data-ppgy="1" aria-label="Next year"' + (yi >= ys.length - 1 ? ' disabled' : '') + '><i class="bi bi-chevron-right"></i></button>' : '';
    el.innerHTML = '<section class="card kit-card" id="pgifts"><div class="card-head"><h2><i class="bi bi-gift"></i> <span data-t="ui.gifts">Gifts</span></h2><div class="head-actions">' + nav +
      '<button type="button" class="text-btn" data-ppgift=""><i class="bi bi-plus-lg"></i> <span data-t="ui.add">Add</span></button></div></div>' + body + '</section>';
    if (location.hash === '#pgifts' && document.documentElement.classList.contains('unlocked')) { history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400); }
  }
  var GALL = false;
  ['tools:change', 'features:change'].forEach(function (ev) { window.addEventListener(ev, function () { clearTimeout(drawGifts.t); drawGifts.t = setTimeout(drawGifts, 30); }); });
  window.Vault.onUnlock(function () { setTimeout(drawGifts, 50); setTimeout(fromHash, 400); });
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-pplook]')) && window.Avatar && window.Avatar.editor) {
      var pl = person(b.dataset.pplook); if (!pl) return;
      window.Avatar.editor(pl.name, window.Avatar.personLook(pl), function (lk) {
        var t = Fe.tools(); (t.people || []).forEach(function (x) { if (x.id === pl.id) x.look = lk; }); Fe.saveTools(t);
        toast('<i class="bi bi-person-bounding-box"></i> ' + esc(pl.name) + (NB ? ' har fått nytt utseende' : '’s look is saved'));
      });
      return;
    }
    if ((b = e.target.closest('[data-ppgift]'))) {
      var q = b.dataset.ppgift.split('|'), p = q[0] && person(q[0]);
      return newGift(p ? { pid: p.id, occ: q[1] || guessOcc(p) } : {});
    }
    if ((b = e.target.closest('[data-ppgave]'))) {
      var r = b.dataset.ppgave.split('|'), pp = person(r[0]); if (!pp) return;
      var idea = String(pp.gifts || '').split('\n').filter(Boolean)[+r[1]]; if (!idea) return;
      return newGift({ pid: pp.id, occ: guessOcc(pp), what: idea }, function (it, isNew) {
        if (!isNew) return;
        var t = Fe.tools(); (t.people || []).forEach(function (x) { if (x.id === pp.id) { var l = String(x.gifts || '').split('\n').filter(Boolean); l.splice(+r[1], 1); x.gifts = l.join('\n'); } }); Fe.saveTools(t);
      });
    }
    if ((b = e.target.closest('[data-ppgedit]')) && K) { var g = gifts().filter(function (x) { return x.id === b.dataset.ppgedit; })[0]; if (g) K.edit(giftCfg(), g); return; }
    if ((b = e.target.closest('[data-ppgy]'))) {
      var ys = {}; gifts().forEach(function (x) { ys[gyear(x)] = 1; }); ys[today().slice(0, 4)] = 1;
      var l = Object.keys(ys).filter(function (x) { return /^\d{4}$/.test(x); }).sort(), i = l.indexOf(GY || today().slice(0, 4)) + (+b.dataset.ppgy);
      if (l[i]) { GY = l[i]; drawGifts(); } return;
    }
    if (e.target.closest('[data-ppgall]')) { GALL = !GALL; return drawGifts(); }
    if ((b = e.target.closest('[data-pplogall]'))) { OPENLOG[b.dataset.pplogall] = !OPENLOG[b.dataset.pplogall]; if (window.Dash && window.Dash.reload) window.Dash.reload(); return; }
    if ((b = e.target.closest('[data-pplognote]'))) { var s = b.dataset.pplognote.split('|'); askNote(s[0], snapshot('people'), +s[1]); return; }
    if (e.target.closest('[data-ppimport]')) { e.preventDefault(); openImport(''); }
  });
  var MON = { jan: 1, january: 1, januar: 1, feb: 2, february: 2, februar: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, okt: 10, october: 10, oktober: 10, nov: 11, november: 11, dec: 12, des: 12, december: 12, desember: 12 };
  function pdate(s) {
    s = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var m, d, mo, y = null;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^--(\d{2})-?(\d{2})$/))) { mo = +m[1]; d = +m[2]; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\.?$/))) { d = +m[1]; mo = +m[2]; y = m[3] ? +m[3] : null; if (y && y < 100) y += y > 30 ? 1900 : 2000; }
    else if ((m = s.match(/^(\d{1,2})\.? ([a-zæøå]+)\.?,? ?(\d{4})?$/)) && MON[m[2]]) { d = +m[1]; mo = MON[m[2]]; y = m[3] ? +m[3] : null; }
    else if ((m = s.match(/^([a-z]+)\.? (\d{1,2}),? ?(\d{4})?$/)) && MON[m[1]]) { mo = MON[m[1]]; d = +m[2]; y = m[3] ? +m[3] : null; }
    else return null;
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    if (y && (y < 1900 || y > new Date().getFullYear())) y = null;      // the iPhone saves "no year" as 1604
    return pad(d) + '.' + pad(mo) + (y ? '.' + y : '');
  }
  function isPhone(s) { return /^[+(]?\d[\d\s().-]{4,}$/.test(String(s).trim()) && String(s).replace(/\D/g, '').length >= 5; }
  function parseVcf(text) {
    var out = [];
    String(text).replace(/\r?\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1).forEach(function (card) {
      var r = { name: '', bday: null, phone: '' };
      card.split(/\r?\n/).forEach(function (line) {
        var m = line.match(/^(?:item\d+\.)?([A-Z-]+)(?:;[^:]*)?:(.*)$/i); if (!m) return;
        var k = m[1].toUpperCase(), v = m[2].trim().replace(/\\,/g, ',').replace(/\\;/g, ';');
        if (k === 'FN' && !r.name) r.name = v;
        if (k === 'N' && !r.name) { var n = v.split(';'); r.nameN = [n[1], n[0]].filter(Boolean).join(' '); }
        if (k === 'BDAY') r.bday = pdate(v.replace(/T.*$/, ''));
        if (k === 'TEL' && !r.phone) r.phone = v;
      });
      r.name = r.name || r.nameN || ''; delete r.nameN;
      if (r.name) out.push(r);
    });
    return out;
  }
  function parseLines(text) {
    text = String(text || '');
    if (/BEGIN:VCARD/i.test(text)) return parseVcf(text);
    var out = [], seen = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var r = { name: '', bday: null, phone: '' };
      line.split(/\s*(?:;|\t|\s\|\s)\s*/).forEach(function (f) {
        if (!f) return;
        var d = !r.bday && pdate(f);
        if (d) r.bday = d; else if (isPhone(f)) { if (!r.phone) r.phone = f; } else if (!r.name) r.name = f.slice(0, 80);
      });
      if (!r.name) { var prev = out[out.length - 1]; if (prev) { if (r.phone && !prev.phone) prev.phone = r.phone; if (r.bday && !prev.bday) prev.bday = r.bday; } return; }
      var k = String(r.name || '').toLowerCase(); if (seen[k]) return; seen[k] = 1;
      out.push(r);
    });
    return out;
  }
  function status(r) {
    var ex = people().filter(function (p) { return String(p.name).trim().toLowerCase() === r.name.trim().toLowerCase(); })[0];
    if (!ex) return { s: 'new' };
    var adds = []; if (r.bday && !HL.bday(ex)) adds.push('birthday'); if (r.phone && !ex.phone) adds.push('phone');
    return adds.length ? { s: 'update', p: ex, adds: adds } : { s: 'same', p: ex };
  }
  var IMP = null;
  function openImport(text) {
    if (!on()) return;
    var dg = HL.dialog('<div class="pp5-imp"></div>', function (e, close) {
      var b;
      if (e.target.closest('[data-ppipaste]')) {
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) { IMP.rows = parseLines(t); IMP.only = IMP.rows.some(function (r) { return r.bday; }); draw(); } else draw(I18N.k('ui.the-clipboard-is-empty', 'The clipboard is empty.')); }, function () { draw(I18N.k('ui.couldnt-read-the-clipboard-paste-into-th', 'Couldn’t read the clipboard – paste into the box instead.')); });
        return;
      }
      if (e.target.closest('[data-ppiread]')) { var ta = dg.el.querySelector('textarea'); IMP.rows = parseLines(ta ? ta.value : ''); IMP.only = IMP.rows.some(function (r) { return r.bday; }); if (!IMP.rows.length) draw(I18N.k('ui.no-names-found-one-person-per-line-name', 'No names found – one person per line: Name; 24.12.1990; +47 …')); else draw(); return; }
      if (e.target.closest('[data-ppiback]')) { IMP.rows = null; return draw(); }
      if ((b = e.target.closest('[data-ppionly]'))) { IMP.only = b.checked; IMP.sel = null; return draw(); }
      if (e.target.closest('[data-ppigo]')) {
        var picked = [].slice.call(dg.el.querySelectorAll('[data-ppirow]:checked')).map(function (c) { return IMP.view[+c.dataset.ppirow]; });
        if (!picked.length) return;
        var old = snapshot('people'), t = Fe.tools(), l = Array.isArray(t.people) ? t.people : [], nNew = 0, nUp = 0, defEvery = +cfg().defEvery || 0;
        picked.forEach(function (r) {
          var st = status(r);
          if (st.s === 'new') { l.push({ id: uid(), name: r.name, rel: 'friend', bday: r.bday || '', phone: r.phone || '', every: defEvery }); nNew++; }
          else if (st.s === 'update') { l.forEach(function (p) { if (p.id === st.p.id) { if (r.bday && !HL.bday(p)) p.bday = r.bday; if (r.phone && !p.phone) p.phone = r.phone; } }); nUp++; }
        });
        t.people = l; Fe.saveTools(t); close();
        toast('<i class="bi bi-person-check"></i> ' + [nNew ? nNew + ' added' : '', nUp ? nUp + ' updated' : ''].filter(Boolean).join(', '), function () { restore('people', old); });
      }
    });
    IMP = { rows: text ? parseLines(text) : null, only: true, sel: null };
    if (IMP.rows) IMP.only = IMP.rows.some(function (r) { return r.bday; });
    dg.el.addEventListener('change', function (e) {
      var f = e.target.closest('[data-ppifile]');
      if (f && f.files[0]) f.files[0].text().then(function (t) { IMP.rows = parseLines(t); IMP.only = IMP.rows.some(function (r) { return r.bday; }); draw(IMP.rows.length ? '' : 'No contacts in that file.'); });
      if (e.target.closest('[data-ppirow]')) count();
    });
    function count() { var n = dg.el.querySelectorAll('[data-ppirow]:checked').length, b = dg.el.querySelector('[data-ppigo]'); if (b) { b.disabled = !n; b.textContent = n ? 'Import ' + n : 'Import'; } }
    function draw(msg) {
      var box = dg.el.querySelector('.pp5-imp'), h = HL.dhead('person-down', I18N.k('ui.import-contacts', 'Import contacts'), IMP.rows ? '' : 'From your iPhone, with birthdays. The list stays on this device until you pick who to add.');
      if (!IMP.rows || !IMP.rows.length) {
        box.innerHTML = h + (msg ? '<p class="pp5-msg">' + esc(msg) + '</p>' : '') +
          '<div class="pp5-way"><b><i class="bi bi-clipboard"></i> From the iPhone Shortcut</b><textarea rows="4" placeholder="Paste here – one person per line: Name; 24.12.1990; +47 912 34 567" data-t-placeholder="ui.paste-here-one-person-per-line-name-24-1"></textarea>' +
          '<div class="hl-acts"><button type="button" class="pill-btn" data-ppiread data-t="ui.read-the-list">Read the list</button>' + (navigator.clipboard && navigator.clipboard.readText ? '<button type="button" class="text-btn" data-ppipaste><i class="bi bi-clipboard-check"></i> <span data-t="ui.paste">Paste</span></button>' : '') + '</div></div>' +
          '<div class="pp5-way"><b><i class="bi bi-person-vcard"></i> <span data-t="ui.from-a-contact-file">From a contact file</span></b><label class="text-btn pp5-file"><i class="bi bi-folder2-open"></i> <span data-t="ui.choose-a-vcf-file">Choose a .vcf file</span><input type="file" accept=".vcf,text/vcard,text/x-vcard" data-ppifile hidden></label><small class="muted" data-noi18n>' + L('Contacts on the iPhone: Lists → long-press a list → Export. On a Mac: select contacts → File → Export → vCard.', 'Kontakter på iPhone: Lister → hold inne en liste → Eksporter. På Mac: velg kontakter → Arkiv → Eksporter → vCard.') + '</small></div>' +
          '<details class="pp5-steps" data-noi18n>' + L(
          '<summary><i class="bi bi-lightning-charge"></i> Set up the iPhone Shortcut (3 minutes, once)</summary><ol>' +
          '<li><span data-t="ui.shortcuts">Shortcuts →</span> <b>+</b>. Name it <i>Contacts to dashboard</i>.</li>' +
          '<li><span data-t="ui.add">Add</span> <b>Find Contacts</b>. Optional: <b>Add Filter</b> (e.g. a group) – or keep everyone and pick here.</li>' +
          '<li><span data-t="ui.add">Add</span> <b>Repeat with Each</b> (the contacts).</li>' +
          '<li>Inside it, add <b data-t="ui.text"><span data-t="ui.text">Text</span></b> with: <b>Repeat Item</b> → tap it → <i data-t="ui.name-2"><span data-t="ui.name-2">Name</span></i>, type <code>;</code>, <b>Repeat Item</b> → <i data-t="ui.birthday"><span data-t="ui.birthday">Birthday</span></i> (tap it → Date Format: Custom <code>dd.MM.yyyy</code>), type <code>;</code>, <b>Repeat Item</b> → <i>Phone Numbers</i>.</li>' +
          '<li>After <b>End Repeat</b>: <b>Combine Text</b> (Repeat Results, New Lines).</li>' +
          '<li><b>Copy to Clipboard</b> (Combined Text) – a fallback if you have to log in first.</li>' +
          '<li><b>URL Encode</b> (Combined Text), then <b data-t="ui.text"><span data-t="ui.text">Text</span></b>: <code>https://jplundberg.com/cmd/people/#import=</code> followed by <i>URL Encoded Text</i>.</li>' +
          '<li><b>Open URLs</b> (Text). Run it – this window opens with the list. If it opens empty, tap <b data-t="ui.paste"><span data-t="ui.paste">Paste</span></b>.</li></ol>' +
          '<p class="muted hl-small">The list travels after the # in the link, which browsers never send to a server.</p>',
          '<summary><i class="bi bi-lightning-charge"></i> Sett opp snarveien på iPhone (3 minutter, én gang)</summary><ol>' +
          '<li>Snarveier → <b>+</b>. Kall den <i>Kontakter til dashbordet</i>.</li>' +
          '<li>Legg til <b>Finn kontakter</b>. Valgfritt: <b>Legg til filter</b> (f.eks. en gruppe) – eller ta med alle og velg her.</li>' +
          '<li>Legg til <b>Gjenta med hver</b> (kontaktene).</li>' +
          '<li>Inni den: <b>Tekst</b> med <b>Gjentatt objekt</b> → trykk på det → <i>Navn</i>, skriv <code>;</code>, <b>Gjentatt objekt</b> → <i>Fødselsdag</i> (trykk → Datoformat: Tilpasset <code>dd.MM.yyyy</code>), skriv <code>;</code>, <b>Gjentatt objekt</b> → <i>Telefonnumre</i>.</li>' +
          '<li>Etter <b>Slutt på gjentakelse</b>: <b>Kombiner tekst</b> (Gjentakelsesresultater, Ny linje).</li>' +
          '<li><b>Kopier til utklippstavle</b> (Kombinert tekst) – i tilfelle du må logge inn først.</li>' +
          '<li><b>URL-kode</b> (Kombinert tekst), så <b>Tekst</b>: <code>https://jplundberg.com/cmd/people/#import=</code> etterfulgt av <i>URL-kodet tekst</i>.</li>' +
          '<li><b>Åpne URL-er</b> (Tekst). Kjør den – dette vinduet åpnes med listen. Er det tomt, trykk <b>Lim inn</b>.</li></ol>' +
          '<p class="muted hl-small">Listen ligger etter # i lenken, og den delen sender nettleseren aldri til noen server.</p>') + '</details>';
        return;
      }
      var rows = IMP.rows.map(function (r) { return { r: r, st: status(r) }; });
      var view = rows.filter(function (x) { return !IMP.only || x.r.bday || x.st.s !== 'new'; });
      IMP.view = view.map(function (x) { return x.r; });
      var nb = IMP.rows.filter(function (r) { return r.bday; }).length;
      box.innerHTML = h + '<p class="muted hl-small">' + IMP.rows.length + ' found · ' + nb + ' with a birthday</p>' +
        (nb && nb < IMP.rows.length ? '<label class="st-row pp5-only"><span data-t="ui.only-those-with-a-birthday">Only those with a birthday</span><input type="checkbox" class="switch" data-ppionly' + (IMP.only ? ' checked' : '') + '></label>' : '') +
        '<ul class="pp5-rows">' + view.map(function (x, i) {
          var st = x.st, chip = st.s === 'new' ? '<span class="hl-chip" style="--c:#22b35e" data-t="ui.new"><span data-t="ui.new">New</span></span>' : st.s === 'update' ? '<span class="hl-chip" style="--c:#3987e5">Adds ' + st.adds.join(' + ') + '</span>' : '<span class="hl-chip" style="--c:#7a8794" data-t="ui.already-there"><span data-t="ui.already-there">Already there</span></span>';
          var b = x.r.bday ? x.r.bday.split('.') : null;
          return '<li><label><input type="checkbox" data-ppirow="' + i + '"' + (st.s !== 'same' && (x.r.bday || st.s === 'update') ? ' checked' : '') + (st.s === 'same' ? ' disabled' : '') + '><span class="pp5-t"><b data-noi18n>' + esc(x.r.name) + '</b><small>' +
            esc([b ? new Date(b[2] ? +b[2] : 2000, b[1] - 1, +b[0]).toLocaleDateString('en-GB', b[2] ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }) : 'No birthday', x.r.phone].filter(Boolean).join(' · ')) + '</small></span>' + chip + '</label></li>';
        }).join('') + '</ul>' +
        '<div class="qa-acts"><button type="button" class="text-btn" data-ppiback><i class="bi bi-chevron-left"></i> <span data-t="ui.back">Back</span></button><span class="spacer"></span><button type="button" class="pill-btn" data-ppigo data-t="ui.import"><span data-t="ui.import">Import</span></button></div>';
      count();
    }
    draw();
  }
  function fromHash() {
    var m = location.hash.match(/^#import(?:=([\s\S]*))?$/); if (!m || !/\/cmd\/people\/$/.test(location.pathname)) return;
    var text = ''; try { text = decodeURIComponent(m[1] || ''); } catch (e) { text = m[1] || ''; }
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () { openImport(text); }, 200);
  }
  window.addEventListener('hashchange', function () { if (document.documentElement.classList.contains('unlocked')) fromHash(); });
  Object.assign(window.PeoplePlus, { detail: detail, openImport: openImport, parse: parseLines, pdate: pdate });
  (window.__ui = window.__ui || {})["peopleplus"] = { newGift: newGift, openImport: openImport };
})();
