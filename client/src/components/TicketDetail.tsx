import DOMPurify from "dompurify";
import type { TicketDetail as TicketDetailData } from "@/types/ticket";
import { ticketRef } from "@/lib/ticketLabels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

type TicketDetailProps = {
  ticket: TicketDetailData;
};

export function TicketDetail({ ticket }: TicketDetailProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>{ticketRef(ticket.id)}</span>
          <StatusBadge status={ticket.status} />
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{ticket.subject}</h1>
        <div className="text-sm text-muted-foreground">
          <span>
            {ticket.senderName} &lt;{ticket.senderEmail}&gt;
          </span>
          <span className="mx-1.5">·</span>
          <span>{new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="whitespace-pre-wrap text-foreground"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.body) }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
