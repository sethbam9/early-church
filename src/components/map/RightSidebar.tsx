import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import type { SidebarTab, PlacesSubTab } from "../../stores/appStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { kindIcon as MINI_KIND_ICON } from "../shared/entityConstants";
import { getRelationLabel } from "../../domain/relationLabels";
import { ESSAYS, type Essay } from "../../data/essays";

// ── Extracted modules ────────────────────────────────────────────────────────
import { SidebarShell } from "../sidebar/SidebarShell";
import { EntityDetail } from "../sidebar/EntityDetail";
import {
  CitiesList, ArchaeologyList, PersuasionsList, PolitiesList,
  PeopleList, DoctrinesList, EventsList, WorksList, EssaysList,
} from "../sidebar/SidebarLists";
import { CityDetail } from "./CityDetail";

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
  onFlyToArch: (archId: string) => void;
  currentDecade: number;
}

export function RightSidebar({ onFlyToCity, onFlyToArch, currentDecade }: RightSidebarProps) {
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
  // Entity overlay shown on top of essay (city, note, etc. clicked from within essay)
  const [essayOverlay, setEssayOverlay] = useState<Selection | null>(null);
  const essays = ESSAYS;

  // Called when an entity is selected from within an essay — show overlay, fly map, don't close essay
  const handleEssayEntitySelect = (kind: string, id: string) => {
    if (kind === "city") onFlyToCity(id);
    else if (kind === "archaeology") onFlyToArch(id);
    setEssayOverlay({ kind: kind as Selection["kind"], id });
  };

  // Called from non-essay contexts (lists, entity detail panels)
  const handleEntitySelect = (kind: string, id: string) => {
    if (kind === "city") onFlyToCity(id);
    else if (kind === "archaeology") onFlyToArch(id);
    pushSelection({ kind: kind as Selection["kind"], id });
  };

  const handleBack = () => {
    if (selectionHistory.length > 0) {
      popSelection();
    } else {
      setSelection(null);
    }
  };

  // ── Entity detail routing ────────────────────────────────────────────────

  if (selection?.kind === "note") {
    return (
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
        <NoteDetail noteId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </SidebarShell>
    );
  }

  if (selection?.kind === "quote") {
    return (
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
        <QuoteDetail quoteId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </SidebarShell>
    );
  }

  if (selection?.kind === "city") {
    return (
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
        <CityDetail cityId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </SidebarShell>
    );
  }

  if (selection) {
    return (
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
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
      <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
        {/* Essay content — always visible */}
        <EssayView
          essay={selectedEssay}
          onBack={() => { setSelectedEssay(null); setEssayOverlay(null); }}
          onSelectEntity={handleEssayEntitySelect}
        />
        {/* Overlay panel: entity/note/city selected from within essay */}
        {essayOverlay && (
          <div className="essay-entity-overlay">
            {essayOverlay.kind === "note" && (
              <NoteDetail
                noteId={essayOverlay.id}
                onBack={() => setEssayOverlay(null)}
                onSelectEntity={handleEssayEntitySelect}
              />
            )}
            {essayOverlay.kind === "city" && (
              <CityDetail
                cityId={essayOverlay.id}
                onBack={() => setEssayOverlay(null)}
                onSelectEntity={handleEssayEntitySelect}
              />
            )}
            {essayOverlay.kind !== "note" && essayOverlay.kind !== "city" && (
              <EntityDetail
                key={`${essayOverlay.kind}:${essayOverlay.id}`}
                kind={essayOverlay.kind}
                id={essayOverlay.id}
                onBack={() => setEssayOverlay(null)}
                onSelectEntity={handleEssayEntitySelect}
                mapFilterType={mapFilterType}
                mapFilterId={mapFilterId}
                setMapFilter={setMapFilter}
                clearMapFilter={clearMapFilter}
                currentDecade={currentDecade}
              />
            )}
          </div>
        )}
      </SidebarShell>
    );
  }

  // ── List views ──────────────────────────────────────────────────────────

  return (
    <SidebarShell expanded={sidebarExpanded} onToggleExpand={toggleExpanded} onDismiss={toggleRightPanel}>
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
            onFlyToSite={onFlyToArch}
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
            loading={false}
            onSelect={setSelectedEssay}
          />
        )}
      </div>
    </SidebarShell>
  );
}

