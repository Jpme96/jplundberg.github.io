/* File naming as cards (JP 2026-11-24, from the preview he approved): what all the files share is one calm line with Change;
   each file is a card with a head and three marked parts; the free text starts as the old name, a photo's date is its own,
   a photo's floor is the last one picked; empty fields the name needs have an orange edge and the button says what to fill in.
   Made-up files only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1060);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { const t = Features.tools(); t.dckrav = []; t.dctl = []; Features.saveTools(t); localStorage.removeItem('dcn.tool'); localStorage.removeItem('dcn.floor'); });
  await go(p, 'work/', 2500);
  await p.evaluate(() => PageTabs.show('doc')); await sl(300);
  await p.evaluate(() => document.querySelector('[data-dxtool="ren"]').click()); await sl(300);
  await p.evaluate(() => { const i = document.querySelector('input[data-dxrenf]'), dt = new DataTransfer(), when = new Date(2025, 2, 14, 10).getTime();
    dt.items.add(new File(['made up a'], 'madeup-logo.png', { type: 'image/png', lastModified: when })); dt.items.add(new File(['made up b'], 'IMG_0001.jpg', { type: 'image/jpeg', lastModified: when })); dt.items.add(new File(['made up c'], 'MADEUP DIRU testfil.pdf', { type: 'application/pdf' }));
    i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(1500);
  const R = re => p.evaluate(async src => { const re = new RegExp(src); document.querySelectorAll('[data-dcnfx]').forEach(x => x.click()); await new Promise(r => setTimeout(r, 150));
    const c = [...document.querySelectorAll('.dx-ren .dcn-row.dcn-c')].find(x => re.test(x.textContent)); if (c) { c.querySelector('[data-dcnexp]').click(); await new Promise(r => setTimeout(r, 350)); } return !!document.querySelector('.dcn-fpop .dcn-row'); }, re.source);

  /* the property ID is missing: the shared fields are open, two per row, and the card asks for it too */
  const s0 = await p.evaluate(() => { const g = document.querySelector('.dx-ren .dcn-pvbox .dcn-pvg'); return { open: !!g, cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0, line: !!document.querySelector('.dx-ren .dcn-shared') }; });
  check(s0.open && s0.cols === 2 && !s0.line, 'a value the names need is missing: the shared fields are open, two per row ' + JSON.stringify(s0));
  await R(/madeup-logo/);
  const c1 = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-row'), free = li.querySelector('[data-dcnv$=":free"]'), lab = [...li.querySelectorAll('.dcn-c > span')].map(x => x.textContent).join('|');
    return { head: (li.querySelector('.dcn-head b') || {}).textContent, open: !!li.querySelector('.dcn-head .dcn-open'), secs: [...li.querySelectorAll('.dcn-sec')].map(x => x.firstChild.textContent.trim()), free: free && free.value, askPid: !!li.querySelector('[data-dcnpv="pid"]'),
      name: li.querySelector('.dcn-sug code').textContent, optional: /optional/.test(lab), need: [...li.querySelectorAll('.dcn-s .dcn-need')].map(x => x.dataset.dcnv || x.dataset.dcnpv), fill: (li.querySelector('[data-dcnfill]') || {}).textContent || '', tag: (li.querySelector('.dcn-head .dc-st') || {}).textContent }; });
  /* the three parts sit side by side in the card, none inside another and none past its right edge (2026-11-24: a missing closing tag nested them) */
  const nest = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-row'), lr = li.getBoundingClientRect(), P = [...li.querySelectorAll('.dcn-part')];
    return { direct: P.every(x => x.parentElement === li), n: P.length, out: [...li.querySelectorAll('button, input, select, code')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > lr.right + 1 && !e.classList.contains('dcn-hsel'); }).map(e => e.tagName + '.' + e.className + ' +' + Math.round(e.getBoundingClientRect().right - lr.right)) }; });
  check(nest.direct && nest.n === 3 && !nest.out.length, 'the card’s three parts are side by side, nothing sticks out ' + JSON.stringify(nest));
  check(c1.head === 'madeup-logo.png' && c1.open && c1.secs.join('|') === 'Code and type|Name parts|New name', 'the card has a head with the file and Open, and three marked parts ' + JSON.stringify(c1));
  check(c1.free === 'madeup-logo' && /2025-03-14/.test(c1.name), 'the free text starts as the old name, and the date is the photo’s own ' + JSON.stringify(c1.name));
  check(c1.optional, 'a photo’s NS 3451 code is marked optional');
  check(c1.askPid && c1.need.length >= 2 && /first/.test(c1.fill) && /missing/.test(c1.tag), 'empty fields the name needs are marked, the head says how many, and the button says what to fill in ' + JSON.stringify({ need: c1.need, fill: c1.fill, tag: c1.tag }));
  /* the button takes you to the first empty field */
  const fo = await p.evaluate(async () => { document.querySelector('.dcn-fpop [data-dcnfill]').click(); await new Promise(r => setTimeout(r, 400)); const a = document.activeElement; return !!a && a.classList.contains('dcn-need'); });
  check(fo, 'Fill in … first takes you to the first empty field');
  /* fill in the property ID: it goes to the shared line, and the card shows it filled in (it stays there – JP 2026-11-26) */
  await p.evaluate(() => { const f = document.querySelector('.dcn-fpop [data-dcnpv="pid"]'); f.value = '3-777'; f.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  await p.evaluate(() => { const s = document.querySelector('.dcn-fpop [data-dcnv$=":floor"]'); s.value = 'H02'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sl(400);
  const c2 = await p.evaluate(() => ({ askPid: (() => { const f = document.querySelector('.dcn-fpop [data-dcnpv="pid"]'); return !f ? 'none' : f.classList.contains('dcn-need') ? 'asks' : f.value; })(), line: (document.querySelector('.dx-ren .dcn-shared') || {}).textContent || '', box: !!document.querySelector('.dx-ren .dcn-pvbox') }));
  check(c2.askPid === '3-777' && /3-777/.test(c2.line) && !c2.box, 'once set, the property ID is on the “Shared by all the files” line; the card shows it filled in and no longer asks (JP 2026-11-26) ' + JSON.stringify(c2));
  /* the next photo gets the floor picked last, and a camera name gives no free text */
  await R(/IMG_0001/);
  const c3 = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-row'); return { floor: li.querySelector('[data-dcnv$=":floor"]').value, free: li.querySelector('[data-dcnv$=":free"]').value }; });
  check(c3.floor === 'H02' && c3.free === '', 'the next photo starts with the floor picked last; a camera name (IMG_0001) gives no free text ' + JSON.stringify(c3));
  /* a document without a code: NS 3451 keeps its capitals in the button and the name's gap; the card uses one type scale (JP 2026-11-24) */
  await R(/MADEUP DIRU/);
  const c4 = await p.evaluate(() => { const li = document.querySelector('.dcn-fpop .dcn-row'), fs = q => { const e = li.querySelector(q); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; };
    return { fill: (li.querySelector('[data-dcnfill]') || {}).textContent || '', gap: (li.querySelector('.dcn-sug code i') || {}).textContent || '', pick: fs('.dcn-cbtn'), sel: fs('.dcn-kind select'), code: fs('.dcn-sug code'), btn: fs('.dcn-b .pill-btn'), iss: fs(':scope > .dc-iss'), open: fs('.dcn-head .dcn-open') }; });
  check(/NS 3451/.test(c4.fill) && !/ns 3451/.test(c4.fill) && /NS 3451/.test(c4.gap), 'NS 3451 keeps its capitals in “Fill in … first” and in the name’s gap ' + JSON.stringify({ fill: c4.fill, gap: c4.gap }));
  check(c4.pick === 14 && c4.sel === 14 && c4.code <= 15 && c4.btn === 14 && (!c4.iss || c4.iss === 13) && c4.open === 13.5, 'one type scale in the card: choices 14, new name ≤ 15, buttons 14, small text 13, the small Open button 13.5 (JP 2026-11-24 19:49) ' + JSON.stringify(c4));
  /* space between the cards in the list */
  await p.evaluate(() => document.querySelectorAll('[data-dcnfx]').forEach(x => x.click())); await sl(200);
  const gap = await p.evaluate(() => { const L = [...document.querySelectorAll('.dx-ren .dcn-files > li')]; return L.length > 1 ? Math.round(L[1].getBoundingClientRect().top - L[0].getBoundingClientRect().bottom) : -1; });
  check(gap >= 14, 'clear space between the files in the list (' + gap + ' px)');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); done();
})();
