import { randomUUID } from "node:crypto";
import express, { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { APICallError, generateText, RetryError } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import {
  assignTicketSchema,
  createReplySchema,
  polishReplySchema,
  TICKET_PAGE_SIZE,
  ticketQuerySchema,
  updateTicketSchema,
  type TicketSortField,
} from "core";
import { Prisma, ReplySenderType, Role, TicketStatus } from "../generated/prisma/client.ts";
import { auth } from "../lib/auth.ts";
import { getAiAgentId } from "../lib/aiAgent.ts";
import { replyPolishModel, ticketSummaryModel } from "../lib/ai.ts";
import { queueTicketClassification } from "../lib/classifyTicket.ts";
import { generateMessageId, sendTicketReply } from "../lib/email.ts";
import { queueTicketResolution } from "../lib/resolveTicket.ts";
import { prisma } from "../lib/prisma.ts";
import { validateBody, validateParams, validateQuery } from "../lib/validate.ts";
import { requireAuth } from "../middleware/requireAuth.ts";
import { requireWebhookSecret } from "../middleware/requireWebhookSecret.ts";

const inboundEmailSchema = z.object({
  senderEmail: z.email("Enter a valid email"),
  senderName: z.string().trim().min(1, "Sender name is required"),
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1, "Body is required"),
  messageId: z.string().trim().optional(),
  references: z.string().trim().optional(),
  inReplyTo: z.string().trim().optional(),
});

// Mailgun Routes' forward() action posts application/x-www-form-urlencoded in
// practice (confirmed against a real captured request), but multipart/form-data
// is also accepted in case a Route/attachment-bearing payload sends that instead.
// Both parsers are safe to chain: each only acts when the Content-Type matches
// and calls next() unchanged otherwise, so exactly one of them ever populates
// req.body for a given request.
const inboundUrlencoded = express.urlencoded({ extended: true });
const inboundUpload = multer({ storage: multer.memoryStorage() });

// Mailgun's `from` field is the raw RFC 5322 header value (e.g. `Jane Doe
// <jane@example.edu>`), not just a display name - strip the "<email>" part so
// it doesn't end up duplicating `senderEmail` wherever senderName is rendered.
function parseSenderName(from: unknown): unknown {
  if (typeof from !== "string") return from;
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<[^>]*>\s*$/);
  const name = (match?.[1] ?? from).trim();
  return name.length > 0 ? name : from.trim();
}

function normalizeInboundPayload(body: unknown): unknown {
  const raw = (body ?? {}) as Record<string, unknown>;

  const isMailgunPayload =
    typeof raw.sender === "string" ||
    typeof raw.from === "string" ||
    typeof raw["stripped-text"] === "string" ||
    typeof raw["body-plain"] === "string";

  if (!isMailgunPayload) {
    return raw;
  }

  const strippedText = typeof raw["stripped-text"] === "string" ? raw["stripped-text"].trim() : "";
  const bodyPlain = typeof raw["body-plain"] === "string" ? raw["body-plain"] : "";

  // Mailgun always sends the `subject` field, even as "" when the email has
  // none - normalize that to undefined so the schema's .optional() (and the
  // "(no subject)" fallback at ticket-creation time) actually apply, instead
  // of z.string().min(1) rejecting an empty-but-present subject with a 400.
  const subject = typeof raw.subject === "string" && raw.subject.trim().length > 0 ? raw.subject : undefined;

  return {
    senderEmail: raw.sender,
    senderName: parseSenderName(raw.from),
    subject,
    body: strippedText.length > 0 ? strippedText : bodyPlain,
    messageId: raw["Message-Id"],
    references: raw["References"],
    inReplyTo: raw["In-Reply-To"],
  };
}

