import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types/user";
import { CreateUserDialog } from "@/components/CreateUserDialog";
import { UsersTable } from "@/components/UsersTable";

export default function UsersPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ users: User[] }>("/api/users"),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-4xl font-medium text-foreground">Users</h1>
        <CreateUserDialog />
      </div>

      <UsersTable users={data?.users} isPending={isPending} error={error} />
    </div>
  );
}
