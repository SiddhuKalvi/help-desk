import { test, expect } from "@playwright/test";
import { createTicket, login, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers.ts";

test.describe("ticket detail page", () => {
  test("loads a real ticket end-to-end through the full stack", async ({ page, request }) => {
    const ticket = await createTicket(request);

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/tickets/${ticket.id}`);

    await expect(page.getByRole("heading", { name: ticket.subject })).toBeVisible();
    await expect(page.getByText(`${ticket.senderName} <${ticket.senderEmail}>`)).toBeVisible();
    await expect(page.getByText(ticket.body)).toBeVisible();
  });
});
