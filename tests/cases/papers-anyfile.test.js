/* Papers keeps any kind of file (JP 2026-11-23 "save other file formats in papers too"): a Word file and a spreadsheet are added
   as they are, with their own icons; a photo is still made smaller. Made-up files only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { Features.set('papers', true); });
  await go(p, 'papers/', 2500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-')), doc = path.join(dir, 'Made-up lease.docx'), xls = path.join(dir, 'Made-up budget.xlsx');
  fs.writeFileSync(doc, 'PK made-up word file'); fs.writeFileSync(xls, 'PK made-up sheet');
  const inp = await p.$('input[data-pabulk]');
  check(!!inp && await p.evaluate(i => !i.hasAttribute('accept'), inp), 'Add several files takes any kind of file');
  await inp.uploadFile(doc, xls); await sl(800);
  const dlg = await p.evaluate(() => ({ rows: document.querySelectorAll('.pa-blist .pa-brow').length, icons: [...document.querySelectorAll('.pa-blist .pa-bico i')].map(i => i.className.replace('bi bi-', '')) }));
  check(dlg.rows === 2 && dlg.icons.join() === 'file-earmark-word,file-earmark-excel', 'both files are listed, each with its own icon ' + JSON.stringify(dlg));
  await p.evaluate(() => document.querySelector('[data-pbgo]').click()); await sl(1500);
  const got = await p.evaluate(() => Features.list('papers').map(x => (x.files || []).map(f => f.type + ':' + f.name).join()).sort());
  check(got.join('|') === 'file:Made-up budget.xlsx|file:Made-up lease.docx', 'they are saved as papers, kept as they are ' + JSON.stringify(got));
  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
