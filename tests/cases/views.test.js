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
    /* round 2: the back of the top – a jersey shows its number, a bag becomes a backpack; a hoodie's hood shows from the side */
    const J = Object.assign({}, Avatar.look(), { auto: 'off', top: 'jersey', num: '23', bag: 'yes', neck: 'lanyard' });
    host.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, J);
    const rj = Rig(host.querySelector('svg'), J), bd = () => host.querySelector('.av-backd');
    const hiddenFront = bd() && bd().style.display === 'none';
    Rig.back(rj, true, J); const backShown = bd().style.display !== 'none' && /23/.test(bd().textContent) && !!bd().querySelector('rect');
    Rig.back(rj, false, J); const backGone = bd().style.display === 'none';
    const dangle = !!host.querySelector('.av-chest .av-dangle');
    const Hd = Object.assign({}, Avatar.look(), { auto: 'off', top: 'hoodie' });
    host.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, Hd);
    const rh = Rig(host.querySelector('svg'), Hd); Rig.turn(rh, 1); const hood = host.querySelector('.av-hoodb'), hoodSide = !!hood && hood.style.display !== 'none';
    const chestMoved = /translate/.test(host.querySelector('.av-chest').getAttribute('transform') || '');
    Rig.turn(rh, 0); const hoodFront = hood.style.display === 'none';
    const dress = Object.assign({}, Avatar.look(), { auto: 'off', top: 'dress' }); host.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, dress); const hem = !!host.querySelector('.av-hem');
    /* round 3: three-quarter hides the far earring; from the side each kind of glasses keeps its frame; held things get fingers */
    const E3 = Object.assign({}, Avatar.look(), { auto: 'off', ears: 'hoops', glasses: 'aviator', pierce: 'nose' });
    host.innerHTML = Avatar.figure({ k: 'plain', plain: true, bg: 'none' }, E3);
    const r3 = Rig(host.querySelector('svg'), E3); Rig.turn(r3, .55);
    const hoops = [...host.querySelectorAll('.bob .av-buds circle')], oneHoop = hoops.length === 2 && hoops.filter(e => e.style.display === 'none').length === 1 && +hoops.find(e => e.style.display === 'none').getAttribute('cx') > 101;
    const sideG = Avatar.headView(E3, 'side', ''), aviSide = /#c9a227/.test(sideG) && /#c9ccd6/.test(sideG);
    let grip = false; try { const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 200 120'); sv.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:120px'; document.body.appendChild(sv);
      const H = Live.Hero(sv, null, { x: 60, y: 10, w: 60, h: 100 }); const o = Live.Obj(H, 'R', '<rect width="6" height="8"/>', [3, 4]); grip = !!(o.fg && o.g.contains(o.fg)); sv.remove(); } catch (e) { grip = 'err ' + e.message; }
    host.remove();
    return { r3: { oneHoop, aviSide, grip }, r2: { hiddenFront, backShown, backGone, dangle, hoodSide, chestMoved, hoodFront, hem }, bad: bad.slice(0, 4), out: out.slice(0, 4), seen, chestHidden, backHasTail, frontAgain };
  });
  check(!r.bad.length, 'every hair style and hat draws from behind, the side and three-quarter ' + JSON.stringify(r.bad));
  check(!r.out.length, 'and stays on the head ' + JSON.stringify(r.out));
  check(r.seen.join(',') === 'q>,side>,side<,back,front', 'turning swaps the head: ' + r.seen.join(', '));
  check(r.chestHidden && r.backHasTail, 'from behind: no chest print, the ponytail hangs down the back');
  check(r.frontAgain, 'turning back to us gives the front face again');
  check(r.r2.hiddenFront && r.r2.backShown && r.r2.backGone, 'from behind: the jersey number and the backpack show, and go again when it turns back ' + JSON.stringify(r.r2));
  check(r.r2.hoodSide && r.r2.hoodFront && r.r2.chestMoved, 'from the side: the hood shows past the neck and the chest print moves to the front');
  check(r.r2.dangle && r.r2.hem, 'the lanyard can swing and the dress hem can sway');
  check(r.r3.oneHoop, 'three-quarter: only the near earring shows');
  check(r.r3.aviSide, 'from the side: aviators keep their gold frame, the nose ring shows');
  check(r.r3.grip === true, 'a held thing gets fingers around it ' + r.r3.grip);
  check(!p.errs.length, 'no page errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
