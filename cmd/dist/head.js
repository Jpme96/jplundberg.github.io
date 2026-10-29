/* Built by cmd/build.py from: i18n.js, lock.js, features.js – edit those files, not this one. */
/* ===== i18n.js ===== */
try {
/* Language: English (as written) or Norwegian (Settings → Appearance → Language).
   In Norwegian, this translates what's on screen as it appears – texts, buttons, placeholders,
   labels – and makes every date Norwegian. Your own words (to-dos, notes, events, names) are
   never touched: only texts the dashboard itself writes are in the list below.
   Loaded first on every page, so the rest of the dashboard doesn't need to know about it. */
(function () {
  "use strict";
  var lang = 'en';
  try { lang = (JSON.parse(localStorage.getItem('dash.settings')) || {}).lang === 'nb' ? 'nb' : 'en'; } catch (e) {}
  window.I18N = { lang: lang, t: function (s) { return s; } };
  if (lang !== 'nb') return;
  document.documentElement.lang = 'nb';

  /* ---------- every date in Norwegian ---------- */
  var en = /^en(-|$)/i;
  ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'].forEach(function (fn) {
    var orig = Date.prototype[fn];
    Date.prototype[fn] = function (loc, opt) { return orig.call(this, !loc || en.test(String(loc)) ? 'nb-NO' : loc, opt); };
  });

  /* ---------- the words ---------- */
  var D = {
    /* menu, pages, sections */
    'Home': 'Hjem', 'Calendar': 'Kalender', 'Travel': 'Reise', 'Finances': 'Økonomi', 'Health': 'Helse', 'Work': 'Jobb', 'Dashboard': 'Dashbord',
    'Today': 'I dag', 'Tasks & notes': 'Oppgaver og notater', 'Private': 'Privat', 'Settings': 'Innstillinger', 'Search': 'Søk', 'Close': 'Lukk', 'Cancel': 'Avbryt',
    'Save': 'Lagre', 'Delete': 'Slett', 'Edit': 'Endre', 'Add': 'Legg til', 'Open': 'Åpne', 'Done': 'Ferdig', 'Undo': 'Angre', 'Remove': 'Fjern', 'Copy': 'Kopier', 'Copied': 'Kopiert',
    'Show': 'Vis', 'Fold': 'Brett sammen', 'Off': 'Av', 'On': 'På', 'Next': 'Neste', 'Previous': 'Forrige', 'New': 'Ny', 'Details': 'Detaljer', 'Clear': 'Tøm', 'Refresh': 'Oppdater',
    'Back to jplundberg.com': 'Tilbake til jplundberg.com', 'Profile and settings': 'Profil og innstillinger', 'Search (/)': 'Søk (/)', 'Close settings': 'Lukk innstillinger',
    'Add (expense, event, workout, task or note)': 'Legg til (utgift, hendelse, økt, oppgave eller notat)', 'Loading…': 'Laster …', 'Optional': 'Valgfritt', 'None': 'Ingen', 'Never': 'Aldri',
    /* Apple Health card */
    'Yesterday': 'I går', 'yesterday': 'i går', 'Goal reached': 'Mål nådd', 'Ticked:': 'Krysset av:', 'Goal': 'Mål', 'Nothing from Apple Health this day.': 'Ingenting fra Apple Helse denne dagen.',
    'Stand': 'Stå', 'Distance': 'Distanse', 'Flights': 'Etasjer', 'HRV': 'HRV', 'Cardio fitness': 'Kondisjon', 'Mindfulness': 'Mindfulness', 'Water': 'Vann', 'Daylight': 'Dagslys',
    'Stand hours': 'Ståtimer', 'Heart rate variability': 'Pulsvariasjon', 'Time in daylight': 'Tid i dagslys', 'Active energy': 'Aktiv energi', 'Resting heart rate': 'Hvilepuls', 'Walking + running': 'Gange + løping', 'Flights climbed': 'Etasjer gått',
    'Stand hours ≥': 'Ståtimer ≥', 'Floors ≥': 'Etasjer ≥', 'Mindful min ≥': 'Mindfulness min ≥', 'Water litres ≥': 'Vann liter ≥', 'Daylight min ≥': 'Dagslys min ≥',
    'Customize': 'Tilpass', 'Tile': 'Flis', 'Stack': 'Bunke', 'Hide': 'Skjul', 'Reset': 'Tilbakestill', 'Bars': 'Søyler', 'Line': 'Linje', 'Chart type': 'Diagramtype',
    'More numbers – swipe': 'Flere tall – sveip', 'Tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.': 'Flisene vises alltid; bunken har resten – sveip den som en iPhone-widget.', 'Set a goal': 'Sett et mål',
    'Main tiles are always shown; the stack holds the rest – swipe it like an iPhone widget.': 'Hovedflisene vises alltid; bunken har resten – sveip den som en iPhone-widget.',
    'Heart rate': 'Puls', 'Energy': 'Energi', 'Fitness': 'Kondisjon', 'Mindful': 'Mindfulness',
    'Day before': 'Dagen før', 'Day after': 'Dagen etter', 'Days shown': 'Dager som vises',
    /* lock */
    'Enter your passcode to open the dashboard.': 'Skriv koden din for å åpne dashbordet.', 'Enter your passcode to open your finances.': 'Skriv koden din for å åpne økonomien.',
    'Enter your passcode to open your calendar.': 'Skriv koden din for å åpne kalenderen.', 'Enter your passcode to plan a trip.': 'Skriv koden din for å planlegge en reise.',
    'Enter your passcode to open Health.': 'Skriv koden din for å åpne Helse.', 'Enter your passcode to open Work.': 'Skriv koden din for å åpne Jobb.',
    'Passcode': 'Kode', 'Repeat passcode': 'Gjenta koden', 'Unlock': 'Lås opp', 'Forgot passcode?': 'Glemt koden?', 'Welcome back': 'Velkommen tilbake', 'Erase and start over': 'Slett alt og start på nytt',
    'Restore from backup': 'Gjenopprett fra sikkerhetskopi', 'Found your synced dashboard. Enter your passcode.': 'Fant det synkroniserte dashbordet ditt. Skriv koden din.',
    'Backup restored. Unlock with the passcode it was made with.': 'Sikkerhetskopien er gjenopprettet. Lås opp med koden den ble laget med.',
    /* greeting, top */
    'Good morning,': 'God morgen,', 'Good afternoon,': 'God ettermiddag,', 'Good evening,': 'God kveld,', 'Good night,': 'God natt,',
    /* cards */
    'At a glance': 'Kort fortalt', 'Reviews': 'Oppsummeringer', 'Weather': 'Vær', 'Money': 'Penger', 'This week': 'Denne uka', 'Work today': 'Jobb i dag', 'To-do': 'Gjøremål', 'Goals': 'Mål',
    'Quick links': 'Snarveier', 'Notes': 'Notater', 'Stops': 'Stopp', 'Clear done': 'Fjern ferdige', 'Nothing to do. Nice.': 'Ingenting å gjøre. Deilig.', 'No notes': 'Ingen notater',
    'No notes yet. Tap a note to edit it.': 'Ingen notater ennå. Trykk på et notat for å endre det.', 'Write something…': 'Skriv noe …', 'Something to do…': 'Noe å gjøre …',
    'New task – add “fri” for a day': 'Ny oppgave – skriv «fre» for en dag', 'Nothing needs you right now. Enjoy the day.': 'Ingenting trenger deg akkurat nå. Nyt dagen.',
    'Tap to fold them away': 'Trykk for å brette dem sammen', 'Show less': 'Vis færre', 'Not now': 'Ikke nå', 'Log expense': 'Før utgift', 'Bills': 'Regninger',
    'Weather is unavailable right now.': 'Været er ikke tilgjengelig akkurat nå.', 'Not clocked in': 'Ikke stemplet inn', 'Clock in': 'Stemple inn', 'Clock out': 'Stemple ut', 'today': 'i dag',
    'Flex balance': 'Fleksisaldo', 'logged days': 'førte dager', 'Edit habits on the dashboard': 'Endre vaner på dashbordet', 'Spent today': 'Brukt i dag',
    'left this month': 'igjen denne måneden', 'left until payday': 'igjen til lønning', 'over budget this month': 'over budsjett denne måneden',
    'Synced across your devices': 'Synkronisert på enhetene dine', 'Encrypted with your passcode': 'Kryptert med koden din', 'Synced and encrypted with your passcode': 'Synkronisert og kryptert med koden din',
    'Saved on this device only': 'Bare lagret på denne enheten', 'Choose features in Settings': 'Velg funksjoner i Innstillinger', 'From': 'Fra', 'To': 'Til', 'Swap from and to': 'Bytt fra og til',
    'Save a stop under “Stops” to see its next departures here.': 'Lagre et stopp under «Stopp» for å se neste avganger her.', 'Coming up': 'Snart',
    /* quick add */
    'Expense': 'Utgift', 'Event': 'Hendelse', 'Workout': 'Økt', 'Task': 'Oppgave', 'Note': 'Notat', 'Type what to add': 'Skriv hva du vil legge til',
    'Type it: 149 rema · tor 14 tannlege · løp 5 km': 'Skriv det: 149 rema · tor 14 tannlege · løp 5 km', 'Amount, kr': 'Beløp, kr', 'What was it? (optional)': 'Hva var det? (valgfritt)',
    'What was it?': 'Hva var det?', 'Date': 'Dato', 'Category': 'Kategori', 'What? e.g. Dentist': 'Hva? f.eks. Tannlege', 'Where (optional)': 'Hvor (valgfritt)', 'All day': 'Hele dagen',
    'Start': 'Start', 'Minutes': 'Minutter', 'km (optional)': 'km (valgfritt)', 'Distance': 'Distanse', 'How hard': 'Hvor hardt', 'Easy': 'Lett', 'Light': 'Lys', 'Moderate': 'Middels',
    'Hard': 'Hardt', 'All out': 'Alt jeg hadde', 'Type': 'Type', 'Due date (optional)': 'Frist (valgfritt)', 'Repeat': 'Gjenta', 'Add expense': 'Legg til utgift', 'Add event': 'Legg til hendelse',
    'Log workout': 'Før økt', 'Add task': 'Legg til oppgave', 'Save note': 'Lagre notat', 'Clear': 'Tøm', 'Doesn’t repeat': 'Gjentas ikke', 'Every day': 'Hver dag', 'Every weekday': 'Hver ukedag',
    'Every weekday (Mon–Fri)': 'Hver ukedag (man–fre)', 'Every week': 'Hver uke', 'Every 2 weeks': 'Annenhver uke', 'Every month': 'Hver måned', 'Every 3 months': 'Hvert kvartal', 'Every year': 'Hvert år',
    'every day': 'hver dag', 'every weekday': 'hver ukedag', 'every week': 'hver uke', 'every 2 weeks': 'annenhver uke', 'every month': 'hver måned', 'every 3 months': 'hvert kvartal', 'every year': 'hvert år',
    'Groceries': 'Dagligvarer', 'Eating out': 'Mat ute', 'Transport': 'Transport', 'Shopping': 'Shopping', 'Fun': 'Moro', 'Other': 'Annet', 'Fixed costs': 'Faste kostnader',
    'Strength': 'Styrke', 'Running': 'Løping', 'Walking': 'Gåtur', 'Cycling': 'Sykling', 'Swimming': 'Svømming', 'Ball sports': 'Ballsport', 'Yoga / mobility': 'Yoga / bevegelighet',
    'Personal': 'Personlig', 'Study': 'Studier', 'Training': 'Trening', 'Social': 'Sosialt',
    /* search */
    'Search everything – trips, events, notes, spending…': 'Søk i alt – reiser, hendelser, notater, utgifter …',
    'Search everything – or type something to add: “149 rema”, “fre 18 middag”, “løp 5 km”.': 'Søk i alt – eller skriv noe å legge til: «149 rema», «fre 18 middag», «løp 5 km».',
    'Spending': 'Utgifter', 'Trips': 'Reiser', 'Weekly check-in': 'Ukentlig gjennomgang', 'Import from bank': 'Importer fra banken',
    'CSV or Excel from your bank or credit card': 'CSV eller Excel fra banken eller kredittkortet',
    /* check-in, review */
    'How was the week?': 'Hvordan var uka?', 'The week ahead': 'Uka som kommer', 'Focus this week': 'Fokus denne uka', 'Habits last week': 'Vaner forrige uke', 'Done for this week': 'Ferdig for denne uka',
    'spent this week': 'brukt denne uka', 'most of it': 'mest av det', 'at this pace': 'i dette tempoet', 'left at month end': 'igjen ved månedsslutt', 'left at payday': 'igjen ved lønning',
    'Free': 'Ledig', 'Star up to three – they go to the top of your To-do.': 'Stjernemerk opptil tre – de havner øverst i gjøremålene.', 'No backup downloaded yet.': 'Ingen sikkerhetskopi lastet ned ennå.',
    'You haven’t imported from your bank yet.': 'Du har ikke importert fra banken ennå.', 'Import': 'Importer', 'Backup': 'Sikkerhetskopi', 'Monthly check-in': 'Månedlig gjennomgang', 'Year in review': 'Året som gikk',
    'Month': 'Måned', 'Year': 'År', 'Where the money went': 'Hvor pengene gikk', 'Habits': 'Vaner', 'How it felt': 'Hvordan det føltes', 'spent': 'brukt', 'left over': 'til overs', 'over budget': 'over budsjett',
    'steps a day': 'skritt om dagen', 'sleep a night': 'søvn per natt', 'workouts': 'økter', 'flex': 'fleks', 'Trips, money, workouts and habits': 'Reiser, penger, økter og vaner',
    /* finance page */
    'Budget, bills, what you spend and what you own – and the statistics behind it.': 'Budsjett, regninger, hva du bruker og hva du eier – og tallene bak.',
    'Monthly budget': 'Månedsbudsjett', 'Upcoming bills': 'Kommende regninger', 'Due dates': 'Forfallsdager', 'Savings goals': 'Sparemål', 'Net worth': 'Nettoformue', 'By category': 'Per kategori',
    'Change by category': 'Endring per kategori', 'Statistics': 'Statistikk', 'Spending per month': 'Utgifter per måned', 'This month’s pace': 'Tempoet denne måneden', 'Biggest expenses': 'Største utgifter',
    'Subscriptions': 'Abonnementer', 'Warranties & receipts': 'Garantier og kvitteringer', 'Left': 'Igjen', 'Income': 'Inntekt', 'Account': 'Konto', 'Export': 'Eksporter',
    'This month': 'Denne måneden', '3 months': '3 måneder', '12 months': '12 måneder', 'This year': 'I år', 'All years': 'Alle år', 'Year…': 'År …', 'Show as table': 'Vis som tabell',
    'Left this month': 'Igjen denne måneden', 'Spent this month': 'Brukt denne måneden', 'Savings rate': 'Sparegrad', 'Next payday': 'Neste lønning', 'Net, after tax': 'Netto, etter skatt',
    'of net income left after fixed costs and spending': 'av nettoinntekten igjen etter faste kostnader og forbruk', 'Give your income a payday under Monthly budget': 'Gi inntekten en lønningsdag under Månedsbudsjett',
    'Add accounts under Net worth': 'Legg til kontoer under Nettoformue', 'Asset': 'Eiendel', 'Debt / loan': 'Gjeld / lån', 'Search this month…': 'Søk denne måneden …', 'All categories': 'Alle kategorier',
    'Goal, e.g. Buffer account': 'Mål, f.eks. Bufferkonto', 'Saved, kr': 'Spart, kr', 'Target, kr': 'Mål, kr', 'Reach it by': 'Nå det innen', 'Or per month': 'Eller per måned', 'kr a month': 'kr i måneden',
    'Set it aside in the monthly budget': 'Sett det av i månedsbudsjettet', 'No savings goals yet. Add one, like a buffer account or a trip.': 'Ingen sparemål ennå. Legg til ett, for eksempel en bufferkonto eller en reise.',
    'Import from your bank': 'Importer fra banken', 'Import from your bank (CSV)': 'Importer fra banken (CSV)', 'Choose file': 'Velg fil', 'or credit card': 'eller kredittkortet', 'CSV or Excel': 'CSV eller Excel',
    'Hide amounts': 'Skjul beløp', 'Show amounts': 'Vis beløp', 'Mark as paid': 'Merk som betalt', 'Renewed automatically': 'Fornyet automatisk', 'Which day of the month is each one due?': 'Hvilken dag i måneden forfaller hver av dem?',
    'Add income': 'Legg til inntekt', 'e.g. Rent': 'f.eks. Husleie', 'Per month': 'Per måned', 'Per year': 'Per år', 'Add subscription': 'Legg til abonnement', 'Monthly report': 'Månedsrapport',
    /* calendar */
    'Week': 'Uke', 'List': 'Liste', 'New event': 'Ny hendelse', 'Edit event': 'Endre hendelse', 'Calendar settings': 'Kalenderinnstillinger', 'Reminders': 'Påminnelser', 'Holidays': 'Helligdager',
    'Phone calendars': 'Telefonkalendere', 'Name, e.g. iPhone': 'Navn, f.eks. iPhone', 'Calendar link (webcal:// or https://)': 'Kalenderlenke (webcal:// eller https://)', 'Where do I find the link?': 'Hvor finner jeg lenken?',
    'Delete event': 'Slett hendelse', 'Delete only this one': 'Slett bare denne', 'Delete all': 'Slett alle', 'This event repeats.': 'Denne hendelsen gjentas.', 'End repeat': 'Slutt å gjenta', 'Ends': 'Slutter', 'Starts': 'Starter',
    'Title': 'Tittel', 'Location': 'Sted', 'Time': 'Tid', 'Nothing planned.': 'Ingenting planlagt.', 'Nothing planned the next 7 days.': 'Ingenting planlagt de neste 7 dagene.', 'all-day': 'hele dagen', 'Public holiday': 'Helligdag',
    'Week numbers': 'Ukenummer', 'Norwegian public holidays': 'Norske helligdager', 'Categories': 'Kategorier', 'Add category': 'Legg til kategori', 'Category name': 'Navn på kategori',
    /* travel */
    'where do you want to go?': 'hvor vil du dra?', 'Journey': 'Reise', 'History': 'Historikk', 'Leave now': 'Dra nå', 'Leave at': 'Dra kl.', 'Arrive by': 'Fremme kl.', 'Find trips': 'Finn reiser',
    'Set home': 'Angi hjem', 'Set work': 'Angi jobb', 'Real-time journey data from Entur, the national travel planner for Norway.': 'Sanntidsdata fra Entur, den nasjonale reiseplanleggeren.',
    'Overview': 'Oversikt', 'Plan': 'Plan', 'Prepare': 'Forbered', 'Booked so far': 'Bestilt så langt', 'Booked': 'Bestilt', 'Spent during the trip': 'Brukt på reisen', 'Per day': 'Per dag', 'Set a budget': 'Sett et budsjett',
    'New trip': 'Ny reise', 'Plan a trip': 'Planlegg en reise', 'Your trips': 'Reisene dine', 'Past trips': 'Tidligere reiser', 'Travel documents': 'Reisedokumenter', 'Packing': 'Pakking', 'Currency': 'Valuta',
    'No costs logged for this trip.': 'Ingen kostnader ført for denne reisen.', 'Countries': 'Land', 'Map': 'Kart', 'Globe': 'Globus',
    /* health page */
    'Habits, training, check-ups and how your days feel. Tap a day in a habit to fill in what you missed.': 'Vaner, trening, kontroller og hvordan dagene kjennes. Trykk på en dag i en vane for å fylle inn det du gikk glipp av.',
    'Longest current streak': 'Lengste rekke nå', 'Last 30 days': 'Siste 30 dager', 'times in total': 'ganger totalt', 'All targets hit 🎉': 'Alle mål nådd 🎉', 'Current streak': 'Nåværende rekke', 'Best streak': 'Beste rekke',
    'Last 12 weeks': 'Siste 12 uker', 'Last week': 'Forrige uke', 'Last 26 weeks': 'Siste 26 uker', 'Not done': 'Ikke gjort', 'weeks': 'uker', 'Training log': 'Treningslogg', 'Check-ups & medicine': 'Kontroller og medisiner',
    'Journal': 'Dagbok', 'sessions': 'økter', 'Distance this month': 'Distanse denne måneden', 'Apple Health': 'Apple Helse', 'Steps': 'Skritt', 'Sleep': 'Søvn', 'Exercise': 'Trening', 'Resting HR': 'Hvilepuls', 'Weight': 'Vekt',
    'Active energy': 'Aktiv energi', 'Set up': 'Sett opp', 'Show Apple Health': 'Vis Apple Helse', 'Nothing received yet': 'Ingenting mottatt ennå', 'Habits that tick themselves': 'Vaner som krysses av selv',
    'Tick it automatically when…': 'Kryss av automatisk når …', 'Steps ≥': 'Skritt ≥', 'Exercise min ≥': 'Trening min ≥', 'Sleep hours ≥': 'Søvn timer ≥', 'Active kcal ≥': 'Aktive kcal ≥', 'Km walked ≥': 'Km gått ≥',
    'Remove Apple Health data from the dashboard': 'Fjern Apple Helse-data fra dashbordet', 'Short night': 'Kort natt',
    /* work page */
    'Flex time, meeting notes and what you’re learning. Switch parts on or off in Settings → Features.': 'Fleksitid, møtenotater og det du lærer. Slå deler av eller på i Innstillinger → Funksjoner.',
    'Flex time': 'Fleksitid', 'Add day': 'Legg til dag', 'Meeting notes': 'Møtenotater', 'Courses & certificates': 'Kurs og sertifikater', 'Change': 'Endre', 'days used': 'dager brukt',
    'Holiday (ferie)': 'Ferie', 'Sick': 'Syk', 'Flex day off (avspasering)': 'Avspasering', 'Course / travel': 'Kurs / reise', 'Unpaid break': 'Ubetalt pause', 'In': 'Inn', 'Out': 'Ut',
    /* settings */
    'Your profile': 'Profilen din', 'Appearance': 'Utseende', 'Features': 'Funksjoner', 'Security': 'Sikkerhet', 'Data & sync': 'Data og synk', 'Notifications': 'Varsler', 'Siri & Shortcuts': 'Siri og snarveier',
    'Log things without opening the app': 'Før ting uten å åpne appen', 'Steps, sleep and more from your iPhone': 'Skritt, søvn og mer fra iPhonen', 'Private, only you': 'Privat, bare deg', 'Public website': 'Offentlig nettside',
    'Theme': 'Tema', 'Dark': 'Mørk', 'Auto': 'Auto', 'Accent colour': 'Aksentfarge', 'Background': 'Bakgrunn', 'Background strength': 'Bakgrunnsstyrke', 'Cards': 'Kort', 'Card style': 'Kortstil',
    'Solid': 'Heldekkende', 'Glass': 'Glass', 'Minimal': 'Minimal', 'Soft': 'Myk', 'Density': 'Tetthet', 'Comfortable': 'Romslig', 'Compact': 'Kompakt', 'Corners': 'Hjørner', 'Round': 'Runde', 'Sharp': 'Skarpe',
    'Text size': 'Tekststørrelse', 'Small': 'Liten', 'Normal': 'Normal', 'Large': 'Stor', 'Everything – text, buttons and icons – grows or shrinks together': 'Alt – tekst, knapper og ikoner – blir større eller mindre sammen',
    'Motion': 'Bevegelse', 'Animations': 'Animasjoner', 'Full': 'Full', 'Subtle': 'Dempet', 'Language': 'Språk', 'English': 'English', 'Norsk': 'Norsk',
    'Name in greeting': 'Navn i hilsenen', 'Clock': 'Klokke', 'Big': 'Stor', 'Compact puts At a glance on the first screen of your phone': 'Kompakt legger Kort fortalt på første skjerm på telefonen',
    'Show seconds': 'Vis sekunder', 'Quotes': 'Sitater', 'Tips in At a glance': 'Tips i Kort fortalt', 'Streaks, unusual spending and suggestions': 'Rekker, uvanlig forbruk og forslag',
    'Adapt to the time of day': 'Tilpass etter tid på døgnet', 'Mornings: departures and weather first. Evenings: habits and money.': 'Morgen: avganger og vær først. Kveld: vaner og penger.',
    'Checklists': 'Sjekklister', 'Ready-made repeating tasks – switch off to remove them again': 'Ferdige gjentakende oppgaver – slå av for å fjerne dem igjen', 'Home maintenance': 'Vedlikehold hjemme',
    'Drag the grip to change the order on your dashboard': 'Dra i håndtaket for å endre rekkefølgen på dashbordet', 'Lock after no activity': 'Lås etter inaktivitet', 'Lock now': 'Lås nå', 'Change passcode': 'Endre kode',
    'Sync now': 'Synk nå', 'Download encrypted backup': 'Last ned kryptert sikkerhetskopi', 'Restore from a backup': 'Gjenopprett fra sikkerhetskopi', 'Replaces what\'s here and on your other devices': 'Erstatter det som er her og på de andre enhetene dine',
    'Restore this backup?': 'Gjenopprette denne sikkerhetskopien?', 'Restore': 'Gjenopprett', 'You haven’t taken one yet': 'Du har ikke tatt en ennå', 'Time for a backup': 'På tide med en sikkerhetskopi', 'Download': 'Last ned',
    'Notifications on this device': 'Varsler på denne enheten', 'What to remind you of': 'Hva du vil bli minnet på', 'Events': 'Hendelser', 'Before things in your calendar': 'Før ting i kalenderen',
    'Tasks with a day': 'Oppgaver med dag', '09:00 on the day': '09:00 på dagen', 'Payday': 'Lønningsdag', 'The evening before you leave, 19:00': 'Kvelden før du drar, 19:00', 'Sunday 18:00': 'Søndag 18:00',
    'What they say': 'Hva de sier', 'Text': 'Tekst', 'Send a test notification': 'Send et testvarsel', 'Type a line – for Siri': 'Skriv en linje – for Siri', 'New task': 'Ny oppgave', 'Opens the expense form': 'Åpner utgiftsskjemaet',
    'Everyday': 'Hverdag', 'Finance': 'Økonomi', 'Switch parts on or off': 'Slå deler av eller på', 'Your details and photo – private': 'Detaljene og bildet ditt – privat',
    'Theme, colours, background, cards, glass, motion': 'Tema, farger, bakgrunn, kort, glass, bevegelse', 'Greeting, cards and their order': 'Hilsen, kort og rekkefølgen deres',
    'Categories, week numbers, holidays': 'Kategorier, ukenummer, helligdager', 'Passcode, auto-lock': 'Kode, automatisk lås', 'Backup, sync': 'Sikkerhetskopi, synk', 'Synced': 'Synkronisert',
    'Announcement': 'Kunngjøring', 'Front page': 'Forside', 'Texts': 'Tekster', 'Featured': 'Utvalgt', 'Articles & projects': 'Artikler og prosjekter', 'Visitors': 'Besøkende', 'Socials': 'Sosiale medier',
    'Publish': 'Publiser', 'Project progress': 'Prosjektfremdrift', 'Profile': 'Profil', 'Experience': 'Erfaring', 'Education': 'Utdanning', 'Skills': 'Ferdigheter', 'Languages': 'Språk', 'Interests': 'Interesser',
    /* features */
    'Events, repeats and your phone calendar': 'Hendelser, gjentakelser og telefonkalenderen', 'Departures, journey planner, trips and documents': 'Avganger, reiseplanlegger, reiser og dokumenter',
    'Budget, spending, savings and net worth': 'Budsjett, utgifter, sparing og nettoformue', 'Weekly habits with streaks, on the Health page': 'Ukentlige vaner med rekker, på Helse-siden',
    'Clock in and out, flex balance and holiday days (fleksitid)': 'Stemple inn og ut, fleksisaldo og feriedager', 'Notes with action points you can send to your to-do list': 'Notater med tiltak du kan sende til gjøremålene',
    'What you learn, and certificates that need renewing': 'Det du lærer, og sertifikater som må fornyes', 'Workouts with time, distance and how it felt': 'Økter med tid, distanse og hvordan det føltes',
    'Doctor and dentist, vaccines and prescriptions – with reminders': 'Lege og tannlege, vaksiner og resepter – med påminnelser', 'One line a day and your mood': 'Én linje om dagen og humøret ditt',
    'Steps, sleep, heart rate and exercise from your iPhone': 'Skritt, søvn, puls og trening fra iPhonen', 'Your bucket list, on the map – turn one into a trip': 'Ønskelisten din, på kartet – gjør et sted om til en reise',
    'What you pay every month and when it renews': 'Det du betaler hver måned og når det fornyes', 'Know when the warranty (reklamasjon) runs out': 'Vit når reklamasjonsretten går ut', 'Places to visit': 'Steder å besøke',
    /* pieces of sentences with an amount in between */
    'On track – about': 'I rute – rundt', 'left at the end of the month': 'igjen ved månedsslutt', 'left at payday': 'igjen ved lønning', 'At this pace': 'I dette tempoet',
    'over by payday · keep to': 'over til lønning · hold deg til', 'over this month · keep to': 'over denne måneden · hold deg til', '/day': '/dag', 'left this month ·': 'igjen denne måneden ·',
    'left this month · of': 'igjen denne måneden · av', 'net income ·': 'netto inntekt ·', 'overdue': 'over fristen', 'due today': 'forfaller i dag', '% on target': '% på mål', 'times in': 'ganger i',
    'Training habit': 'Treningsvane', 'Total': 'Totalt', 'Add your accounts and loans. Update the balances now and then, and the chart shows how your net worth develops.': 'Legg til kontoer og lån. Oppdater saldoene av og til, så viser grafen hvordan nettoformuen utvikler seg.',
    'Tap “Clock in” when you start, “Clock out” when you leave. Holidays and flex days off go in with “Add day”.': 'Trykk «Stemple inn» når du begynner og «Stemple ut» når du går. Ferie og avspasering legger du inn med «Legg til dag».',
    'Show your iPhone, Google or Outlook calendar here, read-only. The link is stored encrypted with your passcode.': 'Vis iPhone-, Google- eller Outlook-kalenderen din her, bare for lesing. Lenken lagres kryptert med koden din.',
    'Calendar link': 'Kalenderlenke', 'Calendar name': 'Navn på kalenderen', 'great': 'flott', 'good': 'bra', 'meh': 'så som så', 'bad': 'dårlig', 'Great': 'Flott', 'Good': 'Bra', 'Meh': 'Så som så', 'Bad': 'Dårlig',
    'Jan': 'jan', 'Feb': 'feb', 'Mar': 'mar', 'Apr': 'apr', 'May': 'mai', 'Jun': 'jun', 'Jul': 'jul', 'Aug': 'aug', 'Sept': 'sep', 'Sep': 'sep', 'Oct': 'okt', 'Nov': 'nov', 'Dec': 'des',
    'Mon': 'man', 'Tue': 'tir', 'Wed': 'ons', 'Thu': 'tor', 'Fri': 'fre', 'Sat': 'lør', 'Sun': 'søn', 'Mo': 'ma', 'Tu': 'ti', 'We': 'on', 'Th': 'to', 'Fr': 'fr', 'Sa': 'lø', 'Su': 'sø',
    'Training log ': 'Treningslogg', 'Steps, sleep, resting heart rate, exercise and weight from your iPhone, once a day. A Shortcut sends the numbers to your server; the dashboard picks them up, keeps them encrypted with the rest and deletes them from the server.': 'Skritt, søvn, hvilepuls, trening og vekt fra iPhonen, én gang om dagen. En snarvei sender tallene til serveren din; dashbordet henter dem, lagrer dem kryptert sammen med resten og sletter dem fra serveren.',
    /* the quotes under the clock */
    "The best time to plant a tree was 20 years ago. The second best time is now.": "Den beste tiden å plante et tre var for 20 år siden. Den nest beste er nå.",
    "Believe you can and you're halfway there.": "Tro at du kan, så er du halvveis.",
    "It does not matter how slowly you go as long as you do not stop.": "Det spiller ingen rolle hvor sakte du går, så lenge du ikke stopper.",
    "You are never too old to set another goal or to dream a new dream.": "Du er aldri for gammel til å sette deg et nytt mål eller drømme en ny drøm.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.": "Suksess er ikke endelig, nederlag er ikke dødelig: det er motet til å fortsette som teller.",
    "Don't watch the clock; do what it does. Keep going.": "Ikke se på klokka – gjør som den. Fortsett.",
    "It always seems impossible until it's done.": "Det virker alltid umulig helt til det er gjort.",
    "The only way to do great work is to love what you do.": "Den eneste måten å gjøre en god jobb på er å elske det du gjør.",
    "You have power over your mind, not outside events. Realize this, and you will find strength.": "Du har makt over tankene dine, ikke over det som skjer rundt deg. Innse det, og du finner styrke.",
    "The happiness of your life depends upon the quality of your thoughts.": "Lykken i livet ditt avhenger av kvaliteten på tankene dine.",
    "Waste no more time arguing about what a good man should be. Be one.": "Ikke bruk mer tid på å diskutere hva et godt menneske er. Vær et.",
    "What we do now echoes in eternity.": "Det vi gjør nå, gir gjenklang i evigheten.",
    "If it is not right, do not do it; if it is not true, do not say it.": "Er det ikke riktig, så gjør det ikke. Er det ikke sant, så si det ikke.",
    "Be tolerant with others and strict with yourself.": "Vær tolerant mot andre og streng mot deg selv.",
    "The art of living is more like wrestling than dancing.": "Livets kunst ligner mer på bryting enn på dans.",
    "Well begun is half done.": "Godt begynt er halvt fullendt.",
    "Small daily improvements are the key to staggering long-term results.": "Små forbedringer hver dag gir store resultater over tid.",
    "Discipline is choosing between what you want now and what you want most.": "Disiplin er å velge mellom det du vil ha nå og det du vil ha mest.",
    "We are what we repeatedly do.": "Vi er det vi gjør, gang på gang.",
    "Do the hard jobs first. The easy jobs will take care of themselves.": "Gjør de tunge jobbene først. De lette ordner seg selv.",
    /* toasts */
    'Task added': 'Oppgave lagt til', 'Note saved': 'Notat lagret', 'Workout logged': 'Økt ført', 'Task deleted': 'Oppgave slettet', 'Done tasks cleared': 'Ferdige oppgaver fjernet'
  };
  var DAYS = { day: 'dag', days: 'dager', week: 'uke', weeks: 'uker', month: 'måned', months: 'måneder', hour: 'time', hours: 'timer', minute: 'minutt', minutes: 'minutter', year: 'år', years: 'år' };
  function u(n, w) { return n + ' ' + (DAYS[w] || w); }
  function dg(n) { return n + (+n === 1 ? ' dag' : ' dager'); }
  /* patterns for sentences with numbers, dates and names in them */
  var P = [
    [/^(.+?) · (\d{2}:\d{2})$/, function (m, a, b) { var t = tr(a); return t !== a ? t + ' · ' + b : null; }],
    [/^Synced across your devices · (.+)$/, 'Synkronisert på enhetene dine · $1'],
    [/^Week (\d+)$/, 'Uke $1'], [/^(.+) · Week (\d+)$/, '$1 · uke $2'],
    [/^in (\d+) (days?|weeks?|months?|hours?|minutes?)$/i, function (m, n, w) { return 'om ' + u(n, w.toLowerCase()); }],
    [/^(\d+) (days?|weeks?|months?|hours?|minutes?) ago$/, function (m, n, w) { return 'for ' + u(n, w) + ' siden'; }],
    [/^(\d+) (days?|weeks?|months?)$/, function (m, n, w) { return u(n, w); }],
    [/^tomorrow$/, 'i morgen'], [/^yesterday$/, 'i går'], [/^Tomorrow$/, 'I morgen'], [/^Yesterday$/, 'I går'], [/^Today$/, 'I dag'],
    [/^Due (.+)$/, 'Frist $1'], [/^Due in (\d+) days?$/, function (m, n) { return 'Forfaller om ' + dg(n); }], [/^Overdue by (\d+) days?$/, function (m, n) { return dg(n) + ' over fristen'; }], [/^due (.+)$/, 'frist $1'],
    [/^Show all (\d+)$/, 'Vis alle $1'], [/^(\d+) tips?$/, '$1 tips'], [/^(\d+) of (\d+)$/, '$1 av $2'],
    [/^(.+) kr to spend today$/, '$1 kr å bruke i dag'], [/^(.+) kr left this month$/, '$1 kr igjen denne måneden'], [/^(.+) kr left until payday$/, '$1 kr igjen til lønning'],
    [/^(.+) kr over budget$/, '$1 kr over budsjett'], [/^left this month · (.+)\/day$/, 'igjen denne måneden · $1/dag'], [/^left until payday · (.+)\/day$/, 'igjen til lønning · $1/dag'],
    [/^On track – about (.+) left at the end of the month$/, 'I rute – rundt $1 igjen ved månedsslutt'], [/^On track – about (.+) left at payday$/, 'I rute – rundt $1 igjen ved lønning'],
    [/^At this pace (.+) over (by payday|this month) · keep to (.+)\/day$/, function (m, a, b, c) { return 'I dette tempoet ' + a + ' over ' + (b === 'by payday' ? 'til lønning' : 'denne måneden') + ' · hold deg til ' + c + '/dag'; }],
    [/^At this pace: (.+) over by (payday|the end of the month)$/, function (m, a, b) { return 'I dette tempoet: ' + a + ' over ' + (b === 'payday' ? 'til lønning' : 'ved månedsslutt'); }],
    [/^Spent in (.+)$/, 'Brukt i $1'], [/^Spent since payday$/, 'Brukt siden lønning'], [/^Income in (.+)$/, 'Inntekt i $1'],
    [/^(.+) is overdue$/, '$1 er over fristen'], [/^(.+) due today$/, '$1 forfaller i dag'], [/^(.+) due in (\d+) days?$/, function (m, a, n) { return a + ' forfaller om ' + dg(n); }],
    [/^(.+) · was due (\d+) days? ago$/, function (m, a, n) { return a + ' · forfalt for ' + dg(n) + ' siden'; }], [/^was due (\d+) days? ago$/, function (m, n) { return 'forfalt for ' + dg(n) + ' siden'; }],
    [/^(.+) in (\d+) days$/, function (m, a, n) { return a + ' om ' + n + ' dager'; }],
    [/^(.+): (\d+)% more than usual$/, function (m, a, n) { return tr(a) + ': ' + n + ' % mer enn vanlig'; }],
    [/^(.+): (\d+) weeks in a row$/, '$1: $2 uker på rad'], [/^Keep it going this week$/, 'Hold det gående denne uka'],
    [/^(\d+) workdays? during (.+)$/, function (m, n, a) { return n + (+n === 1 ? ' arbeidsdag' : ' arbeidsdager') + ' under ' + a; }], [/^Mark (them|it) as holiday \(ferie\) in Flex time\?$/, 'Føre som ferie i fleksitid?'], [/^Mark as holiday$/, 'Før som ferie'],
    [/^Last one (\d+) days ago$/, 'Siste for $1 dager siden'], [/^Last one (.+)$/, 'Siste $1'], [/^You haven’t downloaded one yet – it takes a second$/, 'Du har ikke lastet ned en ennå – det tar et sekund'],
    [/^Short night: (.+)$/, 'Kort natt: $1'], [/^Go easy today – and maybe to bed a bit earlier$/, 'Ta det rolig i dag – og kanskje legg deg litt tidligere'],
    [/^(.+) looks like a subscription$/, '$1 ser ut som et abonnement'], [/^Add to subscriptions$/, 'Legg til abonnementer'], [/^Make it a fixed cost$/, 'Gjør det til en fast kostnad'],
    [/^Show (.+)$/, function (m, a) { var t = tr(a); return t !== a ? 'Vis ' + t : null; }], [/^Move (.+) (up|down)$/, function (m, a, b) { return 'Flytt ' + tr(a) + (b === 'up' ? ' opp' : ' ned'); }],
    [/^Remove (.+)$/, function (m, a) { return 'Fjern ' + a; }], [/^Done: (.+)$/, 'Ferdig: $1'], [/^Focus on (.+)$/, 'Fokus på $1'], [/^Day for (.+)$/, 'Dag for $1'],
    [/^Mark (.+) as paid$/, 'Merk $1 som betalt'], [/^Due day for (.+)$/, 'Forfallsdag for $1'], [/^Edit (.+)$/, function (m, a) { return 'Endre ' + a; }],
    [/^Last 4 weeks · (\d+) days? in a row · this week: (.+)$/, function (m, n, w) { return 'Siste 4 uker · ' + dg(n) + ' på rad · denne uka: ' + tr(w); }],
    [/^(\d+) days? from Apple Health · last (.+)$/, function (m, n, a) { return dg(n) + ' fra Apple Helse · sist ' + a; }],
    [/^7-day avg (.+)$/, 'Snitt 7 dager $1'], [/^(.+), last (\d+) days(.*)$/, function (m, a, n, b) { return tr(a) + ', siste ' + n + ' dager' + b.replace(' · line: ', ' · linje: ').replace(' · updated ', ' · oppdatert '); }],
    [/^(7|14|30) days$/, '$1 dager'], [/^All numbers this day \((\d+)\)$/, 'Alle tall denne dagen ($1)'], [/^(.+) ticked$/, '$1 krysset av'],
    [/^(.+) above the goal$/, '$1 over målet'], [/^up (.+) in (\d+) days$/, 'opp $1 på $2 dager'], [/^down (.+) in (\d+) days$/, 'ned $1 på $2 dager'], [/^no change in (\d+) days$/, 'ingen endring på $1 dager'],
    [/^Move (.+) (up|down)$/, function (m, a, b) { return 'Flytt ' + tr(a) + (b === 'up' ? ' opp' : ' ned'); }], [/^(\d+) floors$/, '$1 etasjer'], [/^(.+) to go$/, '$1 igjen'], [/^(.+) short of the goal$/, '$1 under målet'], [/^Goal reached (\d+) of (\d+) days?$/, 'Mål nådd $1 av $2 dager'],
    [/^average (.+)$/, 'snitt $1'], [/^best (.+)$/, 'best $1'], [/^lowest (.+)$/, 'lavest $1'], [/^Goal (\d[^·]*)$/, 'Mål $1'], [/^Goal for (.+)$/, function (m, a) { return 'Mål for ' + tr(a).toLowerCase(); }],
    [/^Updated (.+)$/, 'Oppdatert $1'], [/^(\d+)% of (.+)$/, '$1 % av $2'], [/^(.+): no data$/, function (m, a) { return tr(a) + ': ingen data'; }], [/^(Today|Yesterday): (.+)$/, function (m, a, b) { return tr(a) + ': ' + b; }],
    [/^History builds up by itself – one more day every evening \(since (.+)\)\.$/, 'Historikken bygger seg opp av seg selv – én dag til hver kveld (siden $1).'],
    [/^(\d+) tasks in your To-do$/, '$1 oppgaver i Gjøremål'], [/^(\d+) of (\d+) cards · (.+)$/, '$1 av $2 kort · $3'], [/^Locks after (.+)$/, 'Låses etter $1'],
    [/^(\d+) of (\d+) on · (\d+) extra$/, '$1 av $2 på · $3 ekstra'], [/^(\d+) of (\d+) weeks on target$/, '$1 av $2 uker på mål'],
    [/^Normal day (.+) h · (\d+) holiday days a year ·$/, 'Normal dag $1 t · $2 feriedager i året ·'], [/^(.+) h day · (\d+) holiday days$/, '$1 t dag · $2 feriedager'],
    [/^Holiday (\d{4})$/, 'Ferie $1'], [/^of (.+)$/, 'av $1'], [/^vs (.+)$/, 'mot $1'], [/^(\d+) expenses?$/, function (m, n) { return n + (+n === 1 ? ' utgift' : ' utgifter'); }],
    [/^Done – next (.+)$/, 'Ferdig – neste $1'], [/^(.+) logged$/, '$1 ført'], [/^(.+) added (.+)$/, function (m, a, b) { return a + ' lagt til ' + tr(b); }],
    [/^(.+) · today$/, '$1 · i dag'], [/^(.+) · tomorrow$/, '$1 · i morgen'], [/^Today · (.+)$/, 'I dag · $1'], [/^Tomorrow · (.+)$/, 'I morgen · $1'],
    [/^At (\d{2}:\d{2})(.*)$/, 'Kl. $1$2'], [/^In (\d+) min(.*)$/, 'Om $1 min$2'], [/^Now, until (.+)$/, 'Nå, til $1'], [/^Tomorrow at (.+)$/, 'I morgen kl. $1'],
    [/^(.+) · no packing list yet$/, '$1 · ingen pakkeliste ennå'], [/^Expires (.+)$/, 'Utløper $1'], [/^Renews (.+)$/, 'Fornyes $1'], [/^Renews: (.+)$/, 'Fornyes: $1'],
    [/^Week (\d+) · (.+)$/, 'Uke $1 · $2'], [/^Last bank import (.+)\.$/, function (m, a) { return 'Siste bankimport ' + tr(a) + '.'; }], [/^Last backup (.+)\.$/, function (m, a) { return 'Siste sikkerhetskopi ' + tr(a) + '.'; }],
    [/^(\d+) days ago$/, 'for $1 dager siden'],
    [/^Good (morning|afternoon|evening|night), (.+)$/, function (m, a, n) { return { morning: 'God morgen', afternoon: 'God ettermiddag', evening: 'God kveld', night: 'God natt' }[a] + ', ' + n; }],
    [/^(.+): (.+ kr)$/, function (m, a, b) { var t = tr(a); return t !== a ? t + ': ' + b : null; }],
    [/^(\d+) % of what you can spend$/, '$1 % av det du kan bruke'], [/^(\d+)× per week$/, '$1× per uke'], [/^times in (\d{4})$/, 'ganger i $1'],
    [/^(\d.*) steps a day$/, '$1 skritt om dagen'], [/^(\d.*) sleep$/, '$1 søvn'], [/^(\d.*) exercise$/, '$1 trening'], [/^left in (.+) ·$/, 'igjen i $1 ·'],
    [/^per day for the rest of (.+)$/, 'per dag resten av $1'], [/^· this week (.+)$/, '· denne uka $1'], [/^All (\d+) in (.+)$/, 'Alle $1 i $2'], [/^Budget (.+)$/, 'Budsjett $1'],
    [/^(.+) · this week: (great|good|OK|meh|bad)$/, function (m, a, b) { return tr(a) + ' · denne uka: ' + tr(b); }]
  ];
  var busy = false;
  function tr(s) {
    var t = String(s).trim(); if (!t) return s;
    var r = Object.prototype.hasOwnProperty.call(D, t) ? D[t] : null;
    if (r == null) for (var i = 0; i < P.length; i++) {
      var m = t.match(P[i][0]); if (!m) continue;
      r = typeof P[i][1] === 'function' ? P[i][1].apply(null, m) : t.replace(P[i][0], P[i][1]);
      if (r != null) break;
    }
    /* "Groceries · 27 Oct · today": translate each part */
    if (r == null && t.indexOf(' · ') > 0) {
      var parts = t.split(' · '), ch = false;
      parts = parts.map(function (x) { var y = tr(x); if (y !== x) ch = true; return y; });
      if (ch) r = parts.join(' · ');
    }
    return r == null ? s : String(s).replace(t, r);
  }
  window.I18N.t = function (s) { return tr(s); };
  /* never touch your own words */
  var SKIP = 'script,style,textarea,input,.todo-item .label,.note-body,.notes-list,.sc-url,code,[data-noi18n],.tx-text strong,.ce-title,.cl-ev-t,.ci-x b,.im-x b';
  var ATTR = ['placeholder', 'aria-label', 'title', 'data-title'];
  function textNode(n) {
    var p = n.parentElement; if (!p || p.closest(SKIP)) return;
    var v = n.nodeValue; if (!/[A-Za-z]/.test(v)) return;
    var w = tr(v); if (w !== v) n.nodeValue = w;
  }
  function el(e) {
    if (e.nodeType !== 1 || e.closest('script,style')) return;
    ATTR.forEach(function (a) { var v = e.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { var w = tr(v); if (w !== v) e.setAttribute(a, w); } });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1) return;
    el(root);
    root.querySelectorAll('[placeholder],[aria-label],[title],[data-title]').forEach(el);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) textNode(n);
  }
  function run(muts) {
    if (busy) return; busy = true;
    try {
      muts.forEach(function (m) {
        if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') el(m.target);
        else m.addedNodes.forEach(walk);
      });
    } finally { busy = false; }
  }
  function start() {
    walk(document.body);
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
} catch (e) { console.error("i18n.js", e); }
/* ===== lock.js ===== */
try {
/* Lock screen + encrypted vault for the dashboard.
   Your passcode never leaves this device and is never stored. It is turned into an
   AES-256 key (PBKDF2-SHA-256, 310 000 rounds) that encrypts the finance data in
   this browser's storage. Without the passcode the data cannot be read.
   Sync: if the Cloudflare worker (/_cloudflare/worker.js) is set up, the same
   encrypted blob is copied to Cloudflare so every device you log in on gets it.
   Cloudflare only ever sees the encrypted version. */
(function () {
  "use strict";

  var VAULT_KEY = 'dash.vault';
  var FAIL_KEY = 'dash.fails';
  var ITER = 310000;
  /* Stays unlocked on this device until this long without activity (Settings → Security). */
  function idleMs() {
    var m = 60;
    try { m = (JSON.parse(localStorage.getItem('dash.settings')) || {}).lockMins || 60; } catch (e) {}
    return Math.max(5, Math.min(m, 1440)) * 60 * 1000;
  }

  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  var API = '/cmd/api/vault';
  var SYNC_KEY = 'dash.syncRev';
  var WIDGET_KEYS = ['dash.goals', 'dash.todos', 'dash.links', 'dash.notes', 'dash.settings', 'dash.transit', 'dash.habits', 'dash.travel', 'dash.calendar', 'dash.tools', 'dash.profile'];

  var key = null;          // CryptoKey while unlocked, null when locked
  var salt = null;
  var data = null;         // decrypted vault contents while unlocked
  var writing = Promise.resolve();
  var idleTimer = null;
  var lastActive = 0;
  var savedAt = 0;
  var unlockFns = [];
  var remote = null;       // newest vault found on the server (while locked)
  var remoteRev = null;    // rev on the server, if known
  var ignoreRemote = false;
  var syncState = 'off';
  var available = false;
  var remoteCheck = Promise.resolve();
  var remoteSalt = null;  // salt of the synced vault, if known   // true once the sync worker has answered
  var pushTimer = null;
  var pushing = false;
  var lockFns = [];

  /* ---------- helpers ---------- */
  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function derive(pass, saltBytes, iter) {
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: saltBytes, iterations: iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function widgets() {
    var w = {};
    WIDGET_KEYS.forEach(function (k) { var v = readJSON(k); if (v !== null) w[k] = v; });
    return w;
  }

  function seal(obj, k, s, rev) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plain = Object.assign({}, obj, { _w: widgets() });
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(plain)))
      .then(function (ct) { return { v: 1, rev: rev || 0, iter: ITER, salt: b64(s), iv: b64(iv), ct: b64(ct) }; });
  }

  /* Takes widgets (to-dos, notes …) out of a decrypted vault and puts them on screen. */
  function unpack(obj) {
    obj = obj || {};
    if (obj._w) {
      var w = obj._w;
      delete obj._w;
      Object.keys(w).forEach(function (k) { if (WIDGET_KEYS.indexOf(k) > -1) writeJSON(k, w[k]); });
      if (window.Dash && window.Dash.reload) window.Dash.reload();
    }
    return obj;
  }
  function localRev() { var v = readJSON(VAULT_KEY); return v && v.rev || 0; }
  function syncedRev() { var n = readJSON(SYNC_KEY); return typeof n === 'number' ? n : -1; }

  function open(vault, k) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, k, unb64(vault.ct))
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  function isVault(v) { return v && v.v === 1 && v.salt && v.iv && v.ct; }

  /* ---------- lock screen UI ---------- */
  var mode = 'unlock';   // 'setup' | 'unlock' | 'reset'

  function setMode(m) {
    mode = m;
    var setup = m === 'setup';
    $('lockTitle').textContent = setup ? 'Create a passcode' : m === 'reset' ? 'Start over?' : 'Welcome back';
    $('lockSub').textContent = setup
      ? 'Choose at least 6 characters. It encrypts your finances on this device.'
      : m === 'reset'
        ? 'This erases your encrypted finance data on this device and on your other devices. To-dos, notes and links stay on this device.'
        : 'Enter your passcode to open the dashboard.';
    $('lockForm').hidden = m === 'reset';
    $('lockConfirm').hidden = !setup;
    $('lockConfirm').required = setup;
    $('lockPass').setAttribute('autocomplete', setup ? 'new-password' : 'current-password');
    $('lockSubmit').textContent = setup ? 'Create and open' : 'Unlock';
    $('lockForgot').hidden = m !== 'unlock';
    $('lockRestore').hidden = !setup;
    $('lockReset').hidden = m !== 'reset';
    $('lockWarn').hidden = !setup;
    msg('');
    $('lockPass').value = '';
    $('lockConfirm').value = '';
    if (m !== 'reset') setTimeout(function () { try { $('lockPass').focus({ preventScroll: true }); } catch (e) {} }, 60);
  }

  function msg(text, ok) {
    var el = $('lockMsg');
    el.textContent = text;
    el.classList.toggle('ok', !!ok);
  }

  function shake() {
    var box = $('lockBox');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }

  function busy(on) {
    $('lockSubmit').disabled = on;
    $('lockBox').classList.toggle('busy', on);
  }

  /* Slows down guessing: after 5 wrong tries you wait 30 s, then 1 min, 2 min … up to 15 min. */
  function waitLeft() {
    var f = readJSON(FAIL_KEY);
    return f && f.until ? Math.max(0, f.until - Date.now()) : 0;
  }
  function addFail() {
    var f = readJSON(FAIL_KEY) || { n: 0 };
    f.n += 1;
    if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60, 30 * Math.pow(2, f.n - 5)) * 1000;
    writeJSON(FAIL_KEY, f);
  }

  function showLocked(note) {
    root.classList.add('locked');
    root.classList.remove('unlocked', 'resuming');
    $('lock').hidden = false;
    remote = null;
    setMode(isVault(readJSON(VAULT_KEY)) ? 'unlock' : 'setup');
    if (note) msg(note);
    /* Look for a newer synced version (e.g. made on your phone) before unlocking. */
    remoteCheck = Promise.race([
      getRemote(),
      new Promise(function (r) { setTimeout(r, 6000); })   // never wait forever when offline
    ]).then(function (v) {
      if (!v || ignoreRemote || key) return;
      var local = readJSON(VAULT_KEY);
      var foreign = isVault(local) && syncedRev() === -1 && v.salt !== local.salt;
      if (!isVault(local) || foreign || (v.rev || 0) > (local.rev || 0)) {
        remote = v;
        if (mode === 'setup') { setMode('unlock'); msg('Found your synced dashboard. Enter your passcode.', true); }
      }
    });
  }

  function finishUnlock() {
    removeKey(FAIL_KEY);
    ignoreRemote = false;
    $('lockPass').value = '';
    $('lockConfirm').value = '';
    $('lockPass').blur();
    root.classList.remove('locked', 'resuming');
    root.classList.add('unlocked');
    $('lock').hidden = true;
    $('lockBox').style.visibility = '';
    resetIdle(true);
    emit();
    sync();
  }
  function emit() {
    unlockFns.forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
  }

  function lock(note) {
    if (typeof note !== 'string') note = '';
    /* Normal lock: upload the last change first. Locked because of a passcode mismatch: never upload. */
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; if (key && !note) push(); }
    key = null;
    data = null;
    salt = null;
    clearTimeout(idleTimer);
    forget();
    lockFns.forEach(function (fn) { try { fn(); } catch (e) {} });
    showLocked(note);
  }

  $('lockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pass = $('lockPass').value;
    var wait = waitLeft();
    if (wait > 0) { msg('Too many tries. Wait ' + Math.ceil(wait / 1000) + ' s.'); shake(); return; }

    if (mode === 'setup') {
      if (pass.length < 6) { msg('Use at least 6 characters.'); shake(); return; }
      if (pass !== $('lockConfirm').value) { msg('The two passcodes don’t match.'); shake(); return; }
      busy(true);
      salt = crypto.getRandomValues(new Uint8Array(16));
      derive(pass, salt, ITER)
        .then(function (k) {
          key = k; data = {};
          return seal(data, key, salt, remoteRev !== null ? remoteRev + 1 : 1);
        })
        .then(function (v) {
          busy(false);
          if (!writeJSON(VAULT_KEY, v)) { msg('This browser blocks storage (private mode?).'); key = null; return; }
          if (remoteRev !== null) writeJSON(SYNC_KEY, remoteRev);
          finishUnlock();
        })
        .catch(function () { busy(false); msg('This browser can’t encrypt. Try Safari or Chrome.'); });
      return;
    }

    if (!pass) { shake(); return; }
    busy(true);
    remoteCheck.then(function () { tryUnlock(pass); });
  });

  function tryUnlock(pass) {
    var vault = remote || readJSON(VAULT_KEY);
    if (!isVault(vault)) { busy(false); setMode('setup'); return; }
    var fromRemote = vault === remote;
    var s = unb64(vault.salt), k;
    derive(pass, s, vault.iter || ITER)
      .then(function (kk) { k = kk; return open(vault, k); })
      .then(function (obj) {
        key = k; salt = s;
        if (fromRemote) { writeJSON(VAULT_KEY, vault); writeJSON(SYNC_KEY, vault.rev || 0); remote = null; }
        data = unpack(obj);
        busy(false);
        finishUnlock();
      })
      .catch(function () {
        busy(false);
        addFail();
        $('lockPass').value = '';
        var w = waitLeft();
        msg(w > 0 ? 'Wrong passcode. Wait ' + Math.ceil(w / 1000) + ' s.' : 'Wrong passcode.');
        shake();
      });
  }

  $('lockForgot').addEventListener('click', function () { setMode('reset'); });
  $('lockCancelReset').addEventListener('click', function () { setMode('unlock'); });
  $('lockDoReset').addEventListener('click', function () {
    removeKey(VAULT_KEY);
    removeKey(FAIL_KEY);
    remote = null;
    ignoreRemote = true;
    setMode('setup');
    msg('Erased. Create a new passcode.', true);
  });

  /* Restore an encrypted backup (e.g. on a new phone). Then unlock with the old passcode. */
  $('lockRestore').addEventListener('click', function () { $('lockFile').click(); });
  $('lockFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    file.text().then(function (t) {
      var v = JSON.parse(t);
      if (!isVault(v)) throw new Error('bad');
      v.rev = Math.max(v.rev || 0, remoteRev !== null ? remoteRev + 1 : 0, localRev() + 1);
      writeJSON(VAULT_KEY, v);
      remote = null;
      ignoreRemote = true;
      setMode('unlock');
      msg('Backup loaded. Enter the passcode it was made with.', true);
    }).catch(function () { msg('That file isn’t a dashboard backup.'); shake(); });
  });

  /* ---------- auto-lock ---------- */
  function resetIdle(force) {
    if (!key) return;
    lastActive = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lock, idleMs());
    if (force === true || lastActive - savedAt > 60 * 1000) remember();
  }

  /* ---------- stay unlocked on this device ----------
     The key is kept in this browser's IndexedDB as a non-extractable CryptoKey:
     the page can use it, but it can't be read out or copied. It expires after
     an hour without activity, and the lock button deletes it at once. */
  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('dash-lock', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('k'); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var db = req.result, tx = db.transaction('k', mode), q = fn(tx.objectStore('k'));
        tx.oncomplete = function () { db.close(); resolve(q && q.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function remember() {
    if (!key || !salt) return;
    savedAt = Date.now();
    var rec = { key: key, salt: b64(salt), until: savedAt + idleMs() };
    idb('readwrite', function (st) { return st.put(rec, 'session'); }).catch(function () {});
    try { localStorage.setItem('dash.until', String(rec.until)); } catch (e) {}     // lets the next page skip the lock screen flash
  }
  function forget() { savedAt = 0; try { localStorage.removeItem('dash.until'); } catch (e) {} idb('readwrite', function (st) { return st.delete('session'); }).catch(function () {}); }
  function recall() {
    if (!window.indexedDB) return Promise.resolve(null);
    return Promise.race([
      idb('readonly', function (st) { return st.get('session'); }),
      new Promise(function (r) { setTimeout(function () { r(null); }, 1500); })
    ]).catch(function () { return null; });
  }

  function tooLongAway() { return key && lastActive && Date.now() - lastActive > idleMs(); }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, resetIdle, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (tooLongAway()) { lock(); return; }
    if (key) sync();
  });
  setInterval(function () { if (key && !document.hidden) sync(); }, 60 * 1000);
  document.addEventListener('click', function (e) { if (key && e.target.closest('#syncState')) sync(); });
  window.addEventListener('online', function () { if (key) sync(); });
  /* To-dos, notes, goals and links changed: include them in the encrypted vault. */
  window.addEventListener('dash:local', function () { if (key) window.Vault.save(data); });

  /* ---------- sync with Cloudflare ---------- */
  function setSync(state, why) {
    syncState = state;
    var el = $('syncState');
    if (!el) return;
    var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = {
      off: '<i class="bi bi-phone"></i> Saved on this device only',
      busy: '<i class="bi bi-arrow-repeat spin"></i> Syncing…',
      ok: '<i class="bi bi-cloud-check"></i> Synced across your devices · ' + t,
      offline: '<i class="bi bi-cloud-slash"></i> Offline. Changes sync when you’re back online'
    }[state] + (why ? '<span class="sync-why">' + why + ' · tap to retry</span>' : '');
    el.className = 'sync sync-' + state;
  }

  /* Returns the server's vault, null if there is none, or undefined if sync isn't available. */
  function getRemote() {
    return fetch(API, { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) {
        var isJson = (r.headers.get('content-type') || '').indexOf('json') > -1;
        if (!isJson) {
          available = false;
          return r.text().then(function (t) {
            /* Tells you which part of the Cloudflare setup is missing. */
            var why = /hello world/i.test(t) ? 'Sync worker still has the Hello World code. Paste in the sync code and deploy'
              : r.status === 404 ? 'Sync route not active (jplundberg.com/cmd/api/*)'
              : 'Sync worker didn’t answer (' + r.status + ')';
            setSync('off', why);
            return undefined;
          });
        }
        if (r.status === 404) { available = true; remoteRev = null; remoteSalt = null; return null; }  // set up, but empty
        if (!r.ok) {
          available = false;
          setSync('off', r.status === 401 ? 'Sync refused the login. Check TEAM_DOMAIN and POLICY_AUD'
            : r.status === 503 ? 'Sync worker is missing VAULT, TEAM_DOMAIN or POLICY_AUD'
            : 'Sync error ' + r.status);
          return undefined;
        }
        available = true;
        return r.json().then(function (v) {
          if (!isVault(v)) return undefined;
          remoteRev = v.rev || 0;
          remoteSalt = v.salt;
          return v;
        });
      })
      .catch(function () {
        if (available) setSync('offline');
        else setSync('off', navigator.onLine === false ? 'No internet' : 'Cloudflare login expired. Reload the page');
        return undefined;
      });
  }

  /* Takes a newer version from another device. */
  /* ---------- merging changes from two devices ----------
     After every sync this device remembers a fingerprint (hash) of each part of the data:
     every widget (to-dos, habits, calendar …) and every top-level part of the finances.
     If another device saved in the meantime, the parts changed HERE since the last sync are
     kept, and everything else comes from the other device – instead of one side losing. */
  var BASE_KEY = 'dash.syncBase';
  function parts(obj, w) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) { if (k !== '_w') out['d:' + k] = obj[k]; });
    WIDGET_KEYS.forEach(function (k) { out['w:' + k] = w[k] === undefined ? null : w[k]; });
    return out;
  }
  function fingerprints(p) {
    var keys = Object.keys(p);
    return Promise.all(keys.map(function (k) {
      return crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(p[k]))).then(function (h) { return b64(h).slice(0, 22); });
    })).then(function (hs) { var o = {}; keys.forEach(function (k, i) { o[k] = hs[i]; }); return o; });
  }
  function recordBase(obj, w) {
    return fingerprints(parts(obj, w || widgets())).then(function (h) { writeJSON(BASE_KEY, h); }).catch(function () {});
  }
  function localChanges() {
    var base = readJSON(BASE_KEY);
    if (!base || !data) return Promise.resolve([]);
    return fingerprints(parts(data, widgets())).then(function (now) {
      var keys = Object.keys(now).concat(Object.keys(base).filter(function (k) { return !(k in now); }));
      return keys.filter(function (k) { return base[k] !== now[k]; });
    });
  }

  function adopt(v, failNote) {
    var k = key;
    return open(v, k).then(function (obj) {
      if (key !== k) return;
      return localChanges().catch(function () { return []; }).then(function (changed) {
        if (key !== k) return;
        salt = unb64(v.salt);
        writeJSON(VAULT_KEY, v);
        writeJSON(SYNC_KEY, v.rev || 0);
        remoteRev = v.rev || 0;
        var w = obj._w || {};
        if (!changed.length || failNote) {           // nothing new here: take the other device's version
          data = unpack(obj);
          recordBase(data, w);
          emit();
          setSync('ok');
          return;
        }
        /* both devices changed something: keep this device's changed parts */
        recordBase(obj, w);                          // what the server has now (before merging)
        w = JSON.parse(JSON.stringify(w));
        var mine = widgets(), merged = {};
        Object.keys(obj).forEach(function (x) { if (x !== '_w') merged[x] = obj[x]; });
        changed.forEach(function (c) {
          var name = c.slice(2);
          if (c.indexOf('d:') === 0) { if (data && name in data) merged[name] = data[name]; else delete merged[name]; }
          else if (mine[name] !== undefined) w[name] = mine[name]; else delete w[name];
        });
        merged._w = w;
        data = unpack(merged);
        emit();
        return window.Vault.save(data);           // new version on top of the other device's, then upload
      });
    }, function () {
      /* Encrypted with another passcode: it was changed on another device. */
      lock(failNote || 'Your passcode was changed on another device. Use the new one.');
    });
  }

  function sync() {
    if (!key) return Promise.resolve();
    setSync('busy');
    return getRemote().then(function (v) {
      if (v === undefined || !key) return;
      var lr = localRev();
      var local = readJSON(VAULT_KEY);
      /* This device made its own vault before it ever synced: never overwrite the synced one. */
      if (v && syncedRev() === -1 && local && v.salt !== local.salt) {
        return adopt(v, 'You already have a synced dashboard. Enter its passcode to use it on this device.');
      }
      if (v && (v.rev || 0) > lr) return adopt(v);
      if (!v || lr > (v.rev || 0) || syncedRev() !== (v.rev || 0)) return push();
      writeJSON(SYNC_KEY, v.rev || 0);
      setSync('ok');
      if (data && !readJSON(BASE_KEY)) recordBase(data);
    });
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, 1500);
  }

  function push() {
    if (pushing || !available) { if (!available) setSync('off'); return Promise.resolve(); }
    pushing = true;
    setSync('busy');
    return writing.then(function () {
      var raw = localStorage.getItem(VAULT_KEY);
      var v = JSON.parse(raw);
      /* Never upload over a synced dashboard this device has never been part of. */
      if ((syncedRev() === -1 && remoteSalt && v.salt !== remoteSalt && !ignoreRemote)) { setSync('off'); return; }
      var base = remoteRev !== null ? remoteRev : syncedRev();
      return fetch(API, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'X-Base-Rev': String(base) },
        body: raw
      }).then(function (r) {
        if (r.ok) { remoteRev = v.rev; writeJSON(SYNC_KEY, v.rev); setSync('ok'); if (data) recordBase(data); return; }
        if (r.status === 409) return r.json().then(function (cur) { remoteRev = cur.rev || 0; return adopt(cur); });
        if (r.status === 401 || r.status === 503) { available = false; setSync('off', 'Sync refused the save (' + r.status + ')'); }
        else setSync('offline');
      });
    }).catch(function () { setSync('offline'); })
      .then(function () { pushing = false; });
  }
  /* Coming back with the back button must not show an unlocked page from the cache. */
  window.addEventListener('pageshow', function (e) { if (e.persisted && tooLongAway()) lock(); });

  if ($('lockNow')) $('lockNow').addEventListener('click', lock);

  /* ---------- public API used by finance.js ---------- */
  window.Vault = {
    onUnlock: function (fn) { unlockFns.push(fn); if (key) fn(data); },
    onLock: function (fn) { lockFns.push(fn); },
    get: function () { return data; },
    save: function (obj) {
      if (!key) return Promise.reject(new Error('locked'));
      data = obj;
      var k = key, s = salt;
      writing = writing.then(function () { return seal(obj, k, s, localRev() + 1); })
        .then(function (v) { if (key === k) { writeJSON(VAULT_KEY, v); schedulePush(); } })
        .catch(function (e) { console.error(e); });
      return writing;
    },
    lock: lock,
    sync: sync,
    /* restore a backup file from Settings → Data & sync: it replaces this dashboard (and, after
       unlocking, the synced copy), then asks for the passcode the backup was made with */
    restore: function (text) {
      var v = JSON.parse(text);
      if (!isVault(v)) return Promise.reject(new Error('That file isn’t a dashboard backup.'));
      return writing.then(function () {
        v.rev = Math.max(v.rev || 0, remoteRev !== null ? remoteRev + 1 : 0, localRev() + 1);
        if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
        writeJSON(VAULT_KEY, v);
        remote = null;
        ignoreRemote = true;
        lock('Backup restored');
        setMode('unlock');
        msg('Backup restored. Unlock with the passcode it was made with.', true);
      });
    },
    backup: function () {
      return writing.then(function () {
        var raw = localStorage.getItem(VAULT_KEY);
        var blob = new Blob([raw], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dashboard-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        try { localStorage.setItem('dash.lastBackup', String(Date.now())); } catch (e) {}
        /* remembered in the vault too, so every device knows when you last took one */
        if (data) { data.lastBackup = Date.now(); window.Vault.save(data); }
        window.dispatchEvent(new Event('dash:backup'));
      });
    },
    changePasscode: function (pass) {
      if (!key) return Promise.reject(new Error('locked'));
      var s = crypto.getRandomValues(new Uint8Array(16));
      return writing.then(function () { return derive(pass, s, ITER); })
        .then(function (k) {
          return seal(data, k, s, localRev() + 1).then(function (v) {
            writeJSON(VAULT_KEY, v);
            key = k; salt = s;
            remember();
            return push();
          });
        });
    }
  };

  if (!window.crypto || !crypto.subtle) {
    showLocked();
    msg('Open the dashboard over https to unlock it.');
    $('lockSubmit').disabled = true;
    return;
  }

  /* Still unlocked from earlier on this device? Then open straight away. */
  $('lockBox').style.visibility = 'hidden';
  recall().then(function (rec) {
    var vault = readJSON(VAULT_KEY);
    if (!rec || !rec.key || rec.until < Date.now() || !isVault(vault) || vault.salt !== rec.salt) {
      if (rec) forget();
      throw new Error('locked');
    }
    return open(vault, rec.key).then(function (obj) {
      key = rec.key; salt = unb64(vault.salt);
      data = unpack(obj);
      finishUnlock();
    });
  }).catch(function () {
    $('lockBox').style.visibility = '';
    if (!key) showLocked();
  });
})();
} catch (e) { console.error("lock.js", e); }
/* ===== features.js ===== */
try {
/* Features: which parts of the dashboard are switched on (Settings → Features).
   Switched-off parts disappear from the menu, the home page and the calendar,
   but their data stays in the vault, so switching back on brings everything back.
   Also holds the data of the smaller tools ("dash.tools", synced and encrypted)
   and the reminders they put in the calendar. */
(function () {
  "use strict";

  var LIST = [
    { id: 'calendar', group: 'Everyday', name: 'Calendar', icon: 'calendar3', c: '#3987e5', desc: 'Events, repeats and your phone calendar', def: true },
    { id: 'travel', group: 'Everyday', name: 'Travel', icon: 'signpost-split', c: '#0891b2', desc: 'Departures, journey planner, trips and documents', def: true },
    { id: 'finance', group: 'Everyday', name: 'Finances', icon: 'wallet2', c: '#11a597', desc: 'Budget, spending, savings and net worth', def: true },
    { id: 'habits', group: 'Everyday', name: 'Habits', icon: 'activity', c: '#d55181', desc: 'Weekly habits with streaks, on the Health page', def: true },
    { id: 'flex', group: 'Work', name: 'Flex time', icon: 'stopwatch', c: '#e8743b', desc: 'Clock in and out, flex balance and holiday days (fleksitid)' },
    { id: 'meetings', group: 'Work', name: 'Meeting notes', icon: 'people', c: '#3987e5', desc: 'Notes with action points you can send to your to-do list' },
    { id: 'learning', group: 'Work', name: 'Courses & certificates', icon: 'mortarboard', c: '#8a6fdf', desc: 'What you learn, and certificates that need renewing' },
    { id: 'training', group: 'Health', name: 'Training log', icon: 'heart-pulse', c: '#d55181', desc: 'Workouts with time, distance and how it felt' },
    { id: 'health', group: 'Health', name: 'Check-ups & medicine', icon: 'clipboard2-pulse', c: '#e66767', desc: 'Doctor and dentist, vaccines and prescriptions – with reminders' },
    { id: 'ahealth', group: 'Health', name: 'Apple Health', icon: 'apple', c: '#e66767', desc: 'Steps, sleep, heart rate and exercise from your iPhone' },
    { id: 'journal', group: 'Health', name: 'Journal', icon: 'journal-bookmark', c: '#c9a227', desc: 'One line a day and your mood' },
    { id: 'bucket', group: 'Travel', name: 'Places to visit', icon: 'pin-map', c: '#0891b2', desc: 'Your bucket list, on the map – turn one into a trip' },
    { id: 'subs', group: 'Finance', name: 'Subscriptions', icon: 'arrow-repeat', c: '#11a597', desc: 'What you pay every month and when it renews' },
    { id: 'warranty', group: 'Finance', name: 'Warranties & receipts', icon: 'receipt-cutoff', c: '#c98500', desc: 'Know when the warranty (reklamasjon) runs out' }
  ];
  var WORK = ['flex', 'meetings', 'learning'];
  var HEALTH = ['habits', 'training', 'health', 'journal', 'ahealth'];       // the Health page shows if any is on
  var REMIND_COLOR = '#c9a227';

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    window.dispatchEvent(new Event('dash:local'));      // lock.js puts it in the synced vault
  }
  function byId(id) { return LIST.filter(function (x) { return x.id === id; })[0]; }

  function on(id) {
    if (id === 'work') return WORK.some(on);
    if (id === 'healthpage') return HEALTH.some(on);
    var f = (readJSON('dash.settings') || {}).features || {};
    var d = byId(id);
    return Object.prototype.hasOwnProperty.call(f, id) ? !!f[id] : !!(d && d.def);
  }
  function set(id, val) {
    var s = readJSON('dash.settings') || {};
    s.features = s.features || {};
    s.features[id] = !!val;
    writeJSON('dash.settings', s);
    apply();
    window.dispatchEvent(new Event('features:change'));
    window.dispatchEvent(new Event('cal:change'));
  }
  function apply() {
    var r = document.documentElement;
    LIST.forEach(function (x) { r.classList.toggle('feat-off-' + x.id, !on(x.id)); });
    r.classList.toggle('feat-off-work', !on('work'));
    r.classList.toggle('feat-off-healthpage', !on('healthpage'));
  }
  apply();
  window.addEventListener('dash:settings', apply);
  var prevReload = window.Dash && window.Dash.reload;
  window.Dash = window.Dash || {};
  window.Dash.reload = function () { if (prevReload) prevReload(); apply(); window.dispatchEvent(new Event('features:change')); };

  /* settings arrive from the vault after unlocking (and from other devices when syncing) */
  if (window.Vault) window.Vault.onUnlock(function () { apply(); window.dispatchEvent(new Event('features:change')); window.dispatchEvent(new Event('tools:change')); });

  /* ---------- tool data ---------- */
  function tools() {
    var t = readJSON('dash.tools');
    return t && typeof t === 'object' ? t : {};
  }
  function saveTools(t) {
    writeJSON('dash.tools', t);
    window.dispatchEvent(new Event('tools:change'));
    window.dispatchEvent(new Event('cal:change'));
  }
  function list(key) { var t = tools(); return Array.isArray(t[key]) ? t[key] : []; }

  /* ---------- small date helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = String(k).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addMonths(k, n) {
    var d = fromKey(k), day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1);
    x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
    return dkey(x);
  }
  var isKey = function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); };

  /* Next renewal of a subscription on or after a day */
  var PERIOD_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
  function nextRenewal(s, from) {
    if (!isKey(s.renews)) return '';
    var k = s.renews, m = PERIOD_MONTHS[s.period] || 1, guard = 0;
    from = from || dkey(new Date());
    while (k < from && guard++ < 600) k = addMonths(s.renews, m * guard);
    return k;
  }
  function warrantyEnd(w) {
    if (!isKey(w.bought)) return '';
    return addMonths(w.bought, Math.round((+w.years || 2) * 12));
  }

  /* ---------- Norwegian public holidays (helligdager) ---------- */
  function easter(y) {          /* Gregorian Easter Sunday (Meeus/Jones/Butcher) */
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
    return new Date(y, mo - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  var holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    var E = easter(y), rel = function (n) { var d = new Date(E); d.setDate(d.getDate() + n); return dkey(d); };
    var l = [[y + '-01-01', 'New Year’s Day', 'Første nyttårsdag'], [rel(-3), 'Maundy Thursday', 'Skjærtorsdag'], [rel(-2), 'Good Friday', 'Langfredag'],
      [rel(0), 'Easter Sunday', 'Første påskedag'], [rel(1), 'Easter Monday', 'Andre påskedag'], [y + '-05-01', 'Labour Day', 'Arbeidernes dag'],
      [y + '-05-17', 'Constitution Day', '17. mai'], [rel(39), 'Ascension Day', 'Kristi himmelfartsdag'], [rel(49), 'Whit Sunday', 'Første pinsedag'],
      [rel(50), 'Whit Monday', 'Andre pinsedag'], [y + '-12-25', 'Christmas Day', 'Første juledag'], [y + '-12-26', 'Boxing Day', 'Andre juledag']];
    return (holCache[y] = l.map(function (x) { return { date: x[0], name: x[1], no: x[2] }; }));
  }
  function holiday(k) {
    return holidays(+String(k).slice(0, 4)).filter(function (h) { return h.date === k; })[0] || null;
  }

  /* ---------- reminders for the calendar ---------- */
  function events() {
    var out = [];
    function ev(id, title, k, notes, link) {
      out.push({ id: 'rem:' + id, title: title, allDay: true, start: fromKey(k), days: 1, color: REMIND_COLOR,
        readOnly: true, reminder: true, link: link, location: '', notes: notes || '', exDays: {} });
    }
    if (on('learning')) list('learning').forEach(function (c) {
      if (!isKey(c.expires)) return;
      ev('learn:' + c.id, (c.title || 'Certificate') + ' expires', c.expires, c.provider ? 'From ' + c.provider : '', '/cmd/work/#learning');
      var soon = addMonths(c.expires, -2);
      ev('learn2:' + c.id, 'Renew: ' + (c.title || 'certificate'), soon, 'Expires ' + c.expires, '/cmd/work/#learning');
    });
    /* workouts and courses show in the calendar, in the Training and Study categories */
    var SPORT = { strength: 'Strength', run: 'Running', walk: 'Walking', bike: 'Cycling', swim: 'Swimming', ball: 'Ball sports', yoga: 'Yoga / mobility', other: 'Workout' };
    if (on('training')) list('training').forEach(function (w) {
      if (!isKey(w.date)) return;
      out.push({ id: 'tool:wo:' + w.id, title: (SPORT[w.kind] || 'Workout') + (w.min ? ' · ' + w.min + ' min' : '') + (w.km ? ' · ' + String(w.km).replace('.', ',') + ' km' : ''),
        allDay: true, start: fromKey(w.date), days: 1, cat: 'training', readOnly: true, tool: 'Training log', link: '/cmd/habits/#training',
        location: '', notes: w.notes || '', exDays: {} });
    });
    if (on('learning')) list('learning').forEach(function (c) {
      if (!isKey(c.date)) return;
      out.push({ id: 'tool:co:' + c.id, title: (c.title || 'Course') + (c.status === 'done' ? ' ✓' : ''), allDay: true, start: fromKey(c.date), days: 1,
        cat: 'study', readOnly: true, tool: 'Courses & certificates', link: '/cmd/work/#learning', location: c.provider || '', notes: c.notes || '', exDays: {} });
    });
    /* to-dos with a day (not done yet) */
    (readJSON('dash.todos') || []).forEach(function (t) {
      if (!t || t.done || !isKey(t.due)) return;
      out.push({ id: 'todo:' + t.id, title: '☐ ' + (t.text || 'Task'), allDay: true, start: fromKey(t.due), days: 1, color: '#22b35e',
        readOnly: true, reminder: true, link: '/cmd/#c=todo', location: '', notes: '', exDays: {} });
    });
    /* your birthday, from the profile */
    var me = readJSON('dash.profile') || {};
    if (isKey(me.birthday)) out.push({ id: 'rem:bday', title: 'Your birthday', allDay: true, start: fromKey(me.birthday), days: 1, color: '#d55181',
      readOnly: true, reminder: true, link: '/cmd/?settings=profile', location: '', notes: '', exDays: {}, rule: { freq: 'YEARLY', interval: 1 } });
    if (on('health')) list('health').forEach(function (h) {
      var what = h.title || 'Health';
      if (isKey(h.date) && h.kind === 'checkup' && h.date >= addMonths(dkey(new Date()), -1)) {
        var start = fromKey(h.date), timed = /^\d{2}:\d{2}$/.test(h.time || '');
        if (timed) { var t = h.time.split(':'); start.setHours(+t[0], +t[1]); }
        out.push({ id: 'rem:hc:' + h.id, title: what + (h.where ? ' · ' + h.where : ''), allDay: !timed, start: start, days: 1, dur: 3600e3,
          color: REMIND_COLOR, readOnly: true, reminder: true, link: '/cmd/habits/#health', location: h.where || '', notes: h.notes || '', exDays: {} });
      }
      if (isKey(h.next)) ev('hn:' + h.id, ({ checkup: 'Book check-up: ', vaccine: 'Vaccine due: ', medicine: 'Renew prescription: ' }[h.kind] || 'Due: ') + what,
        h.next, h.where ? 'At ' + h.where : '', '/cmd/habits/#health');
    });
    if (on('warranty')) list('warranty').forEach(function (w) {
      var end = warrantyEnd(w);
      if (!end) return;
      ev('war:' + w.id, 'Warranty ends: ' + (w.item || 'item'), end, w.store ? 'Bought at ' + w.store + (w.receipt ? '. Receipt: ' + w.receipt : '') : '', '/cmd/finance/#warranty');
    });
    if (on('subs')) list('subs').forEach(function (s) {
      if (!isKey(s.renews) || s.paused) return;
      out.push({ id: 'rem:sub:' + s.id, title: 'Renews: ' + (s.name || 'subscription') + (s.amount ? ' · ' + Math.round(+s.amount) + ' kr' : ''),
        allDay: true, start: fromKey(s.renews), days: 1, color: REMIND_COLOR, readOnly: true, reminder: true, link: '/cmd/finance/#subs',
        location: '', notes: s.notes || '', exDays: {},
        rule: { freq: 'MONTHLY', interval: PERIOD_MONTHS[s.period] || 1, clamp: true } });
    });
    return out;
  }

  window.Features = {
    LIST: LIST, WORK: WORK, HEALTH: HEALTH, REMIND_COLOR: REMIND_COLOR, holidays: holidays, holiday: holiday,
    on: on, set: set, apply: apply, byId: byId,
    tools: tools, saveTools: saveTools, list: list,
    events: events, nextRenewal: nextRenewal, warrantyEnd: warrantyEnd,
    dkey: dkey, fromKey: fromKey, addMonths: addMonths
  };
})();
} catch (e) { console.error("features.js", e); }
