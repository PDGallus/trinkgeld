import { Injectable } from '@angular/core';
import { Employee, EmployeeId } from '../models';
import { LocalStorageService } from '../services/local-storage.service';
import { STORAGE_KEYS } from '../storage-keys';

@Injectable({ providedIn: 'root' })
export class EmployeesLocalStorageRepository {
  constructor(private readonly storage: LocalStorageService) {}

  getAll(): Employee[] {
    return this.storage.getItem<Employee[]>(STORAGE_KEYS.employees) ?? [];
  }

  saveAll(employees: Employee[]): void {
    this.storage.setItem(STORAGE_KEYS.employees, employees);
  }

  add(employee: Employee): Employee[] {
    const next = [...this.getAll(), employee];
    this.saveAll(next);
    return next;
  }

  update(employee: Employee): Employee[] {
    const next = this.getAll().map((current) =>
      current.id === employee.id ? employee : current,
    );
    this.saveAll(next);
    return next;
  }

  deactivate(id: EmployeeId): Employee[] {
    const now = new Date().toISOString();
    const next = this.getAll().map((employee) =>
      employee.id === id ? { ...employee, active: false, updatedAt: now } : employee,
    );
    this.saveAll(next);
    return next;
  }

  setActive(id: EmployeeId, active: boolean, inactiveDate?: string): Employee[] {
    const now = new Date().toISOString();
    const next = this.getAll().map((employee) =>
      employee.id === id ? { ...employee, active, inactiveDate: inactiveDate || null, updatedAt: now } : employee,
    );
    this.saveAll(next);
    return next;
  }

  delete(id: EmployeeId): Employee[] {
    const next = this.getAll().filter((employee) => employee.id !== id);
    this.saveAll(next);
    return next;
  }
}
