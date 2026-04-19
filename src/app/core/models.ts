export type EmployeeId = string;
export type PeriodId = string;

export interface Employee {
  id: EmployeeId;
  name: string;
  weeklyHours: number;
  baseFactor: number;
  active: boolean;
  inactiveDate?: string | null;
  isResigned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutPeriod {
  id: PeriodId;
  totalTip: number;
  carryOverIncluded: number;
  startDate: string;
  endDate: string | null;
  payoutDate: string | null;
  weeks: number;
  tipPerWeek: number;
  trendPercent: number;
  trendIcon: 'up' | 'down' | 'steady';
  totalAdjustedFactor: number;
  controlSum: number;
  remainder: number;
  previousPeriodId?: PeriodId;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutShare {
  id: string;
  periodId: PeriodId;
  employeeId: EmployeeId;
  sickUnits: number;
  adjustedFactor: number;
  amount: number;
}

export interface TipDeposit {
  id: string;
  periodId: PeriodId;
  amount: number;
  date: string;
  description?: string;
  createdAt: string;
}

export interface Settings {
  referenceWeeklyHours: number;
  currency: string;
  locale: string;
}

export interface Backup {
  version: '1';
  exportedAt: string;
  employees: Employee[];
  periods: PayoutPeriod[];
  shares: PayoutShare[];
  deposits: TipDeposit[];
  settings: Settings;
}
