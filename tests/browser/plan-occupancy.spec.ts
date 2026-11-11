import { test, expect, type Page } from "@playwright/test"

const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
const plannedGap = (page: Page) =>
  page.locator('.calendar-gap.is-partitioned[data-start="735"]')
const readState = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("gw")!))
const errors = new WeakMap<Page, string[]>()
const remainingCard = (page: Page, title: string) =>
  page
    .locator(".plan-remaining-time")
    .getByRole("article", { name: title, exact: true })

async function scheduleStudy(page: Page) {
  await nav(page, "Plan").click()
  await page.getByRole("button", { name: /Tomorrow 15/ }).click()
  await page.getByRole("button", { name: /^Select 12:15 PM gap/ }).click()
  const show = page.getByRole("button", { name: /^Show all \d+ activities$/ })
  if (await show.isVisible()) await show.click()
  await page
    .getByRole("article", { name: "Study for linear algebra", exact: true })
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "45")
}
async function addRemaining(page: Page, title: string) {
  await plannedGap(page).locator(".segment-available").last().click()
  const show = page
    .locator(".plan-remaining-time")
    .getByRole("button", { name: /^Show all \d+ activities$/ })
  if (await show.isVisible()) await show.click()
  await remainingCard(page, title)
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
}
async function undo(page: Page) {
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
}

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on("pageerror", (error) => errors.get(page)!.push(String(error)))
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Right Now", exact: true }),
  ).toBeVisible()
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page), "No browser runtime errors").toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test("the study example has proportional planned, free, walking, and buffer sections", async ({
  page,
}) => {
  await scheduleStudy(page)
  const gap = plannedGap(page)
  await expect(gap).toHaveAttribute("data-available", "75")
  await expect(gap).toHaveAttribute("data-walking", "5")
  await expect(gap).toHaveAttribute("data-buffer", "10")
  await expect(gap.locator(".segment-activity")).toContainText(
    "Study for linear algebra",
  )
  await expect(gap.locator(".segment-activity")).toContainText("45 min planned")
  await expect(gap.locator(".segment-available")).toContainText("75 min")
  await expect(gap.locator(".segment-available")).toContainText(
    "still available",
  )
  const parts = await gap.locator(".calendar-gap-segment").evaluateAll((els) =>
    els.map((el) => ({
      kind: (el as HTMLElement).dataset.kind,
      minutes: Number((el as HTMLElement).dataset.duration),
      height: el.getBoundingClientRect().height,
      top: el.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
      color: getComputedStyle(el).backgroundColor,
    })),
  )
  expect(parts.map((p) => [p.kind, p.minutes])).toEqual([
    ["activity", 45],
    ["available", 75],
    ["walking", 5],
    ["buffer", 10],
  ])
  for (const part of parts)
    expect(part.height).toBeCloseTo((part.minutes * 56) / 60, 0)
  for (let i = 1; i < parts.length; i++)
    expect(Math.abs(parts[i].top - parts[i - 1].bottom)).toBeLessThan(1)
  expect(parts[0].color).not.toBe(parts[1].color)
  expect(parts[1].color).not.toBe(parts[3].color)
  await expect(
    page.getByRole("region", { name: "Gap time breakdown", exact: true }),
  ).toContainText("75 min still available")
  await expect(page.locator(".plan-scheduled-label")).toContainText(
    "40 min activity + 5 min setup",
  )
  await expect(
    page.locator(".plan-remaining-time .recommendation-card"),
  ).toHaveCount(0)
  const saved = await readState(page)
  expect(Object.values(saved.assign).map((a: any) => a.ids)).toEqual([
    ["study"],
  ])
})

test("available time opens compatible suggestions with an accessible keyboard target and no nested controls", async ({
  page,
}) => {
  await scheduleStudy(page)
  const gap = plannedGap(page)
  expect((await gap.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(
    gap.locator("button, a, input, select, textarea, [role=button]"),
  ).toHaveCount(0)
  await gap.focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", {
      name: "Activities for this time",
      exact: true,
    }),
  ).toBeVisible()
  await expect(remainingCard(page, "Study for linear algebra")).toHaveCount(0)
  await expect(remainingCard(page, "Email my advisor")).toBeVisible()
  await expect(remainingCard(page, "Finish history reading")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Keep remaining time open", exact: true }),
  ).toBeVisible()
  const saved = await readState(page)
  expect(Object.values(saved.assign).map((a: any) => a.ids)).toEqual([
    ["study"],
  ])
})

test("removing an activity restores its space and Undo restores proportional occupancy", async ({
  page,
}) => {
  await scheduleStudy(page)
  await page
    .getByRole("button", {
      name: "Remove Study for linear algebra from this gap",
      exact: true,
    })
    .click()
  await expect(plannedGap(page)).toHaveCount(0)
  await expect(page.locator(".calendar-gap.is-selected")).toContainText(
    "120 min usable",
  )
  expect(Object.keys((await readState(page)).assign)).toHaveLength(0)
  await undo(page)
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "45")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "75")
})

