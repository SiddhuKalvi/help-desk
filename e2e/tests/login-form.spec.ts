import { test, expect } from "@playwright/test";
import { login, submitLogin, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers.ts";

test.describe("login form", () => {
  test("successful login redirects to home and shows admin in navbar", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("wrong password shows server error and stays on login", async ({ page }) => {
    await submitLogin(page, ADMIN_EMAIL, "wrong-password");

    await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
    await expect(page).toHaveURL("/login");
  });

  test("non-existent email shows server error and stays on login", async ({ page }) => {
    await submitLogin(page, "no-such-user@example.com", "whatever123");

    await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
    await expect(page).toHaveURL("/login");
  });

  test("invalid email format shows client-side validation error without a server request", async ({
    page,
  }) => {
    const signInRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/sign-in/email")) signInRequests.push(request.url());
    });

    await submitLogin(page, "not-an-email", "somepassword");

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page).toHaveURL("/login");
    expect(signInRequests).toHaveLength(0);
  });

  test("empty password shows client-side validation error", async ({ page }) => {
    await submitLogin(page, ADMIN_EMAIL, "");

    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});