// ─── Note detail panel ────────────────────────────────────────────────────────

function NoteDetail({ noteId, onBack, onSelectEntity }: {
  noteId: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const allNotes = dataStore.notes.getAll();
  const note = allNotes.find((n) => n.note_id === noteId);
  if (!note) return (
    <div className="detail-panel">
      <div className="detail-back-bar"><button type="button" className="back-btn" onClick={onBack}>← Back</button></div>
      <div className="empty-state">Note not found.</div>
    </div>
  );

  const entity = note.primary_entity_id
    ? getEntityLabel(note.primary_entity_type, note.primary_entity_id)
    : null;

  const yearLabel = note.year_exact
    ? `AD ${note.year_exact}`
    : note.year_bucket
      ? `c. AD ${note.year_bucket}`
      : null;

  return (
    <div className="detail-panel">
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Note</span>
      </div>
      <div className="detail-header">
        <div className="detail-kind-badge">📋 Evidence Note</div>
        {note.note_kind && <div className="detail-subtitle">{note.note_kind}{yearLabel ? ` · ${yearLabel}` : ""}</div>}
      </div>
      <div className="detail-body flex-col-12">
        <div className="note-card">
          <MarkdownRenderer onSelectEntity={onSelectEntity}>
            {note.body_md}
          </MarkdownRenderer>
          {note.citation_urls.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {note.citation_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">{url}</a>
              ))}
            </div>
          )}
        </div>
        {entity && note.primary_entity_id && (
          <div className="fact-grid">
            <span className="fact-label">Primary entity</span>
            <span className="fact-value">
              <button
                type="button"
                className="mention-link"
                onClick={() => onSelectEntity(note.primary_entity_type, note.primary_entity_id)}
              >
                {entity}
              </button>
            </span>
          </div>
        )}
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

// ─── Essay view ───────────────────────────────────────────────────────────────────

