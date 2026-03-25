import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { EmployeesLocalStorageRepository } from '../repositories/employees-local-storage.repository';

describe('BackupService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('exports and imports data', () => {
    const backupService = TestBed.inject(BackupService);
    const employeesRepository = TestBed.inject(EmployeesLocalStorageRepository);

    employeesRepository.saveAll([
      {
        id: 'test',
        name: 'Test',
        weeklyHours: 40,
        baseFactor: 1,
        active: true,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);

    const json = backupService.exportAsJson();
    employeesRepository.saveAll([]);
    backupService.importFromJsonText(json);

    expect(employeesRepository.getAll()).toHaveLength(1);
    expect(employeesRepository.getAll()[0].id).toBe('test');
  });

  it('imports legacy backup without deposits', () => {
    const backupService = TestBed.inject(BackupService);
    const employeesRepository = TestBed.inject(EmployeesLocalStorageRepository);

    const legacyBackup = JSON.stringify({
      version: '1',
      exportedAt: '2026-03-25T00:00:00.000Z',
      employees: [
        {
          id: 'legacy',
          name: 'Legacy',
          weeklyHours: 40,
          baseFactor: 1,
          active: true,
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ],
      periods: [],
      shares: [],
      settings: { referenceWeeklyHours: 40, currency: 'EUR', locale: 'de-DE' },
    });

    backupService.importFromJsonText(legacyBackup);
    expect(employeesRepository.getAll()).toHaveLength(1);
    expect(employeesRepository.getAll()[0].id).toBe('legacy');
  });

  it('rejects malformed json', () => {
    const backupService = TestBed.inject(BackupService);
    expect(() => backupService.importFromJsonText('{')).toThrowError('JSON konnte nicht gelesen werden.');
  });

  it('rejects invalid settings structure', () => {
    const backupService = TestBed.inject(BackupService);

    const invalidBackup = JSON.stringify({
      version: '1',
      exportedAt: '2026-03-25T00:00:00.000Z',
      employees: [],
      periods: [],
      shares: [],
      settings: { referenceWeeklyHours: '40', currency: 'EUR', locale: 'de-DE' },
    });

    expect(() => backupService.importFromJsonText(invalidBackup)).toThrowError('Ungültige Settings im Backup.');
  });
});
