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
