import {addDays, format} from 'date-fns';
import {Component, computed, OnInit, signal} from '@angular/core';
import {BackupService} from './core/services/backup.service';
import {PayoutPeriod, TipDeposit} from './core/models';
import {TipDepositsLocalStorageRepository} from './core/repositories/tip-deposits-local-storage.repository';
import {EmployeesStore} from './core/stores/employees.store';
import {PeriodDetailStore} from './core/stores/period-detail.store';
import {PeriodsStore} from './core/stores/periods.store';
import {calculateBaseFactorFromHours, sanitizeNumber} from './core/utils/period-calculation';
import {HeaderBarComponent} from './components/header-bar/header-bar.component';
import {CreatePeriodComponent} from './components/create-period/create-period.component';
import {PeriodsTableComponent} from './components/periods-table/periods-table.component';
import {CashboxPanelComponent} from './components/cashbox-panel/cashbox-panel.component';
import {EmployeeDraftUpdate, EmployeesPanelComponent} from './components/employees-panel/employees-panel.component';
import {
  PeriodDetailPanelComponent,
  PeriodHeaderChangeEvent
} from './components/period-detail-panel/period-detail-panel.component';

@Component({
  selector: 'app-root',
  imports: [
    HeaderBarComponent,
    CreatePeriodComponent,
    PeriodsTableComponent,
    CashboxPanelComponent,
    EmployeesPanelComponent,
    PeriodDetailPanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly title = signal('Trinkgeldkasse');

  readonly selectedPeriodId = signal<string | null>(null);
  readonly status = signal('');
  readonly employeeFieldErrors = signal<Partial<Record<'name' | 'weeklyHours', string>>>({});
  readonly periodFieldErrors = signal<Partial<Record<'startDate', string>>>({});

  readonly cashFieldErrors = signal<Partial<Record<'amount' | 'date', string>>>({});
  readonly currentPeriodDeposits = signal<TipDeposit[]>([]);
  readonly employeeEditById = signal<Record<string, { name: string; weeklyHours: number; active: boolean }>>({});

  readonly newEmployee = {
    name: '',
    weeklyHours: 40,
  };

  readonly newPeriod = {
    startDate: format(new Date(), 'yyyy-MM-dd'),
  };

  readonly cashDepositForm = {
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
  };

  readonly activeEmployees = computed(() => this.employeesStore.employees().filter((employee) => employee.active));
  readonly employeesById = computed(() => {
    const map: Record<string, string> = {};
    for (const employee of this.employeesStore.employees()) {
      map[employee.id] = employee.name;
    }
    return map;
  });

  constructor(
    readonly employeesStore: EmployeesStore,
    readonly periodsStore: PeriodsStore,
    readonly periodDetailStore: PeriodDetailStore,
    private readonly depositsRepository: TipDepositsLocalStorageRepository,
    private readonly backupService: BackupService,
  ) {}

  ngOnInit(): void {
    this.employeesStore.loadFromLocalStorage();
    this.refreshEmployeeEditBuffer();
    this.periodsStore.loadFromLocalStorage();

    const firstPeriod = this.periodsStore.sortedPeriods()[0];
    if (firstPeriod) {
      this.selectPeriod(firstPeriod.id);
    }
    this.refreshCurrentPeriodDeposits();
  }

  private refreshEmployeeEditBuffer(): void {
    const next: Record<string, { name: string; weeklyHours: number; active: boolean }> = {};
    for (const employee of this.employeesStore.employees()) {
      next[employee.id] = {
        name: employee.name,
        weeklyHours: employee.weeklyHours,
        active: employee.active,
      };
    }
    this.employeeEditById.set(next);
  }

  private recalculateAllPeriodsAfterEmployeeChange(): void {
    const selectedId = this.selectedPeriodId();
    const periodIds = this.periodsStore.periods().map((period) => period.id);
    for (const periodId of periodIds) {
      this.periodDetailStore.setPeriodId(periodId);
      this.periodDetailStore.load();
    }
    this.periodsStore.loadFromLocalStorage();
    this.refreshCurrentPeriodDeposits();
    if (selectedId && periodIds.includes(selectedId)) {
      this.selectPeriod(selectedId);
    }
  }

  updateEmployeeDraft(id: string, patch: Partial<{ name: string; weeklyHours: number; active: boolean }>): void {
    const current = this.employeeEditById()[id];
    if (!current) {
      return;
    }
    this.employeeEditById.update((state) => ({
      ...state,
      [id]: {
        ...current,
        ...patch,
      },
    }));
  }

  onEmployeeDraftUpdate(event: EmployeeDraftUpdate): void {
    this.updateEmployeeDraft(event.id, event.patch);
  }

  saveEmployeeChanges(id: string): void {
    const draft = this.employeeEditById()[id];
    if (!draft) {
      return;
    }

    const name = draft.name.trim();
    const weeklyHours = Math.max(0, sanitizeNumber(draft.weeklyHours, 0));
    if (!name) {
      this.status.set('Name ist erforderlich.');
      return;
    }
    if (weeklyHours <= 0) {
      this.status.set('Wochenstunden müssen > 0 sein.');
      return;
    }

    const baseFactor = calculateBaseFactorFromHours(weeklyHours, 40);
    this.employeesStore.updateEmployee(id, { name, weeklyHours, baseFactor });
    this.employeesStore.setEmployeeActive(id, draft.active);
    this.refreshEmployeeEditBuffer();
    this.recalculateAllPeriodsAfterEmployeeChange();
    this.status.set('Mitarbeiter aktualisiert.');
  }

  deleteEmployee(id: string): void {
    this.employeesStore.deleteEmployee(id);
    this.refreshEmployeeEditBuffer();
    this.recalculateAllPeriodsAfterEmployeeChange();
    this.status.set('Mitarbeiter gelöscht.');
  }

  payoutAndDeactivateEmployee(id: string): void {
    const employee = this.employeesStore.employees().find((item) => item.id === id);
    if (!employee) {
      this.status.set('Mitarbeiter nicht gefunden.');
      return;
    }
    if (!employee.active) {
      this.status.set('Mitarbeiter ist bereits inaktiv.');
      return;
    }

    const current = this.periodsStore.currentPeriod();
    if (!current) {
      this.status.set('Es gibt keine offene Periode für eine Austrittsauszahlung.');
      return;
    }

    const todayIso = format(new Date(), 'yyyy-MM-dd');
    try {
      const payoutAmount = this.periodsStore.payoutEmployeeFromOpenPeriod(current.id, id, todayIso);
      this.employeesStore.setEmployeeActive(id, false);
      this.refreshEmployeeEditBuffer();
      this.recalculateAllPeriodsAfterEmployeeChange();
      if (payoutAmount > 0) {
        this.status.set(`Austritt ausgezahlt: ${employee.name} (${payoutAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR) und auf Inaktiv gesetzt.`);
      } else {
        this.status.set(`Kein Auszahlungsbetrag für ${employee.name}. Mitarbeiter wurde auf Inaktiv gesetzt.`);
      }
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Austrittsauszahlung fehlgeschlagen.');
    }
  }

  refreshCurrentPeriodDeposits(): void {
    const current = this.periodsStore.currentPeriod();
    if (!current) {
      this.currentPeriodDeposits.set([]);
      return;
    }
    this.currentPeriodDeposits.set(this.depositsRepository.getByPeriodId(current.id));
  }

  periodDisplayEndDate(period: Pick<PayoutPeriod, 'startDate' | 'endDate'>): string {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    if (period.endDate) {
      return period.endDate;
    }
    return new Date(todayIso).getTime() < new Date(period.startDate).getTime() ? period.startDate : todayIso;
  }

  onCashDepositAmountChange(value: number): void {
    this.cashDepositForm.amount = value;
  }

  onCashDepositDateChange(value: string): void {
    this.cashDepositForm.date = value;
  }

  depositToCurrentPeriod(): void {
    const current = this.periodsStore.currentPeriod();
    if (!current) {
      this.status.set('Es gibt keine offene Periode für Einzahlungen.');
      return;
    }

    const fieldErrors: Partial<Record<'amount' | 'date', string>> = {};
    const amount = sanitizeNumber(this.cashDepositForm.amount, 0);
    const date = this.cashDepositForm.date;

    if (amount <= 0) {
      fieldErrors.amount = 'Betrag muss größer als 0 sein.';
    }
    if (!date) {
      fieldErrors.date = 'Datum ist erforderlich.';
    }

    this.cashFieldErrors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    try {
      this.periodsStore.addDepositToPeriod(current.id, amount, date);
      this.periodsStore.loadFromLocalStorage();
      this.refreshCurrentPeriodDeposits();
      this.selectPeriod(current.id);
      this.cashDepositForm.amount = 0;
      this.cashFieldErrors.set({});
      this.status.set('Einzahlung verbucht.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Einzahlung fehlgeschlagen.');
    }
  }

  deleteDepositFromCurrentPeriod(depositId: string): void {
    const current = this.periodsStore.currentPeriod();
    if (!current) {
      this.status.set('Es gibt keine offene Periode für Einzahlungen.');
      return;
    }

    try {
      this.periodsStore.removeDepositFromPeriod(current.id, depositId);
      this.periodsStore.loadFromLocalStorage();
      this.refreshCurrentPeriodDeposits();
      this.selectPeriod(current.id);
      this.status.set('Einzahlung gelöscht und protokolliert.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Einzahlung konnte nicht gelöscht werden.');
    }
  }

  private generateEmployeeId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `emp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private generatePeriodId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `period-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  payoutAndCreateNextPeriod(): void {
    const current = this.periodsStore.currentPeriod();
    if (!current) {
      this.createPeriod();
      return;
    }

    const activeEmployees = this.activeEmployees();
    if (activeEmployees.length === 0) {
      this.status.set('Keine aktiven Mitarbeiter vorhanden.');
      return;
    }

    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const payoutEndDate = this.periodDisplayEndDate(current);

    try {
      const { closedPeriod, outOfRangeAmount } = this.periodsStore.closePeriod(current.id, payoutEndDate, todayIso);

      const nextStart = format(addDays(new Date(payoutEndDate), 1), 'yyyy-MM-dd');

      let id = this.generatePeriodId();
      while (this.periodsStore.periods().some((period) => period.id === id)) {
        id = this.generatePeriodId();
      }

      const carryOver = Math.max(0, closedPeriod.remainder + outOfRangeAmount);
      this.periodsStore.createPeriod(
        {
          id,
          totalTip: carryOver,
          carryOverIncluded: carryOver,
          startDate: nextStart,
          endDate: null,
          payoutDate: null,
        },
        activeEmployees,
      );

      this.periodsStore.loadFromLocalStorage();
      this.selectPeriod(id);
      this.refreshCurrentPeriodDeposits();
      this.status.set(
        `Auszahlung am ${format(new Date(todayIso), 'dd.MM.yyyy')} verbucht (Periodenende: ${format(new Date(payoutEndDate), 'dd.MM.yyyy')}). Neue Periode ab ${format(new Date(nextStart), 'dd.MM.yyyy')} erstellt.`,
      );
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Auszahlung fehlgeschlagen.');
    }
  }

  onNewEmployeeNameChange(value: string): void {
    this.newEmployee.name = value;
  }

  onNewEmployeeWeeklyHoursChange(value: number): void {
    this.newEmployee.weeklyHours = value;
  }

  addEmployee(): void {
    const fieldErrors: Partial<Record<'name' | 'weeklyHours', string>> = {};
    const name = this.newEmployee.name.trim();
    const weeklyHours = Math.max(0, sanitizeNumber(this.newEmployee.weeklyHours, 0));
    const baseFactor = calculateBaseFactorFromHours(weeklyHours, 40);

    if (!name) {
      fieldErrors.name = 'Name ist erforderlich.';
    }
    if (weeklyHours <= 0) {
      fieldErrors.weeklyHours = 'Wochenstunden müssen > 0 sein.';
    }
    this.employeeFieldErrors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      this.status.set('Bitte Eingaben prüfen.');
      return;
    }

    let id = this.generateEmployeeId();
    while (this.employeesStore.employees().some((employee) => employee.id === id)) {
      id = this.generateEmployeeId();
    }
    this.employeesStore.addEmployee({ id, name, weeklyHours, baseFactor });
    this.refreshEmployeeEditBuffer();
    this.employeeFieldErrors.set({});

    this.newEmployee.name = '';
    this.newEmployee.weeklyHours = 40;
    this.status.set('Mitarbeiter hinzugefügt.');
  }

  onNewPeriodStartDateChange(value: string): void {
    this.newPeriod.startDate = value;
  }

  createPeriod(): void {
    const fieldErrors: Partial<Record<'startDate', string>> = {};
    if (!this.newPeriod.startDate) {
      fieldErrors.startDate = 'Startdatum ist erforderlich.';
    }

    this.periodFieldErrors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      this.status.set('Bitte Eingaben prüfen.');
      return;
    }

    let id = this.generatePeriodId();
    while (this.periodsStore.periods().some((period) => period.id === id)) {
      id = this.generatePeriodId();
    }

    try {
      this.periodsStore.createPeriod(
        {
          id,
          totalTip: 0,
          carryOverIncluded: 0,
          startDate: this.newPeriod.startDate,
          endDate: null,
          payoutDate: null,
        },
        this.activeEmployees(),
      );

      this.periodsStore.loadFromLocalStorage();
      this.selectPeriod(id);
      this.refreshCurrentPeriodDeposits();
      this.periodFieldErrors.set({});

      this.newPeriod.startDate = format(new Date(), 'yyyy-MM-dd');

      this.status.set('Initiale Periode erstellt.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Periode konnte nicht erstellt werden.');
    }
  }

  selectPeriod(periodId: string): void {
    this.selectedPeriodId.set(periodId);
    this.periodDetailStore.setPeriodId(periodId);
    this.periodDetailStore.load();
  }

  onShareSickUnitsChange(employeeId: string, value: unknown): void {
    const sickUnits = Math.max(0, sanitizeNumber(value, 0));
    if (sickUnits > 0 && sickUnits < 6) {
      this.status.set('Krank darf nur 0 oder mindestens 6 sein.');
      return;
    }
    this.periodDetailStore.updateShare(employeeId, { sickUnits });
  }

  onPeriodHeaderChange(event: PeriodHeaderChangeEvent): void {
    this.periodDetailStore.changeHeader(event.field, event.value);
  }

  exportBackup(): void {
    const content = this.backupService.exportAsJson();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trinkgeldkasse-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.status.set('Backup exportiert.');
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      this.backupService.importFromJsonText(content);
      this.employeesStore.loadFromLocalStorage();
      this.periodsStore.loadFromLocalStorage();
      this.refreshCurrentPeriodDeposits();
      const firstPeriod = this.periodsStore.sortedPeriods()[0];
      if (firstPeriod) {
        this.selectPeriod(firstPeriod.id);
      }
      this.status.set('Backup importiert.');
    } catch (error) {
      this.status.set(error instanceof Error ? `Import fehlgeschlagen: ${error.message}` : 'Import fehlgeschlagen.');
    } finally {
      input.value = '';
    }
  }
}
