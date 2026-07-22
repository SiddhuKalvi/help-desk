import { useState } from "react";
import { Role } from "core";
import type { User } from "@/types/user";
import { EditUserDialog } from "@/components/EditUserDialog";
import { DeleteUserDialog } from "@/components/DeleteUserDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UsersTableProps = {
  users: User[] | undefined;
  isPending: boolean;
  error: Error | null;
};

export function UsersTable({ users, isPending, error }: UsersTableProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  let content: React.ReactNode;

  if (error) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  } else if (isPending) {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-7 w-7 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  } else if (!users || users.length === 0) {
    content = <p className="text-muted-foreground">No users found.</p>;
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === Role.admin ? "default" : "secondary"}>{u.role}</Badge>
              </TableCell>
              <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingUser(u)}>
                  <IconPencil className="size-4" />
                  <span className="sr-only">Edit {u.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeletingUser(u)}
                  disabled={u.role === Role.admin}
                  title={u.role === Role.admin ? "Admin accounts cannot be deleted" : undefined}
                >
                  <IconTrash className="size-4" />
                  <span className="sr-only">Delete {u.name}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <>
      {content}
      <EditUserDialog
        user={editingUser}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
      />
      <DeleteUserDialog
        user={deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
      />
    </>
  );
}
