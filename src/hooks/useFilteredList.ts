import { useState, useMemo } from "react";

/**
 * Generic hook for searchable, filterable entity lists.
 * Used by sidebar list components and entity pages.
 */
export function useFilteredList<T>(
  allItems: T[],
  searchFn: (item: T, query: string) => boolean,
  deps: unknown[] = [],
) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => searchFn(item, q));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allItems, ...deps]);

  return { search, setSearch, filtered } as const;
}
