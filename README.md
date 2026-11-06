# Finanzkompass 1.0.1 – modular, direkt startbar, GitHub Pages

Finanzkompass ist eine vollständig clientseitige App zur Prognose des kleinsten zukünftigen Kontostands und des *heute sicher ausgebbaren Betrags*. Standardmäßig wird ab dem aktuellen Kontostand ein Jahr simuliert; der Horizont ist frei wählbar.

**Diese Fassung ist eine Korrektur des Startproblems aus 1.0.0.** Die modulare Version ließ sich bislang in manchen Browsern nicht per Doppelklick öffnen, weil sie native ES-Module (`type="module"` / `import`) verwendete. Jetzt werden die fachlich getrennten Dateien als gekapselte klassische Skripte geladen. **Es ist kein Webserver, kein `npm install` und kein Build notwendig.**

## A. Direkt auf dem Computer öffnen (Windows, macOS, Linux)

1. **ZIP vollständig entpacken**. Nicht die HTML-Datei aus der ZIP-Vorschau heraus öffnen.
2. Im entpackten Projektordner auf die **`index.html` direkt neben `src/`** doppelklicken.
3. Die Ansicht „Übersicht“ sollte erscheinen; neue Buchungen funktionieren sofort.

**Wichtig:** `index.html` und der vollständige Ordner `src/` müssen **nebeneinander** liegen. Wenn du nur die HTML-Datei verschiebst oder hochlädst, fehlen die Programmdateien. Es gibt bewusst nur **eine** `index.html` im Projektstamm, damit keine falsche Datei geöffnet wird.

Einige Browser/Sicherheitskonfigurationen schränken `file://` selbst oder die Speicherung dort ein. Nutze in diesem Fall den **GitHub-Pages-Link** (empfohlen auch für das iPhone) oder einen lokalen Server, beispielsweise `python3 -m http.server 8000` und `http://localhost:8000/`. In der App wird bei blockierter Speicherung ein Hinweis angezeigt. **Vor dem Schließen immer Daten exportieren**, falls Speicherung gesperrt ist.

## B. Auf GitHub Pages veröffentlichen

1. GitHub-Repository erstellen, beispielsweise `Finanzkompass`, Sichtbarkeit **Public**.
2. Im Repository **alle entpackten Projektdateien und Verzeichnisse** hochladen, insbesondere die **`index.html` direkt auf oberster Ebene** und den gesamten `src/`-Ordner. Die ZIP selbst nicht hochladen.
3. Die eigene `README.md` und `.gitignore` sind enthalten; beim Erstellen des Repositories also **keine zusätzlichen README- oder .gitignore-Vorlagen** auswählen.
4. **Settings → Pages → Build and deployment → Deploy from a branch** wählen.
5. Branch `main` und Ordner `/(root)` einstellen, speichern und anschließend die veröffentlichte Adresse öffnen, z. B. `https://DEIN-NAME.github.io/Finanzkompass/`.
6. Auf dem iPhone in Safari **Teilen → Zum Home-Bildschirm**.

Keine weiteren GitHub-Actions, Node.js-Installation, Buildartefakte oder externen Abhängigkeiten nötig. Bei einer Änderung einer `.js`/`.css`-Datei diese Datei committen; GitHub Pages veröffentlicht sie im nächsten Deployment. Weitere Informationen: [GITHUB_PAGES.md](GITHUB_PAGES.md).

## Ordnerstruktur

