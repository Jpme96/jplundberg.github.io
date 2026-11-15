/* Phase G – the new look (2026-11-15): Settings → Appearance has no Strength, Density, Corners, Card style or Glass,
   and an old saved value of them changes nothing; the live line under a page's title (PageLive) shows the facts
   and puts the page's description away, and goes when emptied; the status tags have one colour each; Work's tabs
   have short names; the page title, live line and picture keep together on a computer. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1280);
  /* Settings → Appearance */
  const st = await p.evaluate(() => ({
    rows: ['stStrength', 'stCardStyle', 'stGlassStr', 'stStrengthRow', 'stGlassRow'].filter(id => document.getElementById(id)).concat(
      ['[data-density]', '[data-corners]', '[data-cardstyle]'].filter(q => document.querySelector(q))),
    accent: !!document.getElementById('stAccents'), theme: !!document.querySelector('[data-theme-opt]'), size: !!document.querySelector('[data-textsize]')
  }));
  check(!st.rows.length && st.accent && st.theme && st.size, 'Appearance keeps theme, accent colour and text size, and has no Strength/Density/Corners/Card style/Glass ' + JSON.stringify(st));
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); Object.assign(s, { density: 'compact', corners: 'sharp', cardStyle: 'glass', glass: true }); localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); });
  await go(p, 'work/', 3000);
  const cls = await p.evaluate(() => ['dens-compact', 'corners-sharp', 'glass', 'card-soft', 'card-minimal', 'card-solid'].filter(c => document.documentElement.classList.contains(c)));
  check(!cls.length, 'an old saved card look or density adds no class to the page ' + JSON.stringify(cls));
  /* the live line */
  const live = await p.evaluate(async () => {
    PageLive.set([{ t: 'Flex −1 h 30 min', c: 'neg' }, 'Next meeting 13:00', { t: '2 documents waiting', href: '#wkDocCtl' }]);
    await new Promise(r => setTimeout(r, 100));
    const h = document.querySelector('.fp-hero'), l = h.querySelector('.fp-live'), d = h.querySelector('p.muted:not(.fp-live)');
    const r1 = { text: l && l.textContent, neg: !!(l && l.querySelector('.neg')), link: !!(l && l.querySelector('a[href="#wkDocCtl"]')), descHidden: !!(d && getComputedStyle(d).display === 'none'), afterTitle: !!(l && l.previousElementSibling && l.previousElementSibling.tagName === 'H1') };
    PageLive.set([]);
    const r2 = { has: h.classList.contains('has-live'), shown: !!(l && l.offsetParent), descBack: !!(d && getComputedStyle(d).display !== 'none') };
    PageLive.set(['<b>x</b>']);
    const r3 = h.querySelector('.fp-live').innerHTML;
    PageLive.set([]);
    return { r1, r2, r3 };
  });
  check(live.r1.text === 'Flex −1 h 30 min·Next meeting 13:00·2 documents waiting'.replace(/·/g, '') && live.r1.neg && live.r1.link && live.r1.descHidden && live.r1.afterTitle, 'the live line shows the facts right under the title, and the description steps back ' + JSON.stringify(live.r1));
  check(!live.r2.has && !live.r2.shown && live.r2.descBack, 'an empty list takes it away and the description comes back ' + JSON.stringify(live.r2));
  check(!/<b>/.test(live.r3), 'text in the live line is never read as HTML ' + live.r3);
  /* status tags: six kinds, six colours, readable */
  const tags = await p.evaluate(() => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const out = ['ok', 'soon', 'cmt', 'bad', 'plan', 'na'].map(k => { const s = document.createElement('span'); s.className = 'stt stt-' + k; s.textContent = k; host.appendChild(s); const cs = getComputedStyle(s); return [k, cs.color, cs.backgroundColor, cs.borderRadius]; });
    host.remove(); return out;
  });
  check(new Set(tags.map(t => t[1])).size === 6 && new Set(tags.map(t => t[2])).size === 6 && tags.every(t => parseFloat(t[3]) > 50), 'each status tag has its own colour and a pill shape ' + JSON.stringify(tags));
  /* Work's tabs */
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.pt-tabs button span')].map(s => s.textContent));
  check(tabs.every(t => t.length <= 14), 'Work\'s tabs have short names ' + JSON.stringify(tabs));
  /* the title block keeps together beside the picture */
  const gap = await p.evaluate(() => { const h = document.querySelector('.fp-hero'), t = h.querySelector('h1'), k = h.querySelector('.fp-kicker'), d = h.querySelector('p.muted'); if (!t || !k || !d) return null; return { k2t: t.getBoundingClientRect().top - k.getBoundingClientRect().bottom, t2d: d.getBoundingClientRect().top - t.getBoundingClientRect().bottom, kAbove: k.getBoundingClientRect().top < t.getBoundingClientRect().top }; });
  check(gap && gap.kAbove && gap.k2t < 24 && gap.t2d < 24, 'the kicker, title and line under it stay together ' + JSON.stringify(gap));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
