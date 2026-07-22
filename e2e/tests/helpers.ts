import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

function loadServerTestEnv(): Record<string, string> {
  const envPath = path.join(__dirname, "../../server/.env.test");
  const contents = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    env[key] = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }

  return env;
}

const serverTestEnv = loadServerTestEnv();

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "password123";
export const AGENT_EMAIL = "agent@example.com";
export const AGENT_PASSWORD = "password123";
export const API_BASE_URL = serverTestEnv.BETTER_AUTH_URL as string;
export const WEBHOOK_SECRET = serverTestEnv.INBOUND_EMAIL_WEBHOOK_SECRET as string;

export async function submitLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

export async function login(page: Page, email: string, password: string) {
  await submitLogin(page, email, password);
  await page.waitForURL("/");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/login");
}

export async function expectRedirectToLogin(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL("/login");
}

export async function createTicket(
  request: APIRequestContext,
  overrides: Partial<{ subject: string; body: string; senderEmail: string; senderName: string }> = {},
) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    senderEmail: overrides.senderEmail ?? `e2e-ticket-${stamp}@example.com`,
    senderName: overrides.senderName ?? "E2E Ticket Sender",
    subject: overrides.subject ?? `E2E ticket subject ${stamp}`,
    body: overrides.body ?? "E2E ticket body content.",
  };

  const response = await request.post(`${API_BASE_URL}/api/tickets/inbound`, {
    headers: { "x-webhook-secret": WEBHOOK_SECRET },
    data: payload,
  });

  return (await response.json()) as {
    id: number;
    subject: string;
    senderEmail: string;
    senderName: string;
    body: string;
  };
}
