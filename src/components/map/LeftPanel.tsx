import { useCallback, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { PresenceStatus, PlaceKind } from "../../data/dataStore";
import type { Stance } from "../../data/types";
import { PRESENCE_LABELS, PRESENCE_COLORS, STANCE_COLORS, STANCE_LABELS, KindIcon } from "../shared/entityConstants";
import { Chip } from "../shared/Chip";
import { Slider } from "../shared/Slider";
import { DropdownSelect } from "../shared/Dropdown";
import { GlobalSearchOverlay } from "../shared/GlobalSearchOverlay";
import { Landmark, Play, Pause, SkipBack, SkipForward, X, Check } from "lucide-react";
import lp from "./LeftPanel.module.css";


interface LeftPanelProps {
  visiblePlaceCount: number;
  onRandomPlace: () => void;
}

// ─── Entity context banner ────────────────────────────────────────────────────

function EntityContextBanner() {
  const selection    = useAppStore((s) => s.selection);
  const setSelection = useAppStore((s) => s.setSelection);
  const activeDecade = useAppStore((s) => s.activeDecade);

  const activeKind = selection?.kind ?? null;
  const activeId   = selection?.id   ?? null;

  const stats = useMemo(() => {
    if (!activeKind || !activeId) return null;

    if (activeKind === "proposition") {
      const ppp = dataStore.propositionPlacePresence.getForProposition(activeId);
      if (ppp.length === 0) return null;
      // Year-filter: only count places whose attestation overlaps the active decade
      const decadeEnd = activeDecade + 9;
      const filtered = ppp.filter((pp) => {
        const s = pp.year_start ?? -9999;
        const e = pp.year_end ?? 9999;
        return s <= decadeEnd && e >= activeDecade;
      });
      let affirm = 0, oppose = 0, mixed = 0;
      for (const entry of filtered) {
        if (entry.stance === "affirms") affirm++;
        else if (entry.stance === "opposes") oppose++;
        else mixed++;
      }
      return { places: filtered.length, affirm, oppose, mixed };
    }

    if (activeKind === "group") {
      const count = dataStore.map.getCumulativePlacesAtDecade(activeDecade)
        .filter((p) => p.group_presence_summary.includes(activeId)).length;
      return count > 0 ? { places: count } : null;
    }

    // person, work, event — use footprints
    const fps = dataStore.footprints.getForEntity(activeKind, activeId);
    const placeIds = new Set(fps.map((f) => f.place_id));
    return placeIds.size > 0 ? { places: placeIds.size } : null;
  }, [activeKind, activeId, activeDecade]);

  if (!activeKind || !activeId || !stats) return null;

  const label = getEntityLabel(activeKind, activeId);
  const isProp = activeKind === "proposition" && "affirm" in stats;

  return (
    <div className={lp.contextBanner}>
      <div className={lp.contextLabel}>
        <span className={lp.contextName} title={label}>
          <KindIcon kind={activeKind} size={13} /> {label}
        </span>
        <button type="button" className={lp.closeBtn} onClick={() => setSelection(null)} title="Dismiss">
          <X size={12} />
        </button>
      </div>
      {isProp && (
        <div className={lp.contextStats}>
          <span className={lp.statAffirm}><Check size={11} /> {(stats as any).affirm} affirm</span>
          {" · "}
          <span className={lp.statOppose}><X size={11} /> {(stats as any).oppose} condemn</span>
          {" · "}
          <span className={lp.statMixed}>~ {(stats as any).mixed} mixed</span>
        </div>
      )}
      <div className={lp.contextStats}>
        <Landmark size={12} /> {stats.places} place{stats.places === 1 ? "" : "s"}
      </div>
    </div>
  );
}

// ─── Place kind chips ─────────────────────────────────────────────────────────

const PLACE_KINDS: PlaceKind[] = ["city", "region", "site", "province", "monastery", "route"];
const STANCE_VARIANT: Record<Stance, "success" | "danger" | "warning" | "unknown"> = {
  affirms: "success",
  opposes: "danger",
  mixed: "warning",
  neutral: "unknown",
  unknown: "unknown",
};

// ─── LeftPanel ────────────────────────────────────────────────────────────────

export function LeftPanel({
  visiblePlaceCount,
  onRandomPlace,
}: LeftPanelProps) {
  const activeDecade      = useAppStore((s) => s.activeDecade);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const includeCumulative = useAppStore((s) => s.includeCumulative);

  const showArcs          = useAppStore((s) => s.showArcs);
  const selection         = useAppStore((s) => s.selection);
  const activeFilters     = useAppStore((s) => s.activePresenceFilters);
  const placeKindFilter   = useAppStore((s) => s.activePlaceKindFilter);
  const christianOnly     = useAppStore((s) => s.christianOnly);
  const mapFilterType     = useAppStore((s) => s.mapFilterType);
  const mapFilterId       = useAppStore((s) => s.mapFilterId);
  const stanceFilter      = useAppStore((s) => s.activePropositionStanceFilters);

  const setDecade            = useAppStore((s) => s.setDecade);
  const stepDecade           = useAppStore((s) => s.stepDecade);
  const togglePlayback       = useAppStore((s) => s.togglePlayback);
  const setIsPlaying         = useAppStore((s) => s.setIsPlaying);
  const setPlaybackSpeed     = useAppStore((s) => s.setPlaybackSpeed);
  const setIncludeCumulative = useAppStore((s) => s.setIncludeCumulative);

  const toggleShowArcs       = useAppStore((s) => s.toggleShowArcs);
  const toggleFilter         = useAppStore((s) => s.togglePresenceFilter);
  const setAllFilters        = useAppStore((s) => s.setAllPresenceFilters);
  const toggleStanceFilter   = useAppStore((s) => s.togglePropositionStanceFilter);
  const clearStanceFilters   = useAppStore((s) => s.clearPropositionStanceFilters);
  const setPlaceKindFilter   = useAppStore((s) => s.setPlaceKindFilter);
  const setChristianOnly     = useAppStore((s) => s.setChristianOnly);
  const toggleLeftPanel      = useAppStore((s) => s.toggleLeftPanel);
  const clearAll             = useAppStore((s) => s.clearAll);
  const setSelection         = useAppStore((s) => s.setSelection);
  const rightPanelVisible    = useAppStore((s) => s.rightPanelVisible);
  const toggleRightPanel     = useAppStore((s) => s.toggleRightPanel);

  const handleGlobalSelect = useCallback((kind: string, id: string) => {
    setSelection({ kind: kind as any, id });
    if (!rightPanelVisible) toggleRightPanel();
  }, [setSelection, rightPanelVisible, toggleRightPanel]);

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

  const hasPresenceFilter = activeFilters.length > 0;
  const isOn = (s: PresenceStatus) => hasPresenceFilter && activeFilters.includes(s);
  const toggleAll = () => setAllFilters([]);
  const hasStanceFilter = stanceFilter.length > 0;

  return (
    <>
      {/* Fixed header */}
      <div className={lp.head}>
        <div className={lp.headLeft}>
          <div className={lp.eyebrow}>Timeline</div>
          <div className={lp.title}>AD {activeDecade}</div>
          <div className={lp.sub}>
            {visiblePlaceCount} places
          </div>
        </div>
        <button
          type="button"
          className={lp.dismissBtn}
          onClick={toggleLeftPanel}
          title="Hide controls"
        >
          <X size={14} />
        </button>
      </div>

      {/* Global entity search */}
      <div className={lp.searchWrap}>
        <GlobalSearchOverlay onSelect={handleGlobalSelect} placeholder="Search entities…" />
      </div>

      {/* Scrollable body */}
      <div className={lp.body}>

        {/* Entity context — shown when an entity selection/filter is active */}
        <EntityContextBanner />

        {/* Timeline slider */}
        <div className={lp.timelineSection}>
          <Slider
            min={0}
            max={decades.length - 1}
            value={decadeIdx}
            onChange={(v) => setDecade(decades[v] ?? activeDecade)}
            minLabel={`AD ${decades[0] ?? 0}`}
            maxLabel={`AD ${decades[decades.length - 1] ?? 100}`}
          />
          <div className={lp.controls}>
            <button type="button" className={lp.ctrlBtn} title="Previous decade"
              onClick={() => handlePlayStep(-1)}><SkipBack size={13} /></button>

            <button
              type="button"
              className={lp.ctrlBtn}
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Play</>}
            </button>

            <button type="button" className={lp.ctrlBtn} title="Next decade"
              onClick={() => handlePlayStep(1)}><SkipForward size={13} /></button>

            <DropdownSelect
              value={String(playbackSpeed)}
              onChange={(v) => setPlaybackSpeed(Number(v) as 1 | 2 | 4)}
              options={[
                { value: "1", label: "1×" },
                { value: "2", label: "2×" },
                { value: "4", label: "4×" },
              ]}
            />
          </div>
        </div>


        {/* Map actions */}
        <div className={lp.actionsSection}>
          <div className={lp.sectionLabel}>Map actions</div>
          <div className={lp.actionGrid}>
            <button type="button" className={lp.actionBtn} onClick={onRandomPlace}>Random place</button>
            <button type="button" className={lp.actionBtn} onClick={clearAll}>Clear selection</button>
            {selection?.kind === "work" && (
              <button
                type="button"
                className={`${lp.actionBtn}${showArcs ? ` ${lp.actionBtnActive}` : ""}`}
                onClick={toggleShowArcs}
                title="Draw arcs to related places"
              >
                {showArcs ? "Hide arcs" : "Show arcs"}
              </button>
            )}
          </div>
        </div>

        {/* Place kind filter */}
        <div className={lp.section}>
          <div className={lp.sectionLabel}>
            Filter by place type
            {placeKindFilter && (
              <button
                type="button"
                className={lp.sectionAction}
                onClick={() => setPlaceKindFilter(null)}
              >
                show all
              </button>
            )}
          </div>
          <div className={lp.chipRow}>
            {PLACE_KINDS.map((k) => (
              <Chip
                key={k}
                active={placeKindFilter === k}
                onClick={() => setPlaceKindFilter(placeKindFilter === k ? null : k)}
              >
                {k}
              </Chip>
            ))}
          </div>
        </div>

        {/* Cumulative + Christian toggles */}
        <div className={lp.section}>
          <label className={lp.cumulLabel}>
            <input
              type="checkbox"
              checked={includeCumulative}
              onChange={(e) => setIncludeCumulative(e.target.checked)}
            />
            Include earlier decades
          </label>
          <label className={lp.cumulLabel}>
            <input
              type="checkbox"
              checked={christianOnly}
              onChange={(e) => setChristianOnly(e.target.checked)}
            />
            Christian places only
          </label>
        </div>

        {/* Proposition stance filter — shown when proposition is filtered or selected */}
        {((mapFilterType === "proposition" && mapFilterId) || selection?.kind === "proposition") && (
          <div className={lp.section}>
            <div className={lp.sectionLabel}>
              Proposition stance
              {hasStanceFilter && (
                <button type="button" className={lp.sectionAction} onClick={clearStanceFilters}>
                  show all
                </button>
              )}
            </div>
            <div className={lp.chipRow}>
              {(Object.entries(STANCE_LABELS) as [string, string][]).map(([stance, label]) => (
                <Chip key={stance}
                  variant={STANCE_VARIANT[stance as Stance]}
                  active={hasStanceFilter && stanceFilter.includes(stance as Stance)}
                  dot={STANCE_COLORS[stance] ?? "#8e8070"}
                  onClick={() => toggleStanceFilter(stance as Stance)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Presence filter — compact chips grid */}
        <div className={lp.section}>
          <div className={lp.sectionLabel}>
            Filter by presence
            {hasPresenceFilter && (
              <button
                type="button"
                className={lp.sectionAction}
                onClick={toggleAll}
              >
                show all
              </button>
            )}
          </div>
          <div className={lp.chipRow}>
            {allStatuses.map((st) => (
              <Chip
                key={st}
                variant={st as any}
                active={isOn(st)}
                dot={PRESENCE_COLORS[st] ?? "#8e8070"}
                onClick={() => toggleFilter(st)}
              >
                {PRESENCE_LABELS[st] ?? st}
              </Chip>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
