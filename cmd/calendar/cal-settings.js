/* Calendar settings: views, week numbers, holidays, defaults for new events, your own
   categories and what the dashboard card shows. Used in Settings → Calendar on the
   dashboard and in the gear sheet on the calendar page. Saved in dash.calendar (synced). */
(function () {
  "use strict";
  var C = window.Cal;
  if (!C) return;
  var esc = C.esc;
  var SWATCHES = ['#3987e5', '#8a6fdf', '#d55181', '#e8743b', '#22b35e', '#14b8a6', '#c98500', '#7a8794'];

  function update(fn) { var d = C.load(); d.prefs = C.prefs(d); fn(d, d.prefs); C.save(d); }
  function cats() { return C.CAT_ORDER.map(function (id) { return { id: id, name: C.CATS[id].name, color: C.CATS[id].color }; }); }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function sw(key, on, label, sub) {
    return '<label class="st-row"><span class="st-label"><span class="cs-l">' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<input type="checkbox" class="switch" data-cs="' + key + '"' + (on ? ' checked' : '') + '></label>';
  }

  function mount(box) {
    var armed = null;
    function render() {
      var d = C.load(), p = C.prefs(d), cs = cats();
      var hours = ''; for (var h = 5; h <= 10; h++) hours += opt(h, String(h).padStart(2, '0') + ':00', p.dayStart);
      var feeds = d.feeds || [];
      box.innerHTML =
        '<p class="st-sub"><i class="bi bi-eye"></i> View</p><section class="st-group">' +
        '<label class="st-row"><span>Open in</span><select class="st-select" data-cs="view">' +
          opt('last', 'Last used', p.view) + opt('month', 'Month', p.view) + opt('week', 'Week', p.view) + opt('list', 'List', p.view) + '</select></label>' +
        sw('weekNums', p.weekNums, 'Week numbers', 'Like “Week 44” in the month and week views') +
        '<label class="st-row"><span class="st-label">Day starts<small>Where the week view opens</small></span><select class="st-select" data-cs="dayStart">' + hours + '</select></label>' +
        sw('holidays', p.holidays, 'Norwegian public holidays', '17. mai, Easter, Christmas … also counted in Flex time') +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-plus-circle"></i> New events</p><section class="st-group">' +
        '<label class="st-row"><span>Length</span><select class="st-select" data-cs="dur">' +
          [15, 30, 45, 60, 90, 120].map(function (m) { return opt(m, m < 60 ? m + ' min' : (m / 60) + ' hour' + (m > 60 ? 's' : ''), p.dur); }).join('') + '</select></label>' +
        '<label class="st-row"><span>Category</span><select class="st-select" data-cs="cat">' + opt('last', 'Last used', p.cat) +
          cs.map(function (c) { return opt(c.id, c.name, p.cat); }).join('') + '</select></label>' +
        '</section>' +

        '<p class="st-sub"><i class="bi bi-tags"></i> Categories <span class="st-hint">Tap the colour to change it</span></p><section class="st-group cs-cats">' +
        cs.map(function (c) {
          return '<div class="st-row cs-cat" data-cid="' + esc(c.id) + '">' +
            '<label class="cs-col" style="--c:' + c.color + '" title="Colour"><input type="color" value="' + c.color + '" data-ccol="' + esc(c.id) + '" aria-label="Colour for ' + esc(c.name) + '"></label>' +
            '<input class="cs-name" value="' + esc(c.name) + '" maxlength="24" data-cname="' + esc(c.id) + '" aria-label="Category name">' +
            (cs.length > 1 ? '<button type="button" class="text-btn danger cs-del" data-cdel="' + esc(c.id) + '">' + (armed === c.id ? 'Delete?' : '<i class="bi bi-trash3"></i>') + '</button>' : '') +
            '</div>';
        }).join('') +
        (cs.length < 8 ? '<button type="button" class="st-row st-btn cs-add" data-cadd><span><i class="bi bi-plus-lg"></i> Add category</span></button>' : '') +
        '</section><p class="st-note">Events in a deleted category move to ' + esc((C.CATS.personal || C.CATS[C.CAT_ORDER[C.CAT_ORDER.length - 1]]).name) + '.</p>' +

        '<p class="st-sub"><i class="bi bi-grid-1x2"></i> Dashboard card <span class="st-hint">What the calendar card on the dashboard shows</span></p><section class="st-group">' +
        cs.map(function (c) { return sw('card:' + c.id, !p.cardHide[c.id], '<i class="dot" style="--c:' + c.color + '"></i> ' + esc(c.name)); }).join('') +
        feeds.map(function (f) { return sw('card:feed:' + f.id, !p.cardHide['feed:' + f.id], '<i class="bi bi-phone"></i> ' + esc(f.name)); }).join('') +
        sw('card:travel', !p.cardHide.travel, '<i class="bi bi-suitcase-lg"></i> Travel') +
        sw('card:reminders', !p.cardHide.reminders, '<i class="bi bi-bell"></i> Reminders') +
        sw('card:holidays', !p.cardHide.holidays, '<i class="bi bi-flag"></i> Holidays') +
        '</section>';
    }
    box.addEventListener('change', function (e) {
      var t = e.target, k = t.dataset.cs;
      if (k) {
        update(function (d, p) {
          if (k.indexOf('card:') === 0) { var id = k.slice(5); if (t.checked) delete p.cardHide[id]; else p.cardHide[id] = 1; }
          else if (t.type === 'checkbox') p[k] = t.checked;
          else p[k] = /^(dur|dayStart)$/.test(k) ? +t.value : t.value;
          if (k === 'holidays' && t.checked) delete d.hidden.holidays;
        });
        return;
      }
      if (t.dataset.ccol || t.dataset.cname) {
        var id = t.dataset.ccol || t.dataset.cname;
        update(function (d) {
          d.cats = cats().map(function (c) {
            if (c.id !== id) return c;
            if (t.dataset.ccol && /^#[0-9a-f]{6}$/i.test(t.value)) c.color = t.value;
            if (t.dataset.cname && t.value.trim()) c.name = t.value.trim().slice(0, 24);
            return c;
          });
        });
        render();
      }
    });
    box.addEventListener('input', function (e) {    /* live colour preview */
      if (e.target.dataset.ccol) e.target.parentNode.style.setProperty('--c', e.target.value);
    });
    box.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-cdel]'))) {
        var id = b.dataset.cdel;
        if (armed !== id) { armed = id; render(); return; }
        armed = null;
        update(function (d) { d.cats = cats().filter(function (c) { return c.id !== id; }); delete d.hidden[id]; });
        render();
      } else if (e.target.closest('[data-cadd]')) {
        var used = cats().map(function (c) { return c.color; });
        var color = SWATCHES.filter(function (c) { return used.indexOf(c) < 0; })[0] || SWATCHES[0];
        var nid = 'c' + C.uid();
        update(function (d) { d.cats = cats().concat([{ id: nid, name: 'New category', color: color }]); });
        render();
        var inp = box.querySelector('[data-cname="' + nid + '"]');
        if (inp) { inp.focus(); inp.select(); }
      }
    });
    return { render: render };
  }

  window.CalSettings = { mount: mount };

  /* Settings → Calendar on the dashboard */
  var home = document.getElementById('csHome');
  if (home) {
    var m = mount(home);
    window.addEventListener('st:page', function (e) { if (e.detail === 'calendar') m.render(); if (e.detail === 'home') summary(); });
    function summary() {
      var s = document.getElementById('sumCalendar');
      if (!s) return;
      var p = C.prefs();
      s.textContent = C.CAT_ORDER.length + ' categories' + (p.weekNums ? ' · week numbers' : '') + (p.holidays ? ' · holidays' : '');
    }
    window.addEventListener('cal:change', summary);
    if (window.Vault) window.Vault.onUnlock(summary);
  }
})();
