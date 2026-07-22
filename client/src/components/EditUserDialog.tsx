import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema, type UpdateUserInput } from "core";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserFormFields } from "@/components/UserFormFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type EditUserDialogProps = {
  user: User | null;
  onOpenChange: (open: boolean) => void;
};

export function EditUserDialog({ user, onOpenChange }: EditUserDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({ resolver: zodResolver(updateUserSchema) });

  useEffect(() => {
    if (user) {
      reset({ name: user.name, email: user.email, password: "" });
      setFormError(null);
    }
  }, [user, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFormError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = async (values: UpdateUserInput) => {
    if (!user) return;
    setFormError(null);
    try {
      await apiFetch<User>(`/api/users/${user.id}`, { method: "PATCH", body: values });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      handleOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user && <>Update {user.name}&apos;s account details.</>}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <UserFormFields
            register={register}
            errors={errors}
            passwordHint="Leave blank to keep the current password."
          />
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
