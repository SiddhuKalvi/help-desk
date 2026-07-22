import type { ReplySenderType, TicketCategory, TicketStatus } from "core";

export type Ticket = {
  id: number;
  subject: string;
  senderEmail: string;
  senderName: string;
  status: TicketStatus;
  category: TicketCategory | null;
  createdAt: string;
};

export type Assignee = {
  id: string;
  name: string;
  email: string;
};

export type Reply = {
  id: number;
  body: string;
  ticketBody: string;
  senderType: ReplySenderType;
  createdAt: string;
  author: Assignee | null;
};

export type TicketDetail = Ticket & {
  body: string;
  assignee: Assignee | null;
  replies: Reply[];
};