test("editing duration in activity details updates the block and the available remainder", async ({
  page,
}) => {
  await scheduleStudy(page)
  await page
    .getByRole("button", {
      name: "View details for Study for linear algebra",
      exact: true,
    })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit activity", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByLabel("Duration (minutes)", { exact: true })
    .fill("20")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("95 min")
  await page.keyboard.press("Escape")
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "25")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "95")
  await expect(plannedGap(page).locator(".segment-activity")).toHaveAttribute(
    "data-duration",
    "25",
  )
  await undo(page)
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "45")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "75")
})

test("walking pace and buffer settings recalculate reserved sections without changing planned duration", async ({
  page,
}) => {
  await scheduleStudy(page)
  await nav(page, "Settings").click()
  await page.getByRole("button", { name: "15 min", exact: true }).click()
  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  await nav(page, "Plan").click()
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "45")
  await expect(plannedGap(page)).toHaveAttribute("data-walking", "6")
  await expect(plannedGap(page)).toHaveAttribute("data-buffer", "15")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "69")
  await expect(plannedGap(page).locator(".segment-buffer")).toHaveAttribute(
    "data-duration",
    "15",
  )
  await undo(page)
  await expect(plannedGap(page)).toHaveAttribute("data-available", "70")
  await undo(page)
  await expect(plannedGap(page)).toHaveAttribute("data-available", "75")
})

test("commitment timing edits resize the gap and keep conflicting plans visible for review", async ({
  page,
}) => {
  await scheduleStudy(page)
  const edit = async (start: string) => {
    await page
      .getByRole("button", { name: "Edit Lab section", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByLabel("Start time", { exact: true })
      .fill(start)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
  }
  await edit("14:00")
  await expect(plannedGap(page)).toHaveAttribute("data-end", "840")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "45")
  await edit("12:45")
  await expect(plannedGap(page)).toHaveAttribute("data-end", "765")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "0")
  await expect(plannedGap(page)).toHaveClass(/needs-review/)
  await expect(page.locator(".recovery-card")).toContainText(
    "Study for linear algebra no longer fits",
  )
  await expect(plannedGap(page).locator(".segment-walking")).toHaveAttribute(
    "data-duration",
    "5",
  )
  await expect(plannedGap(page).locator(".segment-buffer")).toHaveAttribute(
    "data-duration",
    "10",
  )
  expect(
    Object.values((await readState(page)).assign).map((a: any) => a.ids),
  ).toEqual([["study"]])
  await undo(page)
  await expect(plannedGap(page)).not.toHaveClass(/needs-review/)
  await expect(plannedGap(page)).toHaveAttribute("data-available", "45")
})

test("multiple activities remain separate and detail/map previews use the complete remaining route", async ({
  page,
}) => {
  await scheduleStudy(page)
  await addRemaining(page, "Email my advisor")
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "53")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "67")
  await plannedGap(page).locator(".segment-available").last().click()
  await remainingCard(page, "Grab a coffee")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("52 min")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Expand map", exact: true })
    .click()
  await expect(page.locator(".map-route-strip")).toContainText("10 min")
  await expect(page.locator(".map-route-strip")).toContainText("+5 min")
  await page
    .getByRole("button", { name: "Return to activity", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("52 min")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "63")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "52")
  await expect(plannedGap(page)).toHaveAttribute("data-walking", "10")
  const intervals = await plannedGap(page)
    .locator(".segment-activity")
    .evaluateAll((els) =>
      els.map((el) => ({
        id: (el as HTMLElement).dataset.activityId,
        start: Number((el as HTMLElement).dataset.start),
        end: Number((el as HTMLElement).dataset.end),
      })),
    )
  expect(intervals.map((p) => p.id)).toEqual(["study", "email", "coffee"])
  for (let i = 1; i < intervals.length; i++)
    expect(intervals[i].start).toBeGreaterThanOrEqual(intervals[i - 1].end)
  expect(
    Object.values((await readState(page)).assign).map((a: any) => a.ids),
  ).toEqual([["study", "email", "coffee"]])
})

test("removing one activity preserves later departures and its available portion can be planned again", async ({
  page,
}) => {
  await scheduleStudy(page)
  await addRemaining(page, "Email my advisor")
  await addRemaining(page, "Grab a coffee")
  const coffeeStart = await plannedGap(page)
    .locator('.segment-activity[data-activity-id="coffee"]')
    .getAttribute("data-start")
  await page
    .getByRole("button", {
      name: "Remove Email my advisor from this gap",
      exact: true,
    })
    .click()
  await expect(
    plannedGap(page).locator('.segment-activity[data-activity-id="coffee"]'),
  ).toHaveAttribute("data-start", coffeeStart!)
  await expect(plannedGap(page)).toHaveAttribute("data-available", "60")
  await expect(plannedGap(page).locator(".segment-available")).toHaveCount(2)
  await plannedGap(page).locator(".segment-available").first().click()
  await expect(page.locator(".plan-window-select select")).toHaveValue("780")
  await expect(remainingCard(page, "Email my advisor")).toContainText(
    "0 minutes remain",
  )
  await remainingCard(page, "Email my advisor")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-available", "52")
  await expect(
    plannedGap(page).locator('.segment-activity[data-activity-id="coffee"]'),
  ).toHaveAttribute("data-start", coffeeStart!)
})

