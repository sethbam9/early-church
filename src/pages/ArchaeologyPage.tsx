import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { EntityDetailPanel } from "../components/entity/EntityDetailPanel";

const SITE_ICONS: Record<string, string> = {
  "house-church": "🏠",
  basilica: "⛪",
  catacomb: "🕳",
  inscription: "📝",
  monastery: "🏛",
  baptistery: "💧",
  martyrium: "✝",
  mosaic: "🎨",
  other: "🏺",
};

export function ArchaeologyPage() {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelection = useAppStore((s) => s.setSelection);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeType, setActiveType] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTypes = useMemo(() => ["All", ...dataStore.archaeology.getAllTypes()], []);

  const filtered = useMemo(() => {
    let list = localSearch.trim() ? dataStore.archaeology.search(localSearch) : dataStore.archaeology.getAll();
    if (activeType !== "All") list = list.filter((a) => a.site_type === activeType);
    return list.sort((a, b) => (a.year_start ?? 9999) - (b.year_start ?? 9999));
  }, [localSearch, activeType]);

  const selection: Selection | null = selectedId ? { kind: "archaeology", id: selectedId } : null;

  function handleViewOnMap(id: string) {
    setSelection({ kind: "archaeology", id });
    navigate("/");
  }

  return (
    <div className="entity-page">
      <div className="entity-page-main">
        <div className="entity-page-header">
          <div className="entity-page-title">🏛 Archaeology</div>
          <div className="entity-page-subtitle">Excavation sites, inscriptions, basilicas, and physical evidence</div>
        </div>

        <div className="entity-page-controls">
          <div className="search-input">
            <span style={{ color: "var(--text-faint)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search sites…"
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
                {SITE_ICONS[t] ?? ""} {t}
              </button>
            ))}
          </div>
          <span className="entity-count">{filtered.length} sites</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">🏛</div><div>No sites match.</div></div>
        ) : (
          <div className="entity-grid">
            {filtered.map((site) => {
              const icon = SITE_ICONS[site.site_type] ?? "🏺";
              const near = site.city_id ? dataStore.cities.getById(site.city_id)?.city_label : null;
              const yearStr = site.year_start
                ? site.year_end && site.year_end !== site.year_start
                  ? `AD ${site.year_start}–${site.year_end}`
                  : `AD ${site.year_start}`
                : "";
              return (
                <div
                  key={site.archaeology_id}
                  className={`entity-card${selectedId === site.archaeology_id ? " selected" : ""}`}
                  onClick={() => setSelectedId(site.archaeology_id === selectedId ? null : site.archaeology_id)}
                >
                  <div className="entity-card-header">
                    <div className="entity-card-icon">{icon}</div>
                    <div>
                      <div className="entity-card-title">{site.name_display}</div>
                      <div className="entity-card-meta">
                        {near ? `${near} · ` : ""}{yearStr}
                      </div>
                    </div>
                  </div>
                  {site.description && <div className="entity-card-desc">{site.description}</div>}
                  <div className="entity-card-tags">
                    <span className="tag accent">{site.site_type}</span>
                    <span className="tag">{site.current_status}</span>
                    {site.location_precision !== "exact" && (
                      <span className="tag" style={{ color: "var(--text-faint)" }}>{site.location_precision}</span>
                    )}
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
