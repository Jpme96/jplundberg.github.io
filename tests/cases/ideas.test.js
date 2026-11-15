/* JP's list of 15 Nov 2026 (made-up data only):
   - Finances: a one-off big expense is counted once, not as a daily pace
   - Subscriptions: the subscription check (a price that went up, ones not looked at for half a year)
   - Flex time: weekdays with work events in the calendar but nothing logged can be added in one tap
   - Papers: scan with the camera – photos cleaned up and made into one PDF
   - the Excel editor: insert and delete rows (written into the file), sort and filter (the view only) */
const { open, sl, go, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  await p.evaluate(days => {
    ['subs', 'flex', 'papers', 'finance'].forEach(f => Features.set(f, true));
    const d = Vault.get();
    d.budget = { income: [{ id: 'i1', name: 'Salary', amount: 40000, day: 20 }], fixed: [{ id: 'f1', name: 'Rent', amount: 12000, day: 1 }] };
    d.expenses = (d.expenses || []).concat([
      { id: 'e1', date: days.t, amount: 18000, cat: 'home', note: 'Sofa' },
      { id: 'e2', date: days.t, amount: 120, cat: 'groceries', note: 'Shop' },
      { id: 'e3', date: days.m5, amount: 129, cat: 'fun', note: 'Streamio' }]);
    Vault.save(d);
    const t = Features.tools();
    t.subs = [{ id: 's1', name: 'Streamio', amount: 99, period: 'monthly', renews: days.p10, cat: 'streaming' }, { id: 's2', name: 'Cloudbox', amount: 49, period: 'monthly', renews: days.p20, cat: 'software', checked: days.t }];
    t.flex = [];
    Features.saveTools(t);
    /* a work meeting on the last weekday before today, nothing logged that day */
    let k = -1; for (; k > -8; k--) { const g = new Date(); g.setDate(g.getDate() + k); if (g.getDay() > 0 && g.getDay() < 6) break; }
    const dd = new Date(); dd.setDate(dd.getDate() + k); const key = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    const c = JSON.parse(localStorage.getItem('dash.calendar') || '{}'); c.events = (c.events || []).concat([{ id: 'w1', date: key, start: '08:30', stop: '10:00', title: 'Site meeting', cat: 'work' }, { id: 'w2', date: key, start: '14:00', stop: '15:45', title: 'Review', cat: 'work' }]);
    localStorage.setItem('dash.calendar', JSON.stringify(c)); localStorage.setItem('t.flexDay', key);
  }, { t: day(0), m5: day(-5), p10: day(10), p20: day(20) });
  await sl(600);

  /* Finances: the pace counts the sofa once */
  await go(p, 'finance/', 3000);
  const lead = await p.evaluate(() => (document.getElementById('fpPaceLead') || {}).textContent || '');
  const mid = new Date().getDate() >= 3 && new Date().getDate() < new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  check(/one-off \(Sofa\)/.test(lead), 'the pace says the sofa was a one-off: ' + lead.slice(0, 200));
  if (mid) { const n = +((lead.match(/end the month (?:with )?([\d\s ]+) kr/) || [])[1] || '').replace(/\D/g, ''); check(!/end the month [\d\s ]+ kr over/.test(lead) || n < 18000 * 2, 'and the end-of-month guess does not multiply it'); }

  /* Subscriptions: the check */
  const sc = await p.evaluate(() => { const c = document.querySelector('[data-tool="subs"]'); return c ? c.innerText : ''; });
  check(/Subscription check/.test(sc) && /Was 99 kr, last charge 129 kr/.test(sc), 'the subscription check sees that Streamio went up');
  check(!/Cloudbox[\s\S]*Still using it/.test(sc), 'a subscription checked lately is not asked about');
  await p.evaluate(() => document.querySelector('[data-subprice]').click()); await sl(500);
  check(await p.evaluate(() => Features.tools().subs.find(x => x.id === 's1').amount === 129), '"Update the price" sets the new price');
  await p.evaluate(() => { const t = Features.tools(); t.subs.find(x => x.id === 's2').checked = '2020-01-01'; Features.saveTools(t); }); await sl(500);
  check(await p.evaluate(() => /Still using it\?/.test(document.querySelector('[data-tool="subs"]').innerText)), 'one not looked at for half a year asks "Still using it?"');
  await p.evaluate(() => document.querySelector('[data-subcancel]').click()); await sl(400);
  check(await p.evaluate(() => Features.tools().subs.find(x => x.id === 's2').paused === true), '"Cancel it" pauses it (and says to cancel with the company)');

  /* Flex time from the calendar */
  await go(p, 'work/', 3000);
  const fx = await p.evaluate(() => { const c = document.querySelector('[data-tool="flex"]'); return c ? c.innerText : ''; });
  check(/Not logged – from your calendar/.test(fx) && /08:30–15:45/.test(fx) && /2 work events/.test(fx), 'Flex time offers the day from the calendar: first start to last end');
  await p.evaluate(() => document.querySelector('[data-flexcal]').click()); await sl(500);
  const fl = await p.evaluate(() => Features.tools().flex.find(x => x.date === localStorage.getItem('t.flexDay')));
  check(fl && fl.in === '08:30' && fl.out === '15:45' && fl.type === 'work', 'one tap logs it ' + JSON.stringify(fl));

  /* Papers: scan */
  await go(p, 'papers/', 2500);
  check(await p.evaluate(() => !!document.querySelector('input[data-pascan][capture="environment"]')), 'Papers has "Scan with the camera"');
  const scan = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#b8a890'; x.fillRect(0, 0, 600, 800); x.fillStyle = '#3a3020'; x.fillRect(60, 80, 300, 30);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)), f = new File([blob], 'p1.jpg', { type: 'image/jpeg' });
    const pg = await window.__paScan.clean(f), pdf = await window.__paScan.pdf([pg, pg]);
    const head = new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 8).arrayBuffer())), txt = new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()));
    return { head, pages: (txt.match(/\/Type \/Page\b/g) || []).length, name: pdf.name, w: pg.w, h: pg.h };
  });
  check(scan.head.startsWith('%PDF') && scan.pages === 2 && /^Scan .+\.pdf$/.test(scan.name), 'two photos become one PDF with two pages (' + JSON.stringify(scan) + ')');

  /* the Excel editor: rows, sort and filter */
  await go(p, 'work/', 3000);
  const xl = await p.evaluate(async () => {
    await new Promise((res, rej) => { if (window.XlsxView) return res(); const s = document.createElement('script'); s.src = '/cmd/xlsx-view.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    /* a tiny made-up workbook, packed with the same zip helpers Document control uses */
    const Z = window.DocCtl && window.DocCtl.XZ; if (!Z) return { err: 'no zip helpers' };
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Code</t></is></c><c r="B1" t="inlineStr"><is><t>Name</t></is></c></row>' +
      '<row r="2"><c r="A2"><v>320</v></c><c r="B2" t="inlineStr"><is><t>Pipes</t></is></c></row>' +
      '<row r="3"><c r="A3"><v>223</v></c><c r="B3" t="inlineStr"><is><t>Plan</t></is></c></row>' +
      '<row r="4"><c r="A4"><v>231</v></c><c r="B4" t="inlineStr"><is><t>Section</t></is></c><c r="C4"><f>A4*2</f><v>462</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="B3:C3"/></mergeCells></worksheet>';
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Plan" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', sheet]];
    const blob0 = await Z.packAll(files.map(f => ({ name: f[0], text: f[1] })));
    const buf = await blob0.arrayBuffer();
    /* row 3 deleted, a row put in above row 2, and a cell typed into the new row */
    const edits = { 'xl/worksheets/sheet1.xml': { '@rows': [{ op: 'del', r: 3 }, { op: 'ins', r: 2 }], A2: { v: '999' } } };
    const out = await XlsxView.apply(buf, edits, Z), bk = await XlsxView.read(await out.arrayBuffer(), Z), sh = bk.sheets[0];
    const col = r => (sh.cells['A' + r] || {}).v + '/' + (sh.cells['B' + r] || {}).v;
    const ents = Z.zipEntries(await out.arrayBuffer()), sx = ents.find(z => z.name === 'xl/worksheets/sheet1.xml');
    const xml = new TextDecoder().decode(await Z.inflate(sx));
    /* the view: sorted by column A and filtered */
    const v = XlsxView.open({ blob: new Blob([buf]), title: 't.xlsx', Z, edits: {}, download: () => {} });
    await new Promise(r => setTimeout(r, 400));
    v.box.querySelector('[data-xvc="1"]').click();
    const sorted = [...v.box.querySelectorAll('tbody tr th')].map(t => t.textContent).slice(0, 4).join(',');
    v.box.querySelector('[data-xvq]').value = 'sect'; v.box.querySelector('[data-xvq]').dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));
    const filtered = [...v.box.querySelectorAll('tbody tr th')].map(t => t.textContent).join(',');
    const tools = !!v.box.querySelector('[data-xv="rowins"]') && !!v.box.querySelector('[data-xv="rowdel"]');
    v.close();
    return { r1: col(1), r2: col(2), r3: col(3), r4: col(4), f: /<f>A4\*2<\/f>/.test(xml), merge: /mergeCell ref="B2:C2"|<mergeCells/.test(xml) ? 'kept-or-moved' : 'gone', mergeRef: (xml.match(/mergeCell ref="([^"]+)"/) || [])[1] || '', sorted, filtered, tools, orig: XlsxView.origRow(edits['xl/worksheets/sheet1.xml'], 4) };
  });
  check(!xl.err, 'the editor test ran ' + (xl.err || ''));
  check(xl.r1 === 'Code/Name' && xl.r2 === '999/undefined' && xl.r3 === '320/Pipes' && xl.r4 === '231/Section', 'rows put in and taken out are written into the file: ' + [xl.r1, xl.r2, xl.r3, xl.r4].join(' | '));
  check(xl.f && xl.orig === 4, 'a formula in a moved row keeps pointing at its own row (A4*2), and row 4 maps back to the plan row ' + xl.orig);
  check(xl.mergeRef === '', 'a merge in a deleted row is removed (' + xl.mergeRef + ')');
  check(xl.sorted === '1,3,4,2' && xl.filtered === '1,4' && xl.tools, 'sorting by a column and filtering change the view (' + xl.sorted + ' / ' + xl.filtered + ')');

  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
