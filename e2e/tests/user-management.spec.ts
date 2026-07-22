import { test, expect } from "@playwright/test";
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers.ts";

test.describe("user management", () => {
  test("admin can create, edit, and delete a user", async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Test User ${stamp}`;
    const email = `e2e-test-${stamp}@example.com`;
    const password = "password123";
    const updatedName = `${name} Updated`;
    const updatedEmail = `e2e-test-${stamp}-updated@example.com`;

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Create user" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create user" });
    await createDialog.getByLabel("Name").fill(name);
    await createDialog.getByLabel("Email").fill(email);
    await createDialog.getByLabel("Password").fill(password);
    await createDialog.getByRole("button", { name: "Create user" }).click();
    await expect(createDialog).not.toBeVisible();

    const createdRow = page.getByRole("row", { name: new RegExp(email) });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.getByText("agent", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Edit ${name}` }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit user" });
    await expect(editDialog.getByLabel("Name")).toHaveValue(name);
    await expect(editDialog.getByLabel("Email")).toHaveValue(email);
    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByLabel("Email").fill(updatedEmail);
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedEmail) });
    await expect(updatedRow).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(`^${email}$`) })).toHaveCount(0);

    await page.getByRole("button", { name: `Delete ${updatedName}` }).click();
    const deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toContainText(updatedName);
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(deleteDialog).not.toBeVisible();

    await expect(page.getByRole("row", { name: new RegExp(updatedEmail) })).toHaveCount(0);
  });
});
