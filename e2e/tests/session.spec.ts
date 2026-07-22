import { test, expect } from "@playwright/test";
import { login, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers.ts";

test.describe("session", () => {
  test("sign out redirects to /login and invalidates the session server-side", async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");

    await logout(page);

    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("session persists across a full page reload", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");

    await page.reload();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });
});
