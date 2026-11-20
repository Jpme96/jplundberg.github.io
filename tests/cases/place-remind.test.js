/* Reminders by place (2026-11-20): a to-do can get a place from the place search; with the location allowed and the
   phone within ~250 m, a toast says so (once per six hours); far away, nothing. Made-up data and a fake location. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await p.evaluateOnNewDocument(() => {
    window.__pos = { latitude: 59.9220, longitude: 10.7580 };
    const geo = { getCurrentPosition: (ok) => setTimeout(() => ok({ coords: Object.assign({ accuracy: 30 }, window.__pos) }), 10) };
    try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (e) {}
    const q = navigator.permissions && navigator.permissions.query.bind(navigator.permissions);
    if (navigator.permissions) navigator.permissions.query = d => d && d.name === 'geolocation' ? Promise.resolve({ state: 'granted' }) : q(d);
  });
  await go(p, '', 2500);
  await p.evaluate(() => {
    localStorage.setItem('dash.todos', JSON.stringify([{ id: 'tdMilk', text: 'Buy milk', done: false, place: { name: 'Rema 1000 Test', lat: 59.9225, lon: 10.7585 } }, { id: 'tdFar', text: 'Far thing', done: false, place: { name: 'Bergen', lat: 60.39, lon: 5.32 } }]));
    localStorage.removeItem('dash.plSaid');
  });
  const r = await p.evaluate(async () => {
    const toasts = []; const old = Quick.toast; Quick.toast = (h) => { toasts.push(h); };
    PlaceRemind.check(); await new Promise(r => setTimeout(r, 300));
    PlaceRemind.check(); await new Promise(r => setTimeout(r, 300));
    Quick.toast = old; return { toasts, said: Object.keys(JSON.parse(localStorage.getItem('dash.plSaid') || '{}')) };
  });
  check(r.toasts.length === 1 && /Rema 1000 Test/.test(r.toasts[0]) && /Buy milk/.test(r.toasts[0]), 'near the place: one toast with the to-do ' + JSON.stringify(r.toasts));
  check(r.said.join() === 'tdMilk', 'only the near one, and not twice');
  const d = await p.evaluate(() => Math.round(PlaceRemind.dist(59.9220, 10.7580, 59.9225, 10.7585)));
  check(d > 50 && d < 80, 'distance about 60 m (' + d + ')');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
