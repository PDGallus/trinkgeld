import { CommonModule } from '@angular/common';
import { format } from 'date-fns';
import { FormsModule } from '@angular/forms';
import { Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';
import { PayoutPeriod, TipDeposit } from '../../core/models';

@Component({
  selector: 'app-cashbox-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './cashbox-panel.component.html',
  styleUrl: './cashbox-panel.component.css',
})
export class CashboxPanelComponent {
  readonly currentPeriod = input<PayoutPeriod | null>(null);
  readonly deposits = input<TipDeposit[]>([]);
  readonly cashFieldErrors = input<Partial<Record<'amount' | 'date', string>>>({});
  readonly cashDepositAmount = input<number>(0);
  readonly cashDepositDate = input<string>('');

  readonly cashDepositAmountChange = output<number>();
  readonly cashDepositDateChange = output<string>();
  readonly deposit = output<void>();
  readonly deleteDeposit = output<string>();

  readonly expanded = signal(false);
  @ViewChild('cashDepositAmountInput') cashDepositAmountInput?: ElementRef<HTMLInputElement>;

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  openExpandedFromCta(event: Event): void {
    event.stopPropagation();
    this.expanded.set(true);
    setTimeout(() => this.cashDepositAmountInput?.nativeElement.focus(), 0);
  }

  periodDisplayEndDate(period: Pick<PayoutPeriod, 'startDate' | 'endDate'>): string {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    if (period.endDate) {
      return period.endDate;
    }
    return new Date(todayIso).getTime() < new Date(period.startDate).getTime() ? period.startDate : todayIso;
  }

  depositLogLabel(deposit: TipDeposit): string {
    if (deposit.amount > 0) {
      return '';
    }
    if (deposit.id.includes('-employee-exit-')) {
      return 'Austrittsauszahlung';
    }
    if (deposit.id.includes('-delete-')) {
      return 'Einzahlung storniert';
    }
    return 'Korrekturbuchung';
  }

  onAmountChange(value: number): void {
    this.cashDepositAmountChange.emit(value);
  }

  onDateChange(value: string): void {
    this.cashDepositDateChange.emit(value);
  }

  onDeleteDeposit(id: string): void {
    this.deleteDeposit.emit(id);
  }
}
