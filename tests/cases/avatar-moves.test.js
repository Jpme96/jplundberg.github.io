/* The 2.5D avatar's small moves (F1b follow-up): tapping your Home avatar, cheers and the idle look/stretch redraw the
   2.5D figure with a changing pose, then put it back as it was. Under reduced motion nothing moves. Made-up look only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  await sl(600);
  const r = await p.evaluate(async () => {
    const host = document.createElement('div'); host.className = 'av-fig'; document.body.appendChild(host);
    host.innerHTML = Avatar.figure(Avatar.MOMENTS.day, Avatar.look());
    const before = host.querySelector('g.av-all').outerHTML, out = {};
    for (const k of ['wave', 'jump', 'spin', 'laugh', 'cheer', 'dance', 'look', 'stretch']) {
      const ok = Avatar.act25(host, k, 400); await new Promise(r => setTimeout(r, 180));
      const mid = host.querySelector('g.av-all').outerHTML; await new Promise(r => setTimeout(r, 400));
      out[k] = { ok, moved: mid !== before, back: host.querySelector('g.av-all').outerHTML === before, bad: /NaN|undefined/.test(mid) };
    }
    document.documentElement.classList.add('mo-off'); out.still = Avatar.act25(host, 'wave', 400); document.documentElement.classList.remove('mo-off');
    return out;
  });
  const ks = Object.keys(r).filter(k => k !== 'still');
  check(ks.every(k => r[k].ok && r[k].moved), 'every move redraws the 2.5D figure mid-way ' + JSON.stringify(r));
  check(ks.every(k => r[k].back), 'after the move the figure is back exactly as it was');
  check(ks.every(k => !r[k].bad), 'no "NaN" or "undefined" in any frame');
  check(r.still === false, 'with moves switched off nothing moves');
  check(!p.errs.length, 'no errors ' + p.errs.slice(0, 3).join(' | '));
  await done(b);
})();
