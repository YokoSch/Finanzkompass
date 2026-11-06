# Finanzkompass — Architektur und Entwicklerübergabe

**Stand:** Version 1.0.0, 05.11.2026. Diese Datei ist die wichtigste Grundlage für spätere Änderungen. Das System ist bewusst ohne Framework, Build-Abhängigkeiten oder Fremd-APIs geschrieben. Oberfläche, fachliche Operationen, Wiederholungslogik und Simulator sind getrennt.

## 1. Dateien und Abhängigkeiten

| Datei | Verantwortung | Regeln |
| --- | --- | --- |
| `src/date.js` | Kalender-Arithmetik, ISO-Tage, Monats-/Jahresanker, Wochenenden | keine Browser-Abhängigkeit |
| `src/money.js` | Cent-Konvertierung, deutsche Eingabe-/Ausgabeformate | keine Fließkomma-Kontostände |
| `src/model.js` | Datenstruktur, Initialzustand, IDs, vollständige Import-/Zustandsvalidierung | Versionsnummer erhöhen bei inkompatiblen Schemaänderungen |
| `src/recurrence.js` | Terminerzeugung, manuelle Ausnahmen, gebuchte Termine ausblenden | keine Mutationen am Zustand |
| `src/forecast.js` | tägliche Prognose, Reserve, Mindestbetrag, Monatsdurchschnitt | rein funktional und UI-unabhängig |
| `src/operations.js` | neue Ausnahmen, Termin-/Serienbearbeitung, Verbuchung, Storno | einzige Fachschicht für diese Änderungen |
| `src/persistence.js` | localStorage, JSON-Import und -Export | Validierung bei Laden, vor Speichern und Import |
| `src/icons.js` | interne SVG-Icon-Bibliothek | keine externen Ressourcen |
| `src/chart.js` | generierter interaktiver SVG-Kontostandsverlauf | rein visualisierend |
| `src/ui-render.js` | HTML-Darstellung für Ansichten, Modals, Listen | niemals Domänenzustand verändern; alle Fremdtexte via `esc()` |
| `src/ui-actions.js` | `FinanceUI`: UI-Zustand, Eventdelegation, Formulare, Navigation, Commit | **einziger** UI-Controller, Änderungen via `mutate` |
| `src/main.js` | Bootstrap + lesbarer Debug-Snapshot | kleines Einstiegsskript |
| `src/styles.css` | Design-Tokens, Desktop/Mobile, Hell/Dunkel | keine Netzfonts; responsive |
| `scripts/build.mjs` | Modulquelltexte und CSS in ein Offline-HTML einfügen | Reihenfolge manuell, keine externen Pakete |
| `tests/engine.test.mjs` | automatisierte fachliche Tests | bei neuen Regeln ergänzen |

Datenfluss: **Event → `FinanceUI.handleSubmit` / `handleClick` → `mutate(clonedState)` → `operations` oder `newRule` → `validateState` → `forecast` → `saveState` → `renderApp`.** Ohne erfolgreiche Persistenz wird ein mutierter Zustand nicht übernommen.

## 2. Datenmodell (Version 1)

```js
{
  version: 1,
  settings: {
    currentBalanceCents: 125000,  // aktueller Konto-Snapshot 1.250,00 EUR
    balanceDate: '2026-11-05',     // Datum des bestätigten Kontostands
    viewStart: '2026-11-05',       // Anzeigebeginn, nicht Risikobeginn
    viewEnd: '2027-11-05',         // inklusive bis zu diesem Tag simulieren
    reserveCents: 10000,          // 100 EUR Reserve
    theme: 'system'               // system | light | dark
  },
  rules: [{
    id: '...', title: 'Gehalt', amountCents: 210000, // Ausgaben negativ!
    anchor: '2026-11-15', frequency: 'monthly', interval: 1,
    until: null, weekdayPolicy: 'none', note: '', createdAt: '...'
  }],
  exceptions: [{
    id: '...', ruleId: '...', occurrenceIndex: 1,
    action: 'override', date: '2026-12-12',
    title: 'Gehalt', amountCents: 210000, note: ''
  }],
  posted: [{
    id: '...', ruleId: '...', occurrenceIndex: 0,
    date: '2026-11-15', title: 'Gehalt', amountCents: 210000,
    balanceAdjustmentCents: 210000, createdAt: '...'
  }],
  updatedAt: '...'
}
```

### Regeln und Terminidentität

Für jede Regel wird **die logische Terminnummer** `occurrenceIndex` erzeugt: 0, 1, 2, ... . Bei monatlicher Serie mit `anchor=2026-11-15` ist Index 1 nominell der 15.12., Index 2 der 15.01. Folgende Konzepte sind streng getrennt:

