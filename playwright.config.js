import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'NODE_ENV=test RUNNING_E2E=true node server.js',
      url: 'http://localhost:5050/api/v1/auth/me',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd client && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    }
  ],
});
