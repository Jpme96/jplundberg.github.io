/* The opening in the iPhone apps (2026-11-23, JP chose it from previews: "Now its nice :)"): the name is written in
   Sacramento with a turquoise → purple → pink colour run while the ring around the small logo fills – both ARE the loading.
   It follows real steps (this script running, the page read, everything loaded) and eases like a spring between them, so the
   pen never stops dead; then it fades into the page. Only in the apps (cmdapp/ or homeapp/ in the user agent, or ?splash
   for a preview), once per app start (sessionStorage), never in safe mode. Reduced motion: the finished picture, short fade.
   Used by every cmd page (data-name="Lundberg" data-icon="jpl") and the shared app (data-name="Our home" data-icon="home").
   Loaded first in <head>, before the body exists – so it builds on <html> and doesn't wait for anything. */
(function () {
  var me = document.currentScript, ua = navigator.userAgent, q = location.search;
  if (!/cmdapp\/|homeapp\//.test(ua) && !/[?&]splash\b/.test(q)) return;
  if (/[?&]safe\b/.test(q)) return;
  try { if (sessionStorage.getItem('dash.splash') && !/[?&]splash\b/.test(q)) return; sessionStorage.setItem('dash.splash', '1'); } catch (e) {}
  var name = (me && me.getAttribute('data-name')) || 'Lundberg', icon = (me && me.getAttribute('data-icon')) || 'jpl';
  var still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var C1 = '#2dd4bf', C2 = '#8b74d9', C3 = '#f472b6', BG = '#0e0f10';
  var inner = icon === 'home'
    ? '<path d="M10.4 16.6 16 11.6l5.6 5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><rect x="11.9" y="15.6" width="8.2" height="6.4" rx="1" fill="none" stroke="#fff" stroke-width="1.7"/><rect x="15" y="18.6" width="2" height="3.4" rx=".4" fill="' + C1 + '"/>'
    : '<text x="16" y="16.6" fill="#fff" font-family="Inter,-apple-system,system-ui,sans-serif" font-weight="500" font-size="9" text-anchor="middle" dominant-baseline="central">JPL</text>';
  var el = document.createElement('div');
  el.id = 'splash'; el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:' + BG + ';display:flex;align-items:center;justify-content:center;transition:opacity .6s cubic-bezier(.4,0,.2,1);-webkit-user-select:none;user-select:none';
  el.innerHTML = '<div id="splashW" style="text-align:center;margin-top:-8vh;transition:transform .7s cubic-bezier(.2,.7,.2,1)">' +
    '<span id="splashN" style="display:inline-block;font:400 min(22vw,96px)/1 LbSplash,Snell Roundhand,cursive;padding:.18em .35em .42em;white-space:nowrap;' +
    'background:linear-gradient(90deg,' + C1 + ' 12%,' + C2 + ' 50%,' + C3 + ' 88%);-webkit-background-clip:text;background-clip:text;color:transparent;' +
    '-webkit-mask-image:linear-gradient(90deg,#000 0,#000 var(--p),transparent calc(var(--p) + 14%));mask-image:linear-gradient(90deg,#000 0,#000 var(--p),transparent calc(var(--p) + 14%));--p:-14%;visibility:hidden"></span>' +
    '<svg viewBox="0 0 32 32" style="display:block;margin:-4px auto 0;width:min(15vw,64px);height:min(15vw,64px);opacity:0;transform:scale(.9);transition:opacity .5s,transform .6s cubic-bezier(.2,.7,.2,1)" id="splashL">' +
    '<defs><linearGradient id="splashG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + C1 + '"/><stop offset=".5" stop-color="' + C2 + '"/><stop offset="1" stop-color="' + C3 + '"/></linearGradient></defs>' +
    '<circle cx="16" cy="16" r="13.5" fill="none" stroke="#1d2124" stroke-width="2.6"/>' +
    '<circle id="splashR" cx="16" cy="16" r="13.5" fill="none" stroke="url(#splashG)" stroke-width="2.6" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 16 16)"/>' +
    inner + '</svg></div>';
  el.querySelector('#splashN').textContent = name;
  document.documentElement.appendChild(el);
  var w = el.querySelector('#splashW'), n = el.querySelector('#splashN'), logo = el.querySelector('#splashL'), ring = el.querySelector('#splashR');
  var target = 0.35, v = 0, vel = 0, last = 0, writing = false, done = false, born = Date.now();
  function set(p) { n.style.setProperty('--p', (p * 114 - 14).toFixed(2) + '%'); ring.setAttribute('stroke-dashoffset', (100 - p * 100).toFixed(2)); }
  function finish() {
    if (done) return; done = true; set(1);
    setTimeout(function () {
      w.style.transform = 'scale(1.03)'; el.style.opacity = '0'; el.style.pointerEvents = 'none';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
    }, still ? 150 : 380);
  }
  function frame(now) {
    if (done) return;
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    var goal = target >= 1 ? 1 : Math.min(target + 0.12, 0.97), k = target >= 1 ? 60 : 22, c = 2 * Math.sqrt(k);
    vel += (k * (goal - v) - c * vel) * dt; v = Math.max(v, Math.min(1, v + vel * dt));
    if (target >= 1 && v > 0.998) v = 1;
    set(v);
    if (v >= 1) return finish();
    requestAnimationFrame(frame);
  }
  function go() {
    if (writing) return; writing = true; n.style.visibility = 'visible';
    if (still) { target = 1; set(1); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(function () { logo.style.opacity = '1'; logo.style.transform = 'none'; });
  /* the font is kept on the phone (service worker); if it's slow, start with the phone's own script font */
  try {
    if (window.FontFace && document.fonts) {
      var f = new FontFace('LbSplash', 'url(/cmd/assets/fonts/sacramento-400.woff2)');
      f.load().then(function (ff) { document.fonts.add(ff); go(); }, go);
    } else go();
  } catch (e) { go(); }
  setTimeout(go, 700);
  /* the real steps */
  document.addEventListener('DOMContentLoaded', function () { target = Math.max(target, 0.7); });
  window.addEventListener('load', function () { target = 1; if (still) finish(); });
  /* never in the way: gone after 5 s whatever happens; a tap ends it */
  setTimeout(function () { target = 1; if (!writing || still) finish(); }, 5000);
  setTimeout(finish, 6500);
  el.addEventListener('pointerdown', function () { if (Date.now() - born > 400) finish(); });
})();
