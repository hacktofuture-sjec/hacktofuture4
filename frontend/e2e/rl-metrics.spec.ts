import { test, expect } from "@playwright/test";

test.describe("RL Metrics page", () => {
  test("renders RL metrics heading", async ({ page }) => {
    await page.goto("/rl-metrics");
    await expect(page.getByRole("heading", { name: /RL Metrics/i })).toBeVisible();
  });

  test("shows description subtitle", async ({ page }) => {
    await page.goto("/rl-metrics");
    await expect(page.getByText(/Feedback-driven confidence/i)).toBeVisible();
  });
});
