import { useState, useEffect, useMemo } from "react";

const DEFAULT_PAGE_SIZE = 30;

/**
 * Generic pagination hook. Returns page state, current page items, and a
 * Pagination-compatible interface. Automatically resets to page 0 when
 * the items array identity changes.
 */
export function usePaginatedList<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);

  // Reset page when the underlying list changes
  useEffect(() => { setPage(0); }, [items]);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, pageItems, total: items.length, pageSize } as const;
}
