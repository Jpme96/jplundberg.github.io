/* The app's own popups, never the browser's grey boxes (2026-11-19, JP's list – plan Part 3 A1).
   - no bare confirm( / prompt( / alert( in cmd's scripts, the upload page or Team (window.Ask in cmd/filedrop.js instead)
   - Ask.confirm / Ask.prompt / Ask.alert work: they show in the page, give the right answer, close on Escape, and say
     their buttons in Norwegian when the page is Norwegian. Made-up data only. */
const fs = require('fs'), path = require('path');
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '../..');
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const f = path.join(d, e.name);
  if (e.isDirectory()) { if (!/^(dist|vendor|words|node_modules|assets)$/.test(e.name)) walk(f); }
  else if (/\.js$/.test(e.name) && !/^i18n/.test(e.name)) files.push(f);
});
walk(path.join(ROOT, 'cmd')); walk(path.join(ROOT, 'upload'));
files.push(path.join(ROOT, '_team/public/app.js'));
(async () => {
  const bad = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
      const code = ln.replace(/\/\*.*?\*\//g, '').replace(/(^|[^:])\/\/.*$/, '$1');
      if (/(^|[^.\w$])(confirm|prompt|alert)\s*\(/.test(code) || /window\.(confirm|prompt|alert)\s*\(/.test(code)) {
        if (/native-ok/.test(ln)) return;   /* a fallback when Ask is missing */
        bad.push(path.relative(ROOT, f) + ':' + (i + 1));
      }
    });
  }
  check(!bad.length, 'no browser grey boxes – use window.Ask ' + bad.slice(0, 6).join(', '));

  const { b, p } = await open(393);
  await go(p, 'finance/', 1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const press = (sel) => { const e = document.querySelector('.ask-ov ' + sel); if (e) e.click(); return !!e; };
    let pr = Ask.confirm('Sure?', { danger: true });
    out.shown = !!document.querySelector('.ask-ov [role=dialog]');
    out.focusNo = document.activeElement && document.activeElement.classList.contains('ask-no');
    press('.ask-ok'); out.yes = await pr; out.gone = !document.querySelector('.ask-ov');
    pr = Ask.confirm('Sure?'); press('.ask-no'); out.no = await pr;
    pr = Ask.confirm('Sure?'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.esc = await pr;
    pr = Ask.prompt('Name?', 'abc'); const inp = document.querySelector('.ask-in'); inp.value = 'xyz'; press('.ask-ok'); out.txt = await pr;
    pr = Ask.prompt('Name?', 'abc'); press('.ask-no'); out.nul = await pr;
    pr = Ask.alert('Note'); out.alertOne = document.querySelectorAll('.ask-ov button').length; press('.ask-ok'); await pr;
    out.modal = document.documentElement.classList.contains('fdz-modal');
    return out;
  });
  check(r.shown && r.yes === true && r.gone, 'Ask.confirm shows and OK gives true');
  check(r.focusNo, 'a dangerous question starts on Cancel');
  check(r.no === false && r.esc === false, 'Cancel and Escape give false');
  check(r.txt === 'xyz' && r.nul === null, 'Ask.prompt gives the text, or null on Cancel');
  check(r.alertOne === 1 && !r.modal, 'Ask.alert has one button, and the page scrolls again after');

  /* tap tips: on a touch screen a tap on something with a title shows it; a button with a title does not */
  const tp = await p.evaluate(async () => {
    const d = document.createElement('div'); d.title = '64 % of 2 L'; d.textContent = 'x'; d.style.cssText = 'position:fixed;top:300px;left:20px;width:60px;height:30px;z-index:9';
    const bt = document.createElement('button'); bt.title = 'Not a tip'; bt.textContent = 'b'; bt.style.cssText = 'position:fixed;top:360px;left:20px;z-index:9';
    document.body.append(d, bt);
    d.click(); const t1 = document.querySelector('.tap-tip'); const txt = t1 && t1.textContent; const box = t1 && t1.getBoundingClientRect();
    bt.click(); const t2 = document.querySelector('.tap-tip');
    d.remove(); bt.remove();
    return { txt, inView: box && box.left >= 0 && box.right <= innerWidth && box.top >= 0, btn: !!t2 };
  });
  check(tp.txt === '64 % of 2 L' && tp.inView, 'a tap shows a title as a tip on the phone, inside the screen');
  check(!tp.btn, 'a button with a title does its job without a tip');

  /* Norwegian buttons */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.lang = 'nb'; localStorage.setItem('dash.settings', JSON.stringify(s)); });
  await go(p, 'finance/', 1800);
  const nb = await p.evaluate(async () => { const pr = Ask.confirm('?'); const t = [...document.querySelectorAll('.ask-ov button')].map(x => x.textContent); document.querySelector('.ask-no').click(); await pr; return t; });
  check(nb[0] === 'Avbryt', 'Norwegian: the buttons are Norwegian ' + JSON.stringify(nb));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
