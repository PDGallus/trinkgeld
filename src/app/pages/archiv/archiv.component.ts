import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeriodsStore } from '../../core/stores/periods.store';
import { EmployeesLocalStorageRepository } from '../../core/repositories/employees-local-storage.repository';
import { SharesLocalStorageRepository } from '../../core/repositories/shares-local-storage.repository';
import { ActionSheetComponent } from '../../shared/components/action-sheet/action-sheet.component';
import { Employee, PayoutPeriod } from '../../core/models';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DetailRow {
  employeeId: string;
  name: string;
  initials: string;
  employmentType: string;
  totalHours: number;
  factor: number;
  amount: number;
  hasSick: boolean;
  sickPercent: number;
  colorIndex: number;
}

@Component({
  selector: 'app-archiv',
  standalone: true,
  imports: [CommonModule, ActionSheetComponent],
  templateUrl: './archiv.component.html',
  styleUrl: './archiv.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivComponent {
  private readonly periodsStore = inject(PeriodsStore);
  private readonly sharesRepo = inject(SharesLocalStorageRepository);
  private readonly employeesRepo = inject(EmployeesLocalStorageRepository);

  readonly closedPeriods = computed(() =>
    this.periodsStore.sortedPeriods().filter(p => p.payoutDate !== null)
  );

  readonly selectedPeriodId = signal<string | null>(null);
  readonly isDetailSheetOpen = signal(false);

  readonly selectedPeriod = computed(() => {
    const id = this.selectedPeriodId();
    if (!id) return null;
    return this.closedPeriods().find(p => p.id === id) ?? null;
  });

  private readonly allEmployeesById = computed(() => {
    const map = new Map<string, Employee>();
    for (const e of this.employeesRepo.getAll()) {
      map.set(e.id, e);
    }
    return map;
  });

  readonly detailRows = computed((): DetailRow[] => {
    const id = this.selectedPeriodId();
    if (!id) return [];
    const period = this.selectedPeriod();
    if (!period) return [];
    const byId = this.allEmployeesById();
    return this.sharesRepo.getByPeriodId(id)
      .filter(s => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((share, index) => {
        const employee = byId.get(share.employeeId);
        const name = employee?.name ?? 'Unbekannt';
        const weeklyHours = employee?.weeklyHours ?? 40;
        const sickPercent = period.weeks > 0 ? Math.round((share.sickUnits / period.weeks) * 100) : 0;
        return {
          employeeId: share.employeeId,
          name,
          initials: this.getInitials(name),
          employmentType: this.getEmploymentType(weeklyHours),
          totalHours: Math.round(weeklyHours * period.weeks * 10) / 10,
          factor: share.adjustedFactor,
          amount: share.amount,
          hasSick: share.sickUnits > 0,
          sickPercent,
          colorIndex: index % 3,
        };
      });
  });

  openDetail(periodId: string): void {
    this.selectedPeriodId.set(periodId);
    this.isDetailSheetOpen.set(true);
  }

  closeDetail(): void {
    this.isDetailSheetOpen.set(false);
  }

  getPeriodNumber(index: number): number {
    return this.closedPeriods().length - index;
  }

  getShareCount(periodId: string): number {
    return this.sharesRepo.getByPeriodId(periodId).filter(s => s.amount > 0).length;
  }

  formatDateRange(period: PayoutPeriod): string {
    const start = format(new Date(period.startDate), 'dd. MMM', { locale: de });
    const end = period.endDate ? format(new Date(period.endDate), 'dd. MMM', { locale: de }) : '–';
    return `${start} – ${end}`;
  }

  formatDateRangeFull(period: PayoutPeriod): string {
    const start = format(new Date(period.startDate), 'dd. MMM', { locale: de });
    const end = period.endDate ? format(new Date(period.endDate), 'dd. MMM yyyy', { locale: de }) : '–';
    return `${start} – ${end}`;
  }

  formatClosedDate(period: PayoutPeriod): string {
    if (!period.payoutDate) return '';
    return format(new Date(period.payoutDate), 'dd. MMM yyyy', { locale: de });
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
}
