import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Assignee, Reply, TicketDetail } from "@/types/ticket";

type ApiFetchInit = { method?: string; body?: unknown; params?: Record<string, string | undefined> };

const apiFetch = mock<(path: string, init?: ApiFetchInit) => Promise<unknown>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { default: TicketDetailPage } = await import("./TicketDetailPage");

function renderTicketDetailPage(id = "1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tickets/${id}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ticket: TicketDetail = {
  id: 1,
  subject: "Can't log into the portal",
  body: "I keep getting an invalid password error even after resetting it.",
  senderEmail: "jane@example.edu",
  senderName: "Jane Student",
  status: "open",
  category: "technical_question",
  createdAt: "2026-02-20T00:00:00.000Z",
  assignee: null,
  replies: [],
};

const agents: Assignee[] = [
  { id: "agent-1", name: "Alex Agent", email: "alex@example.edu" },
  { id: "agent-2", name: "Riley Agent", email: "riley@example.edu" },
];

const replies: Reply[] = [
  {
    id: 1,
    body: "Thanks for reaching out, looking into this now.",
    ticketBody: ticket.body,
    senderType: "agent",
    createdAt: "2026-02-20T01:00:00.000Z",
    author: agents[0]!,
  },
  {
    id: 2,
    body: "I tried resetting again and still get the same error.",
    ticketBody: ticket.body,
    senderType: "customer",
    createdAt: "2026-02-20T02:00:00.000Z",
    author: { id: "sender-1", name: "Jane Student", email: "jane@example.edu" },
  },
];

function mockDefaultFetch(overrides: { ticket?: TicketDetail } = {}) {
  const currentTicket = overrides.ticket ?? ticket;
  apiFetch.mockImplementation((path) => {
    if (path === "/api/tickets/1") return Promise.resolve(currentTicket);
    if (path === "/api/users/agents") return Promise.resolve({ agents });
    return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
  });
}

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("TicketDetailPage", () => {
  test("shows a skeleton while the request is pending", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = renderTicketDetailPage();

    expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1");
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders the ticket subject, status, category, sender and body once loaded", async () => {
    mockDefaultFetch();

    renderTicketDetailPage();

    expect(await screen.findByText("Can't log into the portal")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /status/i })).toHaveTextContent("Open");
    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent("Technical Question");
    expect(screen.getByText(/Jane Student/)).toBeInTheDocument();
    expect(screen.getByText(/jane@example.edu/)).toBeInTheDocument();
    expect(screen.getByText(ticket.body)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to tickets/i })).toHaveAttribute("href", "/tickets");
  });

  test("shows an error alert when the request fails", async () => {
    apiFetch.mockImplementation((path) => {
      if (path === "/api/tickets/1") return Promise.reject(new Error("Ticket not found"));
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    renderTicketDetailPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found");
  });

  test("shows an empty state when the ticket has no replies", async () => {
    mockDefaultFetch();

    renderTicketDetailPage();

    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
  });

  test("renders existing replies in chronological order with author, sender type and timestamp", async () => {
    mockDefaultFetch({ ticket: { ...ticket, replies } });

    renderTicketDetailPage();

    const firstBody = await screen.findByText(replies[0]!.body);
    const secondBody = screen.getByText(replies[1]!.body);
    expect(firstBody.compareDocumentPosition(secondBody) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getAllByText("Alex Agent")[0]).toBeInTheDocument();
    expect(screen.getByText("Jane Student", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  test("submitting a reply POSTs to /api/tickets/:id/replies and appends it to the thread", async () => {
    const newReply: Reply = {
      id: 3,
      body: "Sure, I'll take a look right away.",
      ticketBody: ticket.body,
      senderType: "agent",
      createdAt: "2026-02-20T03:00:00.000Z",
      author: agents[0]!,
    };

    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/tickets/1" && !init) return Promise.resolve(ticket);
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1/replies" && init?.method === "POST") {
        return Promise.resolve({ ...ticket, replies: [newReply] });
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    renderTicketDetailPage();

    const textarea = await screen.findByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: newReply.body } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1/replies", {
        method: "POST",
        body: { body: newReply.body },
      });
    });

    expect(await screen.findByText(newReply.body)).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });
});
