import { useRef } from "react";
import { useAppStore } from "../../stores/appStore";

interface SearchBarProps {
  visibleRowCount: number;
  visiblePoiCount: number;
}

export function SearchBar({ visibleRowCount, visiblePoiCount }: SearchBarProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="control-card">
      <label className="field-label" htmlFor="search">Search records</label>
      <input
        id="search"
        ref={inputRef}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="city, figure, polity, denomination, evidence"
      />
      <p className="muted small">{visibleRowCount} visible rows, {visiblePoiCount} visible sites</p>
    </section>
  );
}
