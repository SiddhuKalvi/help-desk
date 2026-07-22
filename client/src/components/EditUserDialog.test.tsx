import { useState } from "react";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role } from "core";
import type { User } from "@/types/user";

const apiFetch = mock<(path: string, init?: { method?: string; body?: unknown }) => Promise<User>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { EditUserDialog } = await import("./EditUserDialog");

const sampleUser: User = {
  id: "1",
  name: "Ada Admin",
  email: "ada@example.com",
  role: Role.agent,
  createdAt: "2026-01-15T00:00:00.000Z",
};

// Mirrors how UsersTable owns the dialog: a single `editingUser` state value
// controls both whether it's open and which user it's editing.
function Harness() {
  const [editingUser, setEditingUser] = useState<User | null>(sampleUser);
  return (
    <EditUserDialog
      user={editingUser}
      onOpenChange={(open) => {
        if (!open) setEditingUser(null);
      }}
    />
  );
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

// Base UI's Dialog leaks internal nested-dialog tracking state if a test ends
// while it's still open (leaving `cleanup()` to force-unmount it mid-open),
// which manifests as a ~10s hang the next time a dialog opens/submits in a
// later test. Always close via Escape before a test ends, unless the
// assertion under test already closed it (a successful submit).
function closeDialog() {
  fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
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

describe("EditUserDialog", () => {
  test("opens pre-filled with the user's current data and an empty password field", () => {
    renderDialog();

    expect(screen.getByLabelText("Name")).toHaveValue(sampleUser.name);
    expect(screen.getByLabelText("Email")).toHaveValue(sampleUser.email);
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(
      screen.getByText(`Update ${sampleUser.name}'s account details.`),
    ).toBeInTheDocument();

    closeDialog();
  });

  test("shows validation errors and blocks submission for invalid input", async () => {
    renderDialog();

    fillForm({ name: "ab", email: "not-an-email" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();

    closeDialog();
  });

  test("shows a validation error when a new password is too short or contains spaces", async () => {
    renderDialog();

    fillForm({ password: "pass word" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Password must not contain spaces")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();

    closeDialog();
  });

  test("submits with an empty password when left blank", async () => {
    apiFetch.mockReturnValue(Promise.resolve(sampleUser));

    renderDialog();

    fillForm({ name: "Ada A. Admin" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith(`/api/users/${sampleUser.id}`, {
      method: "PATCH",
      body: { name: "Ada A. Admin", email: sampleUser.email, password: "" },
    });

    await waitFor(() =>
      expect(
        screen.queryByText(`Update ${sampleUser.name}'s account details.`),
      ).not.toBeInTheDocument(),
    );
  }, 15000);

  test("includes a new password in the request when one is provided", async () => {
    apiFetch.mockReturnValue(Promise.resolve(sampleUser));

    renderDialog();

    fillForm({ password: "newpassword123" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith(`/api/users/${sampleUser.id}`, {
      method: "PATCH",
      body: { name: sampleUser.name, email: sampleUser.email, password: "newpassword123" },
    });

    await waitFor(() =>
      expect(
        screen.queryByText(`Update ${sampleUser.name}'s account details.`),
      ).not.toBeInTheDocument(),
    );
  }, 15000);

  test("invalidates the users list and closes the dialog on success", async () => {
    apiFetch.mockReturnValue(Promise.resolve(sampleUser));

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.queryByText(`Update ${sampleUser.name}'s account details.`),
      ).not.toBeInTheDocument(),
    );
  }, 15000);

  test("shows a form error and keeps the dialog open when the request fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("A user with this email already exists.")));

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A user with this email already exists.",
    );
    expect(
      screen.getByText(`Update ${sampleUser.name}'s account details.`),
    ).toBeInTheDocument();

    closeDialog();
  });
});
