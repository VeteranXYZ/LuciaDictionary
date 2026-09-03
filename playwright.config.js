import { defineConfig, devices } from "@playwright/test";

const previewPort = process.env.PLAYWRIGHT_PORT ?? "54321";
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: previewUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    env: {
      ...process.env,
      ASTRO_PREVIEW_BACKGROUND: "0",
    },
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
