import { test, expect } from "@playwright/test"
import {
  assertClean,
  cancelCommitment,
  card,
  dialog,
  nav,
  notice,
  open,
  readState,
  showAll,
  track,
  undo,
  usable,
} from "./helpers"

// BUILD.md Phase 7: each persona's 4.2 scenario, clicked through on desktop and mobile.

test.beforeEach(async ({ page }) => track(page))
test.afterEach(async ({ page }) => assertClean(page))

test("first run shows the persona picker, keeps the buffer step, and lands on Right Now", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Explore GapWise as…" }),
  ).toBeVisible()
  await expect(page.getByRole("article")).toHaveCount(3)
  await page.getByRole("button", { name: "Explore as Stella" }).click()
  await expect(dialog(page)).toContainText("Your planning preferences")
  await expect(
    dialog(page).getByRole("button", { name: "5 min", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await dialog(page).getByRole("button", { name: "Save preferences" }).click()
  await expect(
    page.getByRole("heading", { name: "Right Now", exact: true }),
  ).toBeVisible()
  await expect(usable(page)).toContainText("48")
  const saved = await readState(page)
  expect(saved.persona).toBe("stella")
  expect(saved.onboarded).toBe(true)
})

test("an empty schedule still works through the manual forms", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start with an empty schedule" }).click()
  await dialog(page).getByRole("button", { name: "Save preferences" }).click()
  await expect(page.getByText("Your day is open.")).toBeVisible()
  await page.getByRole("button", { name: "Add commitment" }).first().click()
  await dialog(page).getByLabel("Title").fill("Seminar")
  await dialog(page).getByLabel("Start time", { exact: true }).fill("09:00")
  await dialog(page).getByLabel("End time", { exact: true }).fill("10:00")
  await dialog(page).getByRole("button", { name: "Add to calendar" }).click()
  await nav(page, "Settings").click()
  await expect(page.locator(".schedule-source")).toContainText("your own entries")
})

test("Ryan at 10:50 gets the quiet state: nothing to add, head to Dinwiddie Hall, no map strip", async ({
  page,
}) => {
  await open(page, "persona=ryan&t=10:50")
  await expect(usable(page)).toContainText("6")
  await expect(page.locator(".now-card")).toContainText("Head to Dinwiddie Hall.")
  await expect(page.locator(".now-card")).toContainText("0 activities fit")
  await expect(page.locator(".now-map-strip")).toHaveCount(0)
  await expect(page.locator(".now-card")).toContainText("You don’t have to fill every gap.")
})

