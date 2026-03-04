import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import type { SidebarTab, PlacesSubTab } from "../../stores/appStore";
import { CityDetail } from "./CityDetail";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { getAllEssays, type Essay } from "../../data/essayLoader";

// ─── Shared search highlight utility ─────────────────────────────────────────

function Hl({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(26,122,92,0.25)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: SidebarTab; icon: string; label: string }[] = [
  { id: "places",      icon: "🏛",  label: "Places" },
  { id: "persuasions", icon: "✦",  label: "Persuasions" },
  { id: "polities",    icon: "⚔",  label: "Polities" },
  { id: "people",      icon: "👤", label: "People" },
  { id: "doctrines",   icon: "📖", label: "Doctrines" },
  { id: "events",      icon: "⚡",  label: "Events" },
  { id: "works",       icon: "📜", label: "Works" },
  { id: "essays",      icon: "✍",  label: "Essays" },
];

// ─── RightSidebar ─────────────────────────────────────────────────────────────

interface RightSidebarProps {
  onFlyToCity: (cityId: string) => void;
  currentDecade: number;
}

export function RightSidebar({ onFlyToCity, currentDecade }: RightSidebarProps) {
  const sidebarTab       = useAppStore((s) => s.sidebarTab);
  const sidebarPlacesSub = useAppStore((s) => s.sidebarPlacesSubTab);
  const sidebarExpanded  = useAppStore((s) => s.sidebarExpanded);
  const sidebarSearch    = useAppStore((s) => s.sidebarSearch);
  const selection        = useAppStore((s) => s.selection);
  const mapFilterType    = useAppStore((s) => s.mapFilterType);
  const mapFilterId      = useAppStore((s) => s.mapFilterId);

  const setSidebarTab      = useAppStore((s) => s.setSidebarTab);
  const setSidebarPlacesSub= useAppStore((s) => s.setSidebarPlacesSubTab);
  const toggleExpanded     = useAppStore((s) => s.toggleSidebarExpanded);
  const setSidebarSearch   = useAppStore((s) => s.setSidebarSearch);
  const setSelection       = useAppStore((s) => s.setSelection);
  const setMapFilter       = useAppStore((s) => s.setMapFilter);
  const clearMapFilter     = useAppStore((s) => s.clearMapFilter);
  const toggleRightPanel   = useAppStore((s) => s.toggleRightPanel);
  const pushSelection      = useAppStore((s) => s.pushSelection);
  const popSelection       = useAppStore((s) => s.popSelection);
  const selectionHistory   = useAppStore((s) => s.selectionHistory);

  // Doctrines sub-tab (doctrines vs quotes) — tracked here to update search placeholder
  const [doctrineSubTab, setDoctrineSubTab] = useState<"doctrines" | "quotes">("doctrines");

  // Selected essay for the Essays tab
  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  // Essay we navigated away from (to restore on back)
  const [prevEssay, setPrevEssay] = useState<Essay | null>(null);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [essaysLoading, setEssaysLoading] = useState(true);

  // Load essays on mount
  useEffect(() => {
    getAllEssays().then(loaded => {
      setEssays(loaded);
      setEssaysLoading(false);
    });
  }, []);

  const handleEntitySelect = (kind: string, id: string) => {
    if (selectedEssay) {
      // Remember the essay so back can return to it
      setPrevEssay(selectedEssay);
      setSelectedEssay(null);
    }
    pushSelection({ kind: kind as Selection["kind"], id });
  };

  const handleBack = () => {
    // If we came from an essay, restore it
    if (prevEssay) {
      setSelectedEssay(prevEssay);
      setPrevEssay(null);
      setSelection(null);
      return;
    }
    if (selectionHistory.length > 0) {
      popSelection();
    } else {
      setSelection(null);
    }
  };

  // ── Entity detail routing ────────────────────────────────────────────────

  if (selection?.kind === "quote") {
    return (
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
        <QuoteDetail quoteId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </SidebarShell>
    );
  }

  if (selection?.kind === "city") {
    return (
      <SidebarShell
        expanded={sidebarExpanded}
        onToggleExpand={toggleExpanded}
        onDismiss={toggleRightPanel}
      >
        <CityDetail
          cityId={selection.id}
          onBack={handleBack}
          onSelectEntity={handleEntitySelect}
        />
      </SidebarShell>
    );
  }

  if (selection) {
    return (
      <SidebarShell
        expanded={sidebarExpanded}
        onToggleExpand={toggleExpanded}
        onDismiss={toggleRightPanel}
      >
        <EntityDetail
          key={`${selection.kind}:${selection.id}`}
          kind={selection.kind}
          id={selection.id}
          onBack={handleBack}
          onSelectEntity={handleEntitySelect}
          mapFilterType={mapFilterType}
          mapFilterId={mapFilterId}
          setMapFilter={setMapFilter}
          clearMapFilter={clearMapFilter}
          currentDecade={currentDecade}
        />
      </SidebarShell>
    );
  }

  if (selectedEssay) {
    return (
      <SidebarShell
        expanded={sidebarExpanded}
        onToggleExpand={toggleExpanded}
        onDismiss={toggleRightPanel}
      >
        <EssayView
          essay={selectedEssay}
          onBack={() => setSelectedEssay(null)}
          onSelectEntity={handleEntitySelect}
        />
      </SidebarShell>
    );
  }

  // ── List views ──────────────────────────────────────────────────────────

  return (
    <SidebarShell
      expanded={sidebarExpanded}
      onToggleExpand={toggleExpanded}
      onDismiss={toggleRightPanel}
    >
      {/* Tab bar */}
      <div className="sidebar-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sidebar-tab${sidebarTab === t.id ? " active" : ""}`}
            onClick={() => setSidebarTab(t.id)}
            title={t.label}
          >
            <span className="sidebar-tab-icon">{t.icon}</span>
            <span className="sidebar-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="sidebar-toolbar">
        <div className="sidebar-search">
          <span style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>🔍</span>
          <input
            type="text"
            placeholder={
            sidebarTab === "doctrines"
              ? doctrineSubTab === "quotes" ? "Search quotes…" : "Search doctrines…"
              : `Search ${TABS.find((t) => t.id === sidebarTab)?.label.toLowerCase() ?? ""}…`
          }
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
          />
          {sidebarSearch && (
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: "0 2px" }}
              onClick={() => setSidebarSearch("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Places sub-tabs */}
      {sidebarTab === "places" && (
        <div className="sub-tabs">
          {(["cities", "archaeology"] as PlacesSubTab[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`sub-tab${sidebarPlacesSub === s ? " active" : ""}`}
              onClick={() => setSidebarPlacesSub(s)}
            >
              {s === "cities" ? "Cities" : "Archaeology"}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="sidebar-list">
        {sidebarTab === "places" && sidebarPlacesSub === "cities" && (
          <CitiesList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelectCity={(id) => handleEntitySelect("city", id)}
            onFlyToCity={onFlyToCity}
          />
        )}
        {sidebarTab === "places" && sidebarPlacesSub === "archaeology" && (
          <ArchaeologyList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("archaeology", id)}
          />
        )}
        {sidebarTab === "persuasions" && (
          <PersuasionsList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("persuasion", id)}
            mapFilterId={mapFilterId}
            mapFilterType={mapFilterType}
          />
        )}
        {sidebarTab === "polities" && (
          <PolitiesList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("polity", id)}
            mapFilterId={mapFilterId}
            mapFilterType={mapFilterType}
          />
        )}
        {sidebarTab === "people" && (
          <PeopleList
            search={sidebarSearch}
            onSelect={(id) => handleEntitySelect("person", id)}
          />
        )}
        {sidebarTab === "doctrines" && (
          <DoctrinesList
            search={sidebarSearch}
            subTab={doctrineSubTab}
            onSubTabChange={setDoctrineSubTab}
            onSelect={(id) => handleEntitySelect("doctrine", id)}
            onSelectEntity={handleEntitySelect}
          />
        )}
        {sidebarTab === "events" && (
          <EventsList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("event", id)}
          />
        )}
        {sidebarTab === "works" && (
          <WorksList
            search={sidebarSearch}
            onSelect={(id) => handleEntitySelect("work", id)}
          />
        )}
        {sidebarTab === "essays" && (
          <EssaysList
            search={sidebarSearch}
            essays={essays}
            loading={essaysLoading}
            onSelect={setSelectedEssay}
          />
        )}
      </div>
    </SidebarShell>
  );
}

// ─── SidebarShell (expand/collapse/dismiss wrapper) ───────────────────────────

function SidebarShell({
  children, expanded, onToggleExpand, onDismiss,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={`sidebar-shell${expanded ? " expanded" : ""}`}>
      <div className="sidebar-shell-controls">
        <button
          type="button"
          className="sidebar-ctrl-btn"
          onClick={onToggleExpand}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? "⇥" : "⇤"}
        </button>
        <button
          type="button"
          className="sidebar-ctrl-btn sidebar-ctrl-btn--dismiss"
          onClick={onDismiss}
          title="Hide sidebar"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Cities list ──────────────────────────────────────────────────────────────

function CitiesList({ search, currentDecade, onSelectCity, onFlyToCity }: {
  search: string;
  currentDecade: number;
  onSelectCity: (id: string) => void;
  onFlyToCity: (id: string) => void;
}) {
  const cities = useMemo(() => {
    const all = dataStore.map.getCitiesAtDecade(currentDecade);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) =>
      `${c.city_ancient} ${c.city_label} ${c.city_modern} ${c.country_modern}`.toLowerCase().includes(q),
    );
  }, [search, currentDecade]);

  if (cities.length === 0) return <div className="empty-state">No cities found.</div>;

  return (
    <>
      {cities.map((c) => (
        <div key={c.city_id} className="sidebar-list-item" onClick={() => onSelectCity(c.city_id)}>
          <span className="sli-dot" style={{ background: presenceColor(c.presence_status) }} />
          <div className="sli-main">
            <div className="sli-name">{c.city_label}</div>
            <div className="sli-meta">
              {c.city_ancient !== c.city_label ? `${c.city_ancient} · ` : ""}
              {c.country_modern}
            </div>
          </div>
          <button
            type="button"
            className="sli-fly-btn"
            title="Fly to"
            onClick={(e) => { e.stopPropagation(); onFlyToCity(c.city_id); }}
          >
            ⌖
          </button>
        </div>
      ))}
    </>
  );
}

// ─── Archaeology list ─────────────────────────────────────────────────────────

function ArchaeologyList({ search, currentDecade, onSelect }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
}) {
  const sites = useMemo(() => {
    const all = dataStore.archaeology.getActiveAtDecade(currentDecade);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => `${a.name_display} ${a.site_type}`.toLowerCase().includes(q));
  }, [search, currentDecade]);

  if (sites.length === 0) return <div className="empty-state">No archaeology sites found.</div>;

  return (
    <>
      {sites.map((a) => (
        <div key={a.archaeology_id} className="sidebar-list-item" onClick={() => onSelect(a.archaeology_id)}>
          <span className="sli-icon">★</span>
          <div className="sli-main">
            <div className="sli-name">{a.name_display}</div>
            <div className="sli-meta">{a.site_type}{a.year_start ? ` · AD ${a.year_start}` : ""}</div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Persuasions list ─────────────────────────────────────────────────────────

function PersuasionsList({ search, currentDecade, onSelect, mapFilterId, mapFilterType }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  mapFilterId: string | null;
  mapFilterType: string | null;
}) {
  const rows = useMemo(() => {
    const statesAtDecade = dataStore.map.getCitiesAtDecade(currentDecade);
    const countByPersuasion: Record<string, number> = {};
    for (const c of statesAtDecade) {
      for (const pid of c.persuasion_ids ?? []) {
        countByPersuasion[pid] = (countByPersuasion[pid] ?? 0) + 1;
      }
    }
    const all = dataStore.persuasions.getAll();
    const q = search.trim().toLowerCase();
    return all
      .filter((p) => !q || p.persuasion_label.toLowerCase().includes(q))
      .map((p) => ({ ...p, count: countByPersuasion[p.persuasion_id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [search, currentDecade]);

  if (rows.length === 0) return <div className="empty-state">No persuasions found.</div>;

  return (
    <>
      {rows.map((p) => {
        const isFiltered = mapFilterType === "persuasion" && mapFilterId === p.persuasion_id;
        return (
          <div
            key={p.persuasion_id}
            className={`sidebar-list-item${isFiltered ? " selected" : ""}`}
            onClick={() => onSelect(p.persuasion_id)}
          >
            <span className="sli-icon">✦</span>
            <div className="sli-main">
              <div className="sli-name">{p.persuasion_label}</div>
              {p.count > 0 && <div className="sli-meta">{p.count} cities at AD {currentDecade}</div>}
            </div>
            {p.count > 0 && <span className="sli-badge">{p.count}</span>}
          </div>
        );
      })}
    </>
  );
}

// ─── Polities list ────────────────────────────────────────────────────────────

function PolitiesList({ search, currentDecade, onSelect, mapFilterId, mapFilterType }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  mapFilterId: string | null;
  mapFilterType: string | null;
}) {
  const rows = useMemo(() => {
    const statesAtDecade = dataStore.map.getCitiesAtDecade(currentDecade);
    const countByPolity: Record<string, number> = {};
    for (const c of statesAtDecade) {
      if (c.polity_id) countByPolity[c.polity_id] = (countByPolity[c.polity_id] ?? 0) + 1;
    }
    const all = dataStore.polities.getAll();
    const q = search.trim().toLowerCase();
    return all
      .filter((p) => !q || p.polity_label.toLowerCase().includes(q))
      .map((p) => ({ ...p, count: countByPolity[p.polity_id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [search, currentDecade]);

  if (rows.length === 0) return <div className="empty-state">No polities found.</div>;

  return (
    <>
      {rows.map((p) => {
        const isFiltered = mapFilterType === "polity" && mapFilterId === p.polity_id;
        return (
          <div
            key={p.polity_id}
            className={`sidebar-list-item${isFiltered ? " selected" : ""}`}
            onClick={() => onSelect(p.polity_id)}
          >
            <span className="sli-icon">⚔</span>
            <div className="sli-main">
              <div className="sli-name">{p.polity_label}</div>
              {p.count > 0 && <div className="sli-meta">{p.count} cities at AD {currentDecade}</div>}
            </div>
            {p.count > 0 && <span className="sli-badge">{p.count}</span>}
          </div>
        );
      })}
    </>
  );
}

// ─── People list ──────────────────────────────────────────────────────────────

function PeopleList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.people.getAll();
    if (!q) return all.slice(0, 80);
    return all
      .filter((p) => `${p.person_label} ${p.name_alt.join(" ")} ${p.roles.join(" ")} ${p.description}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [search]);

  if (people.length === 0) return <div className="empty-state">No people found.</div>;

  return (
    <>
      {people.map((p) => (
        <div key={p.person_id} className="sidebar-list-item" onClick={() => onSelect(p.person_id)}>
          <span className="sli-icon">👤</span>
          <div className="sli-main">
            <div className="sli-name">{p.person_label}</div>
            <div className="sli-meta">
              {p.roles.slice(0, 2).join(", ")}
              {(p.birth_year || p.death_year) ? ` · ${p.birth_year ? `b.${p.birth_year}` : ""}${p.death_year ? ` d.${p.death_year}` : ""}` : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Doctrines list ───────────────────────────────────────────────────────────

function DoctrinesList({ search, subTab, onSubTabChange, onSelect, onSelectEntity }: {
  search: string;
  subTab: "doctrines" | "quotes";
  onSubTabChange: (t: "doctrines" | "quotes") => void;
  onSelect: (id: string) => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const hl = search.trim();

  // ── Doctrines sub-tab ────────────────────────────────────────────────────
  const doctrines = useMemo(() => {
    const q = hl.toLowerCase();
    const all = dataStore.doctrines.getAll();
    if (!q) return all;
    return all.filter((d) =>
      `${d.name_display} ${d.category} ${d.description}`.toLowerCase().includes(q) ||
      dataStore.quotes.getByDoctrine(d.doctrine_id).some((qt) => qt.text.toLowerCase().includes(q)),
    );
  }, [hl]);

  // ── Global quotes sub-tab ────────────────────────────────────────────────
  const allQuotes = useMemo(() => {
    const q = hl.toLowerCase();
    const all = dataStore.quotes.getAll();
    if (!q) return all.slice(0, 60);
    return all.filter((qt) =>
      qt.text.toLowerCase().includes(q) ||
      qt.work_reference.toLowerCase().includes(q) ||
      (qt.notes ?? "").toLowerCase().includes(q),
    );
  }, [hl]);

  return (
    <>
      {/* Sub-tab switcher — sits above the shared search bar */}
      <div className="sub-tabs" style={{ padding: "0 8px" }}>
        <button type="button" className={`sub-tab${subTab === "doctrines" ? " active" : ""}`} onClick={() => onSubTabChange("doctrines")}>
          Doctrines ({doctrines.length})
        </button>
        <button type="button" className={`sub-tab${subTab === "quotes" ? " active" : ""}`} onClick={() => onSubTabChange("quotes")}>
          All Quotes {hl ? `(${allQuotes.length})` : ""}
        </button>
      </div>

      {subTab === "doctrines" && (
        doctrines.length === 0
          ? <div className="empty-state">No doctrines found.</div>
          : <>
              {doctrines.map((d) => (
                <div key={d.doctrine_id} className="sidebar-list-item" onClick={() => onSelect(d.doctrine_id)}>
                  <span className="sli-icon">📖</span>
                  <div className="sli-main">
                    <div className="sli-name"><Hl text={d.name_display} query={hl} /></div>
                    <div className="sli-meta">
                      {d.category}
                      {d.first_attested_year ? ` · AD ${d.first_attested_year}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </>
      )}

      {subTab === "quotes" && (
        allQuotes.length === 0
          ? <div className="empty-state">No quotes found.</div>
          : <>
              {allQuotes.map((qt) => {
                const doctrine = qt.doctrine_id ? dataStore.doctrines.getById(qt.doctrine_id) : null;
                const work     = qt.work_id     ? dataStore.works.getById(qt.work_id)         : null;
                return (
                  <div
                    key={qt.quote_id}
                    className="note-card"
                    style={{ margin: "4px 8px", cursor: "pointer" }}
                    onClick={() => onSelectEntity("quote", qt.quote_id)}
                  >
                    <div className="note-year" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {qt.year ? `AD ${qt.year}` : ""}
                      {qt.stance ? ` · ${qt.stance}` : ""}
                      {doctrine && (
                        <button type="button" className="mention-link" style={{ marginLeft: "auto" }}
                          onClick={(e) => { e.stopPropagation(); onSelectEntity("doctrine", doctrine.doctrine_id); }}>
                          {doctrine.name_display}
                        </button>
                      )}
                    </div>
                    <p style={{ fontStyle: "italic", margin: "4px 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
                      &ldquo;<Hl text={qt.text} query={hl} />&rdquo;
                    </p>
                    {qt.work_reference && (
                      <div style={{ fontSize: "0.73rem", color: "var(--text-faint)" }}>
                        — <Hl text={qt.work_reference} query={hl} />
                        {work && (
                          <button type="button" className="mention-link" style={{ marginLeft: 5 }}
                            onClick={(e) => { e.stopPropagation(); onSelectEntity("work", work.work_id); }}>
                            {work.title_display}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
      )}
    </>
  );
}

// ─── Events list ──────────────────────────────────────────────────────────────

function EventsList({ search, currentDecade, onSelect }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
}) {
  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.events.getAll()
      .filter((e) => (e.year_start ?? 0) <= currentDecade + 10)
      .sort((a, b) => (a.year_start ?? 0) - (b.year_start ?? 0));
    if (!q) return all;
    return all.filter((e) => `${e.name_display} ${e.event_type} ${e.region} ${e.description}`.toLowerCase().includes(q));
  }, [search, currentDecade]);

  if (events.length === 0) return <div className="empty-state">No events found.</div>;

  return (
    <>
      {events.map((e) => (
        <div key={e.event_id} className="sidebar-list-item" onClick={() => onSelect(e.event_id)}>
          <span className="sli-icon">⚡</span>
          <div className="sli-main">
            <div className="sli-name">{e.name_display}</div>
            <div className="sli-meta">
              {e.year_start ? `AD ${e.year_start}` : ""}
              {e.event_type ? ` · ${e.event_type}` : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Works list ───────────────────────────────────────────────────────────────

function WorksList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const works = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.works.getAll().sort((a, b) => (a.year_written_start ?? 0) - (b.year_written_start ?? 0));
    if (!q) return all;
    return all.filter((w) =>
      `${w.title_display} ${w.author_name_display} ${w.description} ${w.work_type}`.toLowerCase().includes(q),
    );
  }, [search]);

  if (works.length === 0) return <div className="empty-state">No works found.</div>;

  return (
    <>
      {works.map((w) => (
        <div key={w.work_id} className="sidebar-list-item" onClick={() => onSelect(w.work_id)}>
          <span className="sli-icon">📜</span>
          <div className="sli-main">
            <div className="sli-name">{w.title_display}</div>
            <div className="sli-meta">
              {w.author_name_display}
              {w.year_written_start ? ` · AD ${w.year_written_start}` : ""}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Essays list ──────────────────────────────────────────────────────────────

function EssaysList({ search, essays, loading, onSelect }: {
  search: string;
  essays: Essay[];
  loading: boolean;
  onSelect: (essay: Essay) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return essays;
    return essays.filter((e) =>
      `${e.title} ${e.summary} ${e.body}`.toLowerCase().includes(q),
    );
  }, [search, essays]);

  if (loading) return <div className="empty-state">Loading essays…</div>;
  if (filtered.length === 0) return <div className="empty-state">No essays found.</div>;

  return (
    <>
      {filtered.map((e) => (
        <div key={e.id} className="sidebar-list-item" onClick={() => onSelect(e)}>
          <span className="sli-icon">✍</span>
          <div className="sli-main">
            <div className="sli-name">{e.title}</div>
            <div className="sli-meta">{e.summary}</div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Essay view ───────────────────────────────────────────────────────────────

function EssayView({ essay, onBack, onSelectEntity }: {
  essay: Essay;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  return (
    <div className="detail-panel">
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Essays</span>
      </div>
      <div className="detail-header">
        <div className="detail-kind-badge">✍ Essay</div>
        <div className="detail-title">{essay.title}</div>
        {essay.summary && <div className="detail-subtitle">{essay.summary}</div>}
      </div>
      <div className="detail-body">
        <MarkdownRenderer onSelectEntity={onSelectEntity}>
          {essay.body}
        </MarkdownRenderer>
      </div>
    </div>
  );
}

// ─── Quote detail panel ───────────────────────────────────────────────────────

function QuoteDetail({ quoteId, onBack, onSelectEntity }: {
  quoteId: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const q = dataStore.quotes.getById(quoteId);
  if (!q) return (
    <div className="detail-panel">
      <div className="detail-back-bar"><button type="button" className="back-btn" onClick={onBack}>← Back</button></div>
      <div className="empty-state">Quote not found.</div>
    </div>
  );

  const doctrine = q.doctrine_id ? dataStore.doctrines.getById(q.doctrine_id) : null;
  const work     = q.work_id     ? dataStore.works.getById(q.work_id)         : null;
  const author   = work?.author_person_id ? dataStore.people.getById(work.author_person_id) : null;

  return (
    <div className="detail-panel">
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Quote</span>
      </div>

      <div className="detail-header">
        <div className="detail-kind-badge">💬 Quote</div>
        {q.year && <div className="detail-subtitle">AD {q.year}{q.stance ? ` · ${q.stance}` : ""}</div>}
      </div>

      <div className="detail-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <blockquote style={{
          fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.65,
          borderLeft: "3px solid var(--accent-bright)", margin: 0,
          paddingLeft: 12, color: "var(--text-muted)",
        }}>
          &ldquo;{q.text}&rdquo;
        </blockquote>

        {q.work_reference && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>— {q.work_reference}</div>
        )}

        <div className="fact-grid">
          {doctrine && (
            <>
              <span className="fact-label">Doctrine</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("doctrine", doctrine.doctrine_id)}>
                  {doctrine.name_display}
                </button>
              </span>
            </>
          )}
          {work && (
            <>
              <span className="fact-label">Source work</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("work", work.work_id)}>
                  {work.title_display}
                </button>
              </span>
            </>
          )}
          {author && (
            <>
              <span className="fact-label">Author</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("person", author.person_id)}>
                  {author.person_label}
                </button>
              </span>
            </>
          )}
          {q.notes && (
            <>
              <span className="fact-label">Notes</span>
              <span className="fact-value">{q.notes}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generic entity detail ────────────────────────────────────────────────────

interface EntityDetailProps {
  kind: string;
  id: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
  mapFilterType: string | null;
  mapFilterId: string | null;
  setMapFilter: (type: string, id: string) => void;
  clearMapFilter: () => void;
  currentDecade: number;
}

type EntityDetailTab = "info" | "locations" | "works" | "people" | "quotes" | "evidence" | "related";

function EntityDetail({
  kind, id, onBack, onSelectEntity,
  mapFilterType, mapFilterId, setMapFilter, clearMapFilter, currentDecade,
}: EntityDetailProps) {
  const [activeTab, setActiveTab] = useState<EntityDetailTab>("info");

  const isFiltered = mapFilterType === kind && mapFilterId === id;
  const canFilter  = ["persuasion", "polity", "person", "doctrine", "event", "work"].includes(kind);
  const label      = getEntityLabel(kind, id);

  const toggleFilter = () => {
    if (isFiltered) clearMapFilter();
    else setMapFilter(kind, id);
  };

  const notes     = dataStore.notes.getForEntity(kind, id);
  const relations = dataStore.relations.getForEntity(kind, id);

  // ── Pre-compute counts for tab badges ───────────────────────────────────

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<EntityDetailTab, number>> = {};
    if (kind === "person") {
      // locations: all city footprints + relations
      const fps  = dataStore.footprints.getForEntity("person", id);
      const rels = dataStore.relations.getForEntity("person", id);
      const cityIds = new Set<string>();
      for (const fp of fps) if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
      for (const r of rels) {
        const othId  = r.source_id === id ? r.target_id : r.source_id;
        const othType= r.source_id === id ? r.target_type : r.source_type;
        if (othType === "city") cityIds.add(othId);
      }
      const p = dataStore.people.getById(id);
      if (p?.city_of_origin_id) cityIds.add(p.city_of_origin_id);
      counts.locations = cityIds.size;
      counts.works = dataStore.works.getByAuthor(id).length;
    }
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      const personIds = new Set<string>();
      if (w?.author_person_id) personIds.add(w.author_person_id);
      for (const r of dataStore.relations.getForEntity("work", id)) {
        const othId  = r.source_id === id ? r.target_id : r.source_id;
        const othType= r.source_id === id ? r.target_type : r.source_type;
        if (othType === "person") personIds.add(othId);
      }
      counts.people = personIds.size;
      counts.quotes = dataStore.quotes.getByWork(id).length;
    }
    if (kind === "doctrine") {
      counts.quotes    = dataStore.quotes.getByDoctrine(id).length;
      counts.locations = dataStore.footprints.getForEntity("doctrine", id).filter(f => f.place_id.startsWith("city:")).length;
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      counts.people    = (e?.key_figure_person_ids ?? []).length;
      counts.locations = e?.primary_place_id ? 1 : 0;
    }
    if (kind === "persuasion") {
      counts.locations = dataStore.map.getCitiesAtDecade(currentDecade)
        .filter(c => (c.persuasion_ids ?? []).includes(id)).length;
    }
    if (kind === "polity") {
      counts.locations = dataStore.map.getCitiesAtDecade(currentDecade)
        .filter(c => c.polity_id === id).length;
    }
    counts.evidence = notes.length;
    counts.related  = relations.length;
    return counts;
  }, [kind, id, notes.length, relations.length, currentDecade]);

  // ── Build tab list based on kind ────────────────────────────────────────

  const badge = (tab: EntityDetailTab, fallback: string) => {
    const c = tabCounts[tab];
    return c != null ? `${fallback} (${c})` : fallback;
  };

  const availableTabs = useMemo((): { id: EntityDetailTab; label: string }[] => {
    const tabs: { id: EntityDetailTab; label: string }[] = [{ id: "info", label: "Info" }];

    if (kind === "person") {
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
      tabs.push({ id: "works",     label: badge("works", "Works") });
    }
    if (kind === "work") {
      tabs.push({ id: "people", label: badge("people", "People") });
      tabs.push({ id: "quotes", label: badge("quotes", "Quotes") });
    }
    if (kind === "doctrine") {
      tabs.push({ id: "quotes",    label: badge("quotes", "Quotes") });
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
    }
    if (kind === "event") {
      tabs.push({ id: "people",    label: badge("people", "Key Figures") });
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
    }
    if (kind === "persuasion" || kind === "polity") {
      tabs.push({ id: "locations", label: badge("locations", "Cities") });
    }
    if (notes.length > 0) {
      tabs.push({ id: "evidence", label: `Evidence (${notes.length})` });
    }
    if (relations.length > 0) {
      tabs.push({ id: "related", label: `Related (${relations.length})` });
    }
    return tabs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, notes.length, relations.length, currentDecade]);

  // ── Build header ────────────────────────────────────────────────────────

  const header = useMemo(() => {
    let title = label;
    let subtitle = "";
    let tags: string[] = [];

    if (kind === "person") {
      const p = dataStore.people.getById(id);
      if (p) {
        title = p.person_label;
        subtitle = [
          p.birth_year ? `b. AD ${p.birth_year}` : "",
          p.death_year ? `d. AD ${p.death_year}` : "",
        ].filter(Boolean).join(" · ");
        tags = p.roles;
      }
    } else if (kind === "persuasion") {
      const p = dataStore.persuasions.getById(id);
      if (p) { title = p.persuasion_label; tags = [p.persuasion_stream].filter(Boolean); }
    } else if (kind === "polity") {
      const p = dataStore.polities.getById(id);
      if (p) {
        title = p.polity_label;
        subtitle = [p.region, p.capital].filter(Boolean).join(" · ");
      }
    } else if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w) {
        title = w.title_display;
        subtitle = `${w.author_name_display}${w.year_written_start ? ` · AD ${w.year_written_start}` : ""}`;
        tags = [w.work_type, w.language].filter(Boolean);
      }
    } else if (kind === "doctrine") {
      const d = dataStore.doctrines.getById(id);
      if (d) {
        title = d.name_display;
        subtitle = d.category;
        tags = [d.controversy_level ? `controversy: ${d.controversy_level}` : ""].filter(Boolean);
      }
    } else if (kind === "event") {
      const e = dataStore.events.getById(id);
      if (e) {
        title = e.name_display;
        subtitle = [e.year_start ? `AD ${e.year_start}` : "", e.region].filter(Boolean).join(" · ");
        tags = [e.event_type].filter(Boolean);
      }
    } else if (kind === "archaeology") {
      const a = dataStore.archaeology.getById(id);
      if (a) {
        title = a.name_display;
        subtitle = a.site_type;
        tags = [a.current_status].filter(Boolean);
      }
    }

    return { title, subtitle, tags };
  }, [kind, id, label]);

  return (
    <div className="detail-panel">
      {/* Back bar */}
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">{kindLabel(kind)}</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-kind-badge">{kindIcon(kind)} {kindLabel(kind)}</div>
        <div className="detail-title">{header.title}</div>
        {header.subtitle && <div className="detail-subtitle">{header.subtitle}</div>}
        {header.tags.length > 0 && (
          <div className="detail-tags">
            {header.tags.map((t, i) => <span key={i} className="tag accent">{t}</span>)}
          </div>
        )}
      </div>

      {/* Map filter banner */}
      {canFilter && (
        <div className="filter-banner">
          <span>🗺 Filter map to this {kindLabel(kind).toLowerCase()}</span>
          <button
            type="button"
            className={`filter-toggle-btn${isFiltered ? " on" : ""}`}
            onClick={toggleFilter}
          >
            {isFiltered ? "On" : "Off"}
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      {availableTabs.length > 1 && (
        <div className="detail-sub-tabs">
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`detail-sub-tab${activeTab === t.id ? " active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab body */}
      <div className="detail-body">
        {activeTab === "info"      && <EntityInfoTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "locations" && <EntityLocationsTab kind={kind} id={id} currentDecade={currentDecade} onSelectEntity={onSelectEntity} />}
        {activeTab === "works"     && <EntityWorksTab personId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "people"    && <EntityPeopleTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "quotes"    && <EntityQuotesTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "evidence"  && <EntityEvidenceTab notes={notes} onSelectEntity={onSelectEntity} />}
        {activeTab === "related"   && <EntityRelatedTab relations={relations} entityId={id} entityType={kind} onSelectEntity={onSelectEntity} />}
      </div>
    </div>
  );
}

// ─── Entity detail sub-tab components ────────────────────────────────────────

function EntityInfoTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const q = searchQuery.trim();

  if (kind === "person") {
    const p = dataStore.people.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {p.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}><Hl text={p.description} query={q} /></p>}
        <div className="fact-grid">
          {p.apostolic_connection && <><span className="fact-label">Apostolic connection</span><span className="fact-value">{p.apostolic_connection}</span></>}
          {p.death_type && <><span className="fact-label">Death type</span><span className="fact-value">{p.death_type}</span></>}
          {p.city_of_origin_id && (
            <>
              <span className="fact-label">City of origin</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("city", p.city_of_origin_id!)}>
                  {dataStore.cities.getById(p.city_of_origin_id)?.city_label ?? p.city_of_origin_id}
                </button>
              </span>
            </>
          )}
        </div>
        {p.wikipedia_url && (
          <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>
        )}
        {p.citations.length > 0 && (
          <div>
            <div className="detail-section-title">Sources</div>
            {p.citations.map((url, i) => <a key={i} className="citation-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          </div>
        )}
      </div>
    );
  }

  if (kind === "work") {
    const w = dataStore.works.getById(id);
    if (!w) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {w.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}><Hl text={w.description} query={q} /></p>}
        {w.significance && <p style={{ fontSize: "0.83rem", fontStyle: "italic", color: "var(--text-muted)", lineHeight: 1.5 }}><Hl text={w.significance} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Language</span><span className="fact-value">{w.language || "—"}</span>
          {w.year_written_start && <><span className="fact-label">Written</span><span className="fact-value">AD {w.year_written_start}{w.year_written_end && w.year_written_end !== w.year_written_start ? ` – ${w.year_written_end}` : ""}</span></>}
          {w.author_person_id && (
            <>
              <span className="fact-label">Author</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("person", w.author_person_id!)}>
                  {w.author_name_display}
                </button>
              </span>
            </>
          )}
        </div>
        {w.modern_edition_url && <a href={w.modern_edition_url} target="_blank" rel="noopener noreferrer" className="citation-link">Modern edition →</a>}
      </div>
    );
  }

  if (kind === "doctrine") {
    const d = dataStore.doctrines.getById(id);
    if (!d) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {d.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}><Hl text={d.description} query={q} /></p>}
        {d.resolution && <p style={{ fontSize: "0.83rem", fontStyle: "italic", color: "var(--text-muted)" }}><Hl text={d.resolution} query={q} /></p>}
        <div className="fact-grid">
          {d.first_attested_year && <><span className="fact-label">First attested</span><span className="fact-value">AD {d.first_attested_year}</span></>}
          {d.controversy_level && <><span className="fact-label">Controversy</span><span className="fact-value">{d.controversy_level}</span></>}
          {d.first_attested_work_id && (
            <>
              <span className="fact-label">First work</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("work", d.first_attested_work_id!)}>
                  {dataStore.works.getById(d.first_attested_work_id)?.title_display ?? d.first_attested_work_id}
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (!e) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {e.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}><Hl text={e.description} query={q} /></p>}
        {e.significance && <p style={{ fontSize: "0.83rem", fontStyle: "italic", color: "var(--text-muted)" }}><Hl text={e.significance} query={q} /></p>}
        <div className="fact-grid">
          {e.outcome && <><span className="fact-label">Outcome</span><span className="fact-value">{e.outcome}</span></>}
          {e.primary_place_id && (
            <>
              <span className="fact-label">Location</span>
              <span className="fact-value">
                {e.primary_place_id.startsWith("city:") ? (
                  <button type="button" className="mention-link" onClick={() => onSelectEntity("city", e.primary_place_id!.slice(5))}>
                    {dataStore.cities.getById(e.primary_place_id.slice(5))?.city_label ?? e.primary_place_id}
                  </button>
                ) : e.primary_place_id}
              </span>
            </>
          )}
        </div>
        {e.citations.length > 0 && (
          <div>
            <div className="detail-section-title">Sources</div>
            {e.citations.map((url, i) => <a key={i} className="citation-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          </div>
        )}
      </div>
    );
  }

  if (kind === "persuasion") {
    const p = dataStore.persuasions.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {p.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{p.description}</p>}
        <div className="fact-grid">
          {p.persuasion_stream && <><span className="fact-label">Stream</span><span className="fact-value">{p.persuasion_stream}</span></>}
          {p.year_start && <><span className="fact-label">Active from</span><span className="fact-value">AD {p.year_start}{p.year_end ? ` – ${p.year_end}` : ""}</span></>}
        </div>
        {p.wikipedia_url && <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>}
      </div>
    );
  }

  if (kind === "polity") {
    const p = dataStore.polities.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {p.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{p.description}</p>}
        <div className="fact-grid">
          {p.capital && <><span className="fact-label">Capital</span><span className="fact-value">{p.capital}</span></>}
          {p.region && <><span className="fact-label">Region</span><span className="fact-value">{p.region}</span></>}
          {p.year_start && <><span className="fact-label">Period</span><span className="fact-value">AD {p.year_start}{p.year_end ? ` – ${p.year_end}` : ""}</span></>}
        </div>
        {p.wikipedia_url && <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>}
      </div>
    );
  }

  if (kind === "archaeology") {
    const a = dataStore.archaeology.getById(id);
    if (!a) return <div className="empty-state">Not found.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {a.description && <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{a.description}</p>}
        {a.significance && <p style={{ fontSize: "0.83rem", fontStyle: "italic", color: "var(--text-muted)" }}>{a.significance}</p>}
        <div className="fact-grid">
          {a.year_start != null && <><span className="fact-label">Dated</span><span className="fact-value">AD {a.year_start}{a.year_end && a.year_end !== a.year_start ? ` – ${a.year_end}` : ""}</span></>}
          {a.city_id && <><span className="fact-label">Near</span><span className="fact-value">{dataStore.cities.getById(a.city_id)?.city_label ?? a.city_id}</span></>}
          {a.current_status && <><span className="fact-label">Status</span><span className="fact-value">{a.current_status}</span></>}
          {a.location_precision && <><span className="fact-label">Precision</span><span className="fact-value">{a.location_precision}</span></>}
        </div>
        {a.discovery_notes && (
          <div>
            <div className="detail-section-title">Discovery</div>
            <p style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>{a.discovery_notes}</p>
          </div>
        )}
        {a.uncertainty && (
          <div>
            <div className="detail-section-title">Uncertainty</div>
            <p style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>{a.uncertainty}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function EntityLocationsTab({ kind, id, currentDecade, onSelectEntity }: {
  kind: string; id: string; currentDecade: number;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [allTime, setAllTime] = useState(true);

  // For persuasion/polity: time-aware (decade slices). For person/doctrine/event: always all-time.
  const isTimeFilterable = kind === "persuasion" || kind === "polity";

  const cities = useMemo(() => {
    if (kind === "persuasion") {
      if (allTime) {
        // Scan ALL place states to find every city that ever had this persuasion
        const cityIds = new Set<string>();
        for (const ps of dataStore.map.getAllPlaceStates()) {
          if (ps.place_id.startsWith("city:") && (ps.persuasion_ids ?? []).includes(id)) {
            cityIds.add(ps.place_id.slice(5));
          }
        }
        return Array.from(cityIds).map(cid => dataStore.cities.getById(cid)).filter(Boolean) as NonNullable<ReturnType<typeof dataStore.cities.getById>>[];
      }
      return dataStore.map.getCitiesAtDecade(currentDecade)
        .filter((c) => (c.persuasion_ids ?? []).includes(id));
    }
    if (kind === "polity") {
      if (allTime) {
        const cityIds = new Set<string>();
        for (const ps of dataStore.map.getAllPlaceStates()) {
          if (ps.place_id.startsWith("city:") && ps.polity_id === id) {
            cityIds.add(ps.place_id.slice(5));
          }
        }
        return Array.from(cityIds).map(cid => dataStore.cities.getById(cid)).filter(Boolean) as NonNullable<ReturnType<typeof dataStore.cities.getById>>[];
      }
      return dataStore.map.getCitiesAtDecade(currentDecade)
        .filter((c) => c.polity_id === id);
    }
    if (kind === "person") {
      const fps = dataStore.footprints.getForEntity("person", id);
      const rels = dataStore.relations.getForEntity("person", id);
      const cityIds = new Set<string>();
      for (const fp of fps) {
        if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
      }
      for (const r of rels) {
        const otherId = r.source_id === id ? r.target_id : r.source_id;
        const otherType = r.source_id === id ? r.target_type : r.source_type;
        if (otherType === "city") cityIds.add(otherId);
      }
      const person = dataStore.people.getById(id);
      if (person?.city_of_origin_id) cityIds.add(person.city_of_origin_id);
      return Array.from(cityIds)
        .map((cid) => dataStore.cities.getById(cid))
        .filter(Boolean) as ReturnType<typeof dataStore.cities.getById>[];
    }
    if (kind === "doctrine") {
      const fps = dataStore.footprints.getForEntity("doctrine", id);
      const cityIds = new Set(fps.filter((f) => f.place_id.startsWith("city:")).map((f) => f.place_id.slice(5)));
      return Array.from(cityIds).map((cid) => dataStore.cities.getById(cid)).filter(Boolean) as ReturnType<typeof dataStore.cities.getById>[];
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      if (e?.primary_place_id?.startsWith("city:")) {
        const city = dataStore.cities.getById(e.primary_place_id.slice(5));
        return city ? [city] : [];
      }
    }
    return [];
  }, [kind, id, currentDecade, allTime]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {isTimeFilterable && (
        <div style={{ display: "flex", gap: 6, padding: "6px 0 8px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
          <button
            type="button"
            className={`detail-sub-tab${allTime ? " active" : ""}`}
            onClick={() => setAllTime(true)}
          >
            All time
          </button>
          <button
            type="button"
            className={`detail-sub-tab${!allTime ? " active" : ""}`}
            onClick={() => setAllTime(false)}
          >
            AD {currentDecade}
          </button>
        </div>
      )}
      {cities.length === 0
        ? <div className="empty-state">No locations found.</div>
        : (
          <div className="conn-list">
            {cities.map((c) => c && (
              <div key={c.city_id} className="conn-card" onClick={() => onSelectEntity("city", c.city_id)}>
                <span className="conn-icon">🏛</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="conn-name">{c.city_label}</div>
                  <div className="conn-rel">{c.country_modern}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

function EntityWorksTab({ personId, onSelectEntity }: {
  personId: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const works = dataStore.works.getByAuthor(personId);
  if (works.length === 0) return <div className="empty-state">No works found.</div>;

  return (
    <div className="conn-list">
      {works.map((w) => (
        <div key={w.work_id} className="conn-card" onClick={() => onSelectEntity("work", w.work_id)}>
          <span className="conn-icon">📜</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{w.title_display}</div>
            <div className="conn-rel">{w.year_written_start ? `AD ${w.year_written_start}` : ""} · {w.work_type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EntityPeopleTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const people = useMemo(() => {
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      const personIds = new Set<string>();
      if (w?.author_person_id) personIds.add(w.author_person_id);
      const rels = dataStore.relations.getForEntity("work", id);
      for (const r of rels) {
        const otherId = r.source_id === id ? r.target_id : r.source_id;
        const otherType = r.source_id === id ? r.target_type : r.source_type;
        if (otherType === "person") personIds.add(otherId);
      }
      return Array.from(personIds).map((pid) => dataStore.people.getById(pid)).filter(Boolean);
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      return (e?.key_figure_person_ids ?? []).map((pid) => dataStore.people.getById(pid)).filter(Boolean);
    }
    return [];
  }, [kind, id]);

  if (people.length === 0) return <div className="empty-state">No people found.</div>;

  return (
    <div className="conn-list">
      {people.map((p) => p && (
        <div key={p.person_id} className="conn-card" onClick={() => onSelectEntity("person", p.person_id)}>
          <span className="conn-icon">👤</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{p.person_label}</div>
            <div className="conn-rel">{p.roles.slice(0, 2).join(", ")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EntityQuotesTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const globalQuery = useAppStore((s) => s.searchQuery);
  const [quoteSearch, setQuoteSearch] = useState(globalQuery.trim());

  const hlQuery = quoteSearch.trim() || globalQuery.trim();

  const quotes = useMemo(() => {
    const all = kind === "doctrine"
      ? dataStore.quotes.getByDoctrine(id)
      : kind === "work"
        ? dataStore.quotes.getByWork(id)
        : [];
    if (!quoteSearch.trim()) return all;
    const q = quoteSearch.trim().toLowerCase();
    return all.filter((qt) => qt.text.toLowerCase().includes(q) || qt.work_reference.toLowerCase().includes(q));
  }, [kind, id, quoteSearch]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="sidebar-search" style={{ marginBottom: 4 }}>
        <span style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>🔍</span>
        <input
          type="text"
          placeholder="Search quotes…"
          value={quoteSearch}
          onChange={(e) => setQuoteSearch(e.target.value)}
        />
        {quoteSearch && (
          <button type="button" style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: "0 2px" }} onClick={() => setQuoteSearch("")}>✕</button>
        )}
      </div>

      {quotes.length === 0 && <div className="empty-state">No quotes found.</div>}

      {quotes.map((qt) => {
        const work = qt.work_id ? dataStore.works.getById(qt.work_id) : null;
        return (
          <div
            key={qt.quote_id}
            className="note-card"
            style={{ cursor: "pointer" }}
            onClick={() => onSelectEntity("quote", qt.quote_id)}
          >
            <div className="note-year">
              {qt.year ? `AD ${qt.year}` : ""}
              {qt.stance ? ` · ${qt.stance}` : ""}
            </div>
            <p style={{ fontStyle: "italic", margin: "4px 0", fontSize: "0.83rem", lineHeight: 1.5 }}>
              &ldquo;<Hl text={qt.text} query={hlQuery} />&rdquo;
            </p>
            {qt.work_reference && (
              <div style={{ fontSize: "0.74rem", color: "var(--text-faint)" }}>
                — <Hl text={qt.work_reference} query={hlQuery} />
                {work && (
                  <button
                    type="button"
                    className="mention-link"
                    style={{ marginLeft: 6 }}
                    onClick={(e) => { e.stopPropagation(); onSelectEntity("work", work.work_id); }}
                  >
                    {work.title_display}
                  </button>
                )}
              </div>
            )}
            {qt.notes && <div style={{ fontSize: "0.74rem", color: "var(--text-faint)", marginTop: 3 }}><Hl text={qt.notes} query={hlQuery} /></div>}
          </div>
        );
      })}
    </div>
  );
}

function EntityEvidenceTab({ notes, onSelectEntity }: {
  notes: ReturnType<typeof dataStore.notes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (notes.length === 0) return <div className="empty-state">No evidence notes.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {notes.map((n) => (
        <div key={n.note_id} className="note-card">
          <div className="note-year">AD {n.year_bucket ?? n.year_exact ?? "?"} · {n.note_kind}</div>
          <MarkdownRenderer onSelectEntity={onSelectEntity}>
            {n.body_md}
          </MarkdownRenderer>
        </div>
      ))}
    </div>
  );
}

function EntityRelatedTab({ relations, entityId, entityType, onSelectEntity }: {
  relations: ReturnType<typeof dataStore.relations.getForEntity>;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (relations.length === 0) return <div className="empty-state">No related entities.</div>;

  return (
    <div className="conn-list">
      {relations.slice(0, 20).map((r) => {
        const isOut   = r.source_id === entityId && r.source_type === entityType;
        const otherId = isOut ? r.target_id   : r.source_id;
        const othKind = isOut ? r.target_type : r.source_type;
        const lbl     = getEntityLabel(othKind, otherId);
        return (
          <div key={r.relation_id} className="conn-card" onClick={() => onSelectEntity(othKind, otherId)}>
            <span className="conn-icon">{kindIcon(othKind)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="conn-name">{lbl}</div>
              <div className="conn-rel">{r.relation_type?.replace(/_/g, " ")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function presenceColor(s: string): string {
  const map: Record<string, string> = {
    attested: "#1a7a5c", probable: "#b07e10",
    claimed_tradition: "#c47d2a", suppressed: "#c0392b",
    unknown: "#8e8070", not_attested: "#8e8070",
  };
  return map[s] ?? "#8e8070";
}

function kindIcon(k: string): string {
  const map: Record<string, string> = {
    city: "🏛", person: "👤", work: "📜", doctrine: "📖",
    event: "⚡", archaeology: "★", persuasion: "✦", polity: "⚔",
  };
  return map[k] ?? "•";
}

function kindLabel(k: string): string {
  const map: Record<string, string> = {
    city: "City", person: "Person", work: "Work", doctrine: "Doctrine",
    event: "Event", archaeology: "Archaeology", persuasion: "Persuasion", polity: "Polity",
  };
  return map[k] ?? k;
}
