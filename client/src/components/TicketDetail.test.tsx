import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { TicketDetail } from "./TicketDetail";
import type { TicketDetail as TicketDetailData } from "@/types/ticket";

const ticket: TicketDetailData = {
  id: 1,
  subject: "Can't log into the portal",
  body: "I keep getting an invalid password error even after resetting it.",
  senderEmail: "jane@example.edu",
  senderName: "Jane Student",
  status: "open",
  category: "technical_question",
  createdAt: "2026-02-20T00:00:00.000Z",
  assignee: null,
  replies: [
    {
      id: 1,
      body: "Looking into this now.",
      ticketBody: "I keep getting an invalid password error even after resetting it.",
      senderType: "agent",
      createdAt: "2026-02-20T01:00:00.000Z",
      author: { id: "agent-1", name: "Alex Agent", email: "alex@example.edu" },
    },
  ],
};

describe("TicketDetail", () => {
  test("renders the subject, sender, date and message body", () => {
    render(<TicketDetail ticket={ticket} />);

    expect(screen.getByRole("heading", { name: ticket.subject })).toBeInTheDocument();
    expect(screen.getByText(/Jane Student/)).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.edu/)).toBeInTheDocument();
    expect(screen.getByText(new Date(ticket.createdAt).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(ticket.body)).toBeInTheDocument();
  });

  test("does not render replies", () => {
    render(<TicketDetail ticket={ticket} />);

    expect(screen.queryByText(ticket.replies[0]!.body)).not.toBeInTheDocument();
    expect(screen.queryByText(/replies/i)).not.toBeInTheDocument();
  });
});
