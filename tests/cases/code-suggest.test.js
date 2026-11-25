/* Better NS code suggestions (JP 2026-11-19): your own code names count as words, a code you chose is learned from the file
   name and suggested first next time (and can be forgotten), and when two codes are close you get both to choose from.
   Made-up names and files only – the real NS 3451 names never go into this repo. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1060);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; delete t.fdvlearn; Features.saveTools(t); localStorage.setItem('dcn.nsnames', JSON.stringify({ '311': 'Grunnledninger madeup', '3111': 'Grunnledninger for madeupvann', '627': 'Fasade- og madeupvask' })); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  const add = async names => { await p.evaluate(n => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); n.forEach(x => dt.items.add(new File(['made up ' + x], x))); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }, names); await sl(1200); };
  const pop = async re => p.evaluate(src => { document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); const r = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => new RegExp(src).test(x.textContent)); if (!r) return null; const line = r.textContent; r.querySelector('button').click(); return line; }, re.source);
  const inPop = () => p.evaluate(() => { const f = document.querySelector('.dcn-fpop'); return f && { code: (f.querySelector('.dcn-cbtn span') || {}).textContent || '', alt: [...f.querySelectorAll('.dcn-altb b')].map(x => x.textContent), why: (f.querySelector('.dcn-why') || {}).textContent || '' }; });
  await add(['MADEUP grunnledninger.docx', 'MADEUP sprinkler heis.docx', 'MADEUP Zetabeis plan.docx', 'MADEUP oljemaling fasade.docx']);

  await pop(/grunnledninger/); await sl(200);
  const a = await inPop();
  check(a && /^311/.test(a.code), 'your own code names count as words: “grunnledninger” → 311 ' + JSON.stringify(a));

  await pop(/oljemaling fasade/); await sl(200);
  const o = await inPop();
  check(o && /^235/.test(o.code), 'a hand-picked code word beats a word from a name: oljemaling fasade → 235, not 627 ' + JSON.stringify(o));
  const line = await pop(/sprinkler heis/); await sl(200);
  const c = await inPop();
  check(/Choose code: (332 or 621|621 or 332)/.test(line || '') && c && c.alt.length === 2 && c.alt.some(x => /^332/.test(x)) && c.alt.some(x => /^621/.test(x)) && !/^\d/.test(c.code), 'two codes as close: no guess, both to choose from ' + JSON.stringify({ line, c }));
  await p.evaluate(() => [...document.querySelectorAll('.dcn-fpop .dcn-altb')].find(x => /^621/.test(x.textContent)).click()); await sl(300);
  check(/^621/.test(((await inPop()) || {}).code), 'tapping one sets it');

  await pop(/Zetabeis plan/); await sl(200);
  await p.evaluate(() => { const s = document.querySelector('.dcn-fpop select[data-dcncode]'), o = [...s.options].find(x => /^235/.test(x.value)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  await add(['MADEUP Zetabeis fasade.docx']);
  await pop(/Zetabeis fasade/); await sl(200);
  const d = await inPop();
  check(d && !/^\d/.test(d.code) && d.alt.some(x => /^235/.test(x)), 'a code you chose once is learned from the file name and offered as a choice next time (twice makes it the code – doc-learn) ' + JSON.stringify(d));
  check(await p.evaluate(() => !!(Features.tools().fdvlearn || {}).w && !!Features.tools().fdvlearn.w.zetabei), 'learned codes are kept with your codes (synced, encrypted)');

  await p.evaluate(() => document.querySelectorAll('[data-dcnfx]').forEach(x => x.click())); await sl(150);
  const lr = await p.evaluate(() => { const d = document.querySelector('.dcn-lrn'); if (!d) return null; d.open = true; return [...d.querySelectorAll('li')].map(x => x.textContent); });
  check(lr && lr.some(x => /zetabei\s*→\s*235/.test(x)), 'the rules show what was learned ' + JSON.stringify(lr));
  await p.evaluate(() => document.querySelector('[data-dcnlrx="zetabei"]').click()); await sl(300);
  check(await p.evaluate(() => !Features.tools().fdvlearn.w.zetabei), 'and it can be forgotten');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await p.evaluate(() => { localStorage.removeItem('dcn.nsnames'); const t = Features.tools(); delete t.fdvlearn; Features.saveTools(t); });
  await b.close(); done();
})();
