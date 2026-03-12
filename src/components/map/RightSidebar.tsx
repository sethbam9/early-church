import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import type { SidebarTab } from "../../stores/appStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { ESSAYS, type Essay } from "../../data/essays";

// ── Extracted modules ────────────────────────────────────────────────────────
import { SidebarShell } from "../sidebar/SidebarShell";
import { EntityDetail } from "../sidebar/EntityDetail";
import {
  PlacesList, GroupsList,
  PeopleList, PropositionsList, EventsList, WorksList, EssaysList,
} from "../sidebar/SidebarLists";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: SidebarTab; icon: string; label: string }[] = [
  { id: "places",       icon: "🏛",  label: "Places" },
  { id: "groups",       icon: "✦",  label: "Groups" },
  { id: "people",       icon: "👤", label: "People" },
  { id: "propositions", icon: "📝", label: "Propositions" },
  { id: "events",       icon: "⚡",  label: "Events" },
  { id: "works",        icon: "📜", label: "Works" },
  { id: "essays",       icon: "✍",  label: "Essays" },
];

// ─── RightSidebar ─────────────────────────────────────────────────────────────

interface RightSidebarProps {
  onFlyToPlace: (placeId: string) => void;
  currentDecade: number;
}

export function RightSidebar({ onFlyToPlace, currentDecade }: RightSidebarProps) {
  const sidebarTab       = useAppStore((s) => s.sidebarTab);
  // sidebarExpanded removed — sidebar is now drag-resizable
  const sidebarSearch    = useAppStore((s) => s.sidebarSearch);
  const selection        = useAppStore((s) => s.selection);
  const mapFilterType    = useAppStore((s) => s.mapFilterType);
  const mapFilterId      = useAppStore((s) => s.mapFilterId);

  const setSidebarTab      = useAppStore((s) => s.setSidebarTab);
  const setSidebarSearch   = useAppStore((s) => s.setSidebarSearch);
  const setSelection       = useAppStore((s) => s.setSelection);
  const setMapFilter       = useAppStore((s) => s.setMapFilter);
  const clearMapFilter     = useAppStore((s) => s.clearMapFilter);
  const toggleRightPanel   = useAppStore((s) => s.toggleRightPanel);
  const pushSelection      = useAppStore((s) => s.pushSelection);
  const popSelection       = useAppStore((s) => s.popSelection);
  const selectionHistory   = useAppStore((s) => s.selectionHistory);

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [essayOverlay, setEssayOverlay] = useState<Selection | null>(null);
  const essays = ESSAYS;

  const handleEssayEntitySelect = (kind: string, id: string) => {
    if (kind === "place") onFlyToPlace(id);
    setEssayOverlay({ kind: kind as Selection["kind"], id });
  };

  const handleEntitySelect = (kind: string, id: string) => {
    if (kind === "place") onFlyToPlace(id);
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

  if (selection?.kind === "editor_note") {
    return (
      <SidebarShell onDismiss={toggleRightPanel}>
        <NoteDetail noteId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </SidebarShell>
    );
  }

  if (selection) {
    return (
      <SidebarShell onDismiss={toggleRightPanel}>
        <EntityDetail
          key={`${selection.kind}:${selection.id}`}
          kind={selection.kind}
          id={selection.id}
          onBack={handleBack}
          onExit={() => { setSelection(null); }}
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
      <SidebarShell onDismiss={toggleRightPanel}>
        <EssayView
          essay={selectedEssay}
          onBack={() => { setSelectedEssay(null); setEssayOverlay(null); }}
          onSelectEntity={handleEssayEntitySelect}
        />
        {essayOverlay && (
          <div className="essay-entity-overlay">
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
          </div>
        )}
      </SidebarShell>
    );
  }

  // ── List views ──────────────────────────────────────────────────────────

  return (
    <SidebarShell onDismiss={toggleRightPanel}>
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
          <span className="search-input-icon">🔍</span>
          <input
            type="text"
            placeholder={`Search ${TABS.find((t) => t.id === sidebarTab)?.label.toLowerCase() ?? ""}…`}
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
          />
          {sidebarSearch && (
            <button type="button" className="close-btn" onClick={() => setSidebarSearch("")}>✕</button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="sidebar-list">
        {sidebarTab === "places" && (
          <PlacesList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelectPlace={(id) => handleEntitySelect("place", id)}
            onFlyToPlace={onFlyToPlace}
          />
        )}
        {sidebarTab === "groups" && (
          <GroupsList
            search={sidebarSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("group", id)}
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
        {sidebarTab === "propositions" && (
          <PropositionsList
            search={sidebarSearch}
            onSelect={(id) => handleEntitySelect("proposition", id)}
          />
        )}
        {sidebarTab === "events" && (
          <EventsList
            search={sidebarSearch}
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
  const note = dataStore.editorNotes.getById(noteId);
  if (!note) return (
    <div className="detail-panel">
      <div className="detail-back-bar"><button type="button" className="back-btn" onClick={onBack}>← Back</button></div>
      <div className="empty-state">Note not found.</div>
    </div>
  );

  const entity = note.entity_id
    ? getEntityLabel(note.entity_type, note.entity_id)
    : null;

  return (
    <div className="detail-panel">
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Note</span>
      </div>
      <div className="detail-header">
        <div className="detail-kind-badge">📋 Editor Note</div>
        <div className="detail-subtitle">{note.note_kind}</div>
      </div>
      <div className="detail-body flex-col-12">
        <div className="note-card">
          <MarkdownRenderer onSelectEntity={onSelectEntity}>
            {note.body_md}
          </MarkdownRenderer>
        </div>
        {entity && note.entity_id && (
          <div className="fact-grid">
            <span className="fact-label">Primary entity</span>
            <span className="fact-value">
              <button
                type="button"
                className="mention-link"
                onClick={() => onSelectEntity(note.entity_type, note.entity_id)}
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

// ─── Essay view ───────────────────────────────────────────────────────────────────

function EssayView({ essay, onBack, onSelectEntity }: {
  essay: Essay;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();

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
          onSelectEntity={onSelectEntity}
          searchQuery={searchQuery}
        >
          {essay.body}
        </MarkdownRenderer>
      </div>
    </div>
  );
}
