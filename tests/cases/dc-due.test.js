/* Document control: a deadline and a responsible per line (JP 2026-11-15). Set in the open line, saved on the line,
   shown in the row ("Deadline 3 Nov · Made-up Plumbing"), red as "Overdue" once the deadline has passed and the line
   isn't approved; approved it's a plain deadline again; the report's "Missing documents" table gets the two columns.
   Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  await p.evaluate(() => { localStorage.setItem('dash.dcFlow', '0');   /* these test the old project view */ ['work', 'fdv'].forEach(f => { try { Features.set(f, true); } catch (e) {} });
    const t = Features.tools(); t.dctl = [{ id: 'dcp1', name: 'Made-up school', no: 'P-1', made: '2026-11-01', lines: [{ id: 'l1', code: '320', t: 'A', st: 'missing' }, { id: 'l2', code: '360', t: 'D', st: 'missing' }], files: [] }]; Features.saveTools(t); });
  await go(p, 'work/#dc=dcp1', 3500);
  const toDocs = () => p.evaluate(() => { const t = document.querySelector('[data-dctab="docs"]'); if (t) t.click(); }).then(() => sl(500));
  await toDocs();
  const opened = await p.evaluate(() => { const b = document.querySelector('[data-dcline="l1"]'); if (b) b.click(); return !!b; }); await sl(600);
  check(opened && await p.evaluate(() => !!document.querySelector('[data-dcdue="l1"]') && !!document.querySelector('[data-dcwho="l1"]')), 'an open line has Deadline and Responsible');
  /* a deadline in the past, and who */
  await p.evaluate(() => { const set = (q, v) => { const i = document.querySelector(q); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }; set('[data-dcdue="l1"]', '2026-01-05'); set('[data-dcwho="l1"]', 'Made-up Plumbing'); });
  await sl(900);
  const saved = await p.evaluate(() => { const l = Features.list('dctl')[0].lines[0]; return { due: l.due, who: l.who }; });
  check(saved.due === '2026-01-05' && saved.who === 'Made-up Plumbing', 'saved on the line ' + JSON.stringify(saved));
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await sl(500);
  const row = await p.evaluate(() => { const r = document.querySelector('[data-dcline="l1"] .dc-dwl'); return r ? { t: r.textContent, late: !!r.querySelector('.dc-late') } : null; });
  check(row && /Overdue/.test(row.t) && /Made-up Plumbing/.test(row.t) && row.late, 'the row says Overdue in red, with who ' + JSON.stringify(row));
  /* approved: a plain deadline */
  await p.evaluate(() => { const t = Features.tools(); t.dctl[0].lines[0].st = 'ok'; Features.saveTools(t); window.dispatchEvent(new Event('vault:in')); });
  await go(p, 'work/#dc=dcp1', 3000); await toDocs();
  const row2 = await p.evaluate(() => { const r = document.querySelector('[data-dcline="l1"] .dc-dwl'); return r ? { t: r.textContent, late: !!r.querySelector('.dc-late') } : null; });
  check(row2 && /Deadline/.test(row2.t) && !row2.late, 'approved: a plain deadline, not red ' + JSON.stringify(row2));
  const txt = await p.evaluate(() => document.body.innerText);
  check(!/\bundefined\b|\bNaN\b|\bnull\b/.test(txt), 'no undefined/NaN/null');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