- `nominalDate`: der ursprüngliche von der Regel generierte Kalendertag. Dieser bleibt eine stabile Referenz.
- `date`: tatsächlicher **geplanter** Termin nach Wochenendregel und/oder expliziter Ausnahme.
- `exceptions`: nur **eine** Ausnahme je Kombination `(ruleId, occurrenceIndex)`; `skip` oder `override` (neues Datum, Bezeichnung, Betrag). `override` ersetzt, dupliziert nicht.
- `posted`: eine tatsächlich verbuchte Zahlung dieses logischen Termins; sie wird nicht nochmals in die zukünftige Simulation aufgenommen. Historie bleibt erhalten, selbst wenn die Regel gelöscht wird.

`materializeEvents(state, from, to, {includePosted})` ist die zentrale Methode: die UI darf Wiederholungen **nicht noch einmal selbst** generieren.

### Die drei Bearbeitungsumfänge

`changeOccurrence(state, event, newValues, scope)`:

- `once`: `exceptions`-Override setzen (für Einmalregeln direkt den Regeltermin ändern).
- `future`: bestehende Regel am vorherigen nominalen Termin beenden, neue Regel ab gewähltem Datum anlegen. Zukünftige Ausnahmen wechseln zur neuen Regel und ihre Indizes werden entsprechend reduziert.
- `all`: Regel bearbeiten; `shiftedSeriesAnchor()` ermittelt den passenden **neuen ersten Serienanker**, statt den geöffneten Termin aus einer späteren Periode zum Serienstart zu machen.

**Vorsicht bei Änderungen:** Wenn bereits Ausnahmen vorhanden sind, muss die Beziehung zur logischen Terminnummer erhalten bleiben; `posted` ist eine eigenständige Ist-Historie und darf nicht rückwirkend verändert werden. Bei komplizierten Änderungen (Wechsel des Rhythmus mit vielen Ausnahmen) muss später ggf. ein Migrationsdialog ergänzt werden.

## 3. Simulationsinvarianten

1. `currentBalanceCents` ist ein **Snapshot**, kein Anfangswert seit Kontoeröffnung. Schon enthaltene Zahlungen dürfen nicht doppelt gezählt werden.
2. Alle Beträge bleiben ganzzahlige, sichere JavaScript-Centwerte; Einnahme positiv, Ausgabe negativ.
3. Die Risikorechnung beginnt **immer** bei `settings.balanceDate`, unabhängig vom gewählten späteren grafischen `viewStart`.
4. Der Horizont endet **einschließlich** `settings.viewEnd`.
5. An einem Tag werden alle ausstehenden negativen Beträge **vor** positiven berücksichtigt, da die exakte Bankreihenfolge unbekannt ist. Auch innerhalb eines einzigen Tages kann deshalb der `lowCents` unter `closingCents` liegen.
6. `minCents` berücksichtigt bereits den ursprünglichen Kontostand und alle Tages-Zwischentiefs.
7. `safeSpendCents = max(0, minCents - reserveCents)`; `shortfallCents = max(0, reserveCents - minCents)`.
8. Gespeicherte `posted`-Zahlungen werden in `materializeEvents(..., includePosted=false)` **übersprungen**.
9. Für Monats-/Jahrestermine stets vom ursprünglichen Anker rechnen. Nicht aus 31.01. → 28.02. den anschließenden 28.03. ableiten. Ein 29. Februar wird jährlich in Nichtschaltjahren auf den 28. Februar geklemmt.
10. Kalendarische Daten sind **keine Zeitstempel**. Hilfsfunktionen rechnen mit UTC-Kalendertagen, um Sommer-/Winterzeitfehler zu vermeiden.

`forecast(state, end)` liefert `{days, events, minCents, minDate, endCents, safeSpendCents, shortfallCents}`. Jeder Tageswert enthält opening, debit, credit, low, closing und count.

Die Grafik zeigt Tages-**Endstände**; der Sicherheitswert verwendet hingegen die niedrigeren Tages-**Zwischenstände**. Das ist bewusst und muss in der UI erklärt bleiben.

## 4. Kontoanker und „gebucht“

`postOccurrence` unterstützt zwei Modi:

- `adjust`: bereits tatsächlich abgegangenen/erhaltenen Betrag auf `currentBalanceCents` addieren; Terminkey als `posted` markieren. `balanceAdjustmentCents` speichert den durch die Aktion verursachten Korrekturwert.
- `included`: der vom Nutzer eingetragene Konto-Snapshot enthält den Betrag schon; nur `posted` markieren, `balanceAdjustmentCents=0`.

`undoPosted()` kann diese automatischen Änderungen rückgängig machen. Bei einer **manuellen neuen Kontostandseingabe** setzt `cleanAfterManualBalanceUpdate()` alle vorherigen `balanceAdjustmentCents` auf 0, damit ein späteres Rückgängig nicht einen inzwischen vollständig aktualisierten Bank-Saldo beschädigt.

