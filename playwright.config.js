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
  projects: [{ name: 'chromium' }],
  // A clipped column is a deterministic CSS outcome, so a retry would only
  // mask a real failure.
  retries: 0,
  reporter: [['list']],
  // ES modules cannot load over file://, so the fixture is served over HTTP.
  // `npx serve`-free: Node's own static handler keeps this dependency-light.
  webServer: {
    command: 'node test/e2e/fixture/serve.js',
    url: 'http://127.0.0.1:4173/test/e2e/fixture/index.html',
    reuseExistingServer: false,
    stdout: 'ignore'
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    baseURL: 'http://127.0.0.1:4173'
  },
  // Rebuild the fixture bundle before each run so the harness can never be
  // measured against stale copies of the views it is meant to exercise.
  globalSetup: './test/e2e/fixture/build.js'
});
