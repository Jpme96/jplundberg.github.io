/* The lock screen has no card behind it in any card look. In Glass the lock box got the cards' background and the thin
   light line along their top edge – with no padding, so the line ran right at the top of the shield icon (2026-11-10).
   Phone width. Made-up data only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  for (const st of ['glass', 'solid', 'soft', 'minimal']) {
    await p.evaluate(st => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.cardStyle = st; s.glass = st === 'glass'; localStorage.setItem('dash.settings', JSON.stringify(s)); window.dispatchEvent(new Event('dash:local')); }, st);
    await sl(800); await p.evaluate(() => Vault.lock()); await sl(1200);
    const r = await p.evaluate(() => { const bx = document.getElementById('lockBox'), cs = getComputedStyle(bx), ic = document.querySelector('#lockBox .lock-icon');
      return { on: !!(bx.offsetParent && ic && ic.offsetParent),
        bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderTopWidth + ' ' + cs.borderTopStyle }; });
    const clear = /rgba\(0, 0, 0, 0\)|transparent/.test(r.bg) && r.shadow === 'none' && !/solid/.test(r.border);
    check(r.on && clear, st + ': no card or top line behind the lock screen ' + JSON.stringify(r));
    await p.type('#lockPass', 'test-passcode-1'); await p.click('#lockSubmit'); await sl(2000);
  }
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
