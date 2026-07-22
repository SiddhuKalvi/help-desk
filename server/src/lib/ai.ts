import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

export const replyPolishModel = openrouter("openrouter/free");
export const ticketSummaryModel = openrouter("openrouter/free");
export const ticketClassificationModel = openrouter("openrouter/free");
export const ticketResolutionModel = openrouter("openrouter/free");
