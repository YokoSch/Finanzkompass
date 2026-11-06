# Entwicklernotizen / Übergabe an künftige ChatGPT-Sitzungen

**Projekt:** Finanzkompass, Version 1.0.0 (05.11.2026). Dies ist die gezielte Kurzorientierung für spätere Anpassungen: bitte zuerst `ARCHITEKTUR.md` und diese Notizen lesen, bevor die Funktionalität geändert wird.

## Ausgangswünsche des Nutzers

- Kein gewöhnliches Haushaltsbuch, sondern ein **Liquiditätsplaner**, der den *geringsten künftigen Kontostand* untersucht und daraus ein **sicheres Ausgabelimit heute** ableitet.
- Frei wählbarer Simulationszeitraum, **standardmäßig 1 Jahr ab heute**, tagesgenau.
- Aktueller Ist-Kontostand, individuelle Einnahmen und Ausgaben, einmalig und wiederkehrend.
- Jede Buchung pro Tag anlegen, bearbeiten, ausfallen lassen oder verschieben. Bei Serie wählbar: nur dieser Termin, ab diesem Termin, gesamte Serie.
- Minimalistisches, übersichtliches UI. Hauptbereiche: Übersicht, Kalender, Buchungen. Extras nachgelagert, wenig Pflichtfelder, schnelle Eingabe.
- Lokal/offline als HTML-Datei; **modularer Code, erklärende Kommentare, dauerhafte Dokumentation**, damit spätere Änderungen überschaubar sind.

## Aktueller Projektstatus

- In `dist/Finanzkompass.html` liegt die fertige Einzeldatei.
- In `src/` liegt der modulare, in ESM-Dateien aufgeteilte Quellcode.
- Das Backend ist **kein Backend**, sondern der browserunabhängig testbare JavaScript-Rechenkern.
- `npm test` sollte **20 Engine-Tests** bestehen. Zusätzlich `python tests/browser-smoke.py` für Chrome/Playwright (falls installiert).
- Der CSS-Look ist bewusst neutral/modern: viel Weißraum, gedecktes Petrol/Türkis, dezente Linien, mobil Bottom-Navigation + FAB, Desktop Sidebar, Extras in Dialogen/`details`.

## Dateien – wo ändert man was?

| Wunsch | Datei(en) | Achtung |
| --- | --- | --- |
| Berechnung des sicheren Betrags | `src/forecast.js` | `lowCents`, nicht nur `closingCents`! |
| Neuer Rhythmus / Terminlogik | `src/recurrence.js`, `src/date.js` | Monatshebel **vom Originalanker**, Ausnahmen per Index |
| Einzeltermin ändern / Serie teilen | `src/operations.js` | Snapshot-Historie erhalten, keine Doppelbuchungen |
| JSON-Datenformat ändern | `src/model.js`, `src/persistence.js` | `version` + Migrationspfad + Tests vor Import alter Backups |
| Dialoge oder Seiten gestalten | `src/ui-render.js`, `src/styles.css` | Nutzerstrings immer `esc()`; Mobile prüfen |
| Klick- und Eingabeereignisse | `src/ui-actions.js` | Änderungen nur via `mutate`; kein manuelles DOM als Quelle der Wahrheit |
| Diagramm / Performance | `src/chart.js` | Tiefpunkte beim Downsampling erhalten |
| Quellcode in Einzel-HTML bauen | `scripts/build.mjs` | Feste Dateireihenfolge ergänzen |
| Farb- und Icon-Stil | `src/styles.css`, `src/icons.js` | Keine externen Dienste einführen |

## Kritische Fallstricke, die bereits abgefangen sind

1. **Doppelverbuchung:** Wer seinen aktuellen Bankkontostand selbst aktualisiert hat, darf eine Zahlung danach nur als „bereits enthalten“ markieren. Sonst wird doppelt gerechnet. Zwei explizite Buchungsmodi vorhanden.
2. **Monatsende:** 31.01. → 28.02. → 31.03. Nie den Februar als neuen Serienanker missbrauchen.
3. **Sommerzeit:** ISO-Tage statt lokaler JavaScript-24h-Intervalle.
4. **Änderung einer Serie ab Dezember:** Die originale Novemberbuchung muss erhalten bleiben; alte Serie bis vorherigen Nominaltermin begrenzen, neue Serie mit neuem Anker anlegen.
5. **Änderung „gesamte Serie“ auf einer Dezemberbuchung:** Serienbeginn nicht versehentlich auf Dezember setzen. Beispielsweise Dezember 15 → Dezember 12 muss den ursprünglichen Novemberanker 15 → 12 verschieben.
6. **Geändertes Wochenende:** Wenn eine Buchung wegen Wochenende am Montag sichtbar ist, darf eine reine Betragsänderung an der gesamten zukünftigen Serie nicht den ursprünglich festgelegten Wochentag/Monatstag überschreiben.
7. **Gebuchte Historie:** Muss auch sichtbar bleiben, wenn die zugrunde liegende Serie gelöscht oder getrennt wird. Deshalb gebuchte Snapshots unabhängig von aktiven Regeln hinzufügen.
8. **Rückgängig nach manuellem Saldoabgleich:** Alte Saldo-Korrekturen in `posted` dürfen dann nicht mehr abgezogen werden (`cleanAfterManualBalanceUpdate`).
9. **Graphen-Zoom:** `viewStart` ist Darstellung, nicht Beginn der Sicherheitsrechnung. Sonst werden Engpässe vor dem Zoom verschwiegen.
10. **Lokaler Speicher kann gesperrt sein:** Dann ist nur die aktuelle Session möglich; dauerhafte Warnung und JSON-Sicherung anbieten, keine vorgetäuschte Persistenz.

