import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { PlaceKind } from "../../data/dataStore";
import s from "./RightPanel.module.css";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import type { PanelTab } from "../../stores/appStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { SearchInput } from "../shared/SearchInput";
import { Tabs } from "../shared/Tabs";
import { ESSAYS, type Essay } from "../../data/essays";
import { extractEssayEntities, groupByKind } from "../../utils/extractEssayEntities";
import { kindIcon, kindLabel } from "../shared/entityConstants";

// ── Extracted modules ────────────────────────────────────────────────────────
import { PanelShell } from "../panel/PanelShell";
import { EntityDetail } from "../panel/EntityDetail";
import {
  PlacesList, GroupsList,
  PeopleList, PropositionsList, EventsList, WorksList, EssaysList,
} from "../panel/PanelLists";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: PanelTab; icon: string; label: string }[] = [
  { id: "places",       icon: "🏛",  label: "Places" },
  { id: "groups",       icon: "✦",  label: "Groups" },
  { id: "people",       icon: "👤", label: "People" },
  { id: "propositions", icon: "📝", label: "Propositions" },
  { id: "events",       icon: "⚡",  label: "Events" },
  { id: "works",        icon: "📜", label: "Works" },
  { id: "essays",       icon: "✍",  label: "Essays" },
];

// ─── RightPanel ──────────────────────────────────────────────────────────────

interface RightPanelProps {
  onFlyToPlace: (placeId: string) => void;
  currentDecade: number;
}

