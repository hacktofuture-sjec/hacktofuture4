import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads and shows the page title", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/REKALL/);
    await expect(page.getByRole("heading", { name: /Live Dashboard/i })).toBeVisible();
  });

  test("shows simulator scenario buttons", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Postgres Refused")).toBeVisible();
    await expect(page.getByText("OOM Kill")).toBeVisible();
    await expect(page.getByText("Test Failure")).toBeVisible();
    await expect(page.getByText("Secret Leak")).toBeVisible();
    await expect(page.getByText("Image Pull Backoff")).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Vault/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /RL Metrics/i })).toBeVisible();
  });

  test("redirects from / to /dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
