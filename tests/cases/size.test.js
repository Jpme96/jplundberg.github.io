/* The app may not quietly get heavier: what each cmd page loads (scripts, gzip-free bytes) stays under its budget.
   Budgets are today's sizes plus a little room; lower them as the app gets lighter. */
const fs = require('fs'), path = require('path'); const { check, done } = require('../lib/check');
const ROOT = path.join(__dirname, '..', '..', 'cmd');
const BUDGET_KB = { total: 1671 };   /* +1 (2026-11-17 21:45): popups beside the side bar, the side bar measured again after fonts */   /* +7 (2026-11-17 21:02): filedrop.js in head */   /* +2 (2026-11-17): see PAGE_KB */   /* +7 (2026-11-16, JP's list): the Apple Health set-up steps in both languages with the iPhone's own Norwegian Shortcut names (ahealth.js – Settings opens on every page) */   /* +1 (2026-11-15 late): the Norwegian texts from the live check */   /* +11 (2026-11-15 night, JP: the avatar overhaul he asked for): the head as 3D slices with a jaw, hair on it with an outline per style, beards along the jaw, open eyes, clothes cut per garment (GARM: fit, hem, neckline, rib, pockets), every maker option visible */   /* +1 (2026-11-15 evening, JP's list): shared calendar invites – the invite switch, answers as status tags (share.js, cal.js); +2: hours from Team into Flex time (tools.js – the link's hash read, the offer and adding them once); */   /* +10 (2026-11-15 night, JP's list): a switch per page and per Work tab (nav.js, pagetabs.js), flex time from the calendar (tools.js), one-offs counted once in the pace (budget.js, fin.js), Papers words – the subscription check is Finance-only (sub-check.page.js); +1 Health/Travel later that night: Work Today and the travel planner's messages by name; +1–2 (15 Nov morning): all-zero key numbers hidden (tilekit.js), 'Visible to' by name (share.js), Admin log grouped, dinner days folded */   /* +2 (2026-11-15 night): Norwegian for texts that were still English (weather, the year ahead, Papers, dinner voting) – named texts in the page scripts */   /* +1 (2026-11-15): reminders before document deadlines in notify.js (every page plans the reminders) */   /* Work +3 more (2026-11-14 morning): report revisions; Work +4 (2026-11-14): Building inspection as its own page with tabs and the PDF made on the phone (jsPDF and html2canvas load only when a PDF is made, from cmd/vendor) */   /* −34 (2026-11-13 night): the FDV notes and report moved out of life-pages.page.js into fdv.page.js, which only Work loads (Finances, House, Habits and Travel lost 37–39 kB); Work +12 for the report's sections, charts, cost summary and building fields */   /* +4 (2026-11-13 night): FDV after NS 3451/NS 3424 – the two-digit headings, KG, priority and the code reader in the everywhere part (search and the summary use them) */   /* +4 (2026-11-13 late evening): more texts by name – the home hero, page-tab rows, the calendar and tax lists */   /* +5 (2026-11-13 evening): texts by name – the Settings rows, card set-ups, tabs, bill and tax texts call I18N.k (the words themselves load only in Norwegian) */   /* +3 (2026-11-13): the snowman (January and February, outdoors) and its hat */   /* +4 (2026-11-13): F6 – talking mouth shapes and brow moods, the pets in the body's look, crutches that stay put, the mohawk's crest, long hair's strands */   /* +4 (2026-11-13): the avatar's customisation pass – hair strands and nape, beards along the jaw, necklines, the prosthetic arm on every sleeve */   /* +4 (2026-11-13): the avatar's shading after JP's reference – gradients per colour, limbs as flowing shapes, the chest and stomach shapes */   /* +8 (2026-11-13): the avatar's new face – eyes with iris and lids, tapered brows, a nose shaped by light, two lips, a profile – and room for the hair, beards and mouth shapes that follow */   /* +6 (2026-11-13): the avatar's anatomy pass – teardrop shoulders, a jaw and chin, the back's details */      /* biggest page today ≈ 1589 kB (Finances; head + page + tail, the Norwegian words load only in Norwegian) */
/* each page on its own (Phase D 25: a page loads only its own code) – lower a page's number when it gets lighter */
/* +25 kB on every page (2026-11-12, F1b): the 2.5D figure (avatar-25d.js) and its small moves are in tail next to the old flat drawing; the old
   drawing code goes in F4 and these budgets come down again then.
   +2–9 kB on the pages with a scene (2026-11-12, F2): the 2.5D scene engine (scene25.js) in their bundle, next to the old engine until F4.
   −83 kB on every page (2026-11-12, D 25): Papers, Work, Habits (water), Goals, Wishlist and House chores load their page parts only on their page.
   −100 kB on every page (2026-11-12, F4): the old engine (scene-kit, avatar-rig, scene-common) and the flat drawing are gone; scene25.js is in tail
   now (the avatar page's "See it move" uses it on every page).
   +4 kB on every page (2026-11-12, F3): the everyday actions (wave, stretch, the time, a look round, coffee, umbrella, flag) in scene25.js.
   +1–3 kB on the scene pages (2026-11-12, F3 part 2): each page's own actions (a video call, the bottle, dusting, a note, a sit on the rock, the bench …), long press, looking at your finger.
   +25 kB on every page (2026-11-12, D 24): texts by name – the pieces of text between tags got their own named span and the labels passed to helpers became I18N.k(name, English); the old sentence list (Norwegian only) shrank by 9 kB.
   −220 kB on the pages that don't draw them (2026-11-12, F4 home-life split): home-life, people-plus, food-plus, money-plus, fin-tools, home-shared and
   life-pages load their page parts only on House, People, Food, Work, Finances, Habits, Travel and Wishlist (test home-split).
   +1 kB on some pages (2026-11-12, F4 faster frames): scene25's patch() – a frame is built off the page and only the changes are written.
   +5–6 kB on every page, +10 on Travel (2026-11-12, F3 extras): the season props and walks (tree, pumpkin) and the taps on things in scene25.js;
   Travel's packing and map.
   +4–5 kB on every page (2026-11-12 night, D 24): the choices in lists, the Settings summaries and the counts as I18N.k(name, English, {n}).
   +1 kB on Food and People (2026-11-12 night): night actions, muscles and face shapes in the figure, the whole plane.
   +1 kB on most pages (2026-11-12 night): the six-pack and obliques on a bare athletic or muscular body.
   +1–4 kB on the scene pages (2026-11-13): the last F3 actions (price tag, cart, call, ball, heart note, star sticker, done for the day, stamp, the smaller climber, taste and salt, the shelf, polish, piggy bank, payday bag, passport).
   +43 kB on Work (2026-11-14): Document control – the document plan read from Excel, the delivered files matched and checked by name, statuses, overview and report (doc-control.page.js, Work only);
   +4 kB more the same day: names from the FDV system (pasted or exported) and Quick check;
   +12 kB more: the plan made from the client's checklist with 34 project types (codes only), your own types, lines by hand;
   +16 kB more: Document requirements as its own tab (the list for the start of a project, PDF and Excel for the contractor, Start document control) and the building and property on both;
   +3 kB: suggested document types per NS 3451 group with a short description each, when the client's checklist has none; +1 kB: 4-digit codes under their 3-digit code, the code once with its types under it; +3 kB: NS 3456's 1 series (general documents, headings in both languages);
   +12 kB: documents specific to each kind of project (completion certificate, declarations, tests, photos …), the PDF drawn a few pages at a time.
   +2 kB on Work (2026-11-14 evening): Send to Team (a project as a file for work.jplundberg.com) and the PDF maker in its own file (paged-pdf.js) so Team uses the same code.
   +12 kB on Work (2026-11-14 night): Document control's "Excel with colours" – your own plan back with each row coloured by status and a Check column (the zip and the sheets are rewritten on the device, no library).
   +14 kB on Work (2026-11-14 night): see and edit the coloured plan like Excel (xlsx-view.js – sheets, colours, merged cells, a bar to type in; also used by Team).
   +13 kB on Work (2026-11-14 night): Check a plan (the plan against the client's checklist and the naming rules, no project) and the editor's tools – ranges, keys, undo/redo, copy/paste with Excel, bold, fill colours (+2 kB: the check's own footer text, the colour menu under its button, and drawing names checked part by part after BBY's template).
   −22 kB on Work (2026-11-14 night): the Excel editor (xlsx-view.js) loads the first time it is used, not with the page.
   +3 kB on Work (2026-11-15): Check a plan compares with the last check of the same plan and sends the result to the contractor; a status colour in the Excel sets the line's status; +2 kB: a checklist per client; +1 kB: DWG/PDF pairs; +1 kB: a building inspection sent to Team.
   +3 kB on Work (2026-11-15 afternoon): a deadline and a responsible per document line – in the open line, the row (overdue in red) and the report's Missing documents. */
