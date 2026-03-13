/**
 * Shared global entity search overlay.
 * Renders a search input with a dropdown of results.
 * Supports keyboard navigation (arrow keys + Enter to select).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { globalSearch, type GlobalSearchResult } from "../../data/dataStore";
import { kindIcon, kindLabel } from "./entityConstants";
import { SearchInput } from "./SearchInput";
import s from "./GlobalSearchOverlay.module.css";

interface GlobalSearchOverlayProps {
  /** Called when user selects an entity from the results */
  onSelect: (kind: string, id: string) => void;
  /** Optional callback fired whenever the raw query string changes */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function GlobalSearchOverlay({ onSelect, onQueryChange, placeholder = "Search all entities…", className }: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = globalSearch(query);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setShowResults(false);
    setActiveIndex(-1);
  }, []);

  const handleSelect = useCallback((r: GlobalSearchResult) => {
    onSelect(r.kind, r.id);
    clear();
  }, [onSelect, clear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      if (results[idx]) handleSelect(results[idx]);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }, [showResults, results, activeIndex, handleSelect]);

  return (
    <div className={`${s.wrap} ${className ?? ""}`} ref={wrapRef} onKeyDown={handleKeyDown}>
      <SearchInput
        value={query}
        onChange={(v) => { setQuery(v); setShowResults(true); setActiveIndex(-1); onQueryChange?.(v); }}
        onClear={() => { clear(); onQueryChange?.(""); }}
        placeholder={placeholder}
      />
      {showResults && results.length > 0 && (
        <div className={s.dropdown}>
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              className={`${s.result}${i === activeIndex ? ` ${s.resultActive}` : ""}`}
              onClick={() => handleSelect(r)}
            >
              <span className={s.resultIcon}>{kindIcon(r.kind)}</span>
              <span className={s.resultLabel}>{r.label}</span>
              <span className={s.resultKind}>{kindLabel(r.kind)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
