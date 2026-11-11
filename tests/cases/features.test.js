/* One switchboard for features (Phase D): every feature in Features.LIST has a name, a description and a default,
   and turning each one off and on again breaks nothing – on Home, one at a time, and every page with everything on
   and with everything off. No "undefined"/"NaN" on screen. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
const PAGES = ['', 'calendar/', 'travel/', 'finance/', 'habits/', 'work/', 'house/', 'people/', 'food/', 'wish/', 'goals/', 'papers/'];
(async () => {
  const { b, p } = await open(393);
  await go(p, '', 2500);
  const meta = await p.evaluate(() => Features.LIST.map(f => [f.id, !!f.name, !!f.desc, typeof f.def === 'boolean']));
  const bad = meta.filter(x => !(x[1] && x[2] && x[3])).map(x => x[0]);
  check(meta.length > 20 && !bad.length, meta.length + ' features, each with a name, a description and a default ' + JSON.stringify(bad));
  /* one at a time on Home: off, then back as it was */
  const flips = await p.evaluate(async () => { const errs = []; const was = {}; Features.LIST.forEach(f => { was[f.id] = Features.on(f.id); });
    for (const f of Features.LIST) { try { Features.set(f.id, !was[f.id]); await new Promise(r => setTimeout(r, 60)); Features.set(f.id, was[f.id]); await new Promise(r => setTimeout(r, 30)); } catch (e) { errs.push(f.id + ': ' + e.message); } }
    return errs; });
  check(!flips.length && !p.errs.length, 'each feature turns off and on again on Home without errors ' + JSON.stringify(flips.concat(p.errs)).slice(0, 300));
  for (const all of [true, false]) {
    await p.evaluate(all => Features.LIST.forEach(f => { try { Features.set(f.id, all); } catch (e) {} }), all);
    const out = [];
    for (const pg of PAGES) {
      p.errs.length = 0; await go(p, pg, 1800);
      const words = await p.evaluate(() => /\b(undefined|NaN)\b/.test(document.body.innerText));
      if (p.errs.length || words) out.push(pg + (words ? ' (words)' : '') + ' ' + p.errs.join(' | ').slice(0, 120));
    }
    check(!out.length, (all ? 'everything on' : 'everything off') + ': every page loads cleanly ' + JSON.stringify(out));
  }
  await p.evaluate(() => Features.LIST.forEach(f => { try { Features.set(f.id, f.def); } catch (e) {} }));
  await done(b);
})();
