/**
 * Project charts: ring, bars, donut, split bar, line and Gantt.
 * Each <figure class="chart" data-chart="{...}"> is drawn from the data the
 * editor saves. Colours, fonts and motion come from the site's stylesheets.
 */
(function () {
  "use strict";

  var SVGNS = 'http://www.w3.org/2000/svg';
  var PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

  function el(tag, attrs, parent, ns) {
    var e = ns ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs, parent) { return el(tag, attrs, parent, true); }

  function num(v) {
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v == null ? '' : v).replace(/\s| /g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  function parseDate(v, end) {
    var m = String(v || '').match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1;
    if (m[3]) return new Date(y, mo, +m[3]);
    return end ? new Date(y, mo + 1, 0) : new Date(y, mo, 1);
  }

  function draw(fig) {
    var data, parts, ui;
    try {
      data = JSON.parse(fig.getAttribute('data-chart')) || {};
      parts = JSON.parse(fig.getAttribute('data-parts') || 'null') || [];
      ui = JSON.parse(fig.getAttribute('data-i18n') || '{}') || {};
    } catch (e) { return; }

    var lang = fig.getAttribute('data-lang') === 'nb' ? 'nb-NO' : 'en-GB';
    var nf = new Intl.NumberFormat(lang);
    var compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
    var monthFmt = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' });
    var monthOnly = new Intl.DateTimeFormat(lang, { month: 'short' });
    var type = (data.type || 'bars').toLowerCase();
    var points = (data.points || []).filter(function (p) { return p && (p.label || p.start); });

    var body = fig.querySelector('.chart-body');
    body.innerHTML = '';

    // Shared tooltip
    var tip = el('div', { 'class': 'chart-tip', role: 'status' }, fig);
    function showTip(html, x, y) {
      tip.innerHTML = html;
      tip.classList.add('on');
      var fr = fig.getBoundingClientRect();
      var tw = tip.offsetWidth;
      var left = Math.max(8, Math.min(x - fr.left - tw / 2, fr.width - tw - 8));
      tip.style.left = left + 'px';
      tip.style.top = (y - fr.top - tip.offsetHeight - 12) + 'px';
    }
    function hideTip() { tip.classList.remove('on'); }
    function bindTip(node, html) {
      node.setAttribute('tabindex', '0');
      node.addEventListener('pointerenter', function (e) { showTip(html, e.clientX, e.clientY); });
      node.addEventListener('pointermove', function (e) { showTip(html, e.clientX, e.clientY); });
      node.addEventListener('pointerleave', hideTip);
      node.addEventListener('focus', function () { var r = node.getBoundingClientRect(); showTip(html, r.left + r.width / 2, r.top); });
      node.addEventListener('blur', hideTip);
    }

    // Data table for screen readers (same data, no colour needed)
    function table(head, rows) {
      var t = el('table', { 'class': 'visually-hidden' }, body);
      el('caption', { text: (data.title || '') + ' – ' + (ui.chart_table || 'Chart data') }, t);
      var tr = el('tr', null, el('thead', null, t));
      head.forEach(function (h) { el('th', { scope: 'col', text: h }, tr); });
      var tb = el('tbody', null, t);
      rows.forEach(function (r) { var row = el('tr', null, tb); r.forEach(function (c) { el('td', { text: c }, row); }); });
    }

    function legend(items) {
      var ul = el('ul', { 'class': 'chart-legend' }, body);
      items.forEach(function (it) {
        var li = el('li', null, ul);
        el('span', { 'class': 'swatch', style: 'background:' + it.color }, li);
        el('span', { 'class': 'lg-label', text: it.label }, li);
        el('span', { 'class': 'lg-value', text: it.value }, li);
      });
    }

    /* ---------- Ring: one percentage ---------- */
    if (type === 'ring') {
      var pct = Math.max(0, Math.min(100, num(data.percent != null ? data.percent : (points[0] && points[0].value))));
      var wrap = el('div', { 'class': 'ring-wrap' }, body);
      var s = svg('svg', { viewBox: '0 0 120 120', 'class': 'ring', 'aria-hidden': 'true' }, wrap);
      svg('circle', { 'class': 'ring-track', cx: 60, cy: 60, r: 52 }, s);
      var C = 2 * Math.PI * 52;
      svg('circle', { 'class': 'ring-value', cx: 60, cy: 60, r: 52, style: '--len:' + C + ';--offset:' + (C * (1 - pct / 100)) }, s);
      el('div', { 'class': 'ring-text', text: nf.format(pct) + '%' }, wrap);
      table(['', '%'], [[data.title || '', nf.format(pct) + '%']]);
      return;
    }

    if (!points.length && type !== 'gantt') return;

    /* ---------- Bars: compare amounts ---------- */
    if (type === 'bars') {
      var max = Math.max.apply(null, points.map(function (p) { return num(p.value); })) || 1;
      var ul = el('ul', { 'class': 'bars' }, body);
      points.forEach(function (p, i) {
        var v = num(p.value);
        var li = el('li', null, ul);
        el('span', { 'class': 'bar-label', text: p.label }, li);
        var track = el('span', { 'class': 'bar-track' }, li);
        var fill = el('span', { 'class': 'bar-fill', style: '--w:' + (v / max * 100) + '%;--i:' + i }, track);
        el('span', { 'class': 'bar-value', text: nf.format(v) }, li);
        bindTip(fill, '<b>' + p.label + '</b>' + nf.format(v));
      });
      table(['', ''], points.map(function (p) { return [p.label, nf.format(num(p.value))]; }));
      return;
    }

    /* ---------- Donut and split bar: parts of a whole ---------- */
    if (type === 'donut' || type === 'split') {
      var items = points.slice(0, 5);
      var total = items.reduce(function (a, p) { return a + num(p.value); }, 0) || 1;
      var rows = items.map(function (p, i) {
        var v = num(p.value);
        return { label: p.label, v: v, share: v / total, color: PALETTE[i] };
      });

      if (type === 'donut') {
        var dwrap = el('div', { 'class': 'donut-wrap' }, body);
        var ds = svg('svg', { viewBox: '0 0 120 120', 'class': 'donut', 'aria-hidden': 'true' }, dwrap);
        var R = 48, DC = 2 * Math.PI * R, gap = rows.length > 1 ? 2.2 : 0, acc = 0;
        rows.forEach(function (r, i) {
          var len = Math.max(0, r.share * DC - gap);
          var seg = svg('circle', {
            'class': 'donut-seg', cx: 60, cy: 60, r: R,
            style: 'stroke:' + r.color + ';stroke-dasharray:' + len + ' ' + (DC - len) + ';stroke-dashoffset:' + (-acc) + ';--i:' + i
          }, ds);
          acc += r.share * DC;
          bindTip(seg, '<b>' + r.label + '</b>' + nf.format(r.v) + ' · ' + Math.round(r.share * 100) + '%');
        });
        var mid = el('div', { 'class': 'donut-total' }, dwrap);
        el('strong', { text: compact.format(total) }, mid);
        el('small', { text: ui.total || 'Total' }, mid);
      } else {
        var bar = el('div', { 'class': 'split' }, body);
        rows.forEach(function (r, i) {
          var seg = el('span', { 'class': 'split-seg', style: 'flex-grow:' + r.share + ';background:' + r.color + ';--i:' + i }, bar);
          bindTip(seg, '<b>' + r.label + '</b>' + nf.format(r.v) + ' · ' + Math.round(r.share * 100) + '%');
        });
      }
      legend(rows.map(function (r) {
        return { label: r.label, color: r.color, value: nf.format(r.v) + ' · ' + Math.round(r.share * 100) + '%' };
      }));
      table(['', '', '%'], rows.map(function (r) { return [r.label, nf.format(r.v), Math.round(r.share * 100) + '%']; }));
      return;
    }

    /* ---------- Line: change over time ---------- */
    if (type === 'line') {
      var W = Math.max(280, body.clientWidth), H = W < 480 ? 200 : 240;
      var padL = 44, padR = 16, padT = 28, padB = 30;
      var vals = points.map(function (p) { return num(p.value); });
      var vmax = Math.max.apply(null, vals);
      var step = Math.pow(10, Math.floor(Math.log10(vmax || 1)));
      var niceMax = Math.ceil((vmax || 1) / step) * step;
      if (niceMax / step < 3) { step /= 2; niceMax = Math.ceil(vmax / step) * step; }
      var ticks = 4;
      var x = function (i) { return padL + (points.length === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (points.length - 1)); };
      var y = function (v) { return padT + (H - padT - padB) * (1 - v / niceMax); };

      var ls = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'class': 'line-chart', 'aria-hidden': 'true' }, body);
      for (var t = 0; t <= ticks; t++) {
        var tv = niceMax * t / ticks, ty = y(tv);
        svg('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: ty, y2: ty }, ls);
        svg('text', { 'class': 'axis', x: padL - 8, y: ty, 'text-anchor': 'end', 'dominant-baseline': 'middle', text: compact.format(tv) }, ls);
      }
      var every = Math.ceil(points.length / Math.max(2, Math.floor((W - padL - padR) / 64)));
      var shownX = [];
      points.forEach(function (p, i) { if (i % every === 0) shownX.push(i); });
      var lastI = points.length - 1;
      if (shownX[shownX.length - 1] !== lastI) {
        // Keep the last label; drop the one before it if they would crowd
        if (x(lastI) - x(shownX[shownX.length - 1]) < 56) shownX.pop();
        shownX.push(lastI);
      }
      shownX.forEach(function (i) {
        svg('text', { 'class': 'axis', x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : (i === lastI ? 'end' : 'middle'), text: points[i].label }, ls);
      });
      var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
      svg('path', { 'class': 'area', d: d + ' L' + x(vals.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z' }, ls);
      var line = svg('path', { 'class': 'line', d: d }, ls);
      var last = vals.length - 1;
      svg('circle', { 'class': 'end-dot', cx: x(last), cy: y(vals[last]), r: 4.5 }, ls);
      svg('text', { 'class': 'end-label', x: x(last), y: y(vals[last]) - 12, 'text-anchor': 'end', text: nf.format(vals[last]) }, ls);
      try { var L = line.getTotalLength(); line.style.setProperty('--len', L); } catch (e) {}

      // Crosshair + tooltip
      var cross = svg('line', { 'class': 'cross', y1: padT, y2: H - padB }, ls);
      var dot = svg('circle', { 'class': 'hover-dot', r: 4.5 }, ls);
      var hit = svg('rect', { 'class': 'hit', x: padL - 10, y: 0, width: W - padL - padR + 20, height: H }, ls);
      function move(e) {
        var r = ls.getBoundingClientRect();
        var px = (e.clientX - r.left) * (W / r.width);
        var i = Math.round((px - padL) / ((W - padL - padR) / Math.max(1, points.length - 1)));
        i = Math.max(0, Math.min(points.length - 1, i));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(vals[i]));
        ls.classList.add('hovering');
        showTip('<b>' + points[i].label + '</b>' + nf.format(vals[i]), r.left + x(i) * r.width / W, r.top + y(vals[i]) * r.height / H);
      }
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', function () { ls.classList.remove('hovering'); hideTip(); });
      table(['', ''], points.map(function (p) { return [p.label, nf.format(num(p.value))]; }));
      return;
    }

    /* ---------- Gantt: phases over time ---------- */
    if (type === 'gantt') {
      var rowsG = (points.length ? points : parts).map(function (p) {
        return { label: p.label || p.title, start: parseDate(p.start), end: parseDate(p.end, true) || parseDate(p.start, true), status: p.status };
      }).filter(function (r) { return r.start && r.end; });
      if (!rowsG.length) return;

      var min = new Date(Math.min.apply(null, rowsG.map(function (r) { return r.start; })));
      var maxD = new Date(Math.max.apply(null, rowsG.map(function (r) { return r.end; })));
      min = new Date(min.getFullYear(), min.getMonth(), 1);
      maxD = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1);
      var span = maxD - min;
      var pos = function (dt) { return Math.max(0, Math.min(100, (dt - min) / span * 100)); };
      var months = (maxD.getFullYear() - min.getFullYear()) * 12 + maxD.getMonth() - min.getMonth();
      // Space the month labels by the room available, so they never overlap
      var laneW = Math.max(120, body.clientWidth * (window.innerWidth < 576 ? 0.62 : 0.68));
      var stepM = [1, 2, 3, 6, 12, 24].filter(function (st) { return Math.ceil(months / st) * 62 <= laneW; })[0] || 24;
      var shortFmt = new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' });

      var g = el('div', { 'class': 'gantt' }, body);
      var head = el('div', { 'class': 'g-row g-head' }, g);
      el('span', { 'class': 'g-label' }, head);
      var axis = el('div', { 'class': 'g-axis' }, head);
      for (var mi = 0; mi < months; mi += stepM) {
        var md = new Date(min.getFullYear(), min.getMonth() + mi, 1);
        el('span', { 'class': 'g-tick', style: 'left:' + pos(md) + '%', text: stepM >= 12 ? String(md.getFullYear()) : (mi === 0 || md.getMonth() === 0) ? shortFmt.format(md) : monthOnly.format(md) }, axis);
      }
      var today = new Date();
      rowsG.forEach(function (r, i) {
        var row = el('div', { 'class': 'g-row' }, g);
        el('span', { 'class': 'g-label', text: r.label }, row);
        var lane = el('div', { 'class': 'g-lane' }, row);
        for (var mj = stepM; mj < months; mj += stepM) {
          el('span', { 'class': 'g-grid', style: 'left:' + pos(new Date(min.getFullYear(), min.getMonth() + mj, 1)) + '%' }, lane);
        }
        var left = pos(r.start), width = Math.max(1.5, pos(r.end) - left);
        var bar = el('span', { 'class': 'g-bar' + (r.status ? ' g-' + r.status : ''), style: 'left:' + left + '%;width:' + width + '%;--i:' + i }, lane);
        var dates = monthFmt.format(r.start) + ' – ' + monthFmt.format(r.end);
        bindTip(bar, '<b>' + r.label + '</b>' + dates + (r.status && ui.status ? ' · ' + ui.status[r.status] : ''));
      });
      if (today > min && today < maxD) {
        var tl = el('div', { 'class': 'g-today', style: '--x:' + pos(today) }, g);
        el('span', { text: ui.today || 'Today' }, tl);
      }
      if (rowsG.some(function (r) { return r.status; }) && ui.status) {
        legend(['done', 'ongoing', 'planned'].filter(function (k) { return rowsG.some(function (r) { return r.status === k; }); })
          .map(function (k) { return { label: ui.status[k], color: 'var(--g-' + k + ')', value: '' }; }));
      }
      table(['', '', ''], rowsG.map(function (r) { return [r.label, monthFmt.format(r.start), monthFmt.format(r.end)]; }));
    }
  }

  function formatPartDates() {
    document.querySelectorAll('.part-dates').forEach(function (n) {
      var lang = n.getAttribute('data-lang') === 'nb' ? 'nb-NO' : 'en-GB';
      var f = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' });
      var s = parseDate(n.getAttribute('data-start')), e = parseDate(n.getAttribute('data-end'), true);
      if (s || e) n.textContent = (s ? f.format(s) : '') + (e ? ' – ' + f.format(e) : '');
    });
  }

  var figs = Array.prototype.slice.call(document.querySelectorAll('figure.chart[data-chart]'));
  figs.forEach(draw);
  formatPartDates();

  // Redraw width-dependent charts when the screen size changes
  var lastW = window.innerWidth, timer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(function () {
      figs.forEach(function (f) { if (f.classList.contains('chart--line') || f.classList.contains('chart--gantt')) { var t = f.querySelector('.chart-tip'); if (t) t.remove(); draw(f); } });
    }, 150);
  });
})();
