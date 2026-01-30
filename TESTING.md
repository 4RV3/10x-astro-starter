# Testing Guide

## Overview
This project includes end-to-end (E2E) tests using Playwright that verify application behavior from a user's perspective.

## Test Structure
- **Location:** `tests/` directory
- **Framework:** Playwright
- **Browser:** Chromium
- **Test Files:** `*.spec.ts`

## Running Tests

### Run all tests (headless):
```bash
npm run test
```

### Run tests with UI (interactive mode):
```bash
npm run test:ui
```

### Debug tests:
```bash
npm run test:debug
```

### Run specific test file:
```bash
npx playwright test tests/user-flow.spec.ts
```

### Run tests in headed mode (see browser):
```bash
npx playwright test --headed
```

## Current Test Coverage

### User Flow Tests (`tests/user-flow.spec.ts`)
1. **Landing and Navigation**
   - Redirects unauthenticated users to login
   - Displays login form with required fields
   - Navigation between login and register pages
   - Shows validation errors for invalid credentials

2. **Registration Flow**
   - Displays registration form properly
   - All required fields are present

3. **Public Pages Accessibility**
   - Login page loads without errors
   - Register page loads without errors

## Test Configuration

Configuration file: `playwright.config.ts`

Key settings:
- Base URL: `http://localhost:4321`
- Build before testing: `npm run build && npm run preview`
- Retries on CI: 2 attempts
- Reporter: HTML report in `playwright-report/`

## CI/CD Integration

Tests run automatically on every push/PR via GitHub Actions:
- Builds application
- Installs Playwright browsers
- Runs all tests
- Uploads test reports as artifacts

See `.github/workflows/ci-cd.yml` for details.

## Writing New Tests

Create new test files in the `tests/` directory:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/some-page');
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

## Best Practices

1. **Use descriptive test names** - clearly state what is being tested
2. **Group related tests** - use `test.describe()` blocks
3. **Wait for elements** - use `await expect().toBeVisible()` instead of timeouts
4. **Keep tests independent** - each test should work in isolation
5. **Use data-testid** - add `data-testid` attributes for stable selectors

## Troubleshooting

### Tests fail with "Target closed"
- Usually means the page crashed or timed out
- Check application logs
- Increase timeout in test

### Browser doesn't open in headed mode
- Ensure browsers are installed: `npx playwright install`

### Tests pass locally but fail in CI
- Check environment variables
- Verify CI has required dependencies
- Review CI logs for specific errors

## Resources
- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
