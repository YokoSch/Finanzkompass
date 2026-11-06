# Architektur / Datenmodell – Finanzkompass 1.0.0

Dieses Dokument ist die **technische Referenz für zukünftige Entwicklungsarbeiten**. Vor Änderungen an Serien- oder Kontostandslogik bitte lesen.

## 1. Architekturprinzipien

**Vier Ebenen** – keine Abhängigkeit nach oben:

1. **Domänen-Utilities:** `date.js`, `money.js`, `model.js`
2. **Fachlogik:** `recurrence.js`, `forecast.js`, `operations.js` — deterministisch, ohne HTML/Browserzugriff (Ausnahmen: ID- und `createdAt`-Erzeugung)
3. **I/O:** `persistence.js` — lokale Speicherung, JSON-Sicherung, Datenvalidierung
4. **Benutzeroberfläche:** `icons.js`, `chart.js`, `ui-render.js`, `ui-actions.js`, `main.js`

`ui-render.js` soll niemals direkt Fachzustand ändern; `ui-actions.js` ist die einzige UI-Ereignis-Zentrale. Fachmutationen laufen über `operations.js` oder einen klaren Einstellungen-Patch; danach immer `validateState` → `forecast` → `saveState` → `render`. Bei einem Fehler keine teilweise gespeicherte Änderung.

**Alle Beträge werden als ganze Cent (Integer) gespeichert.** Alle fachlichen Zeitpunkte sind **ISO-Kalendertage `YYYY-MM-DD`**, ohne Uhrzeit/Zeitzone. Die Berechnung eines Tages darf deshalb niemals von Sommer-/Winterzeit abhängen.

## 2. Persistiertes Schema

```json
{
  "version": 1,
  "settings": {
    "currentBalanceCents": 175000,
    "balanceDate": "2026-11-05",
    "viewStart": "2026-11-05",
    "viewEnd": "2027-11-05",
    "reserveCents": 10000,
    "theme": "system"
  },
  "rules": [
    {
      "id": "id-a",
      "title": "Gehalt",
      "amountCents": 210000,
      "anchor": "2026-11-15",
      "frequency": "monthly",
      "interval": 1,
      "until": null,
      "weekdayPolicy": "none",
      "note": "",
      "createdAt": "2026-11-05T18:00:00.000Z"
    }
  ],
  "exceptions": [
    {
      "id": "id-b",
      "ruleId": "id-a",
      "occurrenceIndex": 1,
      "action": "override",
      "date": "2026-12-12",
      "amountCents": 210000,
      "title": "Gehalt",
      "note": "Früher wegen Feiertag"
    }
  ],
  "posted": [
    {
      "id": "id-c",
      "ruleId": "id-a",
      "occurrenceIndex": 0,
      "date": "2026-11-15",
      "title": "Gehalt",
      "amountCents": 210000,
      "balanceAdjustmentCents": 0,
      "createdAt": "2026-11-15T18:00:00.000Z"
    }
  ],
  "updatedAt": "2026-11-15T18:00:00.000Z"
}
```

### Felder und Invarianten

| Feld | Bedeutung / technische Anforderung |
| --- | --- |
| `version` | Datenformatversion, aktuell `1`; bei inkompatiblen Änderungen Migration schreiben |
| `currentBalanceCents` | **Absolute Ist-Momentaufnahme** des Kontos am `balanceDate`; nicht alle Historienbuchungen erneut abziehen |
| `viewStart`, `viewEnd` | Sichtfenster für Chart; **Risiko-Minimum startet immer bei `balanceDate`** |
| `reserveCents` | Untergrenze, mindestens 0 |
| `rules[].amountCents` | Vorzeichen: positiv Einnahme, negativ Ausgabe; 0 ungültig |
| `rules[].anchor` | **Erster nominaler Termin** der Regel; monatliche Folgen immer relativ dazu erzeugen |
| `rules[].frequency` | `none`, `daily`, `weekly`, `monthly`, `yearly` |
| `rules[].interval` | Integer ≥ 1; im UI derzeit immer 1; Rechenkern bereits für Intervalle vorbereitet |
| `rules[].until` | Letzter **nominal zulässiger** Tag (inklusive) oder `null` |
| `rules[].weekdayPolicy` | `none`, `previous`, `next`; nur Samstag/Sonntag, keine Feiertage |
| `exceptions[].occurrenceIndex` | **Nullbasierter Index des Nominaltermins**; stabil bei Datumsverschiebungen |
| `exceptions[].action` | `override` mit Datum/Betrag/Titel oder `skip` für ausgefallenen Termin |
| `posted[]` | Historischer Snapshot tatsächlich als gebucht markierter Zahlungen; **niemals automatisch aus noch offenen Regeln erneut verbuchen** |
| `posted[].balanceAdjustmentCents` | Automatisch auf aktuellen Saldo gebuchter Umsatz (0, falls bereits enthalten); wird nach manueller Saldoaktualisierung zu 0 |

