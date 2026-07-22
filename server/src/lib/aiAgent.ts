import { prisma } from "./prisma.ts";

export const AI_AGENT_EMAIL = process.env.AI_AGENT_EMAIL ?? "ai@helpdesk.local";

let cachedAiAgentId: string | null = null;

export async function getAiAgentId(): Promise<string | null> {
  if (cachedAiAgentId) return cachedAiAgentId;
  const agent = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL }, select: { id: true } });
  cachedAiAgentId = agent?.id ?? null;
  return cachedAiAgentId;
}
