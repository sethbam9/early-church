import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { denominationRepo } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { Denomination } from "../../domain/types";

const TRADITION_LABELS: Record<string, string> = {
  mainstream: "Mainstream",
  heterodox: "Heterodox",
  schismatic: "Schismatic",
};

export function DenominationPanel() {
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);

  const [searchQuery, setSearchQuery] = useState("");
  const [traditionFilter, setTraditionFilter] = useState<string>("all");
  const [selectedDenomId, setSelectedDenomId] = useState<string | null>(
    selection?.kind === "denomination" ? selection.id : null,
  );

  const allDenoms = useMemo(() => {
    return denominationRepo.getAll().sort((a, b) => a.year_start - b.year_start);
  }, []);

  const traditions = useMemo(() => {
    const t = new Set(allDenoms.map((d) => d.tradition));
    return Array.from(t).sort();
  }, [allDenoms]);

  const filtered = useMemo(() => {
    let denoms = allDenoms;
    if (traditionFilter !== "all") denoms = denoms.filter((d) => d.tradition === traditionFilter);
    if (searchQuery.trim()) {
      denoms = denominationRepo.search(searchQuery).filter((d) =>
        traditionFilter === "all" || d.tradition === traditionFilter,
      );
    }
    return denoms;
  }, [allDenoms, traditionFilter, searchQuery]);

  const selectedDenom = selectedDenomId ? denominationRepo.getById(selectedDenomId) : null;

  function selectDenom(denom: Denomination) {
    setSelectedDenomId(denom.id);
    setSelection({ kind: "denomination", id: denom.id });
  }

  return (
    <div className="doctrine-explorer">
      <h2>Denominations & Movements</h2>
      <p className="muted small">
        Christian traditions, heresies, and schisms from the apostolic era through AD 800.
      </p>

      <div className="event-track-filters">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search denominations..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={traditionFilter} onChange={(e) => setTraditionFilter(e.target.value)}>
          <option value="all">All traditions</option>
          {traditions.map((t) => (
            <option key={t} value={t}>{TRADITION_LABELS[t] ?? t}</option>
          ))}
        </select>
        <span className="muted small">{filtered.length}</span>
      </div>

      <div className="doctrine-list">
        {filtered.map((denom) => (
          <button
            key={denom.id}
            type="button"
            className={`doctrine-item ${selectedDenomId === denom.id ? "doctrine-item-selected" : ""}`}
            onClick={() => selectDenom(denom)}
          >
            <strong>{denom.name_display}</strong>
            <span className="muted small"> — {TRADITION_LABELS[denom.tradition] ?? denom.tradition}</span>
            {denom.year_end !== null && <Badge>Extinct</Badge>}
          </button>
        ))}
      </div>

      {selectedDenom && (
        <div className="doctrine-detail">
          <h3>{selectedDenom.name_display}</h3>
          <div className="badge-row">
            <Badge>{TRADITION_LABELS[selectedDenom.tradition] ?? selectedDenom.tradition}</Badge>
            <Badge>Founded: AD {selectedDenom.year_start}</Badge>
            {selectedDenom.year_end !== null && <Badge>Ended: AD {selectedDenom.year_end}</Badge>}
          </div>

          {selectedDenom.founder && (
            <p><strong>Founder:</strong> {selectedDenom.founder}</p>
          )}

          {selectedDenom.parent_tradition && selectedDenom.parent_tradition !== "none" && (
            <p><strong>Parent tradition:</strong> {selectedDenom.parent_tradition}</p>
          )}

          <p>{selectedDenom.description}</p>

          {selectedDenom.modern_descendants && selectedDenom.modern_descendants !== "none (extinct)" && (
            <p><strong>Modern descendants:</strong> {selectedDenom.modern_descendants}</p>
          )}

          {selectedDenom.wikipedia_url && (
            <p><a href={selectedDenom.wikipedia_url} target="_blank" rel="noreferrer">Wikipedia →</a></p>
          )}
          <CitationList urls={selectedDenom.citations} />
        </div>
      )}
    </div>
  );
}