/* +1–2 kB per page (2026-11-15 late, JP's live check): Norwegian names for the Admin and Settings texts that showed in English, the live line and tips line through the translator, Norwegian weekday letters, stand minutes. */
/* +2 kB (2026-11-16): the lock and sync guards that keep a device from wiping the synced dashboard (no-wipe) and their Norwegian texts. */
/* +1 kB (2026-11-16): the figure keeps its head between frames (scene-speed: frames 20–30 % faster). */
/* work +4 kB (2026-11-16): the PDF viewer (shown before sharing) and Move to Team for document requirements. */
/* finance, work +1 kB (2026-11-16): finance row texts and People's tile by name, one flex time format. */
/* work +4 kB (2026-11-16, JP 13:48 "fix everything" – Work was heavy to use): the picker updates in place instead of redrawing 800 controls, project types in rows with a search and a picked line, long lists folded per NS group (an 881-line list went from ~80 000 px to ~1 500 px and Make the list from 0.9 s to 0.2 s at phone speed), help texts one line until tapped. */
/* work +1 kB (2026-11-16, JP: file naming as a test): only the switch and the loader – the naming itself (cmd/doc-naming.js) and the PDF reader (cmd/vendor/pdf*.js) load only where it is switched on. */
/* +1 kB (2026-11-16): rounded hair outlines, the round afro, Finance's walk behind the jar. */
/* work +2 kB (2026-11-16, JP 15:19 – one Documentation tab): Requirements and Control become one tab with one project list, steps Requirements → Received → Report and the plan check on top; the two old lists are gone, the new words in both languages make up the rest. */
/* work +9 kB (2026-11-16, JP 15:03–15:19 – the Requirements step as in the approved preview): the pen for the list, the Send sheet that remembers what was sent and shows a change afterwards, and "+ New type" with start from, systems and own documents (admin only in Team). */
/* work +9 kB (2026-11-16, JP 14:39 "a one time thing" – step 3 of the Documentation tab): the two one-off tools, Give files the right names (files or a .zip in, a renamed .zip out) and Check names from the FDV system – nothing saved. */
/* work +2 kB (2026-11-16, JP 21:21): what the drawing letters mean (Boligbygg tables 8–11), discipline and drawing type suggested, a building number for drawings in the rename tool. */
/* +2 kB per page (2026-11-17, JP's list 1–8): one money forecast for Home, the Money card and Finances (budget.js), the freeze watchdog worker and the wider wide-page search (diag.js), the quiet wait in upgrades */
/* +1 kB Work (2026-11-17 19:05): the document plans box like the rename box – big buttons, a drop popup for the plans */
/* +4 kB Work (2026-11-17 15:25): document plans that stay – a list with summaries, several at once, delete */
/* +3 kB Work (2026-11-17 12:53): a searchable code list; redraws from elsewhere wait while you choose */
/* +2 kB Work (2026-11-17, JP 07:48/07:50): the NS code dropdown with names imported on the device, and the drop popup in the rename tool */
/* +8 kB every page (2026-11-17 21:02, JP): filedrop.js in head – every file picker opens the same drop popup */
/* +1–2 kB (2026-11-17 22:45, JP's list 9–22): moving-in wording, hidden calendar kinds, tiles at 0 wait, the week popup on Habits, Norwegian words */
const PAGE_KB = { 'index.html': 1450, 'admin/index.html': 1367, 'calendar/index.html': 1296, 'finance/index.html': 1671, 'food/index.html': 1384, 'goals/index.html': 1314, 'habits/index.html': 1343, 'house/index.html': 1656, 'papers/index.html': 1335, 'people/index.html': 1383, 'travel/index.html': 1440, 'wish/index.html': 1399, 'work/index.html': 1637 };
const pages = ['index.html'].concat(fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'index.html')) && d !== 'home').map(d => d + '/index.html'));
let worst = 0;
for (const pg of pages) {
  const html = fs.readFileSync(path.join(ROOT, pg), 'utf8'), dir = path.dirname(path.join(ROOT, pg));
  const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  const kb = Math.round(srcs.reduce((a, s) => { const f = s.startsWith('/') ? path.join(ROOT, '..', s) : path.join(dir, s); return a + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0) / 1024);
  worst = Math.max(worst, kb);
  const bud = Math.min(BUDGET_KB.total, PAGE_KB[pg] || BUDGET_KB.total);
  check(kb <= bud, pg + ': ' + kb + ' kB of scripts (budget ' + bud + ')');
}
console.log('  heaviest page: ' + worst + ' kB');
done();
