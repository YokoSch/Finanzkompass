# Testplan und Grenzfälle

## Automatisierte Tests

Im Projektordner ausführen:

```bash
npm test
npm run build
```

Die Tests in `tests/engine.test.mjs` prüfen insbesondere:

- Kontostand ohne Buchungen und korrekte Reserve/Deckungslücke.
- Ausgaben **vor** Einnahmen am selben Tag; Zwischenminimum statt Tagesendstand.
- Monate mit 28/29/30/31 Tagen, 29. Februar und Sommer-/Winterzeit.
- Verschieben nur einer Dezember-Gehaltszahlung ohne zweite Buchung am Ursprungstag.
- Serienänderung ab einem Termin, sowie gesamte Serie ohne unbeabsichtigtes Entfernen älterer Termine.
- Wochenendverschiebung über Monatsgrenzen.
- „Gebucht“ mit und ohne Kontostandskorrektur, Rückgängig und neuem Konto-Snapshot.
- Ausfall/Rücknahme eines einzelnen Termins.
- Parsing deutscher Geldbeträge und Zurückweisen beschädigter JSON-Daten.

## Manuelle Browser-Abnahme

**Erster Start:** App ohne bestehende Daten öffnen. Test: Übersicht mit Willkommenshinweis, keine fiktiven Buchungen, Reserve 0, Zeitraum 1 Jahr.

**Eingabe:** Über **Kontostand eingeben** `800,00` speichern. Dann neue Einnahme **Gehalt**, `2000`, monatlich am 15., und eine einmalige Ausgabe **Miete**, `450`, am 8. anlegen. Diagramm, sicherer Betrag und nächste Termine aktualisieren sich sofort.

**Editieren:** Kalender öffnen, nächsten monatlichen Gehaltstermin auswählen, nur diese Buchung vom 15. auf den 12. verschieben; prüfen, dass es im Monat nur eine Zahlung gibt und der Folgemonat wieder den ursprünglichen Termin benutzt. Dieselbe Änderung mit Scope „Diese und alle folgenden“ auf eine weitere Serie testen.

**Gebucht:** Öffne eine geplante Ausgabe, wähle **Als gebucht markieren → Ist im Kontostand bereits enthalten**. Das geplante Vorkommen verschwindet aus der Vorschau, der Kontostand bleibt gleich. Einmal auch **Kontostand jetzt mitändern** testen: der tatsächliche Betrag wird genau einmal belastet. Den Vorgang rückgängig machen.

**Szenario:** **Ausgabe testen**, Betrag und Datum eingeben, Auswirkungen prüfen, ohne das Szenario zu speichern. Anschließend optional per **Als Buchung übernehmen** zur Erfassung wechseln.

**Zeitraum:** 1M / 3M / 6M / 1J durchklicken, dann frei wählbares Enddatum setzen. Sicherer Betrag rechnet vom Kontostand-Stichtag bis zum Ende, selbst wenn die Anzeige später startet.

**Datensicherung:** Ein JSON-Backup exportieren. Danach neue Buchung erstellen. Backup erneut importieren und den Dialog bestätigen: vorheriger Stand sollte wiederhergestellt sein. Bei ungültiger/inkompatibler JSON-Datei bleibt der bestehende Zustand unverändert.

**Bedienung:** 1440 px Desktop, 768 px Tablet und 375 px Mobilgerät, Light und Dark Theme. Alle drei Ansichten, Modals, Bottom-Navigation, Plus-Button, Kalender und Suchfeld prüfen. Tastaturbedienung: Tab/Enter/Escape.

## Wichtige negative Szenarien

- Konto < Reserve, auch ohne Zahlungen: sicher ausgebbar ist 0, Fehlbetrag > 0.
- Gehalt und Miete am gleichen Tag: Miete vorher berücksichtigt.
- Buchung am 31. eines Monats: Februar klemmt, März kehrt zum 31. zurück.
- Eine Einzelabweichung vom Monatsersten auf das Vormonatsende verschieben; keine Doppelbuchung.
- Alte Serien-/Kontodaten nach mehreren Wochen öffnen: Hinweis auf veralteten Kontostand.
- Eine erledigte Einmalbuchung löschen/Serie entfernen: historische Ist-Zahlungen bleiben gesondert gespeichert.
- Negativer Kontostand als manueller Snapshot ist zulässig; negative Reserve nicht.
- Wiederholungsende vor dem Startdatum muss bei Neuanlage abgewiesen werden.
- Keine Mehrfacheinträge bei wiederholtem Speichern/importieren gleicher Ausnahmen.
- Eingefügter Text wie `<script>alert(1)</script>` ist in der UI als Text anzuzeigen und darf nie ausgeführt werden.

## Build-Abnahme für spätere Versionen

Die modularen Skripte der Root-`index.html` müssen sowohl nach Entpacken über `file://` (soweit lokale Dateien erlaubt sind) als auch unter GitHub Pages funktionieren. Der optionale Standalone-Export `dist/Finanzkompass.html` wird im Browser-Smoke-Test aus denselben Skripten getestet. Browser-Konsole auf JavaScript-Fehler prüfen. Nach einem Schemawechsel unbedingt vorhandene JSON-Backups als Migrationsfall testen, bevor ausgeliefert wird.
