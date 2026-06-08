import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'npm run api',
      url: 'http://127.0.0.1:4310/api/agronomy/health',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm start',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
