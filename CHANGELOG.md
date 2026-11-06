# Änderungsverlauf

## 1.0.1 — 06.11.2026 · Startproblem behoben

- **Fix:** `/index.html` startet nicht mehr nur über HTTP(S), sondern normalerweise auch direkt als `file://`-Datei nach vollständigem Entpacken.
- Die einzelnen JavaScript-Dateien bleiben modular mit eigenen Scopes und klaren APIs (`globalThis.FinanzkompassModules`). Klassische geordnete Skripte ersetzen Browser-ESM-Imports.
- GitHub Pages lädt **dieselben einzelnen Quelldateien** unverändert und benötigt keinen Build-Schritt.
- Doppelte `src/index.html` entfernt; nur die Root-`index.html` bleibt.
- Optionaler Ein-Datei-Build erzeugt weiterhin `dist/Finanzkompass.html` aus den verlinkten Skripten und CSS.
- Entwicklerdokumentation, Testanweisungen und GitHub-Pages-Anleitung aktualisiert.
- **Keine Änderung am JSON-Schema** (`version: 1`), an den Finanzregeln oder am Speicher-Key (`finanzkompass.v1`).
- 20 Rechenregressionstests bestanden; Desktop-/Mobile-Smoke-Tests mit den eingebetteten Originalskripten bestanden. Direkte `file://`-/`localhost`-Navigation konnte in der isolierten Testumgebung nicht durchgeführt werden (administrativ gesperrt).

## 1.0.0 — 05.11.2026 · Erste Version

- Minimalistische, responsive UI mit sicher ausgebbarem Betrag, Diagramm und Buchungskalender.
- Tagesgenaue Simulation, einmalige und wiederkehrende Einnahmen/Ausgaben.
- Einzelne Serientermine verschieben, ausfallen lassen oder Serie ändern.
- Gebuchte Zahlungen, Sicherheitsreserve, Was-wäre-wenn-Rechner, JSON-Backup, Hell-/Dunkelmodus.
- Initiale ESM-basierte modulare Version; Doppelklick-Startproblem in 1.0.1 behoben.
