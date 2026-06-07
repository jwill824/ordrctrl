// TC-WN-01–TC-WN-04 — Playwright e2e tests: weekly view navigation (Phase 11)
// TC-WN-01: ← moves back one week | TC-WN-02: → moves forward one week
// TC-WN-03: Today returns to current week | TC-WN-04: center shows date range on current week

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (weekStart.getMonth() === end.getMonth()) {
    const endDay = end.getDate();
    return `${startLabel}–${endDay}`;
  }
  return `${startLabel} – ${endLabel}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function switchToWeekView(page: Page) {
  await page.goto(`${BASE_URL}/feed`);
  await page.locator('button:has-text("Week")').click();
  await expect(page.locator('[aria-label="Previous week"]')).toBeVisible();
}

test.describe('Weekly view navigation — authenticated', () => {
  test.skip(
    !process.env.E2E_SESSION_COOKIE,
    'E2E_SESSION_COOKIE not set — skipping authenticated weekly navigation tests',
  );

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: 'sessionId',
        value: process.env.E2E_SESSION_COOKIE!,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
  });

  test('TC-WN-01: clicking ← moves view back one week', async ({ page }) => {
    await switchToWeekView(page);
    await page.locator('[aria-label="Previous week"]').click();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
  });

  test('TC-WN-02: clicking → moves view forward one week', async ({ page }) => {
    await switchToWeekView(page);
    await page.locator('[aria-label="Next week"]').click();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
  });

  test('TC-WN-03: tapping Today from an offset week returns to current week', async ({ page }) => {
    await switchToWeekView(page);
    await page.locator('[aria-label="Next week"]').click();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
    await page.locator('button:has-text("Today")').click();
    const currentWeekStart = getWeekStart(new Date());
    const expectedRange = formatWeekRange(currentWeekStart);
    await expect(page.locator(`button:has-text("${expectedRange}")`)).toBeVisible();
  });

  test('TC-WN-04: center shows date range label when on current week', async ({ page }) => {
    await switchToWeekView(page);
    const currentWeekStart = getWeekStart(new Date());
    const expectedRange = formatWeekRange(currentWeekStart);
    await expect(page.locator(`button:has-text("${expectedRange}")`)).toBeVisible();
  });

  test('TC-WN-05: week mode shows day column headers (Mon–Sun)', async ({ page }) => {
    await switchToWeekView(page);
    // Each day column header contains a day abbreviation + date number
    // Check Mon and Fri are visible (they appear in any week)
    await expect(page.locator('text=/Mon \\d+/')).toBeVisible();
    await expect(page.locator('text=/Fri \\d+/')).toBeVisible();
  });
});
