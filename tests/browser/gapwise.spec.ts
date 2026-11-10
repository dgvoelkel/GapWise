import { test, expect, type Page } from "@playwright/test"

const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
const card = (page: Page, title: string) =>
  page.getByRole("article", { name: title, exact: true })
const readState = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("gw")!))
const errors = new WeakMap<Page, string[]>()
async function showAll(page: Page) {
  const button = page.getByRole("button", { name: /^Show all \d+ activities$/ })
  if (await button.isVisible()) await button.click()
}
async function assignStudy(page: Page) {
  await showAll(page)
  await card(page, "Study for linear algebra")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
}
async function delayClass(page: Page) {
  await nav(page, "Plan").click()
  await page
    .getByRole("button", { name: "Edit Machine Learning", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByLabel("End time", { exact: true })
    .fill("11:20")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
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
    "No horizontal page overflow",
  ).toBe(true)
})

test("all five navigation sections work without academic commentary", async ({
  page,
}) => {
  await expect(
    page.getByRole("region", { name: "Available time" }),
  ).toHaveCount(1)
  await expect(page.locator(".time-summary")).toContainText("51")
  for (const [label, heading] of [
    ["Plan", "Plan"],
    ["Map", "Map"],
    ["Activities", "Things to make time for"],
    ["Settings", "Settings"],
    ["Right Now", "Right Now"],
  ]) {
    await nav(page, label).click()
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible()
    await expect(nav(page, label)).toHaveAttribute("aria-current", "page")
    expect(await page.locator("body").innerText()).not.toMatch(
      /low.fidelity prototype|this prototype|scenario [a-c1-3]|persona|research findings|design rationale|walkthrough|teaching staff|figure \d|interaction demonstration/i,
    )
  }
  await expect(page).toHaveTitle(/GapWise/)
})