test("Ryan: canceling the advisor meeting merges two gaps, reports the new length, offers rest, and keeps open", async ({
  page,
}) => {
  await open(page, "persona=ryan&t=10:50")
  await cancelCommitment(page, "Advisor meeting")
  await expect(notice(page)).toContainText("11:50 AM–2:00 PM gap is now 2 hr 10 min")
  await expect(notice(page)).toContainText("126 usable minutes")
  const merged = page.getByRole("button", { name: /^Select 11:50 AM gap, 126 usable minutes/ })
  await expect(merged).toBeVisible()
  await expect(page.getByRole("button", { name: /^Select 1:30 PM gap/ })).toHaveCount(0)
  await merged.click()
  await expect(page.getByRole("button", { name: "Rest in room", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Keep this gap open", exact: true }).click()
  await expect(page.locator(".assignment-card")).toContainText("Gap kept open")
  const saved = await readState(page)
  expect(Object.values(saved.assign)).toEqual([{ kind: "open" }])
  await undo(page)
  await expect(page.locator(".assignment-card")).toHaveCount(0)
})

test("Stella at 11:00: raising the Finance buffer to 10 lowers usable time by 5, makes lunch Tight, keeps print and coffee comfortable with no detour, and the workout fits later", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00")
  await expect(usable(page)).toContainText("48")
  await expect(page.locator(".now-map-strip")).toBeVisible()
  await nav(page, "Plan").click()
  await page
    .getByRole("button", { name: "Edit FINE 3010 · Financial Management", exact: true })
    .click()
  await dialog(page).getByLabel("Arrival buffer").selectOption("10")
  await dialog(page).getByRole("button", { name: "Save changes" }).click()
  await expect(notice(page)).toContainText("from 48 to 43 minutes before FINE 3010")
  await nav(page, "Right Now").click()
  await expect(usable(page)).toContainText("43")
  await showAll(page)
  await expect(card(page, "Print assignment")).toContainText("Comfortable")
  await expect(card(page, "Print assignment")).toContainText("Goldring/Woldenberg")
  await expect(card(page, "Print assignment")).toContainText("Little or no extra detour")
  await expect(card(page, "Coffee")).toContainText("Comfortable")
  await expect(card(page, "Coffee")).toContainText("Goldring/Woldenberg")
  await expect(card(page, "Coffee")).toContainText("Little or no extra detour")
  await expect(card(page, "Lunch").locator(".fit-badge")).toHaveText(/Tight/)
  await expect(page.locator(".disclosure", { hasText: "Combine two short" })).toContainText(
    "Print assignment + Coffee",
  )
  const noFit = page.locator(".disclosure", { hasText: "Doesn’t fit this gap" })
  await noFit.locator("summary").click()
  const workout = noFit.locator(".incompatible-card", { hasText: "Conditioning workout" })
  await expect(workout).toContainText("Doesn't fit")
  await workout.getByRole("button", { name: "Find another time" }).click()
  await expect(dialog(page)).toContainText("Find time for Conditioning workout")
  await expect(dialog(page).locator(".found-gap").first()).toContainText("Today · 12:50 PM")
})

test("Stella's why-it-fits sheet opens from a deep link with the time receipt", async ({ page }) => {
  await open(page, "persona=stella&t=11:00&sheet=why:lunch")
  await expect(dialog(page)).toContainText("Lunch")
  await expect(dialog(page).locator(".time-calculation")).toContainText("Walk to activity")
  await expect(dialog(page).locator(".time-calculation")).toContainText("Arrival buffer")
  await expect(dialog(page).locator(".route-preview")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
})

test("Chloe at 12:00: the workout doesn't fit, canceling the 1:00 class merges the gaps so it fits, keep open is one tap, and the talk is only offered on Wednesday", async ({
  page,
}) => {
  await open(page, "persona=chloe&t=12:00")
  await expect(usable(page)).toContainText("50")
  const noFit = page.locator(".disclosure", { hasText: "Doesn’t fit this gap" })
  await noFit.locator("summary").click()
  await expect(noFit.locator(".incompatible-card", { hasText: "Workout" })).toBeVisible()
  await cancelCommitment(page, "CMPS 6240 · Intro to Machine Learning")
  await expect(notice(page)).toContainText("11:50 AM–3:00 PM gap is now 3 hr 10 min")
  await nav(page, "Right Now").click()
  await expect(usable(page)).toContainText("170")
  await showAll(page)
  await expect(card(page, "Workout").locator(".fit-badge")).toHaveText(/Comfortable/)
  await page.getByRole("button", { name: "Keep this gap open", exact: true }).click()
  await expect(page.locator(".assignment-card")).toContainText("This time is yours.")
  // The talk's 4:15–5:15 window only fits Wednesday's 4:00–5:30 gap.
  await nav(page, "Activities").click()
  await card(page, "Data science talk").getByRole("button", { name: /Details/ }).click()
  const alternatives = dialog(page).locator(".alternative-gaps")
  await expect(alternatives.getByRole("button")).toHaveCount(1)
  await expect(alternatives).toContainText("Today · 4:00 PM–5:30 PM")
})

test("the Right Now strip pins and the option list select the same activity, and the strip opens the Map tab", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00")
  const strip = page.locator(".now-map-strip")
  await strip.getByRole("button", { name: /^Suggestion 2:/ }).click()
  await expect(strip.locator(".now-strip-comparison")).toContainText("Lunch")
  await expect(card(page, "Lunch")).toHaveClass(/is-selected/)
  await card(page, "Print assignment").getByRole("button", { name: /^Select suggestion 1/ }).click()
  await expect(strip.locator(".now-strip-comparison")).toContainText("Print assignment")
  await strip.getByRole("button", { name: "Open full map for this gap" }).click()
  await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible()
  await expect(page.locator(".map-option.is-selected")).toContainText("Print assignment")
  await expect(page.getByRole("button", { name: /^Option 1: Print assignment/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.getByRole("button", { name: /^Option 2: Lunch/ }).click()
  await expect(page.locator(".map-option.is-selected")).toContainText("Lunch")
  await expect(page.locator(".map-selected-activity")).toContainText("Lunch")
})

test("when map tiles are blocked the fallback message shows and the options list still works", async ({
  page,
}) => {
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort())
  await open(page, "persona=stella&t=11:00&tab=map")
  await expect(page.locator(".campus-map-fallback")).toContainText(
    "Map couldn’t load. Walking times still work.",
  )
  await expect(page.locator(".map-option")).toHaveCount(6)
  await page.locator(".map-option").nth(1).click()
  await expect(page.locator(".map-selected-activity")).toContainText("Lunch")
  await expect(page.locator(".map-route-strip")).toContainText("7 min direct")
  await nav(page, "Right Now").click()
  await expect(page.locator(".now-map-strip .campus-map-fallback")).toBeVisible()
  await expect(usable(page)).toContainText("48")
})

test("switching student from Settings asks before discarding changes and resets to the new persona", async ({
  page,
}) => {
  await open(page, "persona=ryan&t=10:50")
  await nav(page, "Settings").click()
  await expect(page.locator(".schedule-source")).toContainText("demo data for Routine Ryan")
  await page.getByRole("button", { name: "Switch student" }).click()
  await expect(dialog(page)).toContainText("Explore GapWise as…")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Brisk", exact: true }).click()
  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  await page.getByRole("button", { name: "Switch student" }).click()
  await expect(dialog(page)).toContainText("Switch student?")
  await dialog(page).getByRole("button", { name: "Choose a student" }).click()
  await dialog(page).getByRole("button", { name: "Explore as Chloe" }).click()
  await expect(notice(page)).toContainText("Now exploring as Commuter Chloe")
  await expect(usable(page)).toContainText("50")
  // A URL without ?persona= loads whatever this tab already holds.
  await page.goto("/")
  await expect(usable(page)).toContainText("50")
  expect((await readState(page)).persona).toBe("chloe")
})

test("the help sheet describes the current tab and lists the persona's tasks", async ({ page }) => {
  await open(page, "persona=chloe&t=12:00&tab=plan&day=0")
  await page.getByRole("button", { name: "Help for this tab" }).click()
  await expect(dialog(page)).toContainText("About Plan")
  await expect(dialog(page)).toContainText("Plan Thursday, or don't")
  await dialog(page).getByRole("button", { name: "Got it" }).click()
  await expect(dialog(page)).toHaveCount(0)
})
