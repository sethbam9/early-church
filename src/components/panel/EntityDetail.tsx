import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { EntityHeader, getEntityHeaderData } from "../shared/EntityHeader";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { NoteCard } from "../shared/NoteCard";
import { kindIcon, kindLabel, PRESENCE_COLORS, PRESENCE_LABELS } from "../shared/entityConstants";
import { CertaintyBadge } from "../shared/CertaintyBadge";
import { FootprintCard } from "../shared/FootprintCard";
import { Timeline } from "../shared/Timeline";
import type { TimelineRow } from "../shared/Timeline";
import { EvidenceCard } from "../shared/EvidenceCard";
import { EntityHoverWrap } from "../shared/EntityHoverCard";
import { ExternalLink } from "../shared/ExternalLink";
import { getPredicateLabel } from "../../domain/relationLabels";
import type { Claim, EntityPlaceFootprint, PlaceStateByDecade } from "../../data/types";
import { truncateLabel, formatYearRange, formatDecadeLabel } from "../../utils/formatYear";
import ed from "./EntityDetail.module.css";

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
  propositions: "Beliefs",
  topics:       "Topics",
  notes:        "Notes",
  mentions:     "Mentions",
};

// ─── EntityDetail (main) ─────────────────────────────────────────────────────

interface EntityDetailProps {
  kind: string;
  id: string;
  onBack: () => void;
  onExit?: () => void;
  onSelectEntity: (kind: string, id: string) => void;
  onHoverEntity?: (kind: string, id: string) => void;
  onLeaveEntity?: () => void;
  mapFilterType?: string | null;
  mapFilterId?: string | null;
  setMapFilter?: (type: string, id: string) => void;
  clearMapFilter?: () => void;
  currentDecade?: number;
  currentPage?: "map" | "graph" | "wiki";
  hideBackBar?: boolean;
  hasHistory?: boolean;
  searchQuery?: string;
}

