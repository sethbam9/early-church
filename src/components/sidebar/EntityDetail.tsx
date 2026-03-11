import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { EntityHeader } from "../shared/EntityHeader";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { NoteCard } from "../shared/NoteCard";
import { kindIcon, kindLabel, PRESENCE_COLORS, PRESENCE_LABELS, CERTAINTY_COLORS } from "../shared/entityConstants";
import { CrossPageNav } from "../shared/CrossPageNav";
import { FootprintCard } from "../shared/FootprintCard";
import { PassageReference } from "../shared/PassageReference";
import { getPredicateLabel } from "../../domain/relationLabels";
import { getSourceExternalUrl, getSourceAccessTitle } from "../../utils/sourceLinks";
import type { Claim, EntityPlaceFootprint, PlaceStateByDecade } from "../../data/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityDetailTab =
  | "info" | "timeline" | "people" | "places" | "groups"
  | "works" | "events" | "propositions" | "topics" | "notes" | "mentions";

interface ConnectedEntity {
  kind: string;
  id: string;
  claims: Claim[];
}

// ─── Tab label map ────────────────────────────────────────────────────────────

const TAB_LABELS: Record<EntityDetailTab, string> = {
  info:         "Info",
  timeline:     "Timeline",
  people:       "People",
  places:       "Places",
  groups:       "Groups",
  works:        "Works",
  events:       "Events",
  propositions: "Propositions",
  topics:       "Topics",
  notes:        "Notes",
  mentions:     "Mentions",
};

// ─── EntityDetail (main) ─────────────────────────────────────────────────────

interface EntityDetailProps {
  kind: string;
  id: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
  mapFilterType?: string | null;
  mapFilterId?: string | null;
  setMapFilter?: (type: string, id: string) => void;
  clearMapFilter?: () => void;
  currentDecade?: number;
}

