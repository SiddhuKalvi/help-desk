import type { ReplySenderType, TicketCategory, TicketStatus } from "core";

export const statusLabel: Record<TicketStatus, string> = {
  new: "New",
  processing: "Processing",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const categoryLabel: Record<TicketCategory, string> = {
  general_question: "General Question",
  technical_question: "Technical Question",
  refund_request: "Refund Request",
};

export const uncategorizedLabel = "Uncategorized";

const glassBase =
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-md";

// Frosted-glass status pill: translucent tint + soft border, keyed off the
// --signal-* tokens in index.css so a status only ever needs one color to change.
export const statusGlassClass: Record<TicketStatus, string> = {
  new: `${glassBase} border-signal-new/30 bg-signal-new/10 text-signal-new`,
  processing: `${glassBase} border-signal-processing/30 bg-signal-processing/10 text-signal-processing animate-pulse`,
  open: `${glassBase} border-signal-open/50 bg-signal-open/15 text-signal-open shadow-[0_0_16px_-4px_var(--signal-open)]`,
  resolved: `${glassBase} border-signal-resolved/30 bg-signal-resolved/10 text-signal-resolved`,
  closed: `${glassBase} border-signal-closed/30 bg-signal-closed/10 text-signal-closed`,
};

export function ticketRef(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export const senderTypeLabel: Record<ReplySenderType, string> = {
  agent: "Agent",
  customer: "Customer",
  ai: "AI Assistant",
};

export const senderTypeVariant: Record<ReplySenderType, "default" | "secondary" | "outline"> = {
  agent: "secondary",
  customer: "outline",
  ai: "default",
};