Offene Zahlungen **vor** `balanceDate` werden nicht als automatische Rückstände auf heute geschoben: ohne Bankhistorie ist nicht erkennbar, ob sie stattgefunden haben. Deshalb weist die Startseite auf veraltete Konto-Snapshots hin.

## 5. Benutzeroberfläche und Änderungen

`FinanceUI` unterscheidet:

- `state`: persistente Finanzdaten.
- `view`, `modal`, `toast`, `calendarMonth`, `selectedDay`, `bookingFilter`, `search`, `chartDate`, `rangePreset`: flüchtige Darstellungszustände.
- `result`: jeweils neu berechnetes Forecast-Ergebnis.
- `eventMap`: aktuelle gerenderte Termine nach `event.key`, damit Klicks ohne HTML-Serialisierung funktionieren.

`renderApp()` baut das DOM nach fachlichen Änderungen oder Navigation neu auf. Formularwerte bei Fehlern werden mit `captureDraft()` gesichert. Die Suchliste wird auf Texteingabe isoliert aktualisiert, damit der Cursor im Suchfeld nicht springt. Klick- und Formularereignisse laufen über Eventdelegation am App-Root (`data-action`, `data-form`).

**Neue UI-Aktion hinzufügen:**

1. `ui-render.js`: Button mit `data-action="neue-aktion"` anbringen.
2. `ui-actions.js`: Action im `handleClick`-Switch ergänzen oder `handleSubmit`-Fall ergänzen.
3. Fachliche Mutationen als neue Funktion in `operations.js` kapseln und ausschließlich via `mutate()` anwenden.
4. Bei Zustandsschemaänderungen `model.js`-Validierung, Versionsstrategie, Import und Tests erweitern.
5. CSS möglichst in designkompatiblen Komponenten ergänzen, mobile Breakpoints prüfen.
6. `npm test`, `npm run build`, Browser-Schnelltest und JSON-Roundtrip ausführen.

**Sicherheit:** `esc()` aus `ui-render.js` für jeden Inhalt verwenden, der aus Benutzereingabe oder Import stammen kann. `innerHTML` niemals mit ungeprüften Strings befüllen. Kein `eval`, keine externen APIs, keine Zugangsdaten.

## 6. Standalone-Build

`npm run build` erzeugt `dist/Finanzkompass.html`. Das Buildskript verkettet die ESM-Quelldateien in einer genau definierten Reihenfolge und entfernt nur die **statischen Import-/Export-Deklarationen**. Alle Funktionen landen im selben gekapselten Scope. Deshalb:

- Neue Quelldatei **in `scripts/build.mjs` an der korrekten Stelle** in `order` ergänzen.
- Keine gleichnamigen top-level `const`/`let`/Funktionen in verschiedenen Modulen, da die Standalone-Fassung sonst einen Syntaxfehler bekommt.
- Keine dynamischen Imports oder unüblichen mehrzeiligen Importformen, ohne das Buildskript zu erweitern.
- Immer auch den Standalone-Build testen — erfolgreiche ESM-Tests allein garantieren noch keinen fehlerfreien Bundle-Scope.

`src/index.html` ist die entwicklerfreundliche Modulversion und sollte über einen lokalen Webserver geöffnet werden. `dist/Finanzkompass.html` ist die vom Nutzer benötigte Einzeldatei.

## 7. Bekannte Beschränkungen

- Keine Synchronisation mit Banken oder über mehrere Geräte. Kein Cloud-Backup. Browser-Storage ist nicht garantiert dauerhaft.
- Keine amtlichen Feiertagskalender oder Banking-Cutoff-Zeiten. Mo–Fr ist **nicht** identisch mit Bankarbeitstagen.
- Keine mehrteiligen Buchungen, Kategorien, Haushaltsbudgets, Währungswechsel, Zinsen/Dispolimits oder Kontoüberträge.
- Keine nachträgliche historische Kontorekonstruktion vor dem Konto-Snapshot.
- Die „Ø monatlicher Überschuss“-Kennzahl nutzt vereinfachte Frequenzfaktoren, nicht den exakten tatsächlichen Jahresplan; Einzelzahlungen und Serienlaufzeiten werden dort nicht berücksichtigt.
- Serienänderung `future` und vorhandene Overrides sind über Vorkommensindizes gekoppelt; bei komplexen Kombinationen von Terminverschiebungen über die Serienendgrenze hinaus sollte die Logik vor neuer Funktionalität gezielt mit Regressionstests erweitert werden.
- JSON-Version 1 wird validiert. Bei künftigen Breaking Changes einen expliziten Migrationseintritt für alte JSON-Dateien implementieren; nicht einfach alte Daten stillschweigend umformen oder überschreiben.
