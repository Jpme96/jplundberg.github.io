/* The chat's code isn't part of every page (2026-11-21, JP: "faster Home"): tail.js doesn't carry it; share.js loads
   /cmd/dist/chat.js when the chat starts (1.2 s after unlock, when you share) or when you open it. */
const { open, go, sl, until } = require('../lib/browser'); const { check, done } = require('../lib/check');
(async () => {
  const { b, p } = await open(393);
  const r = await p.evaluate(async () => {
    const src = [...document.scripts].map(s => s.src).find(s => /dist\/tail\.js/.test(s));
    const tail = await fetch(src).then(x => x.text());
    const chat = await fetch('/cmd/dist/chat.js').then(x => x.ok ? x.text() : '');
    return { inTail: /window\.HomeChat\s*=/.test(tail), own: /window\.HomeChat\s*=/.test(chat) };
  });
  check(!r.inTail && r.own, 'the chat is built on its own, not into every page ' + JSON.stringify(r));
  check(!p.errs.length, 'no errors ' + p.errs.join(' | ').slice(0, 200));
  await done(b);
})();
