/* Making a PDF copies only the report, not the whole page (2026-11-16 – iPhone: "stuck for 5 s" after Make PDF):
   html2canvas copies the document before drawing; the page's scenes, cards and menus stay out of that copy, and the
   pages are drawn with a pause between them. Made-up data only. */
const { open, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(440);
  await p.evaluate(() => { ['fdv', 'work'].forEach(f => { try { Features.set(f, true); } catch (e) {} }); });
  await go(p, 'work/', 3000);
  const r = await p.evaluate(async () => {
    const P = window.PagedPdf; await P.html('<p>warm</p>', 'f', 'w.pdf');   /* the two tools load the first time */
    const seen = [], h2c = window.html2canvas;
    window.html2canvas = (el, o) => { const oc = o.onclone; o.onclone = d => { seen.push({ all: d.body.getElementsByTagName('*').length, scene: !!d.querySelector('#scIllu, .mbar, .card:not(.rp-doc *)') }); if (oc) oc(d); }; return h2c(el, o); };
    const rows = Array.from({ length: 120 }, (_, i) => '<tr><td>' + (300 + i) + '</td><td>Made-up document ' + i + '</td><td>Missing</td></tr>').join('');
    const f = await P.html('<h2>Test report</h2><table>' + rows + '</table>', 'Made-up footer', 'x.pdf');
    window.html2canvas = h2c;
    return { pages: f._pages, seen, page: document.body.getElementsByTagName('*').length };
  });
  check(r.pages >= 2, 'the test report has several pages (' + r.pages + ')');
  check(r.seen.length >= 2 && r.seen.every(s => !s.scene), 'the copy html2canvas draws has no scene, menu or cards ' + JSON.stringify(r.seen));
  check(r.seen.every(s => s.all < r.page / 3), 'the copy is a small part of the page (' + r.seen.map(s => s.all).join(', ') + ' of ' + r.page + ' elements)');
  check(!p.errs.length, 'no errors ' + JSON.stringify(p.errs).slice(0, 200));
  await done(b);
})();
