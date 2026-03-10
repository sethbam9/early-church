/**
 * Reusable filter chip bar for sidebar list tabs.
 * Each tab provides its own filter options; this component renders them uniformly.
 */

interface FilterChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  active: T | null;
  onChange: (value: T | null) => void;
}

export function FilterChips<T extends string>({ label, options, active, onChange }: FilterChipsProps<T>) {
  if (options.length === 0) return null;

  return (
    <div className="list-filter-bar" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="faint" style={{ fontSize: "0.72rem" }}>{label}</span>
        {active && (
          <button
            type="button"
            className="section-label-action"
            onClick={() => onChange(null)}
            style={{ fontSize: "0.68rem" }}
          >
            clear
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`pchip${active === opt.value ? " active" : ""}`}
            onClick={() => onChange(active === opt.value ? null : opt.value)}
            style={{ fontSize: "0.7rem", padding: "2px 8px" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
