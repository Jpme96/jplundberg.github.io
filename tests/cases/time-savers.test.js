/* Time savers (2026-11-20, plan Part 3 C): paste a bank SMS, a bill or a booking into quick add and it becomes an
   expense, a to-do to pay by the due date, or an event; "Same as last week" on the dinners; a short connection drop
   is not written to the error log. Made-up data only. */
const { open, go, sl } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const r = await p.evaluate(() => {
    const now = new Date(2026, 10, 20, 12);
    const sms = Smart.parse('Varekjøp NOK 249,00 hos REMA 1000 GRUNERLOKKA den 19.11 kl 17:42. Disponibelt beløp kr 12 345,67. Hilsen Banken AS kundeservice', { now });
    const bill = Smart.parse('Faktura fra Hafslund Strøm AS. Beløp å betale: kr 1 234,50. Forfallsdato 28.11.2026. KID 12345678901. Kontonummer 1234 56 78901. Takk for at du er kunde hos oss', { now });
    const fly = Smart.parse('Bestillingsbekreftelse: Flight SK 1234 fra Oslo til Bergen. Avgang 12.12.2026 kl 07:15, gate åpner 06:30. Booking reference ABC123. God tur!', { now });
    const plain = Smart.parse('149 rema', { now });
    return { sms, bill, fly, plain };
  });
  check(r.sms && r.sms.kind === 'expense' && r.sms.amount === 249 && /Rema 1000/i.test(r.sms.note) && r.sms.date === '2026-11-19', 'a pasted bank SMS becomes an expense ' + JSON.stringify(r.sms));
  check(r.bill && r.bill.kind === 'todo' && r.bill.due === '2026-11-28' && /Hafslund/.test(r.bill.text) && /1\s?235|1\s?234/.test(r.bill.text), 'a pasted bill becomes a to-do to pay by the due date ' + JSON.stringify(r.bill));
  check(r.fly && r.fly.kind === 'event' && r.fly.date === '2026-12-12' && r.fly.start === '07:15' && /Flight – Bergen/.test(r.fly.title), 'a pasted booking becomes an event on the day ' + JSON.stringify(r.fly));
  check(r.plain && r.plain.kind === 'expense' && r.plain.amount === 149, 'a short typed line works as before');
  /* Same as last week */
  await p.evaluate(() => {
    Features.set('food', true);
    const pad = n => String(n).padStart(2, '0'), k = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const t = Features.tools(); t.meals = {}; for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() - 7 + i); if (i <= 3) t.meals[k(d)] = 'Taco ' + i; } Features.saveTools(t);
  });
  await go(p, 'food/', 2500);
  const s1 = await p.evaluate(() => { const b = document.querySelector('[data-mlsame]'); return b ? b.textContent : ''; });
  check(/Same as last week \([1-3]\)/.test(s1), 'the dinners offer last week for the empty days ' + s1);
  await p.evaluate(() => document.querySelector('[data-mlsame]').click()); await sl(300);
  const s2 = await p.evaluate(() => { const pad = n => String(n).padStart(2, '0'), d = new Date(); d.setDate(d.getDate() + 1); return Features.tools().meals[d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())]; });
  check(s2 === 'Taco 1', 'tomorrow gets what that weekday had a week ago (' + s2 + ')');
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 300));
  await done(b);
})();
