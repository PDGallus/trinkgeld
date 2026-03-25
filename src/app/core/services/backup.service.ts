import { Injectable } from '@angular/core';
import { Backup } from '../models';
import { EmployeesLocalStorageRepository } from '../repositories/employees-local-storage.repository';
import { PeriodsLocalStorageRepository } from '../repositories/periods-local-storage.repository';
import { SettingsLocalStorageRepository } from '../repositories/settings-local-storage.repository';
import { SharesLocalStorageRepository } from '../repositories/shares-local-storage.repository';
import { TipDepositsLocalStorageRepository } from '../repositories/tip-deposits-local-storage.repository';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private readonly employeesRepository: EmployeesLocalStorageRepository,
    private readonly periodsRepository: PeriodsLocalStorageRepository,
    private readonly sharesRepository: SharesLocalStorageRepository,
    private readonly depositsRepository: TipDepositsLocalStorageRepository,
    private readonly settingsRepository: SettingsLocalStorageRepository,
  ) {}

  createBackup(): Backup {
    return {
      version: '1',
      exportedAt: new Date().toISOString(),
      employees: this.employeesRepository.getAll(),
      periods: this.periodsRepository.getAll(),
      shares: this.sharesRepository.getAll(),
      deposits: this.depositsRepository.getAll(),
      settings: this.settingsRepository.get(),
    };
  }

  exportAsJson(): string {
    return JSON.stringify(this.createBackup(), null, 2);
  }

  importFromJsonText(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('JSON konnte nicht gelesen werden.');
    }

    if (!isObject(parsed)) {
      throw new Error('Ungültiges Backup-Format.');
    }

    if (parsed['version'] !== '1') {
      throw new Error('Nicht unterstützte Backup-Version.');
    }

    const employees = parsed['employees'];
    const periods = parsed['periods'];
    const shares = parsed['shares'];
    const deposits = parsed['deposits'];
    const settings = parsed['settings'];

    if (
      !Array.isArray(employees) ||
      !Array.isArray(periods) ||
      !Array.isArray(shares) ||
      (deposits !== undefined && !Array.isArray(deposits)) ||
      !isObject(settings)
    ) {
      throw new Error('Ungültige Backup-Struktur.');
    }

    const referenceWeeklyHours = settings['referenceWeeklyHours'];
    const currency = settings['currency'];
    const locale = settings['locale'];

    if (
      typeof referenceWeeklyHours !== 'number' ||
      !Number.isFinite(referenceWeeklyHours) ||
      typeof currency !== 'string' ||
      !currency ||
      typeof locale !== 'string' ||
      !locale
    ) {
      throw new Error('Ungültige Settings im Backup.');
    }

    this.employeesRepository.saveAll(employees);
    this.periodsRepository.saveAll(periods);
    this.sharesRepository.saveAll(shares);
    this.depositsRepository.saveAll(deposits ?? []);
    this.settingsRepository.save({
      referenceWeeklyHours,
      currency,
      locale,
    });
  }
}
