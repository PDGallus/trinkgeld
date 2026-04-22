import { test, expect } from '@playwright/test';
import { clearStorage, goto, seedOpenPeriod, seedEmployees } from './helpers/storage';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/dashboard');
    await clearStorage(page);
    await seedEmployees(page, [
      { id: 'emp-1', name: 'Anna Müller', weeklyHours: 40 },
      { id: 'emp-2', name: 'Ben Koch', weeklyHours: 20 },
    ]);
    await seedOpenPeriod(page, {
      id: 'period-1',
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      totalTip: 500,
    });
    await goto(page, '/dashboard');
  });

  test('bottom nav is visible on all pages', async ({ page }) => {
    const nav = page.locator('app-bottom-nav nav');
    await expect(nav).toBeVisible();

    await page.locator('app-bottom-nav button[routerlink="/team"]').click();
    await expect(page).toHaveURL(/\/team/);
    await expect(nav).toBeVisible();

    await page.locator('app-bottom-nav button[routerlink="/archiv"]').click();
    await expect(page).toHaveURL(/\/archiv/);
    await expect(nav).toBeVisible();

    await page.locator('app-bottom-nav button[routerlink="/dashboard"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(nav).toBeVisible();
  });

  test('active nav tab is highlighted', async ({ page }) => {
    // Dashboard tab should be active
    const dashBtn = page.locator('app-bottom-nav button[routerlink="/dashboard"]');
    await expect(dashBtn).toHaveClass(/active/);

    // Navigate to Team
    await page.locator('app-bottom-nav button[routerlink="/team"]').click();
    await expect(page.locator('app-bottom-nav button[routerlink="/team"]')).toHaveClass(/active/);
    await expect(dashBtn).not.toHaveClass(/active/);
  });

  // ── Snapshot tests ────────────────────────────────────────────────────────

  test('snapshot: dashboard initial view', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard-initial.png');
  });

  test('snapshot: team page', async ({ page }) => {
    await page.locator('app-bottom-nav button[routerlink="/team"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('team-page.png');
  });

  test('snapshot: archiv empty state', async ({ page }) => {
    // Navigate with no closed periods
    await clearStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('app-bottom-nav button[routerlink="/archiv"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('archiv-empty.png');
  });
});
