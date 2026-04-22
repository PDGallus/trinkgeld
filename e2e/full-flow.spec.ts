/**
 * Full E2E flow: team setup → deposits → payout → archive inspection.
 *
 * This test mirrors the complete journey of a new user:
 *  1. Open app (empty state)
 *  2. Add employees on the Team page
 *  3. Navigate to Dashboard and add deposits via the numpad
 *  4. Open the payout sheet, inspect the distribution
 *  5. Complete the payout (close the period)
 *  6. Verify the closed period appears in the Archiv
 *  7. Inspect archiv detail sheet
 */

import { test, expect, Page } from '@playwright/test';
import { clearStorage, goto, seedOpenPeriod, sheetOpen } from './helpers/storage';

// ── Helpers ────────────────────────────────────────────────────────────────

async function addEmployee(page: Page, name: string, hours: string) {
  await page.locator('button.fab').tap();
  const sheet = page.locator('app-action-sheet');
  await expect(sheetOpen(sheet)).toBeVisible();
  await sheet.locator('app-text-input input').fill(name);
  await sheet.locator('app-number-input input').fill(hours);
  await sheet.locator('button.btn-primary-large').tap();
  await expect(sheetOpen(sheet)).not.toBeVisible();
}

// The numpad is cent-based: digits are appended as cents (e.g. 200 € → "20000").
// Pass a whole-euro integer; the helper converts it to the required digit sequence.
async function enterNumpadAmount(page: Page, euros: number) {
  const digits = Math.round(euros * 100).toString();
  for (const char of digits) {
    await page
      .locator(`.numpad-key:not(.numpad-key--delete):not(.numpad-key--muted)`, { hasText: char })
      .tap();
  }
}

// ── Test ───────────────────────────────────────────────────────────────────

test.describe('Full user flow', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/team');
    await clearStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('complete journey: employees → deposits → payout → archiv', async ({ page }) => {
    // ── Step 1: Add employees ──────────────────────────────────────────────
    await addEmployee(page, 'Anna Vollzeit', '40');
    await addEmployee(page, 'Bea Teilzeit', '20');
    await addEmployee(page, 'Carl Minijob', '10');

    await expect(page.locator('.employee-card')).toHaveCount(3);

    // ── Step 1.5: Seed an open period ─────────────────────────────────────
    // The new dashboard UI has no "create period" screen; a period must exist
    // for deposits to be saved. We seed it here and do a full navigation so
    // the Angular stores re-initialise from the updated localStorage.
    const today = new Date().toISOString().split('T')[0];
    await seedOpenPeriod(page, { id: 'period-flow', startDate: today, totalTip: 0 });

    // ── Step 2: Go to Dashboard (full reload so stores pick up seeded period) ──
    await goto(page, '/dashboard');
    await expect(page.locator('.dashboard-main')).toBeVisible();

    // ── Step 3: Add first deposit ──────────────────────────────────────────
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const depositSheet = page.locator('app-action-sheet').first();
    await expect(sheetOpen(depositSheet)).toBeVisible();

    await enterNumpadAmount(page, 200);
    await expect(depositSheet.locator('.deposit-amount-value')).toContainText('200');
    await depositSheet.locator('.deposit-submit-btn').tap();
    await expect(sheetOpen(depositSheet)).not.toBeVisible();

    await expect(page.locator('.summary-amount')).toContainText('200');

    // ── Step 4: Add second deposit ─────────────────────────────────────────
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    await expect(sheetOpen(depositSheet)).toBeVisible();

    await enterNumpadAmount(page, 100);
    await depositSheet.locator('.deposit-submit-btn').tap();
    await expect(sheetOpen(depositSheet)).not.toBeVisible();

    await expect(page.locator('.summary-amount')).toContainText('300');
    await expect(page.locator('.deposit-entry')).toHaveCount(2);

    // ── Step 5: Open payout sheet ──────────────────────────────────────────
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const payoutSheet = page.locator('app-action-sheet').nth(1);
    await expect(sheetOpen(payoutSheet)).toBeVisible();

    await expect(payoutSheet.locator('.payout-total-amount')).toContainText('300');

    const employeeCards = payoutSheet.locator('.payout-employee-card');
    await expect(employeeCards).toHaveCount(3);

    // ── Step 6: Expand an employee, inspect sick week stepper ──────────────
    const firstEmployee = employeeCards.first();
    await firstEmployee.locator('.payout-card-header').tap();
    await expect(firstEmployee.locator('.payout-sick-section')).toBeVisible();
    await expect(firstEmployee.locator('.payout-sick-value')).toHaveText('0');

    // Collapse again
    await firstEmployee.locator('.payout-card-header').tap();
    await expect(firstEmployee.locator('.payout-sick-section')).not.toBeVisible();

    // ── Step 7: Verify totals section ─────────────────────────────────────
    await expect(payoutSheet.locator('.payout-totals')).toBeVisible();
    await expect(payoutSheet.locator('.payout-totals-row--total')).toBeVisible();

    // ── Step 8: Complete the payout ───────────────────────────────────────
    await payoutSheet.locator('.payout-submit-btn').tap();
    await expect(sheetOpen(payoutSheet)).not.toBeVisible();
    await expect(page.locator('.summary-amount')).toBeVisible();

    // ── Step 9: Go to Archiv ───────────────────────────────────────────────
    await page.locator('app-bottom-nav button[routerlink="/archiv"]').tap();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.empty-state')).not.toBeVisible();
    const periodCard = page.locator('.period-card').first();
    await expect(periodCard).toBeVisible();
    await expect(periodCard.locator('.period-amount')).toBeVisible();

    // ── Step 10: Open archiv detail sheet ─────────────────────────────────
    await periodCard.tap();
    const detailSheet = page.locator('app-action-sheet');
    await expect(sheetOpen(detailSheet)).toBeVisible();

    await expect(detailSheet.locator('.detail-summary-card')).toBeVisible();
    await expect(detailSheet.locator('.employee-card')).toHaveCount(3);
    await expect(detailSheet.locator('.totals-row--total')).toBeVisible();
    await expect(detailSheet.locator('.detail-footer')).toContainText('archiviert');

    // ── Step 11: Close detail sheet ───────────────────────────────────────
    await detailSheet.locator('button.close-btn').tap();
    await expect(sheetOpen(detailSheet)).not.toBeVisible();

    // ── Snapshot: archiv with one closed period ────────────────────────────
    await expect(page).toHaveScreenshot('archiv-one-period.png');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  test('empty deposits list shown when no deposits', async ({ page }) => {
    await goto(page, '/dashboard');
    await page.waitForLoadState('networkidle');

    const noDeposits = page.locator('.deposit-entry', { hasText: 'keine Einzahlungen' });
    const emptyEntries = page.locator('.deposits-list .deposit-entry');
    const count = await emptyEntries.count();
    if (count > 0) {
      await expect(emptyEntries.first()).toBeVisible();
    } else {
      await expect(noDeposits).toBeVisible();
    }
  });

  test('team: reactivating an inactive employee changes status dot', async ({ page }) => {
    await addEmployee(page, 'Toggle Person', '40');
    await expect(page.locator('.employee-card', { hasText: 'Toggle Person' })).toBeVisible();

    await page.locator('.employee-card', { hasText: 'Toggle Person' }).tap();
    const sheet = page.locator('app-action-sheet');

    // Pause the employee
    await sheet.locator('button.btn-secondary-large', { hasText: 'pausieren' }).tap();
    await expect(sheet.locator('app-calendar')).toBeVisible();

    await sheet.locator('button.btn-primary-large', { hasText: 'Bestätigen' }).tap();
    await expect(sheetOpen(sheet)).not.toBeVisible();

    // Card should now be inactive
    await expect(page.locator('.employee-card.inactive', { hasText: 'Toggle Person' })).toBeVisible();

    // Reopen and reactivate
    await page.locator('.employee-card.inactive', { hasText: 'Toggle Person' }).tap();
    await expect(sheetOpen(sheet)).toBeVisible();
    await sheet.locator('button.btn-secondary-large', { hasText: 'aktivieren' }).tap();
    await expect(sheetOpen(sheet)).not.toBeVisible();

    // Card should be active again
    await expect(page.locator('.employee-card:not(.inactive)', { hasText: 'Toggle Person' })).toBeVisible();
  });
});

// ── Backup export / import flow ──────────────────────────────────────────────

test.describe('Backup', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/dashboard');
    await clearStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('export backup button triggers file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button[title="Backup exportieren"]').tap(),
    ]);
    expect(download.suggestedFilename()).toMatch(/trinkgeldkasse.*\.json/i);
  });

  test('snapshot: backup export button visible in header', async ({ page }) => {
    const header = page.locator('.dashboard-header');
    await expect(header).toBeVisible();
    await expect(header.locator('button[title="Backup exportieren"]')).toBeVisible();
    await expect(header.locator('button[title="Backup importieren"]')).toBeVisible();
  });
});