test("immediate decision preserves activity through details, map, assignment, and undo", async ({
  page,
}) => {
  await card(page, "Print assignment")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  const detail = page.getByRole("dialog")
  await expect(detail).toContainText("35 min")
  await expect(detail).toContainText("Setup time")
  await expect(detail).toContainText("Walk to next commitment")
  await detail.getByRole("button", { name: "Expand map", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Map", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Preview Print assignment/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".map-route--detour")).toHaveCount(1)
  await expect(page.locator(".map-route--next")).toHaveCount(1)
  await expect(page.locator(".map-route-strip")).toContainText("+4 min")
  await page
    .getByRole("button", { name: "Return to activity", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("Print assignment")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator(".assignment-card")).toContainText(
    "Print assignment",
  )
  const saved = await readState(page)
  expect(Object.values(saved.assign).some((a: any) => a.id === "print")).toBe(
    true,
  )
  await nav(page, "Plan").click()
  await expect(page.locator(".calendar-gap.is-planned")).toContainText(
    "Print assignment",
  )
  await page
    .getByRole("button", { name: "Undo assignment", exact: true })
    .click()
  expect(Object.keys((await readState(page)).assign)).toHaveLength(0)
})

test("recommendation filters, dismissal, and restoration modify real results", async ({
  page,
}) => {
  await page.getByRole("button", { name: "High priority", exact: true }).click()
  await expect(page.locator(".recommendation-card")).toHaveCount(2)
  await expect(page.locator(".now-strip-pin")).toHaveCount(2)
  await page
    .getByRole("button", { name: "No extra detour", exact: true })
    .click()
  await expect(page.locator(".recommendation-card")).toHaveCount(1)
  await expect(page.locator(".now-strip-pin")).toHaveCount(1)
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "+0 min detour",
  )
  await expect(card(page, "Email my advisor")).toBeVisible()
  await card(page, "Email my advisor")
    .getByRole("button", { name: "Dismiss Email my advisor", exact: true })
    .click()
  await expect(page.locator(".recommendation-card")).toHaveCount(0)
  await expect(page.locator(".now-strip-pin")).toHaveCount(0)
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "Direct to next commitment",
  )
  expect(Object.values((await readState(page)).dismissed).flat()).toContain(
    "email",
  )
  await page
    .getByRole("button", { name: /Restore dismissed activities/ })
    .click()
  await expect(card(page, "Email my advisor")).toBeVisible()
  await expect(page.locator(".now-strip-pin")).toHaveCount(1)
  await page.getByRole("button", { name: "High priority", exact: true }).click()
  await page
    .getByRole("button", { name: "No extra detour", exact: true })
    .click()
  await page.getByRole("button", { name: "Short tasks", exact: true }).click()
  await expect(page.locator(".recommendation-card")).toHaveCount(3)
  await page.getByRole("button", { name: "Low energy", exact: true }).click()
  await page.getByRole("button", { name: "Nearby", exact: true }).click()
  expect(await page.locator(".recommendation-card").count()).toBeGreaterThan(0)
})

test("map markers, building locations, category filters, and route controls work", async ({
  page,
}) => {
  await nav(page, "Map").click()
  const map = page.getByRole("region", {
    name: "Interactive Tulane campus map",
    exact: true,
  })
  await expect(map).toBeVisible()
  await page.getByRole("button", { name: "Food & coffee", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Preview / })).toHaveCount(2)
  await page.getByRole("button", { name: /^Preview Grab a coffee/ }).click()
  await expect(page.locator(".map-selected-activity")).toContainText(
    "Grab a coffee",
  )
  await expect(page.locator(".map-selected-activity")).toContainText(
    "min to activity",
  )
  await expect(page.locator(".map-selected-activity")).toBeInViewport()
  const backToMap = page.getByRole("button", {
    name: "Back to map",
    exact: true,
  })
  if (await backToMap.isVisible()) {
    await backToMap.click()
    await expect(map).toBeInViewport()
  }
  await page.getByRole("button", { name: "Study", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Preview / })).toHaveCount(2)
  await page.getByRole("button", { name: "Everything", exact: true }).click()
  await page.getByRole("button", { name: "Explore LBC", exact: true }).click()
  await expect(page.locator(".map-location-results")).toContainText("Get lunch")
  await expect(page.locator(".map-location-results")).toContainText(
    "Grab a coffee",
  )
  await page
    .locator(".map-location-results")
    .getByRole("button", { name: "Grab a coffee · 10 min", exact: true })
    .click()
  await expect(page.locator(".map-selected-activity")).toContainText("LBC")
  const svg = map.locator("svg.campus-svg")
  const original = await svg.getAttribute("viewBox")
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(svg).not.toHaveAttribute("viewBox", original!)
  await page
    .getByRole("button", { name: "Recenter Tulane campus", exact: true })
    .click()
  await expect(svg).toHaveAttribute("viewBox", original!)
  await map.focus()
  await page.keyboard.press("ArrowRight")
  await expect(svg).not.toHaveAttribute("viewBox", original!)
  await page.keyboard.press("Home")
  await expect(svg).toHaveAttribute("viewBox", original!)
  await page.getByRole("button", { name: "Map layers", exact: true }).click()
  await page
    .getByRole("button", { name: "Walking routes", exact: true })
    .click()
  await expect(page.locator(".map-route")).toHaveCount(0)
  await page
    .getByRole("button", { name: "Walking routes", exact: true })
    .click()
  await expect(page.locator(".map-route")).toHaveCount(2)
})

test("a map activity and future gap lead to the same calendar context", async ({
  page,
}) => {
  await nav(page, "Map").click()
  const futureValue = await page
    .getByLabel("Map gap", { exact: true })
    .locator("option")
    .filter({ hasText: "Tomorrow" })
    .first()
    .getAttribute("value")
  await page.getByLabel("Map gap", { exact: true }).selectOption(futureValue!)
  await page
    .getByRole("button", { name: /^Preview Study for linear algebra/ })
    .click()
  await page
    .locator(".map-context-bar")
    .getByRole("button", { name: "Plan this gap", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Plan", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Tomorrow 15/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".calendar-gap.is-selected")).toContainText(
    "89 min usable",
  )
  await expect(card(page, "Study for linear algebra")).toHaveClass(
    /is-selected/,
  )
})

test("kept-open time and skip decisions persist across views and reload", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Keep this gap open", exact: true })
    .click()
  await expect(page.locator(".assignment-card")).toContainText(
    "This time is yours.",
  )
  await expect(page.locator(".recommendation-card")).toHaveCount(0)
  await expect(page.locator(".now-strip-pin")).toHaveCount(0)
  await nav(page, "Plan").click()
  await expect(page.locator(".calendar-gap.is-open")).toContainText("Kept open")
  await page.reload()
  await expect(page.locator(".assignment-card")).toContainText(
    "This time is yours.",
  )
  await expect(page.locator(".now-strip-pin")).toHaveCount(0)
  await page.getByRole("button", { name: "Change choice", exact: true }).click()
  await page.getByRole("button", { name: "Skip for now", exact: true }).click()
  expect(Object.values((await readState(page)).assign)).toContainEqual({
    kind: "skip",
  })
  await page.getByRole("button", { name: "Change choice", exact: true }).click()
  await page.getByRole("button", { name: "Rest nearby", exact: true }).click()
  expect(
    Object.values((await readState(page)).assign).some(
      (a: any) => a.id === "rest",
    ),
  ).toBe(true)
})

