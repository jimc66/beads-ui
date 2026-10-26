/**
 * Playwright configuration for browser-based layout tests.
 *
 * These tests exist because the vitest suite runs in jsdom, which has no
 * layout engine: every width it reports is 0, so a clipped table column is
 * structurally undetectable there. Assertions that depend on real text
 * metrics belong here instead.
 *
 * Kept out of `npm test` (see the `test:e2e` script) so the default suite
 * stays fast and needs no browser download.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  // Layout assertions compare measured pixel widths, so a stable viewport is
  // part of the contract rather than an incidental default.
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A clipped column is a deterministic CSS outcome, so a retry would only
  // mask a real failure.
  retries: 0,
  reporter: [['list']]
});
