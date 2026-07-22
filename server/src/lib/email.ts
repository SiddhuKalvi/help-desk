import { randomUUID } from "node:crypto";

const MAILGUN_API_BASE_URL = "https://api.mailgun.net/v3";

// RFC 5322 Message-ID, e.g. <uuid@mg.example.com>. Generated up front (before
// the send attempt) so a reply always has a stable thread identity, even if
// the Mailgun call below fails or Mailgun isn't configured yet.
export function generateMessageId(): string {
  const domain = process.env.MAILGUN_DOMAIN || "localhost";
  return `<${randomUUID()}@${domain}>`;
}

export type SendTicketReplyInput = {
  to: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
};

export async function sendTicketReply({
  to,
  subject,
  body,
  messageId,
  inReplyTo,
  references,
}: SendTicketReplyInput): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM;

  if (!apiKey || !domain || !from) {
    console.error("Mailgun is not configured (missing MAILGUN_API_KEY/MAILGUN_DOMAIN/MAILGUN_FROM); skipping outbound email.");
    return;
  }

  const form = new FormData();
  form.set("from", from);
  form.set("to", to);
  form.set("subject", subject);
  form.set("text", body);
  form.set("h:Message-Id", messageId);
  if (inReplyTo) form.set("h:In-Reply-To", inReplyTo);
  if (references) form.set("h:References", references);

  try {
    const response = await fetch(`${MAILGUN_API_BASE_URL}/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Mailgun API responded with ${response.status} sending reply email to ${to}: ${errorText}`);
    }
  } catch (error) {
    console.error(`Failed to send reply email to ${to}:`, error);
  }
}
