import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeriodsStore } from '../../core/stores/periods.store';
import { EmployeesStore } from '../../core/stores/employees.store';
import { PeriodDetailStore } from '../../core/stores/period-detail.store';
import { TipDepositsLocalStorageRepository } from '../../core/repositories/tip-deposits-local-storage.repository';
import { ActionSheetComponent } from '../../shared/components/action-sheet/action-sheet.component';
import { BackupService } from '../../core/services/backup.service';
import { PayoutShare } from '../../core/models';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ActionSheetComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly periodsStore = inject(PeriodsStore);
  private readonly employeesStore = inject(EmployeesStore);
  private readonly periodDetailStore = inject(PeriodDetailStore);
  private readonly depositsRepo = inject(TipDepositsLocalStorageRepository);
  private readonly backupService = inject(BackupService);

  readonly currentPeriod = this.periodsStore.currentPeriod;

  readonly totalTip = computed(() => this.currentPeriod()?.carryOverIncluded ?? 0);

  readonly trendPercent = computed(() => this.currentPeriod()?.trendPercent ?? 0);
  readonly trendIcon = computed(() => this.currentPeriod()?.trendIcon ?? 'steady');

  readonly activeWeeks = computed(() => {
    const period = this.currentPeriod();
    if (!period) return 0;
    return period.weeks;
  });

  readonly periodStartDateDisplay = computed(() => {
    const period = this.currentPeriod();
    if (!period) return '';
    return format(new Date(period.startDate), 'dd. MMM', { locale: de });
  });

  readonly activeEmployeesCount = computed(() =>
    this.employeesStore.employees().filter(e => e.active).length
  );

  readonly averagePerWeek = computed(() => {
    const period = this.currentPeriod();
    return period?.tipPerWeek ?? 0;
  });

  readonly recentDeposits = computed(() => {
    const period = this.currentPeriod();
    if (!period) return [];
    const deposits = this.depositsRepo.getByPeriodId(period.id);
    return deposits
      .filter(d => d.amount > 0)
      .slice(0, 3);
  });

  // --- Deposit Action Sheet ---
  readonly isDepositSheetOpen = signal(false);
  private readonly depositDigits = signal('');

  readonly depositAmount = computed(() => {
    const d = this.depositDigits();
    return d.length === 0 ? 0 : parseInt(d, 10) / 100;
  });

  readonly depositDisplay = computed(() => {
    const d = this.depositDigits();
    const padded = d.padStart(3, '0');
    const intPart = parseInt(padded.slice(0, -2), 10);
    const decPart = padded.slice(-2);
    return intPart.toLocaleString('de-DE') + ',' + decPart;
  });

  readonly afterDepositAmount = computed(() => this.totalTip() + this.depositAmount());

  readonly todaySubtitle = format(new Date(), "'Heute,' dd. MMMM yyyy", { locale: de });

  openDepositSheet(): void {
    this.depositDigits.set('');
    this.isDepositSheetOpen.set(true);
  }

  closeDepositSheet(): void {
    this.isDepositSheetOpen.set(false);
  }

  onNumPad(key: string): void {
    if (key === 'backspace') {
      this.depositDigits.update(d => d.slice(0, -1));
      return;
    }
    const current = this.depositDigits();
    if (current.length >= 8) return;
    if (current === '' && key === '0') return;
    this.depositDigits.update(d => d + key);
  }

  submitDeposit(): void {
    const period = this.currentPeriod();
    const amount = this.depositAmount();
    if (!period || amount <= 0) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    this.periodsStore.addDepositToPeriod(period.id, amount, today);
    this.isDepositSheetOpen.set(false);
  }

  // --- Payout Action Sheet ---
  readonly isPayoutSheetOpen = signal(false);
  readonly expandedEmployeeId = signal<string | null>(null);

  readonly payoutPeriod = this.periodDetailStore.period;
  readonly payoutShares = this.periodDetailStore.shares;
  readonly payoutEmployees = this.periodDetailStore.employees;

  readonly payoutRows = computed(() => {
    const employees = this.payoutEmployees();
    const shares = this.payoutShares();
    const period = this.payoutPeriod();

    return shares
      .map((share, index) => {
        const employee = employees.find(e => e.id === share.employeeId);
        if (!employee) return null;
        return {
          share,
          employee,
          totalHours: Math.round(employee.weeklyHours * (period?.weeks ?? 1) * 10) / 10,
          employmentType: this.getEmploymentType(employee.weeklyHours),
          initials: this.getInitials(employee.name),
          colorIndex: index % 3,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.employee.weeklyHours - a.employee.weeklyHours);
  });

  readonly payoutTotal = computed(() => this.payoutPeriod()?.carryOverIncluded ?? 0);
  readonly payoutControlSum = computed(() => this.payoutPeriod()?.controlSum ?? 0);
  readonly payoutRemainder = computed(() => this.payoutPeriod()?.remainder ?? 0);

  readonly payoutDateRange = computed(() => {
    const period = this.payoutPeriod();
    if (!period) return '';
    const start = format(new Date(period.startDate), 'dd. MMM', { locale: de });
    const end = format(new Date(), 'dd. MMM yyyy', { locale: de });
    return `${start} – ${end}`;
  });

  openPayoutSheet(): void {
    const period = this.currentPeriod();
    if (period) {
      this.periodDetailStore.setPeriodId(period.id);
      this.periodDetailStore.load();
    }
    this.expandedEmployeeId.set(null);
    this.isPayoutSheetOpen.set(true);
  }

  closePayoutSheet(): void {
    this.isPayoutSheetOpen.set(false);
  }

  togglePayoutEmployee(employeeId: string): void {
    this.expandedEmployeeId.update(id => id === employeeId ? null : employeeId);
  }

  adjustSickWeeks(employeeId: string, share: PayoutShare, delta: number): void {
    const next = Math.max(0, share.sickUnits + delta);
    this.periodDetailStore.updateShare(employeeId, { sickUnits: next });
  }

  submitPayout(): void {
    const period = this.currentPeriod();
    if (!period) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    this.periodsStore.closePeriod(period.id, today, today);
    this.isPayoutSheetOpen.set(false);
  }

  // --- Shared Helpers ---
  formatDepositDate(dateIso: string): string {
    const d = new Date(dateIso);
    if (isToday(d)) {
      return `Heute, ${format(d, 'HH:mm')}`;
    }
    if (isYesterday(d)) {
      return `Gestern, ${format(d, 'HH:mm')}`;
    }
    return format(d, 'dd.MM.yyyy, HH:mm');
  }

  getTrendClass(icon: string): string {
    if (icon === 'up') return 'text-green-600';
    if (icon === 'down') return 'text-red-600';
    return 'text-gray-500';
  }

  getTrendIcon(icon: string): string {
    if (icon === 'up') return 'trending_up';
    if (icon === 'down') return 'trending_down';
    return 'trending_flat';
  }

  getTrendText(percent: number, icon: string): string {
    if (icon === 'steady' || percent === 0) return 'Keine Veränderung';
    const sign = icon === 'up' ? '+' : '-';
    return `${sign}${percent}% diesen Monat`;
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatHours(hours: number): string {
    return hours.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  formatFactor(factor: number): string {
    return factor.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  private getEmploymentType(weeklyHours: number): string {
    if (weeklyHours >= 35) return 'Vollzeit';
    if (weeklyHours >= 15) return 'Teilzeit';
    return 'Aushilfe';
  }

  private getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  // --- Export / Import ---
  readonly importError = signal<string | null>(null);

  exportBackup(): void {
    const json = this.backupService.exportAsJson();
    const date = format(new Date(), 'yyyy-MM-dd');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trinkgeldkasse-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.backupService.importFromJsonText(reader.result as string);
        this.periodsStore.loadFromLocalStorage();
        this.employeesStore.loadFromLocalStorage();
      } catch (err) {
        this.importError.set(err instanceof Error ? err.message : 'Import fehlgeschlagen.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }
}
