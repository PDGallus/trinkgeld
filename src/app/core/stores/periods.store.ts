import { computed, Injectable, signal } from '@angular/core';
import { format } from 'date-fns';
import { Employee, PayoutPeriod, TipDeposit } from '../models';
import { PeriodsLocalStorageRepository } from '../repositories/periods-local-storage.repository';
import { SharesLocalStorageRepository } from '../repositories/shares-local-storage.repository';
import { TipDepositsLocalStorageRepository } from '../repositories/tip-deposits-local-storage.repository';
import {
  buildPeriod,
  buildSharesForPeriod,
  calculateTipPerWeek,
  calculateTrend,
  calculateWeeksFromDateRange,
  recalculateShares,
  roundCurrency,
} from '../utils/period-calculation';

@Injectable({ providedIn: 'root' })
export class PeriodsStore {
  readonly periods = signal<PayoutPeriod[]>([]);

  readonly sortedPeriods = computed(() =>
    [...this.periods()].sort((a, b) => new Date(this.effectiveEndDateIso(b)).getTime() - new Date(this.effectiveEndDateIso(a)).getTime()),
  );

  readonly currentPeriod = computed(() => this.sortedPeriods().find((period) => period.payoutDate === null) ?? null);

  constructor(
    private readonly periodsRepository: PeriodsLocalStorageRepository,
    private readonly sharesRepository: SharesLocalStorageRepository,
    private readonly depositsRepository: TipDepositsLocalStorageRepository,
  ) {}

  loadFromLocalStorage(): void {
    this.periods.set(this.periodsRepository.getAll());
    this.refreshCurrentPeriodLivePreview();
  }

  private effectiveEndDateIso(period: Pick<PayoutPeriod, 'startDate' | 'endDate'>): string {
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    if (period.endDate) {
      return period.endDate;
    }
    return new Date(todayIso).getTime() < new Date(period.startDate).getTime() ? period.startDate : todayIso;
  }

  private sumDepositsInRange(period: PayoutPeriod, endDate: string): number {
    const deposits = this.depositsRepository.getByPeriodId(period.id);
    let inRangeAmount = 0;
    for (const deposit of deposits) {
      const isInRange = deposit.date >= period.startDate && deposit.date <= endDate;
      if (isInRange) {
        inRangeAmount += deposit.amount;
      }
    }
    return roundCurrency(inRangeAmount);
  }

  private recalculatePeriodForEndDate(period: PayoutPeriod, endDate: string): PayoutPeriod {
    const currentEndDate = this.effectiveEndDateIso(period);
    const currentInRangeAmount = this.sumDepositsInRange(period, currentEndDate);
    const openingBalance = roundCurrency(period.carryOverIncluded - currentInRangeAmount);
    const targetInRangeAmount = this.sumDepositsInRange(period, endDate);
    const nextCarryOver = roundCurrency(openingBalance + targetInRangeAmount);
    const weeks = calculateWeeksFromDateRange(period.startDate, endDate);
    const tipPerWeek = calculateTipPerWeek(nextCarryOver, weeks);
    const previousTip = period.previousPeriodId ? this.periodsRepository.getById(period.previousPeriodId)?.tipPerWeek ?? 0 : 0;
    const trend = calculateTrend(tipPerWeek, previousTip);

    const nextPeriod: PayoutPeriod = {
      ...period,
      totalTip: nextCarryOver,
      carryOverIncluded: nextCarryOver,
      weeks,
      tipPerWeek,
      trendPercent: trend.percent,
      trendIcon: trend.icon,
      updatedAt: new Date().toISOString(),
    };

    const shares = this.sharesRepository.getByPeriodId(period.id);
    const recalculated = recalculateShares(nextPeriod, shares);
    this.sharesRepository.saveForPeriod(period.id, recalculated.shares);

    return {
      ...nextPeriod,
      totalAdjustedFactor: recalculated.totalAdjustedFactor,
      controlSum: recalculated.controlSum,
      remainder: recalculated.remainder,
    };
  }

  private refreshCurrentPeriodLivePreview(): void {
    const current = this.currentPeriod();
    if (!current) {
      return;
    }

    const previewEndDate = this.effectiveEndDateIso(current);
    this.periods.set(this.periodsRepository.upsert(this.recalculatePeriodForEndDate(current, previewEndDate)));
  }

