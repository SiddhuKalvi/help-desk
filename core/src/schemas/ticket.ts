import { z } from "zod";
import { ticketListStatuses, ticketEditableStatuses } from "../constants/ticketStatus.ts";
import { ticketCategories } from "../constants/ticketCategory.ts";

export const ticketSortFields = ["subject", "senderName", "status", "category", "createdAt"] as const;
export const ticketCategoryFilters = [...ticketCategories, "uncategorized"] as const;

export const ticketQuerySchema = z.object({
  sortBy: z.enum(ticketSortFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(ticketListStatuses).optional(),
  category: z.enum(ticketCategoryFilters).optional(),
  subject: z.string().trim().min(1).max(255).optional(),
  sender: z.string().trim().min(1).max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type TicketSortField = (typeof ticketSortFields)[number];
export type TicketCategoryFilter = (typeof ticketCategoryFilters)[number];
export type TicketQuery = z.infer<typeof ticketQuerySchema>;

export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const updateTicketSchema = z
  .object({
    status: z.enum(ticketEditableStatuses).optional(),
    category: z.enum(ticketCategories).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.category !== undefined, {
    message: "Provide a status or category to update",
  });

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const createReplySchema = z.object({
  body: z.string().trim().min(1, "Reply body is required"),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const polishReplySchema = z.object({
  body: z.string().trim().min(1, "Reply body is required").max(1000),
});

export type PolishReplyInput = z.infer<typeof polishReplySchema>;
