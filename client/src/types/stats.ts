export type DailyTicketCount = {
  date: string;
  count: number;
};

export type TicketStats = {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  aiResolvedTickets: number;
  avgResolutionMs: number | null;
  dailyTicketCounts: DailyTicketCount[];
};
