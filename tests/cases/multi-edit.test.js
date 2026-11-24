/* Several files at once in "Give files the right names" (JP 2026-11-19): a checkbox on each line, a bar with the changes,
   a popup that shows who gets what (a code you set yourself is kept unless you say so), Undo-able changes, and a download popup
   that shows what is downloaded – one file comes as itself, not a .zip. Made-up files only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1060);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; delete t.fdvlearn; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); ['MADEUP alpha.docx', 'MADEUP bravo.docx', 'MADEUP charlie.docx', 'MADEUP delta.docx'].forEach(n => dt.items.add(new File(['made up ' + n], n))); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(1200);
  const codes = () => p.evaluate(async () => { const out = []; for (const r of [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')]) { const nm = r.querySelector('.dcn-sumt b').textContent; [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => x.querySelector('.dcn-sumt b').textContent === nm).querySelector('.dcn-sumb').click(); await new Promise(z => setTimeout(z, 120)); out.push(nm + ':' + ((document.querySelector('.dcn-fpop .dcn-cbtn span') || {}).textContent || '')); document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); await new Promise(z => setTimeout(z, 80)); } return out; });
  /* one file gets a code by hand first */
  await p.evaluate(() => { [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(r => /delta/.test(r.textContent)).querySelector('button').click(); }); await sl(200);
  await p.evaluate(() => { const s = document.querySelector('.dcn-fpop select[data-dcncode]'), o = [...s.options].find(x => /^362/.test(x.value)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); }); await sl(300);
  check(await p.evaluate(() => document.querySelectorAll('.dx-ren .dcn-row.dcn-c input[data-dcnpk]').length === 4 && !document.querySelector('.dcn-pkact')), 'a checkbox on each line, and no bar before anything is ticked');
  /* a real mouse click: it gives the box focus, and a focused field in the tool used to stop the redraw – Select all ticked only itself (JP 2026-11-24) */
  await p.click('.dx-ren input[data-dcnpkall]'); await sl(300);
  check(await p.evaluate(() => { const B = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c input[data-dcnpk]')]; return B.length === 4 && B.every(b => b.checked); }), 'clicking Select all with the mouse ticks every file in the list');
  check(await p.evaluate(() => { const r = document.querySelector('.dx-ren .dcn-row.dcn-c'), c = r.querySelector('.dcn-pkc'), b = r.querySelector('.dcn-sumb'); return c.getBoundingClientRect().right <= b.getBoundingClientRect().left + 1 && Math.abs(c.getBoundingClientRect().top - b.getBoundingClientRect().top) < 30; }), 'the checkbox sits on the left of its line, not above it (JP 2026-11-19)');
  check(await p.evaluate(() => /4 selected/.test((document.querySelector('.dcn-pkact') || {}).textContent || '')), 'Select all (4) ticks every file and the bar shows 4 selected');
  check(await p.evaluate(() => !document.querySelector('.dx-ren [data-dcnpks="all"]') && /Select all \(4\)/.test(document.querySelector('.dcn-pkall').textContent)), 'one box for all, with its words – no second All button');
  await p.evaluate(() => document.querySelector('[data-dcnpka="code"]').click()); await sl(200);
  await p.evaluate(() => { const s = document.querySelector('.dcn-bulk select[data-bksel]'), o = [...s.options].find(x => /^365/.test(x.value)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(150);
  const bk = await p.evaluate(() => ({ box: document.querySelector('.dcn-bulk .dcn-bkbox').textContent, own: !!document.querySelector('.dcn-bulk [data-bkover]'), go: document.querySelector('.dcn-bulk [data-bkgo]').textContent }));
  check(/These 3 get 365/.test(bk.box) && bk.own && /Set 365 on 3 files/.test(bk.go), 'the popup says who gets the code, and the one you set yourself is left out unless you tick it ' + JSON.stringify(bk));
  await p.evaluate(() => document.querySelector('.dcn-bulk [data-bkgo]').click()); await sl(400);
  const c1 = await codes();
  check(c1.filter(t => /365/.test(t)).length === 3 && c1.some(t => /delta/.test(t) && /362/.test(t)), 'three got 365, the hand-set one kept 362 ' + JSON.stringify(c1));
  check(await p.evaluate(() => !!document.querySelector('.qk-toast, .toast, [class*=toast]')), 'a toast says what changed (with Undo)');
  /* download popup: only the selected is chosen when something is ticked; one file comes as itself */
  await p.evaluate(() => { document.querySelector('.dx-ren [data-dcnpks="none"]').click(); }); await sl(150);
  await p.evaluate(() => { document.querySelector('.dx-ren input[data-dcnpk]').click(); }); await sl(200);
  await p.evaluate(() => document.querySelector('[data-dxrendl]').click()); await sl(200);
  const dl = await p.evaluate(() => ({ on: (document.querySelector('.dx-dlpop .dx-dlopt.on') || {}).textContent || '', items: document.querySelectorAll('.dx-dlpop .dx-dllist li').length, go: document.querySelector('.dx-dlpop [data-dlgo]').textContent }));
  check(/Only the selected \(1\)/.test(dl.on) && dl.items === 1 && /Download the file/.test(dl.go), 'the download popup shows what you get – the selected one ' + JSON.stringify(dl));
  const got = await p.evaluate(async () => { let f = null; FdvPdf.share = x => { f = x; return Promise.resolve(); }; document.querySelector('.dx-dlpop [data-dlgo]').click(); for (let i = 0; i < 30 && !f; i++) await new Promise(r => setTimeout(r, 100)); return f && f.name; });
  check(got && !/\.zip$/.test(got) && /\.docx$/.test(got), 'one file is downloaded as itself, not a .zip ' + got);
  await p.evaluate(() => document.querySelector('[data-dxrendl]').click()); await sl(200);
  await p.evaluate(() => { const r = document.querySelector('.dx-dlpop input[value=all]'); r.click(); }); await sl(150);
  check(await p.evaluate(() => /Download 4 files \(\.zip\)/.test(document.querySelector('.dx-dlpop [data-dlgo]').textContent) && document.querySelectorAll('.dx-dlpop .dx-dllist li').length === 4), 'All: 4 files in the .zip, every name listed');
  /* choose right in the download list (JP 2026-11-23): untick one file and the count and the button follow */
  await p.evaluate(() => { const c = document.querySelector('.dx-dlpop [data-dlpk]'); c.click(); }); await sl(150);
  check(await p.evaluate(() => /Download 3 files \(\.zip\)/.test(document.querySelector('.dx-dlpop [data-dlgo]').textContent) && document.querySelectorAll('.dx-dlpop .dx-dllist li').length === 4 && document.querySelectorAll('.dx-dlpop li.dx-dloff').length === 1), 'unticking a file in the download list leaves it out (3 of 4)');
  await p.evaluate(() => document.querySelector('.dx-dlpop [data-dlx]').click()); await sl(150);
  /* remove from the list (the tool only) */
  await p.evaluate(() => document.querySelector('[data-dcnpka="rm"]').click()); await sl(200);
  await p.evaluate(() => document.querySelector('.dcn-bulk [data-bkgo]').click()); await sl(400);
  check((await codes()).length === 3, 'Remove from the list takes the selected one out');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
