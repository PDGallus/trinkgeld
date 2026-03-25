# Lokale Persistenz mit LocalStorage – Implementierungsplan

## 1. Zielbild

- Die Anwendung läuft vollständig im Browser und speichert alle Daten (Mitarbeiter, Auszahlungsperioden, Shares) in LocalStorage. [file:1]
- Keine Benutzerverwaltung, keine Serverabhängigkeit, Daten sind pro Gerät/Browser getrennt.
- Export/Import (JSON-Datei) dient als Backup bzw. Gerätewechsel.

---

## 2. Datenmodell für LocalStorage

### 2.1 Schlüssel-Struktur

- `trinkgeldkasse.v1.employees`
- `trinkgeldkasse.v1.periods`
- `trinkgeldkasse.v1.shares`
- `trinkgeldkasse.v1.settings`

Optional: Namespacing über `v2` bei späteren Breaking Changes.

### 2.2 JSON-Strukturen

**Employees**

```ts
type EmployeeId = string;

interface Employee {
  id: EmployeeId;
  name: string;
  weeklyHours: number;        // z.B. 40, 38.5, 30, 20[1]
  baseFactor: number;         // z.B. 1, 0.9625, 0.75, 0.5[1]
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**PayoutPeriod**

```ts
type PeriodId = string;

