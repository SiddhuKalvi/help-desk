import type { TicketStats } from "@/types/stats";
import { formatDuration } from "@/lib/formatDuration";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardStatsProps = {
  stats: TicketStats | undefined;
  isPending: boolean;
  error: Error | null;
};

export function DashboardStats({ stats, isPending, error }: DashboardStatsProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const aiResolvedPercent =
    stats && stats.resolvedTickets > 0 ? (stats.aiResolvedTickets / stats.resolvedTickets) * 100 : 0;

  const tiles: { label: string; value: string | number | undefined; accent?: string }[] = [
    { label: "Total Tickets", value: stats?.totalTickets },
    { label: "Open Tickets", value: stats?.openTickets, accent: "text-signal-open" },
    { label: "Resolved by AI", value: stats?.aiResolvedTickets, accent: "text-signal-resolved" },
    { label: "AI resolution Rate", value: stats ? `${aiResolvedPercent.toFixed(1)}%` : undefined },
    { label: "Avg Resolution Time", value: stats ? formatDuration(stats.avgResolutionMs) : undefined },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardHeader>
            <CardDescription>{tile.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={`font-mono text-3xl font-semibold ${tile.accent ?? "text-foreground"}`}>
                {tile.value}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