// Pulls every `<id@domain>` token out of an In-Reply-To/References header
// value. References holds the full ancestor chain space-separated, so a
// reply anywhere in a thread still resolves back to the ticket that started it.
function extractReferencedMessageIds(...headerValues: (string | undefined | null)[]): string[] {
  const ids = new Set<string>();
  for (const value of headerValues) {
    if (!value) continue;
    const matches = value.match(/<[^<>\s]+>/g);
    if (matches) {
      matches.forEach((id) => ids.add(id));
    } else if (value.trim()) {
      ids.add(value.trim());
    }
  }
  return [...ids];
}

const ticketIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid ticket id"),
});

// Shared `select` shapes so the same ticket-with-replies/ticket-summary
// projection isn't hand-copied across every route that returns one.
const ticketSummarySelect = {
  id: true,
  subject: true,
  body: true,
  senderEmail: true,
  senderName: true,
  status: true,
  category: true,
  createdAt: true,
} satisfies Prisma.TicketSelect;

const ticketWithRepliesSelect = {
  ...ticketSummarySelect,
  assignee: { select: { id: true, name: true, email: true } },
  replies: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      ticketBody: true,
      senderType: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.TicketSelect;

// Repeated across every route that mutates a ticket by id - a missing row
// surfaces as Prisma's P2025 ("record to update not found").
function respondIfTicketNotFound(error: unknown, res: Response): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ error: "Ticket not found" });
    return true;
  }
  return false;
}

// generateText() throws when the AI provider errors or exhausts retries (e.g.
// OpenRouter's free-tier daily rate limit) - surface that as a specific,
// actionable 503 rather than letting it fall through to a generic 500.
function respondIfAiUnavailable(error: unknown, res: Response): boolean {
  const apiError = RetryError.isInstance(error)
    ? APICallError.isInstance(error.lastError)
      ? error.lastError
      : undefined
    : APICallError.isInstance(error)
      ? error
      : undefined;

  if (!apiError && !RetryError.isInstance(error)) {
    return false;
  }

  const message =
    apiError?.statusCode === 429
      ? "The AI service has hit its usage limit for now. Please try again later."
      : "The AI service is temporarily unavailable. Please try again later.";

  res.status(503).json({ error: message });
  return true;
}

export const ticketsRouter = Router();

ticketsRouter.get("/", requireAuth, async (req, res) => {
  const query = validateQuery(ticketQuerySchema, req, res);
  if (!query) return;

  const orderByField: Record<TicketSortField, Prisma.TicketOrderByWithRelationInput> = {
    subject: { subject: query.sortOrder },
    senderName: { senderName: query.sortOrder },
    status: { status: query.sortOrder },
    category: { category: query.sortOrder },
    createdAt: { createdAt: query.sortOrder },
  };

  const where: Prisma.TicketWhereInput = {
    status: query.status ?? { not: TicketStatus.processing },
    ...(query.category ? { category: query.category === "uncategorized" ? null : query.category } : {}),
    ...(query.subject ? { subject: { contains: query.subject, mode: "insensitive" } } : {}),
    ...(query.sender
      ? {
          OR: [
            { senderName: { contains: query.sender, mode: "insensitive" } },
            { senderEmail: { contains: query.sender, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: orderByField[query.sortBy],
      skip: (query.page - 1) * TICKET_PAGE_SIZE,
      take: TICKET_PAGE_SIZE,
      select: {
        id: true,
        subject: true,
        senderEmail: true,
        senderName: true,
        status: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page: query.page, pageSize: TICKET_PAGE_SIZE });
});

const DAILY_CHART_DAYS = 30;

type TicketStatsResult = {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  aiResolvedTickets: number;
  avgResolutionMs: number | null;
  dailyTicketCounts: { date: string; count: number }[];
};

ticketsRouter.get("/stats", requireAuth, async (_req, res) => {
  const aiAgentId = await getAiAgentId();

  const rows = await prisma.$queryRaw<
    { stats: TicketStatsResult }[]
  >`SELECT get_ticket_stats(${aiAgentId}, ${DAILY_CHART_DAYS}) AS stats`;

  res.json(rows[0]!.stats);
});

ticketsRouter.get("/:id", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: ticketWithRepliesSelect,
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

ticketsRouter.patch("/:id", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const body = validateBody(updateTicketSchema, req, res);
  if (!body) return;

  const resolvedAtUpdate: Prisma.TicketUpdateInput =
    body.status === TicketStatus.resolved
      ? { resolvedAt: new Date() }
      : body.status === TicketStatus.open
        ? { resolvedAt: null }
        : {};

  try {
    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: { status: body.status, category: body.category, ...resolvedAtUpdate },
      select: ticketWithRepliesSelect,
    });
    res.json(ticket);
  } catch (error) {
    if (respondIfTicketNotFound(error, res)) return;
    throw error;
  }
});

ticketsRouter.patch("/:id/assign", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const body = validateBody(assignTicketSchema, req, res);
  if (!body) return;

  if (body.assigneeId) {
    const agent = await prisma.user.findUnique({
      where: { id: body.assigneeId },
      select: { role: true, deletedAt: true },
    });
    if (!agent || agent.deletedAt || agent.role !== Role.agent) {
      res.status(400).json({ error: "Assignee must be an active agent." });
      return;
    }
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: { assigneeId: body.assigneeId },
      select: ticketWithRepliesSelect,
    });
    res.json(ticket);
  } catch (error) {
    if (respondIfTicketNotFound(error, res)) return;
    throw error;
  }
});