```text
Finanzkompass/
├── index.html                  # EINZIGER Einstieg: Doppelklick und GitHub Pages
├── src/
│   ├── date.js, money.js       # Datum und Geld (Cent)
│   ├── model.js                # Validierung und Datenmodell
│   ├── recurrence.js           # Wiederholungsregeln und Einzeltermine
│   ├── forecast.js             # Kontostandsprognose
│   ├── operations.js           # Buchungen ändern und als gebucht markieren
│   ├── persistence.js          # localStorage und JSON-Import/-Export
│   ├── icons.js, chart.js      # Darstellungshilfen
│   ├── ui-render.js            # HTML-Erzeugung
│   ├── ui-actions.js           # Eingabe, Dialoge, Navigation
│   ├── main.js                 # Startpunkt
│   └── styles.css              # Desktop-/Mobile-Design
├── tests/                      # Automatisierte Regressionstests
├── scripts/build.mjs           # Optionaler Ein-Datei-Export
├── docs/                       # Entwicklerdokumentation
├── ARCHITEKTUR.md              # Datenmodell und Berechnungsannahmen
├── ENTWICKLERNOTIZEN.md        # Handlungsanleitung für spätere Änderungen
├── GITHUB_PAGES.md             # Veröffentlichung und Problemlösung
├── CHANGELOG.md
├── .gitignore
└── .nojekyll
```

## Wie die Modularität funktioniert

Jede Datei enthält ihren Code in einer **eigenen Funktion / eigenem Scope** und veröffentlicht nur notwendige Funktionen in `globalThis.FinanzkompassModules.<modulname>`. Beispielsweise wird `forecast()` unter `FinanzkompassModules.forecast.forecast` bereitgestellt. Andere Module übernehmen genau die APIs, die sie benötigen. Damit gibt es weder `import`-CORS-Probleme beim Doppelklick noch ungewollte globale Variablen aus den Funktionsdateien.

**Wichtiger Unterschied zu nativen ES-Modulen:** Die **Reihenfolge der `<script defer>`-Einträge in `index.html` ist relevant**. Ein neues Modul muss dort an der passenden Stelle eingetragen werden. Nicht mit `async` versehen. Näheres in [ARCHITEKTUR.md](ARCHITEKTUR.md).

## Tests und optionaler Build

Für den normalen Betrieb wird **kein** Node.js benötigt. Entwickler können mit Node.js 20+ Tests ausführen:

```sh
npm test
```

Die Browser-Smoke-Tests benötigen Python und Playwright/Chromium:

```sh
npm run build
python tests/browser-smoke.py
```

Der **optionale** Build erzeugt `dist/Finanzkompass.html`, eine vollständige Einzeldatei. Sie ist ein Zusatzformat, nicht die GitHub-Pages-Version und nicht die Quelle für Änderungen. Das veröffentlichte Projekt verwendet immer `index.html` + `src/`.

## Daten, Backup und Datenschutz

- Daten werden als `localStorage` **nur im jeweiligen Browser** gespeichert. Es gibt keinen Server und keinen Kontoabgleich.
- `file://` und `https://...github.io/...` haben **getrennte Speicherbereiche**. Bestehende Daten gehen bei Wechsel **nicht automatisch mit**. Vorher JSON-Backup exportieren und am neuen Ort importieren.
- Auch Safari auf dem iPhone und der Desktop-Browser sind getrennte Speicherbereiche. JSON-Import/-Export ermöglicht den manuellen Transfer.
- `localStorage` ist keine garantierte dauerhafte Datensicherung; insbesondere private Modi, bereinigte Browserdaten oder Browserbeschränkungen können Daten löschen. Regelmäßig als JSON exportieren.
- **Niemals Finanz-Backups oder persönliche Daten in ein öffentliches GitHub-Repository hochladen.** Eine `.gitignore` ist kein Schutz für manuelle Uploads.
- Auf GitHub Pages kann die App online aufgerufen werden; ein vollständiger Service-Worker-/PWA-Offlinemodus ist noch nicht implementiert. Die lokal entpackte Variante benötigt keinen Internetzugang.

## Funktionsumfang

Tagesgenaue Simulation, sichere verfügbare Summe, Sicherheitsreserve, Kalender, Einmal- und Serienbuchungen, Verschiebungen, Ausnahmen, „als gebucht“ markieren, Was-wäre-wenn-Test, Suche, JSON-Backup, Hell-/Dunkelmodus. Der Funktionsumfang und das **JSON-Datenformat Version 1** sind gegenüber 1.0.0 unverändert.
