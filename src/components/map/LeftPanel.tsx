import { useCallback, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { PresenceStatus } from "../../data/dataStore";
import { PRESENCE_LABELS, PRESENCE_COLORS } from "../shared/entityConstants";

interface LeftPanelProps {
  visibleCityCount: number;
  visibleArchCount: number;
  onFitVisible: () => void;
  onCenterSelected: () => void;
  onRandomSite: () => void;
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

    if (activeKind === "doctrine") {
      const fps = dataStore.footprints.getForEntity("doctrine", activeId);
      let affirms = 0, condemns = 0, mixed = 0;
      const cityStances = new Map<string, Set<string>>();
      for (const fp of fps) {
        if (!fp.place_id.startsWith("city:")) continue;
        const cid = fp.place_id.slice(5);
        if (!cityStances.has(cid)) cityStances.set(cid, new Set());
        if (fp.stance) cityStances.get(cid)!.add(fp.stance);
      }
      for (const stances of cityStances.values()) {
        const hasA = stances.has("affirms"), hasC = stances.has("condemns");
        if (hasA && hasC) mixed++;
        else if (hasA) affirms++;
        else if (hasC) condemns++;
      }
      const total = affirms + condemns + mixed;
      if (total === 0) return null;
      return { kind: "doctrine", affirms, condemns, mixed, total };
    }

    if (activeKind === "person") {
      const cityIds = new Set<string>();
      for (const fp of dataStore.footprints.getForEntity("person", activeId)) {
        if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
      }
      for (const r of dataStore.relations.getForEntity("person", activeId)) {
        const othId   = r.source_id === activeId ? r.target_id   : r.source_id;
        const othType = r.source_id === activeId ? r.target_type : r.source_type;
        if (othType === "city") cityIds.add(othId);
      }
      const p = dataStore.people.getById(activeId);
      if (p?.city_of_origin_id) cityIds.add(p.city_of_origin_id);
      return cityIds.size > 0 ? { kind: "person", cities: cityIds.size } : null;
    }

    if (activeKind === "persuasion") {
      const count = dataStore.map.getCumulativeCitiesAtDecade(activeDecade)
        .filter((c) => (c.persuasion_ids ?? []).includes(activeId)).length;
      return count > 0 ? { kind: "persuasion", cities: count } : null;
    }

    if (activeKind === "polity") {
      const count = dataStore.map.getCumulativeCitiesAtDecade(activeDecade)
        .filter((c) => c.polity_id === activeId).length;
      return count > 0 ? { kind: "polity", cities: count } : null;
    }

    if (activeKind === "work") {
      const w = dataStore.works.getById(activeId);
      const cityIds = new Set<string>();
      if (w?.place_written_id?.startsWith("city:")) cityIds.add(w.place_written_id.slice(5));
      for (const rid of w?.place_recipient_ids ?? []) {
        if (rid.startsWith("city:")) cityIds.add(rid.slice(5));
      }
      return cityIds.size > 0 ? { kind: "work", cities: cityIds.size } : null;
    }

    if (activeKind === "event") {
      const e = dataStore.events.getById(activeId);
      const cityIds = new Set<string>();
      if (e?.primary_place_id?.startsWith("city:")) cityIds.add(e.primary_place_id.slice(5));
      for (const r of dataStore.relations.getForEntity("event", activeId)) {
        if (r.source_type === "city") cityIds.add(r.source_id);
        if (r.target_type === "city") cityIds.add(r.target_id);
      }
      return cityIds.size > 0 ? { kind: "event", cities: cityIds.size } : null;
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
      {stats.kind === "doctrine" && (
        <div className="entity-context-stats">
          <span className="ecs-affirm">✓ {stats.affirms} affirm</span>
          <span className="ecs-condemn">✗ {stats.condemns} condemn</span>
          {stats.mixed > 0 && <span className="ecs-mixed">~ {stats.mixed} mixed</span>}
          <span className="ecs-total faint">{stats.total} cities</span>
        </div>
      )}
      {(stats.kind === "person" || stats.kind === "persuasion" || stats.kind === "polity" || stats.kind === "work" || stats.kind === "event") && (
        <div className="entity-context-stats">
          <span className="ecs-cities">🏛 {stats.cities} cit{stats.cities === 1 ? "y" : "ies"}</span>
        </div>
      )}
    </div>
  );
}

// ─── LeftPanel ────────────────────────────────────────────────────────────────

export function LeftPanel({
  visibleCityCount,
  visibleArchCount,
  onFitVisible,
  onCenterSelected,
  onRandomSite,
}: LeftPanelProps) {
  const activeDecade      = useAppStore((s) => s.activeDecade);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const searchQuery       = useAppStore((s) => s.searchQuery);
  const showArcs          = useAppStore((s) => s.showArcs);
  const archaeologyVisible= useAppStore((s) => s.archaeologyLayerVisible);
  const activeFilters     = useAppStore((s) => s.activePresenceFilters);

  const setDecade            = useAppStore((s) => s.setDecade);
  const stepDecade           = useAppStore((s) => s.stepDecade);
  const togglePlayback       = useAppStore((s) => s.togglePlayback);
  const setIsPlaying         = useAppStore((s) => s.setIsPlaying);
  const setPlaybackSpeed     = useAppStore((s) => s.setPlaybackSpeed);
  const setIncludeCumulative = useAppStore((s) => s.setIncludeCumulative);
  const setSearchQuery       = useAppStore((s) => s.setSearchQuery);
  const toggleShowArcs       = useAppStore((s) => s.toggleShowArcs);
  const toggleArch           = useAppStore((s) => s.toggleArchaeologyLayer);
  const toggleFilter         = useAppStore((s) => s.togglePresenceFilter);
  const setAllFilters        = useAppStore((s) => s.setAllPresenceFilters);
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
            {visibleCityCount} cities · {visibleArchCount} sites
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
            <span>AD 0</span>
            <span>AD 800</span>
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
              placeholder="Search city, figure, polity…"
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
            <button type="button" className="action-btn" onClick={onRandomSite}>Random site</button>
            <button type="button" className="action-btn" onClick={clearAll}>Clear selection</button>
            <button
              type="button"
              className={`action-btn${showArcs ? " active" : ""}`}
              onClick={toggleShowArcs}
              title="Draw arcs to related cities"
            >
              {showArcs ? "Hide arcs" : "Show arcs"}
            </button>
            <button
              type="button"
              className={`action-btn${archaeologyVisible ? " active" : ""}`}
              onClick={toggleArch}
            >
              {archaeologyVisible ? "Hide arch." : "Show arch."}
            </button>
          </div>
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
