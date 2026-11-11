import { expect, type Page } from "@playwright/test"

export const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
export const card = (page: Page, title: string) =>
  page.getByRole("article", { name: title, exact: true })
export const dialog = (page: Page) => page.getByRole("dialog")
export const notice = (page: Page) => page.locator(".product-notice span").first()
export const readState = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("gw")!))
export const usable = (page: Page) => page.locator(".time-summary h2").first()

export async function showAll(page: Page) {
  const button = page.getByRole("button", { name: /^Show all \d+ activities$/ })
  if (await button.isVisible()) await button.click()
}
export async function undo(page: Page) {
  await page
    .locator(".product-notice")
    .getByRole("button", { name: "Undo", exact: true })
    .click()
}
/** Open a persona by deep link and wait for its home tab. */
export async function open(page: Page, query: string) {
  await page.goto(`/?${query}`)
  await expect(page.locator(".app-shell")).toBeVisible()
}
export async function cancelCommitment(page: Page, title: string) {
  await nav(page, "Plan").click()
  await page.getByRole("button", { name: `Edit ${title}`, exact: true }).click()
  await dialog(page)
    .getByRole("button", { name: "Cancel commitment", exact: true })
    .click()
}

export const errors = new WeakMap<Page, string[]>()
export function track(page: Page) {
  errors.set(page, [])
  page.on("pageerror", (error) => errors.get(page)!.push(String(error)))
}
export async function assertClean(page: Page) {
  expect(errors.get(page) ?? [], "No browser runtime errors").toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal page overflow",
  ).toBe(true)
}
