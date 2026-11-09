# How changes are made here (cmd, the shared app and the Worker)

Every change – a fix, a new feature, a tweak – follows these rules. They grow as the rebuilds in the plan land;
when a part of the plan is done, its rule moves from "Coming" to "Rules".

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
- **Ask before** anything that can't be undone (deleting data, changing DNS, scheduled tasks).

## Coming (from the plan – becomes a rule when that part is done)
- **Shared home:** shared things live only in the shared box; cmd and the shared app read and write it directly – no copying into the owner's vault. New shared features are built once and used in both apps.
- **Saving in small pieces:** new data gets its own encrypted piece instead of growing the one vault.
- **Page switching:** every cmd module has `start()` / `stop()` and keeps no state between pages except through its store.
- **Translations:** every text has a fixed name (key); never match on the English sentence.
- **Reminders:** sent by the server (LiveRoom alarms), not planned by a device.
- **Offline:** every edit goes through the offline queue.

The full plan: project doc `claude/plan-rebuilds-2026-11.md`.