test("future calendar gaps can be assigned without filling other gaps", async ({
  page,
}) => {
  await nav(page, "Plan").click()
  await page.getByRole("button", { name: /Tomorrow 15/ }).click()
  await page.getByRole("button", { name: /^Select 12:15 PM gap/ }).click()
  await showAll(page)
  await card(page, "Study for linear algebra")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  const saved = await readState(page)
  expect(Object.keys(saved.assign)).toHaveLength(1)
  expect(Object.keys(saved.assign)[0]).toMatch(/^1-/)
  await expect(page.locator(".calendar-gap.is-planned")).toContainText(
    "Study for linear algebra",
  )
  await nav(page, "Activities").click()
  await expect(card(page, "Study for linear algebra")).toContainText("Planned")
  await nav(page, "Plan").click()
  await expect(page.locator(".assignment-card")).toContainText(
    "Study for linear algebra",
  )
})

test("adding, editing, completing, deleting, and undoing an activity update state", async ({
  page,
}) => {
  await nav(page, "Activities").click()
  await page.getByRole("button", { name: "Add activity", exact: true }).click()
  const form = page.getByRole("dialog")
  await form
    .getByLabel("Activity name", { exact: true })
    .fill("Pick up a package")
  await form.getByLabel("Duration (minutes)", { exact: true }).fill("12")
  await form.getByLabel("Setup time (minutes)", { exact: true }).fill("3")
  await form.getByLabel("Priority", { exact: true }).selectOption("must")
  await form.getByLabel("Campus location", { exact: true }).selectOption("LBC")
  await form.getByLabel("Location is flexible", { exact: true }).uncheck()
  await form.getByLabel("Add a deadline", { exact: true }).check()
  await form.getByLabel("Deadline time", { exact: true }).fill("15:00")
  await form.getByLabel("Set a preferred time window", { exact: true }).check()
  await form.getByLabel("Preferred start", { exact: true }).fill("10:00")
  await form.getByLabel("Preferred end", { exact: true }).fill("14:00")
  await form.getByRole("button", { name: "Save activity", exact: true }).click()
  await expect(card(page, "Pick up a package")).toBeVisible()
  let a = (await readState(page)).acts.find(
    (a: any) => a.title === "Pick up a package",
  )
  expect(a).toMatchObject({
    duration: 12,
    setup: 3,
    priority: "must",
    locations: ["LBC"],
    flexibleLocation: false,
    deadline: 900,
    preferred: [600, 840],
  })
  await nav(page, "Right Now").click()
  await showAll(page)
  await expect(card(page, "Pick up a package")).toBeVisible()
  await nav(page, "Activities").click()
  await card(page, "Pick up a package")
    .getByRole("button", { name: "Edit", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByLabel("Duration (minutes)", { exact: true })
    .fill("120")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  a = (await readState(page)).acts.find(
    (a: any) => a.title === "Pick up a package",
  )
  expect(a.duration).toBe(120)
  await card(page, "Pick up a package")
    .getByRole("button", { name: "Complete Pick up a package", exact: true })
    .click()
  await expect(card(page, "Pick up a package")).toHaveCount(0)
  await page.getByRole("button", { name: "Completed", exact: true }).click()
  await expect(card(page, "Pick up a package")).toContainText("Completed")
  await card(page, "Pick up a package")
    .getByRole("button", { name: "Pick up a package", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete activity", exact: true })
    .click()
  expect(
    (await readState(page)).acts.some(
      (a: any) => a.title === "Pick up a package",
    ),
  ).toBe(false)
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
  expect(
    (await readState(page)).acts.some(
      (a: any) => a.title === "Pick up a package" && a.done,
    ),
  ).toBe(true)
})

test("activity forms reject invalid windows without creating an activity", async ({
  page,
}) => {
  await nav(page, "Activities").click()
  await page.getByRole("button", { name: "Add activity", exact: true }).click()
  const form = page.getByRole("dialog")
  await form.getByLabel("Activity name", { exact: true }).fill("Window test")
  await form.getByLabel("Set a preferred time window", { exact: true }).check()
  await form.getByLabel("Preferred start", { exact: true }).fill("13:00")
  await form.getByLabel("Preferred end", { exact: true }).fill("12:00")
  await form.getByRole("button", { name: "Save activity", exact: true }).click()
  await expect(form.getByRole("alert")).toContainText("end after it starts")
  expect(
    (await readState(page)).acts.some((a: any) => a.title === "Window test"),
  ).toBe(false)
})

test("a delayed commitment recalculates time, retains the plan, and supports undo", async ({
  page,
}) => {
  await assignStudy(page)
  await delayClass(page)
  await expect(page.locator(".product-notice")).toContainText(
    "51 to 21 minutes",
  )
  await expect(page.locator(".recovery-card")).toContainText(
    "Study for linear algebra no longer fits",
  )
  await expect(page.locator(".recovery-card")).toContainText("24 more minutes")
  expect(
    Object.values((await readState(page)).assign).some(
      (a: any) => a.id === "study",
    ),
  ).toBe(true)
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
  await expect(page.locator(".recovery-card")).toHaveCount(0)
  expect((await readState(page)).cs.find((c: any) => c.id === "c2").end).toBe(
    650,
  )
  expect(
    Object.values((await readState(page)).assign).some(
      (a: any) => a.id === "study",
    ),
  ).toBe(true)
})

test("an infeasible assignment can be moved to another suitable gap", async ({
  page,
}) => {
  await assignStudy(page)
  const oldKey = Object.keys((await readState(page)).assign)[0]
  await delayClass(page)
  await page
    .locator(".recovery-card")
    .getByRole("button", { name: "Find another time", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText(
    "Find time for Study for linear algebra",
  )
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move here", exact: true })
    .first()
    .click()
  const after = await readState(page)
  expect(after.assign[oldKey]).toBeUndefined()
  expect(Object.values(after.assign).some((a: any) => a.id === "study")).toBe(
    true,
  )
  await expect(page.locator(".recovery-card")).toHaveCount(0)
  await expect(page.locator(".assignment-card")).toContainText(
    "Study for linear algebra",
  )
})

test("incompatible activities explain the constraint, block assignment, and offer a future gap", async ({
  page,
}) => {
  await page.getByText("Doesn’t fit this gap", { exact: false }).click()
  const rejected = page
    .locator(".incompatible-card")
    .filter({ hasText: "Work out at Reily" })
  await expect(rejected).toContainText("Doesn't fit")
  await rejected
    .getByRole("button", { name: "View details", exact: true })
    .click()
  const dialog = page.getByRole("dialog")
  await expect(
    dialog.getByRole("button", { name: "Add to gap", exact: true }),
  ).toBeDisabled()
  await expect(dialog).toContainText("Only available")
  await dialog
    .getByRole("button", { name: "Find another time", exact: true })
    .click()
  await expect(page.getByRole("dialog").locator(".found-gap")).not.toHaveCount(
    0,
  )
  expect(Object.keys((await readState(page)).assign)).toHaveLength(0)
})

test("arrival buffer, pace, accessibility, energy, and planning style affect saved calculations", async ({
  page,
}) => {
  await nav(page, "Settings").click()
  await page.getByRole("button", { name: "15 min", exact: true }).click()
  await expect(page.locator(".settings-preview")).toContainText("46 min usable")
  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  await expect(page.locator(".settings-preview")).toContainText("43 min usable")
  await page.getByLabel("Prefer accessible routes", { exact: false }).check()
  await page
    .getByLabel("Avoid unnecessarily long walks", { exact: false })
    .check()
  await page
    .getByLabel("Preferred energy level", { exact: true })
    .selectOption("low")
  await page.getByRole("button", { name: "Plan ahead", exact: true }).click()
  const s = await readState(page)
  expect(s.prefs).toMatchObject({
    buffer: 15,
    pace: "relaxed",
    accessible: true,
    avoidLong: true,
    energy: "low",
    style: "ahead",
  })
  await nav(page, "Right Now").click()
  await expect(page.locator(".time-summary")).not.toContainText("51 min usable")
  await expect(page.locator(".plan-next-card")).toBeVisible()
})

test("commitments validate overlap, support recurrence, cancel, and restore", async ({
  page,
}) => {
  await nav(page, "Plan").click()
  await page
    .getByRole("button", { name: "Add commitment", exact: true })
    .first()
    .click()
  let form = page.getByRole("dialog")
  await form.getByLabel("Title", { exact: true }).fill("Advisor check-in")
  await form.getByLabel("Start time", { exact: true }).fill("10:20")
  await form.getByLabel("End time", { exact: true }).fill("10:40")
  await form
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click()
  await expect(form.getByRole("alert")).toContainText(
    "overlaps Machine Learning",
  )
  await form.getByLabel("Start time", { exact: true }).fill("14:00")
  await form.getByLabel("End time", { exact: true }).fill("14:30")
  await form.getByRole("button", { name: "M", exact: true }).click()
  await form
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(
    (await readState(page)).cs.filter(
      (c: any) => c.title === "Advisor check-in",
    ),
  ).toHaveLength(2)
  await page
    .getByRole("button", { name: "Edit Advisor check-in", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel commitment", exact: true })
    .click()
  expect(
    (await readState(page)).cs.find(
      (c: any) => c.title === "Advisor check-in" && c.day === 0,
    ).canceled,
  ).toBe(true)
  await page
    .getByRole("button", { name: "Edit Advisor check-in", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore commitment", exact: true })
    .click()
  expect(
    (await readState(page)).cs.find(
      (c: any) => c.title === "Advisor check-in" && c.day === 0,
    ).canceled,
  ).toBe(false)
})

test("activity combinations create two-member assignments and complete both", async ({
  page,
}) => {
  await page.getByText("Combine two short activities", { exact: true }).click()
  await page
    .getByRole("button", { name: "Add both to gap", exact: true })
    .first()
    .click()
  const assignment: any = Object.values((await readState(page)).assign)[0]
  expect(assignment.ids).toHaveLength(2)
  await expect(page.locator(".now-strip-pin")).toHaveCount(2)
  await expect(page.locator(".now-strip-route")).toHaveCount(3)
  await expect(page.locator(".now-strip-heading")).toContainText(
    "Your planned route",
  )
  await page
    .getByRole("button", { name: "Mark both completed", exact: true })
    .click()
  const s = await readState(page)
  expect(
    assignment.ids.every(
      (id: string) => s.acts.find((a: any) => a.id === id).done,
    ),
  ).toBe(true)
  await expect(page.locator(".assignment-card")).toContainText("Completed")
  await expect(page.locator(".now-strip-pin")).toHaveCount(0)
})

test("planning clock recalculates remaining time rather than changing a label only", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Planning clock,/ }).click()
  await page
    .getByRole("dialog")
    .getByLabel("Time used for Right Now", { exact: true })
    .fill("11:10")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click()
  expect((await readState(page)).now).toBe(670)
  await expect(page.locator(".time-summary")).toContainText("31 min usable")
  await expect(page.locator(".time-summary")).toContainText("50 min gap")
})

test("dialogs support keyboard focus containment and Escape without losing the plan", async ({
  page,
}) => {
  await card(page, "Print assignment")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  const activeInside = await dialog.evaluate((el) =>
    el.contains(document.activeElement),
  )
  expect(activeInside).toBe(true)
  await page.keyboard.press("Tab")
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(Object.keys((await readState(page)).assign)).toHaveLength(0)
})

test("state survives reload and completed activities are no longer recommended", async ({
  page,
}) => {
  await card(page, "Print assignment")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click()
  await page.reload()
  await expect(page.locator(".assignment-card")).toContainText("Completed")
  await page
    .getByRole("button", { name: "Undo assignment", exact: true })
    .click()
  await showAll(page)
  await expect(card(page, "Print assignment")).toHaveCount(0)
  expect(
    (await readState(page)).acts.find((a: any) => a.id === "print").done,
  ).toBe(true)
})

test("Right Now list and map strip preserve the same selected activity", async ({
  page,
}) => {
  await showAll(page)
  await card(page, "Grab a coffee")
    .getByRole("button", { name: "Grab a coffee", exact: true })
    .click()
  const pin = page.getByRole("button", {
    name: /^Suggestion \d+: Grab a coffee,/,
  })
  await expect(pin).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "Grab a coffee",
  )
  await expect(card(page, "Grab a coffee")).toHaveClass(/is-selected/)
  await page.getByRole("button", { name: "Open full map", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /^Preview Grab a coffee/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await page
    .getByRole("button", { name: "Return to Right Now", exact: true })
    .click()
  await expect(card(page, "Grab a coffee")).toHaveClass(/is-selected/)
})

test("an explicitly selected map location is used in the actual assignment", async ({
  page,
}) => {
  await nav(page, "Map").click()
  await page
    .getByRole("button", { name: "Explore PJ's Coffee", exact: true })
    .click()
  await page
    .locator(".map-location-results")
    .getByRole("button", { name: "Grab a coffee · 10 min", exact: true })
    .click()
  await expect(page.locator(".map-selected-activity")).toContainText(
    "PJ's Coffee",
  )
  await nav(page, "Right Now").click()
  await showAll(page)
  await expect(card(page, "Grab a coffee")).toContainText("PJ's Coffee")
  await card(page, "Grab a coffee")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  const assignment: any = Object.values((await readState(page)).assign)[0]
  expect(assignment.locations.coffee).toBe("PJ's Coffee")
  await nav(page, "Plan").click()
  await page
    .locator(".assignment-card")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  await expect(
    page.getByRole("dialog").locator(".route-summary"),
  ).toContainText("PJ's Coffee")
  await expect(page.getByRole("dialog")).toContainText("38 min")
})

test("editing an assigned activity re-evaluates it and undo restores the valid plan", async ({
  page,
}) => {
  await assignStudy(page)
  await nav(page, "Activities").click()
  await card(page, "Study for linear algebra")
    .getByRole("button", { name: "Edit", exact: true })
    .click()
  const form = page.getByRole("dialog")
  await form.getByLabel("Duration (minutes)", { exact: true }).fill("80")
  await form.getByLabel("Priority", { exact: true }).selectOption("must")
  await form
    .getByLabel("Campus location", { exact: true })
    .selectOption("Reily Rec Center")
  await form.getByLabel("Location is flexible", { exact: true }).uncheck()
  await form.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.locator(".recovery-card")).toContainText(
    "Study for linear algebra no longer fits",
  )
  expect(
    (await readState(page)).acts.find((a: any) => a.id === "study"),
  ).toMatchObject({
    duration: 80,
    priority: "must",
    locations: ["Reily Rec Center"],
    flexibleLocation: false,
  })
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
  await expect(page.locator(".recovery-card")).toHaveCount(0)
  expect(
    (await readState(page)).acts.find((a: any) => a.id === "study").duration,
  ).toBe(40)
})

test("schedule recovery can keep time open or choose a shorter activity", async ({
  page,
}) => {
  await assignStudy(page)
  await delayClass(page)
  await page
    .locator(".recovery-card")
    .getByRole("button", { name: "Keep gap open", exact: true })
    .click()
  await expect(page.locator(".recovery-card")).toHaveCount(0)
  expect(Object.values((await readState(page)).assign)).toContainEqual({
    kind: "open",
  })
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
  await page
    .locator(".recovery-card")
    .getByRole("button", { name: "Choose a shorter activity", exact: true })
    .click()
  expect(Object.keys((await readState(page)).assign)).toHaveLength(0)
  await card(page, "Email my advisor")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  expect(
    Object.values((await readState(page)).assign).some(
      (a: any) => a.id === "email",
    ),
  ).toBe(true)
  await expect(page.locator(".recovery-card")).toHaveCount(0)
})

test("initial setup saves real preferences and narrower layouts do not overflow", async ({
  page,
}) => {
  await nav(page, "Settings").click()
  await page
    .getByRole("button", { name: "Update initial setup", exact: true })
    .click()
  const form = page.getByRole("dialog")
  await form.getByRole("button", { name: "5 min", exact: true }).click()
  await form.getByLabel("Walking pace", { exact: true }).selectOption("brisk")
  await form.getByLabel("Planning style", { exact: true }).selectOption("ahead")
  await form
    .getByRole("button", { name: "Save preferences", exact: true })
    .click()
  expect((await readState(page)).prefs).toMatchObject({
    buffer: 5,
    pace: "brisk",
    style: "ahead",
  })
  await expect(page.locator(".settings-preview")).toContainText("57 min usable")
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const label of [
      "Right Now",
      "Plan",
      "Map",
      "Activities",
      "Settings",
    ]) {
      await nav(page, label).click()
      if (label === "Right Now" && width === 320)
        await expect(page.locator(".now-card .next-event")).toHaveCSS(
          "display",
          "grid",
        )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    }
  }
})

test("an empty local schedule still offers a working map, activity details, and reset", async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("gw")!)
    s.cs = []
    sessionStorage.setItem("gw", JSON.stringify(s))
  })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Your day is open.", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Open full map", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Map", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Explore Howard-Tilton Library", exact: true })
    .click()
  await page
    .locator(".map-location-results")
    .getByRole("button", { name: "Print assignment · 10 min", exact: true })
    .click()
  await page
    .locator(".map-selected-activity")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("Print assignment")
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Add to gap", exact: true }),
  ).toBeDisabled()
  await page.keyboard.press("Escape")
  await nav(page, "Settings").click()
  await page
    .getByRole("button", { name: "Reset local schedule", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset schedule", exact: true })
    .click()
  await expect(page.locator(".time-summary")).toContainText("51 min usable")
  expect((await readState(page)).cs.length).toBeGreaterThan(0)
})

