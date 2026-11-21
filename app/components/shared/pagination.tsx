import { useState } from "react";

import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 10;

export function usePagedRows<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  return {
    pageRows: rows.slice(start, start + PAGE_SIZE),
    page: current,
    pageCount,
    setPage,
    total: rows.length,
    start,
  };
}

export function Pagination({
  page,
  pageCount,
  total,
  start,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, total);
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Menampilkan {from}-{to} dari {total} data
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Sebelumnya
        </Button>
        <span className="min-w-20 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
