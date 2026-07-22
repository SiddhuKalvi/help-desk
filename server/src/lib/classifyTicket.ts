import { generateObject } from "ai";
import type { JobWithMetadata } from "pg-boss";
import { z } from "zod";
import { ticketCategories } from "core";
import { Prisma } from "../generated/prisma/client.ts";
import { ticketClassificationModel } from "./ai.ts";
import { prisma } from "./prisma.ts";
import { boss } from "./queue.ts";
import { Sentry } from "./sentry.ts";

const classificationSchema = z.object({
  category: z.enum(ticketCategories),
});

// The free-tier model occasionally ignores the schema entirely and returns
// the bare category value as plain text (e.g. `technical_question` instead
// of `{"category":"technical_question"}`) - salvage that instead of burning
// a retry attempt on an otherwise-correct answer.
function repairCategoryText(text: string): string | null {
  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, "");
  return (ticketCategories as readonly string[]).includes(cleaned) ? JSON.stringify({ category: cleaned }) : null;
}

export type ClassifiableTicket = Prisma.TicketGetPayload<{ select: { id: true; subject: true; body: true } }>;

export const CLASSIFY_TICKET_QUEUE = "classify-ticket";

export async function queueTicketClassification(ticket: ClassifiableTicket): Promise<void> {
  await boss.send(CLASSIFY_TICKET_QUEUE, ticket);
}

export async function registerTicketClassificationWorker(): Promise<void> {
  // See registerTicketResolutionWorker's comment - short expiry so an
  // orphaned job (worker died mid-run) gets reclaimed in ~2 minutes rather
  // than pg-boss's 15-minute default.
  await boss.createQueue(CLASSIFY_TICKET_QUEUE, {
    expireInSeconds: 120,
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 5,
  });
  await boss.work(
    CLASSIFY_TICKET_QUEUE,
    { includeMetadata: true },
    async ([job]: JobWithMetadata<ClassifiableTicket>[]) => {
      if (!job) return;
      try {
        await classifyTicket(job.data);
      } catch (error) {
        if (job.retryCount < job.retryLimit) {
          console.error(
            `Ticket classification attempt ${job.retryCount + 1}/${job.retryLimit + 1} failed for ticket ${job.data.id}, retrying:`,
            error,
          );
          // Re-throw so pg-boss retries with backoff - a transient
          // "no object generated" glitch from the free-tier model shouldn't
          // page anyone, only a failure that survives all retries should.
          throw error;
        }

        console.error(`Ticket classification exhausted retries for ticket ${job.data.id}:`, error);
        Sentry.captureException(error, { extra: { ticketId: job.data.id } });
        throw error;
      }
    },
  );
}

async function classifyTicket(ticket: ClassifiableTicket): Promise<void> {
  const { object } = await generateObject({
    model: ticketClassificationModel,
    schema: classificationSchema,
    system:
      "You classify student help desk tickets into exactly one category based on their subject and body. " +
      "general_question: general, non-technical questions. " +
      "technical_question: technical issues, bugs, or how-to questions about a product or system. " +
      "refund_request: requests for a refund or a billing/payment dispute.",
    prompt: `Subject: ${ticket.subject}\n\nBody: ${ticket.body}`,
    experimental_repairText: async ({ text }) => repairCategoryText(text),
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { category: object.category },
  });
}
