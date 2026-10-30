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
  /* …also the date formatters some pages make once and reuse (Intl.DateTimeFormat('en-GB', …)) */
  try {
    var DTF = Intl.DateTimeFormat;
    var NbDTF = function (loc, opt) { return new DTF(!loc || en.test(String(loc)) ? 'nb-NO' : loc, opt); };
    NbDTF.prototype = DTF.prototype; NbDTF.supportedLocalesOf = DTF.supportedLocalesOf;
    Intl.DateTimeFormat = NbDTF;
  } catch (e) {}

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
    'Customize this page': 'Tilpass denne siden', 'What’s saved': 'Hva som er lagret', 'Counted on this device, from your encrypted data': 'Telt på denne enheten, fra de krypterte dataene dine',
    'No expenses': 'Ingen utgifter', 'No bank file imported': 'Ingen bankfil importert', 'Budget set up': 'Budsjett satt opp', 'No budget yet': 'Ikke noe budsjett ennå', 'No Apple Health data': 'Ingen data fra Apple Helse', 'Look and layout': 'Utseende og oppsett', 'With your iPhone': 'Med iPhonen din', 'Privacy and data': 'Personvern og data', 'Menu & pages': 'Meny og sider',
    'The order of pages, sections and cards': 'Rekkefølgen på sider, seksjoner og kort', 'Home screen': 'Startskjerm', 'Text and language': 'Tekst og språk', 'How to set it up': 'Slik setter du det opp',
    'About 10 minutes, once – Cloudflare first, then your iPhone': 'Omtrent 10 minutter, én gang – Cloudflare først, så iPhonen',
    'Number tiles (Finances, Health, Travel) each have their own Customize button under them.': 'Tallflisene (Økonomi, Helse, Reise) har hver sin Tilpass-knapp under seg.', 'Pages': 'Sider', 'Customize Finances': 'Tilpass Økonomi', 'Customize Health': 'Tilpass Helse', 'Customize Work': 'Tilpass Jobb',
    'Order the sections and cards on each page, and hide what you don’t use': 'Sorter seksjonene og kortene på hver side, og skjul det du ikke bruker',
    'Nothing to arrange on this page yet – switch on more cards under Settings → Features.': 'Ingenting å ordne på denne siden ennå – slå på flere kort under Innstillinger → Funksjoner.',
    'Move sections and cards up or down, and switch off what you don’t use. Number tiles have their own Customize button. Open this again from Settings → Menu & pages.': 'Flytt seksjoner og kort opp eller ned, og slå av det du ikke bruker. Tallflisene har sin egen Tilpass-knapp. Åpne dette igjen fra Innstillinger → Meny og sider.', 'Sections': 'Seksjoner', 'Cards': 'Kort', 'Always first': 'Alltid først', 'Menu': 'Meny', 'The order of the pages in the menu': 'Rekkefølgen på sidene i menyen',
    'Move sections and cards up or down, and switch off what you don’t use. Number tiles have their own Customize button.': 'Flytt seksjoner og kort opp eller ned, og slå av det du ikke bruker. Tallflisene har sin egen Tilpass-knapp.',
    'Budget, bills and spending': 'Budsjett, regninger og forbruk', 'Statistics': 'Statistikk', 'Subscriptions and warranties': 'Abonnementer og garantier', 'Key numbers': 'Nøkkeltall', 'Habits': 'Vaner', 'Apple Health, training and more': 'Apple Helse, trening og mer',
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
    'Training log ': 'Treningslogg', 'Steps, sleep, heart rate, exercise, weight and more from your iPhone, once a day. A Shortcut sends the numbers to your server; the dashboard picks them up, keeps them encrypted with the rest and deletes them from the server.': 'Skritt, søvn, puls, trening, vekt og mer fra iPhonen, én gang om dagen. En snarvei sender tallene til serveren din; dashbordet henter dem, lagrer dem kryptert sammen med resten og sletter dem fra serveren.',
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
    [/^Show (.+)$/, function (m, a) { var t = tr(a); return t !== a ? 'Vis ' + t : null; }], [/^Move (.+) (up|down|left|right)$/, function (m, a, b) { return 'Flytt ' + tr(a) + ({ up: ' opp', down: ' ned', left: ' til venstre', right: ' til høyre' })[b]; }],
    [/^Remove (.+)$/, function (m, a) { return 'Fjern ' + a; }], [/^Done: (.+)$/, 'Ferdig: $1'], [/^Focus on (.+)$/, 'Fokus på $1'], [/^Day for (.+)$/, 'Dag for $1'],
    [/^Mark (.+) as paid$/, 'Merk $1 som betalt'], [/^Due day for (.+)$/, 'Forfallsdag for $1'], [/^Edit (.+)$/, function (m, a) { return 'Endre ' + a; }],
    [/^Last 4 weeks · (\d+) days? in a row · this week: (.+)$/, function (m, n, w) { return 'Siste 4 uker · ' + dg(n) + ' på rad · denne uka: ' + tr(w); }],
    [/^(\d+) days? from Apple Health · last (.+)$/, function (m, n, a) { return dg(n) + ' fra Apple Helse · sist ' + a; }],
    [/^7-day avg (.+)$/, 'Snitt 7 dager $1'], [/^(.+), last (\d+) days(.*)$/, function (m, a, n, b) { return tr(a) + ', siste ' + n + ' dager' + b.replace(' · line: ', ' · linje: ').replace(' · updated ', ' · oppdatert '); }],
    [/^(7|14|30) days$/, '$1 dager'], [/^(\d+) expenses? · (.+)$/, '$1 utgifter · $2'], [/^(\d+) from bank files(.*)$/, function (m, n, r) { return n + ' fra bankfiler' + r.replace(' · last import ', ' · sist importert '); }],
    [/^Bank file imported (.+) – no expenses kept$/, 'Bankfil importert $1 – ingen utgifter beholdt'], [/^(\d+) to-dos?(.*)$/, function (m, n, r) { return n + ' gjøremål' + r.replace(' calendar events', ' kalenderhendelser'); }], [/^(\d+) days from Apple Health$/, '$1 dager fra Apple Helse'], [/^All numbers this day \((\d+)\)$/, 'Alle tall denne dagen ($1)'], [/^(.+) ticked$/, '$1 krysset av'],
    [/^(.+) above the goal$/, '$1 over målet'], [/^up (.+) in (\d+) days$/, 'opp $1 på $2 dager'], [/^down (.+) in (\d+) days$/, 'ned $1 på $2 dager'], [/^no change in (\d+) days$/, 'ingen endring på $1 dager'],
    [/^Move (.+) (up|down|left|right)$/, function (m, a, b) { return 'Flytt ' + tr(a) + ({ up: ' opp', down: ' ned', left: ' til venstre', right: ' til høyre' })[b]; }], [/^(\d+) floors$/, '$1 etasjer'], [/^(.+) to go$/, '$1 igjen'], [/^(.+) short of the goal$/, '$1 under målet'], [/^Goal reached (\d+) of (\d+) days?$/, 'Mål nådd $1 av $2 dager'],
    [/^average (.+)$/, 'snitt $1'], [/^best (.+)$/, 'best $1'], [/^lowest (.+)$/, 'lavest $1'], [/^Goal (\d[^·]*)$/, 'Mål $1'], [/^Goal for (.+)$/, function (m, a) { return 'Mål for ' + tr(a).toLowerCase(); }],
    [/^Updated (.+)$/, 'Oppdatert $1'], [/^(\d+)% of (.+)$/, '$1 % av $2'], [/^(.+): no data$/, function (m, a) { return tr(a) + ': ingen data'; }], [/^(Today|Yesterday): (.+)$/, function (m, a, b) { return tr(a) + ': ' + b; }],
    [/^History builds up by itself – one more day every evening \(since (.+)\)\.$/, 'Historikken bygger seg opp av seg selv – én dag til hver kveld (siden $1).'],
    [/^(\d+) tasks in your To-do$/, '$1 oppgaver i Gjøremål'], [/^(\d+) of (\d+) cards · (.+)$/, '$1 av $2 kort · $3'], [/^Locks after (.+)$/, 'Låses etter $1'],
    [/^(\d+) of (\d+) on · (\d+) extra$/, '$1 av $2 på · $3 ekstra'], [/^(\d+) of (\d+) weeks on target$/, '$1 av $2 uker på mål'],
    [/^Normal day (.+) h · (\d+) holiday days a year ·$/, 'Normal dag $1 t · $2 feriedager i året ·'], [/^(.+) h day · (\d+) holiday days$/, '$1 t dag · $2 feriedager'],
    [/^Holiday (\d{4})$/, 'Ferie $1'], [/^of (.+)$/, 'av $1'], [/^vs previous (\d+) months$/, 'mot forrige $1 måneder'], [/^vs (.+)$/, 'mot $1'], [/^(\d+) expenses?$/, function (m, n) { return n + (+n === 1 ? ' utgift' : ' utgifter'); }],
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
  /* ---------- more words (sweep of every page, empty and filled, Oct 2026) ---------- */
  Object.assign(D, {
    'Links that open the dashboard with something ready to add. Use them in the Shortcuts app, for Siri (“Hey Siri, log expense”) or Back Tap (tap the back of the phone twice). Nothing is saved until you press Add.': 'Lenker som åpner dashbordet med noe klart til å legges til. Bruk dem i Snarveier-appen, med Siri («Hei Siri, log expense») eller Bakpå-trykk (trykk to ganger på baksiden av telefonen). Ingenting lagres før du trykker Legg til.',
    'The same works for events (“tor 14 tannlege”), tasks (“betale strøm hver måned”) and workouts (“løp 5 km”) – the line understands all of them. For Back Tap: iPhone Settings → Accessibility → Touch → Back Tap → Double Tap → pick the shortcut.': 'Det samme virker for hendelser («tor 14 tannlege»), oppgaver («betale strøm hver måned») og økter («løp 5 km») – linjen forstår alle. For Bakpå-trykk: iPhone-innstillinger → Tilgjengelighet → Berøring → Bakpå-trykk → Dobbelttrykk → velg snarveien.',
    'Your courses and certificates from the Work page. Switch on the ones that may be shown on jplundberg.com (a “Courses & certificates” section on the front page – turn the section on under Front page) and in your CV. Nothing else from the list leaves the dashboard.': 'Kursene og sertifikatene dine fra Jobb-siden. Slå på dem som kan vises på jplundberg.com (en «Kurs og sertifikater»-seksjon på forsiden – slå på seksjonen under Forside) og i CV-en din. Ingenting annet fra listen forlater dashbordet.',
    '(DNB, Sparebank 1, Nordea and the others have it under the account’s history) and pick the file here.': '(DNB, Sparebank 1, Nordea og de andre har det under kontohistorikken) og velg filen her.',
    'Only what you spent is imported – salary, card payments and transfers are left out – and rows you already have are skipped. Nothing leaves your browser.': 'Bare det du har brukt importeres – lønn, kortbetalinger og overføringer utelates – og rader du allerede har hoppes over. Ingenting forlater nettleseren din.',
    'or credit card': 'eller kredittkortet', 'as': 'som', 'CSV or Excel': 'CSV eller Excel', 'Choose file': 'Velg fil',
    'These are filed under Other – pick a category and the bank import remembers the shop next time.': 'Disse ligger under Annet – velg en kategori, så husker bankimporten butikken neste gang.',
    'Over budget': 'Over budsjett', 'All calendars': 'Alle kalendere', 'Nothing shown': 'Ingenting vises', 'Your calendars': 'Dine kalendere', 'From the dashboard': 'Fra dashbordet', 'Phone calendars': 'Telefonkalendere', 'Only': 'Bare', 'Show all': 'Vis alle', 'Hide all': 'Skjul alle', 'Filter calendars': 'Filtrer kalendere', 'Last month': 'Forrige måned', 'Last year': 'I fjor', 'all years': 'alle år', 'new': 'ny', 'Show fewer': 'Vis færre', 'Spent so far': 'Brukt så langt', 'Not yet': 'Ikke ennå', 'Even pace': 'Jevnt tempo', 'This month, after fixed costs': 'Denne måneden, etter faste kostnader', 'net income': 'netto inntekt', 'over at month end': 'over ved månedsslutt', 'From your bank': 'Fra banken',
    /* budget editor and income */
    'Budget runs': 'Budsjettet går', 'Calendar month': 'Kalendermåned', 'Payday to payday': 'Fra lønning til lønning', 'Income': 'Inntekt', 'Add income': 'Legg til inntekt', 'Gross salary': 'Bruttolønn', 'Tax': 'Skatt', 'Tax and deductions': 'Skatt og trekk',
    'Left': 'Igjen', 'Fixed costs': 'Faste kostnader', 'Spent since payday': 'Brukt siden lønning', 'Payday…': 'Lønningsdag …', 'Paid on the last day': 'Utbetales siste dag', 'Net (paid out)': 'Netto (utbetalt)', 'Gross (payslip)': 'Brutto (lønnsslipp)',
    'Net or gross': 'Netto eller brutto', 'Payday': 'Lønningsdag', 'e.g. Salary': 'f.eks. Lønn', 'kr / month, after tax': 'kr / måned, etter skatt', 'From your payslip (lønnsslipp)': 'Fra lønnsslippen', 'Monthly salary, gross (Månedslønn)': 'Månedslønn, brutto',
    'Tax (Skattetrekk): % or kr': 'Skattetrekk: % eller kr', '37 % or 29 621': '37 % eller 29 621', 'Extra tax, kr (Ekstra skattetrekk)': 'Ekstra skattetrekk, kr', 'Taxed benefits, not paid out (fordel)': 'Skattepliktig fordel, ikke utbetalt', 'e.g. 90': 'f.eks. 90',
    'Deductions (union, pension, insurance)': 'Trekk (fagforening, pensjon, forsikring)', 'e.g. Fagforening': 'f.eks. Fagforening', '681 or 2 %': '681 eller 2 %', 'Add deduction': 'Legg til trekk', 'Norwegian pay year: holiday pay in June, half tax in December': 'Norsk lønnsår: feriepenger i juni, halv skatt i desember',
    'Holiday pay earned last year (Opptjente feriepenger i fjor)': 'Opptjente feriepenger i fjor', '0 if you started this year': '0 hvis du begynte i år', 'Holiday weeks': 'Ferieuker', '5 weeks': '5 uker', '4 weeks + 1 day': '4 uker + 1 dag',
    'Payslips logged': 'Lønnsslipper ført', 'Type in the net, gross and tax from each payslip. That month then uses the real numbers (bonuses, overtime, a different tax table) and the year adds up correctly.': 'Skriv inn netto, brutto og skatt fra hver lønnsslipp. Den måneden bruker da de virkelige tallene (bonus, overtid, en annen skattetabell), og året går opp.',
    'Month': 'Måned', 'Net paid (Netto)': 'Netto utbetalt', 'Gross (optional)': 'Brutto (valgfritt)', 'Tax (optional)': 'Skatt (valgfritt)', 'Save payslip': 'Lagre lønnsslipp', 'Remove payslip': 'Fjern lønnsslipp',
    'Money in (refunds, Vipps)': 'Penger inn (refusjoner, Vipps)', 'Habit': 'Vane', 'Mood': 'Humør', 'Type': 'Type', 'Add a day': 'Legg til en dag', 'Log a workout': 'Før en økt', 'More (optional)': 'Mer (valgfritt)', 'Exercises, weights, how it felt.': 'Øvelser, vekter, hvordan det kjentes.',
    'Today in one sentence': 'I dag i én setning', 'No animation at all.': 'Ingen animasjon i det hele tatt.', 'Pages cross-fade, nothing else moves.': 'Sidene toner over, ingenting annet beveger seg.', 'Only if lunch is not part of your paid time.': 'Bare hvis lunsjen ikke er en del av betalt tid.',
    'per month on average': 'per måned i snitt', 'per month': 'per måned', 'net a month · tax': 'netto i måneden · skatt', 'Tips': 'Tips',
    /* Finances – empty states and statistics */
    'Add your salary – net, or gross with tax and deductions – and your fixed costs (rent, loans, subscriptions). Spending you log below is counted automatically.': 'Legg inn lønnen din – netto, eller brutto med skatt og trekk – og de faste kostnadene dine (husleie, lån, abonnementer). Det du fører inn nedenfor, regnes med automatisk.',
    'Add your fixed costs (rent, loans, subscriptions) under Monthly budget, then give them a due date here.': 'Legg inn de faste kostnadene dine (husleie, lån, abonnementer) under Månedsbudsjett, og gi dem en forfallsdato her.',
    'Add your accounts and loans. Update the balances now and then, and the chart shows how your net worth develops month by month.': 'Legg inn kontoer og lån. Oppdater saldoene nå og da, så viser diagrammet hvordan nettoformuen din utvikler seg måned for måned.',
    'Add income and fixed costs under Monthly budget to compare with a budget.': 'Legg inn inntekt og faste kostnader under Månedsbudsjett for å sammenligne med et budsjett.',
    'Add your salary under Monthly budget': 'Legg inn lønnen din under Månedsbudsjett', 'Set up your budget above': 'Sett opp budsjettet ovenfor', 'Set up budget': 'Sett opp budsjett',
    'Set up your monthly budget': 'Sett opp månedsbudsjettet', 'Needs your income': 'Trenger inntekten din',
    'Set up your budget on the Finances page – salary, fixed costs – and this shows what you can spend each day.': 'Sett opp budsjettet på Økonomi-siden – lønn og faste kostnader – så viser dette hva du kan bruke hver dag.',
    'No spending logged in this period yet.': 'Ingen utgifter ført i denne perioden ennå.', 'No spending this month yet.': 'Ingen utgifter denne måneden ennå.', 'Nothing logged in this period.': 'Ingenting ført i denne perioden.',
    'Budget': 'Budsjett', 'under': 'under', 'net': 'netto', 'kr / month': 'kr / måned', 'Period': 'Periode', 'Show one year': 'Vis ett år', 'Previous month': 'Forrige måned', 'Next month': 'Neste måned',
    'Export the transactions from your bank account': 'Eksporter transaksjonene fra bankkontoen din',
    'Endring per kategori': 'Endring per kategori', 'Bergen trip': 'Bergen trip',
    /* Home, tasks, glance */
    'No open tasks. Add one with + or in the To-do card.': 'Ingen åpne oppgaver. Legg til en med + eller i Gjøremål-kortet.', 'Nothing to do': 'Ingenting å gjøre', 'Nothing yet.': 'Ingenting ennå.',
    'Nothing planned in the next 6 weeks.': 'Ingenting planlagt de neste 6 ukene.', 'Show 6 more weeks': 'Vis 6 uker til', 'Tomorrow': 'I morgen', 'Upcoming': 'Kommende', 'Reminder': 'Påminnelse', 'Show more': 'Vis mer',
    'Hit a weekly target to start one': 'Nå et ukemål for å starte en', 'Delete task': 'Slett oppgave', 'Mark as done': 'Merk som ferdig', 'From a checklist': 'Fra en sjekkliste', 'Increase': 'Øk', 'Decrease': 'Mink',
    'Change the day': 'Endre dagen', 'Tips': 'Tips', 'Your name': 'Navnet ditt', 'Travel & departures': 'Reise og avganger', 'Work today (flex time)': 'Jobb i dag (fleksitid)',
    'Synced and encrypted with your passcode ·': 'Synkronisert og kryptert med koden din ·', 'Time for a backup': 'På tide med en sikkerhetskopi',
    /* Calendar */
    'Calendars': 'Kalendere', 'Show calendars': 'Vis kalendere', 'View': 'Visning', 'Dashboard card': 'Kort på dashbordet', 'Day starts': 'Dagen starter', 'Length': 'Varighet', 'New events': 'Nye hendelser', 'Open in': 'Åpne i',
    'Tap the colour to change it': 'Trykk på fargen for å endre den', 'What the calendar card on the dashboard shows': 'Hva kalenderkortet på dashbordet viser', 'Where the week view opens': 'Hvor ukevisningen åpner',
    'Like “Week 44” in the month and week views': 'Som «Uke 44» i måneds- og ukevisningen', 'Events in a deleted category move to Personal.': 'Hendelser i en slettet kategori flyttes til Personlig.',
    '17. mai, Easter, Christmas … also counted in Flex time': '17. mai, påske, jul … regnes også med i fleksitid', 'Colour': 'Farge',
    'iPhone (iCloud)': 'iPhone (iCloud)', '– open the Calendar app →': '– åpne Kalender-appen →', '→ tap': '→ trykk', 'next to the calendar → turn on': 'ved siden av kalenderen → slå på',
    '. Do this for each calendar you want here.': '. Gjør dette for hver kalender du vil ha her.', '– calendar.google.com on a computer →': '– calendar.google.com på en datamaskin →', '→ pick the calendar →': '→ velg kalenderen →',
    '→ copy': '→ kopier', '– outlook.com →': '– outlook.com →', '→ copy the ICS link.': '→ kopier ICS-lenken.',
    'Anyone who has the link can read that calendar, so keep it private. You can turn the link off again in the same place. New events show up here within about 10 minutes.': 'Alle som har lenken kan lese den kalenderen, så hold den privat. Du kan slå av lenken igjen samme sted. Nye hendelser dukker opp her innen omtrent 10 minutter.',
    /* Travel */
    'Add a destination to your trips': 'Legg til et reisemål på turene dine', 'Trips with a destination show up here.': 'Turer med et reisemål vises her.',
    'No trips planned yet. Add one to keep flights, hotels, packing and costs in one place – it shows up in your calendar too.': 'Ingen turer planlagt ennå. Legg til en for å samle fly, hotell, pakking og kostnader på ett sted – den vises i kalenderen også.',
    'Trips you’ve been on show up here, with days away, countries and what you spent. Add older trips with “Log a past trip” – put what it cost under “Other costs” and it goes into Finances on that date.': 'Turer du har vært på vises her, med dager borte, land og hva du brukte. Legg til eldre turer med «Før en tidligere tur» – legg det den kostet under «Andre kostnader», så havner det i Økonomi på den datoen.',
    'Add your passport, ID, EU health card and travel insurance with their expiry dates. You get a warning before a trip if something runs out, and a reminder in your calendar to renew.': 'Legg inn pass, ID, europeisk helsetrygdkort og reiseforsikring med utløpsdato. Du får et varsel før en tur hvis noe går ut, og en påminnelse i kalenderen om å fornye.',
    'Cheap flights': 'Billige flyreiser', 'Check documents': 'Sjekk dokumenter', 'Countries visited': 'Land besøkt', 'Log a past trip': 'Før en tidligere tur', 'Travel in Finances': 'Reise i Økonomi', 'Where you’ve been': 'Hvor du har vært',
    'Year by year': 'År for år', 'counting today': 'medregnet i dag', 'outside Norway': 'utenfor Norge', 'where are you going next?': 'hvor skal du neste gang?', 'where have you been?': 'hvor har du vært?', 'Map or globe': 'Kart eller globus', 'Travel in numbers': 'Reise i tall',
    /* Work */
    'Lunch break, taken off the day': 'Lunsjpause, trekkes fra dagen', 'Holiday days a year': 'Feriedager i året', 'Break in minutes': 'Pause i minutter', 'Holiday days per year': 'Feriedager per år', 'Month for the report': 'Måned for rapporten',
    'Used by Flex time on the Work page and the “Work today” card.': 'Brukes av fleksitid på Jobb-siden og «Jobb i dag»-kortet.', 'days': 'dager', 'min': 'min',
    'Public holidays come from the calendar setting and don’t count as work. The normal day is also in your profile.': 'Helligdager kommer fra kalenderinnstillingen og regnes ikke som jobb. Normaldagen ligger også i profilen din.',
    'Nothing switched on here. Go to': 'Ingenting er slått på her. Gå til', 'Settings → Features': 'Innstillinger → Funksjoner', 'and turn on Flex time, Meeting notes or Courses & certificates.': 'og slå på fleksitid, møtenotater eller kurs og sertifikater.',
    /* Settings: main list and pages */
    'Dashboard settings sync across your devices. Website changes go live on jplundberg.com about a minute after you publish.': 'Dashbordinnstillingene synkroniseres på enhetene dine. Endringer på nettsiden er ute på jplundberg.com omtrent ett minutt etter at du publiserer.',
    '5 categories · week numbers · holidays': '5 kategorier · ukenummer · helligdager', 'About, roles, contact, footer': 'Om, roller, kontakt, bunntekst', 'Links in the header and footer': 'Lenker i toppen og bunnen', 'Newest first': 'Nyeste først', 'None published': 'Ingen publisert', 'Last 7 days': 'Siste 7 dager',
    'Colours': 'Farger', 'Auto': 'Auto', 'Full': 'Full', 'Glass': 'Glass', 'Minimal': 'Minimal', 'Normal': 'Normal', 'English': 'English', 'Norsk': 'Norsk', 'Moon': 'Måne', 'Aurora': 'Nordlys', 'Dusk': 'Skumring', 'Forest': 'Skog', 'Ocean': 'Hav',
    'For the dashboard – the website has its own switch': 'For dashbordet – nettsiden har sin egen bryter', 'Cards rise in, pages cross-fade.': 'Kortene glir inn, sidene toner over.', 'Calm, dark cards – the original look.': 'Rolige, mørke kort – det opprinnelige utseendet.',
    'Raised cards with soft shadows, like phone widgets.': 'Hevede kort med myke skygger, som widgeter på telefonen.', 'Choose your own colour': 'Velg din egen farge', 'Choose your own accent colour': 'Velg din egen aksentfarge',
    'Teal': 'Blågrønn', 'Blue': 'Blå', 'Purple': 'Lilla', 'Pink': 'Rosa', 'Orange': 'Oransje', 'Green': 'Grønn',
    'Pick what you use. Switched-off parts disappear from the menu, the dashboard and the calendar. Your data stays, encrypted and synced, so switching back on brings everything back.': 'Velg det du bruker. Det du slår av forsvinner fra menyen, dashbordet og kalenderen. Dataene dine blir liggende, kryptert og synkronisert, så alt kommer tilbake når du slår det på igjen.',
    'The main parts. Switching one off hides its page, card and calendar items – nothing is deleted.': 'Hoveddelene. Slår du av en, skjules siden, kortet og kalenderelementene – ingenting slettes.',
    'Turning on any of these adds a Work page to the menu.': 'Slår du på en av disse, får menyen en Jobb-side.', 'Shown on the Health page (the menu tab shows when any of these or Habits is on).': 'Vises på Helse-siden (fanen i menyen vises når en av disse eller Vaner er på).',
    'Shown under Trips on the Travel page.': 'Vises under Turer på Reise-siden.', 'Shown on the Finances page. Renewals and warranty dates also go in your calendar.': 'Vises på Økonomi-siden. Fornyelser og garantidatoer legges også i kalenderen.',
    'Reminders on this device, even when the dashboard is closed. Off until you switch it on, and you choose what they say.': 'Påminnelser på denne enheten, også når dashbordet er lukket. Av til du slår det på, og du velger hva de sier.',
    'Reminders are planned 7 days ahead each time you open the dashboard. Haven’t opened it for a week? Then they pause until you do.': 'Påminnelsene planlegges 7 dager fram hver gang du åpner dashbordet. Har du ikke åpnet det på en uke, tar de pause til du gjør det.',
    'Your data is encrypted with your passcode, synced through your server and kept in this browser. A backup file is a third copy – keep it in Files, iCloud Drive or on your computer. At a glance reminds you once a month.': 'Dataene dine er kryptert med koden din, synkronisert via serveren din og lagret i denne nettleseren. En sikkerhetskopi er en tredje kopi – legg den i Filer, iCloud Drive eller på datamaskinen. Kort fortalt minner deg på det én gang i måneden.',
    /* Profile */
    'About you': 'Om deg', 'Add photo': 'Legg til bilde', 'Address': 'Adresse', 'Allergies': 'Allergier', 'Birthday': 'Fødselsdag', 'Blood type': 'Blodtype', 'City': 'By', 'Email': 'E-post', 'Emergency contact': 'Nødkontakt', 'Employer': 'Arbeidsgiver',
    'GP (fastlege)': 'Fastlege', 'Medicines': 'Medisiner', 'Name': 'Navn', 'Normal working day': 'Normal arbeidsdag', 'Normal working day in hours': 'Normal arbeidsdag i timer', 'Office': 'Kontor', 'Phone': 'Telefon', 'Private.': 'Privat.', 'Relation': 'Relasjon', 'Role': 'Rolle',
    'Saved encrypted, only for you.': 'Lagret kryptert, bare for deg.', 'Shirts & jackets': 'Skjorter og jakker', 'Shoes': 'Sko', 'Trousers': 'Bukser', 'Sizes': 'Størrelser',
    'Only you see this – nothing here is shown on jplundberg.com. What’s public is under Settings → jplundberg.com.': 'Bare du ser dette – ingenting her vises på jplundberg.com. Det som er offentlig ligger under Innstillinger → jplundberg.com.',
    'Becomes “Home” in Travel, so departures and “leave by” start from here.': 'Blir «Hjem» i Reise, så avganger og «dra senest» regnes herfra.', 'Shown with your travel documents and on the Health page.': 'Vises sammen med reisedokumentene og på Helse-siden.',
    'The office becomes “Work” in Travel. The working day is what Flex time counts against.': 'Kontoret blir «Jobb» i Reise. Arbeidsdagen er det fleksitiden regnes mot.',
    'Anything else you want to keep handy': 'Annet du vil ha for hånden', 'Anything you take regularly': 'Det du tar fast', 'Company': 'Firma', 'Full name': 'Fullt navn', 'Job title': 'Stilling', 'Name and clinic': 'Navn og legekontor', 'Ring, hat …': 'Ring, lue …',
    'Search for the office address': 'Søk etter kontoradressen', 'Search for your address': 'Søk etter adressen din', 'e.g. Mother, partner': 'f.eks. mor, partner',
    /* Siri & Shortcuts */
    'Links that open the dashboard with something ready to add. Use them in the Shortcuts app, for Siri (“Hey Siri, log expense”) or Back Tap (tap the back of the phone twice). Nothing is saved until you tap Add.': 'Lenker som åpner dashbordet med noe klart til å legges til. Bruk dem i Snarveier-appen, med Siri («Hei Siri, før utgift») eller Bakpå-trykk (trykk to ganger på baksiden av telefonen). Ingenting lagres før du trykker Legg til.',
    '“Hey Siri, log expense” – 2 minutes': '«Hei Siri, før utgift» – 2 minutter', 'Add what you say after it: “149 rema”, “fre 18 middag”, “løp 5 km”': 'Legg til det du sier etterpå: «149 rema», «fre 18 middag», «løp 5 km»',
    'Links open in Safari. The first time, unlock there with your passcode; your data is synced, so it\'s the same as in the app.': 'Lenkene åpnes i Safari. Første gang låser du opp der med koden din; dataene er synkronisert, så alt er likt som i appen.',
    'Open the': 'Åpne', 'app →': '-appen →', '(new shortcut).': '(ny snarvei).', 'Add the action': 'Legg til handlingen', '. Type: Text. Prompt:': '. Type: Tekst. Spørsmål:', '– you\'ll say or type e.g. “149 rema”.': '– du sier eller skriver f.eks. «149 rema».',
    'and paste the first link above (the one that ends in': 'og lim inn den første lenken over (den som slutter på', '). Then tap after it and insert': '). Trykk så etter den og sett inn', 'from the variables bar.': 'fra variabelfeltet.',
    'Rename the shortcut to': 'Gi snarveien navnet', '. Now say “Hey Siri, log expense”.': '. Si nå «Hei Siri, log expense».', 'What did you buy?': 'Hva kjøpte du?',
    /* Apple Health set-up */
    'On your iPhone (5 minutes)': 'På iPhonen (5 minutter)', 'Once, in Cloudflare (3 minutes)': 'Én gang, i Cloudflare (3 minutter)', 'Paste the newest': 'Lim inn nyeste', 'into the Worker, if you haven\'t.': 'i Workeren, hvis du ikke har gjort det.',
    ', duration: non-expiring. Copy the': ', varighet: utløper ikke. Kopier', 'straight into the Shortcut below – nowhere else.': 'rett inn i snarveien nedenfor – ingen andre steder.', '. Name:': '. Navn:', '. Action:': '. Handling:', '. Include:': '. Inkluder:', '. Save.': '. Lagre.',
    'The token can only hand in health numbers – it can\'t read or change anything else.': 'Nøkkelen kan bare levere helsetall – den kan ikke lese eller endre noe annet.', ', name it': ', gi den navnet', '– Type: Steps, Start Date: is today. Then': '– Type: Steps, Start Date: is today. Så',
    '→ Sum.': '→ Sum.', '– Type: Sleep, Start Date: is in the last 1 day,': '– Type: Sleep, Start Date: is in the last 1 day,', 'and': 'og',
    '(keeps the Watch\'s Core, Deep and REM, so a night isn\'t counted twice). Then': '(beholder klokkens kjerne-, dyp- og REM-søvn, så en natt ikke telles to ganger). Så', '→ Duration, and': '→ Duration, og',
    '. Headers:': '. Headers:', 'with your two values. Request Body:': 'med de to verdiene dine. Request Body:', 'fields': '-felt', ', each set with': ', hver satt med', '→ the blue': '→ den blå',
    'under its own Calculate action. No date needed – today\'s is used.': 'under sin egen Calculate-handling. Ingen dato trengs – dagens brukes.', 'More numbers': 'Flere tall', '(optional): one': '(valgfritt): én', '(Start Date is today) + one': '(Start Date is today) + én',
    'each, and a Number field with this name. Each gets its own tile, chart and goal.': 'hver, og et Number-felt med dette navnet. Hver får sin egen flis, sitt eget diagram og mål.',
    'Run it once. Open the dashboard – a note says what arrived.': 'Kjør den én gang. Åpne dashbordet – en melding sier hva som kom inn.', '→ Time of Day, 22:30, Daily →': '→ Time of Day, 22:30, Daily →', '→ Health to dashboard.': '→ Health to dashboard.',
    'Sleep can come as hours, minutes or seconds – the dashboard works it out. Missing numbers are simply left out.': 'Søvn kan komme som timer, minutter eller sekunder – dashbordet finner ut av det. Tall som mangler blir bare utelatt.',
    'Number for Training': 'Tall for Trening', 'Threshold': 'Grense', 'Shortcuts →': 'Snarveier →',
    /* jplundberg.com pages */
    'A short message at the top of every page on jplundberg.com. Visitors can close it.': 'En kort melding øverst på hver side på jplundberg.com. Besøkende kan lukke den.', 'Link (optional)': 'Lenke (valgfritt)', 'Live': 'Publisert', 'Norwegian': 'Norsk',
    'Publish announcement': 'Publiser kunngjøring', 'Show announcement': 'Vis kunngjøring', 'e.g. New article: What do FDVU users say?': 'f.eks. New article: What do FDVU users say?',
    'Choose which sections are shown on the front page, and in which order.': 'Velg hvilke seksjoner som vises på forsiden, og i hvilken rekkefølge.', 'About': 'Om', 'Contact': 'Kontakt', 'Intro (name and title)': 'Intro (navn og tittel)', 'Latest articles': 'Siste artikler', 'Projects': 'Prosjekter',
    'Publish front page': 'Publiser forsiden', 'Right now': 'Akkurat nå', 'Always last': 'Alltid sist', 'One line under your name on the front page about what you’re working on. Leave it empty to hide it.': 'Én linje under navnet ditt på forsiden om hva du jobber med. La den stå tom for å skjule den.',
    'Articles': 'Artikler', 'Article': 'Artikkel', 'Project': 'Prosjekt', 'Publish featured': 'Publiser utvalgte',
    'Hide an article or project from jplundberg.com, and show it again with one tap. The Norwegian and English versions follow each other. Changes are live in about a minute.': 'Skjul en artikkel eller et prosjekt fra jplundberg.com, og vis det igjen med ett trykk. Den norske og engelske versjonen følger hverandre. Endringer er ute om omtrent ett minutt.',
    'Pin an article and a project first on the front page, with a “Featured” label. Choose “Newest” to show the latest as usual.': 'Fest en artikkel og et prosjekt først på forsiden, med merket «Utvalgt». Velg «Nyeste» for å vise de siste som vanlig.',
    'No courses yet. Add them on the Work page (switch on “Courses & certificates” under Features).': 'Ingen kurs ennå. Legg dem til på Jobb-siden (slå på «Kurs og sertifikater» under Funksjoner).', 'Publish courses & certificates': 'Publiser kurs og sertifikater',
    'Publish project progress': 'Publiser prosjektfremdrift', 'Publish cv': 'Publiser CV', 'Add job': 'Legg til jobb', 'Born': 'Født', 'CV page on jplundberg.com/cv/': 'CV-side på jplundberg.com/cv/', 'Contact details on the CV': 'Kontaktinfo på CV-en',
    'Include articles': 'Ta med artikler', 'Include courses & certificates marked “In CV”': 'Ta med kurs og sertifikater merket «I CV»', 'Include projects': 'Ta med prosjekter', 'Nationality': 'Nasjonalitet', 'One per line.': 'Én per linje.', 'Open the CV': 'Åpne CV-en', 'Profile text': 'Profiltekst',
    'One per line, with a level 0–100 after a comma, e.g.': 'Én per linje, med et nivå 0–100 etter et komma, f.eks.', '. Shown as bars in the sidebar.': '. Vises som stolper i sidefeltet.', 'from the site': 'fra nettsiden',
    'The short text at the top of the CV. Empty = the About text from the website.': 'Den korte teksten øverst på CV-en. Tom = Om-teksten fra nettsiden.', 'Used by the CV and the Experience section on the front page. Until you add something here, the site’s own list is shown.': 'Brukes av CV-en og Erfaring-seksjonen på forsiden. Til du legger inn noe her, vises nettsidens egen liste.',
    'Email and website are always there. Anything you add here is published to the website’s files, which are public – leave out what you don’t want online.': 'E-post og nettside er alltid med. Det du legger inn her publiseres i nettsidens filer, som er offentlige – utelat det du ikke vil ha på nett.',
    'Two or three sentences about what you do.': 'To eller tre setninger om hva du gjør.', 'e.g. 30 June 1996': 'f.eks. 30. juni 1996',
    'Add social': 'Legg til profil', 'Publish socials': 'Publiser profiler', 'Your profiles': 'Profilene dine', 'Network': 'Nettverk', 'username': 'brukernavn',
    'Public: the profiles switched on here show on jplundberg.com (sidebar, front page and footer) after you tap Publish.': 'Offentlig: profilene som er slått på her vises på jplundberg.com (sidefelt, forside og bunntekst) når du trykker Publiser.',
    'Username or link. The switch decides if it’s shown on jplundberg.com': 'Brukernavn eller lenke. Bryteren bestemmer om den vises på jplundberg.com',
    'Change the texts on jplundberg.com. Empty a field (or tap': 'Endre tekstene på jplundberg.com. Tøm et felt (eller trykk', ') to go back to the original text. Changes are live about a minute after you publish.': ') for å gå tilbake til originalteksten. Endringer er ute omtrent ett minutt etter at du publiserer.',
    'Couldn’t load the texts. Check your connection and try again.': 'Klarte ikke å laste tekstene. Sjekk tilkoblingen og prøv igjen.', 'Original': 'Original', 'Publish texts': 'Publiser tekster',
    'A goal on the dashboard can keep a project page on jplundberg.com up to date. Publish a goal here, and give the project’s chart the goal’s name (': 'Et mål på dashbordet kan holde en prosjektside på jplundberg.com oppdatert. Publiser et mål her, og gi prosjektets diagram målets navn (',
    'in the project file). Only the name, the numbers and the date are published.': 'i prosjektfilen). Bare navnet, tallene og datoen publiseres.',
    'From Cloudflare Web Analytics · no cookies, no personal data.': 'Fra Cloudflare Web Analytics · ingen informasjonskapsler, ingen personopplysninger.', 'Front page (English)': 'Forside (engelsk)', 'Front page (Norwegian)': 'Forside (norsk)',
    'Most read pages': 'Mest leste sider', 'Page views': 'Sidevisninger', 'Visits': 'Besøk', 'Where visitors come from': 'Hvor besøkende kommer fra', 'Norway': 'Norge', 'Sweden': 'Sverige',
    'A CV page built from your profile, experience, courses and projects – always up to date, and saved as PDF with one tap. It isn’t listed in search engines.': 'En CV-side laget av profilen, erfaringen, kursene og prosjektene dine – alltid oppdatert, og lagret som PDF med ett trykk. Den vises ikke i søkemotorer.',
    'Your courses and certificates from the Work page. Switch on the ones that may be shown on jplundberg.com (a “Courses & certificates” section on the front page – turn the section on under Front page).': 'Kursene og sertifikatene dine fra Jobb-siden. Slå på dem som kan vises på jplundberg.com (en «Kurs og sertifikater»-seksjon på forsiden – slå på seksjonen under Forside).',
    '· on the page, “Save as PDF” prints it to a file.': '· på siden skriver «Lagre som PDF» den til en fil.', 'Website': 'Nettside', 'Site editor': 'Nettsideredigering',
    'CSV': 'CSV', 'PDF': 'PDF'
  });
  /* optional features: Talk to add, Shutdown, Find time, Meeting prep, Trip budget, Rest day, Strømpris, Jars, FDV, Holiday planner, Gym log, Smart packing */
  (function (add) { for (var k in add) if (!(k in D)) D[k] = add[k]; })({
    'Talk to add': 'Snakk inn', 'Say it and it’s added – “149 Rema”, “gym tomorrow 7”': 'Si det, så legges det til – «149 Rema», «trening i morgen 7»', 'Say it, and it’s added': 'Si det, så legges det til',
    'Find time': 'Finn tid', 'Finds a free slot this week for anything, and books it': 'Finner ledig tid denne uken til hva som helst, og booker den', 'A free slot this week for anything': 'Ledig tid denne uken til hva som helst',
    'Shutdown ritual': 'Avslutt arbeidsdagen', 'End the workday in one go: clock out, move what’s left, pick tomorrow’s top 3': 'Avslutt arbeidsdagen på én gang: stemple ut, flytt det som er igjen, velg morgendagens topp 3',
    'Meeting prep': 'Møteforberedelse', 'Before a meeting: notes and open action points from last time': 'Før et møte: notater og åpne oppgaver fra sist',
    'FDV inspection notes': 'FDV-befaringsnotater', 'Findings with TG per building part – and a tidy summary to send': 'Funn med TG per bygningsdel – og et ryddig sammendrag å sende',
    'Holiday planner': 'Ferieplanlegger', 'Holiday days left, and where to put them for the longest breaks': 'Feriedager igjen, og hvor de gir lengst fri',
    'Gym log': 'Treningslogg (styrke)', 'Sets, reps and kg per exercise, progress, and next session’s weight': 'Sett, reps og kg per øvelse, fremgang og vekt til neste økt',
    'Rest-day advisor': 'Hviledagsråd', 'Tells you when to rest – from sleep, heart rate and your training': 'Sier fra når du bør hvile – ut fra søvn, puls og treningen din',
    'Trip budget mode': 'Reisebudsjett', 'While you’re away: what you can spend today': 'Mens du er borte: hva du kan bruke i dag',
    'Smart packing': 'Smart pakking', 'A packing list from the trip’s length and the weather there': 'En pakkeliste ut fra reisens lengde og været der',
    'Strømpris': 'Strømpris', 'Electricity price in Oslo (NO1) hour by hour – and the cheapest hours': 'Strømprisen i Oslo (NO1) time for time – og de billigste timene',
    'Savings jars': 'Sparekrukker', 'Your savings goals as jars that fill up, with weeks left': 'Sparemålene som krukker som fylles opp, med uker igjen',
    'End your workday': 'Avslutt arbeidsdagen', 'End my workday': 'Avslutt arbeidsdagen', 'End my day': 'Avslutt dagen', 'Close today in one go – and know what tomorrow holds.': 'Avslutt i dag på én gang – og vit hva morgendagen bringer.',
    'Work time': 'Arbeidstid', 'Left from today': 'Igjen fra i dag', 'Nothing left – nice work.': 'Ingenting igjen – bra jobbet.', 'Tomorrow’s top 3': 'Morgendagens topp 3', 'No open tasks.': 'Ingen åpne oppgaver.',
    'Not now': 'Ikke nå', 'Move what’s left and pick tomorrow’s top 3': 'Flytt det som er igjen og velg morgendagens topp 3', 'Clock out, move what’s left, pick tomorrow’s top 3': 'Stemple ut, flytt det som er igjen, velg morgendagens topp 3',
    'Three is the limit – take one out first': 'Tre er maks – ta ut én først',
    'What do you need time for?': 'Hva trenger du tid til?', 'Work hours': 'Arbeidstid', 'Evenings': 'Kvelder', 'Any time': 'Når som helst', 'This week': 'Denne uken', 'Next week': 'Neste uke', '2 weeks': '2 uker', 'Weekends too': 'Helger også',
    'No free slot that long – try a shorter time, or more days.': 'Ingen ledig tid så lenge – prøv kortere tid eller flere dager.',
    'In the event': 'I hendelsen', 'Open action points': 'Åpne oppgaver', 'All action points done.': 'Alle oppgaver er gjort.', 'Ready': 'Klar', 'Meeting notes': 'Møtenotater', 'Notes in the event': 'Notater i hendelsen', 'notes ready': 'notater klare',
    'Take a rest day': 'Ta en hviledag', 'Go easy today': 'Ta det rolig i dag', 'Ready to train': 'Klar for trening', 'Slept well': 'Sov godt', 'HRV above your normal': 'HRV over det normale',
    'Your body is recovered – a good day for a hard session.': 'Kroppen er restituert – en god dag for en hard økt.', 'Train light: technique, mobility, a walk or an easy run.': 'Tren lett: teknikk, mobilitet, en tur eller en rolig løpetur.',
    'Rest, sleep early and eat well – you’ll come back stronger.': 'Hvil, legg deg tidlig og spis godt – du kommer sterkere tilbake.',
    'Needs a few days of sleep, heart rate (HRV, resting pulse) from Apple Health, or your training log, to know your normal.': 'Trenger noen dager med søvn og puls (HRV, hvilepuls) fra Apple Health, eller treningsloggen, for å kjenne ditt normale nivå.',
    'Today': 'I dag', 'Tomorrow': 'I morgen', 'Cheap': 'Billig', 'Normal': 'Normal', 'Expensive': 'Dyrt', 'I have Norgespris': 'Jeg har Norgespris', 'You pay 50 øre with Norgespris': 'Du betaler 50 øre med Norgespris',
    'Spot price in NO1 with VAT, before grid rent (nettleie). Prices from hvakosterstrommen.no.': 'Spotpris i NO1 med mva, før nettleie. Priser fra hvakosterstrommen.no.',
    'Getting today’s prices …': 'Henter dagens priser …', 'Couldn’t reach the price service right now – try again later.': 'Fikk ikke kontakt med pristjenesten nå – prøv igjen senere.',
    'Good time to wash, dry or charge': 'Lurt å vaske, tørke eller lade nå', 'Full 🎉': 'Full 🎉',
    'New inspection': 'Ny befaring', 'Edit inspection': 'Rediger befaring', 'Building': 'Bygg', 'Building or property, e.g. Storgata 12': 'Bygg eller eiendom, f.eks. Storgata 12', 'Address': 'Adresse', 'Street, town': 'Gate, sted', 'Client': 'Oppdragsgiver', 'Who it’s for': 'Hvem det er for',
    'Copy summary': 'Kopier sammendrag', 'Share': 'Del', 'TG 2–3 to to-do': 'TG 2–3 til gjøremål', 'Add finding': 'Legg til funn', 'Photo': 'Bilde', 'Photo ✓': 'Bilde ✓', 'Summary copied': 'Sammendraget er kopiert', 'Finding removed': 'Funnet er fjernet', 'Remove finding': 'Fjern funn',
    'No findings yet – add the first one below.': 'Ingen funn ennå – legg til det første under.', 'What you found, e.g. Cracked sealant around window, 2nd floor': 'Hva du fant, f.eks. sprukken fuge rundt vindu, 2. etg', 'What should be done (optional)': 'Hva bør gjøres (valgfritt)',
    'Walk a building, note each finding with its condition grade (TG) and a photo – and get a tidy summary you can send or paste into a report.': 'Gå gjennom et bygg, noter hvert funn med tilstandsgrad (TG) og bilde – og få et ryddig sammendrag du kan sende eller lime inn i en rapport.',
    'Roof': 'Tak', 'Facade': 'Fasade', 'Windows and doors': 'Vinduer og dører', 'Wet rooms': 'Våtrom', 'Kitchen': 'Kjøkken', 'Electrical': 'Elektro', 'Plumbing (VVS)': 'VVS', 'Ventilation': 'Ventilasjon', 'Heating': 'Oppvarming', 'Fire safety': 'Brannsikring', 'Structure': 'Konstruksjon', 'Outdoor areas': 'Utomhus', 'Other': 'Annet',
    'No issues': 'Ingen avvik', 'Minor issues': 'Mindre avvik', 'Significant issues': 'Vesentlige avvik', 'Serious issues': 'Store eller alvorlige avvik', 'Not examined': 'Ikke undersøkt',
    'Longest breaks for the fewest days': 'Lengst fri for færrest dager', 'Plan it': 'Planlegg', 'In calendar': 'I kalenderen', 'days off': 'dager fri', 'Next public holiday': 'Neste helligdag', 'No clever breaks in the next 12 months.': 'Ingen lure fridager de neste 12 månedene.',
    'Start workout': 'Start økt', 'Workout': 'Økt', 'Edit workout': 'Rediger økt', 'Save workout': 'Lagre økten', 'Progress': 'Fremgang', 'Recent': 'Siste', 'Next': 'Neste', 'Volume': 'Volum', 'New bests': 'Nye rekorder', 'last 30 days': 'siste 30 dager', 'reps': 'reps', 'Set': 'Sett', 'Reps': 'Reps', 'Kilos': 'Kilo',
    'Add exercise, e.g. Bench press': 'Legg til øvelse, f.eks. benkpress', 'Workout deleted': 'Økten er slettet', 'Remove set': 'Fjern sett',
    'Log sets, reps and kilos per exercise. It shows your progress and suggests the weight for next time.': 'Logg sett, reps og kilo per øvelse. Den viser fremgangen og foreslår vekt til neste gang.',
    'Bench press': 'Benkpress', 'Squat': 'Knebøy', 'Deadlift': 'Markløft', 'Overhead press': 'Skulderpress', 'Barbell row': 'Stangroing', 'Pull-ups': 'Pull-ups', 'Lat pulldown': 'Nedtrekk', 'Leg press': 'Beinpress', 'Lunges': 'Utfall', 'Romanian deadlift': 'Rumensk markløft', 'Biceps curl': 'Bicepscurl', 'Triceps pushdown': 'Triceps pushdown', 'Dips': 'Dips', 'Seated row': 'Sittende roing', 'Leg curl': 'Lårcurl', 'Calf raise': 'Tåhev', 'Plank': 'Planke',
    'Smart list': 'Smart liste', 'Checking the weather …': 'Sjekker været …', 'Allow the microphone for this site to talk to add': 'Gi siden tilgang til mikrofonen for å snakke inn'
  });
  P.push(
    [/^(\d+) of 3$/, '$1 av 3'], [/^Move (.+) to tomorrow$/, 'Flytt $1 til i morgen'], [/^Clock out now \((\d\d:\d\d)\) – clocked in at (\d\d:\d\d)$/, 'Stemple ut nå ($1) – stemplet inn $2'],
    [/^Workday closed(?: · (\d+) moved to tomorrow)?\. See you tomorrow\.$/, function (m, n) { return 'Arbeidsdagen er avsluttet' + (n ? ' · ' + n + ' flyttet til i morgen' : '') + '. Vi ses i morgen.'; }],
    [/^Prep: (.+) at (\d\d:\d\d)$/, 'Forbered: $1 kl. $2'], [/^Last time (.+)$/, 'Sist $1'], [/^(\d+) open actions?$/, function (m, n) { return n + (n === '1' ? ' åpen oppgave' : ' åpne oppgaver'); }],
    [/^(.+): (.+) left today$/, '$1: $2 igjen i dag'], [/^(.+): (.+) over today$/, '$1: $2 over i dag'], [/^(.+) a day$/, '$1 om dagen'], [/^(\d+) days? left$/, function (m, n) { return n + (n === '1' ? ' dag' : ' dager') + ' igjen'; }],
    [/^HRV (\d+) % below your normal$/, 'HRV $1 % under det normale'], [/^Resting pulse \+(\d+) bpm$/, 'Hvilepuls +$1 slag/min'], [/^Slept ([\d,]+) h$/, 'Sov $1 t'], [/^(\d+) training days in a row$/, '$1 treningsdager på rad'], [/^readiness (\d+)$/, 'form $1'],
    [/^Now, (\d+)–(\d+)$/, 'Nå, $1–$2'], [/^Average (today|tomorrow)$/, function (m, a) { return 'Snitt ' + (a === 'today' ? 'i dag' : 'i morgen'); }], [/^≈ (\d+) øre after strømstøtte$/, '≈ $1 øre etter strømstøtte'],
    [/^Cheapest (.+)$/, 'Billigst $1'], [/^Most expensive (.+)$/, 'Dyrest $1'], [/^Average (\d+) øre$/, 'Snitt $1 øre'], [/^Cheap power now – (\d+) øre$/, 'Billig strøm nå – $1 øre'], [/^until (\d\d:\d\d)$/, 'til $1'], [/^Cheapest power (.+)$/, 'Billigst strøm $1'], [/^now (\d+) øre$/, 'nå $1 øre'],
    [/^(\d+) weeks? to go$/, function (m, n) { return n + (n === '1' ? ' uke' : ' uker') + ' igjen'; }], [/^(.+) to go$/, '$1 igjen'],
    [/^(\d+) findings?$/, function (m, n) { return n + ' funn'; }], [/^(\d+) tasks? added to your to-do list$/, '$1 lagt til i gjøremål'],
    [/^Days left (\d{4})$/, 'Dager igjen $1'], [/^(\d+) used$/, '$1 brukt'], [/^(\d+) planned$/, '$1 planlagt'], [/^Take (\d+) days?: (.+)$/, function (m, n, r) { return 'Ta ' + n + (n === '1' ? ' dag' : ' dager') + ': ' + r; }], [/^Off (.+)$/, 'Fri $1'],
    [/^(.+) break in your calendar( and flex time)?$/, function (m, a, f) { return a + ' er lagt i kalenderen' + (f ? ' og fleksitiden' : ''); }],
    [/^Last (\d+)×(\d+) @ (.+) kg · try (.+)$/, 'Sist $1×$2 @ $3 kg · prøv $4'], [/^Last (\d+)×(\d+) @ (.+) kg$/, 'Sist $1×$2 @ $3 kg'], [/^Workout saved – (\d+) exercises?$/, function (m, n) { return 'Økten er lagret – ' + n + (n === '1' ? ' øvelse' : ' øvelser'); }],
    [/^(\d+) things added(.*)$/, function (m, n, r) { return n + ' ting lagt til' + r.replace('weather from the season – forecast comes 2 weeks before', 'vær fra årstiden – varselet kommer 2 uker før').replace('rain likely', 'trolig regn'); }]
  );
  (function (add) { for (var k in add) if (!(k in D)) D[k] = add[k]; })({
    'Add a stop': 'Legg til et stopp', 'to see its next departures here – the one by home, work or the gym.': 'for å se neste avganger her – det ved hjemme, jobb eller treningssenteret.',
    'Pin note to the top': 'Fest notatet øverst', 'Unpin note': 'Løsne notatet', 'Pin to the top': 'Fest øverst', 'Unpin': 'Løsne', 'Note deleted': 'Notatet er slettet', 'Goal deleted': 'Målet er slettet',
    'No notes yet. Tap a note to edit it, pin the ones you need, and start lines with “- [ ]” for a checklist.': 'Ingen notater ennå. Trykk på et notat for å endre det, fest de du trenger, og start linjer med «- [ ]» for en sjekkliste.',
    'Steps': 'Steg', 'Add steps': 'Legg til steg', 'Add a step': 'Legg til et steg', 'Add step': 'Legg til steg', 'Remove step': 'Fjern steg', 'Break it into small steps – tick them off as you go.': 'Del det opp i små steg – kryss av underveis.',
    'Hide for today': 'Skjul i dag', 'New': 'Ny', 'Clock in?': 'Stemple inn?', 'Not clocked in yet today': 'Ikke stemplet inn i dag', 'Saved': 'Lagret', 'Earlier versions': 'Tidligere versjoner', 'Kept on your server, one a day for 30 days': 'Lagret på serveren, én per dag i 30 dager',
    'as it was at the start of the day': 'slik det var ved starten av dagen', 'Looking …': 'Ser etter …', 'None yet – the first one is kept tomorrow, after your first change.': 'Ingen ennå – den første lagres i morgen, etter første endring.',
    'Paste the newest worker.js into your Worker to keep daily versions on the server.': 'Lim inn nyeste worker.js i Workeren for å ta vare på daglige versjoner på serveren.', 'Couldn’t get that version right now.': 'Fikk ikke hentet den versjonen nå.',
    'Apple Health': 'Apple Health', 'Steps today': 'Skritt i dag', 'Steps this week': 'Skritt denne uken', 'Exercise minutes today': 'Treningsminutter i dag', 'Exercise minutes this week': 'Treningsminutter denne uken', 'Active calories today': 'Aktive kalorier i dag',
    'Distance this week (km)': 'Distanse denne uken (km)', 'Sleep, 7-night average (h)': 'Søvn, snitt 7 netter (t)', 'Weight, latest (kg) – lower is better': 'Vekt, siste (kg) – lavere er bedre', 'Resting pulse, latest – lower is better': 'Hvilepuls, siste – lavere er bedre'
  });
  P.push(
    [/^Clock (in|out) (\d\d:\d\d)$/, function (m, a, t) { return (a === 'in' ? 'Stemple inn ' : 'Stemple ut ') + t; }], [/^Worked (\d+) h (\d+) min – clock out\?$/, 'Jobbet $1 t $2 min – stemple ut?'],
    [/^This is your dashboard as it was on (.+)\. It opens with the passcode you had then\.$/, 'Dette er dashbordet slik det var $1. Det åpnes med koden du hadde da.'], [/^(.+) removed$/, '$1 er fjernet']
  );
  /* the Modern look: menu bar, More, the home hero */
  (function (add) { for (var k in add) if (!(k in D)) D[k] = add[k]; })({
    'Good morning': 'God morgen', 'Good afternoon': 'God ettermiddag', 'Good evening': 'God kveld', 'Good night': 'God natt',
    'More': 'Mer', 'More pages': 'Flere sider', 'All pages': 'Alle sider', 'Choose what\u2019s in the bar': 'Velg hva som er i menyen', 'Choose your 4 in the bar': 'Velg dine 4 i menyen',
    'Today\u2019s top 3': 'Dagens topp 3', 'A clear day,': 'En rolig dag,', 'Top 3 done today,': 'Topp 3 er gjort i dag,', 'One task left today,': 'Én oppgave igjen i dag,',
    'and an early start tomorrow.': 'og tidlig start i morgen.', 'enjoy the evening.': 'nyt kvelden.', 'make it a good one.': 'gjør den til en god en.', 'keep it going.': 'fortsett sånn.',
    'You\u2019re on track with money this month.': 'Du ligger godt an med pengene denne måneden.', 'You\u2019re over budget this month – take it easy on spending.': 'Du er over budsjett denne måneden – ta det rolig med forbruket.',
    'Everything is in order.': 'Alt er i orden.', 'left today': 'igjen i dag', 'steps': 'skritt', 'focused': 'fokus',
    'Pick the three things that matter most today and give them a time.': 'Velg de tre tingene som betyr mest i dag, og gi dem et tidspunkt.',
    'Nothing on your list. Add a task, or enjoy the free time.': 'Ingenting på listen. Legg til en oppgave, eller nyt fritiden.',
    'Mark as not done': 'Merk som ikke gjort', 'Your day': 'Dagen din', 'Look': 'Utseende', 'Modern': 'Moderne', 'Classic': 'Klassisk', 'Calm': 'Rolig',
    'Your colours, background and card style apply on top': 'Farger, bakgrunn og kortstil legges oppå', 'The original look, with the big clock': 'Det opprinnelige utseendet, med den store klokken'
  });
  P.push(
    [/^(Two|Three|Four|Five|Six|Seven|Eight|Nine|\d+) tasks left today,$/, function (m, n) { return ({ Two: 'To', Three: 'Tre', Four: 'Fire', Five: 'Fem', Six: 'Seks', Seven: 'Sju', Eight: 'Åtte', Nine: 'Ni' }[n] || n) + ' oppgaver igjen i dag,'; }],
    [/^next up: (.+) at (\d\d:\d\d)\.$/, 'neste: $1 kl. $2.'], [/^(.+) at (\d\d:\d\d) tomorrow\.$/, '$1 kl. $2 i morgen.'],
    [/^(.+) in (\d+) days?\.$/, function (m, a, n) { return a + ' om ' + n + (n === '1' ? ' dag.' : ' dager.'); }],
    [/^in (\d+) days?$/, function (m, n) { return 'om ' + n + (n === '1' ? ' dag' : ' dager'); }],
    [/^One more (.+) session hits your weekly goal\.$/, 'Én økt til med $1, så når du ukemålet.'],
    [/^(\d+) more (.+) sessions this week to hit your goal\.$/, '$1 økter til med $2 denne uken for å nå målet.'],
    [/^week (\d+)$/, 'uke $1'], [/^(\d+) of (\d+) done$/, '$1 av $2 gjort'], [/^(\d+) min focused$/, '$1 min fokus']
  );
  /* Plan my day, gestures, keyboard, focus timer (only words not already above) */
  (function (add) { for (var k in add) if (!(k in D)) D[k] = add[k]; })({
    'Plan day': 'Planlegg dagen', 'Plan my day': 'Planlegg dagen', 'Plan your day': 'Planlegg dagen', 'Top 3 today': 'Topp 3 i dag', 'Remove from top 3': 'Fjern fra topp 3',
    'Pick a task below, or type a new one': 'Velg en oppgave under, eller skriv en ny', 'Schedule': 'Sett av tid', 'Pick a slot': 'Velg et tidspunkt', 'Put it here': 'Legg den her',
    'Take it out of the calendar': 'Ta den ut av kalenderen', 'Tasks': 'Oppgaver', 'New task – it goes straight into your top 3': 'Ny oppgave – den går rett inn i topp 3',
    'No other open tasks.': 'Ingen andre åpne oppgaver.', 'Your day': 'Dagen din', 'Fill my day': 'Fyll dagen', 'Nothing left of today.': 'Ikke mer igjen av dagen.', 'Habits today': 'Vaner i dag',
    'Free': 'Ledig', 'Done': 'Ferdig', 'Not done': 'Ikke ferdig', 'Next week': 'Neste uke', 'No date': 'Ingen dato', 'Focus this week': 'Fokus denne uken', 'Not focus': 'Ikke fokus', 'Delete': 'Slett',
    'Top 3 done 🎉': 'Topp 3 ferdig 🎉', 'in your calendar': 'i kalenderen', 'Pick your top 3 and give them a time – 1 minute': 'Velg topp 3 og gi dem et tidspunkt – 1 minutt',
    'Plan my day: one place in the morning for what today holds – and what you\'ll get done.': 'Planlegg dagen: ett sted om morgenen for hva dagen bringer – og hva du skal få gjort.',
    'Top 3 is full – take one out in Plan my day': 'Topp 3 er full – ta ut én i Planlegg dagen',
    'Commands': 'Kommandoer', 'Go to': 'Gå til', 'Pick your top 3 and put them in the calendar': 'Velg topp 3 og legg dem i kalenderen', 'New task': 'Ny oppgave',
    'Add something to your to-do list': 'Legg noe til på gjøremålslisten', 'Quick add': 'Legg til raskt', 'Expense, event, workout, task or note': 'Utgift, hendelse, trening, oppgave eller notat',
    'Start a focus timer': 'Start fokustimer', 'Pause or resume the focus timer': 'Pause eller fortsett fokustimeren', '25 minutes on one task, then a break': '25 minutter på én oppgave, så en pause',
    'Light mode': 'Lyst tema', 'Dark mode': 'Mørkt tema', 'Switch the look': 'Bytt utseende', 'Lock now': 'Lås nå', 'Lock the dashboard on this device': 'Lås dashbordet på denne enheten',
    'Keyboard shortcuts': 'Hurtigtaster', 'All the keys': 'Alle tastene', 'Everywhere': 'Overalt', 'Search and commands': 'Søk og kommandoer', 'Quick add – expense, event, note …': 'Legg til raskt – utgift, hendelse, notat …',
    'Focus timer – start or pause': 'Fokustimer – start eller pause', 'Dark or light': 'Mørkt eller lyst', 'Lock': 'Lås', 'Previous / next': 'Forrige / neste', 'Task menu – top 3, move, focus': 'Oppgavemeny – topp 3, flytt, fokus',
    'Right-click': 'Høyreklikk', 'Focus timer – 25 min': 'Fokustimer – 25 min', 'Focus': 'Fokus', 'Break': 'Pause', 'Pause': 'Pause', 'Resume': 'Fortsett', 'Stop': 'Stopp', 'Stopped': 'Stoppet',
    'Focus for 25 minutes': 'Fokus i 25 minutter', 'Pick a task – or just start.': 'Velg en oppgave – eller bare start.', 'Just start': 'Bare start', 'Start a focus timer ': 'Start fokustimer',
    'Well done – take a 5-minute break.': 'Bra jobbet – ta 5 minutter pause.', 'Break over – ready for the next one?': 'Pausen er over – klar for neste?', 'More numbers – swipe': 'Flere tall – sveip'
  });
  P.push(
    [/^(\d+) events?$/, function (m, n) { return n + (n === '1' ? ' hendelse' : ' hendelser'); }], [/^(\d+) tasks? due$/, function (m, n) { return n + (n === '1' ? ' oppgave' : ' oppgaver') + ' forfaller'; }],
    [/^(\d+) habits? left$/, function (m, n) { return n + (n === '1' ? ' vane' : ' vaner') + ' igjen'; }], [/^(\d+) of 3 picked$/, '$1 av 3 valgt'], [/^(\d+) in the calendar$/, '$1 i kalenderen'],
    [/^(\d+) more in To-do$/, '$1 til i Gjøremål'], [/^(\d+) of (\d+) done$/, '$1 av $2 ferdig'], [/^Today: (.+)$/, 'I dag: $1'], [/^Done today: (.+)$/, 'Ferdig i dag: $1'],
    [/^(.+) → (today|tomorrow|next week|no date)$/, function (m, a, w) { return a + ' → ' + { today: 'i dag', tomorrow: 'i morgen', 'next week': 'neste uke', 'no date': 'ingen dato' }[w]; }],
    [/^(\d+) min focused today$/, '$1 min fokus i dag'], [/^Show (\d+) more$/, 'Vis $1 til'], [/^(.+) – (\d+:\d\d) left$/, function (m, a, t) { return tr(a) + ' – ' + t + ' igjen'; }]
  );
  P.push(
    [/^No spending logged in (.+)\.$/, 'Ingen utgifter ført i $1.'], [/^Spent, all years$/, 'Brukt, alle år'], [/^Spent, (.+)$/, function (m, a) { return 'Brukt, ' + tr(a).toLowerCase(); }],
    [/^(\d+) % of spending( · new)?( ·)?$/, function (m, n, nw, d) { return n + ' % av forbruket' + (nw ? ' · ny' : '') + (d || ''); }],
    [/^Spending so far this month: (.+) of a (.+) budget$/, 'Brukt hittil denne måneden: $1 av et budsjett på $2'], [/^Fixed (.+), spent (.+), left (.+)$/, 'Faste $1, brukt $2, igjen $3'],
    [/^Spending per month, (.+) to (.+)\. Table below\.$/, 'Forbruk per måned, $1 til $2. Tabell nedenfor.'], [/^Visits per day, (.+)$/, function (m, a) { return 'Besøk per dag, ' + tr(a).toLowerCase(); }],
    [/^(\d+) trips?$/, function (m, n) { return n + (n === '1' ? ' tur' : ' turer'); }], [/^(\d+) in total$/, '$1 totalt'], [/^(\d+) places?$/, function (m, n) { return n + (n === '1' ? ' sted' : ' steder'); }],
    [/^Trips in (\d{4})$/, 'Turer i $1'], [/^Days away in (\d{4})$/, 'Dager borte i $1'], [/^Spent on travel (\d{4})$/, 'Brukt på reise i $1'],
    [/^Training: (\d+) of (\d+) this week$/, 'Trening: $1 av $2 denne uka'], [/^(.+): (\d+) of (\d+) this week$/, function (m, a, x, y) { return tr(a) + ': ' + x + ' av ' + y + ' denne uka'; }],
    [/^(\d+) more · (\d+) days left – today counts$/, '$1 til · $2 dager igjen – i dag teller'], [/^an even pace for (.+)\.$/, 'et jevnt tempo for $1.'], [/^av this week’s targets so far$/, 'av ukas mål så langt'], [/^of this week’s targets so far$/, 'av ukas mål så langt'],
    [/^(\d+) tips$/, '$1 tips'], [/^(.+) er over fristen$/, '$1 er over fristen'], [/^Rent is overdue$/, 'Husleien er over fristen'],
    [/^Shown · (.+)$/, 'Vises · $1'], [/^Hidden · (.+)$/, 'Skjult · $1'], [/^Show (.+) on the website$/, function (m, a) { return 'Vis ' + a + ' på nettsiden'; }], [/^Show (.+) on jplundberg\.com$/, function (m, a) { return 'Vis ' + a + ' på jplundberg.com'; }],
    [/^(Instagram|LinkedIn|GitHub|Facebook|X|YouTube|TikTok) username or link$/, 'Brukernavn eller lenke for $1'], [/^Open (Instagram|LinkedIn|GitHub|Facebook|X|YouTube|TikTok)$/, 'Åpne $1'],
    [/^Colour for (.+)$/, function (m, a) { return 'Farge for ' + tr(a); }], [/^Number for (.+)$/, 'Tall for $1'],
    [/^(.+) workdays? during (.+)$/, function (m, n, a) { return n + ' arbeidsdager under ' + a; }],
    [/^vs previous (\d+) months$/, 'mot forrige $1 måneder'], [/^paid the (\d+)(st|nd|rd|th)$/, 'utbetales den $1.'], [/^paid last day$/, 'utbetales siste dag'], [/^Paid on the (\d+)\.$/, 'Utbetales den $1.'],
    [/^gross (.+) − tax (.+)$/, 'brutto $1 − skatt $2'], [/^Spent in (.+)$/, function (m, a) { return 'Brukt i ' + a; }], [/^(.+) net$/, '$1 netto'], [/^net (.+)$/, 'netto $1'], [/^gross (.+)$/, 'brutto $1'], [/^tax (.+)$/, 'skatt $1'], [/^deductions (.+)$/, 'trekk $1'],
    [/^(.+) net a month$/, '$1 netto i måneden'], [/^(.+) per month$/, '$1 per måned'], [/^June (.+)$/, 'Juni $1'], [/^December (.+)$/, 'Desember $1'], [/^this year: net (.+)$/, 'i år: netto $1'], [/^Remove (.+)$/, function (m, a) { return 'Fjern ' + a; }],
    [/^of (.+) net income$/, 'av $1 netto inntekt'], [/^(.+)\/day until payday$/, '$1/dag til lønning'], [/^(.+)\/day$/, '$1/dag'], [/^(\d+) more$/, '$1 til'], [/^\+(\d+) more$/, '+$1 til'],
    [/^(.+), (.+), done$/, function (m, a, b) { return a + ', ' + b + ', utført'; }], [/^(\d+) expenses?$/, '$1 utgifter'], [/^(\d+) tips$/, '$1 tips'],
    [/^(\d+) hidden$/, '$1 skjult'], [/^Only (.+)$/, function (m, a) { return 'Bare ' + tr(a); }], [/^(\d+) of (\d+)$/, '$1 av $2'], [/^over budget · of$/, 'over budsjett · av'], [/^left (.+) · of$/, function (m, a) { return 'igjen ' + tr(a) + ' · av'; }], [/^(\d+) expenses? ·$/, '$1 utgifter ·'],
    [/^\(DNB, Sparebank 1, Nordea and the others have it under the account’s history\) and pick the file here\. Only what you spent is imported – salary, card payments and transfers are left out – and rows you already have are skipped\. Nothing leaves your browser\.$/, '(DNB, Sparebank 1, Nordea og de andre har det under kontohistorikken) og velg filen her. Bare det du har brukt importeres – lønn, kortbetalinger og overføringer utelates – og rader du allerede har hoppes over. Ingenting forlater nettleseren din.'], [/^The (\d+) months before$/, 'De $1 månedene før'], [/^before (.+)$/, 'før: $1'], [/^(\d+) months$/, '$1 måneder'], [/^(\d+) more tasks?$/, function (m, n) { return n + (n === '1' ? ' oppgave til' : ' oppgaver til'); }], [/^(.+) kr\/month$/, '$1 kr/mnd.'], [/^vs previous (\d+) months$/, 'mot forrige $1 måneder'], [/^vs (\d{4})$/, 'mot $1'], [/^vs (?!previous)(.+)$/, function (m, a) { return 'mot ' + a; }],
    [/^(\d+) more categor(y|ies)$/, function (m, n) { return n + (n === '1' ? ' kategori til' : ' kategorier til'); }], [/^(\d+) of (\d+) sections shown$/, '$1 av $2 seksjoner vises'], [/^(\d+) % of this week’s targets so far$/, '$1 % av ukas mål så langt'],
    [/^(.+) kr more than usual$/, '$1 kr mer enn vanlig'], [/^Category for (.+)$/, 'Kategori for $1'],
    [/^You spend about (.+) a day – (.+) a day keeps you on budget$/, 'Du bruker omtrent $1 om dagen – $2 om dagen holder deg innenfor budsjettet']
  );

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
