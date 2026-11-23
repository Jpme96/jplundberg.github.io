/* Me, more (2026-11-22, JP: "Do them all"): mood check-in, life wheel, wins & gratitude, hobbies, body upkeep, screen time,
   style – all off by default and on the Me page; Journal and Courses & certificates moved to Me; and Settings → Features
   folded into groups by page with a search (JP: "it's starting to get very long"). Made-up data only. */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  const NEW = ['mood', 'wheel', 'wins', 'hobbies', 'bodycare', 'screen', 'style'];
  await go(p, '', 2500);
  const off = await p.evaluate(ids => ids.map(i => { const f = Features.LIST.find(x => x.id === i); return !!f && f.def === false && !Features.on(i) && f.group === 'Me'; }), NEW);
  check(off.every(Boolean), 'the seven new sections exist, are off and are listed under Me ' + JSON.stringify(off));
  /* Settings → Features: folded groups by page, counts, search */
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('st:page', { detail: 'features' }))); await sl(200);
  const fs = await p.evaluate(() => { const g = [...document.querySelectorAll('#ftList details.ft-grp')]; return { n: g.length, open: g.filter(d => d.open).length, names: g.map(d => d.dataset.ftg), cnt: (g[0] && g[0].querySelector('.ft-cnt') || {}).textContent }; });
  check(fs.n >= 9 && fs.open === 0 && fs.names.indexOf('Me') > -1 && fs.names.indexOf('Life admin') > -1 && /of \d+ on/.test(fs.cnt), 'Features: closed groups by page with a count ' + JSON.stringify(fs));
  const sr = await p.evaluate(async () => { const q = document.querySelector('#ftList [data-ftq]'); q.value = 'dentist'; q.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    const rows = [...document.querySelectorAll('#ftList [data-feat]')].map(x => x.dataset.feat), op = [...document.querySelectorAll('#ftList details[open]')].map(d => d.dataset.ftg);
    const q2 = document.querySelector('#ftList [data-ftq]'); q2.value = 'zzqq'; q2.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 100));
    const none = !!document.querySelector('#ftList .ft-none'); const q3 = document.querySelector('#ftList [data-ftq]'); q3.value = ''; q3.dispatchEvent(new Event('input', { bubbles: true }));
    return { rows, op, none, focus: document.activeElement === document.querySelector('#ftList [data-ftq]') }; });
  check(sr.rows.indexOf('bodycare') > -1 && sr.rows.length <= 3 && sr.op.indexOf('Me') > -1 && sr.none, 'Features: the search finds Body upkeep, opens its group, says when nothing matches ' + JSON.stringify(sr));
  /* turn them on (and Journal + Courses) */
  await p.evaluate(ids => ids.concat(['journal', 'learning', 'sleep']).forEach(i => Features.set(i, true)), NEW);
  await go(p, 'habits/', 2500);
  check(await p.evaluate(() => !document.querySelector('[data-tool="journal"]')), 'Journal is no longer on Health');
  await go(p, 'work/', 2500);
  check(await p.evaluate(() => !document.querySelector('[data-tool="learning"]')), 'Courses & certificates are no longer on Work');
  await go(p, 'me/?customize', 3500);
  const me = await p.evaluate(() => ({ cards: ['lp-mood', 'lp-wheel', 'lp-wins', 'lp-hobbies', 'lp-bodycare', 'lp-screen', 'lp-style', 'journal', 'learning'].filter(i => { const e = document.querySelector('[data-tool="' + i + '"]'); return e && !e.hidden && e.innerHTML.length > 40; }), tabs: [...document.querySelectorAll('[data-ptab-go]')].map(x => x.dataset.ptabGo) }));
  check(me.cards.length === 9 && ['mind', 'rest', 'care', 'free', 'career'].every(t => me.tabs.indexOf(t) > -1), 'Me: all nine cards are drawn, in the tabs Mind · Rest · Care · Free time · Career ' + JSON.stringify(me));
  /* mood → the journal's mood for today, one entry */
  await p.evaluate(() => document.querySelector('[data-lpact="mood"][data-lpid="4"]').click()); await sl(200);
  await p.evaluate(() => document.querySelector('[data-lpact="mood"][data-lpid="5"]').click()); await sl(300);
  const md = await p.evaluate(() => { const pad = n => String(n).padStart(2, '0'), d = new Date(), k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); const l = Features.list('journal').filter(j => j.date === k); return { n: l.length, m: l[0] && l[0].mood, row: (document.querySelector('[data-tool="journal"]') || {}).textContent }; });
  check(md.n === 1 && md.m === '5' && /Great/.test(md.row), 'Mood: a tap sets today’s journal mood, a second tap changes it – one entry, shown in the Journal ' + JSON.stringify({ n: md.n, m: md.m }));
  /* life wheel */
  await p.evaluate(() => document.querySelector('[data-lpact="wheelform"]').click()); await sl(200);
  await p.evaluate(() => { const r = document.querySelector('[data-lpwheel="fun"]'); r.value = '3'; r.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-lpact="wheelsave"]').click(); }); await sl(300);
  const wh = await p.evaluate(() => ({ w: Features.list('wheel'), svg: !!document.querySelector('#lp-wheel svg polygon'), low: document.querySelector('#lp-wheel').textContent }));
  check(wh.w.length === 1 && wh.w[0].s.fun === 3 && wh.w[0].s.health === 5 && wh.svg && /Lowest now: Fun \(3\)/.test(wh.low), 'Life wheel: scores saved, drawn, lowest named');
  /* body upkeep: the usual list, a tick counts the next one from today */
  await p.evaluate(() => document.querySelector('[data-lpact="bodyseed"]').click()); await sl(300);
  const bd = await p.evaluate(async () => { const l = Features.list('bodycare'), h = l.find(x => /Haircut/.test(x.title)); document.querySelector('[data-lpact="bodydone"][data-lpid="' + h.id + '"]').click(); await new Promise(r => setTimeout(r, 300));
    const h2 = Features.list('bodycare').find(x => x.id === h.id); return { n: l.length, due: LifePlus.bodyDue(h2), last: h2.last, w: LifePlus.bodyDue({ last: '2026-01-01', every: 6, unit: 'w' }), m: LifePlus.bodyDue({ last: '2026-01-31', every: 1, unit: 'm' }) }; });
  check(bd.n >= 6 && LP_days(bd.last, bd.due) === 42 && bd.w === '2026-02-12' && bd.m === '2026-02-28', 'Body upkeep: the usual list, a haircut ticked is due again in 6 weeks ' + JSON.stringify(bd));
  /* hobbies: +30 min */
  await p.evaluate(() => { const t = Features.tools(); t.hobbies = [{ id: 'hob-made-up-1', title: 'Made-up guitar', kind: 'practice', status: 'paused', hrs: 2 }]; Features.saveTools(t); }); await sl(400);
  await p.evaluate(() => document.querySelector('[data-lpact="hob30"][data-lpid="hob-made-up-1"]').click()); await sl(300);
  check(await p.evaluate(() => { const h = Features.list('hobbies')[0]; return h.hrs === 2.5 && h.status === 'active' && !!h.last; }), 'Hobbies: +30 min adds half an hour and wakes a paused one');
  /* screen time */
  await p.evaluate(() => document.querySelector('[data-lpact="screentick"]').click()); await sl(300);
  check(await p.evaluate(() => (Features.tools().screen || {}).days.length === 1 && /1 of 3 this week/.test(document.querySelector('#lp-screen').textContent)), 'Screen time: tonight ticked, 1 of 3 this week');
  /* style + wins */
  const st = await p.evaluate(() => ({ bf26: LifePlusMe.blackFriday(2026).getDate(), bf27: LifePlusMe.blackFriday(2027).getDate() }));
  check(st.bf26 === 27 && st.bf27 === 26, 'Style: Black Friday is worked out (27 Nov 2026, 26 Nov 2027) ' + JSON.stringify(st));
  await p.evaluate(() => { const t = Features.tools(); t.wins = [{ id: 'w-made-up-1', title: 'Made-up win', kind: 'win', date: (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()) }]; t.style = [{ id: 's-made-up-1', kind: 'size', title: 'Shoes', val: '44' }]; Features.saveTools(t); }); await sl(500);
  check(await p.evaluate(() => /Made-up win/.test(document.querySelector('[data-tool="lp-wins"]').textContent) && /44/.test(document.querySelector('[data-tool="lp-style"]').textContent)), 'Wins and Style draw their rows');
  /* At a glance and search point at Me */
  await go(p, '', 2500);
  /* an overdue made-up item, so a Me line is due whatever the date (2026-11-23: it depended on Black Friday being near) */
  await p.evaluate(() => { const t = Features.tools(), d = new Date(Date.now() - 50 * 864e5); t.bodycare = (t.bodycare || []).concat([{ id: 'bc-made-up-trim', title: 'Made-up trim', every: 6, unit: 'w', last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }]); Features.saveTools(t); });
  /* ask the sections themselves – At a glance keeps only the top few, and which those are depends on the day (2026-11-23) */
  const br = await p.evaluate(() => { const out = [], d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    (window.BriefExtra || []).forEach(fn => { try { fn((pri, ic, col, title, sub, href) => out.push({ title, href }), d, t); } catch (e) {} });
    return out.filter(x => /\/me\//.test(x.href || '')).map(x => x.title).join(' | '); });
  check(/Made-up trim/.test(br), 'At a glance: Me lines link to the Me page (' + br.slice(0, 120) + ')');
  check(!p.errs.length, 'no script errors ' + p.errs.slice(0, 2).join(' | '));
  await b.close(); done();
})();
function LP_days(a, b) { return Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5); }