test("keeping remaining time open persists independently of scheduled activities and supports Undo", async ({
  page,
}) => {
  await scheduleStudy(page)
  await page
    .getByRole("button", { name: "Keep remaining time open", exact: true })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-available", "75")
  await expect(plannedGap(page).locator(".segment-available")).toHaveClass(
    /is-kept-open/,
  )
  expect(Object.values((await readState(page)).assign)[0]).toMatchObject({
    ids: ["study"],
    remainingChoice: "open",
  })
  await page.reload()
  await nav(page, "Plan").click()
  await page.getByRole("button", { name: /Tomorrow 15/ }).click()
  await plannedGap(page).locator(".segment-available").click()
  await expect(page.locator(".plan-remaining-time")).toContainText(
    "75 min kept open",
  )
  await expect(
    page.locator(".plan-remaining-time .recommendation-card"),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Change remaining-time choice", exact: true })
    .click()
  await expect(remainingCard(page, "Email my advisor")).toBeVisible()
  await undo(page)
  await expect(plannedGap(page).locator(".segment-available")).toHaveClass(
    /is-kept-open/,
  )
  expect(Object.values((await readState(page)).assign)[0]).toMatchObject({
    ids: ["study"],
    remainingChoice: "open",
  })
})

test("adding from a remaining-time map preview returns to Plan with the original activity intact", async ({
  page,
}) => {
  await scheduleStudy(page)
  await plannedGap(page).locator(".segment-available").click()
  await remainingCard(page, "Grab a coffee")
    .getByRole("button", {
      name: "View on map",
      exact: true,
    })
    .click()
  await expect(page.locator(".map-selected-activity")).toContainText(
    "Grab a coffee",
  )
  await expect(page.locator(".map-route-strip")).toContainText("+5 min")
  await page
    .locator(".map-selected-activity")
    .getByRole("button", {
      name: "Add to gap",
      exact: true,
    })
    .click()
  await expect(nav(page, "Plan")).toHaveAttribute("aria-current", "page")
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "55")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "60")
  expect(
    Object.values((await readState(page)).assign).map((a: any) => a.ids),
  ).toEqual([["study", "coffee"]])
})

test("opening waits stay separate from actual setup and activity time", async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("gw")!)
    const study = s.acts.find((a: any) => a.id === "study")
    Object.assign(study, {
      preferred: [780, 850],
      required: true,
      flexibleLocation: false,
      locations: ["Gibson Hall"],
    })
    sessionStorage.setItem("gw", JSON.stringify(s))
  })
  await page.reload()
  await scheduleStudy(page)
  const gap = plannedGap(page)
  await expect(gap).toHaveAttribute("data-planned", "45")
  await expect(gap).toHaveAttribute("data-waiting", "40")
  await expect(gap).toHaveAttribute("data-available", "35")
  await expect(gap.locator('[data-phase="setup"]')).toHaveAttribute(
    "data-duration",
    "5",
  )
  await expect(gap.locator('[data-phase="setup"]')).toHaveAttribute(
    "data-start",
    "735",
  )
  await expect(gap.locator(".segment-waiting")).toHaveAttribute(
    "data-start",
    "740",
  )
  await expect(gap.locator(".segment-waiting")).toHaveAttribute(
    "data-end",
    "780",
  )
  await expect(gap.locator('[data-phase="activity"]')).toHaveAttribute(
    "data-start",
    "780",
  )
  await expect(gap.locator('[data-phase="activity"]')).toHaveAttribute(
    "data-duration",
    "40",
  )
  await expect(page.locator(".plan-time-balance")).toContainText(
    "40 min opening wait reserved",
  )
  await expect(page.locator(".plan-scheduled-label")).toContainText(
    "12:15 PM–12:20 PM setup",
  )
  await expect(page.locator(".plan-scheduled-label")).toContainText(
    "1:00 PM–1:40 PM activity",
  )
})

test("removing the first activity leaves the later start intact and reports all unplanned time", async ({
  page,
}) => {
  await scheduleStudy(page)
  await addRemaining(page, "Email my advisor")
  await page
    .getByRole("button", {
      name: "Remove Study for linear algebra from this gap",
      exact: true,
    })
    .click()
  await expect(plannedGap(page)).toHaveAttribute("data-planned", "8")
  await expect(plannedGap(page)).toHaveAttribute("data-available", "112")
  await expect(plannedGap(page).locator(".segment-available")).toHaveCount(2)
  await expect(
    plannedGap(page).locator('.segment-activity[data-activity-id="email"]'),
  ).toHaveAttribute("data-start", "780")
  await expect(page.locator(".assignment-card")).toContainText(
    "Scheduled at 1:00 PM",
  )
  await expect(page.locator(".assignment-card")).toContainText(
    "112 minutes are still available",
  )
})
