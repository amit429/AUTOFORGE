import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // Every page runs a WebGL scene; more than two at once starves software rendering in headless runs.
  workers: 2,
  use: { baseURL: process.env.E2E_URL ?? 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm start -p 3100',
        url: 'http://localhost:3100',
        timeout: 240_000,
        reuseExistingServer: true,
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'reduced-motion',
      testMatch: /flow/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
});
