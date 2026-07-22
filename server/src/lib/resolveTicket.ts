import type { JobWithMetadata } from "pg-boss";
import { Prisma, ReplySenderType, TicketStatus } from "../generated/prisma/client.ts";
import { getAiAgentId } from "./aiAgent.ts";
import { generateMessageId, sendTicketReply } from "./email.ts";
import { resolveTicketFromKnowledgeBase } from "./knowledgeBaseResolver.ts";
import { prisma } from "./prisma.ts";
import { boss } from "./queue.ts";
import { Sentry } from "./sentry.ts";

export type ResolvableTicket = Prisma.TicketGetPayload<{
  select: { id: true; subject: true; body: true; senderName: true; senderEmail: true };
}>;

export const RESOLVE_TICKET_QUEUE = "resolve-ticket";

export async function queueTicketResolution(ticket: ResolvableTicket): Promise<void> {
  await boss.send(RESOLVE_TICKET_QUEUE, ticket);
}

export async function registerTicketResolutionWorker(): Promise<void> {
  // Default expireInSeconds (900) leaves a ticket stuck in "processing" for
  // 15 minutes if the worker process dies mid-job (e.g. a dev-server restart
  // or deploy) - this job normally finishes in a few seconds, so a much
  // shorter expiry lets pg-boss reclaim and retry an orphaned job quickly.
  // retryLimit/retryBackoff/retryDelay give the AI call itself (rate limits,
  // "no object generated" glitches from the free-tier model, network blips)
  // a few automatic, backed-off retries before we give up on it - see
  // resolveTicket's catch block below for how those retries are consumed.
  await boss.createQueue(RESOLVE_TICKET_QUEUE, {
    expireInSeconds: 120,
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 5,
  });
  await boss.work(
    RESOLVE_TICKET_QUEUE,
    { includeMetadata: true },
    async ([job]: JobWithMetadata<ResolvableTicket>[]) => {
      if (!job) return;
      await resolveTicket(job.data, { retryCount: job.retryCount, retryLimit: job.retryLimit });
    },
  );
}

// retryInfo defaults to "no retries available" so direct callers (unit tests,
// one-off recovery scripts) get today's behavior: any failure falls straight
// back to `open` instead of throwing. The real worker above always passes the
// job's actual retry budget.
export async function resolveTicket(
  ticket: ResolvableTicket,
  retryInfo: { retryCount: number; retryLimit: number } = { retryCount: 0, retryLimit: 0 },
): Promise<void> {
  const aiAgentId = await getAiAgentId();

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: TicketStatus.processing, ...(aiAgentId ? { assigneeId: aiAgentId } : {}) },
  });

  try {
    const result = await resolveTicketFromKnowledgeBase(ticket);

    if (result.resolved) {
      // Gmail-style threading, same as the agent-reply route: In-Reply-To is
      // the most recent message in the thread, References is the full chain.
      const existing = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { messageId: true, replies: { orderBy: { createdAt: "asc" }, select: { messageId: true } } },
      });
      const priorMessageIds = [existing?.messageId, ...(existing?.replies.map((reply) => reply.messageId) ?? [])].filter(
        (id): id is string => Boolean(id),
      );
      const previousMessageId = priorMessageIds.at(-1) ?? null;
      const referencesHeader = priorMessageIds.length > 0 ? priorMessageIds.join(" ") : null;
      const newMessageId = generateMessageId();

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.resolved,
          resolvedAt: new Date(),
          replies: {
            create: {
              body: result.reply,
              ticketBody: ticket.body,
              senderType: ReplySenderType.ai,
              messageId: newMessageId,
              inReplyTo: previousMessageId,
              references: referencesHeader,
            },
          },
        },
      });

      // sendTicketReply swallows its own failures (missing config, non-2xx,
      // network errors) and just logs - it never throws, so a delivery
      // problem here can't undo the resolution we just committed above.
      await sendTicketReply({
        to: ticket.senderEmail,
        subject: `Re: ${ticket.subject}`,
        body: result.reply,
        messageId: newMessageId,
        inReplyTo: previousMessageId,
        references: referencesHeader,
      });

      console.log(`Ticket ${ticket.id} auto-resolved, email dispatched (message ${newMessageId})`);
    } else {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.open, assigneeId: null },
      });
    }
  } catch (error) {
    if (retryInfo.retryCount < retryInfo.retryLimit) {
      console.error(
        `Auto-resolve attempt ${retryInfo.retryCount + 1}/${retryInfo.retryLimit + 1} failed for ticket ${ticket.id}, retrying:`,
        error,
      );
      // Re-throw so pg-boss retries the job (with backoff) instead of us
      // treating a transient AI/infra failure as a real "escalate" decision.
      throw error;
    }

    console.error(`Auto-resolve exhausted retries for ticket ${ticket.id}, falling back to open:`, error);
    Sentry.captureException(error, { extra: { ticketId: ticket.id } });
    await prisma.ticket
      .update({ where: { id: ticket.id }, data: { status: TicketStatus.open, assigneeId: null } })
      .catch((fallbackError) => {
        console.error(`Failed to fall back ticket ${ticket.id} to open after resolution error:`, fallbackError);
        Sentry.captureException(fallbackError, { extra: { ticketId: ticket.id } });
      });
  }
}
