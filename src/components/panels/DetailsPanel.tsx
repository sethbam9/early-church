import { useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { ChurchRow } from "../../domain/types";

const PRESENCE_STATUS_LABELS: Record<string, string> = {
  attested: "Attested",
  probable: "Probable",
  claimed_tradition: "Claimed tradition",
  not_attested: "Not attested",
  suppressed: "Suppressed",
  unknown: "Unknown",
};

const LOCATION_PRECISION_LABELS: Record<string, string> = {
  exact: "Exact site",
  approx_city: "Approximate city",
  region_only: "Region only",
  unknown: "Unknown",
};

const FIGURE_LOOKUP_OVERRIDES: Record<string, string> = {
  "ignatius of antioch": "https://en.wikipedia.org/wiki/Ignatius_of_Antioch",
  "polycarp": "https://en.wikipedia.org/wiki/Polycarp",
  "clement of rome": "https://en.wikipedia.org/wiki/Clement_of_Rome",
  "james the just": "https://en.wikipedia.org/wiki/James,_brother_of_Jesus",
  "simeon bar cleophas": "https://en.wikipedia.org/wiki/Simeon_of_Jerusalem",
  "john chrysostom": "https://en.wikipedia.org/wiki/John_Chrysostom",
  "athanasius": "https://en.wikipedia.org/wiki/Athanasius_of_Alexandria",
  "basil the great": "https://en.wikipedia.org/wiki/Basil_of_Caesarea",
  "gregory of nazianzus": "https://en.wikipedia.org/wiki/Gregory_of_Nazianzus",
  "gregory of nyssa": "https://en.wikipedia.org/wiki/Gregory_of_Nyssa",
  "augustine": "https://en.wikipedia.org/wiki/Augustine_of_Hippo",
  "cyril of alexandria": "https://en.wikipedia.org/wiki/Cyril_of_Alexandria",
  "jerome": "https://en.wikipedia.org/wiki/Jerome",
  "eusebius": "https://en.wikipedia.org/wiki/Eusebius",
};

function yearLabel(year: number): string {
  return `AD ${year}`;
}

function canonicalFigureName(figure: string): string {
  return figure.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function makeFigureLookupUrl(figure: string, row: ChurchRow): string {
  const canonical = canonicalFigureName(figure);
  if (FIGURE_LOOKUP_OVERRIDES[canonical]) return FIGURE_LOOKUP_OVERRIDES[canonical];
  const query = `${figure} early christianity ${row.city_ancient} AD ${row.year_bucket}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

function citationsForRow(row: ChurchRow): string[] {
  if (row.citations_valid.length > 0) return row.citations_valid;
  return row.citation_tokens.filter((t) => t.isValid).map((t) => t.value);
}

function samePlace(a: ChurchRow, b: ChurchRow): boolean {
  return a.city_ancient === b.city_ancient && a.city_modern === b.city_modern && a.country_modern === b.country_modern;
}

function pickRowForYear(candidates: ChurchRow[], year: number): ChurchRow | null {
  if (candidates.length === 0) return null;
  const exact = candidates.find((r) => r.year_bucket === year);
  if (exact) return exact;
  const sorted = [...candidates].sort((a, b) => a.year_bucket - b.year_bucket);
  const before = sorted.filter((r) => r.year_bucket <= year);
  if (before.length > 0) return before[before.length - 1] ?? null;
  return sorted[0] ?? null;
}

interface DetailsPanelProps {
  visibleRows: ChurchRow[];
}

export function DetailsPanel({ visibleRows }: DetailsPanelProps) {
  const selection = useAppStore((s) => s.selection);
  const activeDecade = useAppStore((s) => s.activeDecade);
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);

  const selectedRow = useMemo(() => {
    if (selection?.kind !== "city") return null;
    const anchor = dataStore.churchRows.getById(selection.id);
    if (!anchor) return null;
    const candidates = visibleRows.filter((r) => samePlace(r, anchor));
    return pickRowForYear(candidates, activeDecade);
  }, [selection, visibleRows, activeDecade]);

  const selectedArchSite = useMemo(() => {
    if (selection?.kind !== "archaeology") return null;
    return dataStore.archaeology.getById(selection.id);
  }, [selection]);

  if (selectedRow) {
    return (
      <div className="drawer-content">
        <h2>
          {selectedRow.city_ancient}
          <span className="muted"> ({selectedRow.city_modern}, {selectedRow.country_modern})</span>
        </h2>
        <div className="badge-row">
          <Badge>Selected decade: {yearLabel(activeDecade)}</Badge>
          <Badge>Record decade: {yearLabel(selectedRow.year_bucket)}</Badge>
          <Badge>{selectedRow.date_range}</Badge>
          <Badge>{PRESENCE_STATUS_LABELS[selectedRow.church_presence_status]}</Badge>
          <Badge>{LOCATION_PRECISION_LABELS[selectedRow.location_precision]}</Badge>
        </div>
        {selectedRow.year_bucket !== activeDecade && (
          <p className="muted small">
            No exact entry at AD {activeDecade}. Showing closest available record.
          </p>
        )}
        <p><strong>Ruling polity:</strong> {selectedRow.ruling_empire_polity} ({selectedRow.ruling_subdivision || "n/a"})</p>
        <p><strong>Planted by:</strong> {selectedRow.church_planted_by || "unknown"}</p>
        <p><strong>Apostolic thread:</strong> {selectedRow.apostolic_origin_thread || "unknown"}</p>

        <div className="figure-links-block">
          <strong>Key figures:</strong>
          {selectedRow.key_figures_list.length > 0 ? (
            <ul className="figure-link-list">
              {selectedRow.key_figures_list.map((figure) => (
                <li key={figure}>
                  <a href={makeFigureLookupUrl(figure, selectedRow)} target="_blank" rel="noreferrer">
                    {figure}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span> n/a</span>
          )}
        </div>

        <p><strong>Historic denomination:</strong> {selectedRow.denomination_label_historic || "n/a"}</p>
        <p><strong>Modern mapping:</strong> {selectedRow.modern_denom_mapping || "n/a"}</p>
        <p><strong>Council context:</strong> {selectedRow.council_context || "n/a"}</p>

        <h3>Evidence summary</h3>
        <p>{selectedRow.evidence_sections.summary || selectedRow.evidence_notes_and_citations || "n/a"}</p>

        <h3>Uncertainty</h3>
        <p>{selectedRow.evidence_sections.uncertainty || "No explicit uncertainty note."}</p>

        <h3>Evidence notes</h3>
        <p>{selectedRow.evidence_sections.evidence || "No additional evidence segment parsed."}</p>

        <h3>Citations</h3>
        <CitationList urls={citationsForRow(selectedRow)} />

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              setSelection({ kind: "city", id: selectedRow.id });
              setActiveRightPanel("chronicle");
            }}
          >
            View full city timeline →
          </button>
        </div>
      </div>
    );
  }

  if (selectedArchSite) {
    return (
      <div className="drawer-content">
        <h2>{selectedArchSite.name_display}</h2>
        <div className="badge-row">
          <Badge>AD {selectedArchSite.year_start}</Badge>
          <Badge>{selectedArchSite.year_end === null ? "Open-ended" : `through AD ${selectedArchSite.year_end}`}</Badge>
          <Badge>{LOCATION_PRECISION_LABELS[selectedArchSite.location_precision] ?? selectedArchSite.location_precision}</Badge>
        </div>
        <p>{selectedArchSite.description}</p>
        {selectedArchSite.significance && (
          <>
            <h3>Significance</h3>
            <p>{selectedArchSite.significance}</p>
          </>
        )}
        <h3>Uncertainty</h3>
        <p>{selectedArchSite.uncertainty || "No uncertainty note."}</p>
        <h3>Citations</h3>
        <CitationList urls={selectedArchSite.citations} />
      </div>
    );
  }

  return (
    <div className="drawer-content">
      <p className="muted">Select a marker on the map to view details for the current decade.</p>
    </div>
  );
}