  createPeriod(
    dto: {
      id: string;
      totalTip: number;
      carryOverIncluded: number;
      startDate: string;
      endDate: string | null;
      payoutDate: string | null;
    },
    employees: Employee[],
  ): void {
    const trimmedId = dto.id.trim();
    if (!trimmedId) {
      throw new Error('Perioden-ID fehlt.');
    }
    if (this.periods().some((period) => period.id === trimmedId)) {
      throw new Error(`Periode mit ID '${trimmedId}' existiert bereits.`);
    }
    if (!dto.startDate) {
      throw new Error('Bitte ein Startdatum angeben.');
    }

    const effectiveEndDate = dto.endDate ?? this.effectiveEndDateIso({ startDate: dto.startDate, endDate: null });
    const weeks = calculateWeeksFromDateRange(dto.startDate, effectiveEndDate);
    if (weeks <= 0) {
      throw new Error('Ungültiger Datumsbereich.');
    }

    const activeEmployees = employees.filter((employee) => employee.active);
    if (activeEmployees.length === 0) {
      throw new Error('Keine aktiven Mitarbeiter vorhanden.');
    }

    const previous = this.sortedPeriods()[0];
    const period = buildPeriod(
      {
        ...dto,
        id: trimmedId,
        previousPeriodId: previous?.id,
      },
      previous,
    );

    const shares = buildSharesForPeriod(period.id, activeEmployees, period.carryOverIncluded);
    const recalculated = recalculateShares(period, shares);

    const finalizedPeriod: PayoutPeriod = {
      ...period,
      weeks,
      tipPerWeek: calculateTipPerWeek(period.carryOverIncluded, weeks),
      totalAdjustedFactor: recalculated.totalAdjustedFactor,
      controlSum: recalculated.controlSum,
      remainder: recalculated.remainder,
      updatedAt: new Date().toISOString(),
    };

    this.periods.set(this.periodsRepository.upsert(finalizedPeriod));
    this.sharesRepository.saveForPeriod(period.id, recalculated.shares);
  }

