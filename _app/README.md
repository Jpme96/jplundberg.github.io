# The iPhone apps

Two apps made from the live pages with [Capacitor](https://capacitorjs.com):

| App | Opens | For | App link |
| --- | --- | --- | --- |
| **cmd** (`com.jplundberg.cmd`) | `https://jplundberg.com/cmd/` | JP | `jplcmd://…` |
| **Shared home** (`com.jplundberg.home`) | `https://jplundberg.com/cmd/home/` | both of you | `jplhome://…` |

The apps open the live site, so a change to cmd reaches the apps with the next release – no new app version.
A new app version is only needed when something here (`_app/`) changes: a new native plugin, icon or permission.

What the app adds over the home-screen web app (cmd checks `window.Native`, see `cmd/native.js`):
- Reminders are scheduled on the phone (`notify.js` → Local Notifications), with titles – nothing goes through the server.
- `jplcmd://cmd/food/#shop` or `jplcmd://?say=milk` opens that page in the app (Siri Shortcuts: "Open URLs").
- Offline: the pages' service worker runs in the app (`WKAppBoundDomains`), and `www/error.html` shows if the very first start has no signal.

Coming: widgets, the passport chip (NFC), Health straight from HealthKit, pushes from the other one (APNs).

## Try it on your own iPhone (Mac + Xcode)
1. Install Xcode from the App Store and open it once.
2. In Terminal:
   ```
   git clone https://github.com/Jpme96/jplundberg.github.io.git
   cd jplundberg.github.io/_app && npm install && npm run sync
   open cmd/ios/App/App.xcodeproj
   ```
3. In Xcode: click **App** (top of the left list) → **Signing & Capabilities** → Team: choose your Apple ID
   (Xcode → Settings → Accounts → + if it isn't there).
4. Plug in the iPhone, pick it at the top, press ▶. The first time: on the phone, Settings → General → VPN & Device
   Management → trust your Apple ID, and turn on Developer Mode if it asks.

With a free Apple ID the app stops after 7 days (press ▶ again). With the Apple Developer Program it lasts and can go
to TestFlight – that's what the GitHub workflow `.github/workflows/ios.yml` does (see the secrets it needs at its top).

## TestFlight (both of you)
1. App Store Connect → Apps → + → New App, once per app: name, the bundle id above, SKU = the bundle id.
2. Users and Access → Integrations → App Store Connect API → a key with the App Manager role. Put its id, the issuer id
   and the `.p8` text in the repo's Actions secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`) and the team id in
   `APPLE_TEAM_ID`. Never in the repo or the chat.
3. Actions → "iPhone apps" → Run. Then TestFlight → Internal testing: add yourself and Iago (he needs to be a user in
   App Store Connect, role Customer Support is enough) and install from the TestFlight app.

## After changing something here
`cd _app && npm run sync` (copies settings and plugins into both iOS projects), commit the result.
