import { useMemo, useState } from "react";
import type { DailyTicketCount } from "@/types/stats";
import { formatDayLong, formatDayShort } from "@/lib/formatDayLabel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TicketsPerDayChartProps = {
  data: DailyTicketCount[] | undefined;
  isPending: boolean;
  error: Error | null;
};

const PLOT_HEIGHT = 160;
const X_LABEL_STEP = 5;

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function TicketsPerDayChart({ data, isPending, error }: TicketsPerDayChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const maxCount = useMemo(() => (data && data.length > 0 ? Math.max(...data.map((d) => d.count)) : 0), [data]);
  const yAxisMax = niceMax(maxCount);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (isPending || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets per day</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton style={{ height: PLOT_HEIGHT + 32 }} className="w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>Tickets per day</CardTitle>
        <CardDescription>Last 30 days</CardDescription>
        <CardAction>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showTable ? "View chart" : "View as table"}
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{formatDayLong(d.date)}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="flex" style={{ height: PLOT_HEIGHT }}>
                <div
                  className="flex flex-col justify-between pr-2 text-right text-xs text-muted-foreground"
                  style={{ width: 32 }}
                >
                  <span>{yAxisMax}</span>
                  <span>{Math.round(yAxisMax / 2)}</span>
                  <span>0</span>
                </div>
                <div className="relative flex flex-1 items-end gap-[2px]">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="border-t border-border" />
                    <div className="border-t border-border" />
                    <div className="border-t border-border/70" />
                  </div>
                  {data.map((d, i) => {
                    const heightPx = yAxisMax > 0 ? (d.count / yAxisMax) * PLOT_HEIGHT : 0;
                    const label = `${formatDayLong(d.date)}: ${d.count} ${d.count === 1 ? "ticket" : "tickets"}`;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className="group relative flex h-full flex-1 items-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chart-1)]"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex((cur) => (cur === i ? null : cur))}
                        onFocus={() => setHoveredIndex(i)}
                        onBlur={() => setHoveredIndex((cur) => (cur === i ? null : cur))}
                        aria-label={label}
                      >
                        <span className="relative mx-auto w-2" style={{ height: heightPx }}>
                          <span className="absolute inset-0 rounded-t-[4px] bg-[var(--chart-1)] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80" />
                          {hoveredIndex === i && (
                            <div
                              role="tooltip"
                              aria-hidden="true"
                              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-sm"
                            >
                              <p className="font-semibold text-foreground">
                                {d.count} {d.count === 1 ? "ticket" : "tickets"}
                              </p>
                              <p className="text-muted-foreground">{formatDayLong(d.date)}</p>
                            </div>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex" style={{ paddingLeft: 32 + 8 }}>
                <div className="flex flex-1">
                  {data.map((d, i) => (
                    <div key={d.date} className="flex-1 text-center text-xs text-muted-foreground">
                      {i % X_LABEL_STEP === 0 || i === data.length - 1 ? formatDayShort(d.date) : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
