import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    channel: 'chrome',
    headless: true,
  },
});
