/* not a real test: contact sheets for the new scenes (deleted after) */
const { open, sl, go } = require('../lib/browser'); const { check, done } = require('../lib/check');
const fs = require('fs');
const SHEETS = JSON.parse(fs.readFileSync('/home/claude/preview/plan.json', 'utf8'));
(async () => {
  const { b, p } = await open(1400);
  await go(p, 'wish/', 3500);
  for (const f of ['homelife', 'lifeadmin', 'me']) await p.evaluate(fs.readFileSync('/home/claude/site/cmd/scene-' + f + '.js', 'utf8'));
  for (const sc of SHEETS) {
    await p.evaluate((aid) => { const s = JSON.parse(localStorage.getItem('dash.settings') || '{}'); s.avatar = Object.assign({}, s.avatar || {}, { aid: aid || '' }); if (!aid) delete s.avatar.aid; localStorage.setItem('dash.settings', JSON.stringify(s)); const d = Vault.get(); if (d) { d.settings = s; } }, sc.aid || '');
    await p.evaluate((sc) => {
      document.querySelectorAll('.pv-wrap').forEach(x => x.remove());
      const w = document.createElement('div'); w.className = 'pv-wrap'; w.style.cssText = 'position:absolute;left:0;top:0;width:' + (sc.cols * 330) + 'px;z-index:99999;background:#14181e;padding:14px;display:grid;grid-template-columns:repeat(' + sc.cols + ',1fr);gap:10px;align-content:start;font:600 13px system-ui;color:#cdd3d9';
      document.body.appendChild(w);
      sc.frames.forEach(fr => { const c = document.createElement('figure'); c.style.margin = 0; c.innerHTML = '<svg viewBox="0 0 400 240" style="width:100%;display:block;border-radius:12px;background:linear-gradient(#232a35,#1a1f27)"></svg><figcaption style="margin-top:4px">' + fr.cap + '</figcaption>'; w.appendChild(c);
        const api = window.SceneLive[sc.id](c.querySelector('svg'), sc.data || {}); if (fr.act) api.pact(fr.act, fr.t); else api.at(fr.t); api.stop(); });
    }, sc);
    await sl(500);
    const el = await p.$('.pv-wrap'); await el.screenshot({ path: '/home/claude/preview/' + sc.out + '.png' });
  }
  check(false, 'previews written'); await b.close(); done();
})();
