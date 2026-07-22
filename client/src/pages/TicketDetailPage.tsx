import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { TicketDetail as TicketDetailData } from "@/types/ticket";
import { senderTypeLabel, senderTypeVariant } from "@/lib/ticketLabels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/BackLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReplyForm } from "@/components/ReplyForm";
import { TicketDetail } from "@/components/TicketDetail";
import { TicketSummary } from "@/components/TicketSummary";
import { UpdateTicket } from "@/components/UpdateTicket";
import { Skeleton } from "@/components/ui/skeleton";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isPending, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch<TicketDetailData>(`/api/tickets/${id}`),
  });

  return (
    <div className="p-8">
      <BackLink to="/tickets">Back to tickets</BackLink>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-36 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <TicketDetail ticket={ticket} />

          <TicketSummary ticket={ticket} />

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-6 md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Replies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticket.replies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No replies yet.</p>
                  ) : (
                    ticket.replies.map((reply, index) => (
                      <div
                        key={reply.id}
                        className={index > 0 ? "border-t border-border pt-4" : undefined}
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{reply.author?.name ?? senderTypeLabel[reply.senderType]}</span>
                          <Badge variant={senderTypeVariant[reply.senderType]}>
                            {senderTypeLabel[reply.senderType]}
                          </Badge>
                          <span>{new Date(reply.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-foreground">{reply.body}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add a reply</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReplyForm ticket={ticket} />
                </CardContent>
              </Card>
            </div>

            <UpdateTicket ticket={ticket} />
          </div>
        </div>
      )}
    </div>
  );
}
