import { useRef, useState, useMemo } from "react";
import type { GraphNode } from "../../utils/forceLayout";
import { KIND_COLORS } from "./entityConstants";
import s from "./PathPickerInput.module.css";

interface PathPickerInputProps {
  placeholder: string;
  query: string;
  setQuery: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  nodes: GraphNode[];
}

export function PathPickerInput({ placeholder, query, setQuery, selectedId, onSelect, onClear, nodes }: PathPickerInputProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAbove, setShowAbove] = useState(false);

  const suggestions = useMemo(() => {
    if (selectedId) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 8);
  }, [query, nodes, selectedId]);

  const handleOpen = () => {
    setOpen(true);
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setShowAbove(rect.top > window.innerHeight / 2);
    }
  };

  return (
    <div className={s.wrap}>
      <input
        ref={inputRef}
        type="text"
        className={s.input}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          handleOpen();
        }}
        onFocus={handleOpen}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {open && suggestions.length > 0 && (
        <div className={`${s.dropdown}${showAbove ? ` ${s.dropdownAbove}` : ""}`}>
          {suggestions.map((n) => (
            <button key={n.id} type="button" className={s.suggestion}
              onMouseDown={() => { onSelect(n.id, n.label); setOpen(false); }}>
              <span className={s.badge} style={{ background: KIND_COLORS[n.kind] ?? "#666" }} />
              <span className={s.label}>{n.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
