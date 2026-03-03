import { useAppStore } from "../../stores/appStore";
import { churchRowRepo } from "../../data/runtimeData";

const PLAYBACK_SPEEDS = [1, 2, 5] as const;

function yearLabel(year: number): string {
  return `AD ${year}`;
}

export function TimelineControl() {
  const activeDecade = useAppStore((s) => s.activeDecade);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const stepDecade = useAppStore((s) => s.stepDecade);
  const setDecadeByIndex = useAppStore((s) => s.setDecadeByIndex);
  const togglePlayback = useAppStore((s) => s.togglePlayback);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const setIncludeCumulative = useAppStore((s) => s.setIncludeCumulative);

  const buckets = churchRowRepo.yearBuckets;
  const currentIndex = Math.max(0, buckets.indexOf(activeDecade));
  const dateRange = churchRowRepo.dateRangeByYear[String(activeDecade)] ?? "";

  return (
    <section className="control-card timeline-card">
      <div className="timeline-top-row">
        <strong>{yearLabel(activeDecade)}</strong>
        <span className="muted small">{dateRange}</span>
        <span>{currentIndex + 1} / {buckets.length}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, buckets.length - 1)}
        value={currentIndex}
        onChange={(e) => setDecadeByIndex(Number(e.target.value))}
      />
      <div className="timeline-buttons">
        <button type="button" onClick={() => stepDecade(-1)}>Prev</button>
        <button type="button" onClick={togglePlayback}>{isPlaying ? "Pause" : "Play"}</button>
        <button type="button" onClick={() => stepDecade(1)}>Next</button>
      </div>
      <div className="timeline-bottom-row">
        <label>
          Speed
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value) as 1 | 2 | 5)}
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </label>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={includeCumulative}
            onChange={(e) => setIncludeCumulative(e.target.checked)}
          />
          Include earlier decades
        </label>
      </div>
    </section>
  );
}