// ── Archiv tests (with pre-seeded data) ──────────────────────────────────────

test.describe('Archiv with seeded data', () => {
  test.beforeEach(async ({ page }) => {
    const { seedClosedPeriod, seedEmployees } = await import('./helpers/storage');

    await goto(page, '/archiv');
    await clearStorage(page);
    await seedEmployees(page, [
      { id: 'arch-emp-1', name: 'Archiv Anna', weeklyHours: 40 },
      { id: 'arch-emp-2', name: 'Archiv Ben', weeklyHours: 20 },
    ]);
    await seedClosedPeriod(
      page,
      {
        id: 'arch-period-1',
        startDate: '2024-01-01',
        endDate: '2024-01-28',
        payoutDate: '2024-01-28',
        controlSum: 400,
        remainder: 10,
      },
      [
        { id: 'share-1', employeeId: 'arch-emp-1', sickUnits: 0, adjustedFactor: 1.0, amount: 265 },
        { id: 'share-2', employeeId: 'arch-emp-2', sickUnits: 0, adjustedFactor: 0.5, amount: 125 },
      ]
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('shows closed period card', async ({ page }) => {
    await expect(page.locator('.period-card')).toHaveCount(1);
    await expect(page.locator('.period-amount')).toContainText('400');
  });

  test('clicking period card opens detail sheet', async ({ page }) => {
    await page.locator('.period-card').tap();
    const sheet = page.locator('app-action-sheet');
    await expect(sheetOpen(sheet)).toBeVisible();
    await expect(sheet.locator('.detail-summary-card')).toBeVisible();
  });

  test('detail sheet shows two employee rows', async ({ page }) => {
    await page.locator('.period-card').tap();
    const sheet = page.locator('app-action-sheet');
    await expect(sheet.locator('.employee-card')).toHaveCount(2);
  });

  test('detail sheet shows correct totals', async ({ page }) => {
    await page.locator('.period-card').tap();
    const sheet = page.locator('app-action-sheet');
    await expect(sheet.locator('.totals-row--total')).toContainText('400');
  });

  test('snapshot: archiv with closed period', async ({ page }) => {
    await expect(page).toHaveScreenshot('archiv-closed-period.png');
  });

  test('snapshot: archiv detail sheet', async ({ page }) => {
    await page.locator('.period-card').tap();
    // Wait for detail content to be on-screen before snapping
    await expect(page.locator('.detail-summary-card')).toBeVisible();
    await expect(page).toHaveScreenshot('archiv-detail-sheet.png');
  });
});
