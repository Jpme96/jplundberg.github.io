/* Weather outfits in 2.5D (F3): your own avatar dresses for today by itself – a beanie, scarf and padded jacket in snow,
   an umbrella in the hand when it rains, a T-shirt when it's warm – and the people in People never change. Made-up weather. */
const { open, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const r = await p.evaluate(() => {
    const set = (code, t) => localStorage.setItem('dash.wxNow', JSON.stringify({ at: Date.now(), code, t }));
    const base = Object.assign({}, Avatar.look(), { hat: 'none', top: 'sweater', glasses: 'none' });
    set(73, -4); const snow = Avatar.dressed(base);
    set(61, 8); const rain = Avatar.dressed(base), rainSvg = Avatar.figure(Avatar.MOMENTS.day);
    set(1, 26); const warm = Avatar.dressed(base);
    const person = Avatar.personLook({ id: 'p1', name: 'Test' });
    return { snow, rain, warm, umbrella: /data-f25/.test(rainSvg), person };
  });
  check(r.snow.hat === 'beanie' && r.snow.wxScarf && r.snow.top === 'puffer', 'snow: a beanie, a scarf and a padded jacket ' + JSON.stringify([r.snow.hat, r.snow.wxScarf, r.snow.top]));
  check(r.rain.wxHold === 'umbrella' && r.umbrella, 'rain: the umbrella in the hand (2.5D)');
  check(r.warm.top === 'tee' && !r.warm.wxHold, 'warm: a T-shirt, nothing in the hand');
  check(!r.person.wxHold && r.person.hat !== 'beanie', 'the people in People are not dressed by your weather');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
