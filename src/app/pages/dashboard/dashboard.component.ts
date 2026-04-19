import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeriodsStore } from '../../core/stores/periods.store';
import { EmployeesStore } from '../../core/stores/employees.store';
import { TipDepositsLocalStorageRepository } from '../../core/repositories/tip-deposits-local-storage.repository';
import { ActionSheetComponent } from '../../shared/components/action-sheet/action-sheet.component';
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
  private readonly depositsRepo = inject(TipDepositsLocalStorageRepository);

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
}