export function RightPanel({ onFlyToPlace, currentDecade }: RightPanelProps) {
  const panelTab         = useAppStore((s) => s.panelTab);
  const panelSearch      = useAppStore((s) => s.panelSearch);
  const selection        = useAppStore((s) => s.selection);
  const mapFilterType    = useAppStore((s) => s.mapFilterType);
  const mapFilterId      = useAppStore((s) => s.mapFilterId);

  const setPanelTab        = useAppStore((s) => s.setPanelTab);
  const setPanelSearch     = useAppStore((s) => s.setPanelSearch);
  const setSelection       = useAppStore((s) => s.setSelection);
  const setMapFilter       = useAppStore((s) => s.setMapFilter);
  const clearMapFilter     = useAppStore((s) => s.clearMapFilter);
  const toggleRightPanel   = useAppStore((s) => s.toggleRightPanel);
  const pushSelection      = useAppStore((s) => s.pushSelection);
  const popSelection       = useAppStore((s) => s.popSelection);
  const selectionHistory   = useAppStore((s) => s.selectionHistory);

  const pendingEssayId   = useAppStore((s) => s.pendingEssayId);
  const setPendingEssay   = useAppStore((s) => s.setPendingEssay);

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [rpPlaceKind, setRpPlaceKind] = useState<PlaceKind | null>(null);
  const [rpChristianOnly, setRpChristianOnly] = useState(false);
  const essays = ESSAYS;

  // Pick up pending essay from wiki "Open in map"
  useEffect(() => {
    if (pendingEssayId) {
      const essay = ESSAYS.find((e) => e.id === pendingEssayId);
      if (essay) setSelectedEssay(essay);
      setPendingEssay(null);
    }
  }, [pendingEssayId, setPendingEssay]);

  const handleEssayEntitySelect = (kind: string, id: string) => {
    if (kind === "place") onFlyToPlace(id);
    pushSelection({ kind: kind as Selection["kind"], id });
  };

  const handleEntitySelect = (kind: string, id: string) => {
    if (selection?.kind === kind && selection?.id === id) return;
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
      <PanelShell onDismiss={toggleRightPanel}>
        <NoteDetail noteId={selection.id} onBack={handleBack} onSelectEntity={handleEntitySelect} />
      </PanelShell>
    );
  }

  if (selection) {
    return (
      <PanelShell onDismiss={toggleRightPanel}>
        <EntityDetail
          key={`${selection.kind}:${selection.id}`}
          kind={selection.kind}
          id={selection.id}
          hasHistory={selectionHistory.length > 0}
          onBack={handleBack}
          onExit={() => { setSelection(null); }}
          onSelectEntity={handleEntitySelect}
          mapFilterType={mapFilterType}
          mapFilterId={mapFilterId}
          setMapFilter={setMapFilter}
          clearMapFilter={clearMapFilter}
          currentDecade={currentDecade}
          searchQuery={panelSearch}
        />
      </PanelShell>
    );
  }

  if (selectedEssay) {
    return (
      <PanelShell onDismiss={toggleRightPanel}>
        <EssayView
          essay={selectedEssay}
          onBack={() => { setSelectedEssay(null); }}
          onSelectEntity={handleEssayEntitySelect}
        />
      </PanelShell>
    );
  }

  // ── List views ──────────────────────────────────────────────────────────

  return (
    <PanelShell onDismiss={toggleRightPanel}>
      {/* Tab bar */}
      <Tabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
        active={panelTab}
        onChange={(id) => setPanelTab(id as PanelTab)}
        compact
      />

      {/* Search bar */}
      <div className={s.toolbar}>
        <SearchInput
          value={panelSearch}
          onChange={setPanelSearch}
          placeholder={`Search ${TABS.find((t) => t.id === panelTab)?.label.toLowerCase() ?? ""}…`}
        />
      </div>

      {/* Tab content */}
      <div className={s.list}>
        {panelTab === "places" && (
          <PlacesList
            search={panelSearch}
            currentDecade={currentDecade}
            onSelectPlace={(id) => handleEntitySelect("place", id)}
            onFlyToPlace={onFlyToPlace}
            placeKindFilterOverride={rpPlaceKind}
            setPlaceKindFilterOverride={setRpPlaceKind}
            christianOnlyOverride={rpChristianOnly}
            setChristianOnlyOverride={setRpChristianOnly}
          />
        )}
        {panelTab === "groups" && (
          <GroupsList
            search={panelSearch}
            currentDecade={currentDecade}
            onSelect={(id) => handleEntitySelect("group", id)}
            mapFilterId={mapFilterId}
            mapFilterType={mapFilterType}
          />
        )}
        {panelTab === "people" && (
          <PeopleList
            search={panelSearch}
            onSelect={(id) => handleEntitySelect("person", id)}
          />
        )}
        {panelTab === "propositions" && (
          <PropositionsList
            search={panelSearch}
            onSelect={(id) => handleEntitySelect("proposition", id)}
          />
        )}
        {panelTab === "events" && (
          <EventsList
            search={panelSearch}
            onSelect={(id) => handleEntitySelect("event", id)}
          />
        )}
        {panelTab === "works" && (
          <WorksList
            search={panelSearch}
            onSelect={(id) => handleEntitySelect("work", id)}
          />
        )}
        {panelTab === "essays" && (
          <EssaysList
            search={panelSearch}
            essays={essays}
            loading={false}
            onSelect={setSelectedEssay}
          />
        )}
      </div>
    </PanelShell>
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
    <div className={s.panel}>
      <div className={s.backBar}><button type="button" className={s.backBtn} onClick={onBack}>← Back</button></div>
      <div className={s.emptyState}>Note not found.</div>
    </div>
  );

  const entity = note.entity_id
    ? getEntityLabel(note.entity_type, note.entity_id)
    : null;

  return (
    <div className={s.panel}>
      <div className={s.backBar}>
        <button type="button" className={s.backBtn} onClick={onBack}>← Back</button>
        <span className={s.crumb}>Note</span>
      </div>
      <div className={s.header}>
        <div className={s.kindBadge}>📋 Editor Note</div>
        <div className={s.subtitle}>{note.note_kind}</div>
      </div>
      <div className={`${s.body} ${s.bodyGap12}`}>
        <div className={s.noteCard}>
          <MarkdownRenderer onSelectEntity={onSelectEntity}>
            {note.body_md}
          </MarkdownRenderer>
        </div>
        {entity && note.entity_id && (
          <div className={s.factGrid}>
            <span className={s.factLabel}>Primary entity</span>
            <span className={s.factValue}>
              <button
                type="button"
                className={s.mentionLink}
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

const essayScrollMap = new Map<string, number>();

function EssayView({ essay, onBack, onSelectEntity }: {
  essay: Essay;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [essayTab, setEssayTab] = useState<"content" | "entities">("content");

  const handleScroll = useCallback(() => {
    if (bodyRef.current) essayScrollMap.set(essay.id, bodyRef.current.scrollTop);
  }, [essay.id]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = essayScrollMap.get(essay.id) ?? 0;
      }
    });
  }, [essay.id]);

  const entityGroups = useMemo(() => groupByKind(extractEssayEntities(essay.body)), [essay.body]);
  const entityCount = useMemo(() => entityGroups.reduce((n, [, refs]) => n + refs.length, 0), [entityGroups]);

  return (
    <div className={s.panel}>
      <div className={s.backBar}>
        <button type="button" className={s.backBtn} onClick={onBack}>← Back</button>
        <span className={s.crumb}>Essays</span>
      </div>
      <div className={s.header}>
        <div className={s.kindBadge}>✍ Essay</div>
        <div className={s.title}>{essay.title}</div>
      </div>
      <div className={s.essayTabBar}>
        <button type="button" className={`${s.essayTab}${essayTab === "content" ? ` ${s.essayTabActive}` : ""}`}
          onClick={() => setEssayTab("content")}>Content</button>
        <button type="button" className={`${s.essayTab}${essayTab === "entities" ? ` ${s.essayTabActive}` : ""}`}
          onClick={() => setEssayTab("entities")}>Entities ({entityCount})</button>
      </div>
      {essayTab === "content" ? (
        <div className={s.body} ref={bodyRef} onScroll={handleScroll}>
          <MarkdownRenderer
            onSelectEntity={onSelectEntity}
            searchQuery={searchQuery}
          >
            {essay.body}
          </MarkdownRenderer>
        </div>
      ) : (
        <div className={s.body}>
          {entityGroups.map(([kind, refs]) => (
            <div key={kind}>
              <div className={s.entityGroupLabel}>{kindLabel(kind)} ({refs.length})</div>
              {refs.map((r) => (
                <button key={`${r.kind}:${r.id}`} type="button" className={s.entityItem}
                  onClick={() => onSelectEntity(r.kind, r.id)}>
                  <span className={s.entityItemIcon}>{kindIcon(r.kind)}</span>
                  <span className={s.entityItemLabel}>{r.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
