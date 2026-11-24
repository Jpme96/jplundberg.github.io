/* The Requirements step as approved in the preview (JP 2026-11-16 15:03–15:19): the list is calm until the pen ✎ is on,
   "Send to the contractor" remembers what was sent and shows when the list changed afterwards, and own project types get
   "+ New type" (name, start from, systems, own documents) and a pen to change or delete them. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = [{ id: 'k1', name: 'Made-up block C', made: '2026-11-16T10:00:00Z', lines: [{ id: 'a', code: '332', t: 'A' }, { id: 'b', code: '332', t: 'BC' }, { id: 'c', code: '442', t: 'E' }] }]; t.dctl = []; t.dctypes = []; delete t.dcTeamAt; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dropen="k1"]').click()); await sl(500);
  /* a list without a project becomes one and opens in step 1 Krav (JP 2026-11-24 18:37); Change the requirements shows the step */
  await p.evaluate(() => { const b = document.querySelector('[data-dckin]'); b && b.click(); }); await sl(500);
  const c0 = await p.evaluate(() => ({ x: document.querySelectorAll('[data-drldel]').length, add: !!document.querySelector('form[data-dcaddl]'), pen: !!document.querySelector('[data-drpen]'), send: !!document.querySelector('[data-drsend]') }));
  check(c0.x === 0 && !c0.add && c0.pen && c0.send, 'the list is calm: no × or add form until the pen is on; Send to the contractor is there ' + JSON.stringify(c0));
  await p.evaluate(() => document.querySelector('[data-drpen]').click()); await sl(300);
  const c1 = await p.evaluate(() => ({ x: document.querySelectorAll('[data-drldel]').length, add: !!document.querySelector('form[data-dcaddl]'), on: document.querySelector('[data-drpen]').getAttribute('aria-pressed') }));
  check(c1.x === 3 && c1.add && c1.on === 'true', 'the pen shows × per line and the add form ' + JSON.stringify(c1));
  await p.evaluate(() => document.querySelector('[data-drpen]').click()); await sl(300);
  /* send */
  await p.evaluate(() => document.querySelector('[data-drsend]').click()); await sl(300);
  await p.evaluate(() => { const i = document.querySelector('form[data-drsendf] [name="to"]'); i.value = 'Made-up Sprinkler AS'; i.blur(); });
  await p.evaluate(() => { window.__shared = null; FdvPdf.share = f => { window.__shared = f.name; return Promise.resolve(); }; document.querySelector('form[data-drsendf] [data-drxlsx]').click(); }); await sl(500);
  const s1 = await p.evaluate(() => ({ sent: Features.list('dckrav')[0].sent, file: window.__shared, line: (document.querySelector('.dx-sent') || {}).textContent || '' }));
  check(s1.sent && s1.sent.to === 'Made-up Sprinkler AS' && s1.sent.what === 'xlsx' && s1.sent.n === 3 && /\.xlsx$/.test(s1.file) && /Sent to Made-up Sprinkler AS/.test(s1.line), 'Send: the Excel is made and shared, and the project remembers who got what ' + JSON.stringify(s1));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav[0].lines = t.dckrav[0].lines.slice(0, 2); Features.saveTools(t); }); await sl(500);
  const s2 = await p.evaluate(() => ({ ch: !!document.querySelector('.dx-sent.dx-ch'), t: (document.querySelector('.dx-sent') || {}).textContent || '', btn: (document.querySelector('[data-drsend]') || {}).textContent }));
  check(s2.ch && /Changed after it was sent/.test(s2.t) && /Send again/.test(s2.btn), 'a change after sending shows "Changed after it was sent" and Send again ' + JSON.stringify(s2));
  /* "Som Boligbyggs vedlegg 7": the same list laid out like their document plan, saved for a look and read back as a plan */
  const bby = await p.evaluate(async () => { window.__bf = null; FdvPdf.share = f => { window.__bf = f; return Promise.resolve(); }; document.querySelector('[data-drsend]') && !document.querySelector('form[data-drsendf]') && document.querySelector('[data-drsend]').click(); await new Promise(r => setTimeout(r, 300));
    const b = document.querySelector('form[data-drsendf] [data-drxbby]'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 400)); const f = window.__bf; if (!f) return { btn: true };
    const u8 = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return { name: f.name, b64: btoa(s) }; });
  check(bby && bby.b64 && /Dokumentplan.*\.xlsx$/.test(bby.name), 'Send has "Excel – like Boligbygg’s Vedlegg 7" and makes the file ' + JSON.stringify(bby && { name: bby.name }));
  if (bby && bby.b64) require('fs').writeFileSync(require('path').join(__dirname, '..', '.tmp', 'bby.xlsx'), Buffer.from(bby.b64, 'base64'));

  await p.evaluate(() => document.querySelector('[data-drpen]').click()); await sl(200);
  await p.evaluate(() => document.querySelector('[data-drpick]').click()); await sl(600);
  await p.evaluate(() => document.querySelector('[data-dctnew]').click()); await sl(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-dctform]'); f.n.value = 'Made-up small bath'; const s = f.querySelector('[data-dctfrom]'); s.value = 'bath'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(300);
  const t1 = await p.evaluate(() => ({ name: document.querySelector('form[data-dctform]').n.value, n: document.querySelectorAll('form[data-dctform] [data-dctc]:checked').length, label: document.querySelector('[data-dctn]').textContent }));
  check(t1.name === 'Made-up small bath' && t1.n > 5 && /picked/.test(t1.label), '+ New type: start from Bathroom ticks its systems, the name is kept ' + JSON.stringify(t1));
  await p.evaluate(() => { const c = document.querySelector('form[data-dctform] [data-dctc]:checked'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(100);
  await p.evaluate(() => { const f = document.querySelector('form[data-dctform]'); f.xc.value = '274'; f.xt.value = 'Made-up wet room papers'; f.querySelector('[data-dctxadd]').click(); }); await sl(300);
  await p.evaluate(() => document.querySelector('form[data-dctform]').requestSubmit()); await sl(500);
  const t2 = await p.evaluate(() => { const t = Features.tools().dctypes[0]; return t && { name: t.name, n: t.codes.length, x: t.x.map(x => x[0] + ' ' + x[2]).join(), chip: [...document.querySelectorAll('[data-dcptype]')].some(b => /Made-up small bath/.test(b.textContent)) }; });
  check(t2 && t2.name === 'Made-up small bath' && t2.n > 4 && /,274 Made-up wet room papers$/.test(t2.x) && t2.x.split(',').length > 3 && t2.chip, 'Save the type: it is under your own types with its systems, the start type’s own documents and the one added ' + JSON.stringify(t2));
  /* the pen on own types: change and delete */
  await p.evaluate(() => document.querySelector('[data-dctpen]').click()); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dctedit]').click()); await sl(300);
  const t3 = await p.evaluate(() => ({ name: document.querySelector('form[data-dctform]').n.value, del: !!document.querySelector('form[data-dctform] [data-dctdel]') }));
  check(t3.name === 'Made-up small bath' && t3.del, 'the pen on own types opens one to change, with Delete ' + JSON.stringify(t3));
  await p.evaluate(() => document.querySelector('form[data-dctform] [data-dctdel]').click()); await sl(400);
  check(await p.evaluate(() => (Features.tools().dctypes || []).length === 0 && !document.querySelector('form[data-dctform]')), 'Delete the type removes it');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
