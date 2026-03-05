import { useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/dataStore";
import type { PresenceStatus } from "../../data/dataStore";
import { PRESENCE_LABELS } from "../shared/entityConstants";

interface LeftPanelProps {
  visibleCityCount: number;
  visibleArchCount: number;
  onFitVisible: () => void;
  onCenterSelected: () => void;
  onRandomSite: () => void;
}

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
      {/* Header */}
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

      {/* Timeline */}
      <div className="timeline-section">
        <div className="timeline-range-row">
          <span>AD {decades[0]}</span>
          <span>AD {decades[decades.length - 1]}</span>
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
            className={`ctrl-btn play`}
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
        </div>
        {searchQuery && (
          <div className="search-hit-count">
            Searching: <em>{searchQuery}</em>
          </div>
        )}
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

      {/* Presence filter */}
      <div className="presence-section">
        <div className="section-label">
          Presence status
          {!allOn && (
            <button
              type="button"
              style={{ marginLeft: 8, fontSize: "0.68rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
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
              <span className={`status-dot ${s}`} />
              {PRESENCE_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
