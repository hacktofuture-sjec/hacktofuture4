import { test, expect } from "@playwright/test";

// RL Metrics page has been eliminated as part of the flat-file architecture migration.
// Vault confidence & episode data are now read directly from vault/episodes.json
// and surfaced via GET /metrics/episodes on the backend.
// This spec now covers the Memory Vault page instead.

test.describe("Memory Vault page", () => {
  test("renders Memory Vault heading", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("heading", { name: /Memory Vault/i })).toBeVisible();
  });

  test("shows vault stats section", async ({ page }) => {
    await page.goto("/vault");
    // Stats cards render — even if vault is empty, the stat cards still appear
    await expect(page.getByText(/Total Entries/i)).toBeVisible();
  });

  test("vault page loads without error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");
    expect(errors.filter((e) => !e.includes("hydration"))).toHaveLength(0);
  });
});