## Aktuelle, bewusst nicht gelöste Punkte

- **Kein Abgleich mit Bankumsätzen**. Der Nutzer aktualisiert Saldo und erledigte Buchungen manuell.
- **Feiertage** werden bei automatischer Mo–Fr-Verschiebung nicht berücksichtigt. Es wird nicht behauptet, dass Bankarbeitstage vollständig modelliert sind.
- Buchungen mit Datum **vor** dem aktuellen Ist-Saldo-Stichtag werden nicht rückwirkend in den laufenden Saldo hineingerechnet. Das ist absichtlich so, um bereits enthaltene Zahlungen nicht doppelt zu zählen. Rückständige, unbezahlte Forderungen müssen ausdrücklich als noch kommende Zahlung aufgenommen werden.
- **Keine automatischen variablen Budgets** (Lebensmittel usw.); spontan geplante Ausgaben können als Einmalbuchungen erfasst werden.
- **Kein Draggable Calendar**. Einzeltermine lassen sich über das Datum im Dialog sicher verschieben. Drag & Drop ist eine potenzielle Komforterweiterung, muss aber dieselben `changeOccurrence`-Operationen verwenden und darf Serienmodi nicht umgehen.
- **Keine mobile App-Installation/PWA**, nur lokal ausführbare HTML-Datei.
- `localStorage` ist nicht verschlüsselt und an Browser/Ursprung gebunden. **Backup** bleibt der portable Weg.
- Große Horizonte sind bis 160.000 Tage technisch begrenzt; Tagesdiagramm verwendet Min-Max-Downsampling, nicht eine millionenlange SVG-Linie.

## Was bei einer neuen Feature-Anfrage tun?

1. Betroffene fachliche Invariante identifizieren (z. B. Serienanpassung, gebuchte Snapshots, Kontostand-Stichtag).
2. Wenn der Rechenkern betroffen ist: **zuerst Node-Regressionstest** in `tests/engine.test.mjs` ergänzen.
3. Fachlogik in `operations.js` / `recurrence.js` / `forecast.js` ändern, nicht im HTML-Renderer.
4. Dialog und Klickaktion getrennt hinzufügen (`ui-render.js` vs. `ui-actions.js`).
5. Für die minimale Oberfläche neue Optionen nach Möglichkeit als sekundären Dialog/`details` statt dauerhaft sichtbar darstellen.
6. `npm test`, `npm run build`, `python tests/browser-smoke.py` laufen lassen; mobile Darstellung bei ca. 390 px prüfen.
7. Änderungen in `CHANGELOG.md` und ggf. `ARCHITEKTUR.md` dokumentieren; Schemaänderungen brauchen Version/Migration.
8. Der Nutzer soll nach Änderungen **immer die neue gebaute HTML-Datei und ggf. das geänderte Quellprojekt** erhalten.

## Beispiel einer nachvollziehbaren neuen Funktion

Neue Regel: „Alle 2 Monate“. Der Engine liegt schon `interval: 2` vor, aber das UI setzt aktuell immer `interval: 1`. Vorgehen: `newRule` um `interval` aus Formdaten erweitern, `validateState` unverändert (unterstützt bereits Integer ≥ 1), im Modal nur bei `frequency != none` eine kompakte erweiterte Einstellung anbieten, und zusätzliche Tests zu Monatsenden / Jahreswechseln schreiben. Im Build keine neue Datei nötig.

## Datenschutz und Fehlersuche

- Im Browser können Entwicklungsinformationen lesend geprüft werden: `FinanzkompassDebug.state()` und `FinanzkompassDebug.forecast()` (nur geklonte Objekte).
- In den Testdaten enthaltene Personen-/Kontodaten nicht in Fehlermeldungen oder öffentliches Logging übernehmen. Keine Telemetrie nachrüsten, außer wenn der Nutzer dies ausdrücklich will.
- Importdateien sind untrusted input; Validierung und HTML-Escaping dürfen nicht umgangen werden.

**Architekturentscheidung:** Lieber eine neue kleine Domänenfunktion mit Tests als ein immer größerer Eventhandler. Das erhält die spätere Änderbarkeit, auf die der Nutzer besonderen Wert legt.
