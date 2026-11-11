/* Price changes (later features): what each subscription and fixed bill costs is remembered in your data
   (d.prices); when one changes, it's noted (d.priceChanges, the last 90 days) and At a glance says so for 30 days –
   "Streaming: 129 → 149 kr (+15 %)". The first time it only learns today's prices, so nothing is flagged. */
(function () {
  'use strict';
  var NB = function () { return window.I18N && window.I18N.lang === 'nb'; };
  function L(en, nb) { return NB() ? nb : en; }
  function kr(n) { return Math.round(+n || 0).toLocaleString(NB() ? 'nb-NO' : 'en-GB') + ' kr'; }
  /* what costs what now: { key: { n: name, a: amount } } */
  function now(d) {
    var out = {}, Fe = window.Features;
    ((d.budget && d.budget.fixed) || []).forEach(function (f) { if (f && f.id && +f.amount > 0 && !f.src) out['bill:' + f.id] = { n: String(f.name || 'Bill'), a: +f.amount }; });
    (Fe && Fe.list ? Fe.list('subs') : []).forEach(function (s) { if (s && s.id && +s.amount > 0 && !s.paused) out['sub:' + s.id] = { n: String(s.name || 'Subscription'), a: +s.amount }; });
    return out;
  }
  function check() {
    var V = window.Vault, d = V && V.get && V.get(); if (!d) return;
    var cur = now(d), was = d.prices, ch = false, at = Date.now(), log = Array.isArray(d.priceChanges) ? d.priceChanges.slice() : [];
    if (!was || typeof was !== 'object') { d.prices = cur; V.save(d); return; }              /* the first time: just learn */
    Object.keys(cur).forEach(function (k) {
      var a = was[k];
      if (a && Math.abs(a.a - cur[k].a) >= 1) { log.push({ k: k, n: cur[k].n, from: a.a, to: cur[k].a, at: at }); ch = true; }
      if (!a || a.a !== cur[k].a || a.n !== cur[k].n) ch = true;
    });
    if (Object.keys(was).some(function (k) { return !cur[k]; })) ch = true;
    if (!ch) return;
    d.prices = cur; d.priceChanges = log.filter(function (x) { return at - x.at < 90 * 864e5; }).slice(-50); V.save(d);
  }
  var t = null; function soon() { clearTimeout(t); t = setTimeout(check, 1200); }
  ['tools:change', 'fin:change'].forEach(function (ev) { window.addEventListener(ev, soon); });
  if (window.Vault && window.Vault.onUnlock) window.Vault.onUnlock(soon);
  /* At a glance: the changes of the last 30 days */
  window.BriefExtra = (window.BriefExtra || []).filter(function (f) { return f._id !== 'prices'; });   /* a page change runs this again: once only */
  var brief = function (add) {
    var d = window.Vault && window.Vault.get && window.Vault.get(); if (!d || !Array.isArray(d.priceChanges)) return;
    d.priceChanges.filter(function (x) { return Date.now() - x.at < 30 * 864e5; }).slice(-3).forEach(function (x) {
      var up = x.to > x.from, pct = x.from ? Math.round((x.to - x.from) / x.from * 100) : 0;
      add(up ? 62 : 40, up ? 'graph-up-arrow' : 'graph-down-arrow', up ? '#e5484d' : '#2fae6a', x.n + ': ' + kr(x.from) + ' → ' + kr(x.to) + (pct ? ' (' + (pct > 0 ? '+' : '') + pct + ' %)' : ''),
        up ? L('The price went up', 'Prisen gikk opp') : L('The price went down', 'Prisen gikk ned'), x.k.indexOf('sub:') === 0 ? 'finance/#c=subs' : 'finance/#c=bills', { key: 'price:' + x.k + ':' + x.at });
    });
  };
  brief._id = 'prices'; window.BriefExtra.push(brief);
  window.Prices = { check: check, now: now };
})();
