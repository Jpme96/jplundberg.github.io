/* JP's list (16 Nov), the quick ones (17 Nov 22:42): the pantry guesses the shelf from the name in both languages,
   and the texts that were added have their Norwegian words. Made-up items only. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', 'home-life.js'), 'utf8');
  const A = eval(src.match(/var AISLES = (\[[\s\S]*?\n  \]);/)[1]);
  const of = t => { t = ' ' + t.toLowerCase() + ' '; for (const a of A.slice(0, -1)) if (a[4].test(t)) return a[0]; return 'other'; };
  const got = ['Pære', 'Peaches', 'Guarana', 'Plommer', 'Kiwi', 'Iste'].map(x => x + ':' + of(x));
  check(got.join(' ') === 'Pære:veg Peaches:veg Guarana:drink Plommer:veg Kiwi:veg Iste:drink', 'the pantry guesses the shelf for fruit and drinks ' + got.join(' '));
  const w = fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', 'words', 'ui.nb.js'), 'utf8');
  for (const k of ['ui.hm-moving-in', 'ui.cl-n-hidden', 'ui.hl-nothing-yet', 'ui.tl-your-day', 'ui.dx-part-krav']) check(w.includes('"' + k + '"'), k + ' has its Norwegian words');
  const hab = fs.readFileSync(path.join(__dirname, '..', '..', 'cmd', 'habits', 'habits.js'), 'utf8');
  check(/pointer: coarse/.test(hab) && /weekPop/.test(hab), 'on a phone a tap on the small squares opens the week with big days');
  await done();
})();
