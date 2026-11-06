# Deploy-Notizen – GitHub Pages, modulare Variante

## Aktive Dateien

- GitHub Pages liest `/index.html` im Stammverzeichnis.
- Die Root-HTML lädt `/src/styles.css` und `/src/main.js` über **relative** URLs.
- `src/main.js` ist ein Standard-ES-Modul (`type="module"`) und importiert `ui-actions.js`; alle weiteren Module werden durch deren Imports aufgelöst.
- `.nojekyll` sorgt dafür, dass Dateien ohne Jekyll-Verarbeitung ausgeliefert werden.
- `dist/` wird von Pages nicht gebraucht und ist per `.gitignore` aus dem Git-Repository ausgeschlossen.

## Änderung testen und veröffentlichen

1. `npm test` ausführen.
2. Lokal mit `python3 -m http.server 8000` unter HTTP testen.
3. Nur die geänderten Quelldateien und ggf. die Dokumentation committen und nach `main` pushen.
4. Pages veröffentlicht die neue Version entsprechend der Repository-Einstellungen.

**Achtung:** GitHub Pages ist statisches Hosting; es führt kein Node.js und keine Buildskripte aus. Deshalb sind sämtliche imports bereits direkt browserkompatibel und können ohne Build veröffentlicht werden.

**Speicherort:** `localStorage` ist an Browserprofil und Webseiten-Origin gebunden, nicht an das Git-Repository. Ein Host- oder Domainwechsel erzeugt gegebenenfalls einen neuen Speicherbereich. JSON-Backup vorher exportieren.

## Weitere geplante Funktionen

Eine echte installierbare Offline-PWA erfordert mindestens Manifest, Icons und Service Worker einschließlich verlässlicher Cache-/Update-Strategie. Diese Komponenten sind hier **noch nicht implementiert**; keine ungetesteten Offlineversprechen abgeben.
