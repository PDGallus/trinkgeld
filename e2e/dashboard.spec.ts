import { test, expect } from '@playwright/test';
import {
  clearStorage,
  goto,
  seedEmployees,
  seedOpenPeriod,
  seedDeposits,
  sheetOpen,
} from './helpers/storage';

const START_DATE = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/dashboard');
    await clearStorage(page);
    await seedEmployees(page, [
      { id: 'emp-a', name: 'Anna Müller', weeklyHours: 40 },
      { id: 'emp-b', name: 'Ben Koch', weeklyHours: 20 },
    ]);
    await seedOpenPeriod(page, {
      id: 'period-open',
      startDate: START_DATE,
      totalTip: 300,
    });
    await seedDeposits(page, [
      { id: 'dep-1', periodId: 'period-open', amount: 150, date: START_DATE, description: 'Montag' },
      { id: 'dep-2', periodId: 'period-open', amount: 150, date: START_DATE, description: 'Dienstag' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  // ── Summary card ──────────────────────────────────────────────────────────

  test('shows total tip amount in summary card', async ({ page }) => {
    const amountEl = page.locator('.summary-amount');
    await expect(amountEl).toBeVisible();
    await expect(amountEl).toContainText('300');
  });

  test('shows active employee count', async ({ page }) => {
    await expect(page.locator('.stat-value.large').first()).toContainText('02');
  });

  test('shows recent deposits list', async ({ page }) => {
    const list = page.locator('.deposits-list');
    await expect(list).toBeVisible();
    await expect(list.locator('.deposit-entry')).toHaveCount(2);
  });

  // ── Deposit action sheet ──────────────────────────────────────────────────

  test('opens deposit sheet on action card tap', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();
    // The host element has zero intrinsic size (all children are position:fixed),
    // so we check the backdrop's .open class instead of the host's visibility.
    await expect(sheetOpen(sheet)).toBeVisible();
    await expect(sheet.locator('.numpad-grid')).toBeVisible();
  });

  test('numpad builds deposit amount', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();
    await expect(sheetOpen(sheet)).toBeVisible();

    // The numpad builds a cent-value: entering '1','2','5' yields display '1,25'
    // (digits / 100 = 1.25 €).  To enter 125 € use five digits: '1','2','5','0','0'.
    await sheet.locator('.numpad-key', { hasText: '1' }).tap();
    await sheet.locator('.numpad-key', { hasText: '2' }).tap();
    await sheet.locator('.numpad-key', { hasText: '5' }).tap();

    await expect(sheet.locator('.deposit-amount-value')).toContainText('1,25');
  });

  test('numpad backspace removes last digit', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();

    await sheet.locator('.numpad-key', { hasText: '5' }).tap();
    await sheet.locator('.numpad-key', { hasText: '0' }).tap();
    await sheet.locator('.numpad-key[class*="delete"]').tap();

    await expect(sheet.locator('.deposit-amount-value')).toContainText('5');
  });

  test('submit button disabled when amount is zero', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();
    await expect(sheet.locator('.deposit-submit-btn')).toBeDisabled();
  });

  test('depositing amount updates total and deposit list', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();
    await expect(sheetOpen(sheet)).toBeVisible();

    // 100 € = digit string '10000' (numpad is cent-based)
    await sheet.locator('.numpad-key', { hasText: '1' }).tap();
    await sheet.locator('.numpad-key', { hasText: '0' }).tap();
    await sheet.locator('.numpad-key', { hasText: '0' }).tap();
    await sheet.locator('.numpad-key', { hasText: '0' }).tap();
    await sheet.locator('.numpad-key', { hasText: '0' }).tap();

    await expect(sheet.locator('.deposit-summary-value--primary')).toContainText('400');

    await sheet.locator('.deposit-submit-btn').tap();
    await expect(sheetOpen(sheet)).not.toBeVisible();

    await expect(page.locator('.summary-amount')).toContainText('400');
    await expect(page.locator('.deposit-entry')).toHaveCount(3);
  });

  test('deposit sheet can be closed via close button', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    const sheet = page.locator('app-action-sheet').first();
    await expect(sheetOpen(sheet)).toBeVisible();

    await sheet.locator('button.close-btn').tap();
    await expect(sheetOpen(sheet)).not.toBeVisible();
  });

  // ── Payout sheet ──────────────────────────────────────────────────────────

  test('opens payout sheet on action card tap', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const sheet = page.locator('app-action-sheet').nth(1);
    await expect(sheetOpen(sheet)).toBeVisible();
    await expect(sheet.locator('.payout-total-amount')).toBeVisible();
  });

  test('payout sheet shows employee rows', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const sheet = page.locator('app-action-sheet').nth(1);
    await expect(sheet.locator('.payout-employee-card')).toHaveCount(2);
  });

  test('expanding employee row shows sick week stepper', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const sheet = page.locator('app-action-sheet').nth(1);

    const firstCard = sheet.locator('.payout-employee-card').first();
    await firstCard.locator('.payout-card-header').tap();

    await expect(firstCard.locator('.payout-sick-section')).toBeVisible();
    await expect(firstCard.locator('.payout-stepper-btn')).toHaveCount(2);
  });

  test('sick week stepper increments value', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const sheet = page.locator('app-action-sheet').nth(1);

    const firstCard = sheet.locator('.payout-employee-card').first();
    await firstCard.locator('.payout-card-header').tap();
    await expect(firstCard.locator('.payout-sick-section')).toBeVisible();

    const sickValue = firstCard.locator('.payout-sick-value');
    await expect(sickValue).toHaveText('0');

    // Click + once — adjustSickWeeks does Math.max(0, current + delta)
    await firstCard.locator('.payout-stepper-btn').nth(1).tap();
    await expect(sickValue).toHaveText('1');
  });

  // ── No period state ───────────────────────────────────────────────────────

  test('payout sheet shows no-period message when no open period', async ({ page }) => {
    await clearStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    const sheet = page.locator('app-action-sheet').nth(1);
    await expect(sheet.locator('.payout-no-period')).toBeVisible();
  });

  // ── Exit payments ─────────────────────────────────────────────────────────

  test('exit payment shows description and negative amount', async ({ page }) => {
    await seedDeposits(page, [
      { id: 'dep-1', periodId: 'period-open', amount: 150, date: START_DATE, description: 'Montag' },
      { id: 'dep-exit', periodId: 'period-open', amount: -75, date: START_DATE, description: 'Austritt Max Mustermann' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const exitEntry = page.locator('.deposit-entry').filter({ hasText: 'Austritt Max Mustermann' });
    await expect(exitEntry.locator('.deposit-type')).toHaveText('Austritt Max Mustermann');
    await expect(exitEntry.locator('.deposit-amount')).toContainText('-75,00');
  });

  // ── Snapshots ─────────────────────────────────────────────────────────────

  test('snapshot: dashboard with deposits', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard-with-deposits.png');
  });

  test('snapshot: dashboard with exit payment', async ({ page }) => {
    await seedDeposits(page, [
      { id: 'dep-1', periodId: 'period-open', amount: 150, date: START_DATE, description: 'Montag' },
      { id: 'dep-exit', periodId: 'period-open', amount: -75, date: START_DATE, description: 'Austritt Max Mustermann' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-with-exit-payment.png');
  });

  test('snapshot: deposit sheet open', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Trinkgeld einzahlen' }).tap();
    // Wait for numpad to be on-screen before snapping
    await expect(page.locator('.numpad-grid')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard-deposit-sheet.png');
  });

  test('snapshot: payout sheet open', async ({ page }) => {
    await page.locator('.action-card', { hasText: 'Auszahlung vorbereiten' }).tap();
    await expect(page.locator('.payout-total-amount')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard-payout-sheet.png');
  });
});
