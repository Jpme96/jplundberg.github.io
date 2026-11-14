/* FDV inspection notes after NS 3451 (building part codes) and NS 3424 (TG, KG, survey level) – 2026-11-13:
   - a finding is added with a code, TG, KG, place, cause, when and cost; the list shows the code's name and the priority
   - a three-digit code of your own is remembered and shows under its group
   - a finding can be changed in place (Edit finding → Save finding)
   - the report groups findings by code, has the grade grid, the priority and the KG legend
   - upgrade step 4 moves the old parts to codes (old name kept as the place where there is no clear code)
   Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { Features.set('fdv', true); const t = Features.tools(); t.fdv = [{ id: 'ins1', no: '2026-007', building: 'Testveien 1', address: 'Made-up street 1', date: '2026-11-12', client: 'Test client', level: '2', findings: [] }]; Features.saveTools(t); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => { document.querySelector('[data-fdvopen="ins1"]').click(); }); await sl(300);
  const form = await p.evaluate(() => { const f = document.querySelector('form.fdv-add'); return !!f && { code: !!f.code, kg: !!f.kg, kt: !!f.kt, when: !!f.when, cost: !!f.cost, groups: f.code.querySelectorAll('optgroup').length, has23: !![...f.code.options].find(o => o.value === '23') }; });
  check(form && form.code && form.kg && form.kt && form.when && form.cost && form.groups === 6 && form.has23, 'the finding form has the NS 3451 code (6 main groups), TG, KG, consequence type, when and cost ' + JSON.stringify(form));
  /* add a finding: 23 Outer walls, TG 3, KG 2 */
  await p.evaluate(() => { const f = document.querySelector('form.fdv-add'); f.code.value = '23'; f.tg.value = '3'; f.kg.value = '2'; f.kt.value = 'safety'; f.part.value = '2nd floor, south'; f.text.value = 'Rot in the cladding'; f.action.value = 'Replace boards'; f.cause.value = 'Too close to the ground'; f.when.value = 'y1'; f.cost.value = '25 000'; f.requestSubmit(); });
  await sl(400);
  /* a three-digit code of your own */
  await p.evaluate(() => { const f = document.querySelector('form.fdv-add'); f.code.value = '+'; f.code.dispatchEvent(new Event('change', { bubbles: true })); f.newcode.value = '231 Made-up wall code'; f.tg.value = '1'; f.kg.value = '1'; f.text.value = 'Small crack'; f.requestSubmit(); });
  await sl(400);
  const st = await p.evaluate(() => { const r = Features.list('fdv')[0], li = [...document.querySelectorAll('.fdv-list li')].map(l => l.textContent.replace(/\s+/g, ' ').trim());
    const f = document.querySelector('form.fdv-add'); f.code.value = '23'; f.code.dispatchEvent(new Event('change', { bubbles: true }));
    return { n: r.findings.length, a: r.findings[0], b: r.findings[1], codes: Features.tools().fdvcodes, li, own: !![...f.code3.options].find(o => o.value === '231') && !f.code3.hidden, ownGroup: '2 (under 23)' }; });
  check(st.n === 2 && st.a.code === '23' && st.a.kg === '2' && st.a.kt === 'safety' && st.a.cost === 25000 && st.a.when === 'y1' && st.a.part === '2nd floor, south' && st.a.cause, 'the finding is saved with its code, KG, type, place, cause, when and cost ' + JSON.stringify(st.a));
  check(st.li.some(t => /23 Outer walls · 2nd floor, south/.test(t) && /KG 2/.test(t) && /High priority/.test(t)), 'the list shows "23 Outer walls · place", KG and the priority (TG 3 × KG 2 = high) ' + JSON.stringify(st.li));
  check(st.b.code === '231' && (st.codes || []).some(c => c.c === '231' && c.n === 'Made-up wall code') && st.own && /^2 /.test(st.ownGroup || ''), 'a three-digit code of your own is saved, remembered and offered under 23 ' + JSON.stringify(st.codes));
  /* edit the first finding */
  await p.evaluate(id => { document.querySelector('[data-fdvfedit="ins1:' + id + '"]').click(); }, st.a.id); await sl(300);
  const ed = await p.evaluate(() => { const f = document.querySelector('form.fdv-add.editing'); if (!f) return null; const v = { code: f.code.value, tg: f.tg.value, kg: f.kg.value, text: f.text.value }; f.tg.value = '2'; f.text.value = 'Rot in the cladding, bottom boards'; f.requestSubmit(); return v; });
  await sl(400);
  const after = await p.evaluate(id => { const r = Features.list('fdv')[0]; return { n: r.findings.length, x: r.findings.filter(x => x.id === id)[0], editing: !!document.querySelector('form.fdv-add.editing') }; }, st.a.id);
  check(ed && ed.code === '23' && ed.tg === '3' && ed.kg === '2' && after.n === 2 && after.x.tg === '2' && /bottom boards/.test(after.x.text) && after.x.cost === 25000 && !after.editing, 'Edit finding fills the form with the finding and Save changes it in place ' + JSON.stringify({ ed, x: after.x }));
  /* your own list (made-up names): a file or pasted table is read, and picking 23 → 234 → 2341 shows the levels below */
  const parsed = await p.evaluate(() => window.__core.work.parseCodes('# made up\n234.000|2341.000|Made-up window\n234.000||Made-up openings\n235 Made-up cladding\n237\t(Reservert)\n2342\tMade-up door'));
  check(parsed.map(c => c.c).join() === '234,2341,2342,235' && parsed[1].n === 'Made-up window', 'codes are read from lines, "|" rows and tab rows; reserved ones are skipped ' + JSON.stringify(parsed));
  await p.evaluate(l => { const t = Features.tools(); t.fdvcodes = (t.fdvcodes || []).concat(l); Features.saveTools(t); }, parsed); await sl(600);
  const cas = await p.evaluate(async () => { const f = document.querySelector('form.fdv-add'), w = ms => new Promise(r => setTimeout(r, ms)), ch = el => el.dispatchEvent(new Event('change', { bubbles: true }));
    f.code.value = '23'; ch(f.code); await w(50); const l3 = [...f.code3.options].map(o => o.value), h4 = f.code4.hidden;
    f.code3.value = '234'; ch(f.code3); await w(50); const l4 = [...f.code4.options].map(o => o.value);
    f.code4.value = '2341'; ch(f.code4); await w(50); f.tg.value = '2'; f.text.value = 'Made-up window finding'; f.requestSubmit(); await w(400);
    const x = Features.list('fdv')[0].findings.filter(q => q.text === 'Made-up window finding')[0];
    document.querySelector('[data-fdvfedit="ins1:' + x.id + '"]').click(); await w(300); const g = document.querySelector('form.fdv-add.editing');
    const back = g && [g.code.value, g.code3.value, g.code4.value].join('/'); document.querySelector('[data-fdvfcancel]').click(); await w(200);
    const f2 = document.querySelector('form.fdv-add'); f2.code.value = '26'; ch(f2.code); await w(50);
    return { l3, h4, l4, code: x.code, back, none: f2.querySelector('.fdv-sub').hidden, label: LifePages.partLabel(x) }; });
  check(cas.l3.join() === ',231,234,235' && cas.h4 && cas.l4.join() === ',2341,2342' && cas.code === '2341' && cas.back === '23/234/2341' && cas.none && /^2341 Made-up window/.test(cas.label), 'picking 23 shows its three-digit codes, 234 its four-digit ones; the finding gets 2341 and an edit opens at 23 → 234 → 2341; a group with none hides the row ' + JSON.stringify(cas));
  /* revisions (2026-11-14): add Rev. 01 in the Building tab – it shows on the cover */
  await p.evaluate(() => document.querySelector('[data-fdvtab="building"]').click()); await sl(300);
  const rv0 = await p.evaluate(() => { const f = document.querySelector('form[data-fdvrevadd]'); if (!f) return null; const lbl = f.querySelector('button').textContent.trim(); f.text.value = 'Made-up first issue'; f.requestSubmit(); return lbl; }); await sl(400);
  const rv = await p.evaluate(() => { const r = Features.list('fdv')[0]; return { revs: r.revs, li: document.querySelectorAll('.fdv-revs li').length, next: (document.querySelector('form[data-fdvrevadd] button') || {}).textContent }; });
  check(/Rev\. 01/.test(rv0 || '') && rv.revs && rv.revs[0].n === '01' && rv.revs[0].text === 'Made-up first issue' && rv.li === 1 && /Rev\. 02/.test(rv.next || ''), 'a revision is added as Rev. 01 with today\'s date, and the next one offered is Rev. 02 ' + JSON.stringify(rv));
  await p.evaluate(() => document.querySelector('[data-fdvtab="findings"]').click()); await sl(300);
  /* the report */
  await p.evaluate(() => { document.querySelector('[data-fdvpdf="ins1"]').click(); }); await sl(500);
  const rp = await p.evaluate(() => { const d = document.querySelector('.rp-doc'); if (!d) return null; const t = d.textContent; return { secs: [...d.querySelectorAll('.rp-part h3')].map(h => h.textContent), grid: d.querySelectorAll('.rp-grid:not(.rp-revt) tbody tr').length, kg: /Consequence grades/.test(t), level: /Level 2/.test(t), cost: /25\s?000 kr/.test(t), std: /NS 3451/.test(t) && /NS 3424/.test(t), prio: d.querySelectorAll('.rp-pr').length, rev: /Rev\. 01/.test(d.querySelector('.rp-kick').textContent) && !!d.querySelector('.rp-revt'), h2: [...d.querySelectorAll('h2')].map(h => h.textContent.trim()), no: /Report no\. 2026-007/.test(d.querySelector('.rp-kick').textContent), fno: [...d.querySelectorAll('.rp-f .rp-no')].map(e => e.textContent).join(), page: true, charts: d.querySelectorAll('.rp-chart').length, wide: [...d.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length, bars: d.querySelectorAll('.rp-chart rect').length }; });
  check(rp && rp.rev, 'the cover shows Rev. 01 and the revision table ' + JSON.stringify(rp && rp.rev));
  check(rp && rp.no && /^Finding 1,Finding 2/.test(rp.fno), 'the report shows its number and numbers the findings ' + JSON.stringify(rp && { no: rp.no, fno: rp.fno }));
  /* Work → Inspections (2026-11-14): the inspection is a page of its own (#fdv=id, back closes it); the PDF is made on the device, with pages */
  const pg = await p.evaluate(() => ({ full: document.body.classList.contains('fdv-full'), hash: location.hash, tabs: [...document.querySelectorAll('[data-fdvtab]')].map(b => b.dataset.fdvtab).join(), inline: !!document.querySelector('.fdv-page .rp-doc.rp-inline') }));
  check(pg.full && pg.hash === '#fdv=ins1' && pg.tabs === 'findings,building,conclusion,report' && pg.inline, 'an inspection opens on a page of its own with Findings, Building, Conclusion and Report, the report shown in the page ' + JSON.stringify(pg));
  const pdf = await p.evaluate(async () => { try { const f = await FdvPdf.make(Features.list('fdv')[0]); const head = new TextDecoder().decode(new Uint8Array(await f.slice(0, 5).arrayBuffer())); return { head, pages: f._pages, size: f.size, name: f.name }; } catch (e) { return { err: String(e) }; } });
  check(pdf.head === '%PDF-' && pdf.pages >= 2 && pdf.size > 20000 && /Testveien 1\.pdf$/.test(pdf.name), 'Make PDF makes a real PDF on the device, cut into pages ' + JSON.stringify(pdf));
  await p.evaluate(() => history.back()); await sl(400);
  const bk = await p.evaluate(() => ({ full: document.body.classList.contains('fdv-full'), list: !!document.querySelector('[data-fdvopen="ins1"]') }));
  check(!bk.full && bk.list, 'Back (or the phone\'s back gesture) returns to the list of inspections ' + JSON.stringify(bk));
  check(rp && rp.h2.join('|') === 'Revisions|Contents|1 Assignment|2 Conclusion|3 Main report|4 Appendices' && rp.charts >= 1, 'the report follows NS 3424\'s order (a cover with contents, then assignment, conclusion, main report, appendices) and has its charts ' + JSON.stringify({ h2: rp && rp.h2, charts: rp && rp.charts }));
  check(rp && rp.wide === 0, 'on a 393 px phone nothing in the report runs past the right edge (' + (rp && rp.wide) + ')');
  check(rp && rp.secs.length === 1 && /^3\.1 23 Outer walls/.test(rp.secs[0]) && rp.grid === 0 && rp.kg && rp.level && rp.cost && rp.std && rp.prio >= 1, 'the report groups by NS 3451 code, leaves out the grade table when only one main group has findings (2026-11-14), has survey level, cost, priority and the KG legend ' + JSON.stringify(rp));
  await p.evaluate(() => { const c = document.querySelector('[data-rpclose]'); if (c) c.click(); });
  /* upgrade step 4 on made-up old data */
  const up = await p.evaluate(() => {
    const mem = { 'dash.tools': { fdv: [{ id: 'o1', findings: [{ id: 'a', part: 'Roof', tg: '2', text: 'x' }, { id: 'b', part: 'Våtrom', tg: '3', text: 'y' }, { id: 'c', part: 'Windows and doors', tg: '1', text: 'z' }, { id: 'd', part: '231 Own wall', tg: '1', text: 'w' }] }], fdvph: [{ id: 'p', part: 'Ventilation', text: 'Dirty' }], fdvparts: ['Garage', '264 Own roof part'] } };
    const io = { get: k => mem[k] ? JSON.parse(JSON.stringify(mem[k])) : null, set: (k, v) => { mem[k] = v; } };
    const r = Upgrades.run({ dv: 3 }, io), t = mem['dash.tools'], f = t.fdv[0].findings;
    return { r, f, ph: t.fdvph[0], parts: t.fdvparts, codes: t.fdvcodes };
  });
  check(up.r.indexOf(4) > -1 && up.f[0].code === '26' && up.f[0].part === '' && up.f[1].code === '' && up.f[1].part === 'Våtrom' && up.f[2].code === '23' && up.f[2].part === 'Windows and doors' && up.f[3].code === '231' && up.f[3].part === 'Own wall' && up.f[0].oldPart === 'Roof', 'step 4 moves old parts to NS 3451 codes and keeps the name as the place where there is no clear code ' + JSON.stringify(up.f));
  check(up.ph.code === '36' && !('part' in up.ph) && up.parts.join() === 'Garage' && (up.codes || []).some(c => c.c === '264'), 'and your phrases get codes; your own parts that start with a code become your own codes ' + JSON.stringify({ ph: up.ph, parts: up.parts, codes: up.codes }));
  check(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); done();
})();