test("home is a list-first Now card with a small map and matching numbered suggestions", async ({
  page,
}) => {
  await expect(nav(page, "Right Now")).toHaveAttribute("aria-current", "page")
  const home = page.getByRole("region", {
    name: "Your next decision",
    exact: true,
  })
  const strip = home.getByRole("region", {
    name: "Suggestions along your route",
    exact: true,
  })
  await expect(
    home.getByRole("region", { name: "Available time" }),
  ).toBeVisible()
  await expect(strip).toBeVisible()
  await expect(
    page.getByLabel("Recommendation view", { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("region", {
      name: "Interactive Tulane campus map",
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    strip.getByRole("img", { name: "Your location: Gibson Hall" }),
  ).toBeVisible()
  await expect(
    strip.getByRole("img", { name: "Next commitment: Newcomb Hall" }),
  ).toBeVisible()
  const suggestions = home.locator(".recommendation-card")
  await expect(suggestions).toHaveCount(3)
  await expect(strip.locator(".now-strip-pin")).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    const title = await suggestions.nth(i).getAttribute("aria-label")
    const number = suggestions.nth(i).locator(".recommendation-number")
    await expect(number).toHaveText(String(i + 1))
    const pin = strip.getByRole("button", {
      name: new RegExp(`^Suggestion ${i + 1}: ${title},`),
    })
    await expect(pin).toHaveText(String(i + 1))
    const bounds = await pin.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
  }
  const mapSize = await page.locator(".now-strip-canvas").boundingBox()
  expect(mapSize!.height).toBeLessThanOrEqual(180)
  const fontSizes = await home.evaluate((el) => ({
    time: parseFloat(
      getComputedStyle(el.querySelector(".time-summary h2 strong")!).fontSize,
    ),
    pin: parseFloat(
      getComputedStyle(el.querySelector(".now-strip-pin")!).fontSize,
    ),
  }))
  expect(fontSizes.time).toBeGreaterThan(fontSizes.pin * 3)
  const positions = await strip
    .locator(".now-strip-marker")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }),
    )
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i],
        b = positions[j]
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
        "Map markers have separate touch targets",
      ).toBe(true)
    }
  }
})

