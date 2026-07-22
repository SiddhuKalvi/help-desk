import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ReplySenderType, TicketStatus } from "../generated/prisma/client.ts";
import type { ResolvableTicket } from "./resolveTicket.ts";

const ticketUpdate = mock<(args: unknown) => Promise<unknown>>();
const ticketFindUnique = mock<(args: unknown) => Promise<unknown>>();
const getAiAgentId = mock<() => Promise<string | null>>();
const resolveTicketFromKnowledgeBase = mock<(ticket: unknown) => Promise<unknown>>();
const generateMessageId = mock<() => string>();
const sendTicketReply = mock<(input: unknown) => Promise<void>>();
const captureException = mock<(error: unknown, context?: unknown) => void>();

mock.module("./prisma.ts", () => ({
  prisma: { ticket: { update: ticketUpdate, findUnique: ticketFindUnique } },
}));
mock.module("./aiAgent.ts", () => ({ getAiAgentId }));
mock.module("./knowledgeBaseResolver.ts", () => ({ resolveTicketFromKnowledgeBase }));
mock.module("./email.ts", () => ({ generateMessageId, sendTicketReply }));
mock.module("./queue.ts", () => ({
  boss: { createQueue: mock(), work: mock(), send: mock() },
}));
mock.module("./sentry.ts", () => ({ Sentry: { captureException } }));

const { resolveTicket } = await import("./resolveTicket.ts");

const ticket: ResolvableTicket = {
  id: 42,
  subject: "Can't see my course",
  body: "I purchased the course but it isn't showing up.",
  senderName: "Jane Doe",
  senderEmail: "jane@example.edu",
};

beforeEach(() => {
  ticketUpdate.mockReset().mockResolvedValue(undefined);
  ticketFindUnique.mockReset().mockResolvedValue(null);
  getAiAgentId.mockReset().mockResolvedValue(null);
  resolveTicketFromKnowledgeBase.mockReset();
  generateMessageId.mockReset().mockReturnValue("<new-reply@help-desk.co.in>");
  sendTicketReply.mockReset().mockResolvedValue(undefined);
  captureException.mockReset();
});

afterEach(() => {
  ticketUpdate.mockReset();
  ticketFindUnique.mockReset();
  getAiAgentId.mockReset();
  resolveTicketFromKnowledgeBase.mockReset();
  generateMessageId.mockReset();
  sendTicketReply.mockReset();
  captureException.mockReset();
});

describe("resolveTicket", () => {
  test("marks the ticket processing, assigning the AI agent when one exists", async () => {
    getAiAgentId.mockResolvedValue("ai-agent-id");
    resolveTicketFromKnowledgeBase.mockResolvedValue({ resolved: false });

    await resolveTicket(ticket);

    expect(ticketUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 42 },
      data: { status: TicketStatus.processing, assigneeId: "ai-agent-id" },
    });
  });

  test("threads and emails the AI reply when the knowledge base resolves the ticket", async () => {
    resolveTicketFromKnowledgeBase.mockResolvedValue({ resolved: true, reply: "Here's how to fix it." });
    ticketFindUnique.mockResolvedValue({
      messageId: "<original@mail.example>",
      replies: [{ messageId: "<earlier-reply@help-desk.co.in>" }],
    });

    await resolveTicket(ticket);

    expect(ticketUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 42 },
      data: {
        status: TicketStatus.resolved,
        resolvedAt: expect.any(Date),
        replies: {
          create: {
            body: "Here's how to fix it.",
            ticketBody: ticket.body,
            senderType: ReplySenderType.ai,
            messageId: "<new-reply@help-desk.co.in>",
            inReplyTo: "<earlier-reply@help-desk.co.in>",
            references: "<original@mail.example> <earlier-reply@help-desk.co.in>",
          },
        },
      },
    });

    expect(sendTicketReply).toHaveBeenCalledWith({
      to: "jane@example.edu",
      subject: "Re: Can't see my course",
      body: "Here's how to fix it.",
      messageId: "<new-reply@help-desk.co.in>",
      inReplyTo: "<earlier-reply@help-desk.co.in>",
      references: "<original@mail.example> <earlier-reply@help-desk.co.in>",
    });
  });

  test("threads off the ticket's own message when it has no prior replies", async () => {
    resolveTicketFromKnowledgeBase.mockResolvedValue({ resolved: true, reply: "Here's how to fix it." });
    ticketFindUnique.mockResolvedValue({ messageId: "<original@mail.example>", replies: [] });

    await resolveTicket(ticket);

    expect(sendTicketReply).toHaveBeenCalledWith(
      expect.objectContaining({
        inReplyTo: "<original@mail.example>",
        references: "<original@mail.example>",
      }),
    );
  });

  test("falls back to open with no email when the knowledge base can't answer", async () => {
    resolveTicketFromKnowledgeBase.mockResolvedValue({ resolved: false });

    await resolveTicket(ticket);

    expect(ticketUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 42 },
      data: { status: TicketStatus.open, assigneeId: null },
    });
    expect(sendTicketReply).not.toHaveBeenCalled();
  });

  test("falls back to open with no email when the AI call throws", async () => {
    resolveTicketFromKnowledgeBase.mockRejectedValue(new Error("AI service unavailable"));

    await resolveTicket(ticket);

    expect(ticketUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 42 },
      data: { status: TicketStatus.open, assigneeId: null },
    });
    expect(sendTicketReply).not.toHaveBeenCalled();
  });

  test("re-throws so pg-boss retries when attempts remain, instead of escalating early", async () => {
    resolveTicketFromKnowledgeBase.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(resolveTicket(ticket, { retryCount: 0, retryLimit: 3 })).rejects.toThrow("Rate limit exceeded");

    // Only the initial "processing" update happened - no premature fallback to open.
    expect(ticketUpdate).toHaveBeenCalledTimes(1);
    expect(sendTicketReply).not.toHaveBeenCalled();
    // A transient, still-retryable failure shouldn't be reported yet - only the
    // exhausted-retries case (below) is a real error worth paging on.
    expect(captureException).not.toHaveBeenCalled();
  });

  test("falls back to open only once retries are exhausted", async () => {
    const error = new Error("Rate limit exceeded");
    resolveTicketFromKnowledgeBase.mockRejectedValue(error);

    await resolveTicket(ticket, { retryCount: 3, retryLimit: 3 });

    expect(ticketUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 42 },
      data: { status: TicketStatus.open, assigneeId: null },
    });
    expect(sendTicketReply).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(error, { extra: { ticketId: 42 } });
  });

  test("reports the fallback update failure too, if it also throws", async () => {
    const resolveError = new Error("Rate limit exceeded");
    const fallbackError = new Error("Database unavailable");
    resolveTicketFromKnowledgeBase.mockRejectedValue(resolveError);
    ticketUpdate.mockReset().mockResolvedValueOnce(undefined).mockRejectedValueOnce(fallbackError);

    await resolveTicket(ticket, { retryCount: 3, retryLimit: 3 });

    expect(captureException).toHaveBeenCalledWith(resolveError, { extra: { ticketId: 42 } });
    expect(captureException).toHaveBeenCalledWith(fallbackError, { extra: { ticketId: 42 } });
  });
});
