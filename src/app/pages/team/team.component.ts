import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeesStore } from '../../core/stores/employees.store';
import { PeriodsStore } from '../../core/stores/periods.store';
import { Employee } from '../../core/models';
import { ActionSheetComponent } from '../../shared/components/action-sheet/action-sheet.component';
import { TextInputComponent } from '../../shared/components/forms/text-input/text-input.component';
import { NumberInputComponent } from '../../shared/components/forms/number-input/number-input.component';
import { CalendarComponent } from '../../shared/components/calendar/calendar.component';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, ActionSheetComponent, TextInputComponent, NumberInputComponent, CalendarComponent],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.css']
})
export class TeamComponent {
  isAddEmployeeSheetOpen = signal(false);
  editingEmployeeId = signal<string | null>(null);

  newEmployeeName = signal<string>('');
  newEmployeeHours = signal<number | null>(null);

  flowMode = signal<'none' | 'pause' | 'exit'>('none');
  selectedPauseDate = signal<Date | null>(new Date());

  editingEmployee = computed(() => {
    const id = this.editingEmployeeId();
    if (!id) return null;
    return this.employeesStore.employees().find(e => e.id === id) || null;
  });

  sheetTitle = computed(() => this.editingEmployeeId() ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen');
  submitLabel = computed(() => this.editingEmployeeId() ? 'Änderungen speichern' : 'Mitarbeiter hinzufügen');

  constructor(public employeesStore: EmployeesStore, public periodsStore: PeriodsStore) { }

  getInitials(name: string): string {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  openEmployeeSheet(employee?: Employee): void {
    if (employee) {
      this.editingEmployeeId.set(employee.id);
      this.newEmployeeName.set(employee.name);
      this.newEmployeeHours.set(employee.weeklyHours);
    } else {
      this.editingEmployeeId.set(null);
      this.newEmployeeName.set('');
      this.newEmployeeHours.set(null);
    }
    this.isAddEmployeeSheetOpen.set(true);
  }

  closeEmployeeSheet(): void {
    this.isAddEmployeeSheetOpen.set(false);
    this.editingEmployeeId.set(null);
    this.newEmployeeName.set('');
    this.newEmployeeHours.set(null);
    this.flowMode.set('none');
  }

  submitEmployee(): void {
    const name = this.newEmployeeName();
    const hours = this.newEmployeeHours();

    if (!name || hours === null || hours < 0) return;

    const editId = this.editingEmployeeId();
    if (editId) {
      this.employeesStore.updateEmployee(editId, {
        name: name,
        weeklyHours: hours,
        baseFactor: 1// This could be calculated differently if required
      });
    } else {
      this.employeesStore.addEmployee({
        name: name,
        weeklyHours: hours,
        baseFactor: 1
      });
    }

    this.closeEmployeeSheet();
  }

  startPauseFlow(): void {
    this.flowMode.set('pause');
    this.selectedPauseDate.set(new Date());
  }

  startExitFlow(): void {
    this.flowMode.set('exit');
    this.selectedPauseDate.set(new Date());
  }

  cancelFlow(): void {
    this.flowMode.set('none');
  }

  confirmFlow(): void {
    const employee = this.editingEmployee();
    const date = this.selectedPauseDate();
    if (employee && date) {
      if (this.flowMode() === 'pause') {
        this.employeesStore.setEmployeeActive(employee.id, false, date.toISOString());
      } else if (this.flowMode() === 'exit') {
        this.employeesStore.setEmployeeResigned(employee.id, date.toISOString());
        const currentPeriod = this.periodsStore.currentPeriod();
        if (currentPeriod) {
          this.periodsStore.payoutEmployeeFromOpenPeriod(currentPeriod.id, employee.id, date.toISOString(), `Austritt ${employee.name}`);
        }
      }
      this.closeEmployeeSheet();
    }
  }

  reactivateEmployee(): void {
    const employee = this.editingEmployee();
    if (employee) {
      this.employeesStore.setEmployeeActive(employee.id, true);
      this.closeEmployeeSheet();
    }
  }

  deleteEmployee(): void {
    const editId = this.editingEmployeeId();
    if (editId) {
      this.employeesStore.deleteEmployee(editId);
      this.closeEmployeeSheet();
    }
  }
}