test("map-strip pins compare real detours and keep list, details, and full map connected", async ({
  page,
}) => {
  const strip = page.locator(".now-map-strip")
  await strip
    .getByRole("button", { name: /^Suggestion 2: Email my advisor,/ })
    .click()
  await expect(card(page, "Email my advisor")).toHaveClass(/is-selected/)
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "+0 min detour",
  )
  await card(page, "Print assignment")
    .getByRole("button", { name: "Print assignment", exact: true })
    .click()
  await expect(
    strip.getByRole("button", {
      name: /^Suggestion 1: Print assignment,/,
    }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "13 min total walk",
  )
  await expect(page.locator(".now-strip-comparison")).toContainText(
    "+4 min detour",
  )
  await expect(page.locator(".time-summary")).toContainText("51 min usable")
  await card(page, "Print assignment")
    .getByRole("button", { name: "View details", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText("35 min")
  await page.keyboard.press("Escape")
  await strip
    .getByRole("button", { name: "Open full map", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: /^Preview Print assignment/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".map-route-strip")).toContainText("+4 min")
  await page
    .getByRole("button", { name: "Return to Right Now", exact: true })
    .click()
  await expect(card(page, "Print assignment")).toHaveClass(/is-selected/)
})

test("the Plan calendar is an hourly full-day grid with time-aligned commitments and gaps", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Plan your day", exact: true }).click()
  await expect(nav(page, "Plan")).toHaveAttribute("aria-current", "page")
  const grid = page.locator(".calendar-day-grid")
  await expect(grid).toHaveAttribute("data-start", "480")
  await expect(grid).toHaveAttribute("data-end", "1200")
  await expect(grid.locator(".day-grid-hour")).toHaveCount(13)
  await expect(grid.locator(".calendar-event")).toHaveCount(4)
  await expect(grid.locator(".calendar-gap")).toHaveCount(3)
  const topology = await grid
    .getByRole("button", { name: "Edit Topology", exact: true })
    .evaluate((el) => ({
      top: (el as HTMLElement).offsetTop,
      height: el.getBoundingClientRect().height,
    }))
  const ml = await grid
    .getByRole("button", { name: "Edit Machine Learning", exact: true })
    .evaluate((el) => ({
      top: (el as HTMLElement).offsetTop,
      height: el.getBoundingClientRect().height,
    }))
  expect(ml.top - topology.top).toBe(56)
  expect(ml.height).toBe(topology.height)
  const gap = grid.getByRole("button", { name: /^Select 10:50 AM gap/ })
  await expect(gap).toHaveAttribute("data-start", "650")
  await expect(gap).toHaveAttribute("data-end", "720")
  await expect(gap).toContainText("51 min usable")
  await expect(gap).toHaveAttribute("aria-pressed", "true")
  const gapLabelFits = await gap.evaluate((el) => {
    const label = el.querySelector(".calendar-gap-content > small")!
    return (
      label.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom
    )
  })
  expect(gapLabelFits, "The time range fits inside its calendar gap").toBe(true)
  const short = grid.getByRole("button", { name: /^Select 9:50 AM gap/ })
  expect((await short.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(grid.locator(".calendar-now-line")).toHaveAttribute(
    "aria-label",
    "Now, 10:50 AM",
  )
})

test("Plan keeps the selected gap connected to its activities and offers a mobile return to the day", async ({
  page,
}) => {
  await nav(page, "Plan").click()
  await page.getByRole("button", { name: /^Select 1:15 PM gap/ }).click()
  await expect(page.locator(".calendar-gap.is-selected")).toHaveAttribute(
    "data-start",
    "795",
  )
  await expect(
    page.getByRole("region", { name: "Selected gap", exact: true }),
  ).toContainText("After Research meeting")
  await expect(page.locator(".planning-gap-panel")).toContainText(
    "1:15 PM–4:00 PM",
  )
  const back = page.getByRole("button", { name: "Back to day", exact: true })
  if (page.viewportSize()!.width < 850) {
    await expect(page.locator(".planning-gap-panel")).toBeInViewport()
    await back.click()
    await expect(
      page.getByRole("region", { name: "Today calendar", exact: true }),
    ).toBeInViewport()
  } else {
    await expect(back).toBeHidden()
  }
})

test("the day grid includes early and late commitments instead of cutting them off", async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("gw")!)
    s.cs.push(
      {
        ...s.cs[0],
        id: "early",
        title: "Early study group",
        start: 420,
        end: 450,
      },
      { ...s.cs[0], id: "late", title: "Evening club", start: 1260, end: 1350 },
    )
    sessionStorage.setItem("gw", JSON.stringify(s))
  })
  await page.reload()
  await nav(page, "Plan").click()
  const grid = page.locator(".calendar-day-grid")
  await expect(grid).toHaveAttribute("data-start", "420")
  await expect(grid).toHaveAttribute("data-end", "1380")
  await expect(
    grid.getByRole("button", { name: "Edit Early study group", exact: true }),
  ).toBeVisible()
  await expect(
    grid.getByRole("button", { name: "Edit Evening club", exact: true }),
  ).toBeVisible()
  await expect(grid.locator(".day-grid-hour").last()).toContainText("11 PM")
})

