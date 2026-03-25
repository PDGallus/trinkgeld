import { TestBed } from '@angular/core/testing';
import { format } from 'date-fns';
import { PeriodsLocalStorageRepository } from '../repositories/periods-local-storage.repository';
import { SharesLocalStorageRepository } from '../repositories/shares-local-storage.repository';
import { TipDepositsLocalStorageRepository } from '../repositories/tip-deposits-local-storage.repository';
import { PeriodsStore } from './periods.store';
import { calculateWeeksFromDateRange } from '../utils/period-calculation';

describe('PeriodsStore deposits', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('adds deposit to open period and recalculates totals', () => {
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const depositsRepository = TestBed.inject(TipDepositsLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
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
        periodId: 'p-open',
        employeeId: 'a',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
      {
        id: 's2',
        periodId: 'p-open',
        employeeId: 'b',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
    ]);

    store.loadFromLocalStorage();
    store.addDepositToPeriod('p-open', 20, '2026-03-26');

    const updated = periodsRepository.getById('p-open');
    expect(updated?.carryOverIncluded).toBe(120);
    expect(updated?.totalTip).toBe(120);
    expect(updated?.tipPerWeek).toBe(30);

    const shares = sharesRepository.getByPeriodId('p-open');
    expect(shares.length).toBe(2);
    expect(shares[0].amount + shares[1].amount).toBe(120);

    const deposits = depositsRepository.getByPeriodId('p-open');
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBe(20);
    expect(deposits[0].date).toBe('2026-03-26');
  });

  it('deletes deposit from open period, recalculates totals and writes a log entry', () => {
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const depositsRepository = TestBed.inject(TipDepositsLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
        totalTip: 120,
        carryOverIncluded: 120,
        startDate: '2026-03-01',
        endDate: '2026-03-28',
        weeks: 4,
        payoutDate: null,
        tipPerWeek: 30,
        trendPercent: 0,
        trendIcon: 'steady',
        totalAdjustedFactor: 2,
        controlSum: 120,
        remainder: 0,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);
    sharesRepository.saveAll([
      {
        id: 's1',
        periodId: 'p-open',
        employeeId: 'a',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 60,
      },
      {
        id: 's2',
        periodId: 'p-open',
        employeeId: 'b',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 60,
      },
    ]);
    depositsRepository.saveAll([
      {
        id: 'd1',
        periodId: 'p-open',
        amount: 20,
        date: '2026-03-26',
        createdAt: '2026-03-26T10:00:00.000Z',
      },
    ]);

    store.loadFromLocalStorage();
    store.removeDepositFromPeriod('p-open', 'd1');

    const updated = periodsRepository.getById('p-open');
    expect(updated?.carryOverIncluded).toBe(100);
    expect(updated?.totalTip).toBe(100);
    expect(updated?.tipPerWeek).toBe(25);

    const shares = sharesRepository.getByPeriodId('p-open');
    expect(shares.length).toBe(2);
    expect(shares[0].amount + shares[1].amount).toBe(100);

    const deposits = depositsRepository.getByPeriodId('p-open');
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBe(-20);
    expect(deposits[0].date).toBe('2026-03-26');
  });

  it('closes an open period with a provided end date and payout date', () => {
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
        totalTip: 100,
        carryOverIncluded: 100,
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        weeks: 2,
        payoutDate: null,
        tipPerWeek: 50,
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
        periodId: 'p-open',
        employeeId: 'a',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
      {
        id: 's2',
        periodId: 'p-open',
        employeeId: 'b',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
    ]);

    store.loadFromLocalStorage();
    store.closePeriod('p-open', '2026-03-28', '2026-03-28');

    const closed = periodsRepository.getById('p-open');
    expect(closed?.payoutDate).toBe('2026-03-28');
    expect(closed?.endDate).toBe('2026-03-28');
    expect(closed?.weeks).toBe(4);
    expect(closed?.tipPerWeek).toBe(25);
  });

  it('excludes deposits outside the selected payout period range', () => {
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const depositsRepository = TestBed.inject(TipDepositsLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
        totalTip: 120,
        carryOverIncluded: 120,
        startDate: '2026-03-01',
        endDate: null,
        weeks: 4,
        payoutDate: null,
        tipPerWeek: 30,
        trendPercent: 0,
        trendIcon: 'steady',
        totalAdjustedFactor: 2,
        controlSum: 120,
        remainder: 0,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);
    sharesRepository.saveAll([
      { id: 's1', periodId: 'p-open', employeeId: 'a', sickUnits: 0, adjustedFactor: 1, amount: 75 },
      { id: 's2', periodId: 'p-open', employeeId: 'b', sickUnits: 0, adjustedFactor: 1, amount: 75 },
    ]);
    depositsRepository.saveAll([
      { id: 'd-in', periodId: 'p-open', amount: 20, date: '2026-03-20', createdAt: '2026-03-20T10:00:00.000Z' },
      { id: 'd-out', periodId: 'p-open', amount: 30, date: '2026-03-27', createdAt: '2026-03-27T10:00:00.000Z' },
    ]);

    store.loadFromLocalStorage();
    const result = store.closePeriod('p-open', '2026-03-25', '2026-03-25');

    const closed = periodsRepository.getById('p-open');
    expect(closed?.carryOverIncluded).toBe(120);
    expect(closed?.totalTip).toBe(120);
    expect(result.outOfRangeAmount).toBe(30);
  });

  it('updates open period to a live preview on load while keeping end date unset', () => {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const expectedWeeks = calculateWeeksFromDateRange('2026-03-01', todayIso);
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
        totalTip: 100,
        carryOverIncluded: 100,
        startDate: '2026-03-01',
        endDate: null,
        weeks: 1,
        payoutDate: null,
        tipPerWeek: 100,
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
        periodId: 'p-open',
        employeeId: 'a',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
      {
        id: 's2',
        periodId: 'p-open',
        employeeId: 'b',
        sickUnits: 0,
        adjustedFactor: 1,
        amount: 50,
      },
    ]);

    store.loadFromLocalStorage();

    const current = periodsRepository.getById('p-open');
    expect(current?.endDate).toBeNull();
    expect(current?.weeks).toBe(expectedWeeks);
  });

  it('pays out a single employee from open period and logs it as negative deposit', () => {
    const periodsRepository = TestBed.inject(PeriodsLocalStorageRepository);
    const sharesRepository = TestBed.inject(SharesLocalStorageRepository);
    const depositsRepository = TestBed.inject(TipDepositsLocalStorageRepository);
    const store = TestBed.inject(PeriodsStore);

    periodsRepository.saveAll([
      {
        id: 'p-open',
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
      { id: 's1', periodId: 'p-open', employeeId: 'a', sickUnits: 0, adjustedFactor: 1, amount: 60 },
      { id: 's2', periodId: 'p-open', employeeId: 'b', sickUnits: 0, adjustedFactor: 1, amount: 40 },
    ]);

    store.loadFromLocalStorage();
    const payout = store.payoutEmployeeFromOpenPeriod('p-open', 'a', '2026-03-26');

    expect(payout).toBe(50);
    const updated = periodsRepository.getById('p-open');
    expect(updated?.carryOverIncluded).toBe(50);
    expect(updated?.totalTip).toBe(50);

    const deposits = depositsRepository.getByPeriodId('p-open');
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBe(-50);
    expect(deposits[0].date).toBe('2026-03-26');
  });
});
