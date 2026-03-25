# Trinkgeldkasse

Webanwendung zur Verwaltung einer Trinkgeldkasse mit lokalen Daten im Browser (LocalStorage), periodischer Verteilung und nachvollziehbarer Buchungshistorie.

## Zweck

Die Anwendung unterstützt bei:
- Erfassen von Einzahlungen in eine offene Auszahlungsperiode
- Live-Berechnung der Verteilung auf aktive Mitarbeiter
- Abschluss einer Periode mit korrekter Berücksichtigung des Zeitraums
- Übertrag in die nächste Periode
- Mitarbeiterverwaltung inkl. Austrittsszenario
- Backup-Export/-Import

## Technischer Stack

- Angular 21
- TypeScript
- Signals-basiertes State-Management
- LocalStorage als Persistenz
- Vitest für Unit-Tests

## Projektstart

### Voraussetzungen

- Node.js + npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

### Tests

```bash
npm run test -- --watch=false
```

### Build

```bash
npm run build
```

## Fachliches Modell

### Mitarbeiter

Ein Mitarbeiter hat:
- Name
- Wochenstunden
- automatisch berechneten Basisfaktor (`Wochenstunden / 40`)
- Status (`Aktiv` / `Inaktiv`)

Funktionen:
- Anlegen
- Bearbeiten (Name, Wochenstunden, Status)
- Löschen
- Austritt auszahlen (Teil-Auszahlung, danach `Inaktiv`)

### Auszahlungsperiode

Eine Periode hat u. a.:
- `startDate`
- optional `endDate` (bei offener Periode `null`)
- `payoutDate` (bei offener Periode `null`)
- `carryOverIncluded`, `tipPerWeek`, `controlSum`, `remainder`

Wichtig:
- Es gibt immer maximal eine offene Periode.
- Die initiale Periode wird nur mit Startdatum erstellt.
- Solange `endDate` leer ist, läuft eine Live-Vorschau mit heutigem Datum.

### Buchungen (Trinkgeldkasse)

Buchungen werden als Einträge gespeichert:
- positive Beträge: Einzahlung
- negative Beträge: Korrektur/Teil-Auszahlung

Protokolltyp in der UI:
- `Austrittsauszahlung`
- `Einzahlung storniert`
- `Korrekturbuchung` (Fallback)

## Zentrale Fachregeln

### 1) Nur Buchungen im Periodenzeitraum zählen zur Auszahlung

Für eine Auszahlung mit Zeitraum `startDate..endDate` werden nur Buchungen berücksichtigt, deren Buchungsdatum in diesem Fenster liegt.

Wenn das Enddatum rückwirkend gesetzt wird (weil „Auszahlen“ vergessen wurde), werden spätere Buchungen nicht in die abgeschlossene Auszahlung einbezogen.

### 2) Buchungen außerhalb des Abschluss-Zeitraums gehen in die nächste Periode

Beim Abschluss einer Periode werden Buchungen außerhalb des gewählten Enddatums als Übertrag in die nächste offene Periode übernommen.

### 3) Rundung der Mitarbeiterbeträge

Mitarbeiter-Auszahlungen werden immer auf den nächsten niedrigeren 5-Euro-Schritt abgerundet.

Beispiele:
- `252,02 -> 250`
- `241,94 -> 240`
- `189,02 -> 185`

Die Differenz bleibt als `Restbetrag` in der Periode sichtbar.

### 4) Krank-Regel in Periodendetails

`Krank` ist nur erlaubt als:
- `0`
- oder `>= 6`

Werte `1..5` werden abgewiesen.

### 5) Inaktive Mitarbeiter

Inaktive Mitarbeiter:
- erscheinen nicht in den Periodendetails
- werden bei Verteilungen nicht berücksichtigt

### 6) Auto-Save in Periodendetails

Änderungen in Periodendetails werden sofort gespeichert (kein separater „Speichern“-Button).

## Wichtige User-Flows

### Initiale Einrichtung

1. Mitarbeiter anlegen
2. Initiale Periode mit Startdatum erstellen

Die Sektion „Neue Auszahlungsperiode“ wird nur angezeigt, solange noch keine Periode existiert.

### Laufender Betrieb

1. Einzahlungen in der offenen Periode buchen
2. In Periodendetails Live-Werte prüfen/bei Bedarf Enddatum setzen
3. Periode auszahlen und nächste Periode erstellen

### Mitarbeiter-Austritt ohne Gesamtauszahlung

Über `Austritt auszahlen` in der Mitarbeiterzeile:
1. Anteil des Mitarbeiters aus offener Periode wird als negative Buchung erfasst
2. Topf wird entsprechend reduziert
3. Mitarbeiter wird auf `Inaktiv` gesetzt
4. Restliche Mitarbeiter laufen in derselben Periode weiter

## UI-Hinweise

- Trinkgeldkasse lässt sich per Klick auf den Header auf-/zuklappen.
- Der CTA `Einzahlen` klappt ebenfalls auf und setzt Fokus in das Betragsfeld.
- Inputs und Buttons sind auf konsistente Höhe ausgelegt.

## Datenhaltung / LocalStorage

Verwendete Keys:
- `trinkgeldkasse.v1.employees`
- `trinkgeldkasse.v1.periods`
- `trinkgeldkasse.v1.shares`
- `trinkgeldkasse.v1.deposits`
- `trinkgeldkasse.v1.settings`

## Backup

- Export: JSON-Datei mit allen relevanten Daten
- Import: Wiederherstellung aus JSON (Version/Struktur validiert)

## Architektur (kurz)

- `repositories/*`: Lesen/Schreiben auf LocalStorage
- `stores/*`: Fachlogik, Berechnungen, Konsistenz
- `app.ts` + `app.html`: UI-Interaktionen und Darstellung
- `core/utils/period-calculation.ts`: Kernberechnungen (Faktoren, Trends, Verteilung)

## Qualitätssicherung

- Unit-Tests decken zentrale Fachlogik ab:
  - Ein-/Ausbuchungen
  - Periodenabschluss
  - Zeitraumfilterung bei Auszahlung
  - Live-Vorschau
  - Ausschluss inaktiver Mitarbeiter
  - Rundungsregeln

