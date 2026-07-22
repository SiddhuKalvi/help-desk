import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Assignee, TicketDetail } from "@/types/ticket";

type ApiFetchInit = { method?: string; body?: unknown; params?: Record<string, string | undefined> };

const apiFetch = mock<(path: string, init?: ApiFetchInit) => Promise<unknown>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { UpdateTicket } = await import("./UpdateTicket");

function selectOption(element: HTMLElement) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element);
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

function renderUpdateTicket(ticketOverride: TicketDetail = ticket) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <UpdateTicket ticket={ticketOverride} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("UpdateTicket", () => {
  test("renders the ticket's status and category", async () => {
    apiFetch.mockResolvedValue({ agents });

    renderUpdateTicket();

    expect(await screen.findByRole("combobox", { name: /status/i })).toHaveTextContent("Open");
    expect(screen.getByRole("combobox", { name: /category/i })).toHaveTextContent("Technical Question");
  });

  test("shows Uncategorized when the ticket has no category", async () => {
    apiFetch.mockResolvedValue({ agents });

    renderUpdateTicket({ ...ticket, category: null });

    expect(await screen.findByRole("combobox", { name: /category/i })).toHaveTextContent("Uncategorized");
  });

  test("shows Unassigned when the ticket has no assignee", async () => {
    apiFetch.mockResolvedValue({ agents });

    renderUpdateTicket();

    expect(await screen.findByRole("combobox", { name: /assignee/i })).toHaveTextContent("Unassigned");
  });

  test("shows the assignee's name when the ticket is already assigned", async () => {
    apiFetch.mockResolvedValue({ agents });

    renderUpdateTicket({ ...ticket, assignee: agents[0]! });

    expect(await screen.findByRole("combobox", { name: /assignee/i })).toHaveTextContent("Alex Agent");
  });

  test("assigning an agent PATCHes the ticket and writes the updated assignee into the query cache", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1/assign" && init?.method === "PATCH") {
        return Promise.resolve({ ...ticket, assignee: agents[0]! });
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    const { queryClient } = renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /assignee/i });
    expect(select).toHaveTextContent("Unassigned");

    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Alex Agent" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1/assign", {
        method: "PATCH",
        body: { assigneeId: "agent-1" },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TicketDetail>(["ticket", "1"])).toEqual({
        ...ticket,
        assignee: agents[0]!,
      });
    });
  });

  test("shows an error alert when assigning fails", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1/assign" && init?.method === "PATCH") {
        return Promise.reject(new Error("Assignee must be an active agent."));
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /assignee/i });
    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Alex Agent" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Assignee must be an active agent.")).toBeInTheDocument();
  });

  test("changing status PATCHes the ticket and writes the updated status into the query cache", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1" && init?.method === "PATCH") {
        return Promise.resolve({ ...ticket, status: "resolved" });
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    const { queryClient } = renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /status/i });
    expect(select).toHaveTextContent("Open");

    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Resolved" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1", {
        method: "PATCH",
        body: { status: "resolved" },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TicketDetail>(["ticket", "1"])).toEqual({
        ...ticket,
        status: "resolved",
      });
    });
  });

  test("changing category PATCHes the ticket and writes the updated category into the query cache", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1" && init?.method === "PATCH") {
        return Promise.resolve({ ...ticket, category: "refund_request" });
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    const { queryClient } = renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /category/i });
    expect(select).toHaveTextContent("Technical Question");

    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Refund Request" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1", {
        method: "PATCH",
        body: { category: "refund_request" },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TicketDetail>(["ticket", "1"])).toEqual({
        ...ticket,
        category: "refund_request",
      });
    });
  });

  test("setting category to Uncategorized PATCHes the ticket with a null category", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1" && init?.method === "PATCH") {
        return Promise.resolve({ ...ticket, category: null });
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    const { queryClient } = renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /category/i });
    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Uncategorized" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1", {
        method: "PATCH",
        body: { category: null },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TicketDetail>(["ticket", "1"])).toEqual({
        ...ticket,
        category: null,
      });
    });
  });

  test("shows an error alert when updating status fails", async () => {
    apiFetch.mockImplementation((path, init) => {
      if (path === "/api/users/agents") return Promise.resolve({ agents });
      if (path === "/api/tickets/1" && init?.method === "PATCH") {
        return Promise.reject(new Error("Ticket not found"));
      }
      return Promise.reject(new Error(`Unhandled apiFetch call: ${path}`));
    });

    renderUpdateTicket();

    const select = await screen.findByRole("combobox", { name: /status/i });
    selectOption(select);
    selectOption(await screen.findByRole("option", { name: "Resolved" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Ticket not found")).toBeInTheDocument();
  });
});
