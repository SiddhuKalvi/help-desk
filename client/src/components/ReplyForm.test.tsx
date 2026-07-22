import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TicketDetail } from "@/types/ticket";

type ApiFetchInit = { method?: string; body?: unknown; params?: Record<string, string | undefined> };

const apiFetch = mock<(path: string, init?: ApiFetchInit) => Promise<unknown>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { ReplyForm } = await import("./ReplyForm");

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
  replies: [
    {
      id: 1,
      body: "Working on it.",
      ticketBody: "I keep getting an invalid password error even after resetting it.",
      senderType: "agent",
      createdAt: "2026-02-20T03:00:00.000Z",
      author: { id: "agent-1", name: "Alex Agent", email: "alex@example.edu" },
    },
  ],
};

function renderReplyForm(ticketOverride: TicketDetail = ticket) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReplyForm ticket={ticketOverride} />
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

describe("ReplyForm", () => {
  test("renders an empty reply textarea with a disabled submit button", () => {
    renderReplyForm();

    expect(screen.getByRole("textbox", { name: /reply/i })).toHaveValue("");
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
  });

  test("submitting a non-empty reply POSTs to /api/tickets/:id/replies with the trimmed body", async () => {
    apiFetch.mockResolvedValue(ticket);

    renderReplyForm();

    const textarea = screen.getByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: "  Looking into this now.  " } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1/replies", {
        method: "POST",
        body: { body: "Looking into this now." },
      });
    });
  });

  test("clears the textarea after a successful submission", async () => {
    apiFetch.mockResolvedValue(ticket);

    renderReplyForm();

    const textarea = screen.getByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: "Sure, I'll take a look." } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  test("writes the response into the [\"ticket\", ticket.id] query cache on success", async () => {
    const ticket42 = { ...ticket, id: 42 };
    apiFetch.mockResolvedValue(ticket42);

    const { queryClient } = renderReplyForm(ticket42);

    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "Sure, I'll take a look." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(queryClient.getQueryData<TicketDetail>(["ticket", "42"])).toEqual(ticket42);
    });
  });

  test("disables the send button until the reply has non-whitespace content", () => {
    renderReplyForm();

    const sendButton = screen.getByRole("button", { name: /send reply/i });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "   " },
    });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "Looking into it." },
    });
    expect(sendButton).toBeEnabled();
  });

  test("shows an error alert when the submission fails, without clearing the textarea", async () => {
    apiFetch.mockRejectedValue(new Error("Something went wrong"));

    renderReplyForm();

    const textarea = screen.getByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: "Working on it." } });
    fireEvent.click(screen.getByRole("button", { name: /send reply/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Something went wrong")).toBeInTheDocument();
    expect(textarea).toHaveValue("Working on it.");
  });

  test("disables the polish button until the reply has non-whitespace content", () => {
    renderReplyForm();

    const polishButton = screen.getByRole("button", { name: /^polish$/i });
    expect(polishButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "   " },
    });
    expect(polishButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /reply/i }), {
      target: { value: "Looking into it." },
    });
    expect(polishButton).toBeEnabled();
  });

  test("clicking polish POSTs the draft to /api/tickets/:id/replies/polish and replaces the textarea with the response", async () => {
    apiFetch.mockResolvedValue({ body: "Thank you for reaching out. I'm looking into this now." });

    renderReplyForm();

    const textarea = screen.getByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: "lookin into it" } });
    fireEvent.click(screen.getByRole("button", { name: /^polish$/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tickets/1/replies/polish", {
        method: "POST",
        body: { body: "lookin into it" },
      });
    });

    await waitFor(() => {
      expect(textarea).toHaveValue("Thank you for reaching out. I'm looking into this now.");
    });
  });

  test("shows an error alert when polishing fails, without clearing the textarea", async () => {
    apiFetch.mockRejectedValue(new Error("Polish failed"));

    renderReplyForm();

    const textarea = screen.getByRole("textbox", { name: /reply/i });
    fireEvent.change(textarea, { target: { value: "Working on it." } });
    fireEvent.click(screen.getByRole("button", { name: /^polish$/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Polish failed")).toBeInTheDocument();
    expect(textarea).toHaveValue("Working on it.");
  });
});
