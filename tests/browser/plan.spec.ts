import { test, expect, type Page } from "@playwright/test"
import {
  assertClean,
  card,
  dialog,
  notice,
  open,
  readState,
  showAll,
  track,
  undo,
} from "./helpers"

// Plan-tab occupancy with Chloe's Friday: RA hours at the library 9–12, shuttle departs 3:00.
// Gap 12:00–3:00 = 180 min; Library → Shuttle stop walk is read from the grid itself.

const plannedGap = (page: Page) =>
  page.locator('.calendar-gap.is-partitioned[data-start="720"]')

async function scheduleStudy(page: Page) {
  await open(page, "persona=chloe&t=12:00&tab=plan&day=2")
  await page.getByRole("button", { name: /^Select 12:00 PM gap/ }).click()
  await showAll(page)
  await card(page, "Study for midterm")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "65")
}

test.beforeEach(async ({ page }) => track(page))
test.afterEach(async ({ page }) => assertClean(page))

test("the day grid draws commitments and gaps to scale, with rooms and sources on blocks", async ({
  page,
}) => {
  await open(page, "persona=chloe&t=12:00&tab=plan&day=0")
  const grid = page.locator(".calendar-day-grid")
  const start = Number(await grid.getAttribute("data-start"))
  const blocks = await page.locator(".calendar-event").evaluateAll((els) =>
    els.map((el) => ({
      start: Number((el as HTMLElement).dataset.start),
      end: Number((el as HTMLElement).dataset.end),
      top: parseFloat((el as HTMLElement).style.top),
      height: parseFloat((el as HTMLElement).style.height),
      text: el.textContent ?? "",
    })),
  )
  expect(blocks.length).toBe(5)
  for (const b of blocks) {
    expect(b.top).toBeCloseTo(((b.start - start) / 60) * 56, 0)
    if (b.end - b.start >= 60) expect(b.height).toBeCloseTo(((b.end - b.start) / 60) * 56 - 3, 0)
  }
  // Blocks never overlap, including the 5-minute shuttle stops.
  const sorted = [...blocks].sort((a, b) => a.top - b.top)
  for (let i = 1; i < sorted.length; i++)
    expect(sorted[i].top).toBeGreaterThanOrEqual(sorted[i - 1].top + sorted[i - 1].height - 1)
  await expect(page.locator(".calendar-event", { hasText: "CMPS 6160" })).toContainText("Stanley Thomas Hall 302")
  await expect(page.locator(".calendar-event", { hasText: "Research meeting" }).locator(".source-chip")).toHaveText(
    "Outlook",
  )
  await expect(page.locator(".calendar-gap")).toHaveCount(4)
})

test("a planned activity partitions the gap into activity, available, walking, and buffer bands that add up", async ({
  page,
}) => {
  await scheduleStudy(page)
  const gap = plannedGap(page)
  const walking = Number(await gap.getAttribute("data-walking"))
  expect(walking).toBeGreaterThan(0)
  await expect(gap).toHaveAttribute("data-buffer", "10")
  await expect(gap).toHaveAttribute("data-available", String(180 - 65 - walking - 10))
  const parts = await gap.locator(".calendar-gap-segment").evaluateAll((els) =>
    els.map((el) => ({
      kind: (el as HTMLElement).dataset.kind,
      minutes: Number((el as HTMLElement).dataset.duration),
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      height: el.getBoundingClientRect().height,
    })),
  )
  expect(parts.map((p) => p.kind)).toEqual(["activity", "available", "walking", "buffer"])
  expect(parts.reduce((sum, p) => sum + p.minutes, 0)).toBe(180)
  for (const part of parts) expect(part.height).toBeCloseTo((part.minutes * 56) / 60, 0)
  for (let i = 1; i < parts.length; i++)
    expect(Math.abs(parts[i].top - parts[i - 1].bottom)).toBeLessThan(1)
  await expect(page.getByRole("region", { name: "Gap time breakdown" })).toContainText(
    `${180 - 65 - walking - 10} min still available`,
  )
  await expect(page.locator(".plan-scheduled-label")).toContainText("60 min activity + 5 min setup")
  expect(Object.values((await readState(page)).assign).map((a: any) => a.ids)).toEqual([["midterm"]])
})

test("removing the activity restores the whole gap and Undo brings the plan back", async ({ page }) => {
  await scheduleStudy(page)
  await page.getByRole("button", { name: "Remove Study for midterm from this gap" }).click()
  await expect(plannedGap(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Select 12:00 PM gap, \d+ usable minutes, Free gap/ })).toBeVisible()
  await undo(page)
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "65")
})

test("remaining time can be kept open independently of the planned activity", async ({ page }) => {
  await scheduleStudy(page)
  await page.getByRole("button", { name: "Keep remaining time open" }).click()
  await expect(page.locator(".plan-remaining-time")).toContainText("kept open")
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "65")
  const choice = Object.values((await readState(page)).assign)[0] as any
  expect(choice.remainingChoice).toBe("open")
  await page.goto("/?tab=plan&day=2")
  await page.getByRole("button", { name: /^Select 12:00 PM gap/ }).click()
  await expect(page.locator(".plan-remaining-time")).toContainText("kept open")
})

test("a delayed commitment keeps the plan visible for review and explains when no other gap fits", async ({ page }) => {
  await scheduleStudy(page)
  await page.getByRole("button", { name: "Edit Shuttle departs", exact: true }).first().click()
  await dialog(page).getByLabel("Start time", { exact: true }).fill("13:00")
  await dialog(page).getByLabel("End time", { exact: true }).fill("13:05")
  await dialog(page).getByRole("button", { name: "Save changes" }).click()
  await expect(notice(page)).toContainText("Your schedule changed")
  await expect(page.locator(".recovery-card")).toContainText("Study for midterm no longer fits")
  await page.locator(".recovery-card").getByRole("button", { name: "Find another time" }).click()
  await expect(dialog(page)).toContainText("Find time for Study for midterm")
  // Due Friday 11:59 PM: no other gap before the deadline is long enough, and the app says so.
  await expect(dialog(page)).toContainText("No available gap fits yet.")
  await dialog(page).getByRole("button", { name: "Open Plan" }).click()
  await expect(page.locator(".recovery-card")).toContainText("Study for midterm no longer fits")
  await page.locator(".recovery-card").getByRole("button", { name: "Keep gap open" }).click()
  await expect(page.locator(".recovery-card")).toHaveCount(0)
})
