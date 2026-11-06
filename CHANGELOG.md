# Changelog

## 1.0.0 — 05.11.2026

**Erste nutzbare Offline-Version** des Finanzkompasses.

- Minimalistische, responsive Startseite mit sicherem Ausgabelimit, Tiefpunkt, aktuellem Saldo, Diagramm und anstehenden Buchungen.
- Tagesgenaue Simulation ab dem Kontostand-Stichtag; Default ein Jahr, individuelle Intervalle.
- Einmalige und wiederkehrende Einnahmen/Ausgaben; tägliche, wöchentliche, monatliche und jährliche Rhythmen.
- Monatskalender, Tageslisten und Regelübersicht mit Suche und Filter.
- Einzeltermine ändern, ausfallen lassen, wiederherstellen; Serien ab Zeitpunkt teilen oder insgesamt bearbeiten.
- Optional Wochenendtermine auf Montag–Freitag verschieben (ohne Feiertage).
- Gebuchte Zahlungen, alternative Behandlung bereits im Kontostand enthaltener Umsätze.
- Was-wäre-wenn-Rechner, Sicherheitsreserve, Monatsdurchschnitt, Hell-/Dunkelmodus.
- Browser-Lokalspeicherung mit Warn-/Fallbackmodus sowie vollständiger JSON-Import/-Export.
- Modulare ES-Module, kommentierter Code, dependency-freier Einzeldatei-Build.
- 20 Engine-Regressionstests und optionaler Desktop-/Mobil-Browser-Smoke-Test.

## GitHub-Pages-Auslieferung (modular, unveränderter Funktionsstand 1.0.0)

- Neu: kleine `index.html` im Repository-Stamm; CSS/JavaScript werden einzeln über `src/` geladen.
- Neu: `README.md` und `GITHUB_PAGES.md` für Einrichtung, Datenschutz und Erweiterung.
- Unverändert: Berechnungslogik, Datenmodell und Speicherformat.
