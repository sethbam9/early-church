import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import type { ChurchRow } from "../../domain/types";

const STATUS_SHORT: Record<string, string> = {
  attested: "Attested",
  probable: "Probable",
  claimed_tradition: "Tradition",
  not_attested: "Not attested",
  suppressed: "Suppressed",
  unknown: "?",
};

interface CityChronicleProps {
  cityAncient: string;
}

interface RowDiff {
  status?: string;
  polity?: string;
  figures?: string;
  denomination?: string;
  council?: string;
  summary?: string;
}

function computeDiff(prev: ChurchRow | null, cur: ChurchRow): RowDiff {
  const diff: RowDiff = {};
  if (!prev || prev.church_presence_status !== cur.church_presence_status)
    diff.status = STATUS_SHORT[cur.church_presence_status] ?? cur.church_presence_status;
  if (!prev || prev.ruling_empire_polity !== cur.ruling_empire_polity)
    diff.polity = cur.ruling_empire_polity;
  if (!prev || prev.key_figures !== cur.key_figures)
    diff.figures = cur.key_figures_list.join(", ");
  if (!prev || prev.denomination_label_historic !== cur.denomination_label_historic)
    diff.denomination = cur.denomination_label_historic;
  if (cur.council_context && (!prev || prev.council_context !== cur.council_context))
    diff.council = cur.council_context;
  if (cur.evidence_sections.summary && (!prev || prev.evidence_sections.summary !== cur.evidence_sections.summary))
    diff.summary = cur.evidence_sections.summary;
  return diff;
}

export function CityChronicle({ cityAncient }: CityChronicleProps) {
  const activeDecade = useAppStore((s) => s.activeDecade);
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    return dataStore.churchRows
      .getRowsForCity(cityAncient)
      .sort((a, b) => a.year_bucket - b.year_bucket);
  }, [cityAncient]);

  const relatedEvents = useMemo(() => {
    const seen = new Set<string>();
    const results: Array<{ id: string; name: string; year: number }> = [];
    const allEvents = dataStore.events.getAll();
    for (const evt of allEvents) {
      if (evt.city_ancient === cityAncient && !seen.has(evt.id)) {
        seen.add(evt.id);
        results.push({ id: evt.id, name: evt.name_display, year: evt.year_start });
      }
    }
    for (const row of rows) {
      const edgesTo = dataStore.edges.getEdgesTo(row.id, "city");
      for (const edge of edgesTo) {
        if (edge.source_type === "event" && !seen.has(edge.source_id)) {
          seen.add(edge.source_id);
          const evt = dataStore.events.getById(edge.source_id);
          if (evt) results.push({ id: evt.id, name: evt.name_display, year: evt.year_start });
        }
      }
    }
    return results.sort((a, b) => a.year - b.year);
  }, [cityAncient, rows]);

  const relatedPeople = useMemo(() => {
    const peopleSet = new Set<string>();
    for (const row of rows) {
      const edgesTo = dataStore.edges.getEdgesTo(row.id, "city");
      for (const edge of edgesTo) {
        if (edge.source_type === "person") peopleSet.add(edge.source_id);
      }
    }
    return Array.from(peopleSet)
      .map((id) => dataStore.people.getById(id))
      .filter((p) => p !== undefined);
  }, [rows]);

  useEffect(() => {
    if (activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeDecade, cityAncient]);

  if (rows.length === 0) {
    return <p className="muted">No records found for {cityAncient}.</p>;
  }

  const firstRow = rows[0]!;
  const hasDiff = (d: RowDiff) => Object.keys(d).length > 0;

  return (
    <div className="city-chronicle">
      <h2>{cityAncient}</h2>
      <p className="muted">{firstRow.city_modern}, {firstRow.country_modern}</p>

      {relatedPeople.length > 0 && (
        <div className="chronicle-section">
          <h3>Key Figures</h3>
          <div className="entity-chip-list">
            {relatedPeople.map((p) => (
              <button key={p!.id} type="button" className="entity-chip"
                onClick={() => { setSelection({ kind: "person", id: p!.id }); setActiveRightPanel("correspondence"); }}>
                {p!.name_display}
              </button>
            ))}
          </div>
        </div>
      )}

      {relatedEvents.length > 0 && (
        <div className="chronicle-section">
          <h3>Events</h3>
          <div className="entity-chip-list">
            {relatedEvents.map((e) => (
              <button key={e.id} type="button" className="entity-chip"
                onClick={() => { setSelection({ kind: "event", id: e.id }); setActiveRightPanel("events"); }}>
                {e.name} ({e.year})
              </button>
            ))}
          </div>
        </div>
      )}

      <h3>Timeline</h3>
      <div className="chronicle-timeline">
        {rows.map((row, i) => {
          const prev = i > 0 ? rows[i - 1] : null;
          const diff = computeDiff(prev ?? null, row);
          const isActive = row.year_bucket === activeDecade;
          const isEmpty = !hasDiff(diff) && i > 0;

          return (
            <div
              key={row.id}
              ref={isActive ? activeRowRef : undefined}
              className={`chronicle-row ${isActive ? "chronicle-row-active" : ""}`}
            >
              <div className="chronicle-row-header">
                <strong>AD {row.year_bucket}</strong>
                {diff.status && <span className="chronicle-row-change">{diff.status}</span>}
              </div>
              {isEmpty ? (
                <div className="muted">No changes</div>
              ) : (
                <div className="chronicle-row-diffs">
                  {diff.polity && <div className="muted">{diff.polity}</div>}
                  {diff.figures && <div className="chronicle-row-change">Figures: {diff.figures}</div>}
                  {diff.denomination && <div className="chronicle-row-change">Denom: {diff.denomination}</div>}
                  {diff.council && <div className="chronicle-row-change">Council: {diff.council}</div>}
                  {diff.summary && <div className="small">{diff.summary}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