ticketsRouter.post("/:id/replies", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const body = validateBody(createReplySchema, req, res);
  if (!body) return;

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const existingTicket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: {
      body: true,
      messageId: true,
      replies: { orderBy: { createdAt: "asc" }, select: { messageId: true } },
    },
  });
  if (!existingTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  // Gmail-style threading: In-Reply-To is the most recent message in the
  // thread, References is the full ancestor chain (root ticket email, then
  // every reply since) so any mail client can render the whole thread.
  const priorMessageIds = [existingTicket.messageId, ...existingTicket.replies.map((reply) => reply.messageId)].filter(
    (id): id is string => Boolean(id),
  );
  const previousMessageId = priorMessageIds.at(-1) ?? null;
  const referencesHeader = priorMessageIds.length > 0 ? priorMessageIds.join(" ") : null;
  const newMessageId = generateMessageId();

  try {
    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        replies: {
          create: {
            body: body.body,
            ticketBody: existingTicket.body,
            authorId: session.user.id,
            senderType: ReplySenderType.agent,
            messageId: newMessageId,
            inReplyTo: previousMessageId,
            references: referencesHeader,
          },
        },
      },
      select: ticketWithRepliesSelect,
    });

    await sendTicketReply({
      to: ticket.senderEmail,
      subject: `Re: ${ticket.subject}`,
      body: body.body,
      messageId: newMessageId,
      inReplyTo: previousMessageId,
      references: referencesHeader,
    });

    console.log(`Agent reply added to ticket ${ticket.id}, email dispatched (message ${newMessageId})`);

    res.status(201).json(ticket);
  } catch (error) {
    if (respondIfTicketNotFound(error, res)) return;
    throw error;
  }
});

ticketsRouter.post("/:id/replies/polish", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const body = validateBody(polishReplySchema, req, res);
  if (!body) return;

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: { body: true, senderName: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const customerFirstName = ticket.senderName.trim().split(/\s+/)[0];

  try {
    const { text } = await generateText({
      model: replyPolishModel,
      system:
        "You polish draft replies written by a student help desk agent. " +
        "Improve clarity, grammar, and tone (professional, friendly, concise) while preserving the original meaning and intent. " +
        "Do not invent facts, commitments, or details that aren't in the draft. " +
        "Address the customer by their first name in the greeting at the start of the reply. " +
        "End the reply with a sign-off on its own line using the agent's name (e.g. 'Best regards,' followed by the name). " +
        "Respond with only the polished reply text, no preamble, no quotes, no markdown.",
      prompt:
        `Original student message:\n${ticket.body}\n\n` +
        `Customer's first name: ${customerFirstName}\n` +
        `Agent's name: ${session.user.name}\n\n` +
        `Agent's draft reply to polish:\n${body.body}`,
    });

    res.json({ body: text.trim() });
  } catch (error) {
    if (respondIfAiUnavailable(error, res)) return;
    throw error;
  }
});

