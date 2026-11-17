/* Every file picker opens the same drop popup (JP 2026-11-17 21:02): a tap on a file field's label and a script's
   input.click() open it; a dropped or chosen file reaches the original field (its change handler runs); camera
   fields and the popup's own field go straight to the picker. Made-up files only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(1060);
  await go(p, 'work/', 2500);
  await p.evaluate(() => {
    const w = document.createElement('div'); w.id = 'fdzT';
    w.innerHTML = '<label class="pill-btn" id="fdzL">PDF or photos<input type="file" accept="application/pdf,.pdf,image/*" hidden id="fdzI"></label>' +
      '<label id="fdzC">Camera<input type="file" accept="image/*" capture="environment" hidden id="fdzCI"></label>';
    document.querySelector('main').appendChild(w);
    window.__got = []; document.getElementById('fdzI').addEventListener('change', e => { window.__got.push([...e.target.files].map(f => f.name)); });
  });
  await p.evaluate(() => document.getElementById('fdzL').click()); await sl(150);
  const o = await p.evaluate(() => { const ov = document.querySelector('.fdz-ov'); return ov && { here: ov.querySelector('.fdz-dz b').textContent, kinds: ov.querySelector('.fdz-help').textContent, many: ov.querySelector('.fdz-dz input').multiple }; });
  check(o && /Drop the file here/.test(o.here) && /PDF/.test(o.kinds) && /photos/.test(o.kinds) && !o.many, 'a tap on a file field opens the drop popup with what it takes ' + JSON.stringify(o));
  await p.evaluate(() => { const ov = document.querySelector('.fdz-ov'), dt = new DataTransfer(); dt.items.add(new File(['x'], 'Made-up note.txt', { type: 'text/plain' }));
    ov.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }); await sl(150);
  check(await p.evaluate(() => !!document.querySelector('.fdz-ov .fdz-bad:not([hidden])') && !window.__got.length), 'a file of the wrong kind is refused with a word why');
  await p.evaluate(() => { const ov = document.querySelector('.fdz-ov'), dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4'], 'Made-up drawing.pdf', { type: 'application/pdf' })); dt.items.add(new File(['%PDF-1.4'], 'Second.pdf', { type: 'application/pdf' }));
    ov.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }); await sl(150);
  const got = await p.evaluate(() => ({ got: window.__got, open: !!document.querySelector('.fdz-ov') }));
  check(JSON.stringify(got.got) === '[["Made-up drawing.pdf"]]' && !got.open, 'a dropped file reaches the field (one file for a one-file field) and the popup closes ' + JSON.stringify(got));
  await p.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.click(); }); await sl(150);
  check(await p.evaluate(() => /Drop the files here/.test((document.querySelector('.fdz-ov .fdz-dz b') || {}).textContent || '')), 'a script’s input.click() opens it too');
  await p.keyboard.press('Escape'); await sl(150);
  check(await p.evaluate(() => !document.querySelector('.fdz-ov')), 'Escape closes it');
  await p.evaluate(() => document.getElementById('fdzC').click()); await sl(150);
  check(await p.evaluate(() => !document.querySelector('.fdz-ov')), 'a camera field goes straight to the camera');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
