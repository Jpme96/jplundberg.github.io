/* The PDF tools (~2 MB in cmd/vendor: pdf.js and its worker, jsPDF, html2canvas, qrcode) load only when a PDF is
   opened or made – never when a page opens (2026-11-19, plan Part 4). Every page is opened with every feature on.
   Made-up data only. */
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const seen = [];
  p.on('request', r => { const u = r.url(); if (/\/cmd\/vendor\//.test(u)) seen.push(u.replace(/^.*\/cmd\//, '') + ' on ' + (p.url().replace(/^.*\/cmd\//, '') || 'home')); });
  await p.evaluate(() => { Features.LIST.forEach(f => Features.set(f.id, true)); });
  for (const pg of ['', 'calendar/', 'travel/', 'finance/', 'habits/', 'house/', 'people/', 'food/', 'work/', 'wish/', 'goals/', 'papers/', 'admin/']) await go(p, pg, 2200);
  check(!seen.length, 'no PDF tool loads when a page opens ' + seen.slice(0, 4).join(' | '));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
