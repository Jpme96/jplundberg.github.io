/* Props in one style (2026-11-15): every colour in a scene file is one of cmd/scene-palette.json – the same greys,
   woods and three shades per hue everywhere; glow and flame only for light sources. Figure looks (skin:) don't count. */
const fs = require('fs'), path = require('path');
const { check, done } = require('../lib/check');
const CMD = path.join(__dirname, '../../cmd');
const PAL = Object.values(JSON.parse(fs.readFileSync(path.join(CMD, 'scene-palette.json'), 'utf8')).colours).map(c => c.toLowerCase());
check(PAL.length >= 40 && PAL.every(c => /^#[0-9a-f]{6}$/.test(c)), 'the palette is a set of plain colours (' + PAL.length + ')');
const off = [];
for (const f of fs.readdirSync(CMD).filter(n => /^scene(-[a-z]+|25)\.js$/.test(n))) {
  fs.readFileSync(path.join(CMD, f), 'utf8').split('\n').forEach((ln, i) => {
    if (/skin:|var LOOKS/.test(ln)) return;
    (ln.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g) || []).forEach(h => { if (!PAL.includes(h.toLowerCase())) off.push(f + ':' + (i + 1) + ' ' + h); });
  });
}
check(!off.length, 'every prop colour comes from cmd/scene-palette.json ' + off.slice(0, 8).join(', '));
const glow = [];
for (const f of fs.readdirSync(CMD).filter(n => /^scene-[a-z]+\.js$/.test(n))) fs.readFileSync(path.join(CMD, f), 'utf8').split('\n').forEach((ln, i) => { if (/#ffe2a8|#ffd56b/i.test(ln) && !/lamp|light|glow|lit|flame|candle|sun|window|bulb|fire|moon|star/i.test(ln)) glow.push(f + ':' + (i + 1)); });
check(!glow.length, 'glow and flame are only used for light sources ' + glow.slice(0, 5).join(', '));
done();
