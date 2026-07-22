import type { TicketStatus } from "core";
import { statusGlassClass, statusLabel } from "@/lib/ticketLabels";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: TicketStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return <span className={cn(statusGlassClass[status], className)}>{statusLabel[status]}</span>;
}
