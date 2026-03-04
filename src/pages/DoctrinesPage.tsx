import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { EntityDetailPanel } from "../components/entity/EntityDetailPanel";

const CONTROVERSY_COLORS: Record<string, string> = {
  low: "var(--attested)",
  medium: "var(--probable)",
  high: "var(--suppressed)",
};

export function DoctrinesPage() {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelection = useAppStore((s) => s.setSelection);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allCategories = useMemo(() => ["All", ...dataStore.doctrines.getAllCategories()], []);

  const filtered = useMemo(() => {
    let list = localSearch.trim() ? dataStore.doctrines.search(localSearch) : dataStore.doctrines.getAll();
    if (activeCategory !== "All") list = list.filter((d) => d.category === activeCategory);
    return list.sort((a, b) => (a.first_attested_year ?? 9999) - (b.first_attested_year ?? 9999));
  }, [localSearch, activeCategory]);

  const selection: Selection | null = selectedId ? { kind: "doctrine", id: selectedId } : null;

  function handleViewOnMap(id: string) {
    setSelection({ kind: "doctrine", id });
    navigate("/");
  }

  return (
    <div className="entity-page">
      <div className="entity-page-main">
        <div className="entity-page-header">
          <div className="entity-page-title">✝ Doctrines</div>
          <div className="entity-page-subtitle">Theological claims and practices attested in primary sources</div>
        </div>

        <div className="entity-page-controls">
          <div className="search-input">
            <span style={{ color: "var(--text-faint)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search doctrines…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          <div className="filter-tabs">
            {allCategories.map((c) => (
              <button
                key={c}
                type="button"
                className={`filter-tab${activeCategory === c ? " active" : ""}`}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="entity-count">{filtered.length} doctrines</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">✝</div><div>No doctrines match.</div></div>
        ) : (
          <div className="entity-grid">
            {filtered.map((d) => {
              const quoteCount = dataStore.quotes.getByDoctrine(d.doctrine_id).length;
              return (
                <div
                  key={d.doctrine_id}
                  className={`entity-card${selectedId === d.doctrine_id ? " selected" : ""}`}
                  onClick={() => setSelectedId(d.doctrine_id === selectedId ? null : d.doctrine_id)}
                >
                  <div className="entity-card-header">
                    <div className="entity-card-icon">✝</div>
                    <div>
                      <div className="entity-card-title">{d.name_display}</div>
                      <div className="entity-card-meta">
                        {d.first_attested_year ? `AD ${d.first_attested_year} · ` : ""}{d.category}
                      </div>
                    </div>
                  </div>
                  {d.description && <div className="entity-card-desc">{d.description}</div>}
                  <div className="entity-card-tags">
                    <span
                      className="tag"
                      style={{ color: CONTROVERSY_COLORS[d.controversy_level], borderColor: CONTROVERSY_COLORS[d.controversy_level] }}
                    >
                      {d.controversy_level} controversy
                    </span>
                    {quoteCount > 0 && <span className="tag accent">{quoteCount} quotes</span>}
                  </div>
                </div>
              );
            })}
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
