import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ticketCategories,
  ticketEditableStatuses,
  type TicketCategory,
  type TicketEditableStatus,
  type TicketStatus,
} from "core";
import { apiFetch } from "@/lib/api";
import type { Assignee, TicketDetail as TicketDetailData } from "@/types/ticket";
import { categoryLabel, statusLabel, uncategorizedLabel } from "@/lib/ticketLabels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UNASSIGNED = "unassigned";
const UNCATEGORIZED = "uncategorized";

type UpdateTicketBody = { status: TicketEditableStatus } | { category: TicketCategory | null };

type UpdateTicketProps = {
  ticket: TicketDetailData;
};

export function UpdateTicket({ ticket }: UpdateTicketProps) {
  const queryClient = useQueryClient();

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ agents: Assignee[] }>("/api/users/agents"),
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      apiFetch<TicketDetailData>(`/api/tickets/${ticket.id}/assign`, {
        method: "PATCH",
        body: { assigneeId },
      }),
    onSuccess: (updated) => queryClient.setQueryData(["ticket", String(ticket.id)], updated),
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateTicketBody) =>
      apiFetch<TicketDetailData>(`/api/tickets/${ticket.id}`, { method: "PATCH", body }),
    onSuccess: (updated) => queryClient.setQueryData(["ticket", String(ticket.id)], updated),
  });

  const agents = agentsData?.agents ?? [];
  const assigneeItems: Record<string, string> = {
    [UNASSIGNED]: "Unassigned",
    ...Object.fromEntries(agents.map((a) => [a.id, a.name])),
  };

  const statusItems: Record<TicketStatus, string> = statusLabel;
  const categoryItems: Record<string, string> = {
    ...categoryLabel,
    [UNCATEGORIZED]: uncategorizedLabel,
  };

  const actionError = assignMutation.error ?? updateMutation.error;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Ticket details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select
            items={statusItems}
            value={ticket.status}
            onValueChange={(value) => updateMutation.mutate({ status: value as TicketEditableStatus })}
          >
            <SelectTrigger className="w-full" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ticketEditableStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Category</span>
          <Select
            items={categoryItems}
            value={ticket.category ?? UNCATEGORIZED}
            onValueChange={(value) =>
              updateMutation.mutate({
                category: value === UNCATEGORIZED ? null : (value as TicketCategory),
              })
            }
          >
            <SelectTrigger className="w-full" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED}>{uncategorizedLabel}</SelectItem>
              {ticketCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Assigned to</span>
          <Select
            items={assigneeItems}
            value={ticket.assignee?.id ?? UNASSIGNED}
            onValueChange={(value) =>
              assignMutation.mutate(value === UNASSIGNED ? null : (value as string))
            }
          >
            <SelectTrigger className="w-full" aria-label="Assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {actionError && (
          <Alert variant="destructive">
            <AlertDescription>{actionError.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
