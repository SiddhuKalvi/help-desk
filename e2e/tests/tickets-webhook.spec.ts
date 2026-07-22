import { test, expect } from "@playwright/test";
import { API_BASE_URL, WEBHOOK_SECRET } from "./helpers.ts";

const INBOUND_URL = `${API_BASE_URL}/api/tickets/inbound`;

test.describe("POST /api/tickets/inbound", () => {
  test("valid payload with correct secret creates a new, uncategorized ticket", async ({
    request,
  }) => {
    const stamp = Date.now();
    const payload = {
      senderEmail: `e2e-inbound-${stamp}@example.com`,
      senderName: "E2E Inbound Sender",
      subject: `E2E test subject ${stamp}`,
      body: "E2E test body content.",
    };

    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: payload,
    });

    expect(response.status()).toBe(201);
    const ticket = await response.json();
    expect(ticket).toMatchObject({
      subject: payload.subject,
      body: payload.body,
      senderEmail: payload.senderEmail,
      senderName: payload.senderName,
      status: "new",
      category: null,
    });
    expect(typeof ticket.id).toBe("number");
    expect(typeof ticket.createdAt).toBe("string");
  });

  test("omitted subject defaults to (no subject)", async ({ request }) => {
    const stamp = Date.now();
    const payload = {
      senderEmail: `e2e-inbound-nosubject-${stamp}@example.com`,
      senderName: "E2E Inbound Sender",
      body: "E2E test body content without a subject.",
    };

    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: payload,
    });

    expect(response.status()).toBe(201);
    const ticket = await response.json();
    expect(ticket.subject).toBe("(no subject)");
  });

  test("missing webhook secret returns 401", async ({ request }) => {
    const response = await request.post(INBOUND_URL, {
      data: {
        senderEmail: "e2e-inbound-nosecret@example.com",
        senderName: "E2E Inbound Sender",
        body: "E2E test body content.",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("wrong webhook secret returns 401", async ({ request }) => {
    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": "wrong-secret" },
      data: {
        senderEmail: "e2e-inbound-wrongsecret@example.com",
        senderName: "E2E Inbound Sender",
        body: "E2E test body content.",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("invalid senderEmail returns 400", async ({ request }) => {
    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: {
        senderEmail: "not-an-email",
        senderName: "E2E Inbound Sender",
        body: "E2E test body content.",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });

  test("missing required body field returns 400", async ({ request }) => {
    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: {
        senderEmail: "e2e-inbound-missingbody@example.com",
        senderName: "E2E Inbound Sender",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });

  test("missing required senderName field returns 400", async ({ request }) => {
    const response = await request.post(INBOUND_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: {
        senderEmail: "e2e-inbound-missingname@example.com",
        body: "E2E test body content.",
      },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });
});
