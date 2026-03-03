import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { empireRepo } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { Empire } from "../../domain/types";

export function EmpirePanel() {
  const selection = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);
  const activeDecade = useAppStore((s) => s.activeDecade);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmpireId, setSelectedEmpireId] = useState<string | null>(
    selection?.kind === "empire" ? selection.id : null,
  );

  const allEmpires = useMemo(() => {
    return empireRepo.getAll().sort((a, b) => a.year_start - b.year_start);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allEmpires;
    return empireRepo.search(searchQuery);
  }, [allEmpires, searchQuery]);

  const selectedEmpire = selectedEmpireId ? empireRepo.getById(selectedEmpireId) : null;

  function selectEmpire(empire: Empire) {
    setSelectedEmpireId(empire.id);
    setSelection({ kind: "empire", id: empire.id });
  }

  return (
    <div className="doctrine-explorer">
      <h2>Empires & Polities</h2>
      <p className="muted small">
        Ruling powers during the spread of early Christianity.
      </p>

      <div className="event-track-filters">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search empires..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <span className="muted small">{filtered.length}</span>
      </div>

      <div className="doctrine-list">
        {filtered.map((empire) => {
          const isActive = empire.year_start <= activeDecade + 9 && (empire.year_end === null || empire.year_end >= activeDecade);
          return (
            <button
              key={empire.id}
              type="button"
              className={`doctrine-item ${selectedEmpireId === empire.id ? "doctrine-item-selected" : ""}`}
              onClick={() => selectEmpire(empire)}
            >
              <strong>{empire.name_display}</strong>
              <span className="muted small"> — {empire.region}</span>
              {isActive && <Badge>Active</Badge>}
            </button>
          );
        })}
      </div>

      {selectedEmpire && (
        <div className="doctrine-detail">
          <h3>{selectedEmpire.name_display}</h3>
          <div className="badge-row">
            <Badge>AD {selectedEmpire.year_start}–{selectedEmpire.year_end ?? "present"}</Badge>
            <Badge>{selectedEmpire.region}</Badge>
            <Badge>Capital: {selectedEmpire.capital}</Badge>
          </div>
          <p>{selectedEmpire.description}</p>
          {selectedEmpire.wikipedia_url && (
            <p><a href={selectedEmpire.wikipedia_url} target="_blank" rel="noreferrer">Wikipedia →</a></p>
          )}
          <CitationList urls={selectedEmpire.citations} />
        </div>
      )}
    </div>
  );
}
