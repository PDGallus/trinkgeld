import { Page, Locator } from '@playwright/test';

/**
 * Returns a locator for the open backdrop inside an app-action-sheet.
 *
 * Why: The app-action-sheet host element has zero intrinsic dimensions
 * (all children are position:fixed), so Playwright always considers it
 * "hidden". Instead we check whether the backdrop carries the .open class
 * (opacity:1) which Playwright correctly sees as visible.
 *
 * Usage:
 *   const sheet = page.locator('app-action-sheet');
 *   await expect(sheetOpen(sheet)).toBeVisible();       // sheet is open
 *   await expect(sheetOpen(sheet)).not.toBeVisible();   // sheet is closed
 */
export function sheetOpen(sheet: Locator): Locator {
  return sheet.locator('.action-sheet-backdrop.open');
}

const LS_PREFIX = 'trinkgeldkasse.v1';

export const KEYS = {
  employees: `${LS_PREFIX}.employees`,
  periods: `${LS_PREFIX}.periods`,
  shares: `${LS_PREFIX}.shares`,
  deposits: `${LS_PREFIX}.deposits`,
  settings: `${LS_PREFIX}.settings`,
};

/** Clears all app data from localStorage. */
export async function clearStorage(page: Page) {
  await page.evaluate((keys) => {
    // Use setItem with empty arrays so the app treats this as "initialized but empty"
    // rather than "first run" (which would trigger default employee seeding).
    localStorage.setItem(keys.employees, '[]');
    localStorage.setItem(keys.periods, '[]');
    localStorage.setItem(keys.shares, '[]');
    localStorage.setItem(keys.deposits, '[]');
    localStorage.removeItem(keys.settings);
  }, KEYS);
}

/** Seeds employees into localStorage before navigation. */
export async function seedEmployees(
  page: Page,
  employees: Array<{
    id: string;
    name: string;
    weeklyHours: number;
    active?: boolean;
    isResigned?: boolean;
  }>
) {
  const now = new Date().toISOString();
  const data = employees.map((e) => ({
    id: e.id,
    name: e.name,
    weeklyHours: e.weeklyHours,
    baseFactor: e.weeklyHours / 40,
    active: e.active ?? true,
    isResigned: e.isResigned ?? false,
    createdAt: now,
    updatedAt: now,
  }));
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: KEYS.employees, value: data }
  );
}

/** Seeds an open period into localStorage. */
export async function seedOpenPeriod(
  page: Page,
  period: { id: string; startDate: string; totalTip?: number }
) {
  const data = [
    {
      id: period.id,
      totalTip: period.totalTip ?? 0,
      carryOverIncluded: period.totalTip ?? 0,
      startDate: period.startDate,
      endDate: null,
      payoutDate: null,
      weeks: null,
      tipPerWeek: null,
      trendPercent: null,
      trendIcon: 'steady',
      totalAdjustedFactor: null,
      controlSum: null,
      remainder: null,
    },
  ];
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: KEYS.periods, value: data }
  );
}

/** Seeds a closed period with shares into localStorage (for Archiv tests). */
export async function seedClosedPeriod(
  page: Page,
  period: {
    id: string;
    startDate: string;
    endDate: string;
    payoutDate: string;
    controlSum: number;
    remainder: number;
  },
  shares: Array<{
    id: string;
    employeeId: string;
    sickUnits: number;
    adjustedFactor: number;
    amount: number;
  }>
) {
  const periods = [
    {
      id: period.id,
      totalTip: period.controlSum,
      carryOverIncluded: period.controlSum,
      startDate: period.startDate,
      endDate: period.endDate,
      payoutDate: period.payoutDate,
      weeks: 4,
      tipPerWeek: period.controlSum / 4,
      trendPercent: 0,
      trendIcon: 'steady',
      totalAdjustedFactor: shares.reduce((s, sh) => s + sh.adjustedFactor, 0),
      controlSum: period.controlSum,
      remainder: period.remainder,
    },
  ];
  const sharesData = shares.map((s) => ({ ...s, periodId: period.id }));

  await page.evaluate(
    ({ periodsKey, sharesKey, periodsData, sharesData }) => {
      localStorage.setItem(periodsKey, JSON.stringify(periodsData));
      localStorage.setItem(sharesKey, JSON.stringify(sharesData));
    },
    {
      periodsKey: KEYS.periods,
      sharesKey: KEYS.shares,
      periodsData: periods,
      sharesData,
    }
  );
}

/** Seeds tip deposits for a period. */
export async function seedDeposits(
  page: Page,
  deposits: Array<{ id: string; periodId: string; amount: number; date: string; description?: string }>
) {
  const now = new Date().toISOString();
  const data = deposits.map((d) => ({
    id: d.id,
    periodId: d.periodId,
    amount: d.amount,
    date: d.date,
    description: d.description ?? 'Barzahlung',
    createdAt: now,
  }));
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: KEYS.deposits, value: data }
  );
}

/** Navigates to a page and waits for Angular to stabilise. */
export async function goto(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
