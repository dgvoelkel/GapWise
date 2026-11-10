import { existsSync } from "node:fs"
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  expect: { timeout: 6000 },
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
