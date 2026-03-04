import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore } from "../data/dataStore";
import type { Work, Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { EntityDetailPanel } from "../components/entity/EntityDetailPanel";

function yearSpan(w: Work): string {
  if (!w.year_written_start) return "";
  if (!w.year_written_end || w.year_written_end === w.year_written_start) return `AD ${w.year_written_start}`;
  return `AD ${w.year_written_start}–${w.year_written_end}`;
}

export function WorksPage() {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelection = useAppStore((s) => s.setSelection);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeType, setActiveType] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTypes = useMemo(() => ["All", ...dataStore.works.getAllTypes()], []);

  const filtered = useMemo(() => {
    let list = localSearch.trim() ? dataStore.works.search(localSearch) : dataStore.works.getAll();
    if (activeType !== "All") list = list.filter((w) => w.work_type === activeType);
    return list.sort((a, b) => (a.year_written_start ?? 9999) - (b.year_written_start ?? 9999));
  }, [localSearch, activeType]);

  const selection: Selection | null = selectedId ? { kind: "work", id: selectedId } : null;

  function handleViewOnMap(id: string) {
    setSelection({ kind: "work", id });
    navigate("/");
  }

  return (
    <div className="entity-page">
      <div className="entity-page-main">
        <div className="entity-page-header">
          <div className="entity-page-title">📜 Works</div>
          <div className="entity-page-subtitle">Primary source texts — letters, treatises, creeds, canons</div>
        </div>

        <div className="entity-page-controls">
          <div className="search-input">
            <span style={{ color: "var(--text-faint)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search works…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <div className="filter-tabs">
            {allTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={`filter-tab${activeType === t ? " active" : ""}`}
                onClick={() => setActiveType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="entity-count">{filtered.length} works</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">📜</div><div>No works match.</div></div>
        ) : (
          <div className="entity-grid">
            {filtered.map((w) => (
              <div
                key={w.work_id}
                className={`entity-card${selectedId === w.work_id ? " selected" : ""}`}
                onClick={() => setSelectedId(w.work_id === selectedId ? null : w.work_id)}
              >
                <div className="entity-card-header">
                  <div className="entity-card-icon">📜</div>
                  <div>
                    <div className="entity-card-title">{w.title_display}</div>
                    <div className="entity-card-meta">{w.author_name_display} · {yearSpan(w)}</div>
                  </div>
                </div>
                {w.description && <div className="entity-card-desc">{w.description}</div>}
                <div className="entity-card-tags">
                  <span className="tag accent">{w.work_type}</span>
                  {w.language && <span className="tag">{w.language}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selection && (
        <div className="detail-panel">
          <EntityDetailPanel
            selection={selection}
            onClose={() => setSelectedId(null)}
            onNavigateToMap={() => handleViewOnMap(selection.id)}
          />
        </div>
      )}
    </div>
  );
}
