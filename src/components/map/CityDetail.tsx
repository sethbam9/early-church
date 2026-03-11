import { useState, useMemo, useEffect, useRef } from "react";
import { dataStore } from "../../data/dataStore";
import { useAppStore } from "../../stores/appStore";
import type { PlaceStateByDecade } from "../../data/dataStore";
import { Hl } from "../shared/Hl";
import { NoteCard } from "../shared/NoteCard";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { PRESENCE_LABELS, PRESENCE_COLORS } from "../shared/entityConstants";
import { ClaimCard } from "../shared/RelationCard";
import { FootprintCard } from "../shared/FootprintCard";
import { CrossPageNav } from "../shared/CrossPageNav";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceDetailProps {
  placeId: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}

// ─── PlaceDetail (exported as CityDetail for migration compat) ───────────────

export function CityDetail({ cityId, onBack, onSelectEntity }: { cityId: string; onBack: () => void; onSelectEntity: (kind: string, id: string) => void }) {
  return <PlaceDetail placeId={cityId} onBack={onBack} onSelectEntity={onSelectEntity} />;
}

export function PlaceDetail({ placeId, onBack, onSelectEntity }: PlaceDetailProps) {
  const [subTab, setSubTab] = useState<"info" | "timeline" | "claims">("info");
  const activeDecade = useAppStore((s) => s.activeDecade);

  const place       = dataStore.places.getById(placeId);
  const placeStates = dataStore.map.getPlaceStatesForPlace(placeId);
  const editorNotes = dataStore.editorNotes.getForEntity("place", placeId);
  const footprints  = dataStore.footprints.getForPlace(placeId);
  const claims      = dataStore.claims.getVisibleForEntity("place", placeId);

  const currentState = useMemo(() => dataStore.map.getCurrentPlaceState(placeId, activeDecade), [placeId, activeDecade]);

  if (!place) {
    return (
      <div className="detail-panel">
        <div className="detail-back-bar">
          <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        </div>
        <div className="empty-state">Place not found.</div>
      </div>
    );
  }

  const presenceColor = PRESENCE_COLORS[currentState?.presence_status ?? "unknown"] ?? "#8e8070";


  return (
    <div className="detail-panel">
      {/* Back bar */}
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Place</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="detail-kind-badge">🏛 {place.place_kind}</div>
          <CrossPageNav kind="place" id={placeId} current="map" />
        </div>
        <div className="detail-title">{place.place_label}</div>
        <div className="detail-subtitle">
          {place.place_label_modern && place.place_label_modern !== place.place_label
            ? `modern: ${place.place_label_modern} · `
            : ""}
          {place.modern_country_label}
        </div>

        {currentState && (
          <div className="detail-tags detail-tags--spaced">
            <span className="tag">AD {activeDecade}</span>
            <span
              className="tag"
              style={{
                background: `${presenceColor}18`,
                borderColor: `${presenceColor}55`,
                color: presenceColor,
              }}
            >
              {PRESENCE_LABELS[currentState.presence_status] ?? currentState.presence_status}
            </span>

            {/* Dominant polity tag (shown first, separated from other groups) */}
            {currentState.dominant_polity_group_id && (
              <button
                type="button"
                className="tag tag-clickable tag-persuasion"
                onClick={() => onSelectEntity("group", currentState.dominant_polity_group_id)}
                title="Dominant polity"
              >
                ⚔ {dataStore.groups.getById(currentState.dominant_polity_group_id)?.group_label ?? currentState.dominant_polity_group_id}
              </button>
            )}

            {/* Group presence tags (skip the dominant polity to avoid duplication) */}
            {currentState.group_presence_summary
              .filter((gid) => gid !== currentState.dominant_polity_group_id)
              .map((gid) => {
                const group = dataStore.groups.getById(gid);
                if (!group) return null;
                return (
                  <button
                    key={gid}
                    type="button"
                    className="tag tag-clickable"
                    onClick={() => onSelectEntity("group", gid)}
                    title={`View group: ${group.group_label}`}
                  >
                    {group.group_label}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="detail-sub-tabs">
        {[
          { id: "info" as const, label: "Info" },
          { id: "timeline" as const, label: `Timeline (${placeStates.length})` },
          ...(claims.length > 0 ? [{ id: "claims" as const, label: `Claims (${claims.length})` }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`detail-sub-tab${subTab === t.id ? " active" : ""}`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="detail-body">
        {subTab === "info" && <InfoTab place={place} currentState={currentState} editorNotes={editorNotes} onSelectEntity={onSelectEntity} />}
        {subTab === "timeline" && <TimelineTab placeStates={placeStates} placeId={placeId} activeDecade={activeDecade} onSelectEntity={onSelectEntity} />}
        {subTab === "claims" && <ClaimsTab claims={claims} placeId={placeId} onSelectEntity={onSelectEntity} />}
      </div>
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ place, currentState, editorNotes, onSelectEntity }: {
  place: NonNullable<ReturnType<typeof dataStore.places.getById>>;
  currentState: PlaceStateByDecade | undefined;
  editorNotes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const q = searchQuery.trim();

  return (
    <div className="flex-col-14">
      <div className="fact-grid">
        <span className="fact-label">Kind</span>
        <span className="fact-value">{place.place_kind}</span>
        <span className="fact-label">Location precision</span>
        <span className="fact-value">{place.location_precision?.replace(/_/g, " ")}</span>
        {place.lat != null && place.lon != null && (
          <>
            <span className="fact-label">Coordinates</span>
            <span className="fact-value">{place.lat.toFixed(4)}, {place.lon.toFixed(4)}</span>
          </>
        )}
        {place.parent_place_id && (
          <>
            <span className="fact-label">Parent place</span>
            <span className="fact-value">
              <button type="button" className="mention-link" onClick={() => onSelectEntity("place", place.parent_place_id)}>
                {dataStore.places.getById(place.parent_place_id)?.place_label ?? place.parent_place_id}
              </button>
            </span>
          </>
        )}
        {place.notes && (
          <>
            <span className="fact-label">Notes</span>
            <span className="fact-value"><Hl text={place.notes} query={q} /></span>
          </>
        )}
      </div>

      {editorNotes.length > 0 && (
        <div>
          <div className="detail-section-title">Editor Notes</div>
          {editorNotes.map((n) => (
            <NoteCard key={n.editor_note_id} note={n} onSelectEntity={onSelectEntity} searchQuery={q} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline tab (enriched with footprint activity per decade) ──────────────

function TimelineTab({ placeStates, placeId, activeDecade, onSelectEntity }: {
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
        const isActive = ps.decade === activeDecade;
        const isLast   = idx === placeStates.length - 1;
        const dotColor = PRESENCE_COLORS[ps.presence_status] ?? "#8e8070";
        const statusLabel = PRESENCE_LABELS[ps.presence_status] ?? ps.presence_status;
        const decadeFootprints = footprintsByDecade.get(ps.decade) ?? [];

        return (
          <div
            key={ps.decade}
            ref={isActive ? activeRowRef : null}
            className={`tl-v-row${isActive ? " tl-v-row--active" : ""}`}
          >
            <div className={`tl-v-gutter${isLast ? " tl-v-gutter--last" : ""}`}>
              <span
                className={`tl-v-dot${isActive ? " tl-v-dot--active" : ""}`}
                style={{
                  borderColor: dotColor,
                  background: isActive ? dotColor : "transparent",
                  boxShadow: isActive ? `0 0 0 4px ${dotColor}22` : undefined,
                }}
              />
            </div>

            <div className="tl-v-content">
              <div className="tl-v-status" style={{ color: dotColor }}>
                {statusLabel}
              </div>
              <div className="tl-v-meta">
                <span className="tl-v-year">{isActive ? `▶ AD ${ps.decade}` : `AD ${ps.decade}`}</span>

                {/* Dominant polity */}
                {ps.dominant_polity_group_id && (() => {
                  const polity = dataStore.groups.getById(ps.dominant_polity_group_id);
                  return polity ? (
                    <button
                      type="button"
                      className="timeline-polity-btn"
                      onClick={() => onSelectEntity("group", ps.dominant_polity_group_id)}
                    >
                      {polity.group_label}
                    </button>
                  ) : null;
                })()}

                {/* Group presence chips (skip dominant polity) */}
                {ps.group_presence_summary
                  .filter((gid) => gid !== ps.dominant_polity_group_id)
                  .map((gid) => {
                    const g = dataStore.groups.getById(gid);
                    return g ? (
                      <button
                        key={gid}
                        type="button"
                        className="timeline-persuasion-btn"
                        onClick={() => onSelectEntity("group", gid)}
                      >
                        {g.group_label}
                      </button>
                    ) : null;
                  })}
              </div>

              {/* Footprint cards for this decade (skip groups already shown as chips) */}
              {decadeFootprints.length > 0 && (() => {
                const groupIds = new Set([ps.dominant_polity_group_id, ...ps.group_presence_summary].filter(Boolean));
                const filtered = decadeFootprints.filter((fp) => !(fp.entity_type === "group" && groupIds.has(fp.entity_id)));
                return filtered.length > 0 ? (
                  <div className="fp-stack">
                    {filtered.map((fp, i) => (
                      <FootprintCard
                        key={`${fp.entity_type}:${fp.entity_id}:${fp.reason_predicate_id}:${i}`}
                        footprint={fp}
                        showEntity={true}
                        showPlace={false}
                        onSelectEntity={onSelectEntity}
                      />
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

// ─── Claims tab ───────────────────────────────────────────────────────────────

function ClaimsTab({ claims, placeId, onSelectEntity }: {
  claims: ReturnType<typeof dataStore.claims.getForEntity>;
  placeId: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const sorted = useMemo(() =>
    claims.slice().sort((a, b) => (a.year_start ?? 9999) - (b.year_start ?? 9999)),
    [claims],
  );
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(sorted, PAGE_SIZE);

  if (sorted.length === 0) return <div className="empty-state">No claims.</div>;

  return (
    <div className="flex-col">
      {pageItems.map((c) => (
        <ClaimCard
          key={c.claim_id}
          claim={c}
          entityId={placeId}
          entityType="place"
          onSelectEntity={onSelectEntity}
        />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}


