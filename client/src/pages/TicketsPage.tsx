import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import type { TicketCategoryFilter, TicketListStatus } from "core";
import { apiFetch } from "@/lib/api";
import type { Ticket } from "@/types/ticket";
import { TicketsTable } from "@/components/TicketsTable";
import { TicketsFilters } from "@/components/TicketsFilters";
import { TicketsPagination } from "@/components/TicketsPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [status, setStatus] = useState<TicketListStatus | "all">("all");
  const [category, setCategory] = useState<TicketCategoryFilter | "all">("all");
  const [subject, setSubject] = useState("");
  const [sender, setSender] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSubject = useDebouncedValue(subject.trim(), 300);
  const debouncedSender = useDebouncedValue(sender.trim(), 300);

  const sort = sorting[0];
  const hasActiveFilters = status !== "all" || category !== "all" || debouncedSubject !== "" || debouncedSender !== "";

  useEffect(() => {
    setPage(1);
  }, [sort?.id, sort?.desc, status, category, debouncedSubject, debouncedSender]);

  const { data, isPending, error } = useQuery({
    queryKey: ["tickets", sort?.id, sort?.desc, status, category, debouncedSubject, debouncedSender, page],
    queryFn: () =>
      apiFetch<{ tickets: Ticket[]; total: number }>("/api/tickets", {
        params: {
          sortBy: sort?.id,
          sortOrder: sort ? (sort.desc ? "desc" : "asc") : undefined,
          ...(status !== "all" ? { status } : {}),
          ...(category !== "all" ? { category } : {}),
          ...(debouncedSubject ? { subject: debouncedSubject } : {}),
          ...(debouncedSender ? { sender: debouncedSender } : {}),
          ...(page > 1 ? { page: String(page) } : {}),
        },
      }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-4xl font-medium text-foreground">Tickets</h1>
      </div>

      <TicketsFilters
        status={status}
        onStatusChange={setStatus}
        category={category}
        onCategoryChange={setCategory}
        subject={subject}
        onSubjectChange={setSubject}
        sender={sender}
        onSenderChange={setSender}
      />

      <TicketsTable
        tickets={data?.tickets}
        isPending={isPending}
        error={error}
        sorting={sorting}
        onSortingChange={setSorting}
        emptyMessage={hasActiveFilters ? "No tickets match your filters." : "No tickets found."}
      />

      {data && <TicketsPagination page={page} total={data.total} onPageChange={setPage} />}
    </div>
  );
}
