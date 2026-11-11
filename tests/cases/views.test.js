/* The avatar from every side (Phase L, round 1): every hair style and hat draws from behind, from the side and in
   three-quarter without errors or broken words and inside the picture; turning swaps the head for the right view
   (and mirrors it the other way), the back view hides the chest print, and turning back gives the front again.
   Made-up looks only. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const r = await p.evaluate(() => {
    const hairs = ['short', 'side', 'quiff', 'curly', 'buzz', 'fade', 'spiky', 'mohawk', 'afro', 'mullet', 'slick', 'undercut', 'waves', 'long', 'ponytail', 'bun', 'braids', 'pigtails', 'dreads', 'sideshave', 'bangs', 'bowl', 'topknot', 'cornrows', 'bald'];
    const hats = ['none', 'cap', 'beanie', 'bucket', 'beret', 'bandana', 'cowboy', 'phones', 'flowers', 'party', 'wizard', 'santa', 'witch', 'chef', 'crown'];
    const bad = [], out = [];
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;visibility:hidden'; document.body.appendChild(host);
    hairs.forEach((h, i) => {
      const L = Object.assign({}, Avatar.look(), { auto: 'off', hair: h, hat: hats[i % hats.length], beard: i % 3 ? 'none' : 'full', glasses: i % 4 ? 'none' : 'round' });
      ['back', 'side', 'qback'].forEach(v => {
        let s; try { s = Avatar.headView(L, v, '<path d="M81 56h40z"/>'); } catch (e) { bad.push(h + ' ' + v + ': ' + e.message); return; }
        if (/undefined|NaN|null|\[object/.test(s)) bad.push(h + ' ' + v + ': word');
        if (v !== 'qback') { host.innerHTML = '<svg viewBox="0 0 200 200"><g>' + s + '</g></svg>'; const bb = host.querySelector('g').getBBox(); if (bb.x < 30 || bb.y < -5 || bb.x + bb.width > 170 || bb.y + bb.height > 120) out.push(h + ' ' + v + ' ' + [bb.x, bb.y, bb.width, bb.height].map(Math.round).join(',')); }
      });
    });
    /* turning a real figure */
    const L = Object.assign({}, Avatar.look(), { auto: 'off', hair: 'ponytail', hat: 'cap', chest: 'JP' });
    host.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, L);
    const rig = Rig(host.querySelector('svg'), L), seen = [];
    Rig.turn(rig, .55); seen.push(Rig.view(rig));
    Rig.turn(rig, 1); seen.push(Rig.view(rig));
    Rig.turn(rig, -1); seen.push(Rig.view(rig));
    Rig.turn(rig, .001); Rig.back(rig, true, L); seen.push(Rig.view(rig));
    const chestHidden = [...host.querySelectorAll('.av-chest')].every(e => e.style.display === 'none');
    const backHasTail = !!host.querySelector('.bob .av-swing');
    Rig.back(rig, false, L); Rig.turn(rig, 0); seen.push(Rig.view(rig));
    const frontAgain = !!host.querySelector('.bob .av-faceshape');
    host.remove();
    return { bad: bad.slice(0, 4), out: out.slice(0, 4), seen, chestHidden, backHasTail, frontAgain };
  });
  check(!r.bad.length, 'every hair style and hat draws from behind, the side and three-quarter ' + JSON.stringify(r.bad));
  check(!r.out.length, 'and stays on the head ' + JSON.stringify(r.out));
  check(r.seen.join(',') === 'q>,side>,side<,back,front', 'turning swaps the head: ' + r.seen.join(', '));
  check(r.chestHidden && r.backHasTail, 'from behind: no chest print, the ponytail hangs down the back');
  check(r.frontAgain, 'turning back to us gives the front face again');
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
