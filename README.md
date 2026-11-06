# Finanzkompass 1.0.0 – modular für GitHub Pages

**Modulare, clientseitige Web-App zur Planung des verfügbaren Kontostands.**
Diese Repository-Variante ist für **GitHub Pages** vorbereitet und benötigt **keinen Build-Schritt**. Die Anwendung verarbeitet Daten lokal im Browser; GitHub Pages liefert lediglich die öffentlichen Programmdateien aus.

## Veröffentlichung auf GitHub Pages

1. In GitHub ein **öffentliches Repository** erstellen, z. B. `Finanzkompass`.
2. **Den entpackten Inhalt dieses Projektordners** in das Repository hochladen – insbesondere `index.html` **und** den Ordner `src/`. **Nicht nur** die ZIP-Datei hochladen.
3. Unter **Settings → Pages → Build and deployment** die Quelle **Deploy from a branch** wählen.
4. Branch `main`, Ordner `/ (root)` auswählen und **Save** anklicken.
5. Die Seite ist anschließend unter `https://DEIN-NAME.github.io/Finanzkompass/` erreichbar (der genaue Pfad hängt vom Repository-Namen ab).
6. Auf dem iPhone den Link in Safari öffnen und über **Teilen → Zum Home-Bildschirm** ablegen.

**Entscheidend:** Die Startdatei im Repository-Stammverzeichnis heißt `index.html`; sie lädt `./src/styles.css` und `./src/main.js`. Letztere importiert die weiteren JavaScript-Module selbst. Die relativen Pfade funktionieren auch dann, wenn die App unter `/Finanzkompass/` statt direkt unter der Domain liegt.

## Struktur

```text
Finanzkompass/
├── index.html                 # GitHub-Pages-Einstieg; nur HTML-Grundgerüst
├── src/
│   ├── main.js                # Bootstrap; importiert FinanceUI
│   ├── ui-actions.js          # Interaktion, Formulare, Dialoge
│   ├── ui-render.js           # UI-Templates
│   ├── styles.css             # Responsive CSS
│   ├── forecast.js            # Liquiditätsprognose, Tagesminima
│   ├── recurrence.js          # Wiederholung, Verschiebungen, Ausnahmen
│   ├── operations.js          # Buchungsänderungen, als gebucht markieren
│   ├── model.js               # Validierung und Datenmodell
│   ├── persistence.js         # localStorage, JSON-Import/Export
│   ├── date.js, money.js      # Datum und Geldbeträge
│   ├── chart.js, icons.js     # Darstellungsbausteine
│   └── index.html             # Optional: lokale Entwickler-Einstiegsdatei
├── tests/                     # Regressions- und Browser-Smoke-Tests
├── scripts/                   # Optionaler Standalone-Build
├── docs/                      # Technische Zusatzdokumentation
├── ARCHITEKTUR.md             # Algorithmen, Datenformat, Randfälle
├── ENTWICKLERNOTIZEN.md       # Hinweise für künftige Änderungen
└── CHANGELOG.md
```

## Lokale Entwicklung

Die Seite muss über **HTTP(S)** aufgerufen werden, da JavaScript-Module beim Doppelklick auf `index.html` (`file://`) je nach Browser blockiert werden.

```bash
# Im Projektordner
python3 -m http.server 8000
# Öffnen: http://localhost:8000/
```

Alternativ für die ältere Entwicklungs-Einstiegsdatei im Modulordner:

```bash
python3 -m http.server 8000 --directory src
# Öffnen: http://localhost:8000/
```

Für Tests wird Node.js 20+ benötigt:

```bash
npm test
```

Optional erzeugt `npm run build` eine **einzelne Offline-HTML-Datei** unter `dist/Finanzkompass.html`. Das ist **nur ein zusätzliches Exportformat**. GitHub Pages verwendet und benötigt es **nicht**. Änderungen an `src/` werden beim nächsten GitHub-Pages-Deploy automatisch als getrennte Dateien bereitgestellt.

## Datenschutz und Datenspeicherung

- **Keine Kontosynchronisierung:** Finanzdaten werden mit `localStorage` nur im Browser/auf dem jeweiligen Gerät gespeichert; GitHub speichert nicht automatisch die eingegebenen Finanzdaten.
- **Jedes Gerät hat eigene Daten:** iPhone und Computer teilen ihren Finanzstand nicht. Daten lassen sich über die App als JSON exportieren/importieren.
- **Beim Umstieg** von einer lokal geöffneten Standalone-HTML auf GitHub Pages: vorher **JSON-Backup exportieren** und auf der GitHub-Pages-Website **importieren**. Daten werden nicht automatisch übernommen.
- Browserdaten können gelöscht werden; regelmäßige Backups sind sinnvoll. **JSON-Dateien enthalten vertrauliche Finanzdaten. Nicht in ein öffentliches GitHub-Repository einchecken!**
- **Offline:** Diese Variante benötigt für den Seitenaufruf eine Verbindung zur Website. Sie enthält **noch keinen Service Worker und keinen vollständigen PWA-Offlinemodus**. „Zum Home-Bildschirm“ macht daraus noch keine garantiert offlinefähige App.
- Auch wenn das Repository öffentlich ist, gibt es keinen automatischen Upload deiner Eingaben an GitHub. Der App-Code ist öffentlich lesbar.

## Architekturprinzipien

1. Jede fachliche Änderung gehört in `src/operations.js` bzw. die zugehörigen Domain-Module, nicht direkt in HTML-Strings.
2. Tagesgenaue Liquiditätsberechnung findet in `src/forecast.js` statt. An einem Tag werden Ausgaben **vor** Einnahmen berücksichtigt.
3. Ursprüngliche Serientermine werden von einem unveränderten Anker abgeleitet; Änderungen einzelner Vorkommen sind separate Ausnahmen.
4. `src/persistence.js` kümmert sich um Speichern und JSON-Backups; niemals Buchungen zweimal in den aktuellen Kontostand einrechnen.
5. Vor Änderungen `npm test` ausführen; kritische Randfälle und Datenformat in `ARCHITEKTUR.md` dokumentieren.

Weitere technische Details: [ARCHITEKTUR.md](ARCHITEKTUR.md), [ENTWICKLERNOTIZEN.md](ENTWICKLERNOTIZEN.md) und [docs/](docs/).

## Änderungsvermerk

Die GitHub-Pages-Verpackung ändert **nur die Auslieferungsform**, nicht die Finanzlogik von 1.0.0. Die JavaScript-Module sind identisch zur bisherigen Entwicklungsfassung.
