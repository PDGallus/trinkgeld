import { FormsModule } from '@angular/forms';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-create-period',
  imports: [FormsModule],
  templateUrl: './create-period.component.html',
  styleUrl: './create-period.component.css',
})
export class CreatePeriodComponent {
  readonly startDate = input.required<string>();
  readonly startDateChange = output<string>();
  readonly startDateError = input<string | undefined>();
  readonly createPeriod = output<void>();

  onStartDateChange(value: string): void {
    this.startDateChange.emit(value);
  }
}
