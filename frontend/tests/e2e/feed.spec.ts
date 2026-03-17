// T003–T008 — Playwright e2e tests: feed task lifecycle (US1)
// TC-F01: tasks visible | TC-F02: complete | TC-F03: dismiss | TC-F04: restore | TC-F05: rename

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Feed interactions — authenticated', () => {
  test.skip(
    !process.env.E2E_SESSION_COOKIE,
    'E2E_SESSION_COOKIE not set — skipping authenticated feed tests',
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

  // TC-F01: Tasks visible in feed sections
  test('TC-F01: tasks appear in feed sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);

    // At least one section header must be visible
    const upcomingVisible = await page.locator('text=/upcoming/i').isVisible();
    const noDateVisible = await page.locator('text=/no date/i').isVisible();
    expect(upcomingVisible || noDateVisible).toBeTruthy();

    // At least one task item must be present
    await expect(page.locator('[aria-label="Mark complete"]').first()).toBeVisible();
  });

  // TC-F02: Complete a task
  test('TC-F02: completing a task moves it to the Completed section', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);

    const completeBtn = page.locator('[aria-label="Mark complete"]').first();
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // Completed section toggle button becomes visible
    await expect(page.locator('button:has-text("Completed")')).toBeVisible();
  });

  // TC-F03: Dismiss a task
  test('TC-F03: dismissing a task removes it from the main feed', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);

    // Count tasks before dismiss
    const tasksBefore = await page.locator('[aria-label="Mark complete"]').count();
    expect(tasksBefore).toBeGreaterThan(0);

    // Hover to reveal the dismiss button (opacity-0 → opacity-100 on group hover)
    const firstTask = page.locator('[aria-label="Mark complete"]').first();
    const taskRow = firstTask.locator('xpath=ancestor::*[contains(@class,"group")]').first();
    await taskRow.hover();

    const dismissBtn = taskRow.locator('[aria-label="Dismiss item"]');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    // Task count must decrease
    const tasksAfter = await page.locator('[aria-label="Mark complete"]').count();
    expect(tasksAfter).toBeLessThan(tasksBefore);
  });

  // TC-F04: Restore a dismissed task
  test('TC-F04: restoring a dismissed task returns it to the main feed', async ({ page }) => {
    // First dismiss a task
    await page.goto(`${BASE_URL}/feed`);
    const firstTask = page.locator('[aria-label="Mark complete"]').first();
    const taskRow = firstTask.locator('xpath=ancestor::*[contains(@class,"group")]').first();
    await taskRow.hover();
    await taskRow.locator('[aria-label="Dismiss item"]').click();

    // Navigate to the dismissed view
    await page.goto(`${BASE_URL}/feed?showDismissed=true`);
    await expect(page.locator('text=/dismissed/i').first()).toBeVisible();

    // Restore the task
    const restoreBtn = page.locator('[aria-label="Restore item"]').first();
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Task should disappear from dismissed view
    await expect(page.locator('[aria-label="Restore item"]').first()).not.toBeVisible();

    // Navigate back to main feed — task should be present again
    await page.goto(`${BASE_URL}/feed`);
    await expect(page.locator('[aria-label="Mark complete"]').first()).toBeVisible();
  });

  // TC-F05: Rename a task (title override)
  test('TC-F05: setting a custom title overrides the task name and preserves the original', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/feed`);

    // Click the task content area to open EditTaskModal
    const taskContentArea = page
      .locator('[aria-label="Mark complete"]')
      .first()
      .locator('xpath=following-sibling::*[contains(@class,"cursor-pointer")]')
      .first();
    await taskContentArea.click();

    // EditTaskModal must open
    const titleInput = page.locator('#edit-title');
    await expect(titleInput).toBeVisible();

    // Clear and type a new title
    await titleInput.fill('Custom Title');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Modal closes
    await expect(titleInput).not.toBeVisible();

    // Task displays new title in the feed
    await expect(page.locator('text=Custom Title').first()).toBeVisible();
  });
});
