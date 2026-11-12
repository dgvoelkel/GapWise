import { test, expect } from "@playwright/test"
import {
  assertClean,
  card,
  dialog,
  nav,
  open,
  track,
  undo,
  usable,
} from "./helpers"

test.beforeEach(async ({ page }) => track(page))
test.afterEach(async ({ page }) => assertClean(page))

test("Right Now deducts a planned activity and restores the minutes on undo", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00")
  await expect(usable(page)).toHaveText("48 usable minutes")
  // Selecting a suggestion only previews it; adding it reserves the time.
  await card(page, "Print assignment")
    .getByRole("button", { name: "Print assignment", exact: true })
    .click()
  await expect(usable(page)).toHaveText("48 usable minutes")
  await card(page, "Print assignment")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await expect(usable(page)).toHaveText("38 usable minutes")
  await expect(page.locator(".time-equation")).toContainText(
    "10 min planned (incl. setup)",
  )
  await undo(page)
  await expect(usable(page)).toHaveText("48 usable minutes")
})

test("an activity added in Plan shows the same remaining time in Right Now", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00&tab=plan&day=0")
  await card(page, "Lunch")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  const available = await page
    .locator(".plan-time-balance h2 strong")
    .textContent()
  await nav(page, "Right Now").click()
  await expect(usable(page)).toHaveText(`${available} usable minutes`)
  await expect(page.locator(".time-equation")).toContainText(
    "35 min planned (incl. setup)",
  )
  await expect(page.locator(".time-equation")).toContainText("7 min walking")
  await page
    .locator(".assignment-card")
    .getByRole("button", { name: "Undo assignment", exact: true })
    .click()
  await expect(usable(page)).toHaveText("48 usable minutes")
})

test("advancing the clock does not subtract elapsed activity time twice", async ({
  page,
}) => {
  await open(page, "persona=stella&t=11:00")
  await card(page, "Print assignment")
    .getByRole("button", { name: "Add to gap", exact: true })
    .click()
  await page.getByRole("button", { name: /^Planning clock/ }).click()
  await dialog(page).getByLabel("Time used for Right Now").fill("11:30")
  await dialog(page).getByRole("button", { name: "Done", exact: true }).click()
  await expect(usable(page)).toHaveText("25 usable minutes")
  await expect(page.locator(".time-equation")).toContainText("30 min gap")
  await expect(page.locator(".time-equation")).not.toContainText("min planned")
  await expect(page.locator(".time-equation")).toContainText("0 min walking")
})
