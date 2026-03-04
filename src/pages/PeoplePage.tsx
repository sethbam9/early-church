import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore } from "../data/dataStore";
import type { Person, Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { EntityDetailPanel } from "../components/entity/EntityDetailPanel";

function yearSpan(p: Person): string {
  if (!p.birth_year && !p.death_year) return "";
  const b = p.birth_year ? `b. ${p.birth_year}` : "";
  const d = p.death_year ? `d. ${p.death_year}` : "";
  return [b, d].filter(Boolean).join(" · ");
}

export function PeoplePage() {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelection = useAppStore((s) => s.setSelection);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeRole, setActiveRole] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allRoles = useMemo(() => ["All", ...dataStore.people.getAllRoles()], []);

  const filtered = useMemo(() => {
    let list = localSearch.trim() ? dataStore.people.search(localSearch) : dataStore.people.getAll();
    if (activeRole !== "All") {
      list = list.filter((p) => p.roles.some((r) => r.toLowerCase() === activeRole.toLowerCase()));
    }
    return list.sort((a, b) => {
      const ay = a.birth_year ?? a.death_year ?? 9999;
      const by = b.birth_year ?? b.death_year ?? 9999;
      return ay - by || a.person_label.localeCompare(b.person_label);
    });
  }, [localSearch, activeRole]);

  const selection: Selection | null = selectedId ? { kind: "person", id: selectedId } : null;

  function handleCardClick(id: string) {
    setSelectedId(id === selectedId ? null : id);
  }

  function handleViewOnMap(id: string) {
    setSelection({ kind: "person", id });
    navigate("/");
  }

  return (
    <div className="entity-page">
      <div className="entity-page-main">
        <div className="entity-page-header">
          <div className="entity-page-title">👤 People</div>
          <div className="entity-page-subtitle">
            Historical figures — bishops, theologians, martyrs, apostles
          </div>
        </div>

        <div className="entity-page-controls">
          <div className="search-input">
            <span style={{ color: "var(--text-faint)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search people…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>

          <div className="filter-tabs">
            {allRoles.slice(0, 8).map((role) => (
              <button
                key={role}
                type="button"
                className={`filter-tab${activeRole === role ? " active" : ""}`}
                onClick={() => setActiveRole(role)}
              >
                {role}
              </button>
            ))}
          </div>

          <span className="entity-count">{filtered.length} people</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👤</div>
            <div>No people match your search.</div>
          </div>
        ) : (
          <div className="entity-grid">
            {filtered.map((person) => (
              <div
                key={person.person_id}
                className={`entity-card${selectedId === person.person_id ? " selected" : ""}`}
                onClick={() => handleCardClick(person.person_id)}
              >
                <div className="entity-card-header">
                  <div className="entity-card-icon">👤</div>
                  <div>
                    <div className="entity-card-title">{person.person_label}</div>
                    <div className="entity-card-meta">{yearSpan(person)}</div>
                  </div>
                </div>
                {person.description && (
                  <div className="entity-card-desc">{person.description}</div>
                )}
                <div className="entity-card-tags">
                  {person.roles.slice(0, 3).map((r) => (
                    <span key={r} className="tag accent">{r}</span>
                  ))}
                  {person.death_type === "martyr" && (
                    <span className="tag" style={{ color: "var(--suppressed)", borderColor: "var(--suppressed)" }}>martyr</span>
                  )}
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
