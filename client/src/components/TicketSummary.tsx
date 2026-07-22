import { useMutation } from "@tanstack/react-query";
import { IconSparkles } from "@tabler/icons-react";
import { apiFetch } from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type TicketSummaryProps = {
  ticket: TicketDetail;
};

export function TicketSummary({ ticket }: TicketSummaryProps) {
  const summaryMutation = useMutation({
    mutationFn: () => apiFetch<{ summary: string }>(`/api/tickets/${ticket.id}/summarize`, { method: "POST" }),
  });

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={summaryMutation.isPending}
        onClick={() => summaryMutation.mutate()}
      >
        <IconSparkles />
        {summaryMutation.isPending ? "Summarizing..." : summaryMutation.data ? "Regenerate summary" : "Summarize"}
      </Button>
      {summaryMutation.error && (
        <Alert variant="destructive">
          <AlertDescription>{summaryMutation.error.message}</AlertDescription>
        </Alert>
      )}
      {summaryMutation.data && (
        <Alert>
          <AlertDescription className="whitespace-pre-wrap">{summaryMutation.data.summary}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
