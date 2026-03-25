import { CommonModule } from '@angular/common';
import { format } from 'date-fns';
import { Component, input, output } from '@angular/core';
import { PayoutPeriod } from '../../core/models';
import { trendSymbol } from '../../core/utils/period-calculation';

@Component({
  selector: 'app-periods-table',
  imports: [CommonModule],
  templateUrl: './periods-table.component.html',
  styleUrl: './periods-table.component.css',
})
export class PeriodsTableComponent {
  readonly periods = input.required<PayoutPeriod[]>();
  readonly selectedPeriodId = input<string | null>(null);
  readonly selectPeriod = output<string>();

  onSelectPeriod(periodId: string): void {
    this.selectPeriod.emit(periodId);
  }

  periodDisplayEndDate(period: Pick<PayoutPeriod, 'startDate' | 'endDate'>): string {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    if (period.endDate) {
      return period.endDate;
    }
    return new Date(todayIso).getTime() < new Date(period.startDate).getTime() ? period.startDate : todayIso;
  }

  trendIcon(icon: 'up' | 'down' | 'steady'): string {
    return trendSymbol(icon);
  }
}
