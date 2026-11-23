/* Inside the iPhone app (2026-11-22, JP: "maybe I should make a proper app for my phone"): with a stand-in Capacitor
   bridge, cmd knows it's in the app, schedules reminders on the phone with titles, opens jplcmd:// links and gives Siri
   the app link. On the web nothing changes. Made-up data only. */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
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
      Keyboard: { setAccessoryBarVisible: o => { window.__bar = o.isVisible; return Promise.resolve(); } },
      Haptics: { impact: o => { (window.__hap = window.__hap || []).push('impact:' + o.style); return Promise.resolve(); }, notification: o => { (window.__hap = window.__hap || []).push('note:' + o.type); return Promise.resolve(); } },
      NativeBiometric: {
        isAvailable: () => Promise.resolve({ isAvailable: true, biometryType: 2 }),
        setCredentials: o => { localStorage.setItem('t.kc', JSON.stringify(o)); return Promise.resolve(); },
        getSecureCredentials: o => { window.__faceid = (window.__faceid || 0) + 1; const c = JSON.parse(localStorage.getItem('t.kc') || 'null'); return c ? Promise.resolve({ username: c.username, password: c.password }) : Promise.reject(new Error('No protected credentials found')); },
        deleteCredentials: () => { localStorage.removeItem('t.kc'); return Promise.resolve(); } },
      DocumentScanner: { scanDocument: o => { window.__scanOpts = o; const c = document.createElement('canvas'); c.width = 60; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 60, 80);
        const b = c.toDataURL('image/jpeg').split(',')[1]; return Promise.resolve({ status: 'success', scannedImages: [b, b] }); } },
      App: { addListener: (n, f) => { window.__L[n] = f; return Promise.resolve({ remove() {} }); }, getLaunchUrl: () => Promise.resolve({}) } } };
  });
  await go(p, '', 2500);
  const r = await p.evaluate(() => ({ on: Native.on, app: Native.app, cls: document.documentElement.classList.contains('in-app'), url: !!window.__L.appUrlOpen }));
  check(r.on && r.app === 'cmd' && r.cls, 'in the app: Native.on, the cmd app, html.in-app');
  check(r.url, 'listens for app links');
  check(await p.evaluate(() => window.__bar) === false, 'hides the form toolbar above the keyboard');
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
  /* vibrations: a tick, and "done" on a save */
  await p.evaluate(() => { const c = document.createElement('input'); c.type = 'checkbox'; document.body.appendChild(c); c.click(); c.remove(); window.Quick && Quick.toast('<i class="bi bi-check2"></i> Made-up saved'); });
  await sl(200);
  const hap = await p.evaluate(() => window.__hap || []);
  check(hap.some(x => /impact:LIGHT/.test(x)) && hap.some(x => /note:SUCCESS/.test(x)), 'a light tap on a tick and a "done" buzz on a save ' + hap.join(','));
  check(await p.evaluate(() => { const r = document.getElementById('stPasskey'); return !!r && !r.hidden; }), 'Settings → Security shows “Unlock with Face ID” in the app');
  /* Face ID through the Keychain: switched on with the passcode, then the lock screen unlocks by itself */
  const fid = await p.evaluate(async () => { const r = await window.Passkey.enable('test-passcode-1'); const kc = JSON.parse(localStorage.getItem('t.kc') || '{}'); return { r, ac: kc.accessControl, has: !!kc.password, saved: JSON.parse(localStorage.getItem('dash.pk') || '{}').native }; });
  check(fid.r === 'done' && fid.ac === 1 && fid.has && fid.saved === 1, 'Face ID is switched on: the passcode goes into the Keychain behind Face ID ' + JSON.stringify({ r: fid.r, ac: fid.ac, saved: fid.saved }));
  await p.evaluate(() => window.Vault.lock()); await sl(1200);
  await until(p, () => document.documentElement.classList.contains('unlocked'), 8000);
  const un = await p.evaluate(() => ({ unlocked: document.documentElement.classList.contains('unlocked'), asked: window.__faceid || 0 }));
  check(un.unlocked && un.asked >= 1, 'the lock screen asks Face ID by itself and unlocks ' + JSON.stringify(un));
  /* Apple's scanner in Papers: two pages straight into the PDF view */
  await go(p, 'papers/', 2500);
  const sc = await p.evaluate(() => new Promise(res => { const i = document.querySelector('[data-pascan]'); if (!i) return res('no scan button'); i.closest('label').click();
    setTimeout(() => res({ figs: document.querySelectorAll('.pa-scan figure').length, opts: window.__scanOpts && window.__scanOpts.responseType }), 900); }));
  check(sc && sc.figs === 2 && sc.opts === 'base64', 'Scan with the camera opens Apple’s scanner and its pages go into the PDF ' + JSON.stringify(sc));
  /* the app's WebKit has no "Safari" in its name: page changes must still take Safari's plain path (JP: "very laggy") */
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 cmdapp/1');
  await go(p, '', 2500);
  check(await p.evaluate(() => window.SoftNav && window.SoftNav.webkit === true), 'the iPhone app gets Safari’s plain page changes, not the view-transition glide');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})();
