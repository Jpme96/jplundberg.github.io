/* Travel fills things in for you (2026-11-22, JP: passports have NFC → "Yeah"): the passport's machine-readable lines
   (checked with their check digits) fill a travel document, linked to its scan in Papers; a pasted Norwegian / Airbnb
   confirmation becomes the flights and the stay of the trip, the total once in Finances. Made-up data only
   (the passport lines are ICAO 9303's own specimen, "Anna Maria Eriksson" of Utopia). */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const MRZ = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10';
const NOR = 'Takk for bestillingen!\nBestillingsreferanse: K7XQ2M\nFredag 12. desember 2027\nDY1302 Oslo-Gardermoen (OSL) 07:05 - London-Gatwick (LGW) 08:50\nSøndag 14. desember 2027\nDY1303 London-Gatwick (LGW) 09:40 - Oslo-Gardermoen (OSL) 12:55\nTotalt 1 849,00 NOK';
const AIR = 'Airbnb\nReservasjonen er bekreftet – reisen din til London\nInnsjekking\nfre. 12. des. 2027\n15:00\nUtsjekking\nsøn. 14. des. 2027\n11:00\nAdresse\nMade-up Street 1, London\nBekreftelseskode\nHMABCD1234\nTotalt (NOK) kr 3 210,50';
(async () => {
  const { b, p } = await open(393);
  /* the readers on their own */
  await go(p, 'travel/', 3000);
  check(await p.evaluate(() => !window.TravelImport), 'the readers are not loaded until a form opens (the page stays light)');
  await p.evaluate(() => document.getElementById('docAdd').click()); await sl(1200);
  await p.evaluate(() => document.querySelector('#docForm [data-close]').click()); await sl(300);
  const r = await (async () => { return p.evaluate((M, N, A) => {
    const T = window.TravelImport, m = T.mrz(M), bad = T.mrz(M.replace('L898902C36', 'L898902C46')), td1 = T.mrz('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<'), live = T.mrz(M.replace('7408122', '74O8122').replace('\n', ' '));
    return { m, bad: bad.valid, td1: td1 && td1.valid && td1.type, live: live && live.valid, nor: T.booking(N, new Date(2027, 10, 1)), air: T.booking(A, new Date(2027, 10, 1)), en: T.booking('Booking reference: ZZ12AB\nFlight D8 2531, 3 Jan 2028, Bergen (BGO) 18:20 → Málaga (AGP) 22:55\nTotal price NOK 2,499', new Date(2027, 10, 1)) };
  }, MRZ, NOR, AIR); })();
  check(r.m && r.m.valid && r.m.number === 'L898902C3' && r.m.surname === 'Eriksson' && r.m.given === 'Anna Maria' && r.m.born === '1974-08-12' && r.m.expires === '2012-04-15', 'passport lines: read, every check digit right ' + JSON.stringify(r.m));
  check(r.bad === false, 'a wrong digit in the number is caught');
  check(r.td1 === 'id' && r.live === true, 'a three-line ID card reads; Live Text noise (spaces, O for 0) is cleaned up');
  check(r.nor.length === 2 && r.nor[0].from === 'Oslo-Gardermoen (OSL)' && r.nor[0].title === 'DY 1302' && r.nor[0].time === '07:05' && r.nor[1].from === 'London-Gatwick (LGW)' && r.nor[1].time === '09:40' && r.nor[0].ref === 'K7XQ2M' && r.nor[0].cost === '1849' && !r.nor[1].cost, 'Norwegian: both flights, their own times and airports, the total once ' + JSON.stringify(r.nor));
  check(r.air.length === 1 && r.air[0].type === 'hotel' && r.air[0].title === 'Airbnb · London' && r.air[0].date === '2027-12-12' && r.air[0].endDate === '2027-12-14' && r.air[0].ref === 'HMABCD1234' && r.air[0].cost === '3211', 'Airbnb: the stay with check-in, check-out, code and total ' + JSON.stringify(r.air));
  check(r.en[0] && r.en[0].cost === '2499' && r.en[0].to === 'Málaga (AGP)', 'English confirmation: "NOK 2,499" is 2 499 kr');
  /* the document form */
  await p.evaluate(() => { const t = Features.tools(); t.papers = [{ id: 'pa-made-up-1', title: 'Passport scan (made up)', kind: 'id' }]; Features.saveTools(t); });
  await go(p, 'travel/#docs', 3000);
  await p.evaluate(() => document.getElementById('docAdd').click()); await sl(1000);
  await p.evaluate(M => { document.getElementById('docMrz').value = M; document.getElementById('docMrzGo').click(); document.getElementById('docPaper').value = 'pa-made-up-1'; }, MRZ); await sl(200);
  const f = await p.evaluate(() => ({ no: docNo.value, holder: docHolder.value, exp: docExp.value, name: docName.value, out: docMrzOut.textContent }));
  check(f.no === 'L898902C3' && f.holder === 'Anna Maria Eriksson' && f.exp === '2012-04-15' && /UTO/.test(f.name) && /checked/.test(f.out), 'the form is filled from the lines ' + JSON.stringify(f));
  await p.evaluate(() => document.querySelector('#docForm button[type=submit]').click()); await sl(400);
  const d = await p.evaluate(() => ({ doc: (JSON.parse(localStorage.getItem('dash.travel')).docs || []).find(x => x.number === 'L898902C3'), scan: !!document.querySelector('#docList a.doc-scan[href*="pa-made-up-1"]') }));
  check(d.doc && d.doc.holder === 'Anna Maria Eriksson' && d.doc.paper === 'pa-made-up-1' && d.scan, 'saved with number and name, linked to the scan in Papers ' + JSON.stringify(d.doc));
  /* a trip: paste the confirmation, add all */
  await p.evaluate(() => { const tv = JSON.parse(localStorage.getItem('dash.travel') || '{}'); tv.trips = [{ id: 'tt-made-up', name: 'Made-up London', dest: 'London', start: '2027-12-12', end: '2027-12-14', items: [] }]; localStorage.setItem('dash.travel', JSON.stringify(tv)); const v = Vault.get(); if (v) { v.travel = tv; Vault.save(v); } });
  await go(p, 'travel/#trip=tt-made-up', 3500);
  await p.evaluate(() => (document.querySelector('[data-quick="flight"]') || document.getElementById('tpAddItem')).click()); await sl(1000);
  await p.evaluate(N => { document.querySelector('#tiImpBox details').open = true; document.getElementById('tiImpText').value = N; document.getElementById('tiImpGo').click(); }, NOR); await sl(200);
  const shown = await p.evaluate(() => document.querySelectorAll('#tiImpOut .ti-imp-list li').length);
  check(shown === 2, 'two flights are shown before anything is added');
  const spend0 = await p.evaluate(() => (Vault.get().expenses || []).length);
  await p.evaluate(() => document.getElementById('tiImpAdd').click()); await sl(500);
  const t2 = await p.evaluate(() => { const tr = (JSON.parse(localStorage.getItem('dash.travel')).trips || []).find(x => x.id === 'tt-made-up'); return { items: (tr.items || []).map(i => i.title + '|' + i.date + '|' + (i.cost || '')), spend: (Vault.get().expenses || []).filter(e => e.amount === 1849).length }; });
  check(t2.items.length === 2 && t2.items[0] === 'DY 1302|2027-12-12|1849' && t2.spend === 1, 'both flights in the plan, 1 849 kr once in Finances ' + JSON.stringify(t2));
  await p.evaluate(() => (document.getElementById('tpAddItem') || document.querySelector('[data-quick="flight"]')).click()); await sl(600);
  await p.evaluate(N => { document.querySelector('#tiImpBox details').open = true; document.getElementById('tiImpText').value = N; document.getElementById('tiImpGo').click(); document.getElementById('tiImpAdd').click(); }, NOR); await sl(400);
  check(await p.evaluate(() => (JSON.parse(localStorage.getItem('dash.travel')).trips.find(x => x.id === 'tt-made-up').items || []).length) === 2, 'pasting the same email again adds nothing twice');
  check(!p.errs.length, 'no script errors ' + p.errs.slice(0, 2).join(' | '));
  await b.close(); done();
})();
