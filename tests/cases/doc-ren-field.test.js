/* Give files the right names: a field you fill in on a file's card is shown at once – the card's colour, its status and the new name
   (JP 2026-11-28 10:36 "forget sometimes to change its colour when I add a correct name": the field still had focus when its change
   came, and the tool's draw stood back for a field in use without drawing later). Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); dt.items.add(new File(['%PDF made up'], '332 DV Madeup sprinkler.pdf', { type: 'application/pdf' })); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await sl(2500);
  const card = () => p.evaluate(() => { const li = document.querySelector('.dx-ren .dcn-card'); return li && { cls: li.className, name: (li.querySelector('.dcn-sug code') || {}).textContent || '', st: (li.querySelector('.dcn-head .dc-st') || {}).textContent || '' }; });
  await p.evaluate(() => { const c = document.querySelector('.dx-ren .dcn-row.dcn-c [data-dcnexp]'); if (c) c.click(); }); await sl(400);
  /* the file already has its right name except the text: a wrong text first (field left), then the right one typed */
  const setDesc = v => p.evaluate(v => { const i = document.querySelector('.dx-ren .dcn-card input[data-dcnv$=":desc"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, v);
  await setDesc('Wrong words'); await sl(900);
  const c0 = await card();
  check(c0 && /dcn-bad/.test(c0.cls) && /Wrong words/.test(c0.name), 'a wrong text: the card is red ' + JSON.stringify(c0));
  await p.evaluate(() => { const i = document.querySelector('.dx-ren .dcn-card input[data-dcnv$=":desc"]'); i.focus(); i.select(); });
  await p.keyboard.type('Madeup sprinkler'); await sl(100);
  /* its change comes while the field still has focus (Enter, Tab, or a click on the page) */
  await p.evaluate(() => document.activeElement.dispatchEvent(new Event('change', { bubbles: true }))); await sl(1000);
  const c1 = await card();
  check(c1 && /dcn-good/.test(c1.cls) && /Madeup sprinkler/.test(c1.name), 'the right text: the card turns green at once, while the field still has focus ' + JSON.stringify({ c0, c1 }));
  check(await p.evaluate(() => document.activeElement && document.activeElement.matches('input[data-dcnv$=":desc"]') && document.activeElement.value === 'Madeup sprinkler'), 'the field keeps its focus and its text');
  /* while typing – before the field's change – the card already follows: a wrong word makes it red, the right text green again */
  await p.evaluate(() => { const i = document.querySelector('.dx-ren .dcn-card input[data-dcnv$=":desc"]'); i.focus(); i.select(); });
  await p.keyboard.type('Madeup sprinklex'); await sl(150);
  const t1 = await card();
  await p.keyboard.press('Backspace'); await p.keyboard.type('r'); await sl(150);
  const t2 = await card();
  check(t1 && /dcn-bad/.test(t1.cls) && /sprinklex/.test(t1.name) && t2 && /dcn-good/.test(t2.cls) && /Madeup sprinkler\.pdf/.test(t2.name) && /follows/.test(t2.st), 'the colour, the status and the new name change while you type ' + JSON.stringify({ t1, t2 }));
  await p.evaluate(() => document.activeElement.blur()); await sl(900);
  /* a drawing that follows its rule but came without its PDF twin: green – the missing twin is about the delivery, not the name */
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(); dt.items.add(new File(['made up drawing'], 'Rørplan sprinkler.dwg')); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(2500);
  const dwg = () => p.evaluate(() => { const c = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => /Rørplan/.test(x.textContent)); if (c) c.querySelector('[data-dcnexp]').click(); });
  await dwg(); await sl(400);
  const fill = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-card'); if (!li) return 'no card'; [...li.querySelectorAll('select[data-dcnv]')].forEach(s => { if (!s.value && s.options.length > 1) { s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } }); return [...li.querySelectorAll('input[data-dcnv], input[data-dcnpv]')].filter(i => !i.value).map(i => i.dataset.dcnv || i.dataset.dcnpv).join(','); }); await sl(600);
  if (fill) await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-card'); [...li.querySelectorAll('input[data-dcnv], input[data-dcnpv]')].filter(i => !i.value).forEach(i => { i.value = '12345'; i.dispatchEvent(new Event('change', { bubbles: true })); }); }); await sl(600);
  await p.evaluate(() => { const u = document.querySelector('.dcn-fpop .dcn-card [data-dcnuse]'); if (u) u.click(); }); await sl(800);
  await dwg(); await sl(400);
  const d1 = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-card'); return li && { cls: li.className, iss: (li.querySelector('.dc-iss') || {}).textContent || '', st: (li.querySelector('.dcn-head .dc-st') || {}).textContent }; });
  check(d1 && /dcn-good/.test(d1.cls) && /PDF|pdf/.test(d1.iss), 'a drawing with its right name and no PDF twin is green, the twin still said below ' + JSON.stringify({ fill, d1 }));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close(); done();
})().catch(e => { console.error('error', e); process.exit(1); });
