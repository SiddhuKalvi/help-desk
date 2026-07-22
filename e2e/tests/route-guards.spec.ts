import { test, expect } from "@playwright/test";
import {
  login,
  logout,
  expectRedirectToLogin,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
} from "./helpers.ts";

test.describe("route guards", () => {
  test("visiting / while unauthenticated redirects to /login", async ({ page }) => {
    await expectRedirectToLogin(page, "/");
  });

  test("visiting /users while unauthenticated redirects to /login", async ({ page }) => {
    await expectRedirectToLogin(page, "/users");
  });

  test("visiting /login while already authenticated redirects to / without showing the form", async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");

    await page.goto("/login");

    await expect(page).toHaveURL("/");
    await expect(page.getByLabel("Email")).not.toBeVisible();
  });

  test("admin can visit /users and sees the Users heading", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("non-admin agent visiting /users is redirected to /", async ({ page }) => {
    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/users");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });

  test("Navbar shows Users link for admin but not for agent", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

    await logout(page);

    await login(page, AGENT_EMAIL, AGENT_PASSWORD);
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  });
});
