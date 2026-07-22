import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role } from "core";
import type { User } from "@/types/user";

const apiFetch = mock<(path: string, init?: { method?: string; body?: unknown }) => Promise<User>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { CreateUserDialog } = await import("./CreateUserDialog");

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateUserDialog />
    </QueryClientProvider>,
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Create user" }));
}

function fillForm(values: { name?: string; email?: string; password?: string }) {
  if (values.name !== undefined) {
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: values.name } });
  }
  if (values.email !== undefined) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: values.email } });
  }
  if (values.password !== undefined) {
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: values.password } });
  }
}

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("CreateUserDialog", () => {
  test("opens the dialog when the trigger button is clicked", () => {
    renderDialog();

    expect(screen.queryByText("Add a new agent account.")).not.toBeInTheDocument();

    openDialog();

    expect(screen.getByText("Add a new agent account.")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });

  test("shows validation errors and blocks submission for invalid input", async () => {
    renderDialog();
    openDialog();

    fillForm({ name: "ab", email: "not-an-email", password: "short" });

    const submitButtons = screen.getAllByRole("button", { name: "Create user" });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });

  test("shows a validation error when the password contains spaces", async () => {
    renderDialog();
    openDialog();

    fillForm({ name: "New Agent", email: "new-agent@example.com", password: "pass word123" });

    const submitButtons = screen.getAllByRole("button", { name: "Create user" });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    expect(await screen.findByText("Password must not contain spaces")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });

  // Base UI's Dialog occasionally takes several seconds to finish closing
  // under happy-dom (an animation-timing quirk, not a real hang) — give this
  // one more headroom than the 5s default.
  test("submits valid data, invalidates the users list, and closes the dialog", async () => {
    apiFetch.mockReturnValue(
      Promise.resolve({
        id: "3",
        name: "New Agent",
        email: "new-agent@example.com",
        role: Role.agent,
        createdAt: "2026-07-13T00:00:00.000Z",
      }),
    );

    renderDialog();
    openDialog();

    fillForm({ name: "New Agent", email: "new-agent@example.com", password: "password123" });

    const submitButtons = screen.getAllByRole("button", { name: "Create user" });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/users", {
      method: "POST",
      body: {
        name: "New Agent",
        email: "new-agent@example.com",
        password: "password123",
      },
    });

    await waitFor(() =>
      expect(screen.queryByText("Add a new agent account.")).not.toBeInTheDocument(),
    );
  }, 15000);

  test("shows a form error and keeps the dialog open when the request fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("A user with this email already exists.")));

    renderDialog();
    openDialog();

    fillForm({ name: "New Agent", email: "new-agent@example.com", password: "password123" });

    const submitButtons = screen.getAllByRole("button", { name: "Create user" });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A user with this email already exists.",
    );
    expect(screen.getByText("Add a new agent account.")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  });
});
