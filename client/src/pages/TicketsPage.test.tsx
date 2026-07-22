import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Ticket } from "@/types/ticket";

const apiFetch =
  mock<
    (
      path: string,
      init?: { params?: Record<string, string | undefined> },
    ) => Promise<{ tickets: Ticket[]; total: number }>
  >();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { default: TicketsPage } = await import("./TicketsPage");

function selectOption(element: HTMLElement) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element);
}

function renderTicketsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const openTicket: Ticket = {
  id: 1,
  subject: "Can't log into the portal",
  senderEmail: "jane@example.edu",
  senderName: "Jane Student",
  status: "open",
  category: "technical_question",
  createdAt: "2026-02-20T00:00:00.000Z",
};

const uncategorizedTicket: Ticket = {
  id: 2,
  subject: "Refund status",
  senderEmail: "sam@example.edu",
  senderName: "Sam Student",
  status: "resolved",
  category: null,
  createdAt: "2026-01-15T00:00:00.000Z",
};

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("TicketsPage", () => {
  test("shows skeleton rows while the request is pending", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = renderTicketsPage();

    expect(apiFetch).toHaveBeenCalledWith("/api/tickets", {
      params: { sortBy: "createdAt", sortOrder: "desc" },
    });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders a row per ticket with formatted status, category and date once loaded", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 2 }));

    renderTicketsPage();

    expect(await screen.findByText("Can't log into the portal")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    const openRow = rows.find((row) => within(row).queryByText("Can't log into the portal"));
    const uncategorizedRow = rows.find((row) => within(row).queryByText("Refund status"));

    expect(openRow).toBeDefined();
    expect(within(openRow!).getByText("Jane Student")).toBeInTheDocument();
    expect(within(openRow!).getByText("jane@example.edu")).toBeInTheDocument();
    expect(within(openRow!).getByText("Open")).toBeInTheDocument();
    expect(within(openRow!).getByText("Technical Question")).toBeInTheDocument();
    expect(
      within(openRow!).getByText(new Date(openTicket.createdAt).toLocaleDateString()),
    ).toBeInTheDocument();

    expect(uncategorizedRow).toBeDefined();
    expect(within(uncategorizedRow!).getByText("Resolved")).toBeInTheDocument();
    expect(within(uncategorizedRow!).getByText("Uncategorized")).toBeInTheDocument();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });

  test('shows "No tickets found." when the list is empty', async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [], total: 0 }));

    renderTicketsPage();

    expect(await screen.findByText("No tickets found.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows an error alert when the request fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("Forbidden")));

    renderTicketsPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("clicking a column header re-fetches with the new sort params", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 2 }));

    renderTicketsPage();

    await screen.findByText("Can't log into the portal");

    fireEvent.click(screen.getByRole("button", { name: "Subject" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "asc" },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Subject" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "subject", sortOrder: "desc" },
      }),
    );
  });

  test("typing a subject search re-fetches with the subject param after debounce", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 2 }));

    renderTicketsPage();

    await screen.findByText("Can't log into the portal");

    fireEvent.change(screen.getByPlaceholderText("Search subject..."), { target: { value: "refund" } });

    await waitFor(
      () =>
        expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "createdAt", sortOrder: "desc", subject: "refund" },
        }),
      { timeout: 2000 },
    );
  });

  test("selecting a status filter re-fetches with the status param and shows a Clear filters button", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 2 }));

    renderTicketsPage();

    await screen.findByText("Can't log into the portal");

    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    selectOption(await screen.findByRole("option", { name: "Resolved" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", status: "resolved" },
      }),
    );

    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc" },
      }),
    );
  });

  test("clicking page 2 re-fetches with the page param, and shows a Showing X-Y of Z summary", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 25 }));

    renderTicketsPage();

    await screen.findByText("Can't log into the portal");

    expect(screen.getByText("Showing 1-10 of 25 tickets")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", page: "2" },
      }),
    );
  });

  test("changing a filter while on page 2 resets back to page 1", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ tickets: [openTicket, uncategorizedTicket], total: 25 }));

    renderTicketsPage();

    await screen.findByText("Can't log into the portal");

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
        params: { sortBy: "createdAt", sortOrder: "desc", page: "2" },
      }),
    );

    fireEvent.change(screen.getByPlaceholderText("Search subject..."), { target: { value: "refund" } });

    await waitFor(
      () =>
        expect(apiFetch).toHaveBeenLastCalledWith("/api/tickets", {
          params: { sortBy: "createdAt", sortOrder: "desc", subject: "refund" },
        }),
      { timeout: 2000 },
    );
  });
});