export function EntityDetail({
  kind, id, onBack, onExit, onSelectEntity, onHoverEntity, onLeaveEntity,
  mapFilterType, mapFilterId, setMapFilter, clearMapFilter, currentDecade = 0,
  currentPage = "map",
  hideBackBar = false,
  hasHistory,
  searchQuery: searchQueryProp,
}: EntityDetailProps) {
  const storeSearchQuery = useAppStore((s) => s.searchQuery).trim();
  const resolvedSearchQuery = searchQueryProp ?? storeSearchQuery;
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
    <div className={ed.panel}>
      {/* Back bar */}
      {!hideBackBar && (
        <div className={ed.backBar}>
          {hasHistory && (
            <button type="button" className={ed.backBtn} onClick={onBack}>← Back</button>
          )}
          <span className={ed.crumb}>{kindLabel(kind)}</span>
          {onExit && <button type="button" className={`${ed.backBtn} ${ed.exitBtn}`} onClick={onExit} title="Exit to list">✕</button>}
        </div>
      )}

      {/* Header */}
      <div className={ed.header}>
        <EntityHeader kind={kind} id={id} currentPage={hideBackBar ? undefined : currentPage} />

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
        <div className={ed.filterBanner}>
          <span>🗺 Filter map to this {kindLabel(kind).toLowerCase()}</span>
          <button
            type="button"
            className={`${ed.filterToggleBtn}${isFiltered ? ` ${ed.filterToggleBtnOn}` : ""}`}
            onClick={toggleFilter}
          >
            {isFiltered ? "On" : "Off"}
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      {availableTabs.length > 1 && (
        <div className={ed.subTabs}>
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${ed.detailSubTab}${activeTab === t.id ? ` ${ed.detailSubTabActive}` : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab body */}
      <div className={ed.body}>
        {activeTab === "info" && (
          <InfoTab kind={kind} id={id} editorNotes={editorNotes} onSelectEntity={onSelectEntity}
            hideExternalLink={currentPage === "wiki" && (kind === "work" || kind === "source")} searchQuery={resolvedSearchQuery} />
        )}
        {activeTab === "timeline" && kind === "place" && (
          <PlaceTimelineTab placeStates={placeStates} placeId={id} activeDecade={activeDecade} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />
        )}
        {activeTab === "timeline" && kind !== "place" && (
          <EntityTimelineTab claims={datedClaims} entityKind={kind} entityId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />
        )}
        {activeTab === "people"       && <RelationTab entities={connectedByType["person"]      ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "groups"       && <RelationTab entities={connectedByType["group"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "works"        && <RelationTab entities={connectedByType["work"]        ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "events"       && <RelationTab entities={connectedByType["event"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "propositions" && <RelationTab entities={connectedByType["proposition"] ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "topics"       && <RelationTab entities={connectedByType["topic"]       ?? []} focusKind={kind} focusId={id} onSelectEntity={onSelectEntity} onHoverEntity={onHoverEntity} onLeaveEntity={onLeaveEntity} />}
        {activeTab === "places"       && <PlacesTab footprints={footprints} onSelectEntity={onSelectEntity} />}
        {activeTab === "notes"        && <NotesTab notes={editorNotes} onSelectEntity={onSelectEntity} searchQuery={resolvedSearchQuery} />}
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
    <div className={`${ed.tags} ${ed.tagsSpaced}`}>
      <span className={ed.tag}>AD {activeDecade}</span>
      <span className={ed.tag} style={{ background: `${presenceColor}18`, borderColor: `${presenceColor}55`, color: presenceColor }}>
        {PRESENCE_LABELS[currentState.presence_status] ?? currentState.presence_status}
      </span>
      {currentState.dominant_polity_group_id && (
        <EntityHoverWrap kind="group" id={currentState.dominant_polity_group_id}>
          <button type="button" className={`${ed.tag} ${ed.tagClickable}`}
            onClick={() => onSelectEntity("group", currentState.dominant_polity_group_id)}
            title="Dominant polity"
          >
            ⚔ {dataStore.groups.getById(currentState.dominant_polity_group_id)?.group_label ?? currentState.dominant_polity_group_id}
          </button>
        </EntityHoverWrap>
      )}
      {currentState.group_presence_summary
        .filter((gid) => gid !== currentState.dominant_polity_group_id)
        .map((gid) => {
          const group = dataStore.groups.getById(gid);
          if (!group) return null;
          return (
            <EntityHoverWrap kind="group" id={gid}>
              <button key={gid} type="button" className={`${ed.tag} ${ed.tagClickable}`} onClick={() => onSelectEntity("group", gid)}>
                {group.group_label}
              </button>
            </EntityHoverWrap>
          );
        })}
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ kind, id, editorNotes, onSelectEntity, hideExternalLink, searchQuery = "" }: {
  kind: string; id: string;
  editorNotes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
  hideExternalLink?: boolean;
  searchQuery?: string;
}) {
  const data = getEntityHeaderData(kind, id);
  return (
    <div className={ed.flexCol12}>
      {data.rows.length > 0 && (
        <div className={ed.factGrid}>
          {data.rows.map(({ label, value, linkKind, linkId }) => (
            <React.Fragment key={label}>
              <span className={ed.factLabel}>{label}</span>
              <span className={ed.factValue}>
                {linkKind && linkId ? (
                  <EntityHoverWrap kind={linkKind} id={linkId}>
                    <button type="button" className={ed.mentionLink} onClick={() => onSelectEntity(linkKind, linkId)}>
                      {value}
                    </button>
                  </EntityHoverWrap>
                ) : value}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {data.notes && (
        <p className={ed.desc}>
          <MarkdownRenderer onSelectEntity={onSelectEntity}>{data.notes}</MarkdownRenderer>
        </p>
      )}
      {data.url && !hideExternalLink && (
        <ExternalLink href={data.url}>Read online</ExternalLink>
      )}
      {editorNotes.length > 0 && (
        <div className={ed.flexCol8}>
          <div className={ed.sectionTitle}>Editor Notes</div>
          {editorNotes.map((n) => (
            <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Place timeline tab (decade-by-decade) ────────────────────────────────────

function PlaceTimelineTab({ placeStates, placeId, activeDecade, onSelectEntity, onHoverEntity, onLeaveEntity }: {
  placeStates: PlaceStateByDecade[];
  placeId: string;
  activeDecade: number;
  onSelectEntity: (kind: string, id: string) => void;
  onHoverEntity?: (kind: string, id: string) => void;
  onLeaveEntity?: () => void;
}) {
  const footprintsByDecade = useMemo(
    () => dataStore.footprints.getByDecadeForPlace(placeId, placeStates),
    [placeId, placeStates],
  );

  const rows: TimelineRow[] = useMemo(() => placeStates.map((ps) => {
    const dotColor = PRESENCE_COLORS[ps.presence_status] ?? "#8e8070";
    const statusLabel = PRESENCE_LABELS[ps.presence_status] ?? ps.presence_status;
    const decadeFootprints = footprintsByDecade.get(ps.decade) ?? [];

    // Collect all row items: groups first, then footprints (excluding already-shown groups)
    const allGroups = [
      ...(ps.dominant_polity_group_id ? [ps.dominant_polity_group_id] : []),
      ...ps.group_presence_summary.filter((gid) => gid !== ps.dominant_polity_group_id),
    ];
    const groupIds = new Set(allGroups);
    const otherFootprints = decadeFootprints.filter((fp) => !(fp.entity_type === "group" && groupIds.has(fp.entity_id)));
    const totalItems = allGroups.length + otherFootprints.length;

    return {
      decade: ps.decade,
      dotColor,
      content: (
        <>
          <div className={ed.tlDecadeHdr}>
            AD {ps.decade}s
            <span className={ed.tlDecadeCount} style={{ color: dotColor }}>{statusLabel}</span>
            {totalItems > 1 && <span className={ed.tlDecadeCount}>{totalItems}</span>}
          </div>
          <div className={ed.tlClaims}>
            {allGroups.map((gid) => {
              const g = dataStore.groups.getById(gid);
              if (!g) return null;
              const isDominant = gid === ps.dominant_polity_group_id;
              const label = truncateLabel(g.group_label);
              return (
                <div key={gid} className={ed.tlClaimRow}
                  onMouseEnter={() => onHoverEntity?.("group", gid)}
                  onMouseLeave={() => onLeaveEntity?.()}
                >
                  <span className={ed.tlYearBadge}>AD {ps.decade}</span>
                  <span className={ed.tlPred}>{isDominant ? "polity" : "group present"}</span>
                  <EntityHoverWrap kind="group" id={gid}>
                    <button type="button" className={ed.mentionLink} onClick={() => onSelectEntity("group", gid)}>
                      {kindIcon("group")} {label}
                    </button>
                  </EntityHoverWrap>
                </div>
              );
            })}
            {otherFootprints.map((fp, i) => {
              const entLabel = truncateLabel(getEntityLabel(fp.entity_type, fp.entity_id));
              const predLabel = getPredicateLabel(fp.reason_predicate_id, false);
              const yrBadge = formatYearRange(fp.year_start, fp.year_end) || `AD ${ps.decade}`;
              return (
                <div key={`${fp.entity_type}:${fp.entity_id}:${fp.reason_predicate_id}:${i}`} className={ed.tlClaimRow}
                  onMouseEnter={() => onHoverEntity?.(fp.entity_type, fp.entity_id)}
                  onMouseLeave={() => onLeaveEntity?.()}
                >
                  <span className={ed.tlYearBadge}>{yrBadge}</span>
                  <span className={ed.tlPred}>{predLabel}</span>
                  <EntityHoverWrap kind={fp.entity_type} id={fp.entity_id}>
                    <button type="button" className={ed.mentionLink} onClick={() => onSelectEntity(fp.entity_type, fp.entity_id)}>
                      {kindIcon(fp.entity_type)} {entLabel}
                    </button>
                  </EntityHoverWrap>
                  <CertaintyBadge value={fp.stance ?? ""} />
                </div>
              );
            })}
          </div>
        </>
      ),
    };
  }), [placeStates, footprintsByDecade, onSelectEntity, onHoverEntity, onLeaveEntity]);

  return <Timeline rows={rows} activeDecade={activeDecade} emptyMessage="No timeline data." />;
}

// ─── Entity timeline tab (decade-grouped dated claims) ────────────────────────

function EntityTimelineTab({ claims, entityKind, entityId, onSelectEntity, onHoverEntity, onLeaveEntity }: {
  claims: Claim[];
  entityKind: string;
  entityId: string;
  onSelectEntity: (kind: string, id: string) => void;
  onHoverEntity?: (kind: string, id: string) => void;
  onLeaveEntity?: () => void;
}) {
  const activeDecade = useAppStore((s) => s.activeDecade);

  const byDecade = useMemo(() => {
    const map = new Map<number, Claim[]>();
    for (const c of claims) {
      if (c.year_start == null) continue;
      const decade = Math.floor(c.year_start / 10) * 10;
      const arr = map.get(decade) ?? [];
      arr.push(c);
      map.set(decade, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [claims]);

  const rows: TimelineRow[] = useMemo(() => byDecade.map(([decade, dClaims]) => {
    const decadeLabel = formatDecadeLabel(decade);
    return {
      decade,
      dotColor: "var(--accent)",
      content: (
        <>
          <div className={ed.tlDecadeHdr}>
            {decadeLabel}
            {dClaims.length > 1 && <span className={ed.tlDecadeCount}>{dClaims.length}</span>}
          </div>
          <div className={ed.tlClaims}>
            {dClaims.map((c) => {
              const isSubject = c.subject_type === entityKind && c.subject_id === entityId;
              const othKind   = isSubject ? c.object_type  : c.subject_type;
              const othId     = isSubject ? c.object_id    : c.subject_id;
              const predLabel = getPredicateLabel(c.predicate_id, isSubject);
              const othLabelRaw = othId ? getEntityLabel(othKind, othId) : (c.value_text || c.value_year?.toString() || "—");
              const othLabel = othId ? truncateLabel(othLabelRaw) : othLabelRaw;
              const yearBadge = formatYearRange(c.year_start, c.year_end) || "—";
              return (
                <div key={c.claim_id} className={ed.tlClaimRow}
                  onMouseEnter={() => othId && onHoverEntity?.(othKind, othId)}
                  onMouseLeave={() => onLeaveEntity?.()}
                >
                  <span className={ed.tlYearBadge}>{yearBadge}</span>
                  <span className={ed.tlPred}>{predLabel}</span>
                  {othId ? (
                    <EntityHoverWrap kind={othKind} id={othId}>
                      <button type="button" className={ed.mentionLink} onClick={() => onSelectEntity(othKind, othId)}>
                        {kindIcon(othKind)} {othLabel}
                      </button>
                    </EntityHoverWrap>
                  ) : <span className={ed.faint}>{othLabel}</span>}
                  <CertaintyBadge value={c.certainty ?? ""} />
                </div>
              );
            })}
          </div>
        </>
      ),
    };
  }), [byDecade, entityKind, entityId, onSelectEntity, onHoverEntity, onLeaveEntity]);

  return <Timeline rows={rows} activeDecade={activeDecade} emptyMessage="No dated claims." />;
}

// ─── Relation tab (people / groups / works / events / propositions / topics) ──

function RelationTab({ entities, focusKind, focusId, onSelectEntity, onHoverEntity, onLeaveEntity }: {
  entities: ConnectedEntity[];
  focusKind: string;
  focusId: string;
  onSelectEntity: (kind: string, id: string) => void;
  onHoverEntity?: (kind: string, id: string) => void;
  onLeaveEntity?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(entities, PAGE_SIZE);

  if (entities.length === 0) return <div className={ed.emptyState}>None.</div>;

  return (
    <div className={ed.flexCol}>
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
        const topCertainty = eClaims.find((c) => c.certainty && c.certainty !== "attested")?.certainty ?? "";

        return (
          <div key={id} className={ed.connCard}
            onMouseEnter={() => onHoverEntity?.(kind, id)}
            onMouseLeave={() => onLeaveEntity?.()}
          >
            <div className={ed.connRow} onClick={() => onSelectEntity(kind, id)}>
              <span className={ed.connIcon}>{kindIcon(kind)}</span>
              <div className={ed.connBody}>
                <div className={ed.connName}>{label}</div>
                <div className={ed.connRel}>{predicates.join(" · ")}</div>
              </div>
              <div className={ed.connBadges}>
                <CertaintyBadge value={topCertainty} />
                {evidence.length > 0 && (
                  <button type="button" className={ed.connExpandBtn}
                    onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : id); }}
                    title={isOpen ? "Hide evidence" : "Show evidence"}
                  >
                    {isOpen ? "▲" : "▼"}
                  </button>
                )}
              </div>
            </div>

            {isOpen && evidence.length > 0 && (
              <div className={ed.connEvidence}>
                {evidence.map((ev) => (
                  <EvidenceCard key={`${ev.claim_id}-${ev.passage_id}`} ev={ev} onSelectEntity={onSelectEntity} hideWorkLink={focusKind === "work"} />
                ))}
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
  if (footprints.length === 0) return <div className={ed.emptyState}>No locations found.</div>;
  return (
    <div className={ed.flexCol}>
      {pageItems.map((f, i) => (
        <FootprintCard key={`${f.place_id}:${i}`} footprint={f} showEntity={false} showPlace onSelectEntity={onSelectEntity} />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ notes, onSelectEntity, searchQuery = "" }: {
  notes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
  searchQuery?: string;
}) {
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(notes, PAGE_SIZE);
  if (notes.length === 0) return <div className={ed.emptyState}>No editor notes.</div>;
  return (
    <div className={ed.flexCol8}>
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
  if (notes.length === 0) return <div className={ed.emptyState}>No notes mention this entity.</div>;
  return (
    <div className={ed.flexCol8}>
      {pageItems.map((n) => (
        <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} yearLabel={n.note_kind} />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
