/* Life sections (JP 2026-11-21): seventeen sections, each off until switched on, each a card on its page; the starting
   lists fill in; ticks and seeds save; At a glance picks up what is due; the sleep reminder is planned; the breathing
   minute opens and closes; nothing is shown while a section is off. Made-up data only. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
const IDS = ['ready', 'hood', 'ladmin', 'deals', 'climate', 'parties', 'moments', 'family', 'pets', 'clubs', 'sleep', 'calm', 'media', 'later', 'digital', 'career', 'outdoor'];
const PAGE = { ready: 'house', hood: 'house', ladmin: 'finance', deals: 'finance', climate: 'finance', parties: 'people', moments: 'people', family: 'people', pets: 'people', clubs: 'people', sleep: 'habits', calm: 'habits', media: 'habits', later: 'habits', digital: 'habits', career: 'work', outdoor: 'travel' };
(async () => {
  const { b, p } = await open(1280);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const off = await p.evaluate(ids => ids.filter(i => Features.on(i)), IDS);
  check(off.length === 0, 'all seventeen are off to start with ' + off.join());
  const feats = await p.evaluate(ids => ids.every(i => Features.LIST.some(x => x.id === i && x.def === false)), IDS);
  check(feats, 'each is a switch in Settings → Features');
  await p.evaluate(ids => { ['house', 'people', 'finance', 'habits', 'work', 'travel', 'journal'].concat(ids).forEach(i => { try { Features.set(i, true); } catch (e) {} });
    const t = Features.tools(), d0 = new Date(), k = n => { const d = new Date(d0); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    t.deals = [{ id: 'dl1', who: 'Made-up Power AS', kind: 'power', price: 600, last: k(-400), every: 12 }];
    t.pets = [{ id: 'pt1', name: 'Made-up Cat', kind: 'cat', worm: k(-95), wormEvery: 3 }];
    t.parties = [{ id: 'pa1', title: 'Made-up party', date: k(5), todo: '[x] Invite\nBuy cake' }];
    t.outdoor = [{ id: 'ou1', title: 'Made-up hike', date: k(1), done: false }, { id: 'ou2', title: 'Made-up ski', date: k(-10), km: 12, done: true }];
    Features.saveTools(t); }, IDS);
  await sl(800);
  for (const pg of ['house', 'finance', 'people', 'habits', 'work', 'travel']) {
    await go(p, pg + '/', 3000);
    const ids = IDS.filter(i => PAGE[i] === pg);
    const shown = await p.evaluate(ids => ids.map(i => { const el = document.querySelector('[data-tool="lp-' + i + '"]'); return [i, !!el && !el.hidden && el.innerHTML.length > 50]; }), ids);
    check(shown.every(x => x[1]), pg + ': the cards are drawn ' + JSON.stringify(shown));
  }
  /* starting lists */
  await go(p, 'house/', 3000);
  await p.evaluate(() => { const n = document.querySelector('[data-lpready-n]'); n.value = '3'; document.querySelector('[data-lpact="readyseed"]').click(); }); await sl(500);
  const rd = await p.evaluate(() => { const l = Features.list('ready'); return { n: l.length, water: (l.find(x => /water|vann/i.test(x.name)) || {}).qty }; });
  check(rd.n >= 12 && rd.water === '60 l', 'Emergency preparedness: the recommended list, water for three people ' + JSON.stringify(rd));
  await p.evaluate(() => { const id = Features.list('ready')[0].id; document.querySelector('[data-lpact="readyhave"][data-lpid="' + id + '"]').click(); }); await sl(300);
  check(await p.evaluate(() => Features.list('ready')[0].have === true), 'a tick marks it as had');
  await go(p, 'finance/', 3000);
  await p.evaluate(() => document.querySelector('[data-lpact="ladminseed"]').click()); await sl(400);
  check(await p.evaluate(() => Features.list('ladmin').some(x => x.md === '04-30')), 'Life admin: the usual Norwegian ones, the tax return by 30 April');
  await go(p, 'people/', 3000);
  await p.evaluate(() => { const d = document.querySelector('[data-lpfam-d]'); d.value = '2027-06-10'; document.querySelector('[data-lpact="famseed"]').click(); }); await sl(400);
  const fam = await p.evaluate(() => Features.list('family').map(x => x.date));
  check(fam.length >= 6 && fam.indexOf('2028-03-01') > -1 && fam.indexOf('2027-05-20') > -1, 'Family planning: steps from the due date (leave 3 weeks before, kindergarten by 1 March the year after) ' + JSON.stringify(fam));
  /* a life moment puts its steps in the to-do list */
  const mo = await p.evaluate(async () => { document.querySelector('[data-tool="lp-moments"] [data-kit-add]').click(); await new Promise(r => setTimeout(r, 300));
    const f = document.querySelector('.kit-sheet'); f.querySelector('#kf-kind').value = 'moving'; const dt = new Date(); dt.setDate(dt.getDate() + 40); f.querySelector('#kf-date').value = dt.toISOString().slice(0, 10); f.requestSubmit(); await new Promise(r => setTimeout(r, 600));
    const T = JSON.parse(localStorage.getItem('dash.todos') || '[]'); return T.filter(t => /^lp:/.test(t.list || '')).length; });
  check(mo >= 6, 'Big life moments: moving adds its steps to the to-dos with dates (' + mo + ')');
  /* At a glance */
  await go(p, '', 3000);
  const br = await p.evaluate(() => (window.BriefItems || []).map(x => x.title).join(' | '));
  check(/compare: Made-up Power AS/.test(br) && /Made-up Cat/.test(br) && /Made-up party in 5 days/.test(br) && /Made-up hike in 1 days|Made-up hike/.test(br), 'At a glance: a deal to compare, the cat’s worming, the party, the hike ' + br.slice(0, 400));
  /* the wind-down push */
  const pu = await p.evaluate(() => Notify.plan({ from: Date.now(), to: Date.now() + 3 * 864e5, full: true }).filter(x => /^sleep:/.test(x.id)).length);
  check(pu >= 2, 'Sleep coach: a wind-down push each evening (' + pu + ')');
  /* breathing */
  await go(p, 'habits/', 3000);
  await p.evaluate(() => { if (window.PageTabs) PageTabs.show('care'); document.querySelector('[data-lpact="breathe"]').click(); }); await sl(600);
  const br2 = await p.evaluate(() => { const o = document.querySelector('.lp-breath'); const t = o && o.querySelector('.lp-btxt').textContent; if (o) o.querySelector('[data-lpbx]').click(); return { t, gone: !document.querySelector('.lp-breath') }; });
  check(/Breathe in|Hold/.test(br2.t) && br2.gone, 'Mind and rest: the breathing minute opens and closes ' + JSON.stringify(br2));
  /* instant page changes: the cards come back on each page and a tick still flips once (no doubled listeners) */
  const nav = async path => { const n0 = await p.evaluate(() => SoftNav.count); await p.evaluate(h => { const a = document.createElement('a'); a.href = h; document.body.appendChild(a); a.click(); a.remove(); }, '/cmd/' + path); await until(p, n => SoftNav.count > n, 15000, n0); await sl(1200); };
  await nav('house/'); await nav('people/'); await nav('house/');
  const sn = await p.evaluate(async () => { const id = Features.list('ready')[1].id, before = Features.list('ready')[1].have; const b = document.querySelector('[data-lpact="readyhave"][data-lpid="' + id + '"]'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 300)); return { before, after: Features.list('ready')[1].have }; });
  check(sn && sn.after === !sn.before, 'after instant page changes the card is there and a tick flips once ' + JSON.stringify(sn));
  /* off again: nothing shown */
  await p.evaluate(() => Features.set('hood', false)); await sl(400);
  check(await p.evaluate(() => { const el = document.querySelector('[data-tool="lp-hood"]'); return el.hidden && !el.innerHTML; }), 'switched off: the card goes away');
  check(!errs.length, 'no script errors ' + errs.join(' | '));
  await b.close(); done();
})();
