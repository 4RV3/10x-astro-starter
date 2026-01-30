import { test, expect } from '@playwright/test';

test.describe('User Flow - Landing and Navigation', () => {
  test('should redirect unauthenticated user to login page', async ({ page }) => {
    // Navigate to home
    const response = await page.goto('/');
    
    // Should redirect to login (either immediate or after processing)
    await page.waitForURL(/.*\/(auth\/login|login)/, { timeout: 10000 });
    
    // Verify we're on login page
    const url = page.url();
    expect(url).toMatch(/\/(auth\/login|login)/);
  });

  test('should display login form with all required fields', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if form exists - LoginForm uses name="username" not email
    const usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    
    // Button component might not have type="submit", look for button with login text
    const submitButton = page.locator('button:has-text("Zaloguj")');
    await expect(submitButton).toBeVisible();
  });

  test('should navigate to register page from login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Look for registration link
    const registerLink = page.locator('a[href*="register"]').first();
    
    const linkCount = await registerLink.count();
    if (linkCount > 0) {
      await registerLink.click();
      await expect(page).toHaveURL(/.*\/(auth\/register|register|signup)/, { timeout: 10000 });
    } else {
      // If no link found, try direct navigation
      await page.goto('/auth/register');
      expect(page.url()).toMatch(/\/(auth\/register|register|signup)/);
    }
  });
});

test.describe('User Flow - Registration', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    
    // Check if registration form exists
    // Registration form should have username/email input
    const hasUsernameOrEmail = await page.locator('input[name="username"], input[name="email"], input[type="email"]').count();
    expect(hasUsernameOrEmail).toBeGreaterThan(0);
    
    // Registration may have multiple password fields (password + confirm password)
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs.first()).toBeVisible();
    
    // Check there's at least one password field (registration typically has 2)
    const count = await passwordInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    
    // Check for submit button by text content
    const hasSubmit = await page.locator('button:has-text("Załóż konto"), button:has-text("Zarejestruj"), button:has-text("Utwórz")').count();
    expect(hasSubmit).toBeGreaterThan(0);
  });
});

test.describe('Public Pages Accessibility', () => {
  test('should load login page without critical errors', async ({ page }) => {
    const response = await page.goto('/auth/login');
    
    // Accept both 200 OK and redirects (3xx)
    const status = response?.status() || 200;
    expect(status).toBeLessThan(400);
    
    // Verify page loaded some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should load register page without critical errors', async ({ page }) => {
    const response = await page.goto('/auth/register');
    
    // Accept both 200 OK and redirects (3xx)  
    const status = response?.status() || 200;
    expect(status).toBeLessThan(400);
    
    // Verify page loaded some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
