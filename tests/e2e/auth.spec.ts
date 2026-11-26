import { expect, test } from '@playwright/test';

test.describe('Authentication screen', () => {
  test('redirects a signed-out visitor to the login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome back.', { exact: true }).last()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
  });

  test('shows validation when login is submitted empty', async ({ page }) => {
    await page.goto('/auth');
    await page.getByText('Log in', { exact: true }).last().click();
    await expect(page.getByText('Please enter your email and password.')).toBeVisible();
  });

  test('opens the sign-up form and displays its required fields', async ({ page }) => {
    await page.goto('/auth');
    await page.getByText('Sign up', { exact: true }).click();
    await expect(page.getByText('Create your account.')).toBeVisible();
    await expect(page.getByPlaceholder('Choose a username')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password again')).toBeVisible();
    await expect(page.getByText('Create account', { exact: true })).toBeVisible();
  });
});
