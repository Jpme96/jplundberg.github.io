/* Nothing on a page makes it wider than the screen (the error log reported Work 960–1150 px wide with nothing named, 2026-11-16),
   and the wide-page report now names what sticks out even when it sits outside the page. Made-up content only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1060);
  await go(p, 'work/', 2500);
  const r = await p.evaluate(() => { const x = document.createElement('div'); x.id = 'tooWide'; x.style.cssText = 'width:2400px;height:20px;background:red'; document.querySelector('main').appendChild(x);
    const out = { sw: document.documentElement.scrollWidth, iw: innerWidth }; x.remove(); return out; });
  check(r.sw <= r.iw, 'something too wide inside the page does not widen it ' + JSON.stringify(r));
  check(await p.evaluate(async () => (await fetch('/cmd/diag.js').then(x => x.text())).includes("[document.querySelector('main'), document.body]")), 'the wide-page report also looks outside the page for the culprit');
  for (const W of [960, 1150]) { await p.setViewport({ width: W, height: 900 }); await sl(500);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Work at ' + W + ' px fits the screen'); }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
