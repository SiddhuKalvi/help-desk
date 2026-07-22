import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { IconArrowDown, IconArrowsSort, IconArrowUp } from "@tabler/icons-react";
import type { Ticket } from "@/types/ticket";
import { categoryLabel, ticketRef, uncategorizedLabel } from "@/lib/ticketLabels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TicketsTableProps = {
  tickets: Ticket[] | undefined;
  isPending: boolean;
  error: Error | null;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  emptyMessage?: string;
};

const columnWidths: Partial<Record<keyof Ticket, string>> = {
  status: "w-28",
  category: "w-44",
  createdAt: "w-28",
};

function columnClassName(columnId: string): string | undefined {
  const width = columnWidths[columnId as keyof Ticket];
  return width ? `${width} text-center` : undefined;
}

function SortableHeader({ label, column }: { label: string; column: Column<Ticket, unknown> }) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5 h-7 gap-1 px-2.5"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === "asc" ? (
        <IconArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <IconArrowDown className="size-3.5" />
      ) : (
        <IconArrowsSort className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

export function TicketsTable({
  tickets,
  isPending,
  error,
  sorting,
  onSortingChange,
  emptyMessage = "No tickets found.",
}: TicketsTableProps) {
  const columns = useMemo<ColumnDef<Ticket>[]>(
    () => [
      {
        accessorKey: "subject",
        header: ({ column }) => <SortableHeader label="Subject" column={column} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticketRef(row.original.id)}</span>
            <Link to={`/tickets/${row.original.id}`}>{row.original.subject}</Link>
          </div>
        ),
      },
      {
        accessorKey: "senderName",
        header: ({ column }) => <SortableHeader label="Sender" column={column} />,
        cell: ({ row }) => (
          <>
            <div>{row.original.senderName}</div>
            <div className="text-sm text-muted-foreground">{row.original.senderEmail}</div>
          </>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader label="Status" column={column} />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "category",
        header: ({ column }) => <SortableHeader label="Category" column={column} />,
        cell: ({ row }) =>
          row.original.category ? (
            <Badge variant="outline" className="w-36">
              {categoryLabel[row.original.category]}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{uncategorizedLabel}</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader label="Created" column={column} />,
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tickets ?? [],
    columns,
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
  });

  let content: React.ReactNode;

  if (error) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  } else if (isPending) {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead className={columnClassName("status")}>Status</TableHead>
            <TableHead className={columnClassName("category")}>Category</TableHead>
            <TableHead className={columnClassName("createdAt")}>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className={columnClassName("status")}>
                <Skeleton className="mx-auto h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell className={columnClassName("category")}>
                <Skeleton className="mx-auto h-5 w-36 rounded-full" />
              </TableCell>
              <TableCell className={columnClassName("createdAt")}>
                <Skeleton className="mx-auto h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  } else if (!tickets || tickets.length === 0) {
    content = <p className="text-muted-foreground">{emptyMessage}</p>;
  } else {
    content = (
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={columnClassName(header.column.id)}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={columnClassName(cell.column.id)}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return content;
}
