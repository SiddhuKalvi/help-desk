-- Computes the dashboard's ticket stats (totals, AI-resolution counts, average
-- resolution time, and a zero-filled daily ticket count series) in a single
-- round trip, instead of the app aggregating them from raw rows.
CREATE OR REPLACE FUNCTION get_ticket_stats(p_ai_agent_id TEXT, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total_tickets INTEGER;
  v_open_tickets INTEGER;
  v_resolved_tickets INTEGER;
  v_ai_resolved_tickets INTEGER;
  v_avg_resolution_ms BIGINT;
  v_daily_ticket_counts JSONB;
  v_range_end DATE := (now() AT TIME ZONE 'UTC')::date;
  v_range_start DATE := (now() AT TIME ZONE 'UTC')::date - (p_days - 1);
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'open'),
    count(*) FILTER (WHERE status = 'resolved'),
    count(*) FILTER (WHERE status = 'resolved' AND "assigneeId" = p_ai_agent_id),
    round(avg(extract(epoch FROM ("resolvedAt" - "createdAt")) * 1000))::bigint
  INTO v_total_tickets, v_open_tickets, v_resolved_tickets, v_ai_resolved_tickets, v_avg_resolution_ms
  FROM "ticket";

  SELECT jsonb_agg(
    jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'), 'count', COALESCE(t.cnt, 0))
    ORDER BY d.day
  )
  INTO v_daily_ticket_counts
  FROM generate_series(v_range_start, v_range_end, interval '1 day') AS d(day)
  LEFT JOIN (
    SELECT date_trunc('day', "createdAt")::date AS day, count(*) AS cnt
    FROM "ticket"
    WHERE "createdAt" >= v_range_start
    GROUP BY 1
  ) t ON t.day = d.day::date;

  RETURN jsonb_build_object(
    'totalTickets', v_total_tickets,
    'openTickets', v_open_tickets,
    'resolvedTickets', v_resolved_tickets,
    'aiResolvedTickets', v_ai_resolved_tickets,
    'avgResolutionMs', v_avg_resolution_ms,
    'dailyTicketCounts', COALESCE(v_daily_ticket_counts, '[]'::jsonb)
  );
END;
$$;