  addDepositToPeriod(periodId: string, amount: number, date: string): void {
    if (!date) {
      throw new Error('Bitte ein Datum für die Einzahlung wählen.');
    }

    const normalizedAmount = roundCurrency(Math.max(0, amount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Einzahlungsbetrag muss größer als 0 sein.');
    }

    const period = this.periodsRepository.getById(periodId);
    if (!period) {
      throw new Error('Periode nicht gefunden.');
    }
    if (period.payoutDate !== null) {
      throw new Error('Nur offene Perioden können Einzahlungen erhalten.');
    }

    const deposit: TipDeposit = {
      id: `${periodId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      periodId,
      amount: normalizedAmount,
      date,
      createdAt: new Date().toISOString(),
    };
    this.depositsRepository.add(deposit);

    const effectiveEndDate = this.effectiveEndDateIso(period);
    const isInCurrentRange = date >= period.startDate && date <= effectiveEndDate;
    const periodSeed: PayoutPeriod = isInCurrentRange
      ? {
          ...period,
          totalTip: roundCurrency(period.totalTip + normalizedAmount),
          carryOverIncluded: roundCurrency(period.carryOverIncluded + normalizedAmount),
        }
      : period;
    this.periods.set(this.periodsRepository.upsert(this.recalculatePeriodForEndDate(periodSeed, effectiveEndDate)));
  }

  closePeriod(periodId: string, endDate: string, payoutDate: string): { closedPeriod: PayoutPeriod; outOfRangeAmount: number } {
    if (!endDate) {
      throw new Error('Bitte ein Enddatum für die Auszahlung wählen.');
    }
    if (!payoutDate) {
      throw new Error('Bitte ein Auszahlungsdatum wählen.');
    }

    const period = this.periodsRepository.getById(periodId);
    if (!period) {
      throw new Error('Periode nicht gefunden.');
    }
    if (period.payoutDate !== null) {
      throw new Error('Periode ist bereits ausgezahlt.');
    }

    const inRangeAmount = this.sumDepositsInRange(period, endDate);
    const allDepositsAmount = roundCurrency(this.depositsRepository.getByPeriodId(period.id).reduce((sum, deposit) => sum + deposit.amount, 0));
    const outOfRangeAmount = roundCurrency(allDepositsAmount - inRangeAmount);
    const recalculated = this.recalculatePeriodForEndDate(period, endDate);
    const closedPeriod: PayoutPeriod = {
      ...recalculated,
      endDate,
      payoutDate,
      updatedAt: new Date().toISOString(),
    };

    this.periods.set(this.periodsRepository.upsert(closedPeriod));
    return { closedPeriod, outOfRangeAmount };
  }

  payoutEmployeeFromOpenPeriod(periodId: string, employeeId: string, date: string): number {
    if (!date) {
      throw new Error('Bitte ein Datum für die Austrittsauszahlung wählen.');
    }

    const period = this.periodsRepository.getById(periodId);
    if (!period) {
      throw new Error('Periode nicht gefunden.');
    }
    if (period.payoutDate !== null) {
      throw new Error('Nur offene Perioden erlauben Austrittsauszahlungen.');
    }

    const shares = this.sharesRepository.getByPeriodId(periodId);
    const share = shares.find((item) => item.employeeId === employeeId);
    if (!share) {
      throw new Error('Mitarbeiteranteil in der offenen Periode nicht gefunden.');
    }

    const payoutAmount = roundCurrency(Math.max(0, share.amount));
    if (payoutAmount <= 0) {
      return 0;
    }

    const nowIso = new Date().toISOString();
    const payoutLog: TipDeposit = {
      id: `${periodId}-employee-exit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      periodId,
      amount: roundCurrency(-payoutAmount),
      date,
      createdAt: nowIso,
    };
    this.depositsRepository.add(payoutLog);

    const periodSeed: PayoutPeriod = {
      ...period,
      totalTip: roundCurrency(Math.max(0, period.totalTip - payoutAmount)),
      carryOverIncluded: roundCurrency(Math.max(0, period.carryOverIncluded - payoutAmount)),
      updatedAt: nowIso,
    };

    const effectiveEndDate = this.effectiveEndDateIso(period);
    const recalculated = this.recalculatePeriodForEndDate(periodSeed, effectiveEndDate);
    this.periods.set(this.periodsRepository.upsert({ ...recalculated, updatedAt: nowIso }));
    return payoutAmount;
  }

  removeDepositFromPeriod(periodId: string, depositId: string): void {
    const period = this.periodsRepository.getById(periodId);
    if (!period) {
      throw new Error('Periode nicht gefunden.');
    }
    if (period.payoutDate !== null) {
      throw new Error('Nur offene Perioden können Einzahlungen löschen.');
    }

    const periodDeposits = this.depositsRepository.getByPeriodId(periodId);
    const deposit = periodDeposits.find((item) => item.id === depositId && item.amount > 0);
    if (!deposit) {
      throw new Error('Einzahlung nicht gefunden.');
    }

    const deleted = this.depositsRepository.deleteById(depositId);
    if (!deleted) {
      throw new Error('Einzahlung nicht gefunden.');
    }

    const nowIso = new Date().toISOString();
    const deletionLog: TipDeposit = {
      id: `${periodId}-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      periodId,
      amount: roundCurrency(-deleted.amount),
      date: deleted.date,
      createdAt: nowIso,
    };
    this.depositsRepository.add(deletionLog);

    const effectiveEndDate = this.effectiveEndDateIso(period);
    const isInCurrentRange = deleted.date >= period.startDate && deleted.date <= effectiveEndDate;
    const periodSeed: PayoutPeriod = isInCurrentRange
      ? {
          ...period,
          totalTip: roundCurrency(Math.max(0, period.totalTip - deleted.amount)),
          carryOverIncluded: roundCurrency(Math.max(0, period.carryOverIncluded - deleted.amount)),
        }
      : period;
    const recalculated = this.recalculatePeriodForEndDate(periodSeed, effectiveEndDate);
    this.periods.set(this.periodsRepository.upsert({ ...recalculated, updatedAt: nowIso }));
  }

  updatePeriod(period: PayoutPeriod): void {
    this.periods.set(this.periodsRepository.upsert({ ...period, updatedAt: new Date().toISOString() }));
  }

  deletePeriod(id: string): void {
    this.periods.set(this.periodsRepository.delete(id));
    this.sharesRepository.saveForPeriod(id, []);
    this.depositsRepository.deleteByPeriodId(id);
  }
}
