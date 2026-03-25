import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, input, output } from '@angular/core';
import { PayoutPeriod, PayoutShare } from '../../core/models';

export interface PeriodHeaderChangeEvent {
  field: 'carryOverIncluded' | 'startDate' | 'endDate';
  value: string | number;
}

@Component({
  selector: 'app-period-detail-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './period-detail-panel.component.html',
  styleUrl: './period-detail-panel.component.css',
})
export class PeriodDetailPanelComponent {
  readonly period = input.required<PayoutPeriod>();
  readonly shares = input.required<PayoutShare[]>();
  readonly employeesById = input.required<Record<string, string>>();

  readonly changeHeader = output<PeriodHeaderChangeEvent>();
  readonly shareSickUnitsChange = output<{ employeeId: string; value: unknown }>();
  readonly payoutAndCreateNextPeriod = output<void>();

  employeeName(employeeId: string): string {
    return this.employeesById()[employeeId] ?? employeeId;
  }

  onHeaderChange(field: 'carryOverIncluded' | 'startDate' | 'endDate', value: string | number): void {
    this.changeHeader.emit({ field, value });
  }

  onShareSickUnitsChange(employeeId: string, value: unknown): void {
    this.shareSickUnitsChange.emit({ employeeId, value });
  }
}
