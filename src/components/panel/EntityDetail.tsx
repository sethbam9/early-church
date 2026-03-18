import React, { useState, useMemo, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, X, BookOpen, Scale, Map as MapIcon, Sword, Info, Clock, FileText, AtSign, Copy, Check, Quote } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { EntityHeader, getEntityHeaderData } from "../shared/EntityHeader";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { NoteCard } from "../shared/NoteCard";
import { KindIcon, kindLabel, PRESENCE_COLORS, PRESENCE_LABELS, KIND_COLORS } from "../shared/entityConstants";
import { CertaintyBadge } from "../shared/CertaintyBadge";
import { FootprintCard } from "../shared/FootprintCard";
import { Timeline } from "../shared/Timeline";
import type { TimelineRow } from "../shared/Timeline";
import { EvidenceCard } from "../shared/EvidenceCard";
import { EntityHoverWrap } from "../shared/EntityHoverCard";
import { ExternalLink } from "../shared/ExternalLink";
import { InfoIcon } from "../shared/InfoIcon";
import { DerivationIcon } from "../shared/DerivationIcon";
import { getSourceExternalUrl } from "../../utils/sourceLinks";
import { getPredicateLabel } from "../../domain/relationLabels";
import type { Claim, Passage, EntityPlaceFootprint, PlaceStateByDecade, FirstAttestation } from "../../data/types";
import { truncateLabel, formatYearRange, formatDecadeLabel } from "../../utils/formatYear";
import ed from "./EntityDetail.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityDetailTab =
  | "info" | "timeline" | "passages" | "people" | "places" | "groups"
  | "works" | "events" | "propositions" | "topics" | "notes" | "mentions";

interface ConnectedEntity {
  kind: string;
  id: string;
  claims: Claim[];
}

// ─── Tab label map ────────────────────────────────────────────────────────────

const TAB_ICONS: Partial<Record<EntityDetailTab, React.ReactNode>> = {
  info:         <Info size={12} />,
  timeline:     <Clock size={12} />,
  passages:     <Quote size={12} />,
  people:       <KindIcon kind="person" size={12} />,
  places:       <KindIcon kind="place" size={12} />,
  groups:       <KindIcon kind="group" size={12} />,
  works:        <KindIcon kind="work" size={12} />,
  events:       <KindIcon kind="event" size={12} />,
  propositions: <KindIcon kind="proposition" size={12} />,
  topics:       <KindIcon kind="topic" size={12} />,
  notes:        <FileText size={12} />,
  mentions:     <AtSign size={12} />,
};

