import { ticketCategoryFilters, ticketListStatuses } from "core";
import type { TicketCategoryFilter, TicketListStatus } from "core";
import { IconX } from "@tabler/icons-react";
import { categoryLabel, statusLabel, uncategorizedLabel } from "@/lib/ticketLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TicketsFiltersProps = {
  status: TicketListStatus | "all";
  onStatusChange: (status: TicketListStatus | "all") => void;
  category: TicketCategoryFilter | "all";
  onCategoryChange: (category: TicketCategoryFilter | "all") => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  sender: string;
  onSenderChange: (sender: string) => void;
};

function categoryOptionLabel(value: TicketCategoryFilter): string {
  return value === "uncategorized" ? uncategorizedLabel : categoryLabel[value];
}

const statusItems: Record<TicketListStatus | "all", string> = {
  all: "All statuses",
  ...statusLabel,
};

const categoryItems: Record<TicketCategoryFilter | "all", string> = {
  all: "All categories",
  general_question: categoryLabel.general_question,
  technical_question: categoryLabel.technical_question,
  refund_request: categoryLabel.refund_request,
  uncategorized: uncategorizedLabel,
};

export function TicketsFilters({
  status,
  onStatusChange,
  category,
  onCategoryChange,
  subject,
  onSubjectChange,
  sender,
  onSenderChange,
}: TicketsFiltersProps) {
  const hasActiveFilters = status !== "all" || category !== "all" || subject !== "" || sender !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search subject..."
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        className="w-48"
      />
      <Input
        placeholder="Search sender..."
        value={sender}
        onChange={(e) => onSenderChange(e.target.value)}
        className="w-48"
      />
      <Select items={statusItems} value={status} onValueChange={(value) => onStatusChange(value as TicketListStatus | "all")}>
        <SelectTrigger className="w-36" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {ticketListStatuses.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={categoryItems}
        value={category}
        onValueChange={(value) => onCategoryChange(value as TicketCategoryFilter | "all")}
      >
        <SelectTrigger className="w-44" aria-label="Category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {ticketCategoryFilters.map((c) => (
            <SelectItem key={c} value={c}>
              {categoryOptionLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onStatusChange("all");
            onCategoryChange("all");
            onSubjectChange("");
            onSenderChange("");
          }}
        >
          <IconX className="size-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