**Eindeutigkeit:** Je Regel und `occurrenceIndex` maximal ein Exception-Datensatz und ein Posted-Datensatz. IDs dürfen nicht recycelt werden. Bereits gebuchte Snapshots werden auch dann behalten, wenn die zugehörige Regel gelöscht oder in zwei Serien gesplittet wird.

### Warum Ausnahmen nach Index statt nach Datum?

Würde man eine Verschiebung nach dem ursprünglichen Buchungsdatum referenzieren, könnte eine Änderung des Serientages eine Ausnahme unauffindbar machen. Der Index `1` bedeutet „zweites Vorkommen dieser Serie“, unabhängig davon, ob das ursprünglich der 15. Dezember oder künftig der 12. Dezember ist.

Bei „diese und alle folgenden“ wird die alte Serie **nach** dem vorhergehenden Nominaltermin beendet und eine neue Regel mit neuem Anker angelegt. Ausnahmeindizes ab diesem Punkt werden auf die neue Serie umgerechnet (`newIndex = oldIndex - splitIndex`). Gebuchte Snapshots bleiben unverändert mit ihrem ursprünglichen Schlüssel.

## 3. Erzeugung von Buchungen (`recurrence.js`)

```text
Rule(anchor, frequency, interval, until)
  ↓ nominalDate(rule, occurrenceIndex)
Nominaltermin (z. B. 2027-02-28 bei Anker 2027-01-31)
  ↓ weekdayPolicy (optional)
Regelmäßiger geplanter Tag
  ↓ exception by (ruleId, index)
Geänderter Tag/Betrag/Titel ODER skip
  ↓ posted by (ruleId, index)
Bereits gebucht? → nicht mehr in offene Prognose
  ↓
Materialisierte offene Ereignisse [{date,amountCents,…}]
```

**Unbedingt beibehalten:** `nominalDate` MUSS für den Index `n` direkt aus dem Ursprungsanker rechnen und darf nicht iterativ den letzten Termin weiterrechnen. Sonst wird der 31. Januar → 28. Februar → fälschlich 28. März statt 31. März.

Date/Time: `date.js` benutzt UTC-basierte Kalenderoperationen und isoliert die lokale Datumsermittlung in `todayISO()`. Damit wird die DST-Umstellung nicht als 23-/25-Stunden-Simulation missverstanden.

Bei `materializeEvents(s, from, to, {includePosted:true})` werden historische gebuchte Snapshots zusätzlich als eigene sichtbare Einträge ergänzt; der Forecast ruft ohne `includePosted` auf.

## 4. Liquiditätsalgorithmus (`forecast.js`)

Für den Stichtag `T0 = settings.balanceDate` und das gewählte Ende `T`:

```text
K = currentBalanceCents
K_min = K
für jeden Kalendertag d von T0 bis T (inkl.):
    Belastungen = Summe min(0, offene Beträge am Tag d)
    Gutschriften = Summe max(0, offene Beträge am Tag d)
    Tagestief = K + Belastungen
    K_min = min(K_min, Tagestief)
    K = Tagestief + Gutschriften
safeSpendCents = max(0, K_min - reserveCents)
shortfallCents = max(0, reserveCents - K_min)
```

Der Kontostandsgraph zeichnet `closingCents` (Tagesschluss), der Risikorechner verwendet **`lowCents`** (konservatives Zwischentief). Das Minimum der Anfangsmomentaufnahme wird ebenfalls geprüft – eine noch nicht erfolgte heutige Gutschrift darf die Ausgabegrenze heute nicht künstlich erhöhen.

**Besonderheit des Chart-Zooms:** `viewStart` darf später als `balanceDate` liegen. `forecast` simuliert trotzdem vom Stichtag, damit ein Engpass vor der eingezoomten Anzeige berücksichtigt wird. Der UI-Chart filtert anschließend nur die anzuzeigenden Tage.

**Sicherheitsreserve:** Kein eigener Bankbetrag, sondern eine vom Nutzer gewünschte Untergrenze. Bei `shortfallCents > 0` darf die App nicht „negativ ausgebbar“ behaupten, sondern zeigt einen Fehlbetrag.

## 5. Tatsächliche Buchungen (`operations.js`)

`postOccurrence(s, event, mode, actualCents, actualDate)` erstellt einen gebuchten Snapshot. Zwei Modi:

- `adjust`: `settings.currentBalanceCents += actualCents` und `posted.balanceAdjustmentCents = actualCents`. Der ursprünglich geplante Termin fällt aus der zukünftigen Prognose heraus.
- `included`: Der aktuelle Saldo war bereits in der Bank-App aktualisiert. Deshalb `balanceAdjustmentCents = 0` und **keine Änderung** des Saldos.

`undoPosted` entfernt den Snapshot und nimmt dessen gespeicherte Saldoänderung zurück (sofern nicht inzwischen ein absoluter Kontostand gesetzt wurde). `cleanAfterManualBalanceUpdate` setzt nach einer absoluten Saldoeingabe alle älteren `balanceAdjustmentCents` auf 0, damit ein späteres Undo nicht einen inzwischen veralteten Buchungseffekt zurückrechnet.

