import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

// Express's query parser decodes `+` as a space (the application/x-www-form-urlencoded
// convention), which silently corrupts a base64 secret embedded unencoded in a URL
// (as Mailgun's Route forward() action does). Read the raw query string instead and
// decode only %XX escapes via decodeURIComponent, which leaves a literal `+` alone -
// this handles both an unencoded `+` and a properly percent-encoded `%2B` correctly.
function extractRawQuerySecret(req: Request): string {
  const queryString = req.originalUrl.split("?")[1] ?? "";
  const match = queryString.match(/(?:^|&)secret=([^&]*)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1] as string);
  } catch {
    return match[1] as string;
  }
}

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = Buffer.from(process.env.INBOUND_EMAIL_WEBHOOK_SECRET as string);

  const provided = Buffer.from(req.header("x-webhook-secret") || extractRawQuerySecret(req));

  const isValid = expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!isValid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}