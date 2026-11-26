import { expect, test, type Page } from '@playwright/test';

async function openSignup(page: Page) {
  await page.goto('/auth');
  await page.getByText('Sign up', { exact: true }).click();
}

async function fillSignupCredentials(page: Page) {
  await page.getByPlaceholder('Choose a username').fill('musicboxd-test-user');
  await page.getByPlaceholder('you@example.com').last().fill('musicboxd-test@example.com');
  await page.getByPlaceholder('Enter your password').last().fill('ValidPass123!');
}

test.describe('Authentication screen', () => {
  test('redirects a signed-out visitor to the login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome back.', { exact: true }).last()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com').last()).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password').last()).toBeVisible();
  });

  test('shows validation when login is submitted empty', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByText('Please enter your email and password.')).toBeVisible();
  });

  test('opens the sign-up form and displays its required fields', async ({ page }) => {
    await openSignup(page);
    await expect(page.getByText('Create your account.')).toBeVisible();
    await expect(page.getByPlaceholder('Choose a username')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password again')).toBeVisible();
    await expect(page.getByText('Create account', { exact: true })).toBeVisible();
  });

  test('requires a username before creating an account', async ({ page }) => {
    await openSignup(page);
    await page.getByPlaceholder('you@example.com').last().fill('musicboxd-test@example.com');
    await page.getByPlaceholder('Enter your password').last().fill('ValidPass123!');
    await page.getByTestId('auth-submit-button').click();

    await expect(page.getByText('Please choose a username.')).toBeVisible();
  });

  test('requires agreement to the terms before creating an account', async ({ page }) => {
    await openSignup(page);
    await fillSignupCredentials(page);
    await page.getByPlaceholder('Enter your password again').fill('ValidPass123!');
    await page.getByTestId('auth-submit-button').click();

    await expect(
      page.getByText('Please agree to the Terms of Service and Privacy Policy.')
    ).toBeVisible();
  });

  test('rejects passwords shorter than six characters', async ({ page }) => {
    await openSignup(page);
    await page.getByPlaceholder('Choose a username').fill('musicboxd-test-user');
    await page.getByPlaceholder('you@example.com').last().fill('musicboxd-test@example.com');
    await page.getByPlaceholder('Enter your password').last().fill('12345');
    await page.getByRole('checkbox').click();
    await page.getByTestId('auth-submit-button').click();

    await expect(
      page.getByText('Your password must be at least 6 characters.')
    ).toBeVisible();
  });

  test('rejects passwords that do not match', async ({ page }) => {
    await openSignup(page);
    await fillSignupCredentials(page);
    await page.getByPlaceholder('Enter your password again').fill('DifferentPass123!');
    await page.getByRole('checkbox').click();
    await page.getByTestId('auth-submit-button').click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });
});
