#!/usr/bin/env node
// Report figures (BUILD.md Phase 8): PNGs at deviceScaleFactor 2 from deep links.
//
//   node scripts/figures.mjs --port=3000
//
// Expects a production build in dist/ (the Makefile runs `pnpm build` first).
// Starts `vite preview` on --port unless something already answers there.

import { existsSync, mkdirSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "docs", "figures")
const port = Number((process.argv.find((a) => a.startsWith("--port=")) ?? "--port=3000").slice(7))
const base = `http://127.0.0.1:${port}`

const nav = (page, name) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name, exact: true })
const settle = (page, ms = 3500) => page.waitForTimeout(ms) // let tiles finish

/** Each figure shows a different function of the prototype. */
const FIGURES = [
  { file: "01-persona-picker.png", url: "/", shows: "Entry point: choosing a student" },
  {
    file: "02-right-now-stella.png",
    url: "/?persona=stella&t=11:00&tab=today",
    shows: "Usable-time headline, map strip, fit-labeled options",
  },
  {
    file: "03-why-it-fits.png",
    url: "/?persona=stella&t=11:00&sheet=why:lunch",
    shows: "Time receipt explaining a fit",
    clip: "dialog",
    prepare: async (page) => {
      // Raise the Finance buffer to 10 first so lunch is Tight (4.2), then reopen the sheet.
      await page.goto(`${base}/?persona=stella&t=11:00&tab=plan`)
      await page.getByRole("button", { name: "Edit FINE 3010 · Financial Management", exact: true }).click()
      await page.getByRole("dialog").getByLabel("Arrival buffer").selectOption("10")
      await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click()
      await nav(page, "Right Now").click()
      const show = page.getByRole("button", { name: /^Show all \d+ activities$/ })
      if (await show.isVisible()) await show.click()
      await page.getByRole("article", { name: "Lunch", exact: true }).getByRole("button", { name: "View details" }).click()
      await settle(page, 2500)
      return true // handled navigation itself
    },
  },
  { file: "04-plan-grid.png", url: "/?persona=chloe&tab=plan&day=0", shows: "Calendar grid with gaps to scale" },
  {
    file: "05-recovery-chloe.png",
    url: "/?persona=chloe&t=12:00&tab=plan&day=0",
    shows: "Change banner and recalculated gap",
    action: async (page) => {
      await page.getByRole("button", { name: "Edit CMPS 6240 · Intro to Machine Learning", exact: true }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Cancel commitment", exact: true }).click()
      await nav(page, "Right Now").click()
      await settle(page)
    },
  },
  {
    file: "06-doesnt-fit-later.png",
    url: "/?persona=stella&t=11:00&tab=today",
    shows: "Doesn't fit + later gap suggestion",
    clip: "dialog",
    action: async (page) => {
      const show = page.getByRole("button", { name: /^Show all \d+ activities$/ })
      if (await show.isVisible()) await show.click()
      const noFit = page.locator(".disclosure", { hasText: "Doesn’t fit this gap" })
      await noFit.locator("summary").click()
      await noFit
        .locator(".incompatible-card", { hasText: "Conditioning workout" })
        .getByRole("button", { name: "View details" })
        .click()
      await settle(page, 2500)
    },
  },
  { file: "07-map-tab.png", url: "/?persona=stella&t=11:00&tab=map", shows: "Real campus map with route and pins" },
  { file: "08-quiet-ryan.png", url: "/?persona=ryan&t=10:50", shows: "Quiet state: nothing to add" },
]

async function serverUp() {
  try {
    const res = await fetch(base)
    return res.ok
  } catch {
    return false
  }
}

mkdirSync(OUT, { recursive: true })
let server
if (!(await serverUp())) {
  server = spawn("pnpm", ["exec", "vite", "preview", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  })
  for (let i = 0; i < 40 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 250))
}
const browser = await chromium.launch({
  executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
try {
  for (const figure of FIGURES) {
    // Dialog figures get a tall viewport so the whole sheet (receipt + later gaps) is in frame.
    const page = await browser.newPage({
      viewport: { width: 1280, height: figure.clip === "dialog" ? 1500 : 860 },
      deviceScaleFactor: 2,
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e)))
    const handled = figure.prepare ? await figure.prepare(page) : false
    if (!handled) {
      await page.goto(base + figure.url)
      await settle(page)
      if (figure.action) await figure.action(page)
    }
    const target = figure.clip === "dialog" ? page.getByRole("dialog") : null
    const file = path.join(OUT, figure.file)
    if (target) await target.screenshot({ path: file })
    else await page.screenshot({ path: file, fullPage: false })
    console.log(`${figure.file}  ${figure.shows}${errors.length ? "  ! " + errors.join(" | ") : ""}`)
    await page.close()
  }
} finally {
  await browser.close()
  server?.kill()
}
console.log(`wrote ${FIGURES.length} figures to ${path.relative(ROOT, OUT)}`)
