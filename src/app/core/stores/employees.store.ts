import { Injectable, signal } from '@angular/core';
import { defaultEmployees } from '../defaults';
import { Employee } from '../models';
import { EmployeesLocalStorageRepository } from '../repositories/employees-local-storage.repository';

@Injectable({ providedIn: 'root' })
export class EmployeesStore {
  readonly employees = signal<Employee[]>([]);

  constructor(private readonly repository: EmployeesLocalStorageRepository) { }

  loadFromLocalStorage(): void {
    if (!this.repository.hasInitialized()) {
      const seeded = defaultEmployees();
      this.repository.saveAll(seeded);
      this.employees.set(seeded);
      return;
    }
    const all = this.repository.getAll();
    const normalized = this.normalizeKnownDataCorrection(all);
    this.employees.set(normalized);
  }

  private normalizeKnownDataCorrection(employees: Employee[]): Employee[] {
    let hasChanges = false;
    const normalized = employees.map((employee) => {
      if (employee.id !== 'vanessa') {
        return employee;
      }

      if (employee.weeklyHours === 30 && employee.baseFactor === 0.75) {
        hasChanges = true;
        return {
          ...employee,
          weeklyHours: 20,
          baseFactor: 0.5,
          updatedAt: new Date().toISOString(),
        };
      }

      return employee;
    });

    if (hasChanges) {
      this.repository.saveAll(normalized);
    }

    return normalized;
  }

  addEmployee(dto: { name: string; weeklyHours: number; baseFactor: number }): void {
    const now = new Date().toISOString();
    const employee: Employee = {
      id: this.generateId(),
      name: dto.name,
      weeklyHours: dto.weeklyHours,
      baseFactor: dto.baseFactor,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.employees.set(this.repository.add(employee));
  }

  updateEmployee(id: string, dto: { name: string; weeklyHours: number; baseFactor: number }): void {
    const current = this.employees().find((employee) => employee.id === id);
    if (!current) {
      return;
    }

    const updated: Employee = {
      ...current,
      name: dto.name,
      weeklyHours: dto.weeklyHours,
      baseFactor: dto.baseFactor,
      updatedAt: new Date().toISOString(),
    };

    this.employees.set(this.repository.update(updated));
  }

  deactivateEmployee(id: string): void {
    this.employees.set(this.repository.deactivate(id));
  }

  setEmployeeActive(id: string, active: boolean, inactiveDate?: string): void {
    this.employees.set(this.repository.setActive(id, active, inactiveDate));
  }

  setEmployeeResigned(id: string, inactiveDate: string): void {
    const current = this.employees().find((e) => e.id === id);
    if (!current) return;
    
    const updated: Employee = {
      ...current,
      active: false,
      inactiveDate,
      isResigned: true,
      updatedAt: new Date().toISOString(),
    };
    this.employees.set(this.repository.update(updated));
  }

  deleteEmployee(id: string): void {
    this.employees.set(this.repository.delete(id));
  }

  private generateId(): string {
    let id = '';
    if (globalThis.crypto?.randomUUID) {
      id = globalThis.crypto.randomUUID();
      while (this.employees().some((employee) => employee.id === id)) {
        id = globalThis.crypto.randomUUID();
      }
    } else {
      id = `emp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return id;
  }
}
