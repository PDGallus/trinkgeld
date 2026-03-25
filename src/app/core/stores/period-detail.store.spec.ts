import { TestBed } from '@angular/core/testing';
import { EmployeesLocalStorageRepository } from '../repositories/employees-local-storage.repository';
import { PeriodsLocalStorageRepository } from '../repositories/periods-local-storage.repository';
import { SharesLocalStorageRepository } from '../repositories/shares-local-storage.repository';
import { PeriodDetailStore } from './period-detail.store';

describe('PeriodDetailStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('recalculates adjusted factor and keeps sum stable when sick units change', () => {
    const employeesRepository = TestBed.inject(EmployeesLocalStorageRepository);
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const store = TestBed.inject(PeriodDetailStore);

    employeesRepository.saveAll([
      {
        id: 'a',
        name: 'Alice',
        weeklyHours: 40,
        baseFactor: 1,
        active: true,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
      {
        id: 'b',
        name: 'Bob',
        weeklyHours: 40,
        baseFactor: 1,
        active: true,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);

    periodsRepository.saveAll([
      {
        id: 'p1',
        totalTip: 100,
        carryOverIncluded: 100,
        startDate: '2026-03-01',
        endDate: '2026-03-28',
        weeks: 4,
        payoutDate: null,
        tipPerWeek: 25,
        trendPercent: 0,
        trendIcon: 'steady',
        totalAdjustedFactor: 2,
        controlSum: 100,
        remainder: 0,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);

    sharesRepository.saveAll([
      {
        id: 's1',
        periodId: 'p1',
        employeeId: 'a',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
      {
        id: 's2',
        periodId: 'p1',
        employeeId: 'b',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
    ]);

    store.setPeriodId('p1');
    store.load();
    store.updateShare('a', { sickUnits: 1 });

    const aliceShare = store.shares().find((share) => share.employeeId === 'a');
    const bobShare = store.shares().find((share) => share.employeeId === 'b');

    expect(aliceShare).toBeTruthy();
    expect(bobShare).toBeTruthy();
    expect(aliceShare?.adjustedFactor).toBe(0.75);
    expect(aliceShare?.amount).toBeLessThan(bobShare?.amount ?? 0);
    expect(store.period()?.controlSum).toBe(95);
    expect(store.period()?.remainder).toBe(5);
  });

  it('excludes inactive employees from period details and calculation', () => {
    const employeesRepository = TestBed.inject(EmployeesLocalStorageRepository);
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const store = TestBed.inject(PeriodDetailStore);

    employeesRepository.saveAll([
      {
        id: 'a',
        name: 'Alice',
        weeklyHours: 40,
        baseFactor: 1,
        active: true,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
      {
        id: 'b',
        name: 'Bob',
        weeklyHours: 40,
        baseFactor: 1,
        active: false,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);

    periodsRepository.saveAll([
      {
        id: 'p1',
        totalTip: 100,
        carryOverIncluded: 100,
        startDate: '2026-03-01',
        endDate: '2026-03-28',
        weeks: 4,
        payoutDate: null,
        tipPerWeek: 25,
        trendPercent: 0,
        trendIcon: 'steady',
        totalAdjustedFactor: 2,
        controlSum: 100,
        remainder: 0,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);

    sharesRepository.saveAll([
      { id: 's1', periodId: 'p1', employeeId: 'a', sickUnits: 0, adjustedFactor: 1, amount: 50 },
      { id: 's2', periodId: 'p1', employeeId: 'b', sickUnits: 0, adjustedFactor: 1, amount: 50 },
    ]);

    store.setPeriodId('p1');
    store.load();

    expect(store.shares()).toHaveLength(1);
    expect(store.shares()[0].employeeId).toBe('a');
    expect(store.period()?.controlSum).toBe(100);
  });
});
