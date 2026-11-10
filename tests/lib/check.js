/* tiny assertions: check(condition, what) collects failures; done() prints them and sets the exit code */
const fails = [];
function check(ok, what) { console.log((ok ? '  ok  ' : '  FAIL ') + what); if (!ok) fails.push(what); }
function done(...browsers) { return Promise.all(browsers.filter(Boolean).map(b => b.close().catch(() => {}))).then(() => process.exit(fails.length ? 1 : 0)); }
process.on('unhandledRejection', e => { console.log('  FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
module.exports = { check, done };
/* empty boxes that take room on the page (a gap you can see): visible, taller than 50 px, with nothing in them */
module.exports.GAPS = () => {
  const out = [], main = document.querySelector('main') || document.body;
  main.querySelectorAll('section, div, ul').forEach(el => {
    const r = el.getBoundingClientRect(); if (r.height < 50 || r.width < 100 || !el.offsetParent) return;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.position === 'fixed' || cs.position === 'absolute') return;
    if (el.closest('.card-folded, [hidden], .scene, svg, canvas, .sc-wrap, .av-fig')) return;
    if ((el.innerText || '').trim()) return;
    if (el.querySelector('img, svg, canvas, input, select, textarea, button, video, iframe, i.bi')) return;
    if (cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')) return;   /* a drawn shape */
    if ([...el.querySelectorAll('*')].some(x => { const q = getComputedStyle(x); return q.backgroundImage !== 'none' || (q.backgroundColor !== 'rgba(0, 0, 0, 0)' && q.backgroundColor !== 'transparent'); })) return;
    out.push((el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ').slice(0, 2).join('.') + ' ' + Math.round(r.height) + 'px');
  });
  return out;
};
