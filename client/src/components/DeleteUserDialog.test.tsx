import { useState } from "react";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Role } from "core";
import type { User } from "@/types/user";

const apiFetch = mock<(path: string, init?: { method?: string; body?: unknown }) => Promise<void>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { DeleteUserDialog } = await import("./DeleteUserDialog");

const sampleUser: User = {
  id: "1",
  name: "Greg Agent",
  email: "greg@example.com",
  role: Role.agent,
  createdAt: "2026-01-15T00:00:00.000Z",
};

// Mirrors how UsersTable owns the dialog: a single `deletingUser` state value
// controls both whether it's open and which user it's targeting.
function Harness() {
  const [deletingUser, setDeletingUser] = useState<User | null>(sampleUser);
  return (
    <DeleteUserDialog
      user={deletingUser}
      onOpenChange={(open) => {
        if (!open) setDeletingUser(null);
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

// See EditUserDialog.test.tsx for why every test must close the dialog
// (Escape) before ending unless the assertion under test already closed it.
function closeDialog() {
  fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
}

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("DeleteUserDialog", () => {
  test("shows a confirmation message naming the user", () => {
    renderDialog();

    expect(
      screen.getByText(`This will remove ${sampleUser.name} from the system. This can't be undone.`),
    ).toBeInTheDocument();

    closeDialog();
  });

  test("closes without calling apiFetch when Cancel is clicked", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(apiFetch).not.toHaveBeenCalled();
  }, 15000);

  test("deletes the user, invalidates the users list, and closes on success", async () => {
    apiFetch.mockReturnValue(Promise.resolve());

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith(`/api/users/${sampleUser.id}`, { method: "DELETE" });

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  }, 15000);

  test("shows an error and keeps the dialog open when the delete fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("Admin users cannot be deleted.")));

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Admin users cannot be deleted.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    closeDialog();
  });
});
