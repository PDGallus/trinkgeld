import { addDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { Employee, PayoutPeriod, PayoutShare } from '../models';

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sanitizeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric;
}

export function trendIconFor(percent: number): 'up' | 'down' | 'steady' {
  if (percent > 0.01) {
    return 'up';
  }
  if (percent < -0.01) {
    return 'down';
  }
  return 'steady';
}

export function trendSymbol(icon: 'up' | 'down' | 'steady'): string {
  if (icon === 'up') {
    return '⬈';
  }
  if (icon === 'down') {
    return '⬊';
  }
  return '→';
}

export function calculateTipPerWeek(carryOverIncluded: number, weeks: number): number {
  if (weeks <= 0) {
    return 0;
  }
  return roundCurrency(carryOverIncluded / weeks);
}

export function calculateTrend(tipPerWeek: number, previousTipPerWeek: number): { percent: number; icon: 'up' | 'down' | 'steady' } {
  if (previousTipPerWeek <= 0) {
    return { percent: 0, icon: 'steady' };
  }

  const percent = roundCurrency(((tipPerWeek - previousTipPerWeek) / previousTipPerWeek) * 100);
  return { percent, icon: trendIconFor(percent) };
}

export function calculateAdjustedFactor(baseFactor: number, weeks: number, sickUnits: number): number {
  const validBase = Math.max(0, sanitizeNumber(baseFactor, 0));
  const validWeeks = Math.max(0, sanitizeNumber(weeks, 0));
  const validSick = Math.max(0, sanitizeNumber(sickUnits, 0));

  if (validWeeks <= 0) {
    return roundCurrency(validBase);
  }

  const sicknessRatio = Math.min(1, validSick / validWeeks);
  return roundCurrency(validBase * (1 - sicknessRatio));
}

export function calculateBaseFactorFromHours(weeklyHours: number, referenceWeeklyHours = 40): number {
  const validHours = Math.max(0, sanitizeNumber(weeklyHours, 0));
  const validReference = Math.max(1, sanitizeNumber(referenceWeeklyHours, 40));
  return Math.round((validHours / validReference) * 10000) / 10000;
}

export function calculateWeeksFromDateRange(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end)) {
    return 1;
  }

  if (end < start) {
    return 1;
  }

  const daysInclusive = differenceInCalendarDays(end, start) + 1;
  return Math.max(1, Math.ceil(daysInclusive / 7));
}

export function deriveStartDateFromEndAndWeeks(endDate: string, weeks: number): string {
  const end = parseISO(endDate);
  if (!isValid(end)) {
    return endDate;
  }

  const days = Math.max(1, Math.round(sanitizeNumber(weeks, 1))) * 7 - 1;
  return addDays(end, -days).toISOString().slice(0, 10);
}

function allocateAmountsByFactor(totalAmount: number, factors: number[]): number[] {
  const normalizedTotal = roundCurrency(Math.max(0, totalAmount));
  const totalFactor = factors.reduce((sum, factor) => sum + Math.max(0, factor), 0);

  if (totalFactor <= 0) {
    return factors.map(() => 0);
  }

  return factors.map((factor) => {
    const rawAmount = (normalizedTotal * Math.max(0, factor)) / totalFactor;
    // Auszahlung je Person immer auf den nächsten 5-Euro-Schritt abrunden.
    return Math.floor(rawAmount / 5) * 5;
  });
}

export function buildSharesForPeriod(
  periodId: string,
  employees: Employee[],
  carryOverIncluded: number,
): PayoutShare[] {
  const activeEmployees = employees.filter((employee) => employee.active);
  const factors = activeEmployees.map((employee) => Math.max(0, employee.baseFactor));
  const amounts = allocateAmountsByFactor(carryOverIncluded, factors);

  return activeEmployees.map((employee, index) => ({
    id: `${periodId}-${employee.id}-${index}`,
    periodId,
    employeeId: employee.id,
    sickUnits: 0,
    adjustedFactor: roundCurrency(Math.max(0, employee.baseFactor)),
    amount: amounts[index],
  }));
}

export function recalculateShares(
  period: PayoutPeriod,
  shares: PayoutShare[],
): { shares: PayoutShare[]; totalAdjustedFactor: number; controlSum: number; remainder: number } {
  const factors = shares.map((share) => roundCurrency(Math.max(0, share.adjustedFactor)));
  const amounts = allocateAmountsByFactor(period.carryOverIncluded, factors);

  const recalculatedShares = shares.map((share, index) => ({
    ...share,
    adjustedFactor: factors[index],
    amount: amounts[index],
  }));

  const controlSum = roundCurrency(recalculatedShares.reduce((sum, share) => sum + share.amount, 0));
  const remainder = roundCurrency(roundCurrency(period.carryOverIncluded) - controlSum);

  return {
    shares: recalculatedShares,
    totalAdjustedFactor: roundCurrency(factors.reduce((sum, factor) => sum + factor, 0)),
    controlSum,
    remainder,
  };
}

export function buildPeriod(
  input: {
    id: string;
    totalTip: number;
    carryOverIncluded: number;
    startDate: string;
    endDate: string | null;
    payoutDate: string | null;
    previousPeriodId?: string;
  },
  previousPeriod?: PayoutPeriod,
): PayoutPeriod {
  const now = new Date().toISOString();
  const roundedCarryOver = roundCurrency(Math.max(0, sanitizeNumber(input.carryOverIncluded, 0)));
  const effectiveEndDate = input.endDate ?? input.startDate;
  const weeks = calculateWeeksFromDateRange(input.startDate, effectiveEndDate);
  const tipPerWeek = calculateTipPerWeek(roundedCarryOver, weeks);
  const trend = calculateTrend(tipPerWeek, previousPeriod?.tipPerWeek ?? 0);

  return {
    id: input.id,
    totalTip: roundCurrency(Math.max(0, sanitizeNumber(input.totalTip, 0))),
    carryOverIncluded: roundedCarryOver,
    startDate: input.startDate,
    endDate: input.endDate,
    payoutDate: input.payoutDate,
    weeks,
    tipPerWeek,
    trendPercent: trend.percent,
    trendIcon: trend.icon,
    totalAdjustedFactor: 0,
    controlSum: 0,
    remainder: roundedCarryOver,
    previousPeriodId: input.previousPeriodId,
    createdAt: now,
    updatedAt: now,
  };
}
