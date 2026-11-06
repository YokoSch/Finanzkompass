# Geplante Erweiterungen und technische Leitplanken

Dieses Dokument ist eine Ideensammlung, **kein** Versprechen, dass die genannten Funktionen schon vorhanden sind.

## Naheliegende Funktionen

1. **Schnelltext-Eingabe** (`Einkauf 32,50`) mit Vorschau und Bestätigung; Parser als eigenes Modul und Unit-Tests bauen. Niemals ohne Bestätigung Betrag und Vorzeichen erraten.
2. **Drag & Drop im Kalender** zum Verschieben eines Vorkommens. Muss dieselbe fachliche `changeOccurrence(..., 'once')`-Funktion wie der Dialog verwenden.
3. **Kategorien / optionale Notizen** für Buchungen und bessere Monatsanalysen, ohne die vier Pflichtangaben der Schnelleingabe zu vergrößern.
4. **Echte Bankarbeitstage**: landes- und ggf. bankabhängige Feiertage (Deutschland/Bundesland) plus klare Regeln für frühere/spätere Verschiebung.
5. **Mehr Konten** und Überträge mit sauberer Trennung je Snapshot; Überträge dürfen Gesamtsaldo nicht als Einkommen/Ausgabe aufblähen.
6. **Import/Export ergänzen** durch CSV mit Vorschau und Dublettenprüfung; JSON bleibt vollständiges natives Backup.
7. **Benachrichtigungen / Prognosewarnungen** für zukünftige Deckungslücken — nur opt-in, lokal und datensparsam.
8. **Gleitende Szenarien**: eine geplante Ausgabe oder Einnahme nur hypothetisch verschieben und die Risikoänderung anzeigen.

## Technische Hinweise

- Bei neuen Feldern immer das Datenmodell, `validateState`, Import-Validierung und möglichst eine Migration erweitern. Beim Ändern der Version niemals bestehende lokale Nutzerdateien ohne Backup überschreiben.
- Den Rechenkern rein funktional halten; er ist unabhängig von Design und Browser und kann später auch als Worker oder Serverfunktion laufen.
- Den **Serienanker** nicht aus einem später angeklickten Termintag direkt ersetzen: Index-/Ankersemantik bewahren (siehe `shiftedSeriesAnchor()`).
- Bestehende `posted`-Vorkommen niemals beim Regelwechsel wieder in `forecast` einführen.
- Ein separater tatsächlicher Kontoauszug wäre nötig, bevor vergangene Tage korrekt rekonstruiert werden können. Nicht stillschweigend aus geplanten Buchungen „historische Realität“ machen.
- Wenn sehr viele tägliche Regeln oder Jahrzehnte simuliert werden, `materializeEvents()` in der Vorschau effizienter auf Start-/Endindex einschränken und im Diagramm Min/Max-erhaltendes Sampling beibehalten.
- Das Standalone-Buildskript ist absichtlich klein und abhängigkeitsfrei. Wenn die Anzahl der Module stark wächst, lieber ein standardisiertes Offline-Bundling (mit geprüfter Wiederherstellbarkeit ohne Netz) einführen, statt die Regex-Transformation unbegrenzt zu erweitern.
- UI-Prinzip nicht aufgeben: Übersicht, Kalender, Buchungen bleiben prominent. Erweiterte Regeln in Details, Modals oder Einstellungen verstecken. Mobile-Ansicht immer mitprüfen.

## Release-Checkliste

Änderung erklären → Fachlogik separat testen → kritische Szenarien aus `TESTS_UND_GRENZFÄLLE.md` testen → `npm run build` → Standalone öffnen → responsive UI prüfen → JSON-Export/Import-Roundtrip → Versionsnummer und Dokumentation aktualisieren.