const TAB_LABELS: Record<EntityDetailTab, string> = {
  info:         "Info",
  timeline:     "Timeline",
  passages:     "Passages",
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
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

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
  const datedClaims  = useMemo(() => (kind !== "place" && kind !== "work") ? dataStore.claims.getDatedSorted(kind, id) : [], [kind, id]);

  // Passages for works, propositions, people
  const entityPassages = useMemo((): Passage[] => {
    if (kind === "work") return dataStore.passages.getByWork(id);
    // For people/propositions: find passages via claim_evidence chains
    const relatedClaims = [...(dataStore.claims.getGroupedByObjectType(kind, id).values())].flat();
    const passageIds = new Set<string>();
    for (const c of relatedClaims) {
      for (const ev of dataStore.claimEvidence.getForClaim(c.claim_id)) {
        passageIds.add(ev.passage_id);
      }
    }
    return Array.from(passageIds).map((pid) => dataStore.passages.getById(pid)).filter((p): p is Passage => !!p);
  }, [kind, id]);

  // First attestations for header enrichment
  const firstAttests = useMemo(() => dataStore.firstAttestations.getForSubject(kind, id), [kind, id]);

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
  const availableTabs = useMemo((): { id: EntityDetailTab; label: string; count: number }[] => {
    const tabs: { id: EntityDetailTab; label: string; count: number }[] = [
      { id: "info", label: TAB_LABELS.info, count: 0 },
    ];

    // Works get no timeline (they have composition dates); other entities get timeline
    if (kind !== "work") {
      const timelineCount = kind === "place" ? placeStates.length : datedClaims.length;
      if (timelineCount > 0)
        tabs.push({ id: "timeline", label: TAB_LABELS.timeline, count: timelineCount });
    }

    // Passages tab for works only
    if (kind === "work" && entityPassages.length > 0)
      tabs.push({ id: "passages", label: TAB_LABELS.passages, count: entityPassages.length });

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
      if (n > 0) tabs.push({ id: tab, label: TAB_LABELS[tab], count: n });
    }

    if (footprints.length > 0)
      tabs.push({ id: "places", label: TAB_LABELS.places, count: footprints.length });

    if (editorNotes.length > 0)
      tabs.push({ id: "notes", label: TAB_LABELS.notes, count: editorNotes.length });
    if (mentions.length > 0)
      tabs.push({ id: "mentions", label: TAB_LABELS.mentions, count: mentions.length });

    return tabs;
  }, [kind, id, placeStates.length, datedClaims.length, entityPassages.length, connectedByType, footprints.length, editorNotes.length, mentions.length]);

  // Reset tab when entity changes
  useEffect(() => { setActiveTab("info"); }, [kind, id]);

  // ── Place-specific header data ───────────────────────────────────────────
  const activeDecade = useAppStore((s) => s.activeDecade);
  const currentState = useMemo(
    () => kind === "place" ? dataStore.map.getCurrentPlaceState(id, activeDecade) : undefined,
    [kind, id, activeDecade],
  );

  const accentColor = KIND_COLORS[kind];

  return (
    <div className={ed.panel} style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}>
      {/* Back bar */}
      {!hideBackBar && (
        <div className={ed.backBar}>
          {hasHistory && (
            <button type="button" className={ed.backBtn} onClick={onBack}><ChevronLeft size={12} /> Back</button>
          )}
          <span className={ed.crumb}>{getEntityLabel(kind, id)}</span>
          <button type="button" className={ed.copyIdBtn} onClick={handleCopyId} title={`Copy entity ID: ${id}`}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
          {onExit && <button type="button" className={`${ed.backBtn} ${ed.exitBtn}`} onClick={onExit} title="Exit to list"><X size={13} /></button>}
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
      {canFilter && setMapFilter && (() => {
        let labelContent: React.ReactNode = null;
        
        if (kind === "proposition" && currentDecade !== undefined) {
          // Propositions: show stance breakdown
          const ppp = dataStore.propositionPlacePresence.getForProposition(id);
          const decadeEnd = currentDecade + 9;
          const filtered = ppp.filter((pp) => {
            const s = pp.year_start ?? -9999;
            const e = pp.year_end ?? 9999;
            return s <= decadeEnd && e >= currentDecade;
          });
          let affirm = 0, oppose = 0, mixed = 0;
          for (const entry of filtered) {
            if (entry.stance === "affirms") affirm++;
            else if (entry.stance === "opposes") oppose++;
            else mixed++;
          }
          labelContent = (
            <>
              <MapIcon size={13} /> {filtered.length} {filtered.length === 1 ? "place" : "places"}
              <span className={ed.faint}> · {affirm} affirm · {oppose} oppose · {mixed} mixed</span>
            </>
          );
        } else if (kind === "group" && currentDecade !== undefined) {
          // Groups: count from cumulative places
          const count = dataStore.map.getCumulativePlacesAtDecade(currentDecade)
            .filter((p) => p.group_presence_summary.includes(id)).length;
          labelContent = (
            <>
              <MapIcon size={13} /> {count} {count === 1 ? "place" : "places"} on map
            </>
          );
        } else {
          // Person, work, event: count from footprints
          const fps = dataStore.footprints.getForEntity(kind, id);
          const placeIds = new Set(fps.map((f) => f.place_id));
          labelContent = (
            <>
              <MapIcon size={13} /> {placeIds.size} {placeIds.size === 1 ? "place" : "places"} on map
            </>
          );
        }

        return (
          <div className={ed.filterBanner}>
            <span className={ed.filterBannerLabel} title="Filter map to this entity">
              {labelContent}
            </span>
            <button
              type="button"
              className={`${ed.filterToggleBtn}${isFiltered ? ` ${ed.filterToggleBtnOn}` : ""}`}
              onClick={toggleFilter}
              title={isFiltered ? "Stop filtering map" : "Filter map to this entity"}
            >
              {isFiltered ? "On" : "Off"}
            </button>
          </div>
        );
      })()}

      {/* Sub-tabs */}
      {availableTabs.length > 1 && (
        <div className={ed.subTabs}>
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${ed.detailSubTab}${activeTab === t.id ? ` ${ed.detailSubTabActive}` : ""}`}
              onClick={() => setActiveTab(t.id)}
              title={TAB_LABELS[t.id as EntityDetailTab]}
            >
              {TAB_ICONS[t.id as EntityDetailTab]}
              {t.count > 0 && <span className={ed.detailSubTabCount}>{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Tab body */}
      <div className={ed.body}>
        {activeTab === "info" && (
          <InfoTab kind={kind} id={id} editorNotes={editorNotes} firstAttests={firstAttests} onSelectEntity={onSelectEntity}
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
        {activeTab === "passages"     && <PassagesTab passages={entityPassages} onSelectEntity={onSelectEntity} />}
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
            <Sword size={11} /> {dataStore.groups.getById(currentState.dominant_polity_group_id)?.group_label ?? currentState.dominant_polity_group_id}
          </button>
        </EntityHoverWrap>
      )}
      {currentState.group_presence_summary
        .filter((gid) => gid !== currentState.dominant_polity_group_id)
        .map((gid) => {
          const group = dataStore.groups.getById(gid);
          if (!group) return null;
          return (
            <EntityHoverWrap key={gid} kind="group" id={gid}>
              <button type="button" className={`${ed.tag} ${ed.tagClickable}`} onClick={() => onSelectEntity("group", gid)}>
                {group.group_label}
              </button>
            </EntityHoverWrap>
          );
        })}
    </div>
  );
}

// ─── Collapsed editor notes section ──────────────────────────────────────────

function EditorNotesSectionCollapsed({ notes, onSelectEntity, searchQuery = "" }: {
  notes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
  searchQuery?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={ed.flexCol8}>
      <button type="button" className={ed.notesToggle} onClick={() => setOpen((v) => !v)}>
        <span className={ed.sectionTitle}>Editor Notes ({notes.length})</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && notes.map((n) => (
        <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} searchQuery={searchQuery} />
      ))}
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ kind, id, editorNotes, firstAttests = [], onSelectEntity, hideExternalLink, searchQuery = "" }: {
  kind: string; id: string;
  editorNotes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  firstAttests?: FirstAttestation[];
  onSelectEntity: (kind: string, id: string) => void;
  hideExternalLink?: boolean;
  searchQuery?: string;
}) {
  const data = getEntityHeaderData(kind, id);

  // Pick the earliest first attestation to display
  const earliest = useMemo(() => {
    // Try derived first_attestations first
    if (firstAttests.length > 0) {
      return firstAttests.reduce((best, fa) => {
        if (fa.first_year == null) return best;
        if (!best || best.first_year == null || fa.first_year < best.first_year) return fa;
        return best;
      }, null as FirstAttestation | null);
    }
    // For propositions (and others), find earliest dated claim where this entity is the object
    const objectClaims = dataStore.claims.getAll().filter(
      (c) => c.object_type === kind && c.object_id === id && c.year_start != null
    );
    if (objectClaims.length === 0) return null;
    const sorted = objectClaims.sort((a, b) => (a.year_start ?? 9999) - (b.year_start ?? 9999));
    const c = sorted[0]!;
    const ev = dataStore.claimEvidence.getForClaim(c.claim_id);
    return {
      subject_type: c.subject_type,
      subject_id: c.subject_id,
      predicate_id: c.predicate_id,
      first_year: c.year_start,
      first_claim_id: c.claim_id,
      first_passage_id: ev[0]?.passage_id ?? "",
    } as FirstAttestation;
  }, [firstAttests, kind, id]);
  const earliestPassage = earliest?.first_passage_id ? dataStore.passages.getById(earliest.first_passage_id) : null;
  const earliestSource = earliestPassage ? dataStore.sources.getById(earliestPassage.source_id) : null;

  return (
    <div className={ed.flexCol12}>
      {earliest && earliest.first_year != null && (
        <div className={ed.firstAttestRow}>
          <span className={ed.firstAttestLabel}>First mentioned</span>
          <span className={ed.firstAttestValue}>
            AD {earliest.first_year}
            {earliestSource && <span className={ed.faint}> in {earliestSource.title}</span>}
          </span>
          <InfoIcon claimId={earliest.first_claim_id} title="View first attestation claim" />
        </div>
      )}
      {kind === "proposition" && <DoctrineStats propositionId={id} onSelectEntity={onSelectEntity} />}
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
        <div className={ed.desc}>
          <MarkdownRenderer onSelectEntity={onSelectEntity}>{data.notes}</MarkdownRenderer>
        </div>
      )}
      {data.url && !hideExternalLink && (
        <ExternalLink href={data.url}>Read online</ExternalLink>
      )}
      {editorNotes.length > 0 && (
        <EditorNotesSectionCollapsed notes={editorNotes} onSelectEntity={onSelectEntity} searchQuery={searchQuery} />
      )}
    </div>
  );
}

// ─── Doctrine stats (proposition Info tab) ──────────────────────────────────

const STANCE_COLORS: Record<string, string> = {
  affirms: "#27ae60", opposes: "#c0392b", develops: "#2980b9", mentions: "#8e44ad",
};
const STANCE_LABELS: Record<string, string> = {
  affirms: "Affirmed by", opposes: "Opposed by", develops: "Developed by", mentions: "Mentioned by",
};

interface StanceEntry { subjectKind: string; subjectId: string; label: string; yearStart?: number | null; yearEnd?: number | null; certainty: string; claimId: string; }

function DoctrineStats({ propositionId, onSelectEntity }: { propositionId: string; onSelectEntity: (kind: string, id: string) => void }) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const stanceData = useMemo(() => {
    const claims = dataStore.claims.getAll().filter(
      (c) => c.object_type === "proposition" && c.object_id === propositionId && c.claim_status === "active"
    );
    const buckets: Record<string, StanceEntry[]> = { affirms: [], opposes: [], develops: [], mentions: [] };
    for (const c of claims) {
      let bucket: string | null = null;
      if (c.predicate_id.includes("affirms")) bucket = "affirms";
      else if (c.predicate_id.includes("opposes")) bucket = "opposes";
      else if (c.predicate_id.includes("develops")) bucket = "develops";
      else if (c.predicate_id.includes("mentions")) bucket = "mentions";
      if (!bucket) continue;
      const label = getEntityLabel(c.subject_type, c.subject_id);
      buckets[bucket]!.push({
        subjectKind: c.subject_type, subjectId: c.subject_id, label,
        yearStart: c.year_start, yearEnd: c.year_end, certainty: c.certainty ?? "",
        claimId: c.claim_id,
      });
    }
    // Sort each bucket by year
    for (const arr of Object.values(buckets)) {
      arr.sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999));
    }
    return buckets;
  }, [propositionId]);

  const placePresence = useMemo(
    () => dataStore.propositionPlacePresence.getForProposition(propositionId),
    [propositionId],
  );
  const placeStanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pp of placePresence) {
      const s = pp.stance || "unknown";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [placePresence]);

  const aff = stanceData.affirms ?? [];
  const opp = stanceData.opposes ?? [];
  const dev = stanceData.develops ?? [];
  const mnt = stanceData.mentions ?? [];
  const total = aff.length + opp.length + dev.length + mnt.length;
  if (total === 0 && placePresence.length === 0) return null;

  const segments = [
    { key: "affirms", count: aff.length },
    { key: "opposes", count: opp.length },
    { key: "develops", count: dev.length },
    { key: "mentions", count: mnt.length },
  ].filter((s) => s.count > 0);

  return (
    <div className={ed.doctrineStats}>
      {total > 0 && (
        <>
          <div className={ed.stanceBar}>
            {segments.map((seg) => (
              <div key={seg.key} className={ed.stanceBarSeg}
                style={{ flex: seg.count, background: STANCE_COLORS[seg.key] }} />
            ))}
          </div>
          <div className={ed.stanceRow}>
            {segments.map((seg) => (
              <span key={seg.key} className={ed.stanceStat}>
                <span className={ed.stanceDot} style={{ background: STANCE_COLORS[seg.key] }} />
                <span className={ed.stanceCount}>{seg.count}</span> {seg.key}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Interactive stance sections */}
      {(["affirms", "opposes", "develops", "mentions"] as const).map((stance) => {
        const entries = stanceData[stance];
        if (!entries || entries.length === 0) return null;
        const isOpen = openSection === stance;
        return (
          <div key={stance} className={ed.stanceSection}>
            <button type="button" className={ed.stanceSectionToggle} onClick={() => setOpenSection(isOpen ? null : stance)}>
              <span className={ed.stanceDot} style={{ background: STANCE_COLORS[stance] }} />
              <span className={ed.stanceSectionLabel}>{STANCE_LABELS[stance]}</span>
              <span className={ed.stanceSectionCount}>({entries.length})</span>
              {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {isOpen && (
              <div className={ed.stanceEntityList} style={{ borderColor: STANCE_COLORS[stance] }}>
                {entries.map((e) => (
                  <button key={e.claimId} type="button" className={ed.stanceEntity}
                    onClick={() => onSelectEntity(e.subjectKind, e.subjectId)}>
                    <KindIcon kind={e.subjectKind} size={11} />
                    <span>{truncateLabel(e.label, 35)}</span>
                    {e.yearStart != null && <span className={ed.stanceEntityYear}>AD {e.yearStart}{e.yearEnd && e.yearEnd !== e.yearStart ? `–${e.yearEnd}` : ""}</span>}
                    {e.certainty && <CertaintyBadge value={e.certainty} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Place presence summary */}
      {placePresence.length > 0 && (
        <div className={ed.stancePlaceCount}>
          <MapIcon size={11} />
          <span>{placePresence.length} place{placePresence.length !== 1 ? "s" : ""}</span>
          {Object.entries(placeStanceCounts).map(([stance, count]) => (
            <span key={stance} className={ed.stanceStat}>
              <span className={ed.stanceDot} style={{ background: STANCE_COLORS[stance] ?? "#8e8070" }} />
              {count}
            </span>
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
                      <KindIcon kind="group" size={13} /> {label}
                    </button>
                  </EntityHoverWrap>
                </div>
              );
            })}
            {otherFootprints.map((fp, i) => {
              const entLabel = truncateLabel(getEntityLabel(fp.entity_type, fp.entity_id));
              const predLabel = getPredicateLabel(fp.reason_predicate_id, false);
              const yrBadge = formatYearRange(fp.year_start, fp.year_end) || `AD ${ps.decade}`;
              const backingClaims = dataStore.claims.getBackingForFootprint(fp);
              const firstClaimId = backingClaims[0]?.claim_id;
              const fpEdge = fp.derived_edge_id ? dataStore.derivedEdges.getById(fp.derived_edge_id) : undefined;
              const fpIsDerived = fpEdge?.directness === "derived";
              return (
                <div key={`${fp.entity_type}:${fp.entity_id}:${fp.reason_predicate_id}:${i}`} className={ed.tlClaimRow}
                  onMouseEnter={() => onHoverEntity?.(fp.entity_type, fp.entity_id)}
                  onMouseLeave={() => onLeaveEntity?.()}
                >
                  <span className={ed.tlYearBadge}>{yrBadge}</span>
                  <span className={ed.tlPred}>{predLabel}</span>
                  <EntityHoverWrap kind={fp.entity_type} id={fp.entity_id}>
                    <button type="button" className={ed.mentionLink} onClick={() => onSelectEntity(fp.entity_type, fp.entity_id)}>
                      <KindIcon kind={fp.entity_type} size={13} /> {entLabel}
                    </button>
                  </EntityHoverWrap>
                  {fpIsDerived && fp.derived_edge_id ? (
                    <DerivationIcon edgeId={fp.derived_edge_id} />
                  ) : firstClaimId ? (
                    <InfoIcon claimId={firstClaimId} />
                  ) : null}
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
                        <KindIcon kind={othKind} size={13} /> {othLabel}
                      </button>
                    </EntityHoverWrap>
                  ) : <span className={ed.faint}>{othLabel}</span>}
                  <InfoIcon claimId={c.claim_id} />
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
              <span className={ed.connIcon}><KindIcon kind={kind} size={14} /></span>
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
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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

// ─── Passages tab ────────────────────────────────────────────────────────────

function PassagesTab({ passages, onSelectEntity }: {
  passages: Passage[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(passages, PAGE_SIZE);
  if (passages.length === 0) return <div className={ed.emptyState}>No passages found.</div>;

  return (
    <div className={ed.flexCol}>
      {pageItems.map((p) => {
        const source = dataStore.sources.getById(p.source_id);
        const evidence = dataStore.claimEvidence.getAll().filter((ev) => ev.passage_id === p.passage_id);
        const isOpen = expandedId === p.passage_id;

        return (
          <div key={p.passage_id} className={`${ed.connCard} ${ed.passageCard}`}>
            <div
              className={`${ed.connRow} ${ed.passageHeader}${isOpen ? ` ${ed.passageHeaderOpen}` : ""}`}
              onClick={() => setExpandedId(isOpen ? null : p.passage_id)}
            >
              <div className={ed.passageMain}>
                <span className={ed.connIcon}><BookOpen size={14} /></span>
                <div className={ed.connBody}>
                  <div className={ed.passageTitle}>
                    {p.locator}
                  </div>
                  <div className={ed.passageMeta}>
                    <span className={ed.passageMetaSource}>
                      {source?.title ?? p.source_id}
                    </span>
                    {p.passage_year && <span>· AD {p.passage_year}</span>}
                    {evidence.length > 0 && <span className={ed.passageClaimsCount}>{evidence.length} claim{evidence.length !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`${ed.connExpandBtn} ${ed.passageExpandBtn}`}
                onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : p.passage_id); }}
                title={isOpen ? "Hide detail" : "Show detail"}
              >
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {isOpen && (
              <div className={ed.passageContent}>
                {p.excerpt && <blockquote className={ed.passageQuote}>"{p.excerpt}"</blockquote>}

                <div className={ed.passageDetailsRow}>
                  {p.language && <span><strong>Language:</strong> {p.language}</span>}
                  {p.locator_type && <span><strong>Type:</strong> {p.locator_type}</span>}
                </div>

                <div className={ed.passageActions}>
                  {p.locator_type === "bible_osis" && p.locator && (
                    <ExternalLink href={`https://www.stepbible.org/?q=reference=${encodeURIComponent(p.locator)}`}>
                      Open Bible verse
                    </ExternalLink>
                  )}
                  {p.url_override && <ExternalLink href={p.url_override}>View passage</ExternalLink>}
                  {source && (
                    <EntityHoverWrap kind="source" id={source.source_id}>
                      <button
                        type="button"
                        className={`${ed.mentionLink} ${ed.passageWorkBtn}`}
                        onClick={() => onSelectEntity("source", source.source_id)}
                      >
                        Open work: {source.title}
                      </button>
                    </EntityHoverWrap>
                  )}
                </div>

                {evidence.length > 0 && (
                  <>
                    <div className={`${ed.sectionTitle} ${ed.linkedClaimsHeader}`}>Linked claims ({evidence.length})</div>
                    <div className={ed.linkedClaimsList}>
                      {evidence.map((ev) => {
                        const claim = dataStore.claims.getById(ev.claim_id);
                        if (!claim) return null;
                        const predLabel = getPredicateLabel(claim.predicate_id, true);
                        const subLabel = getEntityLabel(claim.subject_type, claim.subject_id);
                        const isObjEntity = claim.object_mode === "entity" && !!claim.object_id;
                        const objLabel = isObjEntity
                          ? getEntityLabel(claim.object_type, claim.object_id)
                          : (claim.value_text || claim.value_year?.toString() || "");
                        const evPassage = dataStore.passages.getById(ev.passage_id);
                        const evSource = evPassage ? dataStore.sources.getById(evPassage.source_id) : null;
                        const evSourceUrl = getSourceExternalUrl(evSource);
                        
                        return (
                          <div key={ev.claim_id} className={ed.linkedClaimCard} onClick={() => onSelectEntity("claim", claim.claim_id)}>
                            <div className={ed.linkedClaimMain}>
                              <div className={ed.connBody}>
                                <div className={ed.linkedClaimSentence}>
                                  <EntityHoverWrap kind={claim.subject_type} id={claim.subject_id}>
                                    <button
                                      type="button"
                                      className={`${ed.mentionLink} ${ed.linkedClaimEntity}`}
                                      onClick={(e) => { e.stopPropagation(); onSelectEntity(claim.subject_type, claim.subject_id); }}
                                    >
                                      {subLabel}
                                    </button>
                                  </EntityHoverWrap>
                                  <span className={ed.linkedClaimPredicate}> {predLabel} </span>
                                  {isObjEntity && claim.object_id ? (
                                    <EntityHoverWrap kind={claim.object_type} id={claim.object_id}>
                                      <button
                                        type="button"
                                        className={`${ed.mentionLink} ${ed.linkedClaimEntity}`}
                                        onClick={(e) => { e.stopPropagation(); onSelectEntity(claim.object_type, claim.object_id); }}
                                      >
                                        {objLabel}
                                      </button>
                                    </EntityHoverWrap>
                                  ) : (
                                    <span className={ed.linkedClaimObjectText}>{objLabel}</span>
                                  )}
                                </div>
                                <div className={ed.linkedClaimMeta}>
                                  <span className={ed.linkedClaimRole}>{ev.evidence_role}</span>
                                  {ev.evidence_weight != null && <span className={ed.weightIcon}><Scale size={11} /> {ev.evidence_weight}</span>}
                                  {ev.support_aspect && <span>{ev.support_aspect}</span>}
                                </div>
                              </div>
                              <div className={ed.linkedClaimActions}>
                                <CertaintyBadge value={claim.certainty ?? ""} />
                                <InfoIcon claimId={claim.claim_id} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {evidence.length === 0 && <div className={ed.noLinkedClaims}>No claims reference this passage.</div>}
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
