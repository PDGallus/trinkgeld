import { Injectable, signal } from '@angular/core';
import { format } from 'date-fns';
import { Employee, PayoutPeriod, PayoutShare } from '../models';
import { EmployeesLocalStorageRepository } from '../repositories/employees-local-storage.repository';
import { PeriodsLocalStorageRepository } from '../repositories/periods-local-storage.repository';
import { SharesLocalStorageRepository } from '../repositories/shares-local-storage.repository';
import {
  calculateAdjustedFactor,
  calculateTipPerWeek,
  calculateTrend,
  calculateWeeksFromDateRange,
  recalculateShares,
  sanitizeNumber,
} from '../utils/period-calculation';

@Injectable({ providedIn: 'root' })
export class PeriodDetailStore {
  readonly periodId = signal<string | null>(null);
  readonly period = signal<PayoutPeriod | null>(null);
  readonly shares = signal<PayoutShare[]>([]);
  readonly employees = signal<Employee[]>([]);

  constructor(
    private readonly periodsRepository: PeriodsLocalStorageRepository,
    private readonly sharesRepository: SharesLocalStorageRepository,
    private readonly employeesRepository: EmployeesLocalStorageRepository,
  ) {}

  setPeriodId(periodId: string): void {
    this.periodId.set(periodId);
  }

  private effectiveEndDateIso(period: Pick<PayoutPeriod, 'startDate' | 'endDate'>): string {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    if (period.endDate) {
      return period.endDate;
    }
    return new Date(todayIso).getTime() < new Date(period.startDate).getTime() ? period.startDate : todayIso;
  }

  load(): void {
    const id = this.periodId();
    if (!id) {
      return;
    }

    let period = this.periodsRepository.getById(id) ?? null;
    const employees = this.employeesRepository.getAll();
    const activeEmployees = employees.filter((employee) => employee.active);
    const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
    let shares = this.sharesRepository.getByPeriodId(id);
    shares = shares.filter((share) => activeEmployeeIds.has(share.employeeId));

    if (period) {
      const periodId = period.id;
      for (const employee of activeEmployees) {
        const hasShare = shares.some((share) => share.employeeId === employee.id);
        if (!hasShare) {
          shares.push({
            id: `${periodId}-${employee.id}-${shares.length}`,
            periodId,
            employeeId: employee.id,
            sickUnits: 0,
            adjustedFactor: employee.baseFactor,
            amount: 0,
          });
        }
      }
    }

    if (period) {
      const recalculated = recalculateShares(period, shares);
      shares = recalculated.shares;
      period = {
        ...period,
        totalAdjustedFactor: recalculated.totalAdjustedFactor,
        controlSum: recalculated.controlSum,
        remainder: recalculated.remainder,
        updatedAt: new Date().toISOString(),
      };
      this.sharesRepository.saveForPeriod(period.id, shares);
      this.periodsRepository.upsert(period);
    }

    this.period.set(period);
    this.shares.set(shares);
    this.employees.set(employees);
  }

  changeHeader(
    field: keyof Pick<PayoutPeriod, 'totalTip' | 'carryOverIncluded' | 'startDate' | 'endDate'>,
    value: string | number,
  ): void {
    const current = this.period();
    if (!current) {
      return;
    }

    const next = { ...current, updatedAt: new Date().toISOString() };
    if (field === 'totalTip') {
      next.totalTip = Math.max(0, sanitizeNumber(value, next.totalTip));
    }
    if (field === 'carryOverIncluded') {
      next.carryOverIncluded = Math.max(0, sanitizeNumber(value, next.carryOverIncluded));
    }
    if (field === 'startDate') {
      next.startDate = String(value);
    }
    if (field === 'endDate') {
      const normalized = String(value).trim();
      next.endDate = normalized || null;
    }

    const effectiveEndDate = this.effectiveEndDateIso(next);
    next.weeks = calculateWeeksFromDateRange(next.startDate, effectiveEndDate);
    next.tipPerWeek = calculateTipPerWeek(next.carryOverIncluded, next.weeks);
    const previousTip = next.previousPeriodId ? this.periodsRepository.getById(next.previousPeriodId)?.tipPerWeek ?? 0 : 0;
    const trend = calculateTrend(next.tipPerWeek, previousTip);
    next.trendPercent = trend.percent;
    next.trendIcon = trend.icon;

    let nextShares = this.shares();
    if (field === 'startDate' || field === 'endDate') {
      nextShares = nextShares.map((share) => {
        const employee = this.employees().find((item) => item.id === share.employeeId);
        return {
          ...share,
          adjustedFactor: calculateAdjustedFactor(employee?.baseFactor ?? share.adjustedFactor, next.weeks, share.sickUnits),
        };
      });
    }

    const recalculated = recalculateShares(next, nextShares);
    this.shares.set(recalculated.shares);
    this.period.set({
      ...next,
      totalAdjustedFactor: recalculated.totalAdjustedFactor,
      controlSum: recalculated.controlSum,
      remainder: recalculated.remainder,
    });
    this.persistCurrentState();
  }

  updateShare(
    employeeId: string,
    partial: Partial<Pick<PayoutShare, 'sickUnits'>>,
  ): void {
    const currentPeriod = this.period();
    if (!currentPeriod) {
      return;
    }

    const employee = this.employees().find((item) => item.id === employeeId);

    const nextShares = this.shares().map((share) => {
      if (share.employeeId !== employeeId) {
        return share;
      }

      const nextSickUnits = Math.max(0, sanitizeNumber(partial.sickUnits ?? share.sickUnits, share.sickUnits));
      const nextAdjustedFactor = calculateAdjustedFactor(employee?.baseFactor ?? share.adjustedFactor, currentPeriod.weeks, nextSickUnits);

      return {
        ...share,
        sickUnits: nextSickUnits,
        adjustedFactor: nextAdjustedFactor,
      };
    });

    const recalculated = recalculateShares(currentPeriod, nextShares);
    this.shares.set(recalculated.shares);
    this.period.set({
      ...currentPeriod,
      totalAdjustedFactor: recalculated.totalAdjustedFactor,
      controlSum: recalculated.controlSum,
      remainder: recalculated.remainder,
      updatedAt: new Date().toISOString(),
    });
    this.persistCurrentState();
  }

  save(): void {
    this.persistCurrentState();
  }

  private persistCurrentState(): void {
    const currentPeriod = this.period();
    const currentShares = this.shares();
    if (!currentPeriod) {
      throw new Error('Keine Periode ausgewählt.');
    }

    this.periodsRepository.upsert(currentPeriod);
    this.sharesRepository.saveForPeriod(currentPeriod.id, currentShares);
  }
}
