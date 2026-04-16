import { test, expect } from "@playwright/test";

test.describe("Vault page", () => {
  test("renders vault page heading", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("heading", { name: /Memory Vault/i })).toBeVisible();
  });

  test("shows filter tabs", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /human/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /synthetic/i })).toBeVisible();
  });

  test("search input is interactive", async ({ page }) => {
    await page.goto("/vault");
    const search = page.getByPlaceholder(/Search vault/i);
    await expect(search).toBeVisible();
    await search.fill("postgres");
    await expect(search).toHaveValue("postgres");
  });
});
