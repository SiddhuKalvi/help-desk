import { generateObject } from "ai";
import { z } from "zod";
import { ticketResolutionModel } from "./ai.ts";

export type TicketToResolve = {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
};

export type ResolutionResult = { resolved: true; reply: string } | { resolved: false };

const AI_REPLY_SIGN_OFF = "Siddhu Kalvi";

const KNOWLEDGE_BASE_PATH = `${import.meta.dir}/../../knowledge-base.md`;

let knowledgeBasePromise: Promise<string> | undefined;

function loadKnowledgeBase(): Promise<string> {
  knowledgeBasePromise ??= Bun.file(KNOWLEDGE_BASE_PATH).text();
  return knowledgeBasePromise;
}

const resolutionSchema = z.discriminatedUnion("resolution", [
  z.object({
    resolution: z.literal("resolved"),
    paragraphs: z.array(z.string().min(1)).min(1).max(4),
    bulletPoints: z.array(z.string().min(1)).max(6).optional(),
  }),
  z.object({
    resolution: z.literal("escalate"),
    reason: z.string().min(1),
  }),
]);

const NON_ANSWER_PATTERN =
  /\b(don'?t have|do not have|doesn'?t (have|contain|cover)|does not (have|contain|cover)|no information|not (covered|available|documented)|outside (the|our) (scope|knowledge base))\b/i;

function isNonAnswer(paragraphs: string[], bulletPoints: string[] | undefined): boolean {
  return NON_ANSWER_PATTERN.test([...paragraphs, ...(bulletPoints ?? [])].join(" "));
}

function formatResolvedReply(
  customerFirstName: string,
  paragraphs: string[],
  bulletPoints: string[] | undefined,
): string {
  const sections = [
    `Hi ${customerFirstName},`,
    ...paragraphs,
    ...(bulletPoints && bulletPoints.length > 0 ? [bulletPoints.map((point) => `- ${point}`).join("\n")] : []),
    `Best regards,\n${AI_REPLY_SIGN_OFF}`,
  ];
  return sections.join("\n\n");
}

export async function resolveTicketFromKnowledgeBase(ticket: TicketToResolve): Promise<ResolutionResult> {
  const knowledgeBase = await loadKnowledgeBase();
  const customerFirstName = ticket.senderName.trim().split(/\s+/)[0] ?? ticket.senderName;

  const { object } = await generateObject({
    model: ticketResolutionModel,
    schema: resolutionSchema,
    system:
      "You are an automated first-line responder for a student help desk. " +
      "You must answer using ONLY the information contained in the knowledge base provided below — " +
      "never invent facts, policies, prices, or commitments that are not explicitly stated in it. " +
      'The knowledge base\'s own "Escalation Rules" section is binding internal policy: if the ticket ' +
      "matches any of those conditions (legal threat, refund request outside the 30-day window, a disputed " +
      "charge/chargeback, an account security concern, or you are not highly confident in your answer), " +
      'you must respond with resolution: "escalate" and a short reason — do NOT attempt to answer. ' +
      'You must ALSO respond with resolution: "escalate" whenever the knowledge base does not contain ' +
      "information relevant to what the customer is asking — this counts as low confidence. Never resolve a " +
      "ticket by telling the customer the knowledge base doesn't cover their question, that you don't have " +
      "that information, or by giving a generic non-answer — if you would need to say anything like that, " +
      'escalate instead. Only respond with resolution: "resolved" when the knowledge base directly and ' +
      "unambiguously answers the ticket and none of the escalation conditions apply. When resolved, do NOT write a greeting or " +
      "sign-off yourself — those are added automatically. Only provide the body content: `paragraphs` is " +
      "one or two short, professional, warm, customer-friendly sentences/paragraphs answering the question, " +
      "grounded strictly in the knowledge base content; `bulletPoints` is an optional list of short items " +
      "(one condition/step per item, no leading dashes) to include only when the answer involves multiple " +
      "steps or conditions, e.g. refund eligibility conditions or troubleshooting steps — omit it otherwise.\n\n" +
      `Knowledge base:\n${knowledgeBase}`,
    prompt:
      `From: ${ticket.senderName} <${ticket.senderEmail}>\n` +
      `Subject: ${ticket.subject}\n\n` +
      `Body:\n${ticket.body}`,
  });

  const shouldResolve = object.resolution === "resolved" && !isNonAnswer(object.paragraphs, object.bulletPoints);

  if (object.resolution === "resolved" && !shouldResolve) {
    console.warn(
      `Model returned resolution "resolved" but the reply reads as a non-answer; escalating to open instead.`,
    );
  }

  if (!shouldResolve) {
    return { resolved: false };
  }

  return {
    resolved: true,
    reply: formatResolvedReply(customerFirstName, object.paragraphs, object.bulletPoints),
  };
}
