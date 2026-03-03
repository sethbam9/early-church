import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { Work } from "../../domain/types";

const WORK_TYPE_LABELS: Record<string, string> = {
  letter: "Letter",
  apology: "Apology",
  treatise: "Treatise",
  homily: "Homily",
  canon: "Canon",
  creed: "Creed",
  chronicle: "Chronicle",
  inscription: "Inscription",
  rule: "Rule",
  gospel: "Gospel",
  other: "Other",
};

export function WorksPanel() {
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);
  const selection = useAppStore((s) => s.selection);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(
    selection?.kind === "work" ? selection.id : null,
  );

  const allWorks = useMemo(() => {
    return dataStore.works.getAll().sort((a, b) => a.year_written_earliest - b.year_written_earliest);
  }, []);

  const workTypes = useMemo(() => {
    const types = new Set(allWorks.map((w) => w.work_type));
    return Array.from(types).sort();
  }, [allWorks]);

  const filtered = useMemo(() => {
    let works = allWorks;
    if (typeFilter !== "all") {
      works = works.filter((w) => w.work_type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      works = works.filter((w) =>
        [w.title_display, w.author_name_display, w.description, w.language].join(" ").toLowerCase().includes(q),
      );
    }
    return works;
  }, [allWorks, typeFilter, searchQuery]);

  const selectedWork = selectedWorkId ? dataStore.works.getById(selectedWorkId) : null;

  function selectWork(work: Work) {
    setSelectedWorkId(work.id);
    setSelection({ kind: "work", id: work.id });
  }

  return (
    <div className="works-panel">
      <h2>Works & Writings</h2>
      <p className="muted small">Letters, treatises, creeds, chronicles, and other key texts.</p>

      <div className="event-track-filters">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search works..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {workTypes.map((t) => (
            <option key={t} value={t}>{WORK_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <span className="muted small">{filtered.length}</span>
      </div>

      <div className="event-track-list">
        {filtered.map((work) => (
          <div
            key={work.id}
            className={`event-card ${selectedWorkId === work.id ? "event-card-selected" : ""}`}
            onClick={() => selectWork(work)}
          >
            <div className="event-card-header">
              <strong>{work.title_display}</strong>
              <span className="muted small">AD {work.year_written_earliest}{work.year_written_latest !== work.year_written_earliest ? `–${work.year_written_latest}` : ""}</span>
            </div>
            <div className="badge-row">
              <Badge>{WORK_TYPE_LABELS[work.work_type] ?? work.work_type}</Badge>
              <Badge>{work.language}</Badge>
            </div>
            <p className="small muted">{work.author_name_display}</p>
          </div>
        ))}
      </div>

      {selectedWork && (
        <div className="archaeology-detail">
          <h3>{selectedWork.title_display}</h3>
          <div className="badge-row">
            <Badge>{WORK_TYPE_LABELS[selectedWork.work_type] ?? selectedWork.work_type}</Badge>
            <Badge>AD {selectedWork.year_written_earliest}{selectedWork.year_written_latest !== selectedWork.year_written_earliest ? `–${selectedWork.year_written_latest}` : ""}</Badge>
            <Badge>{selectedWork.language}</Badge>
          </div>

          {selectedWork.author_id ? (
            <p>
              <strong>Author: </strong>
              <button type="button" className="entity-chip"
                onClick={() => { setSelection({ kind: "person", id: selectedWork.author_id! }); setActiveRightPanel("correspondence"); }}>
                {selectedWork.author_name_display}
              </button>
            </p>
          ) : (
            <p><strong>Author:</strong> {selectedWork.author_name_display}</p>
          )}

          <p>{selectedWork.description}</p>

          {selectedWork.significance && (
            <>
              <h4>Significance</h4>
              <p className="small">{selectedWork.significance}</p>
            </>
          )}

          {selectedWork.modern_edition_url && (
            <p>
              <a href={selectedWork.modern_edition_url} target="_blank" rel="noreferrer">
                Read online →
              </a>
            </p>
          )}

          <CitationList urls={selectedWork.citations} />
        </div>
      )}
    </div>
  );
}