function EssayView({ essay, onBack, onSelectEntity }: {
  essay: Essay;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  const [popup, setPopup] = useState<{ kind: string; id: string } | null>(null);

  return (
    <div className="detail-panel" style={{ position: "relative" }}>
      <div className="detail-back-bar" style={{ flexShrink: 0 }}>
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Essays</span>
      </div>
      <div className="detail-header" style={{ flexShrink: 0 }}>
        <div className="detail-kind-badge">✍ Essay</div>
        <div className="detail-title">{essay.title}</div>
      </div>
      <div className="detail-body">
        <MarkdownRenderer
          onSelectEntity={(kind, id) => setPopup({ kind, id })}
          searchQuery={searchQuery}
        >
          {essay.body}
        </MarkdownRenderer>
      </div>

      {/* Entity popup — slides up over the essay without losing scroll position */}
      {popup && (
        <div className="essay-popup">
          <EntityMiniCard
            kind={popup.kind}
            id={popup.id}
            onClose={() => setPopup(null)}
            onNavigate={(k, i) => setPopup({ kind: k, id: i })}
            onOpenInSidebar={(k, i) => { setPopup(null); onSelectEntity(k, i); }}
          />
        </div>
      )}
    </div>
  );
}

// ─── EntityMiniCard (popup inside essay view) ──────────────────────────────────

function EntityMiniCard({ kind, id, onClose, onNavigate, onOpenInSidebar }: {
  kind: string;
  id: string;
  onClose: () => void;
  onNavigate: (kind: string, id: string) => void;
  onOpenInSidebar: (kind: string, id: string) => void;
}) {
  const label = getEntityLabel(kind, id);

  const { description, subtitle, tags } = useMemo(() => {
    if (kind === "person") {
      const p = dataStore.people.getById(id);
      return {
        description: p?.description ?? "",
        subtitle: p ? [p.birth_year && `b. AD ${p.birth_year}`, p.death_year && `d. AD ${p.death_year}`].filter(Boolean).join(" · ") : "",
        tags: p?.roles?.slice(0, 3) ?? [],
      };
    }
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      return {
        description: w?.description ?? "",
        subtitle: w ? `${w.author_name_display}${w.year_written_start ? ` · AD ${w.year_written_start}` : ""}` : "",
        tags: [w?.work_type, w?.language].filter(Boolean) as string[],
      };
    }
    if (kind === "doctrine") {
      const d = dataStore.doctrines.getById(id);
      return { description: d?.description ?? "", subtitle: d?.category ?? "", tags: [] };
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      return {
        description: e?.description ?? "",
        subtitle: [e?.year_start && `AD ${e.year_start}`, e?.region].filter(Boolean).join(" · "),
        tags: [e?.event_type].filter(Boolean) as string[],
      };
    }
    if (kind === "city") {
      const c = dataStore.cities.getById(id);
      return { description: "", subtitle: c?.country_modern ?? "", tags: [] };
    }
    if (kind === "persuasion") {
      const p = dataStore.persuasions.getById(id);
      return { description: p?.description ?? "", subtitle: p?.persuasion_stream ?? "", tags: [] };
    }
    if (kind === "polity") {
      const p = dataStore.polities.getById(id);
      return { description: p?.description ?? "", subtitle: [p?.region, p?.capital].filter(Boolean).join(" · "), tags: [] };
    }
    return { description: "", subtitle: "", tags: [] };
  }, [kind, id]);

  // Up to 6 connections
  const connections = useMemo(() => {
    const seen = new Set<string>();
    const list: { othKind: string; othId: string; label: string }[] = [];
    const add = (othKind: string, othId: string, label: string) => {
      const key = `${othKind}:${othId}`;
      if (!seen.has(key)) { seen.add(key); list.push({ othKind, othId, label }); }
    };
    for (const r of dataStore.relations.getForEntity(kind, id)) {
      const isOut   = r.source_id === id && r.source_type === kind;
      const othId   = isOut ? r.target_id : r.source_id;
      const othKind = isOut ? r.target_type : r.source_type;
      add(othKind, othId, getRelationLabel(r.relation_type, isOut));
    }
    if (kind === "person") {
      for (const w of dataStore.works.getAll()) {
        if (w.author_person_id === id) add("work", w.work_id, "authored");
      }
    }
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w?.author_person_id) add("person", w.author_person_id, "by");
    }
    return list.slice(0, 6);
  }, [kind, id]);

  return (
    <div className="mini-card">
      <div className="mini-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mini-card-kind">{MINI_KIND_ICON(kind)} {kind}</div>
          <div className="mini-card-title">{label}</div>
          {subtitle && <div className="mini-card-subtitle">{subtitle}</div>}
          {tags.length > 0 && (
            <div className="flex-wrap-4" style={{ marginTop: 4 }}>
              {tags.map((t, i) => <span key={i} className="tag accent">{t}</span>)}
            </div>
          )}
        </div>
        <button type="button" className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="mini-card-body">
        {description && (
          <p className="mini-card-desc">
            {description.length > 240 ? description.slice(0, 239) + "…" : description}
          </p>
        )}

        {connections.length > 0 && (
          <div>
            <div className="mini-card-section-title">Connections</div>
            {connections.map(({ othKind, othId, label: relLabel }, i) => (
              <button
                key={i}
                type="button"
                className="mini-card-conn"
                onClick={() => onNavigate(othKind, othId)}
              >
                <span className="faint">{MINI_KIND_ICON(othKind)}</span>
                <span className="mini-card-conn-label">{getEntityLabel(othKind, othId)}</span>
                <span className="mini-card-conn-rel">{relLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mini-card-footer">
        <button type="button" className="view-on-map-btn" style={{ flex: 1 }} onClick={() => onOpenInSidebar(kind, id)}>
          View full details →
        </button>
        <button type="button" className="map-overlay-btn" onClick={onClose}>
          ✕ Close
        </button>
      </div>
    </div>
  );
}
