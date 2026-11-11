import { test, expect } from "@playwright/test"
import {
  assertClean,
  card,
  dialog,
  nav,
  notice,
  open,
  readState,
  showAll,
  track,
  undo,
} from "./helpers"

test.beforeEach(async ({ page }) => track(page))
test.afterEach(async ({ page }) => assertClean(page))

test("adding an activity to the current gap, viewing details, undoing, and completing all update state", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00")
  await card(page, "Print assignment").getByRole("button", { name: "Add to gap", exact: true }).click()
  await expect(notice(page)).toContainText("Print assignment added to today’s 11:00 AM gap")
  await expect(page.locator(".assignment-card")).toContainText("Planned in this gap")
  await expect(page.locator(".now-map-strip")).toContainText("Your planned route")
  await page.locator(".assignment-card").getByRole("button", { name: "View details" }).click()
  await expect(dialog(page)).toContainText("Already planned in a gap")
  await page.keyboard.press("Escape")
  await page.locator(".assignment-card").getByRole("button", { name: "Mark completed" }).click()
  await expect(page.locator(".assignment-card")).toContainText("Completed")
  await nav(page, "Activities").click()
  await expect(card(page, "Print assignment")).toHaveCount(0)
  await page.getByRole("button", { name: "Completed", exact: true }).click()
  await expect(card(page, "Print assignment")).toContainText("Completed")
  await undo(page)
  await expect(card(page, "Print assignment")).toHaveCount(0)
})

test("creating, editing, and deleting an activity flows through the forms with validation", async ({
  page,
}) => {
  await open(page, "persona=ryan&t=10:50&tab=acts")
  await page.getByRole("button", { name: "Add activity" }).first().click()
  await dialog(page).getByLabel("Activity name").fill("Return library book")
  await dialog(page).getByLabel("Duration (minutes)").fill("10")
  await dialog(page).getByLabel("Campus location").selectOption("Howard-Tilton Library")
  await dialog(page).getByLabel("Location is flexible").uncheck()
  await dialog(page).getByLabel("Set a preferred time window").check()
  await dialog(page).getByLabel("Preferred start").fill("14:00")
  await dialog(page).getByLabel("Preferred end").fill("13:00")
  await dialog(page).getByRole("button", { name: "Save activity" }).click()
  await expect(dialog(page).getByRole("alert")).toContainText("must end after it starts")
  await dialog(page).getByLabel("Preferred end").fill("16:00")
  await dialog(page).getByRole("button", { name: "Save activity" }).click()
  await expect(card(page, "Return library book")).toContainText("Howard-Tilton Library")
  await card(page, "Return library book").getByRole("button", { name: "Edit" }).click()
  await dialog(page).getByLabel("Duration (minutes)").fill("15")
  await dialog(page).getByRole("button", { name: "Save changes" }).click()
  await expect(card(page, "Return library book")).toContainText("15 min")
  await card(page, "Return library book").getByRole("button", { name: /Details/ }).click()
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click()
  await dialog(page).getByRole("button", { name: "Delete activity" }).click()
  await expect(card(page, "Return library book")).toHaveCount(0)
  expect((await readState(page)).acts.some((a: any) => a.title === "Return library book")).toBe(false)
})

test("recommendation filters, dismissal, and restore change the real list", async ({ page }) => {
  await open(page, "persona=stella&t=11:00")
  await page.getByRole("button", { name: "Short tasks", exact: true }).click()
  await expect(card(page, "Lunch")).toHaveCount(0)
  await expect(card(page, "Print assignment")).toBeVisible()
  await page.getByRole("button", { name: "Short tasks", exact: true }).click()
  await showAll(page)
  await card(page, "Lunch").getByRole("button", { name: "Dismiss Lunch" }).click()
  await expect(card(page, "Lunch")).toHaveCount(0)
  await page.getByRole("button", { name: /^Restore dismissed activities/ }).click()
  await showAll(page)
  await expect(card(page, "Lunch")).toBeVisible()
})

test("the planning clock shrinks the current gap and a later clock passes it", async ({ page }) => {
  await open(page, "persona=stella&t=11:00")
  await page.getByRole("button", { name: /^Planning clock/ }).click()
  await dialog(page).getByLabel("Time used for Right Now").fill("11:30")
  await dialog(page).getByRole("button", { name: "Done" }).click()
  await expect(page.locator(".time-summary")).toContainText("18")
  await expect(page.locator(".time-summary")).toContainText("30 min gap")
})

test("settings changes recalculate the preview and the current gap", async ({ page }) => {
  await open(page, "persona=stella&t=11:00&tab=settings")
  await expect(page.locator(".settings-preview")).toContainText("48 min usable")
  await page.getByRole("button", { name: "15 min", exact: true }).click()
  await expect(page.locator(".settings-preview")).toContainText("38 min usable")
  await page.getByRole("button", { name: "Relaxed", exact: true }).click()
  await expect(page.locator(".settings-preview")).toContainText("9 min walking")
  await page.getByLabel("Prefer accessible routes").check()
  await expect(page.locator(".settings-preview")).toContainText("11 min walking")
  await nav(page, "Right Now").click()
  await expect(page.locator(".time-summary")).toContainText("34")
})