test("exploring a later map gap continues in Plan without replacing the Right Now home gap", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open full map", exact: true }).click()
  const later = await page
    .getByLabel("Map gap", { exact: true })
    .locator("option")
    .filter({ hasText: "Today · 1:15 PM" })
    .getAttribute("value")
  await page.getByLabel("Map gap", { exact: true }).selectOption(later!)
  await page
    .getByRole("button", { name: "Continue in Plan", exact: true })
    .click()
  await expect(nav(page, "Plan")).toHaveAttribute("aria-current", "page")
  await expect(page.locator(".calendar-gap.is-selected")).toHaveAttribute(
    "data-start",
    "795",
  )
  await page.getByRole("button", { name: "GapWise home", exact: true }).click()
  await expect(nav(page, "Right Now")).toHaveAttribute("aria-current", "page")
  await expect(page.locator(".time-summary")).toContainText("51 min usable")
  await expect(page.locator(".next-event")).toContainText("Research meeting")
})

test("an upcoming gap is labeled as a future start instead of a live student location", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Planning clock,/ }).click()
  await page
    .getByRole("dialog")
    .getByLabel("Time used for Right Now", { exact: true })
    .fill("09:30")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click()
  await expect(page.locator(".page-heading")).toContainText(
    "You’re in Topology.",
  )
  await expect(page.locator(".now-map-strip").getByRole("img", {
      name: "Gap starts: Gibson Hall",
      exact: true,
    })).toBeVisible()
  await expect(page.locator(".next-event")).toContainText("30 min away")
})
