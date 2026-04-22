import { test, expect } from '@playwright/test';
import { clearStorage, goto, seedEmployees, sheetOpen } from './helpers/storage';

test.describe('Team management', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/team');
    await clearStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  // ── Add employee ──────────────────────────────────────────────────────────

  test('add new employee via FAB', async ({ page }) => {
    await page.locator('button.fab').tap();

    const sheet = page.locator('app-action-sheet');
    await expect(sheetOpen(sheet)).toBeVisible();

    await sheet.locator('app-text-input input').fill('Maria Schmidt');
    await sheet.locator('app-number-input input').fill('32');

    await sheet.locator('button.btn-primary-large').tap();

    await expect(sheetOpen(sheet)).not.toBeVisible();

    const card = page.locator('.employee-card', { hasText: 'Maria Schmidt' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('32');
  });

  test('add employee button is disabled when name is empty', async ({ page }) => {
    await page.locator('button.fab').tap();
    const sheet = page.locator('app-action-sheet');

    await sheet.locator('app-number-input input').fill('40');

    const submitBtn = sheet.locator('button.btn-primary-large');
    await expect(submitBtn).toBeDisabled();
  });

  // ── Edit employee ─────────────────────────────────────────────────────────

  test('edit existing employee name and hours', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'emp-edit', name: 'Karl Braun', weeklyHours: 40 },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('.employee-card', { hasText: 'Karl Braun' }).tap();

    const sheet = page.locator('app-action-sheet');
    await expect(sheetOpen(sheet)).toBeVisible();

    await expect(sheet.locator('app-text-input input')).toHaveValue('Karl Braun');
    await expect(sheet.locator('app-number-input input')).toHaveValue('40');

    await sheet.locator('app-text-input input').fill('Karl Braun Jr.');
    await sheet.locator('app-number-input input').fill('35');

    await sheet.locator('button.btn-primary-large').tap();

    const card = page.locator('.employee-card', { hasText: 'Karl Braun Jr.' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('35');
  });

  // ── Employee status (inactive) ────────────────────────────────────────────

  test('inactive employee card has inactive styling', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'emp-active', name: 'Aktive Person', weeklyHours: 40, active: true },
      { id: 'emp-inactive', name: 'Inaktive Person', weeklyHours: 20, active: false },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const inactiveCard = page.locator('.employee-card.inactive');
    await expect(inactiveCard).toBeVisible();
    await expect(inactiveCard).toContainText('Inaktive Person');

    // Use regex for case-sensitive match — "Inaktive" contains "aktive" so a
    // plain string would match both cards (Playwright's hasText is case-insensitive)
    const activeCard = page.locator('.employee-card', { hasText: /Aktive Person/ });
    await expect(activeCard).not.toHaveClass(/inactive/);
  });

  // ── Delete employee ───────────────────────────────────────────────────────

  test('delete employee removes card', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'emp-del', name: 'Lösch Mich', weeklyHours: 20 },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('.employee-card', { hasText: 'Lösch Mich' }).tap();
    const sheet = page.locator('app-action-sheet');
    await expect(sheetOpen(sheet)).toBeVisible();

    await sheet.locator('button.btn-danger-ghost').tap();

    await expect(page.locator('.employee-card', { hasText: 'Lösch Mich' })).not.toBeVisible();
    await expect(sheetOpen(sheet)).not.toBeVisible();
  });

  // ── Pause / Exit flows ────────────────────────────────────────────────────

  test('pause flow shows calendar picker', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'emp-pause', name: 'Pause Tester', weeklyHours: 40 },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('.employee-card', { hasText: 'Pause Tester' }).tap();
    const sheet = page.locator('app-action-sheet');

    await sheet.locator('button.btn-secondary-large', { hasText: 'pausieren' }).tap();

    await expect(sheet.locator('app-calendar')).toBeVisible();

    await sheet.locator('button.btn-secondary-large', { hasText: 'Abbrechen' }).tap();
    await expect(sheet.locator('app-calendar')).not.toBeVisible();
  });

  test('exit flow shows calendar picker', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'emp-exit', name: 'Exit Tester', weeklyHours: 40 },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator('.employee-card', { hasText: 'Exit Tester' }).tap();
    const sheet = page.locator('app-action-sheet');

    await sheet.locator('button.btn-secondary-large', { hasText: 'Austritt' }).tap();
    await expect(sheet.locator('app-calendar')).toBeVisible();
  });

  // ── Snapshots ─────────────────────────────────────────────────────────────

  test('snapshot: team with employees', async ({ page }) => {
    await seedEmployees(page, [
      { id: 'snap-1', name: 'Anna Vollzeit', weeklyHours: 40 },
      { id: 'snap-2', name: 'Bea Teilzeit', weeklyHours: 20 },
      { id: 'snap-3', name: 'Carl Mini', weeklyHours: 10, active: false },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('team-with-employees.png');
  });

  test('snapshot: add employee sheet open', async ({ page }) => {
    await page.locator('button.fab').tap();
    const sheet = page.locator('app-action-sheet');
    // Wait for the form to appear (inner content, not the zero-dimension host)
    await expect(sheet.locator('.add-employee-form')).toBeVisible();
    await expect(page).toHaveScreenshot('team-add-sheet.png');
  });
});
