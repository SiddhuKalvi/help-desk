export const ticketStatuses = ["new", "processing", "open", "resolved", "closed"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

// Statuses visible in the ticket list / requestable as a filter.
// `processing` is a transient, system-only state and must never be listed or filterable.
export const ticketListStatuses = ["new", "open", "resolved", "closed"] as const;

export type TicketListStatus = (typeof ticketListStatuses)[number];

// Statuses an agent can manually set via the ticket detail "Status" dropdown.
// `new` and `processing` are system-managed transitions only.
export const ticketEditableStatuses = ["open", "resolved", "closed"] as const;

export type TicketEditableStatus = (typeof ticketEditableStatuses)[number];
