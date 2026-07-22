import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReplySchema, type CreateReplyInput } from "core";
import { apiFetch } from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ReplyFormProps = {
  ticket: TicketDetail;
};

export function ReplyForm({ ticket }: ReplyFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<CreateReplyInput>({ resolver: zodResolver(createReplySchema) });

  const bodyValue = watch("body");

  const replyMutation = useMutation({
    mutationFn: (body: CreateReplyInput) =>
      apiFetch<TicketDetail>(`/api/tickets/${ticket.id}/replies`, { method: "POST", body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", String(ticket.id)], updated);
      reset();
    },
  });

  const polishMutation = useMutation({
    mutationFn: (body: CreateReplyInput) =>
      apiFetch<{ body: string }>(`/api/tickets/${ticket.id}/replies/polish`, { method: "POST", body }),
    onSuccess: ({ body }) => {
      setValue("body", body, { shouldValidate: true, shouldDirty: true });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => replyMutation.mutate(values))}
      noValidate
      className="space-y-3"
    >
      <Textarea aria-label="Reply" placeholder="Write a reply..." {...register("body")} />
      {(polishMutation.error ?? replyMutation.error) && (
        <Alert variant="destructive">
          <AlertDescription>{(polishMutation.error ?? replyMutation.error)?.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!bodyValue?.trim() || polishMutation.isPending || isSubmitting}
          onClick={() => polishMutation.mutate({ body: bodyValue })}
        >
          {polishMutation.isPending ? "Polishing..." : "Polish"}
        </Button>
        <Button type="submit" disabled={!bodyValue?.trim() || isSubmitting || polishMutation.isPending}>
          {isSubmitting ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
