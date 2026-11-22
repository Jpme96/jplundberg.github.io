/* Inside the iPhone app (2026-11-22, JP: "maybe I should make a proper app for my phone"): with a stand-in Capacitor
   bridge, cmd knows it's in the app, schedules reminders on the phone with titles, opens jplcmd:// links and gives Siri
   the app link. On the web nothing changes. Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const web = await p.evaluate(() => ({ on: window.Native && Native.on, cls: document.documentElement.classList.contains('in-app') }));
  check(web.on === false && !web.cls, 'on the web cmd is not "in the app"');
  await p.evaluateOnNewDocument(() => {
    window.__sched = []; window.__cancel = 0; window.__L = {};
    const pend = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      LocalNotifications: {
        requestPermissions: () => Promise.resolve({ display: 'granted' }),
        getPending: () => Promise.resolve({ notifications: pend.slice() }),
        cancel: o => { window.__cancel += o.notifications.length; pend.length = 0; return Promise.resolve(); },
        schedule: o => { o.notifications.forEach(n => { pend.push(n); window.__sched.push(n); }); return Promise.resolve(); },
        addListener: (n, f) => { window.__L['ln:' + n] = f; return Promise.resolve({ remove() {} }); } },
      App: { addListener: (n, f) => { window.__L[n] = f; return Promise.resolve({ remove() {} }); }, getLaunchUrl: () => Promise.resolve({}) } } };
  });
  await go(p, '', 2500);
  const r = await p.evaluate(() => ({ on: Native.on, app: Native.app, cls: document.documentElement.classList.contains('in-app'), url: !!window.__L.appUrlOpen }));
  check(r.on && r.app === 'cmd' && r.cls, 'in the app: Native.on, the cmd app, html.in-app');
  check(r.url, 'listens for app links');
  /* reminders on the phone, with titles */
  await p.evaluate(() => { const pad = n => String(n).padStart(2, '0'), d = new Date(Date.now() + 2 * 864e5), k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    localStorage.setItem('dash.todos', JSON.stringify([{ id: 'td-made-up', text: 'Made-up task for the app', due: k }]));
    localStorage.setItem('dash.push', JSON.stringify({ on: true, k: { tasks: true } })); });
  await p.evaluate(() => Notify.sync(true));
  await sl(400);
  const s1 = await p.evaluate(() => ({ n: window.__sched.length, t: window.__sched.map(x => x.title + ' ' + x.extra.url).join('|'), ids: window.__sched.every(x => Number.isInteger(x.id) && x.id > 0) }));
  check(s1.n >= 1 && /Made-up task for the app/.test(s1.t), 'reminders are scheduled on the phone with their titles ' + s1.t.slice(0, 120));
  check(s1.ids, 'each has a whole-number id');
  await p.evaluate(() => Notify.sync(true));
  await sl(300);
  const s2 = await p.evaluate(() => ({ c: window.__cancel, n: window.__sched.length }));
  check(s2.c >= 1, 'planning again replaces the old ones (no doubles)');
  /* Siri gets the app's own link */
  const link = await p.evaluate(() => new Promise(res => { document.getElementById('quickAdd').click(); setTimeout(() => { const b = document.querySelector('[data-qasiri]'); if (!b) return res('no button'); b.click();
    setTimeout(() => res((document.getElementById('qaSiriLink') || {}).value), 200); }, 300); }));
  check(link === 'jplcmd://?say=', 'the Siri sheet gives the app link ' + link);
  /* an app link opens the page */
  await p.evaluate(() => window.__L.appUrlOpen({ url: 'jplcmd://cmd/food/#shop' }));
  await sl(2500);
  check(/\/cmd\/food\/$/.test(await p.evaluate(() => location.pathname)), 'jplcmd://cmd/food/ opens Food');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})();
