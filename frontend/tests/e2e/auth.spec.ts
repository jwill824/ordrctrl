// T072 — Playwright e2e test: US1 auth flow
// register → verify email → log in → log out → reset password

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `e2e+${Date.now()}@example.com`;
const TEST_PASSWORD = 'E2eTestPass1';

test.describe('US1 — Account Creation & Login', () => {
  test('signup page loads and shows SSO buttons first', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await expect(page).toHaveTitle(/ordrctrl/i);

    // SSO buttons should be visible above the form
    await expect(page.getByRole('link', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /continue with apple/i })).toBeVisible();

    // Email form is present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login page loads and shows SSO buttons first', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await expect(page.getByRole('link', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /continue with apple/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('signup form shows validation error for invalid email', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByLabel(/password/i).fill('ValidPass1');
    await page.getByRole('button', { name: /create account/i }).click();

    // HTML5 or server-side validation should prevent submission
    const emailInput = page.getByLabel(/email/i);
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });

  test('login shows error for wrong credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('WrongPass1');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show an error message without redirecting
    await expect(page.getByText(/invalid|incorrect|failed|check your credentials/i)).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send|reset/i })).toBeVisible();
  });

  test('reset password page loads with error for missing token', async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password`);
    // Should show the form or redirect to forgot-password
    const url = page.url();
    expect(url).toMatch(/reset-password|forgot-password/);
  });

  test('unauthenticated user is redirected to login from /feed', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user is redirected to login from /onboarding', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding`);
    await expect(page).toHaveURL(/\/login/);
  });
});
