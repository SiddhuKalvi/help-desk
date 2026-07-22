import { TICKET_PAGE_SIZE } from "core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";

type TicketsPaginationProps = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

function getPageNumbers(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push("ellipsis");
    result.push(p);
    previous = p;
  }
  return result;
}

export function TicketsPagination({ page, total, onPageChange }: TicketsPaginationProps) {
  const totalPages = Math.ceil(total / TICKET_PAGE_SIZE);

  if (totalPages <= 1) return null;

  const start = (page - 1) * TICKET_PAGE_SIZE + 1;
  const end = Math.min(page * TICKET_PAGE_SIZE, total);

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {total} tickets
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              <IconChevronLeft className="size-4" />
              <span className="sr-only">Previous page</span>
            </Button>
          </PaginationItem>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <Button
                  variant={p === page ? "outline" : "ghost"}
                  size="icon-sm"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                  <span className="sr-only">
                    {p === page ? ", current page" : ""}
                  </span>
                </Button>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <IconChevronRight className="size-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
