import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyTicketCount, TicketStats } from "@/types/stats";
import { formatDayLong, formatDayShort } from "@/lib/formatDayLabel";

const apiFetch = mock<(path: string) => Promise<TicketStats>>();

mock.module("@/lib/api", () => ({
  apiFetch,
}));

const { default: HomePage } = await import("./HomePage");

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

function buildDailyTicketCounts(): DailyTicketCount[] {
  const dates = [
    "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25",
    "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02",
    "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09",
    "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16",
    "2026-07-17", "2026-07-18",
  ];
  return dates.map((date, i) => ({ date, count: i === dates.length - 1 ? 12 : i % 3 }));
}

const dailyTicketCounts = buildDailyTicketCounts();

const stats: TicketStats = {
  totalTickets: 50,
  openTickets: 7,
  resolvedTickets: 30,
  aiResolvedTickets: 21,
  avgResolutionMs: 2 * 60 * 60 * 1000 + 14 * 60 * 1000,
  dailyTicketCounts,
};

beforeEach(() => {
  apiFetch.mockReset();
});

afterEach(() => {
  apiFetch.mockReset();
});

describe("HomePage", () => {
  test("shows skeleton tiles while the request is pending", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = renderHomePage();

    expect(apiFetch).toHaveBeenCalledWith("/api/tickets/stats");
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("renders the five stat tiles once loaded", async () => {
    apiFetch.mockReturnValue(Promise.resolve(stats));

    renderHomePage();

    expect(await screen.findByText("Total Tickets")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    expect(screen.getByText("Open Tickets")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    expect(screen.getByText("Resolved by AI")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();

    expect(screen.getByText("AI resolution Rate")).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();

    expect(screen.getByText("Avg Resolution Time")).toBeInTheDocument();
    expect(screen.getByText("2h 14m")).toBeInTheDocument();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });

  test("renders — for average resolution time when there is no resolved-ticket data yet", async () => {
    apiFetch.mockReturnValue(
      Promise.resolve({
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        aiResolvedTickets: 0,
        avgResolutionMs: null,
        dailyTicketCounts: [],
      }),
    );

    renderHomePage();

    expect(await screen.findByText("—")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  test("shows an error alert when the request fails", async () => {
    apiFetch.mockReturnValue(Promise.reject(new Error("Forbidden")));

    renderHomePage();

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent("Forbidden");
    }
  });

  test("renders the tickets-per-day chart with a bar per day and sparse axis labels", async () => {
    apiFetch.mockReturnValue(Promise.resolve(stats));

    renderHomePage();

    expect(await screen.findByText("Tickets per day")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();

    const lastDay = dailyTicketCounts[dailyTicketCounts.length - 1]!;
    expect(
      screen.getByRole("button", { name: `${formatDayLong(lastDay.date)}: 12 tickets` }),
    ).toBeInTheDocument();

    // y-axis is niceMax(12) = 20, with a midpoint tick at 10
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    // sparse x-axis labels: only every 5th day plus the last day are shown
    expect(screen.getByText(formatDayShort(dailyTicketCounts[0]!.date))).toBeInTheDocument();
    expect(screen.getByText(formatDayShort(lastDay.date))).toBeInTheDocument();
  });

  test("shows a tooltip with the date and count when a bar is focused", async () => {
    apiFetch.mockReturnValue(Promise.resolve(stats));

    renderHomePage();

    const lastDay = dailyTicketCounts[dailyTicketCounts.length - 1]!;
    const bar = await screen.findByRole("button", { name: `${formatDayLong(lastDay.date)}: 12 tickets` });

    expect(screen.queryByText("12 tickets")).not.toBeInTheDocument();

    fireEvent.focus(bar);

    expect(screen.getByText("12 tickets")).toBeInTheDocument();
    expect(screen.getByText(formatDayLong(lastDay.date))).toBeInTheDocument();

    fireEvent.blur(bar);

    expect(screen.queryByText("12 tickets")).not.toBeInTheDocument();
  });

  test("toggles between the chart and a table view", async () => {
    apiFetch.mockReturnValue(Promise.resolve(stats));

    renderHomePage();

    expect(await screen.findByText("Tickets per day")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    const lastDay = dailyTicketCounts[dailyTicketCounts.length - 1]!;
    expect(screen.getByText(formatDayLong(lastDay.date))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View chart" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
