import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { TicketStats } from "@/types/stats";
import { DashboardStats } from "@/components/DashboardStats";
import { TicketsPerDayChart } from "@/components/TicketsPerDayChart";

export default function HomePage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["ticket-stats"],
    queryFn: () => apiFetch<TicketStats>("/api/tickets/stats"),
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 font-heading text-4xl font-medium text-foreground">Dashboard</h1>
      <DashboardStats stats={data} isPending={isPending} error={error} />
      <div className="mt-6">
        <TicketsPerDayChart data={data?.dailyTicketCounts} isPending={isPending} error={error} />
      </div>
    </div>
  );
}