export function EntityDetail({
  kind, id, onBack, onSelectEntity,
  mapFilterType, mapFilterId, setMapFilter, clearMapFilter, currentDecade = 0,
}: EntityDetailProps) {
  const [activeTab, setActiveTab] = useState<EntityDetailTab>("info");

  const isFiltered = mapFilterType === kind && mapFilterId === id;
  const canFilter  = ["group", "person", "proposition", "event", "work"].includes(kind);

  const toggleFilter = () => {
    if (isFiltered) clearMapFilter?.();
    else setMapFilter?.(kind, id);
  };

  // ── Data ────────────────────────────────────────────────────────────────
  const editorNotes  = useMemo(() => dataStore.editorNotes.getForEntity(kind, id), [kind, id]);
  const footprints   = useMemo(() => dataStore.footprints.getForEntityDeduped(kind, id), [kind, id]);
  const mentions     = useMemo(() => dataStore.noteMentions.getMentioning(kind, id), [kind, id]);
  const placeStates  = useMemo(() => kind === "place" ? dataStore.map.getPlaceStatesForPlace(id) : [], [kind, id]);
  const datedClaims  = useMemo(() => kind !== "place" ? dataStore.claims.getDatedSorted(kind, id) : [], [kind, id]);

  const grouped = useMemo(() => dataStore.claims.getGroupedByObjectType(kind, id), [kind, id]);

  // Secondary grouping: for each entity type, group claims by connected entity ID
  const connectedByType = useMemo((): Record<string, ConnectedEntity[]> => {
    const result: Record<string, ConnectedEntity[]> = {};
    for (const [entityType, claimsForType] of grouped.entries()) {
      if (entityType === "scalar" || !entityType) continue;
      const entityMap = new Map<string, Claim[]>();
      for (const c of claimsForType) {
        const isSubject = c.subject_type === kind && c.subject_id === id;
        const othId = isSubject ? c.object_id : c.subject_id;
        if (!othId) continue;
        const arr = entityMap.get(othId) ?? [];
        arr.push(c);
        entityMap.set(othId, arr);
      }
      result[entityType] = Array.from(entityMap.entries()).map(([eid, eClaims]) => ({
        kind: entityType, id: eid, claims: eClaims,
      }));
    }
    return result;
  }, [grouped, kind, id]);

  // ── Build available tabs ─────────────────────────────────────────────────
  const availableTabs = useMemo((): { id: EntityDetailTab; label: string }[] => {
    const tabs: { id: EntityDetailTab; label: string }[] = [
      { id: "info", label: TAB_LABELS.info },
    ];

    const timelineCount = kind === "place" ? placeStates.length : datedClaims.length;
    if (timelineCount > 0)
      tabs.push({ id: "timeline", label: `Timeline (${timelineCount})` });

    const RELATION_TYPES: { type: string; tab: EntityDetailTab }[] = [
      { type: "person",      tab: "people"       },
      { type: "group",       tab: "groups"        },
      { type: "work",        tab: "works"         },
      { type: "event",       tab: "events"        },
      { type: "proposition", tab: "propositions"  },
      { type: "topic",       tab: "topics"        },
    ];
    for (const { type, tab } of RELATION_TYPES) {
      const n = connectedByType[type]?.length ?? 0;
      if (n > 0) tabs.push({ id: tab, label: `${TAB_LABELS[tab]} (${n})` });
    }

    if (footprints.length > 0)
      tabs.push({ id: "places", label: `Places (${footprints.length})` });

    if (editorNotes.length > 0)
      tabs.push({ id: "notes", label: `Notes (${editorNotes.length})` });
    if (mentions.length > 0)
      tabs.push({ id: "mentions", label: `Mentions (${mentions.length})` });

    return tabs;
  }, [kind, id, placeStates.length, datedClaims.length, connectedByType, footprints.length, editorNotes.length, mentions.length]);

  // Reset tab when entity changes
  useEffect(() => { setActiveTab("info"); }, [kind, id]);

  // ── Place-specific header data ───────────────────────────────────────────
  const activeDecade = useAppStore((s) => s.activeDecade);
  const currentState = useMemo(
    () => kind === "place" ? dataStore.map.getCurrentPlaceState(id, activeDecade) : undefined,
    [kind, id, activeDecade],
  );

  return (
    <div className="detail-panel">
      {/* Back bar */}
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">{kindLabel(kind)}</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <CrossPageNav kind={kind} id={id} current="map" />
        </div>
        <EntityHeader kind={kind} id={id} />

        {/* Place: presence status + group chips */}
        {kind === "place" && currentState && (
          <PlacePresenceChips
            currentState={currentState}
            activeDecade={activeDecade}
            onSelectEntity={onSelectEntity}
          />
        )}
      </div>

      {/* Map filter banner */}
      {canFilter && setMapFilter && (
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
        {activeTab === "info" && (
          <InfoTab kind={kind} id={id} editorNotes={editorNotes} onSelectEntity={onSelectEntity} />
        )}
        {activeTab === "timeline" && kind === "place" && (
          <PlaceTimelineTab placeStates={placeStates} placeId={id} activeDecade={activeDecade} onSelectEntity={onSelectEntity} />
        )}
        {activeTab === "timeline" && kind !== "place" && (
          <EntityTimelineTab claims={datedClaims} entityKind={kind} entityId={id} onSelectEntity={onSelectEntity} />
        )}
        {activeTab === "people"       && <RelationTab entities={connectedByType["person"]      ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "groups"       && <RelationTab entities={connectedByType["group"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "works"        && <RelationTab entities={connectedByType["work"]        ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "events"       && <RelationTab entities={connectedByType["event"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "propositions" && <RelationTab entities={connectedByType["proposition"] ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "topics"       && <RelationTab entities={connectedByType["topic"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "places"       && <PlacesTab footprints={footprints} onSelectEntity={onSelectEntity} />}
        {activeTab === "notes"        && <NotesTab notes={editorNotes} onSelectEntity={onSelectEntity} />}
        {activeTab === "mentions"     && <MentionsTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
      </div>
    </div>
  );
}

// ─── Place presence chips (place header extra) ────────────────────────────────

function PlacePresenceChips({ currentState, activeDecade, onSelectEntity }: {
  currentState: PlaceStateByDecade;
  activeDecade: number;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const presenceColor = PRESENCE_COLORS[currentState.presence_status] ?? "#8e8070";
  return (
    <div className="detail-tags detail-tags--spaced">
      <span className="tag">AD {activeDecade}</span>
      <span className="tag" style={{ background: `${presenceColor}18`, borderColor: `${presenceColor}55`, color: presenceColor }}>
        {PRESENCE_LABELS[currentState.presence_status] ?? currentState.presence_status}
      </span>
      {currentState.dominant_polity_group_id && (
        <button type="button" className="tag tag-clickable tag-persuasion"
          onClick={() => onSelectEntity("group", currentState.dominant_polity_group_id)}
          title="Dominant polity"
        >
          ⚔ {dataStore.groups.getById(currentState.dominant_polity_group_id)?.group_label ?? currentState.dominant_polity_group_id}
        </button>
      )}
      {currentState.group_presence_summary
        .filter((gid) => gid !== currentState.dominant_polity_group_id)
        .map((gid) => {
          const group = dataStore.groups.getById(gid);
          if (!group) return null;
          return (
            <button key={gid} type="button" className="tag tag-clickable" onClick={() => onSelectEntity("group", gid)}>
              {group.group_label}
            </button>
          );
        })}
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ kind, id, editorNotes, onSelectEntity }: {
  kind: string; id: string;
  editorNotes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  return (
    <div className="flex-col-12">
      <EntityHeader kind={kind} id={id} showAllFields onSelectEntity={onSelectEntity} />
      {editorNotes.length > 0 && (
        <div className="flex-col-8">
          <div className="detail-section-title">Editor Notes</div>
          {editorNotes.map((n) => (
            <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Place timeline tab (decade-by-decade) ────────────────────────────────────

function PlaceTimelineTab({ placeStates, placeId, activeDecade, onSelectEntity }: {
  placeStates: PlaceStateByDecade[];
  placeId: string;
  activeDecade: number;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeDecade]);

  const footprintsByDecade = useMemo(
    () => dataStore.footprints.getByDecadeForPlace(placeId, placeStates),
    [placeId, placeStates],
  );

  if (placeStates.length === 0) return <div className="empty-state">No timeline data.</div>;

  return (
    <div className="tl-v-list">
      {placeStates.map((ps, idx) => {
        const isActive  = ps.decade === activeDecade;
        const isLast    = idx === placeStates.length - 1;
        const dotColor  = PRESENCE_COLORS[ps.presence_status] ?? "#8e8070";
        const statusLabel = PRESENCE_LABELS[ps.presence_status] ?? ps.presence_status;
        const decadeFootprints = footprintsByDecade.get(ps.decade) ?? [];
        return (
          <div key={ps.decade} ref={isActive ? activeRowRef : null}
            className={`tl-v-row${isActive ? " tl-v-row--active" : ""}`}
          >
            <div className={`tl-v-gutter${isLast ? " tl-v-gutter--last" : ""}`}>
              <span className={`tl-v-dot${isActive ? " tl-v-dot--active" : ""}`}
                style={{ borderColor: dotColor, background: isActive ? dotColor : "transparent",
                  boxShadow: isActive ? `0 0 0 4px ${dotColor}22` : undefined }}
              />
            </div>
            <div className="tl-v-content">
              <div className="tl-v-status" style={{ color: dotColor }}>{statusLabel}</div>
              <div className="tl-v-meta">
                <span className="tl-v-year">{isActive ? `▶ AD ${ps.decade}` : `AD ${ps.decade}`}</span>
                {ps.dominant_polity_group_id && (() => {
                  const polity = dataStore.groups.getById(ps.dominant_polity_group_id);
                  return polity ? (
                    <button type="button" className="timeline-polity-btn" onClick={() => onSelectEntity("group", ps.dominant_polity_group_id)}>
                      {polity.group_label}
                    </button>
                  ) : null;
                })()}
                {ps.group_presence_summary
                  .filter((gid) => gid !== ps.dominant_polity_group_id)
                  .map((gid) => {
                    const g = dataStore.groups.getById(gid);
                    return g ? (
                      <button key={gid} type="button" className="timeline-persuasion-btn" onClick={() => onSelectEntity("group", gid)}>
                        {g.group_label}
                      </button>
                    ) : null;
                  })}
              </div>
              {decadeFootprints.length > 0 && (() => {
                const groupIds = new Set([ps.dominant_polity_group_id, ...ps.group_presence_summary].filter(Boolean));
                const filtered = decadeFootprints.filter((fp) => !(fp.entity_type === "group" && groupIds.has(fp.entity_id)));
                return filtered.length > 0 ? (
                  <div className="fp-stack">
                    {filtered.map((fp, i) => (
                      <FootprintCard key={`${fp.entity_type}:${fp.entity_id}:${fp.reason_predicate_id}:${i}`}
                        footprint={fp} showEntity showPlace={false} onSelectEntity={onSelectEntity} />
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Entity timeline tab (dated claims) ───────────────────────────────────────

function EntityTimelineTab({ claims, entityKind, entityId, onSelectEntity }: {
  claims: Claim[];
  entityKind: string;
  entityId: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(claims, PAGE_SIZE);
  if (claims.length === 0) return <div className="empty-state">No dated claims.</div>;
  return (
    <div className="flex-col">
      {pageItems.map((c) => {
        const isSubject = c.subject_type === entityKind && c.subject_id === entityId;
        const othKind   = isSubject ? c.object_type : c.subject_type;
        const othId     = isSubject ? c.object_id   : c.subject_id;
        const predLabel = getPredicateLabel(c.predicate_id, isSubject);
        const othLabel  = othId ? getEntityLabel(othKind, othId) : (c.value_text || c.value_year?.toString() || "—");
        const yearStr = `AD ${c.year_start}${c.year_end && c.year_end !== c.year_start ? `–${c.year_end}` : ""}`;
        return (
          <div key={c.claim_id} className="tl-v-row">
            <div className="tl-v-gutter">
              <span className="tl-v-dot" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            </div>
            <div className="tl-v-content">
              <div className="tl-v-year">{yearStr}</div>
              <div className="tl-v-status">
                <span className="faint">{predLabel}</span>{" "}
                {othId ? (
                  <button type="button" className="mention-link" onClick={() => onSelectEntity(othKind, othId)}>
                    {kindIcon(othKind)} {othLabel}
                  </button>
                ) : othLabel}
              </div>
              {c.certainty && c.certainty !== "attested" && (
                <span className="rel-certainty" style={{ color: CERTAINTY_COLORS[c.certainty] ?? "var(--text-faint)" }}>
                  {c.certainty}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Relation tab (people / groups / works / events / propositions / topics) ──

function RelationTab({ entities, focusKind, focusId, onSelectEntity }: {
  entities: ConnectedEntity[];
  focusKind: string;
  focusId: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(entities, PAGE_SIZE);

  if (entities.length === 0) return <div className="empty-state">None.</div>;

  return (
    <div className="flex-col">
      {pageItems.map(({ kind, id, claims: eClaims }) => {
        const label      = getEntityLabel(kind, id);
        const isOpen     = expandedId === id;
        const predicates = Array.from(new Set(eClaims.map((c) => {
          const isSub = c.subject_type === focusKind && c.subject_id === focusId;
          return getPredicateLabel(c.predicate_id, isSub);
        })));
        const evidence = eClaims.flatMap((c) =>
          dataStore.claimEvidence.getForClaim(c.claim_id).map((ev) => ({ ...ev, claim: c })),
        );
        const hasCertainty = eClaims.some((c) => c.certainty && c.certainty !== "attested");

        return (
          <div key={id} className="conn-card conn-card--col">
            <div className="conn-card-row" onClick={() => onSelectEntity(kind, id)}>
              <span className="conn-icon">{kindIcon(kind)}</span>
              <div className="conn-card-body">
                <div className="conn-name">{label}</div>
                <div className="conn-rel">{predicates.join(" · ")}</div>
              </div>
              <div className="rel-card-badges">
                {hasCertainty && (
                  <span className="rel-certainty" style={{ color: CERTAINTY_COLORS[eClaims.find((c) => c.certainty && c.certainty !== "attested")?.certainty ?? ""] ?? "var(--text-faint)" }}>
                    {eClaims.find((c) => c.certainty && c.certainty !== "attested")?.certainty}
                  </span>
                )}
                {evidence.length > 0 && (
                  <button type="button" className="rel-expand-btn"
                    onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : id); }}
                    title={isOpen ? "Hide evidence" : "Show evidence"}
                  >
                    {isOpen ? "▲" : "▼"}
                  </button>
                )}
              </div>
            </div>

            {isOpen && evidence.length > 0 && (
              <div className="rel-card-evidence">
                {evidence.map((ev) => {
                  const passage = dataStore.passages.getById(ev.passage_id);
                  const source  = passage ? dataStore.sources.getById(passage.source_id) : null;
                  const url     = getSourceExternalUrl(source);
                  return (
                    <div key={`${ev.claim_id}-${ev.passage_id}`} className="evidence-item">
                      <div className="evidence-item-meta">
                        <span className="faint">{ev.evidence_role}</span>
                        {ev.evidence_weight != null && (
                          <span className="faint" title="Evidence weight">⚖ {ev.evidence_weight}</span>
                        )}
                      </div>
                      {passage && <PassageReference passage={passage} source={source} />}
                      {(ev.excerpt_override || passage?.excerpt) && (
                        <div className="evidence-excerpt">{ev.excerpt_override || passage?.excerpt}</div>
                      )}
                      {ev.notes && <div className="evidence-note faint">{ev.notes}</div>}
                      {source && url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="citation-link evidence-source" title={getSourceAccessTitle(source)}>
                          {source.title}
                        </a>
                      )}
                      {source?.work_id && (
                        <button type="button" className="mention-link"
                          onClick={() => onSelectEntity("work", source.work_id)}>
                          Open work
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Places tab (footprints) ──────────────────────────────────────────────────

function PlacesTab({ footprints, onSelectEntity }: {
  footprints: EntityPlaceFootprint[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(footprints, PAGE_SIZE);
  if (footprints.length === 0) return <div className="empty-state">No locations found.</div>;
  return (
    <div className="flex-col">
      {pageItems.map((f, i) => (
        <FootprintCard key={`${f.place_id}:${i}`} footprint={f} showEntity={false} showPlace onSelectEntity={onSelectEntity} />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ notes, onSelectEntity }: {
  notes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(notes, PAGE_SIZE);
  if (notes.length === 0) return <div className="empty-state">No editor notes.</div>;
  return (
    <div className="flex-col-8">
      {pageItems.map((n) => (
        <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity}
          searchQuery={searchQuery} yearLabel={n.note_kind} />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Mentions tab ─────────────────────────────────────────────────────────────

function MentionsTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const notes = useMemo(() => dataStore.editorNotes.getMentioningNotes(kind, id), [kind, id]);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(notes, PAGE_SIZE);
  if (notes.length === 0) return <div className="empty-state">No notes mention this entity.</div>;
  return (
    <div className="flex-col-8">
      {pageItems.map((n) => (
        <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} yearLabel={n.note_kind} />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
