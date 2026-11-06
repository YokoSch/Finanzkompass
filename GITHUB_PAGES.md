# GitHub Pages – Finanzkompass 1.0.1

## 1. Dateien veröffentlichen

Das Repository muss im Branch `main` in der obersten Ebene mindestens Folgendes enthalten:

```text
index.html
src/
  main.js
  ui-actions.js
  ui-render.js
  ... weitere .js-Dateien ...
  styles.css
```

**Nicht** das ZIP hochladen und **nicht** den gesamten Ordner als zusätzlichen Unterordner in das Repository legen. `index.html` muss direkt im Repository-Stamm liegen. Die Datei `src/index.html` aus älteren Fassungen gibt es absichtlich nicht mehr.

In GitHub unter **Settings → Pages**: `Deploy from a branch`, Branch `main`, Folder `/ (root)`, speichern.

Aufruf: `https://BENUTZERNAME.github.io/REPOSITORYNAME/`.

Der Projektname und die Groß-/Kleinschreibung des Pfads müssen übereinstimmen.

## 2. Doppelklick auf index.html

ZIP **vollständig entpacken** und im entpackten Projektordner `index.html` öffnen. Auch lokal müssen alle Unterordner vorhanden sein. Diese Version benutzt **keine nativen ES-Module**: Klassische `<script defer>`-Referenzen funktionieren normalerweise auch bei `file://`. Das kann dennoch von speziellen Browser- oder Sicherheitseinstellungen blockiert werden. In diesem Fall die veröffentlichte Seite oder einen lokalen HTTP-Server nutzen.

Die 12 Dateien werden in der in `index.html` angegebenen **Abhängigkeitsreihenfolge** geladen. Keine `async`-Attribute hinzufügen.

## 3. Wenn die Seite leer bleibt

1. Kontrollieren: Liegen `index.html` und `src/` direkt nebeneinander?
2. Nach Entpacken die **wirkliche** Datei öffnen, nicht die Vorschau im ZIP-Programm.
3. Auf GitHub prüfen: `src/main.js` und `src/styles.css` sind unter dem Repository vorhanden.
4. In GitHub Pages `/ (root)` als Quelle wählen.
5. Im Browser Hard-Reload durchführen, auf iPhone Safari Seite erneut öffnen.
6. Bei lokaler Dateisperre die GitHub-Pages-Adresse oder `python3 -m http.server 8000` im Projektordner verwenden.
7. In Entwicklerwerkzeugen **Console** prüfen. Fehler wie `Failed to load resource` weisen auf fehlende oder falsch verlinkte Dateien hin.

## 4. Daten bleiben privat – aber nur auf dem jeweiligen Gerät

Github Pages liefert nur Programmcode aus. Die App sendet Finanzdaten nicht an GitHub; sie speichert sie im Browser des Besuchers. Lokale HTML-Datei, Chrome, Safari und GitHub Pages können unterschiedliche Speicherbereiche haben. Zum Umzug vorab **JSON-Backup exportieren**, danach importieren. **Backup-Dateien nicht ins öffentliche Repository hochladen.**

## 5. Aktualisieren

Quellcode ändern, `npm test` laufen lassen und geänderte Dateien zu GitHub committen. GitHub Pages muss **keinen** Build ausführen. `npm run build` ist nur für das zusätzliche `dist/Finanzkompass.html` gedacht, nicht für die Web-Veröffentlichung.

Diese Fassung ist **noch keine Offline-PWA** (kein Service Worker). „Zum Home-Bildschirm“ macht sie bequemer nutzbar, garantiert aber keinen Offlineaufruf der gehosteten Website.
