import { useAppStore } from "../stores/appStore";

/** Returns the trimmed global search query from the app store. */
export function useSearchQuery(): string {
  return useAppStore((s) => s.searchQuery).trim();
}
