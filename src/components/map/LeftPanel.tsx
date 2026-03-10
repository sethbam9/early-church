import { useCallback, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { PresenceStatus, PlaceKind } from "../../data/dataStore";
import { PRESENCE_LABELS, PRESENCE_COLORS } from "../shared/entityConstants";

interface LeftPanelProps {
  visiblePlaceCount: number;
  onFitVisible: () => void;
  onCenterSelected: () => void;
  onRandomPlace: () => void;
}

// ─── Entity context banner ────────────────────────────────────────────────────

function EntityContextBanner() {
  const selection    = useAppStore((s) => s.selection);
  const mapFilterType= useAppStore((s) => s.mapFilterType);
  const mapFilterId  = useAppStore((s) => s.mapFilterId);
  const activeDecade = useAppStore((s) => s.activeDecade);
  const clearMapFilter = useAppStore((s) => s.clearMapFilter);

  const activeKind = mapFilterType ?? selection?.kind ?? null;
  const activeId   = mapFilterId   ?? selection?.id   ?? null;

  const stats = useMemo(() => {
    if (!activeKind || !activeId) return null;

    if (activeKind === "person") {
      const fps = dataStore.footprints.getForEntity("person", activeId);
      const placeIds = new Set(fps.map((f) => f.place_id));
      return placeIds.size > 0 ? { kind: "person", places: placeIds.size } : null;
    }

    if (activeKind === "group") {
      const count = dataStore.map.getCumulativePlacesAtDecade(activeDecade)
        .filter((p) => p.group_presence_summary.includes(activeId)).length;
      return count > 0 ? { kind: "group", places: count } : null;
    }

    if (activeKind === "proposition") {
      const ppp = dataStore.propositionPlacePresence.getForProposition(activeId);
      return ppp.length > 0 ? { kind: "proposition", places: ppp.length } : null;
    }

    if (activeKind === "work") {
      const fps = dataStore.footprints.getForEntity("work", activeId);
      return fps.length > 0 ? { kind: "work", places: fps.length } : null;
    }

    if (activeKind === "event") {
      const fps = dataStore.footprints.getForEntity("event", activeId);
      return fps.length > 0 ? { kind: "event", places: fps.length } : null;
    }

    return null;
  }, [activeKind, activeId, activeDecade]);

  if (!activeKind || !activeId || !stats) return null;

  const label = getEntityLabel(activeKind, activeId);

  return (
    <div className="entity-context-banner">
      <div className="entity-context-label">
        <span className="entity-context-name" title={label}>{label}</span>
        {mapFilterType && (
          <button type="button" className="close-btn" onClick={clearMapFilter} title="Clear filter">✕</button>
        )}
      </div>
      {"places" in stats && (
        <div className="entity-context-stats">
          <span className="ecs-cities">🏛 {stats.places} place{stats.places === 1 ? "" : "s"}</span>
        </div>
      )}
    </div>
  );
}

// ─── Place kind chips ─────────────────────────────────────────────────────────

const PLACE_KINDS: PlaceKind[] = ["city", "region", "site", "province", "monastery", "route"];

// ─── LeftPanel ────────────────────────────────────────────────────────────────

export function LeftPanel({
  visiblePlaceCount,
  onFitVisible,
  onCenterSelected,
  onRandomPlace,
}: LeftPanelProps) {
  const activeDecade      = useAppStore((s) => s.activeDecade);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const searchQuery       = useAppStore((s) => s.searchQuery);
  const showArcs          = useAppStore((s) => s.showArcs);
  const activeFilters     = useAppStore((s) => s.activePresenceFilters);
  const placeKindFilter   = useAppStore((s) => s.activePlaceKindFilter);
  const christianOnly     = useAppStore((s) => s.christianOnly);

  const setDecade            = useAppStore((s) => s.setDecade);
  const stepDecade           = useAppStore((s) => s.stepDecade);
  const togglePlayback       = useAppStore((s) => s.togglePlayback);
  const setIsPlaying         = useAppStore((s) => s.setIsPlaying);
  const setPlaybackSpeed     = useAppStore((s) => s.setPlaybackSpeed);
  const setIncludeCumulative = useAppStore((s) => s.setIncludeCumulative);
  const setSearchQuery       = useAppStore((s) => s.setSearchQuery);
  const toggleShowArcs       = useAppStore((s) => s.toggleShowArcs);
  const toggleFilter         = useAppStore((s) => s.togglePresenceFilter);
  const setAllFilters        = useAppStore((s) => s.setAllPresenceFilters);
  const setPlaceKindFilter   = useAppStore((s) => s.setPlaceKindFilter);
  const setChristianOnly     = useAppStore((s) => s.setChristianOnly);
  const toggleLeftPanel      = useAppStore((s) => s.toggleLeftPanel);
  const clearAll             = useAppStore((s) => s.clearAll);

  const decades    = dataStore.map.getDecades();
  const decadeIdx  = Math.max(0, decades.indexOf(activeDecade));
  const allStatuses= dataStore.map.getAllPresenceStatuses();

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDecade(decades[Number(e.target.value)] ?? activeDecade);
    },
    [decades, activeDecade, setDecade],
  );

  const handlePlayStep = (dir: -1 | 1) => {
    setIsPlaying(false);
    stepDecade(dir);
  };

  const allOn  = activeFilters.length === 0;
  const isOn   = (s: PresenceStatus) => allOn || activeFilters.includes(s);
  const toggleAll = () => setAllFilters([]);

  return (
    <>
      {/* Fixed header */}
      <div className="left-panel-head">
        <div style={{ flex: 1 }}>
          <div className="left-panel-eyebrow">Timeline</div>
          <div className="left-panel-title">AD {activeDecade}</div>
          <div className="left-panel-sub">
            {visiblePlaceCount} places
          </div>
        </div>
        <button
          type="button"
          className="panel-dismiss-btn"
          onClick={toggleLeftPanel}
          title="Hide controls"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="left-panel-body">

        {/* Entity context — shown when an entity selection/filter is active */}
        <EntityContextBanner />

        {/* Timeline slider */}
        <div className="timeline-section">
          <div className="timeline-range-row">
            <span>AD {decades[0] ?? 0}</span>
            <span>AD {decades[decades.length - 1] ?? 100}</span>
          </div>
          <input
            type="range"
            className="timeline-slider"
            min={0}
            max={decades.length - 1}
            value={decadeIdx}
            onChange={handleSlider}
          />
          <div className="timeline-controls">
            <button type="button" className="ctrl-btn" title="Previous decade"
              onClick={() => handlePlayStep(-1)}>◀</button>

            <button
              type="button"
              className="ctrl-btn play"
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>

            <button type="button" className="ctrl-btn" title="Next decade"
              onClick={() => handlePlayStep(1)}>▶▶</button>

            <select
              className="speed-select"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value) as 1 | 2 | 4)}
              title="Playback speed"
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </div>
          <div style={{ marginTop: 7 }}>
            <label className="cumul-label">
              <input
                type="checkbox"
                checked={includeCumulative}
                onChange={(e) => setIncludeCumulative(e.target.checked)}
              />
              Include earlier decades
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="search-section">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search place, figure, group…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="close-btn"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >✕</button>
            )}
          </div>
        </div>

        {/* Map actions */}
        <div className="map-actions-section">
          <div className="section-label">Map actions</div>
          <div className="action-grid">
            <button type="button" className="action-btn" onClick={onFitVisible}>Fit visible</button>
            <button type="button" className="action-btn" onClick={onCenterSelected}>Center selected</button>
            <button type="button" className="action-btn" onClick={onRandomPlace}>Random place</button>
            <button type="button" className="action-btn" onClick={clearAll}>Clear selection</button>
            <button
              type="button"
              className={`action-btn${showArcs ? " active" : ""}`}
              onClick={toggleShowArcs}
              title="Draw arcs to related places"
            >
              {showArcs ? "Hide arcs" : "Show arcs"}
            </button>
          </div>
        </div>

        {/* Place kind filter */}
        <div className="presence-section">
          <div className="section-label">
            Filter by place type
            {placeKindFilter && (
              <button
                type="button"
                className="section-label-action"
                onClick={() => setPlaceKindFilter(null)}
              >
                show all
              </button>
            )}
          </div>
          <div className="presence-chips">
            {PLACE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`pchip${placeKindFilter === k ? " active" : ""}`}
                onClick={() => setPlaceKindFilter(placeKindFilter === k ? null : k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Christian toggle */}
        <div className="presence-section">
          <label className="cumul-label">
            <input
              type="checkbox"
              checked={christianOnly}
              onChange={(e) => setChristianOnly(e.target.checked)}
            />
            Christian places only
          </label>
        </div>

        {/* Presence filter — compact chips grid */}
        <div className="presence-section">
          <div className="section-label">
            Filter by presence
            {!allOn && (
              <button
                type="button"
                className="section-label-action"
                onClick={toggleAll}
              >
                show all
              </button>
            )}
          </div>
          <div className="presence-chips">
            {allStatuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`pchip ${s} ${isOn(s) ? "active" : ""}`}
                onClick={() => toggleFilter(s)}
              >
                <span
                  className="pchip-dot"
                  style={{ background: PRESENCE_COLORS[s] ?? "#8e8070" }}
                />
                {PRESENCE_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
