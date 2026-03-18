import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { PresenceStatus, PlaceKind } from "../../data/dataStore";
import type { Stance } from "../../data/types";
import { PRESENCE_LABELS, PRESENCE_COLORS, STANCE_COLORS, STANCE_LABELS, KindIcon } from "../shared/entityConstants";
import { Chip } from "../shared/Chip";
import { Slider } from "../shared/Slider";
import { DropdownSelect } from "../shared/Dropdown";
import { GlobalSearchOverlay } from "../shared/GlobalSearchOverlay";
import { Play, Pause, SkipBack, SkipForward, X, ChevronDown, ChevronUp } from "lucide-react";
import lp from "./LeftPanel.module.css";


interface LeftPanelProps {
  visiblePlaceCount: number;
  onRandomPlace: () => void;
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

// ─── Proposition browser (grouped by topic) ──────────────────────────────────

function PropositionBrowser({ onSelect }: { onSelect: (kind: string, id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const selection = useAppStore((s) => s.selection);

  const topics = useMemo(() => {
    const allTopics = dataStore.topics.getAll();
    return allTopics.filter((t) => {
      const props = dataStore.propositions.getByTopic(t.topic_id);
      return props.some((p) => dataStore.propositionPlacePresence.getForProposition(p.proposition_id).length > 0);
    });
  }, []);

  if (topics.length === 0) return null;

  return (
    <div className={lp.section}>
      <button type="button" className={lp.sectionToggle} onClick={() => setExpanded((v) => !v)}>
        <span className={lp.sectionLabel} style={{ marginBottom: 0 }}>Browse doctrines</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className={lp.topicList}>
          {topics.map((t) => {
            const isOpen = openTopicId === t.topic_id;
            const props = dataStore.propositions.getByTopic(t.topic_id);
            const withPresence = props.filter((p) =>
              dataStore.propositionPlacePresence.getForProposition(p.proposition_id).length > 0
            );
            return (
              <div key={t.topic_id} className={lp.topicGroup}>
                <button
                  type="button"
                  className={`${lp.topicToggle}${isOpen ? ` ${lp.topicToggleOpen}` : ""}`}
                  onClick={() => setOpenTopicId(isOpen ? null : t.topic_id)}
                >
                  <span>{t.topic_label}</span>
                  <span className={lp.topicCount}>{withPresence.length}</span>
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {isOpen && (
                  <div className={lp.topicProps}>
                    {withPresence.map((p) => {
                      const isActive = selection?.kind === "proposition" && selection.id === p.proposition_id;
                      return (
                        <Chip
                          key={p.proposition_id}
                          active={isActive}
                          onClick={() => onSelect("proposition", p.proposition_id)}
                        >
                          {p.proposition_label}
                        </Chip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

        {/* Proposition browser — collapsed at bottom */}
        <PropositionBrowser onSelect={handleGlobalSelect} />

      </div>
    </>
  );
}
