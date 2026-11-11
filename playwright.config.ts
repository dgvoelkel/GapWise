import { existsSync } from "node:fs"
import { defineConfig } from "@playwright/test"

const PORT = process.env.PORT ?? "3000"

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  expect: { timeout: 6000 },
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 60000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`,
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
