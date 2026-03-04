import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { EntityDetailPanel } from "../components/entity/EntityDetailPanel";

const EVENT_ICONS: Record<string, string> = {
  council: "⚖",
  martyrdom: "✝",
  persecution: "🔥",
  political: "⚔",
  missionary: "🌍",
  liturgical: "🕯",
  schism: "⚡",
  other: "📌",
};

export function EventsPage() {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelection = useAppStore((s) => s.setSelection);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeType, setActiveType] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allTypes = useMemo(() => ["All", ...dataStore.events.getAllTypes()], []);

  const filtered = useMemo(() => {
    let list = localSearch.trim() ? dataStore.events.search(localSearch) : dataStore.events.getAll();
    if (activeType !== "All") list = list.filter((e) => e.event_type === activeType);
    return list.sort((a, b) => (a.year_start ?? 9999) - (b.year_start ?? 9999));
  }, [localSearch, activeType]);

  const selection: Selection | null = selectedId ? { kind: "event", id: selectedId } : null;

  function handleViewOnMap(id: string) {
    setSelection({ kind: "event", id });
    navigate("/");
  }

  return (
    <div className="entity-page">
      <div className="entity-page-main">
        <div className="entity-page-header">
          <div className="entity-page-title">⚡ Events</div>
          <div className="entity-page-subtitle">Councils, persecutions, martyrdoms, and pivotal moments</div>
        </div>

        <div className="entity-page-controls">
          <div className="search-input">
            <span style={{ color: "var(--text-faint)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search events…"
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
                {EVENT_ICONS[t] ?? ""} {t}
              </button>
            ))}
          </div>
          <span className="entity-count">{filtered.length} events</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">⚡</div><div>No events match.</div></div>
        ) : (
          <div className="entity-grid">
            {filtered.map((ev) => {
              const yearStr = ev.year_start
                ? ev.year_end && ev.year_end !== ev.year_start
                  ? `AD ${ev.year_start}–${ev.year_end}`
                  : `AD ${ev.year_start}`
                : "";
              const icon = EVENT_ICONS[ev.event_type] ?? "📌";
              return (
                <div
                  key={ev.event_id}
                  className={`entity-card${selectedId === ev.event_id ? " selected" : ""}`}
                  onClick={() => setSelectedId(ev.event_id === selectedId ? null : ev.event_id)}
                >
                  <div className="entity-card-header">
                    <div className="entity-card-icon">{icon}</div>
                    <div>
                      <div className="entity-card-title">{ev.name_display}</div>
                      <div className="entity-card-meta">{yearStr}{ev.region ? ` · ${ev.region}` : ""}</div>
                    </div>
                  </div>
                  {ev.description && <div className="entity-card-desc">{ev.description}</div>}
                  <div className="entity-card-tags">
                    <span className="tag accent">{ev.event_type}</span>
                    {ev.key_figure_person_ids.length > 0 && (
                      <span className="tag">{ev.key_figure_person_ids.length} key figures</span>
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