interface PayoutPeriod {
  id: PeriodId;
  title: string;              // z.B. "Auszahlung ab Nov 25"[1]
  totalTip: number;           // Summe[1]
  carryOverIncluded: number;  // inkl. Übertrag[1]
  lastDate: string;           // ISO Datum, z.B. "2025-10-30"[1]
  payoutDate: string | null;  // Auszahlung [1]
  weeks: number;              // Wochen[1]
  tipPerWeek: number;         // Trinkgeld/Woche[1]
  trendPercent: number;       // Trend (z.B. 53.01)[1]
  trendIcon: 'up' | 'down' | 'steady'; // ⬈, ⬊, → [1]
  totalAdjustedFactor: number; // TotalAdjustedFactor[1]
  controlSum: number;         // Kontrollsumme[1]
  remainder: number;          // Restbetrag[1]
  previousPeriodId?: PeriodId;
  createdAt: string;
  updatedAt: string;
}
```

**PayoutShare**

```ts
interface PayoutShare {
  id: string;
  periodId: PeriodId;
  employeeId: EmployeeId;
  sickUnits: number;          // Spalte "krank"[1]
  adjustedFactor: number;     // PersonalAdjustedFactor[1]
  amount: number;             // Betrag je Mitarbeiter (z.B. 210.00)[1]
}
```

**Settings**

```ts
interface Settings {
  referenceWeeklyHours: number; // z.B. 40 für Faktor-Berechnung[1]
  currency: string;             // "EUR"
  locale: string;               // "de-DE"
}
```

---

## 3. LocalStorage-Services

### 3.1 Gemeinsame Infrastruktur

`LocalStorageService`

- Methoden:
  - `getItem<T>(key: string): T | null`
  - `setItem<T>(key: string, value: T): void`
  - `removeItem(key: string): void`
- Fehlerbehandlung:
  - try/catch um `JSON.parse` und `JSON.stringify`.
- Fallback bei `null`: Rückgabe leerer Arrays/Defaults im jeweiligen Service.

### 3.2 Fachservices auf LocalStorage-Basis

`EmployeesLocalStorageRepository`

- `getAll(): Employee[]`
- `saveAll(employees: Employee[]): void`
- `add(employee: Employee): Employee[]`
- `update(employee: Employee): Employee[]`
- `deactivate(id: EmployeeId): Employee[]`

`PeriodsLocalStorageRepository`

- `getAll(): PayoutPeriod[]`
- `getById(id: PeriodId): PayoutPeriod | undefined`
- `saveAll(periods: PayoutPeriod[]): void`
- `upsert(period: PayoutPeriod): PayoutPeriod[]`
- `delete(id: PeriodId): PayoutPeriod[]`

`SharesLocalStorageRepository`

- `getByPeriodId(periodId: PeriodId): PayoutShare[]`
- `saveForPeriod(periodId: PeriodId, shares: PayoutShare[]): void`

`SettingsLocalStorageRepository`

- `get(): Settings`
- `save(settings: Settings): void`

---

## 4. State-Management mit Signals

### 4.1 Stores

`EmployeesStore`

- State:
  - `employees = signal<Employee[]>([])`
- Actions:
  - `loadFromLocalStorage()`
  - `addEmployee(dto)`
  - `updateEmployee(id, dto)`
  - `deactivateEmployee(id)`
- Side Effects:
  - Nach jeder Änderung: Persistenz via `EmployeesLocalStorageRepository`.

`PeriodsStore`

- State:
  - `periods = signal<PayoutPeriod[]>([])`
- Actions:
  - `loadFromLocalStorage()`
  - `createPeriod(dto)` inkl. Initialberechnung.
  - `updatePeriod(id, dto)`
  - `deletePeriod(id)`
- Computed:
  - `sortedPeriods = computed(() => ...)`
  - `currentPeriod = computed(() => ...)` (letzte offene Periode).

`PeriodDetailStore` (pro Route-Instanz)

- Inputs:
  - `periodId: PeriodId`
- State:
  - `period = signal<PayoutPeriod | null>(null)`
  - `shares = signal<PayoutShare[]>([])`
  - `employees = signal<Employee[]>([])`
- Actions:
  - `load()` → aus LocalStorage.
  - `changeHeader(field, value)` → berechnet abhängige Felder neu (tipPerWeek etc.). [file:1]
  - `updateShare(employeeId, partial)` → sickUnits ändern, neu berechnen. [file:1]
  - `save()` → schreibt `period` & `shares` zurück in LocalStorage.

---

## 5. Lade- und Speicherstrategie

### 5.1 App-Initialisierung

- In `AppConfig`/`AppInitializer`:
  - `EmployeesStore.loadFromLocalStorage()`
  - `PeriodsStore.loadFromLocalStorage()`
- Falls keine Daten vorhanden:
  - Default-Mitarbeiter aus „Arbeitsstunden“-Tabelle erzeugen (Angi, Frank, Paola, Concetta, Vanessa, Kimi mit Stunden und Faktoren). [file:1]

### 5.2 Speichern

- Jede mutierende Aktion in den Stores ruft direkt den jeweiligen LocalStorage-Repository.
- Optionale Optimierung: Debounce beim Speichern von Period-Details, um bei vielen Eingaben nicht zu oft zu schreiben.

---

## 6. Import/Export (Backup)

### 6.1 Export-Funktion

`BackupService`

- `export()`:
  - Liest:
    - `employees`, `periods`, `shares`, `settings`
  - Erzeugt JSON:

```ts
interface Backup {
  version: '1';
  exportedAt: string;
  employees: Employee[];
  periods: PayoutPeriod[];
  shares: PayoutShare[];
  settings: Settings;
}
```

- Download als `.json` via Blob/URL-Create.

### 6.2 Import-Funktion

- Upload eines JSON-Files.
- Validierung (Version, Struktur).
- Schreiben der Daten in LocalStorage:
  - Überschreiben der Keys `trinkgeldkasse.v1.*`.
- UI-Warnung: „Bestehende Daten werden überschrieben“.

---

## 7. Migrationsstrategie (Versionierung)

- In `Settings` oder separatem Key: `trinkgeldkasse.version`.
- Beim Start:
  - Version prüfen.
  - Falls `null` → erste Initialisierung.
  - Falls alte Version → Migrationslogik (z.B. v1 → v2) anwenden sowie LocalStorage updaten.

---

## 8. Sicherheit & Robustheit

- LocalStorage-Größe:
  - Datenmenge gering (wenige Jahre Trinkgeldperioden, wenige Mitarbeiter). [file:1]
- Fehlerfälle:
  - LocalStorage voll → UI-Fehlermeldung mit Hinweis auf Backup und manuellen Clear.
  - JSON defekt (manuelle Bearbeitung) → Fallback auf leeren Zustand + Hinweis.
- Privatsphäre:
  - Keine sensiblen Daten, nur Namen und Geldbeträge; trotzdem Hinweis, dass alles lokal im Browser gespeichert wird.

---

## 9. Phasierung speziell für LocalStorage

1. **Phase 1: Basis-LocalStorage-Infrastruktur**
  - `LocalStorageService` + Repositories.
  - `Settings` mit Defaults (locale, currency, referenceWeeklyHours). [file:1]

2. **Phase 2: Mitarbeiter-Stores + UI**
  - `EmployeesStore` auf LocalStorage-Basis.
  - Seite „Mitarbeiter“, initiale Befüllung aus Arbeitsstunden-Excel. [file:1]

3. **Phase 3: Perioden-Stores + Übersicht**
  - `PeriodsStore` mit LocalStorage-Bindung.
  - Tabelle der Perioden (ohne Detail-Berechnungen). [file:1]

4. **Phase 4: Perioden-Detail + Berechnungen**
  - `PeriodDetailStore`, Berechnungslogik, Live-Update.
  - Persistenz von Perioden und Shares in LocalStorage. [file:1]

5. **Phase 5: Backup (Import/Export)**
  - `BackupService`, UI-Buttons „Daten exportieren“ / „Daten importieren“.

6. **Phase 6: Feinschliff**
  - Validation, Rundungs-Logik, Trend-Icons, Fehlerhandling. [file:1]

---

## 10. Beispielhafte LocalStorage-Belegung (Auszug)

| Key                              | Inhalt (Kurzform)                                 |
|----------------------------------|----------------------------------------------------|
| `trinkgeldkasse.v1.employees`    | `[{"id":"angi","name":"Angi","weeklyHours":40,...}]` [file:1] |
| `trinkgeldkasse.v1.periods`      | `[{"id":"2025-Q3","totalTip":1185,"weeks":16,...}]` [file:1] |
| `trinkgeldkasse.v1.shares`       | `[{"periodId":"2025-Q3","employeeId":"angi",...}]` [file:1] |
| `trinkgeldkasse.v1.settings`     | `{"referenceWeeklyHours":40,"currency":"EUR"}` [file:1] |

---

Wenn du möchtest, kann ich dir im nächsten Schritt konkrete Angular-Services (`EmployeesLocalStorageRepository`, `PeriodsStore` mit Signals) in TypeScript-Skeletten ausschreiben, die direkt in dein Projekt kopierbar sind.

<user_response_autocomplete>
Bitte gib mir konkrete TypeScript Services mit Signals
Zeig mir ein Beispiel wie PeriodDetailStore aussehen kann
Ich möchte zuerst die Backup Import Export Logik implementieren
</user_response_autocomplete>
