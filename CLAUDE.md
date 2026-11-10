# How changes are made here (cmd, the shared app and the Worker)

Every change – a fix, a new feature, a tweak – follows these rules. They grow as the rebuilds in the plan land;
when a part of the plan is done, its rule moves from "Coming" to "Rules".

## Before any new feature or change
1. Read this file and the plan (project doc `claude/plan-rebuilds-2026-11.md`).
2. If the part of the plan it touches is **done**, build it the new way (the rule is under "Rules").
3. If that part is **not done yet**, say so to the owner and either do that rebuild step first, or build the feature
   so it moves over without rework (same data shape, no new copying between cmd and the shared box, keys for texts).
   Never add more of the old way just because it's quicker.
4. Add a test for it, run all tests, then ship.
5. When a rebuild part is finished, move its line from "Coming" to "Rules" here and in the project doc `claude/rules-for-changes.md`.

## Rules
- **The repo is public.** Never commit real data, personal details (also the owner's email), tokens, keys or test files with real content. Tests use made-up data only.
- **Tests first.** Run `cd tests && npm test` (or `node tests/run.js <words>` for some) before pushing. A new feature or fix gets a test in `tests/cases/` that would have caught the bug. GitHub runs all tests on every push; a red run is fixed before anything else.
- **Build and versions.** After changing cmd scripts: `python3 cmd/build.py` (and `--check`). Ship: bump `CACHE` in `cmd/sw.js`; when styles change, bump `styles.css?v=` on every page; for the shared app bump `APPV` in `cmd/home/app.js` and `app.js?v=` in `cmd/home/index.html` (must match), and the `?v=` of any changed script there.
- **The Worker deploys itself** from `_cloudflare/` (Cloudflare Workers Builds, `_cloudflare/wrangler.jsonc`). Never ask the owner to paste code. A new binding goes into `wrangler.jsonc`; a new Durable Object class needs a new migration tag. Secrets stay in the Cloudflare dashboard – never in the repo or the chat.
- **Encryption.** Everything personal is encrypted on the device (owner: passcode vault; shared home: the shared key). The Worker only ever sees ciphertext, ids, times and version numbers. The live line (LiveRoom) carries numbers only.
- **Sync safety.** Changes from elsewhere go through `keepView()` (nothing jumps) and never overwrite a change made on this device meanwhile (`editSeq` in `lock.js`). Don't redraw a field while someone is typing in it (`typingHere()`).
- **Words.** English and Norwegian for every text. No Norwegian words in the English UI unless explained in brackets. No "undefined", "NaN" or "null" may ever reach the screen (the words test checks every page).
- **Phone first.** Check at phone width (393–440 px): no zoom, no tiny date boxes, room under the status bar, nothing hidden behind the bottom menu.
- **Who you live with is a setting** – never hard-code a name.
- **Mail:** the domain's mail is with another provider – never touch the root MX records.
- **Keep it light.** No new library or big image without need; images sized for the screen (WebP/AVIF); remove code that's no longer used. The size test (`tests/cases/size.test.js`) fails if the scripts a page loads grow past its budget – lower the budget when the app gets lighter, never raise it without a reason.
- **Icons and fonts.** cmd uses its own trimmed icon set: after using a new `bi-…` icon, run `python3 cmd/icons.py` (the build test fails otherwise). Fonts are woff2. Background images stay under ~250 kB.
- **Shared features are shared code.** Text or logic that both apps need (like `ShareCore.activity`) lives in `cmd/share-core.js`, not copied into each app. New shared kinds go into `ALLOW` with their fields and cleaning.
- **Saving in small pieces (done 2026-11-10).** On the server the vault is a small core (v: 2) plus encrypted pieces (`split()`/`join()`/`toServer()` in `cmd/lock.js`, `/cmd/api/vpiece` in the Worker). Any top-level part, widget, tool list or Health month over 2 kB becomes its own piece by itself – keep new data in its own top-level key or tool list so it lands in its own piece; don't pile it into an existing big one. Piece names stay inside the encrypted core. Backups and snapshots are whole copies. Test: `pieces`.
- **Instant page changes (done 2026-11-10, on by default).** `cmd/softnav.js` (last in head) swaps the page without a reload and runs the page bundle and `tail.js` again; what they set up on things that stay (listeners on window/document/html/body, intervals, timers, observers, WebSockets, `<html>` classes, additions to head objects, `Vault.onUnlock`) is undone when you leave – who made it is read from the call stack. So: a page/tail module may run many times per session – keep lasting state in a store (vault, localStorage, the shared box), never only in module variables; head modules (`scripts.json` head) run once and must use event delegation for page elements. Test: `softnav` (13 page changes, nothing doubled, Back, Settings, lock).
- **Ask before** anything that can't be undone (deleting data, changing DNS, scheduled tasks).

## Coming (from the plan – becomes a rule when that part is done)
- **Shared home:** shared things live only in the shared box; cmd and the shared app read and write it directly – no copying into the owner's vault. New shared features are built once and used in both apps.
  *Started (on by default since 2026-11-10, JP's choice):* shopping list, chores + rooms + chore ticks and notes are read straight from the box (`DLISTS` in `cmd/share.js` + `Features.direct()`; can be turned off per part under Shared space → "Shared home in one place"; tests `shop-direct`, `chores-direct`). **A new shared list goes into `DLISTS`**, not into `collect()`/`applyAll()`. Still the old way: dinners/votes, money, pantry, recipes, events, plants.
- **Translations:** every text has a fixed name (key); never match on the English sentence.
- **Reminders:** sent by the server (LiveRoom alarms), not planned by a device.
- **Offline:** every edit goes through the offline queue.
- **Lighter app:** each page loads only its own code.

The full plan: project doc `claude/plan-rebuilds-2026-11.md`.
