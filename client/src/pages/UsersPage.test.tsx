import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role } from "core";
import type { User } from "@/types/user";

const apiFetch = mock<(path: string) => Promise<{ users: User[] }>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { default: UsersPage } = await import("./UsersPage");

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

const admin: User = {
  id: "1",
  name: "Ada Admin",
  email: "ada@example.com",
  role: Role.admin,
  createdAt: "2026-01-15T00:00:00.000Z",
};

const agent: User = {
  id: "2",
  name: "Greg Agent",
  email: "greg@example.com",
  role: Role.agent,
  createdAt: "2026-02-20T00:00:00.000Z",
};

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("UsersPage", () => {
  test("shows skeleton rows while the request is pending", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = renderUsersPage();

    expect(apiFetch).toHaveBeenCalledWith("/api/users");
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders a row per user with formatted role and date once loaded", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ users: [admin, agent] }));

    renderUsersPage();

    expect(await screen.findByText("Ada Admin")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    const adminRow = rows.find((row) => within(row).queryByText("Ada Admin"));
    const agentRow = rows.find((row) => within(row).queryByText("Greg Agent"));

    expect(adminRow).toBeDefined();
    expect(within(adminRow!).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(adminRow!).getByText(Role.admin)).toBeInTheDocument();
    expect(within(adminRow!).getByText(new Date(admin.createdAt).toLocaleDateString())).toBeInTheDocument();
    expect(within(adminRow!).getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(within(adminRow!).getByRole("button", { name: /delete/i })).toBeDisabled();

    expect(agentRow).toBeDefined();
    expect(within(agentRow!).getByText(Role.agent)).toBeInTheDocument();
    expect(within(agentRow!).getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(within(agentRow!).getByRole("button", { name: /delete/i })).toBeEnabled();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });

  test('shows "No users found." when the list is empty', async () => {
    apiFetch.mockReturnValue(Promise.resolve({ users: [] }));

    renderUsersPage();

    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows an error alert when the request fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("Forbidden")));

    renderUsersPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("shows the create user dialog when the button is clicked", () => {
    apiFetch.mockReturnValue(Promise.resolve({ users: [] }));
    renderUsersPage();

    expect(screen.queryByText("Add a new agent account.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(screen.getByText("Add a new agent account.")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });

  test("hides the dialog when Escape is pressed", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ users: [] }));
    renderUsersPage();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByText("Add a new agent account.")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() =>
      expect(screen.queryByText("Add a new agent account.")).not.toBeInTheDocument(),
    );
  }, 15000);

  test("hides the dialog when clicking outside of it", async () => {
    apiFetch.mockReturnValue(Promise.resolve({ users: [] }));
    renderUsersPage();

    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByText("Add a new agent account.")).toBeInTheDocument();

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    fireEvent.mouseDown(overlay!);
    fireEvent.mouseUp(overlay!);
    fireEvent.click(overlay!);

    await waitFor(() =>
      expect(screen.queryByText("Add a new agent account.")).not.toBeInTheDocument(),
    );
  }, 15000);
});
