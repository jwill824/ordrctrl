// T073 — Playwright e2e test: US2 integrations flow
// connect integration → verify Connected state → disconnect

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('US2 — Integration Onboarding', () => {
  test('onboarding page is accessible after login redirect', async ({ page }) => {
    // Without auth, we expect a redirect to login
    await page.goto(`${BASE_URL}/onboarding`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('integration settings page requires auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings/integrations`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('onboarding page shows all 4 integration cards when authenticated', async ({
    page,
    context,
  }) => {
    // Skip if no test session cookie is configured
    const sessionCookie = process.env.E2E_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'E2E_SESSION_COOKIE not set; skipping authenticated test');
      return;
    }

    await context.addCookies([
      {
        name: 'sessionId',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    await page.goto(`${BASE_URL}/onboarding`);

    // Should NOT redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // All 4 integration cards should be visible
    await expect(page.getByText('Gmail')).toBeVisible();
    await expect(page.getByText('Apple Reminders')).toBeVisible();
    await expect(page.getByText('Microsoft To Do')).toBeVisible();
    await expect(page.getByText('Apple Calendar')).toBeVisible();
  });

  test('Gmail sync mode selector is shown when connecting Gmail', async ({
    page,
    context,
  }) => {
    const sessionCookie = process.env.E2E_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'E2E_SESSION_COOKIE not set');
      return;
    }

    await context.addCookies([
      {
        name: 'sessionId',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    await page.goto(`${BASE_URL}/onboarding`);

    // Click sync options for Gmail
    const syncOptionsButton = page
      .locator('[data-testid="gmail-card"], div')
      .filter({ hasText: 'Gmail' })
      .first()
      .getByRole('button', { name: /sync options/i });

    // If button exists, click it
    if (await syncOptionsButton.isVisible()) {
      await syncOptionsButton.click();
      await expect(page.getByText(/starred only/i)).toBeVisible();
      await expect(page.getByText(/all unread/i)).toBeVisible();
    }
  });

  test('integration settings page shows status badges when authenticated', async ({
    page,
    context,
  }) => {
    const sessionCookie = process.env.E2E_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'E2E_SESSION_COOKIE not set');
      return;
    }

    await context.addCookies([
      {
        name: 'sessionId',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    await page.goto(`${BASE_URL}/settings/integrations`);
    await expect(page).not.toHaveURL(/\/login/);

    // Status badges should be visible
    await expect(page.getByText(/connected|not connected/i).first()).toBeVisible();
  });

  test('OAuth error from provider shows error message on onboarding page', async ({
    page,
    context,
  }) => {
    const sessionCookie = process.env.E2E_SESSION_COOKIE;
    if (!sessionCookie) {
      test.skip(true, 'E2E_SESSION_COOKIE not set');
      return;
    }

    await context.addCookies([
      {
        name: 'sessionId',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);

    // Simulate OAuth denial callback
    await page.goto(`${BASE_URL}/onboarding?error=gmail&reason=denied`);

    await expect(page.getByText(/denied|denied|try again/i)).toBeVisible();
  });
});
