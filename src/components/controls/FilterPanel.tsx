import { useAppStore } from "../../stores/appStore";
import { churchRowRepo } from "../../data/runtimeData";
import type { FilterState } from "../../domain/types";

const PRESENCE_STATUS_LABELS: Record<string, string> = {
  attested: "Attested",
  probable: "Probable",
  claimed_tradition: "Claimed tradition",
  not_attested: "Not attested",
  suppressed: "Suppressed",
  unknown: "Unknown",
};

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((v) => aSet.has(v));
}

export function FilterPanel() {
  const filters = useAppStore((s) => s.filters);
  const toggleFilterValue = useAppStore((s) => s.toggleFilterValue);
  const setAllFilterValues = useAppStore((s) => s.setAllFilterValues);
  const resetFilters = useAppStore((s) => s.resetFilters);

  const facets = churchRowRepo.facets;

  const defaultFilters: FilterState = {
    church_presence_status: facets.church_presence_status,
    ruling_empire_polity: facets.ruling_empire_polity,
    denomination_label_historic: facets.denomination_label_historic,
    modern_denom_mapping: facets.modern_denom_mapping,
  };

  const areDefault =
    sameStringSet(filters.church_presence_status, defaultFilters.church_presence_status) &&
    sameStringSet(filters.ruling_empire_polity, defaultFilters.ruling_empire_polity) &&
    sameStringSet(filters.denomination_label_historic, defaultFilters.denomination_label_historic) &&
    sameStringSet(filters.modern_denom_mapping, defaultFilters.modern_denom_mapping);

  return (
    <section className="control-card">
      <div className="control-card-top">
        <h2>Filters</h2>
        <button type="button" disabled={areDefault} onClick={resetFilters}>Reset</button>
      </div>

      <FacetGroup
        label="Church presence status"
        field="church_presence_status"
        values={facets.church_presence_status}
        selected={filters.church_presence_status}
        displayFn={(v) => PRESENCE_STATUS_LABELS[v] ?? v}
        toggle={toggleFilterValue}
        setAll={setAllFilterValues}
        defaultOpen
      />
      <FacetGroup
        label="Ruling polity"
        field="ruling_empire_polity"
        values={facets.ruling_empire_polity}
        selected={filters.ruling_empire_polity}
        toggle={toggleFilterValue}
        setAll={setAllFilterValues}
      />
      <FacetGroup
        label="Historic denomination"
        field="denomination_label_historic"
        values={facets.denomination_label_historic}
        selected={filters.denomination_label_historic}
        toggle={toggleFilterValue}
        setAll={setAllFilterValues}
      />
      <FacetGroup
        label="Modern denomination"
        field="modern_denom_mapping"
        values={facets.modern_denom_mapping}
        selected={filters.modern_denom_mapping}
        toggle={toggleFilterValue}
        setAll={setAllFilterValues}
      />
    </section>
  );
}

interface FacetGroupProps {
  label: string;
  field: keyof FilterState;
  values: string[];
  selected: string[];
  displayFn?: (v: string) => string;
  toggle: (field: keyof FilterState, value: string) => void;
  setAll: (field: keyof FilterState, values: string[]) => void;
  defaultOpen?: boolean;
}

function FacetGroup({ label, field, values, selected, displayFn, toggle, setAll, defaultOpen }: FacetGroupProps) {
  return (
    <details open={defaultOpen}>
      <summary>{label} ({selected.length})</summary>
      <div className="facet-actions">
        <button type="button" onClick={() => setAll(field, values)}>All</button>
        <button type="button" onClick={() => setAll(field, [])}>None</button>
      </div>
      <div className="facet-list">
        {values.map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => toggle(field, value)}
            />
            {displayFn ? displayFn(value) : value}
          </label>
        ))}
      </div>
    </details>
  );
}