**Nicht vermischen:** Eine Buchung „geplant“ kann eine beliebige zukünftige oder vergangene Fälligkeit haben. `posted` steht für eine bereits tatsächlich stattgefundene Banktransaktion und darf keine Zukunftsdaten tragen (UI prüft das). Den als gebucht erfassten Betrag kann der Nutzer korrigieren, er darf also vom geplanten Betrag abweichen.

## 6. Speicherung / Sicherheitsgrenzen

- Standard: Browser-`localStorage` mit Schlüssel `finanzkompass.v1`.
- Die aktive Datenbank wird bei jeder erfolgreichen Änderung vollständig geschrieben.
- Bei gesperrtem Speicher: **explizit sichtbarer Warnmodus** mit temporärem Tab-Zustand und JSON-Exportpflicht.
- Bei beschädigtem JSON im Browser: wenn möglich rohe Originaldaten unter `finanzkompass.v1.recovery.<timestamp>` ablegen, statt sie kommentarlos zu überschreiben.
- JSON-Import mit Datums-/Typ-/Regel-/Eindeutigkeitsprüfung, maximal 8 MB.
- Alle nutzerdefinierten Texte werden beim Rendern in `ui-render.js` per `esc()` HTML-escaped.
- Kein Netzverkehr, keine Fonts, keine JS-Bibliotheken von CDNs.

## 7. Build / Module

Die Entwicklungsfassung verwendet standardkonforme ES-Module. Die fertige HTML-Datei wird absichtlich ohne Dependency-Installation erstellt. `scripts/build.mjs` führt Module in **fest vorgegebener Reihenfolge** zusammen, entfernt statische `import`- und `export`-Keywords und schließt alles in einer IIFE ein.

**Änderung einer neuen Datei oder eines Imports:** Modul in `order` des Buildskripts an der fachlich richtigen Stelle ergänzen. Keine `export default`-/dynamischen Imports und keine doppelten globalen `const`-Namen einführen. Danach `npm run build`, `npm test` und optional den Browser-Smoke-Test ausführen.

**Bessere Skalierbarkeit später:** Ein richtiger Bundler (esbuild/Rollup) kann den einfach gehaltenen Build ersetzen, solange die generierte Datei weiterhin ein einzelnes offlinefähiges HTML-Dokument bleibt.

## 8. UI-Zustand

`FinanceUI` (`ui-actions.js`) hält UI-Flags (Ansicht, ausgewählten Kalendertag, Modal, Toast, Suche, Filter) unabhängig vom persistierten Finanzzustand. Das HTML wird aus dem Model durch `renderApp` generiert. `eventMap` verbindet gerenderte Ereignisschlüssel mit den zugehörigen fachlichen Eventobjekten.

Beim Eintippen der Suche wird **nur die Liste** neu gerendert, damit Cursor und Fokus nicht verloren gehen. Bei Modals werden Formularwerte über `FormData` eingelesen. Für größere künftige Veränderungen kann dies schrittweise durch komponentenbasiertes State-Management ersetzt werden, ohne den Rechenkern anzufassen.

## 9. Tests / Regressionen

Automatische Kernfälle in `tests/engine.test.mjs`:

- Tagesuntergrenze und gleichzeitige Einnahmen/Ausgaben
- Reserve, Fehlbetrag
- 31. des Monats / Februarlänge / Schaltjahr
- Wochenendverschiebung über Monatsgrenzen
- Einzeltermine verschieben ohne Doppelbuchung
- Serien ab einem Termin trennen
- gesamte Serie umstellen ohne Verschiebung des Ankerindex
- gebuchte Snapshots / kein doppelter Kontenabzug / manuell aktualisierter Saldo
- ausgelassene Termine wiederherstellen
- Cent-Parsing / JSON-Datenvalidierung / DST-Grenzen

`tests/browser-smoke.py` prüft optional einen echten DOM-Flow in Desktop- und Mobilbreite: Kontostand, Einnahmen und Ausgaben, Monatskalender, Verschiebungen, tatsächliche Buchung, Suche, Reserve, Zeitraum, Theme und Schnellformular.

## 10. Weiterführende Entscheidungen für spätere Versionen

- Soll es eine **klassische Buchungshistorie** mit Monatsauswertungen geben? Bisher ist die Historie über Kalendertage sichtbar, kein eigener Haupttab.
- Soll das sichere Budget geplante **variable Ausgaben** als gesonderte Kategorie und statistische Reserve berücksichtigen? Bisher nur explizit eingetragene Ereignisse.
- Soll eine Serie zusätzliche Modi wie „letzter Bankarbeitstag“ oder Berliner Feiertage enthalten? Dafür müssen Feiertagsregeln zuverlässig gepflegt werden. Die derzeitige Mo–Fr-Regel ist absichtlich einfacher.
- Soll eine echte Kontoanbindung importierte Umsätze den Regeln zuordnen? Fachlich neue Schicht für Matching/Deduplikation nötig, nicht direkt in `forecast.js` integrieren.
- Soll es Multi-Account-/Sparkonto-Unterstützung geben? Das heutige Datenmodell hat genau einen aktuellen Saldo.