ticketsRouter.post("/:id/summarize", requireAuth, async (req, res) => {
  const params = validateParams(ticketIdParamSchema, req, res);
  if (!params) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    select: {
      subject: true,
      body: true,
      senderName: true,
      replies: {
        orderBy: { createdAt: "asc" },
        select: { body: true, senderType: true, author: { select: { name: true } } },
      },
    },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const conversation = [
    `${ticket.senderName} (customer): ${ticket.body}`,
    ...ticket.replies.map((reply) => `${reply.author?.name ?? "AI Assistant"} (${reply.senderType}): ${reply.body}`),
  ].join("\n\n");

  try {
    const { text } = await generateText({
      model: ticketSummaryModel,
      system:
        "You summarize help desk ticket conversations for support agents. " +
        "Write a concise summary (2-4 sentences) covering what the customer needs, key details discussed, " +
        "and the current state of the conversation. Do not invent facts, commitments, or details that aren't in the conversation. " +
        "Respond with only the summary text, no preamble, no quotes, no markdown.",
      prompt: `Ticket subject: ${ticket.subject}\n\nConversation:\n${conversation}`,
    });

    res.json({ summary: text.trim() });
  } catch (error) {
    if (respondIfAiUnavailable(error, res)) return;
    throw error;
  }
});

ticketsRouter.post("/inbound", requireWebhookSecret, inboundUrlencoded, inboundUpload.any(), async (req, res) => {
  req.body = normalizeInboundPayload(req.body);

  const parsed = validateBody(inboundEmailSchema, req, res);
  if (!parsed) return;

  const { senderEmail, senderName, subject, body, messageId, references, inReplyTo } = parsed;

  // Gmail-style threading: if this email's In-Reply-To/References names a
  // Message-ID we've already sent or received, it's a reply on an existing
  // thread - attach it as a customer Reply instead of opening a new ticket.
  const referencedIds = extractReferencedMessageIds(inReplyTo, references);

  const existingTicket =
    referencedIds.length > 0
      ? await prisma.ticket.findFirst({
          where: {
            OR: [{ messageId: { in: referencedIds } }, { replies: { some: { messageId: { in: referencedIds } } } }],
          },
          select: ticketSummarySelect,
        })
      : null;

  try {
    if (existingTicket) {
      const ticket = await prisma.ticket.update({
        where: { id: existingTicket.id },
        data: {
          replies: {
            create: {
              body,
              ticketBody: existingTicket.body,
              senderType: ReplySenderType.customer,
              messageId: messageId ?? null,
            },
          },
        },
        select: ticketSummarySelect,
      });

      console.log(`Inbound reply threaded onto existing ticket ${ticket.id}`);

      res.status(201).json(ticket);
      return;
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: subject ?? "(no subject)",
        body,
        senderEmail,
        senderName,
        messageId: messageId ?? null,
        threadId: randomUUID(),
      },
      select: ticketSummarySelect,
    });

    console.log(`Inbound email created new ticket ${ticket.id}`);

    res.status(201).json(ticket);

    queueTicketClassification(ticket).catch((error) => {
      console.error(`Failed to queue classification for ticket ${ticket.id}:`, error);
    });

    queueTicketResolution(ticket).catch((error) => {
      console.error(`Failed to queue resolution for ticket ${ticket.id}:`, error);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Mailgun retried a delivery we've already processed (duplicate Message-ID) - ack without duplicating.
      console.warn("Duplicate inbound webhook delivery detected (Message-ID already processed); acking without creating a duplicate.");
      res.status(200).json({ status: "duplicate" });
      return;
    }
    throw error;
  }
});
