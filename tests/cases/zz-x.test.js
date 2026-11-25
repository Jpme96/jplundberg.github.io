const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await go(p, 'calendar/', 2000);
  const r1 = await p.evaluate(() => ({ h: document.querySelector('.cl-title, #clTitle, h2') && document.querySelector('.cl-title, #clTitle, h2').textContent, sel: document.querySelector('.sel, [aria-selected=true], .cl-sel') && document.querySelector('.sel, [aria-selected=true], .cl-sel').outerHTML.slice(0,120) }));
  await go(p, '', 1500);
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/cmd/calendar/#d=2027-03-14'; document.body.appendChild(a); a.click(); }); await sl(2500);
  const r2 = await p.evaluate(() => ({ url: location.href, h: [...document.querySelectorAll('h2,h3,.cl-title')].filter(x=>x.offsetParent).slice(0,3).map(x=>x.textContent.trim().slice(0,60)), sel: [...document.querySelectorAll('[class*=sel]')].filter(x=>x.offsetParent).slice(0,3).map(x=>x.className+':'+x.textContent.trim().slice(0,40)) }));
  require('fs').writeFileSync('/tmp/audit/x.txt', JSON.stringify({ r1, r2 }, null, 1)); check(true, 'x'); await b.close(); done();
})();
