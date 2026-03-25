import { FormsModule } from '@angular/forms';
import { Component, input, output } from '@angular/core';
import { Employee } from '../../core/models';

export interface EmployeeDraftUpdate {
  id: string;
  patch: Partial<{ name: string; weeklyHours: number; active: boolean }>;
}

@Component({
  selector: 'app-employees-panel',
  imports: [FormsModule],
  templateUrl: './employees-panel.component.html',
  styleUrl: './employees-panel.component.css',
})
export class EmployeesPanelComponent {
  readonly employees = input.required<Employee[]>();
  readonly employeeEditById = input.required<Record<string, { name: string; weeklyHours: number; active: boolean }>>();
  readonly newEmployeeName = input.required<string>();
  readonly newEmployeeWeeklyHours = input.required<number>();
  readonly employeeFieldErrors = input.required<Partial<Record<'name' | 'weeklyHours', string>>>();

  readonly newEmployeeNameChange = output<string>();
  readonly newEmployeeWeeklyHoursChange = output<number>();
  readonly addEmployee = output<void>();
  readonly updateEmployeeDraft = output<EmployeeDraftUpdate>();
  readonly saveEmployeeChanges = output<string>();
  readonly payoutAndDeactivateEmployee = output<string>();
  readonly deleteEmployee = output<string>();

  onNewEmployeeNameChange(value: string): void {
    this.newEmployeeNameChange.emit(value);
  }

  onNewEmployeeWeeklyHoursChange(value: number): void {
    this.newEmployeeWeeklyHoursChange.emit(value);
  }

  onUpdateEmployeeDraft(id: string, patch: Partial<{ name: string; weeklyHours: number; active: boolean }>): void {
    this.updateEmployeeDraft.emit({ id, patch });
  }
}
